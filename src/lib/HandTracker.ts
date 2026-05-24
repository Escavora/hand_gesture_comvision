import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });

      this.isInitialized = true;
      console.log("MediaPipe HandLandmarker initialized");
    } catch (error) {
      console.error("Error initializing MediaPipe:", error);
    }
  }

  detect(video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null {
    if (!this.handLandmarker) return null;
    return this.handLandmarker.detectForVideo(video, timestamp);
  }
}

export const handTracker = new HandTracker();
