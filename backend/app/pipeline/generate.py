"""Generation stage: formats retrieved context and prompts the LLM."""
from __future__ import annotations

from typing import Any
from app.hf.inference import generate_text


async def generate_answer(
    language_model: str,
    query: str,
    chunks: list[dict[str, Any]],
    max_tokens: int = 64,
) -> dict[str, Any]:
    """Generates an answer using context from retrieved chunks."""
    context_str = "\n\n".join([f"[{i+1}] {c.get('text', '')}" for i, c in enumerate(chunks)])

    system_prompt = (
        "You are a factual assistant. Answer the user question based strictly on the provided context. "
        "If the answer cannot be found in the context, say 'I don't know'."
    )
    user_prompt = f"Context:\n{context_str}\n\nQuestion: {query}\n\nAnswer concisely:"

    return await generate_text(
        model_id=language_model,
        prompt=user_prompt,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
    )
