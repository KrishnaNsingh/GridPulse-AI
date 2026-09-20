import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * StructureFlowCollection — Data Field (`data-field`)
 * 
 * Replicates the Three.js flowing silk/water wave field from Vertex 9 Global Data
 * (runtime Three.js r128–r160, SHA-256 40eb5bac81e3).
 *
 * Exact specifications:
 * - Camera: PerspectiveCamera(55, aspect, 0.1, 100), position (0, -2, 9)
 * - Group rotation: rotation.x = PI / 3, rotation.z = -PI / 8
 * - Lines: 60 lines, 100 points per line, spacing x: 0.22, y: 0.2
 * - Palette: Warm neutrals lerped from #D1C5B4 to #7A7B76, additive blending
 * - Motion: Smooth dual-harmonic wave: sin(y*1.2 + time + x*0.8)*0.8 + cos(x*1.5 - time*0.8 + y*0.5)*0.6
 * - Lighting: Inner depth shadow vignette (inset 0 0 120px rgba(14, 16, 15, 0.9))
 * - Texture: 45deg subtle diagonal grain (repeating-linear-gradient rgba(200,185,160,0.05))
 * - Background ground: #0E100F / #121413 ambient dark canvas
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
  const mountRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera Setup (exact framing: 55 fov, position (0, -2, 9))
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, -2, 9);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Group with exact orientation tilt
    const group = new THREE.Group();
    scene.add(group);

    const numLines = 60;
    const pointsPerLine = 100;

    // Warm neutrals: #D1C5B4 to #7A7B76
    const colorStart = new THREE.Color('#D1C5B4');
    const colorEnd = new THREE.Color('#7A7B76');

    for (let i = 0; i < numLines; i++) {
      const points: THREE.Vector3[] = [];
      const xPos = (i - numLines / 2) * 0.22;
      for (let j = 0; j < pointsPerLine; j++) {
        const yPos = (j - pointsPerLine / 2) * 0.2;
        points.push(new THREE.Vector3(xPos, yPos, 0));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      const color = new THREE.Color().lerpColors(colorStart, colorEnd, i / numLines);

      const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.12 + Math.random() * 0.22,
        blending: THREE.AdditiveBlending,
      });

      const line = new THREE.Line(geometry, material);
      group.add(line);
    }

    // Tilt to create the signature flowing plane
    group.rotation.x = Math.PI / 3;
    group.rotation.z = -Math.PI / 8;

    const clock = new THREE.Clock();

    // 4. Animation loop: flowing waves of silk/water
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      const time = clock.getElapsedTime() * 0.4; // relaxed, elegant pace

      group.children.forEach((child) => {
        const line = child as THREE.Line;
        const positions = line.geometry.attributes.position.array as Float32Array;

        for (let j = 0; j < pointsPerLine; j++) {
          const idx = j * 3;
          const x = positions[idx];
          const y = positions[idx + 1];

          // Rolling waves reminiscent of silk or fluid
          const wave1 = Math.sin(y * 1.2 + time + x * 0.8) * 0.8;
          const wave2 = Math.cos(x * 1.5 - time * 0.8 + y * 0.5) * 0.6;

          positions[idx + 2] = wave1 + wave2;
        }
        line.geometry.attributes.position.needsUpdate = true;
      });

      renderer.render(scene, camera);
    };

    animate();

    // 5. Responsive Resize
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

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
        backgroundColor: '#0E100F',
        filter,
      }}
    >
      {/* Panel 2 Ambient Dark Ground */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#121413',
        }}
      >
        {/* Three.js Canvas container for flowing silk waves */}
        <div
          ref={mountRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* Inner Depth Shadows from reference */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: 'inset 0 0 140px rgba(14, 16, 15, 0.92)',
          }}
        />

        {/* Global Subtle Grain/Texture Overlay from reference */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
            opacity: 0.3,
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(200,185,160,0.05) 0px, rgba(200,185,160,0.05) 1px, transparent 1px, transparent 12px)',
          }}
        />

        {/* Corner Accents from reference */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTop: '1px solid rgba(200,185,160,0.3)', borderLeft: '1px solid rgba(200,185,160,0.3)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTop: '1px solid rgba(200,185,160,0.3)', borderRight: '1px solid rgba(200,185,160,0.3)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottom: '1px solid rgba(200,185,160,0.3)', borderLeft: '1px solid rgba(200,185,160,0.3)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderBottom: '1px solid rgba(200,185,160,0.3)', borderRight: '1px solid rgba(200,185,160,0.3)', pointerEvents: 'none' }} />

        {/* Content Readability Gradient to keep foreground UI crisp */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(7,11,20,0.72) 0%, rgba(7,11,20,0.45) 50%, rgba(7,11,20,0.85) 100%)',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Compatible alias matching `@designcodeio/threeui`
 */
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
  if (variant === 'data-field') {
    return <DataFieldBackground hue={hue} saturation={saturation} brightness={brightness} {...props} />;
  }
  return <DataFieldBackground hue={hue} saturation={saturation} brightness={brightness} {...props} />;
}

export default DataFieldBackground;
