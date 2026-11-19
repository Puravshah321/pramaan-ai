"""Try It interactive query and comparison endpoints."""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import AppSettings, DetectorModel, Document, ShowcaseItem
from app.pipeline.chunking import chunk_text
from app.pipeline.generate import generate_answer
from app.pipeline.index import VectorIndex
from app.pipeline.retrieve import retrieve_chunks
from app.reliability.features import extract_features
from app.reliability.score import score_answer_reliability

router = APIRouter(tags=["try_it"])


class AskRequest(BaseModel):
    question: str
    dataset_id: str | None = None
    embedding_model: str | None = "sentence-transformers/all-MiniLM-L6-v2"
    language_model: str | None = None
    chunk_size: int = 256
    top_k: int = 3


class CompareRequest(BaseModel):
    question: str
    dataset_id: str | None = None
    config_a: AskRequest
    config_b: AskRequest


@router.post("/api/ask")
async def ask_question(
    req: AskRequest,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Execute question through live retrieval + generation pipeline."""
    t_start = time.perf_counter()

    target_lm = req.language_model
    target_em = req.embedding_model or "sentence-transformers/all-MiniLM-L6-v2"
    if not target_lm:
        settings_res = await session.execute(select(AppSettings).where(AppSettings.key == "default"))
        app_settings = settings_res.scalar_one_or_none()
        target_lm = app_settings.language_model if app_settings else None

    if not target_lm:
        raise HTTPException(
            status_code=400,
            detail="No language model configured. Please choose a model in the Setup drawer or specify one in the request.",
        )

    # 1. Fetch corpus documents
    stmt = select(Document)
    if req.dataset_id:
        stmt = stmt.where(Document.dataset_id == req.dataset_id)
    doc_res = await session.execute(stmt)
    docs = doc_res.scalars().all()

    if not docs:
        # Default corpus text if empty
        default_text = (
            "Retrieval-Augmented Generation (RAG) is a technique that combines an external knowledge base "
            "with a large language model. Pramaan AI measures trade-offs between chunk size, retrieval Top-K, "
            "and model quantizations to achieve Pareto-optimal performance under resource limits. "
            "Larger chunks increase context but reduce retrieval precision. Top-K represents the number of most "
            "similar chunks retrieved from the index. Exact Match measures exact string equality between prediction "
            "and ground truth. Quantization compresses neural weights into 8-bit or 4-bit integers to fit edge hardware. "
            "FAISS provides fast vector similarity search and indexing for large corpora."
        )
        docs = [Document(id="doc_default", dataset_id="default", title="Default Guide", content=default_text)]

    # 2. Build index
    v_index = VectorIndex(
        corpus_id="runtime",
        embedding_model=target_em,
        chunk_size=req.chunk_size,
    )
    all_chunks = []
    for d in docs:
        c_list = chunk_text(d.content, chunk_size=req.chunk_size, overlap=32, doc_id=d.id)
        for c in c_list:
            c["source_title"] = d.title
        all_chunks.extend(c_list)

    if all_chunks:
        from app.pipeline.embed import embed_texts
        chunk_texts = [c["text"] for c in all_chunks]
        emb_res = await embed_texts(model_id=target_em, texts=chunk_texts)
        if emb_res.get("embeddings"):
            v_index.add(all_chunks, emb_res["embeddings"])

    # 3. Retrieve
    ret_res = await retrieve_chunks(index=v_index, query=req.question, top_k=req.top_k)
    retrieved = ret_res.get("chunks", [])

    # 4. Generate
    t_gen_0 = time.perf_counter()
    gen_res = await generate_answer(
        language_model=target_lm,
        query=req.question,
        chunks=retrieved,
    )
    t_gen_1 = time.perf_counter()
    gen_ms = round((t_gen_1 - t_gen_0) * 1000, 2)
    tot_ms = round((time.perf_counter() - t_start) * 1000, 2)

    answer_text = gen_res.get("text", "")
    tokens = gen_res.get("tokens", len(answer_text.split()))
    tps = round(tokens / max(0.001, (gen_ms / 1000.0)), 1)

    # 5. Extract features & score reliability
    features = extract_features(answer=answer_text, chunks=retrieved)

    # Check if a trained detector exists in DB
    dm_res = await session.execute(
        select(DetectorModel).order_by(desc(DetectorModel.trained_at)).limit(1)
    )
    dm = dm_res.scalar_one_or_none()
    weights = dm.weights_json if dm else None

    reliability = score_answer_reliability(features=features, model_weights=weights)

    # Save to showcase if valid answer and chunk
    if answer_text and retrieved:
        import uuid
        top_chunk = retrieved[0]
        excerpt_text = top_chunk.get("text", "")
        sentences = [s.strip() for s in excerpt_text.split(".") if s.strip()]
        span = sentences[0] + "." if sentences else excerpt_text[:120]
        showcase_entry = ShowcaseItem(
            id=str(uuid.uuid4())[:8],
            document_title=top_chunk.get("source_title", "Document"),
            excerpt=excerpt_text,
            highlight_span=span,
            question=req.question,
            answer=answer_text,
            badge=reliability.get("status", "Reliable"),
            confidence=reliability.get("confidence", 1.0),
            reasons_json=reliability.get("reasons", []),
            setup_used=f"{req.embedding_model.split('/')[-1]} + {req.language_model.split('/')[-1]}",
        )
        session.add(showcase_entry)
        await session.commit()

    return {
        "question": req.question,
        "answer": answer_text,
        "chunks": [
            {
                "id": c.get("id"),
                "text": c.get("text"),
                "score": c.get("score"),
                "source": c.get("source_title", "Document"),
            }
            for c in retrieved
        ],
        "timings": {
            "embed_ms": ret_res.get("embed_time_ms", 0.0),
            "search_ms": ret_res.get("search_time_ms", 0.0),
            "generation_ms": gen_ms,
            "total_ms": tot_ms,
        },
        "tokens": tokens,
        "tokens_per_second": tps,
        "reliability": reliability,
        "error": gen_res.get("error") or ret_res.get("error"),
    }
