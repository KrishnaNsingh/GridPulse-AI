from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class BatteryConfig(BaseModel):
    """Battery configuration parameters."""
    name: str = Field(default="Default Battery", description="Battery system name")
    capacity_mwh: float = Field(default=10.0, gt=0, description="Nominal energy capacity (MWh)")
    power_mw: float = Field(default=2.5, gt=0, description="Maximum charge/discharge power (MW)")
    efficiency_charge: float = Field(default=0.95, gt=0, le=1.0, description="Charging efficiency (0-1)")
    efficiency_discharge: float = Field(default=0.95, gt=0, le=1.0, description="Discharging efficiency (0-1)")
    soc_min: float = Field(default=0.10, ge=0, lt=1.0, description="Minimum state of charge (0-1)")
    soc_max: float = Field(default=0.90, gt=0, le=1.0, description="Maximum state of charge (0-1)")
    soc_initial: float = Field(default=0.50, ge=0, le=1.0, description="Initial state of charge (0-1)")
    soc_terminal: Optional[float] = Field(default=None, ge=0, le=1.0, description="Required terminal SoC (0-1)")
    degradation_cost_per_mwh: float = Field(default=5.0, ge=0, description="Base degradation cost ($/MWh cycled)")
    reserve_level: float = Field(default=0.0, ge=0, le=1.0, description="Reserve SoC that cannot be dispatched (0-1)")

    @field_validator("soc_max")
    @classmethod
    def soc_max_gt_min(cls, v, info):
        if "soc_min" in info.data and v <= info.data["soc_min"]:
            raise ValueError("soc_max must be greater than soc_min")
        return v

    @field_validator("soc_initial")
    @classmethod
    def soc_initial_in_range(cls, v, info):
        soc_min = info.data.get("soc_min", 0.0)
        soc_max = info.data.get("soc_max", 1.0)
        if v < soc_min or v > soc_max:
            raise ValueError(f"soc_initial must be between soc_min ({soc_min}) and soc_max ({soc_max})")
        return v


class BatteryConfigResponse(BatteryConfig):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatteryState(BaseModel):
    """Real-time battery state."""
    soc: float = Field(description="Current state of charge (0-1)")
    energy_mwh: float = Field(description="Current stored energy (MWh)")
    action: str = Field(description="Current action: charge | discharge | idle")
    charge_power_mw: float = Field(default=0.0, description="Current charge power (MW)")
    discharge_power_mw: float = Field(default=0.0, description="Current discharge power (MW)")
    timestamp: Optional[datetime] = None
    cycle_count: float = Field(default=0.0, description="Equivalent full cycles")
    total_degradation_cost: float = Field(default=0.0, description="Cumulative degradation cost ($)")
    total_revenue: float = Field(default=0.0, description="Cumulative revenue ($)")
    total_energy_cost: float = Field(default=0.0, description="Cumulative energy purchase cost ($)")
