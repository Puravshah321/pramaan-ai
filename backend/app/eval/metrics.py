"""Metrics calculation: Exact Match, Token F1, and Recall@K."""
from __future__ import annotations

import re
import string
from collections import Counter
from typing import Any


def normalize_answer(s: str) -> str:
    """Lower text and remove punctuation, articles and extra whitespace."""
    def remove_articles(text: str) -> str:
        return re.sub(r"\b(a|an|the)\b", " ", text)

    def white_space_fix(text: str) -> str:
        return " ".join(text.split())

    def remove_punc(text: str) -> str:
        exclude = set(string.punctuation)
        return "".join(ch for ch in text if ch not in exclude)

    def lower(text: str) -> str:
        return text.lower()

    return white_space_fix(remove_articles(remove_punc(lower(s))))


def compute_exact_match(prediction: str, ground_truth: str) -> float:
    return float(normalize_answer(prediction) == normalize_answer(ground_truth))


def compute_f1(prediction: str, ground_truth: str) -> float:
    pred_tokens = normalize_answer(prediction).split()
    gold_tokens = normalize_answer(ground_truth).split()

    if not pred_tokens or not gold_tokens:
        return float(pred_tokens == gold_tokens)

    common = Counter(pred_tokens) & Counter(gold_tokens)
    num_same = sum(common.values())

    if num_same == 0:
        return 0.0

    precision = 1.0 * num_same / len(pred_tokens)
    recall = 1.0 * num_same / len(gold_tokens)
    return (2 * precision * recall) / (precision + recall)


def compute_recall_at_k(retrieved_chunks: list[dict[str, Any]], ground_truth: str) -> float:
    """Check if the normalized ground truth (or its significant words) appears in retrieved chunks."""
    gold_norm = normalize_answer(ground_truth)
    if not gold_norm:
        return 0.0

    combined_text = normalize_answer(" ".join([c.get("text", "") for c in retrieved_chunks]))
    if gold_norm in combined_text:
        return 1.0

    # Token overlap heuristic
    gold_tokens = set(gold_norm.split())
    if not gold_tokens:
        return 0.0
    found_tokens = [t for t in gold_tokens if t in combined_text]
    return float(len(found_tokens) / len(gold_tokens) >= 0.7)
