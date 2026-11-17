# PROGRESS.md

## Iteration Number: 2
**Current Stage:** REDESIGN v5 - Full Defect Resolution & Verification Complete

### Audit & Resolution Summary

| Item / Finding | Status | Observed Initial State | Final Implemented & Verified Resolution |
|:---|:---:|:---|:---|
| **F1. Hardware Presets on Recommend** | **RESOLVED** | Missing presets; only manual slider shown; lacked chip detection and verified specs. | Added `GET /api/hardware` endpoint and `backend/app/data/hardware_profiles.json` (32 verified profiles with TechPowerUp, Apple, NVIDIA, and JEDEC sources). Added "Your machine" auto-detected chip, grouped preset chips (RTX 3060, Apple M3/M4, CPU RAM), search input, hidden-by-default manual slider under "Custom Limits", and latency honesty disclaimer. |
| **F2. Token & Router Health Diagnosis** | **RESOLVED** | Claimed token lacked permissions even when Inference Providers was enabled (actually returned HTTP 402 credits exhausted). | Re-reads `backend/.env` dynamically on every request. Implemented 8-case diagnostic system in `health.py` and `scripts/check_token.py`. Added `POST /api/health/recheck`. Updated frontend Home and Models with dismissible, session-stored banner featuring "Re-check connection" loading button and direct links to Hugging Face billing/tokens. |
| **F3. Zero Heuristic Answers in Showcase/Home** | **RESOLVED** | Extractive heuristic verbatim answer from `test_doc.pdf` with "100% words matched" and run `run_17f0dac1` (0.473 F1) contaminated. | Invalidated `run_17f0dac1` and all heuristic/failed runs in `scripts/audit_runs.py`. `GET /api/showcase/latest` now strictly serves real answers from valid runs (`Run.is_valid == True`). Home card displays "Answered by <model> via <runner>" with clean empty state when no data exists. Verbatim copy detector discounts lexical support in reliability scoring. |
| **F4. Models Page Redesign & Live Compare** | **RESOLVED** | ModelPicker showed green tick for "local runner only"; Compare models collapsed & empty; QA datasets section empty with no initial suggestions. | Redesigned Active Setup into 2 compact rows with clear badges ("Ready (local GGUF)", "Ready (hosted)", "Needs fix" with exact error). Comparison table is OPEN BY DEFAULT, pre-filled with active setup, displays popular sub-4B models with 1-click addition, GGUF memory fits, and a "Test" button per row. Suggested QA datasets (SQuAD v2, HotpotQA, TriviaQA, MS MARCO) load immediately on mount. |
| **F5. Home Hero Dimensions & Typography** | **RESOLVED** | Headline wrapped to 4 tall lines, pushing evidence card and buttons below the fold on 1440x900. | Changed headline font size to `clamp(44px, 5.5vw, 76px)` with `lineHeight: 1.04` (max 3 lines at 1440, max 5 at 390). Changed hero container to content-fit `min-h-[560px] py-10 md:py-14` so evidence card and CTA buttons fit on 1440x900 without scrolling. |
| **Part 6. Recommend Integrity** | **RESOLVED** | Recommendation admitted all runs without completion checks. | Added threshold requiring $\ge 80\%$ question completion rate. Added minimum 3 setups check before making comparative Pareto-optimal claims. Displays sample size warning when $n < 100$. |
| **Part 7. Real Benchmark Runs & Reports** | **RESOLVED** | Only contaminated or incomplete runs in reporting. | Clean, audited runs preserved: `run_6d67c8c2` (Q4_K_M, F1 0.316, 220 MB RAM, 0 failed calls) and `run_48353e7c` (Q8_0, F1 0.305, 1267 MB RAM, 0 failed calls). Regenerated all figures, CSV exports, and `docs/report_data.json` via `scripts/make_report.py`. |
| **Part 8. Test Suites & Professional README** | **RESOLVED** | Test suite needed coverage for new endpoints, hardware profiles, and responsive mobile layouts. | Backend pytest suite passes 15/15 tests (including health, hardware, setup, stats, showcase, recommend, HF live). Frontend Playwright suite passes 42/42 tests at both 1440x900 and 390x844 viewports with zero horizontal overflow and zero axe accessibility violations. Professional README written (165 lines). Zero secrets committed. |

---

## REDESIGN v5 Checklist Status

- [x] 1. Part 1: Created `scripts/check_token.py` CLI diagnostic
- [x] 2. Part 1: Updated `backend/app/routes/health.py` with dynamic `.env` reading, live router model check, 8-case diagnosis, and `POST /api/health/recheck`
- [x] 3. Part 1: Updated Frontend Home & Models with dismissible token banner, exact diagnostic message, and "Re-check connection" button
- [x] 4. Part 2: Audited runs with `scripts/audit_runs.py` to invalidate `run_17f0dac1` (F1 0.473) and any run with heuristic answers; fixed `showcase.py` to only serve valid real model answers; updated reliability features to flag verbatim copies
- [x] 5. Part 3: Created verified `backend/app/data/hardware_profiles.json` with 32 profiles, real specs & sources (RTX 3060, Apple M1-M4, cloud GPUs, CPU)
- [x] 6. Part 3: Created `GET /api/hardware` endpoint with auto-detection & hardware profiles
- [x] 7. Part 3: Redesigned `frontend/src/pages/Recommend.tsx` with "Your machine" chip, grouped presets, search box, hidden-by-default custom slider, and target hardware latency disclaimer
- [x] 8. Part 4: Redesigned `frontend/src/pages/Models.tsx`: 2-row Active Setup with real status badges, pre-filled & live open Compare Models with "Run quick test", and immediately loaded live dataset cards
- [x] 9. Part 5: Fixed Home Hero typography (`clamp(44px, 5.5vw, 76px)`, line-height 1.04, max 3 lines) and content-fit min-height 560px
- [x] 10. Part 6: Updated Recommend backend logic for >=80% answered threshold and minimum 3 setups rule
- [x] 11. Part 7: Verified real runs and executed `scripts/make_report.py` (exports updated)
- [x] 12. Part 8: Full backend pytest (15/15 green) and Playwright multi-viewport suite (42/42 green)
- [x] 13. Part 8: Executive README (<600 lines), zero secrets committed, pushed to GitHub main
