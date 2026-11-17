"""Health and status endpoints."""
from __future__ import annotations

import httpx
from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["system"])


@router.get("/healthz")
@router.get("/readyz")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/health")
async def health_check() -> dict[str, Any]:
    """Backend, Hugging Face reachability, token present, local runner on or off."""
    hf_reachable = False
    hf_error = None

    async with httpx.AsyncClient(timeout=4.0) as client:
        try:
            resp = await client.get("https://huggingface.co/api/models?limit=1")
            hf_reachable = (resp.status_code == 200)
        except Exception as e:
            hf_error = str(e)

    token_present = bool(settings.hf_token and settings.hf_token.strip())

    return {
        "status": "ok",
        "huggingface": {
            "reachable": hf_reachable,
            "error": hf_error,
            "token_present": token_present,
        },
        "local_runner": settings.local_runner,
        "database": "sqlite_ready",
    }
