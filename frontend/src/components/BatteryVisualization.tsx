import { Battery3D } from './3d/Battery3D';
import type { BatteryState, BatteryConfig } from '../types';

interface BatteryVisualizationProps {
  state: BatteryState;
  config: BatteryConfig;
  size?: 'sm' | 'md' | 'lg';
  height?: number | string;
  showFooter?: boolean;
}

/**
 * BatteryVisualization: Drop-in 3D Battery replacement.
 * Uses Three.js WebGL via `@react-three/fiber` and `@react-three/drei`
 * with floating holographic HUD and synchronized live telemetry.
 */
export function BatteryVisualization({
  state,
  config,
  size = 'md',
  height,
  showFooter = true,
}: BatteryVisualizationProps) {
  return (
    <Battery3D
      state={state}
      config={config}
      size={size}
      height={height}
      showFooter={showFooter}
    />
  );
}

export default BatteryVisualization;
