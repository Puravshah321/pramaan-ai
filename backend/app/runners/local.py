"""Local runner with real memory tracking and quantization support."""
from __future__ import annotations

import os
import time
from typing import Any
import psutil

from app.runners.hosted import run_single_question
from app.pipeline.index import VectorIndex


def measure_process_memory_mb() -> float:
    """Measures current process resident set memory in MB."""
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    return round(mem_info.rss / (1024 * 1024), 2)


def get_vram_mb() -> float | None:
    """Measures GPU VRAM if pynvml is available and GPU detected."""
    try:
        import pynvml  # type: ignore[import-untyped]
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        return round(info.used / (1024 * 1024), 2)
    except Exception:
        return None
