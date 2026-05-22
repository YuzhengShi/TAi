# TAi Instructor Dashboard — Design & Implementation Notes

**Created:** 2026-04-16  
**Updated:** 2026-04-16 (v2 — expanded after full ChatLab codebase analysis)  
**Source:** Deep code analysis of ChatLab (D:\ChatLab-main, ~470 files, ~5800 lines backend analytics)

---

## Overview

The dashboard is a web UI for Prof. Coady to monitor student engagement, view the student interaction network, query analytics via natural language, and review student competency/mock interview progress. It runs as additional Express routes on the existing voice server (port 3001).

**Stack decision:** Express + `better-sqlite3` (already in TAi) + ECharts CDN + vanilla HTML/Tailwind CDN. No new framework. No Vue/Electron.

---

## ChatLab → TAi Complete Reuse Map

ChatLab (AGPL-3.0) at `D:\ChatLab-main` is a ~470-file Electron chat analytics platform. After full codebase analysis, here's the comprehensive reuse assessment.

### Tier 1 — Copy directly, minimal changes

#### 1.1 Time-Decay Co-Occurrence Algorithm (`social.ts:753-1015`)
The most valuable piece. Detects who talks together, weighted by timing:

```typescript
// For each anchor message, scan next lookAhead=4 different speakers:
const decayWeight = Math.exp(-deltaSeconds / opts.decaySeconds)  // 120s half-life
const positionWeight = 1 - (partnersFound - 1) * 0.2            // 1.0 / 0.8 / 0.6 / 0.4
rawScore[a][b] += decayWeight * positionWeight

// Normalize against expected baseline:
expectedScore = (aMsgCount × bMsgCount / totalMessages) × lookAheadFactor
normalizedScore = rawScore / expectedScore

// Hybrid 50/50:
hybridScore = 0.5 × (rawScore/maxRaw) + 0.5 × (normalizedScore/maxNormalized)

// Node size: 20 + (0.7×normalizedDegree + 0.3×msgNorm) × 35
```

**TAi adaptation:** Swap `sender_id` → `sender` (JID). In TAi, messages are group messages (all from different WhatsApp JIDs in the same group chat), but we care about student-to-student interaction patterns: who replies after whom, study group detection, isolated students.

**Key options (defaults):** `lookAhead=4, decaySeconds=120, topEdges=100`

#### 1.2 EChartGraph Force Layout (`EChartGraph.vue:107-218`)
Framework-agnostic ECharts option object. Extract as `buildGraphOption(nodes, links, maxLinkValue, layout)`:

```javascript
// Force layout params:
force: { repulsion: 300, gravity: 0.1, edgeLength: [80, 200], friction: 0.6 }
// Edge width: 1 + (value/maxValue) × 5 (range 1–6px)
// 12-color palette hardcoded, works well
// Curveness: 0.3 for curved edges
// Zoom: 0.3-3x, draggable nodes
// Adjacency emphasis on hover
// Circular layout alternative with rotated labels
```

#### 1.3 Calendar Heatmap (`OverviewIdentityCard.vue:200-231`)
Custom render (rounded rect cells with transparent gaps):

```javascript
// Custom series for GitHub-style contribution heatmap
renderItem: (params, api) => {
  const cellPoint = api.coord(api.value(0))
  const size = Math.min(cellWidth, cellHeight) - 3  // 3px transparent gap
  return { type: 'rect', shape: { x, y, width: size, height: size, r: 3 } }
}
// Theme colors:
light: ['#fce4ec', '#f8a4b8', '#f06292', '#e91e63']
dark:  ['rgba(238,69,103,0.15)', ..., 'rgba(238,69,103,1)']
empty: light='#ebedf0', dark='rgba(255,255,255,0.04)'
```

#### 1.4 `maxConsecutiveDays()` Streak Algorithm (`useOverviewStatistics.ts:147-181`)
Pure TypeScript, paste directly. Sort active dates, walk consecutive pairs:

```typescript
if (currDate.diff(prevDate, 'day') === 1) currentStreak++
else { maxStreak = Math.max(maxStreak, currentStreak); currentStreak = 1 }
```

→ Student engagement streak metric.

#### 1.5 Overview Statistics Composable (`useOverviewStatistics.ts`)
Computed metrics pattern — adapt for TAi:

| ChatLab Metric | TAi Dashboard Metric |
|---|---|
| `durationDays` | Course duration (days since first student message) |
| `displayMessageCount` | Total student messages |
| `dailyAvgMessages` | Daily avg messages across all students |
| `peakHour` | Peak engagement hour (when students are most active) |
| `peakWeekday` | Peak engagement day (should correlate with Wed class day) |
| `activeDays` | Days with student activity |
| `activeRate` | % of days with activity |
| `lateNightChat` | Late-night study patterns (0-5am) |
| `maxConsecutiveDays` | Max engagement streak |
| `weekdayVsWeekend` | Weekday vs weekend engagement ratio |

#### 1.6 `preprocessMessages()` Pipeline (`preprocessor/pipeline.ts:1-273`)
5 stages, zero dependencies:
1. `dataCleaning` — extract XML share cards → readable text (skip for TAi, no WeChat XML)
2. `blacklistFilter` — remove messages containing keywords (useful: filter bot commands)
3. `denoise` — drop: empty, len<2, pure emoji, `[Image]`/`[Video]`/`[Sticker]` placeholders, reply-protected
4. `mergeConsecutive` — same sender within 180s → concat. **Directly useful** for WhatsApp where students send 3-4 short messages in a row
5. `desensitize` — regex rules with replacement, cached, 50ms guard (skip for TAi)

**TAi use:** Stages 2-4 for cleaning messages before analytics. Stage 4 (merge) is critical — WhatsApp message splitting creates false message counts.

### Tier 2 — Port SQL queries (swap column names)

All from `analysis.ts` (~1165 lines). Each takes a `db: Database.Database` handle.

| ChatLab Function | Lines | TAi Dashboard Use | Priority |
|---|---|---|---|
| `getDivingAnalysis()` | 1115-1164 | Days since student last messaged → **primary at-risk signal** | HIGH |
| `getMemberActivity(db, filter)` | ~L50 | Per-student message volume ranking | HIGH |
| `getHourlyActivity(db, filter)` | ~L120 | When students engage (heatmap) | HIGH |
| `getDailyActivity(db, filter)` | ~L180 | Weekly engagement trend | HIGH |
| `getWeekdayActivity(db, filter)` | ~L230 | Class day patterns | MEDIUM |
| `getNightOwlAnalysis(db)` | 726-1029 | Late-night study patterns | LOW |
| `getCatchphraseAnalysis(db)` | 599-681 | Students' recurring questions/terms → wordcloud | MEDIUM |
| `getDragonKingAnalysis(db)` | 1035-1109 | Daily top speaker → engagement leaderboard | LOW |
| `getRepeatAnalysis(db)` | 325-543 | Not useful for TAi (detects chain messages in groups) | SKIP |

**Schema delta (ChatLab → TAi):**

| ChatLab | TAi |
|---|---|
| `member.platform_id` | `contacts.jid` |
| `member.group_nickname` | `contacts.push_name` |
| `message.sender_id` (FK) | `messages.sender` (JID direct) |
| `message.ts` (Unix seconds) | `messages.timestamp` (Unix seconds) |
| `message.content` | `messages.body` |
| `message.type = 0` (text) | `messages.type = 'text'` |
| System msg filter: `COALESCE(m.account_name,'') != '系统消息'` | `messages.sender != 'system'` or filter by bot JID |

**Time filter pattern (copy directly):**
```typescript
interface TimeFilter { startTs?: number; endTs?: number }
function buildTimeFilter(filter?: TimeFilter): { clause: string; params: number[] }
```

### Tier 2.5 — Port from relationship.ts (459 lines)

#### Response Latency SQL (`relationship.ts:307-328`)
LAG window function, copy-paste ready:
```sql
WITH msg_lag AS (
  SELECT sender, timestamp,
    LAG(sender)    OVER (ORDER BY timestamp) AS prev_sender,
    LAG(timestamp) OVER (ORDER BY timestamp) AS prev_ts
  FROM messages WHERE group_folder = ?
)
SELECT sender as jid, AVG(timestamp - prev_ts) as avg_response_secs
FROM msg_lag WHERE prev_sender IS NOT NULL AND sender != prev_sender
GROUP BY sender
```
**TAi use:** How fast each student responds after TAi sends a message. Engagement quality metric.

#### Session Initiation Analysis
From `getRelationshipStats()` — who starts conversations. In TAi context: which students initiate conversations with the TA (proactive vs reactive students).

### Tier 3 — Port the architecture pattern

#### 3.1 Declarative SQL Tool System
Pattern from `ai/tools/definitions/sql-analysis.ts` + `ai/assistant/sqlToolRunner.ts`:

```typescript
interface SqlToolDef {
  name: string
  description: string
  parameters: { type: 'object', properties: Record<string, JsonSchema>, required: string[] }
  execution: {
    type: 'sqlite',
    query: string,              // Parameterized SQL with @param placeholders
    rowTemplate: string,        // '{column_name}' substitution
    summaryTemplate: string,    // Header with {rowCount}
    fallback: string            // Empty result message
  }
}
```

Runner is ~80 lines: takes def + DB, executes parameterized SQL, formats via `{col}` substitution.

**10 TAi tools to define:**

| Tool | Parameters | Description |
|---|---|---|
| `inactive_students` | `days: number (default 5)` | Students inactive for N+ days → mock interview risk |
| `student_engagement_summary` | `jid?: string` | Per-student message count, last active, avg messages/day |
| `activity_heatmap` | `days?: number` | 24×7 hour/weekday grid |
| `daily_trend` | `days?: number (default 30)` | Daily message counts |
| `conversation_initiators` | — | Who starts conversations (proactivity metric) |
| `unanswered_messages` | `hours?: number` | Messages with no TAi response within N hours |
| `student_interaction_pairs` | — | Co-occurrence pairs (who replies near whom) |
| `message_length_stats` | — | Avg message length per student (effort proxy) |
| `engagement_trend` | `jid: string` | Per-student weekly engagement trend |
| `late_night_activity` | — | Students active 0-5am (wellness signal) |

#### 3.2 AI Query Bar Pattern (`SQLLabTab.vue:145-188`)
`buildAIPrompt(userPrompt, schemaList)` — inject full schema as markdown table + rules:

```
You are a SQLite expert. Database schema:
### messages
| col | description | type |
| sender | Student WhatsApp JID | TEXT |
| timestamp | Unix seconds | INTEGER |
| body | Message content | TEXT |
| type | Message type (text/image/audio) | TEXT |
...

### contacts
| col | description | type |
| jid | WhatsApp JID (primary key) | TEXT |
| push_name | Display name | TEXT |
...

Rules:
1. timestamp is Unix seconds, use datetime(timestamp, 'unixepoch', 'localtime')
2. Only use columns that exist in the schema above
3. Include sender as first column when showing individual messages
4. Filter TAi messages: sender NOT LIKE '%@s.whatsapp.net' OR sender = '{bot_jid}'
5. LIMIT 100 for safety
...

User request: {userPrompt}

Output JSON: {"sql": "...", "explanation": "..."}
```

Call Haiku 4.5 with `temperature=0.1, maxTokens=800`. Parse JSON response. Stream to SSE.

**Dual-mode input (from ChatLab):**
- Prompt mode (default): natural language → AI generates SQL → auto-execute
- SQL mode: direct SQL input → execute
- Toggle button, Ctrl+Enter to run both modes
- History saved to localStorage (max 50 entries)
- Streaming AI output shown while generating

#### 3.3 Session-Boundary-Aware Chunking (`rag/chunking/session.ts`)
Better than naive sliding-window. Each chunk = one coherent conversation:
- `MAX_CHUNK_CHARS = 2000`, `CHUNK_OVERLAP_CHARS = 200`
- Chunk format: `[2024-01-15 14:30 ~ 15:20] Participants: Alice\nAlice: ...`
- Metadata: `{ sessionId, startTs, endTs, messageCount, participants }`
- **TAi use:** Point at TAi's DB for LeanRAG improvement (future)

#### 3.4 FTS5 Smart Fallback (`session/aiTools.ts`)
```typescript
if (hasFtsIndex(sessionId)) {
  WHERE message_id IN (SELECT rowid FROM message_fts WHERE content MATCH ?)
} else {
  WHERE body LIKE ?  // one condition per keyword, OR-joined
}
```
**TAi use:** Search student messages — "find what students said about Docker last week". TAi already has FTS5 on memories; extend to messages table.

#### 3.5 Word Cloud Pattern (`EChartWordcloud.vue`)
Uses echarts-wordcloud extension. Key params:
- `maxWords=100`, font 14-56px normalized by count
- 4 color schemes (default/warm/cool/rainbow)
- Shapes: circle/cardioid/diamond/triangle/rectangle
- Rectangle shape function: `(theta) => 1/Math.max(Math.abs(Math.cos(theta)), Math.abs(Math.sin(theta)))`
- **TAi use:** Student recurring topics/questions wordcloud on overview page

### What NOT to Touch

| Component | Why |
|---|---|
| Vue/Electron IPC layer | `window.chatApi`, `window.llmApi` are Electron globals |
| `@mariozechner/pi-agent-core` | Different agent framework |
| Chinese NLP (jieba, Intl.Segmenter) | TAi content is English |
| Assistant marketplace | TAi uses CLAUDE.md |
| Multi-provider LLM router | TAi uses Bedrock exclusively |
| Import parsers (WeChat/QQ/Telegram formats) | TAi reads WhatsApp SQLite directly |
| RAG vector store (SQLite BLOB) | TAi uses LeanRAG (NetworkX graph) |
| Pinia stores | No Vue in TAi dashboard |
| Rerank pipeline | TAi uses graph traversal, not vector similarity |
| Embedding config management | Single provider (Bedrock) |

---

## Dashboard Pages / Views

### 1. Overview (Landing Page)
**Inspired by:** ChatLab's `OverviewIdentityCard.vue` + `OverviewStatCards.vue`

**Layout:**
- **Header card** (ThemeCard-style elevated card with decorative gradient):
  - Title: "TAi — CS6650 Dashboard"
  - Course info: Instructor, student count, term dates
  - Key stats row: Total Messages | Active Students Today | At-Risk Count | Mock Interviews This Week
  
- **GitHub-style Activity Calendar** (full-width, last 365 days):
  - Custom render with rounded 13×13 cells, 3px transparent gaps
  - Data: daily message counts across all students
  - Color: TAi blue theme (or pink like ChatLab)
  - Tooltip: date + message count

- **Stat Cards Grid** (2×4 grid):
  - Daily Avg Messages | Peak Hour | Peak Day (weekday) | Active Rate
  - Late-Night Activity | Max Streak | Wed Activity (class day) | Avg Response Time

- **Daily Engagement Trend** (ECharts line chart, last 30 days):
  - Smooth curve with gradient fill
  - Separate lines for student messages vs TAi responses (optional)

- **24h × 7day Activity Heatmap** (ECharts heatmap):
  - Hour on Y-axis (0-23), weekday on X-axis (Mon-Sun)
  - Shows when students are most engaged
  - Expected pattern: spikes around Wed 3:15-5:15pm (class time)

### 2. Student List
**Inspired by:** ChatLab's `RankList.vue` + `EChartRank.vue`

**Layout:**
- Sortable table with columns:
  - Student name (push_name from contacts)
  - Last active (relative time + days count)
  - Messages this week
  - COMPETENCY.md avg confidence (read from filesystem)
  - Engagement streak (consecutive days)
  - At-risk flag (>5 days inactive OR low confidence + approaching deadline)
  - Mock interview count
- Click row → student detail page
- Color-coded risk badges (green/yellow/red)
- Sort by: risk level, last active, messages, confidence
- Medal emojis (🥇🥈🥉) for top 3 in engagement (from ChatLab's EChartRank)

### 3. Student Detail
**Inspired by:** ChatLab's private-chat `RelationshipView.vue` + session timeline

**Layout:**
- **Student Profile Card:**
  - Name, JID, Canvas ID, GitHub username
  - Member since, total messages, avg messages/day
  - Personal activity calendar heatmap (their messages only)

- **COMPETENCY.md Rendered:**
  - Mastery by concept (bar chart or radar chart)
  - Scope coverage (theoretical/implementation/debugging/verbal)
  - Active misconceptions (highlighted)
  - Teaching strategy history

- **Mock Interview Scores Timeline:**
  - Line chart: 4 dimensions over time (verbal_clarity, technical_accuracy, depth_of_reasoning, problem_solving_process)
  - Each point = one mock interview session

- **Engagement Metrics:**
  - Response latency (how fast they reply to TAi)
  - Conversation initiation ratio (proactive vs reactive)
  - Message length trend (effort proxy)

- **Message History Search:**
  - FTS5 search box
  - Recent conversations with TAi (paginated)
  - Filter by date range

### 4. Interaction Network
**Inspired by:** ChatLab's `EChartGraph.vue` + `getClusterGraph()` from `social.ts`

**Layout:**
- **Full-width ECharts force graph:**
  - Students as nodes, co-occurrence weight as edges
  - Node size = 70% degree centrality + 30% message volume
  - Edge thickness = hybridScore (raw + normalized)
  - 12-color palette cycling through nodes
  - Edge curveness: 0.3
  - Force layout: repulsion=300, gravity=0.1, edgeLength=[80,200], friction=0.6

- **Controls:**
  - Toggle: circular layout vs force layout
  - Time range filter (last 7/14/30 days)
  - Min edge weight slider (filter weak connections)

- **Insights panel (sidebar):**
  - Isolated students (no edges or very weak)
  - Study clusters detected
  - Matchmaking suggestions (pair isolated with active)
  - Stats: total students, involved students, edge count

### 5. AI Query Bar (SQL Lab)
**Inspired by:** ChatLab's `SQLLabTab.vue` with dual-mode input

**Layout:**
- **Schema Panel** (collapsible left sidebar):
  - TAi database tables: messages, contacts, tasks, memories, sessions, groups, audit
  - Click column name → inserts into SQL input
  - Table/column descriptions

- **Input Area:**
  - Prompt mode (default): textarea for natural language
  - SQL mode: monospace textarea for raw SQL
  - Toggle button + Ctrl+Enter shortcut
  - AI streaming output shown below while generating (SSE)

- **Preset Buttons** (10 quick queries):
  - 🔴 At-Risk Students | 📊 Weekly Summary | 🕐 Activity Heatmap
  - 💬 Most Active | 🤫 Quiet Students | 🌙 Night Owls
  - 📈 Engagement Trend | ❓ Unanswered Messages | 🔄 Interaction Pairs
  - 📏 Message Length Stats

- **Result Area:**
  - Table with column sorting
  - Row count + execution time
  - Export to CSV (future)

- **History:**
  - Last 50 queries in localStorage
  - Click to re-execute
  - Delete individual entries

### 6. Teaching Patrol Log (NEW — TAi-specific)
**No ChatLab equivalent** — unique to agentic TA.

**Layout:**
- **Timeline of patrol decisions:**
  - Date/time of each patrol run
  - Decision: "Sent message to X" / "No action needed for Y" / "Detected risk for Z"
  - Trigger that fired (inactive + deadline, low mastery, spaced review, etc.)
  - Result: student responded? within how long?

- **Patrol effectiveness metrics:**
  - % of proactive messages that got a response
  - Avg time to response after patrol message
  - Most effective triggers

### 7. Competency Overview (NEW — TAi-specific)
**No ChatLab equivalent** — visualization of mastery tracking.

**Layout:**
- **Class-wide Competency Heatmap:**
  - Students on Y-axis, course topics on X-axis
  - Cell color = confidence level (red 0→green 1.0)
  - Click cell → shows scope, stability, via, misconceptions

- **Topic Difficulty Ranking:**
  - Bar chart: avg confidence by topic across all students
  - Highlights struggling topics (class-wide weak areas)

- **Misconception Tracker:**
  - Table: misconception text, student count affected, status (active/remediated)
  - Sort by frequency
  - Shows remediation effectiveness

---

## New Features Identified from ChatLab (not in v1 design)

### A. Word Cloud (`EChartWordcloud.vue`)
**Where:** Overview page or separate "Topics" tab
**What:** Most frequent terms/topics students ask about
**How:** Run catchphrase analysis on student messages → wordcloud visualization
**Value:** Quick visual of what students are struggling with

### B. Message Type Distribution (`getMessageTypeDistribution`)
**Where:** Overview page
**What:** Pie chart: text vs images vs audio vs documents
**How:** `SELECT type, COUNT(*) FROM messages GROUP BY type`
**Value:** Shows if students are sending code screenshots vs typing questions

### C. Conversation Length Analysis
**Where:** Student detail page
**What:** How long are student-TAi conversations? (messages per session, time per session)
**How:** Session gap detection (30min threshold, inline SQL) from ChatLab's `sessionIndex.ts`
**Value:** Longer conversations may indicate deeper engagement OR confusion

### D. Response Time Analysis (`relationship.ts` LAG pattern)
**Where:** Overview stats + student detail
**What:** How fast students respond to TAi, and how fast TAi responds to students
**How:** LAG window function on messages ordered by timestamp
**Value:** Student engagement quality metric; TAi responsiveness SLA

### E. Name Disambiguation (`social.ts:950-966`)
**Where:** Network graph
**What:** Handle students with same display name
**How:** `${baseName}#${jid.slice(-4)}` when nameCount > 1
**Value:** Prevents confusion in visualizations

### F. Night Owl Analysis (`analysis.ts:726-1029`)
**Where:** Overview or student detail
**What:** Students studying 0-5am, with streaks
**How:** Adjusted date (0-4am counts as previous day), consecutive night streaks
**Value:** Wellness concern signal for instructor

### G. Engagement Streak (`useOverviewStatistics.ts:147-181`)
**Where:** Student list + student detail
**What:** Longest consecutive days of engagement
**How:** Walk sorted active dates, count consecutive
**Value:** Gamification signal, identifies consistent vs bursty students

### H. Message Preprocessing (`pipeline.ts`)
**Where:** Applied before all analytics
**What:** Merge consecutive messages, filter noise, remove bot commands
**How:** 
1. Filter: messages starting with `@TAi` prefix? (keep, but mark as command)
2. Denoise: drop empty, pure emoji, `[Image]`/`[Video]` placeholders
3. Merge: same sender within 180s → concat (critical for WhatsApp)
**Value:** Accurate message counts (without merging, one thought sent as 3 messages = 3x inflation)

---

## Implementation Plan (Revised)

**Total estimated effort:** ~30h with ChatLab as reference (vs ~80h greenfield)

### Week 1 (~18h) — Core Dashboard + Overview

**Day 1-2: Infrastructure (6h)**
1. Add dashboard routes to `voice/server.ts` (or separate `dashboard/server.ts`)
2. Read-only `better-sqlite3` handle to TAi's messages.db
3. Build `buildTimeFilter()` utility (copy from ChatLab)
4. Serve static HTML dashboard page with ECharts CDN + Tailwind CDN
5. Basic auth middleware (reuse VOICE_INTERVIEW_SECRET or add DASHBOARD_SECRET)

**Day 3-4: Overview Page (6h)**
6. Port `getMemberActivity()` → `/api/dashboard/student-activity`
7. Port `getDivingAnalysis()` → `/api/dashboard/at-risk`
8. Port `getHourlyActivity()` + `getWeekdayActivity()` → `/api/dashboard/activity-heatmap`
9. Port `getDailyActivity()` → `/api/dashboard/daily-trend`
10. Build overview HTML: StatCards (4), calendar heatmap, daily trend line, 24×7 heatmap
11. Compute overview statistics (adapt `useOverviewStatistics` to server-side)

**Day 5: Student List (6h)**
12. `/api/dashboard/students` — list with computed risk scores
13. Read COMPETENCY.md files → parse avg confidence per student
14. Student list table with sort/filter, risk badges
15. Student detail page stub (link from student list)

### Week 2 (~12h) — Interaction Network + Intelligence

**Day 6-7: Network + Detail (6h)**
1. Port `getClusterGraph()` → `/api/dashboard/interaction-network`
2. Build EChartGraph option (copy from ChatLab)
3. Interaction network page with force/circular toggle
4. Student detail page: personal heatmap, COMPETENCY.md render, message history

**Day 8-9: AI Query Bar (6h)**
5. Implement declarative tool runner (~80 lines) + 10 tool definitions
6. `buildAIPrompt()` with TAi schema
7. Haiku 4.5 streaming via SSE → `/api/dashboard/query-nl`
8. SQL Lab page: dual-mode input, preset buttons, result table, history

### Week 3 (~10h, optional — TAi-specific pages)

**Day 10: Teaching Patrol + Competency (5h)**
1. Teaching patrol log page (read from audit logs or add logging)
2. Competency overview heatmap (students × topics)
3. Misconception tracker table

**Day 11: Polish + Extras (5h)**
4. Port `preprocessMessages()` → clean messages before analytics
5. Word cloud (student topics)
6. Response time analysis (LAG SQL)
7. Message type distribution pie chart
8. Add FTS5 to messages table (if not already) for search

---

## Key Structural Gap

TAi doesn't have `chat_session` / `message_context` tables (ChatLab's session segmentation layer). Options:
1. **Add them** — implement session gap detection (threshold: 30min idle = new session) as a migration
2. **Compute inline** — group messages by gap > N minutes in analytics queries without storing sessions
3. **Use existing** — TAi's `data/sessions/{group}/.claude/` stores Claude Agent SDK sessions, not the same thing

For the interaction network and response latency SQL, **option 2 (inline gap grouping)** is fastest to ship. May add proper sessions table later if needed for session-aware RAG chunking.

---

## API Endpoints Summary

| Endpoint | Method | Returns | Source |
|---|---|---|---|
| `/api/dashboard/overview` | GET | StatCards data (4 metrics) + daily trend | Custom |
| `/api/dashboard/students` | GET | Student list with risk scores + competency | Custom + filesystem |
| `/api/dashboard/student/:jid` | GET | Student detail (activity, competency, messages) | Custom |
| `/api/dashboard/activity-heatmap` | GET | 24×7 hour/weekday grid | Port `getHourlyActivity` + `getWeekdayActivity` |
| `/api/dashboard/daily-trend` | GET | Daily message counts (N days) | Port `getDailyActivity` |
| `/api/dashboard/calendar` | GET | 365-day daily counts | Port `getDailyActivity` (full range) |
| `/api/dashboard/at-risk` | GET | Students sorted by inactive days | Port `getDivingAnalysis` |
| `/api/dashboard/interaction-network` | GET | Nodes + links for EChartGraph | Port `getClusterGraph` |
| `/api/dashboard/student-activity` | GET | Per-student message rankings | Port `getMemberActivity` |
| `/api/dashboard/query-nl` | POST (SSE) | AI-generated SQL results | Port `buildAIPrompt` pattern |
| `/api/dashboard/query-sql` | POST | Direct SQL execution | Port `executeSQL` |
| `/api/dashboard/competency-overview` | GET | Students × topics confidence matrix | Read COMPETENCY.md files |
| `/api/dashboard/patrol-log` | GET | Teaching patrol decisions | Read audit log |
| `/api/dashboard/message-search` | GET | FTS5 message search | Port `searchByFts` pattern |
| `/api/dashboard/word-frequency` | GET | Top terms for wordcloud | Port `getCatchphraseAnalysis` |

---

## Authentication

Simple bearer token auth. Reuse `VOICE_INTERVIEW_SECRET` or add separate `DASHBOARD_SECRET` to .env.

```typescript
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
    || req.query.token
  if (token !== process.env.DASHBOARD_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  next()
}
```

The dashboard HTML page will prompt for the token on first load and store it in localStorage.

---

## Opus 4.7 Migration Note (separate from dashboard)

`us.anthropic.claude-opus-4-7` is listed as AUTHORIZED/AVAILABLE in Bedrock us-west-2 metadata but returns `InternalServerException` on all invocation paths (invoke_model, converse API, AWS web console). This is a Bedrock-side bug. Confirmed 2026-04-16. Wait for AWS to fix.

**When ready to migrate:**
- Breaking changes: remove `temperature`/`top_p`/`top_k` params, use `thinking: {type: "adaptive"}` only
- Model ID: `us.anthropic.claude-opus-4-7` (cross-region inference profile, no `-v1:0` suffix)
- Simple swap in `container-runner.ts` `readSecrets()`
