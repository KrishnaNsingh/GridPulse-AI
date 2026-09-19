from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # App
    app_name: str = "GridPilot AI"
    app_env: str = "development"
    log_level: str = "INFO"

    # Database
    database_url: str = "sqlite:///./gridpilot.db"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # Groq AI (optional)
    groq_api_key: str = ""
    groq_model: str = "llama3-8b-8192"

    # Optimization defaults
    default_capacity_mwh: float = 10.0
    default_power_mw: float = 2.5
    default_efficiency_charge: float = 0.95
    default_efficiency_discharge: float = 0.95
    default_soc_min: float = 0.10
    default_soc_max: float = 0.90
    default_soc_initial: float = 0.50
    default_dt_hours: float = 1.0
    default_horizon_hours: int = 24

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
