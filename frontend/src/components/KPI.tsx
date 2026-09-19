import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPIProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
  icon?: ReactNode;
  subtext?: string;
  loading?: boolean;
}

export function KPI({ label, value, unit, trend, trendValue, color, icon, subtext, loading }: KPIProps) {
  const trendColors = {
    up: 'var(--accent-green)',
    down: 'var(--accent-red)',
    neutral: 'var(--text-muted)',
  };

  return (
    <div className="card" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
      {/* Subtle top accent */}
      {color && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: color, opacity: 0.8,
        }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        {icon && <span style={{ color: color || 'var(--text-muted)', opacity: 0.8 }}>{icon}</span>}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 28, width: '60%', marginBottom: 4 }} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)',
            letterSpacing: '-0.02em', fontFamily: 'monospace',
          }}>
            {typeof value === 'number' ? (
              Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2)
            ) : value}
          </span>
          {unit && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{unit}</span>}
        </div>
      )}

      {(trend || subtext) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          {trend && (
            <>
              {trend === 'up' && <TrendingUp size={12} color={trendColors.up} />}
              {trend === 'down' && <TrendingDown size={12} color={trendColors.down} />}
              {trend === 'neutral' && <Minus size={12} color={trendColors.neutral} />}
              {trendValue && (
                <span style={{ fontSize: 11, color: trendColors[trend], fontWeight: 500 }}>
                  {trendValue}
                </span>
              )}
            </>
          )}
          {subtext && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtext}</span>}
        </div>
      )}
    </div>
  );
}
