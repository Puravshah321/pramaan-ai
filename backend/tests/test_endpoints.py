"""Unit and integration tests for all API endpoints."""
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_health_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/healthz")
        assert res.status_code == 200
        assert res.json().get("status") == "ok"

        res = await client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert "huggingface" in data
        assert "local_runner" in data

        # POST /api/health/recheck
        recheck_res = await client.post("/api/health/recheck")
        assert recheck_res.status_code == 200
        recheck_data = recheck_res.json()
        assert "huggingface" in recheck_data
        assert "diagnosis" in recheck_data


@pytest.mark.anyio
async def test_hardware_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/hardware")
        assert res.status_code == 200
        data = res.json()
        assert "detected" in data
        assert "profiles" in data
        assert len(data["profiles"]) >= 20
        assert "benchmark_hardware" in data
        # Check that RTX 3060 profile is present
        profile_ids = [p["id"] for p in data["profiles"]]
        assert "rtx_3060_12gb" in profile_ids


@pytest.mark.anyio
async def test_stats_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/stats")
        assert res.status_code == 200
        data = res.json()
        assert "documents_indexed" in data
        assert "questions_answered" in data
        assert "setups_measured" in data
        assert "api_calls_made" in data


@pytest.mark.anyio
async def test_setup_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # GET setup
        res = await client.get("/api/setup")
        assert res.status_code == 200
        data = res.json()
        assert "embedding_model" in data
        assert "language_model" in data

        # PUT setup
        put_res = await client.put(
            "/api/setup",
            json={"embedding_model": "BAAI/bge-small-en-v1.5", "language_model": "Qwen/Qwen2.5-0.5B-Instruct"}
        )
        assert put_res.status_code == 200
        assert put_res.json().get("embedding_model") == "BAAI/bge-small-en-v1.5"


@pytest.mark.anyio
async def test_showcase_latest():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/showcase/latest")
        assert res.status_code == 200
        data = res.json()
        assert "has_data" in data
        if data["has_data"]:
            assert "answer" in data
            assert "setup_used" in data
            # Ensure no extractive heuristic leaks
            assert "100% words matched" not in data.get("reasons", [])


@pytest.mark.anyio
async def test_recommend_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/recommend?memory_gb=4.0&latency_s=5.0&goal=best_quality")
        assert res.status_code == 200
        data = res.json()
        assert "nothing_fits" in data or "chosen" in data
        assert "insufficient_setups" in data
