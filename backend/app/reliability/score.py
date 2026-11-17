"""Score an answer for reliability and output badge + reasons."""
from __future__ import annotations

import math
from typing import Any, Optional


def score_answer_reliability(
    features: dict[str, float],
    model_weights: Optional[dict[str, float]] = None,
    intercept: float = 0.0,
    reliable_threshold: float = 0.70,
    uncertain_threshold: float = 0.40,
) -> dict[str, Any]:
    """Computes reliability probability, status ('Reliable', 'Uncertain', 'Unreliable'),
    and reasons detailing which signals pushed confidence up or down.
    """
    top_sim = features.get("top_sim", 0.0)
    gap = features.get("gap", 0.0)
    lexical = features.get("lexical_support", 0.0)
    idk = features.get("idk_flag", 0.0)

    # Compute probability via logistic function or heuristic weights
    if model_weights:
        z = (
            intercept
            + model_weights.get("top_sim", 1.5) * top_sim
            + model_weights.get("gap", 1.0) * gap
            + model_weights.get("lexical_support", 2.0) * lexical
            + model_weights.get("idk_flag", -3.0) * idk
        )
        prob = 1.0 / (1.0 + math.exp(-max(min(z, 15.0), -15.0)))
    else:
        # Heuristic formulation
        if idk == 1.0:
            prob = 0.15
        else:
            prob = 0.5 * top_sim + 0.3 * lexical + 0.2 * min(1.0, gap * 2)

    prob = round(float(prob), 3)

    # Determine status
    if prob >= reliable_threshold:
        status = "Reliable"
    elif prob >= uncertain_threshold:
        status = "Uncertain"
    else:
        status = "Unreliable"

    # Build human-readable reasons explaining signals
    reasons = []
    if idk == 1.0:
        reasons.append("Answer states uncertainty or missing information")
    if top_sim >= 0.75:
        reasons.append(f"High top chunk similarity ({top_sim:.2f})")
    elif top_sim < 0.50:
        reasons.append(f"Low retrieval similarity ({top_sim:.2f})")

    if lexical >= 0.70:
        reasons.append(f"Strong lexical grounding ({int(lexical * 100)}% words matched in context)")
    elif lexical < 0.35:
        reasons.append(f"Weak context overlap ({int(lexical * 100)}% words matched in context)")

    if gap > 0.15:
        reasons.append(f"Clear leading evidence chunk (gap: {gap:.2f})")

    if not reasons:
        reasons.append("Moderate retrieval confidence across signals")

    return {
        "status": status,
        "confidence": prob,
        "reasons": reasons,
        "signals": {
            "top_similarity": top_sim,
            "margin_gap": gap,
            "lexical_support": lexical,
            "abstention_flag": bool(idk),
        },
    }
