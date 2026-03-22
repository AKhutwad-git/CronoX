import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { AuditLogRepository } from '../auditing/audit-log.repository';
import { logger } from '../../lib/logger';

const PRICING_MODEL_VERSION = '1.0.0';
const auditLogRepository = new AuditLogRepository();

export const calculatePrice = async (req: Request, res: Response) => {
  const { professionalId } = req.body as { professionalId?: string };
  const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';

  if (!professionalId) {
    return res.status(400).json({ message: 'Professional ID is required' });
  }

  try {
    logger.info('[pricing] price calculation requested', { correlationId, professionalId });
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId }
    });

    if (!professional) {
      return res.status(404).json({ message: 'Professional not found' });
    }

    const { getRecommendedPricing } = await import('./pricing-engine.service');
    const { baseRate, focusScore, recommendedRate, multiplier, volatilityPenalty } = await getRecommendedPricing(professional.userId);

    // Persist pricing inputs for audit -> AuditLog
    await auditLogRepository.create({
      entityType: 'Pricing',
      entityId: professionalId,
      eventType: 'PriceCalculated',
      metadata: {
        modelVersion: PRICING_MODEL_VERSION,
        inputs: { baseRate, focusScore },
        output: { finalPrice: recommendedRate, multiplier, volatilityPenalty }
      } as Prisma.InputJsonValue
    });

    logger.info('[pricing] price calculated via engine', { correlationId, professionalId, finalPrice: recommendedRate, focusScore, multiplier, volatilityPenalty });
    res.json({ price: recommendedRate, focusScore, baseRate, multiplier, volatilityPenalty });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[pricing] price calculation failed', error, { correlationId, professionalId });
    res.status(500).json({ message: 'Error calculating price', error: message });
  }
};
