"""
Feature engineering for electricity price forecasting.

Creates features from historical price time series:
- Temporal: hour of day, day of week, month, is_weekend
- Lag features: lag_1h, lag_2h, lag_24h, lag_48h
- Rolling statistics: rolling_mean_6h, rolling_mean_24h, rolling_std_24h
- Trend: price_trend_6h (recent slope)
"""
import pandas as pd
import numpy as np
from typing import Optional


def build_features(df: pd.DataFrame, price_col: str = "price") -> pd.DataFrame:
    """
    Build feature matrix from price time series.

    Args:
        df: DataFrame with datetime index and price column
        price_col: Name of the price column

    Returns:
        DataFrame with features (NaN rows from lags are dropped)
    """
    df = df.copy().sort_index()

    # Ensure numeric
    df[price_col] = pd.to_numeric(df[price_col], errors="coerce")

    feat = pd.DataFrame(index=df.index)
    feat["price"] = df[price_col]

    # Temporal features
    feat["hour"] = df.index.hour
    feat["day_of_week"] = df.index.dayofweek
    feat["month"] = df.index.month
    feat["is_weekend"] = (df.index.dayofweek >= 5).astype(int)
    feat["hour_sin"] = np.sin(2 * np.pi * feat["hour"] / 24)
    feat["hour_cos"] = np.cos(2 * np.pi * feat["hour"] / 24)
    feat["dow_sin"] = np.sin(2 * np.pi * feat["day_of_week"] / 7)
    feat["dow_cos"] = np.cos(2 * np.pi * feat["day_of_week"] / 7)

    # Lag features
    feat["lag_1h"] = df[price_col].shift(1)
    feat["lag_2h"] = df[price_col].shift(2)
    feat["lag_3h"] = df[price_col].shift(3)
    feat["lag_6h"] = df[price_col].shift(6)
    feat["lag_12h"] = df[price_col].shift(12)
    feat["lag_24h"] = df[price_col].shift(24)
    feat["lag_48h"] = df[price_col].shift(48)

    # Rolling statistics
    feat["rolling_mean_6h"] = df[price_col].rolling(6, min_periods=1).mean()
    feat["rolling_mean_12h"] = df[price_col].rolling(12, min_periods=1).mean()
    feat["rolling_mean_24h"] = df[price_col].rolling(24, min_periods=1).mean()
    feat["rolling_std_6h"] = df[price_col].rolling(6, min_periods=2).std().fillna(0)
    feat["rolling_std_24h"] = df[price_col].rolling(24, min_periods=2).std().fillna(0)

    # Price trend: simple linear regression slope over last 6 hours
    feat["price_trend_6h"] = (
        df[price_col].rolling(6, min_periods=2)
        .apply(lambda x: np.polyfit(range(len(x)), x, 1)[0] if len(x) > 1 else 0, raw=True)
        .fillna(0)
    )

    # Relative price position vs recent average
    feat["price_vs_24h_avg"] = df[price_col] / (feat["rolling_mean_24h"] + 1e-6) - 1

    return feat


FEATURE_COLS = [
    "hour", "day_of_week", "month", "is_weekend",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "lag_1h", "lag_2h", "lag_3h", "lag_6h", "lag_12h", "lag_24h", "lag_48h",
    "rolling_mean_6h", "rolling_mean_12h", "rolling_mean_24h",
    "rolling_std_6h", "rolling_std_24h",
    "price_trend_6h", "price_vs_24h_avg",
]
