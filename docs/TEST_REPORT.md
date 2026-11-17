# Pramaan AI Test Report

**Date:** 2026-11-17  
**Status:** All 57 Tests Passed (0 Failures, 0 Regressions)

---

## 1. Executive Summary

| Test Suite | Framework | Total Tests | Passed | Failed | Status |
|:---|:---|:---:|:---:|:---:|:---:|
| Backend Endpoints (`test_endpoints.py`) | Pytest / AnyIO | 6 | 6 | 0 | PASS |
| Backend Pipeline (`test_pipeline.py`) | Pytest | 5 | 5 | 0 | PASS |
| Backend Live Hugging Face (`test_live_hf.py`) | Pytest / AnyIO | 4 | 4 | 0 | PASS |
| Frontend Pages & Visual Audits (`pages.spec.ts`) | Playwright | 14 | 14 | 0 | PASS |
| Frontend Anti-Placeholder Check (`static_check.spec.ts`) | Playwright | 2 | 2 | 0 | PASS |
| Frontend Home Redesign (`home.spec.ts`) | Playwright | 4 | 4 | 0 | PASS |
| Frontend Benchmark Flow (`benchmark.spec.ts`) | Playwright | 4 | 4 | 0 | PASS |
| Frontend Recommendation (`recommend.spec.ts`) | Playwright | 2 | 2 | 0 | PASS |
| Frontend Try It Flow (`try_it.spec.ts`) | Playwright | 2 | 2 | 0 | PASS |
| Frontend WCAG Accessibility (`accessibility.spec.ts`) | Playwright / Axe-core | 14 | 14 | 0 | PASS |
| **Total** | | **57** | **57** | **0** | **100% PASS** |

---

## 2. Backend Suite Details

### `backend/tests/test_endpoints.py` (6 passed)
- `test_health_endpoints`: Asserts HTTP 200 on `/health` and live router connectivity.
- `test_stats_endpoint`: Verifies live calculation of `documents_indexed`, `questions_answered`, `setups_measured`, and `api_calls_made`.
- `test_setup_endpoints`: Verifies retrieval of active configuration (`embedding_model`, `language_model`, `quantization`) and valid configuration updates.
- `test_showcase_latest`: Verifies that `GET /api/showcase/latest` returns live real showcase entries with schema compliance (title, excerpt, highlight span, question, answer, badge).
- `test_recommend_endpoint`: Evaluates Pareto-optimal configuration recommendation based on memory and latency constraints.
- `test_ask_endpoint_validation`: Validates HTTP 422 on empty or invalid inputs and confirms pipeline rejects ungrounded queries.

### `backend/tests/test_pipeline.py` (5 passed)
- `test_chunking_size_and_overlap`: Confirms deterministic word chunking and sliding overlap guarantees across document lengths.
- `test_eval_metrics_exact_values`: Tests exact match (EM), token F1, and retrieval recall computations against ground truth strings.
- `test_latency_timer_monotonicity`: Asserts monotonic timer measurements for inference latency tracking.
- `test_reliability_features_in_range`: Verifies feature extraction boundaries: `top_sim` $\in [0, 1]$, `gap` $\ge 0$, `lexical_support` $\in [0, 1]$, and binary `idk_flag`.
- `test_question_split_no_leakage`: Tests question-level dataset splitting ensuring zero passage overlap between train and test folds.

### `backend/tests/test_live_hf.py` (4 passed)
- `test_hub_model_search`: Queries Hugging Face Hub API for embeddings (`sentence-transformers/all-MiniLM-L6-v2`) and verifies metadata schema.
- `test_hub_model_details`: Validates parameter count extraction and model architecture details.
- `test_datasets_server_rows`: Fetches live sample rows from the Hugging Face Datasets Server (`rajpurkar/squad_v2`).
- `test_inference_embed_and_generate`: Validates live token authorization and tests embedding computation via InferenceClient.

---

## 3. Frontend Suite Details

### `frontend/e2e/pages.spec.ts` (14 passed)
Every of the 7 primary routes was loaded and verified at desktop (1440x900) and mobile (390x844) viewports:
- `/` (Home)
- `/guide` (Guide)
- `/models` (Models)
- `/benchmark` (Benchmark)
- `/results` (Results)
- `/recommend` (Recommend)
- `/try-it` (Try It)

Criteria met:
- **Zero console errors** (`console.error` listeners).
- **Zero failed network requests** (HTTP $\ge 400$).
- 14 full-page screenshots saved to `docs/images/`:
  - `home-desktop.png`, `home-mobile.png`
  - `guide-desktop.png`, `guide-mobile.png`
  - `models-desktop.png`, `models-mobile.png`
  - `benchmark-desktop.png`, `benchmark-mobile.png`
  - `results-desktop.png`, `results-mobile.png`
  - `recommend-desktop.png`, `recommend-mobile.png`
  - `try-it-desktop.png`, `try-it-mobile.png`

### `frontend/e2e/static_check.spec.ts` (2 passed)
Scans the built frontend production bundle to verify that forbidden placeholder tokens ("simulated", "dummy", "lorem ipsum", etc.) do not appear in any user-facing rendered UI copy.

### `frontend/e2e/home.spec.ts` (4 passed)
- Verifies editorial hero typography: Fraunces headline, DM Sans body, accent "trust".
- Verifies Live Evidence Card with document highlight sweep and typewriter answer effect.
- Verifies active setup line and slide-out setup drawer.
- Verifies 600ms count-up live statistics strip.

### `frontend/e2e/benchmark.spec.ts` (4 passed)
- Verifies 3-step setup (Corpus, Hardware, Run).
- Verifies Quick, Balanced, and Custom presets.
- Verifies live progress updates streamed from backend.
- Verifies clean cancellation handling without orphaned processes.

### `frontend/e2e/recommend.spec.ts` (2 passed)
- Verifies interactive sliders for latency and memory limits.
- Verifies winning Pareto card updates and dynamic "Why this won" explanation.

### `frontend/e2e/try_it.spec.ts` (2 passed)
- Verifies document selection (SQuAD v2 example, file upload, paste).
- Verifies AI suggested test questions.
- Verifies answer generation, source passage highlight, and reliability badge.

### `frontend/e2e/accessibility.spec.ts` (14 passed)
Axe-core accessibility audit across all 7 pages on desktop and mobile:
- **Zero critical violations** across all routes.
- Fully labeled form elements (`aria-label`, `label`).
- Accessible semantic headings, landmarks, and high-contrast color hierarchy.

---

## 4. Verification Environment

- **Operating System:** Windows 11 (build 26100)
- **Node.js:** v22.14.0
- **Python:** 3.13.5
- **Playwright:** v1.58.2
- **Axe-Core:** v4.14
- **FastAPI / Uvicorn:** running on `127.0.0.1:8000`
- **Vite:** running on `localhost:5173`
