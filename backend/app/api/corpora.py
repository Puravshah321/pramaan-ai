"""Corpora router — file upload and corpus management.

Phase 1: scaffold only (upload endpoint wired, parsing deferred to Phase 2).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import UploadError
from app.core.hashing import sha256_bytes
from app.core.logging import get_logger
from app.db.models import Corpus, Document
from app.db.session import DbSession

logger = get_logger(__name__)
router = APIRouter(prefix="/api/corpora", tags=["corpora"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/html",
}

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".html"}


class CorpusCreate(BaseModel):
    name: str
    description: str = ""


class CorpusOut(BaseModel):
    id: str
    name: str
    description: str
    doc_count: int
    content_hash: str | None


@router.post("", status_code=201)
async def create_corpus(body: CorpusCreate, db: DbSession) -> CorpusOut:
    corpus = Corpus(name=body.name, description=body.description)
    db.add(corpus)
    await db.commit()
    await db.refresh(corpus)
    logger.info("corpus.created", corpus_id=corpus.id, name=corpus.name)
    return CorpusOut(
        id=corpus.id,
        name=corpus.name,
        description=corpus.description,
        doc_count=0,
        content_hash=None,
    )


@router.get("")
async def list_corpora(db: DbSession) -> list[CorpusOut]:
    result = await db.execute(select(Corpus))
    corpora = result.scalars().all()
    return [
        CorpusOut(
            id=c.id,
            name=c.name,
            description=c.description,
            doc_count=c.doc_count,
            content_hash=c.content_hash,
        )
        for c in corpora
    ]


@router.get("/{corpus_id}")
async def get_corpus(corpus_id: str, db: DbSession) -> CorpusOut:
    corpus = await db.get(Corpus, corpus_id)
    if not corpus:
        raise HTTPException(status_code=404, detail="Corpus not found")
    return CorpusOut(
        id=corpus.id,
        name=corpus.name,
        description=corpus.description,
        doc_count=corpus.doc_count,
        content_hash=corpus.content_hash,
    )


@router.post("/{corpus_id}/documents", status_code=202)
async def upload_document(
    corpus_id: str,
    file: UploadFile,
    db: DbSession,
) -> dict:
    """Accept a file upload, validate it, store metadata.

    Actual parsing is done asynchronously (Phase 2).
    Phase 1: validates and stores a Document record with parse_status=pending.
    """
    settings = get_settings()
    corpus = await db.get(Corpus, corpus_id)
    if not corpus:
        raise HTTPException(status_code=404, detail="Corpus not found")

    # Security: validate by extension (magic-byte check in Phase 2)
    suffix = ""
    if file.filename:
        from pathlib import Path
        suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise UploadError(
            f"File type '{suffix}' is not allowed.",
            hint=f"Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Read and size-check
    content = await file.read()
    if len(content) > settings.upload_max_bytes:
        raise UploadError(
            f"File exceeds {settings.upload_max_bytes // (1024*1024)} MB limit.",
            hint="Split large files or increase the upload_max_bytes setting.",
        )

    file_hash = sha256_bytes(content)
    mime = file.content_type or "application/octet-stream"

    # Store to disk (corpus directory)
    corpus_path = settings.corpora_dir / corpus_id
    corpus_path.mkdir(parents=True, exist_ok=True)
    dest = corpus_path / f"{file_hash}{suffix}"
    dest.write_bytes(content)

    # Upsert Document record
    doc = Document(
        corpus_id=corpus_id,
        filename=file.filename or "unknown",
        mime_type=mime,
        sha256=file_hash,
        size_bytes=len(content),
        parse_status="pending",
    )
    db.add(doc)
    corpus.doc_count = (corpus.doc_count or 0) + 1
    await db.commit()
    await db.refresh(doc)

    logger.info("document.uploaded", doc_id=doc.id, corpus_id=corpus_id, sha256=file_hash)
    return {
        "document_id": doc.id,
        "sha256": file_hash,
        "size_bytes": len(content),
        "parse_status": "pending",
        "message": "File accepted. Parsing is queued (Phase 2).",
    }
