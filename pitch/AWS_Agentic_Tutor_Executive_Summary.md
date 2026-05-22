# The Brain for AWS Skill Builder — Executive Summary

---

## Core Idea

Build an intelligence layer for AWS Skill Builder — the "brain" that connects all of its features (which are currently isolated) into one coherent, adaptive learning system. Solve the root problem: **Skill Builder tracks what learners have completed, but nobody tracks what they actually understand.**

---

## Five Core Modules

### One: The Intelligence Layer (Competency Model + Event Bus)

**Why it's the foundation:** AWS Skill Builder has 9 AI-powered features (Learning Assistant, SimuLearn, Meeting Simulator, Cloud Quest, Practice Exams, etc.) — but none share a student model. A learner fails 4 IAM questions on a practice exam, then opens a Builder Lab, and the Lab's AI has zero awareness of that failure. Every feature is an isolated room with no hallway between them.

**What it does:** Maintains a persistent, 4-dimension competency model per learner (confidence, stability, context scope, how it was demonstrated), mapped to official exam domain weightings. Consumes signals from all Skill Builder features through an event bus. Selects from 6 teaching strategies per interaction based on learner state. Tracks misconceptions across sessions (candidate → confirmed → remediated). Generates a domain-weighted readiness score ("you are 71% ready for SAA-C03, Domain 1 Security is dragging you down").

**Immediate benefit:** One signal propagates everywhere — fail IAM questions → next lab session focuses on IAM → next voice mock weights IAM higher → spaced review in 3 days → daily plan adjusts. Today that signal dies where it was born.

---

### Two: Coaching Panel (Beside Every Feature)

**Why it matters:** Learning Assistant answers questions within one lab. It has no idea what happened in any other lab, course, or practice exam. The learner is alone.

**What it does:** A persistent AI tutor that appears alongside every existing Skill Builder feature — courses, labs, SimuLearn, practice exams — with full knowledge of the learner's cross-feature history. During a video, it highlights connections to weak areas. During a lab, it asks "why" instead of letting learners follow scripted steps passively. After a practice exam, it performs Wrong-Answer Triage: not per-question rationale (Skill Builder already does that), but cross-question pattern detection — "you confuse identity-based and resource-based policy evaluation."

**Immediate benefit:** Every existing feature becomes smarter without being rebuilt. The intelligence layer enhances from the outside.

---

### Three: Live AWS Sandbox (Agent-Operated)

**Why it matters:** Builder Labs are scripted walkthroughs with predetermined steps — same for everyone, no failure modes, no cost teaching. They teach AWS through content. We teach AWS through AWS itself.

**What it does:** Each learner gets a dedicated AWS sub-account (Organizations + SCPs). The agent has full API access to all 200+ AWS services. It improvises demos based on the conversation and competency model — not scripted, not pre-built. Two students asking about DynamoDB get completely different demos based on their gaps. The agent deliberately breaks things to test response. Uses real Cost Explorer data as a teaching tool.

**Immediate benefit:** "How do S3 lifecycle policies work?" → tutor creates a bucket, applies the policy, shows real API output, connects it to a known misconception from last week, updates the competency model, ties it back to the exam. One interaction, every layer feeding every other.

---

### Four: Live Technical Review (Voice + Sandbox + Assessment)

**Why it matters:** Every certification prep tool does the same thing: multiple choice. "Which service?" Pick A, B, C, or D. You can pass that by memorizing. You can pass that from exam dumps. The industry knows this is broken.

**What it does:** Real-time voice conversation (Nova Sonic) + live sandbox + 6 assessment modes flowing naturally in one session. Explain (interpret real logs), Debug (fix real broken infrastructure), Implement (build real architectures), Operate (respond to real incidents), Optimize (reduce real costs), Compare (side-by-side live service behavior). The Shadow Evaluator (Sonnet) scores in the background on 4 dimensions without pausing the conversation.

**Immediate benefit:** You can't dump a live interactive assessment where the agent improvises per learner. Exam dumps die overnight. Every learner gets a different experience. AWS could be the first certification body to say: "We don't ban AI. We built the AI."

---

### Five: Grounded Knowledge (RAG + Knowledge Graph)

**Why it matters:** The tutor can't hallucinate — every response must be grounded in AWS's actual content with citations.

**What it does:** Bedrock KB RAG pipeline with Cohere rerank (production-proven at Harvard): retrieve top-16 transcript chunks → re-score by relevance → threshold filter → generate with inline citations linking to exact video timestamps. Custom semantic chunking (splits at speaker/topic/pause boundaries, preserves precise start/end timestamps — not Bedrock's auto-chunker). LeanRAG knowledge graph of AWS concepts: service relationships, prerequisite chains, difficulty layers. Cross-domain queries: one question that spans networking, security, and storage returns a grounded answer from multiple sources.

**Immediate benefit:** "Watch this 2-minute segment where the AWS CISO explains IAM policy evaluation order" — precise to the second. The tutor knows your prerequisite gaps: "You're weak on DynamoDB Global Tables, but you haven't mastered basic partition keys yet — that's the prerequisite. Let's start there."

---

## The AI-Era Assessment Argument

This is the strongest selling point to AWS. Every certification body is panicking about AI cheating — lockdown browsers, proctoring cameras, banning phones. All losing battles.

Our answer: **make the AI the assessment environment itself.** The tutor has seen the learner's reasoning patterns across dozens of sessions — behavioral fingerprint. Real-time probing defeats cheating: suspicious answer → "explain the third point in your own words." Don't fight AI — absorb it: the tutor is better than ChatGPT because it knows the material, the learner's gaps, and can operate live services.

**Pitch to AWS: "We don't ban AI. We built the AI. And it knows exactly what you understand."**

---

## What AWS Gets

- **Higher pass rates** — tutor targets the gap between "watched videos" and "actually ready"
- **Certifications employers trust** — live operation assessment produces practitioners, not memorizers
- **Skill Builder revenue grows** — $29/mo with intelligent guidance is worth far more than $29/mo for self-browsing
- **AWS ecosystem as teaching lab** — every service learned = a service they'll use (and pay for) in production
- **AI-era assessment leadership** — first cert body to solve the problem, not fight it
- **Competitive moat** — Microsoft and Google have nothing close
- **Bedrock showcase** — agentic tutor on AWS's own stack, for AWS's own certs

**The flywheel:** better prepared learners → more cert attempts → higher pass rates → more certified pros → more AWS adoption → more training demand → repeat.

---

## Evidence: Already Works

**TAi** (Northeastern, CS6650 Distributed Systems) — live since April 2026, 9+ students. Persistent competency model, misconception tracking, 6 adaptive strategies, Nova Sonic voice interviews with Shadow Evaluator, LeanRAG knowledge graph, proactive intervention, spaced review. Supervised by Prof. Yvonne Coady.

**htgaa-chat** (Harvard, Synthetic Biology) — live at chat.htgaa.org. Bedrock KB + Cohere rerank RAG (production, not prototype), custom semantic chunking, timestamped watch-links, multi-language tutoring (10 languages), cross-domain queries, architecture design mentor, DynamoDB persistence.

**~85% ports directly from these two systems.** The ~15% genuinely new: live AWS sandbox, six assessment modes, cross-feature event bus, behavioral assessment.

---

## Phased Rollout

**Phase 1 (6 weeks) — Intelligence Layer MVP:** Competency model, teaching strategies, Coaching Panel, full RAG pipeline, wrong-answer triage, readiness score, mock exam engine, multi-language (10 languages), proactive intervention, spaced review, misconception tracking.

**Phase 2 (6 weeks) — Sandbox + Voice:** Live AWS sandbox (per-learner sub-accounts), Live Technical Review (voice + sandbox + 6 modes), Architecture Design Mentor, Infrastructure Portfolio.

**Phase 3 (ongoing) — Full Ecosystem:** All 13 certs with shared competency model, behavioral assessment, cohort/enterprise features, classroom companion, mobile.

---

## What We're Asking from AWS

1. **Skill Builder integration access** — API to consume learner activity signals and surface the Coaching Panel
2. **Bedrock credits** — fits Education Equity Initiative ($100M) / EdStart / Activate
3. **Sandbox infrastructure** — Organizations + SCPs for per-learner sub-accounts
4. **Content access** — re:Invent recordings/transcripts for RAG ingestion
5. **Technical collaboration** — early Bedrock features (AgentCore, Nova Sonic, KB)
6. **Co-visibility** — case study or re:Invent session

**Why partner, not build internally?** AWS ships content breadth, not pedagogical modeling. Documented pattern: Cengage (adaptive learning on Bedrock, Nov 2025), Pearson, Code.org. We bring production-proven pedagogy + deep Bedrock experience. AWS brings ecosystem + content + infrastructure.

---

## Entirely on AWS

Bedrock (Claude for tutoring, Sonnet for evaluation, Nova Sonic for voice, Cohere Rerank for precision, AgentCore for orchestration), Knowledge Bases (RAG), Organizations + SCPs (sandbox isolation), all 200+ services (teaching lab), CloudWatch + Cost Explorer (live metrics as teaching tools), DynamoDB (persistence), S3 + CloudFront (video), Transcribe + Translate (content pipeline), Lambda + SES (proactive outreach), Cognito (auth).

---

## Team

**Yuzheng Shi** — Developer. MS CS, Northeastern (graduating Aug 2026). Built TAi end-to-end. Deep Bedrock experience (Claude, Nova Sonic, Cohere, Transcribe, Polly, Nova Canvas).

**Prof. Yvonne Coady** — Academic Advisor. CS6650 instructor, Northeastern. Supervises TAi deployment and pedagogy.

**[HTGAA Collaborator]** — Built htgaa-chat for Harvard. Production RAG pipeline, Next.js platform, custom chunking, multi-language tutoring.

---

## One-Line Summary

**Skill Builder has the content. We add the intelligence. Together: the first certification system where the AI knows exactly what you understand — and the first assessment model that works in the AI era.**
