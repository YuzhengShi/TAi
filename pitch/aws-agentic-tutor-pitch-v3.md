# The Brain for AWS Skill Builder
## An Agentic Intelligence Layer for AWS Certification

*We don't ban AI. We built the AI. And it knows exactly what you understand.*

---

### The AWS Training & Certification Landscape

AWS has built the most comprehensive cloud education ecosystem in the industry:

| Layer | What AWS Offers | Price | Audience |
|---|---|---|---|
| **Certification** (13 exams) | Proctored exams — Foundational (2), Associate (5), Professional (3), Specialty (3) | $100 – $300/attempt | Everyone from beginners to deep experts |
| **Digital Learning** (Skill Builder) | 900+ on-demand courses, learning plans, Cloud Quest, practice exams, sandboxed labs, SimuLearn, Escape Room | Free – $449/year | Self-paced learners |
| **Classroom Training** | Live instruction from AWS Certified Instructors, 1-5 day courses | $600 – $3,000+ | Teams and enterprise |
| **Cloud Institute** | Multi-quarter vocational program for career switchers | ~$630/quarter | Career changers |

The content is world-class. The credentialing is industry-standard. **What's missing is the layer in between: an intelligent system that knows each learner, adapts to them, and guides them through the right content at the right time.**

AWS's own executives see this clearly. Kara Hurst (VP, AWS Worldwide Sustainability and Social Responsibility) wrote in 2025:

> *"Not everyone can have a dedicated, in-person tutor, but with generative AI, anyone can have this type of experience embedded in a digital learning system ... understanding your current knowledge and skill level, where you need additional support, and providing recommendations and coaching along your personalized learning path."*

AWS's Public Sector blog identified a shift *"from reactive to proactive support models"* — calling out that *"in 2025, AI systems can understand context, anticipate needs, and offer support before anyone asks."*

---

### Skill Builder Has Everything Except a Brain

AWS Skill Builder is the most comprehensive cloud learning ecosystem in the world:

- **900+ digital courses** across every AWS service and certification path
- **200+ Builder Labs** in live sandboxed AWS environments
- **200+ SimuLearn scenarios** with AI-powered customer simulations
- **Cloud Quest** — 3D role-playing across 9 cloud roles
- **Escape Room: Exam Prep** — gamified certification practice with hands-on labs
- **Meeting Simulator** — AI-powered stakeholder communication practice
- **Card Clash** — competitive card game for architecture knowledge
- **Official Practice Exams** — full-length certification mock tests
- **Learning Plans, Digital Badges, Skills Profile, Microcredentials**

Every one of these features is world-class. And every one of them is **an isolated room with no hallway between them.**

---

### The Problem: Nine AI Features, Zero Shared Intelligence

We audited every AI-powered surface in Skill Builder (April 2026). The finding:

| Feature | What It Knows | What It Doesn't Know |
|---|---|---|
| **Learning Assistant** (Dec 2024) | This lab's context | What you did in any other lab, course, or practice exam |
| **SimuLearn** (200+ scenarios) | This simulation's conversation | Your performance in other simulations, labs, or exams |
| **Meeting Simulator** (Nov 2025) | This meeting's dialogue | Your certification path, weak domains, or learning history |
| **Cloud Quest** | This quest's completion state | Your practice exam scores or SimuLearn results |
| **Escape Room** | This room's puzzles | Anything else — appears fully scripted, no disclosed AI |
| **Practice Exams** | Your score + per-question rationale | Why you keep getting IAM questions wrong across multiple exams |
| **Skills Profile** (Sep 2025) | What you've **completed** | What you've **understood** |

AWS's own language confirms the siloing:
- Learning Assistant works **"within your lab's context"** (AWS T&C Blog, Dec 2024)
- Skills Profile is designed for **"sharing"** and **"showcase"** (AWS T&C Blog, Sep 2025)
- Cohorts Studio offers **"team"**-level AI recommendations, not per-learner cognitive modeling

**No cross-feature student model. No misconception tracking. No adaptive teaching strategy. No proactive intervention. No readiness prediction.**

A student fails 4 IAM questions on a practice exam. Then opens a Builder Lab on S3. Learning Assistant has no idea about the IAM failure. SimuLearn doesn't know either. Cloud Quest doesn't adjust. The student is alone — surrounded by world-class features that can't talk to each other.

**Skill Builder tracks completion. Nobody tracks comprehension.**

---

### The Solution: One Brain, Every Surface

We build the intelligence layer that connects all of Skill Builder's features into a coherent, personalized learning system — plus new surfaces Skill Builder doesn't have.

```
┌──────────────────── AWS Skill Builder ──────────────────────┐
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Agentic Intelligence Layer (us)                │ │
│  │                                                        │ │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐  │ │
│  │  │ Competency Model │  │ Teaching Strategy Engine     │  │ │
│  │  │ (per-learner,    │  │ (EXPLAIN / SOCRATIC /       │  │ │
│  │  │  per-concept,    │  │  CORRECT / CHALLENGE /      │  │ │
│  │  │  4 dimensions,   │  │  MOCK PRACTICE /            │  │ │
│  │  │  cert-domain-    │  │  DEMONSTRATE)               │  │ │
│  │  │  mapped)         │  │                             │  │ │
│  │  └────────┬────────┘  └──────────────┬──────────────┘  │ │
│  │           │ reads/writes              │ reads           │ │
│  │           ▼                           ▼                │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │              Event Bus / State Plane              │  │ │
│  │  │     (consumes signals from ALL Skill Builder      │  │ │
│  │  │      features + our own surfaces)                 │  │ │
│  │  └───────────────────────┬──────────────────────────┘  │ │
│  │                          │                             │ │
│  │  Misconception Detection │ Proactive Intervention      │ │
│  │  Wrong-Answer Triage     │ Spaced Review               │ │
│  │  Readiness Scoring       │ Study Plan Generation       │ │
│  │  Behavioral Assessment   │ Multi-Language (10+)        │ │
│  └──────────────────────────┼────────────────────────────┘ │
│                             │                              │
│  ───── reads signals from ──┼── existing features ───────  │
│                             │                              │
│  ┌────────┐ ┌──────┐ ┌─────┴───┐ ┌────────┐ ┌──────────┐ │
│  │Courses │ │Labs  │ │SimuLearn│ │Practice│ │Cloud     │ │
│  │ 900+   │ │ 200+ │ │ 200+   │ │Exams   │ │Quest/    │ │
│  │        │ │      │ │        │ │        │ │Escape Rm │ │
│  └────────┘ └──────┘ └────────┘ └────────┘ └──────────┘ │
│                                                            │
│  ───── new surfaces we add ─────────────────────────────── │
│                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │ Coaching      │ │ Live AWS     │ │ Live Technical     │ │
│  │ Panel         │ │ Sandbox      │ │ Review             │ │
│  │               │ │              │ │ (Voice + Sandbox   │ │
│  │ Beside every  │ │ Agent-       │ │  + 6 Assessment    │ │
│  │ existing      │ │ operated,    │ │  Modes)            │ │
│  │ feature —     │ │ improvised,  │ │                    │ │
│  │ knows your    │ │ per-student  │ │ Nova Sonic voice   │ │
│  │ history       │ │ sub-account  │ │ + Shadow Evaluator │ │
│  └──────────────┘ └──────────────┘ └────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Combined Technical Architecture

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

### What Makes It Agentic (Not Just a Chatbot)

No existing product — AWS or third-party — delivers these capabilities for AWS certification learners:

| Capability | What It Does | Why It Matters |
|---|---|---|
| **Persistent Student Model** | Tracks mastery across 4 dimensions: confidence, stability, context scope, and how it was demonstrated | Knows you can *explain* S3 replication but have never *debugged* a cross-region setup |
| **Two-Layer Learning State** | Conversation-level TutorState (tactical: current hypothesis, next question type) + cross-session Competency Model (strategic: mastery, stability, scope) | Within a conversation, the tutor tracks what you seem to believe right now and what to probe next. Across sessions, it knows your long-term mastery profile. Two layers working together — no other tool has either, let alone both |
| **Adaptive Teaching Strategy** | Selects from 6 strategies per interaction based on your current mastery | Low confidence? It explains. Medium? Socratic questioning. High but untested verbally? Mock interview practice |
| **Misconception Detection** | Discovers and tracks misconceptions organically across sessions via state machine | If you believe "VPC peering is transitive" — it flags, tracks across features, and systematically remediates |
| **Proactive Intervention** | Reaches out when it detects risk — not on a timer, but based on your learning state | "You haven't reviewed IAM since 2 weeks ago, and your mock scores show a gap. Want a 5-minute review?" |
| **Spaced Review** | Resurfaces concepts at optimal intervals based on stability scores | High confidence + low stability + 14 days since last evidence = time to reinforce |
| **Voice Mock Interviews** | Real-time voice conversations where you explain architectures out loud | "You're the SA. The client needs multi-region failover with RPO under 1 minute. Walk me through your design." |
| **Live AWS Sandbox** | Connects to real AWS services via API — provisions, configures, and operates infrastructure live during the conversation | Student asks how lifecycle policies work → tutor creates an S3 bucket, applies the policy, shows the real API output. No simulations — real services, real behavior |
| **Live Interactive Assessment** | Mock exams are hands-on: explain real logs, debug real failures, implement real architectures, respond to real incidents | "Fix this broken CloudFormation stack" replaces "Which service would you use? A, B, C, or D." You can't pass by memorizing — you have to operate |
| **Multi-Language Tutoring** | Answers in 10+ languages — English, Spanish, French, German, Portuguese, Japanese, Korean, Chinese, Arabic, Hindi — with per-conversation language preference | AWS certifications are taken globally. A Japanese engineer preparing for SAA-C03 gets Socratic guidance in Japanese, with English technical terms preserved. No competitor offers this |
| **Architecture Design Mentor** | Guided two-phase workflow: structured design dialogue → full architecture document generation. Refuses to generate until prerequisites are defined | "Design a multi-region active-active setup." Tutor asks structured questions (traffic patterns? RPO/RTO? budget?), validates each decision, then generates a complete architecture document — which the student builds in the sandbox |

---

### What the Intelligence Layer Does

**One signal propagates everywhere.** Student fails 4 IAM questions on a practice exam → Competency Model updates (IAM confidence drops) → affects everything:

- Next Builder Lab session: Coaching Panel focuses on IAM concepts
- Next SimuLearn: a security-heavy customer scenario is recommended
- Next Voice Mock: IAM scenario questions weighted higher
- Spaced Review: IAM re-test scheduled in 3 days
- Readiness Score: the Security domain percentage drops
- Daily Plan: adjusted to prioritize IAM remediation
- Wrong-Answer Triage: detects pattern — "you confuse identity-based and resource-based policy evaluation" — not just "you got question 14 wrong"

Today, that practice exam score dies in the practice exam feature. With us, it becomes a learning signal that flows through the entire ecosystem.

---

### What We Add to Skill Builder

#### I. The Coaching Panel — Your AI Tutor Beside Every Feature

Not a separate app. A persistent coaching presence that appears **alongside every existing Skill Builder feature**, with full knowledge of your learning history.

**During a course video:**
> Tutor highlights: "Pay attention to this section on policy evaluation order — it directly relates to the 4 practice exam questions you got wrong last week."

**During a Builder Lab:**
> Instead of just following scripted steps, the tutor asks: "You just created that security group. Why did you allow inbound on port 443 but not 80? What if the requirement changes to HTTP redirect?"

**After a SimuLearn scenario:**
> "You scored 4/6 on that customer simulation. The two you missed both involved choosing between services under cost constraints. That's a pattern — let me quiz you on three more cost-optimization scenarios."

**After a practice exam:**
> Wrong-Answer Triage kicks in — not question-by-question rationale (Skill Builder already does that), but **cross-question pattern detection**: "You missed 6 questions. I see 2 misconception patterns: (1) you confuse SQS FIFO message-group ordering with Kinesis shard-level ordering, (2) you think VPC peering is transitive. Let's address both."

The difference from Learning Assistant: Learning Assistant answers your questions within one lab. The Coaching Panel **knows your entire history** and **proactively guides you** across all features.

#### II. Live AWS Sandbox — The Entire Cloud as a Teaching Lab

This is the key insight: **every AWS service is an API, and the agent can call any of them.** The tutor doesn't just explain AWS — it *operates* AWS in front of the student, with real inputs, real outputs, and real behavior.

Each learner gets a dedicated AWS sub-account via Organizations, isolated by Service Control Policies. The agent has full API access — every one of the 200+ AWS services becomes a teaching moment. This is fundamentally different from Builder Labs:

| | Builder Labs | Our Sandbox |
|---|---|---|
| Content | Pre-built, scripted steps | Agent improvises based on conversation and competency model |
| Scope | Specific lab scenario | Any AWS service, any combination |
| Adaptivity | Same lab for everyone | Two students asking about DynamoDB get completely different demos based on their gaps |
| Failure modes | Not included | Agent deliberately breaks things to test your response |
| Cost teaching | Not included | Real Cost Explorer data: "your architecture costs $X/month — optimize it" |

**The sandbox is not a separate mode.** It's woven into every conversation. The tutor says "let me show you" and real AWS infrastructure appears. The student says something wrong about how security groups work, and the tutor creates the exact scenario that disproves their assumption — live, in real time.

**What this looks like in practice — a complete interaction:**

Student asks: "How do S3 lifecycle policies work?"

The tutor doesn't just explain. It:

1. **Pulls from training materials** — finds the exact re:Invent talk segment where an AWS engineer explains lifecycle transitions, links to the 3-minute clip
2. **Provisions in the live sandbox** — creates a bucket, uploads objects with different dates, applies a lifecycle policy with transition to Glacier after 30 days
3. **Shows real output** — `aws s3api get-bucket-lifecycle-configuration` output right there in the UI, real JSON, real rules
4. **Connects to a known misconception** — "By the way, you mentioned last week that S3 LIST is strongly consistent. Let me show you something." Demonstrates the real behavior live — not a textbook claim, the actual API response
5. **Updates the competency model** — lifecycle policies confidence goes up, the misconception gets a remediation attempt logged, notes that the student now has *implementation* scope not just *theoretical*
6. **Ties back to the exam** — "Lifecycle policies are 2-3 questions on SAA-C03, usually combined with cost optimization. Your Cost Explorer shows this bucket would cost $X/month on Standard. What lifecycle rule would you add to cut that in half?"

One interaction. Every layer feeding every other layer.

**The agent can improvise.** Student confused about Kinesis vs SQS? Spin up both, push the same messages, show the difference in behavior — ordering, fan-out, replay capability — side by side. No pre-built lab needed.

**The agent can demonstrate failure modes** — the things that separate exam-passers from practitioners:
- Stop an EC2 instance mid-request and show what happens to the ALB health check
- Trigger a Lambda cold start and measure the actual latency
- Exceed a DynamoDB throughput limit and show the throttling in CloudWatch
- Kill an Availability Zone and watch Auto Scaling respond in real time

**Cost becomes a teaching tool.** The tutor can pull Cost Explorer data from the student's sandbox and say: "Your architecture would cost $4,200/month. The client's budget is $500. What would you change?" That's a real SA interview question — answered with real numbers, not hypothetical ones.

**Real-time visual output makes it stick.** When the tutor provisions a VPC, the student doesn't just see CLI output — they see a live network diagram updating as subnets, route tables, and security groups are created. When they load-test an Auto Scaling group, they see CloudWatch graphs with CPU climbing, new instances launching, the ALB distributing traffic — all in real time. That's not a screenshot from a slide deck. That's *their* infrastructure doing *their* thing.

**The competency model makes the sandbox intelligent.** Without the model, a sandbox is a playground — fun but unfocused. With the model, the tutor knows exactly which service to spin up, which failure mode to trigger, which edge case to demonstrate — because it knows what this specific learner doesn't understand yet.

**Learn by operating, not by reading.** Every other tool teaches AWS through content. This teaches AWS through AWS itself. You don't forget how DynamoDB partition keys work if you've seen a hot partition throttle your requests in real time.

#### III. Live Technical Review — Voice + Sandbox + Six Assessment Modes

This is the merged experience: real-time voice conversation with the AI examiner, a shared live sandbox workspace, and six assessment modes that flow naturally within a single session. It mirrors what a real solutions architect interview looks like — you talk, you build, you defend.

**How a session flows:**

> **Agent:** "You're the solutions architect. A client is migrating a monolithic app to AWS. They need 99.95% availability across two regions. Walk me through your initial architecture."
>
> Student talks through their design — Route 53, ALB, Auto Scaling, Multi-AZ RDS. Agent listens, asks clarifying questions. *(Explain mode — but the student doesn't see mode labels. It's just a conversation.)*
>
> **Agent:** "Good. You mentioned individual subnets per AZ. What happens when they grow to 10 microservices and need service discovery across regions?"
>
> *(Constraint shift — the scenario evolves. The student has to adapt their design.)*
>
> **Agent:** "Let me show you something." *(Sandbox activates — voice + visual.)* "Here's a CloudWatch dashboard from your sandbox. The health check is failing even though the endpoint responds. What's going on?"
>
> *(Debug mode. Real health check logs, real alarm configuration. Student diagnoses while talking.)*
>
> **Agent:** "Right, the health check path was wrong. Fix it — I've opened the config."
>
> *(Implement mode. Student edits real configuration while explaining their reasoning.)*
>
> **Agent:** "Health check is green. Now — I just killed us-east-1. Talk me through what's happening."
>
> *(Operate mode. Real CloudWatch alarms firing, real DNS failover, real traffic shift.)*
>
> **Agent:** "Traffic's in us-west-2. But Cost Explorer says this dual-region setup runs $4,200/month. Client budget is $2,000. What changes?"
>
> *(Optimize mode. Real cost data, real tradeoffs.)*
>
> **Agent:** "You suggested Aurora Global Database instead of cross-region RDS replicas. Let me spin up both. Walk me through the difference in failover behavior."
>
> *(Compare mode. Both provisioned live. Student watches actual RPO/RTO difference.)*

One scenario. Six modes. No visible transitions. Just a conversation that naturally escalates based on the competency model.

**Three interaction gears:**

| Gear | When | Example |
|---|---|---|
| **Voice-only** | Student explains, analyzes, reasons out loud | Explain, Compare — interpreting or reasoning, not building |
| **Voice + visual** | Agent shows live output, student narrates what they see | Debug, Operate — reading real CloudWatch, logs, metrics |
| **Voice + hands-on** | Student types/configures while talking through reasoning | Implement, Optimize — building or modifying real infrastructure |

**The Shadow Evaluator** runs in the background via async tool calling (no conversational pause). Claude Sonnet scores each answer on 4 dimensions:

- **Verbal clarity** — can you articulate the concept clearly?
- **Technical accuracy** — are the facts correct?
- **Depth of reasoning** — do you understand *why*, not just *what*?
- **Problem-solving process** — how do you approach novel problems?

Plus new signals from the merged format:

- **Say-vs-build gap** — student verbally designs a VPC, agent provisions it, result has a routing issue the student didn't mention. That gap is measurable
- **Recovery behavior** — how quickly does the student diagnose when something breaks? Do they read the error or guess?
- **Escalation response** — does confidence hold when the agent shifts from Explain to Debug to Operate?
- **Verbal-while-building** — narrating reasoning under load is a strong signal of genuine understanding

#### IV. Architecture Design Mentor — Guided Design to Live Build

A guided two-phase workflow that mirrors how real solutions architects work:

**Phase 1 — Structured Design Dialogue.** The tutor refuses to generate an architecture until prerequisites are defined. It asks structured questions: traffic patterns? RPO/RTO requirements? budget constraints? compliance requirements? Then it validates each decision against the competency model — if the student says "I'll use DynamoDB for the transactional data" and their DynamoDB confidence is 0.4, the tutor probes: "Walk me through your partition key design for this workload."

**Phase 2 — Architecture Document Generation.** Once prerequisites are met, the tutor generates a complete architecture document — service choices, justifications, trade-offs, cost estimates, deployment strategy. This is not a template — it's personalized based on the design dialogue.

**Phase 3 — Build It.** "Now let's build it in the sandbox." The student constructs what they just designed, with the tutor watching for gaps between their documented design and their actual implementation.

#### V. Infrastructure Portfolio — Git-Backed Learning Artifact

Every architecture the student designs, every CloudFormation template they write, every sandbox configuration they create — versioned in a git-backed portfolio.

The tutor reviews version diffs: "You changed the RDS instance to multi-AZ. Walk me through why." It tracks architectural growth over time — from simple single-AZ deployments to complex multi-region active-active setups. The portfolio becomes a tangible artifact the student can show employers: "Here's my progression from basic to advanced AWS architecture, with version history."

---

### Six Assessment Modes — Deep Dive

The Live Technical Review flows naturally between six modes, but each has distinct pedagogical purpose:

**Explain** — "Here's a running Lambda function that's timing out intermittently. The CloudWatch logs are right there. Read them and tell me what's happening." The student interprets real logs, real metrics, real error messages. Not a paragraph describing a scenario — the actual live system misbehaving.

**Debug** — "This CloudFormation stack just failed. Here's the Events tab. Fix the template and redeploy it." The agent created a template with a deliberate misconfiguration — maybe a security group referencing a nonexistent VPC, or a circular dependency. The student reads the real error, finds the real problem, writes the real fix, and watches it deploy successfully. The tutor knows from the competency model exactly which kind of error to plant based on the student's weakest areas.

**Implement** — "A client needs a REST API that stores data in DynamoDB. Build it." The student actually creates the API Gateway, the Lambda, the DynamoDB table, the IAM role connecting them. The tutor watches what they build, gives Socratic hints when they're stuck, and when it's done says "Great, now let's load test it — what happens when you get 10,000 requests per second?" And then they actually see what happens.

**Operate** — "Your application is running. I just killed one of the two AZs. What's your system doing right now?" The student looks at real CloudWatch alarms firing, real health checks failing, real Auto Scaling events triggering. They have to *respond* to an incident, not describe how they'd respond to a hypothetical one.

**Optimize** — "Here's your running architecture. Cost Explorer says it's $3,200/month. The client wants it under $1,000. Change it — but it has to keep serving traffic while you do it." Live cost data, live traffic, real tradeoffs. Switch to Graviton instances? Add a caching layer? Move to Spot? The student makes changes and sees the cost estimate update.

**Compare** — "You said SQS is better than Kinesis for this use case. Let me set up both. Push messages and let's see what actually happens." Side-by-side live behavior. The student watches throughput, ordering, fan-out, replay capability — and realizes their assumption was wrong (or right) based on real evidence.

---

### Real-Time Assessment Signals

Assessment happens continuously, not at the end. During every interaction, the tutor observes:

**Silence is signal.** A 30-second pause before a correct answer means something totally different than an instant correct answer — the first shows the student is reasoning, the second might mean they already knew it cold or looked it up. A 3-minute silence followed by a suddenly perfect, well-structured answer is a very different pattern than 3 minutes of the student typing partial attempts, deleting, trying again.

This compounds with the competency model. If a student has high confidence on VPC networking and then freezes for 4 minutes on a basic subnet question — the model flags that. Maybe their confidence score was inflated. Maybe they memorized the concept but can't apply it under pressure. That's exactly the kind of gap the tutor exists to find.

In voice interviews this is even more powerful. Hesitation, filler words, long pauses, starting and restarting an explanation — all real-time indicators of actual understanding vs surface-level recall. The tutor already does this (TAi's Nova Sonic silence detection in production).

**The process is the assessment, not the answer.** How much help did the student need? What kind of help? How quickly did they apply a hint? Did they need the same hint twice? Could they transfer the concept to a new scenario without help? A student who struggles through a VPC design with 3 hints but gets there and can explain why — that student genuinely understands. Two students both get the right answer, but one needed 0 hints and the other needed 4. That's not "both passed." That's a measurable difference in mastery that no multiple-choice exam captures. All of this data feeds back into the competency model after every interaction.

---

### Assessment in the AI Era

Every institution, every certification body, every school is asking: **"How do we assess people when everyone has AI?"**

The answers so far are all defensive — lockdown browsers, proctoring cameras, banning phones, pen and paper. All losing battles.

**Our answer: make the AI the assessment environment itself.**

The tutor *is* an AI. It has an unfair advantage no human proctor has — it's seen the learner's reasoning patterns, vocabulary, common mistakes, and learning trajectory across dozens of sessions. The competency model is a behavioral fingerprint.

**The process is the assessment, not the answer.** Everything the learner does with the tutor — every question they ask, every hint they need, how many hints before they get it, whether they need the same hint twice, whether they can transfer a concept to a new scenario without help — that is the assessment data. Two learners both get the right answer, but one needed 0 hints and the other needed 4. That's not "both passed." That's a measurable difference in mastery that no multiple-choice exam captures.

**Real-time probing defeats cheating.** A human proctor sees a suspicious answer and can only flag it after the fact. The AI tutor sees a suspicious answer and immediately asks: "Great answer. Now explain the third point in your own words." If the learner understands, they answer easily. If they pasted from ChatGPT, they collapse. The assessment isn't "did you write this yourself" — it's "can you defend what you said."

**Behavioral fingerprinting.** The tutor has seen the student's writing style, reasoning patterns, vocabulary level, and common mistakes across dozens of sessions. If a student who consistently writes short, informal responses with specific types of errors suddenly produces a perfectly structured, comprehensive answer — the tutor notices, because it contradicts the model. More importantly, it can probe in real time rather than just flagging after the fact.

**Don't fight AI — absorb it.** If the learner is already inside an AI tutor that has full context on their learning journey, there's no advantage to opening ChatGPT in another tab. The tutor is *better* than ChatGPT for this task — it knows the course material, knows the learner's gaps, and can operate real AWS services live. The tutor can even say: "You look stuck. Want to work through this together?" — turning the AI from a cheating risk into a guided learning moment.

**Exam dumps die overnight.** You can't dump a live interactive assessment where the agent improvises based on your competency model. Every learner gets a different experience.

**The pitch to AWS:** you don't just get a better tutor. You get a new model of assessment that works in the AI era. Every other certification body is terrified of AI cheating. AWS could be the first to say: **"We don't ban AI. We built the AI. And it knows exactly what you understand."**

---

### How It Integrates with Every Skill Builder Feature

The intelligence layer doesn't replace Skill Builder features. It makes every existing feature smarter by consuming its signals and adding a coaching presence.

| Skill Builder Feature | Current Experience | + Intelligence Layer |
|---|---|---|
| **Digital Courses (900+)** | Watch linearly, mark complete | Tutor selects which chapters to watch (skips what you know), highlights connections to your weak areas during playback, Socratic tests you immediately after |
| **Builder Labs (200+)** | Follow scripted steps | Coaching Panel alongside: asks why you're making each choice, changes constraints mid-lab, turns a walkthrough into an assessment |
| **SimuLearn (200+)** | AI customer scenario → build | Results feed competency model; tutor detects reasoning gaps in your proposals and runs targeted coaching sessions |
| **Practice Exams** | Score + per-question rationale | Wrong-Answer Triage: cross-question pattern detection, misconception identification, targeted remediation plan |
| **Cloud Quest** | 3D quests, earn badges | Quest completion signals update competency model; tutor knows you've done hands-on with VPC but haven't touched IAM |
| **Escape Room** | Gamified exam prep | Results cross-referenced with practice exam patterns to refine readiness score |
| **Meeting Simulator** | Practice stakeholder communication | Our voice mock tests *architectural reasoning* — complementary, not overlapping |
| **Learning Plans** | Static curated course lists | **Replaced** by dynamic daily plans generated from competency model + exam date + active misconceptions |
| **Skills Profile** | Shows what you've **completed** | We add what you've **mastered** — domain-weighted readiness score, misconception list, stability ratings |

**Five new surfaces that Skill Builder doesn't have:**

1. **Coaching Panel** — persistent AI tutor alongside every feature, with full cross-feature context
2. **Live AWS Sandbox** — agent-operated, improvised, per-student sub-account, 200+ services
3. **Live Technical Review** — voice + sandbox + 6 assessment modes (Explain / Debug / Implement / Operate / Optimize / Compare)
4. **Architecture Design Mentor** — guided two-phase design dialogue → architecture document → build in sandbox
5. **Infrastructure Portfolio** — git-backed architecture designs, IaC templates, version-controlled progression

---

### Where It Fits Beyond Skill Builder: Every Layer of AWS Training

The tutor isn't a replacement for any AWS offering — it's the **connective tissue** that makes every layer more effective.

| AWS Layer | Current Experience | With the Intelligence Layer |
|---|---|---|
| **Skill Builder Free** (900+ courses) | Watch linearly, no feedback | Tutor knows what you've mastered → skips basics you already know, deep-dives where you're weak. Links to the *exact 2-minute segment* of the relevant video |
| **Skill Builder Subscription** ($29/mo) | Sandboxed labs, practice exams | The tutor's live sandbox surpasses static labs — any service, any scenario, improvised on the fly based on the conversation. Practice exam results feed back into the student model |
| **Classroom Training** ($600-$3K) | Instructor-led, time-limited | Before class: tutor pre-assesses and surfaces prerequisite gaps. After class: tutor reinforces concepts via spaced review and voice mock interviews. Extends the $3K investment from 5 days to months |
| **Cloud Institute** ($630/quarter) | Structured multi-quarter program | Tutor provides 1-on-1 mentoring between cohort sessions. Tracks mastery across quarters. Flags at-risk students to human instructors before they fall behind |
| **Certification Exams** ($100-$300) | One-shot proctored test | Mock exams are hands-on: deploy architectures, debug real failures, respond to live incidents. Voice interviews test verbal explanation. The tutor tells you when you're *actually ready* — because it's watched you operate, not just answer questions |

---

### The Competency Model: From Completion to Comprehension

The core of the system. A persistent, multi-dimensional model of each learner that tracks **what they actually understand** — not what they've watched or clicked through.

#### Two-Layer Learning State

The system maintains two complementary layers of learning state:

**TutorState (per-conversation, tactical)** — tracks what the learner seems to believe *right now*: current hypothesis, learning goal, misconceptions detected this session, evidence used, next question type. This is the tactical layer — it guides the tutor's next move within a single interaction.

**Competency Model (per-student, strategic)** — tracks long-term mastery across all sessions: confidence, stability, context scope, demonstrated via, across all features. This is the strategic layer — it drives study plans, readiness scores, and proactive intervention.

Two layers working together. Within a conversation, the tutor knows what to probe next. Across sessions, it knows the long-term trajectory. No other tool has either, let alone both.

#### Four Dimensions Per Concept

| Dimension | What It Tracks | Example |
|---|---|---|
| **Confidence** (0.0–1.0) | How likely the learner understands this concept | IAM policy evaluation: 0.55 (shaky) |
| **Stability** (low/medium/high/confirmed) | How many times and ways it's been tested | Low = tested once; Confirmed = tested 4+ times across different formats |
| **Context Scope** | In what contexts has understanding been demonstrated | theoretical / implementation / debugging / verbal / operational |
| **Demonstrated Via** | How was understanding demonstrated | socratic_dialogue / practice_exam / builder_lab / voice_mock / sandbox_operation |

A learner can *explain* S3 replication (theoretical scope, confidence 0.8) but has never *debugged* a failed cross-region replication (no debugging scope, no operational scope). The model sees this gap. A practice exam might not.

#### Mapped to Certification Domains

The model maps concepts to official exam domain weightings. For any certification:

```
Readiness Score: 71%

Domain 1: Design Secure Architectures        ██████░░░░  0.62  (weight: 30%)
  └─ IAM policy evaluation                   ████░░░░░░  0.42  ← dragging you down
  └─ KMS key management                      ████████░░  0.78
  └─ VPC security groups / NACLs             ███████░░░  0.71
  └─ ...

Domain 2: Design Resilient Architectures     ████████░░  0.78  (weight: 26%)
  └─ Multi-AZ patterns                       █████████░  0.88
  └─ Disaster recovery strategies            ███████░░░  0.65
  └─ ...

Domain 3: Design High-Performing Arch.       ███████░░░  0.71  (weight: 24%)
Domain 4: Design Cost-Optimized Arch.        ██████░░░░  0.68  (weight: 20%)
```

The readiness score is **weighted by exam domain percentages** — so a weakness in a 30%-weight domain hurts more than a weakness in a 20%-weight domain. No existing tool computes this.

#### Pre-Assessment Onboarding (Cold Start)

New learners take a 15-minute diagnostic quiz covering all exam domains. Results initialize the competency model with non-zero scores — the same pattern as TAi's Canvas bootstrap, but self-contained. Experienced learners skip basics immediately; beginners get a foundation-first path. No more one-size-fits-all onboarding.

#### Misconception Detection

Misconceptions are discovered organically, never pre-loaded. State machine:

```
candidate → holding → confirmed (frequency ≥ 3) → remediated
```

Example: Student says "VPC peering is transitive" in a coaching session. Tutor records it as candidate. Student makes the same error in a practice exam. Frequency = 2, still candidate. Student designs a peered network assuming transitivity in a SimuLearn scenario. Frequency = 3 → confirmed misconception. Tutor now proactively targets this — in the next relevant interaction, it specifically constructs a scenario that exposes the non-transitivity.

This works **across features** because the competency model is shared. A misconception surfaced in a practice exam gets tested in a voice mock and remediated in a sandbox demo.

AWS has rich misconceptions to detect:
- S3 consistency model (eventual vs strong for different operations)
- IAM policy evaluation order (identity-based vs resource-based vs SCPs)
- VPC default routing and peering transitivity
- SQS visibility timeout behavior
- DynamoDB partition key design and hot partitions
- Lambda cold starts and concurrency limits

#### Teaching Strategy Selection

The model doesn't just track what you know — it decides **how to teach you next**:

| Your State | Strategy | What Happens |
|---|---|---|
| Confidence LOW, stability LOW | **EXPLAIN** | Build the foundation — clear explanation with examples |
| Confidence MEDIUM, stability LOW | **SOCRATIC** | Probe with questions to confirm or correct understanding |
| Confidence HIGH, scope missing "verbal" | **MOCK PRACTICE** | Voice session to test verbal articulation |
| Confidence HIGH, scope missing "implementation" | **DEMONSTRATE** | Sandbox: build it and see what happens |
| Active misconception detected | **CORRECT** | Targeted remediation — construct the counter-example |
| Confidence HIGH, stability CONFIRMED | **CHALLENGE** | Push to edge cases and constraint shifts |

Strategy history is logged per learner. If SOCRATIC didn't work last time on this concept, the engine tries DEMONSTRATE next. Adaptive, not scripted.

**70/30 Socratic Framework:** 70% guiding questions, 30% factual content. Never front-load answers. Identify misconceptions without saying "wrong." One question per response. This framework is proven in production (htgaa-chat and TAi), not theoretical.

#### Adaptive Mock Exam Engine

Question selection is not random. The engine uses:

- **Domain weighting** — questions weighted by competency gaps. Weak domains get more questions
- **Bloom's stratification** — recall → comprehension → application → analysis → design. The engine knows which level the student is at per concept and pushes them to the next level
- **Item response theory** — question difficulty calibrated against student ability. Too easy = no signal. Too hard = frustration. The sweet spot reveals genuine understanding
- **Cross-question pattern tracking** — after each mock exam, the system doesn't just report "you got 72%." It identifies *why* you got questions wrong: misconception patterns, knowledge gaps vs careless errors, domain-specific weaknesses

After each mock exam, the competency model updates across all tested domains simultaneously. The next mock exam will be completely different — weighted toward confirmed weaknesses, testing at the right difficulty level.

#### Cross-Certification Competency Sharing

IAM mastery earned studying for Solutions Architect Associate carries over to Security Specialty. VPC networking knowledge from the Networking Specialty feeds into Advanced Networking. Shared concept nodes in the competency model prevent re-testing mastery you've already demonstrated.

This means a student pursuing multiple certifications (common in the AWS ecosystem) benefits from a unified learning journey, not isolated silos.

---

### Grounded in AWS Content, Not Hallucination

The tutor doesn't rely on the LLM's training data. Every response is grounded in AWS's own content:

**Video transcripts** from re:Invent talks, AWS workshops, and training videos — with timestamped citations and watch-links precise to the second. "Watch this 2-minute segment where the AWS CISO explains IAM policy evaluation order."

**A knowledge graph** of AWS concepts — service relationships, prerequisite chains, difficulty layers. "You're weak on Raft-based consensus in DynamoDB Global Tables. Your model shows you haven't mastered basic DynamoDB partition keys yet — that's the prerequisite. Let's start there."

**Official documentation and whitepapers** — Well-Architected Framework, service FAQs, security best practices — chunked, embedded, and retrieved via Bedrock Knowledge Bases.

**The retrieval pipeline is production-proven.** It runs in production at Harvard today (htgaa-chat): Bedrock KB retrieves top-16 transcript chunks → Cohere rerank (`cohere.rerank-v3-5:0` on Bedrock) re-scores by relevance → threshold filtering → Claude generates a response with inline citations `[1]`, `[2]` linking to exact transcript timestamps. The chunking is a custom semantic chunker — splits at speaker changes, topic shifts, and natural pauses, preserving exact `startSec`/`endSec` per chunk. That's why watch-links are precise to the second, not approximations.

**Cross-domain queries work out of the box.** The system already supports "Full Course" composite mode — a single query spanning all lectures simultaneously, with results distributed across sources to avoid single-topic domination. For the AWS tutor, this means a student can ask "How do VPCs relate to security groups and NACLs?" and get grounded answers pulling from the networking re:Invent talk, the security talk, and the Well-Architected whitepaper — all in one response, all with citations.

All content is embedded within the platform. Learners never leave to watch a video or read a doc — everything plays inline, in context, cited and linked.

#### AWS Content Sources

- **re:Invent talks** — ingest via htgaa-chat's transcribe pipeline → watch-links to exact video segments
- **AWS Documentation** — ingest into LeanRAG graph → concept relationships, prerequisite chains
- **AWS Whitepapers** (Well-Architected, security, etc.) — chunk into Bedrock KB
- **Certification guides** (SAA, SAP, DevOps, etc.) — structure into competency domains
- **AWS Workshops / Skill Builder** — link out as practice resources

---

### What a Day Looks Like

**Morning — tutor sends a notification (proactive):**

> "Your exam is in 18 days. Your readiness is 71%. Domain 1 (Security, 30% weight) is your biggest gap — IAM confidence is only 0.42. Today I've planned: (1) a 12-minute video segment on IAM policy evaluation, (2) a coaching session where I'll test you, (3) a sandbox demo showing how policies actually evaluate. Estimated time: 45 minutes."

**The learner opens Skill Builder — sees the Tutor Dashboard:**

```
Readiness: 71%  ████████████░░░░░  Target: 85%

Today's Plan (generated from your competency model)
┌──────────────────────────────────────────────────┐
│ 1. Watch: re:Invent SEC301 Chapter 3 (12 min)    │
│    IAM Policy Evaluation Logic                   │
│    Tutor will test you after                     │
│                                      [Start →]  │
├──────────────────────────────────────────────────┤
│ 2. Coaching: IAM Misconception Correction        │
│    You've confused identity-based and resource-  │
│    based policy evaluation 3 times               │
│    Strategy: CORRECT                             │
│                                      [Start →]  │
├──────────────────────────────────────────────────┤
│ 3. Sandbox: IAM Policy Evaluation Live Demo      │
│    See what actually happens when policies       │
│    conflict — real API calls, real results       │
│                                      [Start →]  │
└──────────────────────────────────────────────────┘

[Start Live Technical Review]    [Free Chat]
```

**The learner watches the video — tutor is beside it:**

```
┌──────────────────────────┐ ┌────────────────────┐
│                          │ │ Tutor              │
│   re:Invent SEC301       │ │                    │
│   "IAM Policy Evaluation │ │ Notice what he says │
│    Logic Deep Dive"      │ │ about explicit deny │
│                          │ │ — it ALWAYS wins,   │
│   ▶ [=====>      ] 8:23  │ │ regardless of which │
│                          │ │ policy type.        │
│   CJ Moses, AWS CISO:   │ │                    │
│   "...when there is an   │ │ This is exactly    │
│    explicit deny in ANY  │ │ where you went     │
│    policy — that deny    │ │ wrong on your last  │
│    wins. Always."        │ │ practice exam.      │
│                          │ │                    │
└──────────────────────────┘ │ After this section, │
                             │ I'll ask you a      │
                             │ scenario question.   │
                             └────────────────────┘
```

**Video ends — coaching session starts immediately:**

> **Tutor:** "A Lambda function's execution role allows `s3:PutObject`. The bucket policy also allows this role. But the account's SCP denies `s3:PutObject`. Can the Lambda write to the bucket?"
>
> **Learner:** "Yes? Because both the role and bucket policy allow it?"
>
> **Tutor:** "Think about where SCPs sit in the evaluation chain. Who does an SCP apply to?"
>
> **Learner:** "...the whole account? So it overrides everything?"
>
> **Tutor:** "Right — SCP is an explicit deny. Let me show you in the sandbox."
>
> *Sandbox activates inline:*
> ```
> > aws iam simulate-principal-policy ...
> EvalDecision: implicitDeny
> MatchedStatements:
>   - Allow: arn:aws:iam::...role-policy
>   - Deny: arn:aws:organizations::...scp
> ```
>
> **Tutor:** "See? The SCP deny wins. Now — what if I remove the SCP and both the role policy AND bucket policy allow the action. Same result, or different?"

One flow. Video → Socratic coaching → sandbox demo. The learner never leaves the platform. Every step informed by their specific competency model.

**That evening — learner does a practice exam:**

> Score: 76%. Wrong-Answer Triage activates.
>
> "You missed 16 questions. I found 3 misconception patterns:
>
> **Pattern 1:** Resource-based vs identity-based policy evaluation (4 questions) — you consistently assume identity-based policies take precedence. We worked on this today, but it hasn't stuck. Scheduling a spaced review in 3 days.
>
> **Pattern 2:** SQS FIFO message-group ordering vs Kinesis shard-level ordering (3 questions) — you're choosing SQS when the scenario requires ordered processing by partition key.
>
> **Pattern 3:** S3 storage class selection under cost constraints (2 questions) — you're ignoring minimum storage duration charges.
>
> Remaining 7 errors: isolated, no pattern.
>
> Readiness update: 73% → 69% (Domain 1 dropped)."

**3 days later — spaced review triggers:**

> "Quick check: an SCP denies `ec2:TerminateInstances` for the production OU. But the admin's IAM role explicitly allows it. Can they terminate instances? Why or why not?"

Same misconception. Different scenario. Different service. Testing whether the concept transferred.

---

### How It Works — User Modes

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

---

### Competitive Landscape: The Gap Is Real

We audited every AI-powered tool in the AWS certification prep space (April 2026).

| Capability | Skill Builder | Pluralsight Iris | Tutorials Dojo / Maarek / Cantrill | Our Tutor |
|---|---|---|---|---|
| **Cross-feature student model** | No — each feature is siloed | 10-query context window | None | **Persistent 4-dimension model across all surfaces** |
| **Two-layer learning state** | None | None | None | **TutorState (tactical) + Competency Model (strategic)** |
| **Misconception tracking** | None | None | Static per-question explanations | **Cross-session state machine: candidate → confirmed → remediated** |
| **Adaptive teaching strategy** | Same 4-step plan for everyone | Content recommendation only | None | **6 strategies selected per-interaction based on learner state** |
| **Wrong-answer pattern detection** | Per-question rationale | None | Per-question rationale | **Cross-question misconception pattern identification** |
| **Proactive intervention** | None | None | Drip email at best | **State-driven: reaches out when competency model detects risk** |
| **Agent-operated live sandbox** | Builder Labs (scripted, pre-built) | None | None | **Any service, improvised, driven by competency model** |
| **Voice + sandbox assessment** | Meeting Simulator (communication, not cert-specific) | None | None | **6 assessment modes: Explain/Debug/Implement/Operate/Optimize/Compare** |
| **Domain-weighted readiness score** | Skills Profile shows completion | None | Per-exam score only | **Per-concept, per-domain, weighted by exam percentages** |
| **AI-era behavioral assessment** | None | None | None | **Continuous process assessment + real-time probing** |
| **Multi-language AI tutoring** | AI features English-only | English only | English only | **10+ languages, English technical terms preserved** |
| **Architecture design mentor** | None | None | None | **Guided design dialogue → document → build in sandbox** |
| **Cross-domain grounded queries** | None — each lab/course is siloed | None | None | **Single query spans networking + security + storage with citations** |

**Microsoft and Google are further behind.** Microsoft Learn has no AI tutor for Azure certifications — Copilot is marketed as a generic "study buddy." Google Skills (relaunched Oct 2025) added gamification (Leagues, streaks) but no AI tutor for GCP certifications. **An agentic tutor for AWS certifications would be a first-mover advantage not just over third parties, but over competing cloud platforms.**

**The academic evidence is strong.** Randomized controlled trials (Nature Scientific Reports, 2025; IACIS) show AI tutoring systems with proper student models produce **15-35% performance gains** over conventional digital training, with the largest effects on engagement and retention.

---

### Everyone Wins

**For the learner:** A tutor that knows your gaps, adapts to your level, and tells you when you're genuinely ready — not when you've watched all the videos. You walk into the exam confident because you've been tested on your actual weak spots. You pass with real understanding, not memorized answers. You're more competitive in the job market.

**For AWS:**

- **Higher certification pass rates** — every certified professional drives AWS adoption. The tutor targets the gap between "watched the videos" and "actually ready"
- **Certifications people trust** — the #1 criticism is "certified people can't do the job." Live operation assessment produces practitioners, not memorizers. The certification becomes more valuable to employers
- **Skill Builder revenue grows** — a $29/month subscription that intelligently guides you through 900 courses, 200 labs, and 200 simulations is worth far more than one that lets you browse them yourself
- **The entire AWS ecosystem as a teaching surface** — every service learners operate in the sandbox is a service they'll use (and pay for) in production. The tutor doesn't just teach AWS — it creates AWS users. Students who've operated DynamoDB, Lambda, and VPC hands-on during training are the ones who choose AWS at their next job
- **An answer to AI-era assessment** — every certification body is panicking about AI cheating. AWS could be the first to say: "We don't ban AI. We built the AI."
- **Skill Builder force multiplier** — the tutor makes existing free and paid content more effective by routing each learner to the right content at the right time, increasing engagement and retention
- **Classroom training ROI extension** — a $3K classroom course currently delivers 5 days of impact. The tutor extends that to months of adaptive reinforcement, making the investment easier to justify
- **Competitive advantage over Azure and GCP** — neither has anything close. This would be a generational first
- **Bedrock showcase** — the first agentic tutor built on AWS's own stack (AgentCore + Nova Sonic + Bedrock KB + Cohere), for AWS's own certifications. The reference architecture for VP Swami Sivasubramanian's "agentic AI" narrative
- **Research-validated pedagogy** — not another chatbot, but an agentic system with measurable learning outcomes from real university deployments

**For the industry:** More people who actually understand AWS services, not people who memorized exam dumps. The tutor tests verbal explanation, architectural reasoning, live debugging, and cost optimization under constraints — the skills that matter on the job.

**For the global market:** AWS certifications are taken worldwide, but every existing AI prep tool teaches in English. The tutor answers in 10+ languages — already running in production. A developer in Tokyo studies in Japanese. An engineer in São Paulo studies in Portuguese. Technical terms stay in English (they're the same on the exam). This is a massive unlock for the ~60% of AWS cert candidates whose first language isn't English.

**The flywheel:**

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

---

### Entirely on AWS

| Service | Role |
|---|---|
| **Bedrock (Claude)** | Conversational AI — Haiku for daily tutoring, Sonnet for reasoning and evaluation |
| **Bedrock (Nova Sonic)** | Real-time bidirectional voice for Live Technical Reviews |
| **Bedrock Knowledge Bases** | RAG over video transcripts, docs, whitepapers. Custom semantic chunks preserve timestamps |
| **Bedrock (Cohere Rerank)** | Precision filtering — re-scores chunks by relevance, production-proven |
| **Bedrock (Cohere Embed)** | Knowledge graph entity anchoring + KB vector search |
| **Bedrock AgentCore** | Agent orchestration, tool management, sandbox coordination |
| **Organizations + SCPs** | Per-learner sub-accounts with service isolation and budget guardrails |
| **All 200+ services** | The teaching lab — agent calls any service API in learner's sandbox |
| **CloudWatch** | Real-time metrics, logs, dashboards visible to learner during demos/assessments |
| **Cost Explorer** | Live cost data as teaching tool |
| **CloudFormation** | Agent deploys/tears down teaching scenarios; learners debug and author templates |
| **DynamoDB** | Competency models, conversations, assessment data |
| **S3 + CloudFront** | Video hosting with presigned URL access |
| **Transcribe** | Video → searchable transcript with word-level timestamps |
| **Translate** | Subtitle generation for video content in 10+ languages |
| **Lambda** | Proactive notifications + serverless sandbox scenarios |
| **SES** | Proactive outreach, spaced review notifications |
| **Cognito** | Authentication, session management, OAuth integration, group-based permissions for admin/instructor roles |

---

### Evidence: This Already Works

The core technology is deployed and serving real students in two university courses today.

**TAi** — Agentic TA for CS6650 (Distributed Systems), Northeastern University Vancouver
- Live on WhatsApp since April 2026, serving 9+ students
- Persistent 4-dimension competency tracking across 40+ concepts
- Misconception state machine: candidate → confirmed → remediated
- 6 adaptive teaching strategies with logged effectiveness
- Real-time voice mock interviews (Nova Sonic) with Shadow Evaluator (Sonnet scoring mid-interview, async tool calling)
- LeanRAG knowledge graph (zero LLM calls at query time)
- Proactive teaching patrol with 10 intervention triggers, 90% silence rule
- Cross-session memory with decay classes (permanent → 90d → 14d → 24h)
- Supervised by Professor Yvonne Coady

**htgaa-chat** — AI Tutor for "How To Grow Almost Anything" (Synthetic Biology), Harvard
- Live at chat.htgaa.org, serving students across 9 lectures
- Bedrock KB RAG with Cohere rerank — production pipeline, not prototype
- Custom semantic transcript chunking (speaker/topic/pause boundaries, precise timestamps)
- Timestamped watch-links and inline citations (`[1]`, `[2]` → exact video moments)
- Full-course cross-domain queries — one question, answers from all 9 lectures with distributed citations
- TutorState per-conversation tracking (learning goal, hypothesis, next question type)
- 70/30 Socratic framework (70% guiding questions, 30% facts)
- Multi-language tutoring (10 languages, per-conversation preference)
- Architecture design mentor (two-phase: structured dialogue → document generation)
- DynamoDB persistence, conversation soft-delete, S3 presigned video URLs

**The Skill Builder intelligence layer combines the strongest capabilities of both:**
- TAi's agentic engine: persistent competency model, adaptive strategy, misconception tracking, proactive intervention, voice interviews + shadow evaluator, knowledge graph, cross-session memory, spaced review
- htgaa-chat's content infrastructure: Bedrock KB RAG + Cohere rerank, custom semantic chunking, timestamped watch-links, inline citations, cross-domain queries, TutorState, multi-language, video integration, DynamoDB persistence

**~85% of the intelligence layer ports directly from these production systems.** The ~15% genuinely new work is: live AWS sandbox (agent-operated sub-accounts), the six assessment modes, cross-feature event bus integration with Skill Builder, and AI-era behavioral assessment.

---

### What Each Project Contributes

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
| — | Discourse SSO (→ replaced by Cognito) |

---

### Capability Mapping: What Ports, What's New

Both TAi and htgaa-chat are production systems with 20+ distinct capabilities each, serving real students at two universities. We audited every capability against the AWS tutor requirements. **~85% port directly or with medium adaptation. The remaining ~15% is genuinely new work.**

#### Direct Ports from TAi (minimal changes — swap content domain, same engine)

| TAi Capability | AWS Tutor Adaptation |
|---|---|
| **Socratic tutoring** — never gives direct answers, Socratic depth levels (surface probe → assumption challenge → contradiction exposure → meta-cognition), 150-word cap, one question per response | Same approach. AWS domains instead of distributed systems. Same depth levels, same response discipline |
| **Competency tracking** — 40+ concepts, 4 dimensions (confidence, stability, context scope, demonstrated via), updated after every substantive interaction | Map to SAA-C03 exam domains (Compute, Storage, Networking, Security, Database, Serverless, etc.). Same 4-dimension model, same update protocol |
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

#### Ports with Medium Adaptation

| Capability | Source | AWS Tutor Adaptation | What Changes |
|---|---|---|---|
| **Final project two-phase mentor** | htgaa-chat | **Architecture Design Mentor** — structured design dialogue for AWS architectures (traffic patterns? RPO/RTO? budget? compliance?) → complete architecture document | Domain swap: synthetic biology → cloud architecture. Same two-phase pattern, same prerequisite validation |
| **Foundry (git-backed notebook)** | htgaa-chat | **Infrastructure Portfolio** — git-backed architecture designs, CloudFormation/Terraform templates. Tutor reviews version diffs | Git backend stays, content type changes from lab protocols to IaC templates |
| **Discourse SSO** | htgaa-chat | **Cognito auth** — replace Discourse with AWS Cognito for standalone auth | Auth provider changes; session management pattern is the same |
| **Transcript ingest pipeline** | htgaa-chat | Add parallelized bulk ingest for 100+ re:Invent talks. Same per-lecture pipeline, add batch orchestration | Scale: 9 lectures → 100+ talks. Same pipeline per video, add batch wrapper |
| **Proactive outreach** | TAi | Email/browser push notifications instead of WhatsApp. New triggers: exam date approaching + weak domain | Notification channel changes; trigger logic same pattern |
| **Canvas LMS integration** | TAi | Pre-assessment onboarding quiz + self-reported exam date + optional Skill Builder completion import | New data source, but competency bootstrap pattern is the same |
| **Submission content analysis** | TAi | Analyze practice exam results — identify *why* answers are wrong (misconception vs knowledge gap vs careless error) | Same extraction pattern, different input format |
| **Instructor admin tools** | TAi | Web admin dashboard: cohort management, cert progress tracking, at-risk student alerts | Same capabilities, web UI instead of WhatsApp admin channel |
| **Analytics dashboard** | TAi | Direct port of the 7-page design. Add: exam readiness score, cert domain breakdown | Already fully designed, needs implementation |

#### Genuinely New (not in TAi or htgaa-chat)

| New Capability | Description |
|---|---|
| **Live AWS Sandbox** | Per-student AWS sub-account via Organizations + SCPs. Agent calls any AWS service API as MCP tools — provisions, configures, breaks, and tears down infrastructure live during conversations. Every service is a potential teaching moment. The competency model drives what to provision; live results update the model. Real-time visual output: CloudWatch dashboards, Cost Explorer graphs, network diagrams updating as resources are created |
| **Hands-on interactive assessment** | Six assessment modes that replace multiple choice: Explain / Debug / Implement / Operate / Optimize / Compare. Agent improvises challenges based on competency model — every student gets a different assessment. Continuous assessment signals: silence duration, hint dependency, behavioral patterns, process quality |
| **AI-era assessment integrity** | The tutor IS an AI — it has seen the student's writing style, reasoning patterns, and common mistakes across sessions. The competency model is a behavioral fingerprint. Suspicious patterns trigger real-time probing. Don't fight AI — absorb it: the tutor is better than ChatGPT because it knows the student, the material, and can operate live services. Exam dumps become worthless when every assessment is improvised |
| **Adaptive mock exam engine** | Question bank organized by exam domains. Bloom's stratification (recall → comprehension → application → analysis → design). Questions weighted by competency gaps — weak domains get more questions. After each mock exam, competency model updates across all tested domains |
| **Cross-certification competency sharing** | IAM mastery earned studying for SAA carries over to Security Specialty. Shared concept nodes in the competency model. Students pursuing multiple certifications benefit from a unified learning journey |
| **Pre-assessment onboarding** | New learner takes a 15-minute diagnostic quiz covering all exam domains. Results initialize the competency model with non-zero scores. Skips experienced learners past basics immediately |
| **Cross-feature event bus** | Integration with Skill Builder's existing features — consumes learner activity signals (course completions, lab outcomes, practice exam results, SimuLearn scores) and propagates them through the intelligence layer |

#### What Doesn't Port (and doesn't need to)

| Capability | Source | Why Not Needed |
|---|---|---|
| WhatsApp channel (Baileys) | TAi | Web app is the primary interface. Could add WhatsApp as Phase 3 for spaced review nudges |
| Voice transcription (Transcribe Streaming for voice notes) | TAi | Web browser handles audio directly; Nova Sonic is speech-to-speech |
| WhatsApp reactions | TAi | Not applicable to web UI |
| WhatsApp message splitting (4000 char limit) | TAi | Web has no character limit |
| Docker container isolation per student | TAi | htgaa-chat's Next.js architecture handles multi-user natively; DynamoDB provides data isolation |
| GitHub integration (Khoury GHE) | TAi | Not needed for certification prep (could add later for DevOps cert) |
| Discourse SSO plugin | htgaa-chat | Replace with AWS Cognito — no dependency on external forum |
| Lab equipment catalog | htgaa-chat | Replace with AWS service catalog — same structured knowledge pattern, different domain |
| Foundry username whitelist | htgaa-chat | Replace with role-based access — all students get portfolio access |

---

### Key Differentiators: What No Other Tool Does

1. **Remember you** — know you understand EC2 but struggle with IAM policies, across sessions. Two-layer learning state: tactical (what you seem to believe right now) + strategic (your long-term mastery profile)
2. **Adapt strategy** — explain VPCs from scratch if you're new, challenge you with edge cases if you're advanced. 70/30 framework: 70% guiding questions, 30% factual content
3. **Link to the exact moment** in a re:Invent talk where Werner Vogels explains eventual consistency — precise to the second, with Cohere rerank ensuring the most relevant segments surface first
4. **Operate real AWS services live** — don't just say "S3 lifecycle policies transition objects to Glacier" — create the bucket, apply the policy, show the real API output
5. **Conduct voice mock interviews** — "You're the solutions architect. The client needs multi-region failover with RPO under 1 minute. Walk me through your design."
6. **Assess by operation, not recall** — "Fix this broken CloudFormation stack" instead of "Which option best describes CloudFormation?"
7. **Proactively reach out** — "You haven't reviewed S3 replication since 2 weeks ago, and it's a high-weight cert topic. Want a quick review?"
8. **Teach in your language** — 10+ languages, preserving English technical terms. No other cert prep tool offers AI tutoring in Japanese, Korean, Chinese, Arabic, Portuguese, or Hindi
9. **Guide architecture design** — structured two-phase mentor: asks the right questions, validates each decision, generates a complete architecture document — which you build in the sandbox
10. **Query across all domains at once** — ask a question that spans networking, security, and storage, and get a grounded answer pulling from multiple sources with citations to each

---

### Phased Rollout

**Phase 1 — Intelligence Layer MVP (6 weeks)**
- Competency model mapped to certification exam domains (4 dimensions per concept)
- Two-layer learning state: TutorState (tactical) + Competency Model (strategic)
- Teaching strategy engine (6 strategies, adaptive selection, 70/30 Socratic framework)
- Coaching Panel alongside courses and Builder Labs
- Full RAG pipeline: Bedrock KB + Cohere rerank + custom semantic chunking
- Ingest 20+ re:Invent talks on core SAA topics (EC2, S3, VPC, IAM, RDS, Lambda) + Well-Architected whitepapers + service FAQs
- Inline video player with timestamped watch-links and citations
- Cross-domain queries — single question spans networking, security, and storage sources
- Wrong-Answer Triage for practice exam results (pattern detection, misconception identification)
- Pre-assessment onboarding (15-minute diagnostic quiz for cold start)
- Domain-weighted readiness score
- Adaptive mock exam engine (Bloom's stratification, domain-weighted question selection)
- Multi-language tutoring (10 languages from day one)
- Proactive intervention (email/browser push based on competency model)
- Spaced review scheduling
- Misconception tracking and remediation (state machine)

**Phase 2 — Sandbox + Voice (6 weeks)**
- Live AWS Sandbox — per-learner sub-accounts via Organizations + SCPs
- Live Technical Review — voice (Nova Sonic) + sandbox + Shadow Evaluator (Sonnet)
- Six assessment modes: Explain / Debug / Implement / Operate / Optimize / Compare
- Architecture Design Mentor — guided design dialogue → architecture document → build in sandbox
- Infrastructure Portfolio — git-backed architecture designs, IaC templates, version diffs
- Deeper Skill Builder feature integration — consume SimuLearn scores, Cloud Quest completion, Escape Room results
- Teaching images (Nova Canvas) + Mermaid architecture diagrams
- Agent browser for dynamic AWS documentation access
- File reading — students upload CloudFormation templates, Terraform files, screenshots for review

**Phase 3 — Full Ecosystem**
- All 13 certifications with shared competency model across overlapping domains (IAM mastery from one cert carries to others)
- Per-certification sandbox service whitelists
- Continuous behavioral assessment — AI-era integrity model (silence detection, response pattern analysis, real-time probing)
- Cohort features — instructor/team dashboard, study group matching, progress tracking
- Enterprise tier — admin analytics, compliance reporting ("X% of team certified within Y months")
- Classroom companion — pre-assessment before instructor-led training, post-class spaced review
- Infrastructure Portfolio growth tracking — from basic to advanced architecture progression
- Mobile + messaging — WhatsApp/SMS channel for on-the-go spaced review prompts
- Developer/instructor mode — swap models, edit prompts, tune thresholds in-browser
- Open-source reference implementation (negotiable) — shows developers how to build on Bedrock

---

### What We're Asking

**From AWS:**

1. **Skill Builder integration access** — API or plugin pathway to consume learner activity signals (course completions, lab outcomes, practice exam results, SimuLearn scores) and surface the Coaching Panel alongside existing features
2. **Bedrock credits** — primary infrastructure cost. Natural fit for AWS EdStart or Education Equity Initiative
3. **Sandbox infrastructure** — Organizations + SCP setup for per-learner sub-accounts, or collaboration on a shared sandbox service
4. **Content access** — re:Invent session recordings/transcripts, or a licensing pathway for ingestion into our RAG pipeline
5. **Technical collaboration** — early access to Bedrock features (AgentCore, Nova Sonic, KB improvements)
6. **Co-visibility** — case study, blog post, or conference session at re:Invent / AWS Summit

These asks map to programs AWS already runs:
- **Education Equity Initiative** ($100M, re:Invent 2024) — cloud credits + technical advising for edtech
- **AWS EdStart** — accelerator for EdTech startups with credits, office hours, events. Has previously supported AI-powered adaptive learning startups (Joni.AI, Learning Matters, StudySmarter)
- **Pledge to America's Youth** — $30M in credits for educational AI
- **AWS AI for Teaching & Learning Framework** — published reference architecture explicitly inviting partners
- **Cengage partnership** (Nov 2025) — adaptive learning on Bedrock. AWS supplies infrastructure; expert partners own the pedagogy

**Why partner, not build internally?** AWS's Skill Builder team ships ~monthly releases focused on content breadth (new labs, new certs, new languages) and simulation features — not pedagogical modeling. AWS has a documented pattern of partnering for pedagogy: Cengage (Nov 2025, adaptive learning on Bedrock), Pearson, Code.org (Education Equity), Udacity (AI & ML Scholars). AWS supplies infrastructure and content; expert partners own the pedagogy.

We bring production-proven pedagogy (two university deployments, real students, real outcomes) and deep Bedrock experience (Claude, Nova Sonic, Cohere, Knowledge Bases, AgentCore). AWS brings Skill Builder's ecosystem, content, and infrastructure. Together: the first agentic intelligence layer for cloud certification, built on AWS, for AWS.

---

### Team

**Yuzheng Shi** — Developer. MS Computer Science, Northeastern University (graduating Aug 2026). Built TAi end-to-end: agentic core, LeanRAG knowledge graph, Nova Sonic voice interviews, shadow evaluator, full EC2 deployment. Deep Bedrock experience (Claude, Nova Sonic, Cohere, Transcribe, Polly, Nova Canvas).

**Professor Yvonne Coady** — Academic Advisor. CS6650 instructor, Northeastern University Vancouver. Research in distributed systems education. Supervises TAi deployment and pedagogy design.

**[HTGAA Collaborator]** — Built htgaa-chat for Harvard's HTGAA course. Production Bedrock KB + Cohere rerank RAG pipeline, Next.js web platform, custom semantic transcript chunking, inline citations, multi-language tutoring, TutorState tracking, architecture design mentor, git-backed Foundry notebook, DynamoDB persistence.

---

### Contact

Yuzheng Shi
[email]
[LinkedIn]
[GitHub: TAi repository]

---

*Built on AWS. For AWS. Teaching AWS — by operating AWS.*

*Skill Builder has the content. We add the intelligence. Together: the first certification system where the AI knows exactly what you understand.*
