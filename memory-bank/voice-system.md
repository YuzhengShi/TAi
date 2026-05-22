# TAi Voice System — Complete Technical Reference

**Created:** 2026-05-19
**Scope:** All voice functionality — incoming transcription, outgoing TTS, and real-time mock interviews via Nova Sonic

---

## Overview

TAi has three voice systems:

| System | Direction | Protocol | Model |
|--------|-----------|----------|-------|
| Voice note transcription | Student → TAi | WhatsApp audio → Transcribe Streaming | Amazon Transcribe |
| Voice note generation | TAi → Student | Text → Polly → WhatsApp audio | Amazon Polly |
| Mock interview | Bidirectional real-time | Socket.IO + Bedrock WebSocket | Nova 2 Sonic + Claude Sonnet (evaluator) |

---

## 1. Incoming Voice Notes (WhatsApp → Transcription)

### Data Flow

```
Student records voice note on WhatsApp
  → Baileys receives audioMessage (OGG Opus codec, ≤10MB)
  → downloadMediaMessage() saves to /workspace/ipc/{group}/media/{msgId}.ogg
  → ffmpeg converts: OGG Opus → 16kHz mono PCM s16le (raw)
  → PCM streamed in 4096-byte chunks to AWS Transcribe Streaming
  → Final transcript string returned
  → Injected into agent message: [Voice note transcription: "..."]
  → Agent responds to transcribed text as if student typed it
```

### Key Files

- `src/channels/whatsapp.ts` — detects `audioMessage` type, downloads media, triggers transcription
- `src/transcription.ts` — ffmpeg conversion + TranscribeStreamingClient wrapper

### Audio Specs

- **Input:** OGG Opus (WhatsApp native PTT format)
- **Intermediate:** 16kHz mono PCM s16le (Transcribe requirement)
- **ffmpeg command:** `ffmpeg -i input.ogg -ar 16000 -ac 1 -f s16le pipe:1`
- **Language:** en-US
- **Timeout:** 15 seconds hard limit

### Error Handling

- Missing ffmpeg: searches PATH + common Windows install locations
- Empty ffmpeg output: throws error, agent gets file path as fallback
- Transcribe timeout or failure: agent receives `[User sent a voice note — file could not be transcribed. Path: ...]`
- View-once messages: skipped entirely (privacy)

---

## 2. Outgoing Voice Notes (TTS → WhatsApp)

### Data Flow

```
Agent calls MCP tool: send_voice_message(text)
  → container/scripts/tts.py reads text from stdin (≤3000 chars)
  → Amazon Polly (neural engine, voice "Joanna") synthesizes OGG Vorbis
  → ffmpeg converts: OGG Vorbis → OGG Opus at 32kbps
  → Audio written to /workspace/ipc/media/tts-{timestamp}.ogg
  → IPC file created: {type: "voice_message", chatJid, audioPath}
  → Host process reads IPC → sends via Baileys as WhatsApp audio (ptt: true)
  → Student receives voice note in chat
```

### Key Files

- `container/scripts/tts.py` — Polly synthesis + ffmpeg Opus encoding
- `container/agent-runner/src/ipc-mcp-stdio.ts` — `send_voice_message` MCP tool definition (line ~365)

### Audio Specs

- **Polly output:** OGG Vorbis (neural voice)
- **Final format:** OGG Opus 32kbps (WhatsApp-compatible)
- **ffmpeg command:** `ffmpeg -i pipe:0 -c:a libopus -b:a 32k -f ogg pipe:1`
- **Voice:** Joanna (US English, neural, professional female)
- **Max text:** 3000 characters (Polly API limit)

### Constraints

- Rate limit: 10 `send_voice_message` calls per session
- Text output suppressed after tool call (`.send_message_used` marker)
- Polly neural voices produce higher quality but have slightly higher latency than standard voices

---

## 3. Mock Interview System (Nova Sonic Real-Time Voice)

This is the most complex system — a real-time bidirectional voice interview between a student and Nova 2 Sonic, with a Claude Sonnet "Shadow Evaluator" scoring answers asynchronously mid-conversation.

### Architecture

```
                                    ┌─────────────────────────┐
                                    │   Cloudflare Tunnel     │
                                    │  (HTTPS termination)    │
                                    └────────────┬────────────┘
                                                 │
┌──────────────┐    Socket.IO       ┌────────────┴────────────┐
│   Browser    │◄──────────────────►│   voice/server.ts       │
│ interview.js │  base64 PCM audio  │   (Express + Socket.IO) │
│              │  + events          │   port 3001             │
└──────────────┘                    └────────────┬────────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    │   SessionManager        │
                                    │   (session-manager.ts)  │
                                    └──────┬──────────┬───────┘
                                           │          │
                             ┌─────────────┘          └──────────────┐
                             │                                       │
                 ┌────────────┴────────────┐         ┌───────────────┴────────────┐
                 │   NovaSonicSession      │         │   Shadow Evaluator         │
                 │   (nova-sonic.ts)       │         │   (shadow-evaluator.ts)    │
                 │   Bedrock WebSocket     │         │   Claude Sonnet 4.6        │
                 │   us-east-1             │         │   us-west-2                │
                 │   amazon.nova-2-sonic   │         │   async, never blocks      │
                 └─────────────────────────┘         └────────────────────────────┘
                                                                  │
                                                     ┌────────────┴────────────┐
                                                     │   CompetencyWriter      │
                                                     │   (competency-writer.ts)│
                                                     │   Updates COMPETENCY.md │
                                                     └─────────────────────────┘
```

### Complete Lifecycle

#### Phase 1: Interview Trigger

1. Student sends "mock interview" (or similar) on WhatsApp
2. TAi agent (Haiku 4.5 in Docker container) calls `start_mock_interview` MCP tool
3. Tool executes in `container/agent-runner/src/ipc-mcp-stdio.ts` (line ~764):
   - Parses student's `COMPETENCY.md` → extracts name, Canvas ID, GitHub username, weak concepts, verbal gaps, misconceptions
   - Calls `canvas_api.py` → fetches assignments, picks target (most recent past-due or specified)
   - Calls `canvas_api.py` → gets assignment spec + student submission text
   - Calls `github_api.py` → lists repos, matches to assignment, fetches up to 4 key code files
   - Fetches lecture materials from Canvas modules
   - Writes `interview_context.json` to `groups/{student}/`
   - Generates HMAC-SHA256 token: `{base64url(payload)}.{hmac-sha256-hex}`
     - Payload: `{folder, assignmentId, ts}`
     - Secret: `VOICE_INTERVIEW_SECRET` env var
     - TTL: 1 hour
     - Retry budget: MAX_ATTEMPTS = 5
   - Reads live tunnel URL from `groups/global/tunnel-url.txt`
   - Returns link to agent: `https://{tunnel}.trycloudflare.com/interview/{token}`
4. Agent sends link to student on WhatsApp

#### Phase 2: Browser Connection

1. Student opens link on mobile browser (Android/iOS)
2. Express server (`voice/server.ts`) validates token → serves `voice/public/index.html`
3. Frontend loads `interview.js`, creates `InterviewClient`
4. Fetches `/api/context/{token}` → displays student name + assignment name
5. Student clicks "Start Interview" button

#### Phase 3: Audio Setup (The Android Problem)

This is where the critical engineering decisions happen. See detailed section below.

```javascript
// Step 1: AudioContext for PLAYBACK ONLY — 48kHz
this.audioContext = new AudioContext({ sampleRate: 48000 });

// Step 2: Play silent buffer to lock media mode BEFORE getUserMedia
const silentBuf = this.audioContext.createBuffer(1, 4800, 48000);
// ... play it, wait 100ms ...

// Step 3: Get mic (separate from AudioContext)
this.stream = await navigator.mediaDevices.getUserMedia({
  audio: { channelCount: 1, sampleRate: 16000, echoCancellation: false }
});

// Step 4: Capture via MediaStreamTrackProcessor (NO AudioContext involvement)
this.startTrackProcessor();
```

6. Socket.IO emits `start_interview` with token

#### Phase 4: Server-Side Session Start

1. `server.ts` receives `start_interview` event
2. `consumeToken()` validates + increments attempt counter (max 5)
3. `loadInterviewContext()` called:
   - **Fast path:** reads `interview_context.json` (pre-written by MCP tool)
   - **Slow path:** calls Python scripts directly if JSON missing
4. Builds system prompt via `buildSystemPrompt()` (see Prompt Design section)
5. Creates `SessionManager` with callbacks: `onAudio`, `onDone`
6. `manager.start()` called — enters retry loop

#### Phase 5: Nova Sonic Bidirectional Stream

`NovaSonicSession.start(systemPrompt)` establishes the Bedrock WebSocket:

1. **sessionStart** → inference config: `{maxTokens: 1024, topP: 0.9, temperature: 0.7}`
2. **promptStart** → declares output formats:
   - Audio: 24kHz mono PCM s16le, base64, voice "tiffany"
   - Text: text/plain
   - Tool use: application/json
   - `toolConfiguration` (NOT `toolUseConfiguration`) with `evaluate_answer` tool
3. **System prompt** → contentStart(SYSTEM) + textInput + contentEnd
4. **5 silence chunks** → 3200 bytes each (200ms total) to establish audio channel
5. **Audio input block opened** → contentStart(USER, AUDIO, interactive: true)
   - This block stays open for the entire conversation
   - All subsequent mic audio goes into this block

**Stream protocol:**
- Input: async generator yielding `{chunk: {bytes}}` events
- Output: async iterable of `{chunk: {bytes}}` events
- Both carry JSON-encoded event objects
- Model: `amazon.nova-2-sonic-v1:0` (us-east-1 ONLY)
- Connection: WebSocket via `@aws-sdk/middleware-websocket` with 5s timeout

**Ready gate:** `sendAudio()` silently drops all audio until `this.ready = true` (set when first output event arrives). This prevents raw mic noise from hitting Nova Sonic before it's ready.

#### Phase 6: Live Conversation

```
Browser mic → 16kHz PCM (100ms chunks) → base64 → Socket.IO → server
  → Buffer.from(base64) → session.sendAudio(pcmChunk)
  → enqueueEvent({audioInput: {content: base64}}) → Bedrock WebSocket

Nova Sonic generates speech → audioOutput event (24kHz PCM base64)
  → session emits 'audio' → manager.onAudio(chunk) → socket.emit('audio_chunk', base64)
  → Browser decodes → Float32 → AudioBufferSourceNode → speakers

Nova Sonic generates text → textOutput event
  → session emits 'text' → pushed to transcript as 'interviewer' entry

Nova Sonic calls evaluate_answer → toolUse event
  → session emits 'toolUse' → Shadow Evaluator called (async, no blocking)
  → Student answer pushed to transcript
  → Topic added to topicsAsked set
  → Difficulty adjusted based on evaluator result
```

#### Phase 7: Shadow Evaluator (Async Scoring)

When Nova Sonic invokes `evaluate_answer`:

1. It does NOT wait for the result (async tool calling)
2. Nova Sonic continues talking immediately
3. `SessionManager` receives the toolUse event with:
   ```json
   {
     "question_asked": "What happens if a Raft leader fails mid-heartbeat?",
     "student_answer_summary": "The followers detect timeout and start election",
     "topic": "Raft consensus"
   }
   ```
4. Calls `evaluateAnswer()` in `shadow-evaluator.ts`:
   - Model: `us.anthropic.claude-sonnet-4-6` (Bedrock, us-west-2)
   - System prompt includes student's known weak spots and misconceptions
   - Returns JSON with 4 rubric scores (1-5 each) + missed concepts + follow-up suggestion + difficulty adjustment
5. Result stored in `state.evaluations[]`
6. Difficulty adjusted: easier/maintain/harder
7. **Tool result is NEVER sent back to Nova Sonic** — the bidirectional stream API rejects TOOL_RESULT content blocks for async tool calls

**Failure resilience:** Shadow Evaluator errors are caught and swallowed — on any failure, a default evaluation is used (all 3s, "Continue probing"). The interview never crashes due to evaluator issues.

#### Phase 8: Session Boundaries

- **Timer:** 10-second interval checks elapsed time
- **7 min:** `warningSent` flag set (no action taken, natural wrap-up expected)
- **7.5 min:** `session.end()` called → close audio block → promptEnd → sessionEnd
- `done` event fires from NovaSonicSession
- SessionManager checks: `totalElapsed < 20min && sessionIndex < 2`?
  - **Yes:** Resume with new session
    - Increment `sessionIndex`
    - Build resume prompt: base system prompt + last 20 transcript entries + topics covered + avg scores + current difficulty
    - Appends: "Continue from where you left off. Don't re-introduce yourself."
    - `startSession(resumePrompt)` → creates new NovaSonicSession
  - **No:** Finish → call `onDone(buildSummary())`

#### Phase 9: Post-Interview

When `onDone` fires with an `InterviewSummary`:

1. **Token guard:** Only mark completed + write results if `durationMinutes > 0 || transcript.length > 0`
   - Failed/zero-duration sessions don't consume the token or corrupt files
2. `markTokenCompleted(token)` → moves to `completedTokens` Set (permanent, no retry)
3. Socket emits `interview_done` to browser:
   ```json
   {
     "duration": 14,
     "rubric": { "verbal_clarity": 3.5, "technical_accuracy": 4.0, ... },
     "strengths": ["Strong technical accuracy", ...],
     "weaknesses": ["Needs work on verbal clarity", ...]
   }
   ```
4. `writeInterviewResults(summary)` updates three files:
   - **`COMPETENCY.md`** — updates mastery lines (adds "verbal" scope, "mock_interview" via), appends Mock Interview Summary block
   - **`competency/interviews.md`** — prepends full interview record (strengths, weaknesses, rubric, strategy, follow-up)
   - **`competency/strategy-log.md`** — prepends strategy entry (skips test sessions < 3 min with all-zero scores)

---

### The Android Echo Problem (Critical Design Constraint)

#### The Problem

On mobile phones (especially Android), when Nova Sonic's voice plays through the speaker, the microphone picks it up. Nova Sonic then "hears" its own output as user speech. This causes:

1. **Echo feedback loop** — Nova Sonic responds to its own words → generates more audio → mic picks that up → infinite loop
2. **Garbled transcription** — Nova Sonic's speech recognition confuses AI output for student input, corrupting the conversation
3. **Content filter triggers** — the mixed audio pattern (AI voice + ambient noise) hits Amazon's content safety filters

#### Why Browser Echo Cancellation Doesn't Work

```javascript
echoCancellation: false,  // Deliberately disabled
```

Browser AEC (Acoustic Echo Cancellation) is designed for WebRTC calls where there's a known reference signal from a `<audio>` element or RTCPeerConnection. In TAi's architecture:
- Playback goes through `AudioContext.createBufferSource()` → speakers
- This is NOT a WebRTC audio path — there's no reference signal for AEC to subtract
- On Android, enabling `echoCancellation` forces the audio subsystem into **"communication mode"**:
  - Routes audio to earpiece instead of loud speaker
  - Reduces audio quality (narrowband)
  - Terrible UX for a 15-minute interview session
- So AEC is disabled, and echo is handled manually

#### The Solution: Silence Injection + Audio Path Separation

**Three-layer defense:**

**Layer 1: Separate audio paths (prevent communication mode)**

```javascript
// AudioContext for PLAYBACK ONLY — never touches getUserMedia
this.audioContext = new AudioContext({ sampleRate: 48000 });

// Play silent buffer BEFORE getUserMedia to lock media mode
const silentBuf = this.audioContext.createBuffer(1, 4800, 48000);
// ... start playback ...
await new Promise(r => setTimeout(r, 100));  // Let media session establish

// THEN get mic via completely separate API
this.stream = await navigator.mediaDevices.getUserMedia({ ... });

// Capture via MediaStreamTrackProcessor — NO AudioContext connection
const processor = new MediaStreamTrackProcessor({ track });
```

On Android, if `AudioContext` ever touches `getUserMedia` (via `createMediaStreamSource`), the entire audio subsystem switches to "communication mode." By keeping capture completely separate (MediaStreamTrackProcessor reads frames directly from the track), Android stays in "media mode" — loud speaker, full quality.

**Layer 2: Silence injection during AI playback (kill echo)**

```javascript
// In the capture loop:
if (this.socket?.connected) {
  const toSend = this.isPlaying ? new Int16Array(int16.length) : int16;
  this.socket.emit('audio_chunk', this.arrayBufferToBase64(toSend.buffer));
}
```

The `isPlaying` flag tracks whether Nova Sonic audio is currently playing through the speakers:
- Set `true` in `playNext()` when a buffer starts playing
- Set `false` when `playbackQueue` empties and `playNext()` has nothing left

While `isPlaying === true`:
- Actual mic audio is discarded
- Zero-filled Int16 arrays (silence) are sent to Nova Sonic instead
- Nova Sonic "hears" silence → doesn't respond → no echo loop

**Layer 3: Server-side ready gate (prevent early noise)**

```typescript
sendAudio(pcmChunk: Buffer): void {
  if (this.closed || !this.ready) return;  // Drop until first output event
  // ...
}
```

Even after the browser starts sending audio, the server drops it until Nova Sonic sends its first output event. This prevents ambient mic noise during the ~2 second connection setup from triggering content filters.

#### The Consequence: No Barge-In

The silence injection approach means **the student cannot interrupt Nova Sonic while it's speaking**. The mic is effectively muted during AI playback.

In a traditional voice agent, "barge-in" lets the user interrupt the AI mid-sentence — the AI detects speech, stops generating, and listens. TAi explicitly sacrifices this feature because:

1. **Echo vs barge-in is a binary choice** without proper AEC — you can't have both
2. Mock interviews are turn-based: question → answer → next question
3. Nova Sonic's questions are short (1 sentence per turn, per system prompt rules)
4. Students rarely need to interrupt their interviewer
5. The alternative (echo feedback) completely breaks the entire conversation

If barge-in is needed in the future, it requires either:
- A voice agent platform with built-in AEC (e.g., Deepgram Voice Agent — the planned migration)
- WebRTC-based audio routing where the browser has a proper reference signal
- Hardware echo cancellation (not available in mobile browsers)

---

### Content Filter Problem & Workarounds

#### Root Cause

Amazon Nova Sonic has service-side content safety filters that analyze incoming audio patterns. When:
- Raw mic audio (ambient noise, breath, keyboard sounds) arrives before Nova Sonic is "ready"
- The audio doesn't match expected speech patterns
- Timing between audio and model initialization is off

...the service returns a content filter error and terminates the session.

#### Server-Side Mitigations

**1. Initial silence burst** (`nova-sonic.ts:162-171`)
```typescript
const initialSilence = Buffer.alloc(3200).toString('base64');  // 200ms at 16kHz
for (let i = 0; i < 5; i++) {
  this.enqueueEvent({ audioInput: { content: initialSilence } });
}
```
Sends 5 × 200ms = 1 second of known-good silence to establish the audio channel before any real audio arrives.

**2. Ready gate** (`nova-sonic.ts:209`)
```typescript
if (this.closed || !this.ready) return;
```
All `sendAudio()` calls are silently dropped until the first output event arrives from Nova Sonic (proving the session survived content filtering).

**3. Retry logic** (`session-manager.ts:58-74`)
```typescript
for (let attempt = 0; attempt <= MAX_START_RETRIES; attempt++) {
  try {
    await this.startSession(this.context.systemPrompt);
    return;
  } catch (err) {
    if (isContentFilter && attempt < MAX_START_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));  // 2000ms
      continue;
    }
    throw err;
  }
}
```
Up to 2 retries (3 total attempts) with 2-second delays between. The `startupPhase` flag prevents `onDone` from firing during retries.

**4. readyPromise propagation** (`nova-sonic.ts:180-207`)
```typescript
const readyPromise = new Promise<void>((resolve, reject) => {
  this.readyResolve = resolve;
  this.readyReject = reject;
});
```
`start()` now returns a promise that resolves on first output event OR rejects on content filter. This makes errors synchronous from SessionManager's perspective — they propagate as thrown exceptions instead of async events.

#### Current Status

The workaround reduces content filter frequency significantly but does NOT eliminate it. Real browser mic audio patterns can still trigger it in some sessions. This is the primary motivation for the planned **Deepgram Voice Agent migration**.

---

### Token System

#### Generation

```typescript
// Payload: {folder, assignmentId?, ts}
// Signature: HMAC-SHA256(JSON.stringify(payload), VOICE_INTERVIEW_SECRET)
// Format: base64url(payload).hex(signature)
// TTL: 1 hour from ts
```

#### Lifecycle

```
generateToken(folder, assignmentId?)
  → stored in activeTokens Map with attempts=0
  → returned as URL path component

validateToken(token)  [page load — non-consuming]
  → verify signature (timingSafeEqual)
  → check TTL (< 1 hour)
  → return payload or null

consumeToken(token)  [start_interview — consuming]
  → validate
  → check NOT in completedTokens Set
  → increment attempts counter
  → if attempts > MAX_ATTEMPTS (5): return null
  → return payload

markTokenCompleted(token)  [after successful interview]
  → move to completedTokens Set
  → permanently locked, no more retries

Cleanup: tokens with ts > 1hr pruned periodically (and when Map > 1000 entries)
```

The retry budget prevents token burn on transient failures (content filter, network drop). Only successful interviews (duration > 0 or transcript non-empty) permanently consume a token.

---

### Cloudflare Tunnel (HTTPS Requirement)

Browser `getUserMedia()` requires a secure context (HTTPS or localhost). No exceptions — not even a user override. Since EC2 has no domain name or TLS certificate, we use Cloudflare's free quick tunnel:

**`systemd/start-tunnel.sh`:**
```bash
cloudflared tunnel --url http://localhost:3001
```

- Captures random URL from cloudflared output (regex: `https://[a-z0-9-]+\.trycloudflare\.com`)
- Writes to:
  - `.env` → `VOICE_BASE_URL={url}` (for reference)
  - `groups/global/tunnel-url.txt` (mounted read-only into agent containers)
- Restarts `nanoclaw-main` service so new containers see the updated URL

**Important:** The tunnel URL changes on every restart. The `start_mock_interview` MCP tool reads from `tunnel-url.txt` at call time (not from a frozen env var) to always get the current URL.

**systemd service:** `cloudflared.service` uses `/bin/bash start-tunnel.sh` (not direct execution) to avoid executable-bit issues when pulling from Windows.

---

### System Prompt Design

The system prompt (`context-loader.ts:346-431`) is carefully crafted for a voice-first interface:

**Key constraints:**
- Everything generated is spoken aloud — no formatting, no meta-commentary
- ONE sentence per turn, ONE question per turn
- Never speak evaluation results (tool results are internal only)
- Conversational tone: "like a real grad student TA"
- Opens with casual chit-chat before transitioning to technical questions
- References student's SPECIFIC code and submission (not generic textbook content)

**Personalization injected:**
- Student name (for greeting + natural address)
- Assignment name + spec (truncated to 1500 chars)
- Student's actual code from GitHub (up to 2000 chars across 4 files)
- Student's Canvas submission text (truncated to 1500 chars)
- Weak concepts from COMPETENCY.md (targeted probing)
- Verbal gaps (concepts known but never articulated — practice saying them)
- Active misconceptions (approached indirectly, not called out)
- Lecture content from Canvas modules

**Difficulty adaptation via weak concepts:**
- Weak concepts → recall questions: "walk me through what happens when..."
- Verbal gaps → articulation prompts: "how would you explain that to someone who hasn't seen your code?"
- Strong concepts → edge cases: "what happens at 1000 concurrent users?"
- Misconceptions → indirect probing (don't announce, just ask questions that expose)

---

### Disconnect Problem (Unresolved)

**Current behavior:**
```typescript
// server.ts:147-153
socket.on('disconnect', async () => {
  if (manager) {
    await manager.stop();  // Immediately ends interview
  }
});
```

When Socket.IO disconnects (network drop, page refresh, phone lock):
- `manager.stop()` fires immediately
- `onDone(buildSummary())` called → emits `interview_done` to a dead socket
- Token is NOT burned (duration=0 guard works correctly)
- But **session state is lost** — transcript, evaluations, topics are all in-memory
- Student must get a new link and start over

**Needed fix:**
1. Add reconnect grace window (30-60 seconds) before calling `stop()`
2. Hold SessionManager in a Map keyed by token
3. On reconnect: validate same token, restore manager reference, resume audio stream
4. Only `stop()` after grace period expires with no reconnect

---

### File Reference

| File | Role |
|------|------|
| `voice/server.ts` | Express + Socket.IO server, token validation, interview lifecycle |
| `voice/nova-sonic.ts` | Bedrock bidirectional stream wrapper, event protocol |
| `voice/session-manager.ts` | Multi-session orchestration, timer, transcript, resume |
| `voice/shadow-evaluator.ts` | Claude Sonnet async scoring (4-dimension rubric) |
| `voice/competency-writer.ts` | Post-interview file updates (COMPETENCY.md, interviews.md, strategy-log.md) |
| `voice/context-loader.ts` | Pre-interview data assembly (Canvas, GitHub, COMPETENCY.md → system prompt) |
| `voice/interview-token.ts` | HMAC token generation, validation, retry budget |
| `voice/types.ts` | Shared TypeScript interfaces + EVALUATE_ANSWER_TOOL definition |
| `voice/public/index.html` | Interview UI (HTML) |
| `voice/public/interview.js` | Browser client: Socket.IO, mic capture, playback, echo prevention |
| `voice/public/audio-worklet.js` | AudioWorklet fallback processor (older browsers) |
| `systemd/nanoclaw-voice.service` | systemd service (BindsTo nanoclaw-main) |
| `systemd/start-tunnel.sh` | Cloudflare tunnel wrapper (captures URL, updates config) |
| `container/agent-runner/src/ipc-mcp-stdio.ts` | `start_mock_interview` MCP tool (~line 764) |

---

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VOICE_INTERVIEW_SECRET` | Yes | HMAC-SHA256 signing key for tokens |
| `VOICE_PORT` | No (default 3001) | Express server port |
| `VOICE_BASE_URL` | Auto-set by tunnel | Current Cloudflare tunnel URL |
| `AWS_REGION` | Yes | Shadow Evaluator region (us-west-2) |
| `AWS_ACCESS_KEY_ID` | Yes* | Bedrock auth (*or instance role) |
| `AWS_SECRET_ACCESS_KEY` | Yes* | Bedrock auth (*or instance role) |
| `CANVAS_API_TOKEN` | Optional | For loading assignment/submission context |
| `GITHUB_TOKEN` | Optional | For loading student code (Khoury GHE) |
| `GITHUB_TOKEN_PUBLIC` | Optional | For loading student code (github.com) |

Note: Nova Sonic client is hardcoded to **us-east-1** (only available region). Shadow Evaluator uses the configured `AWS_REGION` (us-west-2).

---

### Planned Migration: Deepgram Voice Agent

Nova Sonic's unresolved issues motivate migrating to Deepgram:

| Issue | Nova Sonic | Deepgram (expected) |
|-------|-----------|---------------------|
| Content filter | Triggers on real mic audio patterns | No known equivalent issue |
| Barge-in | Impossible (silence injection kills it) | Built-in AEC + barge-in support |
| Reconnect | Not supported, session state lost | WebSocket reconnect possible |
| Region | us-east-1 only | Multi-region |
| Audio quality | Good (Tiffany voice) | Good (multiple voice options) |

Deepgram docs MCP server added to `.mcp.json` for research. Migration not yet started.
