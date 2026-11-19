"""Hardware auto-detection and profile matching for local RAG benchmarking."""
from __future__ import annotations

import platform
from typing import Any

import psutil


def detect_hardware() -> dict[str, Any]:
    """Auto-detects available GPU (NVIDIA NVML, Apple Metal) or CPU and assigns a verified profile."""
    ram = psutil.virtual_memory()
    ram_total_mb = round(ram.total / (1024 * 1024), 1)
    ram_available_mb = round(ram.available / (1024 * 1024), 1)

    gpu_info = None
    vram_total_mb = None
    vram_used_mb = None

    # Check NVIDIA GPU via pynvml
    try:
        import pynvml
        pynvml.nvmlInit()
        count = pynvml.nvmlDeviceGetCount()
        if count > 0:
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            gpu_name = pynvml.nvmlDeviceGetName(handle)
            if isinstance(gpu_name, bytes):
                gpu_name = gpu_name.decode("utf-8")
            mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
            vram_total_mb = round(mem.total / (1024 * 1024), 1)
            vram_used_mb = round(mem.used / (1024 * 1024), 1)
            gpu_info = {
                "name": gpu_name,
                "count": count,
                "vram_total_mb": vram_total_mb,
                "vram_used_mb": vram_used_mb,
                "vram_free_mb": round((mem.total - mem.used) / (1024 * 1024), 1),
            }
    except Exception:
        pass

    # Apple Silicon Metal check
    is_apple_silicon = platform.system() == "Darwin" and platform.machine() == "arm64"

    # Profile determination
    if gpu_info:
        name_lower = gpu_info["name"].lower()
        if "1650" in name_lower or (vram_total_mb and vram_total_mb <= 4500):
            profile = "GTX 1650 (4GB)"
            max_recommended_params = 3.0
            max_recommended_quant = "Q4_K_M"
        elif "3060" in name_lower or "4050" in name_lower or "4060" in name_lower or (vram_total_mb and vram_total_mb <= 8500):
            profile = "RTX 3060/4050/4060 (6-8GB)"
            max_recommended_params = 7.0
            max_recommended_quant = "Q4_K_M"
        else:
            vram_gb = int(vram_total_mb / 1024) if vram_total_mb else 0
            profile = f"{gpu_info['name']} ({vram_gb}GB)"
            max_recommended_params = 14.0
            max_recommended_quant = "Q8_0"
        device = "cuda"
    elif is_apple_silicon:
        profile = "Apple Silicon (Unified Memory)"
        device = "mps"
        max_recommended_params = 7.0
        max_recommended_quant = "Q4_K_M"
    else:
        profile = "CPU Only"
        device = "cpu"
        max_recommended_params = 1.5
        max_recommended_quant = "Q4_K_M"

    return {
        "device": device,
        "profile": profile,
        "gpu": gpu_info,
        "ram_total_mb": ram_total_mb,
        "ram_available_mb": ram_available_mb,
        "max_recommended_params": max_recommended_params,
        "max_recommended_quant": max_recommended_quant,
    }
