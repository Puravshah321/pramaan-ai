"""Standalone CLI script to diagnose Hugging Face token and router access precisely."""
from __future__ import annotations

import sys
from pathlib import Path
from dotenv import dotenv_values
import httpx

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / "backend" / ".env"

ROUTER_BASE = "https://router.huggingface.co/v1"


def diagnose_token(env_path: Path | None = None) -> dict[str, str]:
    target_env = env_path or ENV_PATH
    vals = dotenv_values(target_env) if target_env.exists() else {}
    token = (vals.get("HF_TOKEN") or "").strip()

    redacted = f"{token[:4]}...{token[-4:]}" if len(token) > 8 else ("(none)" if not token else "***")

    if not token:
        return {
            "status": "no_token",
            "message": "No Hugging Face token found in backend/.env.",
            "fix": "Add HF_TOKEN=your_token to backend/.env to use hosted router models.",
            "token": redacted,
        }

    headers = {"Authorization": f"Bearer {token}", "User-Agent": "PramaanAI/0.1.0"}

    # 1. whoami-v2
    try:
        r_who = httpx.get("https://huggingface.co/api/whoami-v2", headers=headers, timeout=6.0)
    except Exception as e:
        return {
            "status": "network_error",
            "message": f"Network error contacting Hugging Face: {str(e)}",
            "fix": "Check your internet connection and proxy settings.",
            "token": redacted,
        }

    if r_who.status_code == 401:
        return {
            "status": "token_invalid",
            "message": "Your Hugging Face token is invalid or expired (HTTP 401).",
            "fix": "Generate a new token at https://huggingface.co/settings/tokens and update backend/.env.",
            "token": redacted,
        }
    elif r_who.status_code != 200:
        return {
            "status": "token_invalid",
            "message": f"Hugging Face whoami returned unexpected HTTP {r_who.status_code}.",
            "fix": "Verify your token at https://huggingface.co/settings/tokens.",
            "token": redacted,
        }

    who_data = r_who.json()
    username = who_data.get("name", "unknown")
    auth = who_data.get("auth", {})
    access_tok = auth.get("accessToken", {})
    role = access_tok.get("role", "read")

    # Check permissions for fine-grained tokens
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
                "message": "Your Hugging Face token lacks inference permissions.",
                "fix": "Edit your token at https://huggingface.co/settings/tokens and enable 'Make calls to Inference Providers'.",
                "token": redacted,
                "username": username,
            }

    # 2. Fetch live router models catalog
    try:
        r_models = httpx.get(f"{ROUTER_BASE}/models", headers=headers, timeout=8.0)
        if r_models.status_code != 200:
            return {
                "status": "no_provider_enabled",
                "message": f"Unable to fetch Hugging Face router models (HTTP {r_models.status_code}).",
                "fix": "Check your inference provider settings at https://huggingface.co/settings/inference-providers.",
                "token": redacted,
                "username": username,
            }
        catalog = [m.get("id") for m in r_models.json().get("data", []) if m.get("id")]
    except Exception as e:
        return {
            "status": "network_error",
            "message": f"Network error contacting Hugging Face Router: {str(e)}",
            "fix": "Check your internet connection.",
            "token": redacted,
            "username": username,
        }

    if not catalog:
        return {
            "status": "no_provider_enabled",
            "message": "Hugging Face router returned zero available models for this account.",
            "fix": "Enable inference providers at https://huggingface.co/settings/inference-providers.",
            "token": redacted,
            "username": username,
        }

    # 3. Select a small live chat model from the router catalog for test call
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
        r_test = httpx.post(
            f"{ROUTER_BASE}/chat/completions",
            headers=headers,
            json=payload,
            timeout=8.0,
        )
    except Exception as e:
        return {
            "status": "network_error",
            "message": f"Network error during live test call to {test_model}: {str(e)}",
            "fix": "Check network connectivity to router.huggingface.co.",
            "token": redacted,
            "username": username,
            "test_model": test_model,
        }

    if r_test.status_code == 200:
        return {
            "status": "token_fine",
            "message": "Hugging Face token is valid and active. Hosted models are ready.",
            "fix": "None needed.",
            "token": redacted,
            "username": username,
            "test_model": test_model,
        }
    elif r_test.status_code == 402:
        return {
            "status": "credits_exhausted",
            "message": "Hugging Face pre-paid inference credits exhausted or payment required (HTTP 402).",
            "fix": "Purchase pre-paid credits or sign up for PRO at https://huggingface.co/settings/billing to use hosted router models.",
            "token": redacted,
            "username": username,
            "test_model": test_model,
        }
    elif r_test.status_code == 429:
        return {
            "status": "rate_limited",
            "message": "Hugging Face router rate limit reached (HTTP 429).",
            "fix": "Please wait a moment before trying again.",
            "token": redacted,
            "username": username,
            "test_model": test_model,
        }
    elif r_test.status_code in [401, 403]:
        return {
            "status": "missing_inference_permission",
            "message": f"Hugging Face Router rejected test call with HTTP {r_test.status_code}: {r_test.text[:120]}",
            "fix": "Ensure 'Make calls to Inference Providers' is enabled and providers are configured at https://huggingface.co/settings/inference-providers.",
            "token": redacted,
            "username": username,
            "test_model": test_model,
        }
    else:
        return {
            "status": "router_error",
            "message": f"Hugging Face Router returned HTTP {r_test.status_code}: {r_test.text[:120]}",
            "fix": "Check router status at https://status.huggingface.co.",
            "token": redacted,
            "username": username,
            "test_model": test_model,
        }


if __name__ == "__main__":
    result = diagnose_token()
    print("=" * 60)
    print("PRAMAAN AI — HUGGING FACE TOKEN & ROUTER DIAGNOSIS")
    print("=" * 60)
    print(f"Token:       {result.get('token')}")
    print(f"Username:    {result.get('username', 'N/A')}")
    print(f"Diagnosis:   {result['status'].upper()}")
    print(f"Message:     {result['message']}")
    print(f"Action/Fix:  {result['fix']}")
    if result.get("test_model"):
        print(f"Test Model:  {result['test_model']}")
    print("=" * 60)
    sys.exit(0 if result["status"] == "token_fine" else 1)
