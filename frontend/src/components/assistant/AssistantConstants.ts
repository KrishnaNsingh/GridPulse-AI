export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'axora-default',
    name: 'AI Assistant',
    badge: 'Multi-Modal',
    description: 'General intelligence, creative reasoning & energy analysis',
  },
  {
    id: 'gridpulse-bess',
    name: 'GridPulse Arbitrage Agent',
    badge: 'MILP Engine',
    description: 'Degradation-aware dispatch and battery optimization specialist',
  },
  {
    id: 'groq-llama3',
    name: 'Llama 3.3 70B (Groq)',
    badge: 'Ultra Fast',
    description: 'Sub-second natural language inference and code synthesis',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek Reasoner',
    badge: 'Chain-of-Thought',
    description: 'Step-by-step mathematical reasoning and optimization proofs',
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
    id: 'smart-budget',
    title: 'Smart Budget',
    description: 'A budget that fits your lifestyle, not the other way around',
    prompt: 'How can I optimize our energy expenditure budget and battery cycling to minimize lifetime costs while maximizing arbitrage revenue?',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description: 'Analytics empowers individuals and businesses to make smarter',
    prompt: 'Show me an analytical summary of the latest price spreads, dispatch efficiency, and battery state-of-health metrics.',
  },
  {
    id: 'spending',
    title: 'Spending',
    description: 'Spending is the way individuals and businesses use their financial',
    prompt: 'Break down the net financial return, gross energy purchases vs discharge revenues, and cell degradation costs in the latest dispatch.',
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
    title: 'Market Intelligence Report',
    description: 'Synthesize renewable volatility and grid constraints',
    prompt: 'Summarize current electricity market volatility, expected price spikes, and operational constraints.',
  },
  {
    title: 'Photorealistic Concept Render',
    description: 'Generate high-fidelity architectural or technical visuals',
    prompt: 'Generate an ultra-modern futuristic renewable energy battery storage facility with glowing blue power conduits at dusk.',
  },
];
