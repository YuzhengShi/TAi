#!/usr/bin/env python3
"""YouTube transcript fetching with local caching."""

import json
import sys
import os
import re
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

# Config
API_BASE = "https://yt-transcript.midgard-realm.xyz"
API_TOKEN = "api_token_here"
CACHE_DIR = Path("/home/claude/youtube")
MANIFEST_FILE = CACHE_DIR / "manifest.json"


def ensure_dirs():
    """Create cache directory if needed."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def load_manifest() -> dict:
    """Load the manifest tracking cached transcripts."""
    if MANIFEST_FILE.exists():
        return json.loads(MANIFEST_FILE.read_text())
    return {"videos": {}}


def save_manifest(manifest: dict):
    """Save the manifest."""
    ensure_dirs()
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2))


def extract_video_id(url_or_id: str) -> str:
    """Extract video ID from various YouTube URL formats."""
    # Already an ID
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    
    # youtube.com/watch?v=ID
    match = re.search(r'[?&]v=([a-zA-Z0-9_-]{11})', url_or_id)
    if match:
        return match.group(1)
    
    # youtu.be/ID
    match = re.search(r'youtu\.be/([a-zA-Z0-9_-]{11})', url_or_id)
    if match:
        return match.group(1)
    
    # youtube.com/embed/ID
    match = re.search(r'youtube\.com/embed/([a-zA-Z0-9_-]{11})', url_or_id)
    if match:
        return match.group(1)
    
    return url_or_id  # Return as-is, let API handle it


def api_request(endpoint: str) -> dict:
    """Make authenticated request to transcript API."""
    url = f"{API_BASE}{endpoint}"
    req = urllib.request.Request(url, headers={
        "X-Proxy-Token": API_TOKEN
    })
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection error: {e.reason}"}
    except Exception as e:
        return {"error": str(e)}


def fetch_transcript(video: str, lang: str = "en", force: bool = False) -> dict:
    """Fetch full transcript and save to disk. Returns metadata only (not full text).
    
    Args:
        video: Video ID or URL
        lang: Language code (default: en)
        force: Re-fetch even if cached
    """
    video_id = extract_video_id(video)
    cache_path = CACHE_DIR / f"{video_id}.json"
    
    # Check cache first (unless forcing)
    if not force and cache_path.exists():
        cached = json.loads(cache_path.read_text())
        return {
            "video_id": video_id,
            "status": "already_cached",
            "language": cached.get("language"),
            "duration_seconds": cached.get("duration_seconds"),
            "total_chars": cached.get("total_chars"),
            "segment_count": cached.get("segment_count"),
            "path": str(cache_path)
        }
    
    # Fetch from API
    data = api_request(f"/transcript/{video_id}?lang={lang}")
    
    if "error" in data:
        return data
    
    # Build full text from segments
    segments = data.get("segments", [])
    full_text = " ".join(seg.get("text", "") for seg in segments)
    
    result = {
        "video_id": video_id,
        "language": data.get("language"),
        "language_code": data.get("language_code"),
        "is_generated": data.get("is_generated"),
        "segment_count": len(segments),
        "total_chars": len(full_text),
        "duration_seconds": segments[-1]["start"] + segments[-1]["duration"] if segments else 0,
        "segments": segments,
        "full_text": full_text
    }
    
    # Save to disk
    ensure_dirs()
    cache_path.write_text(json.dumps(result, indent=2))
    
    # Update manifest
    manifest = load_manifest()
    manifest["videos"][video_id] = {
        "language": data.get("language"),
        "segment_count": len(segments),
        "total_chars": len(full_text),
        "duration_seconds": result["duration_seconds"],
        "cached_at": datetime.now().isoformat(),
        "path": str(cache_path)
    }
    save_manifest(manifest)
    
    # Return metadata only - not the full text
    return {
        "video_id": video_id,
        "status": "fetched",
        "language": data.get("language"),
        "duration_seconds": result["duration_seconds"],
        "total_chars": len(full_text),
        "segment_count": len(segments),
        "path": str(cache_path)
    }


def get_text(video: str, max_chars: int = None) -> dict:
    """Get transcript text from cache (fetch first if needed).
    
    Use this when you actually need the text in context.
    For most operations, fetch + local file ops is better.
    """
    video_id = extract_video_id(video)
    cache_path = CACHE_DIR / f"{video_id}.json"
    
    # Fetch if not cached
    if not cache_path.exists():
        fetch_result = fetch_transcript(video)
        if "error" in fetch_result:
            return fetch_result
    
    # Load from cache
    data = json.loads(cache_path.read_text())
    text = data.get("full_text", "")
    
    result = {
        "video_id": video_id,
        "language": data.get("language"),
        "duration_seconds": data.get("duration_seconds"),
        "total_chars": len(text),
        "text": text
    }
    
    # Truncate if requested
    if max_chars and len(text) > max_chars:
        result["text"] = text[:max_chars] + "... [truncated]"
        result["truncated"] = True
    
    return result


def list_cached() -> dict:
    """List all cached transcripts."""
    manifest = load_manifest()
    
    videos = []
    for video_id, meta in manifest.get("videos", {}).items():
        videos.append({
            "video_id": video_id,
            "language": meta.get("language"),
            "duration_seconds": meta.get("duration_seconds"),
            "total_chars": meta.get("total_chars"),
            "cached_at": meta.get("cached_at")
        })
    
    return {
        "cached_videos": videos,
        "total": len(videos)
    }


def search_cached(pattern: str, max_results: int = 10) -> dict:
    """Search through cached transcripts for a pattern."""
    manifest = load_manifest()
    matches = []
    regex = re.compile(pattern, re.IGNORECASE)
    
    for video_id, meta in manifest.get("videos", {}).items():
        path = Path(meta.get("path", ""))
        if not path.exists():
            continue
        
        try:
            data = json.loads(path.read_text())
        except:
            continue
        
        full_text = data.get("full_text", "")
        found = list(regex.finditer(full_text))
        
        if found:
            # Get snippets around matches
            snippets = []
            for m in found[:3]:  # First 3 matches
                start = max(0, m.start() - 50)
                end = min(len(full_text), m.end() + 50)
                snippet = full_text[start:end]
                if start > 0:
                    snippet = "..." + snippet
                if end < len(full_text):
                    snippet = snippet + "..."
                snippets.append(snippet)
            
            matches.append({
                "video_id": video_id,
                "match_count": len(found),
                "snippets": snippets,
                "path": str(path)
            })
            
            if len(matches) >= max_results:
                break
    
    return {
        "pattern": pattern,
        "matches": matches,
        "match_count": len(matches),
        "searched_videos": len(manifest.get("videos", {}))
    }


def get_cached(video_id: str) -> dict:
    """Load a specific transcript from cache."""
    manifest = load_manifest()
    
    if video_id not in manifest.get("videos", {}):
        return {"error": f"Video {video_id} not in cache"}
    
    path = Path(manifest["videos"][video_id]["path"])
    if not path.exists():
        return {"error": f"Cache file missing for {video_id}"}
    
    return json.loads(path.read_text())


def clear_cache() -> dict:
    """Clear all cached transcripts."""
    import shutil
    
    manifest = load_manifest()
    count = len(manifest.get("videos", {}))
    
    if CACHE_DIR.exists():
        shutil.rmtree(CACHE_DIR)
    
    return {"cleared": count}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: youtube.py <command> [args]",
            "commands": {
                "fetch <video> [lang]": "Fetch full transcript, save to disk, return metadata only",
                "fetch <video> --force": "Re-fetch even if cached",
                "text <video> [max_chars]": "Get transcript text (fetches if needed, use sparingly)",
                "list": "List cached transcripts",
                "search <pattern>": "Search cached transcripts (regex)",
                "get <video_id>": "Load full transcript from cache",
                "clear": "Clear all cache"
            },
            "notes": [
                "Default workflow: fetch -> work with local file at /home/claude/youtube/<id>.json",
                "Use grep, head, cat on local files instead of dumping into context"
            ]
        }, indent=2))
        sys.exit(1)
    
    cmd = sys.argv[1].lower()
    args = sys.argv[2:]
    
    try:
        if cmd == "fetch" and args:
            force = "--force" in args
            args = [a for a in args if a != "--force"]
            lang = args[1] if len(args) > 1 else "en"
            result = fetch_transcript(args[0], lang, force)
        elif cmd == "text" and args:
            max_chars = int(args[1]) if len(args) > 1 else None
            result = get_text(args[0], max_chars)
        elif cmd == "list":
            result = list_cached()
        elif cmd == "search" and args:
            result = search_cached(args[0])
        elif cmd == "get" and args:
            result = get_cached(args[0])
        elif cmd == "clear":
            result = clear_cache()
        else:
            result = {"error": f"Unknown command: {cmd}"}
        
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
