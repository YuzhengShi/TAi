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

### Phase 1: Agentic TA Core
- [x] 1A. Graduated Student Model — four-dimensional COMPETENCY.md (confidence, stability, scope, via)
- [x] 1B. Emergent Misconception Discovery — state machine (holding → identifying → confirmed → remediated)
- [x] 1C. Teaching Strategy Selection — mastery-adaptive strategy table in TEACHING_STRATEGIES.md
- [x] 1D. Proactive Teaching Patrol — 10 intervention triggers, weekday 9am cron, mandatory silence rule
- [x] 1E. Mock Interview Practice (Text-Based) — 4-dimension rubric, process over correctness

### Phase 2: LeanRAG Knowledge Graph
- [x] 2A. Offline Graph Construction — DeepSeek V3.2 extraction, Cohere Embed v4, GMM clustering, NetworkX+pickle
- [x] 2B. Query-Time Retrieval — embedding + graph traversal, zero LLM calls at query time
- [x] 2C. MCP Integration — Python MCP server, `query_knowledge` tool, claim extraction
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
- [ ] EC2 deployment
- [ ] Analytics/admin dashboard

## Known Issues
- `Browsers.macOS('Chrome')` in whatsapp.ts:96 — needs Linux equivalent for EC2
- `osascript` notification in whatsapp.ts:106-108 — macOS only, fails silently on Linux
- CLAUDE.md phase checklists are behind actual implementation (Phase 3 marked not started but is done)
