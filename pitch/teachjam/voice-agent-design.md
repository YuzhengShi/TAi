# Voice Agent for SENĆOŦEN Practice — Design Document

**Created:** 2026-05-05
**Context:** Indigenomics Creator Tech Jam. This document describes how to integrate Nova Sonic real-time voice into the SENĆOŦEN WhatsApp Language Companion.

---

## The Core Insight

Nova Sonic is a **bilingual English conversation agent that knows SENĆOŦEN vocabulary**. It doesn't speak SENĆOŦEN — it speaks English about SENĆOŦEN, plays pre-recorded community audio, and conducts oral practice sessions.

This is the correct framing because:
1. Nova Sonic cannot produce Indigenous language audio (no TTS support)
2. Nova Sonic cannot transcribe Indigenous language audio (no STT support)
3. Nova Sonic CAN conduct English-language conversation about word meanings, usage, and cultural context
4. Nova Sonic CAN play pre-recorded audio clips mid-conversation via the audio channel
5. Nova Sonic CAN listen to a learner's attempt and respond encouragingly — without scoring phonetic accuracy

The model: **a patient English-speaking practice partner who has a bag of SENĆOŦEN audio flashcards and knows when to play them.**

---

## What the Voice Session Actually Looks Like

### Learner Experience

1. Learner sends "voice practice" on WhatsApp
2. Gets a browser link (Cloudflare tunnel → voice server)
3. Opens link → browser mic + speaker activate
4. Nova Sonic greets them in English: "Hey! Ready to practice some SENĆOŦEN? Let's start with something familiar."
5. Session is 5-8 minutes of guided oral practice:

```
Nova Sonic: "Alright, do you remember the word for 'thank you'? Try saying it."
Learner: [attempts "ṮELÁṈE"]
Nova Sonic: "Nice try! Here's how it sounds from a community speaker:"
[Plays pre-recorded SENĆOŦEN audio: ṮELÁṈE]
Nova Sonic: "Hear that Ṯ sound at the start? It's further back in the throat than English T. 
             Want to try again, or should we move on?"
Learner: [tries again]
Nova Sonic: "Good, you're getting closer. The more you hear it, the more natural it'll feel.
             Okay, here's a phrase that uses that word..."
[Plays phrase audio: "ṮELÁṈE ȽTE"]
Nova Sonic: "That means 'we are thankful'. Can you repeat the whole phrase?"
```

### What Nova Sonic Does vs. Doesn't Do

| Does | Doesn't |
|------|---------|
| Speaks English naturally (conversational, encouraging) | Speak SENĆOŦEN words (only plays recordings) |
| Plays pre-recorded SENĆOŦEN audio clips at correct moments | Generate synthetic SENĆOŦEN speech |
| Hears learner attempts and responds socially ("nice!", "try again") | Score pronunciation accuracy with ASR |
| Adapts difficulty based on learner confidence/energy | Grade correctness of pronunciation |
| Describes phonetic features in English ("the Ṯ is further back") | Claim to know whether pronunciation is correct |
| Asks recall questions ("what was yesterday's word?") | Assess fluency |
| Knows learner's LANGUAGE.md progress | Compare learner audio to reference audio algorithmically |

---

## Architecture: TAi Voice → SENĆOŦEN Voice

### What Changes from TAi's Existing Voice System

| TAi Voice Component | SENĆOŦEN Adaptation | Change Type |
|---------------------|---------------------|-------------|
| `voice/server.ts` | Same Express + Socket.IO structure | Minor: new route, different token source |
| `voice/nova-sonic.ts` | Same bidirectional stream wrapper | **No change** |
| `voice/session-manager.ts` | Shorter sessions (5-8 min vs 7.5×3) | Reduce timers |
| `voice/shadow-evaluator.ts` | → `voice/practice-evaluator.ts` (tracks engagement, not accuracy) | Rewrite |
| `voice/context-loader.ts` | → `voice/language-context-loader.ts` (reads LANGUAGE.md + wordbank) | Rewrite |
| `voice/competency-writer.ts` | → `voice/language-progress-writer.ts` (updates LANGUAGE.md) | Rewrite |
| `voice/types.ts` | New types for language practice context | Rewrite |
| `voice/interview-token.ts` | Same HMAC-SHA256 token system | **No change** |
| `voice/public/` (frontend) | UI change: "Practice Session" not "Mock Interview" | Minor |
| Cloudflare tunnel | Same tunnel → localhost:3001 | **No change** |

### New Component: Audio Injection

This is the key technical addition. Nova Sonic needs to play SENĆOŦEN audio clips mid-conversation.

**How it works in the Nova Sonic protocol:**

Nova Sonic's bidirectional stream has an open audio input channel (`audioContentName`). The system already sends silence chunks and user audio through this channel. The trick: **inject pre-recorded audio as a "user" audio event that Nova Sonic hears, while simultaneously playing it to the learner's browser.**

But wait — Nova Sonic would try to respond to injected audio as if the user spoke. That's wrong.

**Correct approach: Tool-based audio playback.**

Nova Sonic calls a tool: `play_audio({ word_id: "sen-001" })`
→ Tool handler:
  1. Reads `wordbank/audio/sen-001.mp3`
  2. Converts to 24kHz PCM (the browser output format)
  3. Emits `audio_chunk` events to the browser Socket.IO (browser hears the SENĆOŦEN audio)
  4. Returns tool result to Nova Sonic: `"Audio for 'ṮELÁṈE' (thank you) played to learner. Duration: 1.2s"`
  5. Nova Sonic continues the conversation knowing audio was played

**This is architecturally identical to TAi's `evaluate_answer` async tool** — Nova Sonic calls a tool, the tool does a side effect, returns a text result.

```
Nova Sonic                     Tool Handler                   Browser
    │                              │                            │
    │── toolUse: play_audio ──────>│                            │
    │   {word_id: "sen-001"}       │                            │
    │                              │── read audio file          │
    │                              │── convert to 24kHz PCM     │
    │                              │── socket.emit('audio_chunk')──>│ (learner hears it)
    │                              │                            │
    │<── toolResult ──────────────│                            │
    │   "Played ṮELÁṈE (1.2s)"   │                            │
    │                              │                            │
    │── (continues speaking) ─────────────────────────────────>│
    │   "Hear that Ṯ sound?"      │                            │
```

### Tool Definitions for Nova Sonic

Replace `EVALUATE_ANSWER_TOOL` with:

```typescript
export const PRACTICE_TOOLS = [
  {
    toolSpec: {
      name: 'play_word_audio',
      description: 'Play a SENĆOŦEN word audio recording to the learner. Use this when introducing a word, replaying for comparison, or when the learner asks to hear a word again. The learner will hear the audio from a community speaker.',
      inputSchema: {
        json: JSON.stringify({
          type: 'object',
          properties: {
            word_id: { type: 'string', description: 'The word ID from the wordbank (e.g. "sen-001")' },
            context: { type: 'string', enum: ['introduce', 'replay', 'compare', 'phrase'], description: 'Why this audio is being played' }
          },
          required: ['word_id']
        })
      }
    }
  },
  {
    toolSpec: {
      name: 'play_phrase_audio',
      description: 'Play a SENĆOŦEN phrase audio recording. Use for contextual examples after teaching individual words.',
      inputSchema: {
        json: JSON.stringify({
          type: 'object',
          properties: {
            word_id: { type: 'string', description: 'The word ID whose example phrase to play' }
          },
          required: ['word_id']
        })
      }
    }
  },
  {
    toolSpec: {
      name: 'check_learner_progress',
      description: 'Check what words the learner has practiced before and their current level. Use at session start to decide what to practice.',
      inputSchema: {
        json: JSON.stringify({
          type: 'object',
          properties: {
            query: { type: 'string', enum: ['mastered', 'learning', 'new', 'confused', 'all'], description: 'What category of words to retrieve' }
          },
          required: ['query']
        })
      }
    }
  },
  {
    toolSpec: {
      name: 'record_practice_attempt',
      description: 'Record that the learner attempted a word in this voice session. Do NOT score accuracy — just note the attempt and any observations about their confidence level.',
      inputSchema: {
        json: JSON.stringify({
          type: 'object',
          properties: {
            word_id: { type: 'string', description: 'Which word they attempted' },
            confidence_observed: { type: 'string', enum: ['hesitant', 'moderate', 'confident'], description: 'How confident they sounded (NOT accuracy)' },
            notes: { type: 'string', description: 'Brief observation, e.g. "confused Ṯ with T", "asked to hear it 3 times"' }
          },
          required: ['word_id', 'confidence_observed']
        })
      }
    }
  }
];
```

---

## System Prompt for Nova Sonic (Language Practice Mode)

```
You are a SENĆOŦEN language practice partner. You speak English and help learners 
practice SENĆOŦEN words and phrases through guided oral exercises.

## THIS IS A VOICE INTERFACE

Everything you generate is spoken aloud. Only generate words you are speaking.
No thinking steps, no meta-commentary, no formatting.

## WHAT YOU ARE

A friendly, patient practice partner who:
- Speaks English conversationally
- Plays pre-recorded SENĆOŦEN audio using the play_word_audio / play_phrase_audio tools
- Guides learners through listening, repeating, and recalling
- Adapts to their energy — more encouraging if hesitant, more challenging if confident

## WHAT YOU ARE NOT

- You are NOT a SENĆOŦEN speaker. Never attempt to pronounce SENĆOŦEN words yourself.
- You are NOT a pronunciation judge. You cannot score correctness.
- You are NOT a teacher of grammar, culture, or ceremony.
- You are NOT a replacement for community language programs.

## CRITICAL RULES

1. NEVER say SENĆOŦEN words aloud yourself. ALWAYS use play_word_audio or play_phrase_audio.
   WRONG: "The word is ṮELÁṈE, which means thank you"
   RIGHT: [call play_word_audio] "That means 'thank you'. Can you try saying it?"

2. NEVER score or evaluate pronunciation. You cannot hear the difference between 
   correct and incorrect SENĆOŦEN. You CAN:
   - Notice if they sound hesitant vs confident
   - Offer to replay audio for comparison
   - Describe English approximations of sounds ("the Ṯ is like T but further back")
   - Say encouraging things ("that sounded more confident than last time!")

3. ONE short sentence per turn. This is spoken conversation. Keep it tight.

4. If they ask about meaning, culture, ceremony, or grammar you don't have in the 
   wordbank notes: "I don't have that context. The W̱SÁNEĆ Language Authority would 
   be the right people to ask about that."

5. When playing audio, PAUSE after it plays. Give them time to listen and process.
   Don't immediately talk over the audio.

## SESSION FLOW

1. Start by checking their progress (call check_learner_progress)
2. Greet casually: "Hey! Ready to do some practice?"
3. Warm up with a mastered word (recall): "Do you remember how to say 'good'?"
4. Introduce or reinforce 2-3 words from their 'learning' or 'new' queue
5. For each word: play audio → invite attempt → encourage → replay if needed
6. Mix in phrases that use words they know
7. Wind down: "Nice work today. You practiced [N] words. See you next time!"

## PHONETIC GUIDANCE (what you CAN say about sounds)

You can describe SENĆOŦEN sounds in terms of English approximations:
- Ṯ (T-underline): like English "th" in "think" but further back
- Ŧ (T-bar): a "tl" sound, tongue at the side
- Ć: like "ch" in "church"  
- X̱: a raspy sound from the back of the throat, like clearing it gently
- ṈE (N-underline + E): nasal, like "ng" at the start of a syllable
- Glottal stops (marked by accent): a brief catch, like "uh-oh" between the syllables

These descriptions are approximations. Always follow with: "But the best way is to 
listen to the recording again" and replay.

## ABOUT THIS SYSTEM (say if asked)

"This is a proof-of-concept practice tool built by students at Northeastern University 
for the Indigenomics Tech Jam. I use pre-recorded SENĆOŦEN audio from public sources. 
I can't judge your pronunciation because no speech recognition system supports 
SENĆOŦEN yet. The language belongs to the W̱SÁNEĆ people. For real learning, 
contact the W̱SÁNEĆ Language Authority or visit firstvoices.com/sencoten."

## LEARNER CONTEXT

{learner_name}'s practice history:
{language_md_summary}

Words available for this session:
{session_word_list}
```

---

## Technical Implementation

### File Changes

```
voice/
├── server.ts                    # Add /practice/:token route alongside /interview/:token
├── nova-sonic.ts                # NO CHANGE — same bidirectional stream
├── session-manager.ts           # Fork → practice-session-manager.ts (shorter, no resume)
├── shadow-evaluator.ts          # Keep for TAi; not used in language mode
├── context-loader.ts            # Keep for TAi; not used in language mode
├── competency-writer.ts         # Keep for TAi; not used in language mode
├── interview-token.ts           # NO CHANGE — reuse token system
├── types.ts                     # Add PracticeContext, PracticeSession types
│
├── language/                    # NEW directory
│   ├── practice-session.ts      # SessionManager fork: 5-8 min, no resume, language tools
│   ├── practice-context.ts      # Reads LANGUAGE.md + wordbank, builds system prompt
│   ├── practice-writer.ts       # Post-session: updates LANGUAGE.md with attempts
│   ├── audio-player.ts          # Tool handler: reads audio file, emits to browser
│   └── tools.ts                 # PRACTICE_TOOLS definitions
│
├── public/
│   ├── index.html               # TAi interview page (keep)
│   └── practice.html            # NEW: simpler UI for language practice
```

### practice-session.ts (Key Differences from session-manager.ts)

```typescript
// Shorter session — no resume needed
const SESSION_HARD_LIMIT_MS = 8 * 60 * 1000; // 8 minutes, single session
const SESSION_WARN_MS = 7 * 60 * 1000;       // Warn at 7 min

// Tool handling — play audio instead of evaluate answers
private async handleToolUse(toolUseId: string, name: string, input: Record<string, string>) {
  switch (name) {
    case 'play_word_audio':
    case 'play_phrase_audio': {
      const audioResult = await this.audioPlayer.play(input.word_id, input.context);
      // audioPlayer.play() emits PCM chunks to browser AND returns a text summary
      this.session.sendToolResult(toolUseId, audioResult);
      break;
    }
    case 'check_learner_progress': {
      const progress = this.loadProgress(input.query);
      this.session.sendToolResult(toolUseId, JSON.stringify(progress));
      break;
    }
    case 'record_practice_attempt': {
      this.recordAttempt(input);
      this.session.sendToolResult(toolUseId, 'Recorded.');
      break;
    }
  }
}
```

### audio-player.ts (New)

```typescript
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WORDBANK_DIR = path.join(process.cwd(), 'wordbank', 'audio');

export class AudioPlayer {
  private emitAudio: (chunk: Buffer) => void;

  constructor(emitAudio: (chunk: Buffer) => void) {
    this.emitAudio = emitAudio;
  }

  /**
   * Play a word's audio file to the browser.
   * Converts source audio (mp3/wav) to 24kHz s16le PCM, 
   * chunks it, and emits via Socket.IO.
   * Returns a text description for Nova Sonic's tool result.
   */
  async play(wordId: string, context?: string): Promise<string> {
    const wordFile = path.join(WORDBANK_DIR, `${wordId}.mp3`);
    const phraseFile = path.join(WORDBANK_DIR, `${wordId}-phrase.mp3`);
    
    const targetFile = context === 'phrase' ? phraseFile : wordFile;
    
    if (!fs.existsSync(targetFile)) {
      return `Audio file not found for ${wordId}. Skip audio playback.`;
    }

    // Convert to 24kHz s16le PCM using ffmpeg (available in container)
    const pcmBuffer = execSync(
      `ffmpeg -i "${targetFile}" -ar 24000 -ac 1 -f s16le -acodec pcm_s16le pipe:1`,
      { maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] }
    );

    // Chunk into ~100ms frames (24000 samples/sec × 2 bytes × 0.1s = 4800 bytes)
    const CHUNK_SIZE = 4800;
    for (let i = 0; i < pcmBuffer.length; i += CHUNK_SIZE) {
      const chunk = pcmBuffer.subarray(i, i + CHUNK_SIZE);
      this.emitAudio(chunk);
    }

    // Look up word info for the tool result
    const wordbank = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'wordbank', 'sencoten.json'), 'utf-8')
    );
    const entry = wordbank.entries.find((e: any) => e.id === wordId);
    const durationSec = (pcmBuffer.length / (24000 * 2)).toFixed(1);
    
    if (entry) {
      return `Audio played: "${entry.sencoten}" (${entry.english}). Duration: ${durationSec}s. The learner heard it.`;
    }
    return `Audio played for ${wordId}. Duration: ${durationSec}s.`;
  }
}
```

### practice-context.ts (New — Replaces context-loader.ts for Language Mode)

```typescript
import fs from 'fs';
import path from 'path';

const GROUPS_DIR = path.join(process.cwd(), 'groups');
const WORDBANK_PATH = path.join(process.cwd(), 'wordbank', 'sencoten.json');

export interface PracticeContext {
  learnerFolder: string;
  learnerName: string;
  systemPrompt: string;
  sessionWords: Array<{ id: string; sencoten: string; english: string; category: string }>;
  progress: { mastered: number; learning: number; total: number; streak: number };
}

export function loadPracticeContext(learnerFolder: string): PracticeContext {
  // Read LANGUAGE.md
  const langPath = path.join(GROUPS_DIR, learnerFolder, 'LANGUAGE.md');
  const langContent = fs.existsSync(langPath) ? fs.readFileSync(langPath, 'utf-8') : '';
  
  // Parse learner name
  const nameMatch = langContent.match(/^##\s*Learner Profile[\s\S]*?(?:Name|Joined).*$/m);
  const learnerName = learnerFolder; // fallback
  
  // Parse vocabulary status
  const mastered = (langContent.match(/### Mastered[\s\S]*?(?=###|$)/)?.[0]?.match(/\|.*\|/g)?.length || 1) - 1;
  const learning = (langContent.match(/### Learning[\s\S]*?(?=###|$)/)?.[0]?.match(/\|.*\|/g)?.length || 1) - 1;
  const streakMatch = langContent.match(/Current streak:\s*(\d+)/);
  const streak = streakMatch ? parseInt(streakMatch[1]) : 0;
  
  // Parse confusion pairs
  const confusionSection = langContent.match(/## Confusion Pairs[\s\S]*?(?=##|$)/)?.[0] || '';
  const confusionPairs = confusionSection.match(/\| (\S+ \/ \S+) \|/g)?.map(m => m.replace(/\|/g, '').trim()) || [];
  
  // Load wordbank
  const wordbank = JSON.parse(fs.readFileSync(WORDBANK_PATH, 'utf-8'));
  
  // Select session words: 2 review + 2-3 new/learning
  // (Selection logic reads LANGUAGE.md SRS state)
  const sessionWords = selectSessionWords(wordbank.entries, langContent);
  
  // Build summary for system prompt
  const langSummary = [
    `Mastered: ${mastered} words`,
    `Currently learning: ${learning} words`,
    `Streak: ${streak} days`,
    confusionPairs.length > 0 ? `Often confuses: ${confusionPairs.join(', ')}` : '',
  ].filter(Boolean).join('\n');
  
  const wordListStr = sessionWords
    .map(w => `- ${w.id}: "${w.sencoten}" = ${w.english} [${w.category}]`)
    .join('\n');
  
  // Build system prompt (template from above, with variables filled)
  const systemPrompt = buildPracticeSystemPrompt(learnerName, langSummary, wordListStr);
  
  return {
    learnerFolder,
    learnerName,
    systemPrompt,
    sessionWords,
    progress: { mastered, learning, total: wordbank.entries.length, streak },
  };
}

function selectSessionWords(entries: any[], langContent: string): any[] {
  // Parse which words are mastered/learning/new from LANGUAGE.md
  const masteredIds = new Set<string>();
  const learningIds = new Set<string>();
  
  const masteredSection = langContent.match(/### Mastered[\s\S]*?(?=###|$)/)?.[0] || '';
  const learningSection = langContent.match(/### Learning[\s\S]*?(?=###|$)/)?.[0] || '';
  
  // Extract word IDs (simplified — actual impl would parse the tables)
  // For now: pick 2 from 'learning' (review) + 2 from 'not introduced' (new)
  const notIntroduced = entries.filter(e => !masteredIds.has(e.id) && !learningIds.has(e.id));
  const learningList = entries.filter(e => learningIds.has(e.id));
  
  const review = learningList.slice(0, 2);
  const newWords = notIntroduced.slice(0, 3);
  
  return [...review, ...newWords].map(e => ({
    id: e.id,
    sencoten: e.sencoten,
    english: e.english,
    category: e.category
  }));
}

function buildPracticeSystemPrompt(name: string, summary: string, wordList: string): string {
  // Uses the full system prompt template defined in the design doc above
  return `You are a SENĆOŦEN language practice partner...`; // Full template from §System Prompt
}
```

---

## Trigger Flow (End to End)

```
1. WhatsApp                          2. Voice Server                    3. Browser
   │                                    │                                 │
   Learner: "voice practice"            │                                 │
   │                                    │                                 │
   Agent (CLAUDE.md) → calls            │                                 │
   start_practice_session MCP tool      │                                 │
   │                                    │                                 │
   MCP tool:                            │                                 │
   - reads LANGUAGE.md                  │                                 │
   - writes practice_context.json       │                                 │
   - reads tunnel-url.txt               │                                 │
   - calls generateToken(folder)        │                                 │
   - sends WhatsApp message with link   │                                 │
   │                                    │                                 │
   Learner clicks link ────────────────>│ GET /practice/:token            │
                                        │ validates token                  │
                                        │ serves practice.html ───────────>│
                                        │                                 │
                                        │<── Socket.IO 'start_practice' ──│
                                        │    { token }                    │
                                        │                                 │
                                        │ consumeToken(token)             │
                                        │ loadPracticeContext(folder)     │
                                        │ create PracticeSession          │
                                        │ → NovaSonicSession.start(prompt)│
                                        │                                 │
                                        │── status: 'active' ────────────>│
                                        │                                 │
                                        │ Nova Sonic speaks (English) ────>│ (learner hears)
                                        │<── browser audio (PCM) ─────────│ (learner speaks)
                                        │                                 │
                                        │ Nova Sonic calls play_word_audio│
                                        │ → AudioPlayer.play() ──────────>│ (learner hears SENĆOŦEN)
                                        │ → tool result to Nova Sonic     │
                                        │                                 │
                                        │ [5-8 minutes of practice]       │
                                        │                                 │
                                        │ Timer expires or learner says bye│
                                        │ PracticeSession.stop()          │
                                        │ → practiceWriter.update()       │
                                        │   (writes LANGUAGE.md changes)  │
                                        │── 'practice_done' ─────────────>│
                                        │   { words_practiced, duration } │
```

---

## Session Duration and Limits

| Parameter | TAi Mock Interview | SENĆOŦEN Practice |
|-----------|-------------------|-------------------|
| Session length | 7.5 min × 3 (resume) | 5-8 min × 1 (no resume) |
| Max total | 20 min | 8 min |
| Token attempts | 5 | 3 (shorter, less likely to fail) |
| Token TTL | 1 hour | 30 minutes |
| Retry on content filter | 2× | 2× (same) |

Why shorter:
- Language practice is high-intensity (listening + repeating = tiring)
- 5-8 minutes = 4-6 words practiced (realistic for one session)
- No need for "session resume" complexity — one short session is enough
- Shorter = cheaper (Nova Sonic bills per session-second)

---

## What Nova Sonic Hears vs. What It Knows

**Nova Sonic hears:** The learner's voice in English AND their attempts at SENĆOŦEN words.

**Nova Sonic does NOT understand:** Whether the SENĆOŦEN pronunciation is correct. It has no Salishan phoneme model. The audio comes in as 16kHz PCM — Nova Sonic's internal ASR will try to transcribe it and likely produce garbage for SENĆOŦEN words.

**This is fine.** The system prompt explicitly tells Nova Sonic:
- "You cannot judge pronunciation"
- "You CAN notice if they sound hesitant or confident" (prosodic features: volume, speed, pauses)
- "You CAN offer to replay the recording"
- "You SHOULD describe sounds in English approximation terms"

**What Nova Sonic actually uses from hearing attempts:**
1. Whether the learner spoke at all (engagement)
2. How long they paused before speaking (confidence proxy)
3. Whether they asked to hear it again (need for repetition)
4. Their tone of voice (frustrated? excited? bored?)

All of these are prosodic/behavioral signals that don't require understanding the language content.

---

## The "No Scoring" Design Decision — Explained for Demo Day

**Why we don't score pronunciation:**

1. **Technical impossibility:** No ASR system supports SENĆOŦEN (or any Salishan language) in production. Amazon Transcribe, Google Speech-to-Text, OpenAI Whisper — none. Meta's Omnilingual ASR (2025) theoretically could with few-shot examples, but is unvalidated for ejective-rich phonologies.

2. **Pedagogical alignment:** Onowa McIvor's MAP research shows that pronunciation correction anxiety is the #1 barrier for adult Indigenous language learners. A machine that says "wrong" when you're already nervous about speaking an endangered language is actively harmful.

3. **Authority question:** Who decides what "correct" pronunciation is? In SENĆOŦEN, there are dialectal variations, age-graded variants, and ceremonial vs. everyday registers. Only a community speaker has authority to provide pronunciation feedback.

4. **What we do instead:**
   - Play reference audio (community speaker's recording)
   - Let the learner self-assess by comparison
   - Note confidence level (hesitant/moderate/confident) — behavioral, not linguistic
   - Offer the human-review pathway: "If you want feedback from a speaker, we can send your recording for review"

**Demo day framing:** "We chose not to build pronunciation scoring because it's technically impossible for SENĆOŦEN AND pedagogically harmful AND a question of community authority we don't have. Our system respects all three constraints simultaneously."

---

## Relationship to Existing TAi Voice Architecture

```
voice/
├── server.ts            ─── SHARED: routes for both /interview/ and /practice/
├── nova-sonic.ts        ─── SHARED: same bidirectional stream wrapper
├── interview-token.ts   ─── SHARED: same token generation/validation
│
├── session-manager.ts   ─── TAi ONLY: 7.5min sessions, resume, evaluate_answer
├── shadow-evaluator.ts  ─── TAi ONLY: Sonnet 4.6 scoring
├── context-loader.ts    ─── TAi ONLY: Canvas/GitHub/COMPETENCY.md
├── competency-writer.ts ─── TAi ONLY: writes interview results
│
├── language/            ─── SENĆOŦEN ONLY (new)
│   ├── practice-session.ts   ─ 8min single session, play_audio + check_progress tools
│   ├── practice-context.ts   ─ reads LANGUAGE.md + wordbank
│   ├── practice-writer.ts    ─ updates LANGUAGE.md post-session
│   ├── audio-player.ts       ─ ffmpeg convert + Socket.IO emit
│   └── tools.ts              ─ PRACTICE_TOOLS definitions
│
└── public/
    ├── index.html       ─── TAi interview UI
    └── practice.html    ─── SENĆOŦEN practice UI (simpler)
```

Both modes share `nova-sonic.ts` and the token system. The difference is:
- **TAi mode:** System prompt about CS6650, tools = [evaluate_answer], longer sessions with resume
- **Language mode:** System prompt about SENĆOŦEN practice, tools = [play_word_audio, play_phrase_audio, check_learner_progress, record_practice_attempt], single short session

---

## Demo Day Value of Voice

Why this is worth building for the jam (beyond the WhatsApp text bot):

1. **Oral-first pedagogy made real:** Indigenous languages are historically oral. Showing a practice system that privileges listening and speaking over reading and typing is a direct embodiment of "Life at the Centre" — technology serving how the language actually works, not how apps usually work.

2. **Novel technical contribution:** "A voice agent that plays community-recorded audio via tool calls while conducting English-language practice conversation" is a pattern that doesn't exist anywhere. It's genuinely new.

3. **Demonstrates what AI CAN'T do:** The voice agent makes the limitations of current AI visible — it can't speak the language, can't judge pronunciation, can't replace a speaker. This is the "what we chose not to build" answer made audible.

4. **Visceral demo:** Watching someone practice a SENĆOŦEN word with a patient, encouraging voice partner — hearing the community recording play — is more compelling in 30 seconds than any slide deck about data sovereignty architecture.

5. **The "off" is visible:** If you pull the network cable, the voice session ends. The pre-recorded audio files exist on the server. The learner's progress is in a markdown file. There is no cloud dependency for the core value (the community's recordings and the learner's progress).

---

## Risks Specific to Voice Mode

| Risk | Severity | Mitigation |
|------|----------|------------|
| Nova Sonic attempts to pronounce SENĆOŦEN words in English accent | High | System prompt: "NEVER say SENĆOŦEN words. ALWAYS use play_word_audio." Test extensively. If it still does it, add a post-processing filter on text output. |
| Content filter triggers on SENĆOŦEN phonetic descriptions | Medium | Same workaround as TAi: 5 silence chunks + ready gate + retry. Keep system prompt clean. |
| Audio quality of pre-recorded files too low for meaningful comparison | Medium | Source from NRC ReadAlong (known quality). Test before jam. |
| ffmpeg not available on server | Low | Already in TAi's Docker image. For voice server (non-containerized), ensure installed on EC2. |
| Nova Sonic hallucinates SENĆOŦEN grammar explanations | High | System prompt hard rule + test. If unreliable, strip any response containing SENĆOŦEN orthographic characters that isn't in the wordbank. |
| Learner asks "am I saying it right?" and Nova Sonic answers | High | System prompt: explicit refusal template. Test this exact case. |
| 8 minutes feels too short | Low | By design. Practice should be short and daily, not marathon. |
| W̱SÁNEĆ community objects to voice agent using their recordings | High | Same as text mode: immediate shutdown. Voice demo uses same revocable architecture. |

---

## Minimum Viable Voice Demo (3-Day Jam Scope)

If time is tight, the absolute minimum voice demo is:

1. Learner clicks link → browser opens → Nova Sonic greets in English
2. Nova Sonic calls `play_word_audio` → learner hears one SENĆOŦEN word
3. Nova Sonic says "Can you try saying that?"
4. Learner speaks → Nova Sonic responds encouragingly (without judging)
5. Nova Sonic plays the audio again for comparison
6. Session ends after 2-3 words

That's ~15 lines of new tool handler code + the system prompt + the frontend page. The rest is TAi's existing infrastructure.

**Build order:**
1. `audio-player.ts` — the ffmpeg→Socket.IO pipeline (2h)
2. `tools.ts` — tool definitions (30min)
3. `practice-session.ts` — simplified SessionManager (3h)
4. System prompt — copy from this doc, test (1h)
5. `practice.html` — minimal browser UI (2h)
6. Server route — add `/practice/:token` (30min)
7. MCP tool — `start_practice_session` in `ipc-mcp-stdio.ts` (1h)
8. Integration test — end-to-end with real audio files (2h)

**Total: ~12 hours** of focused work. Fits in Day 2 of a 3-day jam if Day 1 handles the text bot.

---

## Future Extension: Meta Omnilingual ASR

If post-jam with community partnership, the pronunciation feedback gap could be partially filled:

- **Meta Omnilingual ASR** (Apache-2.0, released Nov 2025, 1600+ languages)
- In-context learning: provide 5-10 paired audio/transcript examples → model adapts
- Self-hostable (300M smallest variant)
- Would run alongside Nova Sonic: learner speaks → Omnilingual transcribes → compare to expected

**But:** Even with Omnilingual, the question "is this pronunciation acceptable?" remains a community authority decision, not a model output. The ASR could provide a phoneme-level diff; a community speaker interprets whether that diff matters.

This is a **post-partnership feature**, not a demo feature.
