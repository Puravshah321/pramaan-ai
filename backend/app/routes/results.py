"""Results and factor effects endpoints with repeats aggregation and paired differences."""
from __future__ import annotations

import statistics
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.eval.bootstrap import compute_bootstrap_ci
from app.models import Run, RunConfig

router = APIRouter(prefix="/api/results", tags=["results"])


@router.get("")
async def get_results(
    run_id: str | None = Query(default=None),
    include_invalid: bool = Query(default=False),
    group_repeats: bool = Query(default=True),
    session: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve measured configuration metrics for a specific run or all runs,
    with optional aggregation of identical runs (repeats).
    """
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

    raw_items: list[dict[str, Any]] = []
    for c in configs:
        m = c.metrics
        if not m:
            continue
        ds_id = getattr(c.run, "dataset_id", None) or "rajpurkar/squad_v2"
        raw_items.append({
            "config_id": c.id,
            "run_id": c.run_id,
            "run_name": c.run.name if c.run else "Run",
            "dataset_id": ds_id,
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
            "repeats": 1,
            "f1_std": None,
            "latency_p50_std": None,
        })

    if not group_repeats or run_id:
        return raw_items

    # Aggregate repeats by config_hash
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in raw_items:
        h = f"{item['dataset_id']}|{item['language_model']}|{item['embedding_model']}|{item['chunk_size']}|{item['top_k']}|{item['quantization']}"
        grouped.setdefault(h, []).append(item)

    aggregated: list[dict[str, Any]] = []
    for _h, items in grouped.items():
        base = dict(items[0])
        repeats = len(items)
        base["repeats"] = repeats

        if repeats > 1:
            f1_vals = [it["f1"] for it in items if it["f1"] is not None]
            em_vals = [it["em"] for it in items if it["em"] is not None]
            rec_vals = [it["recall_at_k"] for it in items if it["recall_at_k"] is not None]
            lat_vals = [it["latency_p50"] for it in items if it["latency_p50"] is not None]
            mem_vals = [it["memory_mb"] for it in items if it["memory_mb"] is not None]

            if f1_vals:
                base["f1"] = round(statistics.mean(f1_vals), 4)
                base["f1_std"] = round(statistics.stdev(f1_vals), 4) if len(f1_vals) > 1 else 0.0
            if em_vals:
                base["em"] = round(statistics.mean(em_vals), 4)
            if rec_vals:
                base["recall_at_k"] = round(statistics.mean(rec_vals), 4)
            if lat_vals:
                base["latency_p50"] = round(statistics.mean(lat_vals), 2)
                base["latency_p50_std"] = round(statistics.stdev(lat_vals), 2) if len(lat_vals) > 1 else 0.0
            if mem_vals:
                base["memory_mb"] = round(statistics.mean(mem_vals), 1)
            base["n"] = max(it["n"] for it in items if it["n"] is not None) if any(it["n"] is not None for it in items) else 0
            base["run_name"] = f"{base['run_name']} (+{repeats - 1} repeat{'s' if repeats > 2 else ''})"

        aggregated.append(base)

    return aggregated


@router.get("/effects")
async def get_factor_effects(
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Compute per-factor marginal effects on F1, latency, and memory across all measured runs,
    including paired differences, bootstrap 95% CIs, and plain-language takeaway sentences.
    """
    res = await session.execute(
        select(RunConfig)
        .options(selectinload(RunConfig.metrics), selectinload(RunConfig.run))
        .join(RunConfig.metrics)
        .join(RunConfig.run)
        .where(Run.is_valid.is_(True))
    )
    configs = res.scalars().all()

    if not configs:
        return {
            "factors": {},
            "paired_effects": {},
            "n_configurations": 0,
            "message": "No measured configurations exist yet. Run a benchmark first.",
        }

    # 1. Marginal averages per level
    factor_groups: dict[str, dict[Any, list[dict[str, float]]]] = {
        "chunk_size": {},
        "top_k": {},
        "quantization": {},
    }

    config_map: dict[str, dict[str, Any]] = {}

    for c in configs:
        m = c.metrics
        if not m:
            continue
        ds_id = getattr(c.run, "dataset_id", None) or "rajpurkar/squad_v2"
        c_info = {
            "id": c.id,
            "chunk_size": c.chunk_size,
            "top_k": c.top_k,
            "quantization": c.quantization,
            "language_model": c.language_model,
            "embedding_model": c.embedding_model,
            "dataset_id": ds_id,
            "f1": m.f1,
            "latency_p50": m.latency_p50,
            "memory_mb": m.memory_mb,
        }
        config_map[c.id] = c_info

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
        for level_val, rows in sorted(levels.items(), key=lambda x: str(x[0])):
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

    # 2. Paired differences holding other variables constant
    paired_effects: dict[str, Any] = {}

    # Chunk size: compare 512 vs 256
    cs_pairs: list[dict[str, float]] = []
    cfg_list = list(config_map.values())
    for a in cfg_list:
        if a["chunk_size"] == 256:
            for b in cfg_list:
                if (
                    b["chunk_size"] == 512
                    and b["top_k"] == a["top_k"]
                    and b["quantization"] == a["quantization"]
                    and b["language_model"] == a["language_model"]
                    and b["embedding_model"] == a["embedding_model"]
                ):
                    cs_pairs.append({
                        "delta_f1": b["f1"] - a["f1"],
                        "delta_latency_ms": b["latency_p50"] - a["latency_p50"],
                        "delta_memory_mb": b["memory_mb"] - a["memory_mb"],
                    })

    if cs_pairs:
        delta_f1s = [p["delta_f1"] for p in cs_pairs]
        mean_df1 = statistics.mean(delta_f1s)
        mean_dlat = statistics.mean(p["delta_latency_ms"] for p in cs_pairs)
        mean_dmem = statistics.mean(p["delta_memory_mb"] for p in cs_pairs)
        ci_low, ci_high = compute_bootstrap_ci(delta_f1s)
        ci_str = f" [95% CI {ci_low:+.3f}, {ci_high:+.3f}]" if ci_low is not None else ""
        paired_effects["chunk_size"] = {
            "comparison": "512 vs 256",
            "pairs_count": len(cs_pairs),
            "delta_f1": round(mean_df1, 4),
            "delta_latency_ms": round(mean_dlat, 1),
            "delta_memory_mb": round(mean_dmem, 1),
            "ci_lower_f1": ci_low,
            "ci_upper_f1": ci_high,
            "takeaway": f"Increasing chunk size from 256 to 512 changed F1 by {mean_df1:+.3f}{ci_str} with {mean_dlat:+.0f} ms latency.",
        }
    else:
        paired_effects["chunk_size"] = {
            "comparison": "512 vs 256",
            "pairs_count": 0,
            "takeaway": "No paired 256 vs 512 runs found with identical parameters. Run both to measure paired marginal effect.",
        }

    # Top-K: compare 3 vs 1
    k_pairs: list[dict[str, float]] = []
    for a in cfg_list:
        if a["top_k"] == 1:
            for b in cfg_list:
                if (
                    b["top_k"] == 3
                    and b["chunk_size"] == a["chunk_size"]
                    and b["quantization"] == a["quantization"]
                    and b["language_model"] == a["language_model"]
                    and b["embedding_model"] == a["embedding_model"]
                ):
                    k_pairs.append({
                        "delta_f1": b["f1"] - a["f1"],
                        "delta_latency_ms": b["latency_p50"] - a["latency_p50"],
                        "delta_memory_mb": b["memory_mb"] - a["memory_mb"],
                    })

    if k_pairs:
        delta_f1s = [p["delta_f1"] for p in k_pairs]
        mean_df1 = statistics.mean(delta_f1s)
        mean_dlat = statistics.mean(p["delta_latency_ms"] for p in k_pairs)
        ci_low, ci_high = compute_bootstrap_ci(delta_f1s)
        ci_str = f" [95% CI {ci_low:+.3f}, {ci_high:+.3f}]" if ci_low is not None else ""
        paired_effects["top_k"] = {
            "comparison": "k=3 vs k=1",
            "pairs_count": len(k_pairs),
            "delta_f1": round(mean_df1, 4),
            "delta_latency_ms": round(mean_dlat, 1),
            "ci_lower_f1": ci_low,
            "ci_upper_f1": ci_high,
            "takeaway": f"Increasing retrieval depth from Top-1 to Top-3 changed F1 by {mean_df1:+.3f}{ci_str} with {mean_dlat:+.0f} ms latency.",
        }
    else:
        paired_effects["top_k"] = {
            "comparison": "k=3 vs k=1",
            "pairs_count": 0,
            "takeaway": "No paired k=1 vs k=3 runs found with identical parameters.",
        }

    # Quantization: compare Q8_0 vs Q4_K_M
    q_pairs: list[dict[str, float]] = []
    for a in cfg_list:
        if a["quantization"].upper() in ["Q4_K_M", "Q4"]:
            for b in cfg_list:
                if (
                    b["quantization"].upper() in ["Q8_0", "Q8"]
                    and b["chunk_size"] == a["chunk_size"]
                    and b["top_k"] == a["top_k"]
                    and b["language_model"] == a["language_model"]
                    and b["embedding_model"] == a["embedding_model"]
                ):
                    q_pairs.append({
                        "delta_f1": b["f1"] - a["f1"],
                        "delta_latency_ms": b["latency_p50"] - a["latency_p50"],
                        "delta_memory_mb": b["memory_mb"] - a["memory_mb"],
                    })

    if q_pairs:
        delta_f1s = [p["delta_f1"] for p in q_pairs]
        mean_df1 = statistics.mean(delta_f1s)
        mean_dlat = statistics.mean(p["delta_latency_ms"] for p in q_pairs)
        mean_dmem = statistics.mean(p["delta_memory_mb"] for p in q_pairs)
        ci_low, ci_high = compute_bootstrap_ci(delta_f1s)
        ci_str = f" [95% CI {ci_low:+.3f}, {ci_high:+.3f}]" if ci_low is not None else ""
        paired_effects["quantization"] = {
            "comparison": "Q8_0 vs Q4_K_M",
            "pairs_count": len(q_pairs),
            "delta_f1": round(mean_df1, 4),
            "delta_latency_ms": round(mean_dlat, 1),
            "delta_memory_mb": round(mean_dmem, 1),
            "ci_lower_f1": ci_low,
            "ci_upper_f1": ci_high,
            "takeaway": f"Switching from Q4_K_M to Q8_0 changed F1 by {mean_df1:+.3f}{ci_str} with {mean_dmem:+.0f} MB memory overhead.",
        }
    else:
        paired_effects["quantization"] = {
            "comparison": "Q8_0 vs Q4_K_M",
            "pairs_count": 0,
            "takeaway": "No paired Q4 vs Q8 runs found with identical parameters.",
        }

    return {
        "factors": factor_effects,
        "paired_effects": paired_effects,
        "n_configurations": len(configs),
    }
