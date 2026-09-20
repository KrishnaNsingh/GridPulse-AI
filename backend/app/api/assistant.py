"""AI Assistant API endpoints — Groq-powered explanation service."""
import json
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.database.database import get_db, OptimizationRunDB, PriceDataDB
from app.services.groq_service import get_ai_explanation
from app.services.optimization_service import get_default_battery_config
from app.forecasting.inference import get_latest_forecast
from app.core.config import settings

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.get("/config")
def get_assistant_config():
    """Retrieve assistant public configuration including Vapi public key."""
    return {
        "vapi_public_key": settings.vapi_public_key,
        "vapi_assistant_id": settings.vapi_assistant_id,
        "groq_configured": bool(settings.groq_api_key),
    }


class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str


class ChatRequest(BaseModel):
    message: str
    optimization_run_id: Optional[int] = None
    include_forecast: bool = True
    conversation_history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    response: str
    model: str
    used_groq: bool
    context_summary: Optional[str] = None
    fallback_reason: Optional[str] = None


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    x_groq_api_key: Optional[str] = Header(default=None),
):
    """
    Ask GridPulse AI to explain optimization decisions.

    The AI receives actual optimization context and explains the results.
    It NEVER makes or changes dispatch decisions.
    """
    # Build context from actual optimization results
    context = _build_context(db, request.optimization_run_id, request.include_forecast)

    # Build conversation history for Groq
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in request.conversation_history
    ]

    try:
        result = await get_ai_explanation(
            user_message=request.message,
            context=context,
            conversation_history=history,
            client_api_key=x_groq_api_key,
        )

        context_summary = (
            f"Battery SoC: {context.get('current_state', {}).get('soc', 'N/A')}, "
            f"Action: {context.get('current_state', {}).get('action', 'N/A')}, "
            f"Net profit: ${context.get('optimization_result', {}).get('net_profit', 0):.2f}"
        )

        return ChatResponse(
            response=result["response"],
            model=result["model"],
            used_groq=result["used_groq"],
            context_summary=context_summary,
            fallback_reason=result.get("fallback_reason"),
        )
    except Exception as e:
        raise HTTPException(500, f"AI assistant error: {str(e)}")


def _build_context(
    db: Session,
    optimization_run_id: Optional[int],
    include_forecast: bool,
) -> Dict[str, Any]:
    """Build the optimization context for the AI."""
    context: Dict[str, Any] = {}

    # Battery config
    battery = get_default_battery_config(db)
    context["battery_config"] = battery.model_dump()

    # Optimization result
    opt_run = None
    if optimization_run_id:
        opt_run = db.query(OptimizationRunDB).filter(
            OptimizationRunDB.id == optimization_run_id
        ).first()
    else:
        opt_run = db.query(OptimizationRunDB).filter(
            OptimizationRunDB.status == "optimal"
        ).order_by(OptimizationRunDB.created_at.desc()).first()

    if opt_run:
        dispatch = []
        if opt_run.dispatch_json:
            try:
                dispatch = json.loads(opt_run.dispatch_json)
            except Exception:
                pass

        context["optimization_result"] = {
            "run_id": opt_run.id,
            "status": opt_run.status,
            "net_profit": opt_run.net_profit or 0,
            "total_revenue": opt_run.total_revenue or 0,
            "total_energy_cost": opt_run.total_energy_cost or 0,
            "total_degradation_cost": opt_run.total_degradation_cost or 0,
            "runtime_seconds": opt_run.runtime_seconds or 0,
            "constraint_violations": opt_run.constraint_violations or 0,
            "dispatch": dispatch[:24],
        }

        # Current state from first dispatch step
        if dispatch:
            first = dispatch[0]
            context["current_state"] = {
                "soc": first.get("soc_start", battery.soc_initial),
                "action": first.get("action", "idle"),
                "charge_power_mw": first.get("charge_power_mw", 0),
                "discharge_power_mw": first.get("discharge_power_mw", 0),
                "soc_min": battery.soc_min,
                "soc_max": battery.soc_max,
            }
            context["current_price"] = first.get("price", 0)

    # Forecast
    if include_forecast:
        try:
            forecast = get_latest_forecast(db)
            if forecast:
                context["forecast"] = [
                    {"timestamp": str(f.timestamp), "p10": f.p10, "p50": f.p50, "p90": f.p90}
                    for f in forecast.forecasts[:24]
                ]
        except Exception:
            pass

    return context
