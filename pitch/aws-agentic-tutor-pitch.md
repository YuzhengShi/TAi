# Agentic AI Tutor for AWS Certification
## A Bedrock-Native Intelligent Learning Platform

---

### The AWS Training & Certification Landscape

AWS has built the most comprehensive cloud education ecosystem in the industry:

| Layer | What AWS Offers | Price | Audience |
|---|---|---|---|
| **Certification** (13 exams) | Proctored exams — Foundational (2), Associate (5), Professional (3), Specialty (3) | $100 – $300/attempt | Everyone from beginners to deep experts |
| **Digital Learning** (Skill Builder) | 600+ on-demand videos, learning plans, Cloud Quest, practice exams, sandboxed labs | Free – $449/year | Self-paced learners |
| **Classroom Training** | Live instruction from AWS Certified Instructors, 1-5 day courses | $600 – $3,000+ | Teams and enterprise |
| **Cloud Institute** | Multi-quarter vocational program for career switchers | ~$630/quarter | Career changers |

The content is world-class. The credentialing is industry-standard. **What's missing is the layer in between: an intelligent system that knows each learner, adapts to them, and guides them through the right content at the right time.**

---

### The Gap

A student preparing for Solutions Architect Associate today follows a linear path: watch videos, read docs, take practice exams, repeat. Every student gets the same sequence regardless of background.

- The backend engineer with 10 years of experience sits through the same EC2 basics as a career switcher
- A student who confused IAM policy evaluation logic three weeks ago gets no reminder before the exam
- Practice exams test recall but never ask "Walk me through how you'd design this" — the skill the job actually requires
- Skill Builder tracks *completion* (did you watch the video?) but not *comprehension* (can you apply the concept?)

AWS's own executives see this clearly. Kara Hurst (VP, AWS Worldwide Sustainability and Social Responsibility) wrote in 2025:

> *"Not everyone can have a dedicated, in-person tutor, but with generative AI, anyone can have this type of experience embedded in a digital learning system ... understanding your current knowledge and skill level, where you need additional support, and providing recommendations and coaching along your personalized learning path."*

AWS's Public Sector blog identified a shift *"from reactive to proactive support models"* — calling out that *"in 2025, AI systems can understand context, anticipate needs, and offer support before anyone asks."*

**AWS has the content. AWS has the credentials. AWS has even articulated the vision. The gap is an adaptive, persistent learning agent that connects them all.**

---

### The Solution

We're building an **agentic AI tutor** — not a chatbot, not a search engine — that maintains a persistent, multi-dimensional model of each learner and adapts its teaching strategy accordingly. Powered entirely by AWS Bedrock.

#### What Makes It Agentic (Not Just a Chatbot)

No existing product — AWS or third-party — delivers these capabilities for AWS certification learners:


| Capability | What It Does | Why It Matters |
|---|---|---|
| **Persistent Student Model** | Tracks mastery across 4 dimensions: confidence, stability, context scope, and how it was demonstrated | Knows you can *explain* S3 replication but have never *debugged* a cross-region setup |
| **Adaptive Teaching Strategy** | Selects from 6 strategies per interaction based on your current mastery | Low confidence? It explains. Medium? Socratic questioning. High but untested verbally? Mock interview practice |
| **Misconception Detection** | Discovers and tracks misconceptions organically across sessions | If you believe "S3 is strongly consistent for all operations" — it flags, tracks, and systematically remediates |
| **Proactive Intervention** | Reaches out when it detects risk — not on a timer, but based on your learning state | "You haven't reviewed IAM since 2 weeks ago, and your mock scores show a gap. Want a 5-minute review?" |
| **Spaced Review** | Resurfaces concepts at optimal intervals based on stability scores | High confidence + low stability + 14 days since last evidence = time to reinforce |
| **Voice Mock Interviews** | Real-time voice conversations where you explain architectures out loud | "You're the SA. The client needs multi-region failover with RPO under 1 minute. Walk me through your design." |
| **Live AWS Sandbox** | Connects to real AWS services via API — provisions, configures, and operates infrastructure live during the conversation | Student asks how lifecycle policies work → tutor creates an S3 bucket, applies the policy, shows the real API output. No simulations — real services, real behavior |
| **Live Interactive Assessment** | Mock exams are hands-on: explain real logs, debug real failures, implement real architectures, respond to real incidents | "Fix this broken CloudFormation stack" replaces "Which service would you use? A, B, C, or D." You can't pass by memorizing — you have to operate |
| **Multi-Language Tutoring** | Answers in 10+ languages — English, Spanish, French, German, Portuguese, Japanese, Korean, Chinese, Arabic, Hindi — with per-conversation language preference | AWS certifications are taken globally. A Japanese engineer preparing for SAA-C03 gets Socratic guidance in Japanese, with English technical terms preserved. No competitor offers this |
| **Architecture Design Mentor** | Guided two-phase workflow: structured design dialogue → full architecture document generation. Refuses to generate until prerequisites are defined | "Design a multi-region active-active setup." Tutor asks structured questions (traffic patterns? RPO/RTO? budget?), validates each decision, then generates a complete architecture document — which the student builds in the sandbox |
| **Two-Layer Learning State** | Conversation-level TutorState (tactical: current hypothesis, next question type) + cross-session Competency Model (strategic: mastery, stability, scope) | Within a conversation, the tutor tracks what you seem to believe right now and what to probe next. Across sessions, it knows your long-term mastery profile. Two layers working together — no other tool has either, let alone both |

#### Grounded in Real Content, Not Hallucination

The tutor doesn't rely on the LLM's training data. Every response is grounded in:

- **Video transcripts** from re:Invent talks and AWS workshops — with timestamped citations and "watch this 2-minute segment" links
- **A knowledge graph** of AWS concepts — service relationships, prerequisite chains, difficulty layers — enabling questions like "What should I learn before attempting Raft-based consensus in DynamoDB Global Tables?"
- **Official documentation and whitepapers** — chunked, embedded, and retrieved via Bedrock Knowledge Bases

When the tutor says something, it shows you *where* it came from. When it recommends a video, it links to the *exact moment* that answers your question.

**The retrieval pipeline is production-proven, not theoretical.** htgaa-chat's RAG pipeline runs in production at Harvard today: Bedrock KB retrieves top-16 transcript chunks → **Cohere rerank** (`cohere.rerank-v3-5:0` on Bedrock) re-scores by relevance → threshold filtering → Claude generates a response with inline citations `[1]`, `[2]` linking back to exact transcript timestamps. The chunking isn't Bedrock's automatic splitter (which breaks mid-sentence and loses timestamp alignment) — it's a **custom semantic chunker** that splits at speaker changes, topic shifts, and natural pauses, preserving exact `startSec`/`endSec` per chunk. That's why the watch-links are precise to the second, not approximations.

**Cross-domain queries work out of the box.** htgaa-chat already supports a "Full Course" composite mode — a single query spanning all lectures simultaneously, with results distributed across sources to avoid single-topic domination. For the AWS tutor, this means a student can ask "How do VPCs relate to security groups and NACLs?" and get grounded answers pulling from the networking re:Invent talk, the security talk, and the Well-Architected whitepaper — all in one response, all with citations.

#### The Entire AWS Cloud as a Teaching Lab

This is the key insight: **every AWS service is an API, and the agent can call any of them.** The tutor doesn't just explain AWS — it *operates* AWS in front of the student, with real inputs, real outputs, and real behavior.

No certification prep tool does this. Not even AWS's own Builder Labs, which are scripted walkthroughs with predetermined steps. Here, the agent decides what to provision based on the conversation. The student says something wrong about how security groups work, and the tutor *shows them* by creating the exact scenario that disproves their assumption.

Each student gets a dedicated AWS sub-account via AWS Organizations, isolated by Service Control Policies. The tutor has full API access to that account — every one of the 200+ AWS services becomes a potential teaching moment.

**What this looks like in practice:**

Student asks: "How do S3 lifecycle policies work?"

The tutor doesn't just explain. It:

1. **Pulls from training materials** — finds the exact re:Invent talk segment where an AWS engineer explains lifecycle transitions, links to the 3-minute clip
2. **Provisions in the live sandbox** — creates a bucket, uploads objects with different dates, applies a lifecycle policy with transition to Glacier after 30 days
3. **Shows real output** — `aws s3api get-bucket-lifecycle-configuration` output right there in the UI, real JSON, real rules
4. **Connects to a known misconception** — "By the way, you mentioned last week that S3 LIST is strongly consistent. Let me show you something." Demonstrates the real behavior live — not a textbook claim, the actual API response
5. **Updates the competency model** — lifecycle policies confidence goes up, the misconception gets a remediation attempt logged, notes that the student now has *implementation* scope not just *theoretical*
6. **Ties back to the exam** — "Lifecycle policies are 2-3 questions on SAA-C03, usually combined with cost optimization. Your Cost Explorer shows this bucket would cost $X/month on Standard. What lifecycle rule would you add to cut that in half?"

One interaction. Every layer feeding every other layer. The sandbox isn't a separate "lab mode" — it's woven into every conversation.

**The agent can improvise.** It doesn't need pre-built labs for every service. Student asks about Kinesis vs SQS? Spin up both, push the same messages, show the difference in behavior — ordering, fan-out, replay capability — side by side. The student sees what actually happens, not what a slide says would happen.

**The agent can demonstrate failure modes** — the things that separate exam-passers from practitioners:
- Stop an EC2 instance mid-request and show what happens to the ALB health check
- Trigger a Lambda cold start and measure the actual latency
- Exceed a DynamoDB throughput limit and show the throttling in CloudWatch
- Kill an Availability Zone and watch Auto Scaling respond in real time

**Cost becomes a teaching tool.** The tutor can pull Cost Explorer data from the student's sandbox and say: "Your architecture would cost $4,200/month. The client's budget is $500. What would you change?" That's a real SA interview question — answered with real numbers, not hypothetical ones.

**Real-time visual output makes it stick.** When the tutor provisions a VPC, the student doesn't just see CLI output — they see a live network diagram updating as subnets, route tables, and security groups are created. When they load-test an Auto Scaling group, they see CloudWatch graphs with CPU climbing, new instances launching, the ALB distributing traffic — all in real time. That's not a screenshot from a slide deck. That's *their* infrastructure doing *their* thing.

**The competency model makes the sandbox intelligent.** Without the model, a sandbox is just a playground — fun but unfocused. With the model, the tutor knows *exactly* which service to spin up, which failure mode to trigger, which edge case to demonstrate — because it knows what this specific student doesn't understand yet. Two students ask the same question about DynamoDB, and they get completely different live demos based on their gaps.

**Learn by operating, not by reading.** Every other tool teaches AWS through content. This teaches AWS through AWS itself. You don't forget how DynamoDB partition keys work if you've seen a hot partition throttle your requests in real time.

---

### Where It Fits: Every Layer of the AWS Training Ecosystem

The tutor isn't a replacement for any AWS offering — it's the **connective tissue** that makes every layer more effective.

| AWS Layer | Current Experience | With the Agentic Tutor |
|---|---|---|
| **Skill Builder Free** (600+ videos) | Watch linearly, no feedback | Tutor knows what you've mastered → skips basics you already know, deep-dives where you're weak. Links to the *exact 2-minute segment* of the relevant video. |
| **Skill Builder Subscription** ($29/mo) | Sandboxed labs, practice exams | The tutor's live sandbox surpasses static labs — any service, any scenario, improvised on the fly based on the conversation. Practice exam results feed back into the student model. |
| **Classroom Training** ($600-$3K) | Instructor-led, time-limited | Before class: tutor pre-assesses and surfaces prerequisite gaps. After class: tutor reinforces concepts via spaced review and voice mock interviews. Extends the $3K investment from 5 days to months. |
| **Cloud Institute** ($630/quarter) | Structured multi-quarter program | Tutor provides 1-on-1 mentoring between cohort sessions. Tracks mastery across quarters. Flags at-risk students to human instructors before they fall behind. |
| **Certification Exams** ($100-$300) | One-shot proctored test | Mock exams are hands-on: deploy architectures, debug real failures, respond to live incidents. Voice interviews test verbal explanation. The tutor tells you when you're *actually ready* — because it's watched you operate, not just answer questions. |

**There are no losers in this model.** It's a flywheel:

```
    Learners are more prepared
           ↓
    More people attempt certifications (at $100-$300 each)
           ↓
    Pass rates go up → credentials feel attainable, not gatekept
           ↓
    More professionals enter the market with real AWS skills
           ↓
    Enterprises hire certified people → build on AWS
           ↓
    AWS market share grows
           ↓
    Demand for certifications grows
           ↓
    Demand for training grows (Skill Builder, Classroom, Cloud Institute)
           ↓
    (repeat)
```

**For the learner:** A persistent tutor that knows your gaps, adapts to your level, and tells you when you're genuinely ready — not just when you've watched all the videos. You walk into the exam confident because you've been tested on your *actual* weak spots, not generic practice questions. You're more competitive in the job market.

**For AWS:** The exams stay exactly as hard. The bar doesn't move. But more people clear it — because they're better prepared, not because the test got easier. Every additional certified professional drives AWS adoption at their organization. Every Skill Builder subscription becomes more valuable when an intelligent tutor helps learners get more out of it. Classroom training ROI goes up when the tutor extends a 5-day course into months of reinforcement.

**For the industry:** More people who *actually understand* AWS services, not just people who memorized exam dumps. The tutor tests verbal explanation, architectural reasoning, and debugging — the skills that matter on the job, not just on the test.

**For the global market:** AWS certifications are taken worldwide, but every existing prep tool teaches in English. The tutor answers in 10+ languages — already running in production. A developer in Tokyo studies in Japanese. An engineer in São Paulo studies in Portuguese. Technical terms stay in English (they're the same on the exam), but the explanations, Socratic questions, and misconception corrections are in their native language. This is a massive unlock for the ~60% of AWS cert candidates whose first language isn't English.

---



### Combined Architecture

This is a new standalone project, cherry-picking the strongest capabilities from two production systems. TAi is coupled to WhatsApp/Docker containers; htgaa-chat is coupled to Discourse auth and HTGAA-specific content. A clean foundation takes the patterns and key code from both.

```
┌─────────────────── Web App (Next.js, from htgaa-chat) ───────────────────┐
│                                                                           │
│  Lecture Workspace    Live Sandbox     Mock Exam       Voice Interview     │
│  (watch-links,        (real AWS         (hands-on:      (Nova Sonic,       │
│   citations,          services,         explain/debug/   TAi's shadow      │
│   video segments)     live output,      implement/       evaluator)        │
│                       real-time graphs) operate/optimize)                  │
│                                                                           │
│  Architecture Design Mentor    Infra Portfolio    Multi-Language (10+)     │
│  (guided design dialogue →     (git-backed        (answer in learner's    │
│   full arch document,          project notebook,   native language,        │
│   prerequisite validation)     version-controlled) English tech terms)     │
│                                                                           │
└────────────────────────────┬──────────────────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────────────────┐
│                      Agentic Core (TAi + htgaa-chat)                      │
│                                                                           │
│  Two-Layer Learning State:                                                │
│  • TutorState (htgaa-chat) — per-conversation: current hypothesis,       │
│    learning goal, next question type, misconceptions this session         │
│  • Competency Model (TAi) — per-student persistent: confidence,          │
│    stability, context scope, demonstrated via, across all sessions        │
│                                                                           │
│  • Teaching Strategy Selection — EXPLAIN / SOCRATIC / CHALLENGE / etc.    │
│  • 70/30 Socratic Framework — 70% guiding questions, 30% facts           │
│  • Misconception State Machine — persistent, cross-session                │
│  • Proactive Intervention — email/notification when gaps detected         │
│  • Spaced Review — resurface concepts at optimal intervals                │
│  • Real-Time Assessment — silence detection, behavioral fingerprinting    │
└────────────────────────────┬──────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
┌─────────────▼────────────┐  ┌─────────────▼────────────────────────────┐
│   Knowledge Layer        │  │   Live AWS Sandbox                       │
│                          │  │                                          │
│  Bedrock KB (htgaa-chat) │  │  Per-student AWS sub-account             │
│  • re:Invent transcripts │  │  (Organizations + SCPs)                  │
│  • Custom semantic chunks│  │                                          │
│    (not auto-chunked —   │  │  Agent calls any AWS API as MCP tools:   │
│    speaker/topic/pause   │  │  • EC2, S3, VPC, IAM, Lambda, DynamoDB   │
│    boundaries, precise   │  │  • RDS, SQS, SNS, CloudFront, ECS...    │
│    startSec/endSec)      │  │  • CloudWatch, Cost Explorer, CloudTrail │
│  • Cohere rerank (top-16 │  │  • All 200+ services available           │
│    → precision filtered) │  │                                          │
│  • → timestamped cites   │  │  Real inputs → real outputs → real-time  │
│  • → watch-links         │  │  graphs, metrics, cost data, logs        │
│                          │  │                                          │
│  LeanRAG (TAi)           │  │  Sandbox ↔ Competency Model:             │
│  • AWS docs → graph      │  │  model drives what to provision,         │
│  • Service relationships │  │  live results update the model           │
│  • Prerequisite chains   │  │                                          │
│  • → difficulty layers   │  │  Infra Portfolio (git-backed):           │
│                          │  │  • Student's architecture designs        │
│  DynamoDB (persistence)  │  │  • Version-controlled IaC templates      │
│  • Competency records    │  │  • Tutor reviews diffs between versions  │
│  • Conversation history  │  │                                          │
│  • Assessment data       │  │                                          │
└──────────────────────────┘  └──────────────────────────────────────────┘
```

#### What Each Project Contributes

| From TAi | From htgaa-chat |
|---|---|
| 4-dimension competency model (persistent) | Next.js 15 web UI + lecture workspace |
| Adaptive teaching strategies (6 strategies) | Video player + timestamped watch-links (5-sec precision) |
| Misconception state machine (cross-session) | Bedrock KB RAG pipeline (retrieve → Cohere rerank → generate) |
| Mock interview (Nova Sonic voice + text) | Custom semantic transcript chunking (speaker/topic/pause boundaries) |
| Shadow evaluator (Sonnet scoring, async) | Inline citation extraction + display (`[1]`, `[2]` → timestamp links) |
| Proactive intervention engine (10 triggers) | Transcript ingest pipeline (Transcribe → chunk → KB → sync) |
| Spaced review scheduling | Full-course cross-domain composite queries |
| LeanRAG graph knowledge | TutorState per-conversation learning state tracking |
| Cross-session memory (FTS5, decay classes) | Multi-language tutoring (10 languages, per-conversation preference) |
| Teaching images (Nova Canvas) + Mermaid diagrams | Final project two-phase mentor (design dialogue → document generation) |
| YouTube transcript extraction (residential IP) | Foundry: git-backed project notebook (Forgejo, encrypted tokens) |
| File reading (PDF/Office/code/archives) | DynamoDB persistence (conversations, messages, preferences) |
| Agent browser (Playwright + Chromium) | Developer mode (swap models, edit prompts, tune thresholds in-browser) |
| — | Conversation soft-delete (audit trail preservation) |
| — | S3 presigned URLs for private video content |
| — | Multi-part lecture support (unified timeline across video files) |
| — | Discourse SSO (JWT handoff, session management) |

#### AWS Content Sources

- **re:Invent talks** — ingest via htgaa-chat's transcribe pipeline → watch-links to exact video segments
- **AWS Documentation** — ingest into LeanRAG graph → concept relationships, prerequisite chains
- **AWS Whitepapers** (Well-Architected, security, etc.) — chunk into Bedrock KB
- **Certification guides** (SAA, SAP, DevOps, etc.) — structure into competency domains
- **AWS Workshops / Skill Builder** — link out as practice resources

#### Key Differentiators vs Existing Tools

AWS has Skill Builder, certification practice exams, and Q. But none of them:

1. **Remember you** — know you understand EC2 but struggle with IAM policies, across sessions. Two-layer learning state: tactical (what you seem to believe right now) + strategic (your long-term mastery profile)
2. **Adapt strategy** — explain VPCs from scratch if you're new, challenge you with edge cases if you're advanced. 70/30 framework: 70% guiding questions, 30% factual content
3. **Link to the exact moment** in a re:Invent talk where Werner Vogels explains eventual consistency — precise to the second, with Cohere rerank ensuring the most relevant segments surface first
4. **Operate real AWS services live** — don't just say "S3 lifecycle policies transition objects to Glacier" — create the bucket, apply the policy, show the real API output
5. **Conduct voice mock interviews** — "You're the solutions architect. The client needs multi-region failover with RPO under 1 minute. Walk me through your design."
6. **Assess by operation, not recall** — "Fix this broken CloudFormation stack" instead of "Which option best describes CloudFormation?"
7. **Proactively reach out** — "You haven't reviewed S3 replication since 2 weeks ago, and it's a high-weight cert topic. Want a quick review?"
8. **Teach in your language** — 10+ languages, preserving English technical terms. No other cert prep tool offers AI tutoring in Japanese, Korean, Chinese, Arabic, Portuguese, or Hindi
9. **Guide architecture design** — structured two-phase mentor: asks the right questions (traffic patterns? failover requirements? budget?), validates each decision, then generates a complete architecture document — which you build in the sandbox
10. **Query across all domains at once** — ask a question that spans networking, security, and storage, and get a grounded answer pulling from multiple sources with citations to each

#### How It Works — User Modes

```
Student (Web Browser)
    │
    ├── Lecture Workspace ──── Ask questions, get Socratic responses with citations.
    │                          Watch linked video segments (precise to the second).
    │                          Cross-domain queries span all topics simultaneously.
    │                          10+ languages — study in your native language.
    │
    ├── Live Sandbox ───────── Real AWS services woven into every conversation.
    │                          Tutor provisions, configures, breaks things on the fly.
    │                          Real-time CloudWatch dashboards, Cost Explorer, logs.
    │                          Student sees real inputs → real outputs → real graphs.
    │
    ├── Architecture Design ── Guided two-phase workflow: structured design dialogue
    │   Mentor                 (traffic patterns? RPO/RTO? budget constraints?)
    │                          → complete architecture document generation.
    │                          Then: "Now let's build it in the sandbox."
    │
    ├── Infra Portfolio ────── Git-backed project notebook. Save architecture designs,
    │                          IaC templates, sandbox configurations. Version-controlled.
    │                          Tutor reviews diffs: "You changed the RDS instance to
    │                          multi-AZ. Walk me through why."
    │
    ├── Hands-On Exam ──────── Six modes: Explain / Debug / Implement / Operate /
    │                          Optimize / Compare. Real services, not multiple choice.
    │                          Competency model drives which challenges to present.
    │                          Silence detection + behavioral signals = continuous
    │                          assessment (not just the final answer).
    │
    └── Voice Interview ────── Real-time voice with AI evaluator scoring in background.
                               4 dimensions: verbal clarity, technical accuracy,
                               depth of reasoning, problem-solving process.
                               "You just designed it verbally. Now let's build it
                               in the sandbox and see if it works."
```

#### Entirely on AWS

| Service | Role |
|---|---|
| **Bedrock (Claude)** | Conversational AI — Haiku for daily tutoring, Sonnet for deep reasoning and evaluation |
| **Bedrock (Nova Sonic)** | Real-time bidirectional voice for mock interviews |
| **Bedrock Knowledge Bases** | RAG retrieval over video transcripts, docs, and whitepapers. Custom semantic chunks (not auto-chunked) preserve precise timestamps |
| **Bedrock (Cohere Rerank)** | Precision filtering — re-scores retrieved chunks by relevance, eliminates noise before generation. Production-proven in htgaa-chat |
| **Bedrock (Cohere Embed)** | Embedding for knowledge graph entity anchoring + KB vector search |
| **Bedrock AgentCore** | Agent orchestration, tool management, sandbox session coordination |
| **Organizations + SCPs** | Per-student AWS sub-accounts with service-level isolation and budget guardrails |
| **All 200+ AWS services** | The teaching lab — agent calls any service API via MCP tools in the student's sandbox account |
| **CloudWatch** | Real-time metrics, logs, and dashboards visible to student during live demos and assessments |
| **Cost Explorer** | Live cost data as a teaching tool — "your architecture costs $X/month, optimize it" |
| **CloudFormation** | Agent deploys and tears down teaching scenarios; students debug and author templates |
| **DynamoDB** | Student models, conversation history, competency records, assessment data |
| **S3 + CloudFront** | Video hosting with presigned URL access |
| **Transcribe** | Lecture/workshop video → searchable transcript |
| **Lambda** | Proactive notification triggers + serverless components in student sandbox scenarios |
| **SES** | Proactive outreach emails, spaced review notifications |
| **Translate** | Subtitle generation for video content in 10+ languages |
| **Cognito** | User authentication, session management, OAuth integration (replaces Discourse SSO) |

---

### Competitive Landscape: The Gap Is Real and Verified

We conducted a comprehensive market analysis (April 2026) of every AI-powered tool in the AWS certification prep space. The finding: **all five agentic capabilities are unoccupied market space.**

| Capability | AWS Skill Builder | Pluralsight Iris | Whizlabs / Tutorials Dojo / Maarek | ExamPro |
|---|---|---|---|---|
| **Persistent student model** | Completion tracking only (Skills Profile) | 10-query context window, explicitly session-bound | None | None |
| **Adaptive teaching strategy** | Prescriptive 4-step plans, same for everyone | Content recommendation, not pedagogy | None | Spaced repetition (algorithmic, not AI) |
| **Misconception tracking** | None | None | Static per-question explanations | None |
| **Proactive outreach** | Email marketing only | None | Drip email at best | None |
| **Voice mock interviews** | Meeting Simulator (communication skills, not cert scenarios) | None | None | None |
| **Live AWS sandbox (agent-operated)** | Builder Labs (scripted, pre-built, linear steps) | None | None | None |
| **Hands-on assessment (explain/debug/implement/operate)** | None — practice exams are multiple choice | None | Multiple choice only | Multiple choice + flashcards |
| **AI-era integrity (behavioral, not lockdown)** | None | None | None | None |
| **Multi-language tutoring (10+ languages)** | Content in 16 languages (videos/docs) but AI features English-only | English only | English only (Maarek has some non-EN courses) | English only |
| **Architecture design mentor (guided → document)** | None | None | None | None |
| **Cross-domain grounded queries** | None — each lab/course is siloed | None | None | None |

**AWS has the building blocks** — Learning Assistant (Dec 2024), SimuLearn, Meeting Simulator (Nov 2025), Nova Sonic (re:Invent 2025), AgentCore — but has not assembled them into a pedagogical agent. AWS even published a blog encouraging users to build their own cert practice tool using Amazon Q Apps, implicitly confirming this layer is open.

**Microsoft and Google are further behind.** Microsoft Learn has no AI tutor for Azure certifications — Copilot is marketed as a generic "study buddy." Google Skills (relaunched Oct 2025) added gamification (Leagues, streaks) but no AI tutor for GCP certifications. **An agentic tutor for AWS certifications would be a first-mover advantage not just over third parties, but over competing cloud platforms.**

**The academic evidence is strong.** Randomized controlled trials published in 2025 (Nature Scientific Reports; IACIS) show AI tutoring systems with proper student models produce **15-35% performance gains** over conventional digital training, with the largest effects on engagement and retention — exactly the metrics that drive certification completion.

---

### Live Interactive Assessment: Beyond Multiple Choice

Every certification prep tool on the market does the same thing: multiple choice. "Which AWS service provides serverless query execution against S3 data?" Pick A, B, C, or D. You can pass that by memorizing. You can pass that from exam dumps. The entire industry knows this is a problem — it's why employers don't fully trust certifications.

The agentic tutor redefines what assessment means. The agent doesn't ask "which service would you use?" — it says **"show me."**

#### Six Assessment Modes

**Explain** — "Here's a running Lambda function that's timing out intermittently. The CloudWatch logs are right there. Read them and tell me what's happening." The student interprets real logs, real metrics, real error messages. Not a paragraph describing a scenario — the actual live system misbehaving.

**Debug** — "This CloudFormation stack just failed. Here's the Events tab. Fix the template and redeploy it." The agent created a template with a deliberate misconfiguration — maybe a security group referencing a nonexistent VPC, or a circular dependency. The student reads the real error, finds the real problem, writes the real fix, and watches it deploy successfully. The tutor knows from the competency model exactly which kind of error to plant based on the student's weakest areas.

**Implement** — "A client needs a REST API that stores data in DynamoDB. Build it." The student actually creates the API Gateway, the Lambda, the DynamoDB table, the IAM role connecting them. The tutor watches what they build, gives Socratic hints when they're stuck, and when it's done says "Great, now let's load test it — what happens when you get 10,000 requests per second?" And then they actually see what happens.

**Operate** — "Your application is running. I just killed one of the two AZs. What's your system doing right now?" The student looks at real CloudWatch alarms firing, real health checks failing, real Auto Scaling events triggering. They have to *respond* to an incident, not describe how they'd respond to a hypothetical one.

**Optimize** — "Here's your running architecture. Cost Explorer says it's $3,200/month. The client wants it under $1,000. Change it — but it has to keep serving traffic while you do it." Live cost data, live traffic, real tradeoffs. Switch to Graviton instances? Add a caching layer? Move to Spot? The student makes changes and sees the cost estimate update.

**Compare** — "You said SQS is better than Kinesis for this use case. Let me set up both. Push messages and let's see what actually happens." Side-by-side live behavior. The student watches throughput, ordering, fan-out, replay capability — and realizes their assumption was wrong (or right) based on real evidence.

#### Real-Time Assessment Signals

Assessment happens continuously, not at the end. During every interaction, the tutor observes:

**Silence is signal.** A 30-second pause before a correct answer means something totally different than an instant correct answer — the first shows the student is reasoning, the second might mean they already knew it cold or looked it up. A 3-minute silence followed by a suddenly perfect, well-structured answer is a very different pattern than 3 minutes of the student typing partial attempts, deleting, trying again.

This compounds with the competency model. If a student has high confidence on VPC networking and then freezes for 4 minutes on a basic subnet question — the model flags that. Maybe their confidence score was inflated. Maybe they memorized the concept but can't apply it under pressure. That's exactly the kind of gap the tutor exists to find.

In voice interviews this is even more powerful. Hesitation, filler words, long pauses, starting and restarting an explanation — all real-time indicators of actual understanding vs surface-level recall. The tutor already does this (TAi's Nova Sonic silence detection in production).

**The process is the assessment, not the answer.** How much help did the student need? What kind of help? How quickly did they apply a hint? Did they need the same hint twice? Could they transfer the concept to a new scenario without help? A student who struggles through a VPC design with 3 hints but gets there and can explain why — that student genuinely understands. All of this data feeds back into the competency model after every interaction.

#### Assessment in the AI Era

Every institution, every certification body, every school is trying to figure out the same question: **"How do we assess people when everyone has AI?"**

The answers so far are all defensive — lockdown browsers, proctoring cameras, banning phones, going back to pen and paper. All of them are losing battles.

**The agentic tutor offers a fundamentally different answer: make the AI the assessment environment itself.**

The tutor *is* an AI. It has an unfair advantage no human proctor has — it's seen the student's writing style, reasoning patterns, vocabulary level, and common mistakes across dozens of sessions. The competency model is a fingerprint of how this specific person thinks. If a student who consistently writes short, informal responses with specific types of errors suddenly produces a perfectly structured, comprehensive answer — the tutor notices, because it contradicts the model.

More importantly, the tutor can probe in real time. A human proctor sees a suspicious answer and can only flag it after the fact. The AI tutor sees a suspicious answer and immediately asks: "Great answer. Now explain the third point in your own words." Or "You mentioned you'd use a Gateway endpoint. What's the difference between a Gateway endpoint and an Interface endpoint, and why did you choose Gateway?" If the student actually understands, they answer easily. If they pasted from another AI, they collapse. The assessment isn't "did you write this yourself" — it's "can you defend what you said."

**But the biggest shift: don't fight AI — absorb it.** If the student is already inside an AI tutor that has full context on their learning journey, there's no advantage to opening ChatGPT in another tab. The tutor is *better* than ChatGPT for this task because it knows the course material, knows the student's gaps, and can actually operate the AWS services live. The tutor can even say: "You look stuck. Want to work through this together?" — turning the AI from a cheating risk into a guided learning moment.

Everything the student does with the tutor — every question they ask, every hint they need, how many hints before they get it, which concepts they need help with and which they handle alone — *that is the assessment data.* You can't dump a live interactive assessment where the agent improvises based on your competency model. Every student gets a different experience. Exam dumps become worthless overnight.

**The pitch to AWS:** you don't just get a better tutor. You get a new model of assessment that actually works in the AI era. Every other certification body is terrified of AI cheating. AWS could be the first to say: "We don't ban AI. We built the AI. And it knows exactly what you understand." The #1 criticism of AWS certifications — "certified people can't actually do the job" — disappears when the assessment is live operation of real AWS services, not multiple choice recall.

---

### Evidence: This Already Works

This isn't a concept. The core technology is deployed and serving real students in two university courses today.

**TAi** — Agentic TA for CS6650 (Distributed Systems), Northeastern University Vancouver
- Live on WhatsApp since April 2026, serving 9+ students
- Persistent competency tracking across all interactions
- Proactive teaching patrol with 10 intervention triggers
- Real-time voice mock interviews with Shadow Evaluator (Claude Sonnet scoring mid-interview)
- LeanRAG knowledge graph (zero LLM calls at query time)
- Supervised by Professor Yvonne Coady

**HTGAA Lecture Tutor** — AI Tutor for "How To Grow Almost Anything" (Synthetic Biology), Harvard
- Live at chat.htgaa.org, serving students across 9 lectures
- Socratic Q&A grounded in lecture video transcripts (70/30 rule: 70% guiding questions, 30% facts)
- Timestamped watch-links precise to the second — custom semantic chunking, not Bedrock auto-chunker
- Bedrock KB RAG with Cohere rerank (top-16 retrieve → precision filter → generate with inline citations)
- Full-course cross-lecture queries — single question, answers grounded in all 9 lectures simultaneously
- Per-conversation TutorState tracking: learning goal, current hypothesis, misconceptions, next question type
- Final project two-phase mentor: structured design dialogue → complete proposal document generation
- Experiment Foundry: git-backed lab notebook with encrypted credentials, version-controlled protocols
- Multi-language tutoring: 10 languages with per-conversation preference
- DynamoDB persistence with conversation soft-delete (audit trail preservation)

**The AWS certification tutor combines the strongest capabilities of both:**
- TAi's agentic core (persistent student modeling, adaptive strategy, misconception tracking, proactive intervention, voice interviews, LeanRAG knowledge graph, cross-session memory)
- HTGAA's web experience (Next.js lecture workspace, video player with watch-links, inline citations, Cohere rerank RAG, custom semantic chunking, cross-domain queries, TutorState, multi-language tutoring, architecture design mentor, git-backed project notebook, DynamoDB persistence, transcript ingest pipeline)

---

### Capability Mapping: What Ports, What's New

Both TAi and htgaa-chat are production systems with 20+ distinct capabilities each, serving real students at two universities. We audited every capability from both systems against the AWS tutor requirements. **~85% port directly or with medium adaptation. The remaining ~15% is genuinely new work.**

#### Direct Ports (minimal changes — swap content domain, same engine)

| TAi Capability | AWS Tutor Adaptation |
|---|---|
| **Socratic tutoring** — never gives direct answers, Socratic depth levels (surface probe → assumption challenge → contradiction exposure → meta-cognition), 150-word cap, one question per response | Same approach. AWS domains instead of distributed systems. Same depth levels, same response discipline |
| **Competency tracking** — 40+ concepts, 4 dimensions (confidence, stability, context scope, demonstrated via), updated after every substantive interaction | Map to SAA-C03 exam domains (Compute, Storage, Networking, Security, Database, Servertic, etc.). Same 4-dimension model, same update protocol |
| **Misconception detection** — state machine (candidate → holding → identifying → confirmed → remediated), frequency-based confirmation, auto-triggers CORRECT strategy | Direct port. AWS has rich misconceptions: S3 consistency model, IAM policy evaluation order, VPC default routing, SQS visibility timeout, eventual vs strong consistency |
| **Adaptive teaching strategy** — 6 strategies (EXPLAIN, SOCRATIC, MOCK PRACTICE, DEMONSTRATE, CORRECT, CHALLENGE), strategy history logged per student | Direct port. Same decision matrix, same logging |
| **Voice mock interviews** — Nova Sonic bidirectional streaming, personalized system prompt from competency model, session resume at 7.5min, max 20min | Change system prompt: "distributed systems TA" → "AWS solutions architect interviewer." Same HMAC tokens, same session resume, same architecture |
| **Shadow evaluator** — Sonnet scores each answer mid-interview on 4 dimensions (verbal clarity, technical accuracy, depth of reasoning, problem-solving process), async tool calling, difficulty adaptation | Direct port. Same 4 dimensions, same async scoring, same difficulty adjustment |
| **YouTube transcripts** — residential IP proxy, full transcript extraction, local caching | **Direct port, huge value for free.** re:Invent talks, AWS workshops, and AWS tutorial videos are all on YouTube. Same youtube_info + youtube_transcript tools |
| **Agent browser** — Playwright + Chromium, renders JavaScript, extracts readable text, read-only | Browse AWS documentation, blog posts, service pages dynamically. Same read-only constraint |
| **LeanRAG knowledge graph** — DeepSeek V3.2 entity extraction, Cohere Embed v4, GMM clustering, hierarchical graph (G0 entities → G1 clusters → G2 themes), zero LLM calls at query time | Rebuild with AWS corpus — docs, whitepapers, re:Invent transcripts. Graph captures service relationships (VPC→Subnet→SG→EC2) and prerequisite chains ("learn IAM before S3 bucket policies"). Same pipeline, new content |
| **Teaching images** — Amazon Nova Canvas generates visual explanations, sent as images | Generate AWS architecture diagrams as teaching aids ("here's what a multi-AZ RDS deployment looks like") |
| **Mermaid diagrams** — Chromium render → PNG, architecture/sequence/flow diagrams | Perfect for AWS content — VPC network diagrams, request flows, service interaction sequences |
| **File reading** — PDF, Office (.docx/.xlsx/.pptx), 20+ code file types, images (multimodal), archives | Students upload CloudFormation templates, Terraform files, architecture screenshots, exam study notes for review |
| **Cross-session memory** — SQLite FTS5, decay classes (permanent/stable 90d/active 14d/session 24h), porter stemming search, injected into every conversation | Port to DynamoDB with TTL for decay. Same recall pattern, same decay classes. DynamoDB Streams for FTS equivalent |
| **Spaced review scheduling** — resurfaces concepts at optimal intervals based on stability scores | Direct port. Same triggers, same stability-based timing |

#### Direct Ports from htgaa-chat (minimal changes — swap content domain, same engine)

| htgaa-chat Capability | AWS Tutor Adaptation |
|---|---|
| **Next.js lecture workspace** — video player, citation sidebar, watch-link buttons, conversation management, responsive layout | Direct port. Replace HTGAA lectures with re:Invent talks and AWS training videos. Same UI patterns, same video player, same watch-link UX |
| **Bedrock KB RAG pipeline** — retrieve top-16 → Cohere rerank → threshold filter → Claude generate → structured JSON (answer + citations + watch-links + tutor state) | Direct port. Same pipeline, new content sources (re:Invent transcripts, AWS docs, whitepapers). Same Cohere rerank scoring, same threshold filtering |
| **Custom semantic transcript chunking** — splits at speaker changes, topic shifts, natural pauses. Preserves exact startSec/endSec per chunk. NOT Bedrock auto-chunker | Direct port. Same ingest pipeline (`Transcribe → chunk → KB → sync`). Critical for precise watch-links — auto-chunking would break timestamp alignment |
| **Watch-link generation** — 5-second spans merged within 30sec, same source, <5min duration. Ranked by Cohere rerank + hint boost. Top 5 per response | Direct port. Same merging logic, same ranking, same limits |
| **Inline citation system** — model writes `[1]`, `[2]`, app parses → links to transcript chunk with timestamps and quotes | Direct port. Same regex parsing, same citation display |
| **Full-course cross-domain queries** — single query spanning all lectures, results distributed across sources to avoid single-topic domination | Direct port. "How do VPCs relate to security groups and NACLs?" pulls from networking, security, and architecture sources simultaneously |
| **TutorState per-conversation** — learning goal, current hypothesis, misconceptions detected, evidence used, next question type — persists across turns within a conversation | Direct port. Complements TAi's persistent competency model — tactical (this conversation) + strategic (all sessions) |
| **Multi-language tutoring** — 10 languages, per-conversation preference, appended to system prompt, English technical terms preserved | Direct port. Massive global impact for AWS certifications |
| **DynamoDB persistence** — conversations, messages, user preferences, with in-memory fallback for dev | Direct port. Same table patterns, same fallback strategy |
| **Conversation soft-delete** — `deletedAt` timestamp, UI hides, data preserved for auditing | Direct port. Important for compliance and analytics |
| **S3 presigned URLs** — private video content with 15-minute expiry | Direct port for re:Invent recordings and AWS training videos |
| **Multi-part lecture support** — unified timeline across multiple video files, per-source offsets, source selector dropdown | Direct port. Many re:Invent talks and workshops are multi-part |
| **Developer mode** — swap models, edit system prompts, tune watch-link thresholds in-browser. Gated by user group membership | Port as instructor/admin mode. Allows educators to tune the tutor without code changes |
| **70/30 Socratic framework** — 70% guiding logic, 30% facts. Never front-load answers. Identify misconceptions without saying "wrong." One question per response | Direct port. Proven pedagogical framework, same system prompt structure |

#### Ports from htgaa-chat with Medium Adaptation

| htgaa-chat Capability | AWS Tutor Adaptation | What Changes |
|---|---|---|
| **Final project two-phase mentor** — structured design dialogue (refuses to generate until prerequisites met) → complete document generation with equipment catalog, techniques, budget | **Architecture Design Mentor** — structured design dialogue for AWS architectures (traffic patterns? RPO/RTO? budget? compliance?) → complete architecture document. Equipment catalog → AWS service catalog. Lab protocols → deployment runbooks | Domain swap: synthetic biology → cloud architecture. Same two-phase pattern, same prerequisite validation, same document generation engine |
| **Foundry (git-backed project notebook)** — Forgejo integration, AES-256-GCM encrypted tokens, 9-stage workflow, version-controlled experiment protocols | **Infrastructure Portfolio** — git-backed architecture designs, CloudFormation/Terraform templates, sandbox configurations. Tutor reviews version diffs: "You added a NAT Gateway. Walk me through why." | Git backend stays, content type changes from lab protocols to IaC templates. Same encryption, same CRUD API |
| **Discourse SSO** — JWT handoff, HttpOnly cookies, 3-hour sessions, group-based permissions | **Cognito auth** — replace Discourse with AWS Cognito for standalone auth. Same session pattern, same group-based permissions for admin/instructor roles | Auth provider changes; session management pattern is the same |
| **Transcript ingest pipeline** — `ready-lecture` command: Transcribe → semantic chunk → write KB docs → write DynamoDB lecture record → sync KB | Add a parallelized bulk ingest for 100+ re:Invent talks. Same per-lecture pipeline, add batch orchestration (Step Functions or simple queue) | Scale: 9 lectures → 100+ talks. Same pipeline per video, add batch wrapper |

#### Ports from TAi with Medium Adaptation

| TAi Capability | AWS Tutor Adaptation | What Changes |
|---|---|---|
| **Proactive outreach** — weekday 9am cron, 10 intervention triggers, 90% silence rule | Email/browser push notifications instead of WhatsApp. New triggers: exam date approaching + weak domain, high-weight cert topic not reviewed | Notification channel changes; trigger logic same pattern, new triggers added |
| **Canvas LMS integration** — grades, deadlines, submissions, 20 action types, identity-bound | Replace with pre-assessment onboarding quiz + self-reported exam date + optional Skill Builder completion import. Progress tracking built into the tutor itself | New data source, but competency bootstrap pattern is the same |
| **Submission content analysis** — extracts understanding signals from student work | Analyze practice exam results, identify *why* answers are wrong (misconception vs knowledge gap vs careless error), feed into competency model | Same extraction pattern, different input format |
| **Instructor admin tools** — class-wide competency view, register students, schedule tasks, audit log | Port to web admin dashboard. Add: cohort management, cert progress tracking, at-risk student alerts, team analytics | Same capabilities, web UI instead of WhatsApp admin channel |
| **Analytics dashboard** — 7-page design (overview, student list, detail, network, AI query bar, patrol log, competency heatmap) | Direct port of the design. Activity calendar, engagement metrics, competency heatmap all apply. Add: exam readiness score, cert domain breakdown | Already fully designed, needs implementation |

#### Genuinely New (not in TAi or htgaa-chat)

| New Capability | Description |
|---|---|
| **Live AWS Sandbox** | Per-student AWS sub-account via Organizations + SCPs. Agent calls any AWS service API as MCP tools — provisions, configures, breaks, and tears down infrastructure live during conversations. Every service is a potential teaching moment. The competency model drives what to provision; live results update the model. Real-time visual output: CloudWatch dashboards, Cost Explorer graphs, network diagrams updating as resources are created |
| **Hands-on interactive assessment** | Six assessment modes that replace multiple choice: Explain (interpret real logs/metrics), Debug (fix real broken infrastructure), Implement (build real architectures), Operate (respond to real incidents), Optimize (reduce real costs under constraints), Compare (side-by-side live service behavior). Agent improvises challenges based on competency model — every student gets a different assessment. Continuous assessment signals: silence duration, hint dependency, behavioral patterns, process quality |
| **AI-era assessment integrity** | The tutor IS an AI — it has seen the student's writing style, reasoning patterns, and common mistakes across sessions. The competency model is a behavioral fingerprint. Suspicious patterns (sudden quality jump, response inconsistent with model) trigger real-time probing: "Great answer. Explain the third point in your own words." Don't fight AI — absorb it: the tutor is better than ChatGPT because it knows the student, the material, and can operate live services. Exam dumps become worthless when every assessment is improvised |
| **Adaptive mock exam engine** | Question bank organized by SAA-C03 domains. Item response theory or simplified Bloom's stratification (recall → comprehension → application → analysis → design). Questions weighted by competency gaps — weak domains get more questions. After each mock exam, competency model updates across all tested domains |
| **Exam readiness score** | Aggregated metric: "You are 78% ready for SAA-C03." Computed from competency model — weighted by exam domain percentages (e.g., Domain 1: Design Resilient Architectures = 30%). Learner can see which domains are dragging their score down |
| **Pre-assessment onboarding** | New learner takes a 15-minute diagnostic quiz covering all exam domains. Results initialize the competency model with non-zero scores (same pattern as TAi's Canvas bootstrap, but self-contained). Skips experienced learners past basics immediately |
| **Cross-certification competency sharing** | IAM mastery earned studying for SAA carries over to Security Specialty. Shared concept nodes in the competency model. Phase 3 feature |

#### What Doesn't Port (and doesn't need to)

| Capability | Source | Why Not Needed |
|---|---|---|
| WhatsApp channel (Baileys) | TAi | Web app is the primary interface. Could add WhatsApp as Phase 3 for spaced review nudges |
| Voice transcription (Transcribe Streaming for voice notes) | TAi | Web browser handles audio directly; Nova Sonic is speech-to-speech |
| WhatsApp reactions | TAi | Not applicable to web UI |
| WhatsApp message splitting (4000 char limit) | TAi | Web has no character limit |
| Docker container isolation per student | TAi | htgaa-chat's Next.js architecture handles multi-user natively; DynamoDB provides data isolation |
| GitHub integration (Khoury GHE) | TAi | Not needed for certification prep (could add later for DevOps cert if students share IaC repos) |
| Discourse SSO plugin | htgaa-chat | Replace with AWS Cognito for standalone auth — no dependency on external forum |
| Lab equipment catalog (Echo525, BioshakeD3000, etc.) | htgaa-chat | Replace with AWS service catalog — same structured knowledge pattern, different domain |
| Foundry username whitelist | htgaa-chat | Replace with role-based access — all students get portfolio access |

---

### Initial Scope: Solutions Architect Associate (SAA-C03)

We start narrow and prove it works before expanding.

**Phase 1 (MVP, 4 weeks):**
- Web app with lecture workspace + Socratic Q&A (port htgaa-chat's Next.js UI, video player, watch-links, citation sidebar)
- Full RAG pipeline: Bedrock KB + Cohere rerank + custom semantic chunking (port htgaa-chat's production pipeline)
- Ingest 20+ re:Invent talks on core SAA topics (EC2, S3, VPC, IAM, RDS, Lambda) via htgaa-chat's transcript ingest pipeline
- Persistent competency model across SAA-C03 exam domains (port TAi's 4-dimension model)
- TutorState per-conversation learning tracking (port htgaa-chat's tactical state)
- Adaptive teaching strategy selection with 70/30 Socratic framework
- Grounded responses with video watch-links (precise to the second) and inline citations
- Multi-language tutoring from day one (10 languages, ported from htgaa-chat)
- Cross-domain queries — single question spans networking, security, and storage sources simultaneously

**Phase 2 (6 weeks):**
- **Live AWS sandbox** — per-student sub-accounts via Organizations + SCPs, agent operates any AWS service live during conversations
- **Architecture Design Mentor** — guided two-phase workflow (port htgaa-chat's final project mentor): structured design dialogue → complete architecture document → build it in the sandbox
- **Infrastructure Portfolio** — git-backed project notebook (port htgaa-chat's Foundry): save architecture designs, IaC templates, sandbox configs. Tutor reviews version diffs
- Voice mock interviews ("explain this architecture to a client") — with sandbox integration ("now let's build what you just described")
- **Hands-on assessment** — six modes (explain/debug/implement/operate/optimize/compare) replace multiple choice
- Proactive review notifications (email/browser push)
- Misconception tracking and remediation

**Phase 3 (full ecosystem):**
- **All 13 certifications** — Foundational (Cloud Practitioner, AI Practitioner) through Professional and Specialty, with shared competency model across overlapping domains (IAM mastery earned studying for SAA carries over to Security Specialty). Per-certification service whitelists — sandbox only exposes services on each exam
- **Continuous behavioral assessment** — silence detection, response pattern analysis, real-time probing, AI-era integrity model that absorbs AI instead of fighting it
- **Skill Builder integration** — deep-link to specific labs/courses, ingest completion signals to update student model
- **Classroom companion** — pre-assessment before instructor-led training, post-class spaced review
- **Cohort features** — instructor dashboard, study group matching, team progress tracking
- **Enterprise / Team tier** — admin analytics, compliance reporting ("X% of team certified within Y months")
- **Mobile + messaging** — WhatsApp/SMS channel for on-the-go spaced review prompts

---

### What We're Looking For

**From AWS:**

1. **Bedrock credits** — primary infrastructure cost; the tutor runs entirely on Bedrock services. Natural fit for **AWS EdStart** (Members Tier) or **AWS Activate** credits programs
2. **Content access** — re:Invent session recordings and transcripts for SAA-relevant topics, or a content licensing pathway
3. **Technical collaboration** — early access to Bedrock features (Nova Sonic GA, AgentCore, Knowledge Base improvements) that directly impact the platform
4. **Co-visibility** — case study, blog post, or conference talk at re:Invent 2026 / AWS Summit 2026

These asks map to programs AWS already runs and is actively funding:
- **AWS Education Equity Initiative** ($100M, announced re:Invent 2024) — cloud credits + technical advising for edtech, already supporting Code.org (Bedrock) and Rocket Learning
- **Pledge to America's Youth** — $30M in credits for organizations building educational AI (chatbots, teaching assistants, lesson plan generators)
- **AWS EdStart** — accelerator for EdTech startups with credits, office hours, and events. Has previously supported AI-powered adaptive learning startups (Joni.AI, Learning Matters, StudySmarter)
- **AWS AI for Teaching & Learning Framework** — a published reference architecture for exactly this kind of system, explicitly inviting partners to implement against it

**What AWS gets:**

- **Higher certification pass rates** — every additional certified professional drives AWS adoption at their organization. The tutor targets the gap between "watched the videos" and "actually ready for the exam"
- **Certifications people trust** — the #1 criticism is "certified people can't do the job." Hands-on assessment (debug real failures, operate real infrastructure) produces practitioners, not memorizers. The certification becomes more valuable to employers
- **The entire AWS ecosystem as a teaching surface** — every service the student learns on is a service they'll use (and pay for) in production. The tutor doesn't just teach AWS — it creates AWS users. Students who've operated DynamoDB, Lambda, and VPC hands-on during training are the ones who choose AWS at their next job
- **An answer to AI-era assessment** — every certification body is panicking about AI cheating. AWS could be the first to say: "We don't ban AI. We built the AI." A behavioral assessment model that works *with* AI instead of against it
- **Skill Builder force multiplier** — the tutor makes existing free and paid content more effective by routing each learner to the right content at the right time, increasing engagement and retention
- **Classroom training ROI extension** — a $3K classroom course currently delivers 5 days of impact. The tutor extends that to months of adaptive reinforcement, making the investment easier to justify
- **Competitive advantage over Azure and GCP** — neither Microsoft nor Google has an AI tutor for their own certifications, let alone one that operates live cloud services as a teaching lab. This would be a generational first
- **Bedrock showcase application** — the first agentic tutor built on AWS's own agentic stack (AgentCore + Nova Sonic + Bedrock KB), for AWS's own certification journey. A reference architecture that aligns perfectly with VP Swami Sivasubramanian's "agentic AI" narrative
- **Research-validated pedagogy** — not another chatbot, but an agentic system with measurable learning outcomes from real university deployments. RCTs show 15-35% gains
- **Open-source reference implementation** (negotiable) — shows developers how to build sophisticated AI applications on Bedrock, driving Bedrock adoption

**Why partner, not build internally?** AWS's Skill Builder team ships ~monthly releases focused on content breadth (new labs, new certs, new languages) and simulation features — not pedagogical modeling. AWS has a documented pattern of partnering for pedagogy: Cengage (Nov 2025 expansion for adaptive learning on Bedrock), Pearson, Code.org (Education Equity), Udacity (AI & ML Scholars). AWS supplies infrastructure; expert partners own the pedagogy.

---

### Team

**Yuzheng Shi** — Developer. MS Computer Science, Northeastern University (graduating Aug 2026). Built TAi end-to-end: agentic core, LeanRAG knowledge graph, Nova Sonic voice interviews, full EC2 deployment. Deep experience with Bedrock (Claude, Nova Sonic, Cohere, Transcribe, Polly).

**Professor Yvonne Coady** — Academic Advisor. CS6650 instructor, Northeastern University Vancouver. Research in distributed systems education. Supervises TAi deployment and pedagogy design.

**[HTGAA Collaborator]** — Built htgaa-chat for Harvard's HTGAA course. Production Bedrock KB + Cohere rerank RAG pipeline, Next.js 15 web platform with video integration, custom semantic transcript chunking, inline citation system, multi-language tutoring (10 languages), TutorState conversation tracking, final project design mentor, git-backed Foundry notebook, DynamoDB persistence, Docker deployment.

---

### Contact

Yuzheng Shi
[email]
[LinkedIn]
[GitHub: TAi repository]

---

*Built on AWS. For AWS. Teaching AWS — by operating AWS.*
