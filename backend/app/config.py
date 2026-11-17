"""Configuration settings loaded from .env."""
from __future__ import annotations

import os
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    hf_token: str = Field(default="", alias="HF_TOKEN")
    database_url: str = Field(default="sqlite:///./pramaan.db", alias="DATABASE_URL")
    local_runner: bool = Field(default=True, alias="LOCAL_RUNNER")
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # Paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    data_dir: Path = base_dir.parent / "data"
    indexes_dir: Path = data_dir / "indexes"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.indexes_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
