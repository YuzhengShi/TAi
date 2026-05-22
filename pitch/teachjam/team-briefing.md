# SENĆOŦEN WhatsApp Language Companion — Team Briefing

## What We're Building

A WhatsApp bot that sends you one SENĆOŦEN word per day with audio, tracks what you've learned, and optionally lets you do real-time voice pronunciation practice in a browser. SENĆOŦEN is the language of the W̱SÁNEĆ people (Saanich Peninsula, BC). The bot speaks English; it plays SENĆOŦEN audio from community recordings or synthesized speech.

**Think of it as:** Duolingo stripped down to one language, running on WhatsApp, with zero data extraction and a kill switch the community can pull at any time.

---

## How It Works (Two Channels)

### Text Channel (WhatsApp, always on)
- Every morning at 9am: sends a new word + audio clip
- Learner can reply, ask for review, look up words, send voice memos
- Tracks progress with a simple flashcard system (Leitner boxes: get it right → longer interval, get it wrong → back to daily)
- Commands: "new word", "review", "play [word]", "voice practice", "forget me"

### Voice Channel (browser, on-demand)
- Learner says "voice practice" on WhatsApp → gets a link
- Opens in browser → English-speaking voice coach guides pronunciation drills
- Coach plays SENĆOŦEN audio (never speaks it itself), learner repeats
- System transcribes the attempt using a specialized ASR model, gives gentle feedback like "I noticed a difference at the Ŧ sound — that's a lateral T"
- Session lasts 5-8 minutes, results sync back to WhatsApp progress

---

## Tech Stack (Short Version)

| Component | What it does |
|-----------|-------------|
| WhatsApp (Baileys) | Messaging interface, voice notes |
| Claude Haiku 4.5 (AWS Bedrock) | Brain of the bot — decides what to say |
| Deepgram Voice Agent | Real-time English voice conversation |
| EveryVoice TTS (NRC, self-hosted GPU) | Generates SENĆOŦEN audio for any word |
| Fine-tuned Whisper ASR (NRC, self-hosted GPU) | Transcribes learner pronunciation attempts |
| SQLite + local filesystem | All data storage — nothing leaves the server |

---

## Content

- 100 curated vocabulary entries (80 words + 20 phrases), difficulty 1-3
- Categories: greetings, family, land/water/place, daily life, numbers
- Audio from openly-licensed sources (NRC ReadAlong, educational materials)
- Deep-links to firstvoices.com/sencoten for extended context — we do NOT copy their content

---

## What Makes This Project Different

### What we chose NOT to build:
- No pronunciation scoring ("wrong/correct") — only "what I heard" vs reference
- No analytics dashboard — we literally cannot see individual learner progress
- No leaderboard — learning is personal, not competitive
- No AI-generated SENĆOŦEN content — only plays curated wordbank entries
- No FirstVoices scraping — respected their terms verbatim
- No host territory languages — no partnership = no right to use them

### Data sovereignty:
- Each learner's data is in one folder. They own it.
- "forget me" = instant permanent deletion (code exists: `rm -rf groups/{learner}/`)
- No cross-learner aggregation. No usage metrics. No model training on learner data.
- Voice recordings: RAM only (10-second buffer), deleted after each evaluation
- If the W̱SÁNEĆ community says stop → project dies immediately

---

## Why SENĆOŦEN

- Founding language of FirstVoices (1999, built in W̱SÁNEĆ territory)
- Strongest NLP infrastructure of any BC Salishan language (NRC ASR paper 2025, EveryVoice TTS, ReadAlong Studio)
- Public and content-rich on FirstVoices (25+ years of curation)
- Same language family as Vancouver host territory languages — demonstrates the pattern without claiming to represent them

---

## Hard Blockers (Can't Build Without These)

| Blocker | Status |
|---------|--------|
| NRC authorizes fine-tuned Whisper model weights | Not yet requested |
| NRC/EveryVoice authorizes TTS model weights | Not yet requested |
| Original TTS speaker consents to educational use | Unknown |

**Without NRC authorization:** The system still works — English coaching + pre-recorded audio playback — but no pronunciation evaluation and no unlimited vocabulary synthesis. Still a valid demo.

---

## Relation to the Problem Statement

**"Prototype digital experiences that make a relational economy visible, felt, and connected."**

The relational economy has a language. SENĆOŦEN carries the vocabulary of reciprocity, protocol, witnessing, ceremony, and exchange — concepts Carol Ann described that don't map cleanly into English. If no one can speak those words, the relational economy becomes invisible. This tool keeps it audible.

---

## What Each Team Member Could Own

| Role | Work |
|------|------|
| Architecture / Dev | Fork TAi, strip unused components, wire up MCP tools, deploy |
| Content | Curate 100 wordbank entries, source audio, verify licenses, write agent persona |
| Frontend / UX | Practice.html (voice session UI), landing page, QR flow, demo prep |
| Governance / Narrative | FPCC email, risk register, demo script ("what we didn't build"), post-jam path |

---

## Timeline

- **Creator Jam (next week):** Produce the spec + minimal working demo (WhatsApp → word + audio → response)
- **Impact Summit (May 27-28):** Showcase
- **Post-jam:** If W̱SÁNEĆ community expresses interest → FPCC grant → 6-month pilot. If not → archive.

---

## One-Line Pitch

"We built a WhatsApp practice companion for a language that carries an entire relational economy in its vocabulary — and we built it so the community can shut it off tomorrow."
