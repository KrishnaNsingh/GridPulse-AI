import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Data Field Background — Three.js network visualization.
 * 
 * Implements a dark technical network aesthetic with nodes, flowing
 * connections, and data-pulse animations. Inspired by the ThreeUI
 * data-field visual language. Rendered behind all content.
 */
export function DataFieldBackground() {
  const mountRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!mountRef.current) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // ── Nodes ───────────────────────────────────────────────────────────────
    const NODE_COUNT = 80;
    const nodes: THREE.Vector3[] = [];
    const nodeVelocities: THREE.Vector3[] = [];

    const nodeGeom = new THREE.BufferGeometry();
    const nodePositions = new Float32Array(NODE_COUNT * 3);
    const nodeSizes = new Float32Array(NODE_COUNT);

    for (let i = 0; i < NODE_COUNT; i++) {
      const x = (Math.random() - 0.5) * 14;
      const y = (Math.random() - 0.5) * 8;
      const z = (Math.random() - 0.5) * 4;
      nodes.push(new THREE.Vector3(x, y, z));
      nodeVelocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.003,
        (Math.random() - 0.5) * 0.003,
        (Math.random() - 0.5) * 0.001,
      ));
      nodePositions[i * 3] = x;
      nodePositions[i * 3 + 1] = y;
      nodePositions[i * 3 + 2] = z;
      nodeSizes[i] = Math.random() * 3 + 1;
    }

    nodeGeom.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
    nodeGeom.setAttribute('size', new THREE.BufferAttribute(nodeSizes, 1));

    const nodeMat = new THREE.PointsMaterial({
      color: 0x1e40af,
      size: 0.04,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });

    // Mix blue and cyan nodes
    const nodePointsBlue = new THREE.Points(nodeGeom, nodeMat);
    scene.add(nodePointsBlue);

    // Secondary cyan nodes
    const nodeGeom2 = nodeGeom.clone();
    const nodeMat2 = new THREE.PointsMaterial({
      color: 0x0891b2,
      size: 0.025,
      transparent: true,
      opacity: 0.5,
    });
    const nodePointsCyan = new THREE.Points(nodeGeom2, nodeMat2);
    scene.add(nodePointsCyan);

    // ── Edges ───────────────────────────────────────────────────────────────
    const MAX_DIST = 2.8;
    const edges: { a: number; b: number; progress: number; speed: number }[] = [];
    const lineSegments: THREE.LineSegments[] = [];

    function buildEdges() {
      // Remove old
      lineSegments.forEach(ls => scene.remove(ls));
      lineSegments.length = 0;
      edges.length = 0;

      const positions: number[] = [];
      const colors: number[] = [];

      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const dist = nodes[i].distanceTo(nodes[j]);
          if (dist < MAX_DIST) {
            const alpha = 1 - dist / MAX_DIST;
            edges.push({ a: i, b: j, progress: Math.random(), speed: 0.003 + Math.random() * 0.005 });
            positions.push(
              nodes[i].x, nodes[i].y, nodes[i].z,
              nodes[j].x, nodes[j].y, nodes[j].z,
            );
            const c = 0.05 * alpha;
            colors.push(0.05, 0.1 + c, 0.25 + c * 2, 0.05, 0.1 + c, 0.25 + c * 2);
          }
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
      });

      const ls = new THREE.LineSegments(geom, mat);
      scene.add(ls);
      lineSegments.push(ls);
    }

    buildEdges();

    // ── Data Pulses (moving points along edges) ─────────────────────────────
    const PULSE_COUNT = 30;
    const pulseGeom = new THREE.BufferGeometry();
    const pulsePos = new Float32Array(PULSE_COUNT * 3);
    pulseGeom.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
    const pulseMat = new THREE.PointsMaterial({
      color: 0x06b6d4,
      size: 0.07,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    const pulsePoints = new THREE.Points(pulseGeom, pulseMat);
    scene.add(pulsePoints);

    const pulses = Array.from({ length: PULSE_COUNT }, () => ({
      edgeIdx: Math.floor(Math.random() * Math.max(1, edges.length)),
      progress: Math.random(),
      speed: 0.005 + Math.random() * 0.01,
    }));

    // ── Mouse Parallax ──────────────────────────────────────────────────────
    let mouseX = 0, mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / W - 0.5) * 0.4;
      mouseY = -(e.clientY / H - 0.5) * 0.3;
    };
    window.addEventListener('mousemove', onMouseMove);

    // ── Animate ─────────────────────────────────────────────────────────────
    let rebuildTimer = 0;

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);

      // Move nodes slowly
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes[i].add(nodeVelocities[i]);
        // Wrap
        if (nodes[i].x > 7) nodes[i].x = -7;
        if (nodes[i].x < -7) nodes[i].x = 7;
        if (nodes[i].y > 4) nodes[i].y = -4;
        if (nodes[i].y < -4) nodes[i].y = 4;

        nodePositions[i * 3] = nodes[i].x;
        nodePositions[i * 3 + 1] = nodes[i].y;
        nodePositions[i * 3 + 2] = nodes[i].z;
      }
      nodeGeom.attributes.position.needsUpdate = true;

      // Rebuild edges periodically
      rebuildTimer++;
      if (rebuildTimer > 120) {
        buildEdges();
        rebuildTimer = 0;
        pulses.forEach(p => {
          p.edgeIdx = Math.floor(Math.random() * Math.max(1, edges.length));
        });
      }

      // Animate data pulses
      if (edges.length > 0) {
        pulses.forEach((pulse, pi) => {
          pulse.progress += pulse.speed;
          if (pulse.progress >= 1) {
            pulse.progress = 0;
            pulse.edgeIdx = Math.floor(Math.random() * edges.length);
          }
          const edge = edges[pulse.edgeIdx];
          if (edge) {
            const a = nodes[edge.a];
            const b = nodes[edge.b];
            const t = pulse.progress;
            pulsePos[pi * 3] = a.x + (b.x - a.x) * t;
            pulsePos[pi * 3 + 1] = a.y + (b.y - a.y) * t;
            pulsePos[pi * 3 + 2] = a.z + (b.z - a.z) * t;
          }
        });
        pulseGeom.attributes.position.needsUpdate = true;
      }

      // Parallax camera
      camera.position.x += (mouseX - camera.position.x) * 0.02;
      camera.position.y += (mouseY - camera.position.y) * 0.02;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    animate();

    // ── Resize ──────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw', height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Gradient overlay to ensure readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(7,11,20,0.7) 0%, rgba(7,11,20,0.5) 50%, rgba(7,11,20,0.8) 100%)',
        zIndex: 1,
      }} />
    </div>
  );
}
