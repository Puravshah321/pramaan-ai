"""Free local-only inference module powered by llama-cpp-python.
Hosted inference APIs have been completely removed.
"""
from __future__ import annotations

import time
from typing import Any

from app.runners.local import run_local_embedding, run_local_inference


async def generate_text(
    model_id: str,
    prompt: str,
    system_prompt: str | None = None,
    max_tokens: int = 64,
    temperature: float = 0.0,
    quantization: str = "q4_k_m",
    max_retries: int = 1,
) -> dict[str, Any]:
    """Execute local text generation via llama-cpp-python.
    Never calls external hosted endpoints.
    """
    # Separate explicit baseline if chosen by user
    if model_id and model_id.lower() in ["extractive-baseline", "extractive_baseline"]:
        t0 = time.perf_counter()
        context_body = prompt
        if "Context:" in prompt and "Question:" in prompt:
            parts = prompt.split("Question:")
            context_body = parts[0].replace("Context:", "").strip()
            q_part = parts[1].replace("Answer concisely:", "").strip()
        else:
            q_part = prompt

        q_words = [w.lower() for w in q_part.split() if len(w) > 3]
        best_sentence = "I don't know."
        sentences = [s.strip() for s in context_body.split(".") if len(s.strip()) > 5]
        max_overlap = 0

        for s in sentences:
            overlap = sum(1 for w in q_words if w in s.lower())
            if overlap > max_overlap:
                max_overlap = overlap
                best_sentence = s + "."

        elapsed = (time.perf_counter() - t0) * 1000
        return {
            "text": best_sentence,
            "latency_ms": round(elapsed, 2),
            "tokens": len(best_sentence.split()),
            "tokens_per_second": round(len(best_sentence.split()) / max(elapsed / 1000.0, 0.001), 1),
            "error": None,
            "source": "extractive_baseline",
        }

    # Execute via local runner
    return await run_local_inference(
        model_id=model_id,
        prompt=prompt,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        quantization=quantization,
    )


async def compute_embeddings(
    model_id: str,
    texts: list[str],
    max_retries: int = 1,
) -> dict[str, Any]:
    """Compute dense embeddings locally via llama-cpp-python GGUF embedding model.
    100% Free, local-only, zero external network dependency.
    """
    if not texts:
        return {"embeddings": [], "latency_ms": 0.0, "error": None, "source": "local"}

    return await run_local_embedding(model_id=model_id, texts=texts)
