"""Analytics service — aggregates metrics for the analytics dashboard."""
import json
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.database.database import OptimizationRunDB, PriceDataDB, ForecastRunDB, SimulationRunDB

logger = logging.getLogger(__name__)


def get_analytics_summary(db: Session) -> Dict[str, Any]:
    """Aggregate analytics from all stored runs."""
    # Latest optimization
    latest_opt = db.query(OptimizationRunDB).filter(
        OptimizationRunDB.status == "optimal"
    ).order_by(OptimizationRunDB.created_at.desc()).first()

    # All completed optimizations
    all_opts = db.query(OptimizationRunDB).filter(
        OptimizationRunDB.status == "optimal"
    ).all()

    # Price data
    prices_db = db.query(PriceDataDB).order_by(PriceDataDB.timestamp).all()

    # Latest forecast
    latest_forecast = db.query(ForecastRunDB).filter(
        ForecastRunDB.status == "done"
    ).order_by(ForecastRunDB.created_at.desc()).first()

    # Simulations
    sims = db.query(SimulationRunDB).filter(
        SimulationRunDB.status == "complete"
    ).all()

    # Build summary
    summary: Dict[str, Any] = {
        "optimization_runs": len(all_opts),
        "simulation_runs": len(sims),
        "price_records": len(prices_db),
    }

    # Price stats
    if prices_db:
        price_vals = [p.price for p in prices_db]
        summary["price_stats"] = {
            "min": round(min(price_vals), 2),
            "max": round(max(price_vals), 2),
            "mean": round(sum(price_vals) / len(price_vals), 2),
            "count": len(price_vals),
        }
        summary["prices"] = [
            {"timestamp": p.timestamp.isoformat(), "price": p.price}
            for p in prices_db
        ]

    # Latest optimization metrics
    if latest_opt:
        summary["latest_optimization"] = {
            "run_id": latest_opt.id,
            "net_profit": latest_opt.net_profit,
            "total_revenue": latest_opt.total_revenue,
            "total_energy_cost": latest_opt.total_energy_cost,
            "total_degradation_cost": latest_opt.total_degradation_cost,
            "runtime_seconds": latest_opt.runtime_seconds,
            "constraint_violations": latest_opt.constraint_violations,
            "created_at": latest_opt.created_at.isoformat(),
        }

        # Parse dispatch
        if latest_opt.dispatch_json:
            try:
                dispatch = json.loads(latest_opt.dispatch_json)
                summary["latest_dispatch"] = dispatch
                soc_traj = [d["soc_start"] for d in dispatch] + [dispatch[-1]["soc_end"]] if dispatch else []
                summary["soc_trajectory"] = soc_traj
            except Exception:
                pass

    # Aggregate profit over runs
    if all_opts:
        summary["profit_history"] = [
            {
                "run_id": o.id,
                "created_at": o.created_at.isoformat(),
                "net_profit": o.net_profit or 0,
                "degradation_cost": o.total_degradation_cost or 0,
                "revenue": o.total_revenue or 0,
                "runtime_seconds": o.runtime_seconds or 0,
            }
            for o in sorted(all_opts, key=lambda x: x.created_at)
        ]

    # Latest forecast
    if latest_forecast and latest_forecast.results_json:
        try:
            summary["latest_forecast"] = json.loads(latest_forecast.results_json)
        except Exception:
            pass

    # Simulation summaries
    if sims:
        sim_summaries = []
        for sim in sims:
            if sim.history_json:
                try:
                    history = json.loads(sim.history_json)
                    total_profit = sum(s.get("net_profit", 0) for s in history)
                    total_deg = sum(s.get("degradation_cost", 0) for s in history)
                    sim_summaries.append({
                        "run_id": sim.id,
                        "mode": sim.mode,
                        "steps": sim.current_step,
                        "net_profit": round(total_profit, 4),
                        "degradation_cost": round(total_deg, 4),
                        "created_at": sim.created_at.isoformat(),
                    })
                except Exception:
                    pass
        summary["simulation_summaries"] = sim_summaries

    return summary
