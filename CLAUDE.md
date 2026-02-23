# TAi — Teaching Assistant Intelligence

An agentic AI Teaching Assistant for CS6650 Building Scalable Distributed Systems at Northeastern University Vancouver. Built on NanoClaw (fork), runs on AWS Bedrock. This is NOT a chatbot — it's an autonomous teaching agent that maintains graduated student models, discovers misconceptions organically, selects pedagogical strategies, and proactively intervenes.

Supervised by Professor Yvonne Coady. Developer: Yuzheng Shi (MS CS, graduating Aug 2026).

## Quick Context

Single Node.js process connecting WhatsApp (Baileys) to Claude Agent SDK running in Docker containers. Each student group has isolated filesystem and memory. Agents run on AWS Bedrock (CLAUDE_CODE_USE_BEDROCK=1).

## Architecture Overview

```
WhatsApp → SQLite → Message Loop → Docker Container → Claude Agent SDK (Bedrock) → Response
                                         ↓
                              MCP Tools: send_message, schedule_task,
                                         query_knowledge (LeanRAG),
                                         update_competency
```

### Model Strategy (Bedrock)
| Role | Model | When |
|------|-------|------|
| Daily TA conversations | Claude Haiku 4.5 | 80%+ of interactions |
| Complex reasoning / eval | Claude Sonnet 4 | Deep concepts, code review, Shadow Evaluator |
| Voice interview | Nova Sonic | Mock interview sessions (Phase 3) |
| Graph construction | DeepSeek V3.2 | Offline LeanRAG entity/relation extraction |
| Embeddings | Cohere Embed v4 | LeanRAG entity anchoring + clustering |

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/whatsapp.ts` | WhatsApp connection, auth, send/receive |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/config.ts` | Trigger pattern, paths, intervals |
| `src/container-runner.ts` | Spawns Docker containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `container/agent-runner/src/index.ts` | Runs inside container, calls Claude Agent SDK |
| `container/agent-runner/src/ipc-mcp-stdio.ts` | MCP server: messaging, scheduling tools |
| `groups/global/CLAUDE.md` | TAi teaching persona + five-step reasoning loop |
| `groups/global/COMPETENCY_TEMPLATE.md` | Template for per-student mastery tracking |
| `groups/{student}/CLAUDE.md` | Per-student agent instructions |
| `groups/{student}/COMPETENCY.md` | Per-student graduated mastery tracking |

## Course Context: CS6650

**Instructor:** Yvonne Coady (m.coady@northeastern.edu)
**Schedule:** Wed 3:15-5:15 Pacific, Northeastern Vancouver, Room 1524
**Assessment:** Homework 50% (10 assignments) + Midterm/Final Masteries 30% + Final Project 20%
**Mock interviews are the core pedagogy** — weekly 1:1 with TA, students explain code and concepts orally.

### Weekly Topics
1. Introduction and Fundamentals (Go, REST, GCP/AWS)
2. Containers and Concurrency (Docker, cross-compilation)
3. Architecture and Infrastructure (Terraform, MapReduce paper)
4. Fundamentals of Distributed Systems
5. Scalable Service Design
6. Load Testing and Threads
7. Project Proposals
8. Tradeoffs in Scalability (CAP theorem, consistency models)
9. Asynchronous and Serverless (Lambda, Kafka)
10. Deployment and Observability
11. Replication, Partitioning, Consistency (Paxos, Raft)
12. Tradeoffs with Data Storage
14. Practical Considerations (Final Mastery)
15. Poster, Presentation, Report

### Key Technologies
Go (Gin), AWS EC2/ECS, Docker, Terraform, MapReduce, load testing, REST APIs, concurrency, Paxos/Raft, consistent hashing, replication, partitioning, Kafka, Lambda

### Mock Interview Format
TAs ask students about homework code AND weekly concepts. Students must:
- Walk through code and explain design decisions
- Answer conceptual questions about the week's topic
- Discuss readings (papers, chapters)
- Show Piazza posts
- Demonstrate running code

---

## Implementation Phases

### ✅ INFRASTRUCTURE (DONE)
- NanoClaw fork, Docker conversion
- WhatsApp connected and responding
- Bedrock authentication working (.env with AWS credentials)
- Basic agent running

---

### PHASE 1: Agentic TA Core (CURRENT)
*Goal: Transform chatbot into teaching agent. Zero new infrastructure — all through CLAUDE.md, COMPETENCY.md, and NanoClaw's existing primitives.*

#### 1A. Graduated Student Model
- [x] Global CLAUDE.md with teaching persona + five-step reasoning loop
- [x] Main CLAUDE.md updated (Jay → TAi, admin dashboard added)
- [ ] Deploy enhanced COMPETENCY.md with four-dimensional tracking:
  - `confidence` (0.0-1.0 mastery estimate)
  - `stability` (how confirmed — tested once vs multiple times)
  - `context_scope` (theoretical / implementation / debugging / verbal)
  - `demonstrated_via` (socratic_dialogue / code_review / mock_interview / homework)
- [ ] Agent instruction in global CLAUDE.md: after every substantive interaction, update COMPETENCY.md with all four dimensions
- [ ] Verbal vs written gap detection: flag concepts where student has theoretical/implementation scope but NOT verbal scope → mock interview risk

#### 1B. Emergent Misconception Discovery
- [ ] Add misconception tracking section to COMPETENCY.md (starts empty, never pre-loaded)
- [ ] Agent instruction: when student says something contradicting a concept, record it as candidate misconception
- [ ] Distinguish HOLDING vs IDENTIFYING misconception (student discussing it correctly vs believing it)
- [ ] Track remediation attempts and effectiveness
- [ ] When same misconception frequency >= 3, mark as confirmed → agent proactively addresses in future

#### 1C. Teaching Strategy Selection
- [ ] Agent uses COMPETENCY.md to choose strategy per interaction:
  - confidence LOW + stability LOW → EXPLAIN (build foundation)
  - confidence MEDIUM + stability LOW → SOCRATIC (probe and confirm)
  - confidence HIGH + scope missing "verbal" → MOCK PRACTICE (verbal articulation)
  - confidence HIGH + scope missing "implementation" → DEMONSTRATE (code walkthrough)
  - Active misconception detected → CORRECT (targeted remediation)
  - confidence HIGH + stability HIGH → CHALLENGE (push to edge cases)
- [ ] Log strategy used and outcome in COMPETENCY.md Teaching Strategy Log

#### 1D. Proactive Teaching Patrol
- [ ] Schedule daily task (cron 9am weekdays): agent reads COMPETENCY.md, decides who needs intervention
- [ ] Intervention triggers (state-driven, not just timer):
  - 5+ days inactive + deadline approaching → reach out with value
  - Low mastery on this week's topic + mock interview coming → offer practice
  - Concept with high confidence but low stability + 14+ days since last evidence → spaced review
  - Misconception confirmed but not yet remediated → targeted correction
- [ ] 90% of patrols should result in "no action needed" — agent value is judgment, not volume
- [ ] Log all proactive decisions (including "decided NOT to intervene") in Proactive Intervention Log

#### 1E. Mock Interview Practice (Text-Based)
- [ ] Agent can conduct text-based mock interviews based on homework Learning Outcomes
- [ ] Uses COMPETENCY.md to target weak spots and verbal gaps
- [ ] Evaluates answers on 4 dimensions: verbal_clarity, technical_accuracy, depth_of_reasoning, problem_solving_process (1-5 each)
- [ ] Principle: "process over correctness" — reasoning through failure modes with minor errors > reciting correct facts
- [ ] Updates COMPETENCY.md with mock interview scores and verbal scope

**Phase 1 Milestone:** Student asks about Docker. TAi reads COMPETENCY.md (Docker confidence: 0.4, stability: 0.2, scope: ["theoretical"], no verbal). TAi chooses SOCRATIC strategy: "You mentioned Docker uses images and containers. Walk me through what actually happens when you run `docker build` — what's the Dockerfile doing step by step?" After the student answers, TAi updates all four dimensions and notes which teaching approach worked. The next day, TAi's teaching patrol notices the student hasn't practiced verbally and mock interview is in 2 days — sends a proactive message offering a quick practice round.

---

### PHASE 2: LeanRAG Knowledge Graph
*Goal: Give TAi structured course knowledge. Agent answers grounded in course materials, not just Claude's training data.*

#### 2A. Offline Graph Construction
- [ ] Preprocess Obsidian vault (CS6650 materials) → extract entities and relations
  - Lecture slides → Concept nodes, FOLLOWS edges (topic ordering)
  - Assignment specs → LearningObjective nodes, REQUIRES edges
  - Research papers (MapReduce, Paxos, Raft) → authoritative Concept definitions
  - Professor's notes → Concept.emphasis, Concept.analogy fields
  - Previous semester discussion posts (anonymized) → common confusion signals
- [ ] Entity extraction via DeepSeek V3.2 (Bedrock serverless, offline batch)
- [ ] Embedding via Cohere Embed v4 (Bedrock)
- [ ] GMM clustering (cluster_size=20) → aggregated entities
- [ ] Inter-cluster relation generation (threshold τ=3) via DeepSeek V3.2
- [ ] Store as NetworkX graph + pickle serialization (no Neo4j needed for this corpus size)

#### 2B. Query-Time Retrieval
- [ ] Student query → Cohere Embed v4 → Top-N seed entities from G0
- [ ] LCA path traversal through hierarchical graph → subgraph + original text chunks
- [ ] Zero LLM calls at query time — only embedding + graph traversal
- [ ] Difficulty layers based on graph level:
  - G0 entity-level: "What does a Paxos proposer do?"
  - G1 cluster-level: "Compare consensus protocols"
  - G2 theme-level: "Analyze fault tolerance vs scalability tradeoffs"

#### 2C. MCP Integration
- [ ] Python MCP server wrapping LeanRAG (stdio transport)
- [ ] Tool: `query_knowledge(question, difficulty)` → returns structured course knowledge
- [ ] Register in agent-runner's MCP server list
- [ ] Agent uses retrieval results as grounded context, not Claude's general knowledge
- [ ] Claim extraction: agent checks its response against retrieved sources, flags unverified claims

#### 2D. Graph-Informed Teaching
- [ ] Mock interview questions generated from graph: pull concepts from student's weak areas in COMPETENCY.md, retrieve related entities and relations, formulate contextual questions
- [ ] Teaching patrol uses graph to identify prerequisite gaps: if student is weak on Raft, check if Paxos (prerequisite) is strong enough
- [ ] Misconception detection enhanced: when student contradicts a graph concept, higher confidence in misconception identification

**Phase 2 Milestone:** Student asks "How does MapReduce handle node failures?" TAi queries LeanRAG → retrieves MapReduce paper entities + fault tolerance cluster + related assignment context. Response is grounded in Professor Coady's lecture materials, not generic Claude knowledge. TAi cites specific lecture content. Mock interview questions pull from the same graph, targeting the student's specific gaps.

---

### PHASE 3: Voice Interview + Evaluation
*Goal: Replace text-based mock interview with real-time voice. Prove TAi is more effective than a chatbot.*

#### 3A. Nova Sonic Voice Interview
- [ ] Clone aws-samples/sample-voicebot-nova-sonic as starting point
- [ ] Web frontend: Socket.IO + AudioWorklet + 16kHz mono PCM → Nova Sonic (Bedrock)
- [ ] Tool use integration:
  - `query_knowledge_base(topic, difficulty)` → LeanRAG (Phase 2)
  - `get_student_context(student_id)` → reads COMPETENCY.md
  - `save_interview_summary(student_id, scores, flags)` → updates COMPETENCY.md + DynamoDB
- [ ] Session resume at 8-min boundary for 15-20 min interviews
- [ ] WhatsApp trigger: student sends "@TAi mock interview" → agent replies with web link

#### 3B. Shadow Evaluator
- [ ] During interview: Nova Sonic → tool call → Claude Sonnet 4 (text) evaluates each answer
- [ ] Sonnet returns: accuracy score + missed concepts + suggested follow-up direction + difficulty adjustment
- [ ] Nova Sonic naturally adjusts next question based on evaluation
- [ ] Student never sees the evaluation happening — only hears natural follow-up questions
- [ ] Interview rubric: verbal_clarity, technical_accuracy, depth_of_reasoning, problem_solving_process (1-5 each)

#### 3C. Silence Detection & Integrity
- [ ] Silero VAD (avr-vad npm) parallel audio analysis
- [ ] Tiered thresholds: 0-5s normal / 5-10s gentle prompt / 10-20s flagged / 20s+ suspicious
- [ ] Pattern analysis: short silence + keyboard sounds + perfect answer = high suspicion
- [ ] Correlate silence duration with answer quality via Shadow Evaluator
- [ ] All flags logged, never automatic accusations — flagged for instructor review

#### 3D. Evaluation Framework
- [ ] Within-subject alternating treatment: same student, some topics via chatbot, others via agentic TA
- [ ] Bloom's-stratified pre/post assessment: 30 questions across 6 levels × 5 core topics
- [ ] Key hypothesis: agentic TA produces disproportionately larger gains at Analyze/Evaluate/Create levels
- [ ] Process metrics (logged automatically):
  - Proactivity Index (system-initiated / total turns)
  - Strategy Diversity (Shannon entropy across strategies used)
  - Telling@K Rate (% interactions where agent reveals answer within K turns)
  - Cross-Session References (count of references to prior interactions)
- [ ] 7-dimension rubric scored by: Professor Coady (expert), LLM-as-judge (Claude Sonnet, validated against expert)
- [ ] Demo format: side-by-side comparison with "thinking panel" showing agent's reasoning
- [ ] Competency heat map visualization showing progression over time

**Phase 3 Milestone:** Student does a 15-minute voice mock interview on Raft consensus. Nova Sonic asks questions grounded in LeanRAG course content, adapted to student's COMPETENCY.md weak spots. Shadow Evaluator (Sonnet) scores each answer in real-time, adjusting difficulty. After the interview, comprehensive feedback written to COMPETENCY.md with all four dimensions updated. Professor Coady reviews the session transcript and rubric scores on the dashboard. Side-by-side evaluation shows the agentic TA asked follow-up questions targeting specific misconceptions while the chatbot baseline asked generic questions regardless of student state.

---

## Development Commands

```bash
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
docker build -t nanoclaw-agent:latest ./container  # Rebuild agent container
```

## Standards
- TypeScript strict mode, 2-space indentation
- Test with Vitest before committing
- Never expose AWS credentials in logs or code
- Agent must NEVER give direct homework answers — always guide through Socratic method
- Agent must update COMPETENCY.md after every substantive interaction
- Misconceptions discovered organically, never pre-loaded
- Process over correctness: reasoning through failure modes > reciting correct facts