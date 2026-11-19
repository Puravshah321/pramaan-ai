"""Adapter for TriviaQA dataset (mandarjoshi/trivia_qa)."""
from __future__ import annotations

from typing import Any

from app.datasets.adapters.base import DatasetAdapter, NormalizedQARow


class TriviaQAAdapter(DatasetAdapter):
    """Adapter for TriviaQA with search results, wiki context, and multi-alias answers."""

    name = "trivia_qa"
    description = "TriviaQA (mandarjoshi/trivia_qa)"

    def can_adapt(
        self,
        features: dict[str, Any] | None,
        sample_row: dict[str, Any] | None = None,
    ) -> tuple[bool, str | None]:
        if not sample_row and not features:
            return False, "No schema features or sample row provided"

        if sample_row:
            has_q = "question" in sample_row
            has_ans = "answer" in sample_row or "answers" in sample_row
            has_trivia_ctx = (
                "entity_pages" in sample_row
                or "search_results" in sample_row
                or "question_id" in sample_row
            )
            if has_q and has_ans and has_trivia_ctx:
                return True, None

        if features:
            f_keys = set(features.keys())
            if "question" in f_keys and ("entity_pages" in f_keys or "search_results" in f_keys):
                return True, None

        return False, "Schema does not match TriviaQA structure"

    def normalize_row(self, row: dict[str, Any], row_idx: int = 0) -> NormalizedQARow | None:
        q_id = str(row.get("question_id") or row.get("id") or f"trivia_qa_{row_idx}")
        question = str(row.get("question") or "").strip()
        if not question:
            return None

        # Extract answer aliases
        ans_obj = row.get("answer") or row.get("answers") or {}
        answer_texts: list[str] = []
        if isinstance(ans_obj, dict):
            val = ans_obj.get("value")
            if val and str(val).strip():
                answer_texts.append(str(val).strip())
            aliases = ans_obj.get("aliases", [])
            if isinstance(aliases, list):
                for a in aliases:
                    if a and str(a).strip():
                        answer_texts.append(str(a).strip())
            normalized = ans_obj.get("normalized_value")
            if normalized and str(normalized).strip():
                answer_texts.append(str(normalized).strip())
        elif isinstance(ans_obj, list):
            answer_texts = [str(x).strip() for x in ans_obj if str(x).strip()]
        elif isinstance(ans_obj, str) and ans_obj.strip():
            answer_texts = [ans_obj.strip()]

        answer_texts = list(dict.fromkeys(answer_texts))

        # Extract context passage from entity pages or search results
        context_passage = ""
        entity_pages = row.get("entity_pages") or {}
        if isinstance(entity_pages, dict):
            wiki_contexts = entity_pages.get("wiki_context", [])
            if isinstance(wiki_contexts, list) and wiki_contexts:
                # Find first non-empty wiki passage
                for wc in wiki_contexts:
                    if wc and str(wc).strip():
                        context_passage = str(wc).strip()
                        break

        if not context_passage:
            search_results = row.get("search_results") or {}
            if isinstance(search_results, dict):
                search_contexts = search_results.get("search_context", [])
                if isinstance(search_contexts, list) and search_contexts:
                    for sc in search_contexts:
                        if sc and str(sc).strip():
                            context_passage = str(sc).strip()
                            break

        if not context_passage:
            # Fallback to direct context if present
            context_passage = str(row.get("context") or row.get("passage") or "")

        # Clean and truncate context passage to a reasonable excerpt (max 2,000 chars)
        context_passage = context_passage.strip()
        if len(context_passage) > 2000:
            # Truncate at sentence boundary
            cut = context_passage[:2000]
            last_period = cut.rfind(".")
            context_passage = cut[: last_period + 1] if last_period > 1000 else cut + "..."

        if not context_passage:
            return None

        return NormalizedQARow(
            id=q_id,
            question=question,
            context=context_passage,
            answers=answer_texts,
            is_unanswerable=len(answer_texts) == 0,
            metadata={"source": "TriviaQA"},
        )
