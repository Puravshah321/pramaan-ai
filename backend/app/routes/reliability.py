"""Reliability checker endpoints."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Answer, DetectorModel, Question
from app.reliability.train import train_reliability_checker

router = APIRouter(prefix="/api/reliability", tags=["reliability"])


@router.post("/train")
async def train_checker(
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Train checker on stored answers with train/test split by question."""
    # Fetch all answers with their corresponding questions
    res = await session.execute(
        select(Answer, Question)
        .join(Question, Answer.question_id == Question.id)
        .where(Answer.answer != "")
    )
    rows = res.all()

    labeled_samples = []
    for ans, q in rows:
        labeled_samples.append({
            "question_id": q.id,
            "question": q.question,
            "answer": ans.answer,
            "gold_answer": q.gold_answer,
            "correct": ans.correct,
            "features": ans.features_json or {},
        })

    train_result = train_reliability_checker(labeled_samples)
    if train_result.get("error"):
        return train_result

    # Save to detector_models table
    dm = DetectorModel(
        id=str(uuid.uuid4())[:8],
        features_json=train_result.get("features", []),
        split_sizes_json={"train": int(len(labeled_samples) * 0.7), "test": int(len(labeled_samples) * 0.3)},
        auroc=train_result.get("auroc", 0.5),
        baseline_auroc=train_result.get("baseline_auroc", 0.5),
        rejection_20_caught=train_result.get("rejection_20_caught", 0.0),
        abstention_rate=train_result.get("abstention_rate", 0.0),
        weights_json=train_result.get("weights", {}),
        n=train_result.get("n", 0),
    )
    session.add(dm)
    await session.commit()

    return train_result


@router.get("/summary")
async def get_reliability_summary(
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve the latest trained checker metrics."""
    res = await session.execute(
        select(DetectorModel).order_by(desc(DetectorModel.trained_at)).limit(1)
    )
    dm = res.scalar_one_or_none()

    if not dm:
        # Check if we have answers to train on
        count_res = await session.execute(select(Answer))
        ans_count = len(count_res.scalars().all())

        return {
            "trained": False,
            "n_answers_available": ans_count,
            "message": "Checker has not been trained yet. Click 'Train checker on my runs' to train.",
            "small_sample": ans_count < 300,
        }

    return {
        "trained": True,
        "auroc": dm.auroc,
        "baseline_auroc": dm.baseline_auroc,
        "rejection_20_caught": dm.rejection_20_caught,
        "abstention_rate": dm.abstention_rate,
        "weights": dm.weights_json,
        "n": dm.n,
        "small_sample": dm.n < 300,
        "trained_at": dm.trained_at.isoformat() if dm.trained_at else None,
    }
