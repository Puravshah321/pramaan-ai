"""SQLAlchemy database models for Pramaan AI."""
from __future__ import annotations

import datetime
from typing import Any
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class AppSettings(Base):
    __tablename__ = "settings"

    key = Column(String(64), primary_key=True, default="default")
    embedding_model = Column(String(256), default="sentence-transformers/all-MiniLM-L6-v2")
    language_model = Column(String(256), nullable=True, default=None)
    dataset_id = Column(String(128), nullable=True)
    ui_preferences = Column(JSON, default=dict)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class ModelCache(Base):
    __tablename__ = "model_cache"

    model_id = Column(String(256), primary_key=True)
    pipeline_tag = Column(String(64), nullable=True)
    metadata_json = Column(JSON, default=dict)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow)


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String(64), primary_key=True)
    name = Column(String(256), nullable=False)
    source = Column(String(32), default="upload")  # "upload" or "hub"
    split = Column(String(32), default="train")
    num_docs = Column(Integer, default=0)
    num_questions = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    documents = relationship("Document", back_populates="dataset", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="dataset", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False)
    title = Column(String(256), default="")
    content = Column(Text, nullable=False)

    dataset = relationship("Dataset", back_populates="documents")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False)
    question = Column(Text, nullable=False)
    gold_answer = Column(Text, default="")
    is_synthetic = Column(Boolean, default=False)

    dataset = relationship("Dataset", back_populates="questions")


class IndexRecord(Base):
    __tablename__ = "indexes"

    id = Column(String(64), primary_key=True)
    corpus_id = Column(String(64), nullable=False)
    embedding_model = Column(String(256), nullable=False)
    chunk_size = Column(Integer, nullable=False)
    file_path = Column(String(512), nullable=False)
    build_time_s = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Run(Base):
    __tablename__ = "runs"

    id = Column(String(64), primary_key=True)
    name = Column(String(256), nullable=False)
    status = Column(String(32), default="pending")  # pending, running, completed, cancelled, failed
    question_count = Column(Integer, default=20)
    runner_type = Column(String(32), default="hosted")  # "hosted" or "local"
    hardware_desc = Column(JSON, default=dict)
    is_valid = Column(Boolean, default=True)
    invalid_reason = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

    configs = relationship("RunConfig", back_populates="run", cascade="all, delete-orphan")


class RunConfig(Base):
    __tablename__ = "run_configs"

    id = Column(String(64), primary_key=True)
    run_id = Column(String(64), ForeignKey("runs.id"), nullable=False)
    chunk_size = Column(Integer, nullable=False)
    top_k = Column(Integer, nullable=False)
    embedding_model = Column(String(256), nullable=False)
    language_model = Column(String(256), nullable=False)
    quantization = Column(String(32), default="none")  # "none", "Q4_K_M", "Q8_0", etc.

    run = relationship("Run", back_populates="configs")
    answers = relationship("Answer", back_populates="config", cascade="all, delete-orphan")
    metrics = relationship("ConfigMetrics", back_populates="config", uselist=False, cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(String(64), primary_key=True)
    run_config_id = Column(String(64), ForeignKey("run_configs.id"), nullable=False)
    question_id = Column(String(64), nullable=False)
    retrieved_chunk_ids = Column(JSON, default=list)
    answer = Column(Text, default="")
    correct = Column(Boolean, default=False)
    timings_json = Column(JSON, default=dict)  # {embedding_ms, search_ms, generation_ms, total_ms}
    tokens = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    features_json = Column(JSON, default=dict)  # for reliability checker: top_sim, gap, lexical_support, etc.

    config = relationship("RunConfig", back_populates="answers")


class ConfigMetrics(Base):
    __tablename__ = "config_metrics"

    id = Column(String(64), primary_key=True)
    run_config_id = Column(String(64), ForeignKey("run_configs.id"), nullable=False)
    recall_at_k = Column(Float, default=0.0)
    em = Column(Float, default=0.0)
    f1 = Column(Float, default=0.0)
    latency_p50 = Column(Float, default=0.0)
    latency_p95 = Column(Float, default=0.0)
    memory_mb = Column(Float, default=0.0)
    memory_source = Column(String(32), default="estimated")  # "measured" or "estimated"
    tokens_per_second = Column(Float, default=0.0)
    n = Column(Integer, default=0)
    failed_calls = Column(Integer, default=0)
    ci_lower_f1 = Column(Float, nullable=True)
    ci_upper_f1 = Column(Float, nullable=True)

    config = relationship("RunConfig", back_populates="metrics")


class DetectorModel(Base):
    __tablename__ = "detector_models"

    id = Column(String(64), primary_key=True)
    features_json = Column(JSON, default=list)
    split_sizes_json = Column(JSON, default=dict)
    auroc = Column(Float, default=0.5)
    baseline_auroc = Column(Float, default=0.5)
    rejection_20_caught = Column(Float, default=0.0)
    abstention_rate = Column(Float, default=0.0)
    weights_json = Column(JSON, default=dict)
    n = Column(Integer, default=0)
    trained_at = Column(DateTime, default=datetime.datetime.utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(64), primary_key=True)
    run_id = Column(String(64), ForeignKey("runs.id"), nullable=False)
    status = Column(String(32), default="pending")  # pending, running, completed, cancelled, failed
    total_steps = Column(Integer, default=0)
    current_step = Column(Integer, default=0)
    current_question = Column(String(256), default="")
    current_config = Column(String(256), default="")
    running_accuracy = Column(Float, default=0.0)
    running_latency = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class ShowcaseItem(Base):
    __tablename__ = "showcase_items"

    id = Column(String(64), primary_key=True)
    document_title = Column(String(256), default="")
    excerpt = Column(Text, nullable=False)
    highlight_span = Column(Text, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    badge = Column(String(32), default="Reliable")
    confidence = Column(Float, default=1.0)
    reasons_json = Column(JSON, default=list)
    setup_used = Column(String(256), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
