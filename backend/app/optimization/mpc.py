"""
Model Predictive Control (MPC) / Receding Horizon Controller.

At each timestep t:
1. Obtain current battery state (actual SoC)
2. Obtain current/updated price
3. Generate or fetch forecast for remaining horizon
4. Optimize dispatch for next N hours
5. Execute ONLY the first action
6. Simulate physical battery response
7. Obtain resulting actual state
8. Shift horizon forward
9. Repeat

This architecture means the optimizer is always re-planning from the actual
state, incorporating new information at each step.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from app.models.battery import BatteryConfig, BatteryState
from app.models.optimization import DispatchStep
from app.optimization.milp import build_and_solve_milp
from app.optimization.degradation import compute_degradation_cost_per_step

logger = logging.getLogger(__name__)


def simulate_battery_response(
    action: str,
    charge_power_mw: float,
    discharge_power_mw: float,
    soc_current: float,
    config: BatteryConfig,
    dt_hours: float = 1.0,
) -> Dict[str, float]:
    """
    Simulate the physical battery response to an applied action.

    This is the "plant model" — it represents what actually happens
    when we execute the command, including efficiency losses.

    Returns:
        dict with soc_new, energy_charged_mwh, energy_discharged_mwh,
               actual_charge_power, actual_discharge_power
    """
    # Clamp to physical limits
    p_ch = max(0.0, min(charge_power_mw, config.power_mw))
    p_dis = max(0.0, min(discharge_power_mw, config.power_mw))

    # Anti-simultaneity safety check
    if p_ch > 0 and p_dis > 0:
        logger.warning("Anti-simultaneity violation in simulation — zeroing discharge")
        p_dis = 0.0

    # SoC transition with efficiency losses
    delta_soc = (config.efficiency_charge * p_ch - p_dis / config.efficiency_discharge) * dt_hours / config.capacity_mwh
    soc_new = soc_current + delta_soc

    # Enforce physical SoC bounds (clamp, don't exceed)
    soc_new = max(config.soc_min, min(config.soc_max, soc_new))

    # Recompute actual power based on clamped SoC
    actual_delta = soc_new - soc_current
    if actual_delta >= 0:
        actual_p_ch = actual_delta * config.capacity_mwh / (config.efficiency_charge * dt_hours)
        actual_p_dis = 0.0
    else:
        actual_p_ch = 0.0
        actual_p_dis = abs(actual_delta) * config.capacity_mwh * config.efficiency_discharge / dt_hours

    return {
        "soc_new": round(soc_new, 6),
        "actual_charge_power_mw": round(actual_p_ch, 4),
        "actual_discharge_power_mw": round(actual_p_dis, 4),
        "energy_charged_mwh": round(actual_p_ch * dt_hours, 4),
        "energy_discharged_mwh": round(actual_p_dis * dt_hours, 4),
    }


def run_mpc_step(
    current_soc: float,
    current_time: datetime,
    price_at_t: float,
    forecast_prices: List[float],
    forecast_timestamps: List[datetime],
    config: BatteryConfig,
    dt_hours: float = 1.0,
    run_id: int = 0,
) -> Dict[str, Any]:
    """
    Execute one MPC iteration:
    1. Optimize over remaining horizon with current SoC
    2. Extract first action
    3. Simulate battery response
    4. Return results

    Args:
        current_soc: Actual current state of charge
        current_time: Current timestamp
        price_at_t: Current electricity price
        forecast_prices: Prices for the remaining horizon (including current)
        forecast_timestamps: Timestamps for each forecast price
        config: Battery configuration
        dt_hours: Timestep duration

    Returns:
        dict with action, new_soc, economic metrics, optimization_result
    """
    # Use current SoC as initial condition for re-optimization
    config_for_opt = config.model_copy(update={"soc_initial": current_soc})

    # All prices including current step
    all_prices = [price_at_t] + list(forecast_prices)
    all_timestamps = [current_time] + list(forecast_timestamps)

    # Run MILP for the horizon
    opt_result = build_and_solve_milp(
        battery=config_for_opt,
        prices=all_prices[:len(forecast_timestamps) + 1],
        timestamps=all_timestamps[:len(forecast_timestamps) + 1],
        dt_hours=dt_hours,
        run_id=run_id,
        price_type="forecast",
    )

    if opt_result.status not in ["optimal"] or not opt_result.dispatch:
        # Fallback: idle if optimization fails
        return {
            "action": "idle",
            "charge_power_mw": 0.0,
            "discharge_power_mw": 0.0,
            "soc_new": current_soc,
            "revenue": 0.0,
            "energy_cost": 0.0,
            "degradation_cost": 0.0,
            "net_profit": 0.0,
            "optimization_dispatch": [],
            "optimization_status": opt_result.status,
            "constraint_violations": 0,
        }

    # Extract FIRST action from the optimal plan
    first = opt_result.dispatch[0]

    # Simulate the physical response
    response = simulate_battery_response(
        action=first.action,
        charge_power_mw=first.charge_power_mw,
        discharge_power_mw=first.discharge_power_mw,
        soc_current=current_soc,
        config=config,
        dt_hours=dt_hours,
    )

    soc_new = response["soc_new"]

    # Calculate actual economics with actual price
    revenue = price_at_t * response["actual_discharge_power_mw"] * config.efficiency_discharge * dt_hours
    energy_cost = price_at_t * (response["actual_charge_power_mw"] / config.efficiency_charge) * dt_hours if response["actual_charge_power_mw"] > 0 else 0.0
    deg_cost = compute_degradation_cost_per_step(
        discharge_power_mw=response["actual_discharge_power_mw"],
        soc_before=current_soc,
        soc_after=soc_new,
        capacity_mwh=config.capacity_mwh,
        base_cost_per_mwh=config.degradation_cost_per_mwh,
        dt_hours=dt_hours,
    )

    return {
        "action": first.action,
        "charge_power_mw": response["actual_charge_power_mw"],
        "discharge_power_mw": response["actual_discharge_power_mw"],
        "soc_new": soc_new,
        "revenue": round(revenue, 4),
        "energy_cost": round(energy_cost, 4),
        "degradation_cost": round(deg_cost, 4),
        "net_profit": round(revenue - energy_cost - deg_cost, 4),
        "optimization_dispatch": [d.model_dump() for d in opt_result.dispatch],
        "optimization_status": opt_result.status,
        "constraint_violations": opt_result.constraint_status.violations,
    }


def run_greedy_dispatch(
    prices: List[float],
    timestamps: List[datetime],
    config: BatteryConfig,
    dt_hours: float = 1.0,
) -> List[Dict[str, Any]]:
    """
    Greedy price arbitrage baseline.

    Strategy:
    - Charge when price is below the 40th percentile
    - Discharge when price is above the 70th percentile
    - Otherwise idle

    This provides a simple but reasonably effective baseline
    to compare against MPC optimization.
    """
    import numpy as np

    prices_arr = np.array(prices)
    low_threshold = np.percentile(prices_arr, 40)
    high_threshold = np.percentile(prices_arr, 70)

    results = []
    current_soc = config.soc_initial

    for t, (price, ts) in enumerate(zip(prices, timestamps)):
        # Greedy decision
        if price <= low_threshold and current_soc < config.soc_max - 0.01:
            action = "charge"
            p_ch = config.power_mw
            p_dis = 0.0
        elif price >= high_threshold and current_soc > config.soc_min + 0.01:
            action = "discharge"
            p_ch = 0.0
            p_dis = config.power_mw
        else:
            action = "idle"
            p_ch = 0.0
            p_dis = 0.0

        # Simulate
        response = simulate_battery_response(
            action=action,
            charge_power_mw=p_ch,
            discharge_power_mw=p_dis,
            soc_current=current_soc,
            config=config,
            dt_hours=dt_hours,
        )

        soc_new = response["soc_new"]
        revenue = price * response["actual_discharge_power_mw"] * config.efficiency_discharge * dt_hours
        energy_cost = price * (response["actual_charge_power_mw"] / config.efficiency_charge) * dt_hours if response["actual_charge_power_mw"] > 0 else 0.0
        deg_cost = compute_degradation_cost_per_step(
            discharge_power_mw=response["actual_discharge_power_mw"],
            soc_before=current_soc,
            soc_after=soc_new,
            capacity_mwh=config.capacity_mwh,
            base_cost_per_mwh=config.degradation_cost_per_mwh,
            dt_hours=dt_hours,
        )

        results.append({
            "step": t,
            "timestamp": ts.isoformat(),
            "price": price,
            "action": action,
            "charge_power_mw": response["actual_charge_power_mw"],
            "discharge_power_mw": response["actual_discharge_power_mw"],
            "soc_start": round(current_soc, 4),
            "soc_end": round(soc_new, 4),
            "revenue": round(revenue, 4),
            "energy_cost": round(energy_cost, 4),
            "degradation_cost": round(deg_cost, 4),
            "net_profit": round(revenue - energy_cost - deg_cost, 4),
        })

        current_soc = soc_new

    return results
