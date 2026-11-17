"""Health and status endpoints with precise token capability diagnosis and hardware auto-detection."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from dotenv import dotenv_values
import httpx
from fastapi import APIRouter

from app.runners.hardware import detect_hardware

router = APIRouter(tags=["system"])

ROUTER_BASE = "https://router.huggingface.co/v1"
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
ENV_PATH = PROJECT_ROOT / "backend" / ".env"


def get_live_token() -> str:
    """Re-reads backend/.env dynamically so changes take effect without server restart."""
    if ENV_PATH.exists():
        vals = dotenv_values(ENV_PATH)
        return (vals.get("HF_TOKEN") or "").strip()
    return ""


async def run_precise_token_diagnosis(token: str) -> dict[str, Any]:
    """Diagnoses Hugging Face token and router access precisely across 8 distinct cases:
    - no_token
    - token_invalid
    - missing_inference_permission
    - no_provider_enabled
    - credits_exhausted (HTTP 402)
    - rate_limited (HTTP 429)
    - network_error
    - token_fine
    """
    redacted = f"{token[:4]}...{token[-4:]}" if len(token) > 8 else ("(none)" if not token else "***")

    if not token:
        return {
            "status": "no_token",
            "reachable": True,
            "router_accessible": False,
            "token_present": False,
            "token_message": "No Hugging Face token found in backend/.env.",
            "fix": "Add HF_TOKEN=your_token to backend/.env to enable hosted models.",
            "tokens_url": "https://huggingface.co/settings/tokens",
            "providers_url": "https://huggingface.co/settings/inference-providers",
            "billing_url": "https://huggingface.co/settings/billing",
            "username": None,
            "token_redacted": redacted,
        }

    headers = {"Authorization": f"Bearer {token}", "User-Agent": "PramaanAI/0.1.0"}

    # 1. whoami-v2
    async with httpx.AsyncClient(timeout=6.0) as client:
        try:
            r_who = await client.get("https://huggingface.co/api/whoami-v2", headers=headers)
        except Exception as e:
            return {
                "status": "network_error",
                "reachable": False,
                "router_accessible": False,
                "token_present": True,
                "token_message": f"Network connection error contacting Hugging Face: {str(e)}",
                "fix": "Check your internet connection and proxy settings.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": None,
                "token_redacted": redacted,
            }

        if r_who.status_code == 401:
            return {
                "status": "token_invalid",
                "reachable": True,
                "router_accessible": False,
                "token_present": True,
                "token_message": "Your Hugging Face token is invalid or expired (HTTP 401).",
                "fix": "Create a new Read token at huggingface.co/settings/tokens.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": None,
                "token_redacted": redacted,
            }
        elif r_who.status_code != 200:
            return {
                "status": "token_invalid",
                "reachable": True,
                "router_accessible": False,
                "token_present": True,
                "token_message": f"Hugging Face authorization failed with HTTP {r_who.status_code}.",
                "fix": "Verify your token at huggingface.co/settings/tokens.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": None,
                "token_redacted": redacted,
            }

        who_data = r_who.json()
        username = who_data.get("name", "unknown")
        auth = who_data.get("auth", {})
        access_tok = auth.get("accessToken", {})
        role = access_tok.get("role", "read")

        # Check fine-grained permissions if role == fineGrained
        if role == "fineGrained":
            fg = access_tok.get("fineGrained", {})
            global_perms = fg.get("global", [])
            scoped = fg.get("scoped", [])
            all_perms = set(global_perms)
            for s in scoped:
                for p in s.get("permissions", []):
                    all_perms.add(p)

            has_inference = any("inference" in p for p in all_perms)
            if not has_inference:
                return {
                    "status": "missing_inference_permission",
                    "reachable": True,
                    "router_accessible": False,
                    "token_present": True,
                    "token_message": "Your Hugging Face token lacks inference permissions.",
                    "fix": "Enable 'Make calls to Inference Providers' on your token at huggingface.co/settings/tokens.",
                    "tokens_url": "https://huggingface.co/settings/tokens",
                    "providers_url": "https://huggingface.co/settings/inference-providers",
                    "billing_url": "https://huggingface.co/settings/billing",
                    "username": username,
                    "token_redacted": redacted,
                }

        # 2. Live Router Models catalog check
        try:
            r_models = await client.get(f"{ROUTER_BASE}/models", headers=headers, timeout=8.0)
            if r_models.status_code != 200:
                return {
                    "status": "no_provider_enabled",
                    "reachable": True,
                    "router_accessible": False,
                    "token_present": True,
                    "token_message": f"Unable to fetch Hugging Face router models (HTTP {r_models.status_code}).",
                    "fix": "Configure inference providers at huggingface.co/settings/inference-providers.",
                    "tokens_url": "https://huggingface.co/settings/tokens",
                    "providers_url": "https://huggingface.co/settings/inference-providers",
                    "billing_url": "https://huggingface.co/settings/billing",
                    "username": username,
                    "token_redacted": redacted,
                }
            catalog = [m.get("id") for m in r_models.json().get("data", []) if m.get("id")]
        except Exception as e:
            return {
                "status": "network_error",
                "reachable": True,
                "router_accessible": False,
                "token_present": True,
                "token_message": f"Network error contacting Hugging Face router: {str(e)}",
                "fix": "Check network connectivity to router.huggingface.co.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": username,
                "token_redacted": redacted,
            }

        if not catalog:
            return {
                "status": "no_provider_enabled",
                "reachable": True,
                "router_accessible": False,
                "token_present": True,
                "token_message": "No hosted models available on Hugging Face router for this account.",
                "fix": "Enable inference providers at huggingface.co/settings/inference-providers.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": username,
                "token_redacted": redacted,
            }

        # 3. Choose a live model from the router catalog for test call
        preferred_candidates = [
            m for m in catalog if any(k in m.lower() for k in ["1.7b", "3b", "small", "flash", "mini", "lite", "8b"])
        ]
        test_model = preferred_candidates[0] if preferred_candidates else catalog[0]

        try:
            payload = {
                "model": test_model,
                "messages": [{"role": "user", "content": "hi"}],
                "max_tokens": 1,
            }
            r_test = await client.post(
                f"{ROUTER_BASE}/chat/completions",
                headers=headers,
                json=payload,
                timeout=8.0,
            )
        except Exception as e:
            return {
                "status": "network_error",
                "reachable": True,
                "router_accessible": False,
                "token_present": True,
                "token_message": f"Network error during live test call to {test_model}: {str(e)}",
                "fix": "Check connection to router.huggingface.co.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": username,
                "token_redacted": redacted,
                "test_model": test_model,
            }

        if r_test.status_code == 200:
            return {
                "status": "token_fine",
                "reachable": True,
                "router_accessible": True,
                "token_present": True,
                "token_message": None,
                "fix": None,
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": username,
                "token_redacted": redacted,
                "test_model": test_model,
            }
        elif r_test.status_code == 402:
            return {
                "status": "credits_exhausted",
                "reachable": True,
                "router_accessible": False,
                "token_present": True,
                "token_message": "Hugging Face pre-paid inference credits exhausted or payment required (HTTP 402).",
                "fix": "Purchase pre-paid credits or sign up for PRO at huggingface.co/settings/billing to use hosted router models.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": username,
                "token_redacted": redacted,
                "test_model": test_model,
            }
        elif r_test.status_code == 429:
            return {
                "status": "rate_limited",
                "reachable": True,
                "router_accessible": False,
                "token_present": True,
                "token_message": "Hugging Face router rate limit reached (HTTP 429).",
                "fix": "Please wait a moment before trying again.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": username,
                "token_redacted": redacted,
                "test_model": test_model,
            }
        elif r_test.status_code in [401, 403]:
            return {
                "status": "missing_inference_permission",
                "reachable": True,
                "router_accessible": False,
                "token_present": True,
                "token_message": f"Hugging Face Router rejected test call (HTTP {r_test.status_code}).",
                "fix": "Enable 'Make calls to Inference Providers' on your token at huggingface.co/settings/tokens.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": username,
                "token_redacted": redacted,
                "test_model": test_model,
            }
        else:
            return {
                "status": "router_error",
                "reachable": True,
                "router_accessible": False,
                "token_present": True,
                "token_message": f"Hugging Face Router returned HTTP {r_test.status_code}.",
                "fix": "Check status at status.huggingface.co or switch to local runner.",
                "tokens_url": "https://huggingface.co/settings/tokens",
                "providers_url": "https://huggingface.co/settings/inference-providers",
                "billing_url": "https://huggingface.co/settings/billing",
                "username": username,
                "token_redacted": redacted,
                "test_model": test_model,
            }


@router.get("/healthz")
@router.get("/readyz")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/health")
async def health_check() -> dict[str, Any]:
    """Backend status, Hugging Face reachability, token capability check, and hardware detection."""
    token = get_live_token()
    diag = await run_precise_token_diagnosis(token)
    hardware_info = detect_hardware()

    return {
        "status": "ok",
        "diagnosis": diag["status"],
        "huggingface": {
            "reachable": diag["reachable"],
            "router_accessible": diag["router_accessible"],
            "token_present": diag["token_present"],
            "username": diag.get("username"),
            "token_message": diag["token_message"],
            "fix": diag.get("fix"),
            "tokens_url": diag.get("tokens_url", "https://huggingface.co/settings/tokens"),
            "providers_url": diag.get("providers_url", "https://huggingface.co/settings/inference-providers"),
            "billing_url": diag.get("billing_url", "https://huggingface.co/settings/billing"),
            "test_model": diag.get("test_model"),
        },
        "local_runner": True,
        "hardware": hardware_info,
        "database": "sqlite_ready",
    }


@router.post("/api/health/recheck")
async def health_recheck() -> dict[str, Any]:
    """Bypasses any cache, re-reads backend/.env live, and re-diagnoses router connectivity."""
    return await health_check()
