"""Recommendation endpoint."""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import ConfigMetrics, Run, RunConfig
from app.recommend import find_recommendation

router = APIRouter(prefix="/api/recommend", tags=["recommend"])


@router.get("")
async def get_recommendation(
    memory_gb: Optional[float] = Query(default=None),
    latency_s: Optional[float] = Query(default=None),
    goal: str = Query(default="best_quality"),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Recommends Pareto-optimal or budget-optimal configuration from measured runs."""
    res = await session.execute(
        select(RunConfig)
        .options(selectinload(RunConfig.metrics))
        .join(RunConfig.metrics)
        .join(RunConfig.run)
        .where(Run.is_valid.is_(True))
    )
    configs = res.scalars().all()

    config_dicts = []
    for c in configs:
        m = c.metrics
        if not m:
            continue
        config_dicts.append({
            "config_id": c.id,
            "run_id": c.run_id,
            "chunk_size": c.chunk_size,
            "top_k": c.top_k,
            "embedding_model": c.embedding_model,
            "language_model": c.language_model,
            "quantization": c.quantization,
            "f1": m.f1,
            "em": m.em,
            "recall_at_k": m.recall_at_k,
            "latency_p50": m.latency_p50,
            "memory_mb": m.memory_mb,
            "memory_source": m.memory_source,
            "tokens_per_second": m.tokens_per_second,
            "n": m.n,
        })

    return find_recommendation(
        configs_with_metrics=config_dicts,
        memory_limit_gb=memory_gb,
        latency_limit_s=latency_s,
        goal=goal,
    )
