from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Text, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from app.core.config import settings

# Create engine — check_same_thread=False needed for SQLite + FastAPI
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── ORM Models ──────────────────────────────────────────────────────────────

class BatteryConfigDB(Base):
    __tablename__ = "battery_config"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Default Battery")
    capacity_mwh = Column(Float, nullable=False)
    power_mw = Column(Float, nullable=False)
    efficiency_charge = Column(Float, nullable=False)
    efficiency_discharge = Column(Float, nullable=False)
    soc_min = Column(Float, nullable=False)
    soc_max = Column(Float, nullable=False)
    soc_initial = Column(Float, nullable=False)
    soc_terminal = Column(Float, nullable=True)
    degradation_cost_per_mwh = Column(Float, default=5.0)
    reserve_level = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PriceDataDB(Base):
    __tablename__ = "price_data"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    price = Column(Float, nullable=False)
    source = Column(String, default="upload")  # upload | synthetic | api
    dataset_name = Column(String, default="default")
    created_at = Column(DateTime, default=datetime.utcnow)


class ForecastRunDB(Base):
    __tablename__ = "forecast_runs"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    horizon_hours = Column(Integer, default=24)
    model_type = Column(String, default="lightgbm")
    results_json = Column(Text)  # JSON array of {timestamp, p10, p50, p90}
    status = Column(String, default="pending")  # pending | done | failed
    error_message = Column(Text, nullable=True)


class OptimizationRunDB(Base):
    __tablename__ = "optimization_runs"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    battery_config_id = Column(Integer, nullable=True)
    forecast_run_id = Column(Integer, nullable=True)
    status = Column(String, default="pending")
    solver = Column(String, default="HiGHS")
    solver_status = Column(String, nullable=True)
    runtime_seconds = Column(Float, nullable=True)
    objective_value = Column(Float, nullable=True)
    total_revenue = Column(Float, nullable=True)
    total_energy_cost = Column(Float, nullable=True)
    total_degradation_cost = Column(Float, nullable=True)
    net_profit = Column(Float, nullable=True)
    constraint_violations = Column(Integer, default=0)
    dispatch_json = Column(Text)  # JSON array of timestep results
    battery_config_json = Column(Text)  # snapshot of config used
    error_message = Column(Text, nullable=True)


class SimulationRunDB(Base):
    __tablename__ = "simulation_runs"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    optimization_run_id = Column(Integer, nullable=True)
    mode = Column(String, default="mpc")  # mpc | open_loop | scenario
    scenario_name = Column(String, nullable=True)
    status = Column(String, default="pending")
    current_step = Column(Integer, default=0)
    total_steps = Column(Integer, default=24)
    state_json = Column(Text)  # current battery state
    history_json = Column(Text)  # full step history
    battery_config_json = Column(Text)
    error_message = Column(Text, nullable=True)


class BacktestRunDB(Base):
    __tablename__ = "backtest_runs"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    battery_config_json = Column(Text)
    greedy_results_json = Column(Text)
    mpc_results_json = Column(Text)
    comparison_json = Column(Text)
    error_message = Column(Text, nullable=True)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
