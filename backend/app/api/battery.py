"""Battery configuration API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db, BatteryConfigDB
from app.models.battery import BatteryConfig, BatteryConfigResponse
from app.core.config import settings
from datetime import datetime

router = APIRouter(prefix="/api/battery", tags=["battery"])


@router.get("/config", response_model=BatteryConfig)
def get_battery_config(db: Session = Depends(get_db)):
    """Get the active battery configuration."""
    config_db = db.query(BatteryConfigDB).filter(BatteryConfigDB.is_active == True).first()
    if not config_db:
        # Return defaults
        return BatteryConfig(
            capacity_mwh=settings.default_capacity_mwh,
            power_mw=settings.default_power_mw,
            efficiency_charge=settings.default_efficiency_charge,
            efficiency_discharge=settings.default_efficiency_discharge,
            soc_min=settings.default_soc_min,
            soc_max=settings.default_soc_max,
            soc_initial=settings.default_soc_initial,
        )
    return BatteryConfig(
        name=config_db.name,
        capacity_mwh=config_db.capacity_mwh,
        power_mw=config_db.power_mw,
        efficiency_charge=config_db.efficiency_charge,
        efficiency_discharge=config_db.efficiency_discharge,
        soc_min=config_db.soc_min,
        soc_max=config_db.soc_max,
        soc_initial=config_db.soc_initial,
        soc_terminal=config_db.soc_terminal,
        degradation_cost_per_mwh=config_db.degradation_cost_per_mwh,
        reserve_level=config_db.reserve_level,
    )


@router.post("/config", response_model=BatteryConfig)
def save_battery_config(config: BatteryConfig, db: Session = Depends(get_db)):
    """Save or update the battery configuration."""
    # Deactivate existing
    db.query(BatteryConfigDB).update({BatteryConfigDB.is_active: False})

    # Create new
    config_db = BatteryConfigDB(
        name=config.name,
        capacity_mwh=config.capacity_mwh,
        power_mw=config.power_mw,
        efficiency_charge=config.efficiency_charge,
        efficiency_discharge=config.efficiency_discharge,
        soc_min=config.soc_min,
        soc_max=config.soc_max,
        soc_initial=config.soc_initial,
        soc_terminal=config.soc_terminal,
        degradation_cost_per_mwh=config.degradation_cost_per_mwh,
        reserve_level=config.reserve_level,
        is_active=True,
    )
    db.add(config_db)
    db.commit()
    db.refresh(config_db)
    return config
