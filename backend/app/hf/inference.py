"""Hugging Face Inference client with InferenceClient, rate limit handling, and local runner fallback."""
from __future__ import annotations

import asyncio
import time
from typing import Any, Optional
from huggingface_hub import InferenceClient
from huggingface_hub.errors import HfHubHTTPError, BadRequestError

from app.config import settings


def _get_client() -> InferenceClient:
    token = settings.hf_token.strip() if settings.hf_token else None
    return InferenceClient(token=token, timeout=30.0)


async def generate_text(
    model_id: str,
    prompt: str,
    system_prompt: Optional[str] = None,
    max_tokens: int = 64,
    temperature: float = 0.0,
    max_retries: int = 2,
) -> dict[str, Any]:
    """Call Hugging Face inference for text generation via InferenceClient or OpenAI router endpoint."""
    client = _get_client()
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    delay = 1.0
    last_err: Optional[str] = None

    for attempt in range(max_retries):
        t0 = time.perf_counter()
        try:
            # 1. Attempt InferenceClient chat_completion
            response = client.chat_completion(
                messages=messages,
                model=model_id,
                max_tokens=max_tokens,
                temperature=temperature if temperature > 0 else None,
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000
            content = ""
            if response.choices:
                content = response.choices[0].message.content or ""
            tokens = len(content.split())
            if hasattr(response, "usage") and response.usage:
                tokens = response.usage.completion_tokens or tokens

            return {
                "text": content.strip(),
                "latency_ms": round(elapsed_ms, 2),
                "tokens": tokens,
                "error": None,
                "source": "api",
            }

        except HfHubHTTPError as e:
            status = getattr(e.response, "status_code", None)
            if status in [429, 503]:
                last_err = f"Waiting for the API (rate limit / cold start HTTP {status})"
                await asyncio.sleep(delay)
                delay *= 2
                continue
            elif status == 402:
                last_err = "Hugging Face API returned HTTP 402: Payment or inference credits required. Set a valid HF_TOKEN in backend/.env."
                break
            elif status in [401, 403]:
                last_err = f"Hugging Face API returned HTTP {status}: Authentication required. Please add a valid read HF_TOKEN to backend/.env."
                break
            else:
                last_err = f"Hugging Face API error: {str(e)[:150]}"
                break
        except BadRequestError as e:
            last_err = f"Model not supported by remote inference provider: {str(e)[:120]}"
            break
        except Exception as e:
            last_err = f"API request error: {str(e)[:150]}"
            break

    # If remote API call fails and local runner is enabled, run extractive prompt-answering locally
    if settings.local_runner:
        t_local_0 = time.perf_counter()
        # Heuristic local extraction from prompt context
        context_body = prompt
        if "Context:" in prompt and "Question:" in prompt:
            parts = prompt.split("Question:")
            context_body = parts[0].replace("Context:", "").strip()
            q_part = parts[1].replace("Answer concisely:", "").strip()
        else:
            q_part = prompt

        # Look for salient answer sentence matching query keywords
        q_words = [w.lower() for w in q_part.split() if len(w) > 3]
        best_sentence = "I don't know."
        sentences = [s.strip() for s in context_body.split(".") if len(s.strip()) > 5]
        max_overlap = 0

        for s in sentences:
            overlap = sum(1 for w in q_words if w in s.lower())
            if overlap > max_overlap:
                max_overlap = overlap
                best_sentence = s + "."

        t_local_1 = time.perf_counter()
        local_ms = (t_local_1 - t_local_0) * 1000

        return {
            "text": best_sentence,
            "latency_ms": round(local_ms, 2),
            "tokens": len(best_sentence.split()),
            "error": last_err,  # Preserves the API failure note
            "source": "local",
        }

    return {
        "text": "",
        "latency_ms": 0.0,
        "tokens": 0,
        "error": last_err or "Inference call failed",
        "source": "api",
    }


async def compute_embeddings(
    model_id: str,
    texts: list[str],
    max_retries: int = 2,
) -> dict[str, Any]:
    """Compute dense embeddings for a list of texts via InferenceClient or local feature extraction."""
    if not texts:
        return {"embeddings": [], "latency_ms": 0.0, "error": None, "source": "api"}

    client = _get_client()
    delay = 1.0
    last_err: Optional[str] = None

    for attempt in range(max_retries):
        t0 = time.perf_counter()
        try:
            res = client.feature_extraction(texts, model=model_id)
            elapsed_ms = (time.perf_counter() - t0) * 1000

            # Convert numpy/tensor to list of vectors
            import numpy as np
            arr = np.array(res, dtype=np.float32)
            if arr.ndim == 3:
                # (batch, seq, dim) -> mean pool over seq length
                arr = arr.mean(axis=1)
            elif arr.ndim == 1:
                arr = arr.reshape(1, -1)

            return {
                "embeddings": arr.tolist(),
                "latency_ms": round(elapsed_ms, 2),
                "error": None,
                "source": "api",
            }
        except HfHubHTTPError as e:
            status = getattr(e.response, "status_code", None)
            if status in [429, 503]:
                last_err = f"Waiting for the API (rate limit HTTP {status})"
                await asyncio.sleep(delay)
                delay *= 2
                continue
            elif status == 402:
                last_err = "Hugging Face API returned HTTP 402: Credits required. Add HF_TOKEN to backend/.env."
                break
            elif status in [401, 403]:
                last_err = f"Hugging Face API returned HTTP {status}: Add valid HF_TOKEN to backend/.env."
                break
            else:
                last_err = f"Embedding error: {str(e)[:150]}"
                break
        except Exception as e:
            last_err = f"Embeddings error: {str(e)[:150]}"
            break

    # If remote API call fails and local runner is enabled, compute local TF-IDF / dense hash representation
    if settings.local_runner:
        t_local_0 = time.perf_counter()
        import numpy as np
        from sklearn.feature_extraction.text import HashingVectorizer

        vectorizer = HashingVectorizer(n_features=384, alternate_sign=False, norm="l2")
        sparse_mat = vectorizer.transform(texts)
        dense_vecs = sparse_mat.toarray().astype(np.float32).tolist()
        t_local_1 = time.perf_counter()
        local_ms = (t_local_1 - t_local_0) * 1000

        return {
            "embeddings": dense_vecs,
            "latency_ms": round(local_ms, 2),
            "error": last_err,
            "source": "local",
        }

    return {
        "embeddings": [],
        "latency_ms": 0.0,
        "error": last_err or "Embedding computation failed",
        "source": "api",
    }
