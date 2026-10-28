"""FastAPI application entry point — Pramaan AI.

Startup sequence:
1. Load settings (env vars / .env file)
2. Configure structured logging
3. Ensure data directories exist
4. Initialise DB (create tables)
5. Mount routers
6. Register middleware (request IDs, CORS, error handlers)
"""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import corpora, experiments, registry, system
from app.core.config import get_settings
from app.core.errors import PramaanError
from app.core.logging import configure_logging, get_logger, request_id_var
from app.db.session import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    """Startup / shutdown lifecycle."""
    configure_logging(level=settings.log_level, fmt=settings.log_format)
    logger = get_logger("pramaan.startup")
    settings.ensure_dirs()

    mode = "DEMO" if settings.demo_mode else "REAL"
    logger.info("startup", mode=mode, version=settings.app_version)

    await init_db()
    logger.info("db.ready")

    if settings.demo_mode:
        from app.demo.seed import seed_demo_db
        await seed_demo_db()
        logger.info("demo.seeded")

    yield
    logger.info("shutdown")


app = FastAPI(
    title="Pramaan AI",
    description=(
        "Benchmark and reliability platform for RAG systems. "
        "Evidence for every answer. Efficiency for every watt."
    ),
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next: Any) -> Any:  # noqa: ANN401
    rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
    token = request_id_var.set(rid)
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Request-ID"] = rid
    response.headers["X-Response-Time-Ms"] = str(elapsed)
    request_id_var.reset(token)
    return response


# ── Error handlers ────────────────────────────────────────────────────────────

@app.exception_handler(PramaanError)
async def pramaan_error_handler(request: Request, exc: PramaanError) -> JSONResponse:
    rid = request_id_var.get()
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(request_id=rid),
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    rid = request_id_var.get()
    logger = get_logger("pramaan.error")
    logger.exception("unhandled_error", exc_type=type(exc).__name__, request_id=rid)
    return JSONResponse(
        status_code=500,
        content={
            "code": "internal_error",
            "message": "An unexpected error occurred.",
            "hint": "Check server logs.",
            "request_id": rid,
        },
    )


# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(system.router)
app.include_router(registry.router)
app.include_router(corpora.router)
app.include_router(experiments.router)

# ── Demo-mode banner ──────────────────────────────────────────────────────────

if settings.demo_mode:
    @app.middleware("http")
    async def demo_banner_middleware(request: Request, call_next: Any) -> Any:  # noqa: ANN401
        response = await call_next(request)
        response.headers["X-Pramaan-Mode"] = "DEMO-SIMULATED"
        return response
