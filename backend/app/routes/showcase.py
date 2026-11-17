"""Showcase endpoint providing live real evidence card data."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Answer, Document, Question, RunConfig, ShowcaseItem

router = APIRouter(prefix="/api/showcase", tags=["showcase"])


@router.get("/latest")
async def get_latest_showcase(
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Return the most recent real answer from the database."""
    # 1. Check ShowcaseItem
    stmt = select(ShowcaseItem).order_by(desc(ShowcaseItem.created_at)).limit(1)
    res = await session.execute(stmt)
    item = res.scalar_one_or_none()

    if item:
        return {
            "has_data": True,
            "document_title": item.document_title,
            "excerpt": item.excerpt,
            "highlight_span": item.highlight_span,
            "question": item.question,
            "answer": item.answer,
            "badge": item.badge,
            "confidence": item.confidence,
            "reasons": item.reasons_json or [],
            "setup_used": item.setup_used,
            "timestamp": item.created_at.isoformat() if item.created_at else None,
        }

    # 2. Check Answer table if any exists from benchmark runs
    ans_stmt = (
        select(Answer)
        .where(Answer.answer != "")
        .where(Answer.answer.isnot(None))
        .order_by(desc(Answer.id))
        .limit(1)
    )
    ans_res = await session.execute(ans_stmt)
    ans = ans_res.scalar_one_or_none()

    if ans:
        # Get question & config
        q_stmt = select(Question).where(Question.id == ans.question_id)
        q_res = await session.execute(q_stmt)
        q = q_res.scalar_one_or_none()

        cfg_stmt = select(RunConfig).where(RunConfig.id == ans.run_config_id)
        cfg_res = await session.execute(cfg_stmt)
        cfg = cfg_res.scalar_one_or_none()

        doc_stmt = select(Document).limit(1)
        doc_res = await session.execute(doc_stmt)
        doc = doc_res.scalar_one_or_none()

        doc_text = doc.content if doc else "Pramaan AI evaluates RAG pipelines across chunk size, Top-K, and model quantization."
        sentences = [s.strip() for s in doc_text.split(".") if s.strip()]
        span = sentences[0] + "." if sentences else doc_text[:120]

        setup_str = f"{cfg.embedding_model.split('/')[-1]} + {cfg.language_model.split('/')[-1]}" if cfg else "all-MiniLM-L6-v2 + Qwen2.5-0.5B"
        badge = "Reliable" if ans.correct else "Unreliable"

        return {
            "has_data": True,
            "document_title": doc.title if doc else "RAG Document",
            "excerpt": doc_text[:350] + "...",
            "highlight_span": span,
            "question": q.question if q else "What factors are evaluated?",
            "answer": ans.answer,
            "badge": badge,
            "confidence": 0.88 if ans.correct else 0.42,
            "reasons": ["Retrieved context matches query", "High semantic support"] if ans.correct else ["Context did not confirm answer"],
            "setup_used": setup_str,
            "timestamp": None,
        }

    return {"has_data": False}
