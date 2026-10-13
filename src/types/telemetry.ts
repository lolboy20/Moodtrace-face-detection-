export type EmotionType =
  | 'joy'
  | 'focus'
  | 'neutral'
  | 'surprise'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'disgust';

export type EmotionScores = Record<EmotionType, number>;

export interface ActionUnits {
  AU01_InnerBrowRaiser: number;
  AU04_BrowLowerer: number;
  AU06_CheekRaiser: number;
  AU09_NoseWrinkler: number;
  AU10_UpperLipRaiser: number;
  AU12_LipCornerPuller: number;
  AU15_LipCornerDepressor: number;
  AU26_JawDrop: number;
}

export interface HeadPose {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface FaceBoundingBox {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width: number; // normalized 0..1
  height: number; // normalized 0..1
}

export interface TelemetryLogEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  subjectLabel: string;
  sourceMode: 'optical_camera' | 'synthetic_calibration';
  dominantEmotion: EmotionType;
  confidence: number; // 0..100
  valence: number; // -1.00 to +1.00
  arousal: number; // 0.00 to 1.00
  heartRateEstBpm: number; // rPPG optical estimate 58..115
  scores: EmotionScores;
  actionUnits: ActionUnits;
  headPose: HeadPose;
  triggeredAlertIds: string[];
}

export type AlertConditionMetric =
  | EmotionType
  | 'negative_valence'
  | 'high_arousal'
  | 'emotional_volatility'
  | 'all_expressions_volatility';

export interface MoodAlertRule {
  id: string;
  name: string;
  description: string;
  metric: AlertConditionMetric;
  operator: 'gte' | 'lte';
  threshold: number; // Percentage 0..100
  sustainedSamples: number; // Consecutive log frames required
  severity: 'advisory' | 'warning' | 'critical';
  soundEnabled: boolean;
  autoSnapshot: boolean;
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt: string | null;
}

export interface AlertIncident {
  id: string;
  timestamp: string;
  ruleId: string;
  ruleName: string;
  severity: 'advisory' | 'warning' | 'critical';
  metric: AlertConditionMetric;
  measuredValue: number;
  thresholdValue: number;
  dominantEmotion: EmotionType;
  valence: number;
  arousal: number;
  subjectLabel: string;
  acknowledged: boolean;
  notes?: string;
}

export interface CloudDashboardState {
  logs: TelemetryLogEntry[];
  rules: MoodAlertRule[];
  incidents: AlertIncident[];
  cloudSyncMetadata: {
    region: string;
    lastSyncedAt: string;
    totalIngestedFrames: number;
    storageStatus: 'Nominal' | 'Syncing' | 'Degraded';
  };
}
