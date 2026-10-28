"""System health, telemetry and metadata endpoints."""
from __future__ import annotations

import platform
import time

import psutil
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["system"])


@router.get("/healthz", response_class=PlainTextResponse)
async def healthz() -> str:
    """Kubernetes-style liveness probe."""
    return "ok"


@router.get("/readyz", response_class=PlainTextResponse)
async def readyz() -> str:
    """Readiness probe — checks DB is accessible."""
    # TODO Phase 2+: ping DB
    return "ok"


@router.get("/api/system/info")
async def system_info() -> dict:
    """Detected hardware and platform info."""
    settings = get_settings()
    cpu = psutil.cpu_count(logical=True)
    ram = psutil.virtual_memory()
    info: dict = {
        "platform": platform.system(),
        "python": platform.python_version(),
        "cpu_cores_logical": cpu,
        "ram_total_gb": round(ram.total / 1e9, 2),
        "ram_available_gb": round(ram.available / 1e9, 2),
        "demo_mode": settings.demo_mode,
        "app_version": settings.app_version,
    }
    # GPU detection (optional)
    try:
        import pynvml  # type: ignore[import-untyped]
        pynvml.nvmlInit()
        n = pynvml.nvmlDeviceGetCount()
        info["gpu_count"] = n
        info["gpus"] = []
        for i in range(n):
            h = pynvml.nvmlDeviceGetHandleByIndex(i)
            mem = pynvml.nvmlDeviceGetMemoryInfo(h)
            info["gpus"].append({
                "name": pynvml.nvmlDeviceGetName(h),
                "vram_total_gb": round(mem.total / 1e9, 2),
                "vram_free_gb": round(mem.free / 1e9, 2),
            })
        pynvml.nvmlShutdown()
    except Exception:
        info["gpu_count"] = 0
        info["gpus"] = []
    return info


@router.get("/api/system/telemetry")
async def telemetry_snapshot() -> dict:
    """Point-in-time resource snapshot (not SSE — see SSE endpoint for streaming)."""
    cpu_pct = psutil.cpu_percent(interval=0.1)
    ram = psutil.virtual_memory()
    result: dict = {
        "timestamp": time.time(),
        "cpu_percent": cpu_pct,
        "ram_used_gb": round(ram.used / 1e9, 2),
        "ram_total_gb": round(ram.total / 1e9, 2),
        "ram_percent": ram.percent,
        "vram_used_gb": None,
        "vram_total_gb": None,
    }
    try:
        import pynvml
        pynvml.nvmlInit()
        h = pynvml.nvmlDeviceGetHandleByIndex(0)
        mem = pynvml.nvmlDeviceGetMemoryInfo(h)
        result["vram_used_gb"] = round(mem.used / 1e9, 2)
        result["vram_total_gb"] = round(mem.total / 1e9, 2)
        pynvml.nvmlShutdown()
    except Exception:
        pass
    return result


@router.get("/api/hardware")
async def hardware_profiles() -> dict:
    """Return detected hardware + named profiles from config."""
    import yaml
    from app.core.config import get_settings

    settings = get_settings()
    profile_path = settings.configs_dir / "hardware_profiles.yaml"
    profiles: dict = {}
    if profile_path.exists():
        with profile_path.open() as f:
            profiles = yaml.safe_load(f) or {}

    # Live detection
    ram = psutil.virtual_memory()
    detected = {
        "ram_gb": round(ram.total / 1e9, 2),
        "vram_gb": 0.0,
        "gpu": False,
    }
    try:
        import pynvml
        pynvml.nvmlInit()
        h = pynvml.nvmlDeviceGetHandleByIndex(0)
        mem = pynvml.nvmlDeviceGetMemoryInfo(h)
        detected["vram_gb"] = round(mem.total / 1e9, 2)
        detected["gpu"] = True
        detected["gpu_name"] = pynvml.nvmlDeviceGetName(h)
        pynvml.nvmlShutdown()
    except Exception:
        pass

    return {
        "detected": detected,
        "profiles": profiles.get("profiles", {}),
        "default_profile": profiles.get("default_profile", "CPU-8GB"),
    }
