"""
Inference pipeline: load price data from DB and generate forecast.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.database.database import PriceDataDB, ForecastRunDB
from app.forecasting.model import QuantileForecastModel
from app.models.price import ForecastPoint, ForecastResponse

logger = logging.getLogger(__name__)

# Module-level model cache (trained once, reused)
_model_cache: Optional[QuantileForecastModel] = None


def get_or_train_model(db: Session, force_retrain: bool = False) -> QuantileForecastModel:
    """Get cached model or train a new one from the database prices."""
    global _model_cache
    if _model_cache is not None and not force_retrain:
        return _model_cache

    prices = db.query(PriceDataDB).order_by(PriceDataDB.timestamp).all()
    if not prices:
        logger.warning("No price data found in DB, creating untrained model")
        model = QuantileForecastModel()
        _model_cache = model
        return model

    df = pd.DataFrame([{"timestamp": p.timestamp, "price": p.price} for p in prices])
    df = df.set_index("timestamp").sort_index()

    model = QuantileForecastModel()
    info = model.train(df)
    logger.info(f"Model trained: {info}")

    _model_cache = model
    return model


def generate_forecast(
    db: Session,
    horizon_hours: int = 24,
    force_retrain: bool = False,
) -> ForecastResponse:
    """
    Generate a price forecast and store it in the database.

    Returns:
        ForecastResponse with P10/P50/P90 for next horizon_hours
    """
    # Load history
    prices = db.query(PriceDataDB).order_by(PriceDataDB.timestamp).all()

    # Create DB record
    run = ForecastRunDB(
        horizon_hours=horizon_hours,
        model_type="lightgbm",
        status="running",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        if not prices:
            # Return synthetic forecast if no data
            run.status = "done"
            run.model_type = "synthetic"
            forecasts = _synthetic_forecast(horizon_hours)
            run.results_json = json.dumps([f.model_dump() for f in forecasts])
            db.commit()
            return ForecastResponse(
                run_id=run.id,
                model_type="synthetic",
                horizon_hours=horizon_hours,
                created_at=run.created_at,
                forecasts=forecasts,
                status="done",
            )

        df = pd.DataFrame([{"timestamp": p.timestamp, "price": p.price} for p in prices])
        df = df.set_index("timestamp").sort_index()

        model = get_or_train_model(db, force_retrain=force_retrain)
        forecast_df = model.predict(df, horizon=horizon_hours)

        # Build response
        forecasts = []
        for ts, row in forecast_df.iterrows():
            forecasts.append(ForecastPoint(
                timestamp=ts,
                p10=round(float(row["p10"]), 4),
                p50=round(float(row["p50"]), 4),
                p90=round(float(row["p90"]), 4),
            ))

        run.status = "done"
        run.model_type = model.model_type
        run.results_json = json.dumps([{
            "timestamp": f.timestamp.isoformat(),
            "p10": f.p10,
            "p50": f.p50,
            "p90": f.p90,
        } for f in forecasts])
        db.commit()

        return ForecastResponse(
            run_id=run.id,
            model_type=model.model_type,
            horizon_hours=horizon_hours,
            created_at=run.created_at,
            forecasts=forecasts,
            status="done",
        )

    except Exception as e:
        logger.error(f"Forecast error: {e}")
        run.status = "failed"
        run.error_message = str(e)
        db.commit()
        raise


def get_latest_forecast(db: Session) -> Optional[ForecastResponse]:
    """Get the most recent forecast from the database."""
    run = db.query(ForecastRunDB).filter(
        ForecastRunDB.status == "done"
    ).order_by(ForecastRunDB.created_at.desc()).first()

    if not run or not run.results_json:
        return None

    try:
        data = json.loads(run.results_json)
        forecasts = [
            ForecastPoint(
                timestamp=datetime.fromisoformat(d["timestamp"]),
                p10=d["p10"],
                p50=d["p50"],
                p90=d["p90"],
            )
            for d in data
        ]
        return ForecastResponse(
            run_id=run.id,
            model_type=run.model_type or "unknown",
            horizon_hours=run.horizon_hours,
            created_at=run.created_at,
            forecasts=forecasts,
            status=run.status,
        )
    except Exception as e:
        logger.error(f"Error parsing latest forecast: {e}")
        return None


def _synthetic_forecast(horizon_hours: int) -> list:
    """Generate a synthetic forecast when no price data is available."""
    import math
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    forecasts = []
    for h in range(horizon_hours):
        ts = now + timedelta(hours=h + 1)
        # Realistic day-ahead price pattern
        hour = ts.hour
        base = 50.0
        # Peak at 9am and 6pm, trough at 3am
        diurnal = 15 * math.sin(2 * math.pi * (hour - 6) / 24) + 10 * math.sin(2 * math.pi * (hour - 15) / 12)
        p50 = max(10, base + diurnal)
        p10 = max(5, p50 - 12)
        p90 = p50 + 12
        forecasts.append(ForecastPoint(timestamp=ts, p10=round(p10, 2), p50=round(p50, 2), p90=round(p90, 2)))
    return forecasts
