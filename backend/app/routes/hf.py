"""Hugging Face live API endpoints."""
from __future__ import annotations

import time
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.hf.datasets import get_dataset_splits_and_rows, search_datasets
from app.hf.hub import get_model_details, search_models
from app.hf.inference import generate_text

router = APIRouter(prefix="/api/hf", tags=["huggingface"])


class TestModelRequest(BaseModel):
    model_id: str
    prompt: Optional[str] = "What is the capital of France?"


@router.get("/models")
async def list_models(
    q: str = Query(default="", alias="q"),
    task: Optional[str] = Query(default=None),
    limit: int = 20,
    session: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Live search on Hugging Face Hub."""
    pipeline_tag = None
    if task:
        if "embed" in task.lower() or "feature" in task.lower() or "similarity" in task.lower():
            pipeline_tag = "sentence-similarity"
        elif "llm" in task.lower() or "generation" in task.lower() or "text" in task.lower():
            pipeline_tag = "text-generation"

    return await search_models(
        query=q,
        pipeline_tag=pipeline_tag,
        limit=limit,
        session=session,
    )


@router.get("/models/{owner}/{name}")
async def model_details(
    owner: str,
    name: str,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve metadata and route availability for a model."""
    full_id = f"{owner}/{name}"
    return await get_model_details(model_id=full_id, session=session)


@router.get("/datasets")
async def list_datasets(
    q: str = Query(default="", alias="q"),
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Live dataset search."""
    return await search_datasets(query=q, limit=limit)


@router.get("/datasets/{id:path}/rows")
async def preview_rows(
    id: str,
    offset: int = 0,
    length: int = 10,
) -> dict[str, Any]:
    """Fetch sample rows from Hugging Face Datasets Server."""
    return await get_dataset_splits_and_rows(dataset_id=id, offset=offset, length=length)


@router.post("/models/test")
async def test_model(req: TestModelRequest) -> dict[str, Any]:
    """Real test call to verify model responsiveness and measure latency."""
    t0 = time.perf_counter()
    res = await generate_text(
        model_id=req.model_id,
        prompt=req.prompt or "What is the capital of France?",
        max_tokens=32,
    )
    t1 = time.perf_counter()
    latency_ms = round((t1 - t0) * 1000, 2)

    return {
        "model_id": req.model_id,
        "response": res.get("text", ""),
        "latency_ms": latency_ms,
        "tokens": res.get("tokens", 0),
        "error": res.get("error"),
        "source": "api",
    }
