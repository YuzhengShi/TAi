"""AWS Bedrock API wrappers for DeepSeek (Converse) and Cohere Embed (InvokeModel).

Includes token-bucket rate limiting and exponential backoff retries.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import boto3
import numpy as np
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError, ReadTimeoutError

from . import config

log = logging.getLogger(__name__)

_client: Any = None

_BOTO_CONFIG = BotoConfig(
    read_timeout=120,       # seconds — prevent indefinite hangs
    connect_timeout=10,
    retries={"max_attempts": 0},  # we handle retries ourselves
)


def _get_client() -> Any:
    global _client
    if _client is None:
        _client = boto3.client(
            "bedrock-runtime",
            region_name=config.AWS_REGION,
            config=_BOTO_CONFIG,
        )
    return _client


# ── Rate limiter ───────────────────────────────────────────────────────

class _RateLimiter:
    """Simple token-bucket rate limiter (1 token = 1 request)."""

    def __init__(self, rpm: int) -> None:
        self._interval = 60.0 / rpm
        self._last = 0.0

    def wait(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last
        if elapsed < self._interval:
            time.sleep(self._interval - elapsed)
        self._last = time.monotonic()


_deepseek_limiter = _RateLimiter(config.DEEPSEEK_RPM)
_cohere_limiter = _RateLimiter(config.COHERE_RPM)


# ── Retry helper ───────────────────────────────────────────────────────

def _retry(fn, max_retries: int = 5):
    """Call *fn* with exponential backoff on throttling/server errors."""
    for attempt in range(max_retries):
        try:
            return fn()
        except ReadTimeoutError:
            wait = 2 ** attempt
            log.warning("Bedrock read timeout (attempt %d/%d), retrying in %ds",
                        attempt + 1, max_retries, wait)
            time.sleep(wait)
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("ThrottlingException", "TooManyRequestsException",
                        "ServiceUnavailableException", "ModelTimeoutException"):
                wait = 2 ** attempt
                log.warning("Bedrock %s (attempt %d/%d), retrying in %ds",
                            code, attempt + 1, max_retries, wait)
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Bedrock call failed after {max_retries} retries")


# ── DeepSeek (Converse API) ───────────────────────────────────────────

def deepseek_converse(prompt: str) -> str:
    """Send a single-turn prompt to DeepSeek via Bedrock Converse API.

    Returns the assistant's text response.
    """
    _deepseek_limiter.wait()

    def _call():
        resp = _get_client().converse(
            modelId=config.DEEPSEEK_MODEL_ID,
            messages=[{
                "role": "user",
                "content": [{"text": prompt}],
            }],
            inferenceConfig={
                "maxTokens": config.DEEPSEEK_MAX_TOKENS,
                "temperature": config.DEEPSEEK_TEMPERATURE,
            },
        )
        return resp["output"]["message"]["content"][0]["text"]

    return _retry(_call)


# ── Cohere Embed v4 (InvokeModel API) ─────────────────────────────────

_COHERE_MAX_CHARS = 2048  # Cohere Embed v4 per-text character limit


def cohere_embed(texts: list[str]) -> np.ndarray:
    """Embed a batch of texts via Cohere Embed on Bedrock.

    *texts* must have len <= EMBED_BATCH_SIZE.
    Returns ndarray of shape (len(texts), embed_dim).
    """
    if len(texts) > config.EMBED_BATCH_SIZE:
        raise ValueError(f"Batch too large: {len(texts)} > {config.EMBED_BATCH_SIZE}")

    # Truncate texts exceeding Cohere's per-text character limit
    truncated = [t[:_COHERE_MAX_CHARS] if len(t) > _COHERE_MAX_CHARS else t for t in texts]

    _cohere_limiter.wait()

    def _call():
        body = json.dumps({
            "texts": truncated,
            "input_type": "search_document",
            "embedding_types": ["float"],
        })
        resp = _get_client().invoke_model(
            modelId=config.COHERE_EMBED_MODEL_ID,
            body=body,
        )
        result = json.loads(resp["body"].read())
        return np.array(result["embeddings"]["float"], dtype=np.float32)

    return _retry(_call)


def embed_all(texts: list[str]) -> np.ndarray:
    """Embed an arbitrary number of texts, batching automatically.

    Returns ndarray of shape (len(texts), embed_dim).
    """
    if not texts:
        return np.empty((0, 0), dtype=np.float32)

    batches: list[np.ndarray] = []
    for i in range(0, len(texts), config.EMBED_BATCH_SIZE):
        batch = texts[i : i + config.EMBED_BATCH_SIZE]
        log.info("Embedding batch %d/%d (%d texts)",
                 i // config.EMBED_BATCH_SIZE + 1,
                 -(-len(texts) // config.EMBED_BATCH_SIZE),
                 len(batch))
        batches.append(cohere_embed(batch))

    return np.vstack(batches)
