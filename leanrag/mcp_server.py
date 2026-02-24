"""LeanRAG MCP server — exposes query_knowledge tool via stdio transport.

Run as:  python -m leanrag.mcp_server
The Agent SDK spawns this process and communicates over stdin/stdout.
"""

from __future__ import annotations

import logging
import sys

from mcp.server.fastmcp import FastMCP

from .query import query_knowledge as _query_knowledge

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger(__name__)

mcp = FastMCP("leanrag", log_level="WARNING")


# ── Formatting ────────────────────────────────────────────────────────

_MAX_SOURCE_FILES = 8
_MAX_CHUNK_CHARS = 600


def _format_context(result: dict) -> str:
    """Format the raw query result as a readable context string for the agent."""
    lines: list[str] = []

    lines.append(f"## LeanRAG Knowledge Retrieval (difficulty: {result['difficulty']})")
    lines.append("")

    # Seed entities (highest-similarity matches)
    lines.append("### Most Relevant Concepts")
    for seed in result["seed_entities"][:5]:
        lines.append(f"- **{seed['name']}** (relevance: {seed['score']:.2f})")
    lines.append("")

    # All entities with descriptions
    lines.append("### Concepts in Context")
    for ent in result["entities"]:
        label = {0: "entity", 1: "cluster", 2: "theme"}.get(ent["layer"], "?")
        desc = ent["description"]
        if desc:
            lines.append(f"- [{label}] **{ent['name']}**: {desc}")
        else:
            lines.append(f"- [{label}] **{ent['name']}**")
    lines.append("")

    # Relations
    if result["relations"]:
        lines.append("### Relationships")
        for rel in result["relations"]:
            head = rel["head"].split(":", 1)[-1] if ":" in rel["head"] else rel["head"]
            tail = rel["tail"].split(":", 1)[-1] if ":" in rel["tail"] else rel["tail"]
            lines.append(f"- {head} --[{rel['relation']}]--> {tail}")
        lines.append("")

    # Source texts (course materials) — deduplicated by file, capped
    if result["source_texts"]:
        lines.append("### Source Course Materials")
        seen_files: set[str] = set()
        shown = 0
        for src in result["source_texts"]:
            if shown >= _MAX_SOURCE_FILES:
                remaining = len(result["source_texts"]) - shown
                lines.append(f"_... and {remaining} more source chunks_")
                break
            fkey = src["source_file"]
            if fkey in seen_files:
                continue
            seen_files.add(fkey)
            text = src["text"]
            if len(text) > _MAX_CHUNK_CHARS:
                text = text[:_MAX_CHUNK_CHARS] + "..."
            lines.append(f"**Source: {src['source_file']}**")
            lines.append(f"```\n{text}\n```")
            lines.append("")
            shown += 1

    return "\n".join(lines)


# ── Tool ──────────────────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Query the CS6650 course knowledge graph for structured, grounded information. "
        "Returns concepts, relationships, and source course materials relevant to the question. "
        "Use this BEFORE answering any course content question to ground your response in "
        "Professor Coady's actual materials rather than general knowledge.\n\n"
        "difficulty levels:\n"
        "- 'auto': system chooses based on query specificity (recommended)\n"
        "- 'entity': fine-grained concept lookup (e.g., 'What does a Paxos proposer do?')\n"
        "- 'cluster': concept group context (e.g., 'Compare consensus protocols')\n"
        "- 'theme': broad thematic analysis (e.g., 'Fault tolerance vs scalability tradeoffs')"
    ),
)
def query_knowledge(
    question: str,
    difficulty: str = "auto",
    top_k: int = 10,
) -> str:
    """Query the CS6650 course knowledge graph."""
    log.info("query_knowledge: question=%r difficulty=%s top_k=%d", question, difficulty, top_k)

    if difficulty not in ("auto", "entity", "cluster", "theme"):
        difficulty = "auto"
    top_k = max(1, min(top_k, 30))

    try:
        result = _query_knowledge(question, difficulty=difficulty, top_k=top_k)
        return _format_context(result)
    except FileNotFoundError as exc:
        return f"LeanRAG error: knowledge graph not found — {exc}"
    except Exception as exc:
        log.exception("query_knowledge failed")
        return f"LeanRAG error: {type(exc).__name__}: {exc}"


# ── Entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
