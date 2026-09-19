from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.models.battery import BatteryConfig, BatteryState
from app.models.optimization import DispatchStep


class SimulationRequest(BaseModel):
    battery_config: Optional[BatteryConfig] = None
    optimization_run_id: Optional[int] = None
    mode: str = Field(default="mpc", description="mpc | open_loop")
    horizon_hours: int = Field(default=24, ge=1, le=168)


class ScenarioRequest(BaseModel):
    base_optimization_run_id: Optional[int] = None
    battery_config: Optional[BatteryConfig] = None
    scenario_name: str
    scenario_params: Dict[str, Any] = Field(
        description="Scenario parameters e.g. price_multiplier, efficiency_multiplier, etc."
    )
    horizon_hours: int = Field(default=24)


class SimulationStep(BaseModel):
    step: int
    timestamp: datetime
    action: str
    charge_power_mw: float
    discharge_power_mw: float
    soc_before: float
    soc_after: float
    price: float
    revenue: float
    energy_cost: float
    degradation_cost: float
    net_profit: float
    optimization_horizon: List[DispatchStep] = []  # MPC re-optimization result for this step
    constraint_violations: int = 0


class SimulationState(BaseModel):
    run_id: int
    mode: str
    status: str = Field(description="pending | running | paused | complete | error")
    current_step: int
    total_steps: int
    battery_state: BatteryState
    history: List[SimulationStep] = []
    cumulative_profit: float = 0.0
    cumulative_degradation_cost: float = 0.0
    created_at: datetime
    error_message: Optional[str] = None
