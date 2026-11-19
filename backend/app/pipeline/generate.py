"""Generation stage: formats retrieved context and prompts the LLM."""
from __future__ import annotations

from typing import Any

from app.hf.inference import generate_text
from app.runners.local import run_local_inference


async def generate_answer(
    language_model: str,
    query: str,
    chunks: list[dict[str, Any]],
    max_tokens: int = 64,
    runner_type: str = "auto",
    quantization: str = "none",
) -> dict[str, Any]:
    """Generates an answer using context from retrieved chunks via local GGUF runner or hosted API."""
    context_str = "\n\n".join([f"[{i+1}] {c.get('text', '')}" for i, c in enumerate(chunks)])

    system_prompt = (
        "You are a factual assistant. Answer the user question based strictly on the provided context. "
        "If the answer cannot be found in the context, say 'I don't know'."
    )
    user_prompt = f"Context:\n{context_str}\n\nQuestion: {query}\n\nAnswer concisely:"

    # If runner is explicitly local, or model is an edge/local model (e.g. sub-4B GGUF)
    use_local = (
        runner_type == "local"
        or "qwen2.5-0.5b" in language_model.lower()
        or "qwen2.5-1.5b" in language_model.lower()
        or "smollm" in language_model.lower()
    )

    if use_local:
        return await run_local_inference(
            model_id=language_model,
            prompt=user_prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=0.0,
            quantization=quantization,
        )

    return await generate_text(
        model_id=language_model,
        prompt=user_prompt,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
    )
