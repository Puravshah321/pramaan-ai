"""Phase 1 unit tests — core utilities.

All tests use hand-computed examples (no mocks for pure functions).
"""
from __future__ import annotations

import pytest

from app.core.hashing import config_hash, dataset_hash, sha256_str


class TestConfigHash:
    def test_deterministic(self) -> None:
        cfg = {"a": 1, "b": "hello"}
        assert config_hash(cfg) == config_hash(cfg)

    def test_key_order_invariant(self) -> None:
        """Key insertion order must not affect the hash."""
        cfg_a = {"chunk_size": 256, "top_k": 3, "model": "miniLM"}
        cfg_b = {"model": "miniLM", "top_k": 3, "chunk_size": 256}
        assert config_hash(cfg_a) == config_hash(cfg_b)

    def test_different_values_different_hash(self) -> None:
        cfg_a = {"chunk_size": 256}
        cfg_b = {"chunk_size": 512}
        assert config_hash(cfg_a) != config_hash(cfg_b)

    def test_nested_dicts(self) -> None:
        cfg = {"params": {"a": 1, "b": 2}}
        cfg_reordered = {"params": {"b": 2, "a": 1}}
        assert config_hash(cfg) == config_hash(cfg_reordered)

    def test_returns_16_chars(self) -> None:
        assert len(config_hash({"x": 1})) == 16

    def test_empty_config(self) -> None:
        assert len(config_hash({})) == 16


class TestDatasetHash:
    def test_deterministic(self) -> None:
        items = [{"question": "Q1", "gold_answers": ["A1"]}]
        assert dataset_hash(items) == dataset_hash(items)

    def test_different_questions_different_hash(self) -> None:
        items_a = [{"question": "Q1", "gold_answers": ["A1"]}]
        items_b = [{"question": "Q2", "gold_answers": ["A1"]}]
        assert dataset_hash(items_a) != dataset_hash(items_b)

    def test_empty_dataset(self) -> None:
        assert len(dataset_hash([])) == 16


class TestSha256Str:
    def test_known_value(self) -> None:
        # sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        assert sha256_str("").startswith("e3b0c44298fc1c14")

    def test_different_strings(self) -> None:
        assert sha256_str("hello") != sha256_str("world")
