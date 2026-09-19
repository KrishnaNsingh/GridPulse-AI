"""Price data API endpoints — upload, history, validation."""
import io
import csv
import logging
from typing import Optional
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.database.database import get_db, PriceDataDB
from app.models.price import PriceUploadResponse, PriceHistoryResponse, PricePoint

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.post("/upload", response_model=PriceUploadResponse)
async def upload_prices(
    file: UploadFile = File(...),
    dataset_name: str = Query(default="upload"),
    db: Session = Depends(get_db),
):
    """
    Upload historical price data as CSV.

    Expected CSV format:
        timestamp,price
        2024-01-01 00:00:00,45.23
        ...

    Timestamps can be any parseable format.
    Prices should be in $/MWh.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "File must be a CSV")

    content = await file.read()
    errors = []

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Cannot parse CSV: {str(e)}")

    # Normalize column names
    df.columns = [c.strip().lower() for c in df.columns]

    # Find timestamp and price columns
    ts_col = next((c for c in df.columns if "time" in c or "date" in c), None)
    price_col = next((c for c in df.columns if "price" in c or "value" in c or "lmp" in c), None)

    if ts_col is None:
        raise HTTPException(400, f"No timestamp column found. Available columns: {list(df.columns)}")
    if price_col is None:
        raise HTTPException(400, f"No price column found. Available columns: {list(df.columns)}")

    # Parse timestamps
    try:
        df[ts_col] = pd.to_datetime(df[ts_col])
    except Exception as e:
        raise HTTPException(400, f"Cannot parse timestamps: {str(e)}")

    # Parse prices
    df[price_col] = pd.to_numeric(df[price_col], errors="coerce")

    # Validate
    null_ts = df[ts_col].isnull().sum()
    null_prices = df[price_col].isnull().sum()
    neg_prices = (df[price_col] < -100).sum()
    extreme_prices = (df[price_col] > 10000).sum()

    if null_ts > 0:
        errors.append(f"{null_ts} rows have invalid timestamps")
    if null_prices > 0:
        errors.append(f"{null_prices} rows have invalid prices (will be skipped)")
    if neg_prices > 0:
        errors.append(f"{neg_prices} rows have suspiciously negative prices (will be kept — may be valid)")
    if extreme_prices > 0:
        errors.append(f"{extreme_prices} rows have prices >$10,000/MWh (will be kept — may be valid)")

    # Remove duplicates
    df = df.drop_duplicates(subset=[ts_col]).dropna(subset=[ts_col, price_col])
    df = df.sort_values(ts_col)

    # Import to DB
    from app.forecasting.inference import _model_cache
    import app.forecasting.inference as inference_module
    inference_module._model_cache = None  # Invalidate model cache on new data

    # Clear existing data for this dataset
    db.query(PriceDataDB).filter(PriceDataDB.dataset_name == dataset_name).delete()

    records = []
    for _, row in df.iterrows():
        records.append(PriceDataDB(
            timestamp=row[ts_col].to_pydatetime(),
            price=float(row[price_col]),
            source="upload",
            dataset_name=dataset_name,
        ))

    db.bulk_save_objects(records)
    db.commit()

    start_date = str(df[ts_col].min().date()) if not df.empty else None
    end_date = str(df[ts_col].max().date()) if not df.empty else None

    return PriceUploadResponse(
        success=True,
        records_imported=len(records),
        dataset_name=dataset_name,
        start_date=start_date,
        end_date=end_date,
        errors=errors,
    )


@router.get("/history", response_model=PriceHistoryResponse)
def get_price_history(
    limit: int = Query(default=168, le=8760),
    dataset_name: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Get historical price data."""
    query = db.query(PriceDataDB).order_by(PriceDataDB.timestamp.desc())
    if dataset_name:
        query = query.filter(PriceDataDB.dataset_name == dataset_name)
    prices_db = query.limit(limit).all()
    prices_db = sorted(prices_db, key=lambda x: x.timestamp)

    prices = [
        PricePoint(timestamp=p.timestamp, price=p.price, source=p.source)
        for p in prices_db
    ]

    return PriceHistoryResponse(
        prices=prices,
        total_records=len(prices),
        dataset_name=dataset_name or "all",
        start_date=prices[0].timestamp.isoformat() if prices else None,
        end_date=prices[-1].timestamp.isoformat() if prices else None,
    )
