"""Results and factor effects endpoints."""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import ConfigMetrics, Run, RunConfig

router = APIRouter(prefix="/api/results", tags=["results"])


@router.get("")
async def get_results(
    run_id: Optional[str] = Query(default=None),
    include_invalid: bool = Query(default=False),
    session: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve measured configuration metrics for a specific run or all runs."""
    stmt = (
        select(RunConfig)
        .options(selectinload(RunConfig.metrics), selectinload(RunConfig.run))
        .join(RunConfig.metrics)
        .join(RunConfig.run)
    )
    if not include_invalid:
        stmt = stmt.where(Run.is_valid.is_(True))
    if run_id:
        stmt = stmt.where(RunConfig.run_id == run_id)

    res = await session.execute(stmt)
    configs = res.scalars().all()

    output = []
    for c in configs:
        m = c.metrics
        if not m:
            continue
        output.append({
            "config_id": c.id,
            "run_id": c.run_id,
            "run_name": c.run.name if c.run else "Run",
            "is_valid": c.run.is_valid if c.run else True,
            "invalid_reason": c.run.invalid_reason if c.run else None,
            "chunk_size": c.chunk_size,
            "top_k": c.top_k,
            "embedding_model": c.embedding_model,
            "language_model": c.language_model,
            "quantization": c.quantization,
            "recall_at_k": m.recall_at_k,
            "em": m.em,
            "f1": m.f1,
            "latency_p50": m.latency_p50,
            "latency_p95": m.latency_p95,
            "memory_mb": m.memory_mb,
            "memory_source": m.memory_source,
            "tokens_per_second": m.tokens_per_second,
            "n": m.n,
            "failed_calls": m.failed_calls,
            "ci_lower_f1": m.ci_lower_f1,
            "ci_upper_f1": m.ci_upper_f1,
            "status": "completed",
        })
    return output


@router.get("/effects")
async def get_factor_effects(
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Compute per-factor marginal effects on F1, latency, and memory across all measured runs."""
    res = await session.execute(
        select(RunConfig)
        .options(selectinload(RunConfig.metrics))
        .join(RunConfig.metrics)
        .join(RunConfig.run)
        .where(Run.is_valid.is_(True))
    )
    configs = res.scalars().all()

    if not configs:
        return {
            "factors": {},
            "n_configurations": 0,
            "message": "No measured configurations exist yet. Run a benchmark first.",
        }

    # Group by factors: chunk_size, top_k, quantization
    factor_groups: dict[str, dict[Any, list[dict[str, float]]]] = {
        "chunk_size": {},
        "top_k": {},
        "quantization": {},
    }

    for c in configs:
        m = c.metrics
        if not m:
            continue
        row = {
            "f1": m.f1,
            "latency_p50": m.latency_p50,
            "memory_mb": m.memory_mb,
        }
        factor_groups["chunk_size"].setdefault(c.chunk_size, []).append(row)
        factor_groups["top_k"].setdefault(c.top_k, []).append(row)
        if c.quantization and c.quantization != "none":
            factor_groups["quantization"].setdefault(c.quantization, []).append(row)

    # Compute averages per level
    factor_effects: dict[str, list[dict[str, Any]]] = {}
    for factor_name, levels in factor_groups.items():
        factor_effects[factor_name] = []
        for level_val, rows in levels.items():
            avg_f1 = sum(r["f1"] for r in rows) / len(rows)
            avg_lat = sum(r["latency_p50"] for r in rows) / len(rows)
            avg_mem = sum(r["memory_mb"] for r in rows) / len(rows)
            factor_effects[factor_name].append({
                "level": str(level_val),
                "avg_f1": round(avg_f1, 3),
                "avg_latency_ms": round(avg_lat, 1),
                "avg_memory_mb": round(avg_mem, 1),
                "sample_count": len(rows),
            })

    return {
        "factors": factor_effects,
        "n_configurations": len(configs),
    }
