"""Paired bootstrap confidence intervals calculation."""
from __future__ import annotations

import numpy as np


def compute_bootstrap_ci(
    scores: list[float],
    n_resamples: int = 1000,
    confidence_level: float = 0.95,
) -> tuple[float | None, float | None]:
    """Computes a bootstrap confidence interval for the mean score.
    Returns (lower_bound, upper_bound) or (None, None) if sample size < 10.
    """
    if len(scores) < 10:
        return None, None

    arr = np.array(scores, dtype=np.float64)
    n = len(arr)
    boot_means = np.empty(n_resamples, dtype=np.float64)

    rng = np.random.default_rng(seed=42)
    for i in range(n_resamples):
        sample = rng.choice(arr, size=n, replace=True)
        boot_means[i] = sample.mean()

    alpha = (1.0 - confidence_level) / 2.0
    lower = float(np.percentile(boot_means, alpha * 100))
    upper = float(np.percentile(boot_means, (1.0 - alpha) * 100))

    return round(lower, 4), round(upper, 4)
