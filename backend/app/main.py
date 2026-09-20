"""
GridPulse AI — FastAPI Application Entry Point
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database.database import init_db
from app.api import battery, prices, forecast, optimization, simulation, backtest, analytics, assistant

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Application ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="GridPulse AI",
    description="Degradation-Aware Intelligent Battery Arbitrage & Closed-Loop Control",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
cors_list = settings.cors_origins_list
is_wildcard = "*" in cors_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else cors_list,
    allow_origin_regex=r"https://.*\.vercel\.app" if not is_wildcard else None,
    allow_credentials=False if is_wildcard else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("Initializing GridPulse AI database...")
    init_db()
    logger.info(f"GridPulse AI started — {settings.app_name}")


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "groq_configured": bool(settings.groq_api_key),
        "vapi_configured": bool(settings.vapi_public_key),
        "vapi_public_key": settings.vapi_public_key,
        "version": "1.0.0",
    }


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(battery.router)
app.include_router(prices.router)
app.include_router(forecast.router)
app.include_router(optimization.router)
app.include_router(simulation.router)
app.include_router(backtest.router)
app.include_router(analytics.router)
app.include_router(assistant.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
