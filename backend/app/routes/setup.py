"""Active setup endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import AppSettings

router = APIRouter(prefix="/api/setup", tags=["setup"])


class UpdateSetupRequest(BaseModel):
    embedding_model: str | None = None
    language_model: str | None = None
    dataset_id: str | None = None
    ui_preferences: dict[str, Any] | None = None


@router.get("")
async def get_setup(session: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Read the current active setup."""
    result = await session.execute(select(AppSettings).where(AppSettings.key == "default"))
    cfg = result.scalar_one_or_none()

    if not cfg:
        # Default to verified locally available edge models
        cfg = AppSettings(
            key="default",
            embedding_model="BAAI/bge-small-en-v1.5",
            language_model="Qwen/Qwen2.5-0.5B-Instruct",
            dataset_id=None,
            ui_preferences={},
        )
        session.add(cfg)
        await session.commit()
    elif not cfg.language_model:
        cfg.language_model = "Qwen/Qwen2.5-0.5B-Instruct"
        if not cfg.embedding_model:
            cfg.embedding_model = "BAAI/bge-small-en-v1.5"
        await session.commit()

    return {
        "embedding_model": cfg.embedding_model,
        "language_model": cfg.language_model,
        "dataset_id": cfg.dataset_id,
        "ui_preferences": cfg.ui_preferences or {},
        "configured": bool(cfg.language_model and cfg.embedding_model),
    }


@router.get("/suggestions")
async def get_suggestions() -> dict[str, Any]:
    """Returns dynamic model suggestions for setup drawer."""
    from app.hf.hub import get_suggested_models
    return await get_suggested_models()


@router.put("")
@router.post("")
async def update_setup(
    req: UpdateSetupRequest,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Update active setup."""
    result = await session.execute(select(AppSettings).where(AppSettings.key == "default"))
    cfg = result.scalar_one_or_none()

    if not cfg:
        cfg = AppSettings(key="default")
        session.add(cfg)

    if req.embedding_model is not None:
        cfg.embedding_model = req.embedding_model
    if req.language_model is not None:
        cfg.language_model = req.language_model
    if req.dataset_id is not None:
        cfg.dataset_id = req.dataset_id
    if req.ui_preferences is not None:
        cfg.ui_preferences = req.ui_preferences

    await session.commit()

    return {
        "embedding_model": cfg.embedding_model,
        "language_model": cfg.language_model,
        "dataset_id": cfg.dataset_id,
        "ui_preferences": cfg.ui_preferences,
    }
