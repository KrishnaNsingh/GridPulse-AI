from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class PricePoint(BaseModel):
    timestamp: datetime
    price: float = Field(description="Electricity price ($/MWh)")
    source: str = Field(default="upload")


class PriceUploadResponse(BaseModel):
    success: bool
    records_imported: int
    dataset_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    errors: List[str] = []


class PriceHistoryResponse(BaseModel):
    prices: List[PricePoint]
    total_records: int
    dataset_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ForecastPoint(BaseModel):
    timestamp: datetime
    p10: float = Field(description="10th percentile price forecast ($/MWh)")
    p50: float = Field(description="50th percentile (median) price forecast ($/MWh)")
    p90: float = Field(description="90th percentile price forecast ($/MWh)")
    is_forecast: bool = True


class ForecastResponse(BaseModel):
    run_id: int
    model_type: str
    horizon_hours: int
    created_at: datetime
    forecasts: List[ForecastPoint]
    status: str
