"""LeanRAG offline graph construction — main orchestrator.

Usage:
    python -m leanrag.build_graph                   # full pipeline
    python -m leanrag.build_graph --dry-run         # load + chunk only
    python -m leanrag.build_graph --force           # ignore caches
"""

from __future__ import annotations

import argparse
import json
import logging
import pickle
import sys

import networkx as nx
import numpy as np

from . import config
from .bedrock import embed_all
from .extract import (
    Entity,
    Relation,
    embed_entities,
    extract_from_chunks,
    gmm_cluster,
)
from .loader import (
    Chunk,
    chunk_documents,
    corpus_hash,
    load_chunks_cache,
    load_documents,
    save_chunks_cache,
)

log = logging.getLogger(__name__)


# ── Graph assembly ─────────────────────────────────────────────────────

def build_networkx_graph(
    g0_entities: list[Entity],
    g0_relations: list[Relation],
    g0_embeddings: np.ndarray,
    g0_membership: dict[int, list[int]],
    g1_entities: list[Entity],
    g1_relations: list[Relation],
    g1_embeddings: np.ndarray,
    g1_membership: dict[int, list[int]],
    g2_entities: list[Entity],
    g2_relations: list[Relation],
    g2_embeddings: np.ndarray,
) -> nx.DiGraph:
    """Assemble the three-layer hierarchical knowledge graph."""
    G = nx.DiGraph()

    # ── G0: Entity layer ───────────────────────────────────────────
    # Pre-compute entity index → cluster_id for O(1) lookup
    g0_idx_to_cluster: dict[int, int] = {}
    for cid, indices in g0_membership.items():
        for idx in indices:
            g0_idx_to_cluster[idx] = cid

    for i, ent in enumerate(g0_entities):
        node_id = f"g0:{ent.name}"
        G.add_node(node_id,
                    layer=0,
                    name=ent.name,
                    description=ent.description,
                    embedding=g0_embeddings[i] if i < len(g0_embeddings) else None,
                    source_chunk_ids=ent.source_chunk_ids,
                    source_files=ent.source_files,
                    cluster_id=g0_idx_to_cluster.get(i))

    for rel in g0_relations:
        G.add_edge(f"g0:{rel.head}", f"g0:{rel.tail}",
                    relation=rel.relation,
                    layer=0,
                    weight=rel.weight,
                    source_chunk_ids=rel.source_chunk_ids)

    # ── G1: Cluster layer ──────────────────────────────────────────
    g1_idx_to_cluster: dict[int, int] = {}
    for cid, indices in g1_membership.items():
        for idx in indices:
            g1_idx_to_cluster[idx] = cid

    for i, ent in enumerate(g1_entities):
        node_id = f"g1:{ent.name}"
        G.add_node(node_id,
                    layer=1,
                    name=ent.name,
                    description=ent.description,
                    embedding=g1_embeddings[i] if i < len(g1_embeddings) else None,
                    member_count=len(g0_membership.get(i, [])),
                    cluster_id=g1_idx_to_cluster.get(i))

    for rel in g1_relations:
        G.add_edge(f"g1:{rel.head}", f"g1:{rel.tail}",
                    relation=rel.relation,
                    layer=1,
                    weight=rel.weight,
                    source_chunk_ids=rel.source_chunk_ids)

    # MEMBER_OF edges: G0 → G1
    # g0_membership keys are 0-based cluster indices matching g1_entities positions
    for cid, indices in g0_membership.items():
        if cid >= len(g1_entities):
            continue
        cluster_name = g1_entities[cid].name
        for idx in indices:
            if idx < len(g0_entities):
                G.add_edge(f"g0:{g0_entities[idx].name}", f"g1:{cluster_name}",
                            relation="MEMBER_OF", layer=-1, weight=1.0,
                            source_chunk_ids=[])

    # ── G2: Theme layer ────────────────────────────────────────────
    for i, ent in enumerate(g2_entities):
        node_id = f"g2:{ent.name}"
        G.add_node(node_id,
                    layer=2,
                    name=ent.name,
                    description=ent.description,
                    embedding=g2_embeddings[i] if i < len(g2_embeddings) else None,
                    member_count=len(g1_membership.get(i, [])))

    for rel in g2_relations:
        G.add_edge(f"g2:{rel.head}", f"g2:{rel.tail}",
                    relation=rel.relation,
                    layer=2,
                    weight=rel.weight,
                    source_chunk_ids=rel.source_chunk_ids)

    # MEMBER_OF edges: G1 → G2
    # g1_membership keys are 0-based cluster indices matching g2_entities positions
    for cid, indices in g1_membership.items():
        if cid >= len(g2_entities):
            continue
        theme_name = g2_entities[cid].name
        for idx in indices:
            if idx < len(g1_entities):
                G.add_edge(f"g1:{g1_entities[idx].name}", f"g2:{theme_name}",
                            relation="MEMBER_OF", layer=-1, weight=1.0,
                            source_chunk_ids=[])

    return G


def save_chunk_index(chunks: list[Chunk]) -> None:
    """Save chunk ID → source text mapping for Phase 2B retrieval."""
    index = {c.chunk_id: {"text": c.text, "source_file": c.source_file} for c in chunks}
    config.CHUNK_INDEX_PATH.write_text(
        json.dumps(index, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    log.info("Saved chunk index (%d chunks) to %s", len(index), config.CHUNK_INDEX_PATH)


def print_summary(G: nx.DiGraph) -> None:
    """Print graph summary stats."""
    layers = {0: "G0 (entities)", 1: "G1 (clusters)", 2: "G2 (themes)"}
    print("\n" + "=" * 60)
    print("LeanRAG Knowledge Graph — Summary")
    print("=" * 60)
    print(f"Total nodes: {G.number_of_nodes()}")
    print(f"Total edges: {G.number_of_edges()}")
    print()

    for layer_id, layer_name in layers.items():
        nodes = [n for n, d in G.nodes(data=True) if d.get("layer") == layer_id]
        edges = [
            (u, v) for u, v, d in G.edges(data=True)
            if d.get("layer") == layer_id
        ]
        cross = [
            (u, v) for u, v, d in G.edges(data=True)
            if d.get("layer") == -1
            and G.nodes[u].get("layer") == layer_id
        ]
        print(f"  {layer_name}: {len(nodes)} nodes, {len(edges)} intra-edges, {len(cross)} MEMBER_OF edges")

        if nodes:
            print(f"    Top entities: {', '.join(G.nodes[n].get('name', n) for n in nodes[:8])}")
            if len(nodes) > 8:
                print(f"    ... and {len(nodes) - 8} more")
        print()

    print("=" * 60)


# ── Main pipeline ──────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="LeanRAG offline graph construction")
    parser.add_argument("--dry-run", action="store_true",
                        help="Load and chunk only, no API calls")
    parser.add_argument("--force", action="store_true",
                        help="Ignore all caches")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # ── Stage 1: Load documents ────────────────────────────────────
    log.info("Loading documents from %s", config.MATERIALS_DIR)
    docs = load_documents()
    log.info("Loaded %d documents", len(docs))
    for doc in docs:
        log.info("  %s (%s) — %d chars", doc.path, doc.category, len(doc.text))

    # ── Stage 2: Chunking ──────────────────────────────────────────
    chash = corpus_hash(docs)
    log.info("Corpus hash: %s", chash)

    chunks: list[Chunk] | None = None
    if not args.force:
        chunks = load_chunks_cache(chash)
        if chunks:
            log.info("Loaded %d chunks from cache", len(chunks))

    if chunks is None:
        chunks = chunk_documents(docs)
        save_chunks_cache(chunks, chash)
        log.info("Chunked into %d chunks (saved to cache)", len(chunks))

    if args.dry_run:
        print(f"\n[DRY RUN] Loaded {len(docs)} documents, {len(chunks)} chunks")
        print(f"Corpus hash: {chash}")
        print("\nChunk distribution by source:")
        by_file: dict[str, int] = {}
        for c in chunks:
            by_file[c.source_file] = by_file.get(c.source_file, 0) + 1
        for f, count in sorted(by_file.items()):
            print(f"  {f}: {count} chunks")
        return

    # ── Stage 3: Entity extraction ─────────────────────────────────
    log.info("Extracting entities and relations from %d chunks", len(chunks))
    g0_entities, g0_relations = extract_from_chunks(chunks, force=args.force)
    log.info("Extracted %d entities, %d relations", len(g0_entities), len(g0_relations))

    if not g0_entities:
        log.error("No entities extracted — cannot build graph")
        sys.exit(1)

    # ── Stage 4: Embed G0 entities ─────────────────────────────────
    log.info("Embedding %d G0 entities", len(g0_entities))
    g0_embeddings = embed_entities(g0_entities, force=args.force)

    # ── Stage 5: GMM clustering G0 → G1 ───────────────────────────
    log.info("Clustering G0 → G1")
    g1_entities, g1_relations, g0_membership = gmm_cluster(
        g0_entities, g0_embeddings, g0_relations,
    )
    log.info("G1: %d clusters, %d inter-cluster relations", len(g1_entities), len(g1_relations))

    # ── Stage 6: Embed G1, cluster G1 → G2 ────────────────────────
    if len(g1_entities) >= 2:
        log.info("Embedding %d G1 clusters", len(g1_entities))
        g1_descriptions = [e.description or e.name for e in g1_entities]
        g1_embeddings = embed_all(g1_descriptions)

        log.info("Clustering G1 → G2")
        g2_entities, g2_relations, g1_membership = gmm_cluster(
            g1_entities, g1_embeddings, g1_relations,
        )
        g2_descriptions = [e.description or e.name for e in g2_entities]
        g2_embeddings = embed_all(g2_descriptions) if g2_entities else np.empty((0, 0))
        log.info("G2: %d themes, %d inter-theme relations", len(g2_entities), len(g2_relations))
    else:
        log.info("Too few G1 clusters for G2 layer, skipping")
        g1_embeddings = np.empty((0, 0))
        g2_entities, g2_relations, g1_membership = [], [], {}
        g2_embeddings = np.empty((0, 0))

    # ── Stage 7: Assemble graph ────────────────────────────────────
    log.info("Assembling NetworkX graph")
    G = build_networkx_graph(
        g0_entities, g0_relations, g0_embeddings, g0_membership,
        g1_entities, g1_relations, g1_embeddings, g1_membership,
        g2_entities, g2_relations, g2_embeddings,
    )

    # ── Stage 8: Save ─────────────────────────────────────────────
    with open(config.GRAPH_PATH, "wb") as f:
        pickle.dump(G, f, protocol=pickle.HIGHEST_PROTOCOL)
    log.info("Saved graph to %s", config.GRAPH_PATH)

    save_chunk_index(chunks)

    print_summary(G)


if __name__ == "__main__":
    main()
