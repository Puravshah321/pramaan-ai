"""Document chunking with configurable size and overlap."""
from __future__ import annotations

from typing import Any


def chunk_text(
    text: str,
    chunk_size: int = 256,
    overlap: int = 32,
    doc_id: str = "",
) -> list[dict[str, Any]]:
    """Splits a document text into token/word chunks with overlap.
    Returns list of { id, doc_id, text, start_idx, end_idx }.
    """
    words = text.split()
    if not words:
        return []

    chunks = []
    step = max(1, chunk_size - overlap)
    chunk_idx = 0

    for i in range(0, len(words), step):
        chunk_words = words[i : i + chunk_size]
        chunk_str = " ".join(chunk_words)
        chunks.append({
            "id": f"{doc_id}_c{chunk_idx}",
            "doc_id": doc_id,
            "text": chunk_str,
            "start_word": i,
            "end_word": i + len(chunk_words),
        })
        chunk_idx += 1
        if i + chunk_size >= len(words):
            break

    return chunks
