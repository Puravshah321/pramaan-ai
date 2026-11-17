"""Health and status endpoints with token capability checking and hardware auto-detection."""
from __future__ import annotations

import httpx
from typing import Any
from fastapi import APIRouter
from app.config import settings
from app.runners.hardware import detect_hardware

router = APIRouter(tags=["system"])


@router.get("/healthz")
@router.get("/readyz")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/health")
async def health_check() -> dict[str, Any]:
    """Backend status, Hugging Face reachability, token capability check, and hardware detection."""
    hf_reachable = False
    hf_error = None
    username = None
    token_role = None
    is_fine_grained_scoped = False
    router_accessible = False
    token_message = None

    token = settings.hf_token.strip() if settings.hf_token else None
    token_present = bool(token)
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    async with httpx.AsyncClient(timeout=4.0) as client:
        # 1. Check basic HF reachability
        try:
            resp = await client.get("https://huggingface.co/api/models?limit=1")
            hf_reachable = (resp.status_code == 200)
        except Exception as e:
            hf_error = str(e)

        # 2. Check token capabilities if present
        if token_present:
            try:
                r_who = await client.get("https://huggingface.co/api/whoami-v2", headers=headers)
                if r_who.status_code == 200:
                    data = r_who.json()
                    username = data.get("name")
                    auth = data.get("auth", {})
                    tok_info = auth.get("accessToken", {})
                    token_role = tok_info.get("role")
                    if token_role == "fineGrained":
                        fg = tok_info.get("fineGrained", {})
                        # If scoped to user only with no global permissions
                        if not fg.get("global"):
                            is_fine_grained_scoped = True
            except Exception:
                pass

            # 3. Test router accessibility with 1 test check
            try:
                payload = {
                    "model": "meta-llama/Llama-3.2-1B-Instruct",
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 1,
                }
                r_router = await client.post(
                    "https://router.huggingface.co/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=4.0,
                )
                router_accessible = (r_router.status_code == 200)
            except Exception:
                router_accessible = False

            if not router_accessible:
                token_message = (
                    "Your Hugging Face token cannot call hosted models. "
                    "Create a Read token or enable 'Make calls to Inference Providers', then restart."
                )

    hardware_info = detect_hardware()

    return {
        "status": "ok",
        "huggingface": {
            "reachable": hf_reachable,
            "error": hf_error,
            "token_present": token_present,
            "username": username,
            "token_role": token_role,
            "is_fine_grained_scoped": is_fine_grained_scoped,
            "router_accessible": router_accessible,
            "token_message": token_message,
            "tokens_url": "https://huggingface.co/settings/tokens",
            "providers_url": "https://huggingface.co/settings/inference-providers",
        },
        "local_runner": settings.local_runner,
        "hardware": hardware_info,
        "database": "sqlite_ready",
    }
