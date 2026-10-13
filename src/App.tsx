import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Download,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  Eye,
  Crosshair,
  Activity,
  Sun,
  Moon,
} from 'lucide-react';
import type {
  ActionUnits,
  AlertIncident,
  CloudDashboardState,
  EmotionScores,
  EmotionType,
  FaceBoundingBox,
  HeadPose,
  MoodAlertRule,
  TelemetryLogEntry,
} from './types/telemetry';
import {
  CALIBRATION_SCENARIOS,
  EMOTION_COLORS,
  EMOTION_LABELS,
  METRIC_LABELS,
  analyzeOpticalVideoFrame,
  computeEmotionScoresFromAUs,
  evaluateMoodAlertRules,
  playAlertChime,
} from './utils/emotionEngine';
import { renderBiometricOverlay } from './utils/faceMeshRenderer';
import {
  CircumplexAffectMatrix,
  EmotionSpiderRadar,
  TelemetryWaveChart,
} from './components/CloudAnalyticsCharts';
import { MoodAlertRuleManager } from './components/MoodAlertRuleManager';
import { CloudEventLedger } from './components/CloudEventLedger';

type WorkspaceTab = 'live' | 'analytics' | 'alerts' | 'ledger';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('live');

  // Theme state: 'light' or 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('moodtrace_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  });

  const isLight = theme === 'light';

  // Synchronize HTML root element class with active theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('moodtrace_theme', theme);
    } catch {
      // Ignore storage errors in private browsing
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Cloud State synced with Express Backend (/api/telemetry/*)
  const [logs, setLogs] = useState<TelemetryLogEntry[]>([]);
  const [rules, setRules] = useState<MoodAlertRule[]>([]);
  const [incidents, setIncidents] = useState<AlertIncident[]>([]);
  const [cloudMeta, setCloudMeta] = useState({
    region: 'europe-west1 (Cloud Telemetry Cluster)',
    lastSyncedAt: new Date().toISOString(),
    totalIngestedFrames: 15140,
    storageStatus: 'Nominal' as 'Nominal' | 'Syncing' | 'Degraded',
  });
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(true);

  // Camera & Optical Stream State
  const [sourceMode, setSourceMode] = useState<'optical_camera' | 'synthetic_calibration'>(
    'optical_camera'
  );
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStreamPaused, setIsStreamPaused] = useState<boolean>(false);
  const [logIntervalSec, setLogIntervalSec] = useState<number>(3);

  // HUD Layer Toggles
  const [showMesh, setShowMesh] = useState<boolean>(true);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(true);
  const [showActionUnitVectors, setShowActionUnitVectors] = useState<boolean>(true);

  // Active Calibration Scenario / Manual FACS Action Unit Override
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('all-expressions');
  const [manualAUs, setManualAUs] = useState<ActionUnits>(
    CALIBRATION_SCENARIOS[0].actionUnits
  );
  const [useManualBiasOnCamera, setUseManualBiasOnCamera] = useState<boolean>(false);

  // Live Real-Time Frame State (updated at 30 FPS)
  const [liveEmotion, setLiveEmotion] = useState<{
    dominantEmotion: EmotionType;
    confidence: number;
    valence: number;
    arousal: number;
    heartRateEstBpm: number;
    scores: EmotionScores;
    actionUnits: ActionUnits;
    headPose: HeadPose;
  }>(() => {
    const initial = computeEmotionScoresFromAUs(CALIBRATION_SCENARIOS[0].actionUnits, 0);
    return {
      ...initial,
      heartRateEstBpm: 71,
      actionUnits: CALIBRATION_SCENARIOS[0].actionUnits,
      headPose: { pitch: -0.8, yaw: 1.2, roll: 0.3 },
    };
  });

  // Active Banner Alert Notification
  const [activeBannerIncident, setActiveBannerIncident] = useState<AlertIncident | null>(
    null
  );

  // Refs for real-time 30 FPS loop & cloud logging
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const faceBoxRef = useRef<FaceBoundingBox>({
    x: 0.31,
    y: 0.14,
    width: 0.38,
    height: 0.68,
  });
  const liveStateRef = useRef(liveEmotion);
  liveStateRef.current = liveEmotion;

  const logsRef = useRef(logs);
  logsRef.current = logs;
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  // 1. Fetch Initial Cloud Dashboard State from Server
  useEffect(() => {
    let mounted = true;
    fetch('/api/telemetry/state')
      .then((res) => res.json())
      .then((data: CloudDashboardState) => {
        if (!mounted) return;
        setLogs(data.logs || []);
        setRules(data.rules || []);
        setIncidents(data.incidents || []);
        if (data.cloudSyncMetadata) {
          setCloudMeta(data.cloudSyncMetadata);
        }
        setIsLoadingCloud(false);
      })
      .catch(() => {
        if (mounted) setIsLoadingCloud(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Start or Stop Device Webcam
  const startOpticalCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setSourceMode('optical_camera');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Camera access unavailable in current browser context';
      setCameraError(
        `Optical camera unavailable (${msg}). Operating in calibrated synthetic biometric stream.`
      );
      setCameraActive(false);
      setSourceMode('synthetic_calibration');
    }
  }, []);

  const stopOpticalCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setSourceMode('synthetic_calibration');
  }, []);

  useEffect(() => {
    startOpticalCamera();
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startOpticalCamera]);

  // 3. Real-Time 30 FPS Computer Vision & Facial Mesh Rendering Loop
  useEffect(() => {
    if (!scratchCanvasRef.current) {
      scratchCanvasRef.current = document.createElement('canvas');
    }

    let animId: number;
    let lastStateUpdateMs = 0;

    const tick = (timestampMs: number) => {
      if (!isStreamPaused) {
        let currentAUs = manualAUs;
        let currentPose: HeadPose = {
          pitch: Number((Math.sin(timestampMs * 0.0012) * 2.1).toFixed(1)),
          yaw: Number((Math.cos(timestampMs * 0.0009) * 2.8).toFixed(1)),
          roll: Number((Math.sin(timestampMs * 0.0007) * 1.4).toFixed(1)),
        };
        let currentHr = Math.round(71 + Math.sin(timestampMs * 0.0015) * 3);

        if (
          sourceMode === 'optical_camera' &&
          cameraActive &&
          videoRef.current &&
          scratchCanvasRef.current
        ) {
          const optical = analyzeOpticalVideoFrame(
            videoRef.current,
            scratchCanvasRef.current,
            faceBoxRef.current,
            useManualBiasOnCamera ? manualAUs : null,
            timestampMs
          );
          faceBoxRef.current = optical.box;
          currentAUs = optical.actionUnits;
          currentPose = optical.headPose;
          currentHr = optical.heartRateEstBpm;
        } else {
          const swayX = Math.sin(timestampMs * 0.001) * 0.012;
          const swayY = Math.cos(timestampMs * 0.0013) * 0.01;
          faceBoxRef.current = {
            x: 0.31 + swayX,
            y: 0.14 + swayY,
            width: 0.38,
            height: 0.68,
          };

          if (selectedScenarioId === 'all-expressions') {
            const cycleList = CALIBRATION_SCENARIOS.filter((s) => s.id !== 'all-expressions');
            const cycleRate = timestampMs * 0.00035;
            const curIdx = Math.floor(cycleRate) % cycleList.length;
            const nxtIdx = (curIdx + 1) % cycleList.length;
            const rawFrac = cycleRate % 1;
            const frac = 0.5 - 0.5 * Math.cos(rawFrac * Math.PI);
            const auA = cycleList[curIdx].actionUnits;
            const auB = cycleList[nxtIdx].actionUnits;

            currentAUs = {
              AU01_InnerBrowRaiser: Math.round(auA.AU01_InnerBrowRaiser * (1 - frac) + auB.AU01_InnerBrowRaiser * frac),
              AU04_BrowLowerer: Math.round(auA.AU04_BrowLowerer * (1 - frac) + auB.AU04_BrowLowerer * frac),
              AU06_CheekRaiser: Math.round(auA.AU06_CheekRaiser * (1 - frac) + auB.AU06_CheekRaiser * frac),
              AU09_NoseWrinkler: Math.round(auA.AU09_NoseWrinkler * (1 - frac) + auB.AU09_NoseWrinkler * frac),
              AU10_UpperLipRaiser: Math.round(auA.AU10_UpperLipRaiser * (1 - frac) + auB.AU10_UpperLipRaiser * frac),
              AU12_LipCornerPuller: Math.round(auA.AU12_LipCornerPuller * (1 - frac) + auB.AU12_LipCornerPuller * frac),
              AU15_LipCornerDepressor: Math.round(auA.AU15_LipCornerDepressor * (1 - frac) + auB.AU15_LipCornerDepressor * frac),
              AU26_JawDrop: Math.round(auA.AU26_JawDrop * (1 - frac) + auB.AU26_JawDrop * frac),
            };
          } else {
            const t = timestampMs * 0.002;
            currentAUs = {
              AU01_InnerBrowRaiser: Math.max(
                1,
                Math.min(99, Math.round(manualAUs.AU01_InnerBrowRaiser + Math.sin(t) * 2))
              ),
              AU04_BrowLowerer: Math.max(
                1,
                Math.min(99, Math.round(manualAUs.AU04_BrowLowerer + Math.cos(t * 0.9) * 2))
              ),
              AU06_CheekRaiser: Math.max(
                1,
                Math.min(99, Math.round(manualAUs.AU06_CheekRaiser + Math.sin(t * 1.1) * 2))
              ),
              AU09_NoseWrinkler: Math.max(
                1,
                Math.min(99, Math.round(manualAUs.AU09_NoseWrinkler + Math.sin(t * 0.8) * 2))
              ),
              AU10_UpperLipRaiser: Math.max(
                1,
                Math.min(99, Math.round(manualAUs.AU10_UpperLipRaiser + Math.cos(t * 0.7) * 2))
              ),
              AU12_LipCornerPuller: Math.max(
                1,
                Math.min(99, Math.round(manualAUs.AU12_LipCornerPuller + Math.cos(t * 0.8) * 2))
              ),
              AU15_LipCornerDepressor: Math.max(
                1,
                Math.min(99, Math.round(manualAUs.AU15_LipCornerDepressor + Math.sin(t * 1.2) * 2))
              ),
              AU26_JawDrop: Math.max(
                1,
                Math.min(99, Math.round(manualAUs.AU26_JawDrop + Math.cos(t * 1.3) * 2))
              ),
            };
          }
        }

        const solved = computeEmotionScoresFromAUs(currentAUs, timestampMs * 0.0015);

        const canvas = overlayCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            renderBiometricOverlay({
              ctx,
              width: canvas.width,
              height: canvas.height,
              sourceMode:
                sourceMode === 'optical_camera' && cameraActive
                  ? 'optical_camera'
                  : 'synthetic_calibration',
              box: faceBoxRef.current,
              actionUnits: currentAUs,
              headPose: currentPose,
              dominantEmotion: solved.dominantEmotion,
              confidence: solved.confidence,
              valence: solved.valence,
              arousal: solved.arousal,
              heartRateEstBpm: currentHr,
              showMesh,
              showBoundingBox,
              showActionUnitVectors,
              timestampMs,
              theme,
            });
          }
        }

        if (timestampMs - lastStateUpdateMs >= 100) {
          lastStateUpdateMs = timestampMs;
          setLiveEmotion({
            dominantEmotion: solved.dominantEmotion,
            confidence: solved.confidence,
            valence: solved.valence,
            arousal: solved.arousal,
            heartRateEstBpm: currentHr,
            scores: solved.scores,
            actionUnits: currentAUs,
            headPose: currentPose,
          });
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [
    cameraActive,
    isStreamPaused,
    manualAUs,
    showActionUnitVectors,
    showBoundingBox,
    showMesh,
    sourceMode,
    useManualBiasOnCamera,
    theme,
  ]);

  // 4. Cloud Telemetry Snapshot Ingestion & Alert Rule Evaluation
  const ingestTelemetryFrameToCloud = useCallback(
    async (customOverride?: Partial<TelemetryLogEntry>) => {
      const current = liveStateRef.current;
      const nowIso = new Date().toISOString();

      const draftEntry: TelemetryLogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        sessionId: 'SES-2026-884A',
        subjectLabel: 'Subject-01 (Primary Station)',
        sourceMode:
          sourceMode === 'optical_camera' && cameraActive
            ? 'optical_camera'
            : 'synthetic_calibration',
        dominantEmotion: current.dominantEmotion,
        confidence: current.confidence,
        valence: current.valence,
        arousal: current.arousal,
        heartRateEstBpm: current.heartRateEstBpm,
        scores: current.scores,
        actionUnits: current.actionUnits,
        headPose: current.headPose,
        triggeredAlertIds: [],
        ...customOverride,
      };

      const { triggeredRuleIds, newIncidents } = evaluateMoodAlertRules(
        rulesRef.current,
        logsRef.current,
        draftEntry
      );

      draftEntry.triggeredAlertIds = triggeredRuleIds;

      setLogs((prev) => [draftEntry, ...prev.slice(0, 299)]);

      if (newIncidents.length > 0) {
        setIncidents((prev) => [...newIncidents, ...prev]);
        setActiveBannerIncident(newIncidents[0]);

        setRules((prevRules) =>
          prevRules.map((r) => {
            const matched = newIncidents.find((inc) => inc.ruleId === r.id);
            if (!matched) return r;
            if (r.soundEnabled) {
              playAlertChime(r.severity);
            }
            return {
              ...r,
              triggerCount: r.triggerCount + 1,
              lastTriggeredAt: matched.timestamp,
            };
          })
        );
      }

      try {
        setCloudMeta((prev) => ({ ...prev, storageStatus: 'Syncing' }));
        const res = await fetch('/api/telemetry/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ log: draftEntry, newIncidents }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.cloudSyncMetadata) {
            setCloudMeta(data.cloudSyncMetadata);
          }
        }
      } catch {
        setCloudMeta((prev) => ({ ...prev, storageStatus: 'Degraded' }));
      }
    },
    [cameraActive, sourceMode]
  );

  useEffect(() => {
    if (isStreamPaused || logIntervalSec <= 0) return;
    const timer = setInterval(() => {
      ingestTelemetryFrameToCloud();
    }, logIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [ingestTelemetryFrameToCloud, isStreamPaused, logIntervalSec]);

  const handleSelectScenario = (scenarioId: string) => {
    const found = CALIBRATION_SCENARIOS.find((s) => s.id === scenarioId);
    if (!found) return;
    setSelectedScenarioId(scenarioId);
    setManualAUs({ ...found.actionUnits });
    if (sourceMode === 'optical_camera') {
      setUseManualBiasOnCamera(true);
    }
  };

  const handleSimulateRuleTrigger = async (rule: MoodAlertRule) => {
    const matchedScenario = CALIBRATION_SCENARIOS.find((s) => s.targetEmotion === rule.metric);
    let targetAUs: ActionUnits = matchedScenario
      ? { ...matchedScenario.actionUnits }
      : { ...CALIBRATION_SCENARIOS[3].actionUnits };
    if (rule.metric === 'disgust') {
      const disg = CALIBRATION_SCENARIOS.find((s) => s.id === 'aversive-disgust');
      if (disg) targetAUs = { ...disg.actionUnits };
    } else if (rule.metric === 'fear') {
      const fearScen = CALIBRATION_SCENARIOS.find((s) => s.id === 'acute-threat');
      if (fearScen) targetAUs = { ...fearScen.actionUnits };
    } else if (rule.metric === 'all_expressions_volatility') {
      const allScen = CALIBRATION_SCENARIOS.find((s) => s.id === 'all-expressions');
      if (allScen) targetAUs = { ...allScen.actionUnits };
    } else if (rule.metric === 'negative_valence') {
      const sadScen = CALIBRATION_SCENARIOS.find((s) => s.id === 'dysphoric-fatigue');
      if (sadScen) targetAUs = { ...sadScen.actionUnits };
    } else if (rule.metric === 'high_arousal') {
      const surScen = CALIBRATION_SCENARIOS.find((s) => s.id === 'startle-surprise');
      if (surScen) targetAUs = { ...surScen.actionUnits };
    }

    setManualAUs(targetAUs);
    if (sourceMode === 'optical_camera') {
      setUseManualBiasOnCamera(true);
    }

    const solved = computeEmotionScoresFromAUs(targetAUs, 0);
    const now = Date.now();

    const simulatedIncident: AlertIncident = {
      id: `inc-${now}`,
      timestamp: new Date(now).toISOString(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      metric: rule.metric,
      measuredValue: Math.max(rule.threshold + 8.4, solved.confidence),
      thresholdValue: rule.threshold,
      dominantEmotion: solved.dominantEmotion,
      valence: solved.valence,
      arousal: solved.arousal,
      subjectLabel: 'Subject-01 (Primary Station)',
      acknowledged: false,
      notes: `Pattern verification test triggered (${METRIC_LABELS[rule.metric]}).`,
    };

    const simulatedLog: TelemetryLogEntry = {
      id: `log-${now}`,
      timestamp: new Date(now).toISOString(),
      sessionId: 'SES-2026-884A',
      subjectLabel: 'Subject-01 (Primary Station)',
      sourceMode:
        sourceMode === 'optical_camera' && cameraActive
          ? 'optical_camera'
          : 'synthetic_calibration',
      dominantEmotion: solved.dominantEmotion,
      confidence: solved.confidence,
      valence: solved.valence,
      arousal: solved.arousal,
      heartRateEstBpm: 89,
      scores: solved.scores,
      actionUnits: targetAUs,
      headPose: { pitch: -1.1, yaw: 0.6, roll: 0.2 },
      triggeredAlertIds: [rule.id],
    };

    if (rule.soundEnabled) {
      playAlertChime(rule.severity);
    }

    setLogs((prev) => [simulatedLog, ...prev]);
    setIncidents((prev) => [simulatedIncident, ...prev]);
    setActiveBannerIncident(simulatedIncident);
    setRules((prev) =>
      prev.map((r) =>
        r.id === rule.id
          ? { ...r, triggerCount: r.triggerCount + 1, lastTriggeredAt: simulatedIncident.timestamp }
          : r
      )
    );

    await fetch('/api/telemetry/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log: simulatedLog, newIncidents: [simulatedIncident] }),
    });
  };

  const handleSaveRule = async (rule: MoodAlertRule) => {
    const res = await fetch('/api/telemetry/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const res = await fetch(`/api/telemetry/rules/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules);
    }
  };

  const handleAcknowledgeIncident = async (id: string) => {
    if (activeBannerIncident?.id === id) {
      setActiveBannerIncident(null);
    }
    const res = await fetch(`/api/telemetry/incidents/${id}/acknowledge`, {
      method: 'PATCH',
    });
    if (res.ok) {
      const data = await res.json();
      setIncidents(data.incidents);
    }
  };

  const handleAcknowledgeAll = async () => {
    setActiveBannerIncident(null);
    const res = await fetch('/api/telemetry/incidents/acknowledge-all', {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      setIncidents(data.incidents);
    }
  };

  const handleResetCloudDb = async () => {
    const res = await fetch('/api/telemetry/reset', { method: 'POST' });
    if (res.ok) {
      const data: CloudDashboardState = await res.json();
      setLogs(data.logs);
      setRules(data.rules);
      setIncidents(data.incidents);
      setCloudMeta(data.cloudSyncMetadata);
      setActiveBannerIncident(null);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Timestamp',
      'SessionID',
      'SourceMode',
      'DominantEmotion',
      'ConfidencePct',
      'Valence',
      'Arousal',
      'HeartRateEstBPM',
      'AU01_InnerBrow',
      'AU04_BrowLower',
      'AU06_CheekRaise',
      'AU09_NoseWrinkle',
      'AU10_UpperLipRaise',
      'AU12_LipPull',
      'AU15_LipDepress',
      'AU26_JawDrop',
      'TriggeredAlerts',
    ];
    const rows = logs.map((l) => [
      l.id,
      l.timestamp,
      l.sessionId,
      l.sourceMode,
      l.dominantEmotion,
      l.confidence,
      l.valence,
      l.arousal,
      l.heartRateEstBpm,
      l.actionUnits.AU01_InnerBrowRaiser,
      l.actionUnits.AU04_BrowLowerer,
      l.actionUnits.AU06_CheekRaiser,
      l.actionUnits.AU09_NoseWrinkler,
      l.actionUnits.AU10_UpperLipRaiser,
      l.actionUnits.AU12_LipCornerPuller,
      l.actionUnits.AU15_LipCornerDepressor,
      l.actionUnits.AU26_JawDrop,
      (l.triggeredAlertIds || []).join(';'),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `moodtrace-telemetry-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sessionAnalytics = useMemo(() => {
    if (logs.length === 0) {
      return {
        meanValence: 0,
        meanArousal: 0.5,
        meanHr: 70,
        dominantSessionEmotion: 'focus' as EmotionType,
        dominantSharePct: 0,
        meanScores: liveEmotion.scores,
      };
    }

    const counts: Record<EmotionType, number> = {
      joy: 0,
      focus: 0,
      neutral: 0,
      surprise: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      disgust: 0,
    };
    const scoreSums: EmotionScores = {
      joy: 0,
      focus: 0,
      neutral: 0,
      surprise: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      disgust: 0,
    };

    let valSum = 0;
    let aroSum = 0;
    let hrSum = 0;

    logs.forEach((l) => {
      counts[l.dominantEmotion] = (counts[l.dominantEmotion] || 0) + 1;
      valSum += l.valence;
      aroSum += l.arousal;
      hrSum += l.heartRateEstBpm;
      (Object.keys(scoreSums) as EmotionType[]).forEach((emo) => {
        scoreSums[emo] += l.scores[emo] || 0;
      });
    });

    const n = logs.length;
    let topEmotion: EmotionType = 'focus';
    let topCount = -1;
    (Object.keys(counts) as EmotionType[]).forEach((emo) => {
      if (counts[emo] > topCount) {
        topCount = counts[emo];
        topEmotion = emo;
      }
    });

    const meanScores: EmotionScores = {
      joy: Number((scoreSums.joy / n).toFixed(1)),
      focus: Number((scoreSums.focus / n).toFixed(1)),
      neutral: Number((scoreSums.neutral / n).toFixed(1)),
      surprise: Number((scoreSums.surprise / n).toFixed(1)),
      sadness: Number((scoreSums.sadness / n).toFixed(1)),
      anger: Number((scoreSums.anger / n).toFixed(1)),
      fear: Number((scoreSums.fear / n).toFixed(1)),
      disgust: Number((scoreSums.disgust / n).toFixed(1)),
    };

    return {
      meanValence: Number((valSum / n).toFixed(2)),
      meanArousal: Number((aroSum / n).toFixed(2)),
      meanHr: Math.round(hrSum / n),
      dominantSessionEmotion: topEmotion,
      dominantSharePct: Number(((topCount / n) * 100).toFixed(1)),
      meanScores,
    };
  }, [logs, liveEmotion.scores]);

  const unacknowledgedIncidents = incidents.filter((i) => !i.acknowledged);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#080B11] text-slate-100'
    }`}>
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className={`flex items-center justify-between gap-8 px-6 py-3.5 border-b transition-colors ${
        isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0B0F17]'
      }`}>
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('live');
          }}
          className={`text-lg font-bold tracking-tight whitespace-nowrap shrink-0 ${
            isLight ? 'text-slate-900' : 'text-slate-100'
          }`}
        >
          MoodTrace
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'live'
                ? isLight
                  ? 'border-cyan-600 text-slate-900 font-semibold'
                  : 'border-cyan-400 text-slate-100 font-semibold'
                : isLight
                  ? 'border-transparent text-slate-600 hover:text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Optical
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'analytics'
                ? isLight
                  ? 'border-cyan-600 text-slate-900 font-semibold'
                  : 'border-cyan-400 text-slate-100 font-semibold'
                : isLight
                  ? 'border-transparent text-slate-600 hover:text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cloud Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'alerts'
                ? isLight
                  ? 'border-cyan-600 text-slate-900 font-semibold'
                  : 'border-cyan-400 text-slate-100 font-semibold'
                : isLight
                  ? 'border-transparent text-slate-600 hover:text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Alert Rules {unacknowledgedIncidents.length > 0 ? `(${unacknowledgedIncidents.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'ledger'
                ? isLight
                  ? 'border-cyan-600 text-slate-900 font-semibold'
                  : 'border-cyan-400 text-slate-100 font-semibold'
                : isLight
                  ? 'border-transparent text-slate-600 hover:text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Event Ledger
          </button>
        </nav>

        {/* Zone 3: 1 primary action area + Theme Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
            title={`Switch to ${isLight ? 'dark' : 'light'} theme`}
            className={`p-2 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isLight
                ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isLight ? (
              <Moon className="w-4 h-4 text-slate-800" />
            ) : (
              <Sun className="w-4 h-4 text-amber-300" />
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Cloud CSV</span>
          </button>
        </div>
      </header>

      {/* Sub-Header Telemetry Ribbon */}
      <div className={`flex flex-wrap items-center justify-between gap-4 px-6 py-2 border-b text-xs font-mono ${
        isLight
          ? 'bg-slate-100 border-slate-200 text-slate-600'
          : 'bg-[#0A0E16] border-slate-800/80 text-slate-400'
      }`}>
        <div className="flex flex-wrap items-center gap-3 tabular-nums">
          <span
            className={
              cloudMeta.storageStatus === 'Nominal'
                ? isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400'
                : cloudMeta.storageStatus === 'Syncing'
                ? isLight ? 'text-cyan-700 font-semibold' : 'text-cyan-400'
                : isLight ? 'text-amber-700 font-semibold' : 'text-amber-400'
            }
          >
            ● CLOUD SYNC: {cloudMeta.storageStatus.toUpperCase()}
          </span>
          <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-slate-600'}>·</span>
          <span>SESSION: SES-2026-884A</span>
          <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-slate-600'}>·</span>
          <span>
            SOURCE:{' '}
            {sourceMode === 'optical_camera' && cameraActive
              ? 'OPTICAL WEBCAM (68-PT MESH)'
              : 'SYNTHETIC CALIBRATION SUBJECT'}
          </span>
          <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-slate-600'}>·</span>
          <span>STORED LOGS: {logs.length} FRAMES</span>
        </div>

        <div className="flex items-center gap-4 tabular-nums">
          <span>
            ACTIVE RULES: {rules.filter((r) => r.enabled).length}/{rules.length}
          </span>
          <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-slate-600'}>·</span>
          <span>
            LAST CLOUD COMMIT:{' '}
            {new Date(cloudMeta.lastSyncedAt).toLocaleTimeString([], {
              hour12: false,
            })}
          </span>
        </div>
      </div>

      {/* Real-Time Triggered Mood Pattern Alert Banner */}
      {activeBannerIncident && (
        <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 ${
          isLight ? 'bg-rose-50 border-rose-200' : 'bg-rose-950/40 border-rose-500/40'
        }`}>
          <div className="flex items-center gap-3 text-xs font-mono">
            <AlertTriangle className={`w-4 h-4 shrink-0 ${isLight ? 'text-rose-600' : 'text-rose-400'}`} />
            <span className={`font-semibold uppercase ${isLight ? 'text-rose-900' : 'text-rose-300'}`}>
              ✖ MOOD PATTERN ALERT TRIGGERED: {activeBannerIncident.ruleName}
            </span>
            <span className={isLight ? 'text-slate-300' : 'text-slate-500'} aria-hidden="true">·</span>
            <span className={`tabular-nums ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
              MEASURED: {activeBannerIncident.measuredValue.toFixed(1)}% (LIMIT:{' '}
              {activeBannerIncident.thresholdValue}%)
            </span>
            <span className={isLight ? 'text-slate-300' : 'text-slate-500'} aria-hidden="true">·</span>
            <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>{activeBannerIncident.notes}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1 text-xs font-mono border transition-colors cursor-pointer ${
                isLight
                  ? 'border-rose-300 text-rose-800 bg-white hover:bg-rose-100'
                  : 'border-rose-500/40 text-rose-200 hover:bg-rose-900/40'
              }`}
            >
              Inspect Incident
            </button>
            <button
              type="button"
              onClick={() => handleAcknowledgeIncident(activeBannerIncident.id)}
              className="px-3 py-1 text-xs font-mono bg-rose-600 text-white font-semibold hover:bg-rose-500 transition-colors cursor-pointer"
            >
              Acknowledge & Dismiss
            </button>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* 4-Column Scientific KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`border p-4 transition-colors ${
            isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
          }`}>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Live Dominant Affect
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span
                className="text-2xl font-bold font-mono tracking-tight"
                style={{ color: EMOTION_COLORS[liveEmotion.dominantEmotion] }}
              >
                {EMOTION_LABELS[liveEmotion.dominantEmotion].split(' / ')[0]}
              </span>
              <span className={`text-lg font-mono font-semibold tabular-nums ${
                isLight ? 'text-slate-800' : 'text-slate-200'
              }`}>
                {liveEmotion.confidence.toFixed(1)}
                <span className={`text-xs ml-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>% CONF</span>
              </span>
            </div>
            <div className={`mt-2 text-xs font-mono tabular-nums ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              AU04: {liveEmotion.actionUnits.AU04_BrowLowerer}% · AU12:{' '}
              {liveEmotion.actionUnits.AU12_LipCornerPuller}% · rPPG:{' '}
              {liveEmotion.heartRateEstBpm} BPM
            </div>
          </div>

          <div className={`border p-4 transition-colors ${
            isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
          }`}>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Circumplex Valence &amp; Arousal
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span
                className={`text-2xl font-mono font-bold tabular-nums ${
                  liveEmotion.valence >= 0
                    ? isLight ? 'text-emerald-700' : 'text-emerald-400'
                    : isLight ? 'text-rose-700' : 'text-rose-400'
                }`}
              >
                {liveEmotion.valence >= 0
                  ? `+${liveEmotion.valence.toFixed(2)}`
                  : liveEmotion.valence.toFixed(2)}
                <span className={`text-xs font-normal ml-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>VAL</span>
              </span>
              <span className={isLight ? 'text-slate-300' : 'text-slate-600'}>/</span>
              <span className={`text-2xl font-mono font-bold tabular-nums ${
                isLight ? 'text-amber-700' : 'text-amber-400'
              }`}>
                {liveEmotion.arousal.toFixed(2)}
                <span className={`text-xs font-normal ml-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>ARO</span>
              </span>
            </div>
            <div className={`mt-2 text-xs font-mono tabular-nums ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              SESSION MEAN: {sessionAnalytics.meanValence >= 0 ? `+${sessionAnalytics.meanValence}` : sessionAnalytics.meanValence} VAL ·{' '}
              {sessionAnalytics.meanArousal} ARO
            </div>
          </div>

          <div className={`border p-4 transition-colors ${
            isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
          }`}>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Cloud Session Distribution
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className={`text-2xl font-mono font-bold tabular-nums ${
                isLight ? 'text-slate-900' : 'text-slate-100'
              }`}>
                {logs.length}
                <span className={`text-xs font-normal ml-1.5 uppercase ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Logged Frames
                </span>
              </span>
            </div>
            <div className={`mt-2 text-xs font-mono tabular-nums ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              PRIMARY STATE:{' '}
              <span style={{ color: EMOTION_COLORS[sessionAnalytics.dominantSessionEmotion] }} className="font-semibold">
                {sessionAnalytics.dominantSessionEmotion.toUpperCase()} (
                {sessionAnalytics.dominantSharePct}%)
              </span>
            </div>
          </div>

          <div className={`border p-4 transition-colors ${
            isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
          }`}>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Mood Pattern Alert Engine
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span
                className={`text-2xl font-mono font-bold tabular-nums ${
                  unacknowledgedIncidents.length > 0
                    ? isLight ? 'text-rose-700' : 'text-rose-400'
                    : isLight ? 'text-emerald-700' : 'text-emerald-400'
                }`}
              >
                {unacknowledgedIncidents.length > 0
                  ? `${unacknowledgedIncidents.length} ACTIVE`
                  : 'NOMINAL'}
              </span>
              <span className={`text-xs font-mono tabular-nums ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}>
                {incidents.length} TOTAL EVENTS
              </span>
            </div>
            <div className={`mt-2 text-xs font-mono tabular-nums ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              {rules.filter((r) => r.enabled).length} RULES ARMED · AUTO-LOG:{' '}
              {logIntervalSec > 0 ? `${logIntervalSec}S` : 'MANUAL'}
            </div>
          </div>
        </section>

        {/* WORKSPACE TAB 1: LIVE OPTICAL DETECTION & BIOMETRIC TELEMETRY */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Control Column */}
              <div className={`lg:col-span-4 border p-5 flex flex-col justify-between space-y-5 transition-colors ${
                isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
              }`}>
                <div className="space-y-5">
                  {/* Optical Source Selector (Both Options) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${
                        isLight ? 'text-slate-700' : 'text-slate-300'
                      }`}>
                        01. Active Input Option
                      </span>
                      <span className={`text-[11px] font-mono font-semibold ${
                        isLight ? 'text-cyan-700' : 'text-cyan-400'
                      }`}>
                        {cameraActive && sourceMode === 'optical_camera'
                          ? '● OPTION 1: LIVE WEBCAM'
                          : '● OPTION 2: SIMULATION MESH'}
                      </span>
                    </div>

                    <div className={`grid grid-cols-2 gap-2 p-1 border ${
                      isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#080B11] border-slate-800'
                    }`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!cameraActive) startOpticalCamera();
                          else setSourceMode('optical_camera');
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          sourceMode === 'optical_camera' && cameraActive
                            ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-semibold'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Live Camera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceMode('synthetic_calibration')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          sourceMode === 'synthetic_calibration' || !cameraActive
                            ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-semibold'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Simulation Mode</span>
                      </button>
                    </div>

                    {cameraError && (
                      <p className="mt-2 text-[11px] font-mono text-amber-600 dark:text-amber-400 leading-relaxed">
                        {cameraError}
                      </p>
                    )}
                  </div>

                  {/* Biometric Expression Presets */}
                  <div className={`border-t pt-4 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${
                        isLight ? 'text-slate-700' : 'text-slate-300'
                      }`}>
                        02. Expression Scenarios
                      </span>
                      <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        FACS PROFILES
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {CALIBRATION_SCENARIOS.map((scen) => {
                        const isSelected = selectedScenarioId === scen.id;
                        return (
                          <button
                            key={scen.id}
                            type="button"
                            onClick={() => handleSelectScenario(scen.id)}
                            className={`text-left p-2.5 border transition-colors cursor-pointer ${
                              isSelected
                                ? isLight
                                  ? 'border-cyan-600 bg-cyan-50 text-slate-900'
                                  : 'border-cyan-500 bg-cyan-950/30 text-slate-100'
                                : isLight
                                  ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                                  : 'border-slate-800 bg-[#080B11] text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-xs font-semibold truncate">
                              {scen.name}
                            </div>
                            <div
                              className="text-[10px] font-mono mt-0.5 uppercase font-medium"
                              style={{ color: EMOTION_COLORS[scen.targetEmotion] }}
                            >
                              {scen.targetEmotion} · V:{scen.valence >= 0 ? `+${scen.valence}` : scen.valence}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* FACS Action Unit Sliders */}
                  <div className={`border-t pt-4 space-y-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                        isLight ? 'text-slate-700' : 'text-slate-300'
                      }`}>
                        <Sliders className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        <span>03. FACS Muscle Contraction Sliders</span>
                      </span>
                      {sourceMode === 'optical_camera' && cameraActive && (
                        <button
                          type="button"
                          onClick={() => setUseManualBiasOnCamera((prev) => !prev)}
                          className={`text-[10px] font-mono hover:underline cursor-pointer ${
                            isLight ? 'text-cyan-700' : 'text-cyan-400'
                          }`}
                        >
                          {useManualBiasOnCamera ? 'USE PURE OPTICAL' : 'OVERRIDE SLIDERS'}
                        </button>
                      )}
                    </div>

                    {(
                      [
                        {
                          key: 'AU01_InnerBrowRaiser',
                          label: 'AU01 Inner Brow Raiser (Surprise/Sad)',
                        },
                        {
                          key: 'AU04_BrowLowerer',
                          label: 'AU04 Corrugator Brow Lower (Anger/Focus)',
                        },
                        {
                          key: 'AU06_CheekRaiser',
                          label: 'AU06 Orbicularis Cheek Raise (Joy)',
                        },
                        {
                          key: 'AU09_NoseWrinkler',
                          label: 'AU09 Levator Labii Nose Wrinkler (Disgust)',
                        },
                        {
                          key: 'AU10_UpperLipRaiser',
                          label: 'AU10 Upper Lip Raiser (Disgust/Aversion)',
                        },
                        {
                          key: 'AU12_LipCornerPuller',
                          label: 'AU12 Zygomatic Lip Pull (Smile)',
                        },
                        {
                          key: 'AU15_LipCornerDepressor',
                          label: 'AU15 Depressor Anguli Oris (Frown)',
                        },
                        {
                          key: 'AU26_JawDrop',
                          label: 'AU26 Masseter Jaw Drop (Startle)',
                        },
                      ] as Array<{ key: keyof ActionUnits; label: string }>
                    ).map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className={`truncate ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                            {label}
                          </span>
                          <span className={`tabular-nums font-semibold ${
                            isLight ? 'text-cyan-700' : 'text-cyan-400'
                          }`}>
                            {liveEmotion.actionUnits[key]}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={manualAUs[key]}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setManualAUs((prev) => ({ ...prev, [key]: val }));
                            if (sourceMode === 'optical_camera') {
                              setUseManualBiasOnCamera(true);
                            }
                          }}
                          className={`w-full h-1.5 cursor-pointer accent-cyan-500 ${
                            isLight ? 'bg-slate-200' : 'bg-slate-800'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cloud Cadence Controls */}
                <div className={`border-t pt-4 space-y-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      CLOUD LOG CADENCE
                    </span>
                    <div className="flex items-center gap-1">
                      {[2, 5, 0].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setLogIntervalSec(sec)}
                          className={`px-2 py-1 text-[11px] font-mono border transition-colors cursor-pointer ${
                            logIntervalSec === sec
                              ? isLight
                                ? 'border-cyan-600 bg-cyan-100 text-cyan-900 font-semibold'
                                : 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                              : isLight
                                ? 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900'
                                : 'border-slate-800 bg-[#080B11] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {sec === 0 ? 'MANUAL' : `${sec}S`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsStreamPaused((p) => !p)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                        isLight
                          ? 'border-slate-300 text-slate-800 hover:bg-slate-100'
                          : 'border-slate-700 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {isStreamPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Resume Stream</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Freeze Frame</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => ingestTelemetryFrameToCloud()}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Log Cloud Frame</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Viewport: Live Video / Simulation Stage + ALL EXPRESSIONS in Both Options */}
              <div className={`lg:col-span-8 border flex flex-col justify-between transition-colors ${
                isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
              }`}>
                <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b ${
                  isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#0B0F17]'
                }`}>
                  <div className={`flex items-center gap-2 text-xs font-mono ${
                    isLight ? 'text-slate-700' : 'text-slate-300'
                  }`}>
                    <Eye className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>
                      {sourceMode === 'optical_camera' && cameraActive
                        ? 'OPTION 1: LIVE OPTICAL VIEWPORT'
                        : 'OPTION 2: SIMULATION STAGE'}
                    </span>
                    <span className={isLight ? 'text-slate-300' : 'text-slate-600'} aria-hidden="true">·</span>
                    <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>68-POINT ANATOMICAL MESH</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBoundingBox((v) => !v)}
                      className={`px-2.5 py-1 text-[11px] font-mono border transition-colors cursor-pointer ${
                        showBoundingBox
                          ? isLight
                            ? 'border-cyan-600 bg-cyan-50 text-cyan-900 font-semibold'
                            : 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                          : isLight
                            ? 'border-slate-200 text-slate-400'
                            : 'border-slate-800 text-slate-500'
                      }`}
                    >
                      RETICLE BOX
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMesh((v) => !v)}
                      className={`px-2.5 py-1 text-[11px] font-mono border transition-colors cursor-pointer ${
                        showMesh
                          ? isLight
                            ? 'border-cyan-600 bg-cyan-50 text-cyan-900 font-semibold'
                            : 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                          : isLight
                            ? 'border-slate-200 text-slate-400'
                            : 'border-slate-800 text-slate-500'
                      }`}
                    >
                      68-PT MESH
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowActionUnitVectors((v) => !v)}
                      className={`px-2.5 py-1 text-[11px] font-mono border transition-colors cursor-pointer ${
                        showActionUnitVectors
                          ? isLight
                            ? 'border-cyan-600 bg-cyan-50 text-cyan-900 font-semibold'
                            : 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                          : isLight
                            ? 'border-slate-200 text-slate-400'
                            : 'border-slate-800 text-slate-500'
                      }`}
                    >
                      FACS LABELS
                    </button>
                    {cameraActive && (
                      <button
                        type="button"
                        onClick={stopOpticalCamera}
                        title="Release device camera"
                        className={`p-1 border cursor-pointer ${
                          isLight
                            ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-slate-100'
                            : 'border-slate-800 text-slate-400 hover:text-rose-400'
                        }`}
                      >
                        <CameraOff className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Video & Canvas Frame */}
                <div className={`relative w-full aspect-video overflow-hidden flex items-center justify-center ${
                  isLight ? 'bg-slate-100' : 'bg-[#070A10]'
                }`}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`w-full h-full object-cover scale-x-[-1] ${
                      sourceMode === 'optical_camera' && cameraActive ? 'block' : 'hidden'
                    }`}
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    width={768}
                    height={432}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                </div>

                {/* ALL EXPRESSIONS SHOWN IN BOTH OPTIONS */}
                <div className={`p-4 border-t ${
                  isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#0B0F17]'
                }`}>
                  <div className={`flex items-center justify-between text-xs font-mono mb-3 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isLight ? 'text-cyan-800' : 'text-cyan-400'}`}>
                        ALL EXPRESSIONS DISPLAYED ({sourceMode === 'optical_camera' && cameraActive ? 'OPTION 1: LIVE CAMERA' : 'OPTION 2: SIMULATION MODE'})
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 border ${
                        isLight ? 'bg-cyan-50 border-cyan-200 text-cyan-800' : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300'
                      }`}>
                        8 CHANNELS ACTIVE
                      </span>
                    </div>
                    <span className="tabular-nums">SUM: 100.0% · 30 FPS REAL-TIME</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {(Object.keys(liveEmotion.scores) as EmotionType[]).map((emo) => {
                      const val = liveEmotion.scores[emo];
                      const isDom = liveEmotion.dominantEmotion === emo;
                      const color = EMOTION_COLORS[emo];
                      return (
                        <div
                          key={emo}
                          className={`p-2.5 border transition-colors ${
                            isDom
                              ? isLight
                                ? 'border-cyan-600 bg-cyan-50/70 shadow-xs'
                                : 'border-slate-600 bg-[#131B2E]'
                              : isLight
                                ? 'border-slate-200 bg-white'
                                : 'border-slate-800/90 bg-[#080B11]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className={`uppercase font-semibold ${
                              isLight ? 'text-slate-800' : 'text-slate-300'
                            }`}>
                              {emo}
                            </span>
                            <span
                              className="tabular-nums font-bold"
                              style={{ color: isDom ? color : isLight ? '#475569' : '#94A3B8' }}
                            >
                              {val.toFixed(1)}%
                            </span>
                          </div>
                          <div className={`mt-2 w-full h-1.5 overflow-hidden ${
                            isLight ? 'bg-slate-200' : 'bg-slate-900'
                          }`}>
                            <div
                              className="h-full transition-transform duration-150 origin-left"
                              style={{
                                backgroundColor: color,
                                transform: `scaleX(${Math.min(1, val / 100)})`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Trajectory Wave & 7-Axis Radar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className={`lg:col-span-8 border p-5 transition-colors ${
                isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      Live Cloud Valence &amp; Arousal Telemetry Stream
                    </h3>
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Multi-channel affective trajectory across recent cloud-synced frames. Hover to probe exact frame coordinates.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('analytics')}
                    className={`text-xs font-mono hover:underline whitespace-nowrap cursor-pointer ${
                      isLight ? 'text-cyan-700 font-semibold' : 'text-cyan-400'
                    }`}
                  >
                    Open Full Analytics →
                  </button>
                </div>
                <TelemetryWaveChart logs={logs} theme={theme} />
              </div>

              <div className={`lg:col-span-4 border p-5 flex flex-col justify-between transition-colors ${
                isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
              }`}>
                <div>
                  <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    7-Axis Affect Calibration Radar
                  </h3>
                  <p className={`text-xs mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Live optical vector vs. historical cloud session baseline.
                  </p>
                </div>
                <EmotionSpiderRadar
                  currentScores={liveEmotion.scores}
                  sessionMeanScores={sessionAnalytics.meanScores}
                  theme={theme}
                />
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE TAB 2: CLOUD ANALYTICS DASHBOARD */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 ${
              isLight ? 'border-slate-200' : 'border-slate-800'
            }`}>
              <div>
                <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  Cloud Affective Analytics &amp; Circumplex Distribution
                </h2>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Longitudinal analysis of facial emotion probabilities, autonomic arousal trends, and Russell&apos;s Circumplex space.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => ingestTelemetryFrameToCloud()}
                  className="px-3.5 py-2 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors cursor-pointer"
                >
                  Capture Cloud Frame Now
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className={`lg:col-span-6 border p-5 flex flex-col justify-between transition-colors ${
                isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
              }`}>
                <div>
                  <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    7-Axis Emotion Spider Calibration
                  </h3>
                  <p className={`text-xs mt-0.5 mb-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Polygonal overlay comparing instantaneous facial expression vector against cloud session mean.
                  </p>
                </div>
                <EmotionSpiderRadar
                  currentScores={liveEmotion.scores}
                  sessionMeanScores={sessionAnalytics.meanScores}
                  theme={theme}
                />
              </div>

              <div className={`lg:col-span-6 border p-5 flex flex-col justify-between transition-colors ${
                isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
              }`}>
                <div>
                  <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    Russell&apos;s 2D Circumplex Affective Space
                  </h3>
                  <p className={`text-xs mt-0.5 mb-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Spatial distribution of cloud logs mapped across Valence (horizontal) and Autonomic Arousal (vertical).
                  </p>
                </div>
                <CircumplexAffectMatrix logs={logs} theme={theme} />
              </div>
            </div>

            <div className={`border p-5 transition-colors ${
              isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
            }`}>
              <h3 className={`text-sm font-semibold mb-1 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                Longitudinal Valence &amp; Arousal Waveforms
              </h3>
              <p className={`text-xs mb-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Vertical crimson markers denote frames where customizable mood pattern alert rules fired.
              </p>
              <TelemetryWaveChart logs={logs} theme={theme} />
            </div>

            <div className={`border p-5 transition-colors ${
              isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#0F141F]'
            }`}>
              <h3 className={`text-sm font-semibold mb-3 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                Session Emotion Class Breakdown &amp; FACS Correlates
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-[11px] font-mono uppercase ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-600'
                        : 'bg-[#0B0F17] border-slate-800 text-slate-400'
                    }`}>
                      <th className="py-2.5 px-4">Affect Class</th>
                      <th className="py-2.5 px-4 text-right">Live Score</th>
                      <th className="py-2.5 px-4 text-right">Cloud Session Mean</th>
                      <th className="py-2.5 px-4 text-right">Delta vs Mean</th>
                      <th className="py-2.5 px-4">Primary Anatomical Action Units</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-xs font-mono tabular-nums ${
                    isLight ? 'divide-slate-100' : 'divide-slate-800/60'
                  }`}>
                    {(
                      [
                        {
                          emo: 'focus',
                          auDesc: 'AU04 Corrugator Supercilii (Moderate) + Orbital Fixation',
                        },
                        {
                          emo: 'joy',
                          auDesc: 'AU06 Cheek Raiser + AU12 Zygomaticus Major Lip Puller',
                        },
                        {
                          emo: 'neutral',
                          auDesc: 'Baseline Muscular Equilibrium (Low AU01–AU26 Variance)',
                        },
                        {
                          emo: 'surprise',
                          auDesc: 'AU01 Frontalis Inner Brow Raiser + AU26 Masseter Jaw Drop',
                        },
                        {
                          emo: 'sadness',
                          auDesc: 'AU01 Inner Brow Raise + AU15 Depressor Anguli Oris',
                        },
                        {
                          emo: 'anger',
                          auDesc: 'AU04 High Brow Lowering + AU15 Lip Corner Compression',
                        },
                        {
                          emo: 'fear',
                          auDesc: 'AU01 Inner Brow Lift + AU04 Corrugator Tension + AU26 Parted Jaw',
                        },
                        {
                          emo: 'disgust',
                          auDesc: 'AU09 Levator Labii Nose Wrinkler + AU10 Upper Lip Raiser + AU15 Depressor',
                        },
                      ] as Array<{ emo: EmotionType; auDesc: string }>
                    ).map(({ emo, auDesc }) => {
                      const liveVal = liveEmotion.scores[emo];
                      const meanVal = sessionAnalytics.meanScores[emo];
                      const delta = Number((liveVal - meanVal).toFixed(1));
                      return (
                        <tr key={emo} className={`transition-colors ${
                          isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/30'
                        }`}>
                          <td
                            className="py-2.5 px-4 font-semibold"
                            style={{ color: EMOTION_COLORS[emo] }}
                          >
                            {EMOTION_LABELS[emo]}
                          </td>
                          <td className={`py-2.5 px-4 text-right font-medium ${
                            isLight ? 'text-slate-900' : 'text-slate-200'
                          }`}>
                            {liveVal.toFixed(1)}%
                          </td>
                          <td className={`py-2.5 px-4 text-right ${
                            isLight ? 'text-slate-500' : 'text-slate-400'
                          }`}>
                            {meanVal.toFixed(1)}%
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-medium ${
                              delta >= 0
                                ? isLight ? 'text-cyan-700' : 'text-cyan-400'
                                : isLight ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
                          </td>
                          <td className={`py-2.5 px-4 font-sans text-xs ${
                            isLight ? 'text-slate-600' : 'text-slate-400'
                          }`}>
                            {auDesc}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE TAB 3: CUSTOMIZABLE MOOD PATTERN ALERT RULES */}
        {activeTab === 'alerts' && (
          <MoodAlertRuleManager
            rules={rules}
            incidents={incidents}
            onSaveRule={handleSaveRule}
            onDeleteRule={handleDeleteRule}
            onAcknowledgeIncident={handleAcknowledgeIncident}
            onAcknowledgeAll={handleAcknowledgeAll}
            onSimulateRuleTrigger={handleSimulateRuleTrigger}
            theme={theme}
          />
        )}

        {/* WORKSPACE TAB 4: CLOUD EVENT LEDGER */}
        {activeTab === 'ledger' && (
          <CloudEventLedger
            logs={logs}
            onExportCsv={handleExportCsv}
            onResetCloudDb={handleResetCloudDb}
            onCaptureManualSnapshot={() => ingestTelemetryFrameToCloud()}
            theme={theme}
          />
        )}
      </main>

      {/* Quiet Scientific Footer */}
      <footer className={`mt-auto border-t px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs transition-colors ${
        isLight ? 'border-slate-200 bg-white text-slate-500' : 'border-slate-800/80 bg-[#0B0F17] text-slate-500'
      }`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
          <span>MoodTrace Biometric Telemetry Suite</span>
          <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-slate-600'}>·</span>
          <span>FACS Action Unit &amp; Circumplex Valence Engine</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`transition-colors cursor-pointer ${
              isLight ? 'hover:text-slate-800' : 'hover:text-slate-300'
            }`}
          >
            Configure Mood Alerts
          </button>
          <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-slate-600'}>·</span>
          <button
            type="button"
            onClick={handleExportCsv}
            className={`transition-colors cursor-pointer ${
              isLight ? 'hover:text-slate-800' : 'hover:text-slate-300'
            }`}
          >
            Download Session CSV
          </button>
        </div>
      </footer>
    </div>
  );
}
