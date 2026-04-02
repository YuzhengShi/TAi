---
name: youtube-transcript
description: Fetch transcripts from YouTube videos via residential proxy API. Use when Claude needs to get captions/subtitles from YouTube videos for summarisation, analysis, note-taking, or any task requiring video transcript text. Accepts video IDs or full YouTube URLs. Auto-caches transcripts for local operations.
---

# YouTube Transcript Skill

Fetch and cache YouTube video transcripts for local operations.

## Default Workflow

**Always fetch first, then work locally:**

```bash
# 1. Fetch transcript (returns metadata only, saves full transcript to disk)
python3 youtube.py fetch "https://www.youtube.com/watch?v=VIDEO_ID"

# 2. Work with local file - DON'T dump into context
grep -i "keyword" /home/claude/youtube/VIDEO_ID.json
head -c 3000 /home/claude/youtube/VIDEO_ID.json | python3 -c "import sys,json; print(json.load(sys.stdin)['full_text'][:2000])"

# 3. Use built-in search for multi-video grep
python3 youtube.py search "pattern"
```

This keeps the full transcript out of context while letting you search, summarise, or extract what you need.

## Scripts

All at `/mnt/skills/user/youtube-transcript/scripts/`

### youtube.py

```bash
# Fetch and cache (returns metadata only - no text blob in context)
python3 youtube.py fetch <video_url_or_id> [lang]
python3 youtube.py fetch <video> --force    # Re-fetch even if cached

# Search across all cached transcripts
python3 youtube.py search "pattern"

# List what's cached
python3 youtube.py list

# Load from cache (only when you need text in context)
python3 youtube.py get <video_id>
python3 youtube.py text <video> [max_chars]  # With optional truncation

# Clear cache
python3 youtube.py clear
```

## Cache Location

```
/home/claude/youtube/
├── <video_id>.json    # Full transcript with segments and full_text
└── manifest.json      # Index of cached videos
```

Each cached file contains:
- `full_text` - complete transcript as one string
- `segments[]` - array of `{text, start, duration}` for timestamps
- Metadata: language, duration, char count

## Local File Operations

After fetching, work with the local file:

```bash
# Grep for keywords
grep -i "docker" /home/claude/youtube/VIDEO_ID.json

# Get first N chars of transcript
cat FILE.json | python3 -c "import sys,json; print(json.load(sys.stdin)['full_text'][:3000])"

# Find segment at specific timestamp
cat FILE.json | python3 -c "import sys,json; segs=json.load(sys.stdin)['segments']; print([s for s in segs if 300 < s['start'] < 360])"
```

## Video Input Formats

Accepts any of:
- Video ID: `dQw4w9WgXcQ`
- Full URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- Short URL: `https://youtu.be/dQw4w9WgXcQ`

## Notes

- `fetch` returns metadata only - full transcript stays on disk
- Use `text` command sparingly - only when you actually need transcript in context
- Auto-generated captions available for most videos
- Cache persists for the session, search across multiple videos
