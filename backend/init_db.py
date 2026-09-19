"""
GridPilot AI — Database Initialization & Sample Data Seeding

Run this script once before starting the application:
    python init_db.py

This script:
1. Creates all database tables
2. Seeds the default battery configuration
3. Imports sample price data
4. Runs an initial forecast and optimization for demo readiness
"""
import sys
import os
import csv
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from app.database.database import init_db, SessionLocal, BatteryConfigDB, PriceDataDB


def seed_battery_config(db):
    """Seed the default battery configuration."""
    existing = db.query(BatteryConfigDB).filter(BatteryConfigDB.is_active == True).first()
    if existing:
        print(f"  Battery config already exists: {existing.name}")
        return

    config = BatteryConfigDB(
        name="Demo BESS — 10 MWh / 2.5 MW",
        capacity_mwh=10.0,
        power_mw=2.5,
        efficiency_charge=0.95,
        efficiency_discharge=0.95,
        soc_min=0.10,
        soc_max=0.90,
        soc_initial=0.50,
        soc_terminal=None,
        degradation_cost_per_mwh=5.0,
        reserve_level=0.0,
        is_active=True,
    )
    db.add(config)
    db.commit()
    print(f"  Created battery config: {config.name}")


def seed_price_data(db):
    """Import sample price data from CSV."""
    existing = db.query(PriceDataDB).count()
    if existing > 0:
        print(f"  Price data already exists: {existing} records")
        return

    csv_path = os.path.join(os.path.dirname(__file__), "data", "sample_prices.csv")
    if not os.path.exists(csv_path):
        print(f"  Sample CSV not found at {csv_path}, generating...")
        import generate_sample_data

    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        records = []
        for row in reader:
            records.append(PriceDataDB(
                timestamp=datetime.strptime(row["timestamp"], "%Y-%m-%d %H:%M:%S"),
                price=float(row["price"]),
                source="sample",
                dataset_name="default",
            ))

    db.bulk_save_objects(records)
    db.commit()
    print(f"  Imported {len(records)} price records from sample_prices.csv")


def run_demo_optimization(db):
    """Run an initial optimization so the dashboard has data to show."""
    from app.models.optimization import OptimizationRequest
    from app.services.optimization_service import run_optimization

    print("  Running initial forecast...")
    from app.services.forecast_service import run_forecast
    try:
        forecast = run_forecast(db, horizon_hours=24)
        print(f"  Forecast generated: {forecast.model_type} model, {len(forecast.forecasts)} hours")
    except Exception as e:
        print(f"  Forecast failed (non-critical): {e}")

    print("  Running initial optimization...")
    try:
        request = OptimizationRequest(horizon_hours=24, use_forecast=True)
        result = run_optimization(db, request)
        print(f"  Optimization complete: status={result.status}, net_profit=${result.net_profit:.2f}")
        print(f"  Runtime: {result.runtime_seconds:.3f}s, violations: {result.constraint_status.violations}")
    except Exception as e:
        print(f"  Optimization failed (non-critical): {e}")


def main():
    print("=" * 60)
    print("GridPilot AI — Database Initialization")
    print("=" * 60)

    print("\n[1/4] Creating database tables...")
    init_db()
    print("  Tables created successfully")

    db = SessionLocal()
    try:
        print("\n[2/4] Seeding battery configuration...")
        seed_battery_config(db)

        print("\n[3/4] Importing sample price data...")
        seed_price_data(db)

        print("\n[4/4] Running demo optimization...")
        run_demo_optimization(db)

    finally:
        db.close()

    print("\n" + "=" * 60)
    print("GridPilot AI initialized successfully!")
    print("=" * 60)
    print("\nTo start the backend:")
    print("  cd backend")
    print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    print("\nAPI docs: http://localhost:8000/docs")


if __name__ == "__main__":
    main()
