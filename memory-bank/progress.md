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
- [x] EC2 deployment — t3.xlarge, Elastic IP 52.12.72.115, pm2 process manager, /data EBS volume

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
- [ ] Analytics/admin dashboard

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
- [x] Cloudflare tunnel — auto-captures URL, writes to .env, restarts voice server
- [x] Log rotation — daily, 14 days, compressed (/var/log/nanoclaw/)
- [x] Backup cron — hourly store/ + daily groups/ to S3
- [x] Migration script — scripts/migrate-to-systemd.sh (one-command migration)

## Known Issues
- CLAUDE.md phase checklists are behind actual implementation (Phase 3 marked not started but is done)
- systemd migration script written but not yet executed on EC2
- S3 backup bucket (tai-backups-prod) needs to be created
