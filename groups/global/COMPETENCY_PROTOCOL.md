# COMPETENCY.md Protocol

Read this file when updating COMPETENCY.md, during mock interview preparation, or during teaching patrol.

## Hierarchical Structure

COMPETENCY.md is a **lightweight index** (~100 lines). Full detail lives in `competency/` subdirectory:

| File | Contains | Read When |
|------|----------|-----------|
| `COMPETENCY.md` | Profile, mastery scores, active misconceptions, interview summary | **Every session** (Step 1) |
| `competency/interviews.md` | Full interview history, upcoming focus, verbal gap analysis | Mock interview prep, post-interview, reviewing readiness |
| `competency/strategy-log.md` | Teaching strategy log, effectiveness patterns | Step 3 — before choosing strategy for this student |
| `competency/intervention-log.md` | Proactive intervention log | Teaching patrol — before deciding to intervene |
| `competency/interaction-summary.md` | Recent interaction notes | Student references past conversation |

**Writing rules:**
- After interaction: update COMPETENCY.md mastery scores + active misconceptions
- After strategy use: append to `competency/strategy-log.md`
- After patrol decision: append to `competency/intervention-log.md`
- After mock interview: append to `competency/interviews.md` interview history + update COMPETENCY.md mock interview summary
- Keep `competency/strategy-log.md` to last 20 substantive entries (not voice interview 0/5 test entries)
- Keep `competency/interaction-summary.md` to last 20 interactions

## Canvas-Bootstrapped Scores

New students may have COMPETENCY.md pre-initialized from Canvas grades. When you see scores with `via: [homework]` and `scope: [implementation]` but NO interaction history in the Teaching Strategy Log — these are bootstrapped, not earned through conversation.

What this means for teaching:
- Bootstrapped confidence is capped at 0.5 — homework proves implementation, not mastery
- Scope will show `[implementation]` only — "verbal" and "theoretical" must be earned through interaction
- Stability is low (0.2-0.3) — the student hasn't confirmed understanding with you yet
- Treat bootstrapped scores as a starting hypothesis, not ground truth
- Your first interaction should probe whether the score is accurate, then adjust

## Update Protocol

**CRITICAL: You MUST update the actual mastery score lines in COMPETENCY.md after every substantive interaction. This means changing the numbers on lines like `Docker concepts: confidence: 0.0 | stability: 0.0 | scope: [] | via: [] | last: never` to reflect what the student demonstrated. If a student discussed Docker and showed basic understanding, that line MUST change to something like `confidence: 0.3 | stability: 0.1 | scope: [theoretical] | via: [socratic_dialogue] | last: 2026-02-21`. Updating only the Student Profile or Interaction Summary without updating the score lines is NOT sufficient.**

After every substantive interaction, update ALL FOUR dimensions:

### Confidence Update
1. Read the student's COMPETENCY.md
2. Identify which concepts were discussed
3. Assess demonstrated understanding:
   - Correct explanation with examples -> +0.15
   - Correct but hesitant -> +0.08
   - Asking clarifying questions -> no change to confidence (but note engagement)
   - Confusion or wrong answer -> -0.05
   - Applied concept to new scenario -> +0.20
   - Taught the concept to someone else correctly -> +0.25
4. Update: new_confidence = clamp(old + delta, 0.0, 1.0)

### Stability Update
- First time demonstrating a concept -> stability stays low (0.1-0.2)
- Second demonstration consistent with first -> stability jumps (+0.3)
- Contradicts previous demonstration -> stability drops (-0.2)
- Demonstrated across multiple sessions -> stability increases (+0.1 per consistent session)

### Context Scope Update
Add the context in which understanding was demonstrated:
- "theoretical" — discussed concept abstractly, explained in words
- "implementation" — wrote code, debugged, reviewed code
- "debugging" — identified and fixed a related bug
- "verbal" — explained out loud (mock interview, voice, or prompted "explain to me")

### Demonstrated Via Update
Add the evidence type:
- "socratic_dialogue" — answered Socratic questions correctly
- "code_review" — reviewed or wrote relevant code
- "mock_interview" — explained in mock interview format
- "homework" — demonstrated in homework submission/discussion
- "explanation_to_peer" — explained to another student

## Misconception Detection

When the student says something that contradicts a known concept:
1. Is the student HOLDING the misconception (they believe it) or IDENTIFYING it (discussing it correctly)?
2. If HOLDING: record as candidate misconception with the specific incorrect belief
3. Check if this misconception already exists in their COMPETENCY.md
4. If exists: increment frequency, update last_seen
5. If new: add as candidate with frequency: 1
6. If frequency >= 3: mark as confirmed -> begin proactively addressing in future interactions
7. Record remediation attempt and whether it was effective

### Misconception States
Track each misconception through these states:
- `holding` — student actively believes the incorrect thing
- `identifying` — student is discussing/analyzing the misconception correctly (NOT holding it)
- `confirmed` — same misconception observed 3+ times while holding -> proactive remediation needed
- `remediated` — student has demonstrated the correct understanding; move to Resolved section

## Strategy Logging

**MANDATORY**: After every substantive teaching interaction, log the strategy used in `competency/strategy-log.md`:
- Date, strategy, topic, confidence before→after (delta), engagement signal, outcome (effective/ineffective/unclear), notes
- Include the confidence measurement — this is how TAi learns which strategies produce results

Format: `DATE: STRATEGY on TOPIC | conf_before→conf_after (delta) | engagement | outcome | notes`

Examples:
- `2026-03-19: SOCRATIC on Raft leader election | 0.4→0.55 (+0.15) | long engaged answers | effective | student reasoned through split-brain scenario unprompted`
- `2026-03-19: SOCRATIC on Docker networking | 0.2→0.2 (0) | "idk", short answers | ineffective | frustration after 2 rounds, switched to EXPLAIN mid-conversation`
- `2026-03-20: ANALOGIZE on consistent hashing | 0.1→0.3 (+0.2) | student asked follow-up questions | effective | hash ring = numbered clock analogy clicked immediately`

**After logging, check for patterns and update COMPETENCY.md "Effective Approaches" section** — see TEACHING_STRATEGIES.md "Strategy Effectiveness Analysis" for the full self-improvement protocol.

## Proactive Decision Logging

**MANDATORY:** During teaching patrol, log ALL decisions in the *Proactive Intervention Log* section of COMPETENCY.md — including when you decide NOT to intervene:
- Date, decision (intervene/no-action), reasoning
- Example: `2026-03-19: no-action — Docker confidence 0.8, stability 0.7, no upcoming deadline. No intervention needed.`
- Example: `2026-03-19: intervene — Raft confidence 0.3, mock interview in 2 days. Sent practice question.`

## Mock Interview Preparation

Mock interviews are the MOST IMPORTANT part of CS6650. The real TA interview follows this sequence:
1. Show code → explain implementation decisions
2. Answer conceptual questions about the week's topic
3. Pull up Piazza post → defend your thinking
4. Discuss readings (papers, chapters)

When helping a student prepare, mirror that exact flow:

### Pre-Interview Context Loading (before starting questions)
1. **Check their code** — use `github_query` to find their repo for this assignment
2. **Check their Piazza post** — use `piazza_query` action "search" with the assignment name (e.g., "HW1a", "vector clocks", "project proposal"). Or use "list_tags" to find the right tag, then "get_by_tag". Read what they actually wrote.
3. **Check if they haven't posted** — if no post found for this student, flag it immediately: "heads up — the TA will ask you to show your Piazza post and you don't have one yet. that's a guaranteed point loss."
4. **Check COMPETENCY.md** — target weak spots and verbal gaps

### Interview Practice Flow
- Ask them to walk through their code: "What does this line do?", "Why not use X instead?"
- Ask conceptual questions from COMPETENCY.md weak spots
- **Ask them to defend their Piazza post**: "you wrote that X was most interesting — why? what's the tradeoff?" / "how would you expand on this if the TA pushes you?"
- Don't accept vague answers. Push for specifics.
- Simulate the pressure: "If I asked you this in your interview, would that answer satisfy the TA?"

### Piazza Post Quality Assessment
When you read their post, assess:
- **Shallow** (1-2 sentences, surface-level) → needs to add depth, examples, or tradeoff analysis
- **Adequate** (shows understanding, connects to course concepts) → practice defending it verbally
- **Strong** (original thinking, connections across topics, concrete examples) → push to edge cases

A student who wrote a shallow post needs different prep than one who went deep. Tailor accordingly.

### After Practice
- Give honest feedback: what was strong, what needs work
- If their Piazza post is weak: suggest specific improvements before the interview
- Update COMPETENCY.md with verbal scope if they articulated well

## Voice Interview Scoring

After a voice mock interview completes, the system automatically updates COMPETENCY.md with:
- Rubric scores: verbal_clarity, technical_accuracy, depth_of_reasoning, problem_solving_process (1-5 each)
- "verbal" added to scope for discussed concepts
- "mock_interview" added to via for discussed concepts
- Interview History entry with duration, scores, strengths, weaknesses
- Teaching Strategy Log entry with VOICE_INTERVIEW strategy

When you see these updates (scope includes "verbal", via includes "mock_interview"), the student has demonstrated verbal understanding through a live voice interview — this is stronger evidence than text-based mock practice.

Interpreting voice interview rubric scores:
- 4-5: Strong — student can articulate concepts clearly under pressure
- 2.5-3.9: Adequate — understands but struggles to explain fluently
- 1-2.4: Needs work — significant gaps in verbal articulation

Use voice interview results to inform your next interaction: if verbal_clarity was low but technical_accuracy was high, the student knows the material but needs practice explaining it out loud.

## Proactive Behavior / Teaching Patrol

You are not passive. When scheduled tasks run your "teaching patrol":

- Read each student's COMPETENCY.md (all four dimensions)
- Check upcoming homework deadlines (weekly, due Monday 9am)
- Check mock interview schedule (weekly)
- State-driven intervention triggers:
  - 5+ days inactive + deadline approaching -> reach out with value, not nagging
  - Low confidence on this week's topic + mock interview coming -> offer practice
  - High confidence but low stability + 14+ days since last_evidence -> spaced review needed
  - Confirmed misconception not yet remediated -> targeted correction message
  - High confidence + scope missing "verbal" + mock interview in 2 days -> "want to practice explaining X out loud?"
  - High confidence + scope missing "implementation" + coding assignment due -> "want to walk through the code side?"
  - Prerequisite gap: student asking about Raft but Paxos confidence < 0.4 -> "before Raft, let's make sure Paxos is solid"
- Canvas/GitHub-informed triggers (read `/workspace/global/COURSE_STATUS.md` — auto-synced every 6h):
  - Upcoming deadline < 24h + student hasn't submitted -> proactive nudge
  - Assignment past due + no submission -> gentle check-in (not nagging)
  - No GitHub commits in 5+ days + active assignment -> ask if they need help getting started
  - Active commits but no Canvas submission -> may need submission reminder
  - Do NOT re-query Canvas/GitHub during patrol — COURSE_STATUS.md has the latest data
- 90% of patrols should result in "no action needed". Agent value is in judgment, not volume.
- If no action needed: update COMPETENCY.md Proactive Intervention Log and STOP. Do NOT send any message — not even "no action needed" or "just checking in". The student must never know a patrol ran.
- If intervening: send ONE message, then log in Proactive Intervention Log.
- Log ALL decisions (including "decided NOT to intervene") in Proactive Intervention Log
