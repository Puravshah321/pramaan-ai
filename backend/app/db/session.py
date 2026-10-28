"""Async database session management.

Uses SQLAlchemy 2 async engine with SQLite WAL mode for concurrent reads.
Real and demo databases are separate files — they can never share data.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.db.models import Base

_engines: dict[str, Any] = {}  # type: ignore[type-arg]
_session_factories: dict[str, Any] = {}  # type: ignore[type-arg]

from typing import Any


def _get_engine(url: str) -> Any:  # noqa: ANN401
    if url not in _engines:
        engine = create_async_engine(
            url,
            echo=get_settings().db_echo,
            connect_args={"check_same_thread": False},
        )
        _engines[url] = engine
    return _engines[url]


def _get_factory(url: str) -> async_sessionmaker[AsyncSession]:
    if url not in _session_factories:
        _session_factories[url] = async_sessionmaker(
            _get_engine(url),
            expire_on_commit=False,
            class_=AsyncSession,
        )
    return _session_factories[url]


async def init_db() -> None:
    """Create all tables. Called once at startup for both real and demo DBs."""
    settings = get_settings()
    for url in {settings.get_database_url()}:
        engine = _get_engine(url)
        # Enable WAL mode for SQLite
        async with engine.connect() as conn:
            await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
            await conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yield a scoped DB session."""
    settings = get_settings()
    factory = _get_factory(settings.get_database_url())
    async with factory() as session:
        yield session


# FastAPI annotated dependency alias
DbSession = Annotated[AsyncSession, Depends(get_session)]
