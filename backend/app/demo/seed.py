"""Demo mode database seeder.

Seeds a finished sample experiment with deterministic, clearly badged
SIMULATED results. Called on startup when DEMO=1.

Rules:
- Demo data is stored in a SEPARATE database file.
- Every seeded record has demo=True.
- No real ML computation is performed.
- All metrics are deterministic (seeded RNG).
"""
from __future__ import annotations

import random
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.hashing import config_hash
from app.core.logging import get_logger
from app.db.models import (
    AnswerRecord,
    Corpus,
    Document,
    Experiment,
    ExperimentConfig,
    QAItem,
    QASet,
    Run,
    Verdict,
)
from app.db.session import _get_factory

logger = get_logger(__name__)
_DEMO_SEED = 20240101


def _rng() -> random.Random:
    return random.Random(_DEMO_SEED)


DEMO_CORPUS_NAME = "Demo: AI Research Papers (Simulated)"
DEMO_EXPERIMENT_NAME = "Quick Benchmark — CPU-8GB (Simulated)"

DEMO_CONFIGS = [
    {
        "chunk_size": 256, "top_k": 3, "embedding_model": "all-MiniLM-L6-v2",
        "llm": "Qwen2.5-0.5B-Instruct-Q4_K_M", "quantization": "Q4_K_M",
        "index_type": "flat", "retriever": "dense", "context_budget": 2048,
        "prompt_template": "plain",
    },
    {
        "chunk_size": 512, "top_k": 5, "embedding_model": "bge-small-en-v1.5",
        "llm": "Qwen2.5-1.5B-Instruct-Q4_K_M", "quantization": "Q4_K_M",
        "index_type": "hnsw", "retriever": "dense", "context_budget": 2048,
        "prompt_template": "plain",
    },
    {
        "chunk_size": 256, "top_k": 3, "embedding_model": "all-MiniLM-L6-v2",
        "llm": "Llama-3.2-1B-Instruct-Q4_K_M", "quantization": "Q4_K_M",
        "index_type": "flat", "retriever": "hybrid", "context_budget": 4096,
        "prompt_template": "citation-required",
    },
]

# Deterministic per-config demo metrics
DEMO_METRICS = [
    {"f1": 0.61, "exact_match": 0.38, "recall_at_k": 0.72, "hallucination_rate": 0.14,
     "p95_latency_ms": 980, "peak_ram_mb": 2100, "energy_wh": 0.0031, "tokens_per_s": 12.4},
    {"f1": 0.74, "exact_match": 0.51, "recall_at_k": 0.84, "hallucination_rate": 0.08,
     "p95_latency_ms": 1540, "peak_ram_mb": 2900, "energy_wh": 0.0048, "tokens_per_s": 9.1},
    {"f1": 0.68, "exact_match": 0.44, "recall_at_k": 0.79, "hallucination_rate": 0.11,
     "p95_latency_ms": 1210, "peak_ram_mb": 2400, "energy_wh": 0.0039, "tokens_per_s": 10.8},
]

DEMO_QUESTIONS = [
    ("What is retrieval-augmented generation?",
     "RAG is a technique that combines information retrieval with language model generation."),
    ("How does quantization affect model quality?",
     "Quantization reduces precision of model weights, trading quality for smaller memory footprint."),
    ("What is the difference between BM25 and dense retrieval?",
     "BM25 is a keyword-based retrieval method; dense retrieval uses embedding similarity."),
    ("How do chunk size and overlap affect retrieval?",
     "Larger chunks provide more context but may include irrelevant text; overlap prevents boundary splits."),
    ("What metrics measure hallucination in LLMs?",
     "Hallucination is measured by NLI faithfulness, entity overlap, and self-consistency."),
]


async def seed_demo_db() -> None:
    """Idempotent: skips seeding if demo experiment already exists."""
    settings = get_settings()
    factory = _get_factory(settings.demo_database_url)

    async with factory() as db:
        # Check idempotency
        existing = await db.execute(
            select(Experiment).where(Experiment.name == DEMO_EXPERIMENT_NAME)
        )
        if existing.scalars().first():
            logger.info("demo.already_seeded")
            return

        await _seed(db)
        await db.commit()
    logger.info("demo.seed_complete")


async def _seed(db: AsyncSession) -> None:
    rng = _rng()

    # Corpus
    corpus = Corpus(name=DEMO_CORPUS_NAME, doc_count=3, content_hash="demo_abc123", demo=True)
    db.add(corpus)
    await db.flush()

    for i in range(3):
        db.add(Document(
            corpus_id=corpus.id,
            filename=f"demo_paper_{i+1}.pdf",
            mime_type="application/pdf",
            sha256=f"demo_sha_{i:04x}",
            size_bytes=rng.randint(50_000, 500_000),
            page_count=rng.randint(5, 30),
            token_count=rng.randint(3_000, 20_000),
            language="en",
            parse_status="ok",
            demo=True,
        ))

    # QA Set
    qa_set = QASet(
        name="Demo QA Set (Simulated)",
        origin="synthetic",
        license="CC-BY-4.0",
        content_hash="demo_qa_abc",
        item_count=len(DEMO_QUESTIONS),
        demo=True,
    )
    db.add(qa_set)
    await db.flush()

    qa_items = []
    for q, a in DEMO_QUESTIONS:
        item = QAItem(
            qa_set_id=qa_set.id,
            question=q,
            gold_answers=[a],
            answerable=True,
            review_status="accepted",
            demo=True,
        )
        db.add(item)
        qa_items.append(item)
    await db.flush()

    # Experiment
    exp = Experiment(
        name=DEMO_EXPERIMENT_NAME,
        goal="Quick benchmark of 3 configs on CPU hardware (SIMULATED)",
        preset="quick",
        design_strategy="ofat",
        factors_json={},
        hardware_profile="CPU-8GB",
        qa_set_ids=[qa_set.id],
        corpus_id=corpus.id,
        seed=_DEMO_SEED,
        n_questions=len(DEMO_QUESTIONS),
        status="done",
        demo=True,
    )
    db.add(exp)
    await db.flush()

    # Configs + Runs + Answers + Verdicts
    for i, (cfg, metrics) in enumerate(zip(DEMO_CONFIGS, DEMO_METRICS)):
        chash = config_hash({**cfg, "_demo": True, "_idx": i})
        ec = ExperimentConfig(
            experiment_id=exp.id,
            config_hash=chash,
            factors_json=cfg,
            feasibility="feasible",
            run_order=i,
            demo=True,
        )
        db.add(ec)
        await db.flush()

        run = Run(
            config_id=ec.id,
            peak_ram_mb=metrics["peak_ram_mb"],
            peak_vram_mb=0.0,
            energy_wh=metrics["energy_wh"],
            energy_kind="estimated",
            status="ok",
            demo=True,
        )
        db.add(run)
        await db.flush()

        for qa in qa_items:
            ans = AnswerRecord(
                run_id=run.id,
                qa_item_id=qa.id,
                retrieved_chunk_ids=[f"chunk_{rng.randint(0,99)}"],
                retrieval_scores=[round(rng.uniform(0.6, 0.95), 3)],
                answer_text=f"[SIMULATED] {qa.gold_answers[0]}",
                latencies_json={
                    "embed_ms": round(rng.uniform(10, 50), 1),
                    "retrieve_ms": round(rng.uniform(5, 20), 1),
                    "generate_ms": round(rng.uniform(500, 1500), 1),
                },
                metrics_json={k: v for k, v in metrics.items()},
                demo=True,
            )
            db.add(ans)
            await db.flush()

            label = "RELIABLE" if metrics["hallucination_rate"] < 0.1 else "UNCERTAIN"
            verdict = Verdict(
                answer_record_id=ans.id,
                detector_version=1,
                signals_json={
                    "retrieval_confidence": round(rng.uniform(0.6, 0.95), 3),
                    "nli_entailment": round(rng.uniform(0.55, 0.9), 3),
                },
                probability=round(rng.uniform(0.55, 0.92), 3),
                label=label,
                explanation_json={"note": "Simulated verdict. Not from a real detector."},
                demo=True,
            )
            db.add(verdict)
