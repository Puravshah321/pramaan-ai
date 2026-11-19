# PROGRESS.md

## Iteration Number: 3 (REDESIGN v8: Event Loop Concurrency, Dual-Stack Networking, Robust Dataset Adapters & Result Filtering)
**Current Stage:** Verification & Complete

### Done vs Missing Table (All Bugs E1 – E12 & Local Runner Stability Resolved)

| Bug / Component | Description | Status | Verification & Resolution Details |
|:---|:---|:---:|:---|
| **E1** | Dataset ingest 500 error (`UNIQUE constraint failed: documents.id`) | **DONE** | In `backend/app/routes/corpora.py`, added atomic deletion of prior `Question` and `Document` rows matching `clean_id` before inserting, and generated content-hashed unique primary keys (`doc_{clean_id}_{idx}_{p_hash}`). Verified with clean ingestion of SQuAD v2.0 validation split. |
| **E2** | Duplicate answers in preview (e.g. `France,France,France`) | **DONE** | In `backend/app/hf/datasets.py` and `frontend/src/pages/Models.tsx`, deduplicated answers using `list(dict.fromkeys(answer_texts))`. Empty answers display `"No answer in the passage (unanswerable)"`. |
| **E3** | Ingestion dialog defaults to `train` split | **DONE** | In `frontend/src/pages/Models.tsx`, default `selectedSplit` initialized to `"validation"`, with clear explanation: `"Defaults to validation split for honest benchmark evaluation"`. Dynamically passed to `fetchDatasetRows`. |
| **E4** | "Start benchmark run" fails with 500 error | **DONE** | Created schema migration and updated `backend/app/db.py` to auto-inspect and sync columns (`job_type`, `progress`, `message`, `payload_json`, `result_json`). Jobs enqueue, execute, and stream status cleanly. |
| **E5** | Benchmark says "All setups fit within 4 GB" | **DONE** | In `frontend/src/pages/Benchmark.tsx`, dynamically bound `memoryLimitGb` to detected GPU budget from `/api/hardware` (`4.9 GB` for detected RTX 4050 6GB), showing explicit source attribution (`"Source: Auto-detected NVIDIA GeForce RTX 4050 Laptop GPU (4.9 GB budget)"`). |
| **E6** | Estimated benchmark duration invented (`~0.2 min (10s)`) | **DONE** | In `backend/app/routes/runs.py` (`preview_run`), replaced hardcoded `0.5s` multiplier with SQLite query for historical median latency of the model. When unmeasured, returns `null` and displays `"Unknown until the first run"`. |
| **E7** | Latency values displayed as `2198.395 s` | **DONE** | In `frontend/src/components/MetricValue.tsx`, latency passed in ms is formatted dynamically: `< 1000 ms` as integer `X ms`, and `≥ 1000 ms` as `(X / 1000).toFixed(2) s`. Tested across Desktop and Mobile viewports. |
| **E8** | Results rows labeled "API latency" | **DONE** | In `MetricValue.tsx`, changed latency source label to `"Local latency"` and updated `Results.tsx` to pass `source="local"`. No misleading "API" claims in local-only mode. |
| **E9** | Unrounded floats for F1 (`0.3641902418187247`) | **DONE** | In `MetricValue.tsx`, defaulted all floating-point evaluation metrics to 3 decimal places (`toFixed(3)`). |
| **E10** | Peak Memory mixes Estimated and Measured; 220 MB anomaly | **DONE** | Added audit rule in `scripts/audit_runs.py` flagging runs with `< 250 MB` memory as contaminated (idle DWM baseline artifact). In `Results.tsx`, separated and labelled `RAM (RSS)` and `VRAM (pynvml)`. |
| **E11** | Identical configurations listed repeatedly | **DONE** | In `backend/app/routes/results.py`, implemented repeat aggregation by `config_hash`. Returns mean $\pm$ standard deviation across repeats (`repeats: N`, `f1_std`, `latency_p50_std`). In `frontend/src/pages/Results.tsx`, added "Aggregate repeats" toggle and `N={row.repeats}` badge. |
| **E12** | Results table missing Dataset, Embedder, and LM columns | **DONE** | In `frontend/src/pages/Results.tsx`, added explicit Dataset, Model, Embedder, Configuration, and Repeats columns, along with a dataset filter dropdown. |
| **S7** | Results page checkboxes freeze UI / reload spinner hangs | **DONE** | Replaced synchronous llama-cpp calls with non-blocking threaded execution (`asyncio.to_thread`), batching embeddings in groups of 16 with cooperative event loop yielding. Added `placeholderData: (previousData) => previousData` in `Results.tsx` so checkbox toggling never unmounts or vanishes the table. |
| **S8** | Ingestion of live hub datasets (TriviaQA, HotpotQA, MS MARCO) failed | **DONE** | Built dedicated schema adapters in `backend/app/datasets/adapters/` (`trivia_qa.py`, `hotpot_qa.py`, `ms_marco.py`). Normalized answers, extracted context cleanly, truncated at sentence boundaries (max 2,500 chars), and capped vector index benchmark chunks to 300 to prevent runaway embedding loops. |
| **S9** | Browser connection refused (`localhost:5173` unreachable on Edge/Chrome) | **DONE** | Configured dual-stack IPv4/IPv6 socket binding (`host: '::'`) in `frontend/vite.config.ts`, ensuring that both `::1` and `127.0.0.1` are served seamlessly. Pointed proxy explicitly to `127.0.0.1:8000`. |
| **S10** | GGML assertion error: `tensor read out of bounds` on concurrent inference | **DONE** | Added event-loop-bound `asyncio.Lock` (`get_inference_lock()`) protecting llama-cpp-python model and embedder execution, serializing C++ computation graphs and preventing thread safety race conditions. |
| **S11** | Default active setup missing on fresh installation | **DONE** | In `backend/app/routes/setup.py`, set robust defaults to verified local models (`Qwen/Qwen2.5-0.5B-Instruct` and `BAAI/bge-small-en-v1.5`), ensuring instant readiness out of the box without requiring manual setup. |

---

### Verification Pipeline Summary (`scripts/verify.ps1`)

- **[1/7] Frontend TypeScript Check (`tsc --noEmit`):** PASSED (0 errors)
- **[2/7] Frontend Lint Check (`npm run lint`):** PASSED (0 errors)
- **[3/7] Frontend Production Build (`npm run build`):** PASSED (Built successfully in < 1s)
- **[4/7] Backend Linter (`ruff check app tests`):** PASSED (All checks passed)
- **[5/7] Backend Type Checker (`mypy app`):** PASSED (52 source files type checked with 0 errors)
- **[6/7] Backend Pytest Suite (`pytest`):** PASSED (20 passed in 8.94s)
- **[7/7] Playwright End-to-End Suite:** PASSED (All 50 tests passed across Desktop 1440x900 and Mobile 390x844 viewports, including full Axe accessibility scans)

**Overall Status: COMPLETE (100% Green)**
