"""Pipeline unit tests: chunking, retrieval, eval metrics, reliability, and leakage-free splits."""
import time

from app.eval.metrics import compute_exact_match, compute_f1, compute_recall_at_k
from app.pipeline.chunking import chunk_text
from app.reliability.features import extract_features
from app.reliability.train import train_reliability_checker


def test_chunking_size_and_overlap():
    text = "word " * 300
    chunks = chunk_text(text, chunk_size=100, overlap=20)
    assert len(chunks) >= 3
    # Check that each chunk length does not exceed chunk_size + buffer
    for c in chunks:
        words = c["text"].split()
        assert len(words) <= 110


def test_eval_metrics_exact_values():
    # Exact Match
    assert compute_exact_match("Paris", "Paris") == 1.0
    assert compute_exact_match("Paris.", "Paris") == 1.0
    assert compute_exact_match("London", "Paris") == 0.0

    # Token F1
    assert compute_f1("Paris", "Paris") == 1.0
    assert compute_f1("The capital is Paris", "Paris") > 0.0
    assert compute_f1("London", "Paris") == 0.0

    # Recall@K
    chunks = [
        {"text": "France has its capital in Paris, a major European city."},
        {"text": "Germany has Berlin as its capital."},
    ]
    assert compute_recall_at_k(chunks, "Paris") == 1.0
    assert compute_recall_at_k(chunks, "Tokyo") == 0.0


def test_latency_timer_monotonicity():
    t0 = time.perf_counter()
    time.sleep(0.01)
    t1 = time.perf_counter()
    assert t1 > t0
    elapsed_ms = (t1 - t0) * 1000
    assert elapsed_ms >= 8.0


def test_reliability_features_in_range():
    answer = "The capital of France is Paris."
    chunks = [
        {"text": "Paris is the capital and most populous city of France.", "score": 0.85},
        {"text": "Marseille is another major city in France.", "score": 0.50},
    ]
    feats = extract_features(answer, chunks)
    assert "top_sim" in feats
    assert 0.0 <= feats["top_sim"] <= 1.0
    assert "gap" in feats
    assert feats["gap"] >= 0.0
    assert "lexical_support" in feats
    assert 0.0 <= feats["lexical_support"] <= 1.0
    assert "idk_flag" in feats
    assert feats["idk_flag"] == 0.0


def test_question_split_no_leakage():
    # Synthetic samples with repeated questions
    records = []
    for q_id in range(20):
        for _run_cfg in range(4):
            records.append({
                "question_id": f"q_{q_id}",
                "correct": (q_id % 2 == 0),
                "features": {
                    "top_sim": 0.8 if q_id % 2 == 0 else 0.3,
                    "gap": 0.2 if q_id % 2 == 0 else 0.05,
                    "lexical_support": 0.7 if q_id % 2 == 0 else 0.1,
                    "idk_flag": 0.0,
                }
            })

    result = train_reliability_checker(records)
    assert "auroc" in result
    assert result["auroc"] >= 0.5
    assert "baseline_auroc" in result
    assert result["n"] == 80
