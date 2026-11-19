"""Hardware profiles and machine detection API."""
from __future__ import annotations

import json
import logging
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Any

import psutil
from fastapi import APIRouter

router = APIRouter(prefix="/api/hardware", tags=["hardware"])
logger = logging.getLogger(__name__)

PROFILES_PATH = Path(__file__).resolve().parent.parent / "data" / "hardware_profiles.json"


def _detect_machine() -> dict[str, Any]:
    """Detect current system's GPU or CPU RAM accurately."""
    system_ram_gb = round(psutil.virtual_memory().total / (1024**3), 1)

    # 1. Try detecting NVIDIA GPU via nvidia-smi
    nvidia_smi = shutil.which("nvidia-smi")
    if nvidia_smi:
        try:
            res = subprocess.run(
                [nvidia_smi, "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if res.returncode == 0 and res.stdout.strip():
                line = res.stdout.strip().split("\n")[0]
                parts = [p.strip() for p in line.split(",")]
                gpu_name = parts[0]
                total_mib = float(parts[1]) if len(parts) > 1 else 0.0
                gpu_gb = round(total_mib / 1024.0, 1) if total_mib else 6.0
                budget_gb = round(gpu_gb * 0.82, 1)

                return {
                    "id": "detected_machine",
                    "name": f"{gpu_name} ({gpu_gb:.0f}GB VRAM)",
                    "chip": gpu_name,
                    "category": "NVIDIA Consumer",
                    "total_gb": gpu_gb,
                    "budget_gb": budget_gb,
                    "type": "VRAM (GDDR6)",
                    "system_ram_gb": system_ram_gb,
                    "is_detected": True,
                }
        except Exception as e:
            logger.debug(f"nvidia-smi check failed: {e}")

    # 2. Check for Apple Silicon
    if platform.system() == "Darwin" and platform.machine() == "arm64":
        # Apple unified memory
        budget_gb = round(system_ram_gb * (0.75 if system_ram_gb >= 24 else 0.66), 1)
        chip_name = "Apple Silicon"
        try:
            res = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True, timeout=2)
            if res.returncode == 0 and res.stdout.strip():
                chip_name = res.stdout.strip()
        except Exception:
            pass

        return {
            "id": "detected_machine",
            "name": f"{chip_name} ({system_ram_gb:.0f}GB Unified)",
            "chip": chip_name,
            "category": "Apple Silicon",
            "total_gb": system_ram_gb,
            "budget_gb": budget_gb,
            "type": "Unified Memory",
            "system_ram_gb": system_ram_gb,
            "is_detected": True,
        }

    # 3. CPU Host RAM fallback
    budget_gb = round(system_ram_gb * 0.55, 1)
    cpu_name = platform.processor() or "Host CPU"
    return {
        "id": "detected_machine",
        "name": f"Host Machine ({system_ram_gb:.0f}GB RAM)",
        "chip": cpu_name,
        "category": "CPU / System RAM",
        "total_gb": system_ram_gb,
        "budget_gb": budget_gb,
        "type": "System RAM",
        "system_ram_gb": system_ram_gb,
        "is_detected": True,
    }


@router.get("")
async def get_hardware() -> dict[str, Any]:
    """Returns detected hardware, available hardware presets, and latency disclaimer info."""
    profiles = []
    if PROFILES_PATH.exists():
        try:
            with open(PROFILES_PATH, encoding="utf-8") as f:
                profiles = json.load(f)
        except Exception as e:
            logger.error(f"Failed to read hardware profiles: {e}")

    detected = _detect_machine()

    return {
        "detected": detected,
        "benchmark_hardware": {
            "name": f"{detected['chip']} ({detected['type']})",
            "disclaimer": "Latency measured on benchmark test runner; expect different numbers on target hardware.",
        },
        "profiles": profiles,
    }
