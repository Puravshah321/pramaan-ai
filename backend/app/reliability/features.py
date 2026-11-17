"""Extract reliability features from an answer and retrieved chunks."""
from __future__ import annotations

import re
import string
from typing import Any


def extract_features(
    answer: str,
    chunks: list[dict[str, Any]],
) -> dict[str, float]:
    """Computes:
    - top_sim: cosine similarity of the top chunk
    - gap: difference between top chunk and 2nd chunk score
    - lexical_support: fraction of answer words present in retrieved chunks
    - idk_flag: 1.0 if answer contains "I don't know", "cannot be found", etc.
    """
    # 1. Similarity and Gap
    top_sim = 0.0
    gap = 0.0
    if chunks:
        top_sim = float(chunks[0].get("score", 0.0))
        if len(chunks) > 1:
            second_sim = float(chunks[1].get("score", 0.0))
            gap = max(0.0, top_sim - second_sim)

    # 2. Lexical Support
    ans_clean = answer.lower().translate(str.maketrans("", "", string.punctuation))
    ans_words = [w for w in ans_clean.split() if len(w) > 2]

    context_str = " ".join([c.get("text", "") for c in chunks]).lower()
    context_clean = context_str.translate(str.maketrans("", "", string.punctuation))
    context_words = set(context_clean.split())

    if ans_words:
        matches = sum(1 for w in ans_words if w in context_words)
        lexical_support = float(matches / len(ans_words))
    else:
        lexical_support = 0.0

    # 3. IDK Flag
    ans_lower = answer.lower()
    idk_flag = 0.0
    if any(phrase in ans_lower for phrase in ["i don't know", "cannot be determined", "not mentioned", "not provided", "no information"]):
        idk_flag = 1.0

    return {
        "top_sim": round(top_sim, 4),
        "gap": round(gap, 4),
        "lexical_support": round(lexical_support, 4),
        "idk_flag": idk_flag,
    }
