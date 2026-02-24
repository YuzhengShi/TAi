"""LeanRAG query-time retrieval — embedding + graph traversal, zero LLM calls.

Given a question, embeds it via Cohere Embed on Bedrock, finds the most similar
G0 entities by cosine similarity, then traverses MEMBER_OF edges to find lowest
common ancestors and collects the connecting subgraph + original source chunks.
"""

from __future__ import annotations

import json
import logging
import os
import pickle
from pathlib import Path

import boto3
import networkx as nx
import numpy as np
from botocore.config import Config as BotoConfig

log = logging.getLogger(__name__)

# ── Configuration (env-overridable, defaults to sibling files) ────────

_LEANRAG_DIR = Path(__file__).resolve().parent

GRAPH_PATH = Path(os.getenv("LEANRAG_GRAPH_PATH", str(_LEANRAG_DIR / "graph.pkl")))
CHUNK_INDEX_PATH = Path(os.getenv("LEANRAG_CHUNK_INDEX_PATH", str(_LEANRAG_DIR / "chunk_index.json")))

AWS_REGION = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-west-2"))
COHERE_MODEL_ID = os.getenv("LEANRAG_COHERE_EMBED_MODEL_ID", "cohere.embed-english-v3")

_COHERE_MAX_CHARS = 2048

_BOTO_CFG = BotoConfig(
    read_timeout=30,
    connect_timeout=10,
    retries={"max_attempts": 3},
)

_bedrock_client = None


def _get_client():
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client(
            "bedrock-runtime",
            region_name=AWS_REGION,
            config=_BOTO_CFG,
        )
    return _bedrock_client


def _embed_query(text: str) -> np.ndarray:
    """Embed a single query via Cohere Embed on Bedrock.

    Uses input_type="search_query" (vs "search_document" used at index time)
    so the embedding is optimized for retrieval.
    """
    body = json.dumps({
        "texts": [text[:_COHERE_MAX_CHARS]],
        "input_type": "search_query",
        "embedding_types": ["float"],
    })
    resp = _get_client().invoke_model(modelId=COHERE_MODEL_ID, body=body)
    result = json.loads(resp["body"].read())
    return np.array(result["embeddings"]["float"][0], dtype=np.float32)


# ── Index ─────────────────────────────────────────────────────────────

class LeanRAGIndex:
    """Pre-loaded graph + chunk index for fast query-time retrieval."""

    def __init__(
        self,
        graph_path: Path = GRAPH_PATH,
        chunk_index_path: Path = CHUNK_INDEX_PATH,
    ):
        log.info("Loading graph from %s", graph_path)
        with open(graph_path, "rb") as f:
            self.graph: nx.DiGraph = pickle.load(f)

        log.info("Loading chunk index from %s", chunk_index_path)
        with open(chunk_index_path, "r", encoding="utf-8") as f:
            self.chunk_index: dict = json.load(f)

        # Pre-build normalized embedding matrix for G0 entities
        self._g0_nodes: list[str] = []
        embeddings: list[np.ndarray] = []
        for node, data in self.graph.nodes(data=True):
            if data.get("layer") == 0 and data.get("embedding") is not None:
                self._g0_nodes.append(node)
                embeddings.append(data["embedding"])

        self._g0_embeddings = np.vstack(embeddings)
        norms = np.linalg.norm(self._g0_embeddings, axis=1, keepdims=True)
        self._g0_normed = self._g0_embeddings / np.maximum(norms, 1e-10)

        log.info(
            "Index ready: %d G0 entities with embeddings, %d chunks",
            len(self._g0_nodes),
            len(self.chunk_index),
        )

    # ── Public API ────────────────────────────────────────────────────

    def query(
        self,
        question: str,
        difficulty: str = "auto",
        top_k: int = 10,
    ) -> dict:
        """Query the knowledge graph.  No LLM calls — only embedding + graph traversal."""

        # 1. Embed query
        query_emb = _embed_query(question)
        query_normed = query_emb / max(float(np.linalg.norm(query_emb)), 1e-10)

        # 2. Cosine similarity against all G0 entities
        scores = self._g0_normed @ query_normed
        top_k = min(top_k, len(self._g0_nodes))
        top_indices = np.argsort(scores)[-top_k:][::-1]

        seed_nodes = [self._g0_nodes[i] for i in top_indices]
        seed_scores = [float(scores[i]) for i in top_indices]

        # 3. Resolve difficulty layer
        if difficulty == "auto":
            avg = float(np.mean(seed_scores[: min(3, len(seed_scores))]))
            if avg > 0.65:
                target_layer = 0   # entity-level
            elif avg > 0.45:
                target_layer = 1   # cluster-level
            else:
                target_layer = 2   # theme-level
        else:
            target_layer = {"entity": 0, "cluster": 1, "theme": 2}.get(difficulty, 0)

        # 4. LCA path traversal
        collected_nodes, collected_edges = self._lca_paths(seed_nodes, target_layer)

        # 5. Gather source chunks from collected G0 entities
        chunk_ids: set[str] = set()
        for node in collected_nodes:
            if self.graph.nodes[node].get("layer") == 0:
                for cid in self.graph.nodes[node].get("source_chunk_ids", []):
                    chunk_ids.add(cid)

        source_texts = []
        for cid in sorted(chunk_ids):
            entry = self.chunk_index.get(cid)
            if entry:
                source_texts.append({
                    "chunk_id": cid,
                    "text": entry["text"],
                    "source_file": entry["source_file"],
                })

        # 6. Build response
        layer_name = {0: "entity", 1: "cluster", 2: "theme"}

        entities = []
        for node in sorted(collected_nodes):
            d = self.graph.nodes[node]
            entities.append({
                "id": node,
                "layer": d["layer"],
                "name": d["name"],
                "description": d.get("description", ""),
            })

        relations = []
        for u, v in sorted(collected_edges):
            d = self.graph.edges[u, v]
            relations.append({
                "head": u,
                "relation": d.get("relation", ""),
                "tail": v,
                "weight": d.get("weight", 1.0),
            })

        return {
            "entities": entities,
            "relations": relations,
            "source_texts": source_texts,
            "difficulty": layer_name.get(target_layer, "entity"),
            "seed_entities": [
                {"id": n, "name": self.graph.nodes[n]["name"], "score": round(s, 4)}
                for n, s in zip(seed_nodes, seed_scores)
            ],
        }

    # ── LCA traversal ────────────────────────────────────────────────

    def _lca_paths(
        self,
        seed_nodes: list[str],
        target_layer: int,
    ) -> tuple[set[str], set[tuple[str, str]]]:
        """Find lowest common ancestors via MEMBER_OF edges and collect paths.

        For each pair of seed G0 entities, walks up the hierarchy
        (G0 -> G1 -> G2) to find the first shared ancestor, then collects
        every node and edge on both paths to that ancestor.
        """
        collected_nodes: set[str] = set(seed_nodes)
        collected_edges: set[tuple[str, str]] = set()

        # Build ancestor chain for each seed: [G0, G1_cluster, G2_theme]
        chains: dict[str, list[str]] = {}
        for node in seed_nodes:
            chain = [node]
            current = node
            while True:
                parent = None
                for _, target, data in self.graph.out_edges(current, data=True):
                    if data.get("relation") == "MEMBER_OF":
                        parent = target
                        break
                if parent is None:
                    break
                chain.append(parent)
                current = parent
            chains[node] = chain

        # For each pair find the LCA and collect path nodes
        for i, node_a in enumerate(seed_nodes):
            chain_a = chains.get(node_a, [node_a])
            set_a = set(chain_a)
            for node_b in seed_nodes[i + 1 :]:
                chain_b = chains.get(node_b, [node_b])
                lca = None
                for ancestor in chain_b:
                    if ancestor in set_a:
                        lca = ancestor
                        break
                if lca is None:
                    continue
                # Collect nodes from node_a up to LCA
                for n in chain_a:
                    collected_nodes.add(n)
                    if n == lca:
                        break
                # Collect nodes from node_b up to LCA
                for n in chain_b:
                    collected_nodes.add(n)
                    if n == lca:
                        break

        # Also include ancestors up to target_layer for every seed
        # (ensures cluster / theme context even if only one seed lands there)
        for node in seed_nodes:
            chain = chains.get(node, [node])
            for n in chain:
                node_layer = self.graph.nodes[n].get("layer", 0)
                if node_layer <= target_layer:
                    collected_nodes.add(n)

        # Collect all edges (MEMBER_OF + intra-layer) between collected nodes
        for u, v, data in self.graph.edges(data=True):
            if u in collected_nodes and v in collected_nodes:
                collected_edges.add((u, v))

        return collected_nodes, collected_edges


# ── Singleton ─────────────────────────────────────────────────────────

_index: LeanRAGIndex | None = None


def get_index() -> LeanRAGIndex:
    """Lazy-load the index (one graph load per process lifetime)."""
    global _index
    if _index is None:
        _index = LeanRAGIndex()
    return _index


def query_knowledge(
    question: str,
    difficulty: str = "auto",
    top_k: int = 10,
) -> dict:
    """Top-level query function.  Loads the index on first call."""
    return get_index().query(question, difficulty=difficulty, top_k=top_k)
