"""Database connection and session management."""
from __future__ import annotations

import contextlib
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Base

# Ensure SQLite URL is formatted for async: sqlite+aiosqlite:///
db_url = settings.database_url
if db_url.startswith("sqlite:///"):
    db_url = "sqlite+aiosqlite:///" + db_url[len("sqlite:///"): ]
elif db_url.startswith("sqlite://"):
    db_url = "sqlite+aiosqlite://" + db_url[len("sqlite://"): ]

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def init_db() -> None:
    """Create all tables if they don't exist and sync columns."""
    settings.ensure_dirs()
    async with engine.begin() as conn:
        # Enable WAL mode for SQLite
        if "sqlite" in db_url:
            await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
            await conn.exec_driver_sql("PRAGMA synchronous=NORMAL")
        await conn.run_sync(Base.metadata.create_all)

        # Check for missing columns in existing SQLite tables (lightweight sync)
        if "sqlite" in db_url:
            def _sync_columns(connection):
                from sqlalchemy import inspect
                insp = inspect(connection)
                tables = insp.get_table_names()
                for table_name, table in Base.metadata.tables.items():
                    if table_name in tables:
                        existing_cols = {c["name"] for c in insp.get_columns(table_name)}
                        for col in table.columns:
                            if col.name not in existing_cols:
                                col_type = col.type.compile(connection.dialect)
                                default_sql = ""
                                if col.server_default is not None:
                                    default_sql = f" DEFAULT {col.server_default.arg}"
                                connection.execute(
                                    f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_sql}"
                                )
            with contextlib.suppress(Exception):
                await conn.run_sync(_sync_columns)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for injecting an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
