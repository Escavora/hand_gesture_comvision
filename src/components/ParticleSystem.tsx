'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GestureType } from '@/lib/GestureClassifier';

const PARTICLE_COUNT = 80000;

function sampleTextPositions(
  text: string,
  count: number,
  scaleX: number = 28,
  scaleY: number = 8
): Float32Array {
  const arr = new Float32Array(count * 3);

  // SSR guard
  if (typeof document === 'undefined') {
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * scaleX;
      arr[i * 3 + 1] = (Math.random() - 0.5) * scaleY;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    return arr;
  }

  const canvas = document.createElement('canvas');
  const width = 1600;
  const height = 400;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const fontSize = text.length > 14 ? 100 : text.length > 10 ? 120 : 150;
  ctx.font = `900 ${fontSize}px Arial, "Segoe UI", sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels: [number, number][] = [];

  // Sample every pixel for maximum density
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      if (imageData.data[idx] > 128) {
        pixels.push([x, y]);
      }
    }
  }

  // Fallback
  if (pixels.length === 0) {
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * scaleX;
      arr[i * 3 + 1] = (Math.random() - 0.5) * scaleY;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    return arr;
  }

  for (let i = 0; i < count; i++) {
    const [px, py] = pixels[Math.floor(Math.random() * pixels.length)];
    const i3 = i * 3;
    // Map pixel coords to centered 3D space — very tight jitter for crisp text
    arr[i3]     = ((px / width) - 0.5) * scaleX  + (Math.random() - 0.5) * 0.02;
    arr[i3 + 1] = -((py / height) - 0.5) * scaleY + (Math.random() - 0.5) * 0.02;
    arr[i3 + 2] = (Math.random() - 0.5) * 0.08;
  }

  return arr;
}

export default function ParticleSystem({ gesture }: { gesture: GestureType }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, targets, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const sz  = new Float32Array(PARTICLE_COUNT);

    // --- Math-based target: Galaxy spiral (for idle / None) ---
    const galaxyTarget = new Float32Array(PARTICLE_COUNT * 3);

    const colorAccents = [
      new THREE.Color('#00f0ff'), // Cyan
      new THREE.Color('#ff003c'), // Neon Red
      new THREE.Color('#7000ff'), // Purple
      new THREE.Color('#ffffff'), // White
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Initial random cloud
      pos[i3]     = (Math.random() - 0.5) * 20;
      pos[i3 + 1] = (Math.random() - 0.5) * 20;
      pos[i3 + 2] = (Math.random() - 0.5) * 20;

      // Galaxy spiral
      const radius = Math.random() * 7 + 0.5;
      const angle = Math.random() * Math.PI * 2;
      const spiral = angle + radius * 1.5;
      galaxyTarget[i3]     = Math.cos(spiral) * radius;
      galaxyTarget[i3 + 1] = (Math.random() - 0.5) * 1.5;
      galaxyTarget[i3 + 2] = Math.sin(spiral) * radius;

      // Colors & sizes
      const c = colorAccents[Math.floor(Math.random() * colorAccents.length)];
      col[i3]     = c.r;
      col[i3 + 1] = c.g;
      col[i3 + 2] = c.b;
      sz[i] = Math.random() * 0.06 + 0.02;
    }

    // --- Text-based targets ---
    // NO emojis in particle text — emojis fail on canvas and waste particle density
    // Shorter text = bigger font = sharper readability
    const tgts: Record<GestureType, Float32Array> = {
      None:        galaxyTarget,
      Open_Hand:   sampleTextPositions('KAMU BISA!',       PARTICLE_COUNT),
      Peace:       sampleTextPositions('TERUS MAJU!',      PARTICLE_COUNT),
      Call_Me:     sampleTextPositions('NIKMATIN AJA DULU!',     PARTICLE_COUNT),
      Thumbs_Up:   sampleTextPositions('KERJA BAGUS!',     PARTICLE_COUNT),
      Point_Up:    sampleTextPositions('KAMU NO.1!',       PARTICLE_COUNT),
      Rock:        sampleTextPositions('SEMANGAT!',        PARTICLE_COUNT),
      Kamehameha:  sampleTextPositions('HAA!!!',           PARTICLE_COUNT),
      Double_Peace:sampleTextPositions('CHILL BRO',        PARTICLE_COUNT),
    };

    return { positions: pos, targets: tgts, colors: col, sizes: sz };
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const targetArray = targets[gesture] || targets.None;

    const lerpFactor = 0.05;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Lerp towards target
      posArray[i3]     += (targetArray[i3]     - posArray[i3])     * lerpFactor;
      posArray[i3 + 1] += (targetArray[i3 + 1] - posArray[i3 + 1]) * lerpFactor;
      posArray[i3 + 2] += (targetArray[i3 + 2] - posArray[i3 + 2]) * lerpFactor;

      // Very subtle floating noise
      posArray[i3 + 1] += Math.sin(state.clock.elapsedTime * 2 + posArray[i3]) * 0.0005;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    // --- Rotation logic ---
    const isTextGesture = gesture !== 'None';

    if (isTextGesture) {
      // Snap rotation to nearest full turn so text faces camera
      const pi2 = Math.PI * 2;
      const targetY = Math.round(pointsRef.current.rotation.y / pi2) * pi2;
      pointsRef.current.rotation.y += (targetY - pointsRef.current.rotation.y) * 0.08;

      const targetZ = Math.round(pointsRef.current.rotation.z / pi2) * pi2;
      pointsRef.current.rotation.z += (targetZ - pointsRef.current.rotation.z) * 0.08;
    } else {
      // Galaxy idle: spin freely
      pointsRef.current.rotation.y += delta * 0.15;
      pointsRef.current.rotation.z += delta * 0.05;
    }

    // --- Scale pulse for Call_Me ---
    if (gesture === 'Call_Me') {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.06;
      pointsRef.current.scale.set(scale, scale, scale);
    } else {
      pointsRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
