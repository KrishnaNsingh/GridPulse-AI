"""
LightGBM quantile regression forecasting model.

Trains three models for P10, P50, P90 quantile forecasts.
Falls back to statistical heuristics if data is insufficient for ML.

The model is trained on historical price data and predicts
electricity prices for the next 24 hours.
"""
import logging
import pickle
import os
from typing import Tuple, Optional, Dict, Any

import numpy as np
import pandas as pd

from app.forecasting.features import build_features, FEATURE_COLS

logger = logging.getLogger(__name__)

MIN_TRAINING_ROWS = 72  # Minimum rows to attempt ML training


class QuantileForecastModel:
    """
    Quantile regression ensemble for P10/P50/P90 price forecasts.

    Uses LightGBM quantile regression when sufficient data is available.
    Falls back to statistical bounds otherwise.
    """

    def __init__(self):
        self.models: Dict[str, Any] = {}  # quantile -> trained model
        self.is_trained = False
        self.model_type = "statistical"
        self.feature_cols = FEATURE_COLS
        self.price_mean = 0.0
        self.price_std = 1.0

    def train(self, df: pd.DataFrame, price_col: str = "price") -> Dict[str, Any]:
        """
        Train quantile regression models on historical price data.

        Returns:
            dict with training info (model_type, train_rows, metrics)
        """
        df = df.copy().sort_index()
        n = len(df)

        self.price_mean = float(df[price_col].mean())
        self.price_std = float(df[price_col].std() or 1.0)

        if n < MIN_TRAINING_ROWS:
            logger.info(f"Only {n} rows available, using statistical fallback (need {MIN_TRAINING_ROWS})")
            self.model_type = "statistical"
            self.is_trained = True
            return {"model_type": "statistical", "train_rows": n, "note": f"Need {MIN_TRAINING_ROWS} rows for ML"}

        # Build features
        feat_df = build_features(df, price_col)
        feat_df = feat_df.dropna(subset=self.feature_cols)

        if len(feat_df) < MIN_TRAINING_ROWS:
            self.model_type = "statistical"
            self.is_trained = True
            return {"model_type": "statistical", "train_rows": len(feat_df)}

        X = feat_df[self.feature_cols].values
        y = feat_df["price"].values

        # Train LightGBM quantile models
        try:
            import lightgbm as lgb

            lgb_params_base = {
                "objective": "quantile",
                "n_estimators": 200,
                "num_leaves": 31,
                "learning_rate": 0.05,
                "feature_fraction": 0.8,
                "bagging_fraction": 0.8,
                "bagging_freq": 5,
                "verbose": -1,
                "force_col_wise": True,
            }

            quantiles = {"p10": 0.1, "p50": 0.5, "p90": 0.9}
            train_results = {}

            for name, alpha in quantiles.items():
                params = {**lgb_params_base, "alpha": alpha}
                model = lgb.LGBMRegressor(**params)
                model.fit(X, y)
                self.models[name] = model
                train_results[name] = "trained"

            self.model_type = "lightgbm"
            self.is_trained = True
            logger.info(f"LightGBM quantile models trained on {len(X)} rows")
            return {
                "model_type": "lightgbm",
                "train_rows": len(X),
                "quantiles": train_results,
            }

        except ImportError:
            logger.warning("LightGBM not available, using statistical fallback")
            self.model_type = "statistical"
            self.is_trained = True
            return {"model_type": "statistical", "train_rows": n, "note": "LightGBM not available"}
        except Exception as e:
            logger.warning(f"LightGBM training failed: {e}, using statistical fallback")
            self.model_type = "statistical"
            self.is_trained = True
            return {"model_type": "statistical", "train_rows": n, "error": str(e)}

    def predict(
        self,
        history_df: pd.DataFrame,
        horizon: int = 24,
        price_col: str = "price",
    ) -> pd.DataFrame:
        """
        Generate P10/P50/P90 forecasts for the next `horizon` timesteps.

        Uses iterative 1-step-ahead prediction when using the ML model.
        Uses statistical heuristics for the fallback.

        Args:
            history_df: DataFrame with datetime index and price column
            horizon: Number of hours to forecast
            price_col: Price column name

        Returns:
            DataFrame with columns [p10, p50, p90] and DatetimeIndex
        """
        if not self.is_trained:
            self.train(history_df, price_col)

        if self.model_type == "lightgbm" and self.models:
            return self._predict_lgb(history_df, horizon, price_col)
        else:
            return self._predict_statistical(history_df, horizon, price_col)

    def _predict_lgb(
        self,
        history_df: pd.DataFrame,
        horizon: int,
        price_col: str,
    ) -> pd.DataFrame:
        """LightGBM iterative forecast."""
        df = history_df.copy().sort_index()
        last_ts = df.index[-1]
        freq = pd.infer_freq(df.index) or "H"
        future_idx = pd.date_range(
            start=last_ts + pd.Timedelta(hours=1),
            periods=horizon,
            freq=freq
        )

        forecasts = {"p10": [], "p50": [], "p90": []}

        # Iteratively predict each step
        working_df = df.copy()
        for ts in future_idx:
            feat = build_features(working_df, price_col)
            last_feat = feat.iloc[[-1]][self.feature_cols]

            # Override temporal features for the actual future timestamp
            last_feat = last_feat.copy()
            last_feat["hour"] = ts.hour
            last_feat["day_of_week"] = ts.dayofweek
            last_feat["month"] = ts.month
            last_feat["is_weekend"] = int(ts.dayofweek >= 5)
            last_feat["hour_sin"] = np.sin(2 * np.pi * ts.hour / 24)
            last_feat["hour_cos"] = np.cos(2 * np.pi * ts.hour / 24)
            last_feat["dow_sin"] = np.sin(2 * np.pi * ts.dayofweek / 7)
            last_feat["dow_cos"] = np.cos(2 * np.pi * ts.dayofweek / 7)

            X = last_feat.values

            p50 = float(self.models["p50"].predict(X)[0])
            p10 = float(self.models["p10"].predict(X)[0])
            p90 = float(self.models["p90"].predict(X)[0])

            # Enforce p10 < p50 < p90
            p10 = min(p10, p50)
            p90 = max(p90, p50)

            forecasts["p10"].append(max(0, p10))
            forecasts["p50"].append(max(0, p50))
            forecasts["p90"].append(max(0, p90))

            # Add p50 as pseudo-actual for next iteration
            new_row = pd.DataFrame({price_col: [p50]}, index=[ts])
            working_df = pd.concat([working_df, new_row])

        return pd.DataFrame(forecasts, index=future_idx)

    def _predict_statistical(
        self,
        history_df: pd.DataFrame,
        horizon: int,
        price_col: str,
    ) -> pd.DataFrame:
        """
        Statistical fallback forecast.

        Uses:
        - P50: rolling mean of last 24h + time-of-day adjustment
        - P10: P50 - 1.28 * rolling_std
        - P90: P50 + 1.28 * rolling_std
        """
        df = history_df.copy().sort_index()
        last_ts = df.index[-1]

        recent = df[price_col].tail(24)
        mu = float(recent.mean())
        sigma = float(recent.std() or mu * 0.15)

        # Compute typical hour-of-day profile from history
        hod_profile = df.groupby(df.index.hour)[price_col].mean()
        hod_std = df.groupby(df.index.hour)[price_col].std().fillna(sigma)

        future_idx = pd.date_range(
            start=last_ts + pd.Timedelta(hours=1),
            periods=horizon,
            freq="H"
        )

        p10_list, p50_list, p90_list = [], [], []
        for ts in future_idx:
            h = ts.hour
            base = hod_profile.get(h, mu)
            std = hod_std.get(h, sigma)

            # Adjust by recent level
            adjustment = mu / (hod_profile.mean() + 1e-6) if hod_profile.mean() > 0 else 1.0
            p50 = max(0, base * adjustment)
            p10 = max(0, p50 - 1.28 * std)
            p90 = max(0, p50 + 1.28 * std)

            p10_list.append(p10)
            p50_list.append(p50)
            p90_list.append(p90)

        return pd.DataFrame({"p10": p10_list, "p50": p50_list, "p90": p90_list}, index=future_idx)
