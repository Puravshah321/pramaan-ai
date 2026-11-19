"""Hugging Face live API endpoints and local model manager."""
from __future__ import annotations

import shutil
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.hf.datasets import get_dataset_splits_and_rows, search_datasets
from app.hf.hub import get_model_details, get_suggested_models, search_models
from app.hf.inference import generate_text
from app.runners.local import (
    estimate_model_memory,
    list_local_models,
    resolve_or_download_gguf,
)

router = APIRouter(prefix="/api/hf", tags=["huggingface"])


class TestModelRequest(BaseModel):
    model_id: str
    prompt: str | None = "What is the capital of France?"


class DownloadModelRequest(BaseModel):
    model_id: str
    quantization: str = "q4_k_m"
    is_embedding: bool = False


# ==============================================================================
# Model Search, Details & Memory
# ==============================================================================

@router.get("/models")
async def list_models(
    q: str = Query(default="", alias="q"),
    task: str | None = Query(default=None),
    limit: int = 20,
    session: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Live search on Hugging Face Hub with fallback to local registry."""
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


@router.get("/models/suggested")
async def suggested_models() -> dict[str, list[dict[str, Any]]]:
    """Returns local-runnable suggested models for LLM and embeddings."""
    return await get_suggested_models()


@router.get("/models/memory")
async def get_model_memory(
    model_id: str = Query(..., alias="model_id"),
    quantization: str = Query(default="q4_k_m", alias="quantization"),
) -> dict[str, Any]:
    """Single source of truth endpoint for model memory estimation."""
    return estimate_model_memory(model_id=model_id, quantization=quantization)


@router.get("/models/local")
async def get_local_models_status() -> list[dict[str, Any]]:
    """Returns disk-computed status of local GGUF models."""
    return list_local_models()


@router.post("/models/download")
async def download_model(req: DownloadModelRequest) -> dict[str, Any]:
    """Downloads model GGUF file with disk space check."""
    from app.runners.local import MODELS_DIR
    free_bytes = shutil.disk_usage(str(MODELS_DIR)).free

    # Required space estimate (~1 GB minimum buffer)
    mem = estimate_model_memory(req.model_id, req.quantization)
    est_bytes = int(mem["estimated_memory_gb"] * (1024 ** 3))

    if free_bytes < (est_bytes + 500 * 1024 * 1024):
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient disk space. Free: {round(free_bytes / (1024**3), 2)} GB, Needed: {round((est_bytes + 500*1024*1024)/(1024**3), 2)} GB",
        )

    try:
        path = resolve_or_download_gguf(
            model_id=req.model_id,
            quantization=req.quantization,
            is_embedding=req.is_embedding,
        )
        file_size_mb = round(Path(path).stat().st_size / (1024 * 1024), 1)
        return {
            "status": "ready",
            "model_id": req.model_id,
            "quantization": req.quantization,
            "path": path,
            "size_mb": file_size_mb,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}") from e


@router.get("/models/{owner}/{name}")
async def model_details(
    owner: str,
    name: str,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve metadata and route availability for a model."""
    full_id = f"{owner}/{name}"
    return await get_model_details(model_id=full_id, session=session)


# ==============================================================================
# Datasets Search & Preview
# ==============================================================================

@router.get("/datasets")
async def list_datasets(
    q: str = Query(default="", alias="q"),
    language: str = Query(default="en"),
    show_unsupported: bool = Query(default=False),
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Live dataset search."""
    return await search_datasets(query=q, language=language, limit=limit, show_unsupported=show_unsupported)


@router.get("/datasets/{id:path}/rows")
async def preview_rows(
    id: str,
    split: str | None = None,
    config: str | None = None,
    offset: int = 0,
    length: int = 10,
    adapter: str | None = None,
) -> dict[str, Any]:
    """Fetch sample rows from Hugging Face Datasets Server."""
    return await get_dataset_splits_and_rows(
        dataset_id=id,
        split=split,
        config=config,
        offset=offset,
        length=length,
        adapter_name=adapter,
    )


@router.post("/models/test")
async def test_model(req: TestModelRequest) -> dict[str, Any]:
    """Real test call to verify model responsiveness locally."""
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
        "source": "local",
    }
