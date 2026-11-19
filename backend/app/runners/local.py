"""Local runner with real llama-cpp-python GGUF inference, local embeddings, memory tracking, and quantization."""
from __future__ import annotations

import asyncio
import os
import shutil
import time
from pathlib import Path
from typing import Any

import numpy as np
import psutil

from app.config import settings
from app.hf.errors import translate_hf_error
from app.runners.hardware import detect_hardware

# Cached Llama model instances: (model_id, quant, is_embedding) -> Llama
_LOCAL_MODEL_CACHE: dict[tuple[str, str, bool], Any] = {}

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
MODELS_DIR = PROJECT_ROOT / "data" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


# ==============================================================================
# Single Source of Truth for Model Memory Estimation (resolves S4)
# ==============================================================================

def get_known_params_b(model_id: str) -> float:
    """Returns parameter count in billions for known popular local models."""
    m = model_id.lower()
    if "0.5b" in m:
        return 0.49
    if "1.5b" in m:
        return 1.54
    if "135m" in m:
        return 0.135
    if "360m" in m:
        return 0.36
    if "1b" in m:
        return 1.23
    if "2b" in m:
        return 2.1
    if "3b" in m:
        return 3.2
    if "7b" in m or "8b" in m:
        return 7.2
    if "bge-small" in m or "minilm" in m:
        return 0.033
    if "bge-base" in m:
        return 0.11
    if "bge-large" in m:
        return 0.33
    return 1.0


def estimate_model_memory(
    model_id: str,
    quantization: str = "q4_k_m",
    params_b: float | None = None,
) -> dict[str, Any]:
    """Single backend source of truth function for estimating model memory before load.
    Resolves Bug S4: All cards and comparison tables derive their values from this function.
    """
    if params_b is None or params_b <= 0:
        params_b = get_known_params_b(model_id)

    q = (quantization or "none").lower()
    if "4" in q:
        bits_per_param = 4.5
        overhead_pct = 0.20
        buffer_gb = 0.25
        quant_label = "Q4_K_M"
    elif "8" in q:
        bits_per_param = 8.5
        overhead_pct = 0.20
        buffer_gb = 0.25
        quant_label = "Q8_0"
    else:  # fp16 / none
        bits_per_param = 16.0
        overhead_pct = 0.20
        buffer_gb = 0.35
        quant_label = "fp16"

    # Bytes = (params * bits / 8) * (1 + overhead) + buffer
    weights_gb = (params_b * 1e9 * (bits_per_param / 8.0)) / (1024 ** 3)
    total_est_gb = round((weights_gb * (1 + overhead_pct)) + buffer_gb, 2)

    return {
        "model_id": model_id,
        "quantization": quant_label,
        "params_b": round(params_b, 3),
        "estimated_memory_gb": total_est_gb,
        "estimated_memory_mb": round(total_est_gb * 1024, 1),
        "fits_under_4gb": total_est_gb <= 4.0,
        "fits_under_8gb": total_est_gb <= 8.0,
        "source": "unified_local_estimator",
    }


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


# ==============================================================================
# Model File Resolution & Local Management
# ==============================================================================

KNOWN_MODEL_REGISTRY: dict[str, dict[str, Any]] = {
    # Language Models
    "qwen/qwen2.5-0.5b-instruct": {
        "repo_id": "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
        "files": {
            "q4_k_m": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
            "q8_0": "qwen2.5-0.5b-instruct-q8_0.gguf",
        },
        "default_file": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "is_embedding": False,
        "params_b": 0.49,
    },
    "qwen/qwen2.5-1.5b-instruct": {
        "repo_id": "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
        "files": {
            "q4_k_m": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
            "q8_0": "qwen2.5-1.5b-instruct-q8_0.gguf",
        },
        "default_file": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "is_embedding": False,
        "params_b": 1.54,
    },
    "huggingfacetb/smollm2-135m-instruct": {
        "repo_id": "HuggingFaceTB/SmolLM2-135M-Instruct-GGUF",
        "files": {"q4_k_m": "smollm2-135m-instruct-q4_k_m.gguf"},
        "default_file": "smollm2-135m-instruct-q4_k_m.gguf",
        "is_embedding": False,
        "params_b": 0.135,
    },
    "huggingfacetb/smollm2-360m-instruct": {
        "repo_id": "HuggingFaceTB/SmolLM2-360M-Instruct-GGUF",
        "files": {"q4_k_m": "smollm2-360m-instruct-q4_k_m.gguf"},
        "default_file": "smollm2-360m-instruct-q4_k_m.gguf",
        "is_embedding": False,
        "params_b": 0.36,
    },
    "meta-llama/llama-3.2-1b-instruct": {
        "repo_id": "bartowski/Llama-3.2-1B-Instruct-GGUF",
        "files": {"q4_k_m": "Llama-3.2-1B-Instruct-Q4_K_M.gguf"},
        "default_file": "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        "is_embedding": False,
        "params_b": 1.23,
    },
    # Embedding Models
    "baai/bge-small-en-v1.5": {
        "repo_id": "CompendiumLabs/bge-small-en-v1.5-gguf",
        "files": {"q4_k_m": "bge-small-en-v1.5-q4_k_m.gguf"},
        "default_file": "bge-small-en-v1.5-q4_k_m.gguf",
        "is_embedding": True,
        "params_b": 0.033,
    },
    "sentence-transformers/all-minilm-l6-v2": {
        "repo_id": "second-state/All-MiniLM-L6-v2-Embedding-GGUF",
        "files": {"q4_k_m": "all-MiniLM-L6-v2-Q4_K_M.gguf"},
        "default_file": "bge-small-en-v1.5-q4_k_m.gguf",  # Fallback to local bge-small
        "is_embedding": True,
        "params_b": 0.033,
    },
}


def list_local_models() -> list[dict[str, Any]]:
    """Inspects data/models directory and computes disk status for all known local models."""
    results = []
    disk_usage = shutil.disk_usage(str(MODELS_DIR))
    free_gb = round(disk_usage.free / (1024 ** 3), 2)

    for model_key, meta in KNOWN_MODEL_REGISTRY.items():
        for quant, filename in meta["files"].items():
            path = MODELS_DIR / filename
            is_downloaded = path.exists()
            size_mb = round(path.stat().st_size / (1024 * 1024), 1) if is_downloaded else 0.0

            status = "ready" if is_downloaded else "not_downloaded"
            mem_info = estimate_model_memory(model_key, quant, meta["params_b"])

            results.append({
                "model_id": model_key,
                "quantization": quant,
                "filename": filename,
                "repo_id": meta["repo_id"],
                "is_embedding": meta["is_embedding"],
                "status": status,
                "size_mb": size_mb,
                "free_disk_gb": free_gb,
                "estimated_memory_gb": mem_info["estimated_memory_gb"],
            })
    return results


def resolve_or_download_gguf(
    model_id: str,
    quantization: str = "q4_k_m",
    is_embedding: bool = False,
) -> str:
    """Finds or downloads the requested GGUF model file. Respects OFFLINE_MODE."""
    m_key = model_id.lower().strip()
    q_tag = (quantization or "q4_k_m").lower()
    quant_key = "q8_0" if "8" in q_tag else "q4_k_m"

    # Match in registry
    matched_meta = None
    for k, meta in KNOWN_MODEL_REGISTRY.items():
        if k in m_key or m_key in k:
            matched_meta = meta
            break

    if is_embedding or (matched_meta and matched_meta.get("is_embedding")):
        # Check for bge-small or minilm locally
        bge_path = MODELS_DIR / "bge-small-en-v1.5-q4_k_m.gguf"
        if bge_path.exists():
            return str(bge_path)
        filename = "bge-small-en-v1.5-q4_k_m.gguf"
        repo_id = "CompendiumLabs/bge-small-en-v1.5-gguf"
    elif matched_meta:
        repo_id = matched_meta["repo_id"]
        filename = matched_meta["files"].get(quant_key, matched_meta["default_file"])
    else:
        # Default to Qwen2.5-0.5B
        repo_id = "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
        filename = f"qwen2.5-0.5b-instruct-{quant_key}.gguf"

    direct_path = MODELS_DIR / filename
    if direct_path.exists():
        return str(direct_path)

    # Check offline mode
    if settings.offline_mode or os.environ.get("OFFLINE_MODE", "").lower() in ["1", "true", "yes"]:
        # Find any existing GGUF in models directory as fallback
        existing_ggufs = list(MODELS_DIR.glob("*.gguf"))
        if existing_ggufs:
            return str(existing_ggufs[0])
        raise RuntimeError(f"Offline mode active and model file {filename} is not downloaded.")

    # Download from Hub
    from huggingface_hub import hf_hub_download
    token = settings.hf_token.strip() if settings.hf_token else None
    downloaded_path = hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        local_dir=str(MODELS_DIR),
        token=token,
    )
    return downloaded_path


# ==============================================================================
# Real Local LLM Inference
# ==============================================================================

_INFERENCE_LOCKS: dict[asyncio.AbstractEventLoop, asyncio.Lock] = {}


def get_inference_lock() -> asyncio.Lock:
    """Returns an asyncio.Lock bound to the current running event loop.
    Guarantees thread-safe access to underlying C++ llama-cpp instances.
    """
    loop = asyncio.get_running_loop()
    if loop not in _INFERENCE_LOCKS:
        _INFERENCE_LOCKS[loop] = asyncio.Lock()
    return _INFERENCE_LOCKS[loop]


def get_local_llm(model_id: str, quantization: str = "q4_k_m"):
    """Retrieves or loads a local Llama instance using llama-cpp-python."""
    key = (model_id, quantization, False)
    if key in _LOCAL_MODEL_CACHE:
        return _LOCAL_MODEL_CACHE[key]

    from llama_cpp import Llama

    model_path = resolve_or_download_gguf(model_id, quantization, is_embedding=False)
    hw = detect_hardware()

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
    system_prompt: str | None = None,
    max_tokens: int = 64,
    temperature: float = 0.0,
    quantization: str = "q4_k_m",
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
        def _sync_chat() -> dict[str, Any]:
            return llm.create_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature if temperature > 0 else 0.0,
            )

        async with get_inference_lock():
            resp = await asyncio.to_thread(_sync_chat)
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


# ==============================================================================
# Real Local Embedding Inference (100% Free & Offline)
# ==============================================================================

def get_local_embedding_model(model_id: str = "BAAI/bge-small-en-v1.5"):
    """Retrieves or loads a local GGUF embedding model instance using llama-cpp-python."""
    key = (model_id, "q4_k_m", True)
    if key in _LOCAL_MODEL_CACHE:
        return _LOCAL_MODEL_CACHE[key]

    from llama_cpp import Llama

    model_path = resolve_or_download_gguf(model_id, quantization="q4_k_m", is_embedding=True)
    hw = detect_hardware()

    n_gpu_layers = 0
    if hw["device"] in ["cuda", "mps"]:
        n_gpu_layers = 32

    embedder = Llama(
        model_path=model_path,
        embedding=True,
        n_ctx=512,
        n_gpu_layers=n_gpu_layers,
        verbose=False,
    )
    _LOCAL_MODEL_CACHE[key] = embedder
    return embedder


async def run_local_embedding(
    model_id: str,
    texts: list[str],
) -> dict[str, Any]:
    """Generates dense embeddings locally via llama-cpp-python GGUF embedding model.
    Runs in background threads with batching so it never blocks the asyncio event loop.
    """
    if not texts:
        return {"embeddings": [], "latency_ms": 0.0, "error": None, "source": "local"}

    t0 = time.perf_counter()
    try:
        embedder = get_local_embedding_model(model_id)

        # Process in batches of 16 to keep thread responsiveness and allow async cooperative scheduling
        batch_size = 16
        vectors: list[list[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            async with get_inference_lock():
                raw_embs = await asyncio.to_thread(embedder.create_embedding, input=batch)
            for item in raw_embs["data"]:
                vec = np.array(item["embedding"], dtype=np.float32)
                norm = np.linalg.norm(vec)
                if norm > 1e-6:
                    vec = vec / norm
                vectors.append(vec.tolist())

            # Yield control back to event loop between batches so HTTP requests proceed
            if i + batch_size < len(texts):
                await asyncio.sleep(0.002)

        t1 = time.perf_counter()
        elapsed_ms = (t1 - t0) * 1000

        return {
            "embeddings": vectors,
            "latency_ms": round(elapsed_ms, 2),
            "error": None,
            "source": "local",
        }
    except Exception as e:
        t1 = time.perf_counter()
        return {
            "embeddings": [],
            "latency_ms": round((t1 - t0) * 1000, 2),
            "error": translate_hf_error(e),
            "source": "local",
        }
