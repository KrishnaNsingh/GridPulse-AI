import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Zap, TrendingUp, DollarSign, Activity, RefreshCw, Cpu, Shield, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { KPI } from '../components/KPI';
import { Battery3D } from '../components/3d/Battery3D';
import { useBattery } from '../context/BatteryContext';
import { getAnalyticsSummary, getLatestForecast, runOptimization } from '../services/api';
import type { AnalyticsSummary, ForecastResponse, OptimizationResult, DispatchStep } from '../types';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div style={{ marginBottom: 4, color: 'var(--text-muted)', fontSize: 11 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
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

function ActionBar({ dispatch }: { dispatch: DispatchStep[] }) {
  if (!dispatch.length) return null;
  return (
    <div style={{ display: 'flex', gap: 2, overflow: 'hidden', borderRadius: 6 }}>
      {dispatch.map((d, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: i * 0.02 }}
          title={`h${d.step}: ${d.action} @ $${d.price.toFixed(1)}/MWh\nSoC: ${(d.soc_start * 100).toFixed(0)}%→${(d.soc_end * 100).toFixed(0)}%`}
          style={{
            flex: 1,
            height: 24,
            background: d.action === 'charge' ? 'rgba(6,182,212,0.7)' :
                        d.action === 'discharge' ? 'rgba(249,115,22,0.7)' :
                        'rgba(75,85,99,0.3)',
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { config: batteryConfig, batteryState, setBatteryState } = useBattery();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ana, fc] = await Promise.all([getAnalyticsSummary(), getLatestForecast().catch(() => null)]);
      setAnalytics(ana);
      setForecast(fc);

      // Parse latest optimization dispatch
      if (ana.latest_dispatch?.length) {
        const first = ana.latest_dispatch[0];
        setOptResult({
          run_id: ana.latest_optimization?.run_id || 0,
          status: 'optimal',
          solver: 'HiGHS',
          solver_status: 'Optimal',
          runtime_seconds: ana.latest_optimization?.runtime_seconds || 0,
          total_revenue: ana.latest_optimization?.total_revenue || 0,
          total_energy_cost: ana.latest_optimization?.total_energy_cost || 0,
          total_degradation_cost: ana.latest_optimization?.total_degradation_cost || 0,
          net_profit: ana.latest_optimization?.net_profit || 0,
          constraint_status: { passed: (ana.latest_optimization?.constraint_violations || 0) === 0, violations: ana.latest_optimization?.constraint_violations || 0, details: [] },
          dispatch: ana.latest_dispatch,
          created_at: ana.latest_optimization?.created_at || new Date().toISOString(),
        });

        // Sync global battery state
        setBatteryState(prev => ({
          ...prev,
          soc: first.soc_start,
          energy_mwh: Number((first.soc_start * (batteryConfig.capacity_mwh || 10)).toFixed(2)),
          action: first.action,
          charge_power_mw: first.charge_power_mw || 0,
          discharge_power_mw: first.discharge_power_mw || 0,
          total_degradation_cost: ana.latest_optimization?.total_degradation_cost || prev.total_degradation_cost,
          total_revenue: ana.latest_optimization?.total_revenue || prev.total_revenue,
          total_energy_cost: ana.latest_optimization?.total_energy_cost || prev.total_energy_cost,
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [batteryConfig.capacity_mwh, setBatteryState]);

  const runOpt = async () => {
    setRunning(true);
    try {
      const result = await runOptimization({ horizon_hours: 24, use_forecast: true });
      setOptResult(result);
      if (result.dispatch?.length) {
        const first = result.dispatch[0];
        setBatteryState(prev => ({
          ...prev,
          soc: first.soc_start,
          energy_mwh: Number((first.soc_start * (batteryConfig.capacity_mwh || 10)).toFixed(2)),
          action: first.action,
          charge_power_mw: first.charge_power_mw,
          discharge_power_mw: first.discharge_power_mw,
          cycle_count: result.cycle_count || prev.cycle_count,
          total_degradation_cost: result.total_degradation_cost || prev.total_degradation_cost,
          total_revenue: result.total_revenue || prev.total_revenue,
          total_energy_cost: result.total_energy_cost || prev.total_energy_cost,
        }));
      }
      await load();
    } catch (err) {
      console.error('Optimization error:', err);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  // Prepare chart data
  const dispatchChartData = optResult?.dispatch?.map(d => ({
    hour: `h${d.step}`,
    price: d.price,
    charge: d.charge_power_mw,
    discharge: -d.discharge_power_mw,
    soc: d.soc_start * 100,
    netProfit: d.net_profit,
  })) || [];

  const forecastChartData = forecast?.forecasts?.slice(0, 24).map(f => ({
    time: new Date(f.timestamp).toLocaleTimeString('en', { hour: '2-digit' }),
    p10: f.p10,
    p50: f.p50,
    p90: f.p90,
  })) || analytics?.latest_forecast?.slice(0, 24).map(f => ({
    time: new Date(f.timestamp).toLocaleTimeString('en', { hour: '2-digit' }),
    p10: f.p10,
    p50: f.p50,
    p90: f.p90,
  })) || [];

  const priceChartData = analytics?.prices?.slice(-168).map(p => ({
    time: new Date(p.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit' }),
    price: p.price,
  })) || [];

  return (
    <div style={{ padding: '80px 24px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header animate-fade-in" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">System Dashboard</h1>
            <p className="page-subtitle" style={{ marginTop: 4 }}>
              Live battery state · {analytics?.price_records || 0} price records · {analytics?.optimization_runs || 0} optimization runs
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={runOpt}
            disabled={running}
            id="run-optimization-btn"
          >
            {running ? (
              <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Optimizing…</>
            ) : (
              <><Cpu size={14} /> Run Optimization</>
            )}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid animate-fade-in" style={{ animationDelay: '0.05s' }}>
        <KPI
          label="Net Profit"
          value={optResult?.net_profit ?? 0}
          unit="$"
          color="var(--accent-green)"
          icon={<DollarSign size={14} />}
          trend={optResult?.net_profit != null ? (optResult.net_profit >= 0 ? 'up' : 'down') : 'neutral'}
          trendValue={`${optResult?.net_profit != null ? (optResult.net_profit >= 0 ? '+' : '') : ''}${(optResult?.net_profit ?? 0).toFixed(2)}`}
          loading={loading}
        />
        <KPI
          label="Revenue"
          value={optResult?.total_revenue ?? 0}
          unit="$"
          color="var(--accent-blue)"
          icon={<TrendingUp size={14} />}
          loading={loading}
        />
        <KPI
          label="Degradation Cost"
          value={optResult?.total_degradation_cost ?? 0}
          unit="$"
          color="var(--accent-amber)"
          icon={<Activity size={14} />}
          loading={loading}
        />
        <KPI
          label="Solver Runtime"
          value={optResult?.runtime_seconds?.toFixed(3) ?? '—'}
          unit="s"
          color="var(--accent-purple)"
          icon={<Clock size={14} />}
          subtext={optResult ? `${optResult.solver} · ${optResult.status}` : undefined}
          loading={loading}
        />
        <KPI
          label="Constraint Violations"
          value={optResult?.constraint_status?.violations ?? '—'}
          color={optResult?.constraint_status?.violations === 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
          icon={<Shield size={14} />}
          subtext={optResult?.constraint_status?.violations === 0 ? 'All satisfied' : 'Review required'}
          loading={loading}
        />
        <KPI
          label="Price Records"
          value={analytics?.price_records ?? 0}
          color="var(--accent-cyan)"
          icon={<Zap size={14} />}
          subtext={analytics?.price_stats ? `$${analytics.price_stats.min.toFixed(0)}–$${analytics.price_stats.max.toFixed(0)}/MWh` : undefined}
          loading={loading}
        />
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 280px) 1fr', gap: 16, marginTop: 16 }}>

        {/* 3D Battery Visualization */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.1s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14, width: '100%', textAlign: 'center' }}>
            Battery State
          </div>
          <Battery3D state={batteryState} config={batteryConfig} size="md" />
        </div>

        {/* Charts Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Dispatch Schedule */}
          <div className="card animate-fade-in" style={{ animationDelay: '0.12s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Optimal Dispatch Schedule</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  MILP solver · {optResult?.dispatch?.length || 0} timesteps
                  {optResult?.status && (
                    <span className={`badge badge-${optResult.status === 'optimal' ? 'optimal' : 'error'}`} style={{ marginLeft: 8 }}>
                      {optResult.status}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: '#06b6d4', borderRadius: 2, display: 'inline-block' }} /> Charge
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: '#f97316', borderRadius: 2, display: 'inline-block' }} /> Discharge
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: '#374151', borderRadius: 2, display: 'inline-block' }} /> Idle
                </span>
              </div>
            </div>
            {/* Action bar */}
            <ActionBar dispatch={optResult?.dispatch || []} />
            {/* SoC + Power chart */}
            <div style={{ height: 180, marginTop: 12 }}>
              <ResponsiveContainer>
                <AreaChart data={dispatchChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={3} />
                  <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['auto', 'auto']} />
                  <YAxis yAxisId="soc" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area yAxisId="soc" type="monotone" dataKey="soc" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" name="SoC %" strokeWidth={2} />
                  <Line yAxisId="price" type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={1} dot={false} name="Price $/MWh" strokeDasharray="4,2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Forecast */}
          {forecastChartData.length > 0 && (
            <div className="card animate-fade-in" style={{ animationDelay: '0.15s' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                24h Price Forecast — P10/P50/P90
              </div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer>
                  <AreaChart data={forecastChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={3} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="p90" stroke="none" fill="rgba(59,130,246,0.08)" name="P90" />
                    <Area type="monotone" dataKey="p50" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" strokeWidth={2} name="P50" />
                    <Area type="monotone" dataKey="p10" stroke="none" fill="rgba(7,11,20,1)" name="P10" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historical Price Chart */}
      {priceChartData.length > 0 && (
        <div className="card animate-fade-in" style={{ marginTop: 16, animationDelay: '0.2s' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Historical Prices · {analytics?.price_stats ? `Avg: $${analytics.price_stats.mean.toFixed(2)}/MWh` : ''}
          </div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer>
              <AreaChart data={priceChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={23} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="price" stroke="#f59e0b" fill="rgba(245,158,11,0.1)" strokeWidth={1.5} name="Price $/MWh" />
                {analytics?.price_stats && (
                  <ReferenceLine y={analytics.price_stats.mean} stroke="#6b7280" strokeDasharray="4,4" label={{ value: 'avg', position: 'right', fontSize: 10, fill: '#6b7280' }} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
