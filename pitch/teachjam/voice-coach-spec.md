# SENĆOŦEN Voice Coach — Three-Engine Spec

**Created:** 2026-05-21
**Status:** Spec (no demo required)
**Builds on:** `pitch/sencoten-companion-full-design.md`, `pitch/voice-agent-design.md`
**Replaces:** The "Nova Sonic plays pre-recorded audio" design with a full adaptive voice coach

---

## Vision

A bilingual voice coach that can speak unlimited SENĆOŦEN (via EveryVoice TTS), can hear and understand learner pronunciation attempts (via NRC Whisper ASR), and guides through adaptive, personalized drills — all in a single real-time voice session powered by Deepgram Voice Agent.

This is not a flashcard player. It is a **pronunciation coaching engine** with a natural English conversation interface.

---

## Three Engines

| Engine | Role | Source |
|--------|------|--------|
| **EveryVoice TTS** | Text → SENĆOŦEN speech (any word from 30K dictionary) | NRC Canada, fine-tuned on single fluent speaker ~4h (Pine et al. 2022b) |
| **Fine-tuned Whisper-large-v2** (pronunciation evaluator) | SENĆOŦEN speech → character-level transcription → Levenshtein alignment vs target | Geng et al. 2025, requires NRC authorization for fine-tuned weights |
| **Deepgram Voice Agent** | Real-time English conversation + function orchestration | Haiku 4.5 (BYO LLM via Bedrock) + Nova-3 STT + Aura-2 TTS |

### Pronunciation Evaluation: The Geng et al. 2025 Pipeline

We use the **exact ASR pipeline from the ComputEL paper** (Sys. 17 in Table 3) as our pronunciation evaluator. This is not a generic similarity metric — it transcribes what the learner said in SENĆOŦEN orthography, then we align against the expected word to produce character-level feedback.

```
Pipeline (from paper, best system):

  1. Base model: Whisper-large-v2 (multilingual, encoder-decoder)
  2. Fine-tuning data:
     - 1.7h real SENĆOŦEN recordings (single speaker, parallel audio+text)
     - 8h EveryVoice TTS-synthesized audio (from 27K Montler dictionary sentences)
  3. Decoding: shallow fusion with large-4g KenLM (14K word vocabulary)
  4. Output: character-level SENĆOŦEN transcription

  Performance (on fluent speaker test set):
    CER 5.09% raw → 3.45% after cedilla filtering
    WER 19.34% raw → 14.32% after cedilla filtering
    WER on unseen words: 44.96% → 26.48% after cedilla filtering
    OOV rate in test set: 57.02% (shows model generalizes beyond training vocab)
```

**Why this works for pronunciation feedback:**

The pipeline transcribes what the learner actually said as SENĆOŦEN text. We then run Levenshtein alignment against the expected target word. This gives us:
- WHICH specific characters differ (e.g., "Ŧ" expected but heard "T")
- WHERE in the word the difference is (position index)
- Phoneme-level hints mapped from our PHONEME_HINTS table

This is fundamentally more useful than acoustic similarity ("sounds close / sounds different") because the agent can say: "I noticed a difference at the Ŧ sound — that's the lateral T, where air passes along the sides of your tongue."

**Cedilla tolerance:** The paper shows cedilla (¸) errors are the most common and "relatively easily correctable by a SENĆOŦEN speaker." Our pipeline filters these by default and reports them separately — they indicate glottalization distinctions that even fluent speakers vary on.

**L2 learner caveat:** The paper's test set uses fluent speaker recordings. Learner speech will have higher error rates. We mitigate this by:
1. Framing ALL feedback as "what I heard" (never "you said it wrong")
2. Confidence thresholding: if Whisper's per-token confidence is low, fall back to "I couldn't quite catch that — let me play it again"
3. Known limitation disclosed to learner: "I'm not perfect at hearing — a community speaker is the real authority"

### What Each Engine Cannot Do

| Engine | Limitation |
|--------|-----------|
| EveryVoice TTS | Trained on ONE speaker — cannot represent dialectal variation |
| Fine-tuned Whisper | Trained on fluent speech — accuracy degrades on L2 learner attempts; cedilla errors common |
| Deepgram Nova-3 | Cannot transcribe SENĆOŦEN — only English |
| Deepgram Aura-2 | Cannot speak SENĆOŦEN — only English |
| Haiku 4.5 | Cannot judge pronunciation correctness — only interprets ASR output |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (practice.html)                       │
│                                                                     │
│  [Audio Track 1: Deepgram Agent — English voice (Aura-2)]           │
│  [Audio Track 2: SENĆOŦEN audio (community recordings / TTS)]      │
│  [Mic capture → 16kHz PCM → Socket.IO → server]                    │
│  [Visual: word card, phonetic hint, waveform]                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Socket.IO (binary audio + JSON events)
┌───────────────────────────────┴─────────────────────────────────────┐
│                     Voice Relay Server (EC2)                          │
│                                                                      │
│  ┌────────────────┐    ┌──────────────────┐    ┌─────────────────┐  │
│  │ Deepgram WS    │    │ Audio Ring Buffer │    │ EveryVoice TTS  │  │
│  │ agent.deepgram │    │ (last 10s of     │    │ (GPU inference) │  │
│  │ .com/v1/agent  │    │  learner mic)    │    │ localhost:8765   │  │
│  │ /converse      │    │                  │    │                 │  │
│  │                │    │ Used by Whisper   │    │ Any SENĆOŦEN    │  │
│  │ BYO LLM:      │    │ when evaluate_    │    │ text → audio    │  │
│  │ Bedrock Haiku  │    │ pronunciation    │    │ (speed control) │  │
│  │                │    │ is called        │    │                 │  │
│  └───────┬────────┘    └────────┬─────────┘    └────────┬────────┘  │
│          │                      │                       │           │
│  ┌───────┴──────────────────────┴───────────────────────┴────────┐  │
│  │                    Function Handler                             │  │
│  │                                                                │  │
│  │  play_word_audio      → recording or TTS → Socket.IO Track 2  │  │
│  │                         + pause mic relay during playback      │  │
│  │  generate_and_play    → EveryVoice → Socket.IO Track 2        │  │
│  │  evaluate_pronunciation → ring buffer → Whisper → alignment   │  │
│  │  check_learner_progress → LANGUAGE.md → session plan          │  │
│  │  record_practice_attempt → update SRS state                   │  │
│  │  start_shadowing_drill → UpdateThink (mode switch)            │  │
│  │  end_session          → write results, send WhatsApp summary  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Fine-tuned Whisper-large-v2 (GPU: g4dn.xlarge)              │   │
│  │  localhost:8766                                               │   │
│  │                                                               │   │
│  │  Base: openai/whisper-large-v2 (multilingual)                 │   │
│  │  Fine-tuned on: 1.7h real + 8h TTS-augmented SENĆOŦEN        │   │
│  │  Decoding: + large-4g KenLM (14K vocab, shallow fusion)       │   │
│  │                                                               │   │
│  │  Input: learner audio (16kHz WAV from ring buffer)            │   │
│  │  Output: SENĆOŦEN character transcription + confidence        │   │
│  │  → Levenshtein alignment vs expected → char-level diffs       │   │
│  │                                                               │   │
│  │  Performance (fluent speech): CER 3.45%, WER 14.32%           │   │
│  │  (after cedilla filtering)                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Dual Audio Channel Design

Deepgram's audio output is TTS-only (English). SENĆOŦEN audio must be delivered through a separate channel:

```
Browser receives TWO audio streams via Socket.IO:

  socket.on('agent_audio', chunk)    → Track 1 (English voice)
  socket.on('sencoten_audio', data)  → Track 2 (SENĆOŦEN, slightly louder)
```

Both play through the same speakers. The learner perceives a single, natural bilingual experience — an English-speaking coach who "plays" SENĆOŦEN words at the right moments.

### Echo Prevention: Mic Relay Gating

**Problem:** If SENĆOŦEN audio plays through browser speakers while the mic is relaying to Deepgram, Deepgram's VAD will hear the playback echo, interpret it as user speech, and trigger a spurious agent turn.

**Solution:** Exploit the natural timing of Deepgram's function call protocol. When `play_word_audio` is called, Deepgram is waiting for `FunctionCallResponse` — it cannot generate new agent speech during this window. We pause mic relay during playback:

```
Timeline:

t0: Agent says "try saying this word"          → Aura-2 → browser
t1: Agent calls play_word_audio                → FunctionCallRequest arrives
    ├── Deepgram is BLOCKED waiting for FunctionCallResponse
    ├── Cannot generate new speech or process user turns
    └── Natural "pause" in the conversation

t2: Server receives request → PAUSES mic relay to Deepgram
t3: Server emits SENĆOŦEN audio → browser Track 2 (1-2 seconds)
t4: Playback completes
t5: Wait 200ms (echo decay in room)
t6: Server RESUMES mic relay to Deepgram
t7: Server sends FunctionCallResponse → Deepgram unblocks

t8: Agent speaks next line: "your turn, try it"
t9: Learner speaks → mic → only learner's voice → Deepgram (clean)
```

**Key insight:** This is NOT a workaround — it uses the function call protocol's built-in blocking semantics. Deepgram cannot trigger on echo audio because it literally cannot process user speech while awaiting a function response.

```typescript
private relayingAudioToDeepgram = true;

async handlePlayWordAudio(args: { word_id: string; speed?: number }) {
  // 1. Pause mic relay to Deepgram (prevents echo)
  this.relayingAudioToDeepgram = false;

  // 2. Play SENĆOŦEN audio to browser
  const pcm = await this.resolveAndConvertAudio(args.word_id, args.speed);
  this.emitSencotenAudio(pcm);

  // 3. Wait for playback duration + echo decay
  const durationMs = (pcm.length / (24000 * 2)) * 1000;
  await sleep(durationMs + 200);

  // 4. Resume mic relay
  this.relayingAudioToDeepgram = true;

  // 5. Send FunctionCallResponse (Deepgram unblocks, agent can speak)
  return JSON.stringify({ status: "played", ... });
}

// In the audio relay path:
onBrowserAudio(chunk: Buffer) {
  // ALWAYS capture in ring buffer (for pronunciation evaluation later)
  this.audioRingBuffer.push(chunk);

  // Only forward to Deepgram when relay is active
  if (this.relayingAudioToDeepgram) {
    this.deepgramWs.send(chunk);
  }
}
```

**Ring buffer is unaffected:** It captures ALL mic audio regardless of relay state. When `evaluate_pronunciation` is called later, it has the learner's full attempt available.

---

## Deepgram Voice Agent Configuration

### Initial Settings

```json
{
  "type": "Settings",
  "audio": {
    "input": { "encoding": "linear16", "sample_rate": 16000 },
    "output": { "encoding": "linear16", "sample_rate": 24000, "container": "none" }
  },
  "agent": {
    "language": "en",
    "greeting": "hey! ready for some SENĆOŦEN practice today?",
    "listen": {
      "provider": {
        "type": "deepgram",
        "model": "nova-3",
        "keyterms": [
          "SENĆOŦEN", "sencoten", "lateral", "glottalized", "ejective",
          "uvular", "FirstVoices", "check my pronunciation",
          "play it again", "slower", "faster", "new word", "review",
          "drill", "practice", "shadowing", "how do I say"
        ],
        "eot_threshold": 0.9,
        "eot_timeout_ms": 4000
      }
    },
    "think": {
      "provider": {
        "type": "aws_bedrock",
        "model": "anthropic.claude-haiku-4-5-20251001-v1:0",
        "temperature": 0.7,
        "credentials": {
          "type": "sts",
          "region": "us-west-2",
          "access_key_id": "<from instance role>",
          "secret_access_key": "<from instance role>",
          "session_token": "<from instance role>"
        }
      },
      "prompt": "<see System Prompts section>",
      "functions": "<see Function Definitions section>"
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "model": "aura-2-thalia-en"
      }
    },
    "context": {
      "messages": "<pre-loaded from LANGUAGE.md — see Context Injection>"
    }
  },
  "flags": { "history": true }
}
```

### Why `eot_timeout_ms: 4000`

Learners pause before attempting SENĆOŦEN words. Default (1500ms) would cut them off. 4 seconds gives time to:
- Process the word mentally
- Form the articulatory gesture
- Begin speaking

The tradeoff: English conversation feels slightly less snappy. Acceptable for a language practice context.

---

## System Prompts

### Practice Mode (Default)

```
You are a SENĆOŦEN language practice partner. You speak English and help learners
practice SENĆOŦEN words and phrases through guided listening and repetition exercises.

## THIS IS A VOICE INTERFACE

Everything you generate is spoken aloud. Only generate words you are speaking.
No formatting, no markdown, no asterisks, no meta-commentary.

## CRITICAL RULES

1. NEVER say SENĆOŦEN words yourself. ALWAYS use play_word_audio or generate_and_play.
   WRONG: "The word is ṮELÁṈE, which means thank you"
   RIGHT: [call play_word_audio] "That means 'thank you'. Can you try saying it?"

2. NEVER score or grade pronunciation with numbers. You CAN:
   - Call evaluate_pronunciation to get ASR feedback
   - Describe differences naturally: "the first sound was a bit different"
   - Offer to replay audio for self-comparison
   - Note confidence level (hesitant vs confident)

3. ONE short sentence per turn. This is spoken conversation.

4. After the learner attempts a word, call evaluate_pronunciation. Use the result
   to guide your next response — but NEVER read the scores aloud.

5. When playing audio, PAUSE after it plays. Give them time to listen.
   Don't immediately talk over the audio.

6. If asked about meaning, culture, ceremony, or grammar not in your context:
   "I don't have that context. The W̱SÁNEĆ Language Authority would be the
   right people to ask about that."

## SESSION FLOW

1. Start by checking their progress (call check_learner_progress)
2. Greet casually: "hey! ready for some practice?"
3. Warm up with a mastered word (recall): "do you remember how to say 'good'?"
4. Introduce or reinforce 2-3 words from their learning queue
5. For each word: play audio → invite attempt → evaluate → feedback → replay if needed
6. If learner wants focused drill: call start_shadowing_drill
7. Wind down naturally after 5-8 minutes

## PHONETIC GUIDANCE

You can describe SENĆOŦEN sounds in English approximation:
- Ṯ (T-underline): like "th" in "think" but further back, retroflex
- Ŧ (T-bar): a "tl" sound, tongue at the side, lateral release
- Ć: like "ch" in "church"
- X̱: raspy sound from back of throat, like gentle throat-clearing
- ṈE (N-underline + E): nasal, like "ng" at start of syllable
- Glottal stops (accent marks): brief catch, like "uh-oh" between syllables

Always follow descriptions with: "but the best way is to listen again" and replay.

## EVALUATE_PRONUNCIATION RESULTS — HOW TO RESPOND

The system transcribes your attempt in SENĆOŦEN orthography, then aligns it
against the expected word. You receive character-level diffs with phonetic hints.

When you receive evaluation results:
- CER = 0 (perfect match): "that sounded great! here's the reference one more time for fun"
- CER < 0.2 + high confidence: mention ONE specific diff naturally using the phonetic_hint
  Example: "I noticed the Ŧ sound — that's the lateral T, tongue at the side. Want to hear it again?"
- CER < 0.5 or medium confidence: "I heard some differences — let me play it again at half speed"
- CER > 0.5 or low confidence: "I couldn't quite catch that — here it is again, take your time"
- cedilla_note present + no other diffs: "that was really close! the only difference was
  a glottalization mark — those are subtle, even fluent speakers vary on them"

NEVER say: "you scored X%" or "that was wrong" or "incorrect"
NEVER read the raw transcript aloud (it may contain ASR errors)
ALWAYS say: "I noticed..." or "the [sound] might be..." or "want to hear it again?"
REMEMBER: the ASR was trained on fluent speech, not learner speech — if confidence
is low, it's more likely an ASR limitation than a learner error. Default to replaying.

## ABOUT THIS SYSTEM (say if asked)

"This is a proof-of-concept practice tool built by students at Northeastern University
for the Indigenomics Tech Jam. I use synthesized audio based on a community speaker's
recordings, and a speech recognition model developed by NRC Canada. I can't perfectly
judge your pronunciation — a community speaker is the real authority. The language
belongs to the W̱SÁNEĆ people. For real learning, contact the W̱SÁNEĆ Language Authority
or visit firstvoices.com/sencoten."

## LEARNER CONTEXT

{language_md_summary}
{session_words}
```

### Shadowing Drill Mode (via UpdateThink)

```
You are running a structured SENĆOŦEN pronunciation drill. Follow this exact pattern:

## LOOP (repeat for each word)

1. Call play_word_audio with the next word from your list
2. Say ONLY: "your turn" — then STOP generating. Wait for the learner.
3. After the learner speaks, call evaluate_pronunciation
4. Based on result:
   - CER = 0 or cedilla-only: "nice!" → move to next word
   - CER < 0.3 + has diffs with phonetic_hint: describe ONE diff using hint, replay, then next word
   - CER > 0.3 or low confidence: "let me play that again" → call play_word_audio at speed 0.7 → "try once more"
5. Maximum 2 retries per word, then move on with encouragement

## AFTER ALL WORDS

Say: "good work! we practiced [N] words today"
Call end_drill with a brief summary

## RULES

- ONE sentence per turn maximum
- NEVER pronounce SENĆOŦEN yourself
- NEVER say scores or percentages
- Keep energy up: "nice", "good", "getting closer", "that's it"
- If learner says "stop" or "enough" at any time: immediately end drill
- If learner sounds frustrated (short sighs, "I can't"): slow down, replay at 0.5x, be warm

## WORDS FOR THIS DRILL

{drill_word_list}
```

---

## Function Definitions

```typescript
const PRACTICE_FUNCTIONS = [
  {
    name: "play_word_audio",
    description: "Play a SENĆOŦEN word/phrase audio to the learner on the dedicated SENĆOŦEN audio channel. The learner hears it clearly alongside your English voice. ALWAYS use this instead of pronouncing SENĆOŦEN yourself.\n\nWHEN TO CALL:\n- Introducing a new word\n- Replaying for comparison after a learner attempt\n- During shadowing drill\n- When learner says 'play it again'\n\nNEVER say SENĆOŦEN words in your speech. ONLY play them via this function.",
    parameters: {
      type: "object",
      properties: {
        word_id: { type: "string", description: "Word ID from wordbank (e.g., 'sen-001')" },
        speed: { type: "number", description: "Playback speed 0.5-1.5. Use 0.7 for slow replay, 1.0 normal, 1.2 for challenge. Default 1.0" },
        context: { type: "string", enum: ["introduce", "replay", "compare", "shadowing"], description: "Why playing — affects what you say after" }
      },
      required: ["word_id"]
    }
  },
  {
    name: "generate_and_play",
    description: "Generate audio for arbitrary SENĆOŦEN text using TTS synthesis, then play it. Use for words NOT in the pre-cached wordbank, combining known words into phrases, or demonstrating sentence context.\n\nNOTE: This uses a synthesized voice (not a community recording). Always disclose: 'this is a synthesized version'.",
    parameters: {
      type: "object",
      properties: {
        sencoten_text: { type: "string", description: "SENĆOŦEN text to synthesize and play" },
        speed: { type: "number", description: "Speed 0.5-1.5, default 1.0" }
      },
      required: ["sencoten_text"]
    }
  },
  {
    name: "evaluate_pronunciation",
    description: "Transcribe the learner's most recent audio attempt using fine-tuned Whisper ASR, then align the transcription against the expected word to find character-level differences.\n\nRETURNS:\n- transcript: what Whisper heard (SENĆOŦEN orthography)\n- cer: character error rate (0.0 = perfect match)\n- diffs: array of character-level differences with positions and phonetic hints\n- confidence: Whisper's decoding confidence (low = unreliable transcription)\n- cedilla_note: if differences are only cedilla marks (minor, ignore)\n\nHOW TO RESPOND based on CER:\n- CER = 0: 'that sounded great!'\n- CER < 0.2 + high confidence: mention ONE specific character difference naturally\n- CER < 0.5 + medium confidence: 'I noticed some differences — let me play it again slower'\n- CER > 0.5 OR low confidence: 'I couldn't quite catch that — here it is again, take your time'\n\nIMPORTANT:\n- NEVER speak the raw CER number to the learner\n- When mentioning a difference, use the phonetic_hint from the diff (e.g., 'the Ŧ is a lateral T')\n- Frame as 'what I heard' not 'what you got wrong' — ASR makes mistakes too\n- Offer to replay at slower speed as the primary teaching move\n- If only cedilla differences: treat as correct ('those glottalization marks are subtle')",
    parameters: {
      type: "object",
      properties: {
        word_id: { type: "string", description: "Word ID — used to look up expected SENĆOŦEN text for alignment" }
      },
      required: ["word_id"]
    }
  },
  {
    name: "check_learner_progress",
    description: "Read the learner's LANGUAGE.md to get their current state: SRS due words, mastered count, confusion pairs, streak, and recommended session plan.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", enum: ["due_today", "mastered", "learning", "confused", "stats", "session_plan"], description: "What aspect of progress to retrieve" }
      },
      required: ["query"]
    }
  },
  {
    name: "record_practice_attempt",
    description: "Update the learner's LANGUAGE.md with a practice attempt result. Adjusts SRS box position (correct → promote, incorrect → demote to box 1).",
    parameters: {
      type: "object",
      properties: {
        word_id: { type: "string", description: "Which word was practiced" },
        success: { type: "boolean", description: "true if similarity > 0.7 or learner expressed satisfaction with their attempt" },
        confidence_observed: { type: "string", enum: ["hesitant", "moderate", "confident"], description: "Prosodic observation — NOT accuracy" },
        notes: { type: "string", description: "Brief note (e.g., 'asked to replay 3 times', 'sounded more confident than last time')" }
      },
      required: ["word_id", "success"]
    }
  },
  {
    name: "start_shadowing_drill",
    description: "Switch to structured pronunciation drill mode. This triggers an UpdateThink that changes the system prompt to a strict drill loop and reduces available functions.\n\nWHEN TO CALL:\n- Learner explicitly asks: 'drill', 'practice pronunciation', 'shadowing'\n- You detect 3+ words with low confidence and suggest it\n- ALWAYS confirm with learner before calling\n\nCORRECT PATTERN:\n1. 'want to do a quick pronunciation drill on these words?'\n2. Wait for learner confirmation\n3. Call this function\n\nWRONG: Calling without asking first",
    parameters: {
      type: "object",
      properties: {
        word_ids: {
          type: "array",
          items: { type: "string" },
          description: "3-5 word IDs to drill"
        },
        mode: { type: "string", enum: ["listen_repeat", "recall", "minimal_pairs"], description: "listen_repeat: play then repeat. recall: ask without playing first. minimal_pairs: contrast similar-sounding words" }
      },
      required: ["word_ids"]
    }
  },
  {
    name: "end_session",
    description: "End the voice practice session. Writes final results to LANGUAGE.md, sends a WhatsApp summary, and closes the connection.\n\nWHEN TO CALL:\n- Learner says 'bye', 'done', 'that's enough'\n- Session timer approaching 8 minutes\n- Natural conclusion after covering planned words\n\nSay a brief closing BEFORE calling: 'great practice today! you worked on [words]. see you next time!'",
    parameters: {
      type: "object",
      properties: {
        summary_note: { type: "string", description: "Brief summary for WhatsApp message and LANGUAGE.md log" }
      },
      required: ["summary_note"]
    }
  }
];
```

---

## Function Handler Implementations

### `play_word_audio`

```typescript
async handlePlayWordAudio(args: { word_id: string; speed?: number; context?: string }): Promise<string> {
  const { word_id, speed = 1.0, context = 'introduce' } = args;
  const entry = this.wordbank.entries.find(e => e.id === word_id);
  if (!entry) return JSON.stringify({ error: `Word ${word_id} not found in wordbank` });

  let audioPath: string;
  const recordingPath = `wordbank/audio/${word_id}.mp3`;
  const cachePath = `cache/tts/${word_id}_${speed.toFixed(1)}.wav`;

  if (fs.existsSync(recordingPath)) {
    audioPath = recordingPath;
  } else if (fs.existsSync(cachePath)) {
    audioPath = cachePath;
  } else {
    audioPath = await this.everyvoiceSynthesize(entry.sencoten, speed);
    await fs.copyFile(audioPath, cachePath); // cache for next time
  }

  const pcm = await this.ffmpegConvert(audioPath, 24000, speed);
  const durationSec = (pcm.length / (24000 * 2)).toFixed(1);

  // Emit to browser on SENĆOŦEN channel
  this.emitSencotenAudio(pcm, {
    word: entry.sencoten,
    english: entry.english,
    word_id: word_id
  });

  const source = fs.existsSync(recordingPath) ? "community recording" : "synthesized (EveryVoice)";
  return JSON.stringify({
    status: "played",
    word: entry.sencoten,
    english: entry.english,
    duration_sec: parseFloat(durationSec),
    source,
    message: `Audio played: "${entry.sencoten}" (${entry.english}). Duration: ${durationSec}s. Source: ${source}.`
  });
}
```

### `generate_and_play`

```typescript
async handleGenerateAndPlay(args: { sencoten_text: string; speed?: number }): Promise<string> {
  const { sencoten_text, speed = 1.0 } = args;

  // Validate: only allow text that uses SENĆOŦEN orthographic characters
  if (!this.isValidSencotenText(sencoten_text)) {
    return JSON.stringify({ error: "Text contains non-SENĆOŦEN characters. Only synthesize known SENĆOŦEN text." });
  }

  const audioPath = await this.everyvoiceSynthesize(sencoten_text, speed);
  const pcm = await this.ffmpegConvert(audioPath, 24000);
  const durationSec = (pcm.length / (24000 * 2)).toFixed(1);

  this.emitSencotenAudio(pcm, {
    word: sencoten_text,
    english: "(synthesized phrase)",
    word_id: null
  });

  // Cleanup temp file
  await fs.unlink(audioPath);

  return JSON.stringify({
    status: "played",
    text: sencoten_text,
    duration_sec: parseFloat(durationSec),
    source: "synthesized (EveryVoice)",
    message: `Synthesized and played: "${sencoten_text}". Duration: ${durationSec}s. This is a synthesized voice, not a community recording.`
  });
}
```

### `evaluate_pronunciation`

```typescript
async handleEvaluatePronunciation(args: { word_id: string }): Promise<string> {
  const { word_id } = args;
  const entry = this.wordbank.entries.find(e => e.id === word_id);
  if (!entry) return JSON.stringify({ status: "error", message: "Word not found" });

  // Get learner's recent audio from ring buffer (last 5 seconds)
  const learnerAudio = this.audioRingBuffer.getLastMs(5000);

  if (learnerAudio.length < 4800) { // < 0.1s at 16kHz
    return JSON.stringify({
      status: "no_audio",
      message: "No audio captured. The learner may not have spoken yet. Ask them to try."
    });
  }

  // Save to temp WAV for Whisper inference
  const learnerPath = `/tmp/attempt_${Date.now()}.wav`;
  await this.saveAsWav(learnerAudio, learnerPath, 16000);

  // === Fine-tuned Whisper-large-v2 transcription ===
  // Model: Whisper-large-v2 fine-tuned on 1.7h real + 8h TTS-augmented SENĆOŦEN
  // Decoding: shallow fusion with large-4g KenLM (14K vocabulary)
  // Paper reference: Geng et al. 2025, Sys. 17 in Table 3
  const whisperResult = await this.whisperTranscribe(learnerPath);
  // whisperResult = { transcript: "TELÁṈE", confidence: 0.72 }

  // Privacy: delete temp file immediately
  await fs.unlink(learnerPath);

  // If confidence too low, don't trust the transcription
  if (whisperResult.confidence < 0.3) {
    return JSON.stringify({
      status: "low_confidence",
      word: entry.sencoten,
      message: "Could not reliably transcribe the attempt. Ask learner to try again or replay audio."
    });
  }

  // === Levenshtein alignment with cedilla tolerance ===
  const alignment = evaluateWithCedillaTolerance(entry.sencoten, whisperResult.transcript);

  // Build response for the Deepgram agent
  let suggestion: string;
  if (alignment.tolerant_cer === 0) {
    suggestion = "Perfect match (after cedilla tolerance). Praise and move on!";
  } else if (alignment.tolerant_cer < 0.2 && whisperResult.confidence > 0.6) {
    const firstDiff = alignment.diffs[0];
    const hint = firstDiff ? PHONEME_HINTS[firstDiff.expected] : null;
    suggestion = hint
      ? `Specific difference detected: expected "${firstDiff.expected}" but heard "${firstDiff.got}". Hint: ${hint}. Mention this naturally.`
      : `Small difference at position ${firstDiff?.position}. Offer to replay.`;
  } else if (alignment.tolerant_cer < 0.5) {
    suggestion = "Several differences. Play audio again at slower speed. Don't enumerate all errors.";
  } else {
    suggestion = "Quite different from expected. Replay, encourage, no blame. May be an ASR error.";
  }

  return JSON.stringify({
    status: "evaluated",
    word: entry.sencoten,
    heard: whisperResult.transcript,
    confidence: whisperResult.confidence,
    strict_cer: alignment.strict_cer,
    tolerant_cer: alignment.tolerant_cer,
    diffs: alignment.diffs.map(d => ({
      ...d, phonetic_hint: PHONEME_HINTS[d.expected] || null
    })),
    cedilla_note: alignment.cedilla_note,
    suggestion,
  });
}
```

### Fine-tuned Whisper ASR Service

```typescript
// Self-hosted on GPU (g4dn.xlarge, shared with EveryVoice TTS)
// Model: openai/whisper-large-v2, fine-tuned via HuggingFace
// Training data: 1.7h real recordings + 8h EveryVoice TTS synthesis
// Language model: large-4g KenLM (14K words from Montler dictionary)
// Reference: Geng et al. 2025, ComputEL-8 (best system: Sys. 17, Table 3)
//
// Performance on fluent speaker test set (57% OOV rate):
//   CER 5.09% → 3.45% (cedilla filtered)
//   WER 19.34% → 14.32% (cedilla filtered)
//   WER on unseen words: 44.96% → 26.48% (cedilla filtered)

async whisperTranscribe(audioPath: string): Promise<{ transcript: string; confidence: number }> {
  const formData = new FormData();
  formData.append('audio', fs.createReadStream(audioPath));
  formData.append('language', 'sencoten');

  const response = await fetch('http://localhost:8766/transcribe', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  // result = { transcript: "TELÁṈE", confidence: 0.72, segments: [...] }
  return { transcript: result.transcript, confidence: result.confidence };
}
```

### `start_shadowing_drill`

```typescript
async handleStartShadowingDrill(args: { word_ids: string[]; mode: string }): Promise<string> {
  const { word_ids, mode } = args;

  // Prepare drill word list for the new prompt
  const drillWords = word_ids.map(id => {
    const entry = this.wordbank.entries.find(e => e.id === id);
    return entry ? `- ${id}: "${entry.sencoten}" = ${entry.english}` : null;
  }).filter(Boolean).join('\n');

  // Mode switch via UpdateThink (same WebSocket, no reconnect)
  const drillPrompt = this.buildDrillPrompt(drillWords, mode);

  this.send({
    type: 'UpdateThink',
    think: {
      provider: this.buildBedrockProvider(),
      prompt: drillPrompt,
      functions: DRILL_FUNCTIONS, // Subset: play_word_audio, evaluate_pronunciation, record_practice_attempt, end_drill
    }
  });
  await this.waitForEvent('ThinkUpdated');

  // Optional: switch to slightly more structured voice
  this.send({ type: 'UpdateSpeak', speak: { provider: { type: 'deepgram', model: 'aura-2-mars-en' } } });
  await this.waitForEvent('SpeakUpdated');

  // Announce transition
  this.send({
    type: 'InjectAgentMessage',
    message: `alright, drill time! I'll play each word and you repeat. here's the first one.`,
    behavior: 'queue'
  });

  this.session.mode = 'drill';
  return JSON.stringify({ status: "drill_started", mode, word_count: word_ids.length });
}
```

---

## Audio Ring Buffer

Captures the learner's raw mic audio for ASR evaluation. Critical because Deepgram's Nova-3 cannot transcribe SENĆOŦEN — we need the raw PCM to send to NRC Whisper.

```typescript
class AudioRingBuffer {
  private chunks: { data: Buffer; timestamp: number }[] = [];
  private maxDurationMs = 10000;

  push(chunk: Buffer): void {
    this.chunks.push({ data: chunk, timestamp: Date.now() });
    this.trim();
  }

  private trim(): void {
    const cutoff = Date.now() - this.maxDurationMs;
    while (this.chunks.length > 0 && this.chunks[0].timestamp < cutoff) {
      this.chunks.shift();
    }
  }

  getLastMs(ms: number): Buffer {
    const cutoff = Date.now() - ms;
    const relevant = this.chunks.filter(c => c.timestamp >= cutoff);
    if (relevant.length === 0) return Buffer.alloc(0);
    return Buffer.concat(relevant.map(c => c.data));
  }

  clear(): void {
    this.chunks = [];
  }
}
```

The relay server stores mic audio in this buffer while ALSO forwarding it to Deepgram (for English detection). When `evaluate_pronunciation` is called, it extracts the relevant window.

---

## Context Injection (Session Start)

When learner opens the voice link, server builds `context.messages` from their state:

```json
{
  "context": {
    "messages": [
      {
        "type": "History",
        "function_calls": [{
          "id": "ctx_progress",
          "name": "check_learner_progress",
          "client_side": true,
          "arguments": "{\"query\": \"session_plan\"}",
          "response": "Mastered: 8 words. Learning: 5 words. Streak: 4 days. Due for review: ĆEN, TŦE, SȾÁSEN. Confusion pair: SȾÁSEN/ĆÁȾEN (3x confused). Suggested new word: ṮELÁṈE (difficulty 2, category greetings)."
        }]
      },
      {
        "type": "History",
        "function_calls": [{
          "id": "ctx_words",
          "name": "check_learner_progress",
          "client_side": true,
          "arguments": "{\"query\": \"confused\"}",
          "response": "Active confusion pairs:\n- SȾÁSEN / ĆÁȾEN: confused 3 times, not yet resolved. The Ⱦ vs Ć distinction is the issue."
        }]
      }
    ]
  }
}
```

---

## Session Flow (Complete)

```
1. Learner sends "voice practice" on WhatsApp
2. Agent generates token + practice link → sends to learner
3. Learner opens link in browser → mic permission → Socket.IO connects
4. Server validates token, reads LANGUAGE.md, builds context
5. Server opens Deepgram WebSocket with Settings (Haiku + functions + context)
6. Server starts relaying: browser mic → Deepgram + ring buffer

7. Deepgram agent greets (English): "hey! ready for some practice?"
   → Aura-2 TTS → Track 1 → browser speakers

8. Agent calls check_learner_progress → gets session plan
9. Agent calls play_word_audio("sen-003", context: "introduce")
   → Server resolves audio (recording or TTS)
   → PCM emitted to browser Track 2
   → Learner hears SENĆOŦEN word
   → Function returns text description to agent

10. Agent says: "that means 'water'. can you try saying it?"
    → Aura-2 TTS → Track 1

11. Learner speaks (attempting SENĆOŦEN word)
    → Raw PCM → ring buffer (AND → Deepgram Nova-3 for turn detection)
    → Nova-3 detects end-of-turn (may transcribe garbage — ignored)
    → Deepgram triggers LLM turn

12. Agent calls evaluate_pronunciation("TŦE")
    → Server extracts last 5s from ring buffer
    → Sends to NRC Whisper → gets "TE" (CER = 0.33, diff: Ŧ→nothing)
    → Returns alignment result to agent

13. Agent responds naturally: "I noticed the 'Ŧ' sound might need the tongue
    at the side — it's like starting a T but letting air pass sideways.
    want me to play it again?"
    → Aura-2 TTS → Track 1

14. Learner: "yes please, slower"
15. Agent calls play_word_audio("sen-003", speed: 0.7, context: "replay")
    → 0.7x speed audio → Track 2

16. [Loop continues for 5-8 minutes]

17. Timer at 7 min → UpdatePrompt: "## WRAP UP. One more word then end naturally."
18. Agent says goodbye, calls end_session
19. Server writes LANGUAGE.md updates, sends WhatsApp summary, closes WebSocket
```

---

## Pronunciation Evaluation Pipeline

### Levenshtein Alignment with Phoneme Hints

```typescript
interface Diff {
  position: number;
  expected: string;
  got: string;
  type: 'substitution' | 'insertion' | 'deletion';
  phonetic_hint: string | null;
}

const PHONEME_HINTS: Record<string, string> = {
  'Ṯ': 'Retroflex T — tongue curled further back than English T, like "th" in "think" but with tongue tip curled up',
  'Ŧ': 'Lateral T — tongue at the side, air passes along sides. Like starting "T" but releasing sideways',
  'Ć': 'Like "ch" in "church" — tongue at hard palate',
  'X̱': 'Uvular fricative — raspy sound from very back of throat, like gentle throat clearing',
  'Ṉ': 'Uvular nasal — like "ng" but further back in the throat',
  'Ⱦ': 'Glottalized T — a T sound with a simultaneous glottal stop (catch in throat)',
  '¸': 'Cedilla indicates glottalization — a brief catch in the voice (glottal stop)',
  'Ḵ': 'Uvular stop — like K but much further back, at the uvula',
  'Ⱥ': 'Schwa vowel — like the "a" in "about" or "sofa"',
};

function levenshteinAlign(expected: string, hypothesis: string): { cer: number; diffs: Diff[] } {
  // Standard edit distance with backtrace
  // Returns character-level alignment with diff types
  // CER = edit_distance / expected_length
}
```

### Cedilla Tolerance

Per the NRC paper, cedilla (¸) errors are the most common and most easily correctable. The evaluation pipeline has a "cedilla-tolerant" mode:

```typescript
function evaluateWithCedillaTolerance(expected: string, hypothesis: string) {
  // First: strict alignment
  const strict = levenshteinAlign(expected, hypothesis);

  // Second: alignment ignoring cedilla differences
  const normalized_expected = expected.replace(/¸/g, '');
  const normalized_hypothesis = hypothesis.replace(/¸/g, '');
  const tolerant = levenshteinAlign(normalized_expected, normalized_hypothesis);

  return {
    strict_cer: strict.cer,
    tolerant_cer: tolerant.cer,
    diffs: tolerant.diffs, // Report non-cedilla differences
    cedilla_note: strict.cer !== tolerant.cer
      ? "Some differences were cedilla marks (glottalization indicators) — these are subtle and even fluent speakers vary in their use."
      : null
  };
}
```

---

## EveryVoice TTS Integration

### Deployment

EveryVoice runs as a persistent process on the same GPU instance (g4dn.xlarge) that hosts NRC Whisper:

```bash
# Start EveryVoice inference server
everyvoice serve \
  --feature-prediction-checkpoint /models/sencoten-text-to-spec.ckpt \
  --vocoder-checkpoint /models/sencoten-spec-to-wav.ckpt \
  --port 8765
```

### API Call from Function Handler

```typescript
async everyvoiceSynthesize(text: string, speed: number = 1.0): Promise<string> {
  const response = await fetch('http://localhost:8765/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      speed_factor: speed,
      output_format: 'wav'
    })
  });

  const outputPath = `/tmp/tts_${Date.now()}.wav`;
  const buffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(buffer));
  return outputPath;
}
```

### Audio Priority System

```
Priority 1: Community recording (wordbank/audio/{word_id}.mp3)
  → Real human voice, highest authenticity
  → Available for pre-curated wordbank entries only

Priority 2: TTS cache (cache/tts/{word_id}_{speed}.wav)
  → Previously generated, instant playback
  → Reduces GPU load

Priority 3: Real-time TTS (EveryVoice inference)
  → Any SENĆOŦEN text on demand
  → ~0.5s latency on GPU
  → Always disclosed as "synthesized"
```

---

## Fine-tuned Whisper ASR — Deployment & Integration

The pronunciation evaluator is the **primary engine** of this system. It uses the exact pipeline from Geng et al. 2025 (ComputEL-8):

- **Base model:** `openai/whisper-large-v2` (multilingual encoder-decoder, 1.5B params)
- **Fine-tuning:** Cross-lingual transfer learning on 1.7h real SENĆOŦEN + 8h TTS-augmented data
- **Language model:** 4-gram KenLM (`large-4g`, 14K word vocabulary from Montler dictionary)
- **Decoding:** Shallow fusion (LM weight tuned on dev set)

### Deployment

```bash
# Whisper inference server (using faster-whisper for speed)
# Model weights: fine-tuned checkpoint from NRC (requires authorization)
# LM: KenLM binary compiled from Montler 2018 dictionary text
python serve_whisper.py \
  --model-path /models/whisper-large-v2-sencoten \
  --lm-path /models/sencoten-large-4g.binary \
  --lm-weight 0.3 \
  --device cuda \
  --port 8766
```

### API Call

```typescript
async whisperTranscribe(audioPath: string): Promise<{ transcript: string; confidence: number }> {
  const formData = new FormData();
  formData.append('audio', fs.createReadStream(audioPath));
  formData.append('language', 'sencoten');

  const response = await fetch('http://localhost:8766/transcribe', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  // result = { transcript: "TELÁṈE", confidence: 0.72, segments: [...] }
  return { transcript: result.transcript, confidence: result.confidence };
}
```

### Why This Specific Configuration (Sys. 17 from the Paper)

The paper tested many configurations. Sys. 17 (Whisper-large-v2 + 8h TTS augmentation + large-4g LM) is optimal because:

1. **Whisper > Wav2Vec2 for this task:** Encoder-decoder architecture naturally produces text output (no separate CTC decoder needed). Sys. 17 beats Sys. 15 (Wav2Vec2-xls-r-1b + large-4g) on both seen and unseen words.

2. **TTS augmentation is critical:** Adding 8h synthesized data from EveryVoice reduces WER on unseen words from 50.35% (Sys. 18, Table 2: no augmentation) to 44.96% (Sys. 17, Table 3) — a 5.39% absolute improvement. This matters because learners will attempt words that are "unseen" to the ASR.

3. **Large LM + TTS together > either alone:** The LM constrains decoding toward valid SENĆOŦEN words, while TTS augmentation gives the acoustic model exposure to those words' sound patterns.

4. **Cedilla filtering is justified:** The paper shows CER drops from 5.09% to 3.45% when cedilla errors are excluded. These errors involve glottalization marks that "vary in their consistency of use" among speakers — they shouldn't be flagged as learner errors.

### Latency Budget

| Step | Time |
|------|------|
| Extract from ring buffer | <1ms |
| Save as temp WAV | ~5ms |
| Whisper inference (2-5s audio on GPU) | ~1-2s |
| Levenshtein alignment | <1ms |
| Build response JSON | <1ms |
| **Total** | **~1-2s** |

This 1-2s pause is natural — the agent "thinks" after the learner speaks. From the learner's perspective, it feels like the coach is listening carefully before responding.

---

## Browser Client (practice.html)

```javascript
class PracticeClient {
  constructor(serverUrl, token) {
    this.audioCtx = new AudioContext({ sampleRate: 24000 });
    this.socket = io(serverUrl, { auth: { token } });

    // Track 1: English agent voice
    this.agentGain = this.audioCtx.createGain();
    this.agentGain.gain.value = 1.0;
    this.agentGain.connect(this.audioCtx.destination);

    // Track 2: SENĆOŦEN audio (slightly louder, distinct)
    this.sencotenGain = this.audioCtx.createGain();
    this.sencotenGain.gain.value = 1.2;
    this.sencotenGain.connect(this.audioCtx.destination);

    this.playbackQueue = [];
    this.isPlaying = false;
  }

  init() {
    // Agent English audio (from Deepgram Aura-2)
    this.socket.on('agent_audio', (chunk) => {
      this.queueAudio(chunk, this.agentGain);
    });

    // SENĆOŦEN audio (from function calls — recordings or TTS)
    this.socket.on('sencoten_audio', (data) => {
      this.queueAudio(data.pcm, this.sencotenGain);
      if (data.word) this.showWordCard(data.word, data.english);
    });

    // Barge-in: learner started speaking → stop agent audio
    this.socket.on('agent_interrupted', () => {
      this.clearPlayback();
    });

    // Session lifecycle
    this.socket.on('session_started', () => this.showStatus('Connected'));
    this.socket.on('session_ended', (data) => this.showSummary(data));

    // Start mic capture
    this.startMicCapture();
  }

  async startMicCapture() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
    });

    const source = this.audioCtx.createMediaStreamSource(stream);
    const processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const float32 = e.inputBuffer.getChannelData(0);
      const int16 = this.float32ToInt16(float32);
      this.socket.emit('audio_chunk', int16.buffer);
    };

    source.connect(processor);
    processor.connect(this.audioCtx.destination);
  }

  showWordCard(word, english) {
    // Display the current SENĆOŦEN word visually
    document.getElementById('word-display').textContent = word;
    document.getElementById('english-display').textContent = english;
  }
}
```

---

## Mode Switching (UpdateThink)

### Practice → Drill

```
Trigger: Agent calls start_shadowing_drill
Server:
  1. FunctionCallResponse → { status: "drill_started" }
  2. Wait 500ms
  3. UpdateThink → drill prompt + 4 functions
  4. Wait ThinkUpdated
  5. UpdateSpeak → aura-2-mars-en (optional: more structured voice)
  6. Wait SpeakUpdated
  7. InjectAgentMessage → "alright, drill time!" (behavior: "queue")
```

### Drill → Practice

```
Trigger: Agent calls end_drill OR learner says "stop"
Server:
  1. FunctionCallResponse → { status: "drill_ended", summary }
  2. Wait 500ms
  3. UpdateThink → practice prompt + 7 functions
  4. Wait ThinkUpdated
  5. UpdateSpeak → aura-2-thalia-en
  6. Wait SpeakUpdated
  7. InjectAgentMessage → "nice work on the drill! want to keep chatting?" (behavior: "queue")
```

---

## Data Sovereignty

All principles from `sencoten-companion-full-design.md` apply. Additional voice-specific constraints:

| Data | Storage | Duration | Who Can Access |
|------|---------|----------|----------------|
| Learner mic audio (ring buffer) | RAM only | 10 seconds max, overwritten continuously | Function handler only, during evaluation |
| Temp WAV for Whisper | /tmp | Deleted immediately after inference (<2s) | Whisper process only |
| Whisper transcription result | RAM only (function response) | Exists only during LLM turn | Haiku (via function result) |
| TTS cache | Local disk | Persistent (same for all learners) | Server process |
| KenLM binary | Local disk | Persistent (static, no learner data) | Whisper process |
| Session transcript | SQLite (same as WhatsApp) | Until learner says "forget me" | Learner's agent only |

**Key commitment:** No learner audio is ever stored persistently. No learner audio is sent to any external service (NRC Whisper runs locally on EC2).

---

## Cost Analysis

| Component | Per Session (8 min) | Monthly (40 sessions) |
|-----------|---------------------|----------------------|
| Deepgram Agent (BYO LLM, $0.07/min) | $0.56 | $22.40 |
| Bedrock Haiku 4.5 (~5K tokens/session) | ~$0.008 | $0.32 |
| Fine-tuned Whisper (self-hosted, ~5 evals × 1.5s GPU each) | ~$0.02 | $0.80 |
| EveryVoice TTS (~10 calls × 0.5s GPU each) | ~$0.01 | $0.40 |
| GPU instance (g4dn.xlarge, shared Whisper+TTS, prorated) | ~$0.05 | $2.00 |
| **Total** | **~$0.65** | **~$25.92** |

---

## Prerequisites (Before This Spec Can Be Built)

| Prerequisite | Status | Blocker Level |
|--------------|--------|---------------|
| Deepgram API key | Available (sign up) | None |
| g4dn.xlarge GPU instance | Can provision | None |
| SENĆOŦEN wordbank (100 entries, public sources) | Partially curated | Low |
| **NRC authorizes use of fine-tuned Whisper weights** | Not yet requested | **Hard blocker** (pronunciation eval) |
| **NRC/EveryVoice authorizes use of TTS model weights** | Not yet requested | **Hard blocker** (unlimited vocab) |
| **Speaker whose voice trained the TTS consents to educational use** | Unknown | **Hard blocker** (TTS) |
| KenLM `large-4g` binary (built from Montler 2018 dictionary) | Requires dictionary access via NRC | Medium |
| Pre-recorded reference audio (public/open-licensed) | Partially available | Medium (fallback if TTS blocked) |

**Without NRC authorization:** The system can still run voice sessions with English coaching + pre-recorded audio playback — but pronunciation evaluation and unlimited TTS are disabled. This falls back to the original `voice-agent-design.md` pattern ("play audio, respond encouragingly, don't evaluate").

**With NRC authorization:** Full pipeline — Whisper transcribes learner attempts, Levenshtein alignment identifies specific character differences, agent gives targeted phonetic coaching. EveryVoice generates audio for any of Montler's 30K words on demand.

### Note on Community Consent

The previous version of this spec listed "W̱SÁNEĆ community consents to machine pronunciation feedback" as a hard blocker. This reflected a framing error: **writing a spec and building a hackathon project does not require community consent.** Deploying to actual W̱SÁNEĆ learners would. The distinction matters:

- Building → no blocker (this is a hackathon)
- Deploying with SENĆOŦEN content → requires content licensing (separate from community consent)
- Deploying as a community-facing tool → requires community partnership (years, not months)

The spec is honest about what it is: an architecture demonstration using SENĆOŦEN as a worked example because it has the strongest NLP infrastructure of any BC Salishan language.

---

## Ethical Considerations (Voice-Specific)

### TTS Voice Identity

The EveryVoice model is trained on ONE speaker's voice. Every synthesized utterance sounds like that person. This raises:

1. **Identity concern:** Is it appropriate for a machine to speak in someone's voice without them present?
2. **Authority concern:** Learners may perceive the TTS as "the correct pronunciation" — but it's one person's pronunciation
3. **Consent concern:** The speaker consented to TTS research — does that extend to this use case?

**Mitigation:** Always disclose. When `generate_and_play` is used (vs community recordings), the agent says "this is a synthesized version" and the UI shows a "(synthesized)" label.

### ASR Feedback Framing

The ASR model will make errors on learner speech. If we frame its output as "you said X wrong," we:
- May crush learner confidence (anxiety is the #1 barrier for adult Indigenous language learners — McIvor)
- May be factually wrong (model error, not learner error)
- Assert authority we don't have (what is "correct" is a community decision)

**Mitigation:** All feedback uses "what I heard" framing. The system prompt explicitly forbids "wrong/incorrect/error" language. The disclaimer "a community speaker is the real judge" accompanies all evaluations.

### The "Stop" Principle

If at any point the W̱SÁNEĆ community says "we don't want machines giving pronunciation feedback on our language," this entire spec is abandoned. The architecture is designed to disable ASR feedback (revert to the "play audio only, don't evaluate" mode) with a single config change.

---

## Relationship to Other Design Documents

| Document | Relationship |
|----------|-------------|
| `pitch/sencoten-companion-full-design.md` | This spec extends Section 13 (Voice Agent Integration) with full TTS + ASR |
| `pitch/voice-agent-design.md` | This spec replaces the Nova Sonic design entirely |
| `memory-bank/deepgram-voice-design.md` | TAi's voice design — shares WebSocket lifecycle, mode switching, and function patterns |
| `pitch/teachjam/2025.computel-main.4.pdf` | Geng et al. 2025 — provides the ASR pipeline, performance benchmarks, and TTS augmentation strategy. Our pronunciation evaluator is Sys. 17 (Table 3): Whisper-large-v2 + 8h TTS aug + large-4g LM |
| EveryVoice TTS Toolkit (Pine et al. 2022b) | Provides the TTS system for both audio generation AND ASR training data augmentation |

---

## Summary: What Changed from Previous Design

| Previous (Nova Sonic + pre-recorded only) | New (Deepgram + EveryVoice + Fine-tuned Whisper) |
|-------------------------------------------|--------------------------------------------------|
| 80 words with audio | 30,000 words available via TTS |
| Play pre-recorded audio only | Generate audio for any SENĆOŦEN text on demand |
| Cannot evaluate pronunciation | Character-level pronunciation feedback (CER 3.45% on fluent speech) |
| Acoustic similarity only ("sounds close") | Actual transcription → alignment → "the Ŧ sound was different" |
| SRS tests recall only | SRS tests recall + oral production |
| "Got your recording!" (no processing) | Immediate character-level descriptive feedback |
| Single mode (casual practice) | Two modes: Practice + Shadowing Drill |
| Nova Sonic echo issues | Deepgram function-call blocking = natural echo prevention |
| 12h additional build | ~20h additional build (TTS server + Whisper server + ring buffer + alignment) |
| No prerequisites beyond audio files | 3 hard blockers (NRC Whisper weights + EveryVoice weights + speaker consent) |
