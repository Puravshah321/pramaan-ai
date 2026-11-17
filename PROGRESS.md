# PROGRESS.md

## Iteration Number: 10
**Current Stage:** REDESIGN v4 Completed & Verified
**Active Goal:**
1. Real llama-cpp-python local runner with GGUF auto-download and real VRAM/RSS memory tracking.
2. Complete removal of silent heuristic extraction fallback (record failed status with plain-language errors).
3. Script `scripts/audit_runs.py` to invalidate all contaminated past runs and add "Show invalid runs" toggle.
4. Model availability 3-check system (router catalog, Hub mapping, 1-token test call) with 10-minute caching.
5. Removal of hard-coded default model IDs (live queries for instruct models under 4B with GGUF, setup prompt if unconfigured).
6. Token capability check in `/api/health` with warning banner on Home and Models for fine-grained scope limitations.
7. Hardware auto-detection with NVIDIA NVML / CPU profiles.
8. Run Quick benchmark on 50 SQuAD v2 questions with local runner and report raw metrics.
9. Verify all tests, update documentation, and push to GitHub.

---

## REDESIGN v4 Checklist

- [x] 1. Remove silent heuristic fallback in `backend/app/hf/inference.py` and `backend/app/runners/hosted.py`
- [x] 2. Create `backend/app/hf/errors.py` (plain-language error translator)
- [x] 3. Create `backend/app/runners/local.py` with real llama-cpp-python GGUF runner and memory tracking
- [x] 4. Create `backend/app/runners/hardware.py` with GPU/CPU auto-detection and hardware profiles
- [x] 5. Add `is_valid` and `invalid_reason` to `Run` model and update endpoints (`include_invalid` toggle)
- [x] 6. Write and execute `scripts/audit_runs.py` to invalidate contaminated runs (22/22 past runs quarantined)
- [x] 7. Implement 3-check model availability system in `backend/app/hf/hub.py` with 10-minute cache
- [x] 8. Extend `/api/health` with token capability check (router test & fine-grained scope detection)
- [x] 9. Remove all hard-coded model strings across backend and frontend; add live suggestions
- [x] 10. Frontend: Add token warning banner on Home & Models, "Show invalid runs" toggle on Results/Benchmark, unconfigured setup drawer
- [x] 11. Run 50-question SQuAD v2 benchmark with local runner on Qwen2.5-0.5B-Instruct (Q4_K_M and Q8_0)
- [x] 12. Run backend pytest suite (15 passed with coverage)
- [x] 13. Run frontend Playwright e2e and accessibility suites (42 passed)
- [x] 14. Re-generate research figures, CSV exports, and report_data.json
- [x] 15. Update README.md (<600 lines) and push to GitHub main branch

---

## Verified Evaluation Results
- **Run `run_6d67c8c2`** (Qwen2.5-0.5B-Instruct `Q4_K_M`, n=50 questions, SQuAD v2):
  - Recall@K: 0.900 (Top-K=3)
  - EM: 0.100
  - F1: 0.316
  - Median Latency (p50): 3262.8 ms
  - Peak Memory: 220.0 MB (Real measured process RSS/VRAM)
  - Failed Calls: 0
- **Run `run_48353e7c`** (Qwen2.5-0.5B-Instruct `Q8_0`, n=50 questions, SQuAD v2):
  - Recall@K: 0.900 (Top-K=3)
  - EM: 0.120
  - F1: 0.305
  - Median Latency (p50): 2413.4 ms
  - Peak Memory: 1267.1 MB (Real measured VRAM)
  - Failed Calls: 0

---

## Known Failures & BLOCKED
None. All 15 checklist items verified and passing.
