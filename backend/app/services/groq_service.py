"""
Groq AI explanation service.

This is the ONLY place in the system where the LLM is called.
The LLM receives structured context from the optimization engine and
generates a natural language explanation. It NEVER makes dispatch decisions.

Architecture:
  Optimization result → build_context() → Groq API → explanation text

If Groq is unavailable, falls back to a structured rule-based explanation.
"""
import logging
import os
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_system_prompt() -> str:
    return """You are GridPulse AI, an expert battery energy storage system (BESS) analyst and engineer directly integrated with the GridPulse platform, website settings, and analytics telemetry.

Your role is to EXPLAIN optimization decisions, dispatch schedules, active battery specifications according to the Settings page, and buying / selling price telemetry from the Analytics page.
You never make or change dispatch decisions — you explain them with rigorous technical and financial precision.

Guidelines:
- When asked "What is my battery configuration?", "What are my settings?", or questions about the BESS hardware parameters from the Settings page:
  State the exact active battery configuration provided in the context: Battery Name, Total Capacity (MWh), Usable Capacity (MWh), Maximum Power Rating (MW), C-rate, Efficiencies, SoC range (Min and Max %), Initial SoC, and Degradation Penalty Cost ($/MWh).
- When asked about buying and selling prices, or details from the Analytics page:
  State the wholesale electricity market price stats (Min, Max, Average $/MWh), the scheduled charging (buying) prices and hours, the scheduled discharging (selling) prices and hours, and the net arbitrage profit.
- Never claim you do not have access to the battery configuration or analytics prices; you have direct real-time access to the user's active BESS parameters from the Settings and Analytics sections.
- You speak precisely, using engineering terminology but remaining accessible.
- Reference specific numbers from the context when explaining.
- Focus on economic reasoning (arbitrage spread, peak vs trough pricing) and physical constraints (degradation avoidance, thermal/C-rate limits).
- Keep responses concise (2-4 sentences for voice and direct chats unless more breakdown is requested).

Never:
- Suggest changing the optimization result
- Override the dispatch decision
- Make up numbers not in the context
- Pretend to be uncertain about what the optimizer decided or what the battery settings or analytics prices are"""


def _build_context_message(context: Dict[str, Any]) -> str:
    """Build a structured context message from optimization results."""
    lines = ["=== GridPulse Optimization & Telemetry Context ===\n"]

    if "battery_config" in context and context["battery_config"]:
        cfg = context["battery_config"]
        cap = cfg.get('capacity_mwh', 10.0)
        pwr = cfg.get('power_mw', 2.5)
        soc_min = cfg.get('soc_min', 0.1)
        soc_max = cfg.get('soc_max', 0.9)
        usable = cap * (soc_max - soc_min)
        c_rate = pwr / max(0.1, cap)
        lines.append(f"Settings Page Battery Configuration:")
        lines.append(f"  Name: {cfg.get('name', 'Demo BESS')}")
        lines.append(f"  Capacity: {cap:.2f} MWh total ({usable:.2f} MWh usable between {soc_min:.0%} and {soc_max:.0%} SoC)")
        lines.append(f"  Power Limit: {pwr:.2f} MW (C-rate: {c_rate:.2f})")
        lines.append(f"  Efficiency: charge={cfg.get('efficiency_charge', 1.0):.0%}, discharge={cfg.get('efficiency_discharge', 1.0):.0%}, round-trip={(cfg.get('efficiency_charge',1.0)*cfg.get('efficiency_discharge',1.0)):.1%}")
        lines.append(f"  State of Charge: Min {soc_min:.0%}, Max {soc_max:.0%}, Initial {cfg.get('soc_initial', 0.5):.0%}")
        lines.append(f"  Degradation Cost: ${cfg.get('degradation_cost_per_mwh', 5.0):.2f}/MWh discharged")
        lines.append(f"  Reserve Level: {cfg.get('reserve_level', 0.0):.0%}\n")

    if "price_stats" in context and context["price_stats"]:
        ps = context["price_stats"]
        lines.append(f"Analytics Page Market Price Statistics (7-day history):")
        lines.append(f"  Average Market Price: ${ps.get('mean', 0):.2f}/MWh")
        lines.append(f"  Minimum Market Price: ${ps.get('min', 0):.2f}/MWh")
        lines.append(f"  Maximum Market Price: ${ps.get('max', 0):.2f}/MWh\n")

    if "buying_summary" in context and context["buying_summary"]:
        bs = context["buying_summary"]
        lines.append(f"Analytics Page Battery Buying (Charging) Details:")
        lines.append(f"  Charging/Buying Hours: {bs.get('charge_hours', [])}")
        lines.append(f"  Buying Prices: Min ${bs.get('min_buy_price', 0):.2f}/MWh, Max ${bs.get('max_buy_price', 0):.2f}/MWh, Average ${bs.get('avg_buy_price', 0):.2f}/MWh")
        lines.append(f"  Total Energy Purchase Cost: ${bs.get('total_energy_cost', 0):.2f}\n")

    if "selling_summary" in context and context["selling_summary"]:
        ss = context["selling_summary"]
        lines.append(f"Analytics Page Battery Selling (Discharging) Details:")
        lines.append(f"  Discharging/Selling Hours: {ss.get('discharge_hours', [])}")
        lines.append(f"  Selling Prices: Min ${ss.get('min_sell_price', 0):.2f}/MWh, Max ${ss.get('max_sell_price', 0):.2f}/MWh, Average ${ss.get('avg_sell_price', 0):.2f}/MWh")
        lines.append(f"  Total Revenue Earned: ${ss.get('total_revenue', 0):.2f}\n")

    if "current_state" in context:
        state = context["current_state"]
        lines.append(f"Current Battery State:")
        lines.append(f"  SoC: {state.get('soc', '?'):.1%}")
        lines.append(f"  Action: {state.get('action', '?').upper()}")
        lines.append(f"  Charge power: {state.get('charge_power_mw', 0):.2f} MW")
        lines.append(f"  Discharge power: {state.get('discharge_power_mw', 0):.2f} MW\n")

    if "current_price" in context:
        lines.append(f"Current electricity price: ${context['current_price']:.2f}/MWh")

    if "forecast" in context and context["forecast"]:
        fc = context["forecast"]
        lines.append(f"24h Forecast (P10/P50/P90): min=${min(f.get('p50',0) for f in fc):.1f}, max=${max(f.get('p50',0) for f in fc):.1f}/MWh")
        peak_hour = max(fc, key=lambda f: f.get('p50', 0))
        trough_hour = min(fc, key=lambda f: f.get('p50', 0))
        lines.append(f"  Price peak (best sell window): ${peak_hour.get('p50', '?'):.1f}/MWh at {peak_hour.get('timestamp', '?')}")
        lines.append(f"  Price trough (best buy window): ${trough_hour.get('p50', '?'):.1f}/MWh at {trough_hour.get('timestamp', '?')}\n")

    if "optimization_result" in context:
        opt = context["optimization_result"]
        lines.append(f"Optimization Financial Result ({opt.get('status', '?').upper()}):")
        lines.append(f"  Net profit: ${opt.get('net_profit', 0):.2f}")
        lines.append(f"  Gross Revenue: ${opt.get('total_revenue', 0):.2f}")
        lines.append(f"  Energy Cost: ${opt.get('total_energy_cost', 0):.2f}")
        lines.append(f"  Degradation Cost: ${opt.get('total_degradation_cost', 0):.2f}")
        lines.append(f"  Solver runtime: {opt.get('runtime_seconds', 0):.3f}s")
        lines.append(f"  Constraint violations: {opt.get('constraint_violations', 0)}\n")

        if opt.get("dispatch"):
            lines.append("Dispatch schedule (first 6 hours):")
            for step in opt["dispatch"][:6]:
                lines.append(
                    f"  h{step.get('step', '?')}: {step.get('action','?').upper()} "
                    f"@ ${step.get('price', '?'):.1f}/MWh, "
                    f"SoC {step.get('soc_start', '?'):.0%}→{step.get('soc_end', '?'):.0%}, "
                    f"net=${step.get('net_profit', 0):.2f}"
                )

    if "scenario" in context and context["scenario"]:
        lines.append(f"\nScenario: {context['scenario'].get('name', 'unnamed')}")
        lines.append(f"  Parameters: {context['scenario'].get('params', {})}")

    return "\n".join(lines)


async def get_ai_explanation(
    user_message: str,
    context: Dict[str, Any],
    conversation_history: Optional[list] = None,
    client_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get an AI explanation from Groq.

    Args:
        user_message: The user's question
        context: Structured optimization context
        conversation_history: Previous messages in this conversation
        client_api_key: Optional custom Groq API key from frontend client settings

    Returns:
        dict with 'response', 'model', 'used_groq' (bool), 'fallback_reason' (if not Groq)
    """
    effective_api_key = (client_api_key or "").strip() or settings.groq_api_key

    if not effective_api_key:
        fallback = _rule_based_explanation(user_message, context)
        return {
            "response": fallback,
            "model": "rule-based-fallback",
            "used_groq": False,
            "fallback_reason": "GROQ_API_KEY not configured",
        }

    try:
        from groq import Groq

        client = Groq(api_key=effective_api_key)

        context_str = _build_context_message(context)
        messages = [
            {"role": "system", "content": _build_system_prompt()},
            {"role": "system", "content": f"OPTIMIZATION CONTEXT:\n{context_str}"},
        ]

        # Include conversation history
        if conversation_history:
            messages.extend(conversation_history[-8:])  # Last 4 exchanges

        messages.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            max_tokens=512,
            temperature=0.3,
        )

        return {
            "response": response.choices[0].message.content,
            "model": settings.groq_model,
            "used_groq": True,
            "fallback_reason": None,
        }

    except ImportError:
        fallback = _rule_based_explanation(user_message, context)
        return {
            "response": fallback,
            "model": "rule-based-fallback",
            "used_groq": False,
            "fallback_reason": "Groq library not installed",
        }
    except Exception as e:
        logger.warning(f"Groq API error: {e}")
        fallback = _rule_based_explanation(user_message, context)
        return {
            "response": fallback,
            "model": "rule-based-fallback",
            "used_groq": False,
            "fallback_reason": f"Groq API unavailable: {str(e)[:100]}",
        }


def _rule_based_explanation(user_message: str, context: Dict[str, Any]) -> str:
    """
    Rule-based fallback explanation when Groq is unavailable.
    Provides structured but limited explanations based on context.
    """
    msg_lower = user_message.lower()
    opt = context.get("optimization_result", {})
    state = context.get("current_state", {})
    current_price = context.get("current_price", 0)
    dispatch = opt.get("dispatch", [])

    # Find current action context
    action = state.get("action", "idle")
    soc = state.get("soc", 0.5)
    net_profit = opt.get("net_profit", 0)
    deg_cost = opt.get("total_degradation_cost", 0)

    # Find current and future prices from dispatch
    if dispatch:
        current_step = dispatch[0] if dispatch else {}
        current_step_price = current_step.get("price", current_price)
        future_prices = [d.get("price", 0) for d in dispatch[1:6]]
        max_future_price = max(future_prices) if future_prices else current_step_price
        avg_future_price = sum(future_prices) / len(future_prices) if future_prices else current_step_price
    else:
        current_step_price = current_price
        max_future_price = current_price
        avg_future_price = current_price

    if "charge" in msg_lower and "why" in msg_lower:
        if action == "charge":
            return (
                f"The battery is charging because the current price (${current_step_price:.1f}/MWh) is "
                f"relatively low compared to forecast peak prices (${max_future_price:.1f}/MWh). "
                f"The optimizer determined it's economically optimal to store energy now "
                f"for discharge during high-price periods. Current SoC is {soc:.0%}."
            )
        else:
            return (
                f"The battery is not charging right now (it's {action}). "
                f"The optimizer determined the current price (${current_step_price:.1f}/MWh) "
                f"does not justify charging — either the SoC is already high ({soc:.0%}) "
                f"or future prices don't provide sufficient margin over degradation costs."
            )

    elif "discharge" in msg_lower and "why" in msg_lower:
        if action == "discharge":
            return (
                f"The battery is discharging because the current price (${current_step_price:.1f}/MWh) "
                f"is high enough to justify the energy and degradation cost. "
                f"The optimizer calculated a positive net value from this action. "
                f"Current SoC: {soc:.0%}."
            )
        else:
            return (
                f"The battery is not discharging (action: {action}). "
                f"At ${current_step_price:.1f}/MWh, the optimizer determined that either the price "
                f"doesn't justify the degradation cost (${deg_cost:.2f} total), "
                f"the SoC is too low ({soc:.0%}), or future prices are higher and it's better to wait."
            )

    elif "degradation" in msg_lower:
        return (
            f"Battery degradation cost is ${deg_cost:.2f} for this optimization window. "
            f"The GridPulse degradation model uses a piecewise increasing cost based on depth-of-discharge (DoD): "
            f"shallow cycles (0-40% DoD) incur 1x base cost, while deep cycles (>90% DoD) incur 8x base cost. "
            f"This discourages the optimizer from cycling aggressively for small price spreads. "
            f"Net profit after degradation: ${net_profit:.2f}."
        )

    elif "profit" in msg_lower or "revenue" in msg_lower or "economic" in msg_lower:
        revenue = opt.get("total_revenue", 0)
        cost = opt.get("total_energy_cost", 0)
        return (
            f"The 24-hour optimization achieved net profit of ${net_profit:.2f}. "
            f"Breakdown: revenue from discharge = ${revenue:.2f}, "
            f"energy purchase cost = ${cost:.2f}, "
            f"degradation penalty = ${deg_cost:.2f}. "
            f"Net = ${net_profit:.2f}."
        )

    elif "constraint" in msg_lower or "violation" in msg_lower:
        violations = opt.get("constraint_violations", 0)
        return (
            f"Constraint status: {'✓ All constraints satisfied' if violations == 0 else f'⚠ {violations} violations detected'}. "
            f"The optimizer enforces: SoC bounds ({state.get('soc_min', 'N/A'):.0%}–{state.get('soc_max', 'N/A'):.0%}), "
            f"power limits, no simultaneous charging and discharging (anti-simultaneity), "
            f"and terminal SoC requirements."
        )

    elif "idle" in msg_lower or "holding" in msg_lower:
        return (
            f"The battery is in IDLE/HOLD mode. The optimizer determined that neither charging "
            f"nor discharging produces positive net value at this timestep. "
            f"Current price (${current_step_price:.1f}/MWh) is in the middle range — "
            f"not low enough to justify charging, not high enough to justify discharging after degradation costs. "
            f"Current SoC: {soc:.0%}."
        )

    else:
        return (
            f"GridPulse AI is ready to explain optimization decisions. "
            f"Current battery status: SoC={soc:.0%}, action={action.upper()}, "
            f"price=${current_step_price:.1f}/MWh. "
            f"24h optimization net profit: ${net_profit:.2f}. "
            f"Ask me about charging, discharging, degradation, constraints, or profitability decisions. "
            f"(Note: Running in fallback mode — configure GROQ_API_KEY for full AI responses.)"
        )
