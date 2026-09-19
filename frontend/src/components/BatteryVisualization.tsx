import { motion } from 'framer-motion';
import { Zap, Battery, BatteryCharging, AlertTriangle } from 'lucide-react';
import type { BatteryState, BatteryConfig } from '../types';

interface BatteryVisualizationProps {
  state: BatteryState;
  config: BatteryConfig;
  size?: 'sm' | 'md' | 'lg';
}

export function BatteryVisualization({ state, config, size = 'md' }: BatteryVisualizationProps) {
  const soc = Math.max(0, Math.min(1, state.soc));
  const socPct = Math.round(soc * 100);

  const dims = {
    sm: { w: 80, h: 160, rx: 8 },
    md: { w: 120, h: 240, rx: 12 },
    lg: { w: 160, h: 320, rx: 16 },
  }[size];

  const fillH = Math.round((dims.h - 20) * soc);
  const fillY = dims.h - 10 - fillH;

  const fillColor =
    state.action === 'charge' ? '#06b6d4' :
    state.action === 'discharge' ? '#f97316' :
    soc > 0.5 ? '#10b981' : soc > 0.25 ? '#f59e0b' : '#ef4444';

  const isCritical = soc < (config.soc_min + 0.05);
  const isNearFull = soc > (config.soc_max - 0.05);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Battery SVG */}
      <div style={{ position: 'relative' }}>
        <svg width={dims.w} height={dims.h + 20} style={{ overflow: 'visible' }}>
          {/* Battery terminal cap */}
          <rect
            x={dims.w * 0.3}
            y={0}
            width={dims.w * 0.4}
            height={10}
            rx={3}
            fill="rgba(100,120,160,0.5)"
          />

          {/* Battery body outline */}
          <rect
            x={0}
            y={10}
            width={dims.w}
            height={dims.h}
            rx={dims.rx}
            fill="rgba(13, 19, 32, 0.9)"
            stroke={isCritical ? '#ef4444' : state.action === 'charge' ? '#06b6d4' : 'rgba(31,45,69,0.9)'}
            strokeWidth={isCritical || state.action === 'charge' ? 2 : 1}
          />

          {/* SoC tick marks */}
          {[0.25, 0.5, 0.75].map(tick => {
            const ty = 10 + (dims.h - 20) * (1 - tick) + 10;
            return (
              <line
                key={tick}
                x1={8} y1={ty} x2={dims.w - 8} y2={ty}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            );
          })}

          {/* Fill level */}
          <clipPath id={`battery-clip-${size}`}>
            <rect x={4} y={14} width={dims.w - 8} height={dims.h - 8} rx={dims.rx - 2} />
          </clipPath>

          <motion.rect
            x={4}
            y={14}
            width={dims.w - 8}
            height={dims.h - 8}
            rx={dims.rx - 2}
            fill="rgba(13, 19, 32, 0.3)"
          />

          <motion.rect
            x={4}
            y={14 + (dims.h - 8) * (1 - soc)}
            width={dims.w - 8}
            height={(dims.h - 8) * soc}
            rx={0}
            fill={fillColor}
            opacity={0.85}
            animate={{ height: (dims.h - 8) * soc, y: 14 + (dims.h - 8) * (1 - soc) }}
            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
            clipPath={`url(#battery-clip-${size})`}
          />

          {/* Glow overlay for charging */}
          {state.action === 'charge' && (
            <motion.rect
              x={4}
              y={14}
              width={dims.w - 8}
              height={dims.h - 8}
              rx={dims.rx - 2}
              fill="transparent"
              stroke="#06b6d4"
              strokeWidth={2}
              opacity={0}
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          )}

          {/* SoC percentage text */}
          <text
            x={dims.w / 2}
            y={10 + dims.h / 2 + 8}
            textAnchor="middle"
            fill="white"
            fontSize={size === 'lg' ? 28 : size === 'md' ? 20 : 14}
            fontWeight="700"
            fontFamily="monospace"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
          >
            {socPct}%
          </text>

          {/* Action icon */}
          {state.action === 'charge' && (
            <text x={dims.w / 2} y={10 + dims.h / 2 - 16} textAnchor="middle" fontSize={16} fill="#06b6d4">⚡</text>
          )}
          {state.action === 'discharge' && (
            <text x={dims.w / 2} y={10 + dims.h / 2 - 16} textAnchor="middle" fontSize={16} fill="#f97316">▼</text>
          )}

          {/* Min/Max SoC lines */}
          {(() => {
            const minY = 14 + (dims.h - 8) * (1 - config.soc_min);
            const maxY = 14 + (dims.h - 8) * (1 - config.soc_max);
            return (
              <>
                <line x1={4} y1={minY} x2={dims.w - 4} y2={minY} stroke="#ef444466" strokeWidth={1} strokeDasharray="4,2" />
                <line x1={4} y1={maxY} x2={dims.w - 4} y2={maxY} stroke="#22d3ee44" strokeWidth={1} strokeDasharray="4,2" />
              </>
            );
          })()}
        </svg>

        {/* Warning badge */}
        {isCritical && (
          <div style={{
            position: 'absolute', top: 16, right: -8,
            background: '#ef4444',
            borderRadius: '50%', width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={10} color="white" />
          </div>
        )}
      </div>

      {/* Status label */}
      <div style={{ textAlign: 'center' }}>
        <div className={`badge badge-${state.action === 'charge' ? 'charging' : state.action === 'discharge' ? 'discharging' : 'idle'}`}>
          {state.action === 'charge' ? '⚡ Charging' :
           state.action === 'discharge' ? '↓ Discharging' : '◎ Idle'}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          {(soc * config.capacity_mwh).toFixed(1)} / {config.capacity_mwh} MWh
        </div>
        {state.charge_power_mw > 0 && (
          <div style={{ fontSize: 11, color: '#06b6d4', marginTop: 2 }}>
            +{state.charge_power_mw.toFixed(2)} MW
          </div>
        )}
        {state.discharge_power_mw > 0 && (
          <div style={{ fontSize: 11, color: '#f97316', marginTop: 2 }}>
            -{state.discharge_power_mw.toFixed(2)} MW
          </div>
        )}
      </div>
    </div>
  );
}
