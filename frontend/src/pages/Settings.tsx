import { useState, useEffect } from 'react';
import { getBatteryConfig, saveBatteryConfig } from '../services/api';
import type { BatteryConfig } from '../types';
import { Save, RefreshCw, Info } from 'lucide-react';
import { KineticTextLoader } from '@/components/ui/kinetic-text-loader';
import { Preloader } from '@/components/Preloader';

const DEFAULT: BatteryConfig = {
  name: 'My BESS', capacity_mwh: 10, power_mw: 2.5,
  efficiency_charge: 0.95, efficiency_discharge: 0.95,
  soc_min: 0.1, soc_max: 0.9, soc_initial: 0.5,
  degradation_cost_per_mwh: 5, reserve_level: 0,
};

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {label}
        {desc && <span title={desc} style={{ cursor: 'help', color: 'var(--text-muted)' }}><Info size={12} /></span>}
      </label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState<BatteryConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewPreloader, setPreviewPreloader] = useState(false);

  useEffect(() => {
    getBatteryConfig().then(c => { setConfig(c); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveBatteryConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const num = (key: keyof BatteryConfig, step = 0.01, min = 0, max = 10000, unit = '') => (
    <Field key={key} label={`${key.toString().replace(/_/g, ' ')}${unit ? ` (${unit})` : ''}`}>
      <input
        type="number"
        className="input"
        step={step}
        min={min}
        max={max}
        value={config[key] as number}
        onChange={e => setConfig({ ...config, [key]: parseFloat(e.target.value) || 0 })}
      />
    </Field>
  );

  if (loading) return (
    <div style={{ padding: '80px 24px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading configuration…
    </div>
  );

  return (
    <div style={{ padding: '80px 24px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header animate-fade-in" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Battery configuration · Saved to database · Used by all optimization runs</p>
          </div>
          <button className="btn-primary" onClick={save} disabled={saving} id="save-config-btn">
            {saving ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> :
              saved ? '✓ Saved' : <><Save size={14} /> Save Config</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Physical Parameters */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Physical Parameters</div>
          <Field label="Battery Name">
            <input className="input" value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })} />
          </Field>
          {num('capacity_mwh', 0.5, 0.1, 10000, 'MWh')}
          {num('power_mw', 0.1, 0.01, 5000, 'MW')}
          {num('efficiency_charge', 0.01, 0.01, 1)}
          {num('efficiency_discharge', 0.01, 0.01, 1)}
        </div>

        {/* SoC Parameters */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>State of Charge Limits</div>
          {num('soc_min', 0.01, 0, 0.5)}
          {num('soc_max', 0.01, 0.5, 1)}
          {num('soc_initial', 0.01, 0, 1)}
          <Field label="soc_terminal" desc="Optional minimum terminal SoC">
            <input
              type="number"
              className="input"
              step={0.01} min={0} max={1}
              value={config.soc_terminal ?? ''}
              placeholder="Optional"
              onChange={e => setConfig({ ...config, soc_terminal: e.target.value === '' ? null : parseFloat(e.target.value) })}
            />
          </Field>
          {num('reserve_level', 0.01, 0, 0.5)}
        </div>

        {/* Economics */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Economic Parameters</div>
          <Field label="Degradation Cost ($/MWh)" desc="Cost per MWh of energy discharged. Higher values discourage deep cycling.">
            <input type="number" className="input" step={0.5} min={0} max={1000} value={config.degradation_cost_per_mwh}
              onChange={e => setConfig({ ...config, degradation_cost_per_mwh: parseFloat(e.target.value) || 0 })} />
          </Field>
          <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ color: '#3b82f6', fontWeight: 600, marginBottom: 6 }}>Degradation Tier Model</div>
            <div>• 0–40% DoD: 1× base cost</div>
            <div>• 40–60% DoD: 1.5× base cost</div>
            <div>• 60–80% DoD: 2.5× base cost</div>
            <div>• 80–90% DoD: 4× base cost</div>
            <div>• 90–100% DoD: 8× base cost</div>
          </div>
        </div>

        {/* Live Summary */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Configuration Summary</div>
          {[
            ['Capacity', `${config.capacity_mwh} MWh`],
            ['Power', `${config.power_mw} MW (C-rate: ${(config.power_mw / config.capacity_mwh).toFixed(2)})`],
            ['Round-trip Efficiency', `${(config.efficiency_charge * config.efficiency_discharge * 100).toFixed(1)}%`],
            ['Usable Capacity', `${((config.soc_max - config.soc_min) * config.capacity_mwh).toFixed(2)} MWh`],
            ['Max Cycles/Day', `${(config.power_mw * 24 / config.capacity_mwh / 2).toFixed(1)} (theoretical)`],
            ['Initial Energy', `${(config.soc_initial * config.capacity_mwh).toFixed(2)} MWh`],
            ['Degradation Cost', `$${config.degradation_cost_per_mwh}/MWh discharged`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{k}</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Kinetic Loader & Preloader Showcase */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Kinetic Text Loader & Preloader</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Physics-driven letter and dot animation with telemetry initialization</div>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPreviewPreloader(true)}
            id="preview-preloader-btn"
            style={{ fontSize: 12, padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={13} />
            Preview Fullscreen Preloader
          </button>
        </div>

        <div
          style={{
            padding: '36px 16px',
            borderRadius: 8,
            backgroundColor: 'rgba(7, 11, 20, 0.75)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 180,
          }}
        >
          <KineticTextLoader text="Loading" />
        </div>
      </div>

      {/* Fullscreen Preloader Preview */}
      <Preloader isLoading={previewPreloader} onComplete={() => setPreviewPreloader(false)} />
    </div>
  );
}
