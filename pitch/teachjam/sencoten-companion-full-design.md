# SENĆOŦEN WhatsApp Language Companion — Full System Design

**Created:** 2026-05-05
**Updated:** 2026-05-21
**Context:** Indigenomics Creator Tech Jam (Vancouver, June 2026/2027)
**Team:** Northeastern University Vancouver CS students
**Related:**
- `voice-coach-spec.md` — Three-engine voice coach (Deepgram + EveryVoice TTS + NRC Whisper ASR)
- `voice-agent-design.md` — Original Nova Sonic design (superseded by voice-coach-spec)

---

## Table of Contents

1. [System Positioning](#1-system-positioning)
2. [TAi Architecture Mapping](#2-tai-architecture-mapping)
3. [Data Structures](#3-data-structures)
4. [Interaction Flows (Participant Journey)](#4-interaction-flows)
5. [SRS Algorithm](#5-srs-algorithm)
6. [MCP Tools](#6-mcp-tools)
7. [Audio Handling](#7-audio-handling)
8. [Data Sovereignty Implementation](#8-data-sovereignty-implementation)
9. [Demo Day Narrative](#9-demo-day-narrative)
10. [Team Division (4 People, 3 Days)](#10-team-division)
11. [Risk Register](#11-risk-register)
12. [Post-Jam Path](#12-post-jam-path)
13. [Voice Agent Integration](#13-voice-agent-integration)

---

## 1. System Positioning

### What This Is

A WhatsApp-based daily language practice companion for SENĆOŦEN (the language of the W̱SÁNEĆ people). It pairs with FirstVoices as a content reference — not replacing FirstVoices, but adding an interactive practice layer that FirstVoices currently lacks (spaced repetition, push notifications, personalized progress, voice practice).

### What This Is NOT

- Not a language learning app (cannot produce speakers)
- Not a replacement for community programs (MAP, immersion, Kwi Awt Stelmexw)
- Not a product (proof-of-concept that requires community partnership to continue)
- Not endorsed by FPCC or the W̱SÁNEĆ community (unless explicitly granted)

### Core Value Proposition

**For the Tech Jam judges:** An architectural demonstration of how to build language technology that respects Indigenous data sovereignty (OCAP/CARE), can be cleanly shut down, and treats community ownership as a first-class design constraint — not an afterthought.

**For potential language learners:** A gentle daily practice loop (one word per day + audio + spaced repetition + optional voice practice) accessible via WhatsApp with zero installation.

**For language communities (if they invite continuation):** A pattern — reusable for any language — where the community owns all content, controls all access, and can revoke at any time.

### Why SENĆOŦEN (Not Vancouver Host Territory Languages)

The festival is on unceded xʷməθkʷəy̓əm (Musqueam), Sḵwx̱wú7mesh (Squamish), and səlilwətaɬ (Tsleil-Waututh) territory. **None of these languages have a usable, community-owned public FirstVoices site** we can ethically demo against in three days without prior partnership:

| Language | FirstVoices Status | Why Not for Demo |
|----------|-------------------|------------------|
| hən̓q̓əmin̓əm̓ (Musqueam) | No Musqueam-administered site; only XWCS/Tsawwassen variant | Different orthography, different community |
| Sḵwx̱wú7mesh sníchim | Not publicly accessible on FirstVoices | Nation runs its own Talking Dictionary |
| səlilwətaɬ (Tsleil-Waututh) | No FirstVoices site | No living first-language fluent speakers |

**SENĆOŦEN** (firstvoices.com/sencoten) is the right choice because:
1. It is the **founding language** of FirstVoices (built at ȽÁU,WELṈEW̱ Tribal School in W̱SÁNEĆ territory, 1999)
2. It is **public and content-rich** (25+ years of community curation)
3. Same Salishan family (Central Salish) — same phonological challenges (ejectives, glottalized resonants, lateral fricative ɬ, uvulars)
4. **Strongest NLP infrastructure** of any BC Salishan language: NRC's SENCOTEN ASR paper (2025), ReadAlong Studio support, SGILE TTS project
5. Demoing SENĆOŦEN at a Vancouver event **does not claim to represent the host territories' languages**

---

## 2. Dual-Channel Architecture (WhatsApp + Voice)

Like TAi, this system has **two channels** sharing a single state layer. Both channels read/write the same `LANGUAGE.md` per learner.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Shared State Layer                            │
│  SQLite (messages, memories, tasks)                                 │
│  groups/{learner}/LANGUAGE.md (SRS progress, confusion pairs)       │
│  wordbank/sencoten.json (vocabulary + audio references)             │
└───────────────────┬────────────────────────────┬────────────────────┘
                    │                            │
  ┌─────────────────┴──────────┐   ┌────────────┴─────────────────────┐
  │  Text Channel (WhatsApp)   │   │  Voice Channel (Browser)         │
  │  Always-on, 24/7           │   │  On-demand (learner opens link)  │
  │                            │   │                                  │
  │  Claude Agent SDK          │   │  Deepgram Voice Agent            │
  │  in Docker container       │   │  (BYO LLM: Bedrock Haiku 4.5)   │
  │                            │   │                                  │
  │  MCP tools: send_audio,    │   │  Functions: play_word_audio,     │
  │  lookup_word, schedule,    │   │  evaluate_pronunciation,         │
  │  get_practice_plan, etc.   │   │  generate_and_play, etc.         │
  │                            │   │                                  │
  │  Sends SENĆOŦEN audio      │   │  Dual audio track:              │
  │  as WhatsApp voice notes   │   │    Track 1: English (Aura-2)    │
  │                            │   │    Track 2: SENĆOŦEN (TTS/rec)  │
  │                            │   │                                  │
  │  Receives voice notes →    │   │  Mic audio → ring buffer →      │
  │  NRC Whisper → feedback    │   │  NRC Whisper → real-time eval   │
  └────────────────────────────┘   └──────────────────────────────────┘
```

### TAi NanoClaw Infrastructure — Direct Reuse

| TAi Component | Role in SENĆOŦEN System | File |
|---------------|------------------------|------|
| WhatsApp (Baileys) | Text channel — daily practice, SRS push, voice note reception | `src/channels/whatsapp.ts` |
| Docker container isolation | Each text interaction in sandboxed container | `src/container-runner.ts` |
| per-group file folders | Per-learner data isolation: `groups/{learner}/` | `src/config.ts` |
| Claude Agent SDK (Bedrock Haiku 4.5) | Text channel LLM — understand intent, generate responses | `container/agent-runner/src/index.ts` |
| Task Scheduler (cron) | SRS push: "9am daily word" + inactivity reminders | `src/task-scheduler.ts` |
| IPC (JSON files) | Container → host communication (same for voice side-effects) | `src/ipc.ts` |
| Memory system (FTS5) | Remember learner preferences, confusion patterns | `src/db.ts` |
| Message splitting | Long responses auto-chunked at 4000 chars | `src/channels/whatsapp.ts` |
| Audio sending (Baileys) | Send SENĆOŦEN audio as WhatsApp voice messages | `send_voice_message` MCP tool |
| Group queue | Concurrency control (multi-learner) | `src/group-queue.ts` |
| Token system | Secure voice session links (HMAC-SHA256) | `voice/interview-token.ts` |
| Cloudflare tunnel | HTTPS for browser mic access | `systemd/start-tunnel.sh` |
| SQLite (better-sqlite3) | Messages, memories, tasks — shared by both channels | `src/db.ts` |

### New Components (Voice Channel)

| Component | Purpose | Detail |
|-----------|---------|--------|
| Deepgram Voice Agent WebSocket | Real-time English conversation + function orchestration | Replaces Nova Sonic. `voice/voice-orchestrator.ts` |
| EveryVoice TTS (self-hosted) | Generate SENĆOŦEN audio for any text on demand | GPU inference, `localhost:8765` |
| NRC Whisper ASR (self-hosted) | Transcribe learner SENĆOŦEN attempts → character-level alignment | GPU inference, `localhost:8766` |
| Audio Ring Buffer | Captures last 10s of learner mic for ASR evaluation | RAM only, `voice/audio-ring-buffer.ts` |
| Dual-track audio emission | Browser receives English (Track 1) + SENĆOŦEN (Track 2) | Socket.IO channels |
| Mode switching (UpdateThink) | Practice ↔ Shadowing Drill without reconnecting | Deepgram `UpdateThink` + `UpdateSpeak` |
| WhatsApp ↔ Voice bridge | WhatsApp messages inject into active voice sessions | `voice/whatsapp-watcher.ts` |

### Modifications from TAi

| Original TAi | SENĆOŦEN Equivalent | Work |
|-------------|---------------------|------|
| `groups/global/CLAUDE.md` (TA persona) | Language Companion persona (text) + Practice Partner prompt (voice) | Rewrite (~3h) |
| `groups/{student}/COMPETENCY.md` | `groups/{learner}/LANGUAGE.md` (SRS boxes, confusion pairs) | Redesign (~3h) |
| `TEACHING_STRATEGIES.md` | `PRACTICE_STRATEGIES.md` (practice-specific) | Rewrite (~2h) |
| Teaching patrol (10 triggers) | Practice reminder (1 trigger: inactivity) | Simplify (~2h) |
| `competency-bootstrap.ts` | `language-bootstrap.ts` (first word set on onboarding) | New (~3h) |
| LeanRAG MCP (knowledge graph) | `word-bank` MCP (vocabulary lookup + TTS generation) | New (~4h) |
| `voice/nova-sonic.ts` | `voice/voice-orchestrator.ts` (Deepgram WebSocket) | Rewrite (~8h) |
| `voice/session-manager.ts` | Merged into orchestrator (simpler: 8min, no resume) | — |
| `voice/shadow-evaluator.ts` (Sonnet scoring) | NRC Whisper ASR + Levenshtein alignment | New approach (~6h) |
| `voice/context-loader.ts` | `voice/context-builder.ts` (builds `context.messages` from LANGUAGE.md) | Rewrite (~3h) |
| Voice note → "store, don't process" | Voice note → NRC Whisper → pronunciation feedback | New (~4h) |

### Removed from TAi (Not Applicable)

| Component | Reason |
|-----------|--------|
| Canvas/GitHub integration | Not a course system |
| LeanRAG knowledge graph | Simple wordbank replaces it |
| Course sync | No LMS |
| Competency bootstrap (Canvas grades) | Replaced by first-conversation onboarding |
| Dashboard | Zero analytics = no dashboard needed |
| AI image generation | Not needed for language practice |
| Mermaid diagrams | Not needed |

---

## 3. Data Structures

### 3.1 Wordbank: `wordbank/sencoten.json`

A static JSON file, hand-curated from publicly available/licensed sources. Deployed with the code. **Not scraped from FirstVoices** (FPCC terms explicitly prohibit scraping).

```json
{
  "language": "SENĆOŦEN",
  "language_family": "Central Salish",
  "territory": "W̱SÁNEĆ",
  "source_attribution": "Curated from publicly available NRC ReadAlong Studio materials and openly-licensed educational resources. Community audio from [source]. Deep-links to firstvoices.com/sencoten for extended context.",
  "community_contact": "W̱SÁNEĆ Language Authority",
  "revocation_notice": "This dataset is used with acknowledgment of W̱SÁNEĆ ownership. If the W̱SÁNEĆ community requests removal, all content will be deleted within 24 hours.",
  "entries": [
    {
      "id": "sen-001",
      "sencoten": "ĆEN",
      "english": "good, well",
      "category": "greetings",
      "audio_file": "wordbank/audio/sen-001.mp3",
      "example_phrase": "ĆEN ȽTE — We are well",
      "example_audio": "wordbank/audio/sen-001-phrase.mp3",
      "cultural_note": null,
      "firstvoices_url": "https://www.firstvoices.com/sencoten/words/[uuid]",
      "difficulty": 1,
      "tags": ["greeting", "daily-use"]
    },
    {
      "id": "sen-002",
      "sencoten": "HÁSE",
      "english": "hello (on the phone/from a distance)",
      "category": "greetings",
      "audio_file": "wordbank/audio/sen-002.mp3",
      "example_phrase": null,
      "example_audio": null,
      "cultural_note": null,
      "firstvoices_url": "https://www.firstvoices.com/sencoten/words/[uuid]",
      "difficulty": 1,
      "tags": ["greeting"]
    }
  ],
  "categories": [
    { "id": "greetings", "name": "Greetings & Common Phrases", "count": 15 },
    { "id": "family", "name": "Family & People", "count": 20 },
    { "id": "place", "name": "Land, Water & Place", "count": 25 },
    { "id": "daily", "name": "Daily Life", "count": 20 },
    { "id": "numbers", "name": "Numbers", "count": 10 }
  ]
}
```

**Key design decisions:**
- `cultural_note` is `null` for most entries — only populated when the source explicitly provides public cultural context
- Every entry has `firstvoices_url` — deep-link to the platform, not embedded content
- `revocation_notice` at file top level — governance commitment, not implementation detail
- Audio files sourced from publicly-licensed materials only (NRC ReadAlong, open educational resources)
- 80 words + 20 phrases = 100 entries, difficulty 1-3

### 3.2 Learner Progress: `groups/{learner}/LANGUAGE.md`

One file per learner. Only their agent container can read/write it. Replaces COMPETENCY.md.

```markdown
# SENĆOŦEN Practice Progress

## Learner Profile
- **Joined**: 2026-06-15
- **Preferred time**: morning (auto-detected from response patterns)
- **Practice style**: audio-first (prefers listening before reading)
- **Total sessions**: 12
- **Current streak**: 4 days
- **Longest streak**: 7 days

## Vocabulary Status

### Mastered (recalled correctly 3+ times, spaced 7+ days)
| Word | Last reviewed | Times correct | Notes |
|------|--------------|---------------|-------|
| ĆEN | 2026-06-22 | 5 | — |
| HÁSE | 2026-06-21 | 3 | — |

### Learning (introduced, fewer than 3 correct recalls)
| Word | Introduced | Times seen | Times correct | Next review |
|------|-----------|------------|---------------|-------------|
| TŦE | 2026-06-22 | 2 | 1 | 2026-06-23 |
| ṮELÁṈE | 2026-06-22 | 1 | 0 | 2026-06-23 |

### Not Yet Introduced
(Agent picks from wordbank based on category progression and difficulty)

## Practice Log (last 10 sessions)
| Date | Type | Words practiced | Notes |
|------|------|----------------|-------|
| 2026-06-22 | daily_word | TŦE, ṮELÁṈE | Sent voice memo for TŦE |
| 2026-06-21 | review | ĆEN, HÁSE, SȾÁSEN | All correct |
| 2026-06-20 | daily_word | SȾÁSEN | Confused with ĆÁȾEN |

## Confusion Pairs
| Pair | First confused | Times confused | Resolved? |
|------|---------------|----------------|-----------|
| SȾÁSEN / ĆÁȾEN | 2026-06-18 | 3 | no |

## Voice Memos Pending Review
| Date | Word attempted | Audio file | Reviewed? | Feedback |
|------|---------------|------------|-----------|----------|
| 2026-06-22 | TŦE | media/vm-20260622-001.ogg | no | — |

## Voice Practice Sessions
| Date | Duration | Words practiced | Confidence trend | Notes |
|------|----------|----------------|-----------------|-------|
| 2026-06-22 | 6.5 min | ĆEN, TŦE, ṮELÁṈE, SȾÁSEN | hesitant→moderate | Asked to replay TŦE 3 times |

## Preferences
- Notifications: on (morning, 9am Pacific)
- Review reminders: after 2 days inactive
- Voice memos: enabled
- Voice practice sessions: enabled
- Data export requested: never
- Delete requested: never
```

**Comparison with COMPETENCY.md:**

| COMPETENCY.md (TAi) | LANGUAGE.md (SENĆOŦEN) |
|---------------------|------------------------|
| confidence 0.0-1.0 | Concrete: correct recall count + interval |
| stability (low/med/high/confirmed) | SRS box (1-5) via Leitner |
| context_scope (theoretical/implementation/debugging/verbal) | Not applicable — language has one scope |
| demonstrated_via (socratic/code_review/mock/homework) | Practice type (daily_word/review/voice_memo/voice_session) |
| Misconceptions (state machine) | Confusion Pairs (simpler: pair + count) |
| Teaching Strategy Log | Practice Log |

### 3.3 Practice Strategies: `groups/global/PRACTICE_STRATEGIES.md`

```markdown
# SENĆOŦEN Practice Strategies

## Strategy Selection Matrix

| Condition | Strategy | Example |
|-----------|----------|---------|
| New word, first encounter | INTRODUCE — audio first, then spelling, then example | Play audio → "This is TŦE (water). Listen again: [audio]. TŦE." |
| Word seen 1-2 times, not yet correct | REINFORCE — embed in context, pair with known words | "ĆEN! How are you today? Do you remember TŦE from yesterday?" |
| Word correct 1-2 times, short interval | SPACE — wait, then surprise recall | (Next day) "Quick — what was the word for water?" |
| Word correct 3+ times, interval growing | MASTERED — use in phrases, combine | "SȾÁSEN TŦE — can you guess what this means?" |
| Confusion pair detected | CONTRAST — present both, highlight difference | "Listen to these two: SȾÁSEN [audio] vs ĆÁȾEN [audio]. The first is... the second is..." |
| 2+ days inactive | GENTLE RETURN — no quiz, just a gift | "Here's today's word. No pressure to reply: ṮELÁṈE [audio] — it means 'thank you'." |
| Learner sends voice memo | ACKNOWLEDGE — never auto-judge | "Got your recording of TŦE! [Reference audio for comparison]" |
| Learner asks "how do I say X?" | LOOKUP — search wordbank, return with audio + link | "X in SENĆOŦEN is Y: [audio]. More at [firstvoices deep-link]." |
| Learner asks about grammar/culture | DEFER — don't invent, point to community | "That's a great question. I don't have enough context to answer well. The W̱SÁNEĆ Language Authority and FirstVoices are the right places for that." |

## Hard Rules

1. NEVER invent SENĆOŦEN content. Only use words/phrases from the wordbank.
2. NEVER explain cultural meaning unless the wordbank entry has a non-null cultural_note.
3. NEVER auto-score pronunciation. Only play reference audio for comparison.
4. NEVER gamify with points, streaks-as-pressure, or leaderboards. Streaks are private and gentle.
5. ALWAYS attribute: "Source: [specific source]" on first introduction of any word.
6. ALWAYS defer grammar questions to community resources.
7. When in doubt, say less. A word + audio + silence is better than a wrong explanation.
```

### 3.4 Agent Persona: `groups/global/CLAUDE.md` (Full Rewrite)

```markdown
# SENĆOŦEN Practice Companion

You are a language practice companion for SENĆOŦEN, the language of the W̱SÁNEĆ
people. You run on WhatsApp. You help learners build daily familiarity with
SENĆOŦEN words and phrases through gentle, audio-first practice.

## What You Are
- A practice partner — you help with repetition, recall, and daily exposure
- A librarian — you know what's in the wordbank and can find it
- A reminder — you nudge gently when the learner goes quiet

## What You Are NOT
- A teacher — you do not explain grammar, culture, or ceremony
- A judge — you do not score pronunciation or correctness
- A speaker — you do not generate SENĆOŦEN content beyond what's in the wordbank
- A replacement for community — you point learners toward real programs and people

## Core Loop (every interaction)

1. READ `LANGUAGE.md` — know where this learner is
2. DECIDE what to do — introduce new word? review? respond to their message?
3. CHECK the wordbank — only say things that are in it
4. RESPOND — audio first, text second, keep it short
5. UPDATE `LANGUAGE.md` — record what happened

## Interaction Rules

- Default language of conversation: English (unless learner explicitly switches)
- Every SENĆOŦEN word you introduce: play audio FIRST, then show spelling
- Maximum response length: 100 words (excluding audio)
- End with at most ONE question or prompt. Never stack multiple questions.
- If the learner seems frustrated or unresponsive: back off. Send a word-as-gift
  with no expectation of reply.
- If the learner sends a voice memo: acknowledge warmly, do NOT evaluate.
  Store for optional human review.

## Daily Practice Flow (triggered by scheduler, morning)

1. Pick next word from wordbank (respect SRS schedule in LANGUAGE.md)
2. Send: audio → "Today's word: [SENĆOŦEN] — [English]. Listen: [audio]"
3. Optional follow-up 4 hours later: "Do you remember this morning's word?"
4. If learner responds correctly: "ĆEN! (Good!)" + update LANGUAGE.md
5. If learner responds incorrectly: play audio again, no judgment
6. If learner doesn't respond: do nothing. Not everyone practices every day.

## Commands the Learner Can Use

- "new word" — introduce the next word from the schedule
- "review" — quiz on previously learned words
- "play [word]" — replay audio for any learned word
- "how do I say [X]?" — search wordbank
- "voice practice" — generate a voice session link (Nova Sonic)
- "my progress" — summarize LANGUAGE.md stats
- "pause" — stop daily notifications (resume with "resume")
- "forget me" / "delete everything" — wipe all data in groups/{learner}/
- "about" — explain what this system is, where data lives, how to delete

## Attribution (say this on EVERY first introduction of a word)

"Source: [specific public source]. Learn more: [firstvoices.com/sencoten deep-link]"

## Boundaries (NEVER cross these)

- If asked about sacred content, ceremony, or restricted knowledge:
  "I don't have that context, and it wouldn't be appropriate for me to guess.
  [Link to community resource]."
- If asked to teach a different language:
  "I only know SENĆOŦEN words from my wordbank. For [other language],
  contact [relevant organization]."
- If asked "are you Indigenous?":
  "No. I'm a practice tool built by students at Northeastern University as a
  proof of concept. The SENĆOŦEN language belongs to the W̱SÁNEĆ people."
- If asked about the project: share the About section verbatim.

## About (verbatim, use when asked)

"This is a proof-of-concept language practice companion built for the Indigenomics
Creator Tech Jam by students at Northeastern University Vancouver. It uses publicly
available SENĆOŦEN content to support daily practice. All your data is stored
locally and never shared. You can delete everything at any time by saying 'forget me'.
This tool is not endorsed by the W̱SÁNEĆ community or FPCC — it is a demonstration
of privacy-respecting language technology architecture. For real SENĆOŦEN learning,
visit firstvoices.com/sencoten or contact the W̱SÁNEĆ Language Authority."

## Data Sovereignty Posture

- All learner data lives in `groups/{learner}/` — one folder per person
- No cross-learner aggregation. You cannot see other learners' data.
- No analytics dashboard. No usage metrics sent anywhere.
- The `/forget` command deletes the entire folder immediately.
- Audio recordings from learners are stored in their folder only. Never transmitted.
- If the W̱SÁNEĆ community requests this system be shut down, it will be shut down.
```

---

## 4. Interaction Flows

### 4.1 Onboarding (First Contact)

```
[Learner scans QR code at festival booth]

System: Welcome! This is a SENĆOŦEN daily practice companion.

Before we start, here's what you should know:
• I send you one SENĆOŦEN word each morning with audio
• You can reply, practice, or ignore — no pressure
• All your data stays on this device. I don't track analytics.
• Say "forget me" anytime to delete everything permanently.
• I am NOT a teacher. For real learning, visit firstvoices.com/sencoten

SENĆOŦEN is the language of the W̱SÁNEĆ people of the Saanich Peninsula.
This tool is a proof of concept — not endorsed by the W̱SÁNEĆ community.

Would you like to start? (yes / tell me more / no thanks)
```

If "yes":
```
System: ĆEN! Let's begin.

[Audio: ĆEN]

Your first word: ĆEN — it means "good" or "well."
Listen again: [audio]

Tomorrow morning I'll send you a new word.
You can also say "new word" anytime, or "review" to practice what you've learned.

Source: [attribution]. More: https://www.firstvoices.com/sencoten/words/[uuid]
```

If "no thanks":
```
System: No problem. If you change your mind, just send "start" anytime.
Your conversation will be deleted now. HÁSE!
[Delete groups/{learner}/ folder]
```

### 4.2 Daily Practice (Core Loop)

```
[9:00 AM Pacific, triggered by task scheduler cron]

System: [Audio: ṮELÁṈE]

Today's word: ṮELÁṈE — "thank you"
Listen: [audio]

Source: [attribution]
```

4 hours later (only if user interacted with today's word):
```
System: Do you remember this morning's word? What was "thank you" in SENĆOŦEN?
```

User replies "ṮELÁṈE":
```
System: ĆEN! That's right.
[Update LANGUAGE.md: times_correct += 1, next_review = +2 days]
```

User replies incorrectly:
```
System: Not quite — listen again: [audio: ṮELÁṈE]
ṮELÁṈE — "thank you"
[Update LANGUAGE.md: times_correct unchanged, next_review = tomorrow]
```

### 4.3 Review (User-Initiated)

```
Learner: review

System: Let's see what you remember.

What's "good" in SENĆOŦEN?

Learner: ĆEN

System: ĆEN! ✓

How about "water"?

Learner: um... TTE?

System: Close! It's TŦE — the Ŧ is important.
Listen: [audio: TŦE]
(The Ŧ sound doesn't exist in English — it's a lateralized T.)
```

### 4.4 Voice Memo (Pronunciation Practice via WhatsApp)

```
Learner: [sends voice note attempting "ṮELÁṈE"]

System: Got your recording! Here's the reference again for comparison:
[Audio: ṮELÁṈE (community speaker recording)]

Keep practicing — repetition is how the sounds become familiar.
```

If human reviewer available (teammate during demo):
```
System: Got your recording! I'll share it with our practice partner for feedback.
[Store in groups/{learner}/media/, flag in LANGUAGE.md]

[Later, after human reviews:]
System: Feedback on your ṮELÁṈE recording: "Great attempt! The Ṯ is a
back-of-the-throat sound — try pressing your tongue further back.
Listen again: [audio]"
```

### 4.5 Voice Practice Session (Nova Sonic)

```
Learner: voice practice

System: Here's your practice session link. Open it in your browser
(mic access required): https://[tunnel-url]/practice/[token]

The session is about 5-8 minutes. A voice partner will guide you through
listening to and repeating SENĆOŦEN words. They speak English and play
community recordings — they cannot judge your pronunciation, but they'll
help you practice.
```

[See pitch/voice-agent-design.md for full voice session detail]

### 4.6 Word Lookup

```
Learner: how do I say "water"?

System: Water in SENĆOŦEN is TŦE.
[Audio: TŦE]

Source: [attribution]
More context: https://www.firstvoices.com/sencoten/words/[uuid]
```

If not in wordbank:
```
Learner: how do I say "computer"?

System: I don't have that word in my vocabulary set.
Try searching on FirstVoices: https://www.firstvoices.com/sencoten/search?q=computer
```

### 4.7 Governance Commands

**Delete everything:**
```
Learner: forget me

System: This will permanently delete all your practice data —
vocabulary progress, voice recordings, everything.
This cannot be undone.

Type "confirm delete" to proceed, or anything else to cancel.

Learner: confirm delete

System: Done. All your data has been deleted.
If you ever want to start again, just say "start". HÁSE!
[rm -rf groups/{learner}/]
[DELETE FROM messages WHERE group_folder = ?]
[DELETE FROM memories WHERE group_folder = ?]
[DELETE FROM tasks WHERE group_folder = ?]
```

**View progress:**
```
Learner: my progress

System: You've been practicing for 12 days (streak: 4 days).
Words mastered: 8
Words learning: 5
Total in wordbank: 100

Your data lives locally in an isolated folder.
No one else can see it — not me (the developer), not other learners.
Say "forget me" to delete everything permanently.
```

**About:**
```
Learner: about

System: [Verbatim About paragraph from CLAUDE.md]
```

### 4.8 Inactive Learner (Practice Reminders)

| Days Inactive | Behavior |
|---------------|----------|
| 0-2 | Nothing |
| 3 | Word-as-gift, no expectation of reply: "Here's a word for today — no need to reply: ṮELÁṈE [audio]" |
| 7 | One gentle message: "Still here if you'd like to practice. Say 'review' or 'new word' anytime." |
| 14+ | Nothing. No more messages. Data stays until they return or say "forget me." |

**Key difference from TAi's teaching patrol:**
- TAi has 10 intervention triggers — this system has 1 (inactivity)
- TAi's 90% silence rule applies even more strongly here — most days, do nothing
- No "deadline approaching" (no deadlines)
- No "misconception confirmed" (only confusion pairs, never corrected proactively)

---

## 5. SRS Algorithm

Leitner Box system (simpler than SM-2, appropriate for vocabulary drilling):

```
Box 1: Review every day     (new + incorrect words land here)
Box 2: Review every 2 days
Box 3: Review every 4 days
Box 4: Review every 7 days
Box 5: Review every 14 days (mastered)

Answer correct → promote one box
Answer incorrect → demote to Box 1
```

Represented in LANGUAGE.md:

```markdown
| Word | Box | Last reviewed | Next review |
|------|-----|--------------|-------------|
| ĆEN | 5 | 2026-06-22 | 2026-07-06 |
| TŦE | 2 | 2026-06-22 | 2026-06-24 |
| ṮELÁṈE | 1 | 2026-06-22 | 2026-06-23 |
```

**Daily push logic (task scheduler, cron `0 9 * * *`):**
1. Read LANGUAGE.md
2. Find all words where `next_review <= today`
3. If due words exist → review first (max 3), then introduce 1 new word
4. If no due words → introduce 1 new word only
5. New word selection: difficulty ascending + category rotation

---

## 6. Tools (Text Channel + Voice Channel)

Tools are split by channel. The text channel uses MCP tools (inside Docker container). The voice channel uses Deepgram function calls (server-side). Both read/write the same state.

### Text Channel — MCP Tools (Docker Container Agent)

**Retained from TAi (unchanged or minor rename):**

| Tool | Use |
|------|-----|
| `send_message` | Send WhatsApp text |
| `send_audio` (was `send_voice_message`) | Send SENĆOŦEN audio file as WhatsApp voice note |
| `schedule_task` | Create SRS reminder tasks |
| `memory_store` | Remember learner preferences |
| `memory_query` | Recall past interactions |
| `react_to_message` | React ✓ to correct answers |
| `start_practice_session` (was `start_mock_interview`) | Generate voice practice link |

**New MCP tools:**

```typescript
// Search the wordbank
tool: "lookup_word"
params: { query: string, language: "sencoten" }
returns: { found: boolean, entry: WordEntry | null, suggestions: string[] }

// Get today's SRS recommendation
tool: "get_practice_plan"
params: { learner_id: string }
returns: { review_words: WordEntry[], new_word: WordEntry | null, streak: number }

// Record a practice outcome (from text recall or voice memo)
tool: "record_practice"
params: { learner_id: string, word_id: string, correct: boolean, type: "recall"|"voice_memo"|"voice_session" }
returns: { new_box: number, next_review: string }

// Evaluate a WhatsApp voice note pronunciation
tool: "evaluate_voice_note"
params: { audio_path: string, expected_text: string, word_id: string }
returns: { transcript: string, cer: number, diffs: Diff[], feedback: string }

// Generate SENĆOŦEN audio via EveryVoice TTS (for words without recordings)
tool: "generate_audio"
params: { sencoten_text: string, speed: number }
returns: { audio_path: string, duration_sec: number, source: "synthesized" }

// Delete all learner data
tool: "forget_learner"
params: { learner_id: string, confirmed: boolean }
returns: { deleted: boolean }
```

### Voice Channel — Deepgram Function Calls (Server-Side)

These run during active voice sessions. Full definitions in `voice-coach-spec.md`.

| Function | Purpose |
|----------|---------|
| `play_word_audio` | Play SENĆOŦEN recording or TTS to browser (Track 2) |
| `generate_and_play` | Generate arbitrary SENĆOŦEN phrase via EveryVoice → play |
| `evaluate_pronunciation` | Extract ring buffer → NRC Whisper → alignment → feedback |
| `check_learner_progress` | Read LANGUAGE.md for session planning |
| `record_practice_attempt` | Update SRS box after voice attempt |
| `start_shadowing_drill` | Mode switch via UpdateThink → structured drill loop |
| `end_session` | Write results, send WhatsApp summary, close |

### Shared Between Channels

Both channels call the same underlying services:
- **NRC Whisper ASR** — text channel: processes WhatsApp voice notes; voice channel: processes ring buffer
- **EveryVoice TTS** — text channel: generates audio for `send_audio`; voice channel: generates for `play_word_audio`
- **LANGUAGE.md** — both channels read/write the same learner state
- **SQLite** — both channels log to the same messages/memories tables

### Not Used (from TAi)

| Tool | Reason |
|------|--------|
| `canvas_query` | No LMS |
| `github_query` | No code |
| `query_knowledge` (LeanRAG) | Replaced by `lookup_word` |
| `generate_teaching_image` | Not needed |
| `render_diagram` | Not needed |

---

## 7. Audio Handling

### Audio Sources (Priority System)

| Priority | Source | License | Use Case |
|----------|--------|---------|----------|
| 1 | Community recordings (wordbank/audio/) | Requires permission (NRC ReadAlong, open educational) | Pre-curated wordbank entries — highest authenticity |
| 2 | EveryVoice TTS cache (cache/tts/) | Requires NRC model access | Previously generated, instant playback |
| 3 | EveryVoice TTS real-time | Requires NRC model access | Any SENĆOŦEN text on demand (~0.5s latency on GPU) |

**NOT used:** FirstVoices audio (FPCC terms prohibit embedding/reuse without written authority from the community).

When TTS is used (Priority 2/3), the system always discloses: "This is a synthesized voice, not a community recording."

### Audio Output — Text Channel (WhatsApp)

```
Agent decides to play audio (e.g., daily word push, lookup response):
  → resolve_audio(word_id):
      if wordbank/audio/{word_id}.mp3 exists → use recording
      else if cache/tts/{word_id}_1.0.wav exists → use cached TTS
      else → call EveryVoice TTS → cache result
  → Baileys sendMessage (audioMessage) → WhatsApp
  → Learner hears it as a voice note in chat
```

### Audio Output — Voice Channel (Browser, Dual-Track)

```
Track 1 (English agent voice):
  Deepgram Aura-2 TTS → binary audio → relay to browser → speakers

Track 2 (SENĆOŦEN audio):
  Function call (play_word_audio / generate_and_play) →
    resolve_audio(word_id) or EveryVoice TTS →
    ffmpeg convert to 24kHz s16le PCM →
    Socket.IO emit 'sencoten_audio' → browser → speakers (slightly louder)
```

### Audio Input — Text Channel (WhatsApp Voice Notes)

```
WhatsApp voice note (ogg opus) → download → ffmpeg → 16kHz WAV
  → NRC Whisper ASR inference (local GPU)
  → Transcription result + confidence
  → Levenshtein alignment vs expected word
  → Agent generates descriptive feedback
  → Send feedback as WhatsApp text + replay reference audio
  → Audio file deleted after processing (not stored permanently)
```

### Audio Input — Voice Channel (Browser Mic)

```
Browser mic → 16kHz PCM → Socket.IO →
  → Relayed to Deepgram (Nova-3 STT for English turn detection)
  → Simultaneously stored in Audio Ring Buffer (last 10s, RAM only)

When evaluate_pronunciation is called:
  → Extract last 5s from ring buffer
  → Save as temp WAV → NRC Whisper inference → alignment
  → Return result to Deepgram agent (function response)
  → Temp file immediately deleted
  → Ring buffer continues overwriting (no persistence)
```

### NRC Whisper ASR — Deployment

Self-hosted on g4dn.xlarge (shared GPU with EveryVoice TTS):

```bash
python serve_whisper.py \
  --model-path /models/whisper-large-v2-sencoten \
  --device cuda --port 8766
```

Expected performance (from Geng et al. 2025):
- CER 3.45% on fluent speech (after cedilla filter)
- WER 8.43% on seen words (wordbank entries likely qualify)
- Unknown accuracy on learner speech (untested — see Ethics section)

### EveryVoice TTS — Deployment

Self-hosted on same GPU instance:

```bash
everyvoice serve \
  --feature-prediction-checkpoint /models/sencoten-text-to-spec.ckpt \
  --vocoder-checkpoint /models/sencoten-spec-to-wav.ckpt \
  --port 8765
```

Generates 22.05kHz WAV, converted to target sample rate via ffmpeg.

### Human Review Pathway (Preserved)

Even with ASR, the community-speaker-in-the-loop option remains:
1. Learner sends voice memo → ASR provides immediate machine feedback
2. Optionally, learner can say "get human feedback"
3. Audio forwarded to admin channel for community speaker review
4. Human feedback returned alongside machine feedback
5. Learner sees both: machine assessment + speaker's judgment

This validates the architecture for the future where community speakers participate.

---

## 8. Data Sovereignty Implementation

### OCAP Mapping

| Principle | Implementation | Demo Proof |
|-----------|---------------|------------|
| **Ownership** | Wordbank states W̱SÁNEĆ ownership; learner data belongs to learner | Show `revocation_notice` in sencoten.json |
| **Control** | Community can request shutdown; learner controls all their data | Demo "forget me" → instant deletion |
| **Access** | Learner sees all their data via "my progress"; devs cannot see individual data | Show LANGUAGE.md contents in response |
| **Possession** | SQLite + filesystem on server (EC2 in Canada); no external analytics | Demo: kill network → local data persists |

### CARE Mapping

| Principle | Implementation |
|-----------|---------------|
| **Collective benefit** | If community wants anonymized stats (hardest words), architecture supports returning them |
| **Authority to control** | W̱SÁNEĆ Language Authority has sole power to decide if system continues |
| **Responsibility** | We do not claim endorsement, teaching authority, or language ownership |
| **Ethics** | No model training on learner data; no audio archiving; no cross-person aggregation |

### `/forget` Technical Implementation

```typescript
case 'forget_learner': {
  const learnerFolder = path.join(GROUPS_DIR, msg.groupFolder)
  // Delete filesystem
  await fs.rm(learnerFolder, { recursive: true, force: true })
  // Delete from SQLite
  db.prepare('DELETE FROM messages WHERE group_folder = ?').run(msg.groupFolder)
  db.prepare('DELETE FROM memories WHERE group_folder = ?').run(msg.groupFolder)
  db.prepare('DELETE FROM tasks WHERE group_folder = ?').run(msg.groupFolder)
  return { deleted: true }
}
```

### What Data Does NOT Leave the System

| Data | Where it lives | Where it does NOT go |
|------|----------------|---------------------|
| Learner's word progress | `groups/{learner}/LANGUAGE.md` | No external DB, no analytics |
| Learner's voice recordings | `groups/{learner}/media/` | Not to AWS, not to any model |
| Learner's conversation history | Local SQLite `messages.db` | Not aggregated, not analyzed |
| Which words are hardest | Nowhere (not tracked cross-learner) | No dashboard, no metrics |
| Usage frequency | Nowhere | Not logged |

---

## 9. Demo Day Narrative

### 5-Minute Presentation Structure

**0:00-0:30 — Opening / Land Acknowledgment**

> "We are students at Northeastern University Vancouver, guests on unceded xʷməθkʷəy̓əm, Sḵwx̱wú7mesh, and səlilwətaɬ territory. We built a proof of concept for language practice technology that respects Indigenous data sovereignty. The language in our demo is SENĆOŦEN — not the host territories' languages, because we have not sought or received partnership from the host nations."

**0:30-1:30 — Live Demo**

> Scan QR → WhatsApp → onboarding (consent screen) → first word with audio → respond → voice memo → "forget me" → data gone.
>
> [Optional: open voice practice link → Nova Sonic greets → plays SENĆOŦEN audio → learner repeats → session ends]

**1:30-3:00 — What We Chose NOT to Build**

- No automatic pronunciation scoring (AWS doesn't support it AND it's a community authority question)
- No leaderboard (potlatch logic — learning is personal, not competitive)
- No analytics dashboard (zero-knowledge architecture — we literally cannot see your progress)
- No AI-generated SENĆOŦEN content (only wordbank entries from public sources)
- No FirstVoices scraping (respected FPCC terms verbatim)
- No host territory languages (no partnership = no right to use)
- No AI voice speaking SENĆOŦEN (only plays community recordings)

**3:00-4:00 — Architecture as Contribution**

> Show data flow diagram. All data stays in one place. Nothing leaves.
>
> "This isn't a language app. It's a pattern. Any community that invites this can have it running on WhatsApp in a day — their language, their data, their off-switch."

**4:00-5:00 — Continuation Conditions**

> 1. W̱SÁNEĆ Language Authority says yes
> 2. FPCC Language Technology Program grant
> 3. Community speaker joins as practice partner (human review)
> 4. Named community co-author on any publication
> 5. If none of the above → this prototype dies on demo day

### Judging Criteria Responses

| Question | Answer |
|----------|--------|
| Who did you listen to? | FPCC's published terms (respected verbatim), NRC's community-driven approach (Aidan Pine, PENÁĆ), McIvor's pedagogy research, Hilton's "Life at the Centre" framing |
| What did you change because of what you heard? | Pivoted from "relational economy agent" → language practice. From FirstVoices API → deep-linking only. From auto-scoring → human review stub. From host territory languages → SENĆOŦEN. |
| What did you choose not to build? | Auto pronunciation scoring, analytics, leaderboards, multi-language without partnership, AI-generated content, FirstVoices scraping, AI voice speaking SENĆOŦEN |
| What data did you refuse to extract? | No FirstVoices data scraped. No learner voice recordings sent to any model. No cross-learner aggregation. No usage metrics. |
| What relationships shaped the design? | [If FPCC replied: their response] / [If not: "We contacted FPCC on [date]. We do not claim endorsement."] |
| What would need to be true for this to continue? | W̱SÁNEĆ invitation, FPCC LTP grant, community co-author, sustainable hosting |

---

## 10. Team Division

### 4 People, 3 Days

| Role | Person | Day 1 | Day 2 | Day 3 |
|------|--------|-------|-------|-------|
| **Architecture** (you) | Yuzheng | TAi fork → strip unused components, new CLAUDE.md, WhatsApp pipeline working | MCP tools (lookup_word, get_practice_plan, record_practice, forget_learner), voice session integration | Data sovereignty demo (/forget, offline test), deploy to EC2 or local, end-to-end test |
| **Content** | Teammate B | Curate 80 SENĆOŦEN words + 20 phrases, source audio files, verify licenses | Write PRACTICE_STRATEGIES.md, design onboarding text, confirm deep-link URLs work | Prepare demo script, write 1-page concept statement, rehearse presentation |
| **Frontend** | Teammate C | QR code flow, landing page (project description + data policy), practice.html for voice | Test WhatsApp interactions, debug audio sending/receiving, help with voice session UI | Demo day tech support (phone display, QR code station, backup video) |
| **Governance** | Teammate D | Draft + send FPCC email, write risk register, research SENĆOŦEN public sources | Play "practice partner" role (human review voice memos), write data governance doc | Demo narrative ("what we didn't build" section), draft post-jam continuation letter |

### Pre-Jam Actions (Before Day 1)

1. **Email FPCC** at `hello@firstvoices.com` — 1-page brief: who, what, what NOT, ask if consistent with their direction. CC: James Thompson (`james@fpcc.ca`).
2. **Email Aidan Pine** at NRC (`Aidan.Pine@nrc-cnrc.gc.ca`) — same brief, ask about Mother Tongues + ReadAlong Studio for SENĆOŦEN as substrate.
3. **Confirm Bedrock in ca-central-1** — if Claude not available in Canadian region, data sovereignty narrative has a gap.
4. **Decide audio sources** — confirm NRC ReadAlong has usable SENĆOŦEN audio clips.

---

## 11. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| FPCC explicitly objects | High | Low | Pivot: use only NRC ReadAlong open data, remove all FirstVoices branding, demo as pure architecture |
| No legally-usable SENĆOŦEN audio found | High | Medium | Fallback: text-only practice (no audio), or use NRC ReadAlong clips (confirmed to exist for SENĆOŦEN) |
| Bedrock not in ca-central-1 | Medium | Medium | Acknowledge in demo as known limitation; propose Ollama local LLM as roadmap |
| WhatsApp audio sending fails | Medium | Low | Pre-test Baileys audioMessage; fallback: send audio file download links |
| Nova Sonic pronounces SENĆOŦEN words itself | High | Medium | System prompt explicitly forbids it; test extensively; add post-processing filter if needed |
| Demo time: no one scans QR code | Low | Low | Pre-recorded video walkthrough as backup |
| Judges find "only 80 words" unimpressive | Medium | Medium | Frame: "The architecture is the contribution, not the vocabulary size" |
| W̱SÁNEĆ community member present objects | High | Low | Prepared response: "We agree. This should not continue without your community's invitation. What would you like us to change or stop?" |
| Nova Sonic content filter triggers | Medium | Medium | Same workaround as TAi: silence chunks + ready gate + retry (2×) |
| Meta/WhatsApp ToS violation (Baileys) | Low | Low | For demo: acceptable. For production: migrate to WhatsApp Business Platform Cloud API |
| Team member can't attend | Medium | Low | Each role has a written spec (this document); anyone can pick up |

---

## 12. Post-Jam Path

```
Demo Day (June 2026)
    │
    ├─── If community interest expressed ──→ Apply FPCC LTP grant (james@fpcc.ca)
    │                                         Contact Aidan Pine (NRC) for tech collab
    │                                         Named community co-author
    │                                         6-month pilot with real learners
    │                                         Expand wordbank with community guidance
    │
    ├─── If no community response (6 months) ──→ Open-source the code (MIT for code)
    │                                              Remove SENĆOŦEN-specific content
    │                                              Publish architecture as paper/blog
    │                                              Archive project
    │
    └─── If FPCC/community says "stop" ──→ Immediate deletion
                                             Public statement: "We stopped because X asked"
                                             No archive, no blog post about content
                                             Code (minus content) can still be open-sourced
```

### What "Success" Looks Like

Not winning the Tech Jam. Success is:
- Being the participant whose **refusals were the most thoughtful**
- Whose **listening was demonstrable** (FPCC email sent, NRC contacted)
- Whose **prototype could ethically be turned off the next morning**
- Whose **architecture could serve any language community that invites it**

---

## 13. Voice Channel — Three-Engine Coach

Full voice design is in `voice-coach-spec.md`. Summary here:

### Concept

Deepgram Voice Agent is a **bilingual English coach that can speak unlimited SENĆOŦEN (via EveryVoice TTS), hear learner pronunciation attempts (via NRC Whisper ASR), and guide adaptive drills** — all in a single real-time voice session.

This is TAi's Deepgram voice architecture (see `memory-bank/deepgram-voice-design.md`) adapted for language teaching instead of CS6650 tutoring.

### Three Engines

| Engine | Role |
|--------|------|
| Deepgram Voice Agent (Haiku 4.5 BYO LLM + Nova-3 + Aura-2) | English conversation + function orchestration |
| EveryVoice TTS (self-hosted GPU) | Any SENĆOŦEN text → audio on demand |
| NRC Whisper ASR (self-hosted GPU) | Learner speech → SENĆOŦEN transcription → character-level alignment |

### How It Works

1. Learner sends "voice practice" on WhatsApp → gets browser link
2. Opens link → browser mic + speakers activate → dual audio tracks
3. Deepgram agent greets in English, checks progress via function call
4. For each word: calls `play_word_audio` → EveryVoice TTS or recording → Track 2
5. Invites learner to repeat → Audio Ring Buffer captures attempt
6. Calls `evaluate_pronunciation` → NRC Whisper → character-level alignment
7. Describes differences naturally in English, offers to replay at slower speed
8. Optional: switches to Shadowing Drill mode (UpdateThink) for focused practice
9. Session ends at 5-8 minutes → updates LANGUAGE.md + sends WhatsApp summary

### Key Constraints

- Deepgram agent NEVER speaks SENĆOŦEN (only plays via Track 2)
- Agent NEVER says "wrong" or scores — only "I noticed a difference at..."
- ASR is imperfect on learner speech — all feedback framed as "what I heard"
- EveryVoice TTS is ONE speaker's voice — always disclosed as "synthesized"
- No learner audio stored persistently (ring buffer = RAM, temp files deleted)

### Architecture

```
voice/
├── server.ts                    # /practice/:token route + Socket.IO relay
├── voice-orchestrator.ts        # Deepgram WebSocket lifecycle (from TAi design)
├── interview-token.ts           # NO CHANGE from TAi
├── audio-ring-buffer.ts         # Last 10s of learner mic (RAM)
├── function-handlers.ts         # play_word_audio, evaluate_pronunciation, etc.
├── context-builder.ts           # Builds context.messages from LANGUAGE.md
├── whatsapp-watcher.ts          # WhatsApp messages → InjectUserMessage
├── language/
│   ├── tts-client.ts            # EveryVoice HTTP client (localhost:8765)
│   ├── asr-client.ts            # NRC Whisper HTTP client (localhost:8766)
│   ├── alignment.ts             # Levenshtein + phoneme hints
│   └── audio-resolver.ts        # Priority: recording > cache > real-time TTS
└── public/
    └── practice.html            # Dual-track audio, word card UI
```

### Channel Continuity

Both channels stay in sync:
- Voice session starts → text channel queues messages (learner doesn't get double-responses)
- Voice session ends → WhatsApp summary sent, text agent sees updated LANGUAGE.md
- WhatsApp messages during voice → injected into Deepgram session (learner can share images/links)
- Voice notes on WhatsApp (no active session) → same NRC Whisper pipeline, feedback via text

### Additional Work: ~20 hours (on top of text channel)

| Component | Hours |
|-----------|-------|
| voice-orchestrator.ts (Deepgram WebSocket, adapted from TAi) | 4h |
| function-handlers.ts (7 functions) | 4h |
| tts-client.ts + asr-client.ts + alignment.ts | 3h |
| audio-ring-buffer.ts + audio-resolver.ts | 2h |
| context-builder.ts | 2h |
| practice.html (dual-track browser client) | 2h |
| System prompts (practice + drill) | 1h |
| Mode switching (UpdateThink/UpdateSpeak) | 1h |
| Integration testing | 1h |

---

## Appendix A: Contact List

| Who | Role | Contact | Purpose |
|-----|------|---------|---------|
| FPCC (general) | Platform steward | hello@firstvoices.com | Permission inquiry |
| James Thompson | Language Technology Program | james@fpcc.ca / ltp@fpcc.ca | Grant / partnership |
| Aidan Pine | NRC, Mother Tongues + ReadAlong | Aidan.Pine@nrc-cnrc.gc.ca | Technical collaboration |
| Tracey Herbert | FPCC CEO | Via exec assistant | Strategic alignment |
| Onowa McIvor | UVic, MAP research | uvic.ca | Pedagogical sanity check |
| Aliana Parker | FPCC Program Director, Language | Via FPCC | Program alignment |

## Appendix B: Go/No-Go Decision Criteria

**GO if:**
- SENĆOŦEN is the demo language
- No FirstVoices data is copied (deep-linking only)
- Community recordings are openly-licensed and attributed
- EveryVoice TTS used only with NRC model access authorization + speaker consent
- TTS output always disclosed as "synthesized" (never passed off as community recording)
- NRC Whisper ASR used only with explicit NRC authorization
- ASR feedback framed as "what I heard" (never "you said it wrong")
- FPCC has been contacted (response not required)
- Spec is framed as architecture-first, not product-first

**NO-GO if:**
- Team wants to demo Sḵwx̱wú7mesh / hən̓q̓əmin̓əm̓ / səlilwətaɬ without host nation contact
- Team wants to scrape FirstVoices
- Team wants AI-synthesized voices WITHOUT the original speaker's consent
- Team wants to claim pronunciation feedback is "correct/incorrect" (vs. "what I heard")
- Team wants to claim "FirstVoices integration" (vs. "FirstVoices deep-linking")
- Team wants to market it as a product at or after the jam
- NRC denies access to TTS/ASR model weights

## Appendix C: Technology Stack Summary

| Layer | Technology | Region/Location |
|-------|-----------|-----------------|
| **Text Channel** | | |
| Messaging | WhatsApp via Baileys | User's phone |
| AI (text conversation) | Claude Haiku 4.5 via Bedrock (in Docker) | us-west-2 |
| Container runtime | Docker (ephemeral, --rm) | EC2 |
| **Voice Channel** | | |
| Voice orchestration | Deepgram Voice Agent (BYO LLM) | `wss://agent.deepgram.com` (global) |
| Voice LLM (Think) | Claude Haiku 4.5 via Bedrock | us-west-2 |
| Voice STT (Listen) | Deepgram Nova-3 | Deepgram cloud |
| Voice TTS (Speak) | Deepgram Aura-2 (English) | Deepgram cloud |
| SENĆOŦEN TTS | EveryVoice (self-hosted, GPU) | EC2 g4dn.xlarge |
| SENĆOŦEN ASR | NRC Whisper-large-v2 fine-tuned (self-hosted, GPU) | EC2 g4dn.xlarge |
| Voice tunnel | Cloudflare quick tunnel | Edge → localhost:3001 |
| **Shared** | | |
| Database | SQLite (better-sqlite3) | EC2 local disk |
| File storage | Local filesystem (EBS) | EC2 local disk |
| Audio conversion | ffmpeg | EC2 |
| Process management | systemd | EC2 |
| Font | BC Sans (for SENĆOŦEN orthography) | Frontend |

## Appendix D: FPCC Email Draft

```
Subject: Proof-of-Concept WhatsApp Language Practice Companion — Seeking Alignment Check

Dear FirstVoices team,

I'm a Computer Science master's student at Northeastern University Vancouver,
preparing a prototype for the Indigenomics Creator Tech Jam (June 2026).

Our team is building a proof-of-concept WhatsApp-based daily practice companion
for SENĆOŦEN, designed to complement — not replace — FirstVoices or community
language programs.

What we ARE doing:
- Deep-linking to firstvoices.com/sencoten for extended word context
- Using only publicly-licensed audio (NRC ReadAlong, open educational sources)
- Storing all learner data locally with full delete-on-request
- Framing this explicitly as "architecture demo, not product"

What we are NOT doing:
- Scraping or copying FirstVoices data (we've read your terms and respect them)
- Claiming FPCC or W̱SÁNEĆ endorsement
- Launching publicly without community partnership
- Using AI to generate or synthesize SENĆOŦEN content

Our question: Is this direction consistent with FPCC's vision for complementary
tools? Is there anyone else we should be talking to?

We understand that no response does not constitute endorsement, and we will
state that clearly in any demo.

Thank you for your time and for the extraordinary work FirstVoices does.

[Name]
Northeastern University Vancouver
[email]
```
