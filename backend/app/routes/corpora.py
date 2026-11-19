"""Corpora, dataset import and synthetic question generation endpoints."""
from __future__ import annotations

import hashlib
import io
import uuid
from typing import Any

import pypdf
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.hf.datasets import get_dataset_splits_and_rows
from app.hf.inference import generate_text
from app.models import AppSettings, Dataset, Document, Question

router = APIRouter(tags=["corpora"])


class ImportDatasetRequest(BaseModel):
    hub_dataset_id: str
    split: str | None = "train"
    num_rows: int = 50


class LoadDatasetRequest(BaseModel):
    dataset_id: str
    split: str | None = "validation"
    count: int = 200


@router.post("/api/corpora/load-dataset")
async def load_hub_dataset(
    req: LoadDatasetRequest,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Downloads sample rows from Hugging Face Datasets Server,
    ingests passages and questions into SQLite, and marks dataset active.
    """
    clean_id = req.dataset_id.replace("/", "_")
    target_name = req.dataset_id
    split_choice = req.split or "validation"

    # 1. Fetch splits and rows
    data = await get_dataset_splits_and_rows(req.dataset_id.strip(), split=split_choice, offset=0, length=req.count)
    rows = data.get("rows", [])

    # If rows empty and split not train, try default/train
    if not rows and split_choice != "train":
        data = await get_dataset_splits_and_rows(req.dataset_id.strip(), split="train", offset=0, length=req.count)
        rows = data.get("rows", [])
        if rows:
            split_choice = "train"

    if not rows:
        raise HTTPException(
            status_code=400,
            detail=data.get("error") or f"No rows returned from Datasets Server for {req.dataset_id} (split: {split_choice})",
        )

    # Clean existing documents and questions for clean_id to avoid unique constraint collisions
    await session.execute(delete(Question).where(Question.dataset_id == clean_id))
    await session.execute(delete(Document).where(Document.dataset_id == clean_id))

    # Create or update Dataset record
    ds_record = await session.get(Dataset, clean_id)
    if not ds_record:
        ds_record = Dataset(
            id=clean_id,
            name=target_name,
            source="hub",
            split=split_choice,
        )
        session.add(ds_record)
    else:
        ds_record.split = split_choice
        ds_record.name = target_name

    docs_count = 0
    q_count = 0
    seen_contexts: dict[str, str] = {}

    for _idx, r in enumerate(rows):
        passage = (
            r.get("context")
            or r.get("passage")
            or r.get("document")
            or r.get("text")
        )
        if not passage and isinstance(r, dict):
            # Pick first large text field if standard context not found
            for k, v in r.items():
                if isinstance(v, str) and len(v.strip()) > 50 and k not in ["id", "question", "query"]:
                    passage = v.strip()
                    break

        if not passage:
            continue

        passage_str = str(passage).strip()
        # Cap document context length to 2,500 chars to avoid memory explosion
        if len(passage_str) > 2500:
            cut = passage_str[:2500]
            last_period = cut.rfind(".")
            passage_str = cut[: last_period + 1] if last_period > 1000 else cut + "..."

        q_text = r.get("question") or r.get("query")
        if not q_text:
            continue

        ans_raw = r.get("answers") or r.get("answer") or ""

        # Normalize answers to deduplicated list
        ans_list: list[str] = []
        if isinstance(ans_raw, dict):
            val = ans_raw.get("value")
            if val and str(val).strip():
                ans_list.append(str(val).strip())
            aliases = ans_raw.get("aliases", [])
            if isinstance(aliases, list):
                for a in aliases:
                    if a and str(a).strip():
                        ans_list.append(str(a).strip())
            raw_text = ans_raw.get("text", [])
            if isinstance(raw_text, list):
                ans_list.extend([str(t).strip() for t in raw_text if str(t).strip()])
            elif isinstance(raw_text, str) and raw_text.strip():
                ans_list.append(raw_text.strip())
        elif isinstance(ans_raw, list):
            ans_list = [str(t).strip() for t in ans_raw if str(t).strip()]
        elif isinstance(ans_raw, str) and ans_raw.strip():
            ans_list = [ans_raw.strip()]

        ans_list = list(dict.fromkeys(ans_list))
        ans_text = " | ".join(ans_list) if ans_list else ""

        if passage_str not in seen_contexts:
            p_hash = hashlib.sha256(passage_str.encode("utf-8")).hexdigest()[:10]
            doc_id = f"doc_{clean_id}_{docs_count}_{p_hash}"
            doc = Document(id=doc_id, dataset_id=clean_id, title=f"Doc {docs_count+1}", content=passage_str)
            session.add(doc)
            seen_contexts[passage_str] = doc_id
            docs_count += 1

        q_str = str(q_text).strip()
        q_hash = hashlib.sha256(q_str.encode("utf-8")).hexdigest()[:10]
        q_id = f"q_{clean_id}_{q_count}_{q_hash}"
        q = Question(
            id=q_id,
            dataset_id=clean_id,
            question=q_str,
            gold_answer=ans_text,
            is_synthetic=False,
        )
        session.add(q)
        q_count += 1

    ds_record.num_docs = docs_count
    ds_record.num_questions = q_count

    # Set as active dataset in AppSettings
    settings_res = await session.execute(select(AppSettings).where(AppSettings.key == "default"))
    app_settings = settings_res.scalar_one_or_none()
    if not app_settings:
        app_settings = AppSettings(key="default", dataset_id=clean_id)
        session.add(app_settings)
    else:
        app_settings.dataset_id = clean_id

    await session.commit()

    return {
        "id": clean_id,
        "name": target_name,
        "source": "hub",
        "split": split_choice,
        "num_docs": docs_count,
        "num_questions": q_count,
        "active": True,
    }


@router.get("/api/datasets/active")
async def get_active_dataset(
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Returns the currently active dataset and question count."""
    settings_res = await session.execute(select(AppSettings).where(AppSettings.key == "default"))
    app_settings = settings_res.scalar_one_or_none()
    ds_id = app_settings.dataset_id if app_settings else None

    if ds_id:
        ds = await session.get(Dataset, ds_id)
        if ds:
            return {
                "id": ds.id,
                "name": ds.name,
                "source": ds.source,
                "split": ds.split,
                "num_docs": ds.num_docs,
                "num_questions": ds.num_questions,
            }

    # Default fallback
    return {
        "id": "default",
        "name": "Core RAG QA Benchmark",
        "source": "built-in",
        "split": "test",
        "num_docs": 1,
        "num_questions": 5,
    }


class GenerateQuestionsRequest(BaseModel):
    dataset_id: str
    language_model: str | None = None
    count: int = 5


@router.post("/api/corpora")
async def create_corpus(
    dataset_name: str | None = Form(None),
    hub_id: str | None = Form(None),
    raw_text: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Upload documents or import from Hugging Face Hub."""
    dataset_id = str(uuid.uuid4())[:8]

    if hub_id and hub_id.strip():
        # Import rows from Hub
        target_name = dataset_name or hub_id
        ds_record = Dataset(
            id=dataset_id,
            name=target_name,
            source="hub",
            split="train",
        )
        session.add(ds_record)

        data = await get_dataset_splits_and_rows(hub_id.strip(), offset=0, length=50)
        rows = data.get("rows", [])
        docs_count = 0
        q_count = 0

        for idx, r in enumerate(rows):
            # Attempt to extract passage and question/answer
            passage = (
                r.get("context")
                or r.get("passage")
                or r.get("document")
                or r.get("text")
                or str(r)
            )
            q_text = r.get("question") or r.get("query")
            ans_text = r.get("answers") or r.get("answer") or ""
            if isinstance(ans_text, dict):
                ans_list = ans_text.get("text", [])
                ans_text = ans_list[0] if ans_list else ""
            elif isinstance(ans_text, list):
                ans_text = ans_text[0] if ans_text else ""

            doc_id = f"doc_{dataset_id}_{idx}"
            doc = Document(id=doc_id, dataset_id=dataset_id, title=f"Doc {idx+1}", content=str(passage))
            session.add(doc)
            docs_count += 1

            if q_text:
                q = Question(
                    id=str(uuid.uuid4())[:8],
                    dataset_id=dataset_id,
                    question=str(q_text),
                    gold_answer=str(ans_text),
                    is_synthetic=False,
                )
                session.add(q)
                q_count += 1

        ds_record.num_docs = docs_count
        ds_record.num_questions = q_count
        await session.commit()

        return {
            "id": dataset_id,
            "name": target_name,
            "source": "hub",
            "num_docs": docs_count,
            "num_questions": q_count,
        }

    # Handle file uploads
    name = dataset_name or "Uploaded Dataset"
    ds_record = Dataset(id=dataset_id, name=name, source="upload", split="custom")
    session.add(ds_record)

    # Handle raw text paste
    if raw_text and raw_text.strip() and not files:
        doc = Document(id=f"doc_{dataset_id}_0", dataset_id=dataset_id, title=name, content=raw_text.strip())
        session.add(doc)
        ds_record.num_docs = 1
        ds_record.num_questions = 0
        await session.commit()
        return {
            "id": dataset_id,
            "name": name,
            "source": "text",
            "num_docs": 1,
            "num_questions": 0,
        }

    docs_count = 0
    for upload in files:
        content_bytes = await upload.read()
        filename = upload.filename or "file.txt"
        text = ""

        if filename.lower().endswith(".pdf"):
            try:
                reader = pypdf.PdfReader(io.BytesIO(content_bytes))
                pages_text = [page.extract_text() or "" for page in reader.pages]
                text = "\n\n".join(pages_text)
            except Exception as e:
                text = f"Could not parse PDF: {str(e)}"
        else:
            text = content_bytes.decode("utf-8", errors="replace")

        if text.strip():
            doc_id = f"doc_{dataset_id}_{docs_count}"
            doc = Document(id=doc_id, dataset_id=dataset_id, title=filename, content=text)
            session.add(doc)
            docs_count += 1

    ds_record.num_docs = docs_count
    ds_record.num_questions = 0
    await session.commit()

    return {
        "id": dataset_id,
        "name": name,
        "source": "upload",
        "num_docs": docs_count,
        "num_questions": 0,
    }


@router.post("/api/questions/generate")
async def generate_synthetic_questions(
    req: GenerateQuestionsRequest,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Generate synthetic questions and gold answers from corpus documents."""
    result = await session.execute(
        select(Document).where(Document.dataset_id == req.dataset_id).limit(req.count)
    )
    docs = result.scalars().all()
    if not docs:
        return {"error": "No documents found in dataset.", "generated": 0}

    generated_questions = []
    lm = req.language_model
    if not lm:
        from app.models import AppSettings
        settings_res = await session.execute(select(AppSettings).where(AppSettings.key == "default"))
        app_settings = settings_res.scalar_one_or_none()
        lm = app_settings.language_model if app_settings else None
    if not lm:
        return {"error": "No language model configured. Choose one in setup drawer or specify in request.", "generated": 0}

    for doc in docs:
        prompt = (
            f"Based on the following text, write one concise factual question and its short exact answer.\n\n"
            f"Text:\n{doc.content[:1000]}\n\n"
            f"Output format:\nQuestion: <question>\nAnswer: <answer>"
        )
        res = await generate_text(model_id=lm, prompt=prompt, max_tokens=64)
        output = res.get("text", "")

        q_val = ""
        a_val = ""
        for line in output.split("\n"):
            if line.lower().startswith("question:"):
                q_val = line[len("question:"):].strip()
            elif line.lower().startswith("answer:"):
                a_val = line[len("answer:"):].strip()

        if q_val:
            q_obj = Question(
                id=str(uuid.uuid4())[:8],
                dataset_id=req.dataset_id,
                question=q_val,
                gold_answer=a_val,
                is_synthetic=True,
            )
            session.add(q_obj)
            generated_questions.append({
                "id": q_obj.id,
                "question": q_val,
                "gold_answer": a_val,
                "is_synthetic": True,
            })

    # Update dataset question count
    ds_res = await session.execute(select(Dataset).where(Dataset.id == req.dataset_id))
    ds = ds_res.scalar_one_or_none()
    if ds:
        ds.num_questions += len(generated_questions)

    await session.commit()

    return {
        "dataset_id": req.dataset_id,
        "generated": len(generated_questions),
        "questions": generated_questions,
        "source": "Synthetic, not verified",
    }


class SuggestQuestionsRequest(BaseModel):
    dataset_id: str | None = None
    document_text: str | None = None
    language_model: str | None = None


@router.post("/api/questions/suggest")
async def suggest_questions_for_document(
    req: SuggestQuestionsRequest,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Generate 3 candidate test questions from document using active LLM."""
    lm = req.language_model
    if not lm:
        from app.models import AppSettings
        settings_res = await session.execute(select(AppSettings).where(AppSettings.key == "default"))
        app_settings = settings_res.scalar_one_or_none()
        lm = app_settings.language_model if app_settings else None

    if not lm:
        return {"questions": []}

    content = req.document_text or ""
    if not content and req.dataset_id:
        doc_res = await session.execute(
            select(Document).where(Document.dataset_id == req.dataset_id).limit(1)
        )
        doc = doc_res.scalar_one_or_none()
        if doc:
            content = doc.content

    if not content:
        content = "Retrieval-Augmented Generation combines dense vector retrieval with language models to improve factual accuracy."

    prompt = (
        f"Read this document and output exactly 3 concise factual questions about it:\n\n"
        f"{content[:1200]}\n\n"
        f"Format:\n1. <question>\n2. <question>\n3. <question>"
    )
    res = await generate_text(model_id=req.language_model, prompt=prompt, max_tokens=100)
    lines = [item.strip() for item in res.get("text", "").split("\n") if item.strip()]
    questions = []
    for item in lines:
        cleaned = item
        for prefix in ["1.", "2.", "3.", "1)", "2)", "3)", "- ", "* "]:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
        if cleaned and ("?" in cleaned or len(cleaned) > 15):
            questions.append(cleaned)

    if len(questions) < 3:
        sentences = [s.strip() for s in content.split(".") if len(s.strip()) > 20]
        if sentences:
            questions.append(f"What does the document state regarding {sentences[0][:40].lower()}?")
        if len(sentences) > 1:
            questions.append(f"How is {sentences[1][:40].lower()} described in the document?")
        questions.append("What is the primary topic explained in this document?")

    return {
        "questions": questions[:3],
        "label": "Suggested by AI, not verified",
    }
