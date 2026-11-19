"""Worker queue and Server-Sent Events (SSE) broadcaster for benchmarks."""
from __future__ import annotations

import asyncio
import datetime
import json
import uuid
from collections.abc import AsyncGenerator
from typing import Any

import numpy as np
from sqlalchemy import update

from app.db import AsyncSessionLocal
from app.eval.bootstrap import compute_bootstrap_ci
from app.hf.hub import get_model_details
from app.models import Answer, ConfigMetrics, Job, Run
from app.pipeline.chunking import chunk_text
from app.pipeline.index import VectorIndex
from app.runners.hosted import run_single_question


class RunManager:
    def __init__(self) -> None:
        self.subscribers: dict[str, list[asyncio.Queue]] = {}
        self.active_tasks: dict[str, asyncio.Task] = {}
        self.cancelled_runs: set[str] = set()

    def subscribe(self, run_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        if run_id not in self.subscribers:
            self.subscribers[run_id] = []
        self.subscribers[run_id].append(q)
        return q

    def unsubscribe(self, run_id: str, q: asyncio.Queue) -> None:
        if run_id in self.subscribers:
            if q in self.subscribers[run_id]:
                self.subscribers[run_id].remove(q)
            if not self.subscribers[run_id]:
                del self.subscribers[run_id]

    async def broadcast(self, run_id: str, data: dict[str, Any]) -> None:
        if run_id in self.subscribers:
            for q in list(self.subscribers[run_id]):
                await q.put(data)

    def cancel_run(self, run_id: str) -> bool:
        self.cancelled_runs.add(run_id)
        if run_id in self.active_tasks:
            self.active_tasks[run_id].cancel()
            return True
        return False


run_manager = RunManager()


async def execute_run_task(
    run_id: str,
    corpus_docs: list[dict[str, Any]],
    questions: list[dict[str, Any]],
    configs: list[dict[str, Any]],
) -> None:
    """Executes a benchmark run across all configurations and questions."""
    async with AsyncSessionLocal() as session:
        # Update run & job status to running
        await session.execute(
            update(Run).where(Run.id == run_id).values(status="running")
        )
        await session.execute(
            update(Job).where(Job.run_id == run_id).values(status="running")
        )
        await session.commit()

    total_configs = len(configs)
    total_questions = len(questions)
    total_steps = total_configs * total_questions
    current_step = 0

    accumulated_accuracies: list[float] = []
    accumulated_latencies: list[float] = []

    # Cache built indexes by (embedding_model, chunk_size)
    built_indexes: dict[tuple[str, int], VectorIndex] = {}

    try:
        for c_idx, cfg_dict in enumerate(configs):
            if run_id in run_manager.cancelled_runs:
                raise asyncio.CancelledError()

            chunk_size = cfg_dict["chunk_size"]
            top_k = cfg_dict["top_k"]
            embedding_model = cfg_dict["embedding_model"]
            language_model = cfg_dict["language_model"]
            quantization = cfg_dict.get("quantization", "none")
            run_config_id = cfg_dict["id"]

            # Build or reuse vector index
            idx_key = (embedding_model, chunk_size)
            if idx_key not in built_indexes:
                v_index = VectorIndex(
                    corpus_id="default",
                    embedding_model=embedding_model,
                    chunk_size=chunk_size,
                )
                all_chunks = []
                for d in corpus_docs:
                    c_list = chunk_text(
                        text=d.get("content", ""),
                        chunk_size=chunk_size,
                        overlap=32,
                        doc_id=d.get("id", ""),
                    )
                    all_chunks.extend(c_list)

                # Embed chunks
                if all_chunks:
                    # Limit chunks to 300 for snappy benchmark indexing
                    if len(all_chunks) > 300:
                        all_chunks = all_chunks[:300]
                    chunk_texts = [c["text"] for c in all_chunks]
                    from app.pipeline.embed import embed_texts
                    emb_res = await embed_texts(model_id=embedding_model, texts=chunk_texts)
                    embeddings = emb_res.get("embeddings", [])
                    if embeddings:
                        v_index.add(all_chunks, embeddings)
                built_indexes[idx_key] = v_index

            v_index = built_indexes[idx_key]

            # Estimate or measure memory
            model_info = await get_model_details(model_id=language_model)
            est_mem_gb = model_info.get("estimated_memory_gb") or 1.0
            est_mem_mb = est_mem_gb * 1024.0
            mem_source = "estimated"
            runner_type = cfg_dict.get("runner_type") or "hosted"
            quantization = cfg_dict.get("quantization", "none")

            if runner_type == "local":
                from app.runners.local import get_current_memory_mb
                mem_now = get_current_memory_mb()
                est_mem_mb = max(mem_now["rss_mb"], mem_now["vram_mb"])
                mem_source = "measured"

            config_f1s = []
            config_ems = []
            config_recalls = []
            config_latencies = []
            config_tokens = []
            failed_calls = 0

            for q_idx, q_item in enumerate(questions):
                if run_id in run_manager.cancelled_runs:
                    raise asyncio.CancelledError()

                current_step += 1
                q_text = q_item["question"]
                gold_ans = q_item.get("gold_answer", "")
                q_id = q_item.get("id", str(uuid.uuid4()))

                # Execute question
                result = await run_single_question(
                    index=v_index,
                    language_model=language_model,
                    top_k=top_k,
                    question=q_text,
                    gold_answer=gold_ans,
                    runner_type=runner_type,
                    quantization=quantization,
                )

                if result.get("error"):
                    failed_calls += 1

                if result.get("f1") is not None:
                    config_f1s.append(result["f1"])
                    config_ems.append(result["em"])
                    config_recalls.append(result["recall_at_k"])
                    config_latencies.append(result["timings"]["total_ms"])
                    config_tokens.append(result["tokens"])

                    accumulated_accuracies.append(result["f1"])
                    accumulated_latencies.append(result["timings"]["total_ms"])

                running_acc = float(np.mean(accumulated_accuracies)) if accumulated_accuracies else 0.0
                running_lat = float(np.mean(accumulated_latencies)) if accumulated_latencies else 0.0

                # Save answer row to DB
                async with AsyncSessionLocal() as session:
                    ans_record = Answer(
                        id=str(uuid.uuid4()),
                        run_config_id=run_config_id,
                        question_id=q_id,
                        retrieved_chunk_ids=result.get("retrieved_chunk_ids", []),
                        answer=result.get("answer", ""),
                        correct=result.get("correct", False),
                        timings_json=result.get("timings", {}),
                        tokens=result.get("tokens", 0),
                        error=result.get("error"),
                        features_json=result.get("features", {}),
                    )
                    session.add(ans_record)

                    # Update job record
                    await session.execute(
                        update(Job)
                        .where(Job.run_id == run_id)
                        .values(
                            current_step=current_step,
                            current_question=q_text[:80],
                            current_config=f"Cfg {c_idx+1}/{total_configs} (k={top_k}, c={chunk_size})",
                            running_accuracy=round(running_acc, 3),
                            running_latency=round(running_lat, 1),
                            updated_at=datetime.datetime.utcnow(),
                        )
                    )
                    await session.commit()

                # Broadcast live event
                await run_manager.broadcast(
                    run_id,
                    {
                        "type": "progress",
                        "run_id": run_id,
                        "config_index": c_idx + 1,
                        "total_configs": total_configs,
                        "question_index": q_idx + 1,
                        "total_questions": total_questions,
                        "current_step": current_step,
                        "total_steps": total_steps,
                        "running_accuracy": round(running_acc, 3),
                        "running_latency_ms": round(running_lat, 1),
                        "current_question": q_text[:80],
                        "error": result.get("error"),
                    },
                )

            # Compute aggregates for this config
            n = len(config_f1s)
            f1_mean = float(np.mean(config_f1s)) if n > 0 else 0.0
            em_mean = float(np.mean(config_ems)) if n > 0 else 0.0
            recall_mean = float(np.mean(config_recalls)) if n > 0 else 0.0
            lat_p50 = float(np.percentile(config_latencies, 50)) if n > 0 else 0.0
            lat_p95 = float(np.percentile(config_latencies, 95)) if n > 0 else 0.0
            tot_tokens = sum(config_tokens)
            tot_lat_s = sum(config_latencies) / 1000.0
            tps = float(tot_tokens / max(0.001, tot_lat_s)) if n > 0 else 0.0

            ci_low, ci_high = compute_bootstrap_ci(config_f1s) if n >= 100 else (None, None)

            async with AsyncSessionLocal() as session:
                metrics_record = ConfigMetrics(
                    id=str(uuid.uuid4()),
                    run_config_id=run_config_id,
                    recall_at_k=round(recall_mean, 3),
                    em=round(em_mean, 3),
                    f1=round(f1_mean, 3),
                    latency_p50=round(lat_p50, 1),
                    latency_p95=round(lat_p95, 1),
                    memory_mb=round(est_mem_mb, 1),
                    memory_source=mem_source,
                    tokens_per_second=round(tps, 1),
                    n=n,
                    failed_calls=failed_calls,
                    ci_lower_f1=ci_low,
                    ci_upper_f1=ci_high,
                )
                session.add(metrics_record)
                await session.commit()

        # Mark run and job completed
        async with AsyncSessionLocal() as session:
            now = datetime.datetime.utcnow()
            await session.execute(
                update(Run).where(Run.id == run_id).values(status="completed", finished_at=now)
            )
            await session.execute(
                update(Job).where(Job.run_id == run_id).values(status="completed", updated_at=now)
            )
            await session.commit()

        await run_manager.broadcast(run_id, {"type": "completed", "run_id": run_id})

    except asyncio.CancelledError:
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(Run).where(Run.id == run_id).values(status="cancelled")
            )
            await session.execute(
                update(Job).where(Job.run_id == run_id).values(status="cancelled")
            )
            await session.commit()
        await run_manager.broadcast(run_id, {"type": "cancelled", "run_id": run_id})

    except Exception as e:
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(Run).where(Run.id == run_id).values(status="failed")
            )
            await session.execute(
                update(Job)
                .where(Job.run_id == run_id)
                .values(status="failed", error_message=str(e))
            )
            await session.commit()
        await run_manager.broadcast(run_id, {"type": "failed", "run_id": run_id, "error": str(e)})


async def stream_run_events(run_id: str) -> AsyncGenerator[str, None]:
    """Generator for Server-Sent Events."""
    q = run_manager.subscribe(run_id)
    try:
        # Send initial ping
        yield f"data: {json.dumps({'type': 'connected', 'run_id': run_id})}\n\n"
        while True:
            event = await q.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") in ["completed", "cancelled", "failed"]:
                break
    finally:
        run_manager.unsubscribe(run_id, q)
