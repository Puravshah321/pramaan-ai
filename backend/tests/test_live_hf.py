"""Live Hugging Face integration tests (run when HF_TOKEN or router access is available)."""
import pytest

from app.config import settings
from app.hf.datasets import get_dataset_splits_and_rows
from app.hf.hub import get_model_details, search_models
from app.hf.inference import compute_embeddings, generate_text

has_token = bool(settings.hf_token and settings.hf_token.strip())


@pytest.mark.live
@pytest.mark.anyio
async def test_hub_model_search():
    res = await search_models(query="MiniLM", pipeline_tag="feature-extraction", limit=5)
    assert len(res) > 0
    assert any("MiniLM" in m["id"] for m in res)


@pytest.mark.live
@pytest.mark.anyio
async def test_hub_model_details():
    details = await get_model_details("sentence-transformers/all-MiniLM-L6-v2")
    assert details["id"] == "sentence-transformers/all-MiniLM-L6-v2"
    assert details["parameters"] is not None
    assert details["parameters"] > 10_000_000


@pytest.mark.live
@pytest.mark.anyio
async def test_datasets_server_rows():
    data = await get_dataset_splits_and_rows("rajpurkar/squad_v2", offset=0, length=3)
    assert "rows" in data
    assert len(data["rows"]) > 0


@pytest.mark.live
@pytest.mark.anyio
async def test_inference_embed_and_generate():
    if not has_token:
        pytest.skip("HF_TOKEN not set; skipping live authenticated inference test.")

    # Embedding call
    emb_res = await compute_embeddings(
        model_id="sentence-transformers/all-MiniLM-L6-v2",
        texts=["Retrieval-Augmented Generation test."]
    )
    assert "embeddings" in emb_res
    assert len(emb_res["embeddings"]) == 1

    # Text generation call
    gen_res = await generate_text(
        model_id="Qwen/Qwen2.5-0.5B-Instruct",
        prompt="Answer with one word: What is 2 + 2?",
        max_tokens=10,
    )
    assert "text" in gen_res
