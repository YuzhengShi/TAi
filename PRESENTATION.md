# TAi — Teaching Assistant Intelligence
### CS6650 Building Scalable Distributed Systems · Northeastern University Vancouver
**Developer:** Yuzheng Shi · MS CS · Graduating August 2026
**Supervisor:** Professor Yvonne Coady

---

## The Problem

Every semester, students leave CS6650 having passed assignments but struggling in mock interviews — not because they lack knowledge, but because they never had to *articulate* it under pressure. The gap isn't understanding; it's **verbal fluency with their own reasoning**.

A chatbot doesn't close this gap. It answers questions. It doesn't:
- Know whether a student is stuck or just hasn't started
- Notice that a student can write a MapReduce job but can't explain what the coordinator does
- Reach out two days before a mock interview to a student who hasn't practiced verbally
- Ask the *right* follow-up question based on what this specific student got wrong last week

TAi is built on the thesis that **an agentic TA with a graduated student model produces measurably better Bloom's-level outcomes** — specifically at Analyze, Evaluate, and Create — than a chatbot that responds identically to every student.

---

## Architecture

```
WhatsApp → SQLite → Message Loop → Docker Container → Claude Agent SDK (Bedrock)
                                          ↓
                                MCP Tools available to agent:
                                  send_message       — reaches out proactively
                                  schedule_task      — sets future interventions
                                  query_knowledge    — retrieves from LeanRAG graph
```

**Single Node.js process** connects WhatsApp (Baileys) to the Claude Agent SDK running in isolated Docker containers. Each student group has its own container, filesystem, and memory — no cross-student data leakage.

**Runs on AWS Bedrock** — no Anthropic API keys needed in production, credentials from EC2 role.

### Model Strategy

| Interaction | Model | Rationale |
|-------------|-------|-----------|
| Daily conversations | Claude Haiku 4.5 | Cost-efficient; 80%+ of turns |
| Deep concept / code review | Claude Sonnet 4 | Complex reasoning when needed |
| Graph construction (offline) | DeepSeek V3.2 | Entity/relation extraction from course materials |
| Embeddings | Cohere Embed v4 | Semantic anchoring for LeanRAG |
| Voice interviews (Phase 3) | Nova Sonic | Real-time oral assessment |

---

## What's Built

### Phase 1: Agentic TA Core ✅ (running in production)

The agent isn't a wrapper around Claude — it's a **pedagogical reasoner**. Before every response it executes a six-step reasoning loop:

1. Who is this student? Read COMPETENCY.md
2. What concept is at stake? What's their current mastery?
3. What teaching strategy fits their state right now?
4. Do I need course-specific grounding? Query LeanRAG if so
5. Formulate response — guide, never answer directly
6. Plan follow-up — schedule intervention? Update competency?

**Graduated Student Model** — per-concept tracking across four dimensions:

| Dimension | What It Captures |
|-----------|-----------------|
| `confidence` | 0.0–1.0 mastery estimate |
| `stability` | How confirmed — tested once vs. multiple times |
| `context_scope` | theoretical / implementation / debugging / **verbal** |
| `demonstrated_via` | socratic_dialogue / code_review / mock_interview / homework |

The `verbal` scope flag is the critical one. A student who can implement Raft but has never explained it out loud is a **mock interview risk** — TAi detects this and acts before the interview.

**Teaching Strategy Selection** — driven by competency state, not just the question asked:

| Condition | Strategy |
|-----------|----------|
| confidence LOW + stability LOW | EXPLAIN — build foundation |
| confidence MEDIUM + stability LOW | SOCRATIC — probe and confirm |
| confidence HIGH, verbal scope missing | MOCK PRACTICE — force articulation |
| Active confirmed misconception | CORRECT — targeted remediation |
| confidence HIGH + stability HIGH | CHALLENGE — push to edge cases |

**Proactive Teaching Patrol** — daily scheduled agent run. Reads every student's COMPETENCY.md, decides who needs intervention and why. 90% of patrols should produce "no action needed" — the value is in the 10%, not in sending daily messages.

### Phase 2: LeanRAG Knowledge Graph ✅ (built, integrated)

The problem with using Claude's training data to teach CS6650: Claude doesn't know how *you* teach Paxos. It doesn't know which analogy you use, what the assignment requires, or what the course considers a prerequisite for what.

LeanRAG is a **three-layer hierarchical knowledge graph** built from your actual course materials:

```
G0: Entity layer     — individual concepts (Paxos proposer, MapReduce coordinator, ...)
G1: Cluster layer    — concept groups (consensus protocols, fault tolerance mechanisms, ...)
G2: Theme layer      — broad themes (CAP tradeoffs, scalability patterns, ...)
```

**Build pipeline** (offline, runs once per semester):
1. Load documents from `cs6650-materials/` (lecture slides, assignment specs, papers)
2. Chunk → extract entities + relations via DeepSeek V3.2
3. Embed entities via Cohere Embed v4
4. GMM clustering G0→G1, G1→G2
5. Serialize as NetworkX graph (~11MB) + chunk index (~2.5MB)

**Query time** — zero LLM calls, only:
1. Embed query via Cohere
2. Cosine similarity against G0 entity embeddings
3. LCA (Lowest Common Ancestor) path traversal up the hierarchy
4. Return subgraph + original source text chunks

The agent calls `query_knowledge` when it needs course-specific grounding — assignment requirements, how the course frames a topic, what Professor Coady's materials say about a concept. For general distributed systems explanations it already knows, it skips retrieval and responds directly.

---

## Phase 3: Voice Interviews (Planned)

Real-time oral mock interviews via web frontend:

- **Nova Sonic** conducts the interview, adapts questions to COMPETENCY.md weak spots
- **Shadow Evaluator** (Claude Sonnet 4) scores each answer in real-time — student never sees it
- **Silence detection** via VAD: flags suspiciously timed silences for instructor review (never automatic accusations)
- **WhatsApp trigger**: student sends `@TAi mock interview` → receives web link

---

## Evaluation Framework

The core research question: **does an agentic TA produce disproportionately larger gains at Bloom's higher levels (Analyze / Evaluate / Create) compared to a chatbot baseline?**

**Within-subject alternating treatment**: same student, some topics via chatbot, others via TAi.

**Bloom's-stratified pre/post assessment**: 30 questions × 6 levels × 5 core topics.

**Process metrics** (logged automatically):

| Metric | Definition |
|--------|-----------|
| Proactivity Index | System-initiated turns / total turns |
| Strategy Diversity | Shannon entropy across strategies used |
| Telling@K Rate | % interactions where agent reveals answer within K turns |
| Cross-Session References | Count of references to prior interactions |

**7-dimension rubric** scored by: Professor Coady (expert baseline) + LLM-as-judge (Claude Sonnet, validated against expert scoring).

**Demo format**: side-by-side comparison — chatbot vs TAi on the same student question, with a "thinking panel" showing the agent's six-step reasoning and competency update.

---

## Current Status

| Component | Status |
|-----------|--------|
| WhatsApp + Docker + Bedrock | Running in production |
| Per-student COMPETENCY.md tracking | Active |
| Six-step pedagogical reasoning loop | Active |
| LeanRAG graph (built from CS6650 materials) | Built (11MB graph, 2.5MB index) |
| LeanRAG MCP integration in containers | Integrated, pending activation |
| Proactive patrol scheduling | Infrastructure ready |
| Voice interview frontend | Phase 3 |
| Evaluation framework | Phase 3 |

The system is live. Students are messaging it. The competency model is updating. The graph is built and plumbed into the containers — the next step is activating it by extending the agent instructions to use it consistently and measuring the difference.

---

## Questions for Prof Coady

1. **Evaluation design** — Does the within-subject alternating treatment adequately control for confounds? What would make the comparison convincing to a committee?

2. **Bloom's assessment instrument** — Do the 30 pre/post questions map well enough to CS6650 learning outcomes to detect the effect I'm hypothesizing?

3. **The "telling" problem** — The Telling@K metric tracks when the agent gives direct answers. The global CLAUDE.md instructs it never to. But in practice it sometimes does. Is this a threshold to tune, or a deeper instruction problem?

4. **Ethics / consent** — Students are interacting with an AI TA that tracks their competency state. What disclosure is appropriate? What should the consent process look like for using interaction data in the evaluation?
