"""Hosted API runner: executes benchmark via Hugging Face Inference APIs."""
from __future__ import annotations

import time
from typing import Any
import psutil

from app.eval.metrics import compute_exact_match, compute_f1, compute_recall_at_k
from app.hf.inference import generate_text
from app.pipeline.retrieve import retrieve_chunks
from app.pipeline.index import VectorIndex
from app.reliability.features import extract_features


async def run_single_question(
    index: VectorIndex,
    language_model: str,
    top_k: int,
    question: str,
    gold_answer: str,
) -> dict[str, Any]:
    """Runs a single question end-to-end through retrieval and generation."""
    t_start = time.perf_counter()

    # 1. Retrieval
    ret_res = await retrieve_chunks(index=index, query=question, top_k=top_k)
    chunks = ret_res.get("chunks", [])

    # 2. Generation
    context_str = "\n\n".join([f"[{i+1}] {c.get('text', '')}" for i, c in enumerate(chunks)])
    user_prompt = f"Context:\n{context_str}\n\nQuestion: {question}\n\nAnswer concisely:"
    system_prompt = (
        "You are a factual assistant. Answer the user question based strictly on the provided context. "
        "If the answer cannot be found in the context, say 'I don't know'."
    )

    t_gen_0 = time.perf_counter()
    gen_res = await generate_text(
        model_id=language_model,
        prompt=user_prompt,
        system_prompt=system_prompt,
        max_tokens=64,
        temperature=0.0,
    )
    t_gen_1 = time.perf_counter()
    gen_ms = (t_gen_1 - t_gen_0) * 1000

    total_ms = (time.perf_counter() - t_start) * 1000
    answer_text = gen_res.get("text", "")
    err = gen_res.get("error") or ret_res.get("error")

    # 3. Metrics: Failed API calls are counted and shown, never scored as wrong answers
    if answer_text:
        em = compute_exact_match(answer_text, gold_answer)
        f1 = compute_f1(answer_text, gold_answer)
        recall_k = compute_recall_at_k(chunks, gold_answer)
        correct = bool(em > 0 or f1 >= 0.5)
    else:
        em = None
        f1 = None
        recall_k = None
        correct = False

    tokens = gen_res.get("tokens", 0)

    # 4. Reliability features
    features = extract_features(answer=answer_text, chunks=chunks)

    timings = {
        "embed_ms": ret_res.get("embed_time_ms", 0.0),
        "search_ms": ret_res.get("search_time_ms", 0.0),
        "generation_ms": round(gen_ms, 2),
        "total_ms": round(total_ms, 2),
    }

    return {
        "answer": answer_text,
        "gold_answer": gold_answer,
        "correct": correct,
        "em": em,
        "f1": f1,
        "recall_at_k": recall_k,
        "timings": timings,
        "tokens": tokens,
        "error": err,
        "features": features,
        "retrieved_chunk_ids": [c.get("id") for c in chunks],
    }
