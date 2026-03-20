import prisma from '../../lib/prisma';
import { calculateAndStoreFocusScore } from '../metrics/focus-score.service';

/**
 * Compute Adjusted Rate based on Focus Score
 * Linear multiplier: 0.5x to 1.5x based on score 0-100
 */
export function computeAdjustedRate(baseRate: number, focusScore: number): number {
  let multiplier: number;

  if (focusScore >= 0 && focusScore <= 50) {
    // From 0 (0.5x) to 50 (1.0x)
    // Multiplier increases by 0.5 over 50 points
    multiplier = 0.5 + (focusScore / 50) * 0.5;
  } else if (focusScore > 50 && focusScore <= 100) {
    // From 50 (1.0x) to 100 (2.0x)
    // Multiplier increases by 1.0 over 50 points
    multiplier = 1.0 + ((focusScore - 50) / 50) * 1.0;
  } else {
    if (focusScore < 0) multiplier = 0.5;
    else multiplier = 2.0;
  }

  return Math.round(baseRate * multiplier * 100) / 100; // Round to 2 decimal places
}

export async function getRecommendedPricing(professionalUserId: string): Promise<{ baseRate: number; focusScore: number; recommendedRate: number }> {
  const professional = await prisma.professional.findUnique({
    where: { userId: professionalUserId }
  });

  if (!professional) {
    throw new Error('Professional not found');
  }

  let latestScore = await prisma.focusScore.findFirst({
    where: { userId: professionalUserId },
    orderBy: { computedAt: 'desc' }
  });

  let scoreValue = 0;
  
  if (!latestScore) {
    // Attempt to compute if none exists
    scoreValue = await calculateAndStoreFocusScore(professionalUserId);
  } else {
    // If it's older than 24h, we could recompute, but let's stick to using the latest stored or calculating fresh
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    if (latestScore.computedAt < oneDayAgo) {
      scoreValue = await calculateAndStoreFocusScore(professionalUserId);
    } else {
      scoreValue = Number(latestScore.score);
    }
  }

  const baseRate = Number(professional.baseRate);
  const recommendedRate = computeAdjustedRate(baseRate, scoreValue);

  return {
    baseRate,
    focusScore: scoreValue,
    recommendedRate
  };
}
