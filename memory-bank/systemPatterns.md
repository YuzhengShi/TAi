# TAi System Patterns

## Architecture

```
WhatsApp (Baileys) → SQLite → Message Loop → Group Queue → Docker Container → Claude Agent SDK (Bedrock)
                                                                    ↓
                                                         MCP Tools (nanoclaw + leanrag)
                                                                    ↓
                                                         IPC (JSON files) → Host processes response
```

Single Node.js host process orchestrates everything. Containers are ephemeral (--rm), one per interaction.

## Data Flow Patterns

### Message Processing
1. WhatsApp message arrives → stored in SQLite → debounced (1.5s)
2. Group queue checks concurrency limit → spawns container or pipes to active container
3. Container receives messages via stdin (NDJSON) → runs Claude Agent SDK query
4. Agent output streams back via stdout markers → parsed, sent to WhatsApp
5. IPC files (messages/, tasks/) processed by host watcher for side effects

### Secrets Isolation
- `readEnvFile()` reads .env file on disk, does NOT load into process.env
- Secrets passed to containers via stdin, never mounted as files
- Bash subprocesses get secrets stripped (unset commands prepended)
- Only AWS credentials fall back to process.env (for EC2 instance role)

### Container Security Model
- `--cap-drop ALL --security-opt no-new-privileges`
- `--tmpfs /tmp:size=512m,noexec`
- Memory/CPU/PID limits configurable
- Non-main containers: restricted Bash, blocked sensitive file reads, SSRF protection, workspace size limits
- Main container: full project root access for admin operations

### Mount Strategy
| Mount | Container Path | Access | Who |
|-------|---------------|--------|-----|
| Project root | /workspace/project | rw | main only |
| groups/{folder} | /workspace/group | rw | all |
| groups/global | /workspace/global | ro | non-main |
| data/sessions/{folder}/.claude | /home/node/.claude | rw | all |
| data/ipc/{folder} | /workspace/ipc | rw | all |
| leanrag/ | /workspace/leanrag | ro | all (if exists) |
| container/agent-runner/src | /app/src | ro | all |

### Path Resolution
All paths relative to `process.cwd()`:
- `STORE_DIR` = `{cwd}/store/` (WhatsApp auth + SQLite DB at store/messages.db)
- `GROUPS_DIR` = `{cwd}/groups/`
- `DATA_DIR` = `{cwd}/data/` (ipc/, sessions/, audit/)
- Mount allowlist at `~/.config/nanoclaw/mount-allowlist.json` (outside project)

## Model Routing
- Scheduled tasks (patrol, sync, bootstrap) → Haiku 4.5 (light model, cost saving)
- Student messages → Haiku 4.5 (daily TA, 80%+ of interactions)
- Complex reasoning → Sonnet 4.6 (code review, deep concepts)
- Voice interviews → Nova 2 Sonic (bidirectional streaming)
- Shadow Evaluator → Sonnet 4 (mid-interview scoring, async tool calls)
- Graph construction (offline) → DeepSeek V3.2
- Embeddings → Cohere Embed v4

## Teaching Patterns
- **Socratic-first**: never give direct answers, guide through questions
- **Mastery-adaptive strategy**: LOW→EXPLAIN, MEDIUM→SOCRATIC, HIGH→CHALLENGE
- **Frustration override**: detect frustration → switch from Socratic to direct explanation
- **90% silence rule**: teaching patrol should result in no action 90% of the time
- **Process over correctness**: reasoning through failure > reciting correct facts
- **Misconceptions discovered organically**: never pre-loaded, only recorded when observed

## Session Management
- Claude Agent SDK sessions stored in data/sessions/{folder}/.claude/
- Session resume via `resumeAt` (latest assistant message UUID)
- Force fresh session after 10 queries (prevents context overflow)
- Bedrock 500 error detection → auto-reset session

## Voice Interview Flow
1. Agent sends `start_mock_interview` MCP tool → generates HMAC-SHA256 token (1hr, single-use)
2. Student opens link → voice/server.ts serves frontend
3. Socket.IO connection → SessionManager creates NovaSonicSession
4. System prompt built from COMPETENCY.md + Canvas assignment + GitHub code + lecture content
5. Bidirectional audio: student 16kHz PCM ↔ Nova Sonic 24kHz PCM
6. Mid-interview: `evaluate_answer` async tool → Shadow Evaluator (Sonnet 4) scores answer
7. Difficulty adapts based on scores (easy/medium/hard)
8. Session resume at 7.5min boundary, max 20min total, up to 3 sessions
9. Post-interview: CompetencyWriter updates COMPETENCY.md + interviews.md + strategy-log.md
10. Key fix: send silence during AI playback to prevent echo feedback loop

## Background Automation
- **Teaching patrol**: weekday 9am, reads COMPETENCY.md + COURSE_STATUS.md, 10 intervention triggers
- **Course sync**: every 6h (2am/8am/2pm/8pm), fetches Canvas + GitHub, writes COURSE_STATUS.md
- **Competency bootstrap**: one-time per student, Canvas grades → initial mastery scores
- **Memory pruning**: decay-based TTL (permanent/stable/active/session/checkpoint)
