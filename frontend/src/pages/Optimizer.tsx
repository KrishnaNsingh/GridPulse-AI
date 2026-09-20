import { useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { Cpu, Play, RefreshCw, AlertTriangle, CheckCircle, Info, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KPI } from '../components/KPI';
import { BatteryVisualization } from '../components/BatteryVisualization';
import { runOptimization, getBatteryConfig } from '../services/api';
import type { OptimizationResult, BatteryConfig, BatteryState, DispatchStep } from '../types';

const DEFAULT_BATTERY: BatteryConfig = {
  name: 'BESS Config',
  capacity_mwh: 10, power_mw: 2.5,
  efficiency_charge: 0.95, efficiency_discharge: 0.95,
  soc_min: 0.1, soc_max: 0.9, soc_initial: 0.5,
  degradation_cost_per_mwh: 5, reserve_level: 0,
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div style={{ marginBottom: 4, color: 'var(--text-muted)', fontSize: 11 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.name}:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ConfigPanel({ config, onChange }: { config: BatteryConfig; onChange: (c: BatteryConfig) => void }) {
  const field = (label: string, key: keyof BatteryConfig, step = 0.01, min = 0, max = 1000, unit = '') => (
    <div style={{ marginBottom: 12 }}>
      <label>{label} {unit && <span style={{ color: 'var(--text-muted)' }}>({unit})</span>}</label>
      <input
        type="number"
        className="input"
        step={step}
        min={min}
        max={max}
        value={config[key] as number}
        onChange={e => onChange({ ...config, [key]: parseFloat(e.target.value) || 0 })}
      />
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
      {field('Capacity', 'capacity_mwh', 0.5, 0.1, 1000, 'MWh')}
      {field('Power Limit', 'power_mw', 0.1, 0.1, 500, 'MW')}
      {field('Charge Efficiency', 'efficiency_charge', 0.01, 0.01, 1)}
      {field('Discharge Efficiency', 'efficiency_discharge', 0.01, 0.01, 1)}
      {field('SoC Min', 'soc_min', 0.01, 0, 0.5)}
      {field('SoC Max', 'soc_max', 0.01, 0.5, 1)}
      {field('SoC Initial', 'soc_initial', 0.01, 0, 1)}
      {field('Degradation Cost', 'degradation_cost_per_mwh', 0.5, 0, 100, '$/MWh')}
    </div>
  );
}

export default function OptimizerPage() {
  const [config, setConfig] = useState<BatteryConfig>(DEFAULT_BATTERY);
  const [horizonHours, setHorizonHours] = useState(24);
  const [useForecast, setUseForecast] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const batteryState: BatteryState = (() => {
    if (!result?.dispatch?.length) return { soc: config.soc_initial, energy_mwh: config.soc_initial * config.capacity_mwh, action: 'idle', charge_power_mw: 0, discharge_power_mw: 0, cycle_count: 0, total_degradation_cost: 0, total_revenue: 0, total_energy_cost: 0 };
    const f = result.dispatch[0];
    return { soc: f.soc_start, energy_mwh: f.soc_start * config.capacity_mwh, action: f.action, charge_power_mw: f.charge_power_mw, discharge_power_mw: f.discharge_power_mw, cycle_count: result.cycle_count || 0, total_degradation_cost: result.total_degradation_cost || 0, total_revenue: result.total_revenue || 0, total_energy_cost: result.total_energy_cost || 0 };
  })();

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await runOptimization({ battery_config: config, horizon_hours: horizonHours, use_forecast: useForecast });
      setResult(r);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Optimization failed');
    } finally {
      setRunning(false);
    }
  }, [config, horizonHours, useForecast]);

  const loadConfig = useCallback(async () => {
    try {
      const c = await getBatteryConfig();
      setConfig(c);
    } catch {}
  }, []);

  const dispatchData = result?.dispatch?.map(d => ({
    h: `h${d.step}`,
    price: d.price,
    soc: +(d.soc_start * 100).toFixed(1),
    charge: d.charge_power_mw,
    discharge: d.discharge_power_mw,
    profit: d.net_profit,
    deg: d.degradation_cost,
    action: d.action,
  })) || [];

  const profitData = result?.dispatch?.map(d => ({ h: `h${d.step}`, profit: d.net_profit })) || [];

  return (
    <div style={{ padding: '80px 24px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div className="page-header animate-fade-in" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">MILP Optimizer</h1>
            <p className="page-subtitle">PuLP + HiGHS solver · Degradation-aware dispatch optimization</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-secondary" onClick={() => { setShowConfig(!showConfig); loadConfig(); }} id="toggle-config-btn">
              <Settings2 size={14} /> {showConfig ? 'Hide' : 'Configure'}
            </button>
            <select
              className="input"
              style={{ width: 'auto', padding: '9px 12px' }}
              value={horizonHours}
              onChange={e => setHorizonHours(+e.target.value)}
            >
              {[6, 12, 24, 48].map(h => <option key={h} value={h}>{h}h horizon</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer' }}>
              <input type="checkbox" checked={useForecast} onChange={e => setUseForecast(e.target.checked)} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Use forecast</span>
            </label>
            <button className="btn-primary" onClick={run} disabled={running} id="run-milp-btn">
              {running ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Solving…</> : <><Cpu size={14} /> Solve MILP</>}
            </button>
          </div>
        </div>
      </div>

      {/* Config Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div className="card animate-fade-in" style={{ marginBottom: 16 }}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-primary)' }}>Battery Configuration</div>
            <ConfigPanel config={config} onChange={setConfig} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', gap: 8, color: '#ef4444' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13 }}>{error}</span>
        </div>
      )}

      {/* Status Banner */}
      {result && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: result.status === 'optimal' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${result.status === 'optimal' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {result.status === 'optimal' ? <CheckCircle size={16} color="#10b981" /> : <AlertTriangle size={16} color="#ef4444" />}
            <span style={{ fontSize: 14, fontWeight: 600, color: result.status === 'optimal' ? '#10b981' : '#ef4444' }}>
              {result.status.toUpperCase()} — {result.solver} · {result.runtime_seconds.toFixed(3)}s
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Violations: <strong style={{ color: result.constraint_status.violations === 0 ? '#10b981' : '#ef4444' }}>{result.constraint_status.violations}</strong></span>
            <span>Timesteps: <strong>{result.dispatch.length}</strong></span>
            {result.infeasibility_reason && <span style={{ color: '#f59e0b' }}>⚠ {result.infeasibility_reason}</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
        {/* Battery */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>First Action</div>
          <BatteryVisualization state={batteryState} config={config} size="md" />
        </div>

        {/* Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPIs */}
          {result && (
            <div className="kpi-grid">
              <KPI label="Net Profit" value={result.net_profit || 0} unit="$" color="var(--accent-green)" />
              <KPI label="Revenue" value={result.total_revenue || 0} unit="$" color="var(--accent-blue)" />
              <KPI label="Energy Cost" value={result.total_energy_cost || 0} unit="$" color="var(--accent-red)" />
              <KPI label="Degradation" value={result.total_degradation_cost || 0} unit="$" color="var(--accent-amber)" />
            </div>
          )}

          {/* SoC Chart */}
          {dispatchData.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>SoC Trajectory + Price</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer>
                  <AreaChart data={dispatchData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="h" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={Math.max(1, Math.floor(dispatchData.length / 12))} />
                    <YAxis yAxisId="soc" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area yAxisId="soc" type="monotone" dataKey="soc" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" strokeWidth={2} name="SoC %" />
                    <Line yAxisId="price" type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Price $/MWh" strokeDasharray="4,2" />
                    <ReferenceLine yAxisId="soc" y={config.soc_min * 100} stroke="#ef444466" strokeDasharray="3,3" />
                    <ReferenceLine yAxisId="soc" y={config.soc_max * 100} stroke="#22d3ee44" strokeDasharray="3,3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-Step Profit */}
          {profitData.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Per-Timestep Net Profit</div>
              <div style={{ height: 140 }}>
                <ResponsiveContainer>
                  <BarChart data={profitData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="h" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={Math.max(1, Math.floor(profitData.length / 12))} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Bar dataKey="profit" name="Net Profit $" radius={[2, 2, 0, 0]}>
                      {profitData.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Table */}
      {result?.dispatch && result.dispatch.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Full Dispatch Schedule</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Step', 'Time', 'Action', 'Price', 'Charge MW', 'Discharge MW', 'SoC%', 'Revenue', 'Cost', 'Deg$', 'Net$'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.dispatch.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>{d.step}</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>
                      {new Date(d.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '5px 10px' }}>
                      <span className={`badge badge-${d.action === 'charge' ? 'charging' : d.action === 'discharge' ? 'discharging' : 'idle'}`} style={{ fontSize: 10 }}>
                        {d.action}
                      </span>
                    </td>
                    <td style={{ padding: '5px 10px', fontFamily: 'monospace' }}>${d.price.toFixed(2)}</td>
                    <td style={{ padding: '5px 10px', color: d.charge_power_mw > 0 ? '#06b6d4' : 'var(--text-muted)', fontFamily: 'monospace' }}>{d.charge_power_mw.toFixed(3)}</td>
                    <td style={{ padding: '5px 10px', color: d.discharge_power_mw > 0 ? '#f97316' : 'var(--text-muted)', fontFamily: 'monospace' }}>{d.discharge_power_mw.toFixed(3)}</td>
                    <td style={{ padding: '5px 10px', fontFamily: 'monospace' }}>{(d.soc_start * 100).toFixed(1)}%</td>
                    <td style={{ padding: '5px 10px', color: '#10b981', fontFamily: 'monospace' }}>${d.revenue.toFixed(3)}</td>
                    <td style={{ padding: '5px 10px', color: '#ef4444', fontFamily: 'monospace' }}>${d.energy_cost.toFixed(3)}</td>
                    <td style={{ padding: '5px 10px', color: '#f59e0b', fontFamily: 'monospace' }}>${d.degradation_cost.toFixed(3)}</td>
                    <td style={{ padding: '5px 10px', color: d.net_profit >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontWeight: 600 }}>${d.net_profit.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Constraint Violations */}
      {Boolean(result?.constraint_status && result.constraint_status.violations > 0 && result.constraint_status.details?.length) && (
        <div className="card" style={{ marginTop: 16, background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle size={14} /> Constraint Violations ({result?.constraint_status?.violations})
          </div>
          {result?.constraint_status?.details?.map((d, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0', fontFamily: 'monospace' }}>
              • {d}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
