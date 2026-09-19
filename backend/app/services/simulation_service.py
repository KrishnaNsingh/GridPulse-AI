"""
Simulation service — battery digital twin and MPC closed-loop simulation.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session

from app.database.database import SimulationRunDB, PriceDataDB
from app.models.battery import BatteryConfig, BatteryState
from app.models.simulation import SimulationRequest, SimulationState, SimulationStep, ScenarioRequest
from app.models.optimization import OptimizationRequest
from app.optimization.mpc import run_mpc_step, simulate_battery_response
from app.optimization.degradation import compute_degradation_cost_per_step
from app.services.optimization_service import get_default_battery_config, get_prices_for_optimization, run_optimization

logger = logging.getLogger(__name__)


def create_simulation(db: Session, request: SimulationRequest) -> SimulationState:
    """Create and initialize a new simulation run."""
    battery = request.battery_config or get_default_battery_config(db)

    run_db = SimulationRunDB(
        mode=request.mode,
        status="pending",
        total_steps=request.horizon_hours,
        battery_config_json=battery.model_dump_json(),
        state_json=json.dumps({"soc": battery.soc_initial}),
        history_json=json.dumps([]),
    )
    db.add(run_db)
    db.commit()
    db.refresh(run_db)

    battery_state = BatteryState(
        soc=battery.soc_initial,
        energy_mwh=battery.soc_initial * battery.capacity_mwh,
        action="idle",
        charge_power_mw=0.0,
        discharge_power_mw=0.0,
        timestamp=datetime.utcnow(),
    )

    return SimulationState(
        run_id=run_db.id,
        mode=request.mode,
        status="pending",
        current_step=0,
        total_steps=request.horizon_hours,
        battery_state=battery_state,
        history=[],
        created_at=run_db.created_at,
    )


def run_full_mpc_simulation(
    db: Session,
    simulation_run_id: int,
    battery: BatteryConfig,
    horizon_hours: int = 24,
    scenario: Optional[Dict[str, Any]] = None,
) -> SimulationState:
    """
    Run the full MPC closed-loop simulation.

    At each step:
    1. Get current SoC and price
    2. Generate forecast for remaining horizon
    3. Run MILP optimization
    4. Execute first action
    5. Simulate battery response
    6. Record state
    7. Shift horizon

    Args:
        db: Database session
        simulation_run_id: ID of SimulationRunDB record
        battery: Battery configuration
        horizon_hours: Number of steps to simulate
        scenario: Optional what-if scenario params
    """
    run_db = db.query(SimulationRunDB).filter(SimulationRunDB.id == simulation_run_id).first()
    if not run_db:
        raise ValueError(f"Simulation run {simulation_run_id} not found")

    run_db.status = "running"
    db.commit()

    # Get price data for simulation
    prices, timestamps, price_type = get_prices_for_optimization(db, horizon_hours=horizon_hours * 2, use_forecast=False)

    # Apply scenario price modifications
    if scenario:
        if "price_multiplier" in scenario:
            prices = [p * scenario["price_multiplier"] for p in prices]
        if "price_spike" in scenario:
            spike_hour = scenario.get("spike_hour", 6)
            spike_mult = scenario.get("spike_magnitude", 3.0)
            spike_duration = scenario.get("spike_duration", 3)
            for h in range(spike_hour, min(spike_hour + spike_duration, len(prices))):
                prices[h] *= spike_mult

    current_soc = battery.soc_initial
    history = []
    cumulative_profit = 0.0
    cumulative_degradation = 0.0

    # Simulation loop
    for step in range(min(horizon_hours, len(prices))):
        current_price = prices[step]
        current_ts = timestamps[step] if step < len(timestamps) else datetime.utcnow() + timedelta(hours=step)

        # Remaining forecast prices (look-ahead window)
        remaining_prices = prices[step + 1: step + 25]
        remaining_timestamps = timestamps[step + 1: step + 25] if step + 1 < len(timestamps) else [
            current_ts + timedelta(hours=i + 1) for i in range(len(remaining_prices))
        ]

        # Run MPC step
        mpc_result = run_mpc_step(
            current_soc=current_soc,
            current_time=current_ts,
            price_at_t=current_price,
            forecast_prices=remaining_prices,
            forecast_timestamps=remaining_timestamps,
            config=battery,
            dt_hours=1.0,
            run_id=simulation_run_id * 100 + step,
        )

        new_soc = mpc_result["soc_new"]

        sim_step = SimulationStep(
            step=step,
            timestamp=current_ts,
            action=mpc_result["action"],
            charge_power_mw=mpc_result["charge_power_mw"],
            discharge_power_mw=mpc_result["discharge_power_mw"],
            soc_before=round(current_soc, 4),
            soc_after=round(new_soc, 4),
            price=current_price,
            revenue=mpc_result["revenue"],
            energy_cost=mpc_result["energy_cost"],
            degradation_cost=mpc_result["degradation_cost"],
            net_profit=mpc_result["net_profit"],
            constraint_violations=mpc_result["constraint_violations"],
        )

        history.append(sim_step)
        current_soc = new_soc
        cumulative_profit += mpc_result["net_profit"]
        cumulative_degradation += mpc_result["degradation_cost"]

        # Update DB incrementally
        run_db.current_step = step + 1
        run_db.history_json = json.dumps([s.model_dump(mode="json") for s in history])
        run_db.state_json = json.dumps({"soc": current_soc, "cumulative_profit": cumulative_profit})
        db.commit()

    # Final state
    run_db.status = "complete"
    db.commit()

    battery_state = BatteryState(
        soc=current_soc,
        energy_mwh=current_soc * battery.capacity_mwh,
        action="idle",
        charge_power_mw=0.0,
        discharge_power_mw=0.0,
        total_degradation_cost=cumulative_degradation,
        total_revenue=sum(s.revenue for s in history),
        total_energy_cost=sum(s.energy_cost for s in history),
        cycle_count=sum(s.discharge_power_mw for s in history) / max(battery.capacity_mwh, 0.001),
    )

    return SimulationState(
        run_id=simulation_run_id,
        mode="mpc",
        status="complete",
        current_step=len(history),
        total_steps=horizon_hours,
        battery_state=battery_state,
        history=history,
        cumulative_profit=cumulative_profit,
        cumulative_degradation_cost=cumulative_degradation,
        created_at=run_db.created_at,
    )


def run_scenario_simulation(
    db: Session,
    request: ScenarioRequest,
) -> Dict[str, Any]:
    """
    Run a what-if scenario and return comparison between base and scenario.
    """
    battery = request.battery_config or get_default_battery_config(db)

    # Run base case
    base_request = OptimizationRequest(
        battery_config=battery,
        horizon_hours=request.horizon_hours,
        use_forecast=True,
    )
    base_result = run_optimization(db, base_request)

    # Run scenario case
    scenario_request = OptimizationRequest(
        battery_config=battery,
        horizon_hours=request.horizon_hours,
        use_forecast=True,
        scenario=request.scenario_params,
    )
    scenario_result = run_optimization(db, scenario_request)

    return {
        "scenario_name": request.scenario_name,
        "base": {
            "run_id": base_result.run_id,
            "status": base_result.status,
            "net_profit": base_result.net_profit,
            "total_revenue": base_result.total_revenue,
            "total_energy_cost": base_result.total_energy_cost,
            "total_degradation_cost": base_result.total_degradation_cost,
            "cycle_count": base_result.cycle_count,
            "constraint_violations": base_result.constraint_status.violations,
            "runtime_seconds": base_result.runtime_seconds,
            "dispatch": [d.model_dump(mode="json") for d in base_result.dispatch],
        },
        "scenario": {
            "run_id": scenario_result.run_id,
            "status": scenario_result.status,
            "net_profit": scenario_result.net_profit,
            "total_revenue": scenario_result.total_revenue,
            "total_energy_cost": scenario_result.total_energy_cost,
            "total_degradation_cost": scenario_result.total_degradation_cost,
            "cycle_count": scenario_result.cycle_count,
            "constraint_violations": scenario_result.constraint_status.violations,
            "runtime_seconds": scenario_result.runtime_seconds,
            "dispatch": [d.model_dump(mode="json") for d in scenario_result.dispatch],
        },
    }


def get_simulation_state(db: Session, run_id: int) -> Optional[SimulationState]:
    """Retrieve simulation state from DB."""
    run_db = db.query(SimulationRunDB).filter(SimulationRunDB.id == run_id).first()
    if not run_db:
        return None

    history = []
    if run_db.history_json:
        try:
            raw = json.loads(run_db.history_json)
            history = [SimulationStep(**s) for s in raw]
        except Exception:
            pass

    battery = BatteryConfig()
    if run_db.battery_config_json:
        try:
            battery = BatteryConfig.model_validate_json(run_db.battery_config_json)
        except Exception:
            pass

    current_soc = battery.soc_initial
    if run_db.state_json:
        try:
            state = json.loads(run_db.state_json)
            current_soc = state.get("soc", battery.soc_initial)
        except Exception:
            pass

    battery_state = BatteryState(
        soc=current_soc,
        energy_mwh=current_soc * battery.capacity_mwh,
        action="idle",
    )

    return SimulationState(
        run_id=run_db.id,
        mode=run_db.mode,
        status=run_db.status,
        current_step=run_db.current_step,
        total_steps=run_db.total_steps,
        battery_state=battery_state,
        history=history,
        cumulative_profit=sum(s.net_profit for s in history),
        cumulative_degradation_cost=sum(s.degradation_cost for s in history),
        created_at=run_db.created_at,
        error_message=run_db.error_message,
    )
