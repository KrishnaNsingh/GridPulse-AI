import { useState, useCallback, useRef, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Play, Square, RefreshCw, Activity, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { KPI } from '../components/KPI';
import { Battery3D } from '../components/3d/Battery3D';
import { useBattery } from '../context/BatteryContext';
import { runSimulation } from '../services/api';
import type { SimulationResult, BatteryConfig, BatteryState, SimulationStep } from '../types';

const DEFAULT_BATTERY: BatteryConfig = {
  name: 'Digital Twin', capacity_mwh: 10, power_mw: 2.5,
  efficiency_charge: 0.95, efficiency_discharge: 0.95,
  soc_min: 0.1, soc_max: 0.9, soc_initial: 0.5,
  degradation_cost_per_mwh: 5, reserve_level: 0,
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', gap: 8 }}>
          <span style={{ color: p.color }}>{p.name}:</span>
          <strong>{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function StepHistory({ history, visible }: { history: SimulationStep[]; visible: number }) {
  const shown = history.slice(-visible);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Step', 'Action', 'Price', 'Charge MW', 'Discharge MW', 'SoC Before', 'SoC After', 'Revenue', 'Net Profit'].map(h => (
              <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((s, i) => (
            <motion.tr
              key={s.step}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{s.step}</td>
              <td style={{ padding: '4px 8px' }}>
                <span className={`badge badge-${s.action === 'charge' ? 'charging' : s.action === 'discharge' ? 'discharging' : 'idle'}`} style={{ fontSize: 10 }}>
                  {s.action}
                </span>
              </td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>${s.price.toFixed(2)}</td>
              <td style={{ padding: '4px 8px', color: '#06b6d4', fontFamily: 'monospace' }}>{s.charge_power_mw.toFixed(3)}</td>
              <td style={{ padding: '4px 8px', color: '#f97316', fontFamily: 'monospace' }}>{s.discharge_power_mw.toFixed(3)}</td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{(s.soc_before * 100).toFixed(1)}%</td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{(s.soc_after * 100).toFixed(1)}%</td>
              <td style={{ padding: '4px 8px', color: '#10b981', fontFamily: 'monospace' }}>${s.revenue.toFixed(3)}</td>
              <td style={{ padding: '4px 8px', color: s.net_profit >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontWeight: 600 }}>${s.net_profit.toFixed(3)}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DigitalTwinPage() {
  const { config, batteryState: globalBatteryState, setBatteryState } = useBattery();
  const [horizonHours, setHorizonHours] = useState(24);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animStep, setAnimStep] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate through steps after run completes
  useEffect(() => {
    if (!result?.history?.length) { setAnimStep(0); return; }
    setAnimStep(0);
    let i = 0;
    animRef.current = setInterval(() => {
      i++;
      if (i >= result.history.length) { clearInterval(animRef.current!); setAnimStep(result.history.length - 1); return; }
      setAnimStep(i);
    }, 120);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [result]);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await runSimulation({ battery_config: config, horizon_hours: horizonHours, mode: 'mpc' });
      setResult(r);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Simulation failed');
    } finally {
      setRunning(false);
    }
  }, [config, horizonHours]);

  const currentHistory = result?.history?.slice(0, animStep + 1) || [];
  const currentStep = result?.history?.[animStep];

  const liveState: BatteryState = currentStep ? {
    soc: currentStep.soc_after,
    energy_mwh: Number((currentStep.soc_after * (config.capacity_mwh || 10)).toFixed(2)),
    action: currentStep.action,
    charge_power_mw: currentStep.charge_power_mw,
    discharge_power_mw: currentStep.discharge_power_mw,
    cycle_count: 0,
    total_degradation_cost: currentHistory.reduce((s, h) => s + h.degradation_cost, 0),
    total_revenue: currentHistory.reduce((s, h) => s + h.revenue, 0),
    total_energy_cost: currentHistory.reduce((s, h) => s + h.energy_cost, 0),
  } : globalBatteryState;

  // Real-time synchronization back to centralized BatteryContext
  useEffect(() => {
    if (result && currentStep) {
      setBatteryState(liveState);
    }
  }, [animStep, result, currentStep, setBatteryState]);

  const socChartData = currentHistory.map(s => ({
    step: s.step,
    soc: +(s.soc_after * 100).toFixed(2),
    price: s.price,
    profit: s.net_profit,
  }));

  const cumProfitData = (() => {
    let cum = 0;
    return currentHistory.map(s => { cum += s.net_profit; return { step: s.step, cumProfit: +cum.toFixed(3) }; });
  })();

  const cumRevenue = currentHistory.reduce((s, h) => s + h.revenue, 0);
  const cumCost = currentHistory.reduce((s, h) => s + h.energy_cost, 0);
  const cumDeg = currentHistory.reduce((s, h) => s + h.degradation_cost, 0);
  const cumProfit = cumRevenue - cumCost - cumDeg;

  return (
    <div style={{ padding: '80px 24px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div className="page-header animate-fade-in" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Digital Twin</h1>
            <p className="page-subtitle">MPC Closed-Loop Simulation · Receding horizon control · Step-by-step replay</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="input" style={{ width: 'auto', padding: '9px 12px' }} value={horizonHours} onChange={e => setHorizonHours(+e.target.value)}>
              {[12, 24, 48].map(h => <option key={h} value={h}>{h}h simulation</option>)}
            </select>
            <button className="btn-primary" onClick={run} disabled={running} id="run-simulation-btn">
              {running ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Simulating…</> : <><Play size={14} /> Run MPC Sim</>}
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {running && (
        <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '60%', background: 'linear-gradient(90deg, #3b82f6, #06b6d4)', borderRadius: 2, animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* KPIs (live) */}
      {result && (
        <div className="kpi-grid animate-fade-in" style={{ marginBottom: 16 }}>
          <KPI label="Cumulative Profit" value={cumProfit} unit="$" color="var(--accent-green)" trend={cumProfit >= 0 ? 'up' : 'down'} />
          <KPI label="Revenue" value={cumRevenue} unit="$" color="var(--accent-blue)" />
          <KPI label="Energy Cost" value={cumCost} unit="$" color="var(--accent-red)" />
          <KPI label="Degradation Cost" value={cumDeg} unit="$" color="var(--accent-amber)" />
          <KPI label="Steps Completed" value={`${animStep + 1} / ${result.history.length}`} color="var(--accent-cyan)" />
          <KPI label="Current SoC" value={`${(liveState.soc * 100).toFixed(1)}%`} color="var(--accent-blue)" subtext={liveState.action.toUpperCase()} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 280px) 1fr', gap: 16 }}>
        {/* Live 3D Battery Digital Twin */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14, width: '100%', textAlign: 'center' }}>
            {result ? `Twin Simulation · Step ${animStep + 1}/${result.history.length}` : 'Digital Twin Real-Time'}
          </div>
          <Battery3D state={liveState} config={config} size="md" />
          {currentStep && (
            <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              Market Price: ${currentStep.price.toFixed(2)}/MWh
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* SoC trajectory */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Live SoC Trajectory</div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer>
                <AreaChart data={socChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="step" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis yAxisId="soc" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area yAxisId="soc" type="monotone" dataKey="soc" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" strokeWidth={2} name="SoC %" />
                  <Line yAxisId="price" type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={1} dot={false} name="Price" strokeDasharray="4,2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative Profit */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Cumulative Profit</div>
            <div style={{ height: 130 }}>
              <ResponsiveContainer>
                <AreaChart data={cumProfitData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="step" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cumProfit" stroke="#10b981" fill="rgba(16,185,129,0.12)" strokeWidth={2} name="Cumulative Profit $" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Step History */}
      {currentHistory.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
            Step History (last {Math.min(currentHistory.length, 20)} steps)
          </div>
          <StepHistory history={currentHistory} visible={20} />
        </div>
      )}
    </div>
  );
}
