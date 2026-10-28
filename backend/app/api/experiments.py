"""Experiments router — create, plan, start/pause/resume/cancel, and stream events."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.core.hashing import config_hash
from app.core.logging import get_logger
from app.db.models import Experiment, ExperimentConfig
from app.db.session import DbSession

logger = get_logger(__name__)
router = APIRouter(prefix="/api/experiments", tags=["experiments"])


class ExperimentCreate(BaseModel):
    name: str
    goal: str = ""
    preset: str | None = None
    design_strategy: str = "ofat"
    factors_json: dict = {}
    hardware_profile: str = "CPU-8GB"
    qa_set_ids: list[str] = []
    corpus_id: str | None = None
    seed: int = 42
    n_questions: int = 300
    reliability_options: dict = {}


class ExperimentOut(BaseModel):
    id: str
    name: str
    status: str
    design_strategy: str
    hardware_profile: str
    n_questions: int
    demo: bool


@router.post("", status_code=201)
async def create_experiment(body: ExperimentCreate, db: DbSession) -> ExperimentOut:
    exp = Experiment(
        name=body.name,
        goal=body.goal,
        preset=body.preset,
        design_strategy=body.design_strategy,
        factors_json=body.factors_json,
        hardware_profile=body.hardware_profile,
        qa_set_ids=body.qa_set_ids,
        corpus_id=body.corpus_id,
        seed=body.seed,
        n_questions=body.n_questions,
        reliability_options=body.reliability_options,
        status="draft",
    )
    db.add(exp)
    await db.commit()
    await db.refresh(exp)
    logger.info("experiment.created", exp_id=exp.id, name=exp.name)
    return ExperimentOut(
        id=exp.id, name=exp.name, status=exp.status,
        design_strategy=exp.design_strategy, hardware_profile=exp.hardware_profile,
        n_questions=exp.n_questions, demo=exp.demo,
    )


@router.get("")
async def list_experiments(db: DbSession) -> list[ExperimentOut]:
    result = await db.execute(select(Experiment))
    return [
        ExperimentOut(
            id=e.id, name=e.name, status=e.status,
            design_strategy=e.design_strategy, hardware_profile=e.hardware_profile,
            n_questions=e.n_questions, demo=e.demo,
        )
        for e in result.scalars().all()
    ]


@router.get("/{exp_id}")
async def get_experiment(exp_id: str, db: DbSession) -> dict:
    exp = await db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return {
        "id": exp.id,
        "name": exp.name,
        "status": exp.status,
        "design_strategy": exp.design_strategy,
        "factors_json": exp.factors_json,
        "hardware_profile": exp.hardware_profile,
        "n_questions": exp.n_questions,
        "seed": exp.seed,
        "plan_json": exp.plan_json,
        "demo": exp.demo,
    }


@router.post("/{exp_id}/plan")
async def plan_experiment(exp_id: str, db: DbSession) -> dict:
    """Dry-run: enumerate configs, check feasibility, estimate cost.

    Phase 1: returns a stub. Full grid builder implemented in Phase 7.
    """
    exp = await db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Stub plan
    plan = {
        "experiment_id": exp_id,
        "n_configs": 0,
        "n_generations": 0,
        "infeasible": [],
        "cache_reuse_pct": 0,
        "estimated_time_minutes": 0,
        "estimated_peak_memory_gb": 0,
        "note": "Full planning available in Phase 7 (Benchmark Engine).",
    }
    exp.plan_json = plan
    exp.status = "planned"
    await db.commit()
    return plan


@router.post("/{exp_id}/start")
async def start_experiment(exp_id: str, db: DbSession) -> dict:
    exp = await db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    exp.status = "running"
    await db.commit()
    logger.info("experiment.start_requested", exp_id=exp_id)
    return {"status": "running", "message": "Benchmark engine queued (Phase 7)."}


@router.post("/{exp_id}/pause")
async def pause_experiment(exp_id: str, db: DbSession) -> dict:
    exp = await db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    exp.status = "paused"
    await db.commit()
    return {"status": "paused"}


@router.post("/{exp_id}/resume")
async def resume_experiment(exp_id: str, db: DbSession) -> dict:
    exp = await db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    exp.status = "running"
    await db.commit()
    return {"status": "running"}


@router.post("/{exp_id}/cancel")
async def cancel_experiment(exp_id: str, db: DbSession) -> dict:
    exp = await db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    exp.status = "failed"
    await db.commit()
    return {"status": "cancelled"}
