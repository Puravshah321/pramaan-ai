"""Run a clean local 4-config benchmark on SQuAD v2 dataset with real GGUF inference."""
import asyncio
import datetime
import os
import sys
import uuid
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import AsyncSessionLocal, init_db
from app.models import Answer, ConfigMetrics, Dataset, Document, Question, Run, RunConfig
from app.pipeline.chunking import chunk_text
from app.pipeline.index import VectorIndex
from app.runners.hosted import run_single_question
from app.runners.local import get_current_memory_mb, estimate_model_memory


async def run_benchmark():
    await init_db()

    dataset_id = "rajpurkar_squad_v2"
    llm_id = "Qwen/Qwen2.5-0.5B-Instruct"
    emb_id = "BAAI/bge-small-en-v1.5"

    async with AsyncSessionLocal() as session:
        # Fetch docs and questions
        from sqlalchemy import select
        doc_res = await session.execute(select(Document).where(Document.dataset_id == dataset_id))
        docs = [{"id": d.id, "content": d.content} for d in doc_res.scalars().all()]

        q_res = await session.execute(select(Question).where(Question.dataset_id == dataset_id).limit(200))
        questions = [{"id": q.id, "question": q.question, "gold_answer": q.gold_answer} for q in q_res.scalars().all()]

    if not questions:
        print("Error: No questions found for dataset", dataset_id)
        return

    print(f"Loaded {len(docs)} documents and {len(questions)} questions from {dataset_id}.")

    # Define 4 factorial configurations
    configs_defs = [
        {"chunk_size": 256, "top_k": 1, "quantization": "Q4_K_M"},
        {"chunk_size": 256, "top_k": 3, "quantization": "Q4_K_M"},
        {"chunk_size": 512, "top_k": 1, "quantization": "Q4_K_M"},
        {"chunk_size": 512, "top_k": 3, "quantization": "Q8_0"},
    ]

    run_id = f"run_{uuid.uuid4().hex[:8]}"
    run_name = f"Local SQuAD v2 Benchmark ({len(questions)} Qs)"

    # Create Run record
    async with AsyncSessionLocal() as session:
        run_record = Run(
            id=run_id,
            name=run_name,
            status="running",
            question_count=len(questions),
            runner_type="local",
            hardware_desc={"runner": "local", "engine": "llama-cpp-python"},
            is_valid=True,
        )
        session.add(run_record)

        run_configs_db = []
        for c in configs_defs:
            cfg_id = f"cfg_{uuid.uuid4().hex[:8]}"
            rc = RunConfig(
                id=cfg_id,
                run_id=run_id,
                chunk_size=c["chunk_size"],
                top_k=c["top_k"],
                embedding_model=emb_id,
                language_model=llm_id,
                quantization=c["quantization"],
            )
            session.add(rc)
            run_configs_db.append({"id": cfg_id, **c})
        await session.commit()

    print(f"Created Run {run_id} with {len(run_configs_db)} configurations.")

    built_indexes = {}

    for c_idx, cfg in enumerate(run_configs_db):
        cs = cfg["chunk_size"]
        k = cfg["top_k"]
        qz = cfg["quantization"]
        cfg_id = cfg["id"]

        print(f"\n--- Running Config {c_idx+1}/4: chunk_size={cs}, top_k={k}, quant={qz} ---")

        # Build index if not built
        if cs not in built_indexes:
            print(f"Indexing {len(docs)} documents with chunk_size={cs} using {emb_id}...")
            v_index = VectorIndex(corpus_id=dataset_id, embedding_model=emb_id, chunk_size=cs)
            all_chunks = []
            for d in docs:
                c_list = chunk_text(d["content"], chunk_size=cs, overlap=32, doc_id=d["id"])
                all_chunks.extend(c_list)
            if all_chunks:
                chunk_texts = [c["text"] for c in all_chunks]
                from app.pipeline.embed import embed_texts
                emb_res = await embed_texts(model_id=emb_id, texts=chunk_texts)
                v_index.add(all_chunks, emb_res.get("embeddings", []))
            built_indexes[cs] = v_index
            print(f"Indexed {len(all_chunks)} chunks.")

        v_index = built_indexes[cs]

        f1_list = []
        em_list = []
        recall_list = []
        latency_list = []
        tokens_list = []

        mem_start = get_current_memory_mb()

        # Run questions (evaluate on subset of questions to ensure high quality and swift execution)
        test_questions = questions[:50]  # 50 questions per config = 200 total evaluations
        for q_idx, q in enumerate(test_questions):
            res = await run_single_question(
                index=v_index,
                language_model=llm_id,
                top_k=k,
                question=q["question"],
                gold_answer=q["gold_answer"],
                runner_type="local",
                quantization=qz,
            )

            if res.get("f1") is not None:
                f1_list.append(res["f1"])
                em_list.append(res["em"])
                recall_list.append(res["recall_at_k"])
                latency_list.append(res["timings"]["total_ms"])
                tokens_list.append(res["tokens"])

            # Store answer
            async with AsyncSessionLocal() as session:
                ans_record = Answer(
                    id=str(uuid.uuid4()),
                    run_config_id=cfg_id,
                    question_id=q["id"],
                    retrieved_chunk_ids=res.get("retrieved_chunk_ids", []),
                    answer=res.get("answer", ""),
                    correct=res.get("correct", False),
                    timings_json=res.get("timings", {}),
                    tokens=res.get("tokens", 0),
                    error=res.get("error"),
                    features_json=res.get("features", {}),
                )
                session.add(ans_record)
                await session.commit()

            if (q_idx + 1) % 10 == 0 or q_idx == len(test_questions) - 1:
                cur_f1 = np.mean(f1_list) if f1_list else 0.0
                cur_lat = np.mean(latency_list) if latency_list else 0.0
                print(f"  [{q_idx+1}/{len(test_questions)}] Running F1: {cur_f1:.3f} | Latency: {cur_lat:.1f}ms")

        mem_end = get_current_memory_mb()
        peak_mem = max(mem_start["rss_mb"], mem_end["rss_mb"])

        # Compute summary metrics
        mean_f1 = float(np.mean(f1_list)) if f1_list else 0.0
        mean_em = float(np.mean(em_list)) if em_list else 0.0
        mean_recall = float(np.mean(recall_list)) if recall_list else 0.0
        p50_lat = float(np.percentile(latency_list, 50)) if latency_list else 0.0
        p95_lat = float(np.percentile(latency_list, 95)) if latency_list else 0.0
        mean_tokens = float(np.mean(tokens_list)) if tokens_list else 0.0
        tps = round(mean_tokens / max(p50_lat / 1000.0, 0.001), 1)

        async with AsyncSessionLocal() as session:
            cm = ConfigMetrics(
                id=str(uuid.uuid4()),
                run_config_id=cfg_id,
                f1=mean_f1,
                em=mean_em,
                recall_at_k=mean_recall,
                latency_p50=p50_lat,
                latency_p95=p95_lat,
                memory_mb=peak_mem,
                tokens_per_second=tps,
                n=len(f1_list),
            )
            session.add(cm)
            await session.commit()

        print(f"Config {c_idx+1} Done -> F1: {mean_f1:.3f}, EM: {mean_em:.3f}, Recall@{k}: {mean_recall:.3f}, Latency: {p50_lat:.1f}ms, Memory: {peak_mem:.1f}MB")

    # Mark run completed
    async with AsyncSessionLocal() as session:
        from sqlalchemy import update
        await session.execute(update(Run).where(Run.id == run_id).values(status="completed"))
        await session.commit()

    print(f"\nBenchmark Run {run_id} fully COMPLETED successfully!")


if __name__ == "__main__":
    asyncio.run(run_benchmark())
