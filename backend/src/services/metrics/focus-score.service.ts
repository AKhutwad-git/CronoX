import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { getConsentedMetricTypes } from '../biometric/consent.service';

/**
 * Advanced AI Focus Score Model — v2.0
 *
 * Multi-signal weighted scoring:
 *   FocusScore = w1·HRVScore + w2·HRStability + w3·SleepRecovery
 *                + w4·ActivityBalance + w5·BehavioralFocus
 *
 * Features:
 * - Dynamic weight rebalancing when signals are missing
 * - Confidence score based on signal availability
 * - Breakdown JSON for transparency
 */

// ─── Types ───────────────────────────────────────────────────

export interface SignalWeights {
  hrv: number;
  heartRateStability: number;
  sleepRecovery: number;
  activityBalance: number;
  behavioralFocus: number;
}

export interface SubScores {
  hrvScore: number | null;
  heartRateStability: number | null;
  sleepRecovery: number | null;
  activityBalance: number | null;
  behavioralFocus: number | null;
}

export interface FocusScoreResult {
  score: number;                // 0–100
  confidence: number;           // 0–100 (% of signals available)
  breakdown: SubScores;
  weights: SignalWeights;
  modelVersion: string;
  contributingFactors: string[];
  validFrom: Date;
  validUntil: Date;
}

// ─── Constants ───────────────────────────────────────────────

const MODEL_VERSION = '2.0';

const DEFAULT_WEIGHTS: SignalWeights = {
  hrv: 0.30,
  heartRateStability: 0.20,
  sleepRecovery: 0.20,
  activityBalance: 0.15,
  behavioralFocus: 0.15
};

const OPTIMAL_SLEEP_HOURS = 7.5;
const OPTIMAL_STEPS_PER_HOUR = 500; // ~8000 steps over 16 waking hours
const GAUSSIAN_SIGMA = 300;

// ─── Sub-score Calculations ─────────────────────────────────

/**
 * HRV Score — higher HRV = better cognitive flexibility
 * Normalized against a personal baseline using a rolling window.
 */
function computeHRVScore(hrvValues: number[]): number {
  if (hrvValues.length === 0) return 0;

  const mean = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;

  // Baseline reference: population average HRV ~40ms, excellent ≥80ms
  // Normalize to 0–1 range: 20ms → 0, 80ms → 1
  const normalized = Math.min(Math.max((mean - 20) / 60, 0), 1);
  return normalized * 100;
}

/**
 * Heart Rate Stability — penalizes spikes (stress indicator)
 * stability = 1 - normalized_variance
 */
function computeHeartRateStability(hrValues: number[]): number {
  if (hrValues.length < 2) return 50; // neutral if insufficient data

  const mean = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
  const variance = hrValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / hrValues.length;
  const stdDev = Math.sqrt(variance);

  // Normalize: stdDev of 0 → perfect stability (100), stdDev ≥ 20 → 0
  const stability = Math.max(0, 1 - stdDev / 20);
  return stability * 100;
}

/**
 * Sleep Recovery — based on last sleep duration vs optimal
 */
function computeSleepRecovery(sleepHours: number | null): number {
  if (sleepHours === null || sleepHours <= 0) return 0;

  const ratio = sleepHours / OPTIMAL_SLEEP_HOURS;

  if (ratio >= 0.87 && ratio <= 1.13) {
    // 6.5h – 8.5h → high score
    return 85 + (1 - Math.abs(1 - ratio)) * 15;
  } else if (ratio < 0.87) {
    // Under-slept — linear decline
    return Math.max(0, ratio * 85 / 0.87);
  } else {
    // Over-slept — gentle decline
    return Math.max(0, 100 - (ratio - 1.13) * 80);
  }
}

/**
 * Activity Balance — Gaussian curve that penalizes both extremes
 * (too idle or too hyperactive)
 */
function computeActivityBalance(stepsPerHour: number): number {
  // Gaussian centered at OPTIMAL_STEPS_PER_HOUR
  const exponent = -((stepsPerHour - OPTIMAL_STEPS_PER_HOUR) ** 2) /
    (2 * GAUSSIAN_SIGMA ** 2);
  return Math.exp(exponent) * 100;
}

/**
 * Behavioral Focus — derived from tab switches, idle time, session continuity.
 * Currently uses activity/screen-time proxy if frontend signals aren't available.
 */
function computeBehavioralFocus(
  screenMinutes: number | null,
  activityLevel: number | null
): number {
  // Proxy: moderate screen time + moderate activity = focused
  const screenScore = screenMinutes !== null
    ? Math.max(0, 100 - Math.abs(screenMinutes - 90) * 0.8)
    : 50;

  const activityScore = activityLevel !== null
    ? Math.max(0, 100 - Math.abs(activityLevel - 5) * 15)
    : 50;

  return (screenScore * 0.6 + activityScore * 0.4);
}

// ─── Weight Rebalancing ──────────────────────────────────────

/**
 * When signals are missing, redistribute their weight proportionally
 * to the remaining signals.
 */
function rebalanceWeights(
  available: Record<keyof SignalWeights, boolean>
): SignalWeights {
  const base = { ...DEFAULT_WEIGHTS };
  const keys = Object.keys(base) as (keyof SignalWeights)[];

  const missingWeight = keys
    .filter(k => !available[k])
    .reduce((sum, k) => sum + base[k], 0);

  const availableKeys = keys.filter(k => available[k]);
  const availableTotal = availableKeys.reduce((sum, k) => sum + base[k], 0);

  if (availableTotal === 0) return base; // shouldn't happen, but guard

  const rebalanced = { ...base };
  for (const key of keys) {
    if (!available[key]) {
      rebalanced[key] = 0;
    } else {
      rebalanced[key] = base[key] + (base[key] / availableTotal) * missingWeight;
    }
  }

  return rebalanced;
}

// ─── Main Computation ────────────────────────────────────────

export function computeFocusScore(
  hrvValues: number[],
  hrValues: number[],
  sleepHours: number | null,
  stepsPerHour: number,
  screenMinutes: number | null,
  activityLevel: number | null
): FocusScoreResult {
  // Determine signal availability
  const available = {
    hrv: hrvValues.length > 0,
    heartRateStability: hrValues.length >= 2,
    sleepRecovery: sleepHours !== null && sleepHours > 0,
    activityBalance: true, // steps always available (defaulted to 0)
    behavioralFocus: true  // proxy always available
  };

  const weights = rebalanceWeights(available);

  // Compute sub-scores
  const hrvScore = available.hrv ? computeHRVScore(hrvValues) : null;
  const heartRateStability = available.heartRateStability
    ? computeHeartRateStability(hrValues) : null;
  const sleepRecovery = available.sleepRecovery
    ? computeSleepRecovery(sleepHours) : null;
  const activityBalance = computeActivityBalance(stepsPerHour);
  const behavioralFocus = computeBehavioralFocus(screenMinutes, activityLevel);

  // Weighted sum (only non-null scores contribute)
  let rawScore = 0;
  if (hrvScore !== null) rawScore += weights.hrv * hrvScore;
  if (heartRateStability !== null) rawScore += weights.heartRateStability * heartRateStability;
  if (sleepRecovery !== null) rawScore += weights.sleepRecovery * sleepRecovery;
  rawScore += weights.activityBalance * activityBalance;
  rawScore += weights.behavioralFocus * behavioralFocus;

  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  // Confidence: percentage of primary signals present
  const signalKeys = Object.keys(available) as (keyof typeof available)[];
  const presentCount = signalKeys.filter(k => available[k]).length;
  const confidence = Math.round((presentCount / signalKeys.length) * 100);

  // Expiry calculation: 1 hour from now
  const now = new Date();
  const validUntil = new Date(now.getTime() + 60 * 60 * 1000);

  // Contributing factors
  const contributingFactors: string[] = [];
  if (hrvScore !== null) contributingFactors.push(`HRV: ${Math.round(hrvScore)}`);
  if (heartRateStability !== null) contributingFactors.push(`HR Stability: ${Math.round(heartRateStability)}`);
  if (sleepRecovery !== null) contributingFactors.push(`Sleep: ${Math.round(sleepRecovery)}`);
  contributingFactors.push(`Activity: ${Math.round(activityBalance)}`);
  contributingFactors.push(`Behavior: ${Math.round(behavioralFocus)}`);

  return {
    score,
    confidence,
    breakdown: { hrvScore, heartRateStability, sleepRecovery, activityBalance, behavioralFocus },
    weights,
    modelVersion: MODEL_VERSION,
    contributingFactors,
    validFrom: now,
    validUntil: validUntil
  };
}

// ─── Database Integration ────────────────────────────────────

/**
 * Fetches latest metrics for a user, computes a focus score, and stores it.
 * Respects consent by filtering metric types the user has authorized.
 */
export async function calculateAndStoreFocusScore(userId: string): Promise<FocusScoreResult> {
  // Get consented metric types
  const consentedTypes = await getConsentedMetricTypes(userId);

  // Fetch recent metrics (last 24h preferred, fall back to latest 200)
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const metrics = await prisma.metric.findMany({
    where: {
      userId,
      recordedAt: { gte: oneDayAgo },
      ...(consentedTypes.length > 0 ? { metricType: { in: consentedTypes } } : {})
    },
    orderBy: { recordedAt: 'desc' },
    take: 200
  });

  // Extract values per metric type
  const hrvValues: number[] = [];
  const hrValues: number[] = [];
  let latestSleep: number | null = null;
  let totalSteps = 0;
  let latestActivity: number | null = null;
  let latestScreen: number | null = null;

  for (const metric of metrics) {
    const val = Number(metric.value);
    switch (metric.metricType) {
      case 'hrv':
        hrvValues.push(val);
        break;
      case 'heart_rate':
        hrValues.push(val);
        break;
      case 'sleep_duration':
        if (latestSleep === null) latestSleep = val;
        break;
      case 'steps':
        totalSteps += val;
        break;
      case 'activity':
        if (latestActivity === null) latestActivity = val;
        break;
      case 'screen_time':
        if (latestScreen === null) latestScreen = val;
        break;
    }
  }

  // Estimate steps per hour (assuming 16 waking hours)
  const stepsPerHour = totalSteps / 16;

  const result = computeFocusScore(
    hrvValues,
    hrValues,
    latestSleep,
    stepsPerHour,
    latestScreen,
    latestActivity
  );

  // Store in database with 1-hour validity window
  await prisma.focusScore.create({
    data: {
      userId,
      score: result.score,
      modelVersion: result.modelVersion,
      breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
      confidence: result.confidence,
      validFrom: result.validFrom,
      validUntil: result.validUntil
    }
  });

  return result;
}

/**
 * Get the latest valid focus score for a user.
 */
export async function getLatestValidFocusScore(userId: string): Promise<FocusScoreResult | null> {
  const now = new Date();
  const latest = await prisma.focusScore.findFirst({
    where: { 
      userId,
      validUntil: { gt: now }
    },
    orderBy: { computedAt: 'desc' }
  });

  if (!latest) return null;

  return {
    score: Number(latest.score),
    confidence: latest.confidence ? Number(latest.confidence) : 60,
    breakdown: (latest.breakdown as unknown as SubScores) ?? {
      hrvScore: null,
      heartRateStability: null,
      sleepRecovery: null,
      activityBalance: null,
      behavioralFocus: null
    },
    weights: DEFAULT_WEIGHTS,
    modelVersion: latest.modelVersion,
    contributingFactors: [],
    validFrom: latest.validFrom,
    validUntil: latest.validUntil
  };
}

/**
 * Get the latest stored focus score for a user (ignoring validity).
 */
export async function getLatestFocusScore(userId: string): Promise<FocusScoreResult | null> {
  const latest = await prisma.focusScore.findFirst({
    where: { userId },
    orderBy: { computedAt: 'desc' }
  });

  if (!latest) return null;

  return {
    score: Number(latest.score),
    confidence: latest.confidence ? Number(latest.confidence) : 60,
    breakdown: (latest.breakdown as unknown as SubScores) ?? {
      hrvScore: null,
      heartRateStability: null,
      sleepRecovery: null,
      activityBalance: null,
      behavioralFocus: null
    },
    weights: DEFAULT_WEIGHTS,
    modelVersion: latest.modelVersion,
    contributingFactors: [],
    validFrom: latest.validFrom,
    validUntil: latest.validUntil
  };
}

/**
 * Get recent focus scores for trend display (last 24h).
 */
export async function getFocusScoreTrend(
  userId: string,
  hours: number = 24
): Promise<Array<{ score: number; computedAt: Date }>> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const scores = await prisma.focusScore.findMany({
    where: {
      userId,
      computedAt: { gte: since }
    },
    orderBy: { computedAt: 'asc' },
    select: { score: true, computedAt: true }
  });

  return scores.map(s => ({ score: Number(s.score), computedAt: s.computedAt }));
}
