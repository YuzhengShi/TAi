"""Document loading and sliding-window chunking."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber
import tiktoken

from . import config


@dataclass
class Document:
    path: str          # relative to MATERIALS_DIR
    text: str
    category: str      # lectures | assignments | papers


@dataclass
class Chunk:
    chunk_id: str               # {source_file}::{start_tok}_{end_tok}
    text: str
    source_file: str            # relative path
    start_token: int
    end_token: int


def _extract_pdf(path: Path) -> str:
    """Extract text from a PDF using pdfplumber."""
    pages: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n\n".join(pages)


def _extract_text(path: Path) -> str:
    """Read plain-text / markdown files."""
    return path.read_text(encoding="utf-8", errors="replace")


def load_documents() -> list[Document]:
    """Recursively scan MATERIALS_DIR and extract text from all supported files."""
    docs: list[Document] = []
    materials = config.MATERIALS_DIR

    if not materials.is_dir():
        raise FileNotFoundError(f"Materials directory not found: {materials}")

    for path in sorted(materials.rglob("*")):
        if not path.is_file():
            continue
        if path.name in config.SKIP_FILENAMES:
            continue
        if path.stat().st_size == 0:
            continue

        rel = path.relative_to(materials).as_posix()
        category = rel.split("/")[0] if "/" in rel else "unknown"

        suffix = path.suffix.lower()
        if suffix == ".pdf":
            text = _extract_pdf(path)
        elif suffix in (".md", ".txt"):
            text = _extract_text(path)
        else:
            continue

        text = text.strip()
        if not text:
            continue

        docs.append(Document(path=rel, text=text, category=category))

    return docs


def corpus_hash(docs: list[Document]) -> str:
    """Deterministic hash of the corpus for cache invalidation.

    Based on sorted (relative path, file size, mtime) of source files.
    """
    items: list[str] = []
    for doc in sorted(docs, key=lambda d: d.path):
        full = config.MATERIALS_DIR / doc.path
        stat = full.stat()
        items.append(f"{doc.path}|{stat.st_size}|{int(stat.st_mtime)}")
    return hashlib.sha256("\n".join(items).encode()).hexdigest()[:16]


def chunk_documents(docs: list[Document]) -> list[Chunk]:
    """Sliding-window chunking over token sequences."""
    enc = tiktoken.get_encoding(config.TIKTOKEN_ENCODING)
    chunks: list[Chunk] = []

    for doc in docs:
        tokens = enc.encode(doc.text)
        n = len(tokens)
        if n == 0:
            continue

        start = 0
        while start < n:
            end = min(start + config.CHUNK_WINDOW, n)
            text = enc.decode(tokens[start:end])

            # Skip noise chunks (e.g. diagram remnants from PDF)
            non_ws = len(re.sub(r"\s", "", text))
            if non_ws >= config.CHUNK_MIN_CHARS:
                chunk_id = f"{doc.path}::{start}_{end}"
                chunks.append(Chunk(
                    chunk_id=chunk_id,
                    text=text,
                    source_file=doc.path,
                    start_token=start,
                    end_token=end,
                ))

            if end >= n:
                break
            start += config.CHUNK_STEP

    return chunks


# ── Cache helpers ──────────────────────────────────────────────────────

def save_chunks_cache(chunks: list[Chunk], chash: str) -> Path:
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = config.CACHE_DIR / f"chunks_{chash}.json"
    data = [
        {
            "chunk_id": c.chunk_id,
            "text": c.text,
            "source_file": c.source_file,
            "start_token": c.start_token,
            "end_token": c.end_token,
        }
        for c in chunks
    ]
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return path


def load_chunks_cache(chash: str) -> list[Chunk] | None:
    path = config.CACHE_DIR / f"chunks_{chash}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return [
        Chunk(
            chunk_id=d["chunk_id"],
            text=d["text"],
            source_file=d["source_file"],
            start_token=d["start_token"],
            end_token=d["end_token"],
        )
        for d in data
    ]
