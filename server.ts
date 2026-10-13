import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type {
  ActionUnits,
  CloudDashboardState,
  TelemetryLogEntry,
  MoodAlertRule,
  AlertIncident,
  EmotionType,
} from './src/types/telemetry.ts';

const PORT = 3000;
const DB_PATH = path.resolve(process.cwd(), 'cloud-telemetry-db.json');

function createSeedData(): CloudDashboardState {
  const now = Date.now();
  const rules: MoodAlertRule[] = [
    {
      id: 'rule-sustained-stress',
      name: 'Sustained Frustration & Brow Tension',
      description: 'Triggers when Anger or Corrugator Brow contraction exceeds 48% across 3 consecutive samples.',
      metric: 'anger',
      operator: 'gte',
      threshold: 48,
      sustainedSamples: 3,
      severity: 'critical',
      soundEnabled: true,
      autoSnapshot: true,
      enabled: true,
      triggerCount: 5,
      lastTriggeredAt: new Date(now - 1000 * 60 * 12).toISOString(),
    },
    {
      id: 'rule-negative-valence-drift',
      name: 'Negative Valence Downward Drift',
      description: 'Detects sustained negative emotional valence (sadness index >= 60%) across 4 samples for fatigue alerting.',
      metric: 'negative_valence',
      operator: 'gte',
      threshold: 60,
      sustainedSamples: 4,
      severity: 'warning',
      soundEnabled: false,
      autoSnapshot: true,
      enabled: true,
      triggerCount: 8,
      lastTriggeredAt: new Date(now - 1000 * 60 * 5).toISOString(),
    },
    {
      id: 'rule-high-arousal-spike',
      name: 'Acute Autonomic Arousal Spike',
      description: 'Monitors sudden startle or acute surprise spikes where autonomic arousal index surpasses 78%.',
      metric: 'high_arousal',
      operator: 'gte',
      threshold: 78,
      sustainedSamples: 2,
      severity: 'warning',
      soundEnabled: true,
      autoSnapshot: false,
      enabled: true,
      triggerCount: 3,
      lastTriggeredAt: new Date(now - 1000 * 60 * 25).toISOString(),
    },
    {
      id: 'rule-deep-focus-lock',
      name: 'Sustained Cognitive Flow State',
      description: 'Logs an advisory milestone when Focus concentration remains at or above 72% across 5 consecutive samples.',
      metric: 'focus',
      operator: 'gte',
      threshold: 72,
      sustainedSamples: 5,
      severity: 'advisory',
      soundEnabled: false,
      autoSnapshot: false,
      enabled: true,
      triggerCount: 14,
      lastTriggeredAt: new Date(now - 1000 * 60 * 1).toISOString(),
    },
  ];

  const logs: TelemetryLogEntry[] = [];
  const patterns: Array<{
    dom: EmotionType;
    val: number;
    aro: number;
    hr: number;
    scores: Record<EmotionType, number>;
    au: ActionUnits;
  }> = [
    {
      dom: 'focus',
      val: 0.26,
      aro: 0.58,
      hr: 71,
      scores: { focus: 75.2, neutral: 13.8, joy: 4.2, surprise: 2.1, sadness: 1.2, anger: 0.9, fear: 0.6, disgust: 2.0 },
      au: { AU01_InnerBrowRaiser: 14, AU04_BrowLowerer: 36, AU06_CheekRaiser: 8, AU09_NoseWrinkler: 2, AU10_UpperLipRaiser: 3, AU12_LipCornerPuller: 12, AU15_LipCornerDepressor: 4, AU26_JawDrop: 3 },
    },
    {
      dom: 'joy',
      val: 0.81,
      aro: 0.68,
      hr: 76,
      scores: { joy: 82.4, focus: 7.2, surprise: 4.1, neutral: 3.1, sadness: 0.5, anger: 0.4, fear: 0.3, disgust: 2.0 },
      au: { AU01_InnerBrowRaiser: 24, AU04_BrowLowerer: 5, AU06_CheekRaiser: 82, AU09_NoseWrinkler: 2, AU10_UpperLipRaiser: 3, AU12_LipCornerPuller: 88, AU15_LipCornerDepressor: 2, AU26_JawDrop: 19 },
    },
    {
      dom: 'neutral',
      val: 0.06,
      aro: 0.32,
      hr: 65,
      scores: { neutral: 68.2, focus: 19.8, joy: 4.2, sadness: 2.6, surprise: 1.4, anger: 1.0, fear: 0.8, disgust: 2.0 },
      au: { AU01_InnerBrowRaiser: 8, AU04_BrowLowerer: 10, AU06_CheekRaiser: 6, AU09_NoseWrinkler: 3, AU10_UpperLipRaiser: 4, AU12_LipCornerPuller: 8, AU15_LipCornerDepressor: 5, AU26_JawDrop: 4 },
    },
    {
      dom: 'anger',
      val: -0.71,
      aro: 0.84,
      hr: 93,
      scores: { anger: 59.2, focus: 16.4, sadness: 9.8, fear: 6.2, neutral: 3.8, surprise: 1.6, joy: 1.0, disgust: 2.0 },
      au: { AU01_InnerBrowRaiser: 10, AU04_BrowLowerer: 86, AU06_CheekRaiser: 15, AU09_NoseWrinkler: 12, AU10_UpperLipRaiser: 14, AU12_LipCornerPuller: 3, AU15_LipCornerDepressor: 54, AU26_JawDrop: 12 },
    },
    {
      dom: 'sadness',
      val: -0.62,
      aro: 0.28,
      hr: 62,
      scores: { sadness: 61.8, neutral: 18.2, focus: 8.1, fear: 5.1, anger: 2.9, joy: 1.1, surprise: 0.8, disgust: 2.0 },
      au: { AU01_InnerBrowRaiser: 66, AU04_BrowLowerer: 46, AU06_CheekRaiser: 5, AU09_NoseWrinkler: 4, AU10_UpperLipRaiser: 5, AU12_LipCornerPuller: 3, AU15_LipCornerDepressor: 76, AU26_JawDrop: 6 },
    },
    {
      dom: 'surprise',
      val: 0.34,
      aro: 0.88,
      hr: 89,
      scores: { surprise: 72.6, joy: 10.8, fear: 7.0, focus: 4.2, neutral: 2.4, anger: 0.6, sadness: 0.4, disgust: 2.0 },
      au: { AU01_InnerBrowRaiser: 90, AU04_BrowLowerer: 4, AU06_CheekRaiser: 18, AU09_NoseWrinkler: 2, AU10_UpperLipRaiser: 3, AU12_LipCornerPuller: 22, AU15_LipCornerDepressor: 3, AU26_JawDrop: 82 },
    },
    {
      dom: 'fear',
      val: -0.66,
      aro: 0.86,
      hr: 96,
      scores: { fear: 71.4, surprise: 12.0, anger: 5.4, sadness: 4.2, focus: 2.8, neutral: 1.8, joy: 0.8, disgust: 1.6 },
      au: { AU01_InnerBrowRaiser: 80, AU04_BrowLowerer: 66, AU06_CheekRaiser: 12, AU09_NoseWrinkler: 6, AU10_UpperLipRaiser: 6, AU12_LipCornerPuller: 4, AU15_LipCornerDepressor: 24, AU26_JawDrop: 70 },
    },
    {
      dom: 'disgust',
      val: -0.74,
      aro: 0.64,
      hr: 83,
      scores: { disgust: 73.8, anger: 11.2, sadness: 5.4, neutral: 3.2, fear: 2.4, focus: 1.6, surprise: 0.8, joy: 0.6 },
      au: { AU01_InnerBrowRaiser: 12, AU04_BrowLowerer: 46, AU06_CheekRaiser: 24, AU09_NoseWrinkler: 86, AU10_UpperLipRaiser: 82, AU12_LipCornerPuller: 3, AU15_LipCornerDepressor: 62, AU26_JawDrop: 14 },
    },
  ];

  for (let i = 35; i >= 0; i--) {
    const p = patterns[(35 - i) % patterns.length];
    const jitter = ((i * 7) % 11) - 5;
    const ts = new Date(now - i * 45 * 1000).toISOString();
    const confidence = Number(Math.min(99.2, Math.max(52.0, p.scores[p.dom] + jitter * 0.6)).toFixed(1));
    logs.push({
      id: `log-seed-${36 - i}`,
      timestamp: ts,
      sessionId: 'SES-2026-884A',
      subjectLabel: 'Subject-01 (Primary Station)',
      sourceMode: i % 3 === 0 ? 'synthetic_calibration' : 'optical_camera',
      dominantEmotion: p.dom,
      confidence,
      valence: Number(Math.max(-1, Math.min(1, p.val + jitter * 0.015)).toFixed(2)),
      arousal: Number(Math.max(0, Math.min(1, p.aro + jitter * 0.012)).toFixed(2)),
      heartRateEstBpm: Math.round(p.hr + jitter * 0.8),
      scores: {
        joy: Number(Math.max(0.2, p.scores.joy + jitter * 0.2).toFixed(1)),
        focus: Number(Math.max(0.2, p.scores.focus - jitter * 0.15).toFixed(1)),
        neutral: Number(Math.max(0.2, p.scores.neutral + jitter * 0.1).toFixed(1)),
        surprise: Number(Math.max(0.2, p.scores.surprise).toFixed(1)),
        sadness: Number(Math.max(0.2, p.scores.sadness).toFixed(1)),
        anger: Number(Math.max(0.2, p.scores.anger - jitter * 0.1).toFixed(1)),
        fear: Number(Math.max(0.2, p.scores.fear).toFixed(1)),
        disgust: Number(Math.max(0.2, p.scores.disgust).toFixed(1)),
      },
      actionUnits: { ...p.au },
      headPose: {
        pitch: Number(((jitter * 0.9) - 1.2).toFixed(1)),
        yaw: Number(((jitter * 1.4) + 0.8).toFixed(1)),
        roll: Number((jitter * 0.4).toFixed(1)),
      },
      triggeredAlertIds: p.dom === 'anger' ? ['rule-sustained-stress'] : p.dom === 'sadness' ? ['rule-negative-valence-drift'] : [],
    });
  }

  const incidents: AlertIncident[] = [
    {
      id: 'inc-104',
      timestamp: new Date(now - 1000 * 60 * 1).toISOString(),
      ruleId: 'rule-deep-focus-lock',
      ruleName: 'Sustained Cognitive Flow State',
      severity: 'advisory',
      metric: 'focus',
      measuredValue: 79.2,
      thresholdValue: 72,
      dominantEmotion: 'focus',
      valence: 0.29,
      arousal: 0.60,
      subjectLabel: 'Subject-01 (Primary Station)',
      acknowledged: false,
      notes: 'Sustained orbital fixation and low blink rate over 5 samples.',
    },
    {
      id: 'inc-103',
      timestamp: new Date(now - 1000 * 60 * 5).toISOString(),
      ruleId: 'rule-negative-valence-drift',
      ruleName: 'Negative Valence Downward Drift',
      severity: 'warning',
      metric: 'negative_valence',
      measuredValue: 65.4,
      thresholdValue: 60,
      dominantEmotion: 'sadness',
      valence: -0.63,
      arousal: 0.27,
      subjectLabel: 'Subject-01 (Primary Station)',
      acknowledged: false,
      notes: 'Elevated AU15 lip corner depressor & AU01 inner brow raise across 4 frames.',
    },
    {
      id: 'inc-102',
      timestamp: new Date(now - 1000 * 60 * 12).toISOString(),
      ruleId: 'rule-sustained-stress',
      ruleName: 'Sustained Frustration & Brow Tension',
      severity: 'critical',
      metric: 'anger',
      measuredValue: 61.2,
      thresholdValue: 48,
      dominantEmotion: 'anger',
      valence: -0.71,
      arousal: 0.84,
      subjectLabel: 'Subject-01 (Primary Station)',
      acknowledged: true,
      notes: 'High AU04 corrugator contraction (>85%) detected during stress scenario.',
    },
  ];

  return {
    logs: logs.reverse(),
    rules,
    incidents,
    cloudSyncMetadata: {
      region: 'europe-west1 (Cloud Telemetry Cluster)',
      lastSyncedAt: new Date().toISOString(),
      totalIngestedFrames: 15140,
      storageStatus: 'Nominal',
    },
  };
}

function loadDatabase(): CloudDashboardState {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(raw) as CloudDashboardState;
    }
  } catch (err) {
    console.error('Error reading cloud telemetry database, initializing fresh store:', err);
  }
  const initial = createSeedData();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(state: CloudDashboardState): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist cloud telemetry state:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  let dbState = loadDatabase();

  app.get('/api/telemetry/state', (_req, res) => {
    res.json(dbState);
  });

  app.post('/api/telemetry/logs', (req, res) => {
    const { log, newIncidents } = req.body as {
      log: TelemetryLogEntry;
      newIncidents?: AlertIncident[];
    };

    if (!log || !log.id) {
      res.status(400).json({ error: 'Invalid telemetry payload' });
      return;
    }

    dbState.logs.unshift(log);
    if (dbState.logs.length > 300) {
      dbState.logs = dbState.logs.slice(0, 300);
    }

    if (Array.isArray(newIncidents) && newIncidents.length > 0) {
      for (const inc of newIncidents) {
        dbState.incidents.unshift(inc);
        const matchingRule = dbState.rules.find((r) => r.id === inc.ruleId);
        if (matchingRule) {
          matchingRule.triggerCount += 1;
          matchingRule.lastTriggeredAt = inc.timestamp;
        }
      }
      if (dbState.incidents.length > 150) {
        dbState.incidents = dbState.incidents.slice(0, 150);
      }
    }

    dbState.cloudSyncMetadata.lastSyncedAt = new Date().toISOString();
    dbState.cloudSyncMetadata.totalIngestedFrames += 1;
    saveDatabase(dbState);

    res.status(201).json({
      status: 'synced',
      cloudSyncMetadata: dbState.cloudSyncMetadata,
      logCount: dbState.logs.length,
    });
  });

  app.post('/api/telemetry/reset', (_req, res) => {
    dbState = createSeedData();
    saveDatabase(dbState);
    res.json(dbState);
  });

  app.post('/api/telemetry/rules', (req, res) => {
    const rule = req.body as MoodAlertRule;
    if (!rule || !rule.id) {
      res.status(400).json({ error: 'Invalid rule payload' });
      return;
    }
    const existingIdx = dbState.rules.findIndex((r) => r.id === rule.id);
    if (existingIdx >= 0) {
      dbState.rules[existingIdx] = rule;
    } else {
      dbState.rules.unshift(rule);
    }
    dbState.cloudSyncMetadata.lastSyncedAt = new Date().toISOString();
    saveDatabase(dbState);
    res.json({ rules: dbState.rules });
  });

  app.delete('/api/telemetry/rules/:id', (req, res) => {
    const { id } = req.params;
    dbState.rules = dbState.rules.filter((r) => r.id !== id);
    dbState.cloudSyncMetadata.lastSyncedAt = new Date().toISOString();
    saveDatabase(dbState);
    res.json({ rules: dbState.rules });
  });

  app.patch('/api/telemetry/incidents/:id/acknowledge', (req, res) => {
    const { id } = req.params;
    const inc = dbState.incidents.find((item) => item.id === id);
    if (inc) {
      inc.acknowledged = true;
      dbState.cloudSyncMetadata.lastSyncedAt = new Date().toISOString();
      saveDatabase(dbState);
    }
    res.json({ incidents: dbState.incidents });
  });

  app.post('/api/telemetry/incidents/acknowledge-all', (_req, res) => {
    dbState.incidents.forEach((inc) => {
      inc.acknowledged = true;
    });
    dbState.cloudSyncMetadata.lastSyncedAt = new Date().toISOString();
    saveDatabase(dbState);
    res.json({ incidents: dbState.incidents });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MoodTrace Cloud Telemetry Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
