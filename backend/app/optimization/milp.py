"""
MILP Battery Arbitrage Optimization Engine.

Uses PuLP with HiGHS solver to solve a Mixed Integer Linear Program for
optimal battery dispatch over a planning horizon.

Decision variables per timestep t:
  P_ch(t)   — charge power [0, P_max] MW
  P_dis(t)  — discharge power [0, P_max] MW
  SoC(t)    — state of charge [SoC_min, SoC_max]
  u_ch(t)   — binary: 1 if charging
  u_dis(t)  — binary: 1 if discharging

Objective: maximize Σ [λ(t)·P_dis(t)·η_dis·Δt - λ(t)·P_ch(t)/η_ch·Δt - C_deg(t)]

Constraints:
  - SoC transition: SoC(t+1) = SoC(t) + (η_ch·P_ch(t) - P_dis(t)/η_dis)·Δt/E_nom
  - SoC bounds
  - Power bounds
  - Anti-simultaneity: u_ch + u_dis <= 1
  - Terminal SoC if specified
"""
import time
import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

import pulp
import numpy as np

from app.models.battery import BatteryConfig
from app.models.optimization import DispatchStep, ConstraintStatus, OptimizationResult
from app.optimization.degradation import compute_degradation_cost_milp_coefficients

logger = logging.getLogger(__name__)


def build_and_solve_milp(
    battery: BatteryConfig,
    prices: List[float],
    timestamps: List[datetime],
    dt_hours: float = 1.0,
    run_id: int = 0,
    price_type: str = "forecast",
    scenario: Optional[Dict[str, Any]] = None,
) -> OptimizationResult:
    """
    Build and solve the MILP battery dispatch optimization.

    Args:
        battery: Battery configuration
        prices: List of electricity prices ($/MWh) for each timestep
        timestamps: List of datetime objects for each timestep
        dt_hours: Duration of each timestep in hours
        run_id: ID for tracking in database
        price_type: 'actual' | 'forecast' — for labeling
        scenario: Optional what-if overrides

    Returns:
        OptimizationResult with full dispatch schedule and metrics
    """
    T = len(prices)
    if T == 0:
        return _error_result(run_id, "No price data provided")

    # Apply scenario overrides
    config = _apply_scenario(battery, scenario)

    start_time = time.time()

    # ─── Build problem ────────────────────────────────────────────────────────
    prob = pulp.LpProblem("BatteryArbitrage", pulp.LpMaximize)

    # Decision variables
    P_ch = [pulp.LpVariable(f"P_ch_{t}", lowBound=0, upBound=config.power_mw) for t in range(T)]
    P_dis = [pulp.LpVariable(f"P_dis_{t}", lowBound=0, upBound=config.power_mw) for t in range(T)]
    SoC = [pulp.LpVariable(f"SoC_{t}", lowBound=config.soc_min, upBound=config.soc_max) for t in range(T + 1)]
    u_ch = [pulp.LpVariable(f"u_ch_{t}", cat="Binary") for t in range(T)]
    u_dis = [pulp.LpVariable(f"u_dis_{t}", cat="Binary") for t in range(T)]

    # ─── Objective function ───────────────────────────────────────────────────
    # Precompute degradation cost coefficients (per MW of discharge)
    deg_coeff = []
    for t in range(T):
        # Use current SoC estimate (initial SoC for first, then propagate approximately)
        soc_est = config.soc_initial  # simplified: use initial SoC for coefficient
        c_deg = compute_degradation_cost_milp_coefficients(
            soc_before=soc_est,
            capacity_mwh=config.capacity_mwh,
            base_cost_per_mwh=config.degradation_cost_per_mwh,
            dt_hours=dt_hours
        )
        deg_coeff.append(c_deg)

    # Objective: revenue - energy_cost - degradation
    revenue_terms = [
        prices[t] * P_dis[t] * config.efficiency_discharge * dt_hours
        for t in range(T)
    ]
    cost_terms = [
        prices[t] * (P_ch[t] / config.efficiency_charge) * dt_hours
        for t in range(T)
    ]
    degradation_terms = [
        deg_coeff[t] * P_dis[t]
        for t in range(T)
    ]

    prob += pulp.lpSum(revenue_terms) - pulp.lpSum(cost_terms) - pulp.lpSum(degradation_terms)

    # ─── Constraints ─────────────────────────────────────────────────────────

    # Initial SoC
    prob += SoC[0] == config.soc_initial, "InitialSoC"

    for t in range(T):
        lam = prices[t]  # price at step t

        # SoC state transition
        # SoC(t+1) = SoC(t) + (η_ch * P_ch(t) - P_dis(t)/η_dis) * Δt / E_nom
        prob += (
            SoC[t + 1] == SoC[t]
            + (config.efficiency_charge * P_ch[t] - P_dis[t] / config.efficiency_discharge)
            * dt_hours / config.capacity_mwh,
            f"SoC_transition_{t}"
        )

        # Power bounds via binary variables (big-M formulation)
        prob += P_ch[t] <= config.power_mw * u_ch[t], f"ChargePower_{t}"
        prob += P_dis[t] <= config.power_mw * u_dis[t], f"DischargePower_{t}"

        # Anti-simultaneity: cannot charge AND discharge simultaneously
        prob += u_ch[t] + u_dis[t] <= 1, f"AntiSimult_{t}"

        # Reserve constraint: SoC cannot go below reserve level
        effective_soc_min = max(config.soc_min, config.reserve_level)
        prob += SoC[t] >= effective_soc_min, f"SoCMin_{t}"
        prob += SoC[t] <= config.soc_max, f"SoCMax_{t}"

    # Terminal SoC constraint (if specified)
    if config.soc_terminal is not None:
        prob += SoC[T] >= config.soc_terminal - 0.01, "TerminalSoC"

    # Final SoC bounds
    prob += SoC[T] >= max(config.soc_min, config.reserve_level), f"SoCMin_{T}"
    prob += SoC[T] <= config.soc_max, f"SoCMax_{T}"

    # ─── Solve ────────────────────────────────────────────────────────────────
    # Try HiGHS Python API first, then HiGHS_CMD, then CBC
    solver = None
    try:
        solver = pulp.HiGHS(msg=False, timeLimit=30)
        solver_name = "HiGHS"
    except Exception:
        try:
            solver = pulp.HiGHS_CMD(msg=0, timeLimit=30)
            solver_name = "HiGHS_CMD"
        except Exception:
            solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=30)
            solver_name = "CBC"

    try:
        prob.solve(solver)
    except Exception as e:
        logger.error(f"Solver error: {e}")
        return _error_result(run_id, f"Solver error: {str(e)}")

    runtime = time.time() - start_time
    solver_status = pulp.LpStatus[prob.status]

    if prob.status not in [1, -1]:  # 1=Optimal, -1=Infeasible
        return _error_result(run_id, f"Solver returned status: {solver_status}", runtime)

    if prob.status == -1:  # Infeasible
        reason = _diagnose_infeasibility(config, prices, T, dt_hours)
        result = OptimizationResult(
            run_id=run_id,
            status="infeasible",
            solver=solver_name,
            solver_status=solver_status,
            runtime_seconds=round(runtime, 4),
            constraint_status=ConstraintStatus(passed=False, violations=1, details=["Optimization infeasible"]),
            created_at=datetime.utcnow(),
            error_message="Optimization problem is infeasible",
            infeasibility_reason=reason
        )
        return result

    # ─── Extract solution ─────────────────────────────────────────────────────
    dispatch = []
    soc_values = [pulp.value(SoC[t]) for t in range(T + 1)]
    total_revenue = 0.0
    total_energy_cost = 0.0
    total_degradation_cost = 0.0
    total_discharge_energy = 0.0

    for t in range(T):
        p_ch = max(0.0, pulp.value(P_ch[t]) or 0.0)
        p_dis = max(0.0, pulp.value(P_dis[t]) or 0.0)
        soc_start = max(0.0, min(1.0, soc_values[t] or config.soc_initial))
        soc_end = max(0.0, min(1.0, soc_values[t + 1] or config.soc_initial))
        price = prices[t]

        # Determine action
        if p_ch > 0.001:
            action = "charge"
        elif p_dis > 0.001:
            action = "discharge"
        else:
            action = "idle"

        # Economic values
        revenue = price * p_dis * config.efficiency_discharge * dt_hours
        energy_cost = price * (p_ch / config.efficiency_charge) * dt_hours if p_ch > 0 else 0.0

        # Degradation cost (actual, not approximated)
        from app.optimization.degradation import compute_degradation_cost_per_step
        deg_cost = compute_degradation_cost_per_step(
            discharge_power_mw=p_dis,
            soc_before=soc_start,
            soc_after=soc_end,
            capacity_mwh=config.capacity_mwh,
            base_cost_per_mwh=config.degradation_cost_per_mwh,
            dt_hours=dt_hours
        )

        net = revenue - energy_cost - deg_cost
        dod = max(0.0, soc_start - soc_end)

        total_revenue += revenue
        total_energy_cost += energy_cost
        total_degradation_cost += deg_cost
        total_discharge_energy += p_dis * dt_hours

        dispatch.append(DispatchStep(
            step=t,
            timestamp=timestamps[t],
            price=round(price, 4),
            price_type=price_type,
            charge_power_mw=round(p_ch, 4),
            discharge_power_mw=round(p_dis, 4),
            soc_start=round(soc_start, 4),
            soc_end=round(soc_end, 4),
            action=action,
            revenue=round(revenue, 4),
            energy_cost=round(energy_cost, 4),
            degradation_cost=round(deg_cost, 4),
            net_profit=round(net, 4),
            dod=round(dod, 4),
        ))

    net_profit = total_revenue - total_energy_cost - total_degradation_cost
    cycle_count = total_discharge_energy / config.capacity_mwh if config.capacity_mwh > 0 else 0.0

    # Validate constraints
    constraint_status = validate_dispatch_constraints(dispatch, config, dt_hours)

    return OptimizationResult(
        run_id=run_id,
        status="optimal",
        solver="HiGHS",
        solver_status=solver_status,
        runtime_seconds=round(runtime, 4),
        objective_value=round(pulp.value(prob.objective) or 0.0, 4),
        total_revenue=round(total_revenue, 4),
        total_energy_cost=round(total_energy_cost, 4),
        total_degradation_cost=round(total_degradation_cost, 4),
        net_profit=round(net_profit, 4),
        cycle_count=round(cycle_count, 4),
        constraint_status=constraint_status,
        dispatch=dispatch,
        battery_config=config,
        created_at=datetime.utcnow(),
    )


def validate_dispatch_constraints(
    dispatch: List[DispatchStep],
    config: BatteryConfig,
    dt_hours: float = 1.0,
    tolerance: float = 1e-4
) -> ConstraintStatus:
    """Post-solve constraint validation layer."""
    violations = []

    for step in dispatch:
        t = step.step

        # SoC bounds
        if step.soc_end < config.soc_min - tolerance:
            violations.append(f"Step {t}: SoC {step.soc_end:.4f} below min {config.soc_min}")
        if step.soc_end > config.soc_max + tolerance:
            violations.append(f"Step {t}: SoC {step.soc_end:.4f} above max {config.soc_max}")

        # Power limits
        if step.charge_power_mw > config.power_mw + tolerance:
            violations.append(f"Step {t}: Charge power {step.charge_power_mw:.2f} exceeds limit {config.power_mw}")
        if step.discharge_power_mw > config.power_mw + tolerance:
            violations.append(f"Step {t}: Discharge power {step.discharge_power_mw:.2f} exceeds limit {config.power_mw}")

        # Anti-simultaneity
        if step.charge_power_mw > tolerance and step.discharge_power_mw > tolerance:
            violations.append(f"Step {t}: Simultaneous charge ({step.charge_power_mw:.2f}) and discharge ({step.discharge_power_mw:.2f})")

        # NaN check
        if np.isnan(step.soc_end) or np.isnan(step.net_profit):
            violations.append(f"Step {t}: NaN in solution values")

    passed = len(violations) == 0
    return ConstraintStatus(passed=passed, violations=len(violations), details=violations[:10])


def _apply_scenario(config: BatteryConfig, scenario: Optional[Dict[str, Any]]) -> BatteryConfig:
    """Apply what-if scenario overrides to battery config."""
    if not scenario:
        return config

    config_dict = config.model_dump()

    # Apply multipliers
    if "efficiency_multiplier" in scenario:
        m = scenario["efficiency_multiplier"]
        config_dict["efficiency_charge"] = min(0.999, config_dict["efficiency_charge"] * m)
        config_dict["efficiency_discharge"] = min(0.999, config_dict["efficiency_discharge"] * m)

    if "capacity_multiplier" in scenario:
        config_dict["capacity_mwh"] = config_dict["capacity_mwh"] * scenario["capacity_multiplier"]

    if "degradation_multiplier" in scenario:
        config_dict["degradation_cost_per_mwh"] = config_dict["degradation_cost_per_mwh"] * scenario["degradation_multiplier"]

    if "power_multiplier" in scenario:
        config_dict["power_mw"] = config_dict["power_mw"] * scenario["power_multiplier"]

    # Direct overrides
    for key in ["soc_initial", "soc_min", "soc_max", "efficiency_charge", "efficiency_discharge",
                "capacity_mwh", "power_mw", "degradation_cost_per_mwh"]:
        if key in scenario:
            config_dict[key] = scenario[key]

    # Clamp values
    config_dict["efficiency_charge"] = min(0.999, max(0.5, config_dict["efficiency_charge"]))
    config_dict["efficiency_discharge"] = min(0.999, max(0.5, config_dict["efficiency_discharge"]))
    config_dict["soc_initial"] = max(config_dict["soc_min"], min(config_dict["soc_max"], config_dict["soc_initial"]))

    return BatteryConfig(**config_dict)


def _diagnose_infeasibility(config: BatteryConfig, prices: List[float], T: int, dt_hours: float) -> str:
    """Provide a human-readable reason for infeasibility."""
    reasons = []

    # Can terminal SoC be reached?
    if config.soc_terminal is not None:
        max_chargeable = config.soc_initial + (config.power_mw * config.efficiency_charge * dt_hours * T) / config.capacity_mwh
        if config.soc_terminal > min(max_chargeable, config.soc_max):
            reasons.append(
                f"Terminal SoC target ({config.soc_terminal:.0%}) cannot be reached within "
                f"the available charging power ({config.power_mw} MW) and horizon ({T} hours)."
            )

    if config.soc_min >= config.soc_max:
        reasons.append(f"SoC minimum ({config.soc_min:.0%}) is not less than maximum ({config.soc_max:.0%}).")

    if not reasons:
        reasons.append(
            "The optimization problem has no feasible solution. Check battery configuration "
            "parameters (SoC bounds, power limits, terminal SoC) and ensure they are consistent."
        )

    return " ".join(reasons)


def _error_result(run_id: int, message: str, runtime: float = 0.0) -> OptimizationResult:
    return OptimizationResult(
        run_id=run_id,
        status="error",
        solver="HiGHS",
        solver_status="Error",
        runtime_seconds=round(runtime, 4),
        constraint_status=ConstraintStatus(passed=False, violations=0, details=[]),
        created_at=datetime.utcnow(),
        error_message=message,
    )
