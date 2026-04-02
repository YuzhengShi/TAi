# YouTube Transcript API

A simple REST API service that fetches YouTube video transcripts. Designed to run on a residential IP to bypass YouTube's cloud IP blocks.

## Why This Exists

YouTube blocks requests from cloud IPs (like Claude's sandbox), so fetching transcripts directly fails. This service runs on your residential IP and proxies the requests, making YouTube transcripts accessible to Claude.

## What Can I Do With This?

Once set up as a Claude skill, you can ask Claude things like:

- "Summarise this YouTube video: [URL]"
- "What does this video say about [topic]?"
- "Create notes from this lecture: [URL]"
- "Find timestamps where they discuss [subject]"
- "Get the transcript and search for mentions of [keyword]"
- "Turn this video into bullet points I can review later"
- "Extract quotes from this interview about [topic]"

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/transcript/{video}` | Get transcript with timestamps |
| GET | `/transcript/{video}/text` | Get transcript as plain text |
| GET | `/transcripts/{video}` | List available transcripts |

## Quick Start

```bash
# Build
docker build -t youtube-transcript-api .

# Run locally
docker run -p 8000:8000 -e PROXY_AUTH_TOKEN=your-token youtube-transcript-api

# Test
curl -H "X-Proxy-Token: your-token" http://localhost:8000/health
```

## Usage Examples

### Get transcript with timestamps

```bash
curl -H "X-Proxy-Token: your-token" \
  "https://yt-transcript.yourdomain.com/transcript/dQw4w9WgXcQ"
```

Response:
```json
{
  "video_id": "dQw4w9WgXcQ",
  "language": "English",
  "language_code": "en",
  "is_generated": true,
  "segments": [
    {"text": "We're no strangers to love", "start": 18.0, "duration": 3.5},
    ...
  ]
}
```

### Get plain text transcript

```bash
curl -H "X-Proxy-Token: your-token" \
  "https://yt-transcript.yourdomain.com/transcript/dQw4w9WgXcQ/text"
```

### List available transcripts

```bash
curl -H "X-Proxy-Token: your-token" \
  "https://yt-transcript.yourdomain.com/transcripts/dQw4w9WgXcQ"
```

### Specify language

```bash
curl -H "X-Proxy-Token: your-token" \
  "https://yt-transcript.yourdomain.com/transcript/dQw4w9WgXcQ?lang=es"
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PROXY_AUTH_TOKEN` | Yes | `changeme` | Auth token for API access |
| `UPSTREAM_PROXY` | No | - | Optional upstream proxy URL |

## Deploy with Cloudflare Tunnel

Add to your tunnel config:
```yaml
- hostname: yt-transcript.yourdomain.com
  service: http://youtube-transcript-api:8000
```

---

## Claude Skill

This repo includes a Claude skill (`skill/`) that lets Claude fetch and work with YouTube transcripts efficiently.

### How It Works

The skill uses a **fetch-first, work-locally** approach to avoid blowing out Claude's context window:

1. **Fetch** - Downloads full transcript, saves to `/home/claude/youtube/<video_id>.json`, returns metadata only (not the full text)
2. **Work locally** - Claude uses `grep`, `head`, `cat` on the local file instead of dumping everything into context
3. **Search** - Built-in search across all cached transcripts

This means a 30-minute video transcript (~30k chars) doesn't eat your context - Claude just works with the file on disk.

### Skill Setup

1. Deploy this service on a residential IP (or any IP not blocked by YouTube)
2. Expose via Cloudflare Tunnel or similar
3. Add your domain to Claude's allowed network list in settings
4. Edit `skill/scripts/youtube.py`:
   - Update `API_BASE` with your domain
   - Update `API_TOKEN` with your `PROXY_AUTH_TOKEN` value
5. Zip the `skill/` folder and rename to `.skill` extension
6. Import into Claude via Settings → Skills

### Skill Commands

```bash
# Fetch transcript (saves to disk, returns metadata only)
python3 youtube.py fetch <video_url_or_id> [lang]
python3 youtube.py fetch <video> --force    # Re-fetch even if cached

# Search across all cached transcripts (regex)
python3 youtube.py search "pattern"

# List cached transcripts
python3 youtube.py list

# Load from cache (only when you need text in context)
python3 youtube.py get <video_id>
python3 youtube.py text <video> [max_chars]

# Clear cache
python3 youtube.py clear
```

### Example Workflow

```bash
# 1. Fetch (returns metadata, full transcript saved to disk)
python3 youtube.py fetch "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
# → {video_id: "dQw4w9WgXcQ", status: "fetched", total_chars: 1847, path: "/home/claude/youtube/dQw4w9WgXcQ.json"}

# 2. Work with local file
grep -i "love" /home/claude/youtube/dQw4w9WgXcQ.json
cat /home/claude/youtube/dQw4w9WgXcQ.json | python3 -c "import sys,json; print(json.load(sys.stdin)['full_text'][:500])"

# 3. Search across multiple cached videos
python3 youtube.py search "never gonna give"
```

### Cache Location

```
/home/claude/youtube/
├── <video_id>.json    # Full transcript with segments
└── manifest.json      # Index of cached videos
```

## License

MIT
