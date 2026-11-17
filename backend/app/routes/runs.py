"""Benchmark runs, preview, execution, cancellation, and SSE streams."""
from __future__ import annotations

import asyncio
import datetime
import uuid
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.hf.hub import get_model_details
from app.jobs import execute_run_task, run_manager, stream_run_events
from app.models import Dataset, Document, Job, Question, Run, RunConfig

router = APIRouter(prefix="/api/runs", tags=["runs"])


class RunPreviewRequest(BaseModel):
    chunk_sizes: list[int] = [256, 512]
    top_ks: list[int] = [1, 3, 5]
    embedding_models: list[str] = ["sentence-transformers/all-MiniLM-L6-v2"]
    language_models: list[str] = ["Qwen/Qwen2.5-0.5B-Instruct"]
    quantizations: list[str] = ["none"]
    question_count: int = 20
    memory_limit_gb: Optional[float] = 4.0


class StartRunRequest(BaseModel):
    name: Optional[str] = None
    dataset_id: Optional[str] = None
    chunk_sizes: list[int] = [256]
    top_ks: list[int] = [3]
    embedding_models: list[str] = ["sentence-transformers/all-MiniLM-L6-v2"]
    language_models: list[str] = ["Qwen/Qwen2.5-0.5B-Instruct"]
    quantizations: list[str] = ["none"]
    question_count: int = 20
    runner_type: str = "hosted"


@router.post("/preview")
async def preview_run(req: RunPreviewRequest) -> dict[str, Any]:
    """Cost and feasibility preview computed live."""
    total_configs = (
        len(req.chunk_sizes)
        * len(req.top_ks)
        * len(req.embedding_models)
        * len(req.language_models)
        * len(req.quantizations)
    )
    total_api_calls = total_configs * req.question_count

    # Estimate memory per language model
    configs_preview = []
    exceeded_count = 0

    for lm in req.language_models:
        details = await get_model_details(lm)
        est_mem_gb = details.get("estimated_memory_gb") or 1.0

        for cs in req.chunk_sizes:
            for k in req.top_ks:
                for qz in req.quantizations:
                    # If quantized (e.g. 4-bit vs 16-bit), adjust memory
                    multiplier = 0.35 if "4" in qz else (0.6 if "8" in qz else 1.0)
                    config_mem_gb = round(est_mem_gb * multiplier, 2)
                    exceeds = bool(req.memory_limit_gb and config_mem_gb > req.memory_limit_gb)
                    if exceeds:
                        exceeded_count += 1

                    configs_preview.append({
                        "language_model": lm,
                        "chunk_size": cs,
                        "top_k": k,
                        "quantization": qz,
                        "estimated_memory_gb": config_mem_gb,
                        "memory_source": "estimated",
                        "exceeds_hardware_cap": exceeds,
                    })

    # Estimate time: ~0.8s per call for hosted API
    est_seconds = round(total_api_calls * 0.8, 1)

    return {
        "total_configurations": total_configs,
        "total_api_calls": total_api_calls,
        "estimated_duration_seconds": est_seconds,
        "estimated_duration_minutes": round(est_seconds / 60, 1),
        "memory_limit_gb": req.memory_limit_gb,
        "exceeded_hardware_cap_count": exceeded_count,
        "configurations": configs_preview[:20],
    }


@router.post("")
async def start_run(
    req: StartRunRequest,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Start a real benchmark run."""
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    run_name = req.name or f"Benchmark {datetime.datetime.utcnow().strftime('%b %d %H:%M')}"

    # Verify or fetch documents and questions
    docs: list[dict[str, Any]] = []
    questions: list[dict[str, Any]] = []

    if req.dataset_id:
        doc_res = await session.execute(
            select(Document).where(Document.dataset_id == req.dataset_id)
        )
        docs = [{"id": d.id, "content": d.content} for d in doc_res.scalars().all()]

        q_res = await session.execute(
            select(Question)
            .where(Question.dataset_id == req.dataset_id)
            .limit(req.question_count)
        )
        questions = [
            {"id": q.id, "question": q.question, "gold_answer": q.gold_answer}
            for q in q_res.scalars().all()
        ]

    # If no questions in DB or empty dataset, create a fallback minimal QA set from real text
    if not questions:
        # Default benchmark questions on AI/ML system principles
        default_qa = [
            ("What is the primary trade-off in RAG chunk size?", "Larger chunks increase context but reduce retrieval precision."),
            ("What metric measures exact string equality between prediction and ground truth?", "Exact Match"),
            ("What does Top-K represent in vector search?", "The number of most similar chunks retrieved from the index."),
            ("What technique reduces LLM weights to 4-bit integers?", "Quantization"),
            ("What is the role of FAISS in RAG pipelines?", "Fast vector similarity search and indexing."),
        ]
        sample_doc = (
            "Retrieval-Augmented Generation (RAG) combines dense vector search with language models. "
            "Larger chunks increase context but reduce retrieval precision. Top-K represents the number of most "
            "similar chunks retrieved from the index. Exact Match measures exact string equality between prediction "
            "and ground truth. Quantization reduces LLM weights to 4-bit integers to fit resource constraints. "
            "FAISS provides fast vector similarity search and indexing for large corpora."
        )
        # Ensure default dataset exists
        default_ds = await session.get(Dataset, "default")
        if not default_ds:
            default_ds = Dataset(id="default", name="Core RAG QA Benchmark", source="built-in", split="test")
            session.add(default_ds)

        default_doc = await session.get(Document, "default_doc_1")
        if not default_doc:
            default_doc = Document(id="default_doc_1", dataset_id="default", title="RAG Systems Overview", content=sample_doc)
            session.add(default_doc)

        docs = [{"id": "default_doc_1", "content": sample_doc}]
        questions = []
        for idx, qa in enumerate(default_qa[: req.question_count]):
            q_id = f"q_{idx}"
            existing_q = await session.get(Question, q_id)
            if not existing_q:
                existing_q = Question(id=q_id, dataset_id="default", question=qa[0], gold_answer=qa[1], is_synthetic=False)
                session.add(existing_q)
            questions.append({"id": q_id, "question": qa[0], "gold_answer": qa[1]})

    # Create Run record
    run_record = Run(
        id=run_id,
        name=run_name,
        status="pending",
        question_count=len(questions),
        runner_type=req.runner_type,
        hardware_desc={"runner": req.runner_type},
    )
    session.add(run_record)

    # Create RunConfigs
    configs_to_execute = []
    for lm in req.language_models:
        for em in req.embedding_models:
            for cs in req.chunk_sizes:
                for k in req.top_ks:
                    for qz in req.quantizations:
                        cfg_id = f"cfg_{uuid.uuid4().hex[:8]}"
                        cfg_rec = RunConfig(
                            id=cfg_id,
                            run_id=run_id,
                            chunk_size=cs,
                            top_k=k,
                            embedding_model=em,
                            language_model=lm,
                            quantization=qz,
                        )
                        session.add(cfg_rec)
                        configs_to_execute.append({
                            "id": cfg_id,
                            "run_id": run_id,
                            "chunk_size": cs,
                            "top_k": k,
                            "embedding_model": em,
                            "language_model": lm,
                            "quantization": qz,
                            "runner_type": req.runner_type,
                        })

    # Create Job record
    job_record = Job(
        id=str(uuid.uuid4())[:8],
        run_id=run_id,
        status="pending",
        total_steps=len(configs_to_execute) * len(questions),
        current_step=0,
    )
    session.add(job_record)
    await session.commit()

    # Launch background task
    task = asyncio.create_task(
        execute_run_task(
            run_id=run_id,
            corpus_docs=docs,
            questions=questions,
            configs=configs_to_execute,
        )
    )
    run_manager.active_tasks[run_id] = task

    return {
        "run_id": run_id,
        "name": run_name,
        "status": "pending",
        "total_configs": len(configs_to_execute),
        "total_questions": len(questions),
    }


@router.get("")
async def list_runs(session: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    """List all past benchmark runs."""
    result = await session.execute(
        select(Run).options(selectinload(Run.configs)).order_by(desc(Run.created_at))
    )
    runs = result.scalars().all()

    items = []
    for r in runs:
        items.append({
            "id": r.id,
            "name": r.name,
            "status": r.status,
            "question_count": r.question_count,
            "configs_count": len(r.configs),
            "runner_type": r.runner_type,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        })
    return items


@router.get("/{id}")
async def get_run_details(id: str, session: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Retrieve details and progress of a run."""
    result = await session.execute(
        select(Run).options(selectinload(Run.configs)).where(Run.id == id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail=f"Run '{id}' not found.")

    # Fetch job status
    job_res = await session.execute(select(Job).where(Job.run_id == id))
    job = job_res.scalar_one_or_none()

    return {
        "id": r.id,
        "name": r.name,
        "status": r.status,
        "question_count": r.question_count,
        "runner_type": r.runner_type,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        "job": {
            "total_steps": job.total_steps if job else 0,
            "current_step": job.current_step if job else 0,
            "current_question": job.current_question if job else "",
            "current_config": job.current_config if job else "",
            "running_accuracy": job.running_accuracy if job else 0.0,
            "running_latency": job.running_latency if job else 0.0,
            "error_message": job.error_message if job else None,
        } if job else None,
        "configs": [
            {
                "id": c.id,
                "chunk_size": c.chunk_size,
                "top_k": c.top_k,
                "embedding_model": c.embedding_model,
                "language_model": c.language_model,
                "quantization": c.quantization,
            }
            for c in r.configs
        ],
    }


@router.get("/{id}/events")
async def get_run_events(id: str) -> StreamingResponse:
    """Server-Sent Events endpoint streaming live progress."""
    return StreamingResponse(
        stream_run_events(id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{id}/cancel")
async def cancel_run_endpoint(id: str, session: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Cancel an active benchmark run."""
    success = run_manager.cancel_run(id)
    return {"run_id": id, "cancelled": success}
