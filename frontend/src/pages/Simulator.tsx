import { useState, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Play, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { KPI } from '../components/KPI';
import { runScenario, getBatteryConfig } from '../services/api';
import type { ScenarioResult, BatteryConfig } from '../types';

const DEFAULT_BATTERY: BatteryConfig = {
  name: 'Scenario BESS', capacity_mwh: 10, power_mw: 2.5,
  efficiency_charge: 0.95, efficiency_discharge: 0.95,
  soc_min: 0.1, soc_max: 0.9, soc_initial: 0.5,
  degradation_cost_per_mwh: 5, reserve_level: 0,
};

const SCENARIOS = [
  {
    id: 'price_spike',
    name: 'Price Spike',
    description: 'Simulate a sudden 3× price spike during peak hours',
    params: { price_spike: 1, spike_hour: 8, spike_magnitude: 3.0, spike_duration: 3 },
    icon: '⚡',
    color: '#f59e0b',
  },
  {
    id: 'high_degradation',
    name: 'High Degradation',
    description: 'Double degradation cost — test impact on dispatch strategy',
    params: { degradation_multiplier: 2.0 },
    icon: '🔋',
    color: '#ef4444',
  },
  {
    id: 'low_capacity',
    name: 'Low Capacity',
    description: 'Reduce available SoC window to 20–70% (reserve requirement)',
    params: { soc_min_override: 0.2, soc_max_override: 0.7 },
    icon: '📉',
    color: '#8b5cf6',
  },
  {
    id: 'price_discount',
    name: 'Price Discount',
    description: 'All electricity prices reduced by 30% — marginal arbitrage',
    params: { price_multiplier: 0.7 },
    icon: '💹',
    color: '#10b981',
  },
  {
    id: 'price_surge',
    name: 'Energy Crisis',
    description: 'All prices 2× — premium discharge opportunity',
    params: { price_multiplier: 2.0 },
    icon: '🌡️',
    color: '#f97316',
  },
  {
    id: 'low_efficiency',
    name: 'Degraded Battery',
    description: 'Efficiency reduced to 85% — aging battery simulation',
    params: { efficiency_override: 0.85 },
    icon: '🔌',
    color: '#6b7280',
  },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', gap: 8 }}>
          <span style={{ color: p.color }}>{p.name}:</span>
          <strong>${typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function SimulatorPage() {
  const [selectedScenario, setSelectedScenario] = useState<typeof SCENARIOS[0] | null>(null);
  const [horizonHours, setHorizonHours] = useState(24);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!selectedScenario) return;
    setRunning(true);
    setError(null);
    try {
      const r = await runScenario({
        scenario_name: selectedScenario.name,
        scenario_params: selectedScenario.params,
        horizon_hours: horizonHours,
      });
      setResult(r);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Scenario failed');
    } finally {
      setRunning(false);
    }
  }, [selectedScenario, horizonHours]);

  const compareData = result ? [
    { metric: 'Net Profit', base: result.base.net_profit || 0, scenario: result.scenario.net_profit || 0 },
    { metric: 'Revenue', base: result.base.total_revenue || 0, scenario: result.scenario.total_revenue || 0 },
    { metric: 'Energy Cost', base: result.base.total_energy_cost || 0, scenario: result.scenario.total_energy_cost || 0 },
    { metric: 'Degradation', base: result.base.total_degradation_cost || 0, scenario: result.scenario.total_degradation_cost || 0 },
  ] : [];

  const baseDispatch = result?.base?.dispatch?.map(d => ({ h: `h${d.step}`, soc: +(d.soc_start * 100).toFixed(1), price: d.price, profit: d.net_profit })) || [];
  const scenarioDispatch = result?.scenario?.dispatch?.map(d => ({ h: `h${d.step}`, soc: +(d.soc_start * 100).toFixed(1), price: d.price, profit: d.net_profit })) || [];

  const improvement = result ? (result.scenario.net_profit || 0) - (result.base.net_profit || 0) : 0;

  return (
    <div style={{ padding: '80px 24px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div className="page-header animate-fade-in" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">What-If Simulator</h1>
            <p className="page-subtitle">Scenario analysis · Base vs Scenario MILP comparison · Real computed metrics</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="input" style={{ width: 'auto' }} value={horizonHours} onChange={e => setHorizonHours(+e.target.value)}>
              {[12, 24, 48].map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
            <button className="btn-primary" onClick={run} disabled={running || !selectedScenario} id="run-scenario-btn">
              {running ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Running…</> : <><Play size={14} /> Run Scenario</>}
            </button>
          </div>
        </div>
      </div>

      {/* Scenario Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }} className="animate-fade-in">
        {SCENARIOS.map(s => (
          <button
            key={s.id}
            id={`scenario-${s.id}`}
            onClick={() => setSelectedScenario(s)}
            style={{
              background: selectedScenario?.id === s.id ? `rgba(${s.color === '#f59e0b' ? '245,158,11' : s.color === '#ef4444' ? '239,68,68' : s.color === '#8b5cf6' ? '139,92,246' : s.color === '#10b981' ? '16,185,129' : s.color === '#f97316' ? '249,115,22' : '107,114,128'},0.12)` : 'var(--surface)',
              border: `1px solid ${selectedScenario?.id === s.id ? s.color : 'var(--border)'}`,
              borderRadius: 10,
              padding: '14px 16px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.description}</div>
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {!selectedScenario && !result && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
          Select a scenario above to run a what-if analysis
        </div>
      )}

      {result && (
        <div className="animate-fade-in">
          {/* Comparison Banner */}
          <div style={{
            padding: '14px 20px', borderRadius: 10, marginBottom: 16,
            background: improvement >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${improvement >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 16, color: improvement >= 0 ? '#10b981' : '#ef4444' }}>
                {selectedScenario?.name}: {improvement >= 0 ? '+' : ''}{improvement.toFixed(2)} net profit vs base
              </span>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>Base: <strong>${(result.base.net_profit || 0).toFixed(2)}</strong></span>
              <span>Scenario: <strong style={{ color: improvement >= 0 ? '#10b981' : '#ef4444' }}>${(result.scenario.net_profit || 0).toFixed(2)}</strong></span>
            </div>
          </div>

          {/* KPI Comparison */}
          <div className="kpi-grid" style={{ marginBottom: 16 }}>
            <KPI label="Base Net Profit" value={result.base.net_profit || 0} unit="$" color="var(--accent-blue)" />
            <KPI label="Scenario Net Profit" value={result.scenario.net_profit || 0} unit="$" color="var(--accent-green)" />
            <KPI label="Profit Δ" value={improvement} unit="$" color={improvement >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} trend={improvement >= 0 ? 'up' : 'down'} trendValue={`${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}`} />
            <KPI label="Base Runtime" value={`${result.base.runtime_seconds.toFixed(3)}s`} color="var(--accent-purple)" />
          </div>

          {/* Bar Chart Comparison */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Metric Comparison: Base vs Scenario</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}><span style={{ width: 10, height: 10, background: '#3b82f6', borderRadius: 2, display: 'inline-block' }} /> Base</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}><span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2, display: 'inline-block' }} /> Scenario</span>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={compareData} margin={{ top: 4, right: 4, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="base" name="Base" fill="#3b82f6" opacity={0.8} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="scenario" name="Scenario" fill="#10b981" opacity={0.8} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SoC Comparison Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Base — SoC Trajectory</div>
              <div style={{ height: 150 }}>
                <ResponsiveContainer>
                  <AreaChart data={baseDispatch} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="h" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="soc" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" strokeWidth={2} name="SoC %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: selectedScenario?.color || 'var(--text-primary)', marginBottom: 10 }}>Scenario — SoC Trajectory</div>
              <div style={{ height: 150 }}>
                <ResponsiveContainer>
                  <AreaChart data={scenarioDispatch} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="h" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="soc" stroke={selectedScenario?.color || '#10b981'} fill={`${selectedScenario?.color || '#10b981'}22`} strokeWidth={2} name="SoC %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
