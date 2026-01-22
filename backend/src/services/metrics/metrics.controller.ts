import { Response } from 'express';
import prisma from '../../lib/prisma';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const createMetric = async (req: AuthenticatedRequest, res: Response) => {
  const { type, value } = req.body as { type?: string; value?: number };
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!type || value === undefined) {
    return res.status(400).json({ message: 'Type and value are required' });
  }

  if (typeof value !== 'number') {
    return res.status(400).json({ message: 'Value must be a number' });
  }

  try {
    const newMetric = await prisma.metric.create({
      data: {
        userId,
        metricType: type,
        value,
        // recordedAt default now? Schema: recordedAt DateTime @map("recorded_at") - No default?
        // Let's check schema. Line 94: recordedAt DateTime @map("recorded_at").
        // No @default. So we must provide it.
        recordedAt: new Date()
      }
    });

    res.status(201).json(newMetric);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error creating metric', error: message });
  }
};

export const getMetricsByUserId = async (userId: string) => {
  return prisma.metric.findMany({
    where: { userId }
  });
};
