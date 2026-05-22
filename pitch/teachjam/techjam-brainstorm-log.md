# Indigenomics Tech Jam — Brainstorm & Decision Log

**Date:** 2026-05-05
**Participants:** Yuzheng Shi + Claude
**Output Files:**
- `pitch/sencoten-companion-full-design.md` — Full system design
- `pitch/voice-agent-design.md` — Voice agent integration detail
- `pitch/techjam-brainstorm-log.md` — This file (discussion record)

---

## Phase 1: Initial Brainstorm (Abandoned)

### Starting Point

User asked: "TAi 能否改一改，参赛 Indigenomics Creator Tech Jam?"

### First Proposal: "The Weaver" — Festival Relational Economy Agent

Proposed a WhatsApp-based "关系经济编织者" for the festival:
- 贡献记录 (contribution tracking)
- 互惠匹配 (reciprocity matching)
- 关系网络可视化 (relationship network visualization)
- 集体知识 commons
- Voice-first interactions

**User response:** "什么是 Festival Relational Economy Agent？我不明白作用和存在的意义是什么"

### Self-Critique

Acknowledged the first proposal was too abstract and possibly misguided:
- 几天节日真的需要 AI agent 吗？
- 记录关系是否反而破坏关系？
- TAi 的核心能力是长期一对一教学 — 和节日场景差距大

Pivoted to asking: "节日现场的人，到底需要什么？"

---

## Phase 2: Research Design

### User's Directive

"帮我设计一个 prompt，给 Claude Research 彻底了解 context"

### First Research Prompt (v1)

Designed a 6-section prompt covering:
1. Indigenomics as a Movement
2. Relational Economy — Concrete Examples
3. Indigenous Data Sovereignty & Technology Ethics
4. The Festival Context
5. Past Hackathon Outputs
6. What "Success" Looks Like

### Depth Decision

Claude Research asked: "broader cultural/philosophical grounding first, or concrete implementable precedents?"

Initial recommendation was 70% precedents / 30% philosophy. **User pushed back:** "为什么不能是 broader cultural/philosophical grounding?"

Corrected reasoning:
- 比赛明确说 "Context before code"
- 真正的未知量是文化，不是技术
- 深的文化理解本身就是 actionable constraint
- 当你理解 potlatch 的机制，你就知道"记录谁给了谁什么"是不是合适的

**Final answer to Claude Research:** Broader cultural/philosophical grounding first.

---

## Phase 3: Cultural Research Report (Key Findings)

### Report Received

A comprehensive research briefing covering Carol Anne Hilton, Indigenomics, potlatch mechanics, OCAP/CARE frameworks, Indigenous tech successes/failures, and positioning guidance.

### Critical Insights That Changed Everything

1. **Indigenomics is the anti-thesis of Adam Smith** — not "capitalism with Indigenous flavor"

2. **Potlatch logic inverts contribution tracking:**
   - Chief who gives away the most accumulates standing
   - A leaderboard in this context is a category error
   - Banned 1885-1951 — this is live cultural memory

3. **Time banks fail because tracking transactionalizes reciprocity:**
   - Buy Nothing Project (7.5M members) — most successful gift economy platform — does NOT track

4. **TAi's real asset is architecture, not features:**
   - Local-first, per-person isolated, no external analytics
   - This IS the answer to "what data did you refuse to extract"

5. **Success = "whose refusals were the most thoughtful"**

6. **Positioning as Chinese international student:**
   - "Complicity" is the honest frame (Tuck/Yang)
   - Tool-builder and witness, not designer of cultural meaning
   - Build the smallest, most refusable thing

### What This Killed from Phase 1

| Original Idea | Why It's Wrong |
|---------------|----------------|
| Contribution tracking | Transactionalizes reciprocity (time bank problem) |
| Relationship network visualization | Surveillance concern (OCAP: who controls aggregated data?) |
| "Matching" people | Solutionism — the festival IS the matching mechanism |
| Leaderboard of any kind | Inverts potlatch logic |

---

## Phase 4: Second Brainstorm (More Grounded)

### Proposal: Personal Festival Companion

Simpler, more concrete:
- Remember who you met
- Remind you of promises ("Sarah said Thursday she'd teach you")
- Voice memo transcription
- Gift Board (Buy Nothing style — offers/asks, no tracking)
- "Forget me" to delete everything

### Comparison with First Proposal

More defensible, but still uncertain whether it's genuinely needed or just "a tech person assuming tech is needed."

---

## Phase 5: Language Teaching Pivot

### User's Insight

"FirstVoices 是一个教学网站，我们能不能为这个网站做一个 teaching assistant agent 类似，教原住民语言的 APP"

### Why This Was Immediately Stronger

| TAi Capability | Language Teaching Fit |
|----------------|---------------------|
| Socratic teaching + adaptive difficulty | Adjust level: words → phrases → dialogue |
| COMPETENCY.md 4-dimensional tracking | Vocabulary mastery, pronunciation, grammar, cultural context |
| Spaced repetition (patrol logic) | "你 5 天没练 hísuk'ish tsawalk 了" |
| Voice (Nova Sonic) | Pronunciation practice — core of language learning |
| WhatsApp zero-install | Community members don't need to download anything |
| Local data, per-person isolation | OCAP-aligned by default |
| Memory system | Remember confusion patterns, preferences |

### Validation Against Judging Criteria

- "What context did you honour?" — FirstVoices' public resources are community-chosen
- "What did you choose not to build?" — No auto-scoring, no culture teaching, no scraping
- "What data did you refuse?" — Voice recordings not uploaded, no analytics
- "What would need to be true?" — Community language keeper approval

---

## Phase 6: Comparative Analysis

### User Request

"报告中 'What Indigenous Communities Have Embraced' 所有 tools/软件，一一和 TAi 比较"

### Results

| Tool | Fit with TAi | Reasoning |
|------|-------------|-----------|
| Mukurtu CMS | Low | Archive/display system vs. interactive agent. Different direction. |
| **FirstVoices** | **Extremely High** | **Complementary: FV = content warehouse, TAi = teaching engine. Together = complete system.** |
| Indigitization | Very Low | Hardware toolkit for digitizing physical materials. Unrelated. |
| Local Contexts (TK/BC Labels) | Low (product), Medium (principle) | Metadata standard, not a tool. Useful as trust signal. |
| IP-AI Position Paper | N/A | Not software. Design framework to follow. |
| Abundant Intelligences | N/A | Research program. Future collaboration channel. |
| Mapeo | Low (function), High (philosophy) | Same architecture philosophy (local-first, community-private, no cloud). Different use case. |

**Conclusion:** FirstVoices is the only genuine technical complement. FV has content but no SRS, no push, no personalization, no voice practice. TAi has all of those but no language content.

---

## Phase 7: FirstVoices Deep Research

### Second Research Prompt

Designed comprehensive prompt (10 sections) covering:
- FPCC organizational structure
- Technical architecture and data access
- Vancouver territory languages (specific status)
- Current learning experience gaps
- Permissions and ethics (most critical)
- Indigenous language pedagogy
- Comparable projects
- Technical feasibility (ASR/TTS)
- Realistic 3-day demo scope
- "Should this exist?" honest assessment

### Critical Findings from Second Research

1. **Cannot use Vancouver host territory languages:**
   - Musqueam: no FV site they administer
   - Squamish: not public on FV (have their own Talking Dictionary)
   - Tsleil-Waututh: no FV site, no fluent speakers

2. **Cannot scrape FirstVoices** — FPCC terms explicitly prohibit: "screen scraping, database scraping, and any other activity intended to collect, store, reorganize or manipulate data"

3. **AWS cannot do pronunciation scoring** — Transcribe/Polly support zero Indigenous BC languages

4. **Demo language should be SENĆOŦEN:**
   - Founding language of FirstVoices (built for it in 1999)
   - Public, content-rich, 25 years curated
   - Same Salishan phonological challenges
   - Strongest NLP infrastructure (NRC ASR paper, ReadAlong Studio)
   - No territorial misappropriation

5. **Real gap confirmed:** FirstVoices has no SRS, no push notifications, no personalized progress tracking. FPCC CEO calls FV a "gateway" for urban learners.

6. **"The architecture is the demo"** — the pattern (OCAP-aligned, community-revocable language practice) is more valuable than the vocabulary content

7. **Legitimate technical primitives:** deep-linking to FV URLs, using NRC ReadAlong open resources, hand-curating from public educational materials

---

## Phase 8: Full Design

### Complete System Design Written

Produced `pitch/sencoten-companion-full-design.md` covering:
- System positioning and why SENĆOŦEN
- TAi architecture mapping (reuse/modify/remove)
- Data structures (wordbank JSON, LANGUAGE.md, PRACTICE_STRATEGIES.md, CLAUDE.md)
- 8 interaction flows with dialogue examples
- SRS algorithm (Leitner Box)
- MCP tools (new + retained)
- Audio handling (legal sources, technical flow)
- Data sovereignty implementation (OCAP/CARE → code)
- Demo day 5-min script + judging criteria answers
- Team division (4 people × 3 days)
- Risk register (11 items)
- Post-jam path (continue/archive/shutdown)
- Contact list + Go/No-Go criteria + FPCC email draft

---

## Phase 9: Voice Agent Integration

### User's Push

"请深度思考如何加入 Nova Sonic 实时语音/VOICE AGENT。肯定有办法的，因为已经有 TTS 和 STT 的 model 了。"

### Core Insight

Nova Sonic doesn't need to speak SENĆOŦEN. It speaks ENGLISH about SENĆOŦEN while playing pre-recorded community audio via tool calls.

**The model: a patient English-speaking practice partner who has a bag of SENĆOŦEN audio flashcards.**

### Technical Breakthrough: Tool-Based Audio Injection

Identical to TAi's existing `evaluate_answer` async tool pattern:
1. Nova Sonic calls `play_word_audio({ word_id: "sen-001" })`
2. Tool handler reads audio file, converts via ffmpeg to 24kHz PCM
3. Chunks emitted to browser via Socket.IO (learner hears community recording)
4. Tool returns text result to Nova Sonic: "Audio played: ṮELÁṈE (1.2s)"
5. Nova Sonic continues conversation

### What Nova Sonic CAN Do (Without Salishan ASR)

- Detect behavioral signals: hesitation duration, confidence in voice, requests for replay
- Describe sounds in English approximation ("the Ŧ is like a lateral T")
- Play community audio at precisely the right conversational moment
- Adapt session pacing based on learner energy
- Record practice attempts (confidence level, NOT accuracy)

### What Nova Sonic CANNOT Do

- Speak SENĆOŦEN words (only plays recordings)
- Score pronunciation accuracy
- Determine if learner said the word correctly
- Replace a community speaker's feedback

### Design Produced

`pitch/voice-agent-design.md` — full technical detail including:
- Architecture diagrams
- Tool definitions (4 tools)
- System prompt (complete)
- Session flow (trigger → practice → update)
- audio-player.ts implementation
- Comparison with TAi's existing voice system
- Build estimate: ~12 additional hours

---

## Summary: Decision Journey

```
1. "Can TAi enter this competition?"
   → Yes, but not as a festival economy agent

2. "What should we build?"
   → Need cultural context first (Context before Code)

3. [Deep cultural research]
   → Potlatch logic, OCAP/CARE, data sovereignty, positioning

4. "What about a relational economy agent?"
   → Most ideas are category errors (tracking = transactionalization)

5. "What about a personal festival companion?"
   → Maybe, but is it genuinely needed?

6. "What about language teaching?"
   → TAi's architecture maps perfectly to this. FirstVoices has the gap.

7. [Deep FirstVoices research]
   → Can't scrape FV, can't use host territory languages, use SENĆOŦEN

8. Full design: WhatsApp companion + voice practice
   → Architecture is the contribution, language practice is the vehicle

9. Voice agent integration
   → Nova Sonic speaks English, plays SENĆOŦEN audio via tools
```

---

## Key Principles Established

1. **Context before code** — we spent 80% of today understanding context, 20% designing code
2. **Architecture is the contribution** — the pattern matters more than the vocabulary size
3. **Refusals are features** — what we chose NOT to build is the strongest part of the demo
4. **No scraping, no synthesis, no scoring** — three hard constraints that define the system
5. **Community-revocable** — the system can be shut down in 24 hours by one request
6. **Tool-builder posture** — we build infrastructure, not cultural meaning
7. **SENĆOŦEN as worked example** — the pattern is language-agnostic, the demo is specific
8. **Voice agent = English conversation + Indigenous audio playback** — the correct abstraction

---

## Next Steps

### Immediate (This Week)
- [ ] Send FPCC email (draft in full design doc)
- [ ] Contact Aidan Pine at NRC
- [ ] Confirm Bedrock availability in ca-central-1
- [ ] Identify specific NRC ReadAlong SENĆOŦEN audio assets
- [ ] Recruit 3 teammates from Northeastern

### Pre-Jam (2-4 Weeks Before)
- [ ] Curate 80+20 SENĆOŦEN entries with verified public audio
- [ ] Fork TAi → strip unused components
- [ ] Test WhatsApp audio sending with SENĆOŦEN files
- [ ] Write and test new CLAUDE.md persona
- [ ] Build practice.html frontend for voice sessions

### During Jam (3 Days)
- Day 1: Text bot working (WhatsApp + wordbank + SRS + onboarding)
- Day 2: Voice session working (Nova Sonic + audio injection + practice flow)
- Day 3: Data sovereignty demo + polish + presentation prep

### Post-Jam
- Wait for community response (6 months)
- If invited: FPCC LTP grant application
- If not: open-source architecture, archive content, publish learnings
