"""LeanRAG configuration — all tunables in one place."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load AWS credentials from project .env
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

# ── Paths ──────────────────────────────────────────────────────────────
MATERIALS_DIR = _PROJECT_ROOT / "cs6650-materials"
CACHE_DIR = Path(__file__).resolve().parent / "cache"
GRAPH_PATH = Path(__file__).resolve().parent / "graph.pkl"
CHUNK_INDEX_PATH = Path(__file__).resolve().parent / "chunk_index.json"
EXTRACTION_STORE_PATH = CACHE_DIR / "extraction_store.json"

# ── AWS / Bedrock ──────────────────────────────────────────────────────
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")

DEEPSEEK_MODEL_ID = os.getenv(
    "LEANRAG_DEEPSEEK_MODEL_ID",
    "us.deepseek.r1-v1:0",
)
COHERE_EMBED_MODEL_ID = os.getenv(
    "LEANRAG_COHERE_EMBED_MODEL_ID",
    "cohere.embed-english-v3",
)

# ── Rate limits (requests per minute) ─────────────────────────────────
DEEPSEEK_RPM = int(os.getenv("LEANRAG_DEEPSEEK_RPM", "30"))
COHERE_RPM = int(os.getenv("LEANRAG_COHERE_RPM", "60"))

# ── Chunking ───────────────────────────────────────────────────────────
CHUNK_WINDOW = 1024        # tokens
CHUNK_STEP = 128           # token stride
CHUNK_MIN_CHARS = 50       # skip chunks with fewer non-whitespace chars
TIKTOKEN_ENCODING = "cl100k_base"

# ── Extraction ─────────────────────────────────────────────────────────
DEEPSEEK_MAX_TOKENS = 4096
DEEPSEEK_TEMPERATURE = 0.1
SAVE_EVERY_N_CHUNKS = 10   # checkpoint interval during extraction

# ── Embedding ──────────────────────────────────────────────────────────
EMBED_BATCH_SIZE = 96       # max texts per Cohere batch call

# ── Clustering ─────────────────────────────────────────────────────────
CLUSTER_SIZE = 20           # target entities per cluster
TAU = 3                     # min cross-cluster relation count for summary relation

# ── Files to skip ──────────────────────────────────────────────────────
SKIP_FILENAMES = {
    "journal entry.txt",    # not course material
}
