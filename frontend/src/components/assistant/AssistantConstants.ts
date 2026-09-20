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
