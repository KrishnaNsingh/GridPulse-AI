import React from 'react';

/**
 * GridPulse AI Ambient Telemetry Background
 * High-performance SVG harmonic wave field visualizing grid data flow.
 * Uses zero WebGL contexts so all GPU resources are dedicated to 3D models.
 */

export interface DataFieldProps {
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function DataFieldBackground({
  hue = 0,
  saturation = 1.0,
  brightness = 1.0,
}: DataFieldProps) {
  const filter = hue === 0 && saturation === 1 && brightness === 1
    ? undefined
    : `hue-rotate(${hue}deg) saturate(${saturation}) brightness(${brightness})`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        backgroundColor: '#070b13',
        filter,
      }}
    >
      {/* Ambient Dark Mesh Ground */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 20%, rgba(14, 28, 48, 0.45) 0%, rgba(7, 11, 19, 0.95) 75%)',
        }}
      >
        {/* Subtle SVG Harmonic Data Flow Grid */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.18,
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
            </linearGradient>
            <pattern id="telemetryGrid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(200, 220, 255, 0.04)" strokeWidth="1" />
              <circle cx="0" cy="0" r="1" fill="rgba(56, 189, 248, 0.15)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#telemetryGrid)" />
          
          {/* Subtle curved telemetry streamlines */}
          <path
            d="M-100 200 C 300 100, 700 350, 1200 200 S 1800 150, 2200 280"
            fill="none"
            stroke="url(#gridGrad)"
            strokeWidth="1.2"
            strokeDasharray="6,8"
          />
          <path
            d="M-100 380 C 400 280, 800 480, 1300 340 S 1900 260, 2300 420"
            fill="none"
            stroke="url(#gridGrad)"
            strokeWidth="1"
            strokeDasharray="4,12"
            opacity="0.6"
          />
          <path
            d="M-100 550 C 350 480, 750 620, 1250 510 S 1850 420, 2250 580"
            fill="none"
            stroke="url(#gridGrad)"
            strokeWidth="0.8"
            opacity="0.4"
          />
        </svg>

        {/* Global Subtle Grain Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
            opacity: 0.25,
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 12px)',
          }}
        />

        {/* Corner Accents */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTop: '1px solid rgba(56,189,248,0.2)', borderLeft: '1px solid rgba(56,189,248,0.2)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTop: '1px solid rgba(56,189,248,0.2)', borderRight: '1px solid rgba(56,189,248,0.2)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottom: '1px solid rgba(56,189,248,0.2)', borderLeft: '1px solid rgba(56,189,248,0.2)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderBottom: '1px solid rgba(56,189,248,0.2)', borderRight: '1px solid rgba(56,189,248,0.2)', pointerEvents: 'none' }} />

        {/* Content Readability Gradient to keep foreground UI crisp */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(7,11,20,0.7) 0%, rgba(7,11,20,0.3) 50%, rgba(7,11,20,0.85) 100%)',
          }}
        />
      </div>
    </div>
  );
}

export function StructureFlowCollection({
  variant = 'data-field',
  hue = 0,
  saturation = 1.0,
  brightness = 1.0,
  ...props
}: {
  variant?: 'data-field' | string;
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <DataFieldBackground hue={hue} saturation={saturation} brightness={brightness} {...props} />;
}

export default DataFieldBackground;
