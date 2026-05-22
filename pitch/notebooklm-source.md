# Presentation Source Document for NotebookLM

## Instructions

Generate a 7-slide presentation. Match the blue and green data/tech/futuristic aesthetic from the uploaded reference images: three-column card layouts, IT/brain icon usage, callout box style. Background should use the 4 uploaded images for a cybernetics theme.

Slide 6 (Real Usage) should be left mostly empty — just a title and a bottom caption. I will manually add screenshots.

---

## Slide 1: Title

**Title:** TAi — Agentic AI Teaching Assistant on AWS Bedrock

**Subtitle:** Deployed in CS 6650 Building Scalable Distributed Systems

**Bottom line:** Yuzheng Shi | MS CS, Northeastern University | Supervised by Prof. Yvonne Coady

---

## Slide 2: Architecture

**Visual:** A left-to-right flow diagram with these nodes connected by arrows:

WhatsApp → Node.js Orchestrator → Docker Container (per student, isolated) → Claude Agent SDK → MCP Tools

MCP Tools branches into three:
- Canvas LMS (grades, deadlines, submissions)
- GitHub (student code, commits, PRs)
- LeanRAG Knowledge Graph (course materials)

**Callout box (bottom-right), label "All Bedrock":**
- Daily tutoring: Claude Haiku 4.5
- Evaluation: Claude Sonnet 4.6
- Voice interview: Nova Sonic
- Embeddings: Cohere Embed v4
- Graph construction: DeepSeek V3.2

---

## Slide 3: Competency Model + Proactive Intervention

**Two-column layout:**

**Left column — "Persistent Student Model":**
Each student has a mastery file tracking every course concept across four dimensions:
- Confidence (0.0–1.0)
- Stability (how many times confirmed)
- Context scope (theoretical / implementation / debugging / verbal)
- Demonstrated via (dialogue / code review / mock interview / homework)

Agent reads before every response. Updates after every interaction.

**Right column — "Proactive Intervention":**
Every weekday morning, agent autonomously:
1. Reads student mastery + Canvas deadlines
2. Checks 10 intervention triggers
3. Decides: reach out or stay silent

Triggers include:
- 5+ days inactive + deadline approaching
- Low mastery on this week's topic + mock interview coming
- High confidence but untested for 14+ days (spaced review)
- Confirmed misconception not yet remediated

90% of the time: no action. Only intervenes when there's genuine need.

---

## Slide 4: Voice Mock Interview

**Visual:** A flow showing the voice interview pipeline:

Student clicks link → Browser (16kHz audio) ↔ Nova Sonic (real-time bidirectional) → Response (24kHz audio)

Parallel async path: Nova Sonic → evaluate_answer tool call → Shadow Evaluator (Claude Sonnet) → scores + difficulty adjustment → feeds back to Nova Sonic

**Three callout cards:**

Card 1 — "Personalized Questions"
Questions generated from student's competency model weak spots and verbal gaps

Card 2 — "Shadow Evaluator"
Sonnet scores each answer on 4 dimensions via async tool calls — zero conversational pause

Card 3 — "Adaptive Difficulty"
Easy → Medium → Hard adjusts live based on evaluator scores

**Bottom note:** 15-20 minutes per session. Session resume at 7.5min boundaries. All grounded in course materials.

---

## Slide 5: Knowledge Graph (LeanRAG)

**Visual:** A hierarchical graph diagram with three levels:

- G0 (bottom): Entity nodes — individual concepts (e.g., "Paxos Proposer", "Docker Layer Caching", "Raft Log Replication")
- G1 (middle): Cluster nodes — topic groups (e.g., "Consensus Protocols", "Containerization")
- G2 (top): Theme nodes — high-level themes (e.g., "Fault Tolerance", "Scalability")

Arrows showing: Student query → Cohere Embed → seed entities in G0 → LCA traversal up to G1/G2 → return subgraph + source text

**Three callout cards:**

Card 1 — "Grounded, Not Hallucinated"
All answers cite professor's actual lecture slides, assignment specs, and research papers (MapReduce, Paxos, Raft)

Card 2 — "Zero LLM at Query Time"
Only embedding lookup + graph traversal. Fast and deterministic.

Card 3 — "Auto-Syncs with Canvas"
Every 6 hours, pulls new lecture files from Canvas LMS and incrementally rebuilds the graph

---

## Slide 6: Real Usage

**Title:** Real Student Usage

**Layout:** Leave the center area empty (I will add WhatsApp conversation screenshots manually showing: homework questions, grade queries, mock interview links, proactive outreach messages)

**Bottom caption (large, bold):**
10 students | 2 months deployed | 1 developer | Entirely on AWS Bedrock

---

## Slide 7: AWS Skill Builder Fit

**Two-column layout with a "before/after" feel:**

**Left column — "Skill Builder Today":**
15+ features, none share student state:
- SimuLearn (AI customer dialogue, 200+ scenarios)
- Meeting Simulator (AI voice personas)
- Learning Assistant (scoped to current lab only)
- Lab Maker (generates labs, no learner history)
- Jam Journeys, Builder Labs, Cloud Quest, Microcredentials, Exam Prep...

Problem: Fail IAM on a SimuLearn → open a Builder Lab → Lab has no idea you just failed IAM. Signals die where they're born.

**Right column — "With Intelligence Layer":**
Shared competency model connects all features via event bus.

Three mapping arrows:
- TAi Competency Model → Intelligence Layer (cross-feature learner state, per-concept mastery)
- TAi Voice Interview → Live Technical Review (operate real AWS services, Shadow Evaluator scores live)
- TAi Knowledge Graph → Grounded in re:Invent content + AWS documentation (timestamp-level citations)

**Bottom callout box:**
"85% of the code is already running in production. Would love 15 minutes to demo the live system."
