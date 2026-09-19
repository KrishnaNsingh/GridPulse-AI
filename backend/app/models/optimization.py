from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.models.battery import BatteryConfig


class OptimizationRequest(BaseModel):
    battery_config: Optional[BatteryConfig] = None  # uses saved config if None
    horizon_hours: int = Field(default=24, ge=1, le=168)
    use_forecast: bool = Field(default=True, description="Use price forecast vs actual prices")
    scenario: Optional[Dict[str, Any]] = Field(default=None, description="What-if scenario overrides")


class DispatchStep(BaseModel):
    """A single timestep in the optimized dispatch schedule."""
    step: int
    timestamp: datetime
    price: float = Field(description="Price used (actual or forecast) ($/MWh)")
    price_type: str = Field(description="actual | forecast")
    charge_power_mw: float
    discharge_power_mw: float
    soc_start: float
    soc_end: float
    action: str = Field(description="charge | discharge | idle")
    revenue: float = Field(description="Revenue from discharge in this step ($)")
    energy_cost: float = Field(description="Cost of energy purchased in this step ($)")
    degradation_cost: float = Field(description="Degradation penalty in this step ($)")
    net_profit: float = Field(description="Net economic value in this step ($)")
    dod: float = Field(description="Depth of discharge fraction used in this step")


class ConstraintStatus(BaseModel):
    passed: bool
    violations: int
    details: List[str] = []


class OptimizationResult(BaseModel):
    run_id: int
    status: str = Field(description="optimal | infeasible | timeout | error")
    solver: str = Field(default="HiGHS")
    solver_status: str
    runtime_seconds: float
    objective_value: Optional[float] = None
    total_revenue: Optional[float] = None
    total_energy_cost: Optional[float] = None
    total_degradation_cost: Optional[float] = None
    net_profit: Optional[float] = None
    cycle_count: Optional[float] = None
    constraint_status: ConstraintStatus
    dispatch: List[DispatchStep] = []
    battery_config: Optional[BatteryConfig] = None
    created_at: datetime
    error_message: Optional[str] = None
    infeasibility_reason: Optional[str] = None
