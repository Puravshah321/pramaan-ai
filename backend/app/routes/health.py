"""Health and status endpoints for free local-only execution and hardware auto-detection.
Hosted inference router, 402 credit checks, and token banners have been removed.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import dotenv_values
from fastapi import APIRouter

from app.config import settings
from app.runners.hardware import detect_hardware
from app.runners.local import list_local_models

router = APIRouter(tags=["system"])

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
ENV_PATH = PROJECT_ROOT / "backend" / ".env"


def get_live_token() -> str:
    """Re-reads backend/.env dynamically so changes take effect without server restart."""
    if ENV_PATH.exists():
        vals = dotenv_values(ENV_PATH)
        return (vals.get("HF_TOKEN") or "").strip()
    return ""


def is_offline() -> bool:
    return bool(
        settings.offline_mode
        or os.environ.get("OFFLINE_MODE", "").lower() in ["1", "true", "yes"]
        or os.environ.get("HF_HUB_OFFLINE", "") == "1"
    )


@router.get("/healthz")
@router.get("/api/health")
async def health_check() -> dict[str, Any]:
    """Returns local runner health, hardware telemetry, and optional Hub reachability."""
    token = get_live_token()
    hw = detect_hardware()
    offline = is_offline()
    local_mods = list_local_models()
    ready_count = sum(1 for m in local_mods if m["status"] == "ready")

    # Optional Hub reachability check (for metadata only, not inference)
    hub_reachable = False
    if not offline:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get("https://huggingface.co/api/models?limit=1")
                hub_reachable = (r.status_code == 200)
        except Exception:
            hub_reachable = False

    return {
        "status": "ok",
        "diagnosis": "ok",
        "local_runner": True,
        "engine": "llama-cpp-python",
        "mode": "offline" if offline else "local",
        "offline_mode": offline,
        "device": hw["device"],
        "gpu": hw.get("gpu"),
        "cpu": hw.get("cpu"),
        "ram": hw.get("ram"),
        "models_ready": ready_count,
        "total_local_models": len(local_mods),
        "huggingface": {
            "token_present": bool(token),
            "hub_reachable": hub_reachable,
            "token_message": None,  # No token error banner in free local-only mode
            "mode": "metadata_only",
        },
    }


@router.post("/api/health/recheck")
async def recheck_health() -> dict[str, Any]:
    """Re-checks local system health."""
    return await health_check()
