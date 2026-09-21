import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, TrendingUp, Activity, Shield, Bot, Zap, Sparkles, Sliders, Eye, RotateCw, Play, Pause } from 'lucide-react';

export interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  badge?: string;
}

interface RisoSweepSectionProps {
  features: FeatureItem[];
}

export const RisoSweepSection: React.FC<RisoSweepSectionProps> = ({ features }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // User controls
  const [preset, setPreset] = useState<'gridpulse' | 'grainient'>('gridpulse');
  const [motionMode, setMotionMode] = useState<'auto' | 'hover'>('auto');
  const [viewMode, setViewMode] = useState<'unified' | 'orbit' | 'cards'>('unified');
  const [activeFeatureIdx, setActiveFeatureIdx] = useState<number>(0);
  const [headlineScale, setHeadlineScale] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // References for animation state
  const stateRef = useRef({
    preset: 'gridpulse',
    motionMode: 'auto',
    headlineScale: 1.0,
    isPlaying: true,
    targetPsi: 0,
    currentSpin: 0,
    userOffset: 0,
    isHovered: false,
    isDragging: false,
    lastPointerX: 0,
    dragVelocity: 0,
    tNow: 0,
    lastFrameTime: performance.now(),
  });

  const rebuildLayersRef = useRef<(() => void) | null>(null);

  // Sync state ref
  useEffect(() => {
    stateRef.current.preset = preset;
    stateRef.current.motionMode = motionMode;
    stateRef.current.headlineScale = headlineScale;
    stateRef.current.isPlaying = isPlaying;
    rebuildLayersRef.current?.();
  }, [preset, motionMode, headlineScale, isPlaying]);

  // Main Canvas 2D engine
  useEffect(() => {
    const cv = canvasRef.current;
    const container = containerRef.current;
    if (!cv || !container) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    /* Design frame: 2962 x 2160 */
    const DW = 2962;
    const DH = 2160;
    const DASP = DW / DH;

    const RING = {
      cx: 1484,
      cy: 1080, // Centered in design frame
      a: 740,
      ratio: 0.492,
      axis: 25.5,
      n: 12,
      tile: 360,
      radius: 0.22,
      dist: 13,
      phase: 93,
    };

    const DUR = 15.015; /* 15.015s full seamless revolution */
    const CAP = 150;
    const SMALL = 22;
    const SANS = '"Inter","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif';

    // PRNG
    function rng(seed: number) {
      let s = seed >>> 0;
      return function () {
        s ^= s << 13;
        s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5;
        s >>>= 0;
        return s / 4294967296;
      };
    }

    function mkc(w: number, h: number) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }

    const TS = 512;

    // Film grain tile
    const grainTile = (function () {
      const c = mkc(160, 160);
      const x = c.getContext('2d')!;
      const d = x.createImageData(160, 160);
      const r = rng(0x51f3);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = 128 + (r() - 0.5) * 116;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      return c;
    })();

    function lin(x: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
      const g = x.createLinearGradient(x0 * TS, y0 * TS, x1 * TS, y1 * TS);
      for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      return g;
    }

    function rad(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, stops: [number, string][], r0?: number) {
      const g = x.createRadialGradient(cx * TS, cy * TS, (r0 || 0) * TS, cx * TS, cy * TS, r * TS);
      for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      return g;
    }

    function fill(x: CanvasRenderingContext2D, style: string | CanvasGradient) {
      x.fillStyle = style;
      x.fillRect(0, 0, TS, TS);
    }

    function band(x: CanvasRenderingContext2D, pts: [number, number][], color: string, width: number, blur: number, passes?: number) {
      x.save();
      x.translate(-2 * TS, 0);
      x.shadowOffsetX = 2 * TS;
      x.shadowBlur = blur * TS;
      x.shadowColor = color;
      x.strokeStyle = color;
      x.lineWidth = width * TS;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.beginPath();
      x.moveTo(pts[0][0] * TS, pts[0][1] * TS);
      for (let i = 1; i < pts.length - 1; i += 2) {
        x.quadraticCurveTo(pts[i][0] * TS, pts[i][1] * TS, pts[i + 1][0] * TS, pts[i + 1][1] * TS);
      }
      for (let p = 0; p < (passes || 1); p++) x.stroke();
      x.restore();
    }

    function glow(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, mode?: GlobalCompositeOperation) {
      x.save();
      x.globalCompositeOperation = mode || 'lighter';
      x.fillStyle = rad(x, cx, cy, r, [[0, color], [1, 'rgba(0,0,0,0)']]);
      x.fillRect(0, 0, TS, TS);
      x.restore();
    }

    function spine(y0: number, amp: number, ph: number, tilt: number) {
      const p: [number, number][] = [];
      for (let i = 0; i < 5; i++) {
        const u = -0.12 + i * 0.31;
        p.push([u, y0 + amp * Math.sin(ph + u * 4.2) + tilt * u]);
      }
      return p;
    }

    function wavy(x: CanvasRenderingContext2D, y0: number, ph: number, amp: number, freq: number, tilt?: number) {
      x.beginPath();
      for (let i = 0; i <= 10; i++) {
        const u = -0.12 + i * 0.124;
        const y = y0 + amp * Math.sin(ph + u * freq) + (tilt || 0) * u;
        if (i === 0) x.moveTo(u * TS, y * TS);
        else x.lineTo(u * TS, y * TS);
      }
    }

    function wavyStroke(x: CanvasRenderingContext2D, y0: number, ph: number, amp: number, freq: number, tilt: number, color: string, w: number, blur: number) {
      x.save();
      x.translate(-2 * TS, 0);
      x.shadowOffsetX = 2 * TS;
      x.shadowBlur = blur * TS;
      x.shadowColor = color;
      x.strokeStyle = color;
      x.lineWidth = w * TS;
      x.lineCap = 'round';
      wavy(x, y0, ph, amp, freq, tilt);
      x.stroke();
      x.stroke();
      x.restore();
    }

    function bandPath(x: CanvasRenderingContext2D, y0: number, h: number, ph: number, amp: number, freq: number, tilt: number) {
      x.beginPath();
      for (let i = 0; i <= 10; i++) {
        const u = -0.12 + i * 0.124;
        x.lineTo(u * TS, (y0 + amp * Math.sin(ph + u * freq) + tilt * u) * TS);
      }
      for (let i = 10; i >= 0; i--) {
        const u = -0.12 + i * 0.124;
        x.lineTo(u * TS, (y0 + h + amp * 0.62 * Math.sin(ph + 1.9 + u * freq * 0.86) + tilt * u) * TS);
      }
      x.closePath();
    }

    function chrome(x: CanvasRenderingContext2D, y0: number, h: number, ph: number, amp: number, freq: number, tilt: number, hot?: string) {
      x.save();
      x.translate(-2 * TS, 0);
      x.shadowOffsetX = 2 * TS;
      x.shadowBlur = 0.06 * TS;
      x.shadowColor = 'rgba(132,12,0,0.9)';
      x.fillStyle = '#000';
      bandPath(x, y0 - 0.018, h + 0.036, ph, amp, freq, tilt);
      x.fill();
      x.fill();
      x.restore();
      x.save();
      bandPath(x, y0, h, ph, amp, freq, tilt);
      x.clip();
      const g = x.createLinearGradient(0, (y0 - 0.03) * TS, 0, (y0 + h + 0.03) * TS);
      g.addColorStop(0, 'rgba(8,0,2,1)');
      g.addColorStop(0.12, 'rgba(58,2,6,1)');
      g.addColorStop(0.3, 'rgba(146,10,8,1)');
      g.addColorStop(0.43, 'rgba(220,42,16,1)');
      g.addColorStop(0.49, hot || 'rgba(255,206,132,1)');
      g.addColorStop(0.56, 'rgba(206,28,12,1)');
      g.addColorStop(0.72, 'rgba(90,4,6,1)');
      g.addColorStop(0.88, 'rgba(26,0,4,1)');
      g.addColorStop(1, 'rgba(5,0,2,1)');
      x.fillStyle = g;
      x.fillRect(0, 0, TS, TS);
      x.restore();
      wavyStroke(x, y0 + 0.004, ph, amp, freq, tilt, 'rgba(255,238,214,0.55)', 0.005, 0.004);
      wavyStroke(x, y0 + h - 0.006, ph + 1.9, amp * 0.62, freq * 0.86, tilt, 'rgba(40,220,200,0.42)', 0.008, 0.009);
      wavyStroke(x, y0 + h + 0.012, ph + 1.9, amp * 0.62, freq * 0.86, tilt, 'rgba(170,230,80,0.28)', 0.006, 0.008);
    }

    function shade(x: CanvasRenderingContext2D, x0: number, x1: number, strength: number) {
      x.save();
      const g = x.createLinearGradient(x0 * TS, 0, x1 * TS, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, 'rgba(0,0,0,' + (strength * 0.7).toFixed(2) + ')');
      g.addColorStop(1, 'rgba(0,0,0,' + strength.toFixed(2) + ')');
      x.fillStyle = g;
      x.fillRect(0, 0, TS, TS);
      x.restore();
    }

    // 12 procedural shaders
    const ART: ((x: CanvasRenderingContext2D) => void)[] = [
      function (x) {
        fill(x, rad(x, 0.5, 0.48, 0.82, [
          [0, '#020105'], [0.3, '#030106'], [0.37, '#1d0a48'], [0.46, '#4f2c94'],
          [0.54, '#38167e'], [0.66, '#22084e'], [0.86, '#0a0218'], [1, '#04010a']
        ]));
        glow(x, 0.3, 0.24, 0.4, 'rgba(96,66,180,0.4)');
        glow(x, 0.76, 0.8, 0.3, 'rgba(52,18,110,0.35)');
      },
      function (x) {
        fill(x, '#fbf9fb');
        band(x, spine(0.52, 0.09, 0.6, -0.18), 'rgba(236,44,140,0.92)', 0.19, 0.055, 2);
        band(x, spine(0.66, 0.07, 2.2, -0.14), 'rgba(255,96,26,0.9)', 0.16, 0.05, 2);
        band(x, spine(0.4, 0.06, 3.4, -0.1), 'rgba(70,120,255,0.55)', 0.09, 0.05, 1);
        band(x, spine(0.58, 0.08, 1.2, -0.16), 'rgba(255,255,255,0.9)', 0.05, 0.03, 2);
        band(x, spine(0.86, 0.05, 0.2, -0.05), 'rgba(150,40,200,0.5)', 0.1, 0.06, 1);
        glow(x, 0.22, 0.14, 0.46, 'rgba(255,255,255,0.85)');
      },
      function (x) {
        fill(x, lin(x, 0.98, 0, 0.06, 1, [
          [0, '#01020e'], [0.3, '#03082e'], [0.56, '#0820c4'], [0.76, '#1a4dff'], [0.95, '#7ea8ff'], [1, '#b6ccff']
        ]));
        glow(x, 0.2, 0.86, 0.3, 'rgba(176,206,255,0.8)');
        glow(x, 0.06, 0.98, 0.22, 'rgba(226,120,220,0.55)');
        glow(x, 0.92, 0.06, 0.44, 'rgba(0,0,8,0.75)', 'source-over');
      },
      function (x) {
        fill(x, lin(x, 0.08, 0, 0, 1, [
          [0, '#9dbccd'], [0.14, '#5b87ad'], [0.26, '#245693'], [0.36, '#7793a8'],
          [0.45, '#e2523a'], [0.52, '#e07a5e'], [0.58, '#82aec8'], [0.68, '#2467a8'],
          [0.8, '#0e3970'], [0.92, '#081c40'], [1, '#051026']
        ]));
        band(x, spine(0.42, 0.02, 1.0, 0.03), 'rgba(240,140,105,0.45)', 0.05, 0.03, 1);
        band(x, spine(0.63, 0.02, 2.4, -0.03), 'rgba(150,200,235,0.4)', 0.05, 0.03, 1);
      },
      function (x) {
        fill(x, lin(x, 0.88, 0.04, 0.14, 0.96, [
          [0, '#010103'], [0.34, '#030316'], [0.58, '#0d066a'], [0.78, '#2a10b8'], [0.93, '#5a38e0'], [1, '#8464f4']
        ]));
        glow(x, 0.14, 0.92, 0.3, 'rgba(110,86,210,0.55)');
        glow(x, 0.9, 0.08, 0.42, 'rgba(0,0,4,0.75)', 'source-over');
      },
      function (x) {
        fill(x, '#020104');
        band(x, spine(0.46, 0.07, 1.4, -0.1), 'rgba(88,30,18,0.7)', 0.24, 0.13, 2);
        band(x, spine(0.44, 0.07, 1.4, -0.1), 'rgba(168,64,36,0.45)', 0.08, 0.07, 1);
        glow(x, 0.16, 0.2, 0.32, 'rgba(20,30,64,0.35)');
        glow(x, 0.9, 0.88, 0.22, 'rgba(70,64,110,0.3)');
      },
      function (x) {
        fill(x, '#e3dcec');
        band(x, spine(0.42, 0.1, 2.6, 0.16), 'rgba(132,58,220,0.9)', 0.18, 0.055, 2);
        band(x, spine(0.6, 0.09, 1.1, 0.2), 'rgba(240,104,20,0.92)', 0.16, 0.05, 2);
        band(x, spine(0.5, 0.09, 2.0, 0.18), 'rgba(245,40,140,0.65)', 0.1, 0.045, 1);
        band(x, spine(0.55, 0.09, 1.6, 0.18), 'rgba(255,255,255,0.8)', 0.04, 0.03, 2);
        glow(x, 0.82, 0.94, 0.36, 'rgba(255,255,255,0.7)');
        glow(x, 0.08, 0.08, 0.26, 'rgba(60,40,110,0.4)', 'source-over');
      },
      function (x) {
        fill(x, '#12030a');
        glow(x, 0.02, 0.04, 0.42, 'rgba(255,142,36,0.85)');
        glow(x, 0.5, 0.5, 0.62, 'rgba(178,26,14,0.8)');
        chrome(x, 0.18, 0.58, 1.1, 0.07, 4.2, -0.1, 'rgba(255,216,158,1)');
        shade(x, 0.55, 1.2, 0.45);
        glow(x, 0.94, 0.94, 0.3, 'rgba(60,14,96,0.45)');
      },
      function (x) {
        fill(x, '#040103');
        glow(x, 0.4, 0.46, 0.5, 'rgba(48,14,10,0.8)');
        chrome(x, 0.3, 0.44, 2.4, 0.06, 4.8, 0.1, 'rgba(255,190,110,1)');
        shade(x, 0.3, 1.15, 0.72);
        band(x, spine(0.9, 0.05, 0.4, 0.1), 'rgba(70,16,110,0.45)', 0.12, 0.08, 1);
      },
      function (x) {
        fill(x, lin(x, 0.4, 0, 0.6, 1, [[0, '#03040e'], [0.42, '#060a22'], [0.72, '#070412'], [1, '#030106']]));
        glow(x, 0.28, 0.14, 0.42, 'rgba(18,32,84,0.55)');
        chrome(x, 0.6, 0.3, 0.9, 0.05, 3.8, -0.08, 'rgba(255,198,120,1)');
        shade(x, 0.3, 1.1, 0.8);
      },
      function (x) {
        fill(x, '#050208');
        chrome(x, 0.02, 0.34, 2.0, 0.045, 4.4, -0.07, 'rgba(255,206,132,1)');
        shade(x, 0.45, 1.1, 0.7);
        x.save();
        x.beginPath();
        x.moveTo(0, TS * 0.72);
        x.lineTo(TS, TS * 0.56);
        x.lineTo(TS, TS);
        x.lineTo(0, TS);
        x.closePath();
        x.clip();
        fill(x, lin(x, 0, 0.5, 0.4, 1, [[0, '#cfd6dc'], [0.6, '#e8eaee'], [1, '#f4f5f7']]));
        band(x, spine(0.7, 0.03, 1.0, -0.1), 'rgba(245,44,96,0.8)', 0.055, 0.03, 2);
        band(x, spine(0.76, 0.03, 1.6, -0.1), 'rgba(30,146,245,0.75)', 0.045, 0.026, 2);
        band(x, spine(0.82, 0.03, 2.2, -0.08), 'rgba(245,130,54,0.5)', 0.035, 0.026, 1);
        x.restore();
      },
      function (x) {
        fill(x, '#08050a');
        for (let i = 0; i < 9; i++) {
          const y0 = 0.06 + i * 0.045;
          const a = 0.8 - i * 0.06;
          band(x, spine(y0, 0.02, 0.4 + i * 0.5, -0.2), 'rgba(' + (250 - i * 3) + ',' + (30 + i * 15) + ',' + (80 + i * 5) + ',' + a.toFixed(2) + ')', 0.032, 0.018, 2);
        }
        band(x, spine(0.28, 0.02, 1.2, -0.18), 'rgba(255,120,72,0.55)', 0.05, 0.035, 1);
        band(x, spine(0.14, 0.02, 2.4, -0.2), 'rgba(120,190,255,0.4)', 0.03, 0.02, 1);
        x.save();
        x.beginPath();
        x.moveTo(0, TS * 0.72);
        x.lineTo(TS, TS * 0.4);
        x.lineTo(TS, TS);
        x.lineTo(0, TS);
        x.closePath();
        x.clip();
        fill(x, lin(x, 0.1, 0.4, 0.6, 1, [[0, '#c6c7cd'], [0.5, '#e2e2e6'], [1, '#f2f2f4']]));
        x.restore();
      },
    ];

    function roundRectPath(x: CanvasRenderingContext2D, w: number, h: number, r: number) {
      x.beginPath();
      x.moveTo(-w / 2 + r, -h / 2);
      x.lineTo(w / 2 - r, -h / 2);
      x.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      x.lineTo(w / 2, h / 2 - r);
      x.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      x.lineTo(-w / 2 + r, h / 2);
      x.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      x.lineTo(-w / 2, -h / 2 + r);
      x.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      x.closePath();
    }

    function buildTextures() {
      const front: HTMLCanvasElement[] = [];
      const back: HTMLCanvasElement[] = [];

      for (let i = 0; i < ART.length; i++) {
        const c = mkc(TS, TS);
        const x = c.getContext('2d')!;
        ART[i](x);

        // Film grain
        x.save();
        x.globalCompositeOperation = 'overlay';
        x.globalAlpha = 0.15;
        const p = x.createPattern(grainTile, 'repeat')!;
        x.fillStyle = p;
        x.fillRect(0, 0, TS, TS);
        x.restore();

        // Create clean back side BEFORE adding front text (no backwards text on reverse!)
        const d = mkc(TS, TS);
        const y = d.getContext('2d')!;
        y.drawImage(c, 0, 0);
        y.globalCompositeOperation = 'saturation';
        y.fillStyle = 'rgba(128,128,128,0.2)';
        y.fillRect(0, 0, TS, TS);
        y.globalCompositeOperation = 'multiply';
        y.fillStyle = 'rgba(6,8,18,0.88)';
        y.fillRect(0, 0, TS, TS);
        back.push(d);

        // Feature card branding overlay on front tile - flipped 180° so text is perfectly upright on screen
        const featIdx = i % features.length;
        const feat = features[featIdx];
        if (feat) {
          x.save();
          // 180° rotation to align perfectly with viewer perspective
          x.translate(TS / 2, TS / 2);
          x.rotate(Math.PI);
          x.translate(-TS / 2, -TS / 2);

          // Glass highlight at bottom
          const grad = x.createLinearGradient(0, TS * 0.46, 0, TS);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(0.45, 'rgba(6,12,26,0.75)');
          grad.addColorStop(1, 'rgba(2,6,18,0.95)');
          x.fillStyle = grad;
          x.fillRect(0, TS * 0.45, TS, TS * 0.55);

          // Glowing border highlight
          x.strokeStyle = feat.color;
          x.lineWidth = 5;
          x.globalAlpha = 0.45;
          x.strokeRect(16, 16, TS - 32, TS - 32);

          // Top badge
          x.globalAlpha = 1;
          x.fillStyle = 'rgba(8,15,30,0.85)';
          x.beginPath();
          x.roundRect(32, 32, 172, 46, 12);
          x.fill();
          x.strokeStyle = feat.color;
          x.lineWidth = 2;
          x.stroke();

          x.font = '700 20px ' + SANS;
          x.fillStyle = feat.color;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText(`0${featIdx + 1} // CORE`, 118, 55);

          // Feature Title
          x.textAlign = 'left';
          x.font = '800 34px ' + SANS;
          x.fillStyle = '#ffffff';
          x.shadowColor = 'rgba(0,0,0,0.9)';
          x.shadowBlur = 12;
          x.fillText(feat.title, 36, TS - 82);

          // Subtitle
          x.font = '600 20px ' + SANS;
          x.fillStyle = '#cbd5e1';
          x.shadowBlur = 0;
          const shortDesc = feat.desc.length > 38 ? feat.desc.slice(0, 38) + '...' : feat.desc;
          x.fillText(shortDesc, 36, TS - 42);

          x.restore();
        }

        front.push(c);
      }
      return { front, back };
    }

    const TEX = buildTextures();

    /* Ring Geometry */
    const ax = (RING.axis * Math.PI) / 180;
    const cf = RING.ratio;
    const sf = Math.sqrt(1 - cf * cf);
    const U = [Math.cos(ax), Math.sin(ax), 0];
    const V = [-Math.sin(ax) * cf, Math.cos(ax) * cf, sf];
    const AXIS = [
      U[1] * V[2] - U[2] * V[1],
      U[2] * V[0] - U[0] * V[2],
      U[0] * V[1] - U[1] * V[0],
    ];

    let W = 0;
    let H = 0;
    let K = 1;
    let OX = 0;
    let OY = 0;
    let headLayer: HTMLCanvasElement | null = null;
    let labelLayer: HTMLCanvasElement | null = null;

    function d2sx(x: number) {
      return OX + x * K;
    }
    function d2sy(y: number) {
      return OY + y * K;
    }

    function fitText(
      x: CanvasRenderingContext2D,
      str: string,
      font: string,
      weight: string,
      cap: number,
      cx: number,
      capTop: number,
      targetW: number,
      color: string,
      align?: CanvasTextAlign
    ) {
      const probe = 100;
      x.font = weight + ' ' + probe + 'px ' + font;
      const m = x.measureText('H');
      const capUnit = (m.actualBoundingBoxAscent || 71) / probe;
      const size = cap / capUnit;
      x.font = weight + ' ' + size + 'px ' + font;
      const mm = x.measureText(str);
      const inkW = (mm.actualBoundingBoxRight || mm.width) + (mm.actualBoundingBoxLeft || 0);
      const sx = targetW ? targetW / inkW : 1;
      x.save();
      x.fillStyle = color;
      x.textBaseline = 'alphabetic';
      x.translate(cx, capTop + cap);
      x.scale(sx, 1);
      x.textAlign = align || 'center';
      const left = mm.actualBoundingBoxLeft || 0;
      x.fillText(str, align === 'left' ? left : 0, 0);
      x.restore();
      return inkW * sx;
    }

    function buildHead() {
      headLayer = mkc(Math.max(1, W), Math.max(1, H));
      const x = headLayer.getContext('2d')!;
      const currentPreset = stateRef.current.preset;
      const scale = stateRef.current.headlineScale;

      // Project-relevant and clear text between the 3D rotating ring
      const HEAD =
        currentPreset === 'gridpulse'
          ? [
            { s: 'GRIDPULSE AI', top: 920, w: 1480 * scale, fill: '#cbd5e1' },
            { s: 'BATTERY ARBITRAGE', top: 1114, w: 1880 * scale, fill: '#ffffff' },
          ]
          : [
            { s: 'NEW GRAINIENT', top: 930, w: 1370 * scale, fill: '#d0d0d0' },
            { s: 'COLLECTION ADDED', top: 1114, w: 1775 * scale, fill: '#ffffff' },
          ];

      for (let i = 0; i < HEAD.length; i++) {
        const h = HEAD[i];
        fitText(x, h.s, SANS, '800', CAP * K * scale, d2sx(1481), d2sy(h.top), h.w * K, h.fill);
      }
    }

    function buildLabels() {
      labelLayer = mkc(Math.max(1, W), Math.max(1, H));
      const x = labelLayer.getContext('2d')!;
      const currentPreset = stateRef.current.preset;

      // In 6 Engines mode: Canvas label text removed for a clean floating 3D ring
      if (currentPreset === 'gridpulse') {
        return;
      }

      const cap = SMALL * K;
      const dim = '#94a3b8';
      const pad = 88 * K;

      x.save();
      x.fillStyle = dim;
      x.textBaseline = 'alphabetic';
      x.textAlign = 'left';
      const f = '500 ' + cap / 0.717 + 'px ' + SANS;
      x.font = f;
      x.fillText('VOID BLUE / GRADIENT STRIPS / RED AURA', pad, pad + cap);
      x.fillText('2026', pad, H - pad);
      x.textAlign = 'right';
      x.fillText('GRAINIENT.SUPPLY', W - pad, H - pad);

      const pitch = 33 * K;
      const L = ['(50+) Gradients', 'Backgrounds', 'Added,'];
      for (let i = 0; i < L.length; i++) {
        fitText(x, L[i], SANS, '500', cap, d2sx(344), d2sy(1148) + i * pitch, 0, '#ffffff', 'left');
      }

      const Rt = ['Gradients &', 'AI-Generated', 'Backgrounds'];
      for (let j = 0; j < Rt.length; j++) {
        fitText(x, Rt[j], SANS, '500', cap, d2sx(2310), d2sy(932) + j * 32.5 * K, 0, '#ffffff', 'left');
      }
      x.restore();
    }

    rebuildLayersRef.current = () => {
      buildHead();
      buildLabels();
    };

    function resize() {
      const rect = container?.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const widthPx = rect ? rect.width : window.innerWidth;
      // Made significantly larger so the text and 3D ring are clearly visible
      const heightPx = Math.max(520, Math.min(720, widthPx * 0.58));

      W = Math.round(widthPx * dpr);
      H = Math.round(heightPx * dpr);

      cv!.width = W;
      cv!.height = H;

      const S = Math.min(W, H * DASP);
      K = S / DW;
      OX = (W - DW * K) / 2;
      OY = (H - DH * K) / 2;

      buildHead();
      buildLabels();
    }

    function project(p: number[]) {
      const k = (RING.a * K * RING.dist) / (RING.dist - p[2]);
      return [d2sx(RING.cx) + k * p[0], d2sy(RING.cy) + k * p[1], k];
    }

    function drawTile(i: number, psi: number) {
      const c = Math.cos(psi);
      const s = Math.sin(psi);
      const C = [c * U[0] + s * V[0], c * U[1] + s * V[1], c * U[2] + s * V[2]];
      const T = [-s * U[0] + c * V[0], -s * U[1] + c * V[1], -s * U[2] + c * V[2]];
      const h = RING.tile / (2 * RING.a);
      const p0 = project(C);
      const pT = project([C[0] + T[0] * h, C[1] + T[1] * h, C[2] + T[2] * h]);
      const pA = project([C[0] + AXIS[0] * h, C[1] + AXIS[1] * h, C[2] + AXIS[2] * h]);
      const ex = pT[0] - p0[0];
      const ey = pT[1] - p0[1];
      const fx = pA[0] - p0[0];
      const fy = pA[1] - p0[1];

      if (Math.abs(ex * fy - ey * fx) < 0.4) return;
      const facing = C[2] > 0;
      const img = (facing ? TEX.front : TEX.back)[i % TEX.front.length];

      ctx!.save();
      ctx!.setTransform((ex * 2) / TS, (ey * 2) / TS, (fx * 2) / TS, (fy * 2) / TS, p0[0], p0[1]);
      roundRectPath(ctx!, TS, TS, TS * RING.radius);
      ctx!.clip();
      ctx!.drawImage(img, -TS / 2, -TS / 2, TS, TS);
      ctx!.restore();
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
    }

    let animId: number;

    function render(spinAngle: number) {
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      // Clean transparent canvas: extracted 3D ring floats cleanly against the page's far background
      ctx!.clearRect(0, 0, W, H);
      ctx!.imageSmoothingQuality = 'high';

      const list: { i: number; psi: number; z: number }[] = [];
      let closestIdx = 0;
      let maxZ = -Infinity;

      for (let i = 0; i < RING.n; i++) {
        const psi = (RING.phase * Math.PI) / 180 - (i * 2 * Math.PI) / RING.n + spinAngle;
        const c = Math.cos(psi);
        const s = Math.sin(psi);
        const z = c * U[2] + s * V[2];
        list.push({ i, psi, z });
        if (z > maxZ) {
          maxZ = z;
          closestIdx = i % features.length;
        }
      }

      setActiveFeatureIdx(closestIdx);

      list.sort((a, b) => a.z - b.z);

      let drawnText = false;
      for (let i = 0; i < list.length; i++) {
        if (!drawnText && list[i].z > 0) {
          if (headLayer) ctx!.drawImage(headLayer, 0, 0);
          drawnText = true;
        }
        drawTile(list[i].i, list[i].psi);
      }

      if (!drawnText && headLayer) ctx!.drawImage(headLayer, 0, 0);
      if (labelLayer) ctx!.drawImage(labelLayer, 0, 0);
    }

    function tick(now: number) {
      const dt = Math.min((now - stateRef.current.lastFrameTime) / 1000, 0.1);
      stateRef.current.lastFrameTime = now;

      // Handle motion physics
      const st = stateRef.current;
      let targetSpeed = 0;

      if (st.isPlaying) {
        if (st.motionMode === 'auto') {
          targetSpeed = (Math.PI * 2) / DUR;
        } else if (st.motionMode === 'hover') {
          targetSpeed = st.isHovered ? (Math.PI * 2) / DUR : 0.04;
        }
      }

      // Drag inertia
      if (st.isDragging) {
        st.currentSpin += st.dragVelocity;
        st.dragVelocity *= 0.9;
      } else {
        st.currentSpin += targetSpeed * dt;
      }

      render(st.currentSpin + st.userOffset);
      animId = requestAnimationFrame(tick);
    }

    // Pointer events for drag & hover
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      stateRef.current.isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      stateRef.current.lastPointerX = clientX;
      stateRef.current.dragVelocity = 0;
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!stateRef.current.isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const dx = clientX - stateRef.current.lastPointerX;
      stateRef.current.lastPointerX = clientX;
      const speedScale = 0.0035;
      stateRef.current.dragVelocity = dx * speedScale;
      stateRef.current.currentSpin += dx * speedScale;
    };

    const handlePointerUp = () => {
      stateRef.current.isDragging = false;
    };

    const handleMouseEnter = () => {
      stateRef.current.isHovered = true;
    };

    const handleMouseLeave = () => {
      stateRef.current.isHovered = false;
      stateRef.current.isDragging = false;
    };

    const cvElement = cv;
    cvElement.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    cvElement.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);

    cvElement.addEventListener('mouseenter', handleMouseEnter);
    cvElement.addEventListener('mouseleave', handleMouseLeave);

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(container);

    resize();
    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      cvElement.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      cvElement.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      cvElement.removeEventListener('mouseenter', handleMouseEnter);
      cvElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [features]);

  // Rotate to specific feature
  const focusFeature = (idx: number) => {
    setActiveFeatureIdx(idx);
    const targetAngle = (idx * 2 * Math.PI) / 6;
    stateRef.current.currentSpin = targetAngle;
  };

  return (
    <div style={{ width: '100%', maxWidth: 1120, margin: '0 auto', position: 'relative' }}>
      {/* Interactive Control Header */}


      {/* 3D Kinetic Canvas Ring Stage - Floating cleanly outside dark box over page background */}
      {viewMode !== 'cards' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            height: 'clamp(500px, 56vw, 680px)',
            borderRadius: 20,
            overflow: 'visible',
            border: 'none',
            boxShadow: 'none',
            background: 'transparent',
            marginBottom: viewMode === 'unified' ? 24 : 0,
            cursor: 'grab',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              touchAction: 'none',
            }}
          />

          {/* Interactive Hint Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              borderRadius: 30,
              padding: '4px 14px',
              fontSize: 11,
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              pointerEvents: 'none',
            }}
          >
            <RotateCw size={12} className="spin-slow" />
            <span>Hover to Orbit · Click & Drag to Spin</span>
          </div>
        </motion.div>
      )}

      {/* Synchronized 6 Feature Cards Grid */}
      {viewMode !== 'orbit' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            width: '100%',
          }}
        >
          {features.map((f, i) => {
            const isSelected = activeFeatureIdx === i;
            return (
              <motion.div
                key={i}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                onClick={() => focusFeature(i)}
                className="card card-hover"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isSelected ? `1px solid ${f.color}` : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isSelected ? `0 0 24px ${f.color}35` : 'none',
                  transition: 'border 0.3s, box-shadow 0.3s',
                  background: isSelected ? 'rgba(15, 23, 42, 0.85)' : undefined,
                }}
              >
                {/* Top color bar */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: isSelected ? 3 : 2,
                    background: f.color,
                    opacity: isSelected ? 1 : 0.7,
                  }}
                />

                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ color: f.color }}>{f.icon}</div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: isSelected ? f.color : '#64748b',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    0{i + 1} // {isSelected ? 'FOCUSED' : 'ORBIT'}
                  </span>
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff', marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: '#8b9bbf', lineHeight: 1.6 }}>{f.desc}</div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};
