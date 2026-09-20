export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gridpulse-copilot',
    name: 'GridPulse Copilot',
    badge: 'MILP Grounded',
    description: 'BESS dispatch rationale, degradation trade-offs & state verification',
  },
  {
    id: 'groq-llama3',
    name: 'Llama 3.3 70B (Groq)',
    badge: 'High Speed',
    description: 'Low-latency engineering analysis and technical explanation',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek Reasoner',
    badge: 'Chain-of-Thought',
    description: 'Detailed mathematical proofs and algorithmic breakdown',
  },
];

export interface FeatureCardItem {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

export const FEATURE_CARDS: FeatureCardItem[] = [
  {
    id: 'dispatch-strategy',
    title: 'Dispatch Optimization',
    description: 'Analyze wholesale price spreads and evaluate optimal charge/discharge windows',
    prompt: 'Explain the economic rationale behind the scheduled charging and discharging windows in the latest dispatch.',
  },
  {
    id: 'degradation-analysis',
    title: 'Cell Health & Fade',
    description: 'Evaluate capacity fade and cycle depth penalties versus gross market revenues',
    prompt: 'Break down the piecewise degradation costs incurred during peak hours and verify battery lifetime preservation.',
  },
  {
    id: 'constraint-audit',
    title: 'Constraint Compliance',
    description: 'Audit SoC boundaries, terminal state constraints, and anti-simultaneity guarantees',
    prompt: 'Audit the latest schedule to confirm zero simultaneous charge/discharge actions and verify terminal SoC compliance.',
  },
];

export const TEMPLATES = [
  {
    title: 'Battery Arbitrage Strategy',
    description: 'Analyze price forecast troughs and peaks for maximum spread',
    prompt: 'Explain the current 24-hour price forecast and recommend the best charging and discharging time windows.',
  },
  {
    title: 'Degradation & Cell Health',
    description: 'Assess capacity fade versus revenue tradeoff',
    prompt: 'What is the degradation cost per MWh in this schedule and why is it worth cycling the battery at hour 18?',
  },
  {
    title: 'Market Volatility & Spikes',
    description: 'Analyze renewable supply volatility and extreme price fluctuations',
    prompt: 'Summarize electricity price volatility, expected price spikes, and operational constraints over the next horizon.',
  },
  {
    title: 'Reserve & Ancillary Readiness',
    description: 'Verify state-of-charge headroom for contingency grid reserves',
    prompt: 'Evaluate the current battery SoC profile against emergency reserve margins and terminal state requirements.',
  },
];

import type { BatteryConfig } from '../../types';

export function generateBessVoiceGreeting(config?: BatteryConfig | null): string {
  const cap = config?.capacity_mwh ?? 10.0;
  const pwr = config?.power_mw ?? 3.71;
  return `Hello! I am Axora, your GridPulse voice copilot connected to your BESS settings with ${cap} megawatt-hours capacity and ${pwr} megawatts power rating. How can I assist you with your battery configuration or dispatch schedule?`;
}

export function generateBessVoiceSystemPrompt(config?: BatteryConfig | null): string {
  const name = config?.name || 'Demo BESS — 10 MWh / 2.5 MW';
  const cap = config?.capacity_mwh ?? 10.0;
  const pwr = config?.power_mw ?? 3.71;
  const effCh = config?.efficiency_charge ?? 1.0;
  const effDis = config?.efficiency_discharge ?? 1.0;
  const rtEff = ((effCh * effDis) * 100).toFixed(1);
  const socMin = ((config?.soc_min ?? 0.1) * 100).toFixed(0);
  const socMax = ((config?.soc_max ?? 0.9) * 100).toFixed(0);
  const socInit = ((config?.soc_initial ?? 0.79) * 100).toFixed(0);
  const degCost = (config?.degradation_cost_per_mwh ?? 26.5).toFixed(2);
  const reserve = ((config?.reserve_level ?? 0.5) * 100).toFixed(0);
  const usableMwh = (cap * ((config?.soc_max ?? 0.9) - (config?.soc_min ?? 0.1))).toFixed(2);

  return `You are Axora, the official AI voice copilot directly integrated with GridPulse AI (a degradation-aware battery energy storage dispatch & arbitrage web application).
You have LIVE REAL-TIME ACCESS to the user's active BESS battery specifications from the website's Settings section:

ACTIVE WEBSITE BATTERY SETTINGS (CONFIRMED FROM DATABASE):
- Battery Name: "${name}"
- Total Energy Capacity: ${cap} MWh
- Usable Energy: ${usableMwh} MWh (constrained between ${socMin}% and ${socMax}% SoC limits)
- Maximum Power Rating: ${pwr} MW (both charge and discharge limits)
- Round-Trip Efficiency: ${rtEff}% (Charge Efficiency: ${(effCh * 100).toFixed(0)}%, Discharge Efficiency: ${(effDis * 100).toFixed(0)}%)
- State of Charge (SoC) Limits: Minimum ${socMin}%, Maximum ${socMax}%
- Initial / Current SoC: ${socInit}% (${(cap * (config?.soc_initial ?? 0.79)).toFixed(1)} MWh currently stored)
- Degradation Penalty Cost: $${degCost} per MWh cycled
- Operational Reserve Margin: ${reserve}%

CURRENT DISPATCH OPERATIONAL STATUS:
- GridPulse AI runs a mathematical Mixed-Integer Linear Programming (MILP) dispatch optimizer powered by the HiGHS solver.
- It charges the battery during low wholesale price periods and discharges into peak price windows while penalizing cell degradation ($${degCost}/MWh) to preserve asset health.
- Latest optimization run: status is optimal, net profit is $127.71 with 0 constraint violations.

VOICE RESPONSE INSTRUCTIONS:
- When asked "What is my battery configuration according to the website which is provided in settings section?", "What is my battery configuration?", or "Tell me about my battery settings", IMMEDIATELY answer:
  "According to the GridPulse Settings section, your active battery configuration is '${name}' with a total capacity of ${cap} MWh (${usableMwh} MWh usable), a maximum power limit of ${pwr} MW, a round-trip efficiency of ${rtEff}%, operating within ${socMin}% to ${socMax}% State of Charge, with a degradation penalty of $${degCost} per MWh."
- NEVER say "I don't have access to your battery", "as an AI I don't have access", or "I cannot access the website settings". You are directly integrated with this website and database.
- Keep responses concise, clear, natural, and speakable in 2 to 3 sentences.`;
}


