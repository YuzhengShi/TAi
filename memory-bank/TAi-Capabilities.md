# TAi — Comprehensive Capability Report

---

## Teaching & Student Support

### Socratic tutoring
The agent never gives direct answers. `groups/global/TEACHING_STRATEGIES.md` defines Socratic depth levels — surface probe → assumption challenge → contradiction exposure → meta-cognition. The agent reads this at Step 3 of its reasoning loop before responding. Every non-greeting response ends with exactly one question. Hard cap: ~150 words per response. Academic integrity rules block submit-ready code.

### Per-student competency tracking (40+ concepts)
`groups/{student}/COMPETENCY.md` — one file per student, initialized from Canvas grades via `src/competency-bootstrap.ts`. Each concept tracks four dimensions: `confidence` (0.0–1.0), `stability` (low/medium/high/confirmed), `context_scope` (theoretical/implementation/debugging/verbal), `demonstrated_via` (socratic/code_review/mock_interview/homework). Updated after every substantive interaction.

### Misconception detection
The misconceptions section of `COMPETENCY.md` starts empty and is never pre-loaded — only filled when the agent directly observes a contradiction. State machine: candidate → holding → identifying → confirmed (frequency ≥ 3) → remediated. Confirmed misconceptions trigger the CORRECT strategy automatically.

### Adaptive teaching strategy
`TEACHING_STRATEGIES.md` defines the full decision matrix:
- confidence LOW → EXPLAIN (build foundation)
- confidence MEDIUM → SOCRATIC (probe and confirm)
- confidence HIGH + missing verbal scope → MOCK PRACTICE
- confidence HIGH + missing implementation → DEMONSTRATE
- active misconception → CORRECT
- confidence HIGH + confirmed stability → CHALLENGE (edge cases)

Strategy history is logged per student so the agent avoids repeating approaches that didn't work.

### Cross-session memory
Two mechanisms: (1) Claude Agent SDK session state persisted to `data/sessions/{folder}/.claude/`, resumed via `resumeAt` UUID on every spawn. (2) SQLite FTS5 memory system — `memory_store` MCP tool writes facts with decay classes (permanent/stable 90d/active 14d/session 24h). Retrieved via porter-stemming FTS search, injected into every container's context before the agent sees anything.

**What gets remembered** — Breakthroughs (permanent), which explanation styles worked (permanent), learning/communication style preferences (permanent), misconception history (COMPETENCY.md), teaching strategy effectiveness (strategy log in COMPETENCY.md).


### Proactive outreach
Weekday 9am cron task per student. Agent reads COMPETENCY.md + COURSE_STATUS.md and checks 10 intervention triggers defined in `COMPETENCY_PROTOCOL.md`: 5+ days inactive + deadline approaching, low mastery + mock interview within 3 days, concept high confidence but untested 14+ days (spaced review), confirmed misconception not yet remediated, etc. 90% silence rule: most patrols result in no action. Only genuine need triggers a message.

### 24/7 availability
Three systemd services with `Restart=on-failure`. WhatsApp via Baileys reconnects automatically. Haiku 4.5 keeps response latency under 5 seconds for typical interactions.

---

## Course System Integration

### Canvas LMS
`src/course-sync.ts` runs every 6 hours, fetches grades, deadlines, submission status, announcements, discussion posts, module structure, wiki pages, uploaded files, and enrolled student list. Also follows up to 10 external links from Canvas content using agent-browser (see below). Writes a structured `COURSE_STATUS.md` to each student's folder. Agent uses `mcp__nanoclaw__canvas_query` for real-time lookups — 20 action types covering assignments, submissions, grades, announcements, discussions, files, syllabus, pages, modules. Identity-bound: students can only query their own data.

### GitHub
`mcp__nanoclaw__github_query` runs `github_api.py`. Supports Khoury GHE (`GITHUB_BASE_URL`) and public GitHub (`github.com`). Actions: list repos, repo tree, commits, commit detail, PRs, PR reviews, CI check runs, file content. Identity-bound to student's registered GitHub username. Course sync also aggregates GitHub activity into `COURSE_STATUS.md`.

### Canvas submission content analysis
Part of the 6-hour sync — fetches recent graded submission bodies, extracts understanding signals (topics explained well vs thin/missing, confusion flags), writes "Submission Content Signals" to `COURSE_STATUS.md`. Teaching patrol uses this to detect students who submitted but don't actually understand their own code.

### External links from Canvas
When the instructor posts a link to a paper, tutorial, documentation, or product page in Canvas, course-sync follows it via agent-browser and summarizes the content into `COURSE_STATUS.md`. The agent can also browse these links on-demand during a student conversation.

### SharePoint & OneDrive access
TAi can access files and videos shared via `northeastern.sharepoint.com` and `northeastern-my.sharepoint.com`. Authentication uses `ms-auth-browse.mjs` — headless Puppeteer script handling Microsoft login → Duo MFA → device trust. Session cookies saved to S3 (`tai-backups-prod/ms-session.json`) and reused, so Duo approval only needed once every 30+ days. Professor Coady can share lecture recordings, assignments, or course materials via SharePoint links and TAi will access them directly.

---

## YouTube Video Transcripts

When the instructor posts a YouTube link in Canvas (lecture recording, tutorial, paper walkthrough), the agent has two dedicated MCP tools:

`mcp__nanoclaw__youtube_info` — calls the official YouTube Data API via `youtube_info.py`. Returns title, description, channel, duration, tags.

`mcp__nanoclaw__youtube_transcript` — calls `youtube_transcript.py` which routes through a **residential IP proxy** (required because YouTube blocks datacenter IPs from transcript access). Returns the full spoken transcript, cached to `/home/node/youtube/` so repeated calls are instant.

`CLAUDE.md` instructs: when encountering any YouTube link — from Canvas, an announcement, or sent by a student — call `youtube_info` first then `youtube_transcript` to get the full content. This means the agent can answer questions grounded in the actual video content, not just the title.

---

## Agent Browser (Web Browsing)

agent-browser is **not an MCP tool** — it's a Claude Code Skill invoked via the `Skill` built-in SDK tool. It runs Playwright + Chromium (installed in the Docker image). Unlike WebFetch (raw HTTP GET), agent-browser actually renders the page — JavaScript executes, dynamic content loads.

Commands:
```
agent-browser open <url>    # navigate
agent-browser snapshot      # DOM snapshot (structured)
agent-browser text          # extract readable text
```

Used for: following external links from Canvas (documentation, papers, product pages the instructor assigns), reading dynamically rendered pages that WebFetch can't handle. Strictly read-only — `CLAUDE.md` forbids clicking submit/post/delete buttons.

---

## LeanRAG Knowledge Graph

LeanRAG runs as a **separate MCP server** — a Python FastMCP process spawned alongside the agent at container start. It loads `graph.pkl` (the pre-built knowledge graph) into memory once and stays resident for the session.

One tool: `mcp__leanrag__query_knowledge(question, difficulty, top_k)`

What it does:
1. Embeds the question via Cohere Embed v4 (Bedrock)
2. Finds nearest seed entities in the G0 entity graph
3. Traverses up through G1 (topic clusters) and G2 (themes) via LCA path
4. Returns: relevant concepts + descriptions + relationships + source material excerpts from Prof. Coady's actual lecture slides and assignment specs

Zero LLM calls at query time — embedding + graph traversal only. Results are grounded in course materials, not Claude's general training data.

The graph is built offline: DeepSeek V3.2 extracts entities and relations from Obsidian lecture notes, assignment specs, and research papers (MapReduce, Paxos, Raft). Cohere Embed v4 embeds entities. GMM clustering produces the hierarchical graph. `src/leanrag-sync.ts` rebuilds it incrementally every 6 hours when Canvas uploads new lecture files.

`CLAUDE.md` mandates: call `mcp__leanrag__query_knowledge` **first** before any other search when a student asks about assignments or lectures. Does not count against the 3-tool-call search limit.

---

## Voice Mock Interviews

### Trigger and link generation
Student says "mock interview" → agent calls `mcp__nanoclaw__start_mock_interview`. The tool reads the live tunnel URL from `groups/global/tunnel-url.txt` (not frozen process.env), loads student context (COMPETENCY.md weak spots + verbal gaps + misconceptions + Canvas submission + GitHub code + lecture content), generates an HMAC-SHA256 signed token (1hr TTL, MAX_ATTEMPTS=5), and sends the student a browser link via WhatsApp.

### Nova Sonic session
Browser connects via Socket.IO → voice server validates token → `SessionManager` starts a `NovaSonicSession`. Nova Sonic (`amazon.nova-2-sonic-v1:0`) handles bidirectional 16kHz→24kHz PCM audio streaming over Bedrock WebSocket. The system prompt is fully personalized: student's name, their specific code choices, their weak concepts, their active misconceptions.

### Shadow Evaluator
Mid-interview, Nova Sonic calls `evaluate_answer` as an **async tool** — Claude Sonnet 4.6 scores each answer on 4 dimensions (verbal_clarity, technical_accuracy, depth_of_reasoning, problem_solving_process) and returns `suggested_follow_up` + `difficulty_adjustment`. No conversational pause — async tool calling means Nova Sonic continues speaking while the evaluation happens.

### Session resume
Hard limit at 7.5 minutes per session, up to 3 sessions (20 minutes total). At each boundary, `buildResumePrompt()` injects the last 20 transcript entries, topics covered, current difficulty, and average scores. Nova Sonic picks up naturally: "Alright, so we were talking about..."

### Post-interview
`writeInterviewResults()` updates COMPETENCY.md with new scores, appends to `interviews.md`, logs strategy to `strategy-log.md`. Only fires if `durationMinutes > 0 || transcript.length > 0` — failed sessions don't consume the token or corrupt the competency file.

---

## Memory & Personalization

**Per-student competency model** — `COMPETENCY.md` on EBS, survives instance replacement, backed up to S3 hourly. Read-write in every container.

**Long-term memory** — SQLite FTS5 `memories` table. Decay classes: permanent (student preferences, identity decisions), stable 90d, active 14d, session 24h, checkpoint 4h. `memory_query` searches via porter stemming. Injected as a context block before every agent invocation.

**What gets remembered** — Breakthroughs (permanent), which explanation styles worked (permanent), learning/communication style preferences (permanent), misconception history (COMPETENCY.md), teaching strategy effectiveness (strategy log in COMPETENCY.md).

---

## Media & Communication

### Reading files students send
- Images — Claude is multimodal, Read tool handles directly
- PDFs — `pymupdf` (fitz) in Python, or `pdftotext` (poppler-utils)
- `.docx/.xlsx/.pptx` — `convert_office.py` (python-docx, openpyxl, python-pptx) → plain text stdout
- Code files (20+ types: .py, .go, .java, .js, .ts, .json, .yaml, .tf, .cpp, etc.) — Read tool directly
- Archives (.zip, .tar, .gz) — `unzip`/`tar` via Bash
- Audio/voice notes — Amazon Transcribe Streaming, injected as `[Voice note transcription: "..."]`

### Generating media to send students
- Voice explanations — `send_voice_message` MCP tool → `tts.py` → Amazon Polly (neural voice) → OGG Opus sent as WhatsApp voice note
- Teaching illustrations — `generate_teaching_image` → `image_gen.py` → Amazon Nova Canvas → PNG sent as WhatsApp image
- Technical diagrams — `render_diagram` → Mermaid CLI + Chromium → PNG sent as WhatsApp image (architecture, sequence, flowcharts)
- Emoji reactions — `react_to_message` on specific message IDs

---

## Instructor Tools (Admin Channel)

The `groups/main/` admin channel has full project root access. Prof. Coady or the developer can:

- **View all student competency files** — read `groups/*/COMPETENCY.md` class-wide
- **Register students** — `register_group` MCP tool creates folder, seeds COMPETENCY.md, triggers Canvas bootstrap
- **Schedule patrols** — `schedule_task` creates cron tasks; `list_tasks`/`pause_task`/`cancel_task` manage them
- **Monitor all interactions** — SQLite `messages.db` stores everything; `data/audit/` JSONL log for all admin ops
- **Update global teaching instructions** — edit `groups/global/CLAUDE.md`, `TEACHING_STRATEGIES.md`, `COMPETENCY_PROTOCOL.md`; changes take effect on next container spawn
- **Query Canvas/GitHub class-wide** — no rate limits or identity restrictions in admin channel
- **Trigger bootstrap manually** — `run_bootstrap` IPC type bypasses the scheduler for immediate re-initialization

---

## Analytics Dashboard (Planned, ~30h)

Not yet built. Seven pages running as Express routes on port 3001:

### Overview
GitHub-style 365-day activity calendar, stat cards (daily avg messages, peak hour/day, streaks, late-night study patterns), daily engagement trend, 24h×7day heatmap.

### Student List
Sortable table with last active, messages this week, avg confidence from COMPETENCY.md, engagement streak, color-coded at-risk badges.

### Student Detail
Personal activity calendar, COMPETENCY.md as bar/radar chart, mock interview scores over time, response latency, FTS5-searchable message history.

### Interaction Network
Force-directed ECharts graph, students as nodes, co-occurrence weight as edges, detects study clusters and isolated students, matchmaking suggestions.

### AI Query Bar
Natural language → Haiku 4.5 → SQL → results. 10 preset queries. Dual natural language / raw SQL mode. SSE streaming.

### Teaching Patrol Log
Timeline of every patrol decision, which trigger fired, whether student responded and how fast, patrol effectiveness metrics.

### Competency Overview
Class-wide heatmap (students × topics), topic difficulty ranking, misconception tracker with frequency and remediation status.

---

## Interface

- Runs on WhatsApp — no app to install, Baileys connects outbound only, no inbound ports
- Works 24/7 — systemd `Restart=on-failure`, event-driven message loop, no polling gaps
- Responds in seconds — Haiku 4.5 for 80%+ of interactions, container reuse within conversations skips spawn overhead
- WhatsApp formatting — single `*bold*`, `_italic_`, ` ```code``` `, no markdown headings, no `[links](url)`, message splitting at 4000 chars for long responses
