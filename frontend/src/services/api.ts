import axios from 'axios';
import type {
  BatteryConfig,
  OptimizationRequest,
  OptimizationResult,
  ForecastResponse,
  PriceHistoryResponse,
  SimulationResult,
  ScenarioResult,
  BacktestResult,
  AnalyticsSummary,
  ChatResponse,
  HealthResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000, // 2 min for heavy optimization calls
});

api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const groqKey = localStorage.getItem('groq_api_key');
    if (groqKey && groqKey.trim().length > 0) {
      config.headers['X-Groq-Api-Key'] = groqKey.trim();
    }
  }
  return config;
});

// ── Health ────────────────────────────────────────────────────────────────────
export const getHealth = (): Promise<HealthResponse> =>
  api.get('/health').then(r => r.data);

// ── Battery Config ─────────────────────────────────────────────────────────────
export const getBatteryConfig = (): Promise<BatteryConfig> =>
  api.get('/battery/config').then(r => r.data);

export const saveBatteryConfig = (config: BatteryConfig): Promise<BatteryConfig> =>
  api.post('/battery/config', config).then(r => r.data);

// ── Prices ────────────────────────────────────────────────────────────────────
export const getPriceHistory = (limit = 168): Promise<PriceHistoryResponse> =>
  api.get(`/prices/history?limit=${limit}`).then(r => r.data);

export const uploadPrices = (file: File, datasetName = 'upload'): Promise<{
  success: boolean;
  records_imported: number;
  dataset_name: string;
  errors: string[];
}> => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/prices/upload?dataset_name=${datasetName}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// ── Forecast ──────────────────────────────────────────────────────────────────
export const generateForecast = (horizon = 24, forceRetrain = false): Promise<ForecastResponse> =>
  api.post(`/forecast/generate?horizon_hours=${horizon}&force_retrain=${forceRetrain}`).then(r => r.data);

export const getLatestForecast = (): Promise<ForecastResponse> =>
  api.get('/forecast/latest').then(r => r.data);

// ── Optimization ──────────────────────────────────────────────────────────────
export const runOptimization = (request: OptimizationRequest): Promise<OptimizationResult> =>
  api.post('/optimization/run', request).then(r => r.data);

export const getOptimizationResult = (id: number): Promise<OptimizationResult> =>
  api.get(`/optimization/${id}`).then(r => r.data);

// ── Simulation ────────────────────────────────────────────────────────────────
export const runSimulation = (params: {
  battery_config?: BatteryConfig;
  horizon_hours?: number;
  mode?: string;
}): Promise<SimulationResult> =>
  api.post('/simulation/run', params).then(r => r.data);

export const runScenario = (params: {
  scenario_name: string;
  scenario_params: Record<string, number | string>;
  battery_config?: BatteryConfig;
  horizon_hours?: number;
}): Promise<ScenarioResult> =>
  api.post('/simulation/scenario', params).then(r => r.data);

export const getSimulation = (id: number): Promise<SimulationResult> =>
  api.get(`/simulation/${id}`).then(r => r.data);

// ── Backtest ──────────────────────────────────────────────────────────────────
export const runBacktest = (params: {
  horizon_hours?: number;
  battery_config?: BatteryConfig;
}): Promise<BacktestResult> =>
  api.post(`/backtest/run?horizon_hours=${params.horizon_hours || 48}`, params.battery_config || null).then(r => r.data);

export const getBacktestResult = (id: number): Promise<BacktestResult> =>
  api.get(`/backtest/${id}`).then(r => r.data);

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getAnalyticsSummary = (): Promise<AnalyticsSummary> =>
  api.get('/analytics/summary').then(r => r.data);

// ── AI Assistant ──────────────────────────────────────────────────────────────
export const sendChatMessage = (params: {
  message: string;
  optimization_run_id?: number;
  include_forecast?: boolean;
  conversation_history?: Array<{ role: string; content: string }>;
}): Promise<ChatResponse> =>
  api.post('/assistant/chat', params).then(r => r.data);

export default api;
