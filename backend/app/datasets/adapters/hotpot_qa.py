"""Adapter for HotpotQA dataset."""
from __future__ import annotations

from typing import Any

from app.datasets.adapters.base import DatasetAdapter, NormalizedQARow


class HotpotQAAdapter(DatasetAdapter):
    """Adapter for HotpotQA multi-hop question answering."""

    name = "hotpot_qa"
    description = "HotpotQA (hotpot_qa)"

    def can_adapt(
        self,
        features: dict[str, Any] | None,
        sample_row: dict[str, Any] | None = None,
    ) -> tuple[bool, str | None]:
        if not sample_row and not features:
            return False, "No schema features or sample row provided"

        if sample_row:
            has_q = "question" in sample_row
            has_ans = "answer" in sample_row
            has_hotpot = "supporting_facts" in sample_row or (
                "context" in sample_row and isinstance(sample_row.get("context"), dict)
            )
            if has_q and has_ans and has_hotpot:
                return True, None

        if features:
            f_keys = set(features.keys())
            if "question" in f_keys and "answer" in f_keys and "supporting_facts" in f_keys:
                return True, None

        return False, "Schema does not match HotpotQA structure"

    def normalize_row(self, row: dict[str, Any], row_idx: int = 0) -> NormalizedQARow | None:
        q_id = str(row.get("id") or f"hotpot_{row_idx}")
        question = str(row.get("question") or "").strip()
        ans = str(row.get("answer") or "").strip()

        if not question:
            return None

        # Build context from paragraphs/sentences
        context_parts: list[str] = []
        ctx_obj = row.get("context")
        if isinstance(ctx_obj, dict):
            titles = ctx_obj.get("title", [])
            sentences_nested = ctx_obj.get("sentences", [])
            for idx, s_list in enumerate(sentences_nested):
                title = titles[idx] if idx < len(titles) else ""
                body = " ".join([str(s).strip() for s in s_list if str(s).strip()])
                if title:
                    context_parts.append(f"{title}: {body}")
                else:
                    context_parts.append(body)
                if sum(len(p) for p in context_parts) > 2000:
                    break
        elif isinstance(ctx_obj, str):
            context_parts.append(ctx_obj)

        context_str = "\n\n".join(context_parts).strip()
        if len(context_str) > 2000:
            context_str = context_str[:2000] + "..."

        if not context_str:
            return None

        answers = [ans] if ans else []
        return NormalizedQARow(
            id=q_id,
            question=question,
            context=context_str,
            answers=answers,
            is_unanswerable=len(answers) == 0,
            metadata={"source": "HotpotQA"},
        )
