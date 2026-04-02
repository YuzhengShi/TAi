"""Entity extraction, deduplication, GMM clustering, and hierarchical aggregation."""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from sklearn.mixture import GaussianMixture

from . import config
from .bedrock import deepseek_converse, embed_all
from .loader import Chunk

log = logging.getLogger(__name__)


# ── Data structures ────────────────────────────────────────────────────

@dataclass
class Entity:
    name: str
    description: str
    source_chunk_ids: list[str] = field(default_factory=list)
    source_files: list[str] = field(default_factory=list)
    embedding: np.ndarray | None = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "source_chunk_ids": self.source_chunk_ids,
            "source_files": self.source_files,
        }

    @staticmethod
    def from_dict(d: dict) -> "Entity":
        return Entity(
            name=d["name"],
            description=d["description"],
            source_chunk_ids=d.get("source_chunk_ids", []),
            source_files=d.get("source_files", []),
        )


@dataclass
class Relation:
    head: str
    relation: str
    tail: str
    source_chunk_ids: list[str] = field(default_factory=list)
    weight: float = 1.0

    def to_dict(self) -> dict:
        return {
            "head": self.head,
            "relation": self.relation,
            "tail": self.tail,
            "source_chunk_ids": self.source_chunk_ids,
            "weight": self.weight,
        }

    @staticmethod
    def from_dict(d: dict) -> "Relation":
        return Relation(
            head=d["head"],
            relation=d["relation"],
            tail=d["tail"],
            source_chunk_ids=d.get("source_chunk_ids", []),
            weight=d.get("weight", 1.0),
        )


# ── Extraction prompt ─────────────────────────────────────────────────

EXTRACTION_PROMPT = """\
You are an expert in distributed systems and computer science education. \
Extract structured knowledge from the following text chunk from a CS6650 \
(Building Scalable Distributed Systems) course.

Extract entities and relations as JSON. Focus on:
- Concepts (e.g., consensus, replication, load balancing, CAP theorem)
- Technologies (e.g., Docker, Kafka, Terraform, Go, REST)
- Algorithms/Protocols (e.g., Paxos, Raft, 2PC, MapReduce)
- Design patterns (e.g., microservices, event sourcing, CQRS)
- Course-specific items (assignments, learning objectives)

Return a JSON array of objects, each with these fields:
- "head": entity name (concise, canonical form)
- "head_desc": one-sentence description of the head entity
- "relation": relationship type (e.g., "USES", "REQUIRES", "IMPLEMENTS", "PART_OF", "FOLLOWS", "COMPARED_WITH", "PREREQUISITE_OF")
- "tail": related entity name
- "tail_desc": one-sentence description of the tail entity

If the text has no extractable knowledge, return an empty array: []

TEXT:
{text}

Respond ONLY with the JSON array, no other text."""


def _parse_extraction(response: str) -> list[dict]:
    """Parse DeepSeek extraction response into list of relation dicts."""
    # Strip markdown code fences if present
    text = response.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    # Handle DeepSeek's <think> tags
    if "<think>" in text:
        # Take content after </think>
        parts = text.split("</think>")
        text = parts[-1].strip()

    # Find the JSON array
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        return []

    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        log.warning("Failed to parse extraction JSON, skipping chunk")
        return []


# ── Entity extraction from chunks ──────────────────────────────────────


def _chunk_content_hash(text: str) -> str:
    """Content-based hash for incremental extraction caching."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _migrate_old_caches(chunks: list[Chunk]) -> dict[str, list[dict]]:
    """One-time migration from corpus-hash-keyed caches to content-hash store."""
    # Build chunk_id → content_hash mapping from current chunks
    id_to_hash: dict[str, str] = {}
    for chunk in chunks:
        id_to_hash[chunk.chunk_id] = _chunk_content_hash(chunk.text)

    # Find the most recent complete old-format cache
    for path in sorted(config.CACHE_DIR.glob("entities_*.json"),
                       key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if not data.get("complete"):
            continue

        log.info("Migrating from old cache: %s", path.name)

        # Build entity name → description lookup
        entity_descs: dict[str, str] = {}
        for e in data.get("entities", []):
            entity_descs[e["name"]] = e.get("description", "")

        # Reconstruct per-chunk extraction tuples from relations
        by_chunk: dict[str, list[dict]] = {}
        for r in data.get("relations", []):
            for cid in r.get("source_chunk_ids", []):
                by_chunk.setdefault(cid, []).append({
                    "head": r["head"],
                    "head_desc": entity_descs.get(r["head"], ""),
                    "relation": r["relation"],
                    "tail": r["tail"],
                    "tail_desc": entity_descs.get(r["tail"], ""),
                })

        store: dict[str, list[dict]] = {}
        migrated = 0
        for chunk_id, tuples in by_chunk.items():
            chash = id_to_hash.get(chunk_id)
            if chash and chash not in store:
                store[chash] = tuples
                migrated += 1

        # Mark processed chunks that produced no relations as empty
        for chunk_id in data.get("processed_chunks", []):
            chash = id_to_hash.get(chunk_id)
            if chash and chash not in store:
                store[chash] = []
                migrated += 1

        log.info("Migrated %d chunk extractions from old cache", migrated)
        return store

    return {}


def extract_from_chunks(
    chunks: list[Chunk],
    force: bool = False,
) -> tuple[list[Entity], list[Relation]]:
    """Extract entities and relations from chunks via DeepSeek.

    Uses per-chunk content hashing for incremental extraction — only new or
    changed chunks trigger DeepSeek calls.  The extraction store persists
    across builds so adding a single lecture only processes its chunks.
    """
    store_path = config.EXTRACTION_STORE_PATH
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Load persistent extraction store (or migrate from old format)
    if not force and store_path.exists():
        store: dict[str, list[dict]] = json.loads(
            store_path.read_text(encoding="utf-8"),
        )
    elif not force:
        store = _migrate_old_caches(chunks)
    else:
        store = {}

    # Identify new chunks by content hash
    chunk_hashes: list[tuple[Chunk, str]] = []
    new_chunks: list[tuple[int, Chunk, str]] = []
    for i, chunk in enumerate(chunks):
        chash = _chunk_content_hash(chunk.text)
        chunk_hashes.append((chunk, chash))
        if chash not in store:
            new_chunks.append((i, chunk, chash))

    log.info("Incremental extraction: %d total, %d cached, %d new",
             len(chunks), len(chunks) - len(new_chunks), len(new_chunks))

    # Extract only new chunks
    for j, (i, chunk, chash) in enumerate(new_chunks):
        log.info("Extracting new chunk %d/%d (pos %d/%d): %s",
                 j + 1, len(new_chunks), i + 1, len(chunks), chunk.chunk_id)
        prompt = EXTRACTION_PROMPT.format(text=chunk.text)

        try:
            response = deepseek_converse(prompt)
        except Exception as exc:
            log.error("Extraction failed for %s: %s", chunk.chunk_id, exc)
            store[chash] = []
            continue

        store[chash] = _parse_extraction(response)

        # Checkpoint periodically
        if (j + 1) % config.SAVE_EVERY_N_CHUNKS == 0:
            store_path.write_text(
                json.dumps(store, ensure_ascii=False), encoding="utf-8",
            )
            log.info("Checkpoint: %d/%d new chunks extracted", j + 1, len(new_chunks))

    # Save updated store
    store_path.write_text(json.dumps(store, ensure_ascii=False), encoding="utf-8")

    # Assemble raw_tuples from current chunks with source attribution
    raw_tuples: list[dict] = []
    for chunk, chash in chunk_hashes:
        for item in store.get(chash, []):
            raw_tuples.append({
                **item,
                "source_chunk_id": chunk.chunk_id,
                "source_file": chunk.source_file,
            })

    return _deduplicate(raw_tuples)


# ── Deduplication ──────────────────────────────────────────────────────

def _normalize(name: str) -> str:
    return name.strip().lower()


def _deduplicate(raw_tuples: list[dict]) -> tuple[list[Entity], list[Relation]]:
    """Merge entities by normalized name and deduplicate relations."""
    entity_map: dict[str, Entity] = {}

    for t in raw_tuples:
        source_cid = t.get("source_chunk_id", "")
        source_file = t.get("source_file", "")

        for role in ("head", "tail"):
            name = _normalize(t.get(role, ""))
            desc = t.get(f"{role}_desc", "")
            if not name:
                continue

            if name not in entity_map:
                entity_map[name] = Entity(name=name, description=desc)

            ent = entity_map[name]
            if desc and desc not in ent.description:
                ent.description = f"{ent.description}; {desc}" if ent.description else desc
            if source_cid and source_cid not in ent.source_chunk_ids:
                ent.source_chunk_ids.append(source_cid)
            if source_file and source_file not in ent.source_files:
                ent.source_files.append(source_file)

    # Deduplicate relations by (head, relation_type, tail)
    rel_map: dict[tuple[str, str, str], Relation] = {}
    for t in raw_tuples:
        head = _normalize(t.get("head", ""))
        tail = _normalize(t.get("tail", ""))
        rel_type = t.get("relation", "").strip()
        if not head or not tail or not rel_type:
            continue
        if head not in entity_map or tail not in entity_map:
            continue

        key = (head, rel_type, tail)
        source_cid = t.get("source_chunk_id", "")
        if key not in rel_map:
            rel_map[key] = Relation(head=head, relation=rel_type, tail=tail)
        rel = rel_map[key]
        rel.weight += 1
        if source_cid and source_cid not in rel.source_chunk_ids:
            rel.source_chunk_ids.append(source_cid)

    entities = list(entity_map.values())
    relations = list(rel_map.values())
    log.info("Deduplication: %d raw tuples → %d entities, %d relations",
             len(raw_tuples), len(entities), len(relations))
    return entities, relations


# ── Embedding ──────────────────────────────────────────────────────────

def embed_entities(
    entities: list[Entity],
    force: bool = False,
) -> np.ndarray:
    """Embed all entity descriptions via Cohere. Returns (n_entities, dim) array."""
    entity_key = hashlib.sha256(
        "\n".join(sorted(e.name for e in entities)).encode(),
    ).hexdigest()[:16]
    cache_path = config.CACHE_DIR / f"embeddings_{entity_key}.npy"

    if not force and cache_path.exists():
        log.info("Loading cached embeddings from %s", cache_path)
        embeddings = np.load(str(cache_path))
        if embeddings.shape[0] == len(entities):
            return embeddings
        log.warning("Cached embeddings shape mismatch, re-embedding")

    descriptions = [e.description or e.name for e in entities]
    embeddings = embed_all(descriptions)

    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    np.save(str(cache_path), embeddings)
    log.info("Saved embeddings to %s (shape: %s)", cache_path, embeddings.shape)

    return embeddings


# ── GMM Clustering ─────────────────────────────────────────────────────

CLUSTER_SUMMARY_PROMPT = """\
You are summarizing a cluster of related concepts from a distributed systems course (CS6650).

The following entities belong to one cluster. Generate a single summary entity that \
captures the overarching theme.

Entities:
{entity_list}

Return a JSON object with two fields:
- "name": a concise theme/topic name (2-5 words)
- "description": a one-paragraph description of what this cluster covers

Respond ONLY with the JSON object."""


RELATION_SUMMARY_PROMPT = """\
You are summarizing relationships between concept clusters in a distributed systems course.

Cluster A: {cluster_a_name} — {cluster_a_desc}
Cluster B: {cluster_b_name} — {cluster_b_desc}

These clusters have {count} cross-cluster relations:
{relations_list}

Generate a single summary relation capturing the primary relationship.

Return a JSON object with one field:
- "relation": a concise relation description (e.g., "ENABLES", "DEPENDS_ON", "CONTRASTS_WITH")

Respond ONLY with the JSON object."""


def _parse_json_obj(text: str) -> dict:
    """Parse a JSON object from DeepSeek response."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    if "<think>" in text:
        parts = text.split("</think>")
        text = parts[-1].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return {}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}


def gmm_cluster(
    entities: list[Entity],
    embeddings: np.ndarray,
    relations: list[Relation],
) -> tuple[list[Entity], list[Relation], dict[int, list[int]]]:
    """GMM clustering: group entities, generate summary entities and relations.

    Returns:
        cluster_entities: list of summary Entity objects (one per cluster)
        cluster_relations: list of inter-cluster Relation objects
        membership: dict mapping cluster_id -> list of entity indices
    """
    n = len(entities)
    if n == 0:
        return [], [], {}

    n_components = max(2, math.ceil(n / config.CLUSTER_SIZE))
    # Ensure we don't request more components than data points
    n_components = min(n_components, n)

    log.info("GMM clustering: %d entities → %d clusters (target %d/cluster)",
             n, n_components, config.CLUSTER_SIZE)

    gmm = GaussianMixture(
        n_components=n_components,
        covariance_type="full",
        random_state=42,
    )
    labels = gmm.fit_predict(embeddings)

    # Build membership map — re-index to contiguous 0..k-1
    raw_membership: dict[int, list[int]] = {}
    for idx, label in enumerate(labels):
        raw_membership.setdefault(int(label), []).append(idx)

    # Renumber clusters to sequential 0-based indices so that
    # membership keys can safely index into cluster_entities list.
    sorted_cids = sorted(raw_membership.keys())
    membership: dict[int, list[int]] = {
        new_id: raw_membership[old_id]
        for new_id, old_id in enumerate(sorted_cids)
    }

    # Generate summary entity for each cluster
    cluster_entities: list[Entity] = []
    cluster_name_map: dict[int, str] = {}

    for cid in sorted(membership.keys()):
        member_indices = membership[cid]
        entity_list = "\n".join(
            f"- {entities[i].name}: {entities[i].description}"
            for i in member_indices
        )
        prompt = CLUSTER_SUMMARY_PROMPT.format(entity_list=entity_list)

        try:
            resp = deepseek_converse(prompt)
            parsed = _parse_json_obj(resp)
            name = parsed.get("name", f"Cluster {cid}")
            desc = parsed.get("description", "")
        except Exception as exc:
            log.error("Cluster summary failed for cluster %d: %s", cid, exc)
            name = f"Cluster {cid}"
            desc = f"Contains: {', '.join(entities[i].name for i in member_indices[:5])}"

        ent = Entity(name=name, description=desc)
        cluster_entities.append(ent)
        cluster_name_map[cid] = name
        log.info("Cluster %d: '%s' (%d members)", cid, name, len(member_indices))

    # Build entity name -> (renumbered) cluster_id lookup
    entity_to_cluster: dict[str, int] = {}
    for cid, indices in membership.items():
        for idx in indices:
            entity_to_cluster[entities[idx].name] = cid

    # Count cross-cluster relations
    cross_cluster: dict[tuple[int, int], list[Relation]] = {}
    for rel in relations:
        head_cid = entity_to_cluster.get(rel.head)
        tail_cid = entity_to_cluster.get(rel.tail)
        if head_cid is None or tail_cid is None or head_cid == tail_cid:
            continue
        key = (min(head_cid, tail_cid), max(head_cid, tail_cid))
        cross_cluster.setdefault(key, []).append(rel)

    # Generate inter-cluster relations
    summarize_pairs = [(k, v) for k, v in cross_cluster.items() if len(v) >= config.TAU]
    concat_pairs = [(k, v) for k, v in cross_cluster.items() if len(v) < config.TAU]
    log.info("Inter-cluster relations: %d pairs total (%d need DeepSeek summary, %d concatenated)",
             len(cross_cluster), len(summarize_pairs), len(concat_pairs))

    cluster_relations: list[Relation] = []
    for i, ((cid_a, cid_b), rels) in enumerate(cross_cluster.items()):
        if len(rels) >= config.TAU:
            if (i + 1) % 20 == 0 or i == 0:
                log.info("Summarizing inter-cluster relation %d/%d", i + 1, len(cross_cluster))
            # Summarize via DeepSeek
            rels_text = "\n".join(f"- {r.head} {r.relation} {r.tail}" for r in rels[:10])
            prompt = RELATION_SUMMARY_PROMPT.format(
                cluster_a_name=cluster_name_map[cid_a],
                cluster_a_desc=cluster_entities[cid_a].description[:200],
                cluster_b_name=cluster_name_map[cid_b],
                cluster_b_desc=cluster_entities[cid_b].description[:200],
                count=len(rels),
                relations_list=rels_text,
            )
            try:
                resp = deepseek_converse(prompt)
                parsed = _parse_json_obj(resp)
                rel_type = parsed.get("relation", "RELATED_TO")
            except Exception as exc:
                log.error("Relation summary failed for %d-%d: %s", cid_a, cid_b, exc)
                rel_type = "RELATED_TO"
        else:
            # Concatenate existing relation types
            rel_type = " / ".join(sorted({r.relation for r in rels}))

        cluster_relations.append(Relation(
            head=cluster_name_map[cid_a],
            relation=rel_type,
            tail=cluster_name_map[cid_b],
            weight=float(len(rels)),
            source_chunk_ids=[cid for r in rels for cid in r.source_chunk_ids],
        ))

    return cluster_entities, cluster_relations, membership
