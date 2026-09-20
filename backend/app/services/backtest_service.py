"""
Backtest service — compares Greedy arbitrage vs GridPulse MPC.

Both strategies execute on historical price data with identical battery models.
"""
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session

from app.database.database import BacktestRunDB, PriceDataDB
from app.models.battery import BatteryConfig
from app.optimization.mpc import run_greedy_dispatch, run_mpc_step
from app.optimization.degradation import get_degradation_summary
from app.services.optimization_service import get_default_battery_config, get_prices_for_optimization

logger = logging.getLogger(__name__)


def run_backtest(
    db: Session,
    battery: Optional[BatteryConfig] = None,
    horizon_hours: int = 48,
    scenario: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run backtest comparing Greedy vs GridPulse MPC strategies.

    Both run on the same historical price data for fair comparison.
    """
    battery = battery or get_default_battery_config(db)

    # Get historical prices
    prices, timestamps, price_type = get_prices_for_optimization(
        db, horizon_hours=horizon_hours, use_forecast=False
    )

    if len(prices) < 4:
        raise ValueError("Need at least 4 hours of price data for backtesting")

    # Apply scenario
    if scenario and "price_multiplier" in scenario:
        prices = [p * scenario["price_multiplier"] for p in prices]

    actual_hours = min(horizon_hours, len(prices))
    prices = prices[:actual_hours]
    timestamps = timestamps[:actual_hours]

    # Create DB record
    run_db = BacktestRunDB(
        status="running",
        battery_config_json=battery.model_dump_json(),
        start_date=timestamps[0].isoformat() if timestamps else None,
        end_date=timestamps[-1].isoformat() if timestamps else None,
    )
    db.add(run_db)
    db.commit()
    db.refresh(run_db)

    try:
        # ── Run Greedy ────────────────────────────────────────────────────────
        logger.info("Running greedy baseline...")
        greedy_steps = run_greedy_dispatch(prices, timestamps, battery, dt_hours=1.0)
        greedy_metrics = _compute_metrics(greedy_steps, battery)

        # ── Run GridPulse MPC ─────────────────────────────────────────────────
        logger.info("Running GridPulse MPC...")
        mpc_steps = _run_mpc_backtest(prices, timestamps, battery)
        mpc_metrics = _compute_metrics(mpc_steps, battery)

        # ── Comparison ───────────────────────────────────────────────────────
        comparison = _compute_comparison(greedy_metrics, mpc_metrics)

        # Persist
        run_db.status = "complete"
        run_db.greedy_results_json = json.dumps({"metrics": greedy_metrics, "steps": greedy_steps})
        run_db.mpc_results_json = json.dumps({"metrics": mpc_metrics, "steps": mpc_steps})
        run_db.comparison_json = json.dumps(comparison)
        db.commit()

        return {
            "run_id": run_db.id,
            "status": "complete",
            "horizon_hours": actual_hours,
            "price_type": price_type,
            "greedy": {"metrics": greedy_metrics, "steps": greedy_steps[:actual_hours]},
            "mpc": {"metrics": mpc_metrics, "steps": mpc_steps[:actual_hours]},
            "comparison": comparison,
        }

    except Exception as e:
        logger.error(f"Backtest error: {e}")
        run_db.status = "failed"
        run_db.error_message = str(e)
        db.commit()
        raise


def _run_mpc_backtest(
    prices: List[float],
    timestamps: List[datetime],
    battery: BatteryConfig,
) -> List[Dict[str, Any]]:
    """Run MPC strategy over the historical data."""
    steps = []
    current_soc = battery.soc_initial

    for i, (price, ts) in enumerate(zip(prices, timestamps)):
        remaining_prices = prices[i + 1: i + 25]
        remaining_timestamps = timestamps[i + 1: i + 25]

        result = run_mpc_step(
            current_soc=current_soc,
            current_time=ts,
            price_at_t=price,
            forecast_prices=remaining_prices,
            forecast_timestamps=remaining_timestamps,
            config=battery,
            dt_hours=1.0,
            run_id=9000 + i,
        )

        step = {
            "step": i,
            "timestamp": ts.isoformat(),
            "price": price,
            "action": result["action"],
            "charge_power_mw": result["charge_power_mw"],
            "discharge_power_mw": result["discharge_power_mw"],
            "soc_start": round(current_soc, 4),
            "soc_end": round(result["soc_new"], 4),
            "revenue": result["revenue"],
            "energy_cost": result["energy_cost"],
            "degradation_cost": result["degradation_cost"],
            "net_profit": result["net_profit"],
        }
        steps.append(step)
        current_soc = result["soc_new"]

    return steps


def _compute_metrics(steps: List[Dict], battery: BatteryConfig) -> Dict[str, Any]:
    """Compute aggregate metrics from a list of dispatch steps."""
    if not steps:
        return {}

    total_revenue = sum(s["revenue"] for s in steps)
    total_energy_cost = sum(s["energy_cost"] for s in steps)
    total_degradation_cost = sum(s["degradation_cost"] for s in steps)
    net_profit = total_revenue - total_energy_cost - total_degradation_cost

    charge_steps = [s for s in steps if s["action"] == "charge"]
    discharge_steps = [s for s in steps if s["action"] == "discharge"]
    total_discharge_energy = sum(s["discharge_power_mw"] for s in discharge_steps)
    cycle_count = total_discharge_energy / max(battery.capacity_mwh, 0.001)

    soc_traj = [s["soc_start"] for s in steps] + [steps[-1]["soc_end"]]
    deg_summary = get_degradation_summary(soc_traj, battery.capacity_mwh, battery.degradation_cost_per_mwh)

    # Cumulative profit over time
    cumulative = []
    running = 0.0
    for s in steps:
        running += s["net_profit"]
        cumulative.append({"timestamp": s["timestamp"], "cumulative_profit": round(running, 4)})

    return {
        "total_revenue": round(total_revenue, 4),
        "total_energy_cost": round(total_energy_cost, 4),
        "total_degradation_cost": round(total_degradation_cost, 4),
        "net_profit": round(net_profit, 4),
        "avg_profit_per_hour": round(net_profit / max(len(steps), 1), 4),
        "cycle_count": round(cycle_count, 4),
        "charge_hours": len(charge_steps),
        "discharge_hours": len(discharge_steps),
        "idle_hours": len(steps) - len(charge_steps) - len(discharge_steps),
        "final_soc": round(steps[-1]["soc_end"], 4),
        "avg_soc": round(sum(s["soc_start"] for s in steps) / len(steps), 4),
        "average_dod": deg_summary["average_dod"],
        "dominant_tier": deg_summary["dominant_tier"],
        "cumulative_profit": cumulative,
    }


def _compute_comparison(greedy: Dict, mpc: Dict) -> Dict[str, Any]:
    """Compute comparison between greedy and MPC strategies."""
    if not greedy or not mpc:
        return {}

    profit_improvement = mpc["net_profit"] - greedy["net_profit"]
    profit_improvement_pct = (
        (profit_improvement / abs(greedy["net_profit"])) * 100
        if greedy["net_profit"] != 0 else 0
    )
    degradation_savings = greedy["total_degradation_cost"] - mpc["total_degradation_cost"]

    return {
        "profit_improvement": round(profit_improvement, 4),
        "profit_improvement_pct": round(profit_improvement_pct, 2),
        "degradation_savings": round(degradation_savings, 4),
        "mpc_wins": profit_improvement > 0,
        "cycle_reduction": round(greedy["cycle_count"] - mpc["cycle_count"], 4),
    }


def get_backtest_result(db: Session, run_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve stored backtest result."""
    run_db = db.query(BacktestRunDB).filter(BacktestRunDB.id == run_id).first()
    if not run_db:
        return None

    result = {
        "run_id": run_db.id,
        "status": run_db.status,
        "created_at": run_db.created_at.isoformat(),
    }
    if run_db.greedy_results_json:
        result["greedy"] = json.loads(run_db.greedy_results_json)
    if run_db.mpc_results_json:
        result["mpc"] = json.loads(run_db.mpc_results_json)
    if run_db.comparison_json:
        result["comparison"] = json.loads(run_db.comparison_json)
    return result
