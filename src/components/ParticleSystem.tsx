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

function sampleShapePositions(
  emoji: string,
  count: number,
  scale: number = 15,
  hollowOutDark: boolean = false
): Float32Array {
  const arr = new Float32Array(count * 3);

  // SSR guard
  if (typeof document === 'undefined') {
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * scale;
      arr[i * 3 + 1] = (Math.random() - 0.5) * scale;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    return arr;
  }

  const canvas = document.createElement('canvas');
  const size = 400;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  ctx.font = `250px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);

  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels: [number, number][] = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      const alpha = imageData.data[idx + 3];
      
      if (alpha > 64) {
        if (hollowOutDark) {
          const r = imageData.data[idx];
          const g = imageData.data[idx + 1];
          const b = imageData.data[idx + 2];
          // Calculate brightness/luminance
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          // Only push bright pixels, leaving dark ones (eyes, mouth) as holes
          if (brightness > 60) {
            pixels.push([x, y]);
          }
        } else {
          pixels.push([x, y]);
        }
      }
    }
  }

  if (pixels.length === 0) {
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * scale;
      arr[i * 3 + 1] = (Math.random() - 0.5) * scale;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    return arr;
  }

  for (let i = 0; i < count; i++) {
    const [px, py] = pixels[Math.floor(Math.random() * pixels.length)];
    const i3 = i * 3;
    arr[i3]     = ((px / size) - 0.5) * scale  + (Math.random() - 0.5) * 0.05;
    arr[i3 + 1] = -((py / size) - 0.5) * scale + (Math.random() - 0.5) * 0.05;
    arr[i3 + 2] = (Math.random() - 0.5) * 0.2;
  }

  return arr;
}

export default function ParticleSystem({ gesture }: { gesture: GestureType }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, targets, targetColors, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const sz  = new Float32Array(PARTICLE_COUNT);

    // --- Math-based target: Galaxy spiral (for idle / None) ---
    const galaxyTarget = new Float32Array(PARTICLE_COUNT * 3);

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

      // Random sizes
      sz[i] = Math.random() * 0.06 + 0.02;
    }

    // --- Text-based targets ---
    const tgts: Record<GestureType, Float32Array> = {
      None:        galaxyTarget,
      Open_Hand:   sampleTextPositions('KAMU BISA!',       PARTICLE_COUNT),
      Peace:       sampleShapePositions('😻',                PARTICLE_COUNT, 20, true),
      Call_Me:     sampleTextPositions('NIKMATIN AJA DULU!', PARTICLE_COUNT),
      Thumbs_Up:   sampleShapePositions('🌷',                PARTICLE_COUNT, 18, false),
      Point_Up:    sampleTextPositions('KAMU NO.1!',       PARTICLE_COUNT),
      Rock:        sampleTextPositions('SEMANGAT!',        PARTICLE_COUNT),
      Kamehameha:  sampleTextPositions('HAA!!!',           PARTICLE_COUNT),
      Double_Peace:sampleTextPositions('CHILL BRO',        PARTICLE_COUNT),
    };

    // --- Color targets ---
    const GESTURE_COLORS: Record<GestureType, THREE.Color[]> = {
      None:        [new THREE.Color('#00f0ff'), new THREE.Color('#ff003c'), new THREE.Color('#7000ff'), new THREE.Color('#ffffff')],
      Open_Hand:   [new THREE.Color('#ffaa00'), new THREE.Color('#ffdd00'), new THREE.Color('#ffffff')],
      Peace:       [new THREE.Color('#00ff88'), new THREE.Color('#00ffcc'), new THREE.Color('#ffffff')],
      Call_Me:     [new THREE.Color('#ff00aa'), new THREE.Color('#ff66cc'), new THREE.Color('#ffffff')],
      Thumbs_Up:   [new THREE.Color('#0088ff'), new THREE.Color('#00ccff'), new THREE.Color('#ffffff')],
      Point_Up:    [new THREE.Color('#aa00ff'), new THREE.Color('#cc66ff'), new THREE.Color('#ffffff')],
      Rock:        [new THREE.Color('#ff5500'), new THREE.Color('#ff8800'), new THREE.Color('#ffffff')],
      Kamehameha:  [new THREE.Color('#00ffff'), new THREE.Color('#ffffff'), new THREE.Color('#00aaff')],
      Double_Peace:[new THREE.Color('#00ff44'), new THREE.Color('#aaffaa'), new THREE.Color('#ffffff')],
    };

    const targetColors: Record<GestureType, Float32Array> = {} as any;
    
    // Initial colors to start
    const initialPalette = GESTURE_COLORS.None;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const c = initialPalette[Math.floor(Math.random() * initialPalette.length)];
      col[i * 3]     = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    for (const key of Object.keys(tgts) as GestureType[]) {
      const palette = GESTURE_COLORS[key] || GESTURE_COLORS.None;
      const colArr = new Float32Array(PARTICLE_COUNT * 3);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const c = palette[Math.floor(Math.random() * palette.length)];
        colArr[i * 3]     = c.r;
        colArr[i * 3 + 1] = c.g;
        colArr[i * 3 + 2] = c.b;
      }
      targetColors[key] = colArr;
    }

    return { positions: pos, targets: tgts, targetColors, colors: col, sizes: sz };
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const colorArray = pointsRef.current.geometry.attributes.color.array as Float32Array;
    
    const targetArray = targets[gesture] || targets.None;
    const targetColorArray = targetColors[gesture] || targetColors.None;

    const lerpFactor = 0.05;
    const colorLerpFactor = 0.08;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Lerp towards target position
      posArray[i3]     += (targetArray[i3]     - posArray[i3])     * lerpFactor;
      posArray[i3 + 1] += (targetArray[i3 + 1] - posArray[i3 + 1]) * lerpFactor;
      posArray[i3 + 2] += (targetArray[i3 + 2] - posArray[i3 + 2]) * lerpFactor;

      // Lerp towards target color
      colorArray[i3]     += (targetColorArray[i3]     - colorArray[i3])     * colorLerpFactor;
      colorArray[i3 + 1] += (targetColorArray[i3 + 1] - colorArray[i3 + 1]) * colorLerpFactor;
      colorArray[i3 + 2] += (targetColorArray[i3 + 2] - colorArray[i3 + 2]) * colorLerpFactor;

      // Very subtle floating noise
      posArray[i3 + 1] += Math.sin(state.clock.elapsedTime * 2 + posArray[i3]) * 0.0005;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;

    // --- Mesh-level Animations based on Gesture ---
    const t = state.clock.elapsedTime;
    
    // Base targets to snap back to center/facing camera
    const pi2 = Math.PI * 2;
    let targetRotY = Math.round(pointsRef.current.rotation.y / pi2) * pi2;
    let targetRotZ = Math.round(pointsRef.current.rotation.z / pi2) * pi2;
    let rotSpeed = 0.08;

    if (gesture === 'None') {
      // Galaxy idle: spin freely
      targetRotY = pointsRef.current.rotation.y + delta * 0.15;
      targetRotZ = pointsRef.current.rotation.z + delta * 0.05;
      rotSpeed = 1;
    }

    // Reset position smoothly
    pointsRef.current.position.y += (0 - pointsRef.current.position.y) * 0.1;

    // Apply rotations
    pointsRef.current.rotation.x += (0 - pointsRef.current.rotation.x) * rotSpeed;
    pointsRef.current.rotation.y += (targetRotY - pointsRef.current.rotation.y) * rotSpeed;
    pointsRef.current.rotation.z += (targetRotZ - pointsRef.current.rotation.z) * rotSpeed;
    
    // Apply scale
    pointsRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.15);

    // Apply fade in fade out for all
    const material = pointsRef.current.material as THREE.PointsMaterial;
    if (material) {
      material.opacity = 0.5 + Math.sin(t * 2.5) * 0.4;
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
