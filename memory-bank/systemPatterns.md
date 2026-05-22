# TAi System Patterns

## Architecture

```
WhatsApp (Baileys) → SQLite → Message Loop → Group Queue → Docker Container → Claude Agent SDK (Bedrock)
                                                                    ↓
                                                         MCP Tools (nanoclaw + leanrag)
                                                                    ↓
                                                         IPC (JSON files) → Host processes response
```

Single Node.js host process orchestrates everything. Containers are ephemeral (--rm), one per interaction.

### Group Queue Priority
- Per-group serialization: only one container at a time per group (prevents concurrent COMPETENCY.md writes)
- **Messages before tasks**: `drainGroup()` and `drainWaiting()` process pending student messages before pending scheduled tasks
- **Task preemption**: when a student message arrives while a scheduled task holds the group slot, the task's stdin is closed immediately (`process.stdin.end()`) to expedite exit — no waiting for the 30-min idle timeout
- `runningTask` flag prevents piping student messages into task containers (tasks have their own prompt/context)
- **Piped message safety**: `outputAfterPipe` flag tracks whether agent produced output after messages were piped. If container exits (idle timeout) without responding to piped messages, cursor is NOT advanced — `drainGroup` re-processes them in a new container. Prevents silent message drops on Bedrock hangs.

### WhatsApp Message Splitting
- `splitMessage()` in `whatsapp.ts` splits outbound messages exceeding 4000 chars
- Split priority: paragraph breaks (`\n\n`) → single newlines → sentence boundaries (`. ! ?`) → hard cut
- Minimum chunk size: 30% of max length (avoids tiny leading fragments)
- Chunks sent sequentially via Baileys; failed chunks queued for retry

## Process Management (systemd)

Three systemd services on EC2 (service files in `systemd/` directory):

| Service | Binary | Depends On |
|---------|--------|------------|
| `nanoclaw-main` | `node dist/index.js` | docker.service |
| `nanoclaw-voice` | `npx tsx voice/server.ts` | nanoclaw-main (BindsTo) |
| `cloudflared` | `systemd/start-tunnel.sh` | network-online.target |

- All run as `nanoclaw` user, log to `/var/log/nanoclaw/`
- Tunnel wrapper auto-captures random URL → writes to `.env` → restarts main (not voice — voice doesn't use the URL, but in-flight agent containers have it baked in from spawn time)
- `KillMode=control-group` on voice prevents orphan tsx processes
- Log rotation: daily, 14 days, compressed
- Backups: hourly store/ + daily groups/ to S3 via cron

## Data Flow Patterns

### Message Processing
1. WhatsApp message arrives → stored in SQLite → debounced (1.5s)
2. Group queue checks concurrency limit → spawns container or pipes to active container
3. Container receives messages via stdin (NDJSON) → runs Claude Agent SDK query
4. Agent output streams back via stdout markers → parsed, sent to WhatsApp
5. IPC files (messages/, tasks/) processed by host watcher for side effects

### Secrets Isolation
- `readEnvFile()` reads .env file on disk, does NOT load into process.env
- Secrets passed to containers via stdin, never mounted as files
- Bash subprocesses get secrets stripped (unset commands prepended)
- Only AWS credentials fall back to process.env (for EC2 instance role)

### Container Security Model
- `--cap-drop ALL --security-opt no-new-privileges`
- `--tmpfs /tmp:size=512m,noexec`
- Memory/CPU/PID limits configurable
- Non-main containers: restricted Bash, blocked sensitive file reads, SSRF protection, workspace size limits
- Main container: full project root access for admin operations

### Mount Strategy
| Mount | Container Path | Access | Who |
|-------|---------------|--------|-----|
| Project root | /workspace/project | rw | main only |
| Symlink targets (e.g. /data/groups) | same absolute path | rw | main only (auto-detected) |
| groups/{folder} | /workspace/group | rw | all |
| groups/global | /workspace/global | ro | non-main |
| data/sessions/{folder}/.claude | /home/node/.claude | rw | all |
| data/ipc/{folder} | /workspace/ipc | rw | all |
| leanrag/ | /workspace/leanrag | ro | all (if exists) |
| container/agent-runner/src | /app/src | ro | all |

**Symlink handling (EC2):** On EC2, `groups/` and `data/` are symlinks to `/data/groups/` and `/data/data/` on EBS. Docker preserves symlinks inside bind mounts but their targets don't exist in the container. `container-runner.ts` detects symlinks via `fs.realpathSync()` and mounts the resolved targets at the same absolute path so symlinks resolve naturally inside the container.

### Path Resolution
All paths relative to `process.cwd()`:
- `STORE_DIR` = `{cwd}/store/` (WhatsApp auth + SQLite DB at store/messages.db)
- `GROUPS_DIR` = `{cwd}/groups/`
- `DATA_DIR` = `{cwd}/data/` (ipc/, sessions/, audit/)
- Mount allowlist at `~/.config/nanoclaw/mount-allowlist.json` (outside project)

## Model Routing
- Scheduled tasks (patrol, sync, bootstrap) → Haiku 4.5 (light model, cost saving)
- Student messages → Haiku 4.5 (daily TA, 80%+ of interactions)
- Complex reasoning → Sonnet 4.6 (code review, deep concepts)
- Voice interviews → Nova 2 Sonic (bidirectional streaming)
- Shadow Evaluator → Sonnet 4 (mid-interview scoring, async tool calls)
- Graph construction (offline) → DeepSeek V3.2
- Embeddings → Cohere Embed v4

## Teaching Patterns
- **Socratic-first**: never give direct answers, guide through questions
- **Mastery-adaptive strategy**: LOW→EXPLAIN, MEDIUM→SOCRATIC, HIGH→CHALLENGE
- **Frustration override**: detect frustration → switch from Socratic to direct explanation
- **90% silence rule**: teaching patrol should result in no action 90% of the time
- **Process over correctness**: reasoning through failure > reciting correct facts
- **Misconceptions discovered organically**: never pre-loaded, only recorded when observed

## Session Management
- Claude Agent SDK sessions stored in data/sessions/{folder}/.claude/
- Session resume via `resumeAt` (latest assistant message UUID)
- Force fresh session after 10 queries (prevents context overflow)
- Bedrock 500 error detection → auto-reset session

## Voice Interview Flow
1. Agent sends `start_mock_interview` MCP tool → reads live URL from `groups/global/tunnel-url.txt` (not frozen process.env) → generates HMAC-SHA256 token (1hr, retry budget MAX_ATTEMPTS=5)
2. Student opens link → voice/server.ts validates token, serves frontend
3. Socket.IO connection → `consumeToken()` checks retry budget (not permanently consumed yet)
4. SessionManager created → `manager.start()` awaits NovaSonicSession readiness (first output event)
5. If Nova Sonic returns content filter error: retry up to 2× with 2s delay; `startupPhase` flag prevents `onDone` firing during retries
6. System prompt built from COMPETENCY.md + Canvas assignment + GitHub code + lecture content
7. Bidirectional audio: student 16kHz PCM ↔ Nova Sonic 24kHz PCM; browser audio gated until `ready=true`
8. 5 silence chunks sent upfront to establish audio channel (avoids content filter on fresh session)
9. Mid-interview: `evaluate_answer` async tool → Shadow Evaluator (Sonnet 4) scores answer
10. Difficulty adapts based on scores (easy/medium/hard)
11. Session resume at 7.5min boundary, max 20min total, up to 3 sessions
12. Post-interview: `markTokenCompleted()` + `writeInterviewResults()` only if `durationMinutes > 0 || transcript.length > 0`
13. CompetencyWriter updates COMPETENCY.md + interviews.md + strategy-log.md
14. Key fix: send silence during AI playback to prevent echo feedback loop

### Voice Interview Token Lifecycle
- `generateToken()` → HMAC-SHA256 signed payload, stored in `activeTokens` Map with `attempts=0`
- `consumeToken()` → increments attempts, returns payload if `attempts < MAX_ATTEMPTS` AND not in `completedTokens`
- `markTokenCompleted()` → moves to `completedTokens` Set, permanently locked
- `markTokenCompleted` only called when interview actually ran (duration > 0 or transcript non-empty)
- Cleanup: tokens expire after 1hr (TTL check in consumeToken + periodic cleanup)

### Voice Interview Known Issues
- **Socket.IO disconnect ends interview permanently** — `manager.stop()` fires immediately on disconnect, no reconnect grace period. Token not burned (duration=0 guard) but session state is lost. Fix: add reconnect window (e.g. 30s) before calling stop(), hold manager in a Map keyed by token so browser can reconnect and resume.
- **Nova Sonic content filter** — service-side timing sensitivity. Workaround (5 silence chunks + ready gate + retry) reduces but doesn't eliminate. May still trigger with real browser mic audio patterns.

## Task Scheduler
- Polls every 60s (`SCHEDULER_POLL_INTERVAL`), finds tasks where `next_run <= now`
- `once` tasks: set to `completed` on success, `failed` on error (fixed 2026-04-03; was always `completed`)
- `once` past-timestamp safety: if timestamp is in the past (timezone mismatch), runs in 5 seconds
- `runningTasks` Set prevents double-enqueue during poll intervals
- Pre-advances `next_run` for cron/interval before execution to prevent re-trigger on crash
- IPC types: `schedule_task`, `run_bootstrap`, `pause_task`, `resume_task`, `cancel_task`
- **Output suppression**: scheduled task text output is logged but NEVER sent to students. Only explicit `send_message` MCP/IPC calls reach WhatsApp. `sendMessage` removed from `SchedulerDependencies`.

## Background Automation
- **Teaching patrol**: weekday 9am, reads COMPETENCY.md + COURSE_STATUS.md, 10 intervention triggers
- **Course sync**: every 6h (2am/8am/2pm/8pm), fetches Canvas + GitHub, writes COURSE_STATUS.md
- **LeanRAG sync**: every 6h (src/leanrag-sync.ts), polls Canvas for new lecture files → downloads to cs6650-materials/ → triggers `python -m leanrag.build_graph` incremental rebuild
- **Competency bootstrap**: one-time per student, Canvas grades → initial mastery scores. `hasBootstrapRun` checks for `status='completed'` (not just existence). Re-triggers on restart if previous attempts failed.
- **Memory pruning**: decay-based TTL (permanent/stable/active/session/checkpoint)

## LeanRAG Incremental Build
- Per-chunk content-hash cache: SHA256[:16] of chunk text → extraction results
- Stored in `leanrag/.cache/extraction_store.json` (persistent across runs)
- One-time migration from old corpus-hash-keyed `entities_{hash}.json` files (sorted by mtime)
- Embedding cache keyed by entity-set hash (sorted entity names → SHA256[:16])
- New lectures: only extract/embed new chunks, reuse cached results for unchanged content
- Saves periodic checkpoints during extraction (every SAVE_EVERY_N_CHUNKS)

## SharePoint Transcript Extraction
Script: `container/scripts/ms-auth-browse.mjs` (COPY'd into Docker image at `/opt/scripts/`)

1. CDP `Network.requestWillBeSent` listener registered BEFORE `page.goto()` (critical timing)
2. Captures `x-authorization` or `Authorization` bearer token from any `cdnmedia` request
3. Waits 15s for Stream app to fire media requests
4. Extracts `driveId` (`/drives/(b!...)`) and `itemId` (`/items/([A-Z0-9]{30,})`) from page HTML via regex
5. Calls `/_api/v2.1/drives/{driveId}/items/{itemId}/media/transcripts` → list transcripts
6. Calls `.../transcripts/{id}/content` with `Accept: text/vtt` → full WebVTT transcript
7. Output marker: `TRANSCRIPT_VTT:\n` followed by content (up to 100KB)

Auth flow: cookies from S3 → page.goto → if redirected to login → email → password → Duo MFA (code displayed, user approves on phone) → "Remember me 30 days" checkbox → "Yes, this is my device" → "Don't show again" checkbox → "Stay signed in" → cookies saved back to S3.

Session lasts 30 days. Re-auth command documented in `memory-bank/ec2-deployment.md` §14.

## Lecture Transcript Pipeline

Four scripts in `container/scripts/` (COPY'd to `/opt/scripts/`), run sequentially:

### 1. `fetch-all-transcripts.mjs`
- Fetches Canvas modules → filters SharePoint video links (`northeastern-my.sharepoint.com`)
- Single browser instance, new page per video
- Reuses CDP bearer token + transcript API from `ms-auth-browse.mjs`
- Skips videos with existing `.vtt` files
- Output: `/workspace/extra/course-materials/transcripts/{week}--{title}.vtt`

### 2. `transcribe-fallback.mjs`
- Handles videos without SharePoint auto-generated transcripts
- Downloads video via `/_api/v2.1/drives/{driveId}/items/{itemId}/content` (follows CDN redirect)
- Extracts audio: `ffmpeg -ac 1 -ar 16000 -f wav` (16kHz mono)
- Uploads to `s3://tai-backups-prod/transcribe-input/`
- AWS Transcribe batch job with custom vocabulary `tai-cs6650` (Paxos, Raft, goroutines, etc.)
- Polls until completion, downloads VTT (or builds from JSON fallback)
- Uses `/workspace/extra/tmp-transcribe/` for temp files (videos are 200+ MB, /tmp is 512MB tmpfs)
- Job names include `Date.now()` for re-run safety

### 3. `polish-transcripts.mjs`
- Parses VTT → strips timestamps/cue IDs → merges into prose
- Chunks by ~800 words, preserving timestamp range per chunk
- Each chunk → Haiku 4.5 with domain glossary: fix proper nouns, rejoin split sentences, preserve spoken style
- Output: `transcripts-polished/{name}.txt` + `{name}.timestamps.json`
- `--force` flag to re-polish existing files

### 4. `prepare-transcripts-for-leanrag.mjs`
- Combines polished text with timestamp headers per chunk:
  ```
  [Lecture: Week 3 — Concurrency Fun | 14:30–18:45]
  So goroutines are lightweight threads...
  ```
- Aligns `.txt` chunks 1:1 with `.timestamps.json` entries
- Output: `/workspace/extra/cs6650-materials/transcripts/{name}.txt`
- Files then copied to `cs6650-materials/transcripts/` in project root for LeanRAG pickup

### Pipeline State (2026-05-19)
- 11/11 lectures transcribed (7 from SharePoint auto-transcripts, 4 via AWS Transcribe)
- 153 total chunks with inline citation headers
- Files in `cs6650-materials/transcripts/` ready for next `build_graph` run
- Custom vocabulary `tai-cs6650` active in AWS Transcribe (us-west-2)

## Media Download Flow
1. WhatsApp message with media → `downloadMedia()` in whatsapp.ts
2. SUPPORTED_MEDIA_TYPES: imageMessage, documentMessage, stickerMessage, audioMessage
3. File saved at: `DATA_DIR/ipc/{groupFolder}/media/{msgId}-{originalFileName}` (or `{msgId}.{ext}` if no fileName)
4. Container sees: `/workspace/ipc/media/{filename}` (mount maps DATA_DIR/ipc/{group}/ → /workspace/ipc/)
5. Agent receives: `[User sent a document "REPORT.md". Use your Read tool to view: /workspace/ipc/media/...]`
6. If download fails: `[User sent "REPORT.md" — file could not be downloaded. TAi cannot access this file.]`
7. MIME map includes: text/markdown, text/x-markdown, application/pdf, text/plain, docx, xlsx, pptx, zip, tar, gzip, plus programming types (py, go, java, js, ts, json, csv, html, xml, yaml, c, cpp). Falls back to extracting extension from original fileName when MIME is unknown.

## Dashboard Patterns (planned, not yet implemented)

### Declarative SQL Tool Pattern
Tools defined as JSON: `{ name, description, parameters (JSON Schema), execution: { query, rowTemplate, summaryTemplate, fallback } }`.
Runner is ~80 lines: prepared statement with named params (`@paramName`), `{col}` template substitution on rows, returns structured result. Replace framework-specific imports with Claude tool use format.

### AI Query Bar
1. User types natural language → POST `/api/query-nl`
2. `buildAIPrompt(userPrompt, schemaMarkdown)` — inject full schema as markdown table + SQL rules
3. Haiku 4.5, `temperature=0.1, maxTokens=800` → streams JSON `{sql, explanation}`
4. Execute SQL via better-sqlite3 → return rows as JSON
5. Frontend: SSE for streaming AI output while generating, then result table

### Time-Decay Co-Occurrence (student interaction network)
```
rawScore[a][b] += exp(-deltaSeconds/120) × positionWeight  // 1.0/0.8/0.6/0.4
normalizedScore = rawScore / ((aMsgCount×bMsgCount/total) × lookAheadFactor)
hybridScore = 0.5×(rawScore/maxRaw) + 0.5×(normalizedScore/maxNormalized)
```
Adapts ChatLab's social.ts algorithm. Swap sender_id → jid. Reveals study clusters and isolated students.

## Container Python Libraries
- `/opt/leanrag/bin/python3` venv with: boto3, networkx, numpy, python-dotenv, mcp, requests, python-docx, pymupdf, openpyxl, python-pptx
- System: pdftotext (poppler-utils), ffmpeg, chromium, git, unzip, yt-dlp
- Agent can parse PDFs via `pymupdf` (fitz), DOCX via `python-docx`, both accessible in Bash
- Agent converts Office files via: `/opt/leanrag/bin/python3 /opt/scripts/convert_office.py <path>` → plain text stdout
  - `.docx` → paragraphs + tables (python-docx)
  - `.xlsx` → all sheets as tab-separated rows (openpyxl)
  - `.pptx` → slide text (python-pptx)

## Container Scripts (`container/scripts/` → `/opt/scripts/`)
Scripts are COPY'd into the Docker image (not mounted). Changes require `docker build -t nanoclaw-agent:latest ./container` on EC2.
- `github_api.py` — GitHub API helper. Default: Khoury GHE (`GITHUB_BASE_URL` + `GITHUB_TOKEN`). Pass `"host": "github.com"` in params to switch to public GitHub (`GITHUB_TOKEN_PUBLIC`).
- `tts.py` — Amazon Polly TTS
- `image_gen.py` — Amazon Nova Canvas image generation
- `youtube_transcript.py` — YouTube transcript via yt-dlp + S3 cookies (see below)
- `ms-auth-browse.mjs` — Headless SharePoint authentication (Puppeteer). Full flow: email → password → Duo MFA code → device trust → content. Session saved to S3 (`tai-backups-prod/ms-session.json`), reused on future runs to skip Duo. Handles "Is this your device?" trust prompt automatically.

## YouTube Transcript (yt-dlp + S3 Cookies)
Script: `container/scripts/youtube_transcript.py`

Primary method: `yt-dlp --cookies /tmp/youtube-cookies.txt --write-auto-sub --js-runtimes node:/usr/local/bin/node`
Fallback: external transcript API (if `YT_TRANSCRIPT_URL` + `YT_TRANSCRIPT_TOKEN` configured)

1. Downloads cookies from `s3://tai-backups-prod/youtube-cookies.txt` via boto3
2. Runs yt-dlp with `--write-auto-sub --write-subs --sub-format vtt/best --skip-download --no-check-formats`
3. Critical flag: `--js-runtimes node:/usr/local/bin/node` — yt-dlp 2026.03.17 requires JS runtime for YouTube cipher
4. Parses VTT/SRT/json3 output, deduplicates auto-generated subtitle repeats
5. Caches to `/home/node/youtube/{video_id}.json`
6. MCP tool timeout: 90s (yt-dlp + cipher solving can be slow)

Cookie refresh: export from Chrome ("Get cookies.txt LOCALLY" extension) → upload to S3.
Local script: `scripts/export-youtube-cookies.py` (requires Chrome closed, uses DPAPI decryption on Windows).
Manual upload via EC2: pipe file to EC2 → `docker run` with `@aws-sdk/client-s3` to `PutObject`.
