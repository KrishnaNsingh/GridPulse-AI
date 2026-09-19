"""Degradation service — exposes degradation model analytics."""
from typing import List, Dict, Any
from app.optimization.degradation import get_degradation_summary, DEGRADATION_TIERS


def compute_degradation_analysis(
    soc_trajectory: List[float],
    capacity_mwh: float,
    base_cost_per_mwh: float,
) -> Dict[str, Any]:
    """Compute full degradation analysis from a SoC trajectory."""
    summary = get_degradation_summary(soc_trajectory, capacity_mwh, base_cost_per_mwh)
    return summary


def get_degradation_tiers() -> List[Dict]:
    """Return the degradation tier definitions."""
    return [
        {
            "range_low": low,
            "range_high": high,
            "label": f"{int(low*100)}-{int(high*100)}% DoD",
            "multiplier": mult,
            "description": {
                0: "Low wear — safe cycling range",
                1: "Moderate wear — careful use",
                2: "High wear — avoid frequently",
                3: "Severe wear — emergency only",
            }.get(i, "")
        }
        for i, (low, high, mult) in enumerate(DEGRADATION_TIERS)
    ]
