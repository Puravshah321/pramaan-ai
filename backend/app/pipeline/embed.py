"""Embedding computation for queries and passages."""
from __future__ import annotations

from typing import Any

from app.hf.inference import compute_embeddings


async def embed_texts(
    model_id: str,
    texts: list[str],
) -> dict[str, Any]:
    """Computes embeddings for a batch of strings."""
    return await compute_embeddings(model_id=model_id, texts=texts)
