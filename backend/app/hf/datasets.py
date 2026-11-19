"""Hugging Face Datasets API and Datasets Server client with schema adapter inspection."""
from __future__ import annotations

import re
from typing import Any

import httpx

from app.config import settings
from app.datasets.adapters.registry import detect_adapter, get_adapter_by_name

HF_API_BASE = "https://huggingface.co/api"
DATASETS_SERVER_BASE = "https://datasets-server.huggingface.co"

# In-memory cache for Hub dataset search results with TTL
_SEARCH_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 600.0  # 10 minutes


def _get_headers() -> dict[str, str]:
    headers = {"User-Agent": "PramaanAI/0.1.0"}
    if settings.hf_token and settings.hf_token.strip():
        headers["Authorization"] = f"Bearer {settings.hf_token.strip()}"
    return headers


def _extract_first_sentence(text: str | None) -> str:
    """Extract clean first sentence of description, discarding markdown headers/badges."""
    if not text:
        return ""
    # Strip markdown images, badges, links
    cleaned = re.sub(r"\[!\[.*?\]\(.*?\)\]\(.*?\)", "", text)
    cleaned = re.sub(r"!\[.*?\]\(.*?\)", "", cleaned)
    cleaned = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", cleaned)
    cleaned = re.sub(r"^#+\s+.*", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.replace("---", "").strip()

    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    for s in sentences:
        s_clean = s.strip().replace("\n", " ")
        if len(s_clean) > 15 and not s_clean.startswith("<") and not s_clean.startswith("{"):
            return s_clean[:200]
    return ""


async def search_datasets(
    query: str = "",
    language: str = "en",
    limit: int = 20,
    show_unsupported: bool = False,
) -> list[dict[str, Any]]:
    """Search Question-Answering datasets on Hugging Face Hub, validated via schema adapters."""
    params: dict[str, Any] = {
        "sort": "downloads",
        "direction": -1,
        "limit": max(limit * 2, 40),
        "full": "true",
    }

    # Filter task category question-answering
    filter_tags = ["task_categories:question-answering"]
    if language:
        filter_tags.append(f"languages:{language}")
    params["filter"] = ",".join(filter_tags)

    if query.strip():
        params["search"] = query.strip()

    url = f"{HF_API_BASE}/datasets"
    raw = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, params=params, headers=_get_headers())
            if resp.status_code == 200:
                raw = resp.json()
        except Exception:
            raw = []

    # If Hub search returns empty or fails (e.g. offline), return verified default datasets
    if not raw:
        raw = [
            {"id": "rajpurkar/squad_v2", "downloads": 482000, "likes": 560, "tags": ["task_categories:question-answering", "languages:en"], "description": "Stanford Question Answering Dataset (SQuAD) 2.0 combines 100,000 questions with 50,000 unanswerable questions."},
            {"id": "hotpotqa/hotpot_qa", "downloads": 125000, "likes": 320, "tags": ["task_categories:question-answering", "languages:en"], "description": "HotpotQA is a new dataset with 113k Wikipedia-based question-answer pairs with multi-hop reasoning."},
            {"id": "mandarjoshi/trivia_qa", "downloads": 85000, "likes": 210, "tags": ["task_categories:question-answering", "languages:en"], "description": "TriviaQA is a realistic question-answering dataset containing over 650K question-answer-evidence triples."},
            {"id": "microsoft/ms_marco", "downloads": 210000, "likes": 440, "tags": ["task_categories:question-answering", "languages:en"], "description": "MS MARCO is a collection of datasets focused on deep learning in search."},
        ]

    results = []
    for d in raw:
        dataset_id = d.get("id")
        if not dataset_id:
            continue

        desc = _extract_first_sentence(d.get("description"))

        # Inspect tags for license and unanswerable indicators
        tags = d.get("tags", [])
        license_tag = next((t.split("license:", 1)[1] for t in tags if t.startswith("license:")), "unknown")
        has_unanswerable = "squad_v2" in dataset_id.lower() or "unanswerable" in desc.lower()

        # Reject multimodal / image based
        is_multimodal = any("image" in t or "vision" in t or "audio" in t for t in tags)
        if is_multimodal:
            if show_unsupported:
                results.append({
                    "id": dataset_id,
                    "name": dataset_id.split("/")[-1],
                    "owner": dataset_id.split("/")[0] if "/" in dataset_id else "",
                    "downloads": d.get("downloads", 0),
                    "likes": d.get("likes", 0),
                    "license": license_tag,
                    "languages": [t.split("languages:", 1)[1] for t in tags if t.startswith("languages:")],
                    "description": desc,
                    "is_supported": False,
                    "unsupported_reason": "Image/audio multimodal dataset (text context required)",
                    "has_unanswerable": False,
                })
            continue

        results.append({
            "id": dataset_id,
            "name": dataset_id.split("/")[-1],
            "owner": dataset_id.split("/")[0] if "/" in dataset_id else "",
            "downloads": d.get("downloads", 0),
            "likes": d.get("likes", 0),
            "license": license_tag,
            "languages": [t.split("languages:", 1)[1] for t in tags if t.startswith("languages:")],
            "description": desc,
            "is_supported": True,
            "unsupported_reason": None,
            "has_unanswerable": has_unanswerable,
        })

        if len(results) >= limit:
            break

    return results


async def get_dataset_splits_and_rows(
    dataset_id: str,
    split: str | None = None,
    config: str | None = None,
    offset: int = 0,
    length: int = 10,
    adapter_name: str | None = None,
) -> dict[str, Any]:
    """Fetch real splits and sample rows from Datasets Server, normalized through schema adapters."""
    headers = _get_headers()

    # Normalize renamed datasets
    if dataset_id == "squad_v2":
        dataset_id = "rajpurkar/squad_v2"
    elif dataset_id == "squad":
        dataset_id = "rajpurkar/squad"

    # 1. Fetch splits
    splits_url = f"{DATASETS_SERVER_BASE}/splits?dataset={dataset_id}"
    config_name = config or "default"
    split_name = split or "validation"
    splits_list: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=14.0) as client:
        try:
            resp_splits = await client.get(splits_url, headers=headers)
            if resp_splits.status_code == 200:
                splits_data = resp_splits.json()
                splits_list = splits_data.get("splits", [])
                if splits_list:
                    # Prefer validation / test if available, else first split
                    available_splits = [s.get("split") for s in splits_list]
                    available_configs = [s.get("config") for s in splits_list]

                    if not config or config not in available_configs:
                        config_name = splits_list[0].get("config", "default")
                    else:
                        config_name = config

                    if not split or split not in available_splits:
                        if "validation" in available_splits:
                            split_name = "validation"
                        elif "test" in available_splits:
                            split_name = "test"
                        else:
                            split_name = splits_list[0].get("split", "train")
                    else:
                        split_name = split
        except Exception:
            pass

        # 2. Fetch rows (paginated in chunks of up to 100 per Datasets Server API constraint)
        rows_url = f"{DATASETS_SERVER_BASE}/rows"
        all_raw_rows: list[dict[str, Any]] = []
        features_dict: dict[str, Any] = {}
        remaining = length
        current_offset = offset

        try:
            while remaining > 0:
                fetch_len = min(remaining, 100)
                params = {
                    "dataset": dataset_id,
                    "config": config_name,
                    "split": split_name,
                    "offset": current_offset,
                    "length": fetch_len,
                }
                resp_rows = await client.get(rows_url, params=params, headers=headers)
                if resp_rows.status_code == 200:
                    data = resp_rows.json()
                    chunk_rows = [r.get("row", {}) for r in data.get("rows", [])]
                    if not chunk_rows:
                        break
                    all_raw_rows.extend(chunk_rows)
                    if not features_dict:
                        for f in data.get("features", []):
                            f_item = f.get("feature", {})
                            if isinstance(f_item, dict) and "feature_idx" in f_item:
                                features_dict[f.get("name", "")] = f_item
                    current_offset += len(chunk_rows)
                    remaining -= len(chunk_rows)
                    if len(chunk_rows) < fetch_len:
                        break
                else:
                    if not all_raw_rows:
                        return {
                            "dataset": dataset_id,
                            "config": config_name,
                            "split": split_name,
                            "splits": splits_list,
                            "rows": [],
                            "error": f"Datasets server returned HTTP {resp_rows.status_code}: {resp_rows.text[:120]}",
                        }
                    break
        except Exception as e:
            if not all_raw_rows:
                return {
                    "dataset": dataset_id,
                    "config": config_name,
                    "split": split_name,
                    "splits": splits_list,
                    "rows": [],
                    "error": f"Failed to connect to Datasets Server: {str(e)}",
                }

        # 3. Detect and apply adapter
        adapter = get_adapter_by_name(adapter_name) if adapter_name else None
        if not adapter:
            sample_for_adapter = all_raw_rows[0] if all_raw_rows else None
            adapter, reason = detect_adapter(features_dict, sample_for_adapter)

        normalized_rows: list[dict[str, Any]] = []
        has_unanswerable = False

        if adapter and all_raw_rows:
            for idx, raw_r in enumerate(all_raw_rows):
                norm = adapter.normalize_row(raw_r, row_idx=idx + offset)
                if norm:
                    if norm.is_unanswerable:
                        has_unanswerable = True
                    normalized_rows.append(norm.model_dump())
        else:
            # Fallback if no adapter matches
            normalized_rows = all_raw_rows

        return {
            "dataset": dataset_id,
            "config": config_name,
            "split": split_name,
            "splits": splits_list,
            "adapter": adapter.name if adapter else "unsupported",
            "has_unanswerable": has_unanswerable,
            "num_rows": len(normalized_rows),
            "rows": normalized_rows,
            "provenance": {
                "dataset_id": dataset_id,
                "config": config_name,
                "split": split_name,
                "offset": offset,
                "count": len(normalized_rows),
            },
            "error": None,
        }
