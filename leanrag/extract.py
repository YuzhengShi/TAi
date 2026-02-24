"""Entity extraction, deduplication, GMM clustering, and hierarchical aggregation."""

from __future__ import annotations

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

def extract_from_chunks(
    chunks: list[Chunk],
    corpus_hash: str,
    force: bool = False,
) -> tuple[list[Entity], list[Relation]]:
    """Extract entities and relations from all chunks via DeepSeek.

    Saves progress every SAVE_EVERY_N_CHUNKS chunks for resumability.
    Returns deduplicated entities and relations.
    """
    cache_path = config.CACHE_DIR / f"entities_{corpus_hash}.json"

    # Try loading complete cache
    if not force and cache_path.exists():
        log.info("Loading cached entities from %s", cache_path)
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        if data.get("complete"):
            entities = [Entity.from_dict(e) for e in data["entities"]]
            relations = [Relation.from_dict(r) for r in data["relations"]]
            return entities, relations
        # Partial cache — resume from where we left off
        processed = set(data.get("processed_chunks", []))
        raw_tuples = data.get("raw_tuples", [])
        log.info("Resuming extraction: %d/%d chunks done", len(processed), len(chunks))
    else:
        processed: set[str] = set()
        raw_tuples: list[dict] = []

    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    new_since_save = 0

    for i, chunk in enumerate(chunks):
        if chunk.chunk_id in processed:
            continue

        log.info("Extracting chunk %d/%d: %s", i + 1, len(chunks), chunk.chunk_id)
        prompt = EXTRACTION_PROMPT.format(text=chunk.text)

        try:
            response = deepseek_converse(prompt)
        except Exception as exc:
            log.error("Extraction failed for %s: %s", chunk.chunk_id, exc)
            continue

        parsed = _parse_extraction(response)
        for item in parsed:
            item["source_chunk_id"] = chunk.chunk_id
            item["source_file"] = chunk.source_file
            raw_tuples.append(item)

        processed.add(chunk.chunk_id)
        new_since_save += 1

        if new_since_save >= config.SAVE_EVERY_N_CHUNKS:
            _save_partial(cache_path, raw_tuples, processed)
            new_since_save = 0

    # Save final complete cache
    entities, relations = _deduplicate(raw_tuples)
    _save_complete(cache_path, entities, relations, processed)

    return entities, relations


def _save_partial(path: Path, raw_tuples: list[dict], processed: set[str]) -> None:
    data = {
        "complete": False,
        "processed_chunks": sorted(processed),
        "raw_tuples": raw_tuples,
    }
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    log.info("Saved extraction checkpoint (%d chunks, %d tuples)", len(processed), len(raw_tuples))


def _save_complete(
    path: Path,
    entities: list[Entity],
    relations: list[Relation],
    processed: set[str],
) -> None:
    data = {
        "complete": True,
        "processed_chunks": sorted(processed),
        "entities": [e.to_dict() for e in entities],
        "relations": [r.to_dict() for r in relations],
    }
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    log.info("Saved complete extraction (%d entities, %d relations)", len(entities), len(relations))


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
    corpus_hash: str,
    force: bool = False,
) -> np.ndarray:
    """Embed all entity descriptions via Cohere. Returns (n_entities, dim) array."""
    cache_path = config.CACHE_DIR / f"embeddings_{corpus_hash}.npy"

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
