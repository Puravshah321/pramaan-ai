# Pramaan AI — Scientific Methodology & Experimental Design

## 1. Research Questions & Operationalization

- **RQ1 (Retrieval Frontier & Knee Point):** How do chunk size, overlap, Top-K, and embedding models affect Recall@K, MRR, and nDCG, and at what memory/latency cost? Where does retrieval performance stop paying off?
- **RQ2 (Quantization & LLM Scaling):** For a fixed retrieval setup, how do model parameter size (0.5B, 1.5B, 3B) and quantization (Q2_K, Q4_K_M, Q5_K_M, Q8_0) trade answer quality for peak VRAM and latency? What is the empirical *exchange rate*?
- **RQ3 (Joint Pareto Optimization):** Which combinations are Pareto-optimal under strict hardware limits (e.g. 4 GB VRAM), and what dimensions give way first as caps tighten?
- **RQ4 (Reliability Detector Honesty):** Can an automated NLI-based detector reliably flag wrong or hallucinated answers, at what false-alarm rate, and does it maintain calibration across model families?
- **RQ5 (Decision Sensitivity):** Does the recommended configuration change when the ranking objective switches from latency/F1 to memory footprint or energy (Joules)?

---

## 2. Experimental Controls & Confound Separation

1. **Independent Evaluation of Retrieval:**
   Retrieval is evaluated in isolation against gold evidence passages. No LLM generation noise can affect retrieval recall.
2. **Oracle Context Mode for Generation:**
   Generation is evaluated under two regimes: (a) retrieved context, and (b) oracle context (gold passage provided directly). This cleanly separates retrieval failures from model hallucination.
3. **Fixed Decoding Determinism:**
   All accuracy benchmark runs use greedy decoding (temperature = 0, seed = 42, fixed max tokens).
4. **Paired Statistical Design:**
   All configurations are evaluated on the exact same question set ($n \ge 300$). Paired bootstrap confidence intervals (1,000 resamples) and Holm–Bonferroni multiple-comparison corrections are applied.
5. **Successive Halving Pruning:**
   Full factorial sweeps are screened on 60 questions; only the top 30% quantile and the empirical Pareto frontier proceed to the full $n=300$ evaluation.
