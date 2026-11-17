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
    Returns:
    - chosen: the best configuration
    - why_chosen: computed statement explaining why it won
    - next_best: list of runner-ups
    - nothing_fits: bool, with closest_option and required limits if True
    """
    if not configs_with_metrics:
        return {
            "chosen": None,
            "why_chosen": "No measured configurations exist yet. Run a benchmark first.",
            "next_best": [],
            "nothing_fits": True,
            "closest_option": None,
        }

    valid_configs = []
    for c in configs_with_metrics:
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
        # Score proximity to limits
        def distance_to_limits(item: dict[str, Any]) -> float:
            mem_gb = item.get("memory_mb", 0.0) / 1024.0
            lat_s = item.get("latency_p50", 0.0) / 1000.0
            mem_excess = max(0.0, mem_gb - (memory_limit_gb or 999.0))
            lat_excess = max(0.0, lat_s - (latency_limit_s or 999.0))
            return mem_excess * 2.0 + lat_excess

        sorted_by_closeness = sorted(configs_with_metrics, key=distance_to_limits)
        closest = sorted_by_closeness[0]
        closest_mem_gb = round(closest.get("memory_mb", 0.0) / 1024.0, 2)
        closest_lat_s = round(closest.get("latency_p50", 0.0) / 1000.0, 2)

        return {
            "chosen": None,
            "why_chosen": f"No configuration fits within {memory_limit_gb} GB memory and {latency_limit_s}s latency.",
            "next_best": [],
            "nothing_fits": True,
            "closest_option": closest,
            "admitting_limits": {
                "required_memory_gb": closest_mem_gb,
                "required_latency_s": closest_lat_s,
            },
        }

    # Rank valid configurations based on goal
    def score_config(item: dict[str, Any]) -> float:
        f1 = item.get("f1", 0.0)
        lat_s = item.get("latency_p50", 1.0) / 1000.0
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

    # Compute why chosen
    if next_best:
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
    }
