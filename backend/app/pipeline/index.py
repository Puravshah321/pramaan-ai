"""In-memory and file-persisted vector index."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
import numpy as np


class VectorIndex:
    def __init__(self, corpus_id: str, embedding_model: str, chunk_size: int) -> None:
        self.corpus_id = corpus_id
        self.embedding_model = embedding_model
        self.chunk_size = chunk_size
        self.chunks: list[dict[str, Any]] = []
        self.embeddings: np.ndarray = np.empty((0, 0), dtype=np.float32)

    def add(self, chunks: list[dict[str, Any]], embeddings: list[list[float]]) -> None:
        self.chunks.extend(chunks)
        emb_arr = np.array(embeddings, dtype=np.float32)
        # Normalize vectors for cosine similarity
        norms = np.linalg.norm(emb_arr, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        emb_norm = emb_arr / norms

        if self.embeddings.size == 0:
            self.embeddings = emb_norm
        else:
            self.embeddings = np.vstack([self.embeddings, emb_norm])

    def search(self, query_vector: list[float], top_k: int = 3) -> list[dict[str, Any]]:
        if self.embeddings.size == 0 or not self.chunks:
            return []

        q = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q)
        if q_norm > 0:
            q = q / q_norm

        scores = np.dot(self.embeddings, q)
        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            chunk = dict(self.chunks[idx])
            chunk["score"] = float(round(float(scores[idx]), 4))
            results.append(chunk)

        return results

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "corpus_id": self.corpus_id,
            "embedding_model": self.embedding_model,
            "chunk_size": self.chunk_size,
            "chunks": self.chunks,
            "embeddings": self.embeddings.tolist(),
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)

    @classmethod
    def load(cls, path: Path) -> "VectorIndex":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        idx = cls(
            corpus_id=data["corpus_id"],
            embedding_model=data["embedding_model"],
            chunk_size=data["chunk_size"],
        )
        idx.chunks = data["chunks"]
        idx.embeddings = np.array(data["embeddings"], dtype=np.float32)
        return idx
