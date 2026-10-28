"""Registry router — lists all available models, quantization levels and hardware profiles."""
from __future__ import annotations

import yaml
from fastapi import APIRouter, HTTPException

from app.core.config import get_settings

router = APIRouter(prefix="/api/registry", tags=["registry"])


@router.get("")
async def get_registry() -> dict:
    """Return the full model registry: embedding models, LLMs, quant levels, NLI models."""
    settings = get_settings()
    path = settings.configs_dir / "model_registry.yaml"
    if not path.exists():
        raise HTTPException(status_code=500, detail="model_registry.yaml not found")
    with path.open() as f:
        data = yaml.safe_load(f) or {}
    return data


@router.get("/embedding-models")
async def list_embedding_models() -> list[dict]:
    settings = get_settings()
    with (settings.configs_dir / "model_registry.yaml").open() as f:
        data = yaml.safe_load(f) or {}
    return data.get("embedding_models", [])


@router.get("/llm-models")
async def list_llm_models() -> list[dict]:
    settings = get_settings()
    with (settings.configs_dir / "model_registry.yaml").open() as f:
        data = yaml.safe_load(f) or {}
    return data.get("llm_models", [])


@router.get("/quantization-levels")
async def list_quantization_levels() -> list[dict]:
    settings = get_settings()
    with (settings.configs_dir / "model_registry.yaml").open() as f:
        data = yaml.safe_load(f) or {}
    return data.get("quantization_levels", [])
