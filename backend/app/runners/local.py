"""Local runner with real llama-cpp-python GGUF inference, memory tracking, and quantization."""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Optional
import psutil
from huggingface_hub import hf_hub_download

from app.hf.errors import translate_hf_error
from app.runners.hardware import detect_hardware

# Cached Llama model instances: (model_id, quant) -> Llama
_LOCAL_MODEL_CACHE: dict[tuple[str, str], Any] = {}

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
MODELS_DIR = PROJECT_ROOT / "data" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def get_current_memory_mb() -> dict[str, float]:
    """Returns current process RAM (RSS) in MB and GPU VRAM if available."""
    proc = psutil.Process(os.getpid())
    rss_mb = round(proc.memory_info().rss / (1024 * 1024), 2)
    hw = detect_hardware()
    vram_mb = hw["gpu"]["vram_used_mb"] if hw.get("gpu") else 0.0
    return {"rss_mb": rss_mb, "vram_mb": vram_mb}


def measure_process_memory_mb() -> float:
    """Returns current process RAM (RSS) in MB."""
    proc = psutil.Process(os.getpid())
    return round(proc.memory_info().rss / (1024 * 1024), 2)


def resolve_or_download_gguf(model_id: str, quantization: str = "none") -> str:
    """Finds or downloads the requested GGUF model file."""
    # Normalize quantization tag
    q_tag = (quantization or "none").lower()
    if q_tag in ["none", "fp16", "f16"]:
        quant_str = "q4_k_m"
    elif "q8" in q_tag:
        quant_str = "q8_0"
    elif "q4" in q_tag:
        quant_str = "q4_k_m"
    else:
        quant_str = q_tag

    # Determine GGUF repo and filename mapping
    if "qwen2.5-0.5b" in model_id.lower():
        repo_id = "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
        filename = f"qwen2.5-0.5b-instruct-{quant_str}.gguf"
    elif "qwen2.5-1.5b" in model_id.lower():
        repo_id = "Qwen/Qwen2.5-1.5B-Instruct-GGUF"
        filename = f"qwen2.5-1.5b-instruct-{quant_str}.gguf"
    elif "smollm2-135m" in model_id.lower():
        repo_id = "HuggingFaceTB/SmolLM2-135M-Instruct-GGUF"
        filename = f"smollm2-135m-instruct-{quant_str}.gguf"
    elif "smollm2-360m" in model_id.lower():
        repo_id = "HuggingFaceTB/SmolLM2-360M-Instruct-GGUF"
        filename = f"smollm2-360m-instruct-{quant_str}.gguf"
    elif "llama-3.2-1b" in model_id.lower():
        repo_id = "bartowski/Llama-3.2-1B-Instruct-GGUF"
        filename = f"Llama-3.2-1B-Instruct-{quant_str.upper()}.gguf"
    else:
        # Fallback to Qwen 0.5B
        repo_id = "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
        filename = f"qwen2.5-0.5b-instruct-{quant_str}.gguf"

    # Check if already present in data/models/
    direct_path = MODELS_DIR / filename
    if direct_path.exists():
        return str(direct_path)

    # Download from Hub
    downloaded_path = hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        local_dir=str(MODELS_DIR),
    )
    return downloaded_path


def get_local_llm(model_id: str, quantization: str = "none"):
    """Retrieves or loads a local Llama instance using llama-cpp-python."""
    key = (model_id, quantization)
    if key in _LOCAL_MODEL_CACHE:
        return _LOCAL_MODEL_CACHE[key]

    from llama_cpp import Llama

    model_path = resolve_or_download_gguf(model_id, quantization)
    hw = detect_hardware()

    # If GPU available, offload layers
    n_gpu_layers = 0
    if hw["device"] in ["cuda", "mps"]:
        n_gpu_layers = 32

    llm = Llama(
        model_path=model_path,
        n_ctx=2048,
        n_gpu_layers=n_gpu_layers,
        verbose=False,
    )
    _LOCAL_MODEL_CACHE[key] = llm
    return llm


async def run_local_inference(
    model_id: str,
    prompt: str,
    system_prompt: Optional[str] = None,
    max_tokens: int = 64,
    temperature: float = 0.0,
    quantization: str = "none",
) -> dict[str, Any]:
    """Executes a real local chat completion using llama-cpp-python with memory tracking."""
    mem_before = get_current_memory_mb()
    t0 = time.perf_counter()

    try:
        llm = get_local_llm(model_id, quantization)
    except Exception as e:
        return {
            "text": "",
            "latency_ms": 0.0,
            "tokens": 0,
            "tokens_per_second": 0.0,
            "error": translate_hf_error(e),
            "memory_mb": mem_before["rss_mb"],
            "source": "local",
        }

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        resp = llm.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature if temperature > 0 else 0.0,
        )
        t1 = time.perf_counter()
        elapsed_ms = (t1 - t0) * 1000

        content = resp["choices"][0]["message"]["content"] or ""
        tokens = resp.get("usage", {}).get("completion_tokens", len(content.split()))
        tokens_per_sec = round(tokens / max((t1 - t0), 0.001), 1)

        mem_after = get_current_memory_mb()
        peak_mem = max(mem_before["rss_mb"], mem_after["rss_mb"])

        return {
            "text": content.strip(),
            "latency_ms": round(elapsed_ms, 2),
            "tokens": tokens,
            "tokens_per_second": tokens_per_sec,
            "error": None,
            "memory_mb": peak_mem,
            "source": "local",
        }
    except Exception as e:
        t1 = time.perf_counter()
        return {
            "text": "",
            "latency_ms": round((t1 - t0) * 1000, 2),
            "tokens": 0,
            "tokens_per_second": 0.0,
            "error": translate_hf_error(e),
            "memory_mb": mem_before["rss_mb"],
            "source": "local",
        }
