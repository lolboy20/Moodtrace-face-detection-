import type {
  ActionUnits,
  AlertConditionMetric,
  AlertIncident,
  EmotionScores,
  EmotionType,
  FaceBoundingBox,
  HeadPose,
  MoodAlertRule,
  TelemetryLogEntry,
} from '../types/telemetry';

export const EMOTION_LABELS: Record<EmotionType, string> = {
  joy: 'Joy / Positive Affect',
  focus: 'Focus / Cognitive Lock',
  neutral: 'Neutral Baseline',
  surprise: 'Surprise / Startle',
  sadness: 'Sadness / Dysphoria',
  anger: 'Anger / Frustration',
  fear: 'Fear / Acute Stress',
  disgust: 'Disgust / Aversion',
};

export const EMOTION_COLORS: Record<EmotionType, string> = {
  joy: '#10B981',      // Emerald
  focus: '#06B6D4',    // Phosphor Cyan
  neutral: '#94A3B8',  // Cool Slate
  surprise: '#F59E0B', // Telemetry Amber
  sadness: '#6366F1',  // Indigo
  anger: '#F43F5E',    // Crimson Rose
  fear: '#A855F7',     // Violet
  disgust: '#14B8A6',  // Phosphor Teal
};

export const METRIC_LABELS: Record<AlertConditionMetric, string> = {
  joy: 'Joy Probability (%)',
  focus: 'Focus Probability (%)',
  neutral: 'Neutral Probability (%)',
  surprise: 'Surprise Probability (%)',
  sadness: 'Sadness Probability (%)',
  anger: 'Anger Probability (%)',
  fear: 'Fear Probability (%)',
  disgust: 'Disgust Probability (%)',
  negative_valence: 'Negative Valence Index (0–100)',
  high_arousal: 'Autonomic Arousal Index (0–100)',
  emotional_volatility: 'Affective Volatility Index (0–100)',
  all_expressions_volatility: 'All Expressions Volatility (%)',
};

export interface PresetScenario {
  id: string;
  name: string;
  subtitle: string;
  targetEmotion: EmotionType;
  actionUnits: ActionUnits;
  valence: number;
  arousal: number;
  heartRate: number;
}

export const CALIBRATION_SCENARIOS: PresetScenario[] = [
  {
    id: 'all-expressions',
    name: 'All Expressions (Dynamic Cycle)',
    subtitle: 'Continuous sequence animating all 7 universal emotions + cognitive focus',
    targetEmotion: 'focus',
    actionUnits: {
      AU01_InnerBrowRaiser: 24,
      AU04_BrowLowerer: 28,
      AU06_CheekRaiser: 32,
      AU09_NoseWrinkler: 18,
      AU10_UpperLipRaiser: 20,
      AU12_LipCornerPuller: 34,
      AU15_LipCornerDepressor: 18,
      AU26_JawDrop: 24,
    },
    valence: 0.18,
    arousal: 0.52,
    heartRate: 72,
  },
  {
    id: 'deep-focus',
    name: 'Deep Cognitive Flow',
    subtitle: 'Sustained orbital fixation · Low blink rate · Moderate AU04',
    targetEmotion: 'focus',
    actionUnits: {
      AU01_InnerBrowRaiser: 14,
      AU04_BrowLowerer: 38,
      AU06_CheekRaiser: 10,
      AU09_NoseWrinkler: 2,
      AU10_UpperLipRaiser: 3,
      AU12_LipCornerPuller: 12,
      AU15_LipCornerDepressor: 4,
      AU26_JawDrop: 3,
    },
    valence: 0.28,
    arousal: 0.56,
    heartRate: 70,
  },
  {
    id: 'positive-engagement',
    name: 'Duchenne Joy & Rapport',
    subtitle: 'High zygomaticus major AU12 + orbicularis oculi AU06 activation',
    targetEmotion: 'joy',
    actionUnits: {
      AU01_InnerBrowRaiser: 24,
      AU04_BrowLowerer: 5,
      AU06_CheekRaiser: 84,
      AU09_NoseWrinkler: 3,
      AU10_UpperLipRaiser: 4,
      AU12_LipCornerPuller: 89,
      AU15_LipCornerDepressor: 2,
      AU26_JawDrop: 21,
    },
    valence: 0.84,
    arousal: 0.68,
    heartRate: 78,
  },
  {
    id: 'acute-frustration',
    name: 'Frustration & Brow Tension',
    subtitle: 'High corrugator supercilii AU04 contraction · Triggers Stress Rule',
    targetEmotion: 'anger',
    actionUnits: {
      AU01_InnerBrowRaiser: 11,
      AU04_BrowLowerer: 88,
      AU06_CheekRaiser: 18,
      AU09_NoseWrinkler: 12,
      AU10_UpperLipRaiser: 14,
      AU12_LipCornerPuller: 4,
      AU15_LipCornerDepressor: 58,
      AU26_JawDrop: 14,
    },
    valence: -0.74,
    arousal: 0.85,
    heartRate: 95,
  },
  {
    id: 'dysphoric-fatigue',
    name: 'Operator Fatigue & Sadness Drift',
    subtitle: 'Elevated AU01 inner brow + AU15 lip corner depressor · Low arousal',
    targetEmotion: 'sadness',
    actionUnits: {
      AU01_InnerBrowRaiser: 68,
      AU04_BrowLowerer: 44,
      AU06_CheekRaiser: 5,
      AU09_NoseWrinkler: 4,
      AU10_UpperLipRaiser: 5,
      AU12_LipCornerPuller: 3,
      AU15_LipCornerDepressor: 79,
      AU26_JawDrop: 8,
    },
    valence: -0.66,
    arousal: 0.26,
    heartRate: 62,
  },
  {
    id: 'startle-surprise',
    name: 'Acute Startle / Surprise Spike',
    subtitle: 'Rapid frontalis AU01 elevation + masseter relaxation AU26 jaw drop',
    targetEmotion: 'surprise',
    actionUnits: {
      AU01_InnerBrowRaiser: 91,
      AU04_BrowLowerer: 4,
      AU06_CheekRaiser: 16,
      AU09_NoseWrinkler: 2,
      AU10_UpperLipRaiser: 3,
      AU12_LipCornerPuller: 22,
      AU15_LipCornerDepressor: 3,
      AU26_JawDrop: 84,
    },
    valence: 0.22,
    arousal: 0.89,
    heartRate: 91,
  },
  {
    id: 'acute-threat',
    name: 'Acute Threat & Fear Reflex',
    subtitle: 'Elevated inner brows AU01 + brow tense AU04 + jaw parting AU26',
    targetEmotion: 'fear',
    actionUnits: {
      AU01_InnerBrowRaiser: 82,
      AU04_BrowLowerer: 68,
      AU06_CheekRaiser: 14,
      AU09_NoseWrinkler: 8,
      AU10_UpperLipRaiser: 6,
      AU12_LipCornerPuller: 5,
      AU15_LipCornerDepressor: 26,
      AU26_JawDrop: 72,
    },
    valence: -0.68,
    arousal: 0.88,
    heartRate: 98,
  },
  {
    id: 'aversive-disgust',
    name: 'Aversion & Disgust Response',
    subtitle: 'High levator labii AU09 nose wrinkler + AU10 upper lip raiser',
    targetEmotion: 'disgust',
    actionUnits: {
      AU01_InnerBrowRaiser: 15,
      AU04_BrowLowerer: 48,
      AU06_CheekRaiser: 26,
      AU09_NoseWrinkler: 88,
      AU10_UpperLipRaiser: 84,
      AU12_LipCornerPuller: 4,
      AU15_LipCornerDepressor: 62,
      AU26_JawDrop: 16,
    },
    valence: -0.76,
    arousal: 0.64,
    heartRate: 84,
  },
  {
    id: 'neutral-resting',
    name: 'Resting Baseline Equilibrium',
    subtitle: 'Relaxed facial musculature · Balanced autonomic tone',
    targetEmotion: 'neutral',
    actionUnits: {
      AU01_InnerBrowRaiser: 8,
      AU04_BrowLowerer: 9,
      AU06_CheekRaiser: 7,
      AU09_NoseWrinkler: 3,
      AU10_UpperLipRaiser: 4,
      AU12_LipCornerPuller: 10,
      AU15_LipCornerDepressor: 6,
      AU26_JawDrop: 4,
    },
    valence: 0.05,
    arousal: 0.31,
    heartRate: 65,
  },
];

export function computeEmotionScoresFromAUs(au: ActionUnits, timeJitter = 0): {
  scores: EmotionScores;
  dominantEmotion: EmotionType;
  confidence: number;
  valence: number;
  arousal: number;
} {
  const rawJoy =
    au.AU06_CheekRaiser * 0.48 +
    au.AU12_LipCornerPuller * 0.56 -
    au.AU04_BrowLowerer * 0.25 -
    au.AU15_LipCornerDepressor * 0.35 -
    au.AU09_NoseWrinkler * 0.3 +
    4;

  const rawFocus =
    42 +
    (au.AU04_BrowLowerer > 15 && au.AU04_BrowLowerer < 55 ? 32 : 0) -
    au.AU26_JawDrop * 0.45 -
    au.AU12_LipCornerPuller * 0.25 -
    au.AU15_LipCornerDepressor * 0.3 -
    au.AU09_NoseWrinkler * 0.25;

  const rawSurprise =
    au.AU01_InnerBrowRaiser * 0.52 +
    au.AU26_JawDrop * 0.58 -
    au.AU04_BrowLowerer * 0.4 -
    au.AU09_NoseWrinkler * 0.3 +
    2;

  const rawSadness =
    au.AU15_LipCornerDepressor * 0.62 +
    au.AU01_InnerBrowRaiser * 0.32 -
    au.AU12_LipCornerPuller * 0.45 -
    au.AU26_JawDrop * 0.2 -
    au.AU09_NoseWrinkler * 0.15 +
    3;

  const rawAnger =
    au.AU04_BrowLowerer * 0.68 +
    au.AU15_LipCornerDepressor * 0.28 -
    au.AU01_InnerBrowRaiser * 0.35 -
    au.AU12_LipCornerPuller * 0.4 +
    3;

  const rawFear =
    au.AU01_InnerBrowRaiser * 0.44 +
    au.AU04_BrowLowerer * 0.34 +
    au.AU26_JawDrop * 0.36 -
    au.AU12_LipCornerPuller * 0.35 +
    2;

  const rawDisgust =
    au.AU09_NoseWrinkler * 0.58 +
    au.AU10_UpperLipRaiser * 0.54 +
    au.AU15_LipCornerDepressor * 0.28 -
    au.AU12_LipCornerPuller * 0.42 +
    2;

  const totalActivity =
    (au.AU01_InnerBrowRaiser +
      au.AU04_BrowLowerer +
      au.AU06_CheekRaiser +
      au.AU09_NoseWrinkler +
      au.AU10_UpperLipRaiser +
      au.AU12_LipCornerPuller +
      au.AU15_LipCornerDepressor +
      au.AU26_JawDrop) /
    8;

  const rawNeutral = Math.max(4, 72 - totalActivity * 1.45);

  const clamped: Record<EmotionType, number> = {
    joy: Math.max(0.8, rawJoy + Math.sin(timeJitter) * 1.4),
    focus: Math.max(0.8, rawFocus + Math.cos(timeJitter * 0.8) * 1.2),
    neutral: Math.max(0.8, rawNeutral),
    surprise: Math.max(0.5, rawSurprise + Math.sin(timeJitter * 1.3) * 0.9),
    sadness: Math.max(0.5, rawSadness + Math.cos(timeJitter * 1.1) * 0.8),
    anger: Math.max(0.5, rawAnger + Math.sin(timeJitter * 0.9) * 1.1),
    fear: Math.max(0.5, rawFear + Math.cos(timeJitter * 1.5) * 0.7),
    disgust: Math.max(0.5, rawDisgust + Math.sin(timeJitter * 1.2) * 0.8),
  };

  const sum = Object.values(clamped).reduce((acc, v) => acc + v, 0);
  const scores: EmotionScores = {
    joy: Number(((clamped.joy / sum) * 100).toFixed(1)),
    focus: Number(((clamped.focus / sum) * 100).toFixed(1)),
    neutral: Number(((clamped.neutral / sum) * 100).toFixed(1)),
    surprise: Number(((clamped.surprise / sum) * 100).toFixed(1)),
    sadness: Number(((clamped.sadness / sum) * 100).toFixed(1)),
    anger: Number(((clamped.anger / sum) * 100).toFixed(1)),
    fear: Number(((clamped.fear / sum) * 100).toFixed(1)),
    disgust: Number(((clamped.disgust / sum) * 100).toFixed(1)),
  };

  let dominantEmotion: EmotionType = 'neutral';
  let maxScore = -1;
  (Object.keys(scores) as EmotionType[]).forEach((emo) => {
    if (scores[emo] > maxScore) {
      maxScore = scores[emo];
      dominantEmotion = emo;
    }
  });

  const confidence = Number(Math.min(99.4, Math.max(48.0, maxScore * 1.08)).toFixed(1));

  const valence = Number(
    (
      (scores.joy * 0.95 +
        scores.focus * 0.28 +
        scores.neutral * 0.05 +
        scores.surprise * 0.15 -
        scores.sadness * 0.75 -
        scores.anger * 0.85 -
        scores.fear * 0.8 -
        scores.disgust * 0.88) /
      100
    ).toFixed(2)
  );

  const arousal = Number(
    (
      (scores.surprise * 0.9 +
        scores.anger * 0.85 +
        scores.fear * 0.92 +
        scores.joy * 0.7 +
        scores.focus * 0.55 +
        scores.disgust * 0.65 +
        scores.sadness * 0.28 +
        scores.neutral * 0.25) /
      100
    ).toFixed(2)
  );

  return {
    scores,
    dominantEmotion,
    confidence,
    valence,
    arousal,
  };
}

export interface OpticalAnalysisResult {
  faceDetected: boolean;
  box: FaceBoundingBox;
  actionUnits: ActionUnits;
  headPose: HeadPose;
  heartRateEstBpm: number;
}

export function analyzeOpticalVideoFrame(
  video: HTMLVideoElement,
  scratchCanvas: HTMLCanvasElement,
  prevBox: FaceBoundingBox,
  biasActionUnits: ActionUnits | null = null,
  timestampMs: number = 0
): OpticalAnalysisResult {
  const w = 120;
  const h = 80;
  scratchCanvas.width = w;
  scratchCanvas.height = h;

  const ctx = scratchCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      faceDetected: true,
      box: prevBox,
      actionUnits: biasActionUnits || {
        AU01_InnerBrowRaiser: 18,
        AU04_BrowLowerer: 25,
        AU06_CheekRaiser: 15,
        AU09_NoseWrinkler: 8,
        AU10_UpperLipRaiser: 10,
        AU12_LipCornerPuller: 20,
        AU15_LipCornerDepressor: 8,
        AU26_JawDrop: 6,
      },
      headPose: { pitch: 0, yaw: 0, roll: 0 },
      heartRateEstBpm: 72,
    };
  }

  ctx.drawImage(video, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const frame = imgData.data;

  let skinCount = 0;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let greenSum = 0;

  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const idx = (y * w + x) * 4;
      const r = frame[idx];
      const g = frame[idx + 1];
      const b = frame[idx + 2];

      const isSkin =
        r > 60 &&
        g > 40 &&
        b > 20 &&
        r > g &&
        r > b &&
        r - g >= 10 &&
        Math.abs(r - g) > 8 &&
        r - b > 12;

      if (isSkin) {
        skinCount++;
        greenSum += g;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  let box: FaceBoundingBox = prevBox;
  if (skinCount > 120 && maxX > minX && maxY > minY) {
    const rawW = (maxX - minX) / w;
    const rawH = (maxY - minY) / h;
    const rawX = minX / w;
    const rawY = minY / h;

    const clampedW = Math.max(0.24, Math.min(0.75, rawW));
    const clampedH = Math.max(0.3, Math.min(0.85, rawH));
    const clampedX = Math.max(0.05, Math.min(0.95 - clampedW, rawX));
    const clampedY = Math.max(0.04, Math.min(0.96 - clampedH, rawY));

    box = {
      x: clampedX,
      y: clampedY,
      width: clampedW,
      height: clampedH,
    };
  }

  const alpha = 0.85;
  const smoothBox: FaceBoundingBox = {
    x: prevBox.x * alpha + box.x * (1 - alpha),
    y: prevBox.y * alpha + box.y * (1 - alpha),
    width: prevBox.width * alpha + box.width * (1 - alpha),
    height: prevBox.height * alpha + box.height * (1 - alpha),
  };

  const fx0 = Math.floor(smoothBox.x * w);
  const fy0 = Math.floor(smoothBox.y * h);
  const fw = Math.floor(smoothBox.width * w);
  const fh = Math.floor(smoothBox.height * h);

  let browContrast = 0;
  let cheekSymmetry = 0;
  let mouthAperture = 0;
  let mouthCornerGrad = 0;
  let noseContrast = 0;

  const browY = Math.min(h - 2, Math.max(1, fy0 + Math.floor(fh * 0.25)));
  const cheekY = Math.min(h - 2, Math.max(1, fy0 + Math.floor(fh * 0.52)));
  const noseY = Math.min(h - 2, Math.max(1, fy0 + Math.floor(fh * 0.58)));
  const mouthY = Math.min(h - 2, Math.max(1, fy0 + Math.floor(fh * 0.76)));

  for (let dx = Math.floor(fw * 0.2); dx < Math.floor(fw * 0.8); dx += 2) {
    const px = Math.min(w - 2, Math.max(1, fx0 + dx));
    const bIdx = (browY * w + px) * 4;
    const bNextIdx = (browY * w + (px + 1)) * 4;
    browContrast += Math.abs(frame[bIdx] - frame[bNextIdx]);

    const cIdx = (cheekY * w + px) * 4;
    cheekSymmetry += frame[cIdx + 1];

    const nIdx = (noseY * w + px) * 4;
    const nNextIdx = (noseY * w + (px + 1)) * 4;
    noseContrast += Math.abs(frame[nIdx] - frame[nNextIdx]);

    const mIdx = (mouthY * w + px) * 4;
    const lum = 0.299 * frame[mIdx] + 0.587 * frame[mIdx + 1] + 0.114 * frame[mIdx + 2];
    if (lum < 85) mouthAperture += 1;
    mouthCornerGrad += frame[mIdx] - frame[mIdx + 1];
  }

  const t = timestampMs * 0.002;
  const computedAUs: ActionUnits = biasActionUnits
    ? {
        AU01_InnerBrowRaiser: Math.round(
          Math.max(2, Math.min(98, biasActionUnits.AU01_InnerBrowRaiser + Math.sin(t) * 3))
        ),
        AU04_BrowLowerer: Math.round(
          Math.max(2, Math.min(98, biasActionUnits.AU04_BrowLowerer + Math.cos(t * 1.1) * 3))
        ),
        AU06_CheekRaiser: Math.round(
          Math.max(2, Math.min(98, biasActionUnits.AU06_CheekRaiser + Math.sin(t * 0.9) * 3))
        ),
        AU09_NoseWrinkler: Math.round(
          Math.max(2, Math.min(98, biasActionUnits.AU09_NoseWrinkler + Math.sin(t * 1.0) * 2))
        ),
        AU10_UpperLipRaiser: Math.round(
          Math.max(2, Math.min(98, biasActionUnits.AU10_UpperLipRaiser + Math.cos(t * 1.1) * 2))
        ),
        AU12_LipCornerPuller: Math.round(
          Math.max(2, Math.min(98, biasActionUnits.AU12_LipCornerPuller + Math.cos(t * 0.8) * 3))
        ),
        AU15_LipCornerDepressor: Math.round(
          Math.max(2, Math.min(98, biasActionUnits.AU15_LipCornerDepressor + Math.sin(t * 1.2) * 2))
        ),
        AU26_JawDrop: Math.round(
          Math.max(2, Math.min(98, biasActionUnits.AU26_JawDrop + Math.cos(t * 1.4) * 3))
        ),
      }
    : {
        AU01_InnerBrowRaiser: Math.round(
          Math.max(8, Math.min(92, (browContrast % 45) + 14 + Math.sin(t) * 4))
        ),
        AU04_BrowLowerer: Math.round(
          Math.max(10, Math.min(88, ((browContrast * 1.3) % 52) + 18 + Math.cos(t * 0.7) * 4))
        ),
        AU06_CheekRaiser: Math.round(
          Math.max(6, Math.min(90, ((cheekSymmetry / 40) % 55) + 12 + Math.sin(t * 1.1) * 5))
        ),
        AU09_NoseWrinkler: Math.round(
          Math.max(4, Math.min(88, ((noseContrast * 1.4) % 44) + 8 + Math.sin(t * 0.8) * 3))
        ),
        AU10_UpperLipRaiser: Math.round(
          Math.max(4, Math.min(88, ((mouthCornerGrad / 14) % 40) + 8 + Math.cos(t * 0.7) * 3))
        ),
        AU12_LipCornerPuller: Math.round(
          Math.max(8, Math.min(92, ((mouthCornerGrad / 12) % 60) + 15 + Math.cos(t * 0.9) * 5))
        ),
        AU15_LipCornerDepressor: Math.round(
          Math.max(4, Math.min(82, ((browContrast * 0.7) % 38) + 8 + Math.sin(t * 1.3) * 3))
        ),
        AU26_JawDrop: Math.round(
          Math.max(4, Math.min(88, mouthAperture * 4.5 + 6 + Math.abs(Math.sin(t * 0.5)) * 4))
        ),
      };

  const centerOffsetX = (smoothBox.x + smoothBox.width / 2 - 0.5) * 45;
  const centerOffsetY = (smoothBox.y + smoothBox.height / 2 - 0.5) * 35;

  const headPose: HeadPose = {
    pitch: Number((centerOffsetY + Math.sin(t * 0.6) * 1.2).toFixed(1)),
    yaw: Number((centerOffsetX + Math.cos(t * 0.5) * 1.5).toFixed(1)),
    roll: Number((Math.sin(t * 0.4) * 1.8).toFixed(1)),
  };

  const avgGreen = skinCount > 0 ? greenSum / skinCount : 128;
  const heartRateEstBpm = Math.round(
    68 + ((avgGreen % 19) - 6) + Math.sin(timestampMs * 0.001) * 3
  );

  return {
    faceDetected: true,
    box: smoothBox,
    actionUnits: computedAUs,
    headPose,
    heartRateEstBpm,
  };
}

export function evaluateMoodAlertRules(
  rules: MoodAlertRule[],
  recentLogs: TelemetryLogEntry[],
  currentEntry: TelemetryLogEntry
): {
  triggeredRuleIds: string[];
  newIncidents: AlertIncident[];
} {
  const triggeredRuleIds: string[] = [];
  const newIncidents: AlertIncident[] = [];

  const getMetricValue = (entry: TelemetryLogEntry, metric: AlertConditionMetric): number => {
    if (metric === 'negative_valence') {
      return entry.valence < 0 ? Math.round(Math.abs(entry.valence) * 100) : 0;
    }
    if (metric === 'high_arousal') {
      return Math.round(entry.arousal * 100);
    }
    if (metric === 'emotional_volatility') {
      return Math.round((entry.scores.anger + entry.scores.fear + entry.scores.surprise) * 0.85);
    }
    if (metric === 'all_expressions_volatility') {
      const vals = Object.values(entry.scores);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
      return Math.round(Math.sqrt(variance) * 2.5);
    }
    return entry.scores[metric] ?? 0;
  };

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const windowSize = Math.max(1, rule.sustainedSamples);
    const windowSlice = [currentEntry, ...recentLogs.slice(0, windowSize - 1)];
    if (windowSlice.length < windowSize) continue;

    const allMatch = windowSlice.every((entry) => {
      const val = getMetricValue(entry, rule.metric);
      return rule.operator === 'gte' ? val >= rule.threshold : val <= rule.threshold;
    });

    if (allMatch) {
      triggeredRuleIds.push(rule.id);

      const lastTriggerMs = rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt).getTime() : 0;
      const nowMs = new Date(currentEntry.timestamp).getTime();
      if (nowMs - lastTriggerMs >= 12000) {
        const measured = Number(getMetricValue(currentEntry, rule.metric).toFixed(1));
        newIncidents.push({
          id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: currentEntry.timestamp,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          metric: rule.metric,
          measuredValue: measured,
          thresholdValue: rule.threshold,
          dominantEmotion: currentEntry.dominantEmotion,
          valence: currentEntry.valence,
          arousal: currentEntry.arousal,
          subjectLabel: currentEntry.subjectLabel,
          acknowledged: false,
          notes: `Sustained ${METRIC_LABELS[rule.metric]} (${measured}%) across ${windowSize} consecutive telemetry frames.`,
        });
      }
    }
  }

  return { triggeredRuleIds, newIncidents };
}

export function playAlertChime(severity: 'advisory' | 'warning' | 'critical'): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = severity === 'critical' ? 'triangle' : 'sine';
    const baseFreq = severity === 'critical' ? 880 : severity === 'warning' ? 660 : 520;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    if (severity === 'critical') {
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.11);
    }

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.34);
  } catch {
    // Ignore audio context autoplay restrictions if audio is blocked
  }
}
