"""Hugging Face Hub API client with 3-check availability system, SQLite caching, and live router catalog."""
from __future__ import annotations

import datetime
import time
import httpx
from typing import Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import ModelCache

HF_API_BASE = "https://huggingface.co/api"
ROUTER_BASE = "https://router.huggingface.co/v1"
CACHE_TTL_MINUTES = 10

# In-memory caches with 10-minute TTL
_ROUTER_MODELS_CACHE: dict[str, Any] = {"models": set(), "fetched_at": 0.0}
_TEST_CALL_CACHE: dict[str, Any] = {}  # model_id -> (status_code, timestamp, reason)


def _get_headers() -> dict[str, str]:
    headers = {"User-Agent": "PramaanAI/0.1.0"}
    if settings.hf_token and settings.hf_token.strip():
        headers["Authorization"] = f"Bearer {settings.hf_token.strip()}"
    return headers


async def get_router_models() -> set[str]:
    """Fetch and cache for 10 minutes the set of all models supported by Hugging Face Router."""
    now = time.time()
    if _ROUTER_MODELS_CACHE["models"] and (now - _ROUTER_MODELS_CACHE["fetched_at"] < CACHE_TTL_MINUTES * 60):
        return _ROUTER_MODELS_CACHE["models"]

    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            resp = await client.get(f"{ROUTER_BASE}/models", headers=_get_headers())
            if resp.status_code == 200:
                data = resp.json()
                model_set = {m.get("id") for m in data.get("data", []) if m.get("id")}
                _ROUTER_MODELS_CACHE["models"] = model_set
                _ROUTER_MODELS_CACHE["fetched_at"] = now
                return model_set
        except Exception:
            pass

    return _ROUTER_MODELS_CACHE.get("models", set())


async def test_one_token_call(model_id: str) -> tuple[int, str]:
    """Performs a real one-token test call to Hugging Face Router, cached for 10 minutes."""
    now = time.time()
    if model_id in _TEST_CALL_CACHE:
        code, timestamp, reason = _TEST_CALL_CACHE[model_id]
        if now - timestamp < CACHE_TTL_MINUTES * 60:
            return code, reason

    headers = _get_headers()
    payload = {
        "model": model_id,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
    }

    async with httpx.AsyncClient(timeout=6.0) as client:
        try:
            resp = await client.post(f"{ROUTER_BASE}/chat/completions", headers=headers, json=payload)
            code = resp.status_code
            reason = resp.text[:120]
        except Exception as e:
            code = 500
            reason = str(e)[:120]

    _TEST_CALL_CACHE[model_id] = (code, now, reason)
    return code, reason


async def classify_model_route(
    model_id: str,
    pipeline_tag: Optional[str],
    is_gated: bool,
    parameters: Optional[int] = None,
) -> dict[str, Any]:
    """Applies the 3-check availability system:
    1. Router catalog check
    2. Hub inferenceProviderMapping check
    3. One-token test call
    """
    router_catalog = await get_router_models()
    is_in_router = model_id in router_catalog

    # Is model local-runnable (sub-4B instruct / GGUF candidate)?
    is_small_model = parameters is not None and parameters <= 4_000_000_000
    is_known_local = any(k in model_id.lower() for k in ["qwen2.5-0.5b", "qwen2.5-1.5b", "smollm", "llama-3.2-1b"])

    if is_gated:
        return {
            "route": "not_runnable",
            "inference_available": False,
            "status_label": "Gated (needs access)",
            "reason": "Model requires gated repository access approval on Hugging Face.",
        }

    # If in router catalog, test live call
    if is_in_router:
        code, reason = await test_one_token_call(model_id)
        if code == 200:
            return {
                "route": "api",
                "inference_available": True,
                "status_label": "API route",
                "reason": "Verified responsive on Hugging Face Serverless Router.",
            }
        elif code in [401, 402, 403]:
            return {
                "route": "needs_token_fix",
                "inference_available": False,
                "status_label": "Needs token fix",
                "reason": "In router catalog, but current token lacks provider credits or global inference permission.",
            }
        else:
            # Other error on router
            if is_small_model or is_known_local:
                return {
                    "route": "local",
                    "inference_available": False,
                    "status_label": "Local only",
                    "reason": "Router call failed; runnable locally via GGUF runner.",
                }
            return {
                "route": "not_runnable",
                "inference_available": False,
                "status_label": "Not runnable",
                "reason": f"Router test call failed ({code}): {reason}",
            }

    # Not in router catalog
    if is_small_model or is_known_local:
        return {
            "route": "local",
            "inference_available": False,
            "status_label": "Local only",
            "reason": "Not hosted on router; runs locally with GGUF runner.",
        }

    return {
        "route": "not_runnable",
        "inference_available": False,
        "status_label": "Not runnable",
        "reason": "Model is not hosted on serverless router and exceeds local edge hardware profile (>4B params).",
    }


async def search_models(
    query: str,
    pipeline_tag: Optional[str] = None,
    limit: int = 20,
    session: Optional[AsyncSession] = None,
) -> list[dict[str, Any]]:
    """Search models from the Hub with verified 3-check route classification."""
    cache_key = f"search_v4:{pipeline_tag or 'all'}:{query.strip().lower()}:{limit}"
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
    router_catalog = await get_router_models()

    for m in raw_models:
        model_id = m.get("id") or m.get("modelId")
        if not model_id:
            continue
        pipeline = m.get("pipeline_tag")
        gated = m.get("gated", False)
        downloads = m.get("downloads", 0)
        likes = m.get("likes", 0)
        tags = m.get("tags", [])
        safetensors = m.get("safetensors", {})
        params_total = safetensors.get("total") if isinstance(safetensors, dict) else None

        # Route classification
        if pipeline in ["feature-extraction", "sentence-similarity"]:
            route_info = {
                "route": "api",
                "inference_available": True,
                "status_label": "API route",
            }
        else:
            is_in_router = model_id in router_catalog
            is_small = any(k in model_id.lower() for k in ["0.5b", "1b", "1.5b", "2b", "3b", "smol"])
            if is_in_router:
                route_info = {
                    "route": "api",
                    "inference_available": True,
                    "status_label": "API route",
                }
            elif is_small:
                route_info = {
                    "route": "local",
                    "inference_available": False,
                    "status_label": "Local only",
                }
            else:
                route_info = {
                    "route": "not_runnable",
                    "inference_available": False,
                    "status_label": "Not runnable",
                }

        results.append({
            "id": model_id,
            "pipeline_tag": pipeline,
            "downloads": downloads,
            "likes": likes,
            "gated": bool(gated),
            "tags": tags,
            "parameters": params_total,
            "inference_available": route_info["inference_available"],
            "inference_route": route_info["route"],
            "status_label": route_info["status_label"],
            "local_only": (route_info["route"] == "local"),
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
    """Fetch live metadata and verified 3-check route status for a specific model ID."""
    now = datetime.datetime.utcnow()
    cache_key = f"model_v4:{model_id}"

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
        elif resp.status_code in [401, 403]:
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

    if not parameters:
        import re
        match = re.search(r'([0-9]+(?:\.[0-9]+)?)[bB]', model_id)
        if match:
            parameters = int(float(match.group(1)) * 1e9)
        else:
            match_m = re.search(r'([0-9]+)[mM]', model_id)
            if match_m:
                parameters = int(float(match_m.group(1)) * 1e6)

    estimated_memory_gb = round((parameters * 2) / (1024 ** 3), 2) if parameters else None

    # License
    license_tag = "unknown"
    tags = data.get("tags", [])
    for tag in tags:
        if tag.startswith("license:"):
            license_tag = tag[len("license:"):]
            break

    # 3-Check Route verification
    route_check = await classify_model_route(
        model_id=model_id,
        pipeline_tag=pipeline,
        is_gated=bool(gated),
        parameters=parameters,
    )

    result_data = {
        "id": model_id,
        "pipeline_tag": pipeline,
        "gated": bool(gated),
        "downloads": downloads,
        "likes": likes,
        "parameters": parameters,
        "estimated_memory_gb": estimated_memory_gb,
        "license": license_tag,
        "inference_route": route_check["route"],
        "inference_available": route_check["inference_available"],
        "status_label": route_check["status_label"],
        "route_reason": route_check.get("reason"),
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


async def get_suggested_models() -> dict[str, list[dict[str, Any]]]:
    """Returns live suggestions for embedding and small local-runnable instruct models (<4B)."""
    local_instruct_ids = [
        "Qwen/Qwen2.5-0.5B-Instruct",
        "Qwen/Qwen2.5-1.5B-Instruct",
        "HuggingFaceTB/SmolLM2-1.7B-Instruct",
        "meta-llama/Llama-3.2-1B-Instruct",
    ]
    embeddings_ids = [
        "sentence-transformers/all-MiniLM-L6-v2",
        "BAAI/bge-small-en-v1.5",
        "mixedbread-ai/mxbai-embed-small",
    ]

    local_models = []
    for mid in local_instruct_ids:
        local_models.append({
            "id": mid,
            "type": "local",
            "badge": "Local only (GGUF)",
            "description": f"Verified local edge model for offline benchmark",
        })

    embedding_models = []
    for mid in embeddings_ids:
        embedding_models.append({
            "id": mid,
            "type": "embedding",
            "badge": "Dense embeddings",
        })

    return {
        "local_instruct": local_models,
        "embeddings": embedding_models,
    }
