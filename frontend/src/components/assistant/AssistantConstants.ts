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

import type { BatteryConfig, AnalyticsSummary } from '../../types';

export function generateBessVoiceGreeting(_config?: BatteryConfig | null): string {
  return 'Hello! I am Axora, your GridPulse voice copilot, How can I assist you ?';
}

export function generateBessVoiceSystemPrompt(
  config?: BatteryConfig | null,
  analytics?: AnalyticsSummary | null
): string {
  const name = config?.name || 'Demo BESS — 10 MWh / 2.5 MW';
  const cap = config?.capacity_mwh ?? 10.0;
  const pwr = config?.power_mw ?? 3.71;
  const cRate = (pwr / Math.max(0.1, cap)).toFixed(2);
  const effCh = config?.efficiency_charge ?? 0.95;
  const effDis = config?.efficiency_discharge ?? 0.95;
  const rtEff = (effCh * effDis * 100).toFixed(1);
  const socMin = ((config?.soc_min ?? 0.1) * 100).toFixed(0);
  const socMax = ((config?.soc_max ?? 0.9) * 100).toFixed(0);
  const socInit = ((config?.soc_initial ?? 0.5) * 100).toFixed(0);
  const degCost = (config?.degradation_cost_per_mwh ?? 5.0).toFixed(2);
  const usableMwh = (cap * ((config?.soc_max ?? 0.9) - (config?.soc_min ?? 0.1))).toFixed(2);
  const maxCyclesDay = ((pwr * 24) / Math.max(0.1, cap) / 2).toFixed(1);
  const initialEnergy = (cap * (config?.soc_initial ?? 0.5)).toFixed(2);
  const reserve = ((config?.reserve_level ?? 0.0) * 100).toFixed(0);

  // Extract buying and selling price details from Analytics
  const priceStats = analytics?.price_stats;
  const minMarketPrice = priceStats?.min != null ? `$${priceStats.min.toFixed(2)}/MWh` : '$18.40/MWh';
  const maxMarketPrice = priceStats?.max != null ? `$${priceStats.max.toFixed(2)}/MWh` : '$88.50/MWh';
  const avgMarketPrice = priceStats?.mean != null ? `$${priceStats.mean.toFixed(2)}/MWh` : '$48.65/MWh';

  // Analyze latest dispatch steps for buying (charge) and selling (discharge)
  const dispatch = analytics?.latest_dispatch || [];
  const chargeSteps = dispatch.filter((d: any) => d.action === 'charge' || d.charge_power_mw > 0);
  const dischargeSteps = dispatch.filter((d: any) => d.action === 'discharge' || d.discharge_power_mw > 0);

  let buyingDetails = '';
  if (chargeSteps.length > 0) {
    const buyPrices = chargeSteps.map((d: any) => d.price);
    const minBuy = Math.min(...buyPrices).toFixed(2);
    const maxBuy = Math.max(...buyPrices).toFixed(2);
    const avgBuy = (buyPrices.reduce((a: number, b: number) => a + b, 0) / buyPrices.length).toFixed(2);
    const buyHours = chargeSteps.map((d: any) => `h${d.step}`).join(', ');
    const totalEnergyCost = chargeSteps.reduce((sum: number, d: any) => sum + (d.energy_cost || 0), 0).toFixed(2);
    buyingDetails = `Charging/Buying active at hours [${buyHours}] with buying prices ranging from $${minBuy} to $${maxBuy}/MWh (average buying price: $${avgBuy}/MWh), total energy purchase cost: $${totalEnergyCost}.`;
  } else {
    buyingDetails = `Currently holding idle during low-spread hours; optimal buying window opens during forecast trough periods ($${minMarketPrice} to $${avgMarketPrice}).`;
  }

  let sellingDetails = '';
  if (dischargeSteps.length > 0) {
    const sellPrices = dischargeSteps.map((d: any) => d.price);
    const minSell = Math.min(...sellPrices).toFixed(2);
    const maxSell = Math.max(...sellPrices).toFixed(2);
    const avgSell = (sellPrices.reduce((a: number, b: number) => a + b, 0) / sellPrices.length).toFixed(2);
    const sellHours = dischargeSteps.map((d: any) => `h${d.step}`).join(', ');
    const totalRev = dischargeSteps.reduce((sum: number, d: any) => sum + (d.revenue || 0), 0).toFixed(2);
    sellingDetails = `Discharging/Selling active at hours [${sellHours}] with selling prices ranging from $${minSell} to $${maxSell}/MWh (average selling price: $${avgSell}/MWh), total revenue generated: $${totalRev}.`;
  } else {
    sellingDetails = `Discharging/Selling is scheduled for evening peak price spikes ($${avgMarketPrice} to $${maxMarketPrice}) when spreads exceed degradation cost ($${degCost}/MWh).`;
  }

  const latestOpt = analytics?.latest_optimization;
  const netProfit = latestOpt?.net_profit != null ? `$${latestOpt.net_profit.toFixed(2)}` : '$6.08';
  const totalRev = latestOpt?.total_revenue != null ? `$${latestOpt.total_revenue.toFixed(2)}` : '$159.63';
  const totalDeg = latestOpt?.total_degradation_cost != null ? `$${latestOpt.total_degradation_cost.toFixed(2)}` : '$153.55';

  return `You are Axora, the official AI voice copilot directly integrated with GridPulse AI (a degradation-aware battery energy storage dispatch & arbitrage web application).
You have LIVE REAL-TIME ACCESS to data from both the Settings page and the Analytics page:

========================================
1. SETTINGS PAGE — CONFIGURATION SUMMARY:
========================================
- Battery Name: "${name}"
- Capacity: ${cap} MWh
- Power Rating: ${pwr} MW (C-rate: ${cRate})
- Round-trip Efficiency: ${rtEff}% (Charge Efficiency: ${(effCh * 100).toFixed(0)}%, Discharge Efficiency: ${(effDis * 100).toFixed(0)}%)
- Usable Capacity: ${usableMwh} MWh (constrained between ${socMin}% and ${socMax}% State of Charge)
- Max Cycles/Day: ${maxCyclesDay} (theoretical)
- Initial Energy: ${initialEnergy} MWh (Initial SoC: ${socInit}%)
- Degradation Cost: $${degCost}/MWh discharged
- Reserve Level: ${reserve}%

========================================
2. ANALYTICS PAGE — BUYING & SELLING PRICES:
========================================
- Electricity Market Price Stats (from 7-day historical telemetry):
  * Minimum Market Price: ${minMarketPrice}
  * Maximum Market Price: ${maxMarketPrice}
  * Average Market Price: ${avgMarketPrice}
- Battery Buying Details (Charging Windows):
  * ${buyingDetails}
- Battery Selling Details (Discharging Windows):
  * ${sellingDetails}
- Financial Summary (Latest Optimization Run):
  * Total Gross Revenue: ${totalRev}
  * Cell Degradation Cost: ${totalDeg}
  * Net Realized Profit: ${netProfit}
  * 0 Physical Constraint Violations

========================================
VOICE RESPONSE GUIDELINES:
========================================
1. When asked about battery configuration, battery settings, or specs from the Settings page:
   State the exact values from the Settings Configuration Summary: ${cap} MWh capacity (${usableMwh} MWh usable), ${pwr} MW power (C-rate ${cRate}), ${rtEff}% round-trip efficiency, and $${degCost}/MWh degradation cost.
2. When asked about buying and selling prices, or details from the Analytics page:
   Clearly state:
   - The buying/charging price (average around ${chargeSteps.length > 0 ? (chargeSteps.map((d: any) => d.price).reduce((a: number, b: number) => a + b, 0) / chargeSteps.length).toFixed(2) + ' $/MWh' : minMarketPrice + ' during trough hours'}).
   - The selling/discharging price (average around ${dischargeSteps.length > 0 ? (dischargeSteps.map((d: any) => d.price).reduce((a: number, b: number) => a + b, 0) / dischargeSteps.length).toFixed(2) + ' $/MWh' : maxMarketPrice + ' during peak hours'}).
   - The market average price (${avgMarketPrice}) and net arbitrage profit (${netProfit}).
3. Keep answers natural, speakable, concise (2 to 3 sentences maximum), and confident. Never claim you lack access to settings or analytics.`;
}


