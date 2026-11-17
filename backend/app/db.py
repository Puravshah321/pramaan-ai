"""Database connection and session management."""
from __future__ import annotations

from typing import AsyncGenerator
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
    """Create all tables if they don't exist."""
    settings.ensure_dirs()
    async with engine.begin() as conn:
        # Enable WAL mode for SQLite
        if "sqlite" in db_url:
            await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
            await conn.exec_driver_sql("PRAGMA synchronous=NORMAL")
        await conn.run_sync(Base.metadata.create_all)


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
