import prisma from '../../lib/prisma';

/**
 * Pricing Engine v2.0
 *
 * Computes adjusted rate using:
 *   priceMultiplier = 1 + (focusScore / 150)
 *   volatilityPenalty = 1 - (stdDev / 50)
 *   adjustedRate = baseRate * priceMultiplier * volatilityPenalty
 */

/**
 * Compute the price multiplier from a focus score.
 * Range: ~1.0x (score=0) to ~1.67x (score=100)
 */
export function computePriceMultiplier(focusScore: number): number {
  return 1 + (focusScore / 150);
}

/**
 * Compute a volatility penalty based on score consistency.
 * Consistent performance → penalty near 1.0 (no penalty).
 * Erratic performance → penalty drops toward 0.0.
 */
export function computeVolatilityPenalty(scores: number[]): number {
  if (scores.length < 2) return 1.0; // no penalty with insufficient data

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Clamp penalty between 0.5 and 1.0
  return Math.max(0.5, Math.min(1.0, 1 - (stdDev / 50)));
}

/**
 * Compute the final adjusted rate.
 */
export function computeAdjustedRate(
  baseRate: number,
  focusScore: number,
  recentScores: number[] = []
): number {
  const multiplier = computePriceMultiplier(focusScore);
  const volatilityPenalty = computeVolatilityPenalty(recentScores);
  const adjusted = baseRate * multiplier * volatilityPenalty;
  return Math.round(adjusted * 100) / 100;
}

/**
 * Full pricing pipeline: fetch professional, compute focus-score-based pricing.
 */
export async function getRecommendedPricing(professionalUserId: string): Promise<{
  baseRate: number;
  focusScore: number;
  recommendedRate: number;
  multiplier: number;
  volatilityPenalty: number;
  isValid: boolean;
}> {
  const professional = await prisma.professional.findUnique({
    where: { userId: professionalUserId }
  });

  if (!professional) {
    throw new Error('Professional not found');
  }

  const baseRate = Number(professional.baseRate);

  // Get latest VALID focus score (within 1 hour)
  const { getLatestValidFocusScore, calculateAndStoreFocusScore } = await import('../metrics/focus-score.service');
  const latestScore = await getLatestValidFocusScore(professionalUserId);

  let scoreValue = 0;
  let isValid = false;

  if (!latestScore) {
    // Attempt one fresh compute if no valid score exists
    try {
      const freshScore = await calculateAndStoreFocusScore(professionalUserId);
      // Check if the fresh computation actually resulted in a valid score (confidence > 0)
      if (freshScore.confidence > 0) {
        scoreValue = freshScore.score;
        isValid = true;
      }
    } catch {
      // No recent data to compute a valid score
      scoreValue = 0;
      isValid = false;
    }
  } else {
    scoreValue = Number(latestScore.score);
    isValid = true;
  }

  // Bio-Temporal Rule: If no valid score exists after attempt, return zero/invalid
  if (!isValid) {
    return {
      baseRate,
      focusScore: 0,
      recommendedRate: baseRate,
      multiplier: 1.0,
      volatilityPenalty: 1.0,
      isValid: false // Flag to disable listings
    };
  }

  // Get recent scores for volatility calculation
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentScores = await prisma.focusScore.findMany({
    where: {
      userId: professionalUserId,
      computedAt: { gte: sevenDaysAgo }
    },
    orderBy: { computedAt: 'desc' },
    take: 20,
    select: { score: true }
  });

  const scoreHistory = recentScores.map(s => Number(s.score));
  const multiplier = computePriceMultiplier(scoreValue);
  const volatilityPenalty = computeVolatilityPenalty(scoreHistory);
  const recommendedRate = computeAdjustedRate(baseRate, scoreValue, scoreHistory);

  return {
    baseRate,
    focusScore: scoreValue,
    recommendedRate,
    multiplier,
    volatilityPenalty,
    isValid: true
  };
}
