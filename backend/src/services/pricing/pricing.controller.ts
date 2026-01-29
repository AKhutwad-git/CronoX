import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { getMetricsByUserId } from '../metrics/metrics.controller';
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

    // 1. Read latest metrics
    // getMetricsByUserId is now async and returns Prisma objects
    const metrics = await getMetricsByUserId(professional.userId);

    // 2. Compute Focus Score (placeholder or avg of metric values?)
    // Using simple placeholder logic for now
    const focusScore = metrics.length > 0 ? 0.8 : 0.5;

    // 3. Apply contextual modifiers (placeholders)
    const fatigue = Math.random() * 0.2;
    const workload = Math.random() * 0.3;
    const history = Math.random() * 0.1;

    // 4. Apply base pricing rules
    const baseRate = Number(professional.baseRate);
    const minCap = baseRate * 0.8;
    const maxCap = baseRate * 2.5;

    let price = baseRate * (1 + focusScore - fatigue - workload + history);

    // 5. Apply dynamic re-pricing (placeholders)
    const demand = Math.random() * 0.4;
    const scarcity = Math.random() * 0.2;
    const velocity = Math.random() * 0.1;

    price = price * (1 + demand + scarcity + velocity);

    // Ensure price is within caps
    const finalPrice = Math.max(minCap, Math.min(maxCap, price));

    // Persist pricing inputs for audit -> AuditLog
    await auditLogRepository.create({
      entityType: 'Pricing',
      entityId: professionalId,
      eventType: 'PriceCalculated',
      metadata: {
        modelVersion: PRICING_MODEL_VERSION,
        inputs: {
          baseRate,
          focusScore,
          fatigue,
          workload,
          history,
          demand,
          scarcity,
          velocity,
        },
        output: {
          finalPrice,
        }
      } as Prisma.InputJsonValue
    });

    logger.info('[pricing] price calculated', { correlationId, professionalId, finalPrice });
    res.json({ price: finalPrice });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[pricing] price calculation failed', error, { correlationId, professionalId });
    res.status(500).json({ message: 'Error calculating price', error: message });
  }
};
