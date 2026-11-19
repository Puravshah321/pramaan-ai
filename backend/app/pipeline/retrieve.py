"""Retrieval stage: embeds query and retrieves top-K chunks from vector index."""
from __future__ import annotations

import time
from typing import Any

from app.pipeline.embed import embed_texts
from app.pipeline.index import VectorIndex


async def retrieve_chunks(
    index: VectorIndex,
    query: str,
    top_k: int = 3,
) -> dict[str, Any]:
    """Retrieves top-K chunks for a query from index.
    Returns: { "chunks": [...], "query_vector": [...], "embed_time_ms": float, "search_time_ms": float, "error": str | None }
    """
    t0 = time.perf_counter()
    embed_res = await embed_texts(model_id=index.embedding_model, texts=[query])
    t1 = time.perf_counter()
    embed_ms = (t1 - t0) * 1000

    if not embed_res.get("embeddings"):
        return {
            "chunks": [],
            "query_vector": [],
            "embed_time_ms": round(embed_ms, 2),
            "search_time_ms": 0.0,
            "error": embed_res.get("error") or "Failed to embed query",
        }

    q_vec = embed_res["embeddings"][0]

    t2 = time.perf_counter()
    chunks = index.search(query_vector=q_vec, top_k=top_k)
    t3 = time.perf_counter()
    search_ms = (t3 - t2) * 1000

    return {
        "chunks": chunks,
        "query_vector": q_vec,
        "embed_time_ms": round(embed_ms, 2),
        "search_time_ms": round(search_ms, 2),
        "error": None,
    }
