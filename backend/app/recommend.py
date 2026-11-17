"""Hardware-aware recommendation engine based strictly on measured configurations."""
from __future__ import annotations

from typing import Any, Optional


def find_recommendation(
    configs_with_metrics: list[dict[str, Any]],
    memory_limit_gb: Optional[float] = None,
    latency_limit_s: Optional[float] = None,
    goal: str = "best_quality",  # "best_quality", "balanced", "fastest", "smallest"
) -> dict[str, Any]:
    """Filters configurations by limits and ranks according to the user's goal.

    Enforces integrity rules:
    - Only configurations with >= 80% answer completion rate are admitted.
    - Requires at least 3 distinct measured configurations to make Pareto-optimal claims.
    - Highlights when sample size n < 100 questions.
    """
    # Filter 1: Completion rate >= 80%
    qualifying_configs = []
    for c in configs_with_metrics:
        n = c.get("n", 0)
        failed = c.get("failed_calls", 0)
        if n > 0:
            completion_rate = (n - failed) / float(n)
            if completion_rate >= 0.8:
                c["completion_rate"] = round(completion_rate, 3)
                qualifying_configs.append(c)

    total_setups = len(qualifying_configs)

    if total_setups == 0:
        return {
            "chosen": None,
            "why_chosen": "No configurations have completed at least 80% of test questions. Run a benchmark first.",
            "next_best": [],
            "nothing_fits": True,
            "closest_option": None,
            "insufficient_setups": True,
            "setup_count": 0,
            "required_setups": 3,
            "low_sample_warning": None,
        }

    valid_configs = []
    for c in qualifying_configs:
        # Convert memory to GB (metrics.memory_mb is in MB)
        mem_mb = c.get("memory_mb", 0.0)
        mem_gb = mem_mb / 1024.0
        lat_s = c.get("latency_p50", 0.0) / 1000.0

        mem_ok = (memory_limit_gb is None) or (mem_gb <= memory_limit_gb)
        lat_ok = (latency_limit_s is None) or (lat_s <= latency_limit_s)

        if mem_ok and lat_ok:
            valid_configs.append(c)

    # If nothing fits, find the closest
    if not valid_configs:
        def distance_to_limits(item: dict[str, Any]) -> float:
            mem_gb = item.get("memory_mb", 0.0) / 1024.0
            lat_s = item.get("latency_p50", 0.0) / 1000.0
            mem_excess = max(0.0, mem_gb - (memory_limit_gb or 999.0))
            lat_excess = max(0.0, lat_s - (latency_limit_s or 999.0))
            return mem_excess * 2.0 + lat_excess

        sorted_by_closeness = sorted(qualifying_configs, key=distance_to_limits)
        closest = sorted_by_closeness[0]
        closest_mem_gb = round(closest.get("memory_mb", 0.0) / 1024.0, 2)
        closest_lat_s = round(closest.get("latency_p50", 0.0) / 1000.0, 2)

        return {
            "chosen": None,
            "why_chosen": f"No configuration fits within {memory_limit_gb} GB memory and {latency_limit_s}s latency.",
            "next_best": [],
            "nothing_fits": True,
            "closest_option": closest,
            "insufficient_setups": total_setups < 3,
            "setup_count": total_setups,
            "required_setups": 3,
            "low_sample_warning": None,
            "admitting_limits": {
                "required_memory_gb": closest_mem_gb,
                "required_latency_s": closest_lat_s,
            },
        }

    # Rank valid configurations based on goal
    def score_config(item: dict[str, Any]) -> float:
        f1 = item.get("f1", 0.0)
        lat_s = max(0.01, item.get("latency_p50", 1.0) / 1000.0)
        mem_gb = max(0.1, item.get("memory_mb", 100.0) / 1024.0)

        if goal == "best_quality":
            return f1
        elif goal == "fastest":
            return -lat_s
        elif goal == "smallest":
            return -mem_gb
        else:  # balanced
            return f1 / (lat_s * 0.5 + mem_gb * 0.5)

    ranked = sorted(valid_configs, key=score_config, reverse=True)
    chosen = ranked[0]
    next_best = ranked[1:4]

    insufficient = total_setups < 3
    n_sample = chosen.get("n", 0)
    low_sample = f"Based on preliminary sample (n={n_sample} questions). Statistical robustness requires n ≥ 100 questions." if n_sample < 100 else None

    # Compute why chosen
    if insufficient:
        why = f"Preliminary observation: only {total_setups} configuration(s) measured so far (at least 3 setups required for definitive Pareto-optimal comparison). Leading option achieves F1 {chosen.get('f1', 0.0):.3f} with {chosen.get('memory_mb', 0.0) / 1024.0:.2f} GB memory footprint."
    elif next_best:
        runner_up = next_best[0]
        f1_diff = round((chosen.get("f1", 0.0) - runner_up.get("f1", 0.0)) * 100, 1)
        lat_diff = round((runner_up.get("latency_p50", 0.0) - chosen.get("latency_p50", 0.0)) / 1000.0, 2)
        if goal == "best_quality":
            why = f"Achieves highest F1 score ({chosen.get('f1', 0.0):.3f}), beating the runner-up by {f1_diff}%."
        elif goal == "fastest":
            why = f"Fastest response ({chosen.get('latency_p50', 0.0):.0f} ms), saving {lat_diff}s over the next option."
        elif goal == "smallest":
            why = f"Lowest memory footprint ({chosen.get('memory_mb', 0.0) / 1024.0:.2f} GB)."
        else:
            why = f"Optimal trade-off balancing quality (F1 {chosen.get('f1', 0.0):.3f}) with {chosen.get('latency_p50', 0.0):.0f} ms latency."
    else:
        why = f"Selected configuration satisfies all hardware constraints with F1 score {chosen.get('f1', 0.0):.3f}."

    return {
        "chosen": chosen,
        "why_chosen": why,
        "next_best": next_best,
        "nothing_fits": False,
        "closest_option": None,
        "insufficient_setups": insufficient,
        "setup_count": total_setups,
        "required_setups": 3,
        "low_sample_warning": low_sample,
    }
