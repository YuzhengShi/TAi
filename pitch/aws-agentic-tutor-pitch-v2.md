# The Brain for AWS Skill Builder
## An Agentic Intelligence Layer for AWS Certification

*We don't ban AI. We built the AI. And it knows exactly what you understand.*

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

Every AWS service is an API. The agent can call any of them.

Each learner gets a dedicated AWS sub-account via Organizations, isolated by Service Control Policies. The agent has full API access — every one of the 200+ AWS services becomes a teaching moment. This is fundamentally different from Builder Labs:

| | Builder Labs | Our Sandbox |
|---|---|---|
| Content | Pre-built, scripted steps | Agent improvises based on conversation and competency model |
| Scope | Specific lab scenario | Any AWS service, any combination |
| Adaptivity | Same lab for everyone | Two students asking about DynamoDB get completely different demos based on their gaps |
| Failure modes | Not included | Agent deliberately breaks things to test your response |
| Cost teaching | Not included | Real Cost Explorer data: "your architecture costs $X/month — optimize it" |

**The sandbox is not a separate mode.** It's woven into every conversation. The tutor says "let me show you" and real AWS infrastructure appears. The student says something wrong about how security groups work, and the tutor creates the exact scenario that disproves their assumption — live, in real time.

**The agent can improvise.** Student confused about Kinesis vs SQS? Spin up both, push the same messages, show the difference in behavior — ordering, fan-out, replay capability — side by side. No pre-built lab needed.

**The agent can demonstrate failure modes** — the things that separate exam-passers from practitioners:
- Stop an EC2 instance mid-request and show what happens to the ALB health check
- Trigger a Lambda cold start and measure the actual latency
- Exceed a DynamoDB throughput limit and show the throttling in CloudWatch
- Kill an Availability Zone and watch Auto Scaling respond in real time

**The competency model makes the sandbox intelligent.** Without the model, a sandbox is a playground — fun but unfocused. With the model, the tutor knows exactly which service to spin up, which failure mode to trigger, which edge case to demonstrate — because it knows what this specific learner doesn't understand yet.

**Learn by operating, not by reading.** You don't forget how DynamoDB partition keys work if you've seen a hot partition throttle your requests in real time.

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

---

### Assessment in the AI Era

Every institution, every certification body, every school is asking: **"How do we assess people when everyone has AI?"**

The answers so far are all defensive — lockdown browsers, proctoring cameras, banning phones, pen and paper. All losing battles.

**Our answer: make the AI the assessment environment itself.**

The tutor *is* an AI. It has an unfair advantage no human proctor has — it's seen the learner's reasoning patterns, vocabulary, common mistakes, and learning trajectory across dozens of sessions. The competency model is a behavioral fingerprint.

**The process is the assessment, not the answer.** Everything the learner does with the tutor — every question they ask, every hint they need, how many hints before they get it, whether they need the same hint twice, whether they can transfer a concept to a new scenario without help — that is the assessment data. Two learners both get the right answer, but one needed 0 hints and the other needed 4. That's not "both passed." That's a measurable difference in mastery that no multiple-choice exam captures.

**Real-time probing defeats cheating.** A human proctor sees a suspicious answer and can only flag it after the fact. The AI tutor sees a suspicious answer and immediately asks: "Great answer. Now explain the third point in your own words." If the learner understands, they answer easily. If they pasted from ChatGPT, they collapse. The assessment isn't "did you write this yourself" — it's "can you defend what you said."

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

**Three new surfaces that Skill Builder doesn't have:**

1. **Coaching Panel** — persistent AI tutor alongside every feature, with full cross-feature context
2. **Live AWS Sandbox** — agent-operated, improvised, per-student sub-account, 200+ services
3. **Live Technical Review** — voice + sandbox + 6 assessment modes (Explain / Debug / Implement / Operate / Optimize / Compare)

---

### The Competency Model: From Completion to Comprehension

The core of the system. A persistent, multi-dimensional model of each learner that tracks **what they actually understand** — not what they've watched or clicked through.

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

#### Misconception Detection

Misconceptions are discovered organically, never pre-loaded. State machine:

```
candidate → holding → confirmed (frequency ≥ 3) → remediated
```

Example: Student says "VPC peering is transitive" in a coaching session. Tutor records it as candidate. Student makes the same error in a practice exam. Frequency = 2, still candidate. Student designs a peered network assuming transitivity in a SimuLearn scenario. Frequency = 3 → confirmed misconception. Tutor now proactively targets this — in the next relevant interaction, it specifically constructs a scenario that exposes the non-transitivity.

This works **across features** because the competency model is shared. A misconception surfaced in a practice exam gets tested in a voice mock and remediated in a sandbox demo.

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

---

### Grounded in AWS Content, Not Hallucination

The tutor doesn't rely on the LLM's training data. Every response is grounded in AWS's own content:

**Video transcripts** from re:Invent talks, AWS workshops, and training videos — with timestamped citations and watch-links precise to the second. "Watch this 2-minute segment where the AWS CISO explains IAM policy evaluation order."

**A knowledge graph** of AWS concepts — service relationships, prerequisite chains, difficulty layers. "You're weak on Raft-based consensus in DynamoDB Global Tables. Your model shows you haven't mastered basic DynamoDB partition keys yet — that's the prerequisite. Let's start there."

**Official documentation and whitepapers** — Well-Architected Framework, service FAQs, security best practices — chunked, embedded, and retrieved via Bedrock Knowledge Bases.

**The retrieval pipeline is production-proven.** It runs in production at Harvard today (htgaa-chat): Bedrock KB retrieves top-16 transcript chunks → Cohere rerank (`cohere.rerank-v3-5:0` on Bedrock) re-scores by relevance → threshold filtering → Claude generates a response with inline citations `[1]`, `[2]` linking to exact transcript timestamps. The chunking is a custom semantic chunker — splits at speaker changes, topic shifts, and natural pauses, preserving exact `startSec`/`endSec` per chunk. That's why watch-links are precise to the second, not approximations.

All content is embedded within the platform. Learners never leave to watch a video or read a doc — everything plays inline, in context, cited and linked.

---

### What a Day Looks Like

**Morning — tutor sends a notification (proactive):**

> "Your exam is in 18 days. Your readiness is 71%. Domain 1 (Security, 30% weight) is your biggest gap — IAM confidence is only 0.42. Today I've planned: (1) a 12-minute video segment on IAM policy evaluation, (2) a coaching session where I'll test you, (3) a sandbox demo showing how policies actually evaluate. Estimated time: 45 minutes."

**The learner opens Skill Builder — sees the Tutor Dashboard:**

```
Readiness: 71%  ████████████░░░░░  Target: 85%

Today's Plan (generated from your competency model)
┌──────────────────────────────────────────────────┐
│ 1. 📹 Watch: re:Invent SEC301 Chapter 3 (12 min) │
│    IAM Policy Evaluation Logic                   │
│    Tutor will test you after                     │
│                                      [Start →]  │
├──────────────────────────────────────────────────┤
│ 2. 🎯 Coaching: IAM Misconception Correction     │
│    You've confused identity-based and resource-  │
│    based policy evaluation 3 times               │
│    Strategy: CORRECT                             │
│                                      [Start →]  │
├──────────────────────────────────────────────────┤
│ 3. 🔧 Sandbox: IAM Policy Evaluation Live Demo   │
│    See what actually happens when policies       │
│    conflict — real API calls, real results       │
│                                      [Start →]  │
└──────────────────────────────────────────────────┘

[Start Live Technical Review 🎤]    [Free Chat 💬]
```

**The learner watches the video — tutor is beside it:**

```
┌──────────────────────────┐ ┌────────────────────┐
│                          │ │ 🤖 Tutor            │
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
> 🔴 **Pattern 1:** Resource-based vs identity-based policy evaluation (4 questions) — you consistently assume identity-based policies take precedence. We worked on this today, but it hasn't stuck. Scheduling a spaced review in 3 days.
>
> 🟡 **Pattern 2:** SQS FIFO message-group ordering vs Kinesis shard-level ordering (3 questions) — you're choosing SQS when the scenario requires ordered processing by partition key.
>
> 🟡 **Pattern 3:** S3 storage class selection under cost constraints (2 questions) — you're ignoring minimum storage duration charges.
>
> Remaining 7 errors: isolated, no pattern.
>
> Readiness update: 73% → 69% (Domain 1 dropped)."

**3 days later — spaced review triggers:**

> "Quick check: an SCP denies `ec2:TerminateInstances` for the production OU. But the admin's IAM role explicitly allows it. Can they terminate instances? Why or why not?"

Same misconception. Different scenario. Different service. Testing whether the concept transferred.

---

### Competitive Landscape: The Gap Is Real

We audited every AI-powered tool in the AWS certification prep space (April 2026).

| Capability | Skill Builder | Pluralsight Iris | Tutorials Dojo / Maarek / Cantrill | Our Tutor |
|---|---|---|---|---|
| **Cross-feature student model** | No — each feature is siloed | 10-query context window | None | **Persistent 4-dimension model across all surfaces** |
| **Misconception tracking** | None | None | Static per-question explanations | **Cross-session state machine: candidate → confirmed → remediated** |
| **Adaptive teaching strategy** | Same 4-step plan for everyone | Content recommendation only | None | **6 strategies selected per-interaction based on learner state** |
| **Wrong-answer pattern detection** | Per-question rationale | None | Per-question rationale | **Cross-question misconception pattern identification** |
| **Proactive intervention** | None | None | Drip email at best | **State-driven: reaches out when competency model detects risk** |
| **Agent-operated live sandbox** | Builder Labs (scripted, pre-built) | None | None | **Any service, improvised, driven by competency model** |
| **Voice + sandbox assessment** | Meeting Simulator (communication, not cert-specific) | None | None | **6 assessment modes: Explain/Debug/Implement/Operate/Optimize/Compare** |
| **Domain-weighted readiness score** | Skills Profile shows completion | None | Per-exam score only | **Per-concept, per-domain, weighted by exam percentages** |
| **AI-era behavioral assessment** | None | None | None | **Continuous process assessment + real-time probing** |
| **Multi-language AI tutoring** | AI features English-only | English only | English only | **10+ languages, English technical terms preserved** |

**Microsoft and Google are further behind.** Microsoft Learn has no AI tutor for Azure certifications. Google Skills (relaunched Oct 2025) added gamification but no AI tutor for GCP certifications. An agentic tutor for AWS certifications would be a first-mover advantage not just over third parties, but over competing cloud platforms.

**The academic evidence is strong.** Randomized controlled trials (Nature Scientific Reports, 2025; IACIS) show AI tutoring systems with proper student models produce **15-35% performance gains** over conventional digital training, with the largest effects on engagement and retention.

---

### Everyone Wins

**For the learner:** A tutor that knows your gaps, adapts to your level, and tells you when you're genuinely ready — not when you've watched all the videos. You walk into the exam confident because you've been tested on your actual weak spots. You pass with real understanding, not memorized answers. You're more competitive in the job market.

**For AWS:**

- **Higher certification pass rates** — every certified professional drives AWS adoption. The tutor targets the gap between "watched the videos" and "actually ready"
- **Certifications people trust** — the #1 criticism is "certified people can't do the job." Live operation assessment produces practitioners, not memorizers. The certification becomes more valuable to employers
- **Skill Builder revenue grows** — a $29/month subscription that intelligently guides you through 900 courses, 200 labs, and 200 simulations is worth far more than one that lets you browse them yourself
- **The entire AWS ecosystem as a teaching surface** — every service learners operate in the sandbox is a service they'll use (and pay for) in production. The tutor doesn't just teach AWS — it creates AWS users
- **An answer to AI-era assessment** — every certification body is panicking about AI cheating. AWS could be the first to say: "We don't ban AI. We built the AI."
- **Competitive advantage over Azure and GCP** — neither has anything close. This would be a generational first
- **Bedrock showcase** — the first agentic tutor built on AWS's own stack (AgentCore + Nova Sonic + Bedrock KB + Cohere), for AWS's own certifications. The reference architecture for VP Swami Sivasubramanian's "agentic AI" narrative

**For the industry:** More people who actually understand AWS services, not people who memorized exam dumps. The tutor tests verbal explanation, architectural reasoning, live debugging, and cost optimization under constraints — the skills that matter on the job.

**For the global market:** AWS certifications are taken worldwide, but every existing AI prep tool teaches in English. The tutor answers in 10+ languages — already running in production. A developer in Tokyo studies in Japanese. An engineer in São Paulo studies in Portuguese. Technical terms stay in English (they're the same on the exam). This is a massive unlock for the ~60% of AWS cert candidates whose first language isn't English.

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
| **Lambda** | Proactive notifications + serverless sandbox scenarios |
| **SES** | Proactive outreach, spaced review notifications |
| **Cognito** | Authentication, session management |

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

### Phased Rollout

**Phase 1 — Intelligence Layer MVP (6 weeks)**
- Competency model mapped to certification exam domains (4 dimensions per concept)
- Teaching strategy engine (6 strategies, adaptive selection)
- Coaching Panel alongside courses and Builder Labs
- Full RAG pipeline: Bedrock KB + Cohere rerank + custom semantic chunking
- Ingest re:Invent talks + Well-Architected whitepapers + service FAQs as embedded content
- Inline video player with timestamped watch-links and citations
- Wrong-Answer Triage for practice exam results (pattern detection, misconception identification)
- Domain-weighted readiness score
- Multi-language tutoring (10 languages from day one)
- Proactive intervention (email/browser push based on competency model)
- Spaced review scheduling

**Phase 2 — Sandbox + Voice (6 weeks)**
- Live AWS Sandbox — per-learner sub-accounts via Organizations + SCPs
- Live Technical Review — voice (Nova Sonic) + sandbox + Shadow Evaluator (Sonnet)
- Six assessment modes: Explain / Debug / Implement / Operate / Optimize / Compare
- Architecture Design Mentor — guided design dialogue → architecture document → build in sandbox
- Deeper Skill Builder feature integration — consume SimuLearn scores, Cloud Quest completion, Escape Room results

**Phase 3 — Full Ecosystem**
- All 13 certifications with shared competency model across overlapping domains (IAM mastery from one cert carries to others)
- Per-certification sandbox service whitelists
- Continuous behavioral assessment — AI-era integrity model
- Cohort features — instructor/team dashboard, study group matching, progress tracking
- Enterprise tier — admin analytics, compliance reporting ("X% of team certified within Y months")
- Infrastructure Portfolio — git-backed architecture designs, version-controlled IaC templates

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
- **AWS EdStart** — accelerator for EdTech startups with credits, office hours, events
- **Pledge to America's Youth** — $30M in credits for educational AI
- **AWS AI for Teaching & Learning Framework** — published reference architecture explicitly inviting partners

**Why partner, not build internally?** AWS's Skill Builder team ships ~monthly releases focused on content breadth (new labs, new certs, new languages) and simulation features — not pedagogical modeling. AWS has a documented pattern of partnering for pedagogy: Cengage (Nov 2025, adaptive learning on Bedrock), Pearson, Code.org (Education Equity). AWS supplies infrastructure and content; expert partners own the pedagogy.

We bring production-proven pedagogy (two university deployments, real students, real outcomes) and deep Bedrock experience (Claude, Nova Sonic, Cohere, Knowledge Bases, AgentCore). AWS brings Skill Builder's ecosystem, content, and infrastructure. Together: the first agentic intelligence layer for cloud certification, built on AWS, for AWS.

---

### Team

**Yuzheng Shi** — Developer. MS Computer Science, Northeastern University (graduating Aug 2026). Built TAi end-to-end: agentic core, LeanRAG knowledge graph, Nova Sonic voice interviews, shadow evaluator, full EC2 deployment. Deep Bedrock experience (Claude, Nova Sonic, Cohere, Transcribe, Polly, Nova Canvas).

**Professor Yvonne Coady** — Academic Advisor. CS6650 instructor, Northeastern University Vancouver. Research in distributed systems education. Supervises TAi deployment and pedagogy design.

**[HTGAA Collaborator]** — Built htgaa-chat for Harvard's HTGAA course. Production Bedrock KB + Cohere rerank RAG pipeline, Next.js web platform, custom semantic transcript chunking, inline citations, multi-language tutoring, TutorState tracking, architecture design mentor, DynamoDB persistence.

---

### Contact

Yuzheng Shi
[email]
[LinkedIn]
[GitHub: TAi repository]

---

*Skill Builder has the content. We add the intelligence. Together: the first certification system where the AI knows exactly what you understand.*
