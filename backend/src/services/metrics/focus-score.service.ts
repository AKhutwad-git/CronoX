import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';

export interface PhysiologicalData {
  heartRate: number;      // bpm
  hrv: number;            // ms
  steps: number;          // daily steps
  sleep: number;          // hours
  activity: number;       // intensity scale 1-10
  screen: number;         // minutes per day
}

export interface FocusScoreWeights {
  heartRate: number;
  hrv: number;
  sleep: number;
  steps: number;
  activity: number;
  screen: number;
}

const DEFAULT_WEIGHTS: FocusScoreWeights = {
  heartRate: 0.30,
  hrv: 0.30,
  sleep: 0.20,
  steps: 0.10,
  activity: 0.05,
  screen: -0.15
};

function normalizeHeartRate(hr: number): number {
  return Math.min(Math.max((hr - 60) / 30, 0), 1);
}

function normalizeHRV(hrv: number): number {
  return Math.min(Math.max((hrv - 20) / 60, 0), 1);
}

function normalizeSleep(hours: number): number {
  if (hours <= 6) {
    return Math.max(hours / 12, 0);
  } else if (hours >= 6 && hours <= 8) {
    return (hours - 6) / 2;
  } else {
    return Math.max(1 - (hours - 8) / 4, 0);
  }
}

function normalizeSteps(steps: number): number {
  return Math.min(steps / 10000, 1);
}

function normalizeActivity(activity: number): number {
  return Math.min(Math.max(activity / 10, 0), 1);
}

function normalizeScreenTime(minutes: number): number {
  return Math.min(minutes / 180, 1);
}

export function computeFocusScore(
  data: PhysiologicalData,
  weights: Partial<FocusScoreWeights> = {}
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  const nHR = normalizeHeartRate(data.heartRate);
  const nHRV = normalizeHRV(data.hrv);
  const nSleep = normalizeSleep(data.sleep);
  const nSteps = normalizeSteps(data.steps);
  const nAct = normalizeActivity(data.activity);
  const nScreen = normalizeScreenTime(data.screen);

  const rawScore =
    w.heartRate * (1 - nHR) +
    w.hrv * nHRV +
    w.sleep * nSleep +
    w.steps * nSteps +
    w.activity * nAct +
    w.screen * nScreen;

  return Math.round(Math.max(0, Math.min(100, rawScore * 100)));
}

export async function calculateAndStoreFocusScore(userId: string): Promise<number> {
  // Fetch latest metrics safely
  const metrics = await prisma.metric.findMany({
    where: { userId },
    orderBy: { recordedAt: 'desc' },
    // Only grab enough recent metrics to construct a payload, e.g last 100
    take: 100
  });

  // Default baselines
  const data: PhysiologicalData = {
    heartRate: 75,
    hrv: 50,
    steps: 5000,
    sleep: 7,
    activity: 5,
    screen: 120
  };

  // Find most recent value of each type
  const found = new Set<string>();
  for (const metric of metrics) {
    if (!found.has(metric.metricType)) {
      found.add(metric.metricType);
      
      const val = Number(metric.value);
      switch(metric.metricType) {
        case 'heart_rate': data.heartRate = val; break;
        case 'hrv': data.hrv = val; break;
        case 'steps': data.steps = val; break;
        case 'sleep_duration': data.sleep = val; break;
        case 'activity': data.activity = val; break;
        case 'screen_time': data.screen = val; break;
      }
    }
  }

  const score = computeFocusScore(data);

  await prisma.focusScore.create({
    data: {
      userId,
      score,
      modelVersion: '1.0'
    }
  });

  return score;
}
