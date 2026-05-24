'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { handTracker } from '@/lib/HandTracker';
import { GestureClassifier, GestureType, FingerState } from '@/lib/GestureClassifier';

// MediaPipe hand connections for drawing skeleton
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],       // thumb
  [0,5],[5,6],[6,7],[7,8],       // index
  [0,9],[9,10],[10,11],[11,12],  // middle
  [0,13],[13,14],[14,15],[15,16],// ring
  [0,17],[17,18],[18,19],[19,20],// pinky
  [5,9],[9,13],[13,17],          // palm
];

export default function WebcamCapture({ onGesture }: { onGesture: (g: GestureType) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugGesture, setDebugGesture] = useState<GestureType>('None');
  const [fingerState, setFingerState] = useState<FingerState | null>(null);

  const drawLandmarks = useCallback((landmarks: { x: number; y: number; z: number }[][]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const hand of landmarks) {
      // Draw connections (skeleton lines)
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      for (const [start, end] of HAND_CONNECTIONS) {
        const p1 = hand[start];
        const p2 = hand[end];
        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      }

      // Draw landmark points
      ctx.shadowBlur = 0;
      for (let i = 0; i < hand.length; i++) {
        const lm = hand[i];
        const x = lm.x * canvas.width;
        const y = lm.y * canvas.height;
        const isTip = [4, 8, 12, 16, 20].includes(i);

        // Tips get bigger, brighter dots
        ctx.beginPath();
        ctx.arc(x, y, isTip ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isTip ? '#ff003c' : '#00f0ff';
        ctx.fill();

        if (isTip) {
          // Glow ring around tips
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 0, 60, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
  }, []);

  useEffect(() => {
    async function setupCamera() {
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve) => {
          videoRef.current!.onloadedmetadata = () => {
            resolve(null);
          };
        });
        videoRef.current.play();

        await handTracker.initialize();
        setIsReady(true);
      } catch (e) {
        console.error("Camera access denied or unavailable", e);
        setError("Camera Error");
      }
    }
    setupCamera();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    let animationFrameId: number;
    let lastVideoTime = -1;

    function renderLoop() {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const time = videoRef.current.currentTime;
        if (time !== lastVideoTime) {
          const results = handTracker.detect(videoRef.current, performance.now());
          if (results) {
            const { gesture, fingers } = GestureClassifier.classifyWithDebug(results);
            
            onGesture(gesture);
            setDebugGesture(gesture);
            setFingerState(fingers);

            // Draw landmarks overlay
            if (results.landmarks && results.landmarks.length > 0) {
              drawLandmarks(results.landmarks);
            } else {
              // Clear canvas when no hand
              const canvas = canvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
            }
          }
          lastVideoTime = time;
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    }

    renderLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isReady, onGesture, drawLandmarks]);

  if (error) {
    return (
      <div className="absolute bottom-4 left-4 z-50 glass-panel p-4 flex items-center text-red-400 font-mono text-sm">
        {error}. Please allow webcam access.
      </div>
    );
  }

  const fingerNames = ['👍Jempol', '👆Telunjuk', '🖕Tengah', '💍Manis', '🤙Kelingking'];
  const fingerKeys: (keyof FingerState)[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

  return (
    <div className="absolute bottom-6 left-6 z-50 glass-panel p-3 overflow-hidden rounded-3xl transition-all duration-500 fade-in shadow-[0_0_30px_rgba(0,240,255,0.15)] border border-cyan-500/20"
         style={{ width: '480px' }}>
      <div className="relative w-full aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full object-cover transform -scale-x-100 rounded-xl"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full transform -scale-x-100 rounded-xl pointer-events-none"
        />
        {/* Gesture debug label */}
        <div className="absolute top-2 left-2 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-cyan-500/30">
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">{debugGesture}</span>
        </div>
      </div>

      {/* Finger state debug panel */}
      {fingerState && (
        <div className="mt-2 px-2 pb-1">
          <div className="flex justify-between gap-1">
            {fingerKeys.map((key, i) => (
              <div
                key={key}
                className={`flex flex-col items-center px-1.5 py-1 rounded-md text-[10px] font-mono transition-all duration-200
                  ${fingerState[key] ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-red-500/10 text-red-400/60 border border-red-500/20'}`}
              >
                <span className="text-sm">{fingerState[key] ? '🟢' : '🔴'}</span>
                <span className="whitespace-nowrap">{fingerNames[i]}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-1 text-[10px] text-gray-500 font-mono">
            Jari terbuka: {fingerState.openCount}/4 {fingerState.thumb ? '+ Jempol' : ''}
          </div>
        </div>
      )}

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md text-xs text-cyan-400 font-mono rounded-2xl">
          <span className="animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Loading ML Models...
          </span>
        </div>
      )}
    </div>
  );
}
