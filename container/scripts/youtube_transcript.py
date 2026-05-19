#!/usr/bin/env python3
"""Fetch YouTube video transcripts via yt-dlp with S3 cookie auth.

Primary method: yt-dlp with YouTube cookies from S3 (avoids bot detection).
Fallback: external transcript API on residential IP (if configured).

Input: JSON on stdin with keys:
  - url: YouTube URL or video ID (required)
  - lang: language code (default: "en")
  - max_chars: truncate text to this many chars (optional)

Output: JSON on stdout with transcript text and metadata.
Caches transcripts to /home/node/youtube/ to avoid re-fetching.

Env vars:
  - AWS_REGION: for S3 access (required for cookie method)
  - YT_TRANSCRIPT_URL: base URL of transcript API (fallback)
  - YT_TRANSCRIPT_TOKEN: auth token for fallback API
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error
from pathlib import Path

CACHE_DIR = Path("/home/node/youtube")
COOKIES_S3_KEY = "youtube-cookies.txt"
COOKIES_S3_BUCKET = "tai-backups-prod"

API_BASE = os.environ.get("YT_TRANSCRIPT_URL", "")
API_TOKEN = os.environ.get("YT_TRANSCRIPT_TOKEN", "")


def extract_video_id(url_or_id: str) -> str:
    if re.match(r"^[a-zA-Z0-9_-]{11}$", url_or_id):
        return url_or_id
    for pattern in [
        r"[?&]v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/embed/([a-zA-Z0-9_-]{11})",
    ]:
        m = re.search(pattern, url_or_id)
        if m:
            return m.group(1)
    raise ValueError(f"Could not extract video ID from: {url_or_id}")


def download_cookies_from_s3() -> str | None:
    """Download YouTube cookies from S3, return local file path or None."""
    try:
        import boto3
        s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "us-west-2"))
        local_path = "/tmp/youtube-cookies.txt"
        s3.download_file(COOKIES_S3_BUCKET, COOKIES_S3_KEY, local_path)
        return local_path
    except Exception:
        return None


def fetch_via_ytdlp(video_id: str, lang: str, cookies_path: str) -> dict | None:
    """Fetch transcript using yt-dlp --write-subs. Returns parsed data or None."""
    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        cmd = [
            "yt-dlp",
            "--cookies", cookies_path,
            "--write-auto-sub",
            "--sub-lang", lang,
            "--sub-format", "vtt",
            "--skip-download",
            "--no-warnings",
            "-o", f"{tmpdir}/%(id)s.%(ext)s",
            url,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            return None

        # Find the VTT file
        vtt_files = list(Path(tmpdir).glob(f"*.{lang}.vtt"))
        if not vtt_files:
            # Try auto-generated subtitle variant
            vtt_files = list(Path(tmpdir).glob("*.vtt"))
        if not vtt_files:
            return None

        vtt_content = vtt_files[0].read_text(encoding="utf-8")
        return parse_vtt(vtt_content, video_id)


def parse_vtt(vtt: str, video_id: str) -> dict:
    """Parse VTT content into text and metadata."""
    lines = vtt.strip().split("\n")
    segments = []
    current_start = 0.0
    current_text = []

    for line in lines:
        # Skip WEBVTT header, NOTE lines, cue identifiers
        if line.startswith("WEBVTT") or line.startswith("NOTE") or line.startswith("Kind:") or line.startswith("Language:"):
            continue

        timestamp_match = re.match(
            r"(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})",
            line,
        )
        if timestamp_match:
            # Save previous segment
            if current_text:
                text = " ".join(current_text).strip()
                if text:
                    segments.append({"start": current_start, "text": text})
                current_text = []
            h, m, s, ms = int(timestamp_match.group(1)), int(timestamp_match.group(2)), int(timestamp_match.group(3)), int(timestamp_match.group(4))
            current_start = h * 3600 + m * 60 + s + ms / 1000
        elif line.strip() and not re.match(r"^\d+$", line.strip()):
            # Remove VTT formatting tags
            clean = re.sub(r"<[^>]+>", "", line.strip())
            if clean:
                current_text.append(clean)

    # Final segment
    if current_text:
        text = " ".join(current_text).strip()
        if text:
            segments.append({"start": current_start, "text": text})

    # Deduplicate (auto-generated subs often have repeated lines)
    deduped = []
    seen_texts = set()
    for seg in segments:
        if seg["text"] not in seen_texts:
            deduped.append(seg)
            seen_texts.add(seg["text"])

    full_text = " ".join(seg["text"] for seg in deduped)
    duration = deduped[-1]["start"] if deduped else 0

    return {
        "video_id": video_id,
        "language": "en",
        "duration_seconds": round(duration),
        "total_chars": len(full_text),
        "segment_count": len(deduped),
        "segments": deduped,
        "full_text": full_text,
    }


def api_get(endpoint: str) -> dict:
    """Fallback: fetch from external transcript API."""
    url = f"{API_BASE}{endpoint}"
    req = urllib.request.Request(url, headers={"X-Proxy-Token": API_TOKEN})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def fetch_via_api(video_id: str, lang: str) -> dict:
    """Fallback: fetch transcript via external API (residential IP)."""
    data = api_get(f"/transcript/{video_id}?lang={lang}")
    segments = data.get("segments", [])
    full_text = " ".join(seg.get("text", "") for seg in segments)
    duration = segments[-1]["start"] + segments[-1]["duration"] if segments else 0

    return {
        "video_id": video_id,
        "language": data.get("language"),
        "language_code": data.get("language_code"),
        "is_generated": data.get("is_generated"),
        "duration_seconds": round(duration),
        "total_chars": len(full_text),
        "segment_count": len(segments),
        "segments": segments,
        "full_text": full_text,
    }


def fetch(video_id: str, lang: str = "en", max_chars: int | None = None) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / f"{video_id}.json"

    # Return from cache if available
    if cache_path.exists():
        data = json.loads(cache_path.read_text())
        text = data["full_text"]
        if max_chars and len(text) > max_chars:
            text = text[:max_chars] + "... [truncated]"
        return {
            "video_id": video_id,
            "cached": True,
            "language": data.get("language"),
            "duration_seconds": data.get("duration_seconds"),
            "total_chars": data.get("total_chars"),
            "text": text,
        }

    # Method 1: yt-dlp with S3 cookies
    cookies_path = download_cookies_from_s3()
    data = None
    method = None

    if cookies_path:
        data = fetch_via_ytdlp(video_id, lang, cookies_path)
        if data:
            method = "yt-dlp"

    # Method 2: fallback to external API
    if not data and API_BASE and API_TOKEN:
        data = fetch_via_api(video_id, lang)
        if data:
            method = "api"

    if not data:
        raise RuntimeError(
            "Could not fetch transcript. "
            "yt-dlp failed (cookies missing or expired?) and no fallback API configured. "
            "Re-export YouTube cookies from browser and upload to S3."
        )

    # Cache locally
    cache_path.write_text(json.dumps(data, indent=2))

    text = data["full_text"]
    if max_chars and len(text) > max_chars:
        text = text[:max_chars] + "... [truncated]"

    return {
        "video_id": video_id,
        "cached": False,
        "method": method,
        "language": data.get("language"),
        "duration_seconds": data.get("duration_seconds"),
        "total_chars": data.get("total_chars"),
        "segment_count": data.get("segment_count"),
        "text": text,
    }


if __name__ == "__main__":
    try:
        args = json.loads(sys.stdin.read())
        video_id = extract_video_id(args["url"])
        lang = args.get("lang", "en")
        max_chars = args.get("max_chars")
        result = fetch(video_id, lang, max_chars)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
