import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface IridescentOrbProps {
  size?: number;
  volumeLevel?: number; // 0 to 1
  isSpeaking?: boolean;
  isListening?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

export function IridescentOrb({
  size = 180,
  volumeLevel = 0,
  isSpeaking = false,
  isListening = false,
  interactive = true,
  className = '',
  onClick,
}: IridescentOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef(volumeLevel);
  volumeRef.current = volumeLevel;

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const isListeningRef = useRef(isListening);
  isListeningRef.current = isListening;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dimensions
    const width = size;
    const height = size;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 3.6;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Custom Iridescent Shader
    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      uniform float uTime;
      uniform float uVolume;

      // Simplex-like 3D noise
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      
      float snoise(vec3 v){
        const vec2  C = vec2(1.0/6.0, 1.0/3.0);
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
        i = mod(i, 289.0 );
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vUv = uv;

        // Subtle fluid displacement
        float noise = snoise(position * 1.8 + vec3(uTime * 0.3));
        float displacement = noise * (0.04 + uVolume * 0.15);
        vec3 newPos = position + normal * displacement;

        vec4 worldPos = modelMatrix * vec4(newPos, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const fragmentShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      uniform float uTime;
      uniform float uVolume;
      uniform vec3 uCameraPos;

      // Cosine based palette generator
      vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
        return a + b*cos( 6.28318*(c*t+d) );
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(uCameraPos - vWorldPosition);

        // Fresnel reflection factor
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.2);

        // Iridescent color shift based on angle and time
        float angle = dot(viewDir, normal);
        float colorCoord = angle * 0.8 + vUv.y * 0.4 + sin(uTime * 0.25 + vPosition.x * 2.0) * 0.3;

        // Palette matching reference image:
        // pearlescent rose, celestial cyan, soft violet, peach gold
        vec3 colA = vec3(0.55, 0.48, 0.62);
        vec3 colB = vec3(0.45, 0.40, 0.45);
        vec3 colC = vec3(1.2, 1.0, 1.1);
        vec3 colD = vec3(0.05, 0.33, 0.67);

        vec3 iridColor = palette(colorCoord, colA, colB, colC, colD);

        // Specular highlight
        vec3 lightDir1 = normalize(vec3(1.2, 1.8, 2.0));
        vec3 lightDir2 = normalize(vec3(-1.5, -1.0, 1.5));
        
        vec3 halfVec1 = normalize(lightDir1 + viewDir);
        float spec1 = pow(max(dot(normal, halfVec1), 0.0), 32.0);

        vec3 halfVec2 = normalize(lightDir2 + viewDir);
        float spec2 = pow(max(dot(normal, halfVec2), 0.0), 16.0);

        // Soft pastel highlights
        vec3 specColor1 = vec3(1.0, 0.85, 0.95) * spec1 * 0.85;
        vec3 specColor2 = vec3(0.4, 0.8, 1.0) * spec2 * 0.4;

        // Base sphere shading with inner translucency
        vec3 base = iridColor * (0.65 + 0.35 * dot(normal, lightDir1));

        // Rim glow
        vec3 rimColor = vec3(0.8, 0.65, 1.0) * fresnel * (0.7 + uVolume * 0.9);

        vec3 finalColor = base + specColor1 + specColor2 + rimColor;

        // Boost brightness when voice is active
        finalColor += vec3(0.1, 0.15, 0.25) * uVolume;

        gl_FragColor = vec4(finalColor, 0.98);
      }
    `;

    // Geometry
    const geometry = new THREE.SphereGeometry(1.2, 64, 64);

    // Uniforms
    const uniforms = {
      uTime: { value: 0 },
      uVolume: { value: 0 },
      uCameraPos: { value: camera.position },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: true,
    });

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Subtle Outer Corona Ring / Glow Halo
    const haloGeom = new THREE.RingGeometry(1.25, 1.32, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeom, haloMat);
    scene.add(halo);

    // Mouse tilt interaction
    let targetRotX = 0;
    let targetRotY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotY = x * 0.6;
      targetRotX = y * 0.6;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      uniforms.uTime.value = elapsedTime;

      // Smooth volume interpolation
      const targetVol = volumeRef.current;
      uniforms.uVolume.value += (targetVol - uniforms.uVolume.value) * 0.15;

      // Sphere rotation & breathing
      sphere.rotation.y += 0.005 + uniforms.uVolume.value * 0.015;
      sphere.rotation.x += (targetRotX - sphere.rotation.x) * 0.05;
      sphere.rotation.z += (targetRotY - sphere.rotation.z) * 0.05;

      // Pulse scale with volume
      const baseScale = 1.0 + Math.sin(elapsedTime * 1.5) * 0.02;
      const scale = baseScale + uniforms.uVolume.value * 0.22;
      sphere.scale.set(scale, scale, scale);

      halo.rotation.z -= 0.002;
      halo.scale.set(scale, scale, scale);
      haloMat.opacity = 0.08 + uniforms.uVolume.value * 0.35;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      haloGeom.dispose();
      haloMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size, interactive]);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative flex items-center justify-center cursor-pointer select-none transition-transform duration-300 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Soft iridescent background ambient back-glow */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: size * 1.3,
          height: size * 1.3,
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, rgba(59, 130, 246, 0.12) 40%, rgba(236, 72, 153, 0.05) 65%, transparent 80%)',
          filter: 'blur(28px)',
          zIndex: 0,
        }}
      />
    </div>
  );
}
