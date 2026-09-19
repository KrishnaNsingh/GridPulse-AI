"""Forecast API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.price import ForecastResponse
from app.services.forecast_service import run_forecast, get_forecast

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.post("/generate", response_model=ForecastResponse)
def generate_forecast(
    horizon_hours: int = Query(default=24, ge=1, le=168),
    force_retrain: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    """Generate a new price forecast."""
    try:
        return run_forecast(db, horizon_hours=horizon_hours, force_retrain=force_retrain)
    except Exception as e:
        raise HTTPException(500, f"Forecast generation failed: {str(e)}")


@router.get("/latest", response_model=ForecastResponse)
def get_latest_forecast(db: Session = Depends(get_db)):
    """Get the most recent forecast."""
    forecast = get_forecast(db)
    if not forecast:
        # Auto-generate if none exists
        try:
            return run_forecast(db, horizon_hours=24)
        except Exception as e:
            raise HTTPException(404, f"No forecast available and generation failed: {str(e)}")
    return forecast
