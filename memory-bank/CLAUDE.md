# Memory Bank Instructions

This directory contains development state files that persist across conversations. Read these before starting work on the TAi project.

## Files

| File | Purpose | When to Read |
|------|---------|-------------|
| `progress.md` | What's done, in progress, and remaining | Start of every conversation |
| `activeContext.md` | Current focus, recent decisions, immediate next steps | Start of every conversation |
| `systemPatterns.md` | Architecture, data flow, design patterns | When modifying code or architecture |

## Rules

1. **Read before assuming.** Check progress.md and activeContext.md before claiming anything is or isn't implemented.
2. **Update after work.** When you complete a task or make a significant decision, update the relevant files.
3. **activeContext.md decays fast.** Keep it current — remove stale entries, update decisions as they change.
4. **progress.md is the source of truth** for implementation status, not the root CLAUDE.md phase checklists (those may lag behind).
5. **systemPatterns.md changes rarely.** Only update when architecture actually changes, not for feature additions.
