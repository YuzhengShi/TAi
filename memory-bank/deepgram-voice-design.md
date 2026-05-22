# TAi Voice Channel — Unified Design (Deepgram Voice Agent)

**Created:** 2026-05-19
**Updated:** 2026-05-19
**Status:** Design complete, not yet implemented
**Replaces:** Nova Sonic voice interview system (`voice/nova-sonic.ts`, `voice/session-manager.ts`)

---

## Vision

Voice is not a feature — it's TAi's **second channel**. The same teaching agent that talks to students on WhatsApp can now talk to them with its voice. Same personality, same knowledge, same memory, same competency tracking. WhatsApp becomes a visual side-channel during voice sessions (for images, diagrams, code snippets), while voice handles the real-time conversation.

---

## Why Migrate from Nova Sonic

| Problem | Nova Sonic | Deepgram Voice Agent |
|---------|-----------|---------------------|
| Echo feedback on Android | Manual silence injection, kills barge-in | Platform handles echo cancellation; barge-in built-in |
| Content filter | Random failures on real mic audio | STT sees audio, LLM sees only text — no content filter |
| Barge-in | Impossible (silence = muted mic) | `UserStartedSpeaking` auto-interrupts agent speech |
| Reconnect | Not possible, session state lost | WebSocket reconnect + `context.messages` history replay |
| Region lock | us-east-1 only | `wss://agent.deepgram.com` (global edge) |
| Pipeline control | Single opaque model | Separate STT + LLM + TTS — each independently configurable |
| Function call results | Async only — agent never sees eval scores | Synchronous — agent receives and uses function results |
| Multi-agent | Not supported | Built-in agent handoff with context summarization |
| Conversation context | None — single session, no history | `context.messages` for full history replay |

---

## Architecture

```
                      ┌──────────────────────────────────────────────────┐
                      │              Shared State Layer                  │
                      │  SQLite (messages, memories, sessions)           │
                      │  COMPETENCY.md (per-student mastery)             │
                      │  COURSE_STATUS.md (Canvas/GitHub sync)           │
                      │  LeanRAG graph.pkl (course knowledge)            │
                      └───────────────┬──────────────────┬───────────────┘
                                      │                  │
                ┌─────────────────────┴──┐      ┌───────┴────────────────────┐
                │   Text Channel         │      │   Voice Channel            │
                │   (WhatsApp + Baileys) │      │   (Browser + Deepgram)     │
                │                        │      │                            │
                │   Claude Agent SDK     │      │   Deepgram Voice Agent     │
                │   in Docker container  │      │   via relay server         │
                │                        │      │                            │
                │   MCP tools (17+)      │      │   Client-side functions    │
                │                        │      │   (17 + 4 interview)       │
                │                        │      │                            │
                │   Always-on 24/7       │      │   On-demand (student       │
                │   Proactive patrol     │      │   opens link)              │
                └─────────────────────────┘      └────────────────────────────┘
```

Both channels read/write the same state. A student can chat via text, switch to voice mid-conversation, and TAi knows exactly what was discussed.

### Voice Server Architecture

```
┌─────────────────┐    Socket.IO        ┌───────────────────────────────────┐
│   Browser       │◄──────────────────► │   voice/server.ts                  │
│   interview.js  │  binary audio +     │   (Express + Socket.IO, port 3001) │
│   (simplified)  │  JSON events        │                                    │
└─────────────────┘                     └───────────────┬───────────────────┘
                                                        │
                                         ┌──────────────┴──────────────────┐
                                         │   VoiceOrchestrator             │
                                         │   (voice-orchestrator.ts)       │
                                         │                                  │
                                         │   SINGLE Deepgram WebSocket      │
                                         │   wss://agent.deepgram.com       │
                                         │   /v1/agent/converse             │
                                         │                                  │
                                         │   Mode switch via UpdateThink    │
                                         │   (no reconnect needed)          │
                                         └──────┬──────────────────┬───────┘
                                                │                  │
                               ┌────────────────┘                  └────────────────┐
                               │                                                    │
              ┌────────────────┴────────────────┐       ┌───────────────────────────┴──────┐
              │  Conversational Mode            │       │  Interviewer Mode                │
              │  (default)                      │       │  (activated via UpdateThink)     │
              │                                 │       │                                  │
              │  Listen: Nova-3 (STT)           │       │  Listen: (unchanged)             │
              │  Think: Haiku 4.5 (Bedrock)     │       │  Think: Haiku 4.5 (Bedrock)      │
              │    prompt: conversational TA    │       │    prompt: interviewer TA        │
              │    functions: 17 (full TAi)     │       │    functions: 4 (focused)        │
              │  Speak: Aura-2 thalia (warm)    │       │  Speak: Aura-2 mars (structured) │
              └──────────────────────────────────┘       └──────────────────────────────────┘
                                                                        │
                                                         ┌──────────────┴──────────────┐
                                                         │  Shadow Evaluator            │
                                                         │  (shadow-evaluator.ts)       │
                                                         │  Bedrock: Sonnet 4.6         │
                                                         │  Called via FunctionCallReq  │
                                                         └─────────────────────────────┘
```

### Key Architecture Decision: Single WebSocket, Mode Switching via `UpdateThink`

Deepgram's `UpdateThink` message replaces the **entire Think configuration** (provider, model, prompt, AND functions) on the same WebSocket connection. The server confirms with `ThinkUpdated`. Combined with `UpdateSpeak` (voice change), this gives us seamless multi-agent behavior **without disconnecting**.

**Why NOT multi-WebSocket (like the reference repo):**
- The reference repo uses Twilio (phone call = persistent audio stream to relay). Our architecture is different: browser → Socket.IO → our server → Deepgram. We control both ends.
- `UpdateThink` gives zero audio gap, preserves conversation history automatically, and eliminates buffer/flush complexity.
- We only need a full WebSocket reconnect for: (a) error recovery, or (b) 30+ min session context reset.

**Mode transition flow:**
```
Student: "let's practice for the interview"
Agent calls start_interview function
  → Our server sends FunctionCallResponse
  → Our server sends UpdateThink (interviewer prompt + 4 functions)
  → Deepgram confirms ThinkUpdated
  → Our server sends UpdateSpeak (mars voice)
  → Deepgram confirms SpeakUpdated
  → Our server sends InjectAgentMessage("alright, interview time! tell me about your assignment", behavior: "queue")
  → Agent speaks with new voice, new persona, new function set
  → Student perceives smooth transition
```

---

## Multi-Agent Design

### Agent 1: Conversational TA (default)

The general-purpose TAi voice agent. Handles everything: Socratic teaching, casual chat, concept explanation, course queries, code discussion, study planning.

**Personality:** Friendly grad student TA, same as text channel. Conversational, uses filler ("hmm", "right", "okay so..."). ONE sentence per turn. Ends with a question when teaching.

**Functions (17):**

| Function | Description | Server Implementation |
|----------|-------------|----------------------|
| `query_knowledge` | LeanRAG course material lookup | Calls LeanRAG Python MCP process |
| `recall_memory` | Retrieve persistent memories for this student | SQLite FTS5 query |
| `save_memory` | Store a new fact/preference | SQLite FTS5 insert |
| `read_competency` | Load student's full COMPETENCY.md | Read filesystem |
| `update_competency` | Write mastery changes after teaching | Write filesystem |
| `query_canvas` | Canvas LMS: grades, deadlines, assignments, submissions | Calls canvas_api.py |
| `query_github` | GitHub: repos, code, commits, PRs | Calls github_api.py |
| `get_youtube_content` | YouTube video info + transcript | Calls youtube_transcript.py |
| `browse_url` | Fetch and extract text from any URL | Playwright render → text |
| `access_sharepoint` | Access SharePoint/OneDrive content | Calls ms-auth-browse.mjs |
| `read_file` | Read uploaded file (PDF, DOCX, code) | pymupdf/convert_office.py/cat |
| `generate_image` | Create teaching illustration → send to WhatsApp | Nova Canvas → IPC → Baileys |
| `render_diagram` | Create technical diagram → send to WhatsApp | Mermaid CLI → IPC → Baileys |
| `send_to_whatsapp` | Send text/code snippet to WhatsApp side-channel | IPC → Baileys |
| `schedule_task` | Schedule a follow-up reminder | Write IPC task file |
| `start_interview` | Handoff to Interviewer Agent | Triggers agent transition |
| `end_session` | Gracefully end the voice call | Close WebSocket + write results |

**Handoff trigger to Interviewer Agent:**
- Student says "let's do a mock interview" / "practice time" / "interview me"
- Agent detects verbal gap in COMPETENCY.md and suggests practice
- Agent calls `start_interview` → orchestrator performs handoff

### Agent 2: Interviewer TA (mock interview mode)

Focused interview agent. Structured Q&A with rubric scoring. Activated only via handoff from Conversational Agent.

**Personality:** Same TAi persona but in "interviewer mode" — still friendly, but more structured. Asks questions, waits for answers, evaluates, adapts difficulty.

**Functions (4):**

| Function | Description | Server Implementation |
|----------|-------------|----------------------|
| `evaluate_answer` | Score student's answer on 4 dimensions | Bedrock Sonnet 4.6 (Shadow Evaluator) |
| `query_knowledge` | Ground questions in course material | LeanRAG Python MCP |
| `read_competency` | Check weak spots to target | Read filesystem |
| `end_interview` | End interview, handoff back or close | Summarize + write results |

**Key difference from Nova Sonic:** Function calls are synchronous. When `evaluate_answer` returns `{accuracy: 3, suggested_follow_up: "Ask about election timeout tuning", difficulty_adjustment: "easier"}`, Haiku directly uses this to pick the next question. The interview adapts in real-time.

### Mode Transition (NOT WebSocket Handoff)

Unlike the reference multi-agent repo (which closes/opens WebSocket connections), we use Deepgram's `UpdateThink` + `UpdateSpeak` on the SAME connection. This means:
- **Zero audio gap** during transition
- **Conversation history preserved** (agent remembers what was discussed before interview)
- **No buffer/flush complexity** (audio stream never interrupts)
- **~200ms transition latency** (just waiting for `ThinkUpdated` + `SpeakUpdated` confirmations)

### Mode Transition Flow

```
Student opens voice link → Single Deepgram WebSocket opens → Conversational Mode
    │
    │  (General teaching, course questions, code discussion)
    │
    ├── Student says "let's practice" or agent suggests it
    │       │
    │       ▼
    │   Agent calls start_interview(topic, assignment_id)
    │       │
    │       ▼
    │   Our server (same WebSocket, no reconnect):
    │     1. Sends FunctionCallResponse to acknowledge
    │     2. Sends UpdateThink → interviewer prompt + 4 functions
    │        (waits for ThinkUpdated confirmation)
    │     3. Sends UpdateSpeak → mars voice
    │        (waits for SpeakUpdated confirmation)
    │     4. Sends InjectAgentMessage("alright, interview time! tell me about your assignment", behavior: "queue")
    │     5. Conversation history PRESERVED — agent knows what was discussed
    │       │
    │       ▼
    │   (Structured interview: question → answer → evaluate → adapt)
    │       │
    │       ├── Timer hits 15 min OR agent calls end_interview
    │       │       │
    │       │       ▼
    │       │   Our server (same WebSocket, no reconnect):
    │       │     1. Builds interview summary (scores, topics, strengths, weaknesses)
    │       │     2. Writes results to COMPETENCY.md + interviews.md
    │       │     3. Sends UpdateThink → conversational prompt + 17 functions
    │       │     4. Sends UpdateSpeak → thalia voice
    │       │     5. Sends InjectAgentMessage("nice work! you did great on X. want to keep chatting?", behavior: "queue")
    │       │       │
    │       │       ▼
    │       │   Back to Conversational Mode (agent remembers everything from interview)
    │       │
    │       └── Student says "I'm done" / "that's all"
    │               │
    │               ▼
    │           end_session → graceful close
    │
    └── Student says "bye" / "thanks" / "I'm done"
            │
            ▼
        end_session → graceful close
```

---

## Context Injection: The Glue

### Session Start — Loading Student State

When a student opens the voice link, the server builds `context.messages` from all available state:

```json
{
  "type": "Settings",
  "agent": {
    "context": {
      "messages": [
        {
          "type": "History", "role": "assistant",
          "content": "[SYSTEM CONTEXT — not spoken]\nStudent: Yuzheng Shi\nCourse: CS6650 Building Scalable Distributed Systems\nCurrent week: Week 11 (Replication, Partitioning, Consistency)\nAssignment due: HW9 in 3 days\nLast interaction: 2 hours ago on WhatsApp about Raft leader election"
        },
        {
          "type": "History",
          "function_calls": [{
            "id": "ctx_competency",
            "name": "read_competency",
            "client_side": true,
            "arguments": "{}",
            "response": "Raft consensus: confidence 0.4, stability low, scope [theoretical]. Docker: confidence 0.8, stability confirmed, scope [theoretical, implementation, verbal]. MapReduce: confidence 0.7, stability medium, scope [theoretical, implementation]. Active misconception: believes Raft leader can commit without majority confirmation."
          }]
        },
        {
          "type": "History",
          "function_calls": [{
            "id": "ctx_memory",
            "name": "recall_memory",
            "client_side": true,
            "arguments": "{\"query\": \"learning style preferences\"}",
            "response": "Prefers analogies to real-world systems. Gets frustrated with pure theory — switch to code examples when patience drops. Learns best through 'what happens if X fails' scenarios."
          }]
        },
        {
          "type": "History", "role": "user",
          "content": "I'm stuck on the Raft leader election timeout"
        },
        {
          "type": "History", "role": "assistant",
          "content": "What happens when a follower's election timer fires — walk me through the sequence?"
        }
      ]
    }
  }
}
```

### Mid-Session — WhatsApp Side-Channel Injection

While voice session is active, WhatsApp messages from the student are injected:

```json
{"type": "InjectUserMessage", "content": "[Student sent on WhatsApp: image of terminal showing Go panic 'runtime error: index out of range [5] with length 3' in server.go:42, inside handleRequest function]"}
```

```json
{"type": "InjectUserMessage", "content": "[Student sent on WhatsApp: file main.go]\n```go\nfunc handleRequest(w http.ResponseWriter, r *http.Request) {\n    parts := strings.Split(r.URL.Path, \"/\")\n    id := parts[5] // panic here\n    ...\n}\n```"}
```

### Mid-Session — Strategy Shifts via UpdatePrompt

When competency state changes or mode shifts are needed:

```json
{
  "type": "UpdatePrompt",
  "prompt": "...original prompt...\n\n## STRATEGY SHIFT\nStudent is getting frustrated. Switch from Socratic probing to direct explanation mode. Give them a clear mental model first, THEN ask follow-up questions."
}
```

---

## WhatsApp as Visual Side-Channel

During a voice session, WhatsApp serves as the "screen" — students stay in voice but glance at WhatsApp for visual content.

### Outbound (Voice Agent → WhatsApp)

| Scenario | Voice Agent Action | Server Does | Student Experience |
|----------|-------------------|-------------|-------------------|
| Teaching diagram | Calls `render_diagram(mermaid_code)` | Mermaid CLI → PNG → IPC → Baileys | Voice: "I just sent you a diagram on WhatsApp showing the Raft election flow" |
| Code snippet | Calls `send_to_whatsapp(code)` | IPC → Baileys text message | Voice: "Check WhatsApp — I sent the relevant code section" |
| Teaching illustration | Calls `generate_image(description)` | Nova Canvas → PNG → IPC → Baileys | Voice: "I drew something to help visualize this — it's on WhatsApp" |
| Post-session summary | `end_session` handler | Writes summary message to WhatsApp | Student sees: "Great voice session! Covered X, Y. Your Raft confidence went 0.4→0.6" |

### Inbound (WhatsApp → Voice Agent)

| Student Action | Server Does | Voice Agent Receives |
|----------------|-------------|---------------------|
| Sends image | Downloads → Haiku 4.5 vision → description | `InjectUserMessage: "[Image: screenshot of terminal showing...]"` |
| Sends document | Downloads → extract text (pymupdf/convert_office) | `InjectUserMessage: "[File: report.docx] Content: ..."` |
| Sends voice note | Downloads → Transcribe Streaming → text | `InjectUserMessage: "[Voice note from WhatsApp: I think the problem is...]"` |
| Sends code file | Downloads → reads content | `InjectUserMessage: "[File: main.go]\n\`\`\`go\n...\n\`\`\`"` |
| Sends text message | Reads body | `InjectUserMessage: "[WhatsApp text: can you also look at my server.go?]"` |

### Implementation: WhatsApp Watcher

```typescript
// In voice/server.ts or separate voice/whatsapp-watcher.ts

// When a voice session is active for a student, register a listener
function watchWhatsAppForStudent(studentJid: string, deepgramSession: DeepgramSession) {
  // Subscribe to Baileys message events for this JID
  const handler = async (msg: WAMessage) => {
    if (msg.key.remoteJid !== studentJid) return;
    
    if (msg.message?.imageMessage) {
      // Vision preprocessing
      const imagePath = await downloadMedia(msg);
      const description = await describeImage(imagePath); // Bedrock Haiku vision
      deepgramSession.injectUserMessage(
        `[Student shared an image on WhatsApp: ${description}]`
      );
    } else if (msg.message?.documentMessage) {
      const filePath = await downloadMedia(msg);
      const text = await extractText(filePath); // pymupdf/convert_office
      const fileName = msg.message.documentMessage.fileName;
      deepgramSession.injectUserMessage(
        `[Student sent file "${fileName}" on WhatsApp]\n${text.slice(0, 3000)}`
      );
    } else if (msg.message?.audioMessage) {
      const audioPath = await downloadMedia(msg);
      const transcript = await transcribeAudio(audioPath);
      deepgramSession.injectUserMessage(
        `[Voice note from WhatsApp: ${transcript}]`
      );
    } else if (msg.message?.conversation || msg.message?.extendedTextMessage) {
      const body = msg.message.conversation || msg.message.extendedTextMessage?.text;
      deepgramSession.injectUserMessage(
        `[WhatsApp message: ${body}]`
      );
    }
  };
  
  // Return cleanup function
  return () => { /* unsubscribe handler */ };
}
```

---

## WebSocket Protocol (Deepgram Agent API)

### Connection

```
URL: wss://agent.deepgram.com/v1/agent/converse
Auth: Authorization: Token <DEEPGRAM_API_KEY>
```

### Event Lifecycle

```
Our Server                          Deepgram
    |                                    |
    |--- WebSocket Connect ------------->|
    |<--- Welcome -----------------------|
    |--- Settings ---------------------->|
    |<--- SettingsApplied ---------------|
    |                                    |
    |  (greeting)                        |
    |<--- AgentStartedSpeaking ---------|
    |<--- Binary Audio (chunks) --------|  → relay to browser
    |<--- ConversationText (assistant) -|  → transcript
    |<--- AgentAudioDone ---------------|
    |                                    |
    |--- Binary Audio (user speech) --->|  ← relay from browser
    |<--- UserStartedSpeaking ----------|  (barge-in: stops agent audio)
    |<--- ConversationText (user) ------|  → transcript
    |<--- AgentStartedSpeaking ---------|
    |<--- Binary Audio (chunks) --------|  → relay to browser
    |<--- ConversationText (assistant) -|  → transcript
    |<--- AgentAudioDone ---------------|
    |                                    |
    |  (function call)                   |
    |<--- FunctionCallRequest -----------|
    |  [our server executes function]    |
    |--- FunctionCallResponse --------->|
    |<--- AgentStartedSpeaking ---------|  (agent uses result)
    |<--- Binary Audio ------------------|
    |<--- AgentAudioDone ---------------|
    |                                    |
    |--- InjectUserMessage ------------>|  (WhatsApp side-channel)
    |<--- InjectionRefused -------------|  (if agent is mid-turn — retry after AgentAudioDone)
    |  OR                                |
    |<--- AgentStartedSpeaking ---------|  (if accepted — agent responds)
    |<--- Binary Audio ------------------|
    |                                    |
    |--- UpdateThink ------------------>|  (mode switch: conversational ↔ interviewer)
    |<--- ThinkUpdated -----------------|
    |                                    |
    |--- UpdateSpeak ------------------>|  (voice change on mode switch)
    |<--- SpeakUpdated -----------------|
    |                                    |
    |--- UpdatePrompt ----------------->|  (soft strategy shift — APPENDS to prompt)
    |<--- PromptUpdated ----------------|
    |                                    |
    |--- InjectAgentMessage ----------->|  (timer wrap-up, mode announcements)
    |    (behavior: "queue")             |  (queued = won't be refused)
    |                                    |
    |--- KeepAlive -------------------->|  (every 5s)
```

### Complete Event Types

**Client → Server (10 types):**
| Message | Purpose |
|---------|---------|
| `Settings` | Initial configuration (sent once after Welcome) |
| Binary audio | Raw PCM from browser mic |
| `KeepAlive` | Prevent WebSocket timeout (every 5s) |
| `UpdatePrompt` | APPEND to system prompt (strategy shifts) |
| `UpdateThink` | REPLACE entire Think config (mode switch — prompt + functions + provider) |
| `UpdateSpeak` | Change TTS voice mid-session |
| `InjectUserMessage` | Inject WhatsApp text/file content |
| `InjectAgentMessage` | Force agent to speak specific text (filler, announcements) |
| `FunctionCallResponse` | Return function execution result |
| `Close` | Graceful disconnect |

**Server → Client (15 types):**
| Event | Purpose | Our Handler |
|-------|---------|-------------|
| `Welcome` | Connection acknowledged, provides request_id | Send Settings |
| `SettingsApplied` | Configuration accepted | Start audio relay |
| `ConversationText` | Transcript of user/assistant turns | Log to transcript[] |
| `UserStartedSpeaking` | VAD detected user speech (barge-in) | Relay to browser (stop playback) |
| `AgentThinking` | LLM is processing | Log (optional UI indicator) |
| `FunctionCallRequest` | LLM wants to call a function | Dispatch to handler, send response |
| `AgentStartedSpeaking` | TTS starting, includes latency metrics | Set isAgentSpeaking=true |
| Binary audio | TTS audio chunks | Relay to browser |
| `AgentAudioDone` | TTS finished for this turn | Set isAgentSpeaking=false, flush injection queue |
| `ThinkUpdated` | Think config replaced | Confirm mode switch complete |
| `SpeakUpdated` | TTS voice changed | Confirm voice switch complete |
| `PromptUpdated` | Prompt appended | Confirm strategy shift |
| `InjectionRefused` | InjectUserMessage/AgentMessage rejected (agent busy) | Queue for retry after AgentAudioDone |
| `Error` | Session error | Log, attempt recovery |
| `Warning` | Non-fatal issue | Log |
| `History` | Conversation history message (when flags.history=true) | Track for reconnect |

---

## Settings Messages

### Conversational Mode Settings (Initial)

```json
{
  "type": "Settings",
  "audio": {
    "input": { "encoding": "linear16", "sample_rate": 16000 },
    "output": { "encoding": "linear16", "sample_rate": 24000, "container": "none" }
  },
  "agent": {
    "language": "en",
    "greeting": "hey {firstName}, what's up?",
    "listen": {
      "provider": {
        "type": "deepgram",
        "model": "nova-3",
        "keyterms": ["Paxos", "Raft", "goroutine", "MapReduce", "Kafka", "Docker", "Terraform", "EC2", "ECS", "gRPC", "REST", "CAP theorem", "consistent hashing", "Piazza", "mutex", "WaitGroup", "load balancer", "Coady"],
        "eot_threshold": 0.9,
        "eot_timeout_ms": 3000
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
      "prompt": "<conversational system prompt>",
      "functions": [ /* 17 client-side functions — no endpoint field */ ]
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "model": "aura-2-thalia-en"
      }
    },
    "context": {
      "messages": [ /* pre-loaded student state — see Context Injection */ ]
    }
  },
  "flags": { "history": true }
}
```

### Interviewer Mode (via UpdateThink — NOT a separate Settings message)

When `start_interview` is called, we send these messages on the existing WebSocket:

```json
// Step 1: Swap Think (prompt + functions)
{
  "type": "UpdateThink",
  "think": {
    "provider": {
      "type": "aws_bedrock",
      "model": "anthropic.claude-haiku-4-5-20251001-v1:0",
      "temperature": 0.7,
      "credentials": { /* same as initial */ }
    },
    "prompt": "<interviewer system prompt — includes assignment context, weak spots>",
    "functions": [ /* 4 functions: evaluate_answer, query_knowledge, read_competency, end_interview */ ]
  }
}
// Server responds: {"type": "ThinkUpdated"}

// Step 2: Swap voice
{
  "type": "UpdateSpeak",
  "speak": {
    "provider": { "type": "deepgram", "model": "aura-2-mars-en" }
  }
}
// Server responds: {"type": "SpeakUpdated"}

// Step 3: Agent announces mode change (queued so it doesn't get refused)
{
  "type": "InjectAgentMessage",
  "message": "alright, interview time! tell me about your {assignmentName} — what's the main thing you built?",
  "behavior": "queue"
}
```

To return to conversational mode after interview, the same pattern in reverse:
```json
{"type": "UpdateThink", "think": { /* conversational prompt + 17 functions */ }}
{"type": "UpdateSpeak", "speak": {"provider": {"type": "deepgram", "model": "aura-2-thalia-en"}}}
{"type": "InjectAgentMessage", "message": "nice work! you did great on {strength}. want to keep chatting or are you good?", "behavior": "queue"}
```

---

## System Prompts

### Conversational Agent Prompt

```
You are TAi, a fellow grad-student TA for CS6650 Building Scalable Distributed Systems at Northeastern, taught by Professor Yvonne Coady. You're having a voice conversation with {studentName}.

## THIS IS A VOICE INTERFACE

Everything you generate is spoken aloud immediately by a text-to-speech engine. Only generate the words you are speaking. No formatting, no markdown, no meta-commentary, no asterisks, no bullet points.

## RULES

1. ONE sentence per turn. Two max if the second is very short. Keep it natural — long responses sound robotic when spoken.
2. When teaching: end with exactly ONE question. Never stack two questions.
3. Never give direct homework answers. Guide through questions (Socratic method).
4. Use your functions freely — query_knowledge for grounding, recall_memory for personalization, query_canvas for deadlines, etc. The student doesn't hear the pause (function calls are quick).
5. After substantive teaching exchanges, call update_competency to track what they demonstrated.
6. If you generate a diagram or image, tell them to check WhatsApp.
7. If the student wants to practice for their mock interview, call start_interview to switch modes.

## WHO YOU ARE

You're a friendly grad student who's been through this course. Conversational, casual, genuine.
- Use filler naturally: "hmm", "right", "okay so...", "yeah that makes sense"
- Match their energy. Nervous → warm and slow. Confident → match it.
- It's fine if they say "I'm not sure" — respect honesty, help them reason through it.
- Reference previous conversations naturally: "last time we talked about X..."

## TEACHING STRATEGY

Based on the student's competency state (loaded at session start), adapt:
- confidence LOW + stability LOW → EXPLAIN: build foundation, use analogies
- confidence MEDIUM + stability LOW → SOCRATIC: probe with questions, confirm understanding
- confidence HIGH + scope missing "verbal" → help them articulate (mock interview territory)
- confidence HIGH + scope complete → CHALLENGE: push to edge cases, failure modes
- Active misconception → probe indirectly, don't announce it, ask questions that expose the contradiction

If the student gets frustrated (short answers, sighing, "I don't know"):
- Switch from Socratic to direct explanation
- Give them a clear mental model first, THEN ask questions
- Say: "okay let me just explain how I think about this..."

## WHATSAPP SIDE-CHANNEL

The student has WhatsApp open alongside this voice call. You can:
- Send diagrams: call render_diagram with Mermaid syntax
- Send code snippets: call send_to_whatsapp with formatted code
- Send illustrations: call generate_image with a description
- When you do, tell them: "check WhatsApp, I just sent you..."

If the student sends something on WhatsApp during our call (image, file, text), you'll receive it as an injected message. Respond to it naturally in voice.

## STUDENT CONTEXT

{competencySummary}
{recentWhatsAppHistory}
{courseStatus}
```

### Interviewer Agent Prompt

```
You are TAi, conducting a practice mock interview with {studentName} about {assignmentName} for CS6650.

## THIS IS A VOICE INTERFACE

Everything you generate is spoken aloud. No formatting. Only words you are speaking.

## RULES

1. ONE sentence per turn. ONE question per turn. Never stack questions.
2. Don't answer your own question. Ask it, then stop generating. Wait for their response.
3. After each substantive answer, call evaluate_answer. NEVER speak the evaluation results — no scores, no "you missed X". Use them silently to guide your next question.
4. If evaluate_answer returns difficulty_adjustment "easier", ask a simpler question. If "harder", push to edge cases.
5. Call end_interview when: (a) you've covered enough topics (8-10 questions), or (b) the student says they're done, or (c) the timer is about to end.

## WHO YOU ARE

Same TAi, but in interviewer mode. Still friendly, but more structured.
- Use filler naturally between their answer and your next question
- Acknowledge good answers briefly: "right", "yeah exactly", "nice"
- Don't lecture. If they get something wrong, ask a follow-up that leads them to see the issue.

## INTERVIEW STRUCTURE

1. Start with their general approach to the assignment (warm-up)
2. Drill into specific implementation decisions (code-level)
3. Ask "what happens if..." scenarios (failure modes, edge cases)
4. Test verbal articulation of concepts (can they explain clearly?)
5. Target weak spots from COMPETENCY.md (loaded in context)

## STUDENT CONTEXT

{competencySummary}
{weakConcepts → targeted probing}
{verbalGaps → articulation practice}
{misconceptions → indirect exploration}

## ASSIGNMENT

{assignmentName}: {assignmentSpec}

## THEIR CODE

{codeExcerpts}

## EVALUATE SILENTLY

After each substantive answer, call evaluate_answer with a summary. Use the returned scores to:
- Adjust difficulty (easier/harder based on difficulty_adjustment)
- Target missed_concepts in follow-up questions
- Know when to move on (high scores → new topic)

NEVER mention scores or evaluation in your speech.
```

---

## Function Definitions

### `query_knowledge`

```json
{
  "name": "query_knowledge",
  "description": "Search course knowledge base (LeanRAG) for grounded information about CS6650 topics. Use this FIRST before answering any technical question — ground your response in course materials, not general knowledge. Returns relevant concepts, relationships, and source excerpts from lectures and assignments.",
  "parameters": {
    "type": "object",
    "properties": {
      "question": {
        "type": "string",
        "description": "The topic or question to search for (e.g., 'How does Raft handle leader failure?')"
      },
      "difficulty": {
        "type": "string",
        "enum": ["entity", "cluster", "theme"],
        "description": "Search depth: 'entity' for specific facts, 'cluster' for topic-level, 'theme' for broad concepts"
      }
    },
    "required": ["question"]
  }
}
```

### `recall_memory`

```json
{
  "name": "recall_memory",
  "description": "Retrieve stored memories about this student — preferences, past breakthroughs, effective teaching approaches, communication style notes. Use when you want to personalize your response or recall something from a previous conversation.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for memories (e.g., 'learning style', 'Docker misconception', 'what worked before')"
      }
    },
    "required": ["query"]
  }
}
```

### `save_memory`

```json
{
  "name": "save_memory",
  "description": "Store a new memory about this student for future conversations. Use for: breakthroughs, newly discovered preferences, effective teaching approaches, important context. Don't store routine facts.",
  "parameters": {
    "type": "object",
    "properties": {
      "content": {
        "type": "string",
        "description": "The fact or observation to remember"
      },
      "decay_class": {
        "type": "string",
        "enum": ["permanent", "stable", "active"],
        "description": "How long to keep: 'permanent' for preferences/breakthroughs, 'stable' (90d) for learning context, 'active' (14d) for temporary state"
      }
    },
    "required": ["content", "decay_class"]
  }
}
```

### `read_competency`

```json
{
  "name": "read_competency",
  "description": "Read the student's full competency model — mastery levels, stability, scope coverage, active misconceptions, and teaching strategy history. Use at session start or when you need to check their state on a specific topic.",
  "parameters": {
    "type": "object",
    "properties": {
      "topic": {
        "type": "string",
        "description": "Optional: filter to a specific topic (e.g., 'Raft consensus'). Omit to get full model."
      }
    }
  }
}
```

### `update_competency`

```json
{
  "name": "update_competency",
  "description": "Update the student's mastery state after a teaching interaction. Call this when: (a) they demonstrated understanding of a concept, (b) you discovered a new misconception, (c) they showed verbal articulation of something previously only theoretical, (d) confidence changed. DO NOT call for trivial exchanges.",
  "parameters": {
    "type": "object",
    "properties": {
      "concept": {
        "type": "string",
        "description": "The concept being tracked (e.g., 'Raft leader election')"
      },
      "confidence_delta": {
        "type": "number",
        "description": "Change in confidence (-0.3 to +0.3). Positive = demonstrated understanding."
      },
      "new_scope": {
        "type": "string",
        "enum": ["theoretical", "implementation", "debugging", "verbal"],
        "description": "New scope dimension demonstrated (if any)"
      },
      "misconception": {
        "type": "string",
        "description": "New misconception discovered (if any). Only record if student genuinely believes something incorrect."
      },
      "notes": {
        "type": "string",
        "description": "Brief note on what happened (e.g., 'Explained Raft timeout clearly in own words')"
      }
    },
    "required": ["concept"]
  }
}
```

### `query_canvas`

```json
{
  "name": "query_canvas",
  "description": "Query Canvas LMS for course information: assignments, grades, deadlines, submissions, announcements, discussions. The student's Canvas ID is already known — results are identity-bound.",
  "parameters": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["assignments", "grades", "submissions", "announcements", "discussions", "deadlines", "modules", "files"],
        "description": "What to look up"
      },
      "assignment_id": {
        "type": "string",
        "description": "Optional: specific assignment ID for submission/grade lookup"
      }
    },
    "required": ["action"]
  }
}
```

### `query_github`

```json
{
  "name": "query_github",
  "description": "Query the student's GitHub repositories: list repos, view file content, see commits, check PRs. Identity-bound to the student's registered GitHub username.",
  "parameters": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["list_repos", "repo_tree", "file_content", "commits", "commit_detail", "pull_requests"],
        "description": "What to look up"
      },
      "repo": {
        "type": "string",
        "description": "Repository name (required for most actions except list_repos)"
      },
      "path": {
        "type": "string",
        "description": "File path within repo (for file_content action)"
      }
    },
    "required": ["action"]
  }
}
```

### `get_youtube_content`

```json
{
  "name": "get_youtube_content",
  "description": "Get the full transcript and metadata of a YouTube video. Use when a student references a video or when you need to discuss video content from the course.",
  "parameters": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "YouTube video URL"
      }
    },
    "required": ["url"]
  }
}
```

### `browse_url`

```json
{
  "name": "browse_url",
  "description": "Fetch and extract readable text from any URL. Renders JavaScript. Use for documentation, papers, tutorials, or any web resource the student or course references.",
  "parameters": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The URL to fetch"
      }
    },
    "required": ["url"]
  }
}
```

### `access_sharepoint`

```json
{
  "name": "access_sharepoint",
  "description": "Access content from Northeastern SharePoint or OneDrive. Handles authentication automatically. Use for lecture recordings, shared course materials, or professor's files.",
  "parameters": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The SharePoint or OneDrive URL"
      }
    },
    "required": ["url"]
  }
}
```

### `read_file`

```json
{
  "name": "read_file",
  "description": "Read a file the student uploaded on WhatsApp. Supports PDF, DOCX, XLSX, PPTX, and all code/text files. Returns extracted text content.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "File path (provided in the injection message when student sends a file)"
      }
    },
    "required": ["path"]
  }
}
```

### `generate_image`

```json
{
  "name": "generate_image",
  "description": "Generate a teaching illustration using AI image generation and send it to the student on WhatsApp. Use for: visualizing architectures, explaining concepts visually, creating diagrams that are too complex for Mermaid. Tell the student to check WhatsApp after calling.",
  "parameters": {
    "type": "object",
    "properties": {
      "description": {
        "type": "string",
        "description": "Detailed description of what to generate (e.g., 'A diagram showing 3 Raft nodes with one leader sending heartbeats to two followers, arrows showing log replication')"
      }
    },
    "required": ["description"]
  }
}
```

### `render_diagram`

```json
{
  "name": "render_diagram",
  "description": "Render a technical diagram from Mermaid syntax and send it to the student on WhatsApp. Use for: sequence diagrams, flowcharts, architecture diagrams, state machines. Tell the student to check WhatsApp after calling.",
  "parameters": {
    "type": "object",
    "properties": {
      "mermaid_code": {
        "type": "string",
        "description": "Valid Mermaid diagram syntax (sequenceDiagram, flowchart, stateDiagram, etc.)"
      },
      "caption": {
        "type": "string",
        "description": "Short caption to send with the diagram on WhatsApp"
      }
    },
    "required": ["mermaid_code"]
  }
}
```

### `send_to_whatsapp`

```json
{
  "name": "send_to_whatsapp",
  "description": "Send a text message or code snippet to the student on WhatsApp. Use when you want them to SEE something: code examples, URLs, formatted content, or any reference material they should keep. Tell the student to check WhatsApp after calling.",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "The text/code to send. Can include WhatsApp formatting (*bold*, _italic_, ```code```)."
      }
    },
    "required": ["message"]
  }
}
```

### `schedule_task`

```json
{
  "name": "schedule_task",
  "description": "Schedule a follow-up task for this student. Use when: they mention wanting a reminder, you want to check back on a concept later, or they need practice before a deadline.",
  "parameters": {
    "type": "object",
    "properties": {
      "description": {
        "type": "string",
        "description": "What the follow-up should do (e.g., 'Check if student practiced Raft verbal explanation')"
      },
      "when": {
        "type": "string",
        "description": "When to trigger: ISO timestamp or relative (e.g., '2026-05-21T09:00:00', 'tomorrow 9am')"
      }
    },
    "required": ["description", "when"]
  }
}
```

### `start_interview`

```json
{
  "name": "start_interview",
  "description": "Switch to mock interview mode. Call this when the student wants to practice for their mock interview OR when you detect they have verbal gaps that need practice. The system will seamlessly transition to interview mode.",
  "parameters": {
    "type": "object",
    "properties": {
      "topic": {
        "type": "string",
        "description": "Primary topic to interview on (e.g., 'Raft consensus', 'Docker networking')"
      },
      "assignment_id": {
        "type": "string",
        "description": "Optional: specific Canvas assignment to base questions on"
      }
    },
    "required": ["topic"]
  }
}
```

### `end_session`

```json
{
  "name": "end_session",
  "description": "End the voice session gracefully. Call when: student says goodbye, says they're done, or the conversation has naturally concluded. The system will write a summary to WhatsApp and update competency tracking.",
  "parameters": {
    "type": "object",
    "properties": {
      "summary_note": {
        "type": "string",
        "description": "Brief note about what was covered (for the post-session WhatsApp message)"
      }
    },
    "required": ["summary_note"]
  }
}
```

### `evaluate_answer` (Interviewer Agent only)

```json
{
  "name": "evaluate_answer",
  "description": "Evaluate the student's answer to your last question. Call this after each substantive student response. DO NOT speak the results — use them silently to pick your next question and adjust difficulty.",
  "parameters": {
    "type": "object",
    "properties": {
      "question_asked": {
        "type": "string",
        "description": "The question you just asked"
      },
      "student_answer_summary": {
        "type": "string",
        "description": "Summary of what the student said"
      },
      "topic": {
        "type": "string",
        "description": "The CS6650 topic being tested"
      }
    },
    "required": ["question_asked", "student_answer_summary", "topic"]
  }
}
```

### `end_interview` (Interviewer Agent only)

```json
{
  "name": "end_interview",
  "description": "End the mock interview. Call when: (a) you've asked 8-10 questions and covered enough ground, (b) the student says they want to stop, or (c) the timer is ending. Say a brief closing remark BEFORE calling this — something they did well and one thing to work on.",
  "parameters": {
    "type": "object",
    "properties": {
      "topics_covered": {
        "type": "string",
        "description": "Comma-separated list of topics covered"
      },
      "overall_impression": {
        "type": "string",
        "description": "Brief assessment for the competency file"
      }
    },
    "required": ["topics_covered", "overall_impression"]
  }
}
```

---

## VoiceOrchestrator Design (Simplified — Single WebSocket)

```typescript
// voice/voice-orchestrator.ts

import WebSocket from 'ws';
import { evaluateAnswer } from './shadow-evaluator.js';

const DEEPGRAM_WS_URL = 'wss://agent.deepgram.com/v1/agent/converse';
const SESSION_DURATION_MS = 30 * 60 * 1000;   // 30 min max total
const INTERVIEW_DURATION_MS = 15 * 60 * 1000; // 15 min max interview
const KEEPALIVE_INTERVAL_MS = 5000;
const RECONNECT_GRACE_MS = 30 * 1000;

type AgentMode = 'conversational' | 'interviewer';

interface VoiceSession {
  token: string;
  studentFolder: string;
  studentJid: string;
  mode: AgentMode;
  ws: WebSocket | null;
  transcript: TranscriptEntry[];
  evaluations: EvaluationResult[];
  startTime: number;
  interviewStartTime: number | null;
  keepAliveInterval: NodeJS.Timeout | null;
  isAgentSpeaking: boolean;          // Track for InjectionRefused handling
  pendingInjections: string[];       // Queue for WhatsApp messages during agent speech
  closed: boolean;
}

export class VoiceOrchestrator {
  private session: VoiceSession;
  private onAudio: (chunk: Buffer) => void;
  private onDone: (summary: SessionSummary) => void;
  private onInterrupted: () => void;
  private whatsAppWatcher: (() => void) | null = null;

  async start(): Promise<void> {
    this.session.ws = new WebSocket(DEEPGRAM_WS_URL, {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
    });

    this.session.ws.on('open', () => { /* wait for Welcome */ });
    this.session.ws.on('message', (data, isBinary) => {
      if (isBinary) {
        this.onAudio(Buffer.from(data as ArrayBuffer));
      } else {
        this.handleEvent(JSON.parse(data.toString()));
      }
    });
  }

  // Mode switch: Conversational → Interviewer (SAME WebSocket)
  async switchToInterviewer(topic: string, assignmentId?: string): Promise<void> {
    const interviewContext = await this.loadInterviewContext(topic, assignmentId);
    
    // Send UpdateThink — replaces prompt + functions in one message
    this.send({
      type: 'UpdateThink',
      think: {
        provider: this.buildBedrockProvider(),
        prompt: this.buildInterviewerPrompt(interviewContext),
        functions: INTERVIEWER_FUNCTIONS, // 4 focused functions
      },
    });
    await this.waitForEvent('ThinkUpdated');

    // Change voice to signal mode shift
    this.send({ type: 'UpdateSpeak', speak: { provider: { type: 'deepgram', model: 'aura-2-mars-en' } } });
    await this.waitForEvent('SpeakUpdated');

    // Announce the transition (queued = won't be refused)
    this.send({
      type: 'InjectAgentMessage',
      message: `alright, interview time! tell me about your ${interviewContext.assignmentName} — what's the main thing you built?`,
      behavior: 'queue',
    });

    this.session.mode = 'interviewer';
    this.session.interviewStartTime = Date.now();
  }

  // Mode switch: Interviewer → Conversational (SAME WebSocket)
  async switchToConversational(interviewSummary: InterviewSummary): Promise<void> {
    // Write results before switching
    await this.writeInterviewResults(interviewSummary);

    this.send({
      type: 'UpdateThink',
      think: {
        provider: this.buildBedrockProvider(),
        prompt: this.buildConversationalPrompt(),
        functions: CONVERSATIONAL_FUNCTIONS, // 17 full functions
      },
    });
    await this.waitForEvent('ThinkUpdated');

    this.send({ type: 'UpdateSpeak', speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } } });
    await this.waitForEvent('SpeakUpdated');

    this.send({
      type: 'InjectAgentMessage',
      message: `nice work! you did great on ${interviewSummary.strengths[0]}. want to keep chatting or are you good for today?`,
      behavior: 'queue',
    });

    this.session.mode = 'conversational';
    this.session.interviewStartTime = null;
  }

  // WhatsApp side-channel injection WITH InjectionRefused handling
  injectFromWhatsApp(content: string): void {
    if (this.session.isAgentSpeaking) {
      // Queue — will be flushed when AgentAudioDone fires
      this.session.pendingInjections.push(content);
    } else {
      this.send({ type: 'InjectUserMessage', content });
    }
  }

  private flushPendingInjections(): void {
    while (this.session.pendingInjections.length > 0) {
      const content = this.session.pendingInjections.shift()!;
      this.send({ type: 'InjectUserMessage', content });
    }
  }

  private async handleFunctionCall(event: FunctionCallRequestEvent): Promise<void> {
    for (const fn of event.functions) {
      let result: string;
      
      switch (fn.name) {
        case 'query_knowledge':
          result = await this.executeQueryKnowledge(fn.arguments);
          break;
        case 'recall_memory':
          result = await this.executeRecallMemory(fn.arguments);
          break;
        case 'save_memory':
          result = await this.executeSaveMemory(fn.arguments);
          break;
        case 'read_competency':
          result = await this.executeReadCompetency(fn.arguments);
          break;
        case 'update_competency':
          result = await this.executeUpdateCompetency(fn.arguments);
          break;
        case 'query_canvas':
          result = await this.executeQueryCanvas(fn.arguments);
          break;
        case 'query_github':
          result = await this.executeQueryGithub(fn.arguments);
          break;
        case 'evaluate_answer':
          result = await this.executeEvaluateAnswer(fn.arguments);
          break;
        case 'start_interview':
          // Mode switch via UpdateThink (no WebSocket reconnect)
          this.sendFunctionResponse(fn.id, fn.name, '{"status": "switching to interview mode"}');
          const startArgs = JSON.parse(fn.arguments);
          await this.switchToInterviewer(startArgs.topic, startArgs.assignment_id);
          return;
        case 'end_interview':
          this.sendFunctionResponse(fn.id, fn.name, '{"status": "ending interview"}');
          const summary = this.buildInterviewSummary();
          await this.switchToConversational(summary);
          return;
        case 'end_session':
          this.sendFunctionResponse(fn.id, fn.name, '{"status": "ending session"}');
          // Give agent 3s to speak farewell (already queued before this call)
          await new Promise(r => setTimeout(r, 3000));
          await this.endSession(JSON.parse(fn.arguments).summary_note);
          return;
        case 'generate_image':
          result = await this.executeGenerateImage(fn.arguments);
          break;
        case 'render_diagram':
          result = await this.executeRenderDiagram(fn.arguments);
          break;
        case 'send_to_whatsapp':
          result = await this.executeSendToWhatsapp(fn.arguments);
          break;
        case 'get_youtube_content':
          result = await this.executeGetYoutubeContent(fn.arguments);
          break;
        case 'browse_url':
          result = await this.executeBrowseUrl(fn.arguments);
          break;
        case 'access_sharepoint':
          result = await this.executeAccessSharepoint(fn.arguments);
          break;
        case 'read_file':
          result = await this.executeReadFile(fn.arguments);
          break;
        case 'schedule_task':
          result = await this.executeScheduleTask(fn.arguments);
          break;
        default:
          result = JSON.stringify({ error: `Unknown function: ${fn.name}` });
      }
      
      this.sendFunctionResponse(fn.id, fn.name, result);
    }
  }

  private sendFunctionResponse(id: string, name: string, content: string): void {
    this.send({ type: 'FunctionCallResponse', id, name, content });
  }

  private send(msg: Record<string, unknown>): void {
    if (this.session.ws?.readyState === WebSocket.OPEN) {
      this.session.ws.send(JSON.stringify(msg));
    }
  }

  private handleEvent(event: Record<string, unknown>): void {
    switch (event.type) {
      case 'Welcome':
        this.sendSettings(); // Send initial Settings after Welcome
        break;
      case 'SettingsApplied':
        this.startTimers();
        this.resolveWaiter('SettingsApplied');
        break;
      case 'ConversationText':
        this.session.transcript.push({
          role: (event.role as string) === 'user' ? 'student' : 'interviewer',
          text: event.content as string,
          timestamp: Date.now(),
          agent: this.session.mode,
        });
        break;
      case 'UserStartedSpeaking':
        this.session.isAgentSpeaking = false;
        this.onInterrupted(); // Tell browser to stop playback
        break;
      case 'AgentStartedSpeaking':
        this.session.isAgentSpeaking = true;
        break;
      case 'AgentAudioDone':
        this.session.isAgentSpeaking = false;
        this.flushPendingInjections(); // Retry queued WhatsApp messages
        break;
      case 'FunctionCallRequest':
        this.handleFunctionCall(event as FunctionCallRequestEvent);
        break;
      case 'ThinkUpdated':
        this.resolveWaiter('ThinkUpdated');
        break;
      case 'SpeakUpdated':
        this.resolveWaiter('SpeakUpdated');
        break;
      case 'InjectionRefused':
        // Message was refused — it's already in pendingInjections queue
        // Will be retried on next AgentAudioDone
        break;
      case 'Error':
        console.error('[deepgram] Error:', event.description, event.code);
        break;
      case 'Warning':
        console.warn('[deepgram] Warning:', event.description);
        break;
    }
  }

  // Helper: wait for a specific event type (used for UpdateThink/UpdateSpeak confirmations)
  private waiters = new Map<string, () => void>();
  private waitForEvent(eventType: string, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${eventType}`)), timeoutMs);
      this.waiters.set(eventType, () => { clearTimeout(timer); resolve(); });
    });
  }
  private resolveWaiter(eventType: string): void {
    this.waiters.get(eventType)?.();
    this.waiters.delete(eventType);
  }
}
```

---

## Lessons from Reference Implementation (deepgram-voice-agent-multi-agent)

After studying the Deepgram multi-agent reference repo and cross-referencing with TAi's text agent architecture, the following patterns inform our design:

### 1. Single WebSocket + UpdateThink (Simplified from Reference)

The reference repo uses **multiple WebSocket connections** (one per agent, closed/opened on handoff) because it targets Twilio phone calls where the audio relay is a separate persistent layer.

**TAi's approach is simpler:** We use a **single Deepgram WebSocket** for the entire session. Mode switching (Conversational ↔ Interviewer) is done via `UpdateThink` + `UpdateSpeak` — zero audio gap, conversation history preserved, no buffer/flush needed. This is possible because Deepgram added `UpdateThink` in Feb 2026 (after the reference repo was written).

### 2. Context Summarization Between Agents (Not Raw History)

The reference uses Groq/Llama to summarize conversations to 2-3 sentences before passing to the next agent. This prevents context bloat and keeps each agent focused.

**TAi application:** We use Bedrock Haiku (already available, no extra API key) instead of Groq. The summarization happens server-side when `start_interview` is called:

```typescript
async function summarizeForHandoff(
  transcript: TranscriptEntry[],
  fromAgent: 'conversational' | 'interviewer',
  toAgent: 'conversational' | 'interviewer',
  studentFolder: string,
): Promise<string> {
  const historyText = transcript
    .slice(-20) // Last 20 exchanges max
    .map(t => `${t.role.toUpperCase()}: ${t.text}`)
    .join('\n');

  const prompt = fromAgent === 'conversational' && toAgent === 'interviewer'
    ? `Summarize this tutoring conversation for an INTERVIEWER who will now conduct a mock interview.\n\nConversation:\n${historyText}\n\nExtract:\n- Topics the student discussed (what they're comfortable with)\n- Any gaps or confusion observed\n- The student's current mood/energy\n- What prompted the interview request\n\nWrite 2-3 sentences as a colleague briefing.`
    : `Summarize this mock interview for a TUTOR who will continue chatting with the student.\n\nInterview:\n${historyText}\n\nExtract:\n- Topics covered and student performance\n- Strengths demonstrated\n- Weaknesses to follow up on\n- Student's confidence level at the end\n\nWrite 2-3 sentences as a colleague briefing.`;

  const response = await bedrockInvoke('us.anthropic.claude-haiku-4-5-20251001-v1:0', prompt, 200);
  return response;
}
```

The summary is injected as a `CONTEXT FROM PREVIOUS CONVERSATION:` prefix in the new agent's system prompt — exactly as the reference repo does.

### 3. Function Descriptions are Training Documents

The reference repo's function definitions include explicit WHEN TO CALL, CORRECT PATTERN, and WRONG PATTERN sections. This dramatically improves LLM reliability with function calls.

**TAi application:** Every function description should include behavioral guidance. Updated `start_interview` example:

```json
{
  "name": "start_interview",
  "description": "Switch to mock interview mode.\n\nWHEN TO CALL:\n- Student explicitly asks: 'let's practice', 'mock interview', 'interview me'\n- You detect they have verbal gaps and they agree to practice\n- NEVER call without student confirmation\n\nCORRECT PATTERN:\n1. You suggest: 'Want to do a quick mock interview on Raft?'\n2. WAIT for student response\n3. Student confirms: 'yeah let's do it'\n4. IMMEDIATELY call start_interview without additional text\n\nWRONG PATTERN:\n- Calling this mid-explanation without asking\n- Saying 'let me switch to interview mode' then calling\n- Generating text after calling the function",
  "parameters": { ... }
}
```

### 4. Wait Gates (SettingsApplied, ThinkUpdated, SpeakUpdated)

The reference waits for `SettingsApplied` event before sending audio. We use the same pattern but generalized via `waitForEvent()`:
- **Initial connect:** wait for `SettingsApplied` before relaying browser audio
- **Mode switch:** wait for `ThinkUpdated` + `SpeakUpdated` before injecting the mode announcement
- **Timeout:** 5 seconds — if not received, log error and continue (don't hang the session)

### 5. Distinct Voice Per Agent Mode (Signals Transition)

The reference uses different TTS voices for each agent (Mars, Thalia, Helena) so the caller perceives the transition as talking to a "different person."

**TAi application:** We use different voices for different modes, but subtly — it's still "TAi":
- **Conversational Agent:** `aura-2-thalia-en` (warm, conversational female)
- **Interviewer Agent:** `aura-2-mars-en` (slightly more authoritative male)

This gives the student an audible cue that they've entered "interview mode" — the voice shifts, reinforcing the behavioral change. The greeting confirms it: "Alright, interview time! Tell me about your assignment..."

### 6. Greeting Auto-Play on Agent Start

When Deepgram receives Settings with a `greeting` field, the agent immediately speaks it without any user input. This is critical for seamless transitions — the student hears the new agent introduce itself naturally.

**TAi application:**
- **Conversational start:** `"hey {firstName}, what's up?"` (casual opener)
- **Interview handoff:** `"alright, let's do this! tell me about your {assignment} — what's the main thing you built?"` (immediate topic focus)
- **Post-interview return:** `"nice work! you did well on {strength}. want to keep chatting or are you good for today?"` (warm closing + choice)

### 7. Pre-Flight Context Assembly (from TAi Text Agent)

TAi's text agent writes `memory_context.md` and `memory_store.json` to the group folder BEFORE the container starts. The agent reads them as part of its system prompt.

**Voice equivalent:** Before the voice session begins (when the student opens the link), the server assembles all context and injects it via `context.messages`:

```typescript
async function buildContextMessages(studentFolder: string, studentJid: string): Promise<HistoryMessage[]> {
  const messages: HistoryMessage[] = [];
  
  // 1. COMPETENCY.md snapshot (as function call result — agent "remembers" it called read_competency)
  const competency = await fs.readFile(`groups/${studentFolder}/COMPETENCY.md`, 'utf8');
  messages.push({
    type: 'History',
    function_calls: [{
      id: 'ctx_comp', name: 'read_competency', client_side: true,
      arguments: '{}',
      response: summarizeCompetency(competency) // Parse and condense to key facts
    }]
  });

  // 2. Recent memories (top-6 FTS-ranked by recent topics)
  const memories = await queryMemories(studentFolder, 6);
  if (memories.length > 0) {
    messages.push({
      type: 'History',
      function_calls: [{
        id: 'ctx_mem', name: 'recall_memory', client_side: true,
        arguments: '{"query": "student context"}',
        response: memories.map(m => m.text).join('\n')
      }]
    });
  }

  // 3. Last 5 WhatsApp messages (continuity with text channel)
  const recentMsgs = await getRecentMessages(studentJid, 5);
  for (const msg of recentMsgs) {
    messages.push({
      type: 'History',
      role: msg.sender === studentJid ? 'user' : 'assistant',
      content: msg.body
    });
  }

  return messages;
}
```

This mirrors the text agent's pre-flight injection pattern — the voice agent starts with full student context without needing any function calls.

### 8. IPC-Based Side Effects (from TAi Text Agent)

The text agent uses JSON files in `/workspace/ipc/` for side effects (send_message, schedule_task, etc.). The host watches these directories asynchronously.

**Voice equivalent:** Functions that produce WhatsApp side effects (`generate_image`, `render_diagram`, `send_to_whatsapp`) write to the same IPC mechanism the text agent uses. This means:
- The main process (WhatsApp orchestrator) already has watchers for these directories
- No new infrastructure needed — voice functions reuse the existing IPC → Baileys path
- Race conditions are handled by the existing per-group queue

```typescript
async executeRenderDiagram(argsJson: string): Promise<string> {
  const { mermaid_code, caption } = JSON.parse(argsJson);
  
  // Write IPC file — same format as text agent's render_diagram tool
  const ipcFile = {
    type: 'render_diagram',
    chatJid: this.session.studentJid,
    mermaid_syntax: mermaid_code,
    caption: caption || '',
    timestamp: Date.now(),
  };
  
  await fs.writeFile(
    `data/ipc/${this.session.studentFolder}/messages/${Date.now()}-diagram.json`,
    JSON.stringify(ipcFile)
  );
  
  return JSON.stringify({ status: 'sent', message: 'Diagram sent to WhatsApp' });
}
```

### 9. CompetencyGuard (from TAi Text Agent)

The text agent has a PreToolUse hook that prevents bulk confidence inflation (max 2 concepts set to >= 0.8 per edit). The voice agent needs the same protection.

**Voice application:** The `update_competency` function handler validates changes server-side:

```typescript
async executeUpdateCompetency(argsJson: string): Promise<string> {
  const args = JSON.parse(argsJson);
  
  // CompetencyGuard: limit confidence changes
  if (args.confidence_delta && Math.abs(args.confidence_delta) > 0.3) {
    args.confidence_delta = Math.sign(args.confidence_delta) * 0.3;
  }
  
  // Track high-confidence updates per session (same guard as text agent)
  if (args.confidence_delta > 0) {
    this.highConfidenceUpdates++;
    if (this.highConfidenceUpdates > 5) {
      return JSON.stringify({ error: 'Too many confidence increases per session. Updates will be applied post-session.' });
    }
  }
  
  // Apply to COMPETENCY.md
  await applyCompetencyUpdate(this.session.studentFolder, args);
  return JSON.stringify({ status: 'updated', concept: args.concept });
}
```

### 10. Handoff Timing Pattern (from Reference Repo)

The reference repo sends the function call response FIRST, then waits 0.5s, THEN performs the transition. This ensures the current agent processes the response before being disconnected.

```typescript
case 'start_interview':
  // Step 1: Respond to current agent
  this.sendFunctionResponse(fn.id, fn.name, '{"status": "transitioning"}');
  
  // Step 2: Brief pause (let Deepgram process the response)
  await new Promise(r => setTimeout(r, 500));
  
  // Step 3: Perform transition
  const { topic, assignment_id } = JSON.parse(fn.arguments);
  await this.transitionToInterviewer(topic, assignment_id);
  return; // Don't send another response

case 'end_interview':
  this.sendFunctionResponse(fn.id, fn.name, '{"status": "ending"}');
  await new Promise(r => setTimeout(r, 500));
  await this.transitionBackToConversational(this.buildInterviewSummary());
  return;

case 'end_session':
  this.sendFunctionResponse(fn.id, fn.name, '{"status": "goodbye"}');
  // Give agent 3 seconds to speak its farewell (same as reference)
  await new Promise(r => setTimeout(r, 3000));
  await this.endSession(JSON.parse(fn.arguments).summary_note);
  return;
```

### 11. Conversation History Tracking (from Reference Repo)

The reference tracks `conversation_history: List[Dict[str, str]]` by listening for `ConversationText` events. This is used for: (a) context summarization at handoff, (b) post-call analysis.

**TAi application:** We already have `transcript: TranscriptEntry[]` in the session state. Enhanced:

```typescript
private handleConversationText(event: { role: string; content: string }): void {
  this.session.transcript.push({
    role: event.role === 'user' ? 'student' : 'interviewer',
    text: event.content,
    timestamp: Date.now(),
    agent: this.session.mode, // Track which agent said it
  });
}
```

After the session, this full transcript is:
1. Summarized → written to SQLite as a `voice_summary` message
2. Raw transcript → written to `groups/{student}/competency/voice-sessions.md` (for text agent reference)
3. Interview portions → scored and written to `competency/interviews.md`

### 12. Double-Cleanup Prevention (from Reference Repo)

The reference has a `cleanup_done` flag to prevent re-entrant cleanup. Important because disconnects can fire multiple times.

```typescript
private cleanupDone = false;

async cleanup(): Promise<void> {
  if (this.cleanupDone) return;
  this.cleanupDone = true;
  
  this.audioRelayActive = false;
  if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
  if (this.whatsAppWatcher) this.whatsAppWatcher(); // Unsubscribe
  this.currentAgentWs?.close();
  
  // Write final results only once
  await this.writeSessionResults();
}
```

---

## Post-Session Sync (Bidirectional)

After voice session ends, our server ensures both channels stay in sync:

### 1. Write to SQLite

```sql
INSERT INTO messages (sender, body, timestamp, type, group_folder)
VALUES (
  'voice_session',
  '[Voice session transcript — 14 min, topics: Raft consensus, Docker networking. Student showed strong implementation knowledge of Docker, weak verbal articulation of Raft leader election.]',
  :timestamp,
  'voice_summary',
  :studentFolder
);
```

### 2. Update COMPETENCY.md

Any `update_competency` calls made during the session are already written. Additionally:
- If interview mode was used: write mock interview scores (same as current `competency-writer.ts`)
- Add "verbal" scope to concepts discussed in voice (student articulated them)

### 3. Update Memories

Any `save_memory` calls made during the session are already written.

### 4. Send WhatsApp Summary

One message to the student after the session closes:

```
Had a great voice session! We covered Raft leader election and Docker networking.

Your Raft confidence went from 0.4 → 0.6 — nice progress on explaining the election timeout mechanism.

Next step: practice explaining log replication verbally (that's still a gap). Hit me up anytime to practice!
```

### 5. Text Agent Continuity

Next time the text agent spawns for this student (via WhatsApp message), it sees:
- Updated COMPETENCY.md (new scores, new verbal scope)
- Voice session summary in SQLite messages
- Updated memories
- It can naturally say: "Hey! Last time we talked (in voice), you were working on Raft election timeouts. How's that going?"

---

## Session Management

### Duration Control

```typescript
// Server-side timers
const SESSION_START = Date.now();

// At 29 min: warn wrap-up
if (elapsed >= 29 * 60 * 1000 && !wrapUpSent) {
  ws.send(JSON.stringify({
    type: 'UpdatePrompt',
    prompt: originalPrompt + '\n\n## WRAP UP NOW\nWe have about 1 minute left. Wrap up naturally — mention what was covered and end warmly.'
  }));
  wrapUpSent = true;
}

// At 30 min: inject closing, then end
if (elapsed >= 30 * 60 * 1000) {
  ws.send(JSON.stringify({
    type: 'InjectAgentMessage',
    message: "Alright, that's our time! Great chat today. Reach out on WhatsApp anytime if more questions come up!",
    behavior: 'queue'
  }));
  setTimeout(() => endSession(), 8000);
}

// Interview mode: 15 min limit
if (mode === 'interviewer' && interviewElapsed >= 14 * 60 * 1000) {
  ws.send(JSON.stringify({
    type: 'UpdatePrompt',
    prompt: interviewPrompt + '\n\n## WRAP UP\nTime is almost up. Ask one final question, give brief feedback, then call end_interview.'
  }));
}
```

### Reconnect Design

```
Browser disconnects (network drop, page refresh):
  → Socket.IO 'disconnect' event fires on server
  → Server starts 30s grace timer
  → VoiceOrchestrator keeps running (Deepgram WebSocket stays open)
  → KeepAlive messages continue to Deepgram

If browser reconnects within 30s:
  → New Socket.IO connection with same token
  → Server validates token, finds active VoiceOrchestrator in Map
  → Resumes audio relay (server → browser, browser → server)
  → No interruption to Deepgram conversation

If 30s expires with no reconnect:
  → Close Deepgram WebSocket
  → Write session results (competency, memories, summary)
  → Send WhatsApp summary
  → Token NOT marked completed if duration < 1 min (failed sessions)
```

### Session Resume (Full Reconnect)

If the Deepgram WebSocket itself drops (rare — their infrastructure), reconnect with full history:

```json
{
  "type": "Settings",
  "agent": {
    "context": {
      "messages": [
        {"type": "History", "role": "assistant", "content": "hey Yuzheng, what's up?"},
        {"type": "History", "role": "user", "content": "hey! working on the Raft assignment"},
        {"type": "History", "role": "assistant", "content": "nice! walk me through your leader election implementation"},
        {"type": "History", "function_calls": [{
          "id": "fc_1", "name": "query_knowledge", "client_side": true,
          "arguments": "{\"question\": \"Raft leader election\"}",
          "response": "{\"concepts\": [...]}"
        }]},
        {"type": "History", "role": "user", "content": "so when a follower's timer expires..."}
      ]
    }
  }
}
```

---

## Browser Client

### What Gets Simpler (vs Nova Sonic)

The current `interview.js` has complex echo prevention:
- `isPlaying` flag tracking
- Silence injection during playback
- MediaStreamTrackProcessor vs AudioWorklet choice
- Silent buffer pre-play to lock media mode

With Deepgram, **none of this is needed**. Barge-in is handled server-side. The browser just:
1. Captures mic audio (MediaStreamTrackProcessor or getUserMedia)
2. Sends raw PCM via Socket.IO
3. Plays received audio chunks through AudioContext
4. Handles `agent_interrupted` event (clear playback queue)

### New: Barge-In UX

```javascript
this.socket.on('agent_interrupted', () => {
  this.playbackQueue = [];
  if (this.currentSource) {
    this.currentSource.onended = null;
    try { this.currentSource.stop(); } catch (_) {}
  }
  this.isPlaying = false;
  // Update UI: show "listening" indicator
});
```

### What Stays the Same

- Socket.IO connection to our server (same token auth)
- 16kHz mono PCM capture → binary/base64 → Socket.IO
- 24kHz PCM playback via AudioBufferSourceNode
- Timer display, status indicators
- HMAC token validation on page load

---

## Image Vision Preprocessing

When a student sends an image on WhatsApp during a voice session:

```typescript
async function describeImage(imagePath: string): Promise<string> {
  const imageBytes = await fs.readFile(imagePath);
  const base64 = imageBytes.toString('base64');
  const mediaType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  
  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          {
            type: 'text',
            text: 'Describe this image concisely for a CS teaching assistant. Focus on: code content, error messages, terminal output, architecture diagrams, or any technical content. Be specific about what you see — file names, line numbers, error text, diagram labels.'
          }
        ]
      }]
    })
  }));
  
  return JSON.parse(response.body).content[0].text;
}
```

Cost: ~$0.002 per image. Latency: ~1-2s (acceptable).

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `voice/voice-orchestrator.ts` | Multi-agent orchestrator (replaces `session-manager.ts` + `nova-sonic.ts`) |
| `voice/deepgram-types.ts` | TypeScript interfaces for Deepgram events |
| `voice/function-handlers.ts` | Implementation of all 17+ function call handlers |
| `voice/whatsapp-watcher.ts` | Monitors WhatsApp for messages during active voice sessions |
| `voice/image-vision.ts` | Bedrock Haiku vision preprocessing for images |
| `voice/context-builder.ts` | Builds `context.messages` from SQLite + filesystem |

### Modified Files

| File | Changes |
|------|---------|
| `voice/server.ts` | Replace SessionManager with VoiceOrchestrator; add reconnect grace; add WhatsApp watcher integration; add agent_interrupted relay |
| `voice/public/interview.js` | Remove echo prevention, add `agent_interrupted` handler, simplify audio capture |
| `voice/shadow-evaluator.ts` | No changes — same Bedrock Sonnet call |
| `voice/competency-writer.ts` | Minor: accept updates from function-handlers.ts as well as post-interview |
| `voice/context-loader.ts` | Rename to `context-builder.ts`, expand to build context.messages format |
| `voice/interview-token.ts` | No changes — same HMAC token system |

### Removed Files

| File | Reason |
|------|--------|
| `voice/nova-sonic.ts` | Replaced by Deepgram WebSocket |
| `voice/session-manager.ts` | Replaced by voice-orchestrator.ts |

---

## Environment Variables

```bash
# New (add to .env on EC2):
DEEPGRAM_API_KEY=<your Deepgram API key>

# Unchanged:
VOICE_INTERVIEW_SECRET=<existing>
VOICE_PORT=3001
AWS_REGION=us-west-2
# (all other existing vars remain)
```

---

## Cost Analysis

Deepgram Voice Agent is billed by **WebSocket connection time (per minute)**, not per token or function call.

| Component | Per Session (30 min) | Monthly (40 sessions) |
|-----------|---------------------|----------------------|
| Deepgram Agent (BYO LLM tier: $0.07/min) | $2.10 | $84.00 |
| Bedrock Haiku 4.5 (Think LLM, ~15K tokens/session) | ~$0.02 | $0.80 |
| Bedrock Sonnet 4.6 (Shadow Evaluator, interview only) | ~$0.05 | $1.00 |
| Bedrock Haiku 4.5 (image vision, ~2 images/session) | ~$0.004 | $0.16 |
| **Total** | **~$2.17** | **~$86.00** |

**Pricing tiers (from Deepgram docs):**
| Tier | Pay As You Go |
|------|--------------|
| Standard (Deepgram-hosted LLM) | $0.08/min |
| Custom - BYO LLM (Bedrock) | $0.07/min |
| Custom - BYO LLM + BYO TTS | $0.05/min |

We use Bedrock (BYO LLM) + Deepgram Aura (their TTS) = **$0.07/min**.

vs Nova Sonic (15 min interview only): ~$0.12/session but very limited functionality. The new system costs more per-session but delivers a **full TAi voice channel** — not just mock interviews. Per-student monthly cost at 2 sessions/week = ~$17/mo — reasonable for a research project.

**Cost optimization options if needed:**
- Shorter sessions (15 min cap → $1.05/session)
- BYO TTS via AWS Polly (drops to $0.05/min)
- Limit voice to interview-only (original scope)

---

## Implementation Plan (Revised)

Based on the reference implementation, the critical path is: WebSocket lifecycle → audio relay → single agent with functions → multi-agent handoff. Each phase is testable independently.

### Phase 1: Minimal Viable Voice (~10h)

**Goal:** Student opens link → hears TAi → can have a basic conversation with 3 core functions.

1. Get Deepgram API key (sign up, add to EC2 .env)
2. Implement `voice-orchestrator.ts` core:
   - WebSocket connect to `wss://agent.deepgram.com/v1/agent/converse`
   - Handle `Welcome` → send Settings → wait for `SettingsApplied` (5s gate)
   - Handle binary audio (relay to browser) + JSON events (dispatch)
   - `KeepAlive` every 5s
   - `FunctionCallRequest` → dispatch → `FunctionCallResponse`
3. Implement `context-builder.ts`:
   - Read COMPETENCY.md → condense to key facts
   - Query SQLite for top-6 memories + last 5 WhatsApp messages
   - Build `context.messages` array (History entries + function_call results)
4. Implement 3 starter functions in `function-handlers.ts`:
   - `query_knowledge` → spawn LeanRAG Python process
   - `read_competency` → read filesystem
   - `end_session` → close WebSocket + basic cleanup
5. Modify `server.ts`:
   - Replace `SessionManager` creation with `VoiceOrchestrator`
   - Socket.IO `audio_chunk` → `orchestrator.sendAudio()`
   - Socket.IO `start_interview` (renamed to `start_session`) → `orchestrator.start()`
6. Simplify `interview.js`:
   - Remove ALL echo prevention code (isPlaying, silence injection, ready gate)
   - Add `agent_interrupted` handler (clear playback queue)
   - Keep: mic capture, Socket.IO, audio playback, timer display
7. **Test:** Browser on laptop → speak → hear TAi respond → test `query_knowledge` fires

### Phase 2: Full Functions + WhatsApp Side-Channel (~10h)

**Goal:** All 17 functions working. WhatsApp messages inject into voice. Images/diagrams route to WhatsApp.

8. Implement remaining function handlers:
   - `recall_memory` / `save_memory` → SQLite FTS5 (reuse existing `db.ts` functions)
   - `update_competency` → filesystem write + CompetencyGuard validation
   - `query_canvas` → spawn `python3 /opt/scripts/canvas_api.py` (same as text agent IPC)
   - `query_github` → spawn `python3 /opt/scripts/github_api.py`
   - `generate_image` → write IPC JSON (reuse existing IPC → Baileys path)
   - `render_diagram` → write IPC JSON
   - `send_to_whatsapp` → write IPC JSON
   - `get_youtube_content` → spawn `python3 /opt/scripts/youtube_transcript.py`
   - `browse_url` → spawn Playwright (already in Docker image)
   - `access_sharepoint` → spawn `node /opt/scripts/ms-auth-browse.mjs`
   - `read_file` → pymupdf / convert_office.py / cat
   - `schedule_task` → write IPC task file (same format as text agent)
9. Implement `whatsapp-watcher.ts`:
   - Hook into Baileys message events for student JIDs with active voice sessions
   - Text messages → `InjectUserMessage`
   - Documents → extract text → `InjectUserMessage`
   - Audio → Transcribe Streaming → `InjectUserMessage`
   - Images → `image-vision.ts` (Bedrock Haiku multimodal) → `InjectUserMessage`
10. **Test:** Send image on WhatsApp while in voice → agent discusses it. Call `render_diagram` → see diagram arrive on WhatsApp.

### Phase 3: Interview Mode + Shadow Evaluator (~8h)

**Goal:** Smooth mode switch via UpdateThink. Full mock interview with scoring.

11. Implement `start_interview` handler:
    - Send FunctionCallResponse
    - Load interview context (assignment spec, code, weak spots from COMPETENCY.md)
    - Send `UpdateThink` (interviewer prompt + 4 functions) → wait `ThinkUpdated`
    - Send `UpdateSpeak` (mars voice) → wait `SpeakUpdated`
    - Send `InjectAgentMessage` (interview opener, behavior: "queue")
12. Implement `evaluate_answer` (reuse `shadow-evaluator.ts` — same Bedrock Sonnet call)
13. Implement `end_interview` handler:
    - Build interview summary (scores, topics, strengths, weaknesses)
    - Write to COMPETENCY.md + interviews.md (reuse `competency-writer.ts`)
    - Send `UpdateThink` (conversational prompt + 17 functions) → wait `ThinkUpdated`
    - Send `UpdateSpeak` (thalia voice) → wait `SpeakUpdated`
    - Send `InjectAgentMessage` (closing remark, behavior: "queue")
14. Implement interview timer:
    - 14 min → `UpdatePrompt` with wrap-up instruction (APPENDS to interviewer prompt)
    - 15 min → `InjectAgentMessage` closing remark (behavior: "queue") → trigger `end_interview`
15. **Test:** Casual chat → "let's practice" → hear voice change → interview → scores → return to casual

### Phase 4: Reconnect + Session Persistence (~4h)

**Goal:** Network drops don't kill the session. Full post-session sync.

16. Reconnect grace window:
    - Store `VoiceOrchestrator` instances in `Map<string, VoiceOrchestrator>` keyed by token
    - On Socket.IO disconnect: start 30s timer, keep Deepgram WS alive
    - On reconnect within grace: validate token → resume audio relay
    - On grace expired: `cleanup()` → write results
17. Post-session sync:
    - Write `voice_summary` message to SQLite
    - Write full transcript to `competency/voice-sessions.md`
    - Send WhatsApp summary message (one message, not raw transcript)
    - `markTokenCompleted()` only if meaningful session (duration > 1min OR transcript.length > 3)
18. **Test:** Refresh page mid-conversation → reconnect → voice continues. Kill tab → 30s → session cleanly ends with WhatsApp summary.

### Phase 5: Deploy + Mobile Test + Cleanup (~4h)

19. Deploy to EC2: `npm run build`, restart `nanoclaw-voice` service
20. Test on Android (Chrome) + iOS (Safari):
    - Mic permission works (HTTPS via Cloudflare tunnel)
    - Barge-in works (speak while TAi is talking)
    - WhatsApp side-channel works (send file, receive diagram)
    - Agent handoff audible (voice change)
21. Remove `nova-sonic.ts`, `session-manager.ts`
22. Update memory-bank docs + CLAUDE.md phase checklist

**Total estimate: ~36h**

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bedrock model ID format wrong | Agent fails to start | Test `anthropic/claude-haiku-4-5-20251001-v1:0` immediately in Phase 1. If fails, try `us.anthropic.claude-haiku-4-5-20251001-v1:0`. Fall back to Anthropic direct API key temporarily. |
| Haiku 4.5 overwhelmed by 17 functions | Calls wrong functions, hallucinated params | Phase 1 starts with 3 functions. Add incrementally. If 17 is too many: split into "core" (always available) + "extended" (loaded on demand via UpdatePrompt). Reference repo shows 7 functions works well. |
| Function call pause noticeable | 1-2s silence during `query_knowledge` or `evaluate_answer` | LeanRAG is <500ms. Shadow Evaluator ~1-2s — natural "thinking" gap after student speaks. For slow functions (`browse_url`, `access_sharepoint`): send `InjectAgentMessage("let me look that up...")` as filler before executing. |
| Audio gap during handoff | Student hears 1-2s silence | Reference repo shows this is acceptable — new agent greeting fills the gap immediately. Buffer audio frames and flush on reconnect. Total gap: ~1s (close WS + open WS + SettingsApplied). |
| EC2 session token expires mid-session | Bedrock calls fail after ~1h | Refresh credentials before each session (sessions are max 30 min). Store credentials at `startTime`, detect 401 in function handlers and refresh inline. |
| STT misrecognizes CS terms | "Raft" → "raft", "Paxos" → "packs us" | Comprehensive `keyterms` list (already specified). Monitor transcripts after first sessions and expand. Nova-3 is generally excellent with domain boosting. |
| Deepgram WebSocket drops mid-session | Conversation lost | Detect close event → attempt immediate reconnect with `context.messages` (full transcript). If reconnect fails within 5s, fall back to grace window logic (same as browser disconnect). |
| Function handlers access shared state unsafely | Race condition between voice agent and text agent | Voice sessions set a lock flag in SQLite (`voice_session_active = 1` for the group). Text agent drains messages normally but marks them for post-session delivery. COMPETENCY.md writes are append-only (voice) or section-replace (text) — no conflicts. |
| Student opens voice link while text conversation is active | Container running + voice session = dual writes | When voice session starts, close any active container for that group (same as `closeStdin` preemption in group-queue.ts). Messages queue until voice ends. |

---

## Open Questions

1. ~~**Bedrock model ID format**~~ **RESOLVED:** SDK confirms format is `anthropic.claude-3-5-haiku-20240307-v1:0` (dot separator). Our Haiku 4.5 is likely `anthropic.claude-haiku-4-5-20251001-v1:0`. **Still need to test exact string in Phase 1.**
2. ~~**Session token support**~~ **RESOLVED:** SDK TypeScript definition confirms `session_token?: string` with note "required for STS only". EC2 instance role = STS type. We pass all three: `access_key_id`, `secret_access_key`, `session_token` with `type: "sts"`.
3. **17 functions vs LLM reliability:** No documented function limit. SDK accepts `functions: ThinkSettingsV1FunctionsItem[]` (unbounded array). **Mitigation if Haiku struggles:** use `UpdateThink` to swap between "core" (6 functions) and "extended" (17 functions) based on conversation need. The ability to hot-swap functions mid-session is our safety valve.
4. ~~**Prompt length**~~ **RESOLVED:** 25K char limit applies to **managed LLMs only** (Deepgram-hosted). For BYO LLM (Bedrock), the limit is whatever the model supports. Haiku's context is 200K tokens. Our prompt (~5-8K chars) is tiny.
5. **InjectUserMessage during function processing:** If agent is in `AgentThinking` state (between FunctionCallRequest and our response), does InjectUserMessage queue? Unknown — **test in Phase 2.** Worst case: it triggers `InjectionRefused` and we retry on `AgentAudioDone`.
6. ~~**Voice session + text agent conflict**~~ **DECIDED:** Set `voice_session_active` flag in SQLite for the group. Text agent won't respond on WhatsApp during active voice (messages queue). Exception: admin messages always pass through.
7. ~~**Deepgram billing**~~ **RESOLVED:** BYO LLM tier = **$0.07/min**. 30-min session = $2.10. We keep Deepgram Aura for TTS so we're NOT on the $0.05/min BYO LLM+TTS tier.
8. **`UpdatePrompt` behavior:** Confirmed: it APPENDS (does not replace). For strategy shifts ("student is frustrated"), this is ideal. For mode switches, use `UpdateThink` instead (full replacement).
9. **`eot_threshold` for education:** Set to 0.9 (high confidence needed). Students pause to think — we don't want premature end-of-turn. `eot_timeout_ms: 3000` gives 3s of silence before declaring turn-end. May need tuning after real student testing.

---

## Dependency on Deepgram SDK

The reference repo uses `deepgram` Python SDK v4+ with typed event classes (`AgentV1SettingsAppliedEvent`, `AgentV1FunctionCallRequestEvent`, etc.) and the `AsyncDeepgramClient().agent.v1.connect()` interface.

For our TypeScript implementation, we have two options:

**Option A: Raw WebSocket (recommended for Phase 1)**
- Direct `ws` WebSocket client to `wss://agent.deepgram.com/v1/agent/converse`
- Parse JSON events manually (we already have types from `deepgram-types.ts`)
- Send binary audio frames directly
- Full control, no SDK dependency, matches our existing Nova Sonic pattern

**Option B: Deepgram JS SDK**
- `@deepgram/sdk` npm package
- Typed interfaces and event emitters
- Less boilerplate for event handling
- Dependency on SDK updates

**Decision:** Start with Option A (raw WebSocket) — it's simpler, we control everything, and the protocol is straightforward. Consider SDK migration later if the manual event parsing becomes unwieldy. The reference repo's Python SDK usage confirms the protocol is stable and well-documented.
