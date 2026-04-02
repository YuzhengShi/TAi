"""YouTube video info via Data API v3. Returns title, description, channel, duration, tags."""
import json
import sys
import os
import re

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests not installed"}))
    sys.exit(1)

API_KEY = os.environ.get('YOUTUBE_API_KEY', '')
API_URL = 'https://www.googleapis.com/youtube/v3/videos'


def extract_video_id(url):
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/v/([a-zA-Z0-9_-]{11})',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def parse_duration(iso_duration):
    """Convert ISO 8601 duration (PT1H2M3S) to human readable."""
    if not iso_duration:
        return None
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso_duration)
    if not m:
        return iso_duration
    h, mins, s = m.group(1), m.group(2), m.group(3)
    parts = []
    if h:
        parts.append(f"{h}h")
    if mins:
        parts.append(f"{mins}m")
    if s:
        parts.append(f"{s}s")
    return ' '.join(parts) or '0s'


def get_video_info(video_id):
    """Fetch video details from YouTube Data API v3."""
    resp = requests.get(API_URL, params={
        'key': API_KEY,
        'id': video_id,
        'part': 'snippet,contentDetails,statistics',
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    items = data.get('items', [])
    if not items:
        return {"error": "Video not found"}

    item = items[0]
    snippet = item.get('snippet', {})
    content = item.get('contentDetails', {})
    stats = item.get('statistics', {})

    description = snippet.get('description', '')

    return {
        "video_id": video_id,
        "title": snippet.get('title'),
        "channel": snippet.get('channelTitle'),
        "published_at": snippet.get('publishedAt'),
        "duration": parse_duration(content.get('duration')),
        "tags": (snippet.get('tags') or [])[:15],
        "view_count": stats.get('viewCount'),
        "description": description[:3000],
        "description_truncated": len(description) > 3000,
        "url": f"https://www.youtube.com/watch?v={video_id}",
    }


try:
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)
    if not API_KEY:
        print(json.dumps({"error": "YOUTUBE_API_KEY not set. Get one from Google Cloud Console > APIs & Services > Credentials."}))
        sys.exit(1)

    req = json.loads(raw)
    url = req.get("url", "").strip()

    if not url:
        print(json.dumps({"error": "url required"}))
        sys.exit(1)

    video_id = extract_video_id(url)
    if not video_id:
        print(json.dumps({"error": f"Could not extract video ID from: {url}"}))
        sys.exit(1)

    result = get_video_info(video_id)
    print(json.dumps(result, indent=2, default=str))

except requests.exceptions.HTTPError as e:
    print(json.dumps({"error": f"YouTube API error: {e.response.status_code} {e.response.text[:300]}"}))
    sys.exit(1)
except Exception as e:
    print(json.dumps({"error": f"{type(e).__name__}: {e}"}))
    sys.exit(1)
