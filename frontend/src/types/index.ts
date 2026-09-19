// ── Battery & Config Types ──────────────────────────────────────────────────

export interface BatteryConfig {
  name: string;
  capacity_mwh: number;
  power_mw: number;
  efficiency_charge: number;
  efficiency_discharge: number;
  soc_min: number;
  soc_max: number;
  soc_initial: number;
  soc_terminal?: number | null;
  degradation_cost_per_mwh: number;
  reserve_level: number;
}

export interface BatteryState {
  soc: number;
  energy_mwh: number;
  action: 'charge' | 'discharge' | 'idle';
  charge_power_mw: number;
  discharge_power_mw: number;
  timestamp?: string;
  cycle_count: number;
  total_degradation_cost: number;
  total_revenue: number;
  total_energy_cost: number;
}

// ── Price & Forecast Types ──────────────────────────────────────────────────

export interface PricePoint {
  timestamp: string;
  price: number;
  source?: string;
}

export interface ForecastPoint {
  timestamp: string;
  p10: number;
  p50: number;
  p90: number;
  is_forecast?: boolean;
}

export interface ForecastResponse {
  run_id: number;
  model_type: string;
  horizon_hours: number;
  created_at: string;
  forecasts: ForecastPoint[];
  status: string;
}

export interface PriceHistoryResponse {
  prices: PricePoint[];
  total_records: number;
  dataset_name: string;
  start_date?: string;
  end_date?: string;
}

// ── Optimization Types ───────────────────────────────────────────────────────

export interface DispatchStep {
  step: number;
  timestamp: string;
  price: number;
  price_type: string;
  charge_power_mw: number;
  discharge_power_mw: number;
  soc_start: number;
  soc_end: number;
  action: 'charge' | 'discharge' | 'idle';
  revenue: number;
  energy_cost: number;
  degradation_cost: number;
  net_profit: number;
  dod: number;
}

export interface ConstraintStatus {
  passed: boolean;
  violations: number;
  details: string[];
}

export interface OptimizationResult {
  run_id: number;
  status: 'optimal' | 'infeasible' | 'timeout' | 'error' | 'running';
  solver: string;
  solver_status: string;
  runtime_seconds: number;
  objective_value?: number;
  total_revenue?: number;
  total_energy_cost?: number;
  total_degradation_cost?: number;
  net_profit?: number;
  cycle_count?: number;
  constraint_status: ConstraintStatus;
  dispatch: DispatchStep[];
  battery_config?: BatteryConfig;
  created_at: string;
  error_message?: string;
  infeasibility_reason?: string;
}

export interface OptimizationRequest {
  battery_config?: BatteryConfig;
  horizon_hours?: number;
  use_forecast?: boolean;
  scenario?: Record<string, unknown>;
}

// ── Simulation Types ─────────────────────────────────────────────────────────

export interface SimulationStep {
  step: number;
  timestamp: string;
  action: 'charge' | 'discharge' | 'idle';
  charge_power_mw: number;
  discharge_power_mw: number;
  soc_before: number;
  soc_after: number;
  price: number;
  revenue: number;
  energy_cost: number;
  degradation_cost: number;
  net_profit: number;
  constraint_violations: number;
}

export interface SimulationResult {
  run_id: number;
  status: string;
  mode: string;
  total_steps: number;
  current_step: number;
  cumulative_profit: number;
  cumulative_degradation_cost: number;
  battery_state: BatteryState;
  history: SimulationStep[];
}

// ── Scenario Types ───────────────────────────────────────────────────────────

export type ScenarioType = 'price_spike' | 'forecast_error' | 'high_degradation' | 'low_soc' | 'low_efficiency' | 'low_capacity';

export interface ScenarioConfig {
  name: string;
  description: string;
  params: Record<string, number | string>;
  icon: string;
  color: string;
}

export interface ScenarioResult {
  scenario_name: string;
  base: {
    run_id: number;
    status: string;
    net_profit?: number;
    total_revenue?: number;
    total_energy_cost?: number;
    total_degradation_cost?: number;
    cycle_count?: number;
    constraint_violations: number;
    runtime_seconds: number;
    dispatch: DispatchStep[];
  };
  scenario: {
    run_id: number;
    status: string;
    net_profit?: number;
    total_revenue?: number;
    total_energy_cost?: number;
    total_degradation_cost?: number;
    cycle_count?: number;
    constraint_violations: number;
    runtime_seconds: number;
    dispatch: DispatchStep[];
  };
}

// ── Backtest Types ───────────────────────────────────────────────────────────

export interface BacktestMetrics {
  total_revenue: number;
  total_energy_cost: number;
  total_degradation_cost: number;
  net_profit: number;
  avg_profit_per_hour: number;
  cycle_count: number;
  charge_hours: number;
  discharge_hours: number;
  idle_hours: number;
  final_soc: number;
  avg_soc: number;
  average_dod: number;
  dominant_tier: string;
  cumulative_profit: Array<{ timestamp: string; cumulative_profit: number }>;
}

export interface BacktestStep {
  step: number;
  timestamp: string;
  price: number;
  action: string;
  charge_power_mw: number;
  discharge_power_mw: number;
  soc_start: number;
  soc_end: number;
  revenue: number;
  energy_cost: number;
  degradation_cost: number;
  net_profit: number;
}

export interface BacktestResult {
  run_id: number;
  status: string;
  horizon_hours: number;
  price_type: string;
  greedy: {
    metrics: BacktestMetrics;
    steps: BacktestStep[];
  };
  mpc: {
    metrics: BacktestMetrics;
    steps: BacktestStep[];
  };
  comparison: {
    profit_improvement: number;
    profit_improvement_pct: number;
    degradation_savings: number;
    mpc_wins: boolean;
    cycle_reduction: number;
  };
}

// ── Analytics Types ───────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  optimization_runs: number;
  simulation_runs: number;
  price_records: number;
  price_stats?: {
    min: number;
    max: number;
    mean: number;
    count: number;
  };
  prices?: Array<{ timestamp: string; price: number }>;
  latest_optimization?: {
    run_id: number;
    net_profit?: number;
    total_revenue?: number;
    total_energy_cost?: number;
    total_degradation_cost?: number;
    runtime_seconds?: number;
    constraint_violations: number;
    created_at: string;
  };
  latest_dispatch?: DispatchStep[];
  soc_trajectory?: number[];
  profit_history?: Array<{
    run_id: number;
    created_at: string;
    net_profit: number;
    degradation_cost: number;
    revenue: number;
    runtime_seconds: number;
  }>;
  latest_forecast?: Array<{ timestamp: string; p10: number; p50: number; p90: number }>;
  simulation_summaries?: Array<{
    run_id: number;
    mode: string;
    steps: number;
    net_profit: number;
    degradation_cost: number;
    created_at: string;
  }>;
}

// ── AI Assistant Types ───────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  model?: string;
  used_groq?: boolean;
}

export interface ChatResponse {
  response: string;
  model: string;
  used_groq: boolean;
  context_summary?: string;
  fallback_reason?: string;
}

// ── Health ───────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  app: string;
  groq_configured: boolean;
  version: string;
}
