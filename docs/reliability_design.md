# Pramaan AI — Reliability & Hallucination Detector Architecture

## 1. Multi-Signal Ensemble Detector

The detector does not rely on a single heuristic or a single LLM self-evaluation. It combines four complementary signals:

1. **Natural Language Inference (NLI) Entailment:**
   Small cross-encoder (e.g. DeBERTa-v3-small-mnli) checking premise (retrieved passages) $\to$ hypothesis (claim extracted from generated answer).
2. **Lexical & Named Entity Overlap:**
   Exact verification of numbers, currency figures, dates, and proper nouns against evidence passages.
3. **LLM Citation Grounding:**
   Verifies whether inline citations $[1], [2]$ match the cited context span.
4. **Self-Consistency Uncertainty (Optional):**
   Dispersion across small sampling runs ($T=0.7$) when enabled.

---

## 2. Canary Injection Protocol

To prevent the detector from becoming a "black box" that promises reliability without proof, Pramaan AI automatically runs **Canary Injections**:
- Injects known synthetic falsehoods and contradictory claims into answers.
- Measures if the detector flags the canary.
- Hard quality gate: **Canary catch-rate must exceed 90.0%**.
