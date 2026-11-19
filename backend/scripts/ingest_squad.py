"""Ingest 200 SQuAD v2 questions into SQLite for local benchmark."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import AsyncSessionLocal, init_db
from app.routes.corpora import load_hub_dataset, LoadDatasetRequest


async def main():
    await init_db()
    async with AsyncSessionLocal() as session:
        res = await load_hub_dataset(
            LoadDatasetRequest(
                dataset_id="rajpurkar/squad_v2",
                split="train",
                count=200,
            ),
            session,
        )
        print("Ingestion result:", res)


if __name__ == "__main__":
    asyncio.run(main())
