# The Brain for AWS Skill Builder
## An Agentic Intelligence Layer for AWS Certification

*We don't ban AI. We built the AI. And it knows exactly what you understand.*

---

### Skill Builder Has Everything Except a Brain

AWS Skill Builder is the most comprehensive cloud education ecosystem in the world:

- **900+ digital courses** across every AWS service and certification path
- **200+ Builder Labs** in live sandboxed AWS environments
- **200+ SimuLearn scenarios** with AI-powered customer simulations (Amazon Bedrock)
- **14+ Jam Journeys** — open-ended, scored, real-AWS challenges
- **Lab Maker** — AI-generated personalized labs with in-console overlay (Team only)
- **Meeting Simulator** — AI-powered voice+text stakeholder practice with instant feedback
- **Cloud Quest** — 3D role-playing across 9 cloud roles
- **Escape Room: Exam Prep** — gamified certification practice with hands-on labs
- **Microcredentials** — 90-minute live-AWS hands-on exams (free for all learners)
- **Card Clash** — competitive card game for architecture knowledge
- **Official Practice Exams** — full-length certification mock tests
- **Skill Builder Trivia** — multiplayer knowledge competitions
- **Learning Plans, Digital Badges, Skills Profile, Cohorts Studio**

Fifteen training surfaces — six with genuine generative AI inside. Every one of them is world-class. And every one of them is **an isolated room with no hallway between them.**

---

### The Problem: Six AI Surfaces, Zero Shared Intelligence

We audited every AI-powered surface in Skill Builder (April 2026). The finding:

| Feature | AI Involvement | What It Knows | What It Doesn't Know |
|---|---|---|---|
| **Lab Maker** (Team, 2025) | Genuinely generative: NL → step-by-step labs in simulated console | Your prompt right now | Your competency state, prior lab history, practice exam failures |
| **SimuLearn** (Bedrock-confirmed) | LLM-driven customer in open dialogue + scripted modes; business→technical translation | This simulation's conversation | Your performance in other simulations, labs, or exams |
| **Meeting Simulator** (Nov 2025) | Voice+text AI personas, instant communication feedback | This meeting's dialogue | Your certification path, weak domains, or learning history |
| **Learning Assistant** (Dec 2024) | Bedrock-backed in-lab chat | "Within your lab's context" (AWS's own words) | What you did in any other lab, course, or practice exam |
| **Cohorts Studio** (Team, Nov 2025) | AI-recommended training content | Cohort-level program goals | Individual learner skill gaps or misconceptions |
| **Skill Builder Trivia** (Apr 2025) | AI-generated custom quiz questions | Event topic | Anything about the players |

AWS's own language confirms the siloing:
- Learning Assistant works **"within your lab's context"** (AWS T&C Blog, Dec 2024)
- Skills Profile is designed for **"sharing"** and **"showcase"** (AWS T&C Blog, Sep 2025)
- Cohorts Studio offers **"team"**-level AI recommendations, not per-learner cognitive modeling

The remaining nine surfaces (Builder Labs, Jam Journeys, Microcredentials, Cloud Quest, Industry Quest, Escape Room, Card Clash, Practice Exams, Exam Prep Practice) are hand-authored with rules-based validation — excellent content, zero AI adaptation.

**No cross-feature student model. No misconception tracking. No adaptive teaching strategy. No proactive intervention. No readiness prediction.**

A student fails 4 IAM questions on a practice exam. Then opens a Builder Lab on S3. Learning Assistant has no idea about the IAM failure. SimuLearn doesn't know either. Lab Maker generates whatever the student asks for — not what they need. The student is alone — surrounded by world-class features that can't talk to each other.

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
│  │Courses │ │Labs  │ │SimuLearn│ │Practice│ │Jam/Micro │ │
│  │ 900+   │ │ 200+ │ │ 200+   │ │Exams   │ │cred/Quest│ │
│  └────────┘ └──────┘ └────────┘ └────────┘ └──────────┘ │
│                                                            │
│  ───── new surfaces we add (inside Skill Builder) ──────── │
│                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │ Coaching      │ │ Live AWS     │ │ Live Technical     │ │
│  │ Panel         │ │ Sandbox      │ │ Review             │ │
│  │               │ │              │ │ (Voice + Sandbox   │ │
│  │ Beside every  │ │ Agent-       │ │  + 6 Assessment    │ │
│  │ existing      │ │ operated,    │ │  Modes)            │ │
│  │ feature —     │ │ REAL AWS,    │ │                    │ │
│  │ knows your    │ │ per-student  │ │ Nova Sonic voice   │ │
│  │ history       │ │ sub-account  │ │ + Shadow Evaluator │ │
│  └──────────────┘ └──────────────┘ └────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

### What the Intelligence Layer Does

**One signal propagates everywhere.** Student fails 4 IAM questions on a practice exam → Competency Model updates (IAM confidence drops) → affects everything:

- Next Builder Lab session: Coaching Panel focuses on IAM concepts
- Next SimuLearn: a security-heavy customer scenario is recommended
- Lab Maker prompt suggestion: "Build an SCP that denies cross-account access" (not whatever the student types)
- Next Voice Mock: IAM scenario questions weighted higher
- Spaced Review: IAM re-test scheduled in 3 days
- Readiness Score: the Security domain percentage drops
- Daily Plan: adjusted to prioritize IAM remediation
- Wrong-Answer Triage: detects pattern — "you confuse identity-based and resource-based policy evaluation" — not just "you got question 14 wrong"

Today, that practice exam score dies in the practice exam feature. With us, it becomes a learning signal that flows through the entire ecosystem.

---

### A Learning Day — From Perception to Intervention to Generation

**9:00 AM — Proactive notification:**

> "Your SAA-C03 exam is in 18 days. Readiness: 71%. Domain 1 (Security, 30% weight) is your biggest gap — IAM confidence is only 0.42. Today's plan: (1) 12-minute re:Invent video on IAM policy evaluation, (2) a coaching session, (3) a live sandbox demo. Estimated: 45 minutes."

**9:15 AM — Builder Lab: VPC Security Group Configuration**

The learner starts a Builder Lab. At step 5, they configure a Security Group inbound rule with CIDR `10.0.0.0/24`. The Event Bus captures:

```json
{"type": "builder_lab_step", "step": 5, "action": "sg_inbound_rule",
 "result": "validation_failed", "error": "CIDR does not allow public access",
 "attempt_number": 3, "time_on_step_seconds": 240}
```

The Coaching Panel activates in **Diagnostic mode**:

> "I notice your HTTP rule isn't taking effect. Your current CIDR — `10.0.0.0/24` — only allows internal traffic. If you want the whole internet to reach your web server, what IP range represents 'everyone'?"

The learner figures it out: `0.0.0.0/0`. Panel updates the competency model silently: VPC Security Groups confidence +0.1, stability still LOW (single context, one test).

**12:00 PM — Practice Exam**

Score: 76%. The Event Bus streams all 65 per-question results. Wrong-Answer Triage detects:

> "3 misconception patterns:
> (1) IAM policy evaluation: you assume identity-based policies override SCPs (4 questions)
> (2) SQS vs Kinesis ordering: you chose SQS for ordered processing scenarios (3 questions)
> (3) S3 minimum storage duration: you ignored retrieval costs (2 questions)"

Coaching Panel switches to **Exam-Ready mode** — shows the updated readiness score (71% → 69%, Domain 1 dropped) and adjusts tomorrow's study plan.

**Next morning — Lab Maker opens with a recommendation:**

> **Recommended for you:**
> "Build an SCP that denies `s3:PutObject` for a child account, then test whether an IAM role's explicit Allow overrides it."
> *Reason: You've confused SCP deny behavior with IAM allows 4 times. Implementation scope needed.*

The learner didn't have to figure out what to practice. The brain knew.

---

### The Microcredential Remediation Loop — Our Killer Demo

AWS Microcredentials are the strongest assessment format in the portfolio: 90-minute live-AWS exams, randomized challenges, hands-on implementation, free for all learners. They are also the most painful learner experience in all of Skill Builder.

**The current experience:**

> You attempt "AWS Serverless Demonstrated." 90 minutes later: **"You failed."** No feedback on what went wrong. No per-task breakdown. No hints about which service tripped you up. Your only option: **wait 25 days and try again blind.**

This is a black box. The learner knows they failed but has no idea whether it was Lambda cold starts, Step Functions state machines, or DynamoDB key design that broke them. Twenty-five days of unfocused study follows.

**With our intelligence layer:**

> You fail "AWS Serverless Demonstrated." The intelligence layer knows the scenario's components (Lambda + Step Functions + DynamoDB + API Gateway + SQS + SNS). It cross-references against your Competency Model: your Builder Lab history shows strong S3 and Lambda basics, but your Practice Exam results reveal consistent errors on Step Functions error handling and DynamoDB partition key design. SimuLearn transcripts confirm: you chose SQS when scenarios required ordered processing (Kinesis pattern).
>
> **Day 1:** "Here's what I think happened. Three hypotheses, ranked by likelihood: (1) Step Functions error handling — you've never tested this in a lab, (2) DynamoDB hot partitions — your confidence is 0.4 and stability is LOW, (3) event-driven ordering — you've confused SQS and Kinesis ordering 3 times across features. Here's your 25-day plan."
>
> **Days 2–24:** Targeted cycle: Builder Lab on Step Functions error states → SimuLearn scenario requiring DynamoDB design → Sandbox demo showing hot partition throttling live → Coaching session on SQS vs Kinesis with real side-by-side behavior → Spaced review on Day 10 and Day 18.
>
> **Day 25:** Retake. Pass. Because you studied what you actually needed, not everything equally.

**This single loop demonstrates every capability of the intelligence layer:** cross-feature signal consumption, competency model inference, misconception detection, adaptive routing, proactive intervention, and measurable outcome improvement. And it requires no new Skill Builder surface — it works entirely with existing features plus our brain.

---

### What We Add to Skill Builder

#### I. The Intelligence Layer — The Brain

Not a surface. The foundational system underneath everything else.

**Two-Layer Learning State:**

- **TutorState (per-conversation, tactical)** — tracks what the learner seems to believe *right now*: current hypothesis, learning goal, misconceptions detected this session, next question type. Guides the tutor's next move within a single interaction.
- **Competency Model (per-student, strategic)** — tracks long-term mastery across all sessions and all features: confidence, stability, context scope, demonstrated via. Drives study plans, readiness scores, and proactive intervention.

Two layers working together. Within a conversation, the tutor knows what to probe next. Across sessions, it knows the long-term trajectory. No existing Skill Builder feature has either, let alone both.

**Four Dimensions Per Concept:**

| Dimension | What It Tracks | Example |
|---|---|---|
| **Confidence** (0.0–1.0) | How likely the learner understands this concept | IAM policy evaluation: 0.55 (shaky) |
| **Stability** (low/medium/high/confirmed) | How many times and ways it's been tested | Low = tested once; Confirmed = tested 4+ times across different formats |
| **Context Scope** | In what contexts has understanding been demonstrated | theoretical / implementation / debugging / verbal / operational |
| **Demonstrated Via** | How was understanding demonstrated | socratic_dialogue / practice_exam / builder_lab / voice_mock / sandbox_operation / jam_journey / microcredential |

A learner can *explain* S3 replication (theoretical scope, confidence 0.8) but has never *debugged* a failed cross-region replication (no debugging scope, no operational scope). The model sees this gap. A practice exam might not.

**Mapped to Certification Domains:**

```
Readiness Score: 71%

Domain 1: Design Secure Architectures        ██████░░░░  0.62  (weight: 30%)
  └─ IAM policy evaluation                   ████░░░░░░  0.42  ← dragging you down
  └─ KMS key management                      ████████░░  0.78
  └─ VPC security groups / NACLs             ███████░░░  0.71

Domain 2: Design Resilient Architectures     ████████░░  0.78  (weight: 26%)
Domain 3: Design High-Performing Arch.       ███████░░░  0.71  (weight: 24%)
Domain 4: Design Cost-Optimized Arch.        ██████░░░░  0.68  (weight: 20%)
```

The readiness score is **weighted by exam domain percentages** — so a weakness in a 30%-weight domain hurts more than a weakness in a 20%-weight domain. No existing tool computes this.

**Misconception Detection — Cross-Feature State Machine:**

```
candidate → holding → confirmed (frequency ≥ 3) → remediated
```

Example: Student says "VPC peering is transitive" in a Coaching session. Tutor records it as candidate. Student makes the same error on a practice exam (pattern detected by Wrong-Answer Triage). Frequency = 2, still candidate. Student designs a peered network assuming transitivity in a SimuLearn scenario. Frequency = 3 → confirmed misconception. Tutor now proactively targets this across all future interactions.

This works **across features** because the competency model is shared. A misconception surfaced in a practice exam gets tested in a voice mock and remediated in a sandbox demo.

**Teaching Strategy Selection:**

| Your State | Strategy | What Happens |
|---|---|---|
| Confidence LOW, stability LOW | **EXPLAIN** | Build the foundation — clear explanation with examples |
| Confidence MEDIUM, stability LOW | **SOCRATIC** | Probe with questions to confirm or correct understanding |
| Confidence HIGH, scope missing "verbal" | **MOCK PRACTICE** | Voice session to test verbal articulation |
| Confidence HIGH, scope missing "implementation" | **DEMONSTRATE** | Sandbox: build it and see what happens |
| Active misconception detected | **CORRECT** | Targeted remediation — construct the counter-example |
| Confidence HIGH, stability CONFIRMED | **CHALLENGE** | Push to edge cases and constraint shifts |

Strategy history is logged per learner. If SOCRATIC didn't work last time on this concept, the engine tries DEMONSTRATE next. Adaptive, not scripted.

**70/30 Socratic Framework:** 70% guiding questions, 30% factual content. Never front-load answers. Identify misconceptions without saying "wrong." One question per response. Production-proven (two university deployments).

---

#### II. The Coaching Panel — Your AI Tutor Beside Every Feature

Think of Chrome's "Ask Gemini" sidebar — but with two upgrades: **eyes** (it sees everything you're doing via the Event Bus, without you telling it) and **hands** (it can highlight, annotate, and guide within the Skill Builder UI via Plugin API). Not a separate app. A persistent coaching presence that appears alongside every existing Skill Builder feature, with full knowledge of your learning history across all features.

**Adaptive form factor — the panel shapeshifts by context:**

- **In Builder Labs / SimuLearn:** In-console overlay. Highlights the exact input field causing errors, annotates configuration choices, asks "why did you choose port 443 and not 80?" directly beside the control.
- **In Cloud Quest / Card Clash:** Game companion. Floating context card that warns: "Your architecture card is missing an encryption layer — the opponent's attack card will exploit this."
- **During course videos:** Active summary sidebar. When the video reaches a concept you previously failed on, the panel lights up: "This is exactly where you went wrong on your last practice exam. Pay close attention."
- **After Practice Exams:** Becomes a diagnostic dashboard. Not per-question rationale — cross-question pattern detection rendered as a visual misconception map.

**Four operating modes (driven by Event Bus signals):**

| Mode | Trigger | What the Panel Does |
|---|---|---|
| **Diagnostic** | Repeated config failures, 30+ second hesitation on a concept | Gives logic clues (not answers): "You're stuck on the CIDR range. You want public access — what IP range represents 'the whole internet'?" |
| **Empathy** | Frustration signals: rapid retries, session abandonment pattern, voice tone shift (Meeting Sim) | Softens tone, suggests downshift: "This SCP policy trips even senior architects. Want to do a quick Card Clash round to reset, then come back?" |
| **Cross-Context** | Current activity overlaps with historical weakness from a different feature | Stitches experiences together: "Remember the S3 lifecycle policy you built in Lab Maker yesterday? The CTO in this SimuLearn is asking about the same concept — use that configuration logic." |
| **Exam-Ready** | Exam date approaching + practice exam completed | Becomes a readiness dashboard: shows domain breakdown, flags remaining red zones, generates a countdown study plan |

**During a Builder Lab:**
> Student configures a Security Group. Event Bus captures 3 consecutive `Inbound Rule Validation Failed` events. Coaching Panel activates in Diagnostic mode:
>
> "I notice your HTTP rule isn't taking effect. Your CIDR is `10.0.0.0/24` — that's internal-only. If you want the whole internet to reach your web server, what should that range be?"
>
> Student fixes it. Panel updates competency model: VPC Security Groups confidence +0.1, stability still LOW (tested once, single context).

**After a SimuLearn scenario:**
> "You scored 4/6 on that customer simulation. The two you missed both involved choosing between services under cost constraints. That's a pattern — let me quiz you on three more cost-optimization scenarios."

**After a practice exam (Wrong-Answer Triage):**
> Not question-by-question rationale (Skill Builder already does that), but **cross-question pattern detection**: "You missed 6 questions. I see 2 misconception patterns: (1) you confuse SQS FIFO message-group ordering with Kinesis shard-level ordering, (2) you think VPC peering is transitive. Let's address both."

**Difference from Learning Assistant:** Learning Assistant answers your questions within one lab — "within your lab's context." The Coaching Panel knows your entire history across every Skill Builder feature, proactively intervenes based on real-time behavioral signals, and routes you to the right next activity across the whole platform.

**Enhancing Lab Maker:** Lab Maker generates whatever the learner asks for — it's cold-start, prompt-driven. With our layer: Lab Maker receives prompt suggestions driven by the competency model. The learner doesn't need to know what to practice — the brain knows. Next morning, Lab Maker shows: "Recommended: Build an SCP that denies cross-account S3 access" — because your IAM confidence is 0.42 and you need implementation scope.

---

#### III. Live AWS Sandbox — The Entire Cloud as a Teaching Lab

This is fundamentally different from Lab Maker and Builder Labs:

| | Builder Labs | Lab Maker | Our Sandbox |
|---|---|---|---|
| Environment | Live AWS (guided) | **Simulated** console | **Live AWS** (agent-operated) |
| Content | Pre-built, scripted steps | AI-generated from prompt | Agent improvises based on competency model |
| Adaptivity | Same for everyone | Based on learner's prompt | Based on learner's actual gaps |
| Failure modes | Not included | Not included | Agent deliberately breaks things |
| Assessment | Completion | Completion | **Process evaluation** — how you got there matters |
| Cost teaching | Not included | Not included | Real Cost Explorer: "your architecture costs $X/month" |
| Access | Individual+ ($29/mo) | Team only ($449/yr) | All tiers (via intelligence layer) |

Each learner gets a dedicated AWS sub-account via Organizations, isolated by Service Control Policies. The agent has full API access — every one of the 200+ AWS services becomes a teaching moment.

**The agent can improvise.** Student confused about Kinesis vs SQS? Spin up both, push the same messages, show the difference in behavior — ordering, fan-out, replay capability — side by side. No pre-built lab needed.

**The agent can demonstrate failure modes:**
- Stop an EC2 instance mid-request and show what happens to the ALB health check
- Trigger a Lambda cold start and measure the actual latency
- Exceed a DynamoDB throughput limit and show the throttling in CloudWatch
- Kill an Availability Zone and watch Auto Scaling respond in real time

**The competency model makes the sandbox intelligent.** Without the model, a sandbox is a playground — fun but unfocused. With the model, the tutor knows exactly which service to spin up, which failure mode to trigger, which edge case to demonstrate — because it knows what this specific learner doesn't understand yet.

---

#### IV. Live Technical Review — Voice + Sandbox + Six Assessment Modes

Real-time voice conversation (Nova Sonic) + live sandbox + 6 assessment modes flowing naturally in one session. Mirrors a real solutions architect interview.

**How a session flows:**

> **Agent:** "You're the solutions architect. A client needs 99.95% availability across two regions. Walk me through your architecture."
>
> Student talks through their design. *(Explain mode)*
>
> **Agent:** "Let me show you something. Here's a CloudWatch dashboard. The health check is failing even though the endpoint responds. What's going on?"
>
> *(Debug mode. Real health check logs.)*
>
> **Agent:** "Fix it — I've opened the config." *(Implement mode)*
>
> **Agent:** "Health check is green. Now — I just killed us-east-1." *(Operate mode)*
>
> **Agent:** "Cost Explorer says $4,200/month. Client budget is $2,000." *(Optimize mode)*
>
> **Agent:** "You suggested Aurora Global Database. Let me spin up both options." *(Compare mode)*

One scenario. Six modes. No visible transitions. Just a conversation that naturally escalates based on the competency model.

**The Shadow Evaluator** runs in the background via async tool calling (no conversational pause). Claude Sonnet scores each answer on 4 dimensions: verbal clarity, technical accuracy, depth of reasoning, problem-solving process.

**Difference from Meeting Simulator:** Meeting Simulator tests **stakeholder communication** — how you translate technical to business value. Our Live Technical Review tests **architectural reasoning** — can you design, debug, operate, and optimize real AWS infrastructure while articulating your reasoning? Complementary, not overlapping.

---

#### V. Architecture Design Mentor + Infrastructure Portfolio

**Architecture Design Mentor** — guided two-phase workflow:

Phase 1: Structured design dialogue. The tutor refuses to generate until prerequisites are defined — traffic patterns? RPO/RTO? budget? compliance? Validates each decision against the competency model.

Phase 2: Architecture document generation. Then: "Now let's build it in the sandbox."

**Infrastructure Portfolio** — git-backed architecture designs, CloudFormation/Terraform templates, version-controlled. Tutor reviews diffs: "You changed the RDS instance to multi-AZ. Walk me through why."

---

### How It Integrates with Every Skill Builder Feature

The intelligence layer doesn't replace features. It makes every existing feature smarter by consuming its signals and adding a coaching presence.

| Skill Builder Feature | Current Experience | + Intelligence Layer |
|---|---|---|
| **Digital Courses (900+)** | Watch linearly, mark complete | Tutor selects which chapters to watch (skips what you know), highlights connections to weak areas, tests you after |
| **Builder Labs (200+)** | Follow scripted steps | Coaching Panel alongside: asks why, changes constraints, turns walkthrough into assessment |
| **Lab Maker (Team)** | Generate from your prompt | Competency model suggests the right prompt; follows up with assessment |
| **SimuLearn (200+)** | AI customer → build solution | Results feed competency model; tutor detects reasoning gaps and runs targeted sessions |
| **Jam Journeys (14+)** | Solve independently, scored | Cross-journey mastery inference; route to next journey based on actual weak services |
| **Meeting Simulator** | Voice stakeholder practice | Communication scores persist; weak objection-handling → targeted scenario routing |
| **Practice Exams** | Score + per-question rationale | Wrong-Answer Triage: cross-question misconception patterns, targeted remediation plan |
| **Microcredentials (free)** | Pass/fail, no feedback, 25-day cooldown | **25-day targeted prep plan** inferred from scenario components + full learner history |
| **Cloud Quest** | 3D quests, earn badges | Per-concept mastery (not just completion); struggle on assignment 7 = container gap detected |
| **Escape Room** | Gamified exam prep | Time-pressure performance → exam readiness signal |
| **Learning Plans** | Static curated lists | **Replaced** by dynamic daily plans from competency model + exam date + misconceptions |
| **Skills Profile** | Shows what you've **completed** | We add what you've **mastered** — readiness score, misconception list, stability ratings |

---

### Assessment in the AI Era

Every certification body is asking: **"How do we assess when everyone has AI?"**

The answers so far are defensive — lockdown browsers, proctoring cameras, banning phones. All losing battles.

**Our answer: make the AI the assessment environment itself.**

AWS already believes hands-on beats multiple choice — that's why Microcredentials exist, free for all learners, in live AWS environments. But Microcredentials assess without teaching: you fail, get no feedback, wait 25 days, try again blind. We close the loop.

**The process is the assessment, not the answer.** Everything the learner does with the tutor — every question they ask, every hint they need, how many hints before they get it, whether they can transfer a concept to a new scenario without help — that is the assessment data.

**Real-time probing defeats cheating.** A suspicious answer → "explain the third point in your own words." If they understand, they answer easily. If they pasted from ChatGPT, they collapse.

**Exam dumps die overnight.** You can't dump a live interactive assessment where the agent improvises based on your competency model. Every learner gets a different experience.

---

### Kiro Integration — Pedagogy for AWS's Developer Surface

Kiro is AWS's flagship agentic IDE — 250,000+ developers in preview, now GA as the official successor to Amazon Q Developer's IDE/CLI experience. Matt Garman anchored re:Invent 2025 on it. Amazon standardized internally on Kiro.

**Kiro is built for developers building software. It has no tutor, no competency model, no formative assessment, no certification alignment.** This is a clear product gap that maps directly onto our intelligence layer.

#### How We Ship Inside Kiro

We distribute as a **Kiro Power** — a bundle of MCP servers + pedagogical steering files + documentation, loaded on-demand by keyword detection. Alongside Figma, Netlify, and Datadog on the Powers partner list.

**What the learner experiences in Kiro:**

```
Developer working on AWS infrastructure in Kiro IDE
    │
    ├── Activates "AWS Cert Coach" Power (one-click install)
    │
    ├── While coding: hooks trigger formative assessment
    │   └── Saves a CloudFormation template → Coach asks:
    │       "You used a single-AZ RDS. Walk me through the
    │        availability tradeoff. What happens when that AZ fails?"
    │
    ├── Architecture Design Mentor maps 1:1 to Kiro's spec workflow:
    │   requirements.md → design.md → tasks.md → build
    │   (Kiro's thesis is spec-driven development — we add pedagogy to it)
    │
    ├── MCP tools available to the Kiro agent:
    │   assess_concept, query_knowledge, get_readiness_score,
    │   generate_challenge, evaluate_answer, get_study_plan
    │
    └── Same competency model powers both surfaces:
        Skill Builder learner ←→ shared state ←→ Kiro developer
```

**Why this matters strategically:** Kiro has no educational partners at the curriculum level. The 11-university Students tier (1,000 credits/month) provides access, not pedagogy. A Kiro Power that makes Kiro a learning environment — not just a building environment — would be a first. AWS has a documented pattern of partnering for pedagogy (Cengage, Pearson, Code.org). The Kiro pedagogy slot is unoccupied.

#### Agent Execution: Kiro CLI as Runtime (Conditional)

We investigated using Kiro CLI/Gateway as the agent execution layer for the intelligence layer's backend — replacing direct Bedrock per-token billing with Kiro's flat-rate subscription model. The technical surface exists: `kiro-gateway` (github.com/jwadow/kiro-gateway, 882 stars) exposes OpenAI/Anthropic-compatible API endpoints over Kiro CLI, supports streaming, tool use, system prompts, multi-turn, and vision.

**The economic argument is compelling:** a single developer measured 40M input tokens + 865K output over 4 days (~$1,000/month at Bedrock rates), fully covered by a $19/month Q Developer Pro subscription.

**However, three independent factors make this non-viable for production today:**

1. **Explicit ToS prohibition.** Kiro's Pricing FAQ states: *"Use with OpenClaw and similar tools that leverage third-party harnesses is prohibited"* and *"subscriptions and usage limits are calculated per individual user… each developer needs their own subscription."* Routing multiple learners through one subscription violates this directly.

2. **The arbitrage window is closing.** New Q Developer Pro signups blocked May 15, 2026; full end-of-support April 30, 2027. Claude Opus 4.6 removed from Q Developer Pro on May 29, 2026. The flat-rate path is being deliberately shut down.

3. **Architectural gaps.** Kiro only routes Claude models. Our RAG pipeline requires **Cohere Embed v4**, **Cohere Rerank**, and **Nova Sonic bidirectional audio** — none available through Kiro. A "swap" still requires maintaining direct Bedrock for these, defeating the single-engine goal.

**If AWS grants internal access or creates a programmatic multi-tenant Kiro tier for partners, this becomes viable immediately.** The technical integration is proven. The cost savings at scale would be transformative (~$200/month vs ~$4,000/month for 100 learners). We present this as a conditional proposal: if a Kiro Enterprise / Kiro for Partners arrangement exists or can be created, we adopt Kiro CLI as the agent runtime. Otherwise, we deploy on direct Bedrock with prompt caching — the proven, compliant, production-grade path.

**Default architecture (without Kiro runtime access):**

```
Agent Execution Layer (invisible to learner):
├── Claude Haiku 4.5 + prompt caching  (80% of interactions — daily tutoring)
├── Claude Sonnet 4.6 + prompt caching (assessment, misconception detection, evaluation)
├── Claude Opus 4.7                    (deep reasoning, plan generation — sparingly)
├── Cohere Embed v4                    (LeanRAG knowledge graph queries)
├── Cohere Rerank v3.5                 (RAG precision filtering)
├── Nova Sonic                         (bidirectional voice for Live Technical Reviews)
├── Intelligent Prompt Routing         (auto-selects model tier per request)
└── Prompt caching                     (60-80% input cost reduction)
```

**Cost at scale (legitimate path with prompt caching):**

| Learners | Monthly cost | Notes |
|---|---|---|
| 10 | ~$400 | Haiku handles 80% of turns |
| 50 | ~$2,000 | Prompt caching reduces input 70% |
| 100 | ~$4,000 | Intelligent routing adds ~30% further savings |

---

### Grounded in AWS Content, Not Hallucination

The tutor doesn't rely on the LLM's training data. Every response is grounded in AWS's own content:

**Video transcripts** from re:Invent talks and AWS workshops — with timestamped citations and watch-links precise to the second. Custom semantic chunking (splits at speaker/topic/pause boundaries, preserves exact startSec/endSec per chunk — not Bedrock's auto-chunker).

**A knowledge graph (LeanRAG)** of AWS concepts — service relationships, prerequisite chains, difficulty layers. Zero LLM calls at query time — embedding + graph traversal only.

**Official documentation and whitepapers** — chunked, embedded, retrieved via Bedrock Knowledge Bases with Cohere rerank (top-16 retrieve → precision filter → generate with inline citations).

**The retrieval pipeline is production-proven.** Running in production at Harvard (htgaa-chat): Bedrock KB → Cohere rerank → threshold filter → Claude generate → structured JSON with inline citations linking to exact video timestamps.

---

### Competitive Landscape: The Gap Is Real and Precisely Identified

| Capability | Skill Builder (accurate, May 2026) | Our Intelligence Layer |
|---|---|---|
| **Cross-feature student model** | Skills Profile = completions/badges only. Each AI feature session-scoped | **Persistent 4-dimension per-concept model across ALL 15 surfaces** |
| **AI-generated labs** | Lab Maker: genuine AI, but **simulated** console, Team-only ($449/yr), no competency input, cold-start | **Competency-driven sandbox: real AWS APIs, targets your gaps, evaluates process** |
| **Voice AI assessment** | Meeting Simulator: voice+text, communication skills, instant feedback, **no cross-session memory** | **Live Technical Review: architectural reasoning, 6 modes, persistent scoring, cross-session** |
| **Hands-on assessment** | Microcredentials: live AWS, free, 90min, randomized — but **NO failure feedback, 25-day black box** | **Adaptive: competency-driven, process evaluation, immediate gap identification, 25-day prep plan** |
| **Independent problem-solving** | Jam Journeys: real AWS, open-ended, scored, clue penalty — but **static, no adaptive difficulty** | **Same + competency-driven selection + process evaluation + cross-journey mastery inference** |
| **Wrong-answer analysis** | Practice Exams: per-question rationale (pre-written, isolated) | **Cross-question pattern detection: "these 4 errors share one misconception"** |
| **Adaptive teaching strategy** | Lab Maker claims "adaptive AI guidance" (unverified) | **6 strategies selected per-interaction based on 4-dimension learner state, logged effectiveness** |
| **Proactive intervention** | None across any feature | **State-driven: reaches out based on competency model + exam date + activity patterns** |
| **Misconception tracking** | None | **Cross-session, cross-feature state machine: candidate → confirmed → remediated** |
| **Domain-weighted readiness score** | Skills Profile shows completion badges | **Per-concept, per-domain, weighted by official exam percentages** |
| **AI-era behavioral assessment** | None | **Continuous process assessment + real-time probing + behavioral fingerprinting** |
| **Multi-language AI tutoring** | AI features English-only; content in 16 languages | **10+ languages, English technical terms preserved (production-proven)** |
| **Cross-domain grounded queries** | Each lab/course is siloed | **Single query spans networking + security + storage with citations to each** |

**Microsoft and Google are further behind.** Microsoft Learn has no AI tutor for Azure certifications. Google Skills (relaunched Oct 2025) added gamification but no AI tutor. **An agentic tutor for AWS certifications would be a first-mover advantage not just over third parties, but over competing cloud platforms.**

---

### Everyone Wins

**For the learner:** A tutor that knows your gaps across every Skill Builder feature, adapts to your level, tells you when you're genuinely ready, and turns the 25-day Microcredential black box into a targeted prep plan. You pass with real understanding.

**For AWS:**

- **Higher certification pass rates** — the tutor targets the gap between "watched the videos" and "actually ready"
- **Certifications employers trust** — live operation assessment produces practitioners, not memorizers
- **Skill Builder revenue grows** — a $29/month subscription that intelligently guides you through 900 courses, 200 labs, and 200 simulations is worth far more than one that lets you browse them yourself
- **Lab Maker becomes intelligent** — instead of cold-start generation, Lab Maker receives competency-driven prompts
- **The entire AWS ecosystem as a teaching surface** — every service learned in the sandbox is a service they'll use (and pay for) in production
- **An answer to AI-era assessment** — AWS could be the first to say: "We don't ban AI. We built the AI."
- **Kiro gets a pedagogy layer** — the first educational partner on AWS's flagship developer surface
- **Competitive advantage over Azure and GCP** — neither has anything close
- **Bedrock + Kiro showcase** — agentic tutor on AWS's own stack, for AWS's own certs

**For the industry:** More people who actually understand AWS services. The tutor tests verbal explanation, architectural reasoning, live debugging, and cost optimization — the skills that matter on the job.

**For the global market:** The tutor answers in 10+ languages — already running in production. A developer in Tokyo studies in Japanese. An engineer in São Paulo studies in Portuguese. This is a massive unlock for the ~60% of AWS cert candidates whose first language isn't English.

---

### Entirely on AWS

| Service | Role |
|---|---|
| **Bedrock (Claude)** | Agent intelligence — Haiku for daily tutoring, Sonnet for evaluation, Opus for deep reasoning |
| **Bedrock (Nova Sonic)** | Real-time bidirectional voice for Live Technical Reviews |
| **Bedrock Knowledge Bases** | RAG over video transcripts, docs, whitepapers. Custom semantic chunks preserve timestamps |
| **Bedrock (Cohere Rerank)** | Precision filtering — re-scores chunks by relevance, production-proven |
| **Bedrock (Cohere Embed)** | Knowledge graph entity anchoring + KB vector search |
| **Bedrock Prompt Caching** | 60-80% input cost reduction on repeated system prompts and competency state |
| **Bedrock Intelligent Routing** | Auto-selects model tier per request (~30% additional cost savings) |
| **Kiro** | Developer-facing Power + MCP server; conditional: agent runtime if partner access granted |
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
- Timestamped watch-links and inline citations
- Full-course cross-domain queries
- TutorState per-conversation tracking
- 70/30 Socratic framework
- Multi-language tutoring (10 languages)
- Architecture design mentor (two-phase: structured dialogue → document generation)
- DynamoDB persistence

**~85% of the intelligence layer ports directly from these production systems.** The ~15% genuinely new: live AWS sandbox (agent-operated sub-accounts), six assessment modes, cross-feature event bus integration with Skill Builder, and AI-era behavioral assessment.

---

### Phased Rollout

**Phase 1 — Intelligence Layer MVP (6 weeks)**
- Competency model mapped to SAA-C03 exam domains (4 dimensions per concept)
- Two-layer learning state: TutorState (tactical) + Competency Model (strategic)
- Teaching strategy engine (6 strategies, adaptive selection, 70/30 Socratic framework)
- Coaching Panel alongside courses and Builder Labs
- Full RAG pipeline: Bedrock KB + Cohere rerank + custom semantic chunking
- Ingest 20+ re:Invent talks on core SAA topics
- Wrong-Answer Triage for practice exam results (cross-question pattern detection)
- **Microcredential remediation loop** (25-day targeted prep plan from pass/fail + scenario metadata)
- Pre-assessment onboarding (15-minute diagnostic quiz for cold start)
- Domain-weighted readiness score
- Multi-language tutoring (10 languages)
- Proactive intervention (email/browser push based on competency model)
- Spaced review scheduling
- Misconception tracking and remediation (state machine)
- Kiro Power: "AWS Cert Coach" MCP server + steering files + one-click install

**Phase 2 — Sandbox + Voice (6 weeks)**
- Live AWS Sandbox — per-learner sub-accounts via Organizations + SCPs
- Live Technical Review — voice (Nova Sonic) + sandbox + Shadow Evaluator (Sonnet)
- Six assessment modes: Explain / Debug / Implement / Operate / Optimize / Compare
- Architecture Design Mentor — guided design dialogue → architecture document → build in sandbox
- Infrastructure Portfolio — git-backed architecture designs, IaC templates, version diffs
- Deeper Skill Builder integration — consume SimuLearn feedback, Meeting Sim scores, Jam Journey data
- Lab Maker intelligence — competency-driven prompt suggestions
- Kiro hooks: formative assessment triggered on file save

**Phase 3 — Full Ecosystem**
- All 13 certifications with shared competency model (IAM mastery carries across certs)
- Per-certification sandbox service whitelists
- Continuous behavioral assessment — AI-era integrity model
- Cohort features — instructor/team dashboard, study group matching
- Enterprise tier — admin analytics, compliance reporting
- Classroom companion — pre-assessment before instructor-led training, post-class spaced review
- Conditional: Kiro CLI as agent runtime (if partner access granted)

---

### Integration Architecture — How the Brain Connects

The intelligence layer requires three integration surfaces from AWS. Together they form a closed loop: **perceive** (Event Bus) → **decide** (our brain) → **intervene** (Coaching Panel) → **generate** (Lab Maker Injection) → back to perceive.

```
┌─── AWS Skill Builder Platform ──────────────────────────────────────────┐
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  1. EVENT BUS — Unified Signal Stream                           │    │
│  │     (Skill Builder → EventBridge → Our Intelligence Layer)      │    │
│  │                                                                 │    │
│  │  Every learner action across every feature → structured events  │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  OUR INTELLIGENCE LAYER (brain)                                 │    │
│  │  Competency Model + Strategy Engine + Misconception Detector    │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│                    ┌────────────┼────────────┐                           │
│                    ▼            ▼            ▼                           │
│  ┌──────────────────┐ ┌──────────────┐ ┌────────────────────────┐      │
│  │ 2. COACHING PANEL │ │ 3. LAB MAKER │ │ Proactive Outreach     │      │
│  │ (Plugin/Widget    │ │ INJECTION    │ │ (SES/Push based on     │      │
│  │  beside every     │ │ (suggest     │ │  competency triggers)  │      │
│  │  feature)         │ │  prompts)    │ │                        │      │
│  └──────────────────┘ └──────────────┘ └────────────────────────┘      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Integration Surface 1: Event Bus — The Eyes

Skill Builder routes learner activity events to our endpoint via Amazon EventBridge. We define a **Unified Signal Schema** — every feature emits structured events that feed the competency model:

```json
// Practice Exam completed — richest exam-prep signal
{
  "type": "practice_exam_completed",
  "learner_id": "u-839201",
  "exam": "SAA-C03",
  "score": 72,
  "domains": {"domain_1": 60, "domain_2": 85, "domain_3": 70, "domain_4": 68},
  "per_question": [{"id": "q14", "correct": false, "domain": 1, "topic": "iam_policy_evaluation"}, ...],
  "timestamp": "2026-05-13T14:30:00Z"
}

// Builder Lab — captures WHERE the learner struggles, not just IF they completed
{
  "type": "builder_lab_step",
  "learner_id": "u-839201",
  "lab_id": "vpc-security-lab",
  "step": 5,
  "action": "security_group_inbound_rule_created",
  "result": "validation_failed",
  "error": "CIDR 10.0.0.0/24 does not allow public access",
  "attempt_number": 3,
  "time_on_step_seconds": 240
}

// SimuLearn — open-dialogue AI customer conversation signal
{
  "type": "simulearn_completed",
  "learner_id": "u-839201",
  "scenario": "gen-ai-architect-3",
  "mode": "open_dialogue",
  "services_proposed": ["Bedrock", "Lambda", "S3"],
  "services_missed": ["DynamoDB", "CloudFront"],
  "feedback_dimensions": {"technical_accuracy": 3, "communication": 4, "cost_awareness": 2},
  "duration_minutes": 47
}

// Microcredential — the 25-day black box signal
{
  "type": "microcredential_attempted",
  "learner_id": "u-839201",
  "credential": "serverless-demonstrated",
  "result": "fail",
  "scenario_services": ["Lambda", "StepFunctions", "DynamoDB", "APIGateway", "SQS", "SNS"],
  "date": "2026-05-01"
}

// Jam Journey — open-ended challenge performance
{
  "type": "jam_challenge_completed",
  "learner_id": "u-839201",
  "journey": "networking",
  "challenge_id": "vpc-lattice-routing",
  "difficulty": "hard",
  "solved": true,
  "clues_used": 2,
  "time_minutes": 18,
  "services_touched": ["VPCLattice", "ALB", "Route53"]
}

// Meeting Simulator — communication + confidence signal
{
  "type": "meeting_sim_completed",
  "learner_id": "u-839201",
  "scenario": "cto-cost-objection",
  "feedback_dimensions": {"clarity": 4, "persuasiveness": 2, "technical_translation": 3},
  "voice_hesitation_events": 7
}

// Cloud Quest — game-based skill signal
{
  "type": "cloud_quest_assignment",
  "learner_id": "u-839201",
  "role": "solutions-architect",
  "assignment": 7,
  "phase": "diy",
  "result": "reset_required",
  "services": ["ECS", "Fargate", "ALB"]
}
```

**Signal richness ranking** (by pedagogical value):
1. SimuLearn open-dialogue transcripts — explicit reasoning and service-selection decisions
2. Meeting Simulator voice + feedback — communication skill + confidence patterns
3. Builder Lab step-level failures — pinpoints exact concept gaps
4. Jam Journey challenge data — time, clues, services, difficulty tier
5. Practice Exam per-question results — domain-level weakness detection
6. Microcredential pass/fail + scenario metadata — triggers remediation loops
7. Cloud Quest per-assignment completion/reset — game-based skill signals
8. Escape Room time/mode performance — pressure-response signals

#### Integration Surface 2: Coaching Panel — The Hands

AWS exposes a plugin slot (iframe embed or Widget API) that renders our panel alongside existing features:

| Skill Builder Page | Panel Location | What It Renders |
|---|---|---|
| **Builder Lab** (active) | Right sidebar, 20% width | Real-time diagnostic guidance + "why" questions triggered by Event Bus step failures |
| **Practice Exam results** | Below score breakdown | Wrong-Answer Triage: cross-question misconception pattern analysis |
| **SimuLearn** (post-session) | Below feedback | Gap analysis: "services you missed" + targeted routing to labs |
| **Lab Maker** (prompt page) | Above input field | "Recommended for you" competency-driven prompt suggestion |
| **Cloud Quest** (in-game) | Floating companion widget | Context-sensitive hints tied to concept gaps from other features |
| **Skill Builder Dashboard** | Top card | Daily AI-generated study plan based on competency model + exam date |
| **Skills Profile** | Enhanced section | Dynamic competency radar chart (not just completion badges) |

The panel adapts its behavior based on learner state — four modes (Diagnostic, Empathy, Cross-Context, Exam-Ready) driven by real-time Event Bus signals.

#### Integration Surface 3: Lab Maker Intelligence — The Feedback Loop

When a learner opens Lab Maker, Skill Builder queries our intelligence API before showing the prompt field:

```
GET /api/suggest-lab?learner_id=u-839201

Response:
{
  "suggestions": [
    {
      "prompt": "Build an SCP that denies cross-account S3 access while allowing same-account Lambda invocations",
      "reason": "IAM policy evaluation confidence is 0.42, needs implementation scope. You've confused identity-based and resource-based policies 3 times.",
      "priority": "high",
      "estimated_time": "25 min"
    },
    {
      "prompt": "Configure a DynamoDB table with a composite key and trigger throttling to observe hot partition behavior",
      "reason": "DynamoDB partition design confidence is 0.4, stability LOW. You failed this area on Serverless Microcredential.",
      "priority": "high",
      "estimated_time": "20 min"
    }
  ],
  "readiness_update": "Completing both will raise Domain 1 readiness from 62% to ~68%"
}
```

The learner sees: **"Recommended for you"** cards above the free-text prompt. They can ignore them and type anything — but the competency model is offering the highest-value next action.

**The closed loop in action:**

```
Event Bus captures: 3 failed Security Group configs in Builder Lab
        ↓
Intelligence Layer: updates VPC/SG confidence to 0.35, detects "CIDR scope" misconception
        ↓
Coaching Panel: activates Diagnostic mode beside the lab — gives logic hint (not answer)
        ↓
Student fixes it (with guidance). Competency updates: confidence +0.1
        ↓
Next day: Lab Maker shows "Recommended: Configure cross-VPC security groups with peering"
        ↓
Student completes it. Event Bus captures success.
        ↓
Practice Exam: student gets SG question right. Misconception status → remediated.
        ↓
Loop complete. Intelligence moves to next weakest concept.
```

**This transforms Skill Builder from a library of isolated rooms into a living, adaptive learning environment — where every feature feeds every other feature through a shared brain.**

---

### What We're Asking

**From AWS:**

1. **Skill Builder integration access** — the three surfaces described above:
   - **Event Bus**: EventBridge rule routing learner activity events to our endpoint (unified signal schema)
   - **Coaching Panel**: Plugin/widget slot (iframe or API) to render our intelligence beside existing features
   - **Lab Maker API**: Endpoint to inject competency-driven prompt suggestions into Lab Maker's UI

2. **Bedrock credits** — primary infrastructure cost (~$2,000-4,000/month at 50-100 learners with prompt caching). Natural fit for AWS EdStart or Education Equity Initiative

3. **Sandbox infrastructure** — Organizations + SCP setup for per-learner sub-accounts, or collaboration on a shared sandbox service

4. **Content access** — re:Invent session recordings/transcripts for RAG pipeline ingestion

5. **Kiro partnership** — featured as a Kiro Power in the server directory and Powers partner list (alongside Figma, Netlify, Datadog). "Add to Kiro" badge for one-click install. Conditional: partner-tier Kiro CLI access for agent runtime

6. **Technical collaboration** — early access to Bedrock features (AgentCore, Nova Sonic improvements, KB enhancements, Intelligent Prompt Routing)

7. **Co-visibility** — case study, blog post, or conference session at re:Invent / AWS Summit

These asks map to programs AWS already runs:
- **Education Equity Initiative** ($100M, re:Invent 2024) — cloud credits + technical advising for edtech
- **AWS EdStart** — accelerator for EdTech startups with credits, office hours, events
- **Pledge to America's Youth** — $30M in credits for educational AI
- **AWS AI for Teaching & Learning Framework** — published reference architecture explicitly inviting partners
- **Cengage partnership** (Nov 2025) — adaptive learning on Bedrock. AWS supplies infrastructure; expert partners own the pedagogy

**Why partner, not build internally?** AWS's Skill Builder team ships ~monthly releases focused on content breadth and simulation features — not pedagogical modeling. AWS has a documented pattern of partnering for pedagogy: Cengage, Pearson, Code.org, Udacity. AWS supplies infrastructure and content; expert partners own the pedagogy.

We bring production-proven pedagogy (two university deployments, real students, real outcomes) and deep Bedrock experience (Claude, Nova Sonic, Cohere, Knowledge Bases). AWS brings Skill Builder's ecosystem, content, and infrastructure. Together: the first agentic intelligence layer for cloud certification, built on AWS, for AWS.

---

### Team

**Yuzheng Shi** — Developer. MS Computer Science, Northeastern University (graduating Aug 2026). Built TAi end-to-end: agentic core, LeanRAG knowledge graph, Nova Sonic voice interviews, shadow evaluator, full EC2 deployment. Deep Bedrock experience (Claude, Nova Sonic, Cohere, Transcribe, Polly, Nova Canvas).

**Professor Yvonne Coady** — Academic Advisor. CS6650 instructor, Northeastern University Vancouver. Research in distributed systems education. Supervises TAi deployment and pedagogy design.

**[HTGAA Collaborator]** — Built htgaa-chat for Harvard's HTGAA course. Production Bedrock KB + Cohere rerank RAG pipeline, custom semantic transcript chunking, inline citations, multi-language tutoring, TutorState tracking, architecture design mentor, DynamoDB persistence.

---

### Contact

Yuzheng Shi
[email]
[LinkedIn]
[GitHub: TAi repository]

---

*Built on AWS. For AWS. Teaching AWS — by operating AWS.*

*Skill Builder has the content. We add the intelligence. Together: the first certification system where the AI knows exactly what you understand.*
