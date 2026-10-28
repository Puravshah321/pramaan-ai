"""SQLAlchemy ORM models — Pramaan AI.

Design rules:
- All tables have: id (UUID), created_at, schema_version.
- run_records is APPEND-ONLY; never UPDATE metrics columns.
- Real and demo data live in separate DB files (enforced by Settings).
- Migrations via Alembic; this file is the single source of truth.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ── Corpus & Documents ───────────────────────────────────────────────────────

class Corpus(Base):
    __tablename__ = "corpus"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    content_hash: Mapped[str | None] = mapped_column(String(64))  # hash of all doc hashes
    doc_count: Mapped[int] = mapped_column(Integer, default=0)

    documents: Mapped[list[Document]] = relationship(back_populates="corpus", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "document"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    corpus_id: Mapped[str] = mapped_column(ForeignKey("corpus.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(String(512))
    mime_type: Mapped[str] = mapped_column(String(128))
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    page_count: Mapped[int | None] = mapped_column(Integer)
    char_count: Mapped[int | None] = mapped_column(Integer)
    token_count: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str | None] = mapped_column(String(16))
    parse_status: Mapped[str] = mapped_column(
        Enum("pending", "ok", "error", name="parse_status_enum"), default="pending"
    )
    parse_error: Mapped[str | None] = mapped_column(Text)

    corpus: Mapped[Corpus] = relationship(back_populates="documents")


# ── QA Sets ─────────────────────────────────────────────────────────────────

class QASet(Base):
    __tablename__ = "qa_set"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    name: Mapped[str] = mapped_column(String(255))
    origin: Mapped[str] = mapped_column(
        Enum("public", "synthetic", "manual", name="qa_origin_enum")
    )
    license: Mapped[str | None] = mapped_column(String(255))
    content_hash: Mapped[str | None] = mapped_column(String(64))
    item_count: Mapped[int] = mapped_column(Integer, default=0)

    items: Mapped[list[QAItem]] = relationship(back_populates="qa_set", cascade="all, delete-orphan")


class QAItem(Base):
    __tablename__ = "qa_item"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    qa_set_id: Mapped[str] = mapped_column(ForeignKey("qa_set.id", ondelete="CASCADE"))
    document_id: Mapped[str | None] = mapped_column(ForeignKey("document.id"))
    question: Mapped[str] = mapped_column(Text)
    gold_answers: Mapped[list[str]] = mapped_column(JSON, default=list)
    gold_evidence_spans: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    answerable: Mapped[bool] = mapped_column(Boolean, default=True)
    question_type: Mapped[str | None] = mapped_column(String(64))  # factoid, multi-hop, unanswerable
    review_status: Mapped[str] = mapped_column(
        Enum("pending", "accepted", "edited", "rejected", name="review_status_enum"),
        default="pending",
    )

    qa_set: Mapped[QASet] = relationship(back_populates="items")


# ── Experiments ──────────────────────────────────────────────────────────────

class Experiment(Base):
    __tablename__ = "experiment"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    name: Mapped[str] = mapped_column(String(255))
    goal: Mapped[str | None] = mapped_column(Text)
    preset: Mapped[str | None] = mapped_column(String(64))
    design_strategy: Mapped[str] = mapped_column(String(64))  # ofat, factorial, lhs, successive_halving
    factors_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    hardware_profile: Mapped[str] = mapped_column(String(64))
    qa_set_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    corpus_id: Mapped[str | None] = mapped_column(ForeignKey("corpus.id"))
    seed: Mapped[int] = mapped_column(Integer, default=42)
    n_questions: Mapped[int] = mapped_column(Integer, default=300)
    reliability_options: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(
        Enum("draft", "planned", "running", "paused", "done", "failed", name="exp_status_enum"),
        default="draft",
    )
    plan_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)

    configs: Mapped[list[ExperimentConfig]] = relationship(back_populates="experiment", cascade="all, delete-orphan")


class ExperimentConfig(Base):
    """One concrete set of factor values within an experiment."""
    __tablename__ = "experiment_config"
    __table_args__ = (UniqueConstraint("experiment_id", "config_hash"),)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiment.id", ondelete="CASCADE"))
    config_hash: Mapped[str] = mapped_column(String(16))
    factors_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    feasibility: Mapped[str] = mapped_column(
        Enum("feasible", "infeasible", name="feasibility_enum"), default="feasible"
    )
    infeasible_reason: Mapped[str | None] = mapped_column(Text)
    run_order: Mapped[int] = mapped_column(Integer, default=0)

    experiment: Mapped[Experiment] = relationship(back_populates="configs")
    runs: Mapped[list[Run]] = relationship(back_populates="config", cascade="all, delete-orphan")


# ── Runs ─────────────────────────────────────────────────────────────────────

class Run(Base):
    """A single execution of one ExperimentConfig. APPEND-ONLY."""
    __tablename__ = "run"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    config_id: Mapped[str] = mapped_column(ForeignKey("experiment_config.id", ondelete="CASCADE"))
    stage_timings_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    peak_ram_mb: Mapped[float | None] = mapped_column(Float)
    peak_vram_mb: Mapped[float | None] = mapped_column(Float)
    energy_wh: Mapped[float | None] = mapped_column(Float)
    energy_kind: Mapped[str | None] = mapped_column(
        Enum("measured", "estimated", name="energy_kind_enum")
    )
    status: Mapped[str] = mapped_column(
        Enum("ok", "oom", "timeout", "error", name="run_status_enum"), default="ok"
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    env_fingerprint_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    code_sha: Mapped[str | None] = mapped_column(String(40))
    model_sha256: Mapped[str | None] = mapped_column(String(64))
    demo: Mapped[bool] = mapped_column(Boolean, default=False)

    config: Mapped[ExperimentConfig] = relationship(back_populates="runs")
    answers: Mapped[list[AnswerRecord]] = relationship(back_populates="run", cascade="all, delete-orphan")


class AnswerRecord(Base):
    """Per-question result within a Run. APPEND-ONLY."""
    __tablename__ = "answer_record"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    run_id: Mapped[str] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"))
    qa_item_id: Mapped[str] = mapped_column(ForeignKey("qa_item.id"))
    retrieved_chunk_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    retrieval_scores: Mapped[list[float]] = mapped_column(JSON, default=list)
    prompt_hash: Mapped[str | None] = mapped_column(String(16))
    answer_text: Mapped[str] = mapped_column(Text, default="")
    token_logprobs_ref: Mapped[str | None] = mapped_column(String(512))  # path to Parquet shard
    latencies_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    metrics_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)

    run: Mapped[Run] = relationship(back_populates="answers")
    verdict: Mapped[Verdict | None] = relationship(back_populates="answer_record", uselist=False)
    human_labels: Mapped[list[HumanLabel]] = relationship(back_populates="answer_record", cascade="all, delete-orphan")


# ── Reliability ──────────────────────────────────────────────────────────────

class Verdict(Base):
    __tablename__ = "verdict"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    answer_record_id: Mapped[str] = mapped_column(
        ForeignKey("answer_record.id", ondelete="CASCADE"), unique=True
    )
    detector_version: Mapped[int] = mapped_column(Integer, default=1)
    signals_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    probability: Mapped[float | None] = mapped_column(Float)
    label: Mapped[str] = mapped_column(
        Enum("RELIABLE", "UNCERTAIN", "UNRELIABLE", name="verdict_enum")
    )
    explanation_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)

    answer_record: Mapped[AnswerRecord] = relationship(back_populates="verdict")


class HumanLabel(Base):
    __tablename__ = "human_label"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    answer_record_id: Mapped[str] = mapped_column(ForeignKey("answer_record.id", ondelete="CASCADE"))
    labeller: Mapped[str] = mapped_column(String(128), default="user")
    label: Mapped[int] = mapped_column(Integer)  # 1=correct, 2=partial, 3=hallucinated
    note: Mapped[str | None] = mapped_column(Text)

    answer_record: Mapped[AnswerRecord] = relationship(back_populates="human_labels")


# ── Caching ──────────────────────────────────────────────────────────────────

class CacheStat(Base):
    __tablename__ = "cache_stat"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    layer: Mapped[str] = mapped_column(String(64))  # chunks, embeddings, index, generation
    cache_key: Mapped[str] = mapped_column(String(64))
    hit: Mapped[bool] = mapped_column(Boolean)
    experiment_id: Mapped[str | None] = mapped_column(String(36))
    demo: Mapped[bool] = mapped_column(Boolean, default=False)


# ── Audit ────────────────────────────────────────────────────────────────────

class AuditLog(Base):
    """Immutable audit trail: what happened, when, and why."""
    __tablename__ = "audit_log"
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    action: Mapped[str] = mapped_column(String(128))
    entity_type: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[str] = mapped_column(String(36))
    details_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    request_id: Mapped[str | None] = mapped_column(String(36))
