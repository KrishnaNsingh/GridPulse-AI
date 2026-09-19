import { useEffect, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { RefreshCw, Upload, FileText, TrendingUp, Zap } from 'lucide-react';
import { KPI } from '../components/KPI';
import { getAnalyticsSummary, getPriceHistory, uploadPrices, generateForecast } from '../services/api';
import type { AnalyticsSummary, PriceHistoryResponse, ForecastResponse } from '../types';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <strong style={{ color: 'var(--text-primary)' }}>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'prices' | 'forecast' | 'runs'>('prices');

  const load = async () => {
    setLoading(true);
    try {
      const [ana, ph] = await Promise.all([getAnalyticsSummary(), getPriceHistory(336)]);
      setAnalytics(ana);
      setPriceHistory(ph);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const runForecast = async () => {
    setGenerating(true);
    try {
      const fc = await generateForecast(24, true);
      setForecast(fc);
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  useEffect(() => { load(); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await uploadPrices(file, 'default');
      setUploadMsg(`✓ Imported ${res.records_imported} records${res.errors.length ? ` (${res.errors.length} warnings)` : ''}`);
      await load();
    } catch (err: any) {
      setUploadMsg(`✗ ${err?.response?.data?.detail || err?.message || 'Upload failed'}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Price chart data
  const priceChartData = priceHistory?.prices?.slice(-168).map(p => ({
    time: new Date(p.timestamp).toLocaleString('en', { weekday: 'short', hour: '2-digit' }),
    price: p.price,
  })) || [];

  // Hour-of-day profile
  const hodProfile = (() => {
    if (!priceHistory?.prices?.length) return [];
    const buckets: { sum: number; count: number }[] = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }));
    priceHistory.prices.forEach(p => {
      const h = new Date(p.timestamp).getHours();
      buckets[h].sum += p.price;
      buckets[h].count += 1;
    });
    return buckets.map((b, h) => ({
      hour: `${h.toString().padStart(2, '0')}:00`,
      avgPrice: b.count > 0 ? +(b.sum / b.count).toFixed(2) : 0,
    }));
  })();

  // Forecast chart
  const forecastChartData = (forecast?.forecasts || analytics?.latest_forecast || []).map(f => ({
    time: new Date(f.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    p10: (f as any).p10,
    p50: (f as any).p50,
    p90: (f as any).p90,
  }));

  // Profit history
  const profitHistory = analytics?.profit_history?.map(r => ({
    run: `#${r.run_id}`,
    profit: r.net_profit,
    revenue: r.revenue,
    degradation: r.degradation_cost,
    runtime: r.runtime_seconds,
  })) || [];

  return (
    <div style={{ padding: '80px 24px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div className="page-header animate-fade-in" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Historical prices · Forecasts · Optimization run history</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* CSV Upload */}
            <label style={{ margin: 0 }}>
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} id="csv-upload-input" />
              <span className="btn-secondary" style={{ cursor: 'pointer' }}>
                {uploading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</> : <><Upload size={14} /> Upload CSV</>}
              </span>
            </label>
            <button className="btn-secondary" onClick={runForecast} disabled={generating} id="generate-forecast-btn">
              {generating ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Forecasting…</> : <><Zap size={14} /> Generate Forecast</>}
            </button>
            <button className="btn-ghost" onClick={load} disabled={loading} id="refresh-analytics-btn">
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
          </div>
        </div>
      </div>

      {/* Upload Notification */}
      {uploadMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: uploadMsg.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${uploadMsg.startsWith('✓') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: uploadMsg.startsWith('✓') ? '#10b981' : '#ef4444',
        }}>
          {uploadMsg}
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid animate-fade-in" style={{ marginBottom: 16 }}>
        <KPI label="Price Records" value={analytics?.price_records || 0} color="var(--accent-cyan)" loading={loading} />
        <KPI label="Min Price" value={analytics?.price_stats?.min || 0} unit="$/MWh" color="var(--accent-green)" loading={loading} />
        <KPI label="Max Price" value={analytics?.price_stats?.max || 0} unit="$/MWh" color="var(--accent-red)" loading={loading} />
        <KPI label="Avg Price" value={analytics?.price_stats?.mean || 0} unit="$/MWh" color="var(--accent-amber)" loading={loading} />
        <KPI label="Optimization Runs" value={analytics?.optimization_runs || 0} color="var(--accent-blue)" loading={loading} />
        <KPI label="Simulation Runs" value={analytics?.simulation_runs || 0} color="var(--accent-purple)" loading={loading} />
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 16, display: 'inline-flex' }}>
        {['prices', 'forecast', 'runs'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t as any)}>
            {t === 'prices' ? '💰 Prices' : t === 'forecast' ? '📈 Forecast' : '📊 Runs'}
          </button>
        ))}
      </div>

      {activeTab === 'prices' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Price History */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
              Historical Prices (last 7 days)
              {analytics?.price_stats && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                Avg: ${analytics.price_stats.mean.toFixed(2)}/MWh
              </span>}
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={priceChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={23} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  {analytics?.price_stats && <ReferenceLine y={analytics.price_stats.mean} stroke="#6b7280" strokeDasharray="4,3" />}
                  <Area type="monotone" dataKey="price" stroke="#f59e0b" fill="rgba(245,158,11,0.12)" strokeWidth={1.5} name="Price $/MWh" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hour-of-Day Profile */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Average Price by Hour of Day</div>
            <div style={{ height: 170 }}>
              <ResponsiveContainer>
                <BarChart data={hodProfile} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  {analytics?.price_stats && <ReferenceLine y={analytics.price_stats.mean} stroke="#6b7280" strokeDasharray="3,3" />}
                  <Bar dataKey="avgPrice" name="Avg Price $/MWh" fill="#f59e0b" opacity={0.8} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CSV Format hint */}
          <div className="card" style={{ background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.2)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <FileText size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', marginBottom: 6 }}>CSV Upload Format</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  timestamp,price<br />
                  2024-01-01 00:00:00,45.23<br />
                  2024-01-01 01:00:00,38.10<br />
                  <span style={{ color: 'var(--text-muted)' }}>...</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Prices in $/MWh · Timestamps in any parseable format · Duplicates are deduplicated
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="animate-fade-in">
          {forecastChartData.length > 0 ? (
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                24h Ahead Forecast — P10 / P50 / P90
              </div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <AreaChart data={forecastChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={3} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="p90" stroke="none" fill="rgba(59,130,246,0.06)" name="P90 $/MWh" />
                    <Area type="monotone" dataKey="p50" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" strokeWidth={2.5} name="P50 $/MWh" />
                    <Area type="monotone" dataKey="p10" stroke="none" fill="rgba(7,11,20,1)" name="P10 $/MWh" />
                    <Line type="monotone" dataKey="p90" stroke="#3b82f666" strokeWidth={1} dot={false} name="P90" strokeDasharray="3,3" />
                    <Line type="monotone" dataKey="p10" stroke="#3b82f666" strokeWidth={1} dot={false} name="P10" strokeDasharray="3,3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {forecast && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                  <span>Model: <strong style={{ color: 'var(--text-secondary)' }}>{forecast.model_type}</strong></span>
                  <span>Horizon: <strong style={{ color: 'var(--text-secondary)' }}>{forecast.horizon_hours}h</strong></span>
                  <span>Points: <strong style={{ color: 'var(--text-secondary)' }}>{forecast.forecasts.length}</strong></span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
              No forecast available. Click "Generate Forecast" to create one.
            </div>
          )}
        </div>
      )}

      {activeTab === 'runs' && (
        <div className="animate-fade-in">
          {profitHistory.length > 0 ? (
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Optimization Run History</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={profitHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="run" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Bar dataKey="revenue" name="Revenue $" fill="#3b82f6" opacity={0.7} stackId="a" />
                    <Bar dataKey="profit" name="Net Profit $" fill="#10b981" opacity={0.9} />
                    <Bar dataKey="degradation" name="Degradation $" fill="#f59e0b" opacity={0.7} stackId="b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Run', 'Net Profit', 'Revenue', 'Degradation', 'Runtime'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profitHistory.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>{r.run}</td>
                        <td style={{ padding: '5px 10px', color: r.profit >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontWeight: 600 }}>${r.profit.toFixed(2)}</td>
                        <td style={{ padding: '5px 10px', color: '#3b82f6', fontFamily: 'monospace' }}>${r.revenue.toFixed(2)}</td>
                        <td style={{ padding: '5px 10px', color: '#f59e0b', fontFamily: 'monospace' }}>${r.degradation.toFixed(2)}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.runtime.toFixed(3)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
              No optimization runs yet. Go to the Optimizer page to run one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
