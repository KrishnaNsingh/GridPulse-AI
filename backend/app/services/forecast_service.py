"""Forecast service — orchestrates forecast generation and retrieval."""
from sqlalchemy.orm import Session
from app.forecasting.inference import generate_forecast, get_latest_forecast
from app.models.price import ForecastResponse
from typing import Optional


def run_forecast(db: Session, horizon_hours: int = 24, force_retrain: bool = False) -> ForecastResponse:
    return generate_forecast(db, horizon_hours=horizon_hours, force_retrain=force_retrain)


def get_forecast(db: Session) -> Optional[ForecastResponse]:
    return get_latest_forecast(db)
