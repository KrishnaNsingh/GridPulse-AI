import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Center, Float, OrbitControls, Html } from '@react-three/drei';
import { AlertTriangle, Zap, ArrowDown, Radio } from 'lucide-react';
import type { BatteryState, BatteryConfig } from '../../types';

interface Battery3DProps {
  state?: BatteryState;
  config?: BatteryConfig;
  height?: number | string;
  size?: 'sm' | 'md' | 'lg';
  showFooter?: boolean;
}

// Check if WebGL context can currently be initialized
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// Error Boundary for 3D Canvas
class CanvasErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.warn('[Battery3D] Canvas rendering error:', err);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Model component containing GLTF mesh and overhead floating HUD
function BatteryModel({
  soc,
  action,
  topOffset = 0.92,
}: {
  soc: number;
  action: 'charge' | 'discharge' | 'idle';
  topOffset?: number;
}) {
  const { scene } = useGLTF('/model/battery3d.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  const socPct = Math.round(soc * 100);

  // Dynamic status glow styling
  const hudColor = useMemo(() => {
    if (action === 'charge') return { text: '#22d3ee', border: 'rgba(34, 211, 238, 0.5)', glow: 'rgba(34, 211, 238, 0.28)', bg: 'rgba(8, 28, 38, 0.88)' };
    if (action === 'discharge') return { text: '#fb923c', border: 'rgba(251, 146, 60, 0.5)', glow: 'rgba(251, 146, 60, 0.28)', bg: 'rgba(36, 18, 8, 0.88)' };
    if (soc > 0.5) return { text: '#34d399', border: 'rgba(52, 211, 153, 0.5)', glow: 'rgba(52, 211, 153, 0.28)', bg: 'rgba(6, 28, 20, 0.88)' };
    if (soc >= 0.25) return { text: '#fbbf24', border: 'rgba(251, 191, 36, 0.5)', glow: 'rgba(251, 191, 36, 0.28)', bg: 'rgba(32, 24, 8, 0.88)' };
    return { text: '#f87171', border: 'rgba(248, 113, 113, 0.5)', glow: 'rgba(248, 113, 113, 0.28)', bg: 'rgba(36, 10, 10, 0.88)' };
  }, [action, soc]);

  return (
    <group dispose={null}>
      {/* Centered GLTF Battery Model */}
      <Center>
        <primitive object={clonedScene} scale={1.8} dispose={null} />
      </Center>

      {/* Overhead Floating Holographic HUD: strictly above top terminal in positive Y world space */}
      <Html
        position={[0, topOffset, 0]}
        center
        distanceFactor={3.2}
        className="pointer-events-none select-none"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          style={{
            background: hudColor.bg,
            border: `1px solid ${hudColor.border}`,
            boxShadow: `0 0 20px ${hudColor.glow}, 0 4px 16px rgba(0,0,0,0.65)`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 12,
            padding: '6px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            minWidth: 90,
            transform: 'translateZ(0)',
          }}
        >
          {/* Action indicator pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: hudColor.text,
            }}
          >
            {action === 'charge' && <Zap size={11} className="animate-pulse" />}
            {action === 'discharge' && <ArrowDown size={11} className="animate-bounce" />}
            {action === 'idle' && <Radio size={10} />}
            <span>{action}</span>
          </div>

          {/* Live Percentage Readout */}
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 18,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              textShadow: `0 0 10px ${hudColor.text}`,
              lineHeight: 1,
            }}
          >
            {socPct}%
          </div>
        </div>
      </Html>
    </group>
  );
}

// Sleek Cybernetic Fallback if WebGL is unavailable or loading
function BatteryCyberFallback({
  height,
  soc,
  action,
}: {
  height: number | string;
  soc: number;
  action: 'charge' | 'discharge' | 'idle';
}) {
  const socPct = Math.round(soc * 100);
  const color =
    action === 'charge' ? '#06b6d4' :
      action === 'discharge' ? '#f97316' :
        soc > 0.5 ? '#10b981' : soc >= 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        height,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, rgba(14, 23, 42, 0.8) 0%, rgba(6, 10, 19, 0.95) 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Floating Overhead Holographic HUD Readout */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          background: 'rgba(8, 18, 30, 0.85)',
          border: `1px solid ${color}55`,
          boxShadow: `0 0 16px ${color}33`,
          backdropFilter: 'blur(8px)',
          borderRadius: 10,
          padding: '4px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {action}
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: 'monospace', textShadow: `0 0 8px ${color}` }}>
          {socPct}%
        </span>
      </div>

      {/* Cybernetic Battery Chassis */}
      <div
        style={{
          marginTop: 26,
          width: 76,
          height: 125,
          borderRadius: 10,
          border: `2px solid ${color}66`,
          background: 'rgba(11, 20, 35, 0.8)',
          boxShadow: `0 0 25px ${color}22, inset 0 0 15px rgba(0,0,0,0.7)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: 4,
          position: 'relative',
        }}
      >
        {/* Terminal Top Cap */}
        <div
          style={{
            position: 'absolute',
            top: -7,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 24,
            height: 6,
            borderRadius: '3px 3px 0 0',
            background: `${color}aa`,
            boxShadow: `0 0 8px ${color}88`,
          }}
        />

        {/* Dynamic Fluid Charge Level */}
        <div
          style={{
            width: '100%',
            height: `${Math.max(4, Math.min(100, socPct))}%`,
            borderRadius: 6,
            background: `linear-gradient(180deg, ${color}dd 0%, ${color}77 100%)`,
            boxShadow: `0 0 12px ${color}66`,
            transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Internal energy pulse scanline */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
              animation: 'pulse 1.5s infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function Battery3D({
  state,
  config,
  height,
  size = 'md',
  showFooter = true,
}: Battery3DProps) {
  const [hasWebGL, setHasWebGL] = useState(true);

  // Check WebGL availability on mount
  useEffect(() => {
    setHasWebGL(isWebGLAvailable());
  }, []);

  // Derive normalized state metrics
  const soc = Math.max(0, Math.min(1, state?.soc ?? config?.soc_initial ?? 0.5));
  const action = state?.action ?? 'idle';
  const capacityMwh = config?.capacity_mwh ?? 10.0;
  const currentEnergyMwh = (soc * capacityMwh).toFixed(2);
  const socMin = config?.soc_min ?? 0.1;
  const isCritical = soc < (socMin + 0.05);

  const canvasHeight = height ?? (size === 'lg' ? 350 : size === 'sm' ? 180 : 350);

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* 3D WebGL Canvas Container */}
      <div
        style={{
          width: '100%',
          height: canvasHeight,
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'radial-gradient(circle at center, rgba(14, 23, 42, 0.75) 0%, rgba(6, 10, 19, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.6)',
        }}
      >
        <CanvasErrorBoundary fallback={<BatteryCyberFallback height={canvasHeight} soc={soc} action={action} />}>
          {hasWebGL ? (
            <Suspense fallback={<BatteryCyberFallback height={canvasHeight} soc={soc} action={action} />}>
              <Canvas
                camera={{ position: [0, 0.12, 3.65], fov: 45, near: 0.1, far: 1000 }}
                gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
                dpr={1}
                style={{ width: '100%', height: '100%' }}
              >
                {/* PBR Lighting Setup matching industrial dark palette */}
                <ambientLight intensity={1.5} />
                <directionalLight position={[5, 8, 5]} intensity={2.0} />
                <directionalLight position={[-5, -2, -5]} intensity={1.2} color="#06b6d4" />
                <pointLight position={[0, -2, 2]} intensity={0.8} color="#10b981" />

                {/* Subtle Float Animation with dampened user orbit controls */}
                <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
                  <BatteryModel soc={soc} action={action} topOffset={0.92} />
                </Float>

                <OrbitControls
                  enableZoom={false}
                  enablePan={false}
                  maxPolarAngle={Math.PI / 2 + 0.2}
                  minPolarAngle={Math.PI / 3}
                  autoRotate
                  autoRotateSpeed={0.8}
                />
              </Canvas>
            </Suspense>
          ) : (
            <BatteryCyberFallback height={canvasHeight} soc={soc} action={action} />
          )}
        </CanvasErrorBoundary>

        {/* Warning Badge if near critical min SoC */}
        {isCritical && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.6)',
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(239, 68, 68, 0.5)',
              zIndex: 3,
            }}
            title="Battery near minimum SoC threshold"
          >
            <AlertTriangle size={13} color="#ef4444" />
          </div>
        )}
      </div>

      {/* Live Telemetry Metrics Footer below Canvas */}
      {showFooter && (
        <div
          style={{
            marginTop: 12,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 4,
          }}
        >
          {/* Status Badge */}
          <div className={`badge badge-${action === 'charge' ? 'charging' : action === 'discharge' ? 'discharging' : 'idle'}`}>
            {action === 'charge' ? '⚡ Charging' : action === 'discharge' ? '↓ Discharging' : '◎ Idle'}
          </div>

          {/* Stored Energy / Total Capacity */}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {currentEnergyMwh} / {capacityMwh} MWh
          </div>

          {/* Active Flow Power */}
          {state && state.charge_power_mw > 0 && (
            <div style={{ fontSize: 11, color: '#06b6d4', fontWeight: 600 }}>
              +{state.charge_power_mw.toFixed(2)} MW Active Charge
            </div>
          )}
          {state && state.discharge_power_mw > 0 && (
            <div style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>
              -{state.discharge_power_mw.toFixed(2)} MW Active Discharge
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Preload 3D asset into memory
useGLTF.preload('/model/battery3d.glb');

export default Battery3D;
