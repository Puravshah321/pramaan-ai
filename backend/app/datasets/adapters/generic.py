"""Generic text QA adapter with auto-detection of question, context, and answer columns."""
from __future__ import annotations

from typing import Any

from app.datasets.adapters.base import DatasetAdapter, NormalizedQARow

# Common column name heuristics in NLP QA benchmarks
CONTEXT_CANDIDATES = [
    "context", "passage", "document", "article", "text", "body", "paragraphs", "corpus"
]
QUESTION_CANDIDATES = [
    "question", "query", "prompt", "instruction", "input"
]
ANSWER_CANDIDATES = [
    "answers", "answer", "target", "gold_answer", "output", "reference"
]

FORBIDDEN_MULTIMODAL_COLUMNS = [
    "image", "images", "audio", "video", "chart_image", "visual", "waveform"
]


class GenericQAAdapter(DatasetAdapter):
    """Generic mapper that detects or accepts explicit text QA column choices."""

    name = "generic_qa"
    description = "Generic text QA mapper with auto-column detection"

    def can_adapt(
        self,
        features: dict[str, Any] | None,
        sample_row: dict[str, Any] | None = None,
    ) -> tuple[bool, str | None]:
        keys: set[str] = set()
        if sample_row:
            keys = set(sample_row.keys())
        elif features:
            keys = set(features.keys())
        else:
            return False, "No schema features or sample row provided"

        # Check for multimodal indicators
        for bad_col in FORBIDDEN_MULTIMODAL_COLUMNS:
            if bad_col in keys:
                return False, f"Image/audio multimodal column '{bad_col}' detected (not text QA)"

        # Check context column
        has_context = any(c in keys for c in CONTEXT_CANDIDATES)
        if not has_context:
            return False, "No passage or text context column found in dataset schema"

        # Check question column
        has_question = any(q in keys for q in QUESTION_CANDIDATES)
        if not has_question:
            return False, "No question or query column found in dataset schema"

        # Check that context value in sample row is text
        if sample_row:
            ctx_key = next((c for c in CONTEXT_CANDIDATES if c in sample_row), None)
            if ctx_key:
                val = sample_row[ctx_key]
                if not isinstance(val, (str, list)):
                    return False, f"Context column '{ctx_key}' contains non-text data ({type(val).__name__})"

        return True, None

    def normalize_row(
        self,
        row: dict[str, Any],
        row_idx: int = 0,
        custom_mapping: dict[str, str] | None = None,
    ) -> NormalizedQARow | None:
        mapping = custom_mapping or {}

        # Resolve context
        ctx_col = mapping.get("context_col") or next((c for c in CONTEXT_CANDIDATES if c in row), None)
        ctx_val = row.get(ctx_col) if ctx_col else None
        if isinstance(ctx_val, list):
            context = " ".join([str(x) for x in ctx_val]).strip()
        else:
            context = str(ctx_val or "").strip()

        # Resolve question
        q_col = mapping.get("question_col") or next((q for q in QUESTION_CANDIDATES if q in row), None)
        question = str(row.get(q_col) or "").strip() if q_col else ""

        if not question or not context:
            return None

        # Resolve answers
        ans_col = mapping.get("answer_col") or next((a for a in ANSWER_CANDIDATES if a in row), None)
        ans_val = row.get(ans_col) if ans_col else None

        answers: list[str] = []
        if isinstance(ans_val, dict):
            raw = ans_val.get("text") or ans_val.get("answer") or []
            if isinstance(raw, list):
                answers = [str(x).strip() for x in raw if str(x).strip()]
            elif isinstance(raw, str) and raw.strip():
                answers = [raw.strip()]
        elif isinstance(ans_val, list):
            answers = [str(x).strip() for x in ans_val if str(x).strip()]
        elif isinstance(ans_val, str) and ans_val.strip():
            answers = [ans_val.strip()]

        q_id = str(row.get("id") or f"qa_{row_idx}")

        return NormalizedQARow(
            id=q_id,
            question=question,
            context=context,
            answers=answers,
            is_unanswerable=len(answers) == 0,
            metadata={"source_columns": {"context": ctx_col, "question": q_col, "answers": ans_col}},
        )
