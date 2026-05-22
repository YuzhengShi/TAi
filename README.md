# TAi — Teaching Assistant Intelligence

An agentic AI Teaching Assistant for **CS6650 Building Scalable Distributed Systems** at Northeastern University Vancouver.

Built on [NanoClaw](https://github.com/gavrielc/nanoclaw) (fork). Runs on AWS Bedrock. This is not a chatbot — it's an autonomous teaching agent that maintains graduated student models, discovers misconceptions organically, selects pedagogical strategies, conducts voice mock interviews, and proactively intervenes.

**Supervised by:** Professor Yvonne Coady  
**Developer:** Yuzheng Shi (MS CS, graduating Aug 2026)

---

## What Makes This Different

| Chatbot | TAi |
|---------|-----|
| Answers when asked | Proactively reaches out when intervention is needed |
| Treats every student the same | Maintains per-student competency model across 4 dimensions |
| Generic responses from training data | Grounded in course materials via LeanRAG knowledge graph |
| No memory between sessions | Persistent student model tracks mastery, misconceptions, verbal gaps |
| Gives direct answers | Selects teaching strategy (Socratic, explain, challenge) based on student state |
| Text only | Real-time voice mock interviews with live AI evaluation |

---

## Architecture

```
WhatsApp (Baileys) → SQLite → Message Loop → Group Queue → Docker Container → Claude Agent SDK (Bedrock)
                                                                    ↓
                                                         MCP Tools (17+):
                                                           send_message, schedule_task,
                                                           query_knowledge (LeanRAG),
                                                           update_competency, canvas_query,
                                                           github_query, youtube_transcript,
                                                           start_mock_interview, ...
                                                                    ↓
                                                         IPC (JSON files) → Host processes response
```

Single Node.js process orchestrating everything. Containers are ephemeral (`--rm`), one per interaction, with per-group filesystem isolation. Up to 5 concurrent containers.

### Model Strategy

| Role | Model | When |
|------|-------|------|
| Daily TA conversations | Claude Haiku 4.5 | 80%+ of interactions |
| Complex reasoning / eval | Claude Sonnet 4.6 | Deep concepts, code review, Shadow Evaluator |
| Voice interview | Nova 2 Sonic | Real-time bidirectional mock interviews |
| Graph construction | DeepSeek V3.2 | Offline LeanRAG entity/relation extraction |
| Embeddings | Cohere Embed v4 | LeanRAG entity anchoring + clustering |

### Infrastructure

- **EC2**: t3.xlarge (4 vCPU, 16 GB RAM), Elastic IP, 20 GB EBS data volume
- **Process manager**: systemd (nanoclaw-main, nanoclaw-voice, cloudflared)
- **Voice HTTPS**: Cloudflare quick tunnel → localhost:3001
- **Backups**: Hourly auth/DB to S3, daily student data to S3

---

## Implementation Status

### Phase 1: Agentic TA Core ✅

- **Graduated Student Model** — Four-dimensional tracking per concept: confidence (0.0–1.0), stability (low/medium/high/confirmed), context scope (theoretical/implementation/debugging/verbal), demonstrated via (socratic/code_review/mock_interview/homework)
- **Emergent Misconception Discovery** — State machine: candidate → holding → identifying → confirmed (freq ≥ 3) → remediated. Never pre-loaded.
- **Teaching Strategy Selection** — Mastery-adaptive: LOW→EXPLAIN, MEDIUM→SOCRATIC, HIGH+no verbal→MOCK PRACTICE, HIGH+confirmed→CHALLENGE, misconception→CORRECT
- **Proactive Teaching Patrol** — Weekday 9am cron, 10 intervention triggers, 90% silence rule
- **Text-Based Mock Interviews** — 4-dimension rubric, process over correctness

### Phase 2: LeanRAG Knowledge Graph ✅

- **Offline graph construction** — DeepSeek V3.2 extracts entities/relations from 66 course files (lectures, assignments, papers, transcripts). Cohere Embed v4 embeddings. GMM clustering → hierarchical graph (G0 entities → G1 clusters → G2 themes).
- **Zero LLM calls at query time** — Embedding + LCA graph traversal only
- **MCP integration** — `query_knowledge(question, difficulty)` tool in every container via Python MCP server
- **Canvas auto-sync** — Every 6h, polls Canvas for new lecture files, downloads, triggers incremental graph rebuild
- **Incremental builds** — Per-chunk SHA256 content-hash cache, only processes new/changed content

### Phase 3: Voice Interview + Evaluation ✅

- **Nova 2 Sonic Voice Interview** — Bidirectional streaming (16kHz in, 24kHz out), web frontend via Cloudflare tunnel, HMAC-SHA256 token auth with retry budget (MAX_ATTEMPTS=5)
- **Shadow Evaluator** — Claude Sonnet 4.6 scores each answer mid-interview on 4 dimensions (verbal clarity, technical accuracy, depth of reasoning, problem-solving process), adjusts difficulty in real-time. Async — no conversational pause.
- **Session management** — 7.5 min per session, up to 3 sessions (20 min total), automatic resume with context replay
- **Echo prevention** — Silence injection during AI playback, separate audio paths (no communication mode on Android), server-side ready gate
- **Post-interview** — Updates COMPETENCY.md, writes to interviews.md and strategy-log.md. Duration > 0 guard prevents token burn on failed sessions.

---

## Capabilities

### Teaching & Pedagogy
- Socratic tutoring (never gives direct answers, always guides)
- Per-student competency tracking (40+ concepts, 4 dimensions each)
- Adaptive strategy selection based on mastery state
- Misconception detection and targeted remediation
- Cross-session memory (FTS5 with decay classes: permanent/stable/active/session)
- Proactive outreach based on 10 intervention triggers

### Course Integration
- **Canvas LMS** — Grades, deadlines, submissions, announcements, discussions, modules, files. Identity-bound per student. 6h sync writes COURSE_STATUS.md.
- **GitHub** — Khoury GHE + public GitHub. List repos, view code, commits, PRs, CI checks. Identity-bound.
- **YouTube** — Full video transcripts via yt-dlp + S3 cookies
- **SharePoint/OneDrive** — Headless auth (Puppeteer + Duo MFA), session persisted to S3 (30-day lifetime)
- **LeanRAG** — Course knowledge graph from 66 files (lectures, assignments, papers, transcripts)

### Media Handling
- **Inbound**: Voice notes (Transcribe Streaming), images (multimodal), PDFs (pymupdf), Office docs (.docx/.xlsx/.pptx), code files (20+ types), archives
- **Outbound**: Voice notes (Polly TTS → OGG Opus), AI illustrations (Stable Image Core), Mermaid diagrams (Chromium render), formatted WhatsApp messages with auto-splitting at 4000 chars

### Voice Interviews
- Real-time bidirectional voice via browser (mobile-friendly)
- Personalized system prompt built from: student's actual code, weak spots, verbal gaps, active misconceptions, Canvas submission, lecture content
- Live difficulty adaptation via Shadow Evaluator (Sonnet 4.6)
- Session resume across 7.5-min boundaries with transcript + score replay
- Token system with retry budget — failed sessions don't consume attempts

### Lecture Transcript Pipeline
- SharePoint video transcript extraction (CDP bearer token capture + VTT API)
- AWS Transcribe fallback with custom vocabulary (Paxos, Raft, goroutines, etc.)
- Haiku 4.5 post-processing (fix proper nouns, rejoin split sentences)
- Inline citation headers for LeanRAG ingestion

---

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/whatsapp.ts` | WhatsApp connection, auth, send/receive, message splitting |
| `src/container-runner.ts` | Spawns Docker containers with mounts + symlink resolution |
| `src/group-queue.ts` | Per-group queue, message priority over tasks, piped message safety |
| `src/task-scheduler.ts` | Cron/once/interval task execution |
| `src/course-sync.ts` | Canvas + GitHub sync every 6h |
| `src/leanrag-sync.ts` | Canvas file polling → LeanRAG incremental rebuild |
| `src/db.ts` | SQLite: messages, tasks, memories (FTS5), sessions, groups, audit |
| `container/agent-runner/src/index.ts` | Runs inside container, calls Claude Agent SDK |
| `container/agent-runner/src/ipc-mcp-stdio.ts` | MCP server: 17+ tools |
| `voice/server.ts` | Express + Socket.IO voice interview server (port 3001) |
| `voice/nova-sonic.ts` | Bedrock bidirectional stream wrapper |
| `voice/session-manager.ts` | Multi-session orchestration, timer, transcript, resume |
| `voice/shadow-evaluator.ts` | Claude Sonnet async mid-interview scoring |
| `voice/competency-writer.ts` | Post-interview COMPETENCY.md updates |
| `leanrag/` | Knowledge graph: build, query, MCP server (Python) |
| `groups/global/CLAUDE.md` | TAi teaching persona + five-step reasoning loop |
| `groups/{student}/COMPETENCY.md` | Per-student graduated mastery tracking |

---

## Development

### Prerequisites

- Node.js 22+
- Docker
- AWS credentials with Bedrock access (or EC2 instance role)

### Commands

```bash
npm run dev          # Run with hot reload (tsx)
npm run build        # Compile TypeScript
npm run voice        # Start voice interview server
docker build -t nanoclaw-agent:latest ./container  # Rebuild agent container
```

### Deploy

```bash
git push deploy main
ssh -i ~/.ssh/tai-deploy ubuntu@<EC2_IP> \
  "sudo -u nanoclaw bash -lc 'cd ~/TAi && git pull origin main && npm run build' && sudo systemctl restart nanoclaw-main"
```

---

## Course Context

**CS6650 Building Scalable Distributed Systems** — Northeastern University Vancouver  
**Topics**: Go/REST, Docker, Terraform, MapReduce, distributed systems, scalable service design, load testing, CAP theorem, async/serverless (Kafka, Lambda), Paxos/Raft, consistent hashing, replication, partitioning

**Mock interviews are the core pedagogy** — weekly 1:1 where students explain code and concepts orally. TAi prepares students by targeting verbal gaps in the competency model, then conducts practice interviews via real-time voice with live AI evaluation.

---

## Roadmap

- [ ] Deepgram Voice Agent migration (replace Nova Sonic — content filter issues, no barge-in)
- [ ] Instructor dashboard (7 pages: overview, student list, detail, interaction network, AI query bar, patrol log, competency heatmap)
- [ ] Evaluation framework (within-subject alternating treatment, Bloom's-stratified pre/post, process metrics)
- [ ] Graph-informed teaching (prerequisite gap detection, graph-driven mock interview questions)

---

## Based On

[NanoClaw](https://github.com/gavrielc/nanoclaw) — a lightweight personal Claude assistant that runs securely in containers. TAi extends it with teaching-specific agentic behavior, AWS Bedrock integration, voice interviews, course system integration, and the graduated student model.

## License

MIT
