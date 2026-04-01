import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import prisma from '../../lib/prisma';
import { SessionRepository } from './session.repository';
import { ProfessionalRepository } from '../users/professional.repository';
import { PaymentRepository } from '../payments/payment.repository';
import { AuditLogRepository } from '../auditing/audit-log.repository';
import { logger } from '../../lib/logger';

// Payment and audit repositories used for post-session settlement
const paymentRepository = new PaymentRepository();
const auditLogRepository = new AuditLogRepository();

const settlePaymentForSession = async (sessionId: string): Promise<void> => {
  try {
    const existingPayment = await paymentRepository.findBySessionId(sessionId);
    let paymentId: string;
    let paymentAmount: number;

    if (existingPayment) {
      if (existingPayment.status !== 'pending') {
        logger.info('[sessions] payment already processed for session, skipping', { sessionId, paymentId: existingPayment.id, status: existingPayment.status });
        return;
      }
      paymentId = existingPayment.id;
      paymentAmount = Number(existingPayment.amount);
    } else {
      // Traverse: session → booking → token → price fallback if payment was not created
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          booking: {
            include: {
              token: { select: { price: true, currency: true } },
            },
          },
        },
      });

      if (!session?.booking?.token) {
        logger.warn('[sessions] unable to resolve token price for payment settlement', { sessionId });
        return;
      }

      paymentAmount = Number(session.booking.token.price);
      const newPayment = await paymentRepository.createWithValidation({ sessionId, amount: paymentAmount, status: 'pending' });
      paymentId = newPayment.id;
    }

    // Determine currency for audit (default to INR if not stored elsewhere)
    let currency = 'INR';
    let durationMinutes = 60; // default
    const sWithToken = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { booking: { include: { token: { select: { currency: true, durationMinutes: true } } } } }
    });
    if (sWithToken?.booking?.token) {
      currency = sWithToken.booking.token.currency;
      durationMinutes = sWithToken.booking.token.durationMinutes;
    }

    // AUDIT LOG VALIDATION
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Session',
        entityId: sessionId,
        eventType: { in: ['SessionJoined', 'SessionLeft'] }
      },
      orderBy: { createdAt: 'asc' }
    });

    const MIN_USER_PRESENCE_MS = 2 * 60000; // 2 minute safeguard
    const validPresenceMap: Record<string, { firstJoin: number; lastLeave: number }> = {};

    for (const log of auditLogs) {
      const meta = log.metadata as any;
      const userId = meta?.userId;
      if (!userId) continue;

      if (!validPresenceMap[userId]) {
        validPresenceMap[userId] = { firstJoin: log.createdAt.getTime(), lastLeave: Date.now() };
      }
      
      if (log.eventType === 'SessionJoined') {
        const joinTime = log.createdAt.getTime();
        if (joinTime < validPresenceMap[userId].firstJoin) {
          validPresenceMap[userId].firstJoin = joinTime;
        }
      }
      if (log.eventType === 'SessionLeft') {
        validPresenceMap[userId].lastLeave = log.createdAt.getTime();
      }
    }

    const validUserIds = Object.keys(validPresenceMap).filter(uid => {
      const p = validPresenceMap[uid];
      return (p.lastLeave - p.firstJoin) >= MIN_USER_PRESENCE_MS;
    });

    const hasBothUsers = validUserIds.length >= 2;
    let actualOverlapMs = 0;

    if (hasBothUsers) {
      // For exactly 2 users (Buyer + Professional), compute the actual interaction overlap
      const p1 = validPresenceMap[validUserIds[0]];
      const p2 = validPresenceMap[validUserIds[1]];
      
      const overlapStart = Math.max(p1.firstJoin, p2.firstJoin);
      const overlapEnd = Math.min(p1.lastLeave, p2.lastLeave);
      
      actualOverlapMs = Math.max(0, overlapEnd - overlapStart);
    }

    const failureThreshold = (durationMinutes * 60000) * 0.25; // 25% for hard dispute
    const reviewThreshold = (durationMinutes * 60000) * 0.5; // 50% for review
    const actualDurationMs = actualOverlapMs;

    if (!hasBothUsers || actualDurationMs < failureThreshold) {
      const reason = !hasBothUsers ? 'Single user join' : 'Session duration too short (< 25%)';
      logger.warn('[sessions] session auto-disputed', { 
        sessionId, paymentId, hasBothUsers, actualDurationMs, reason 
      });

      await paymentRepository.updatePaymentStatus(paymentId, 'disputed');
      await auditLogRepository.create({
        entityType: 'Payment',
        entityId: paymentId,
        eventType: 'PaymentAutoDisputed',
        metadata: {
          sessionId,
          reason,
          hasBothUsers,
          uniqueUsersCount: validUserIds.length,
          actualDurationMs,
          flaggedAt: new Date().toISOString()
        } as Prisma.InputJsonValue,
      });
      return;
    }

    if (actualDurationMs < reviewThreshold) {
      logger.warn('[sessions] session flagged for review', { 
        sessionId, paymentId, actualDurationMs 
      });

      await paymentRepository.updatePaymentStatus(paymentId, 'pending_review');
      await auditLogRepository.create({
        entityType: 'Payment',
        entityId: paymentId,
        eventType: 'PaymentFlaggedForReview',
        metadata: {
          sessionId,
          reason: 'Session duration below 50%',
          actualDurationMs,
          reviewThreshold,
          flaggedAt: new Date().toISOString()
        } as Prisma.InputJsonValue,
      });
      return;
    }

    await paymentRepository.updatePaymentStatus(paymentId, 'settled');
    await prisma.payment.update({
      where: { id: paymentId },
      data: { settledAt: new Date() },
    });

    await auditLogRepository.create({
      entityType: 'Payment',
      entityId: paymentId,
      eventType: 'PaymentSettled',
      metadata: {
        sessionId,
        amount: paymentAmount,
        currency,
        settledAt: new Date().toISOString(),
        trigger: 'session_completed',
      } as Prisma.InputJsonValue,
    });

    logger.info('[sessions] payment settled', { sessionId, paymentId, amount: paymentAmount, currency });
  } catch (error: unknown) {
    // Payment failure must NOT fail the session update — log and continue
    logger.error('[sessions] payment settlement failed (non-fatal)', error, { sessionId });
  }
};

const sessionRepository = new SessionRepository();
const professionalRepository = new ProfessionalRepository();

// Get all sessions for the authenticated user
export const getSessions = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';

    try {
        const hasPagination = typeof req.query.page === 'string' || typeof req.query.pageSize === 'string';
        const pageRaw = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
        const pageSizeRaw = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : 20;
        const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
        const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 50) : 20;

        if (hasPagination) {
            let totalCount = 0;
            let items: unknown[] = [];
            if (user.role === 'admin') {
                [totalCount, items] = await prisma.$transaction([
                    prisma.session.count(),
                    prisma.session.findMany({
                        orderBy: { createdAt: 'desc' },
                        skip: (page - 1) * pageSize,
                        take: pageSize
                    })
                ]);
            } else if (user.role === 'professional') {
                const professional = await professionalRepository.findByUserId(user.userId);
                if (!professional) {
                    return res.status(404).json({ message: 'Professional profile not found' });
                }
                const where: Prisma.SessionWhereInput = { professionalId: professional.id };
                [totalCount, items] = await prisma.$transaction([
                    prisma.session.count({ where }),
                    prisma.session.findMany({
                        where,
                        orderBy: { createdAt: 'desc' },
                        skip: (page - 1) * pageSize,
                        take: pageSize
                    })
                ]);
            } else {
                const where: Prisma.SessionWhereInput = {
                    booking: {
                        buyerId: user.userId
                    }
                };
                [totalCount, items] = await prisma.$transaction([
                    prisma.session.count({ where }),
                    prisma.session.findMany({
                        where,
                        orderBy: { createdAt: 'desc' },
                        skip: (page - 1) * pageSize,
                        take: pageSize
                    })
                ]);
            }
            res.set('X-Total-Count', String(totalCount));
            res.set('X-Page', String(page));
            res.set('X-Page-Size', String(pageSize));
            return res.json(items);
        }

        if (user.role === 'admin') {
            const sessions = await sessionRepository.findAll();
            if (sessions.length === 0) {
                logger.warn('[sessions] sessions empty', { correlationId, userId: user.userId, role: user.role });
            }
            return res.json(sessions);
        }

        if (user.role === 'professional') {
            const professional = await professionalRepository.findByUserId(user.userId);
            if (!professional) {
                return res.status(404).json({ message: 'Professional profile not found' });
            }

            const sessions = await prisma.session.findMany({
                where: { professionalId: professional.id }
            });
            if (sessions.length === 0) {
                logger.warn('[sessions] sessions empty', { correlationId, userId: user.userId, role: user.role });
            }
            return res.json(sessions);
        }

        const sessions = await prisma.session.findMany({
            where: {
                booking: {
                    buyerId: user.userId
                }
            }
        });
        if (sessions.length === 0) {
            logger.warn('[sessions] sessions empty', { correlationId, userId: user.userId, role: user.role });
        }
        return res.json(sessions);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[sessions] sessions fetch failed', error, { correlationId, userId: user.userId, role: user.role });
        res.status(500).json({ message: 'Error fetching sessions', error: message });
    }
};

// Start a session
export const startSession = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) {
        return res.status(400).json({ message: 'Session id is required' });
    }

    try {
        const session = await sessionRepository.findById(id);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        if (user.role === 'professional') {
            const professional = await professionalRepository.findByUserId(user.userId);
            if (!professional) {
                return res.status(404).json({ message: 'Professional profile not found' });
            }
            if (session.professionalId !== professional.id) {
                return res.status(403).json({ message: 'Forbidden: You do not own this session' });
            }
        }

        if (session.status !== 'pending') {
            return res.status(400).json({ message: 'Session must be pending to start' });
        }

        const updated = await sessionRepository.update(id, {
            status: 'active',
            startedAt: new Date()
        });

        // Notification Hooks
        console.log(`[NOTIFICATION - BUYER]: Session ${id} has started!`);
        console.log(`[NOTIFICATION - PROFESSIONAL]: Session ${id} has started!`);

        logger.info('[sessions] session started', { correlationId, sessionId: id, userId: user.userId, role: user.role });
        res.json(updated);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[sessions] session start failed', error, { correlationId, sessionId: id, userId: user.userId, role: user.role });
        res.status(500).json({ message: 'Error starting session', error: message });
    }
};

// End a session
export const endSession = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) {
        return res.status(400).json({ message: 'Session id is required' });
    }

    const { status } = req.body as { status: 'completed' | 'failed' };
    if (!status || !['completed', 'failed'].includes(status)) {
        return res.status(400).json({ message: 'Valid status is required' });
    }

    try {
        const session = await sessionRepository.findById(id);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        if (user.role === 'professional') {
            const professional = await professionalRepository.findByUserId(user.userId);
            if (!professional) {
                return res.status(404).json({ message: 'Professional profile not found' });
            }
            if (session.professionalId !== professional.id) {
                return res.status(403).json({ message: 'Forbidden: You do not own this session' });
            }
        }

        if (session.status !== 'active') {
            return res.status(400).json({ message: 'Session is not active' });
        }

        const updated = await sessionRepository.updateSessionStatus(id, status);

        // Auto-settle payment when session completes successfully
        if (status === 'completed') {
          await settlePaymentForSession(id);
        }

        // Notification Hooks
        console.log(`[NOTIFICATION - BUYER]: Session ${id} has been completed.`);
        console.log(`[NOTIFICATION - PROFESSIONAL]: Session ${id} has been completed and payment settled.`);

        logger.info('[sessions] session ended', { correlationId, sessionId: id, status, userId: user.userId, role: user.role });
        res.json(updated);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[sessions] session end failed', error, { correlationId, sessionId: id, userId: user.userId, role: user.role });
        res.status(500).json({ message: 'Error ending session', error: message });
    }
};

export const disputeSession = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ message: 'Reason is required' });

    try {
        const session = await sessionRepository.findById(id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        // Update payment status to disputed
        const payment = await paymentRepository.findBySessionId(id);
        if (payment) {
            await paymentRepository.updatePaymentStatus(payment.id, 'disputed');
        }

        await auditLogRepository.create({
            entityType: 'Session',
            entityId: id,
            eventType: 'SessionDisputedManual',
            metadata: {
                userId: user.userId,
                reason,
                timestamp: new Date().toISOString()
            } as Prisma.InputJsonValue
        });

        res.json({ success: true, message: 'Session dispute recorded' });
    } catch (error: unknown) {
        logger.error('[sessions] dispute failed', error);
        res.status(500).json({ message: 'Error recording dispute' });
    }
};

export const updateSessionRecording = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const { recordingUrl } = req.body;

    if (!recordingUrl) return res.status(400).json({ message: 'Recording URL is required' });

    try {
        const session = await sessionRepository.findById(id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        // Update session with recording URL
        await prisma.session.update({
            where: { id },
            data: { recordingUrl } as any
        });

        await auditLogRepository.create({
            entityType: 'Session',
            entityId: id,
            eventType: 'SessionRecordingUpdated',
            metadata: {
                userId: user.userId,
                recordingUrl,
                timestamp: new Date().toISOString()
            } as Prisma.InputJsonValue
        });

        res.json({ success: true, message: 'Session recording updated' });
    } catch (error: unknown) {
        logger.error('[sessions] recording update failed', error);
        res.status(500).json({ message: 'Error updating recording' });
    }
};
