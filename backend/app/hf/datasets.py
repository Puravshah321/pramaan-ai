"""Hugging Face Datasets API and Datasets Server client."""
from __future__ import annotations

import httpx
from typing import Any
from app.config import settings

HF_API_BASE = "https://huggingface.co/api"
DATASETS_SERVER_BASE = "https://datasets-server.huggingface.co"


def _get_headers() -> dict[str, str]:
    headers = {"User-Agent": "PramaanAI/0.1.0"}
    if settings.hf_token and settings.hf_token.strip():
        headers["Authorization"] = f"Bearer {settings.hf_token.strip()}"
    return headers


async def search_datasets(query: str, limit: int = 20) -> list[dict[str, Any]]:
    """Search datasets on Hugging Face Hub."""
    params: dict[str, Any] = {
        "sort": "downloads",
        "direction": -1,
        "limit": limit,
    }
    if query.strip():
        params["search"] = query.strip()

    url = f"{HF_API_BASE}/datasets"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, params=params, headers=_get_headers())
            if resp.status_code != 200:
                return []
            raw = resp.json()
        except Exception:
            return []

    results = []
    for d in raw:
        dataset_id = d.get("id")
        if not dataset_id:
            continue
        results.append({
            "id": dataset_id,
            "downloads": d.get("downloads", 0),
            "likes": d.get("likes", 0),
            "tags": d.get("tags", []),
            "author": d.get("author", ""),
        })
    return results


async def get_dataset_splits_and_rows(
    dataset_id: str,
    offset: int = 0,
    length: int = 10,
) -> dict[str, Any]:
    """Fetch splits and sample rows from Hugging Face Datasets Server."""
    headers = _get_headers()

    # 1. Fetch splits
    splits_url = f"{DATASETS_SERVER_BASE}/splits?dataset={dataset_id}"
    config_name = "default"
    split_name = "train"

    async with httpx.AsyncClient(timeout=12.0) as client:
        try:
            resp_splits = await client.get(splits_url, headers=headers)
            if resp_splits.status_code == 200:
                splits_data = resp_splits.json()
                splits_list = splits_data.get("splits", [])
                if splits_list:
                    config_name = splits_list[0].get("config", "default")
                    split_name = splits_list[0].get("split", "train")
        except Exception:
            pass

        # 2. Fetch rows
        rows_url = f"{DATASETS_SERVER_BASE}/rows"
        params = {
            "dataset": dataset_id,
            "config": config_name,
            "split": split_name,
            "offset": offset,
            "length": length,
        }

        try:
            resp_rows = await client.get(rows_url, params=params, headers=headers)
            if resp_rows.status_code == 200:
                data = resp_rows.json()
                rows = [r.get("row", {}) for r in data.get("rows", [])]
                features = [f.get("feature", {}) for f in data.get("features", [])]
                return {
                    "dataset": dataset_id,
                    "config": config_name,
                    "split": split_name,
                    "rows": rows,
                    "features": features,
                    "num_rows_per_page": len(rows),
                    "error": None,
                }
            else:
                return {
                    "dataset": dataset_id,
                    "rows": [],
                    "error": f"Datasets server returned HTTP {resp_rows.status_code}: {resp_rows.text[:120]}",
                }
        except Exception as e:
            return {
                "dataset": dataset_id,
                "rows": [],
                "error": f"Failed to connect to Datasets Server: {str(e)}",
            }
