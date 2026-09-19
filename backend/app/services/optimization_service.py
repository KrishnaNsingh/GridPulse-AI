"""
Optimization service — runs MILP, validates results, persists to database.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from sqlalchemy.orm import Session

from app.database.database import OptimizationRunDB, PriceDataDB, BatteryConfigDB
from app.models.battery import BatteryConfig
from app.models.optimization import OptimizationRequest, OptimizationResult
from app.optimization.milp import build_and_solve_milp
from app.core.config import settings
from app.forecasting.inference import generate_forecast

logger = logging.getLogger(__name__)


def get_default_battery_config(db: Session) -> BatteryConfig:
    """Get the active battery config from DB or return defaults."""
    config_db = db.query(BatteryConfigDB).filter(BatteryConfigDB.is_active == True).first()
    if config_db:
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

    return BatteryConfig(
        capacity_mwh=settings.default_capacity_mwh,
        power_mw=settings.default_power_mw,
        efficiency_charge=settings.default_efficiency_charge,
        efficiency_discharge=settings.default_efficiency_discharge,
        soc_min=settings.default_soc_min,
        soc_max=settings.default_soc_max,
        soc_initial=settings.default_soc_initial,
    )


def get_prices_for_optimization(
    db: Session,
    horizon_hours: int = 24,
    use_forecast: bool = True,
) -> tuple[List[float], List[datetime], str]:
    """
    Get prices and timestamps for optimization.

    Returns (prices, timestamps, price_type)
    where price_type is 'actual' or 'forecast'
    """
    # Try to get recent actual prices
    prices_db = (
        db.query(PriceDataDB)
        .order_by(PriceDataDB.timestamp.desc())
        .limit(horizon_hours * 2)
        .all()
    )

    if prices_db and not use_forecast:
        # Use most recent actual prices
        sorted_prices = sorted(prices_db, key=lambda x: x.timestamp)[-horizon_hours:]
        prices = [p.price for p in sorted_prices]
        timestamps = [p.timestamp for p in sorted_prices]
        # Pad to horizon if needed
        while len(prices) < horizon_hours:
            prices.append(prices[-1])
            timestamps.append(timestamps[-1] + timedelta(hours=1))
        return prices[:horizon_hours], timestamps[:horizon_hours], "actual"

    # Use forecast
    try:
        forecast = generate_forecast(db, horizon_hours=horizon_hours)
        prices = [f.p50 for f in forecast.forecasts]
        timestamps = [f.timestamp for f in forecast.forecasts]
        if prices:
            return prices[:horizon_hours], timestamps[:horizon_hours], "forecast"
    except Exception as e:
        logger.warning(f"Forecast failed, using actual prices: {e}")

    # Last resort: use actual prices
    if prices_db:
        sorted_prices = sorted(prices_db, key=lambda x: x.timestamp)[-horizon_hours:]
        prices = [p.price for p in sorted_prices]
        timestamps = [p.timestamp for p in sorted_prices]
        while len(prices) < horizon_hours:
            prices.append(prices[-1])
            timestamps.append(timestamps[-1] + timedelta(hours=1))
        return prices[:horizon_hours], timestamps[:horizon_hours], "actual"

    # Synthetic fallback
    import math
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    prices = []
    timestamps = []
    for h in range(horizon_hours):
        ts = now + timedelta(hours=h)
        hour = ts.hour
        base = 50.0
        diurnal = 15 * math.sin(2 * math.pi * (hour - 6) / 24)
        prices.append(max(10, base + diurnal))
        timestamps.append(ts)
    return prices, timestamps, "synthetic"


def run_optimization(db: Session, request: OptimizationRequest) -> OptimizationResult:
    """
    Run the MILP optimization and persist results to the database.
    """
    # Determine battery config
    battery = request.battery_config or get_default_battery_config(db)

    # Get prices
    prices, timestamps, price_type = get_prices_for_optimization(
        db,
        horizon_hours=request.horizon_hours,
        use_forecast=request.use_forecast,
    )

    if not prices:
        raise ValueError("No price data available for optimization")

    # Apply scenario price multiplier if present
    if request.scenario and "price_multiplier" in request.scenario:
        m = request.scenario["price_multiplier"]
        prices = [p * m for p in prices]
    if request.scenario and "price_spike" in request.scenario:
        spike_hour = request.scenario.get("spike_hour", 12)
        spike_mult = request.scenario.get("spike_magnitude", 3.0)
        spike_duration = request.scenario.get("spike_duration", 3)
        for h in range(spike_hour, min(spike_hour + spike_duration, len(prices))):
            prices[h] *= spike_mult

    # Create DB record
    run_db = OptimizationRunDB(
        status="running",
        battery_config_json=battery.model_dump_json(),
    )
    db.add(run_db)
    db.commit()
    db.refresh(run_db)

    try:
        result = build_and_solve_milp(
            battery=battery,
            prices=prices,
            timestamps=timestamps,
            dt_hours=1.0,
            run_id=run_db.id,
            price_type=price_type,
            scenario=request.scenario,
        )

        # Persist result
        run_db.status = result.status
        run_db.solver = result.solver
        run_db.solver_status = result.solver_status
        run_db.runtime_seconds = result.runtime_seconds
        run_db.objective_value = result.objective_value
        run_db.total_revenue = result.total_revenue
        run_db.total_energy_cost = result.total_energy_cost
        run_db.total_degradation_cost = result.total_degradation_cost
        run_db.net_profit = result.net_profit
        run_db.constraint_violations = result.constraint_status.violations
        run_db.dispatch_json = json.dumps([d.model_dump(mode="json") for d in result.dispatch])
        run_db.error_message = result.error_message
        db.commit()

        return result

    except Exception as e:
        logger.error(f"Optimization error: {e}")
        run_db.status = "error"
        run_db.error_message = str(e)
        db.commit()
        raise


def get_optimization_result(db: Session, run_id: int) -> Optional[OptimizationResult]:
    """Retrieve a stored optimization result from the database."""
    run_db = db.query(OptimizationRunDB).filter(OptimizationRunDB.id == run_id).first()
    if not run_db:
        return None

    dispatch = []
    if run_db.dispatch_json:
        from app.models.optimization import DispatchStep
        try:
            raw = json.loads(run_db.dispatch_json)
            dispatch = [DispatchStep(**d) for d in raw]
        except Exception:
            pass

    battery_config = None
    if run_db.battery_config_json:
        try:
            battery_config = BatteryConfig.model_validate_json(run_db.battery_config_json)
        except Exception:
            pass

    from app.models.optimization import ConstraintStatus
    constraint_status = ConstraintStatus(
        passed=run_db.constraint_violations == 0,
        violations=run_db.constraint_violations or 0,
    )

    return OptimizationResult(
        run_id=run_db.id,
        status=run_db.status,
        solver=run_db.solver or "HiGHS",
        solver_status=run_db.solver_status or "Unknown",
        runtime_seconds=run_db.runtime_seconds or 0.0,
        objective_value=run_db.objective_value,
        total_revenue=run_db.total_revenue,
        total_energy_cost=run_db.total_energy_cost,
        total_degradation_cost=run_db.total_degradation_cost,
        net_profit=run_db.net_profit,
        constraint_status=constraint_status,
        dispatch=dispatch,
        battery_config=battery_config,
        created_at=run_db.created_at,
        error_message=run_db.error_message,
    )
