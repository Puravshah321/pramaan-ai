"""Live workspace statistics endpoint."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Answer, ConfigMetrics, Document, Run

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
async def get_workspace_stats(session: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Returns live workspace run counts, configs measured, documents indexed, questions answered, and API calls made."""
    # Runs count
    runs_count_res = await session.execute(select(func.count(Run.id)))
    runs_count = runs_count_res.scalar_one() or 0

    # Measured configs count / setups measured
    configs_count_res = await session.execute(select(func.count(ConfigMetrics.id)))
    configs_count = configs_count_res.scalar_one() or 0

    # Documents indexed
    docs_count_res = await session.execute(select(func.count(Document.id)))
    docs_count = docs_count_res.scalar_one() or 0

    # Questions answered
    ans_count_res = await session.execute(
        select(func.count(Answer.id)).where(Answer.answer != "").where(Answer.answer.isnot(None))
    )
    ans_count = ans_count_res.scalar_one() or 0

    # Total API calls made
    calls_res = await session.execute(
        select(func.coalesce(func.sum(ConfigMetrics.n + ConfigMetrics.failed_calls), 0))
    )
    calls_count = int(calls_res.scalar_one() or 0)
    if calls_count == 0 and ans_count > 0:
        calls_count = ans_count

    # Last run
    last_run_res = await session.execute(
        select(Run).order_by(desc(Run.created_at)).limit(1)
    )
    last_run = last_run_res.scalar_one_or_none()

    total_activity = docs_count + ans_count + configs_count + calls_count

    return {
        "runs_count": runs_count,
        "configs_measured": configs_count,
        "setups_measured": configs_count,
        "documents_indexed": docs_count,
        "questions_answered": ans_count,
        "api_calls_made": calls_count,
        "last_run": {
            "id": last_run.id,
            "name": last_run.name,
            "status": last_run.status,
            "created_at": last_run.created_at.isoformat() if last_run.created_at else None,
        } if last_run else None,
        "empty": (total_activity == 0),
    }
