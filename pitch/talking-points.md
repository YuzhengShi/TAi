# Talking Points — 5 Minutes

## Intro (15s)

Yuzheng Shi, MS CS Northeastern, supervised by Prof. Yvonne Coady. I built an AI teaching assistant running on Bedrock, deployed it into a real course in April.

---

## Architecture (45s)

Students message on WhatsApp. Node.js orchestrator spawns an isolated Docker container per student, running Claude Agent SDK inside. The agent has MCP tools to pull grades and deadlines from Canvas LMS, code from GitHub, and course knowledge from a custom knowledge graph I built.

All Bedrock: Haiku for daily tutoring, Sonnet for evaluation, Nova Sonic for voice interviews, Cohere for embeddings.

---

## Features (2min)

### Competency Model

Each student has a persistent mastery file tracking every concept — confidence, stability, and what context it was demonstrated in: written, verbal, debugging, implementation. Agent reads it before every response, updates it after every interaction. It knows exactly where each student is strong and weak.

### Voice Mock Interview

Student clicks a link, enters a real-time voice session with Nova Sonic. Questions generated from their competency model's weak spots. Sonnet runs as a Shadow Evaluator in the background — async tool calls scoring each answer on four dimensions without pausing the conversation. Difficulty adjusts live.

### Proactive Intervention

Every weekday morning the agent reads each student's mastery file plus Canvas deadlines and decides whether to reach out. Most of the time it doesn't. But if a student has been silent 5 days, deadline is close, and their mastery on that topic is low — it messages them first.

### Knowledge Graph

All answers grounded in the professor's actual lecture slides and papers, not Claude's general training data. Entities and relations extracted offline with DeepSeek, embedded with Cohere, stored as a hierarchical graph. Query time: zero LLM calls — just embedding lookup and graph traversal.

---

## Real Usage (1min)

One student uses it almost daily. Asks homework design questions, checks his Canvas grades through it, does voice mock interviews to practice verbal explanations before his weekly TA meeting. He went quiet for 5 days before a deadline — TAi messaged him proactively on his weakest topic. He replied within an hour.

10 students, deployed two months, built by one person, entirely on Bedrock.

---

## AWS Fit (45s)

Skill Builder has 15+ features — SimuLearn, Meeting Simulator, Learning Assistant, Lab Maker, Jam Journeys, Microcredentials — but none of them share student state. Fail IAM on a SimuLearn, open a Builder Lab, the Lab has no idea.

The competency model I built is the missing layer. Shared learner state across all features. The voice interview becomes live technical review operating real AWS services. The knowledge graph plugs into re:Invent content with timestamp-level citations.

85% of the code is already running. I'd like 15 minutes to demo the live system.
