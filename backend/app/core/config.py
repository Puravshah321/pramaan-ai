"""Pramaan AI — application settings.

All configuration comes from environment variables (or a .env file).
No secrets in code. No hard-coded paths.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide settings resolved from env vars / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App identity ────────────────────────────────────────────────────────
    app_name: str = "Pramaan AI"
    app_version: str = "0.1.0"
    environment: Literal["development", "production", "test"] = "development"

    # ── Operational mode ────────────────────────────────────────────────────
    demo_mode: bool = Field(default=False, alias="DEMO")
    """When True, all real backends are swapped for deterministic simulators."""

    # ── Paths ───────────────────────────────────────────────────────────────
    project_root: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parents[3]
    )

    @property
    def data_dir(self) -> Path:
        return self.project_root / "data"

    @property
    def configs_dir(self) -> Path:
        return self.project_root / "configs"

    @property
    def models_dir(self) -> Path:
        return self.data_dir / "models"

    @property
    def corpora_dir(self) -> Path:
        return self.data_dir / "corpora"

    @property
    def indexes_dir(self) -> Path:
        return self.data_dir / "indexes"

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"

    # ── Database ────────────────────────────────────────────────────────────
    database_url: str = Field(
        default_factory=lambda: "sqlite+aiosqlite:///./data/pramaan.db"
    )
    demo_database_url: str = Field(
        default_factory=lambda: "sqlite+aiosqlite:///./data/pramaan_demo.db"
    )
    db_echo: bool = False

    # ── API ─────────────────────────────────────────────────────────────────
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    upload_max_bytes: int = 50 * 1024 * 1024  # 50 MB
    upload_max_pages: int = 500

    # ── Telemetry ───────────────────────────────────────────────────────────
    telemetry_sample_hz: int = 20  # memory sampled at 20 Hz
    enable_energy_measurement: bool = True

    # ── Determinism ─────────────────────────────────────────────────────────
    global_seed: int = 42

    # ── Logging ─────────────────────────────────────────────────────────────
    log_level: str = "INFO"
    log_format: Literal["json", "text"] = "json"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    def get_database_url(self) -> str:
        self.ensure_dirs()
        url = self.demo_database_url if self.demo_mode else self.database_url
        if url.startswith("sqlite+aiosqlite:///./data/"):
            db_name = url.split("/")[-1]
            return f"sqlite+aiosqlite:///{self.data_dir.as_posix()}/{db_name}"
        return url

    def ensure_dirs(self) -> None:
        """Create all required data directories at startup."""
        for d in [
            self.data_dir,
            self.models_dir,
            self.corpora_dir,
            self.indexes_dir,
            self.cache_dir,
        ]:
            d.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the singleton settings instance."""
    return Settings()


# Convenience alias used in FastAPI dependency injection
def settings_dep() -> Settings:
    return get_settings()
