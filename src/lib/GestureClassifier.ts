import { HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

export type GestureType =
  | 'None'
  | 'Open_Hand'
  | 'Peace'
  | 'Call_Me'
  | 'Thumbs_Up'
  | 'Point_Up'
  | 'Rock'
  | 'Kamehameha'
  | 'Double_Peace';

export interface FingerState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
  openCount: number; 
}

export class GestureClassifier {
  /**
   * Helper to evaluate a single hand's basic gesture
   */
  private static evaluateSingleHand(hand: NormalizedLandmark[]): { gesture: GestureType, fingers: FingerState, openCount: number } {
    const indexOpen  = hand[8].y  < hand[6].y;
    const middleOpen = hand[12].y < hand[10].y;
    const ringOpen   = hand[16].y < hand[14].y;
    const pinkyOpen  = hand[20].y < hand[18].y;

    const indexMcp = hand[5];
    const thumbIp  = hand[3];
    const thumbTip = hand[4];

    const tipToIndex = Math.hypot(thumbTip.x - indexMcp.x, thumbTip.y - indexMcp.y);
    const ipToIndex = Math.hypot(thumbIp.x - indexMcp.x, thumbIp.y - indexMcp.y);
    const thumbOpen = tipToIndex > ipToIndex * 1.15;

    const openFingers = [indexOpen, middleOpen, ringOpen, pinkyOpen];
    const openCount = openFingers.filter(Boolean).length;

    const fingers: FingerState = { thumb: thumbOpen, index: indexOpen, middle: middleOpen, ring: ringOpen, pinky: pinkyOpen, openCount };
    let gesture: GestureType = 'None';

    if (thumbOpen && openCount === 0) gesture = 'Thumbs_Up';
    else if (thumbOpen && !indexOpen && !middleOpen && !ringOpen && pinkyOpen) gesture = 'Call_Me';
    else if (indexOpen && pinkyOpen && !middleOpen && !ringOpen) gesture = 'Rock';
    else if (openCount === 1 && indexOpen) gesture = 'Point_Up';
    else if (indexOpen && middleOpen && !ringOpen && !pinkyOpen) gesture = 'Peace';
    else if (openCount >= 3) gesture = 'Open_Hand';

    return { gesture, fingers, openCount: openCount + (thumbOpen ? 1 : 0) }; // total open fingers
  }

  static classifyWithDebug(result: HandLandmarkerResult): {
    gesture: GestureType;
    fingers: FingerState | null;
  } {
    if (!result.landmarks || result.landmarks.length === 0) {
      return { gesture: 'None', fingers: null };
    }

    const evals = result.landmarks.map(hand => this.evaluateSingleHand(hand));

    // --- 2-HAND COMBINATION GESTURES ---
    if (evals.length >= 2) {
      const [e1, e2] = evals;
      const h1 = result.landmarks[0];
      const h2 = result.landmarks[1];

      const wristDist = Math.hypot(h1[0].x - h2[0].x, h1[0].y - h2[0].y);
      const palmDist = Math.hypot(h1[9].x - h2[9].x, h1[9].y - h2[9].y);

      // 1. Kamehameha 🤲: Both hands open, palms brought close together
      if (e1.openCount >= 4 && e2.openCount >= 4 && palmDist < 0.25 && wristDist > palmDist) {
        return { gesture: 'Kamehameha', fingers: e1.fingers };
      }

      // 2. Double Peace ✌️✌️
      if (e1.gesture === 'Peace' && e2.gesture === 'Peace') {
        return { gesture: 'Double_Peace', fingers: e1.fingers };
      }
    }

    // --- SINGLE HAND FALLBACK ---
    // If we have multiple hands but no combination matched, pick the first active gesture
    for (const ev of evals) {
      if (ev.gesture !== 'None') {
        return { gesture: ev.gesture, fingers: ev.fingers };
      }
    }

    return { gesture: 'None', fingers: evals[0].fingers };
  }

  static classify(result: HandLandmarkerResult): GestureType {
    return this.classifyWithDebug(result).gesture;
  }
}
