"""Backtest API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.database.database import get_db
from app.models.battery import BatteryConfig
from app.services.backtest_service import run_backtest, get_backtest_result

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


@router.post("/run", response_model=Dict[str, Any])
def run_backtest_endpoint(
    battery_config: Optional[BatteryConfig] = None,
    horizon_hours: int = Query(default=48, ge=4, le=720),
    db: Session = Depends(get_db),
):
    """
    Run historical backtest comparing Greedy vs GridPilot MPC strategies.

    Both strategies execute on actual price data with all metrics calculated.
    No results are fabricated.
    """
    try:
        return run_backtest(db, battery=battery_config, horizon_hours=horizon_hours)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Backtest failed: {str(e)}")


@router.get("/{run_id}", response_model=Dict[str, Any])
def get_backtest(run_id: int, db: Session = Depends(get_db)):
    """Get stored backtest results by ID."""
    result = get_backtest_result(db, run_id)
    if not result:
        raise HTTPException(404, f"Backtest run {run_id} not found")
    return result
