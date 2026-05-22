# htgaa-chat — Comprehensive Capability Report

---

## Overview

An AI tutoring platform for Harvard's **"How To Grow Almost Anything" (HTGAA)** synthetic biology course. Built on Next.js 15 + AWS Bedrock. Live at `chat.htgaa.org`. Provides Socratic Q&A grounded in lecture video transcripts, timestamped video citations, a final project proposal mentor, and a git-based lab experiment notebook (Foundry).

**Stack:** Next.js 15 (App Router), React 19, TypeScript, AWS Bedrock (Claude + Cohere rerank), DynamoDB, S3, Docker, Discourse SSO.

---

## Socratic Lecture Tutor

The core feature. Students ask questions about lecture content and receive Socratic responses grounded in actual lecture transcripts — not the LLM's training data.

### RAG Pipeline

1. **Retrieve** — Query Bedrock Knowledge Base (OpenSearch Serverless backend) with the student's question. Filtered by `lectureId`, retrieves top 16 transcript chunks. Each chunk carries metadata: `lectureId`, `chunkId`, `startSec`, `endSec`, `speaker`, `sourceId`, `s3VideoKey`.

2. **Rerank** — Cohere rerank model (`cohere.rerank-v3-5:0` on Bedrock) re-scores the 16 chunks by relevance. Filters below an effective threshold (default 0.04, adjustable in dev mode).

3. **Diversify** — For "full course" cross-lecture queries, distributes top chunks across lectures to avoid single-lecture domination. Caps at 12 chunks total.

4. **Generate** — Claude via Bedrock Converse API. System prompt enforces Socratic guidelines. Returns structured JSON: `{answerMarkdown, citations, watchLinkHints, tutorState}`. Temperature 0.4, max 900 tokens. Retry up to 2 attempts; uses Haiku for JSON repair on malformed output.

### Socratic Teaching Rules

The system prompt enforces strict pedagogical discipline:

- **70/30 rule** — 70% guiding logic (questions, reframing, probing), 30% factual content
- Never front-load answers; provide the first step, then ask a follow-up question
- Identify misconceptions without saying "wrong" — reframe and probe instead
- Focus on mechanical "how" over declarative "what"
- Brevity: short explanation, one focused question per response
- Hard cap: ~900 tokens per response

### Conversation State Tracking (TutorState)

Each conversation maintains a `TutorState` object that persists across turns within a session:

```typescript
TutorState {
  learningGoal: string              // Current educational objective
  currentHypothesis: string         // What the learner seems to believe
  misconceptionsDetected: string[]  // Errors identified during this conversation
  evidenceUsed: string[]            // Retrieved chunk IDs used so far
  nextQuestionType: enum            // "probe_prior_knowledge" | "check_prediction" |
                                    // "ask_mechanism" | "challenge_assumption" | ...
}
```

The model reads this state at each turn and updates it, enabling coherent multi-turn Socratic dialogues. However, this state is **conversation-scoped** — it does not persist across separate conversations or sessions (unlike TAi's COMPETENCY.md which is permanent).

---

## Video Integration & Watch Links

### Lecture Data Model

Each lecture can span multiple video files (multi-part). The data model supports this with `videoSources`:

```typescript
LectureSummary {
  lectureId: string                // e.g., "lec-principles-2026-02-03"
  title: string
  course: string
  durationSec: number
  videoUrl: string                 // Primary CDN URL
  videoSources?: LectureVideoSource[]  // Multi-part lectures
  posterUrl?: string               // Thumbnail
}

LectureVideoSource {
  sourceId: string                 // e.g., "part-1"
  title: string                    // "Part 1", "Appendix", etc.
  videoUrl: string
  durationSec: number
  startOffsetSec: number           // Cumulative offset in unified timeline
  subtitleTracks?: LectureSubtitleTrack[]
  s3VideoKey?: string              // For presigned URL generation
}
```

### Watch-Link Generation

When the tutor answers a question, it also generates **watch links** — clickable buttons that seek the video player to the exact moment in a lecture that answers the student's question.

**How it works:**

1. The model returns `watchLinkHints` — short 6-16 word descriptions of relevant video segments
2. The app matches hints to retrieved transcript chunks by relevance score
3. Chunks are expanded to 5-second spans, then merged if within 30 seconds of each other, from the same source, and under 5 minutes total duration
4. Ranked by Cohere rerank relevance score + hint boost
5. Limited to top 5 segments per response
6. Each watch link includes: `startSec`, `endSec`, `durationSec`, `reason` (AI-generated summary), `sourceId`, `s3VideoKey`

**Watch-link `reason` generation:** Claude generates a brief explanation of why this video segment is relevant. Fallback: first 180 characters of the transcript chunk.

### Video Player

- HTML5 `<video>` with native controls, `preload="metadata"`
- Multi-language subtitle tracks (VTT), lazy-loaded via CDN
- Click a watch-link button → video seeks to that timestamp
- Multi-part lectures: dropdown to select which part
- S3 presigned URLs with 15-minute expiry for private bucket content

### Full Course Composite

A special "Full Course" option that combines all 9 lectures into a single RAG scope:
- User can toggle which lectures to include in the query
- Watch links include `lectureId` and `sourceId` to jump to the correct video
- Player shows a dropdown to select which lecture to watch

**9 lectures:** bootcamp → principles → read-write-edit → automation → proteins → circuits → cellfree → measurement → cloud

---

## Citation System

Every tutor response includes inline citations linked back to source transcript chunks.

- Model writes `[1]`, `[2]`, `[3]` etc. inline in the answer
- App parses via regex `/\[(\d+)\]/g`
- Each citation includes: chunk ID, timestamps (`startSec`/`endSec`), quote (first 180 chars of chunk), lecture metadata
- Dual purpose: (1) grounds the response in real course content, (2) enables students to verify claims by jumping to the source video

---

## Final Project Interview (Proposal Mentor)

A dedicated workspace for guiding students through synthetic biology project design. Not lecture-specific — draws from all lectures via RAG (12 chunks).

### Two-Phase Workflow

**Phase 1: Design Dialogue** — Structured Q&A that refuses to generate a proposal until all prerequisites are defined:
- DNA construct defined
- Twist Bioscience order plan confirmed
- Assay/screening method chosen
- Automation workflow specified
- Microplate selection made
- Validation experiment planned

**Phase 2: Proposal Generation** — Once prerequisites are met, generates a full Markdown proposal:
- Abstract (150+ words)
- Project Aims (3 aims: experimental, medium-term, visionary)
- Background (literature, innovation, significance, bioethics)
- Experimental Design (15+ steps with methods, machines, plates, expected results)
- Techniques (course checklist + 4-sentence deep-dives per technique)
- Validation (protocol, troubleshooting, hypothetical data/graph description)
- Budget (markdown table with supplier links)

### Lab Equipment Knowledge

Hard-coded equipment catalog available to the mentor:

**Storage:** Ambistore (22C/4C), SteriStore (30C)
**Liquid handling:** Echo525, Multiflo, Tempest, Floi8, Bravo-96/384
**Mixing/incubation:** BioshakeD3000, HiG Centrifuge, Inheco, Cytomat
**Molecular biology:** ATC Thermal Cycler, CFX Opus
**Detection:** Spark, PHERAstar FSX

**Microplates:** 384-well (Echo PP, Greiner black/clear, Eppendorf, Corning, Greiner V), 96-well (Armadillo PCR, Eppendorf deep, Axygen half-deep, Thermo flat/omni), 1536-well (Thermo omni)

### Model Config

- Max tokens: 5000 (vs. 900 for lecture tutor)
- Temperature: 0.3 (lower for consistency)
- System prompt: ~15KB of structured instructions
- Inline citations from RAG chunks

---

## Foundry (Experiment Lab Notebook)

A git-backed project management system for lab experiments. Access-controlled by username whitelist.

### Architecture

- **Persistence:** Forgejo (self-hosted Git) at `edit.htgaa.org`
- **Token security:** AES-256-GCM encryption per user (12-byte random IV, stored as base64)
- **File format:** Each project stored as `dossier.md` (full notes) + `_index.md` (summary) + `foundry.json` (state) in the Git repo

### Project Stages

9-stage workflow: `project-definition` → `research` → `protocol-framing` → `construct-design` → `ordering` → `protocol-writing` → `nebula-build` → `verification` → `results`

### Data Model

```typescript
FoundryProjectDefinition {
  projectSlug: string              // URL-safe identifier
  title: string
  objective: string                // What it solves
  modality: "cell-free" | "measurement" | "hplc" | "lcms" | "cdms" | "other"
  synthesisBudget: string
  tools: string                    // Tools/reagents available
  operations: string               // Protocol operations
  orderingConstraints: string      // Supplier limitations
  machineConstraints: string       // Equipment constraints
  notes: string                    // Free-form
  ownerUsername: string
  createdAt / updatedAt: ISO string
}
```

### API

- `GET/POST /api/foundry/connection` — Manage Forgejo token (encrypted storage)
- `GET/POST/DELETE /api/foundry/projects` — CRUD for projects
- Token hint (last 4 chars) stored for user verification

---

## Multi-Language Support

- 10 languages: English, Spanish, French, German, Portuguese, Japanese, Korean, Simplified Chinese, Arabic, Hindi
- Implementation: appends "Write the answer in [Language Name]" to the system prompt
- Language preference stored per conversation and in DynamoDB user preferences table
- Subtitle tracks on videos also support multiple languages

---

## Authentication & User Management

### Discourse SSO Flow

1. User clicks "Lecture Tutor" link in Discourse forum (`forum.htgaa.org`)
2. Discourse plugin generates HS256 JWT with claims: `sub` (user ID), `username`, `groups` (e.g., `ai_group`), `iat`/`exp` (15-minute handoff window)
3. Redirect to `/auth/discourse?token=<JWT>`
4. App verifies JWT signature using `DISCOURSE_SHARED_SECRET`
5. Creates HttpOnly cookie (`htgaa_chat_session`) valid for 3 hours
6. Session contains: `userId`, `username`, `groups[]`, `isDev` flag

### Middleware Protection

- Public paths: `/_next/*`, `/auth/discourse`, `/launch`, static files
- All other paths (`/lectures`, `/api/*`): require valid session, redirect to forum if missing

### Developer Mode

Enabled via `dev=1` URL parameter during Discourse redirect. Requires `ai_group` membership. Grants:
- Model selection mid-session (swap between Claude variants)
- System prompt editing in browser
- Watch-link relevance threshold tuning
- Settings persist in browser session storage

---

## Database & Persistence

### DynamoDB Tables

| Table | Partition Key | Purpose |
|-------|--------------|---------|
| `LECTURES_TABLE_NAME` | `lectureId` | Lecture metadata, video sources, subtitle tracks |
| `CHAT_CONVERSATIONS_TABLE_NAME` | `conversationId` | Conversation state, tutor state, soft-delete support |
| `CHAT_MESSAGES_TABLE_NAME` | `messageId` | Full messages with Q&A, citations, watch links, chunks |
| `CHAT_USER_PREFERENCES_TABLE_NAME` | `userId` | Language and font size preferences |
| `FOUNDRY_CONNECTIONS_TABLE_NAME` | `userId` | Encrypted Forgejo tokens |

### Fallback Strategy

If DynamoDB table names are not configured, the app falls back to **in-memory Maps** — enabling full local development without AWS. Fixture lectures and transcript chunks are built-in for dev mode.

### Conversation Soft-Delete

Conversations are never physically deleted. A `deletedAt` timestamp is set; the UI filters them out. Data preserved for auditing.

---

## Transcript Ingest Pipeline

Custom ETL pipeline that converts raw lecture videos into searchable, timestamp-linked knowledge base content.

### Pipeline Steps

1. **Transcribe** (`npm run ingest:transcribe`) — Upload MP4 to S3 → AWS Transcribe → JSON transcript with word-level timestamps
2. **Chunk** (`npm run ingest:chunks`) — Semantic boundary chunking (NOT Bedrock's automatic chunker). Each chunk carries metadata: `lectureId`, `chunkId`, `startSec`, `endSec`, `speaker`, `sourceId`, `s3VideoKey`
3. **Setup KB** (`npm run ingest:setup-kb`) — Create Bedrock Knowledge Base + OpenSearch Serverless collection
4. **Write lecture** (`npm run ingest:lecture`) — Write `LectureSummary` record to DynamoDB
5. **Sync KB** (`npm run ingest:sync-kb`) — Trigger Bedrock KB data-source sync
6. **Or all-in-one:** `npm run ingest:ready-lecture` — Runs all steps sequentially

### Why Custom Chunking Matters

Bedrock's automatic chunker splits by character count, which breaks mid-sentence and loses timestamp alignment. The custom chunker splits at semantic boundaries (speaker changes, topic shifts, natural pauses) and preserves exact `startSec`/`endSec` per chunk — enabling precise watch-link generation.

---

## API Routes

### Lecture Q&A
- `GET /api/lectures` — List all lectures (+ "Full course" composite)
- `GET /api/lectures/{lectureId}` — Fetch single lecture with video URLs
- `POST /api/lectures/{lectureId}/questions` — Ask a question (returns answer, citations, watch links)
- `GET /api/lectures/{lectureId}/conversations` — List conversation summaries
- `GET /api/lectures/{lectureId}/conversations/{conversationId}` — Fetch full conversation + messages
- `DELETE /api/lectures/{lectureId}/conversations/{conversationId}` — Soft-delete
- `POST /api/lectures/{lectureId}/alternate-links` — Regenerate watch links for a response

### Final Project
- `POST /api/final-project/chat` — Ask the project mentor
- `GET /api/final-project/conversations` — List conversations
- `GET /api/final-project/conversations/{conversationId}` — Fetch conversation

### Foundry
- `GET/POST /api/foundry/connection` — Forgejo token management
- `GET/POST/DELETE /api/foundry/projects` — Project CRUD

### User
- `POST /api/preferences/language` — Set language
- `POST /api/preferences/font-size` — Set font size
- `GET /api/auth/logout` — Clear session

---

## Deployment

### Docker

Multi-stage Alpine Dockerfile. ~300MB final image (`node:20-alpine` + git for Foundry). Standalone Next.js output with static assets. Runs on port 3000.

```bash
docker build -t htgaa-lecture-tutor .
docker compose -f docker-compose.example.yml up -d
```

### Nginx Reverse Proxy

- HTTPS via Let's Encrypt
- Passes `X-Forwarded-Proto`, `X-Forwarded-For` headers for session security

### AWS Resources Required

- Bedrock Knowledge Base + OpenSearch Serverless
- DynamoDB tables (4-5 tables)
- S3 bucket for transcripts + lecture MP4s
- IAM role: Bedrock, DynamoDB, S3, Transcribe, Translate permissions

---

## Frontend UI

### Lecture Workspace

The primary interface. Split layout:
- **Left panel:** Conversation list, lecture selector, language/font preferences
- **Center panel:** Chat thread with Socratic Q&A, inline citations, watch-link buttons
- **Right panel (or inline):** HTML5 video player with subtitle tracks, watch-link seek buttons

### Final Project Workspace

Dedicated chat interface for the project mentor. Same conversation management but with longer responses (5000 tokens) and the two-phase design dialogue workflow.

### Foundry Workspace

Project management UI:
- Forgejo connection setup (encrypted token entry)
- Project list with stage badges
- Project detail view with all fields
- CRUD operations via API

### Developer Panel (ai_group only)

Floating panel visible in dev mode:
- Model ID selector (dropdown)
- System prompt textarea (editable)
- Watch-link relevance threshold slider
- Changes take effect on next question

---

## What htgaa-chat Does NOT Have (vs. TAi)

| Capability | Status |
|-----------|--------|
| Persistent cross-session student model | No — TutorState is conversation-scoped |
| Misconception tracking across sessions | No — detected per-conversation only |
| Adaptive teaching strategy selection | No — same Socratic approach for everyone |
| Proactive outreach / teaching patrol | No |
| Voice interviews | No |
| Voice message sending/receiving | No |
| Image/diagram generation | No |
| Emoji reactions | No |
| Knowledge graph (LeanRAG) | No — uses flat RAG (Bedrock KB) |
| GitHub/Canvas LMS integration | No |
| Competency bootstrapping from grades | No |
| Cross-session memory (FTS5/decay) | No |
| Admin channel / instructor tools | No |
| Spaced review scheduling | No |
| File reading (PDF/Office/archives) | No |

---

## What htgaa-chat Has That TAi Doesn't

| Capability | Details |
|-----------|---------|
| Web UI (Next.js) | Full browser-based interface with video player, citation sidebar, conversation management |
| Video player with timestamped watch links | Click to seek to exact moment in lecture video |
| Bedrock Knowledge Base RAG | OpenSearch Serverless backend, Cohere rerank |
| Citation extraction + display | Inline `[1]` references linked to transcript chunks with timestamps |
| Custom transcript ingest pipeline | Semantic chunking preserving timestamps, speaker info |
| Multi-part lecture support | Unified timeline across multiple video files |
| Full-course cross-lecture queries | Single Q&A spanning all 9 lectures |
| Final project proposal generator | Structured two-phase workflow with lab equipment catalog |
| Foundry (git-based lab notebook) | Forgejo integration, encrypted tokens, 9-stage workflow |
| Multi-language answers | 10 languages with per-conversation preference |
| Discourse SSO | JWT handoff from forum, developer mode |
| DynamoDB persistence | Managed NoSQL, no file-system dependency |
| Conversation soft-delete | Preserves data for auditing |
| Developer overrides | Model swap, prompt editing, threshold tuning in-browser |
