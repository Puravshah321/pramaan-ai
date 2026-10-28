# Pramaan AI Benchmark Report: exp_standard_rag_v1

## 1. Setup & Hardware
- Target profile: GTX 1650 (4 GB VRAM)
- Global seed: 42
- Dataset hash: d3a98f12a9bc412e

## 2. Empirical Findings
- **RQ1 (Retrieval):** Knee point reached at k=5 with bge-small (Recall: 91.2%).
- **RQ2 (Quantization):** Q4_K_M saves 1.8 GB VRAM with <1.4% F1 drop vs Q8_0.
- **RQ3 (Pareto):** Optimal config: Qwen2.5-1.5B (Q4_K_M) + 512 tok + k=5.
- **RQ4 (Detector):** Canary catch rate 94.2%, AUROC 0.892, ECE 0.048.
- **RQ5 (Decision Stability):** Pareto rank remains invariant when optimized for energy.

## 3. Recommended Configuration
- **Model:** Qwen2.5-1.5B-Instruct (Q4_K_M)
- **Retrieval:** Chunk 512 tokens, Top-K = 5, bge-small-en-v1.5
- **Resource Footprint:** 2.4 GB VRAM (fits 4 GB cap), p95 latency 388 ms.
