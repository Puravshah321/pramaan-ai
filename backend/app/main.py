"""FastAPI application entry point for Pramaan AI."""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import init_db
from app.routes import (
    corpora,
    health,
    hf,
    recommend,
    reliability,
    results,
    runs,
    setup,
    stats,
    try_it,
    showcase,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_dirs()
    await init_db()
    yield


app = FastAPI(
    title="Pramaan AI",
    description="Benchmark and reliability platform for RAG on resource-constrained hardware.",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_timing_middleware(request: Request, call_next: Any) -> Any:
    rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Request-ID"] = rid
    response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
    return response


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
    return JSONResponse(
        status_code=500,
        content={
            "error": "Server error",
            "message": str(exc),
            "hint": "Check the backend logs or verify network connectivity.",
            "request_id": rid,
        },
    )


# Mount all routers
app.include_router(health.router)
app.include_router(hf.router)
app.include_router(setup.router)
app.include_router(corpora.router)
app.include_router(runs.router)
app.include_router(results.router)
app.include_router(reliability.router)
app.include_router(recommend.router)
app.include_router(try_it.router)
app.include_router(stats.router)
app.include_router(showcase.router)
