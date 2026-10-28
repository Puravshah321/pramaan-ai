# Pramaan AI — 3-Minute Walkthrough Script

## Scene 1: Problem & Positioning (0:00 - 0:40)
- **Visual:** Open Dashboard at `http://localhost:5173`. Point to target hardware cap badge ("GTX 1650 - 4 GB VRAM").
- **Script:** *"In practical deployments, large RAG pipelines quickly crash under resource constraints. Pramaan AI answers a simple question: What is the most reliable RAG configuration that actually fits on your hardware, and what is the scientific proof?"*

## Scene 2: Chunk Lab & Experiment Planner (0:40 - 1:20)
- **Visual:** Navigate to **Corpus & Chunk Lab**, toggle chunk sizes (256 vs 512). Navigate to **Experiment Planner**, show the Pre-Flight Dry Run VRAM check.
- **Script:** *"Before wasting compute, our pre-flight feasibility estimator flags infeasible configurations. For example, Qwen 3B with 8-bit quant exceeds 4 GB VRAM and is barred from execution."*

## Scene 3: Execution, Results & Pareto Frontier (1:20 - 2:20)
- **Visual:** Open **Run Monitor** showing live 20 Hz VRAM telemetry. Navigate to **Results Explorer** showing paired bootstrap CIs `0.74 [0.69–0.78]` and 'TIED' badges. Click **Pareto & Decision**.
- **Script:** *"Every number has provenance. In our Pareto analysis, Qwen2.5-1.5B with Q4_K_M quantization saves 1.8 GB VRAM while losing less than 1.4% F1 compared to 8-bit unquantized baselines."*

## Scene 4: Reliability Lab & Reproducibility (2:20 - 3:00)
- **Visual:** Open **Reliability Lab**, show canary catch-rate (94.2%) and ECE calibration. Open **Reproducibility**, click 'Verify Sample' (100% exact match).
- **Script:** *"Pramaan verifies not just the pipeline, but the honesty of the hallucination detector itself with canary injection and one-click cryptographic replication bundles."*
