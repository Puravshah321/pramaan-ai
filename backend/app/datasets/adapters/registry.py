"""Registry and discovery of dataset schema adapters."""
from __future__ import annotations

from typing import Any

from app.datasets.adapters.base import DatasetAdapter
from app.datasets.adapters.generic import GenericQAAdapter
from app.datasets.adapters.hotpot_qa import HotpotQAAdapter
from app.datasets.adapters.ms_marco import MsMarcoAdapter
from app.datasets.adapters.squad import SquadAdapter
from app.datasets.adapters.squad_v2 import SquadV2Adapter
from app.datasets.adapters.trivia_qa import TriviaQAAdapter

# Registered adapters in precedence order
ADAPTERS: list[DatasetAdapter] = [
    SquadV2Adapter(),
    SquadAdapter(),
    TriviaQAAdapter(),
    HotpotQAAdapter(),
    MsMarcoAdapter(),
    GenericQAAdapter(),
]


def detect_adapter(
    features: dict[str, Any] | None,
    sample_row: dict[str, Any] | None = None,
) -> tuple[DatasetAdapter | None, str | None]:
    """Finds the first adapter that can handle this dataset schema, or returns the most informative rejection reason."""
    rejection_reasons: list[str] = []

    for adapter in ADAPTERS:
        can, reason = adapter.can_adapt(features, sample_row)
        if can:
            return adapter, None
        if reason:
            rejection_reasons.append(f"{adapter.name}: {reason}")

    # Prioritize specific rejections
    for r in rejection_reasons:
        if "No passage or text context column" in r or "multimodal" in r or "non-text" in r:
            return None, r.split(": ", 1)[-1]

    last_reason = rejection_reasons[-1].split(": ", 1)[-1] if rejection_reasons else "Unsupported dataset schema"
    return None, last_reason


def get_adapter_by_name(name: str) -> DatasetAdapter | None:
    for a in ADAPTERS:
        if a.name == name:
            return a
    return None
