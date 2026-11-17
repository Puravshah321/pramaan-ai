"""Plain-language error translator for Hugging Face and local inference errors."""
from __future__ import annotations

import re


def translate_hf_error(err: Exception | str | None) -> str:
    """Translates raw technical error messages and HTTP status codes into actionable plain language."""
    if not err:
        return "An unknown error occurred during inference."

    err_str = str(err)

    # 400 Model not supported / provider issue
    if "code': 'model_not_supported'" in err_str or "model_not_supported" in err_str or "not supported by any provider" in err_str:
        return (
            "This model is not hosted on Hugging Face's serverless router. "
            "Run it with the local runner (using GGUF) or select a hosted model from the active router catalog."
        )

    # 402 Payment / Credits required
    if "402" in err_str or "Purchase pre-paid credits" in err_str or "Payment Required" in err_str:
        return (
            "This model requires Hugging Face Inference Provider credits or a PRO subscription. "
            "Switch to the local runner for offline inference or select a free model."
        )

    # 401 / 403 Authentication / Token scopes
    if "401" in err_str or "403" in err_str or "Unauthorized" in err_str or "Forbidden" in err_str:
        return (
            "Your Hugging Face token lacks permission for this model. "
            "Ensure you are using a Read token or a fine-grained token with 'Make calls to Inference Providers' enabled."
        )

    # 429 Rate limit
    if "429" in err_str or "rate limit" in err_str.lower() or "Too Many Requests" in err_str:
        return (
            "Hugging Face serverless rate limit reached. "
            "Please wait a few moments before retrying, or switch to the local runner."
        )

    # 503 Cold start / Loading
    if "503" in err_str or "Service Unavailable" in err_str or "loading" in err_str.lower():
        return (
            "The model is currently loading on Hugging Face's serverless infrastructure. "
            "Please try again in 30-60 seconds."
        )

    # GGUF / Llama.cpp local runner errors
    if "Failed to load model" in err_str or "llama_cpp" in err_str or "out of memory" in err_str.lower():
        return (
            "Local model could not be loaded into memory. "
            "Verify that your system has enough RAM/VRAM or try a higher quantization (e.g. Q4_K_M)."
        )

    # Extract clean message if JSON or short error
    clean = re.sub(r'\(Request ID:[^)]+\)', '', err_str).strip()
    if len(clean) > 160:
        clean = clean[:160] + "..."
    return f"Inference failed: {clean}"
