"""Adapter for SQuAD v2 style datasets featuring unanswerable (impossible) questions."""
from __future__ import annotations

from typing import Any

from app.datasets.adapters.base import DatasetAdapter, NormalizedQARow


class SquadV2Adapter(DatasetAdapter):
    """Adapter for SQuAD v2 datasets with plausible distractors and unanswerable questions."""

    name = "squad_v2"
    description = "SQuAD v2 style (with unanswerable questions)"

    def can_adapt(
        self,
        features: dict[str, Any] | None,
        sample_row: dict[str, Any] | None = None,
    ) -> tuple[bool, str | None]:
        if not sample_row and not features:
            return False, "No schema features or sample row provided"

        if sample_row:
            has_q = "question" in sample_row or "query" in sample_row
            has_ctx = "context" in sample_row or "passage" in sample_row
            has_ans = "answers" in sample_row

            if not has_ctx:
                return False, "Missing 'context' or 'passage' column"
            if not has_q:
                return False, "Missing 'question' column"
            if not has_ans:
                return False, "Missing 'answers' column"

            ctx_val = sample_row.get("context") or sample_row.get("passage")
            if not isinstance(ctx_val, str):
                return False, "Context column is not text/string"

            # Check if answers has empty text or has is_impossible flag
            ans_val = sample_row.get("answers")
            if isinstance(ans_val, dict) and "text" in ans_val:
                return True, None

        if features:
            f_keys = set(features.keys())
            if "context" in f_keys and "question" in f_keys and "answers" in f_keys:
                return True, None

        return False, "Schema does not match SQuAD v2 structure"

    def normalize_row(self, row: dict[str, Any], row_idx: int = 0) -> NormalizedQARow | None:
        q_id = str(row.get("id") or f"squad_v2_{row_idx}")
        question = str(row.get("question") or row.get("query") or "").strip()
        context = str(row.get("context") or row.get("passage") or "").strip()

        if not question or not context:
            return None

        answers_obj = row.get("answers")
        answer_texts: list[str] = []
        if isinstance(answers_obj, dict):
            raw_texts = answers_obj.get("text", [])
            if isinstance(raw_texts, list):
                answer_texts = [str(t).strip() for t in raw_texts if str(t).strip()]
        elif isinstance(answers_obj, list):
            answer_texts = [str(t).strip() for t in answers_obj if str(t).strip()]
        elif isinstance(answers_obj, str) and answers_obj.strip():
            answer_texts = [answers_obj.strip()]

        # Deduplicate identical answers (resolves E2)
        answer_texts = list(dict.fromkeys(answer_texts))

        # SQuAD v2 explicit or implicit unanswerable flag
        is_impossible = (
            bool(row.get("is_impossible", False))
            or len(answer_texts) == 0
        )

        return NormalizedQARow(
            id=q_id,
            question=question,
            context=context,
            answers=answer_texts,
            is_unanswerable=is_impossible,
            metadata={
                "title": row.get("title", ""),
                "is_impossible": is_impossible,
            },
        )
