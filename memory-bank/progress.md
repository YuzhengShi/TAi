# TAi Development Progress

## Completed

### Infrastructure
- [x] NanoClaw fork, Docker conversion
- [x] WhatsApp connected (Baileys, multi-file auth in store/auth/)
- [x] Bedrock authentication (auto-enable when AWS creds present, no Anthropic key)
- [x] Container orchestration (security hardening, resource limits, per-group isolation)
- [x] SQLite database (messages, tasks, memories with FTS5, sessions, groups, audit)
- [x] IPC system (JSON files in data/ipc/{group}/, host↔container communication)
- [x] Group queue with concurrency control (MAX_CONCURRENT_CONTAINERS=5)
- [x] Docker networking (nanoclaw-net bridge network)
- [x] EC2 deployment — t3.xlarge, Elastic IP 52.12.72.115, systemd process manager, /data EBS volume

### Phase 1: Agentic TA Core
- [x] 1A. Graduated Student Model — four-dimensional COMPETENCY.md (confidence, stability, scope, via)
- [x] 1B. Emergent Misconception Discovery — state machine (holding → identifying → confirmed → remediated)
- [x] 1C. Teaching Strategy Selection — mastery-adaptive strategy table in TEACHING_STRATEGIES.md
- [x] 1D. Proactive Teaching Patrol — 10 intervention triggers, weekday 9am cron, mandatory silence rule
- [x] 1E. Mock Interview Practice (Text-Based) — 4-dimension rubric, process over correctness

### Phase 2: LeanRAG Knowledge Graph
- [x] 2A. Offline Graph Construction — DeepSeek V3.2 extraction, Cohere Embed v4, GMM clustering, NetworkX+pickle
- [x] 2A+. Incremental builds — per-chunk SHA256 content-hash cache (extraction_store.json), one-time migration from old corpus-hash caches
- [x] 2B. Query-Time Retrieval — embedding + graph traversal, zero LLM calls at query time
- [x] 2C. MCP Integration — Python MCP server, `query_knowledge` tool, claim extraction
- [x] 2C+. Canvas auto-sync — src/leanrag-sync.ts polls Canvas for new lecture files (6h interval), downloads to cs6650-materials/, triggers incremental leanrag.build_graph
- [ ] 2D. Graph-Informed Teaching — graph-driven mock questions, prerequisite gap detection, enhanced misconception detection

### Phase 3: Voice Interview + Evaluation
- [x] 3A. Nova 2 Sonic Voice Interview — bidirectional streaming, async tool calling, session resume (7.5min × 3)
- [x] 3B. Shadow Evaluator — Claude Sonnet 4 mid-interview scoring, 4-dimension rubric, difficulty adaptation
- [x] 3C. Silence Detection & Integrity — (partially via Nova Sonic VAD, echo suppression with silence injection)
- [ ] 3C. Full Silero VAD analysis — tiered thresholds, keyboard sound detection, suspicious pattern flagging
- [ ] 3D. Evaluation Framework — within-subject alternating treatment, Bloom's-stratified pre/post, process metrics

### Feature Expansion (all done)
- [x] Voice STT (Amazon Transcribe Streaming) + TTS (Amazon Polly)
- [x] Reactions, message IDs for targeting
- [x] Image sending, AI image generation (Nova Canvas), Mermaid diagrams
- [x] YouTube transcripts (external FastAPI via nanoclaw-net)
- [x] Competency bootstrap (Canvas grades → initial COMPETENCY.md)
- [x] Course sync (Canvas + GitHub, every 6 hours, writes COURSE_STATUS.md)
- [x] Memory system (FTS5, decay classes, MCP tools)
- [x] Identity binding (Canvas user ID + GitHub username, database-verified)

## Not Started
- [ ] 2D. Graph-informed teaching (graph-driven mock questions, prerequisite gaps)
- [ ] 3C. Full Silero VAD with tiered thresholds
- [ ] 3D. Evaluation framework (within-subject study, Bloom's assessment, process metrics)
- [ ] Analytics/admin dashboard — **design complete** (see memory-bank/dashboard.md). Stack: Express routes on voice server port 3001 + ECharts CDN + vanilla HTML. ~25h estimate. ChatLab codebase at D:\ChatLab-main analyzed as reference implementation.

## Bug Fixes (2026-04-02)
- [x] Nova Sonic credential fix — conditional spread for EC2 instance role (voice/nova-sonic.ts)
- [x] EC2 crash fix — try-catch around container log writing in EventEmitter callback (src/container-runner.ts)
- [x] Document download: text/markdown MIME map, original filename preservation, download failure notification (src/channels/whatsapp.ts)
- [x] Unregistered JID logging — WARN when message from unregistered group (src/index.ts)
- [x] Haiku model ID — ANTHROPIC_MODEL_LIGHT env var with correct -v1:0 suffix
- [x] MIME map expanded — 15 programming types (py, go, java, js, ts, json, csv, html, xml, yaml, c, cpp) + fallback extracts extension from original filename when MIME unknown
- [x] Empty message guard — skip messages with no content from non-bot senders (src/channels/whatsapp.ts)
- [x] pymupdf added to container Dockerfile — agent can now parse PDFs programmatically via Python (Docker image rebuilt on EC2)
- [x] Duplicate message fix — killed stale `npm run dev` process (PID 31193) running alongside pm2. Two host processes both connected to WhatsApp = double responses

### Infrastructure Hardening (2026-04-02)
- [x] systemd services — nanoclaw-main, nanoclaw-voice, cloudflared (replaces pm2)
- [x] Cloudflare tunnel — auto-captures URL, writes to .env, restarts main process (not voice)
- [x] Log rotation — daily, 14 days, compressed (/var/log/nanoclaw/)
- [x] Backup cron — hourly store/ + daily groups/ to S3
- [x] Migration script — scripts/migrate-to-systemd.sh (one-command migration)

## Bug Fixes (2026-04-03)
- [x] Docker symlink mount fix — main container couldn't see groups/ or data/ (EBS symlinks). Mount resolved targets at same absolute path so symlinks resolve inside container (container-runner.ts)
- [x] Once-task failure tracking — updateTaskAfterRun now marks failed once-tasks as 'failed' instead of 'completed' (db.ts, task-scheduler.ts)
- [x] Bootstrap re-trigger — hasBootstrapRun now requires status='completed', so failed bootstraps re-seed on restart (competency-bootstrap.ts)
- [x] Once-task past-timestamp — if timestamp is in the past (timezone mismatch), run in 5s instead of skipping (ipc.ts)
- [x] run_bootstrap IPC type — admin agent can trigger bootstraps directly without scheduling (ipc.ts)
- [x] DB cleanup — deleted 13 zombie active duplicate tasks, re-marked 4 falsely-completed bootstraps as failed
- [x] Scheduled task output leak — bootstrap/patrol text output leaked to student WhatsApp. Removed sendMessage from scheduler streaming callback; output is logged only. Only explicit send_message MCP/IPC calls reach students. (task-scheduler.ts, index.ts)
- [x] WhatsApp message truncation — long messages silently cut off at ~4096 chars. Added splitMessage() that splits at paragraph/newline/sentence boundaries, threshold 4000 chars. (whatsapp.ts)
- [x] Delayed message delivery — student messages blocked behind scheduled tasks for up to 30min (idle timeout). Group queue now closes task stdin when student message arrives, and drains messages before tasks. (group-queue.ts)

## Bug Fixes (2026-04-17)
- [x] Office file support — agent couldn't read .docx/.xlsx/.pptx (binary format). Created `container/scripts/convert_office.py` (python-docx, openpyxl, python-pptx → stdout). Added MIME detection in `whatsapp.ts` with hint: `Use /opt/leanrag/bin/python3 /opt/scripts/convert_office.py <path>`. Added `openpyxl python-pptx` to Dockerfile. Docker image rebuilt on EC2.
- [x] Stale interview URL fix — `VOICE_BASE_URL` was frozen at container spawn time. Fix: `start-tunnel.sh` now writes live URL to `groups/global/tunnel-url.txt`; `ipc-mcp-stdio.ts` `start_mock_interview` tool reads from that file at call time (checks `/workspace/global/tunnel-url.txt` then `/workspace/project/groups/global/tunnel-url.txt`).
- [x] Interview token burn on failure — token permanently consumed before Nova Sonic even started. Fix: changed `interview-token.ts` from single-use to retry budget (MAX_ATTEMPTS=5) with separate `completedTokens` Set for permanent consumption. `markTokenCompleted()` added.
- [x] Token marked completed on zero-duration interviews — `markTokenCompleted` was called after `manager.start()` and unconditionally in `onDone`. Fix: only call when `summary.durationMinutes > 0 || summary.transcript.length > 0` (`voice/server.ts`).
- [x] Nova Sonic content filter workaround — real-time browser audio chunks before Nova Sonic responds triggered content filter. Fix: send 5 silence chunks upfront in `nova-sonic.ts`; gate browser audio with `ready` flag until first output event received; `start()` now awaits first output event (readyPromise) so errors propagate as thrown exceptions; retry logic in `session-manager.ts` (MAX_START_RETRIES=2, 2s delay, `startupPhase` flag prevents `onDone` double-fire on retry).
- [x] Shell script executable bit — `git checkout`/`git pull` from Windows strips `+x` from `.sh` files. Fix: `git update-index --chmod=+x` on all `.sh` files (now stored as `100755`); `cloudflared.service` ExecStart uses `/bin/bash script.sh` (immune to missing `+x`); added `.gitattributes` enforcing LF for `.sh` files.
- [x] Cloudflare tunnel stale since 2026-04-03 — tunnel hadn't restarted because `start-tunnel.sh` lost executable bit during earlier `git checkout`. Fixed by `chmod +x` + systemctl restart. New URL written to `.env` and `tunnel-url.txt`.

## Bug Fixes (2026-05-19)
- [x] Piped message silent drop fix — messages piped to active container that got no response (Bedrock hang) were silently dropped because cursor advanced past them. Now tracks `outputAfterPipe`; cursor only advances if agent actually responded. Unprocessed messages get re-queued via `drainGroup`.
- [x] YouTube transcript tool — replaced external residential-IP API with yt-dlp + S3 cookie auth. Cookies exported from Chrome, uploaded to `s3://tai-backups-prod/youtube-cookies.txt`. Script uses `--js-runtimes node:/usr/local/bin/node` for YouTube cipher solving.
- [x] Agent `build_graph` prohibition — added rule to `groups/global/CLAUDE.md` preventing agent from autonomously running `python -m leanrag.build_graph` (expensive, developer-triggered only)
- [x] Canvas deep review — TAi downloaded 8 new files: 2 homework specs (midterm-mastery-part-ii, fundamentals-background), 1 lecture (boolean-blindness.md), 5 YouTube background transcripts (network, cloud, SQL, threads, git)

## Redeployment (2026-05-16)
- [x] New AWS account (931197777315) — terraform-managed infrastructure
- [x] EC2 provisioned: i-03febb8df529c8049, EIP 52.13.181.61, IAM role with Bedrock+S3+Marketplace
- [x] Full setup: Node 22, Docker 29.5, systemd services, cloudflared tunnel
- [x] WhatsApp paired (pairing code method)
- [x] Bedrock models subscribed (Haiku 4.5, Sonnet 4.6) via CLI
- [x] Canvas token + course ID (239676) configured
- [x] S3 bucket tai-backups-prod created
- [x] Store symlink mount fix (container-runner.ts — STORE_DIR added to symlink resolution)
- [x] sqlite3 added to container Dockerfile
- [x] MS SharePoint auth script (container/scripts/ms-auth-browse.mjs) — complete with device trust handling
- [x] SharePoint Duo MFA completion — auth flow works, session saved to S3, future runs skip Duo
- [x] Duo "Remember me 30 days" + "Don't show again" checkboxes — session now lasts 30 days
- [x] SharePoint transcript extraction — CDP bearer token capture + non-cached transcript API → full WebVTT output (verified on 3 videos: 136KB/195KB/322KB)
- [x] GitHub tokens configured (Khoury GHE + public GitHub) — 2026-05-19
- [x] YouTube transcript tool — yt-dlp + S3 cookies (replaces external API + residential proxy)
- [ ] Remaining .env secrets (YOUTUBE_API_KEY for Data API, voice secret)
- [ ] Student group re-registration
- [ ] LeanRAG graph rebuild — 66 files in cs6650-materials/ (20 lectures, 27 transcripts, 17 homeworks, 2 other). Partial extraction cache exists (54/868 chunks done before interrupted)
- [ ] Backup cron configuration
- [ ] Deepgram Voice Agent migration — replace Nova Sonic for mock interviews. Deepgram docs MCP added to `.mcp.json` for research.

## Lecture Transcript Pipeline (2026-05-18/19)
- [x] `fetch-all-transcripts.mjs` — bulk VTT download from SharePoint via Canvas modules (7/11 had auto-transcripts)
- [x] `polish-transcripts.mjs` — Haiku 4.5 post-processing: fix proper nouns, rejoin split sentences, preserve spoken style
- [x] `prepare-transcripts-for-leanrag.mjs` — adds inline `[Lecture: Week X — Title | start–end]` headers for citation
- [x] `transcribe-fallback.mjs` — AWS Transcribe with custom vocabulary for 4 videos lacking SharePoint transcripts (weeks 4, 5 parts 1+2, 8)
- [x] IAM policy updated with batch Transcribe permissions (StartTranscriptionJob, GetTranscriptionJob, CreateVocabulary, GetVocabulary, DeleteVocabulary)
- [x] Custom vocabulary `tai-cs6650` created (Paxos, Raft, goroutines, Piazza, etc.)
- [x] All 11 lectures transcribed, polished, and placed in `cs6650-materials/transcripts/` (153 chunks total)
- [x] Docker image includes `@aws-sdk/client-bedrock-runtime` + `@aws-sdk/client-transcribe`
- [x] YouTube background transcripts (5) + homework specs (2) + lecture file (1) added via Canvas deep review
- [ ] LeanRAG `build_graph` needs to be run to ingest all files (partial cache at 54/868 chunks)

## Known Issues
- CLAUDE.md phase checklists are behind actual implementation (Phase 3 marked not started but is done)
- ~~S3 backup bucket (tai-backups-prod) needs to be created~~ DONE 2026-05-16
- Cross-campus students (ajin, jassem, sihui) have different Canvas course ID — bootstrap can't find them in Canvas roster
- ~~**SharePoint Duo MFA**~~ FIXED 2026-05-16 — Device trust prompt handled, session saved to S3, "Remember me 30 days" checkbox added 2026-05-18
- ~~**SharePoint transcript extraction broken**~~ FIXED 2026-05-18 — CDP bearer token capture before page.goto(), non-cached API, WebVTT output
- ~~**GitHub tokens PLACEHOLDER**~~ FIXED 2026-05-19 — Both Khoury GHE and public GitHub tokens set
- ~~**Piped messages silently dropped**~~ FIXED 2026-05-19 — `outputAfterPipe` tracking prevents cursor advancement when agent hangs
- **Voice interview: "connection lost" → interview instantly ends** — when Socket.IO disconnects (network drop, page refresh), `manager.stop()` fires → `onDone(buildSummary())` → emits `interview_done` to a dead socket. Token is NOT burned (duration=0 guard), but the browser shows "connection lost" and the interview ends permanently. No reconnect logic exists. Needs: (a) reconnect window before calling stop(), (b) token re-use on reconnect within that window.
- **Nova Sonic content filter not fully resolved** — the workaround (5 upfront silence chunks + ready gate + retry) reduces frequency but real mic audio from browser may still trigger it in some cases. Root cause is service-side timing sensitivity in Nova Sonic. **Evaluating Deepgram as replacement.**
- ~~Scheduled task output leaks to students~~ FIXED 2026-04-03
- ~~Long WhatsApp messages truncated~~ FIXED 2026-04-03
- ~~Student messages delayed behind scheduled tasks~~ FIXED 2026-04-03
