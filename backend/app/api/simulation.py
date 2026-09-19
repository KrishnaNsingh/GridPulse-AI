"""Simulation and Digital Twin API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.database.database import get_db
from app.models.simulation import SimulationRequest, SimulationState, ScenarioRequest
from app.models.battery import BatteryConfig
from app.services.simulation_service import (
    create_simulation,
    run_full_mpc_simulation,
    run_scenario_simulation,
    get_simulation_state,
)
from app.services.optimization_service import get_default_battery_config

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


@router.post("/run", response_model=Dict[str, Any])
def run_simulation(
    request: SimulationRequest,
    db: Session = Depends(get_db),
):
    """
    Run a full MPC closed-loop simulation.

    Executes the receding-horizon MPC loop for the specified horizon,
    returning the complete step-by-step simulation history.
    """
    battery = request.battery_config or get_default_battery_config(db)

    # Create simulation record
    sim_state = create_simulation(db, request)
    run_id = sim_state.run_id

    # Run synchronously for now (can be moved to background for large horizons)
    try:
        result = run_full_mpc_simulation(
            db=db,
            simulation_run_id=run_id,
            battery=battery,
            horizon_hours=request.horizon_hours,
        )
        return {
            "run_id": result.run_id,
            "status": result.status,
            "mode": result.mode,
            "total_steps": result.total_steps,
            "current_step": result.current_step,
            "cumulative_profit": result.cumulative_profit,
            "cumulative_degradation_cost": result.cumulative_degradation_cost,
            "battery_state": result.battery_state.model_dump(),
            "history": [s.model_dump(mode="json") for s in result.history],
        }
    except Exception as e:
        raise HTTPException(500, f"Simulation failed: {str(e)}")


@router.post("/scenario", response_model=Dict[str, Any])
def run_scenario(
    request: ScenarioRequest,
    db: Session = Depends(get_db),
):
    """
    Run a what-if scenario comparison.

    Compares base case vs scenario with modified parameters.
    Both strategies execute fully — no results are fabricated.
    """
    try:
        result = run_scenario_simulation(db, request)
        return result
    except Exception as e:
        raise HTTPException(500, f"Scenario simulation failed: {str(e)}")


@router.get("/{run_id}", response_model=Dict[str, Any])
def get_simulation(run_id: int, db: Session = Depends(get_db)):
    """Get simulation state by ID."""
    state = get_simulation_state(db, run_id)
    if not state:
        raise HTTPException(404, f"Simulation run {run_id} not found")
    return {
        "run_id": state.run_id,
        "status": state.status,
        "mode": state.mode,
        "current_step": state.current_step,
        "total_steps": state.total_steps,
        "cumulative_profit": state.cumulative_profit,
        "battery_state": state.battery_state.model_dump(),
        "history": [s.model_dump(mode="json") for s in state.history],
    }
