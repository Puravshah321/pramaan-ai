"""Tests for 100% free local-only execution, network guard, memory consistency, and offline mode."""
import os
import socket
from pathlib import Path

import pytest

from app.runners.local import (
    estimate_model_memory,
    list_local_models,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_APP_DIR = PROJECT_ROOT / "backend" / "app"


# ==============================================================================
# 1. Network Guard Tests
# ==============================================================================

def test_network_guard_blocks_hosted_inference():
    """Verify that network connections to forbidden hosted inference domains are blocked."""
    forbidden_hosts = [
        "api-inference.huggingface.co",
        "router.huggingface.co",
    ]

    for host in forbidden_hosts:
        with pytest.raises(RuntimeError, match="Network Guard"):
            socket.getaddrinfo(host, 443)


# ==============================================================================
# 2. Static AST / Grep Tests (No Forbidden Inference Terms)
# ==============================================================================

def test_static_check_zero_hosted_inference_code():
    """Scan all Python files in backend/app to ensure InferenceClient and router are deleted."""
    forbidden_terms = [
        "InferenceClient",
        "router.huggingface.co",
        "api-inference.huggingface.co",
    ]

    violations = []

    for py_file in BACKEND_APP_DIR.rglob("*.py"):
        code = py_file.read_text(encoding="utf-8")
        for term in forbidden_terms:
            if term in code:
                violations.append(f"{py_file.name}: contains forbidden hosted inference term '{term}'")

    assert not violations, "Forbidden hosted inference code detected in backend/app:\n" + "\n".join(violations)


# ==============================================================================
# 3. Memory Estimation Single Source of Truth (Resolves S4)
# ==============================================================================

def test_memory_estimation_single_source_of_truth():
    """Verify that estimate_model_memory produces consistent mathematical estimates for all sizes."""
    # 0.5B model in Q4_K_M
    m_05b_q4 = estimate_model_memory("Qwen/Qwen2.5-0.5B-Instruct", "Q4_K_M")
    assert 0.4 <= m_05b_q4["estimated_memory_gb"] <= 0.8
    assert m_05b_q4["fits_under_4gb"] is True
    assert m_05b_q4["source"] == "unified_local_estimator"

    # 1.5B model in Q4_K_M
    m_15b_q4 = estimate_model_memory("Qwen/Qwen2.5-1.5B-Instruct", "Q4_K_M")
    assert 1.0 <= m_15b_q4["estimated_memory_gb"] <= 1.6
    assert m_15b_q4["fits_under_4gb"] is True

    # 1.5B model in Q8_0 must be larger than Q4_K_M
    m_15b_q8 = estimate_model_memory("Qwen/Qwen2.5-1.5B-Instruct", "Q8_0")
    assert m_15b_q8["estimated_memory_gb"] > m_15b_q4["estimated_memory_gb"]

    # SmolLM2 135M
    m_smol = estimate_model_memory("HuggingFaceTB/SmolLM2-135M-Instruct", "Q4_K_M")
    assert m_smol["estimated_memory_gb"] < 0.5


# ==============================================================================
# 4. Local Model Storage & Status
# ==============================================================================

def test_local_model_manager_status():
    """Verify list_local_models computes status from real disk files in data/models."""
    models = list_local_models()
    assert len(models) >= 4

    ready_models = [m for m in models if m["status"] == "ready"]
    assert len(ready_models) >= 1  # At least Qwen2.5-0.5B or BGE-Small downloaded

    for m in models:
        assert "filename" in m
        assert "free_disk_gb" in m
        assert m["free_disk_gb"] > 0.0
        assert "estimated_memory_gb" in m


# ==============================================================================
# 5. Offline Mode Configuration
# ==============================================================================

def test_offline_mode_env_flag(monkeypatch):
    """Verify that OFFLINE_MODE sets HF_HUB_OFFLINE=1."""
    from app.config import Settings
    monkeypatch.setenv("OFFLINE_MODE", "true")
    cfg = Settings()
    cfg.ensure_dirs()
    assert os.environ.get("HF_HUB_OFFLINE") == "1"
