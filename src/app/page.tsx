'use client';
import { useState, Suspense, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import WebcamCapture from '@/components/WebcamCapture';
import ParticleSystem from '@/components/ParticleSystem';
import { GestureType } from '@/lib/GestureClassifier';

const GESTURE_INFO: Record<GestureType, { label: string; emoji: string; color: string }> = {
  None:        { label: 'Diam / Galaksi',        emoji: '🌀', color: 'text-gray-400' },
  Open_Hand:   { label: 'KAMU BISA!',            emoji: '✋', color: 'text-yellow-400' },
  Peace:       { label: 'TERUS MAJU!',           emoji: '✌️', color: 'text-green-400' },
  Call_Me:     { label: 'NIKMATIN AJA DULU!',    emoji: '🤙', color: 'text-pink-400' },
  Thumbs_Up:   { label: 'KERJA BAGUS!',          emoji: '👍', color: 'text-blue-400' },
  Point_Up:    { label: 'KAMU NO.1!',            emoji: '☝️', color: 'text-purple-400' },
  Rock:        { label: 'SEMANGAT!',             emoji: '🤘', color: 'text-orange-400' },
  Kamehameha:  { label: 'HAA!!!',                emoji: '🤲', color: 'text-cyan-300' },
  Double_Peace:{ label: 'CHILL BRO',             emoji: '✌️✌️', color: 'text-green-300' },
};

export default function Home() {
  const [gesture, setGesture] = useState<GestureType>('None');
  const info = GESTURE_INFO[gesture] || GESTURE_INFO['None'];

  return (
    <main className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 12], fov: 65 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <Suspense fallback={null}>
            <ParticleSystem gesture={gesture} />
          </Suspense>
        </Canvas>
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute top-0 left-0 w-full p-4 z-10 pointer-events-none flex justify-between items-start">
        {/* Title panel */}
        <div className="glass-panel p-3 border-cyan-500/30">
          <p className="text-gray-400 font-mono text-[10px] max-w-[200px]">
            Tunjukkan tanganmu ke kamera. Setiap gestur akan memunculkan pesan semangat dari partikel kosmik.
          </p>
        </div>

        {/* Active gesture panel */}
        <div className="glass-panel p-3 flex flex-col items-end border-cyan-500/30 min-w-[140px]">
          <div className="flex items-center gap-2">
            <span className="text-lg">{info.emoji}</span>
            <span className={`text-sm font-bold tracking-wide ${info.color}`}>{info.label}</span>
          </div>
        </div>
      </div>

      {/* Gesture guide — bottom right */}
      <div className="absolute bottom-4 right-4 z-10 glass-panel p-3 border-cyan-500/30 pointer-events-none">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
          {Object.entries(GESTURE_INFO).filter(([k]) => k !== 'None').map(([key, val]) => (
            <div key={key} className={`flex items-center gap-2 transition-opacity duration-300 ${gesture === key ? 'opacity-100' : 'opacity-40'}`}>
              <span className="text-sm">{val.emoji}</span>
              <span className="text-gray-300 text-[10px]">{val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Webcam Component */}
      <WebcamCapture onGesture={setGesture} />
    </main>
  );
}
