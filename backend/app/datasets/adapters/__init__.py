"""Dataset adapters package."""
from app.datasets.adapters.base import DatasetAdapter, NormalizedQARow
from app.datasets.adapters.generic import GenericQAAdapter
from app.datasets.adapters.hotpot_qa import HotpotQAAdapter
from app.datasets.adapters.ms_marco import MsMarcoAdapter
from app.datasets.adapters.registry import ADAPTERS, detect_adapter, get_adapter_by_name
from app.datasets.adapters.squad import SquadAdapter
from app.datasets.adapters.squad_v2 import SquadV2Adapter
from app.datasets.adapters.trivia_qa import TriviaQAAdapter

__all__ = [
    "DatasetAdapter",
    "NormalizedQARow",
    "SquadAdapter",
    "SquadV2Adapter",
    "TriviaQAAdapter",
    "HotpotQAAdapter",
    "MsMarcoAdapter",
    "GenericQAAdapter",
    "ADAPTERS",
    "detect_adapter",
    "get_adapter_by_name",
]
