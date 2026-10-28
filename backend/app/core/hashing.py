"""Hashing utilities for Pramaan AI.

Content-addressed caching: every stored object has a deterministic hash
derived from its content, not its identity. This enables cache hits across
restarts and reproducibility verification.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def sha256_file(path: Path, chunk_size: int = 1 << 20) -> str:
    """SHA-256 of a file's bytes. Used to verify model files and corpora."""
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_str(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def config_hash(config: dict[str, Any]) -> str:
    """Deterministic SHA-256 of a config dict.

    Keys are sorted recursively so that key-insertion order does not affect
    the hash. This is the canonical config identity used for cache keys and
    result deduplication.
    """
    canonical = json.dumps(config, sort_keys=True, ensure_ascii=False, default=str)
    return sha256_str(canonical)[:16]  # 16 hex chars = 64-bit — short and unique enough


def dataset_hash(items: list[dict[str, Any]]) -> str:
    """Deterministic hash of a QA dataset (list of items with stable fields)."""
    canonical = json.dumps(
        [{"q": i.get("question", ""), "a": i.get("gold_answers", [])} for i in items],
        sort_keys=True,
        ensure_ascii=False,
    )
    return sha256_str(canonical)[:16]
