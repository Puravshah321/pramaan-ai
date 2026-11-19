"""Base schema adapter definitions for question-answering datasets."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class NormalizedQARow(BaseModel):
    """Canonical representation of a single Question-Answering benchmark question."""
    id: str
    question: str
    context: str
    answers: list[str] = Field(default_factory=list)
    is_unanswerable: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class DatasetAdapter(ABC):
    """Abstract adapter to validate and normalize heterogeneous QA datasets."""

    name: str = "base"
    description: str = ""

    @abstractmethod
    def can_adapt(
        self,
        features: dict[str, Any] | None,
        sample_row: dict[str, Any] | None = None,
    ) -> tuple[bool, str | None]:
        """Returns (True, None) if this adapter can parse the dataset, or (False, reason)."""
        pass

    @abstractmethod
    def normalize_row(self, row: dict[str, Any], row_idx: int = 0) -> NormalizedQARow | None:
        """Parses a raw row from the Hugging Face datasets server into canonical QA format."""
        pass
