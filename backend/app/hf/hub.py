"""Hugging Face Hub API client with SQLite caching."""
from __future__ import annotations

import datetime
import httpx
from typing import Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import ModelCache

HF_API_BASE = "https://huggingface.co/api"
CACHE_TTL_MINUTES = 15


def _get_headers() -> dict[str, str]:
    headers = {"User-Agent": "PramaanAI/0.1.0"}
    if settings.hf_token and settings.hf_token.strip():
        headers["Authorization"] = f"Bearer {settings.hf_token.strip()}"
    return headers


async def search_models(
    query: str,
    pipeline_tag: Optional[str] = None,
    limit: int = 20,
    session: Optional[AsyncSession] = None,
) -> list[dict[str, Any]]:
    """Search models from the Hub with downloads, parameters, license, and inference route availability."""
    cache_key = f"search:{pipeline_tag or 'all'}:{query.strip().lower()}:{limit}"
    now = datetime.datetime.utcnow()

    if session:
        result = await session.execute(
            select(ModelCache).where(ModelCache.model_id == cache_key)
        )
        cached = result.scalar_one_or_none()
        if cached and (now - cached.fetched_at).total_seconds() < CACHE_TTL_MINUTES * 60:
            return cached.metadata_json.get("results", [])

    params: dict[str, Any] = {
        "sort": "downloads",
        "direction": -1,
        "limit": limit,
    }
    if query.strip():
        params["search"] = query.strip()
    if pipeline_tag:
        params["pipeline_tag"] = pipeline_tag

    url = f"{HF_API_BASE}/models"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, params=params, headers=_get_headers())
            if resp.status_code != 200:
                return []
            raw_models = resp.json()
        except Exception:
            return []

    results = []
    for m in raw_models:
        model_id = m.get("id") or m.get("modelId")
        if not model_id:
            continue
        pipeline = m.get("pipeline_tag")
        gated = m.get("gated", False)
        downloads = m.get("downloads", 0)
        likes = m.get("likes", 0)

        # Estimate parameters or extract from tags
        tags = m.get("tags", [])
        safetensors = m.get("safetensors", {})
        params_total = safetensors.get("total") if isinstance(safetensors, dict) else None

        # Check inference capability
        has_inference = False
        if pipeline in ["feature-extraction", "sentence-similarity", "text-generation", "text2text-generation"]:
            has_inference = True

        results.append({
            "id": model_id,
            "pipeline_tag": pipeline,
            "downloads": downloads,
            "likes": likes,
            "gated": bool(gated),
            "tags": tags,
            "parameters": params_total,
            "inference_available": has_inference and not gated,
            "local_only": not has_inference or gated,
        })

    if session:
        cache_entry = ModelCache(
            model_id=cache_key,
            pipeline_tag=pipeline_tag,
            metadata_json={"results": results},
            fetched_at=now,
        )
        await session.merge(cache_entry)
        try:
            await session.commit()
        except Exception:
            await session.rollback()

    return results


async def get_model_details(
    model_id: str,
    session: Optional[AsyncSession] = None,
) -> dict[str, Any]:
    """Fetch live metadata for a specific model ID."""
    now = datetime.datetime.utcnow()
    cache_key = f"model:{model_id}"

    if session:
        result = await session.execute(
            select(ModelCache).where(ModelCache.model_id == cache_key)
        )
        cached = result.scalar_one_or_none()
        if cached and (now - cached.fetched_at).total_seconds() < CACHE_TTL_MINUTES * 60:
            return cached.metadata_json

    url = f"{HF_API_BASE}/models/{model_id}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, headers=_get_headers())
        except Exception as e:
            return {
                "id": model_id,
                "error": f"Failed to connect to Hugging Face: {str(e)}",
                "available": False,
            }

        if resp.status_code == 404:
            return {
                "id": model_id,
                "error": f"Model '{model_id}' not found on Hugging Face.",
                "available": False,
            }
        elif resp.status_code == 401 or resp.status_code == 403:
            return {
                "id": model_id,
                "gated": True,
                "error": "You need to request access on Hugging Face first or check your HF_TOKEN.",
                "available": False,
                "access_url": f"https://huggingface.co/{model_id}",
            }
        elif resp.status_code != 200:
            return {
                "id": model_id,
                "error": f"Hugging Face returned status {resp.status_code}: {resp.text[:100]}",
                "available": False,
            }

        data = resp.json()

    pipeline = data.get("pipeline_tag")
    gated = data.get("gated", False)
    downloads = data.get("downloads", 0)
    likes = data.get("likes", 0)
    safetensors = data.get("safetensors", {})
    parameters = safetensors.get("total") if isinstance(safetensors, dict) else None

    # Try extracting param count from model name or card if not in safetensors
    if not parameters:
        import re
        match = re.search(r'([0-9]+(?:\.[0-9]+)?)[bB]', model_id)
        if match:
            parameters = int(float(match.group(1)) * 1e9)
        else:
            match_m = re.search(r'([0-9]+)[mM]', model_id)
            if match_m:
                parameters = int(float(match_m.group(1)) * 1e6)

    # Estimate memory (bytes per weight: fp16 = 2 bytes)
    estimated_memory_gb = round((parameters * 2) / (1024 ** 3), 2) if parameters else None

    # License
    license_tag = "unknown"
    tags = data.get("tags", [])
    for tag in tags:
        if tag.startswith("license:"):
            license_tag = tag[len("license:"):]
            break

    # Route availability
    inference_route = "local"
    if pipeline in ["feature-extraction", "sentence-similarity", "text-generation", "text2text-generation"] and not gated:
        inference_route = "api"

    result_data = {
        "id": model_id,
        "pipeline_tag": pipeline,
        "gated": bool(gated),
        "downloads": downloads,
        "likes": likes,
        "parameters": parameters,
        "estimated_memory_gb": estimated_memory_gb,
        "license": license_tag,
        "inference_route": inference_route,
        "available": True,
        "library_name": data.get("library_name", ""),
    }

    if session:
        cache_entry = ModelCache(
            model_id=cache_key,
            pipeline_tag=pipeline,
            metadata_json=result_data,
            fetched_at=now,
        )
        await session.merge(cache_entry)
        try:
            await session.commit()
        except Exception:
            await session.rollback()

    return result_data
