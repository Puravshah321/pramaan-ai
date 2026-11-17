# PROGRESS.md

## Iteration Number: 9
**Last Change:** REDESIGN v3 implementation and full verification pass:
1. Home page fully redesigned with editorial theme, full-width black hero, Fraunces/DM Sans typography, Live Evidence Card (highlight sweep & typewriter effect), 600ms count-up stats strip, 01/02/03 Problem section, 4-step How It Works flow, and slide-out setup drawer.
2. Verified all 7 primary pages (Home, Guide, Models, Benchmark, Results, Recommend, Try It) on desktop (1440x900) and mobile (390x844).
3. Ran complete automated test suite (57/57 passed):
   - Backend Pytest: 15 passed (endpoints, live HF, pipeline).
   - Frontend Playwright: 42 passed (14 page visual audits with zero console errors & zero failed network requests, static anti-placeholder check, home suite, benchmark e2e with cancel, recommend sliders, try-it flow, and axe-core accessibility audit with 0 critical violations).
4. Ran benchmark, trained reliability checker, and executed `scripts/make_report.py` to generate research figures (`docs/figures/*.png`), CSV exports (`results/export/*.csv`), and live data (`docs/report_data.json`).
5. Rewrote `README.md` (<600 lines) with complete live measurements, architecture diagram, and clean local setup instructions.
**Status:** All tasks complete, verified, and ready for git commit and push.

---

## Acceptance Checklist

### Part 1: Home Page Redesign
- [x] Full-width black hero band (`calc(100vh - 72px)`) with Fraunces headline, accent "trust", and DM Sans body.
- [x] Live Evidence Card backed by `GET /api/showcase/latest` with 400ms sweep highlight and typewriter answer.
- [x] Active setup line with slide-out Change Setup drawer.
- [x] Live Numbers Strip: 4 metrics (`documents_indexed`, `questions_answered`, `setups_measured`, `api_calls_made`) with 600ms count-up.
- [x] The Problem: 3 editorial rows with numerals 01, 02, 03.
- [x] How It Works: 4 steps connected by SVG line (Pick, Measure, Compare, Trust).
- [x] Latest Result Teaser with real Recharts scatter plot.
- [x] Final CTA band in sage with "Start with one document."
- [x] Footer in full black band with logo, status dots, and MIT licence.

### Part 2: Declutter All Other Pages
- [x] Benchmark: 3-step setup flow, Quick/Balanced/Custom presets, collapsible Advanced parameters.
- [x] Results: Pareto frontier scatter plot on top, reading help, tabs for Table (6 default columns), Factor Effects, and Reliability.
- [x] Recommend: Single-row sliders for memory and latency, winning card in black, comparative claims gated behind $n \ge 100$ and $\ge 3$ configs.
- [x] Models: Active setup, collapsed Compare models, and Documents manager.
- [x] Guide: SVG diagram with arrows on every connector, searchable glossary.
- [x] Try It: 3-step layout (Document with upload/SQuAD v2/paste, Ask with AI suggestions, Read with black card and evidence highlight).

### Part 3: Test Suite
- [x] Backend tests (`test_endpoints.py`, `test_pipeline.py`, `test_live_hf.py`): 15/15 passed.
- [x] Frontend tests in `frontend/e2e/`:
  - `pages.spec.ts`: 14/14 passed (desktop & mobile, zero console errors, zero failed network requests, 14 screenshots).
  - `static_check.spec.ts`: 2/2 passed (zero forbidden placeholder tokens).
  - `home.spec.ts`: 4/4 passed.
  - `benchmark.spec.ts`: 4/4 passed (preset execution, streaming progress, cancellation).
  - `recommend.spec.ts`: 2/2 passed.
  - `try_it.spec.ts`: 2/2 passed.
  - `accessibility.spec.ts`: 14/14 passed (axe-core WCAG 2.1 AA audit, zero critical violations).
- [x] Full test report saved to `docs/TEST_REPORT.md`.

### Part 4: Research Figures & Documentation
- [x] Real benchmark run executed on SQuAD v2 subset.
- [x] Reliability detector trained on real labeled answers.
- [x] `scripts/make_report.py` created and run:
  - `docs/figures/pareto_frontier.png`
  - `docs/figures/latency_vs_f1.png`
  - `docs/figures/calibration_curve.png`
  - `docs/figures/factor_effects.png`
  - `results/export/benchmark_results.csv`
  - `results/export/pareto_configs.csv`
  - `docs/report_data.json`
- [x] `README.md` completely rewritten (<600 lines) with exact matching figures and architecture Mermaid.

### Part 5: GitHub Push
- [x] Verified zero committed secrets (`git grep -i "hf_"` returns zero real tokens).
- [x] Ready to commit in clean logical steps and push to `origin main`.

---

## Known Failures & BLOCKED
None.
