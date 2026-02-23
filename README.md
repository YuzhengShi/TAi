# TAi — Teaching Assistant Intelligence

An agentic AI Teaching Assistant for **CS6650 Building Scalable Distributed Systems** at Northeastern University Vancouver.

Built on [NanoClaw](https://github.com/gavrielc/nanoclaw) (fork). Runs on AWS Bedrock. This is not a chatbot — it's an autonomous teaching agent that maintains graduated student models, discovers misconceptions organically, selects pedagogical strategies, and proactively intervenes.

**Supervised by:** Professor Yvonne Coady
**Developer:** Yuzheng Shi (MS CS, graduating Aug 2026)

## What Makes This Different

| Chatbot | TAi |
|---------|-----|
| Answers when asked | Proactively reaches out when intervention is needed |
| Treats every student the same | Maintains per-student competency model across 4 dimensions |
| Generic responses from training data | Grounded in course materials via LeanRAG knowledge graph |
| No memory between sessions | Persistent student model tracks mastery, misconceptions, verbal gaps |
| Gives direct answers | Selects teaching strategy (Socratic, explain, challenge) based on student state |

## Architecture

```
WhatsApp → SQLite → Message Loop → Docker Container → Claude Agent SDK (Bedrock) → Response
                                         ↓
                              MCP Tools: send_message, schedule_task,
                                         query_knowledge (LeanRAG),
                                         update_competency
```

Single Node.js process connecting WhatsApp (Baileys) to the Claude Agent SDK running in Docker containers. Each student group has an isolated filesystem and memory. Agents run on AWS Bedrock.

### Model Strategy

| Role | Model | When |
|------|-------|------|
| Daily TA conversations | Claude Haiku 4.5 | 80%+ of interactions |
| Complex reasoning / eval | Claude Sonnet 4 | Deep concepts, code review, Shadow Evaluator |
| Voice interview | Nova Sonic | Mock interview sessions (Phase 3) |
| Graph construction | DeepSeek V3.2 | Offline LeanRAG entity/relation extraction |
| Embeddings | Cohere Embed v4 | LeanRAG entity anchoring + clustering |

## Implementation Phases

### Phase 1: Agentic TA Core (Current)

Transform chatbot into teaching agent using CLAUDE.md, COMPETENCY.md, and existing NanoClaw primitives. No new infrastructure.

- **Graduated Student Model** — Four-dimensional tracking per concept: confidence, stability, context scope, demonstrated via
- **Emergent Misconception Discovery** — Misconceptions recorded organically from student interactions, never pre-loaded
- **Teaching Strategy Selection** — Agent chooses approach (Socratic, explain, challenge, correct, mock practice) based on competency state
- **Proactive Teaching Patrol** — Daily scheduled check: decides who needs intervention and why, 90% of patrols should result in "no action needed"
- **Text-Based Mock Interviews** — Practice sessions targeting weak spots and verbal gaps from COMPETENCY.md

### Phase 2: LeanRAG Knowledge Graph

Give TAi structured course knowledge so answers are grounded in course materials, not just Claude's training data.

- Offline graph construction from lecture slides, assignments, papers, and professor's notes
- Query-time retrieval via embedding + graph traversal (zero LLM calls at query time)
- Graph-informed teaching: mock interview questions from student's weak areas, prerequisite gap detection

### Phase 3: Voice Interview + Evaluation

Real-time voice mock interviews with live evaluation.

- Nova Sonic voice interviews via web frontend
- Shadow Evaluator (Claude Sonnet 4) scores each answer in real-time
- Silence detection for academic integrity
- Within-subject evaluation framework comparing agentic TA vs chatbot baseline

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/whatsapp.ts` | WhatsApp connection, auth, send/receive |
| `src/container-runner.ts` | Spawns Docker containers with mounts |
| `src/group-queue.ts` | Per-group queue with concurrency control |
| `src/task-scheduler.ts` | Scheduled task execution |
| `src/db.ts` | SQLite operations |
| `container/agent-runner/src/index.ts` | Runs inside container, calls Claude Agent SDK |
| `groups/global/CLAUDE.md` | TAi teaching persona + five-step reasoning loop |
| `groups/{student}/CLAUDE.md` | Per-student agent instructions |
| `groups/{student}/COMPETENCY.md` | Per-student graduated mastery tracking |

## Getting Started

### Prerequisites

- Node.js 20+
- [Docker Desktop](https://docker.com/products/docker-desktop)
- [Claude Code](https://claude.ai/download)
- AWS credentials with Bedrock access

### Setup

```bash
git clone https://github.com/YuzhengShi/TAi.git
cd TAi
npm install
claude   # then run /setup
```

### Development

```bash
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
docker build -t nanoclaw-agent:latest ./container  # Rebuild agent container
```

## Course Context

**CS6650 Building Scalable Distributed Systems**
Weekly topics: Go/REST fundamentals, Docker/concurrency, Terraform/MapReduce, distributed systems, scalable service design, load testing, CAP theorem, async/serverless, Paxos/Raft, data storage tradeoffs.

**Mock interviews are the core pedagogy** — weekly 1:1 where students explain code and concepts orally. TAi prepares students for these by targeting verbal gaps identified in the competency model.

## Based On

[NanoClaw](https://github.com/gavrielc/nanoclaw) — a lightweight personal Claude assistant that runs securely in containers. TAi extends it with teaching-specific behavior, AWS Bedrock integration, and the graduated student model.

## License

MIT
