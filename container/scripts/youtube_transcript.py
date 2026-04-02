#!/usr/bin/env python3
"""Fetch YouTube video transcripts via external transcript API service.

Calls the youtube-transcript-api FastAPI service running on a residential IP
to avoid YouTube's datacenter IP blocks.

Input: JSON on stdin with keys:
  - url: YouTube URL or video ID (required)
  - lang: language code (default: "en")
  - max_chars: truncate text to this many chars (optional)

Output: JSON on stdout with transcript text and metadata.
Caches transcripts to /home/node/youtube/ to avoid re-fetching.

Env vars (required):
  - YT_TRANSCRIPT_URL: base URL of the transcript API (e.g. https://yt-transcript.example.com)
  - YT_TRANSCRIPT_TOKEN: auth token for X-Proxy-Token header
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

API_BASE = os.environ.get("YT_TRANSCRIPT_URL", "")
API_TOKEN = os.environ.get("YT_TRANSCRIPT_TOKEN", "")
CACHE_DIR = Path("/home/node/youtube")


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


def api_get(endpoint: str) -> dict:
    url = f"{API_BASE}{endpoint}"
    req = urllib.request.Request(url, headers={"X-Proxy-Token": API_TOKEN})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


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

    # Fetch from external API (residential IP)
    data = api_get(f"/transcript/{video_id}?lang={lang}")

    segments = data.get("segments", [])
    full_text = " ".join(seg.get("text", "") for seg in segments)
    duration = segments[-1]["start"] + segments[-1]["duration"] if segments else 0

    # Cache locally
    cache_data = {
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
    cache_path.write_text(json.dumps(cache_data, indent=2))

    text = full_text
    if max_chars and len(text) > max_chars:
        text = text[:max_chars] + "... [truncated]"

    return {
        "video_id": video_id,
        "cached": False,
        "language": data.get("language"),
        "is_generated": data.get("is_generated"),
        "duration_seconds": round(duration),
        "total_chars": len(full_text),
        "segment_count": len(segments),
        "text": text,
    }


if __name__ == "__main__":
    if not API_BASE or not API_TOKEN:
        print(json.dumps({"error": "YT_TRANSCRIPT_URL and YT_TRANSCRIPT_TOKEN must be set in .env"}))
        sys.exit(1)

    try:
        args = json.loads(sys.stdin.read())
        video_id = extract_video_id(args["url"])
        lang = args.get("lang", "en")
        max_chars = args.get("max_chars")
        result = fetch(video_id, lang, max_chars)
        print(json.dumps(result))
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        try:
            detail = json.loads(body).get("detail", body)
        except Exception:
            detail = body or e.reason
        print(json.dumps({"error": f"Transcript API {e.code}: {detail}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
