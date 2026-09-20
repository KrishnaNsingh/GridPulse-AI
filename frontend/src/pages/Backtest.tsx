import { useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Play, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { KPI } from '../components/KPI';
import { runBacktest } from '../services/api';
import type { BacktestResult } from '../types';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <strong style={{ color: 'var(--text-primary)' }}>{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function BacktestPage() {
  const [horizonHours, setHorizonHours] = useState(48);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await runBacktest({ horizon_hours: horizonHours });
      setResult(r);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Backtest failed');
    } finally {
      setRunning(false);
    }
  }, [horizonHours]);

  const g = result?.greedy?.metrics;
  const m = result?.mpc?.metrics;
  const comp = result?.comparison;

  // Merge cumulative profit series
  const cumProfitData = (() => {
    if (!result) return [];
    const greedy = result.greedy?.metrics?.cumulative_profit || [];
    const mpc = result.mpc?.metrics?.cumulative_profit || [];
    const len = Math.max(greedy.length, mpc.length);
    return Array.from({ length: len }, (_, i) => ({
      i,
      greedy: greedy[i]?.cumulative_profit ?? null,
      mpc: mpc[i]?.cumulative_profit ?? null,
    }));
  })();

  // Action distribution
  const actionDistData = g && m ? [
    { name: 'Charge', greedy: g.charge_hours, mpc: m.charge_hours },
    { name: 'Discharge', greedy: g.discharge_hours, mpc: m.discharge_hours },
    { name: 'Idle', greedy: g.idle_hours, mpc: m.idle_hours },
  ] : [];

  // Step-level net profit comparison
  const stepCompare = (() => {
    if (!result) return [];
    const gs = result.greedy?.steps || [];
    const ms = result.mpc?.steps || [];
    return Array.from({ length: Math.min(gs.length, ms.length) }, (_, i) => ({
      step: i,
      greedy: gs[i]?.net_profit ?? 0,
      mpc: ms[i]?.net_profit ?? 0,
    }));
  })();

  return (
    <div style={{ padding: '80px 24px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div className="page-header animate-fade-in" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Strategy Backtest</h1>
            <p className="page-subtitle">Empirical Benchmark: Greedy Arbitrage vs GridPulse MPC · Degradation-Penalized Evaluation</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="input" style={{ width: 'auto' }} value={horizonHours} onChange={e => setHorizonHours(+e.target.value)}>
              {[24, 48, 72, 168].map(h => <option key={h} value={h}>{h}h ({Math.round(h / 24)}d)</option>)}
            </select>
            <button className="btn-primary" onClick={run} disabled={running} id="run-backtest-btn">
              {running ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Running…</> : <><Play size={14} /> Run Backtest</>}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {!result && !running && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Select a horizon and click Run Backtest</div>
          <div style={{ fontSize: 12 }}>Compares Greedy (percentile-based) vs GridPulse MPC (MILP) on actual price data</div>
        </div>
      )}

      {running && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', display: 'inline' }} />
          </div>
          <div style={{ marginTop: 12 }}>Running both strategies on historical price data…</div>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
            This takes a few seconds — MPC runs MILP for each timestep
          </div>
        </div>
      )}

      {result && (
        <div className="animate-fade-in">
          {/* Winner Banner */}
          <div style={{
            padding: '16px 20px', borderRadius: 10, marginBottom: 16,
            background: comp?.mpc_wins ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${comp?.mpc_wins ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {comp?.mpc_wins ? <TrendingUp size={20} color="#10b981" /> : <TrendingDown size={20} color="#ef4444" />}
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: comp?.mpc_wins ? '#10b981' : '#ef4444' }}>
                  {comp?.mpc_wins ? 'GridPulse MPC Wins' : 'Greedy Outperforms MPC'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {result.horizon_hours}h backtest · {result.price_type} prices
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>Profit Δ: <strong style={{ color: comp?.mpc_wins ? '#10b981' : '#ef4444' }}>
                {(comp?.profit_improvement ?? 0) >= 0 ? '+' : ''}{comp?.profit_improvement?.toFixed(2)}$ ({comp?.profit_improvement_pct?.toFixed(1)}%)
              </strong></span>
              <span>Degradation savings: <strong style={{ color: (comp?.degradation_savings ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                ${comp?.degradation_savings?.toFixed(2)}
              </strong></span>
              <span>Cycle reduction: <strong>{comp?.cycle_reduction?.toFixed(2)}</strong></span>
            </div>
          </div>

          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {/* Greedy */}
            <div className="card">
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                📊 Greedy Strategy
              </div>
              <div className="kpi-grid">
                <KPI label="Net Profit" value={g?.net_profit || 0} unit="$" color="#6b7280" />
                <KPI label="Revenue" value={g?.total_revenue || 0} unit="$" color="#6b7280" />
                <KPI label="Degradation" value={g?.total_degradation_cost || 0} unit="$" color="#6b7280" />
                <KPI label="Cycles" value={g?.cycle_count || 0} color="#6b7280" subtext={`avg SoC ${((g?.avg_soc || 0) * 100).toFixed(0)}%`} />
              </div>
            </div>
            {/* MPC */}
            <div className="card">
              <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                ⚡ GridPulse MPC
              </div>
              <div className="kpi-grid">
                <KPI label="Net Profit" value={m?.net_profit || 0} unit="$" color="var(--accent-green)" />
                <KPI label="Revenue" value={m?.total_revenue || 0} unit="$" color="var(--accent-blue)" />
                <KPI label="Degradation" value={m?.total_degradation_cost || 0} unit="$" color="var(--accent-amber)" />
                <KPI label="Cycles" value={m?.cycle_count || 0} color="var(--accent-cyan)" subtext={`avg SoC ${((m?.avg_soc || 0) * 100).toFixed(0)}%`} />
              </div>
            </div>
          </div>

          {/* Cumulative Profit Chart */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Cumulative Profit Comparison</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, background: '#6b7280', borderRadius: 2, display: 'inline-block' }} /> Greedy
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2, display: 'inline-block' }} /> GridPulse MPC
              </span>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={cumProfitData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="i" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={Math.max(1, Math.floor(cumProfitData.length / 12))} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <Area type="monotone" dataKey="greedy" stroke="#6b7280" fill="rgba(107,114,128,0.1)" strokeWidth={1.5} dot={false} name="Greedy $" />
                  <Area type="monotone" dataKey="mpc" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={2} dot={false} name="MPC $" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action Distribution + Per-Step Profit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Action Distribution</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={actionDistData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="greedy" name="Greedy" fill="#6b7280" opacity={0.8} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="mpc" name="MPC" fill="#10b981" opacity={0.8} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Per-Step Net Profit (first 48h)</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={stepCompare.slice(0, 48)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="step" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={5} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Bar dataKey="greedy" name="Greedy" fill="#6b7280" opacity={0.7} />
                    <Bar dataKey="mpc" name="MPC" fill="#10b981" opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
