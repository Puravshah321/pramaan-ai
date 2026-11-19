"""Adapter for MS MARCO dataset."""
from __future__ import annotations

from typing import Any

from app.datasets.adapters.base import DatasetAdapter, NormalizedQARow


class MsMarcoAdapter(DatasetAdapter):
    """Adapter for MS MARCO QnA dataset."""

    name = "ms_marco"
    description = "MS MARCO (ms_marco)"

    def can_adapt(
        self,
        features: dict[str, Any] | None,
        sample_row: dict[str, Any] | None = None,
    ) -> tuple[bool, str | None]:
        if not sample_row and not features:
            return False, "No schema features or sample row provided"

        if sample_row:
            has_q = "query" in sample_row or "question" in sample_row
            has_passages = "passages" in sample_row
            if has_q and has_passages:
                return True, None

        if features:
            f_keys = set(features.keys())
            if ("query" in f_keys or "question" in f_keys) and "passages" in f_keys:
                return True, None

        return False, "Schema does not match MS MARCO structure"

    def normalize_row(self, row: dict[str, Any], row_idx: int = 0) -> NormalizedQARow | None:
        q_id = str(row.get("query_id") or row.get("id") or f"ms_marco_{row_idx}")
        question = str(row.get("query") or row.get("question") or "").strip()
        if not question:
            return None

        # Extract passages
        passages_obj = row.get("passages") or {}
        context_str = ""
        if isinstance(passages_obj, dict):
            p_texts = passages_obj.get("passage_text", [])
            is_selected = passages_obj.get("is_selected", [])
            # Prefer selected passage if available
            chosen = []
            for idx, pt in enumerate(p_texts):
                sel = is_selected[idx] if idx < len(is_selected) else 0
                if sel == 1 and pt and str(pt).strip():
                    chosen.append(str(pt).strip())
            if not chosen and p_texts:
                chosen = [str(p_texts[0]).strip()]
            context_str = "\n\n".join(chosen).strip()
        elif isinstance(passages_obj, list):
            context_str = " ".join([str(p).strip() for p in passages_obj if str(p).strip()])
        elif isinstance(passages_obj, str):
            context_str = passages_obj.strip()

        if len(context_str) > 2000:
            context_str = context_str[:2000] + "..."

        if not context_str:
            return None

        # Extract answers
        ans_raw = row.get("answers") or []
        answers = []
        if isinstance(ans_raw, list):
            answers = [str(a).strip() for a in ans_raw if str(a).strip() and str(a).strip() != "No Answer Present."]
        elif isinstance(ans_raw, str) and ans_raw.strip():
            answers = [ans_raw.strip()]

        return NormalizedQARow(
            id=q_id,
            question=question,
            context=context_str,
            answers=answers,
            is_unanswerable=len(answers) == 0,
            metadata={"source": "MS MARCO"},
        )
