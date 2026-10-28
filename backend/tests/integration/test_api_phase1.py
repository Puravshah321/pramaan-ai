"""Integration tests — API smoke tests (Phase 1).

Uses an in-memory SQLite DB so tests are isolated.
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.session import init_db
from app.main import app


@pytest.fixture(autouse=True)
async def setup_test_db():
    await init_db()
    yield


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


class TestHealth:
    async def test_healthz(self, client: AsyncClient) -> None:
        resp = await client.get("/healthz")
        assert resp.status_code == 200
        assert resp.text == "ok"

    async def test_readyz(self, client: AsyncClient) -> None:
        resp = await client.get("/readyz")
        assert resp.status_code == 200

    async def test_system_info(self, client: AsyncClient) -> None:
        resp = await client.get("/api/system/info")
        assert resp.status_code == 200
        data = resp.json()
        assert "ram_total_gb" in data
        assert "demo_mode" in data


class TestRegistry:
    async def test_registry_returns_data(self, client: AsyncClient) -> None:
        resp = await client.get("/api/registry")
        assert resp.status_code == 200
        data = resp.json()
        assert "embedding_models" in data
        assert len(data["embedding_models"]) > 0

    async def test_embedding_models_have_required_fields(self, client: AsyncClient) -> None:
        resp = await client.get("/api/registry/embedding-models")
        assert resp.status_code == 200
        models = resp.json()
        for m in models:
            assert "id" in m
            assert "license" in m
            assert "size_mb" in m


class TestCorpora:
    async def test_create_and_list(self, client: AsyncClient) -> None:
        resp = await client.post("/api/corpora", json={"name": "Test Corpus"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Corpus"
        corpus_id = data["id"]

        resp = await client.get("/api/corpora")
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()]
        assert corpus_id in ids

    async def test_get_corpus(self, client: AsyncClient) -> None:
        resp = await client.post("/api/corpora", json={"name": "GetMe"})
        cid = resp.json()["id"]
        resp2 = await client.get(f"/api/corpora/{cid}")
        assert resp2.status_code == 200
        assert resp2.json()["id"] == cid

    async def test_404_on_missing_corpus(self, client: AsyncClient) -> None:
        resp = await client.get("/api/corpora/nonexistent-id")
        assert resp.status_code == 404


class TestExperiments:
    async def test_create_experiment(self, client: AsyncClient) -> None:
        resp = await client.post("/api/experiments", json={
            "name": "Test Exp",
            "design_strategy": "ofat",
            "hardware_profile": "CPU-8GB",
        })
        assert resp.status_code == 201
        assert resp.json()["status"] == "draft"

    async def test_plan_experiment(self, client: AsyncClient) -> None:
        resp = await client.post("/api/experiments", json={"name": "Plan Me"})
        exp_id = resp.json()["id"]
        resp2 = await client.post(f"/api/experiments/{exp_id}/plan")
        assert resp2.status_code == 200
        plan = resp2.json()
        assert "n_configs" in plan

    async def test_experiment_lifecycle(self, client: AsyncClient) -> None:
        resp = await client.post("/api/experiments", json={"name": "Lifecycle Test"})
        exp_id = resp.json()["id"]
        assert (await client.post(f"/api/experiments/{exp_id}/start")).status_code == 200
        assert (await client.post(f"/api/experiments/{exp_id}/pause")).status_code == 200
        assert (await client.post(f"/api/experiments/{exp_id}/resume")).status_code == 200
        assert (await client.post(f"/api/experiments/{exp_id}/cancel")).status_code == 200
