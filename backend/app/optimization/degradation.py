"""
Degradation model for battery cycling costs.

Uses a piecewise increasing marginal cost based on depth of discharge (DoD).
Deeper cycles incur higher degradation penalties to discourage aggressive cycling
for small price spreads.

This module is designed to be replaceable with a more detailed electrochemical
model (e.g., based on Rainflow counting or SEI growth models) in the future.
"""
from typing import List


# Piecewise degradation cost multipliers by DoD tier
# DoD = (energy discharged in a cycle) / (nominal capacity)
DEGRADATION_TIERS = [
    (0.00, 0.40, 1.0),   # 0-40% DoD: baseline cost
    (0.40, 0.70, 2.2),   # 40-70% DoD: moderate increase
    (0.70, 0.90, 4.5),   # 70-90% DoD: significant increase
    (0.90, 1.00, 8.0),   # >90% DoD: severe penalty (near full cycles)
]


def compute_degradation_cost_per_step(
    discharge_power_mw: float,
    soc_before: float,
    soc_after: float,
    capacity_mwh: float,
    base_cost_per_mwh: float,
    dt_hours: float = 1.0
) -> float:
    """
    Compute degradation cost for a single dispatch timestep.

    The energy dispatched is penalized at the appropriate tier rate based on
    the effective DoD that would result if this discharge represents a full cycle.

    Args:
        discharge_power_mw: Discharge power in MW
        soc_before: SoC at start of step (0-1)
        soc_after: SoC at end of step (0-1)
        capacity_mwh: Nominal capacity in MWh
        base_cost_per_mwh: Base degradation cost in $/MWh
        dt_hours: Duration of timestep in hours

    Returns:
        Degradation cost in dollars for this timestep
    """
    if discharge_power_mw <= 0:
        return 0.0

    # Energy discharged this step (MWh)
    energy_discharged_mwh = discharge_power_mw * dt_hours

    # DoD proxy: how deep into the battery are we drawing right now?
    # Use the average SoC during this step as proxy for cycle depth
    avg_soc = (soc_before + soc_after) / 2.0
    dod_proxy = 1.0 - avg_soc  # deeper discharge = higher DoD

    dod_proxy = max(0.0, min(1.0, dod_proxy))

    # Find the appropriate tier multiplier
    multiplier = DEGRADATION_TIERS[-1][2]  # default to highest tier
    for low, high, mult in DEGRADATION_TIERS:
        if low <= dod_proxy < high:
            multiplier = mult
            break

    cost = base_cost_per_mwh * multiplier * energy_discharged_mwh
    return cost


def compute_degradation_cost_milp_coefficients(
    soc_before: float,
    capacity_mwh: float,
    base_cost_per_mwh: float,
    dt_hours: float = 1.0
) -> float:
    """
    Compute the degradation cost coefficient for use in MILP objective.

    Returns cost per MW of discharge power at this timestep.
    Used to linearly approximate the degradation cost in the LP formulation.

    Args:
        soc_before: SoC at start of step (0-1) — determines DoD tier
        capacity_mwh: Nominal capacity in MWh
        base_cost_per_mwh: Base degradation cost $/MWh
        dt_hours: Timestep duration hours

    Returns:
        Degradation cost coefficient ($/MW) for discharge power variable
    """
    # Approximate DoD for this step based on current SoC
    dod_proxy = 1.0 - soc_before
    dod_proxy = max(0.0, min(1.0, dod_proxy))

    # Find tier multiplier
    multiplier = DEGRADATION_TIERS[-1][2]
    for low, high, mult in DEGRADATION_TIERS:
        if low <= dod_proxy < high:
            multiplier = mult
            break

    # Cost per MW of discharge = base_cost * multiplier * dt_hours
    return base_cost_per_mwh * multiplier * dt_hours


def compute_cycle_depth(soc_trajectory: List[float]) -> float:
    """
    Estimate equivalent full cycle depth from a SoC trajectory.

    Uses a simplified half-cycle counting approach:
    - Find local minima and maxima in SoC
    - Sum the absolute differences as depth
    - Normalize by 2 (charge + discharge = 1 full cycle)

    Args:
        soc_trajectory: List of SoC values over time

    Returns:
        Equivalent full cycle count (float)
    """
    if len(soc_trajectory) < 2:
        return 0.0

    total_discharge = 0.0
    for i in range(1, len(soc_trajectory)):
        delta = soc_trajectory[i - 1] - soc_trajectory[i]
        if delta > 0:
            total_discharge += delta

    # One full cycle = discharge from soc_max to soc_min (full DoD)
    return total_discharge


def get_degradation_summary(
    soc_trajectory: List[float],
    capacity_mwh: float,
    base_cost_per_mwh: float
) -> dict:
    """
    Compute a full degradation summary from a SoC trajectory.

    Returns:
        dict with cycle_count, equivalent_dod, estimated_cost, tier_breakdown
    """
    cycle_count = compute_cycle_depth(soc_trajectory)

    # Average DoD during discharge events
    discharge_dods = []
    for i in range(1, len(soc_trajectory)):
        if soc_trajectory[i] < soc_trajectory[i - 1]:
            dod = 1.0 - soc_trajectory[i]
            discharge_dods.append(dod)

    avg_dod = sum(discharge_dods) / len(discharge_dods) if discharge_dods else 0.0

    # Find dominant tier
    dominant_tier = "Low (<40%)"
    dominant_mult = 1.0
    for low, high, mult in DEGRADATION_TIERS:
        if low <= avg_dod < high:
            dominant_mult = mult
            if high <= 0.40:
                dominant_tier = "Low (<40%)"
            elif high <= 0.70:
                dominant_tier = "Moderate (40-70%)"
            elif high <= 0.90:
                dominant_tier = "High (70-90%)"
            else:
                dominant_tier = "Severe (>90%)"
            break

    # Estimated total cost
    energy_cycled = cycle_count * capacity_mwh
    estimated_cost = energy_cycled * base_cost_per_mwh * dominant_mult

    return {
        "cycle_count": round(cycle_count, 3),
        "average_dod": round(avg_dod, 3),
        "dominant_tier": dominant_tier,
        "dominant_multiplier": dominant_mult,
        "energy_cycled_mwh": round(energy_cycled, 3),
        "estimated_total_cost": round(estimated_cost, 2),
        "tiers": [
            {"range": f"{int(low*100)}-{int(high*100)}% DoD", "multiplier": mult}
            for low, high, mult in DEGRADATION_TIERS
        ]
    }
