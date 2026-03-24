import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { BookingRepository } from './booking.repository';
import { SessionRepository } from './session.repository';
import { TimeTokenRepository } from '../marketplace/time-token.repository';
import { ProfessionalRepository } from '../users/professional.repository';
import { AuditLogRepository } from '../auditing/audit-log.repository';
import { PaymentRepository } from '../payments/payment.repository';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';

const bookingRepository = new BookingRepository();
const sessionRepository = new SessionRepository();
const timeTokenRepository = new TimeTokenRepository();
const professionalRepository = new ProfessionalRepository();
const auditLogRepository = new AuditLogRepository();
const paymentRepository = new PaymentRepository();

const recordAudit = async (entityType: string, entityId: string, eventType: string, metadata?: Record<string, unknown>) => {
  try {
    await auditLogRepository.create({
      entityType,
      entityId,
      eventType,
      metadata: metadata 
        ? (metadata as Prisma.InputJsonValue) 
        : undefined
    });
  } catch (error: unknown) {
    logger.error('[scheduling] audit log failed', error);
  }
};

const findAvailabilitySlot = async (professionalId: string, startAt: Date, endAt: Date) => {
  return prisma.availabilitySlot.findFirst({
    where: {
      professionalId,
      startAt: { lte: startAt },
      endAt: { gte: endAt },
      status: 'available'
    }
  });
};

const isWeeklyAvailable = async (professionalId: string, startAt: Date, durationMinutes: number) => {
  const startMinute = startAt.getUTCHours() * 60 + startAt.getUTCMinutes();
  const endMinute = startMinute + durationMinutes;
  if (endMinute > 24 * 60) {
    return false;
  }
  const dayOfWeek = startAt.getUTCDay();
  const availability = await prisma.weeklyAvailability.findFirst({
    where: {
      professionalId,
      dayOfWeek,
      startMinute: { lte: startMinute },
      endMinute: { gte: endMinute }
    }
  });
  return !!availability;
};

const hasSessionOverlap = async (professionalId: string, startAt: Date, endAt: Date) => {
  const overlap = await prisma.session.findFirst({
    where: {
      professionalId,
      startedAt: { not: null, lt: endAt },
      endedAt: { not: null, gt: startAt },
      status: { notIn: ['cancelled_by_buyer', 'cancelled_by_professional', 'refunded'] }
    }
  });
  return !!overlap;
};

export const createBooking = async (req: Request, res: Response) => {
  try {
    const { tokenId, scheduledAt } = req.body as { tokenId?: string; scheduledAt?: string };
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!tokenId || !scheduledAt) {
      return res.status(400).json({ message: 'Token ID and scheduledAt are required' });
    }

    const token = await timeTokenRepository.findById(tokenId);
    if (!token) {
      return res.status(404).json({ message: 'TimeToken not found' });
    }

    if (token.ownerId !== user.userId) {
      return res.status(403).json({ message: 'Forbidden: You do not own this token' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ message: 'scheduledAt must be a valid date' });
    }

    const endDate = new Date(scheduledDate.getTime() + token.durationMinutes * 60000);
    if (await hasSessionOverlap(token.professionalId, scheduledDate, endDate)) {
      return res.status(409).json({ message: 'Selected time overlaps with another session' });
    }

    const availabilitySlot = await findAvailabilitySlot(token.professionalId, scheduledDate, endDate);
    if (!availabilitySlot) {
      const weeklyAvailable = await isWeeklyAvailable(token.professionalId, scheduledDate, token.durationMinutes);
      if (!weeklyAvailable) {
        return res.status(400).json({ message: 'Selected time is outside availability' });
      }
    }

    logger.info('[scheduling] booking creation requested', {
      tokenId,
      buyerId: user.userId,
      scheduledAt: scheduledDate.toISOString()
    });

    const result = await bookingRepository.createWithSession({
      timeTokenId: tokenId,
      buyerId: user.userId,
      professionalId: token.professionalId,
      scheduledAt: scheduledDate,
    });

    if (availabilitySlot) {
      await prisma.availabilitySlot.update({
        where: { id: availabilitySlot.id },
        data: { status: 'blocked' }
      });
    }

    await recordAudit('Booking', result.booking.id, 'BookingCreated', {
      tokenId,
      buyerId: user.userId,
      professionalId: token.professionalId
    });

    logger.info('[scheduling] booking created', {
      bookingId: result.booking.id,
      sessionId: result.session.id,
      tokenId
    });

    res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[scheduling] booking creation failed', error);
    res.status(500).json({ message: 'Error creating booking', error: message });
  }
};

/**
 * POST /api/scheduling/bookings/:id/schedule
 * Professional picks a date/time for a pending_schedule booking.
 * Transitions: pending_schedule → scheduled, auto-creates Session.
 */
export const scheduleBooking = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { scheduledAt } = req.body as { scheduledAt?: string };
    const user = (req as AuthenticatedRequest).user;

    console.log("REQ.USER:", user);
    console.log("REQ.BODY:", req.body);

    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!id) return res.status(400).json({ message: 'Booking id is required' });
    if (!scheduledAt) return res.status(400).json({ message: 'scheduledAt is required' });

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ message: 'scheduledAt must be a valid date' });
    }
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ message: 'scheduledAt must be in the future' });
    }

    const booking = await bookingRepository.getBookingWithDetails(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status !== 'pending_schedule' && booking.status !== 'scheduled') {
      return res.status(400).json({ message: `Booking is in '${booking.status}' state, expected 'pending_schedule' or 'scheduled'` });
    }

    // Verify the requesting user is the professional who owns this token
    const professional = await professionalRepository.findByUserId(user.userId);
    if (!professional) return res.status(404).json({ message: 'Professional profile not found' });
    if (booking.token.professionalId !== professional.id) {
      return res.status(403).json({ message: 'Forbidden: You do not own this booking' });
    }

    const token = booking.token;
    const endDate = new Date(scheduledDate.getTime() + token.durationMinutes * 60000);

    // Validate availability
    if (await hasSessionOverlap(professional.id, scheduledDate, endDate)) {
      return res.status(409).json({ message: 'Selected time overlaps with another session' });
    }

    const availabilitySlot = await findAvailabilitySlot(professional.id, scheduledDate, endDate);
    if (!availabilitySlot) {
      const weeklyAvailable = await isWeeklyAvailable(professional.id, scheduledDate, token.durationMinutes);
      if (!weeklyAvailable) {
        return res.status(400).json({ message: 'Selected time is outside your availability' });
      }
    }

    // Generate Jitsi meeting link
    const meetingLink = `https://meet.jit.si/session-${id}`;

    // Update booking: set scheduledAt, status, meetingLink
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        scheduledAt: scheduledDate,
        status: 'scheduled',
        meetingLink,
      },
      include: {
        token: { include: { professional: { include: { user: { select: { email: true } } } } } },
        buyer: { select: { email: true } },
      }
    });

    // Auto-create or Update session
    let session = booking.session || null;
    try {
      if (session) {
        session = await prisma.session.update({
          where: { id: session.id },
          data: {
            startedAt: scheduledDate,
            endedAt: endDate,
            status: 'pending'
          }
        });
      } else {
        session = await sessionRepository.createWithValidation({
          bookingId: id,
          professionalId: professional.id,
          startTime: scheduledDate,
          endTime: endDate,
          status: 'pending'
        });
      }
    } catch (sessionError: unknown) {
      logger.warn('[scheduling] session auto-creation during scheduling failed', sessionError instanceof Error ? { error: sessionError.message } : undefined);
    }

    if (availabilitySlot) {
      await prisma.availabilitySlot.update({
        where: { id: availabilitySlot.id },
        data: { status: 'blocked' }
      });
    }

    const isReschedule = !!booking.scheduledAt;
    await recordAudit('Booking', id, isReschedule ? 'BookingRescheduled' : 'BookingScheduled', {
      professionalId: professional.id,
      scheduledAt: scheduledDate.toISOString(),
      meetingLink,
      sessionId: session?.id ?? null,
    });

    // Add Notification Hooks
    // After scheduling -> notify buyer and professional
    console.log(`[NOTIFICATION - BUYER]: Your session for Booking ${id} has been scheduled for ${scheduledDate.toISOString()}. Meeting link: ${meetingLink}`);
    console.log(`[NOTIFICATION - PROFESSIONAL]: You have scheduled Booking ${id} for ${scheduledDate.toISOString()}. Meeting link: ${meetingLink}`);

    logger.info('[scheduling] booking scheduled', {
      bookingId: id,
      sessionId: session?.id,
      scheduledAt: scheduledDate.toISOString(),
      meetingLink,
    });

    res.json({ booking: updatedBooking, session, meetingLink });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[scheduling] booking schedule failed', error);
    res.status(500).json({ message: 'Error scheduling booking', error: message });
  }
};

export const createSession = async (req: Request, res: Response) => {
  try {
    const { bookingId, startTime, endTime } = req.body as {
      bookingId?: string;
      startTime?: string;
      endTime?: string;
    };

    if (!bookingId || !startTime || !endTime) {
      return res.status(400).json({ message: 'Booking ID, startTime, and endTime are required' });
    }

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Cancelled bookings cannot be scheduled' });
    }

    const token = await timeTokenRepository.findById(booking.tokenId);
    if (!token) {
      return res.status(404).json({ message: 'TimeToken not found' });
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'startTime and endTime must be valid dates' });
    }
    if (startDate >= endDate) {
      return res.status(400).json({ message: 'startTime must be before endTime' });
    }

    const newSession = await sessionRepository.createWithValidation({
      bookingId,
      professionalId: token.professionalId,
      startTime: startDate,
      endTime: endDate,
      status: 'pending'
    });

    logger.info('[scheduling] session created', { sessionId: newSession.id, bookingId });
    res.status(201).json(newSession);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[scheduling] session creation failed', error);
    res.status(500).json({ message: 'Error creating session', error: message });
  }
};

export const getBookings = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const hasPagination = typeof req.query.page === 'string' || typeof req.query.pageSize === 'string';
    const pageRaw = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
    const pageSizeRaw = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : 20;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 50) : 20;

    if (hasPagination) {
      let result: { totalCount: number; items: unknown[] };
      if (user.role === 'admin') {
        result = await bookingRepository.findAllPaginated(page, pageSize);
      } else if (user.role === 'professional') {
        const professional = await professionalRepository.findByUserId(user.userId);
        if (!professional) {
          return res.status(404).json({ message: 'Professional profile not found' });
        }
        result = await bookingRepository.findByProfessionalIdPaginated(professional.id, page, pageSize);
      } else {
        result = await bookingRepository.findByBuyerIdPaginated(user.userId, page, pageSize);
      }
      res.set('X-Total-Count', String(result.totalCount));
      res.set('X-Page', String(page));
      res.set('X-Page-Size', String(pageSize));
      return res.json(result.items);
    }

    let bookings: unknown[] = [];
    if (user.role === 'admin') {
      bookings = await bookingRepository.findAll();
    } else if (user.role === 'professional') {
      const professional = await professionalRepository.findByUserId(user.userId);
      if (!professional) {
        return res.status(404).json({ message: 'Professional profile not found' });
      }
      bookings = await bookingRepository.findByProfessionalId(professional.id);
    } else {
      bookings = await bookingRepository.findByBuyerId(user.userId);
    }
    if (bookings.length === 0) {
      logger.warn('[scheduling] bookings empty', { userId: user.userId, role: user.role });
    }
    res.json(bookings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[scheduling] bookings fetch failed', error);
    res.status(500).json({ message: 'Error fetching bookings', error: message });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

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
        logger.warn('[scheduling] sessions empty', { userId: user.userId, role: user.role });
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
        logger.warn('[scheduling] sessions empty', { userId: user.userId, role: user.role });
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
      logger.warn('[scheduling] sessions empty', { userId: user.userId, role: user.role });
    }
    return res.json(sessions);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[scheduling] sessions fetch failed', error);
    res.status(500).json({ message: 'Error fetching sessions', error: message });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) return res.status(400).json({ message: 'Booking id is required' });

    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const booking = await bookingRepository.getBookingWithDetails(id);
    if (!booking) return res.status(404).send('Booking not found');

    if (user.role !== 'admin') {
      if (user.role === 'buyer' && booking.buyerId !== user.userId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this booking' });
      }
      if (user.role === 'professional') {
        const professional = await professionalRepository.findByUserId(user.userId);
        if (!professional) {
          return res.status(404).json({ message: 'Professional profile not found' });
        }
        if (booking.token.professionalId !== professional.id) {
          return res.status(403).json({ message: 'Forbidden: You do not own this booking' });
        }
      }
    }

    await bookingRepository.update(id, { status: 'cancelled' });
    const sessionStatus = user.role === 'professional' ? 'cancelled_by_professional' : 'cancelled_by_buyer';
    if (booking.session?.id) {
      await sessionRepository.updateSessionStatus(booking.session.id, sessionStatus);
      const payment = await paymentRepository.findBySessionId(booking.session.id);
      if (payment && payment.status !== 'refunded') {
        await paymentRepository.updatePaymentStatus(payment.id, 'refund_requested');
      }
    }
    await recordAudit('Booking', id, 'BookingCancelled', {
      cancelledBy: user.role,
      sessionId: booking.session?.id ?? null
    });
    logger.info('[scheduling] booking cancelled', { bookingId: id });
    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[scheduling] booking cancel failed', error);
    res.status(500).json({ message: 'Error cancelling booking', error: message });
  }
};

export const cancelSession = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) return res.status(400).json({ message: 'Session id is required' });

    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const session = await prisma.session.findUnique({
      where: { id },
      include: { booking: true }
    });
    if (!session) return res.status(404).send('Session not found');

    if (user.role !== 'admin') {
      if (user.role === 'buyer' && session.booking.buyerId !== user.userId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this session' });
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
    }

    const sessionStatus = user.role === 'professional' ? 'cancelled_by_professional' : 'cancelled_by_buyer';
    await sessionRepository.updateSessionStatus(id, sessionStatus);
    const payment = await paymentRepository.findBySessionId(id);
    if (payment && payment.status !== 'refunded') {
      await paymentRepository.updatePaymentStatus(payment.id, 'refund_requested');
    }
    await recordAudit('Session', id, 'SessionCancelled', {
      cancelledBy: user.role,
      bookingId: session.bookingId
    });
    logger.info('[scheduling] session cancelled', { sessionId: id });
    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[scheduling] session cancel failed', error);
    res.status(500).json({ message: 'Error cancelling session', error: message });
  }
};

export const getWeeklyAvailability = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const professionalIdParam = req.query.professionalId;
    const professionalId = Array.isArray(professionalIdParam) ? professionalIdParam[0] : professionalIdParam;

    let targetProfessionalId = professionalId;
    if (!targetProfessionalId) {
      if (!user) return res.status(401).json({ message: 'Unauthorized' });
      if (user.role === 'professional') {
        const professional = await professionalRepository.findByUserId(user.userId);
        if (!professional) {
          return res.status(404).json({ message: 'Professional profile not found' });
        }
        targetProfessionalId = professional.id;
      } else {
        return res.status(400).json({ message: 'professionalId is required' });
      }
    }

    const availability = await prisma.weeklyAvailability.findMany({
      where: { professionalId: targetProfessionalId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }]
    });
    res.json(availability);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error fetching availability', error: message });
  }
};

export const upsertWeeklyAvailability = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (user.role !== 'professional') {
      return res.status(403).json({ message: 'Forbidden: Professional only' });
    }

    const professional = await professionalRepository.findByUserId(user.userId);
    if (!professional) {
      return res.status(404).json({ message: 'Professional profile not found' });
    }

    const { availability } = req.body as {
      availability?: Array<{ dayOfWeek: number; startMinute: number; endMinute: number; timezone?: string }>;
    };

    if (!availability || availability.length === 0) {
      return res.status(400).json({ message: 'availability is required' });
    }

    for (const entry of availability) {
      if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
        return res.status(400).json({ message: 'dayOfWeek must be between 0 and 6' });
      }
      if (entry.startMinute < 0 || entry.startMinute >= 24 * 60) {
        return res.status(400).json({ message: 'startMinute must be between 0 and 1439' });
      }
      if (entry.endMinute <= entry.startMinute || entry.endMinute > 24 * 60) {
        return res.status(400).json({ message: 'endMinute must be between 1 and 1440' });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.weeklyAvailability.deleteMany({ where: { professionalId: professional.id } });
      await tx.weeklyAvailability.createMany({
        data: availability.map((entry) => ({
          professionalId: professional.id,
          dayOfWeek: entry.dayOfWeek,
          startMinute: entry.startMinute,
          endMinute: entry.endMinute,
          timezone: entry.timezone || 'UTC'
        }))
      });
    });

    await recordAudit('Professional', professional.id, 'WeeklyAvailabilityUpdated', {
      entries: availability.length
    });

    const updated = await prisma.weeklyAvailability.findMany({
      where: { professionalId: professional.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }]
    });
    res.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error updating availability', error: message });
  }
};

export const getAvailabilitySlots = async (req: Request, res: Response) => {
  try {
    const professionalIdParam = req.query.professionalId;
    const professionalId = Array.isArray(professionalIdParam) ? professionalIdParam[0] : professionalIdParam;
    if (!professionalId) {
      return res.status(400).json({ message: 'professionalId is required' });
    }

    const startAtParam = req.query.startAt;
    const endAtParam = req.query.endAt;
    const startAt = typeof startAtParam === 'string' ? new Date(startAtParam) : undefined;
    const endAt = typeof endAtParam === 'string' ? new Date(endAtParam) : undefined;
    if (startAt && Number.isNaN(startAt.getTime())) {
      return res.status(400).json({ message: 'startAt must be a valid date' });
    }
    if (endAt && Number.isNaN(endAt.getTime())) {
      return res.status(400).json({ message: 'endAt must be a valid date' });
    }

    const slots = await prisma.availabilitySlot.findMany({
      where: {
        professionalId,
        ...(startAt || endAt
          ? {
              startAt: startAt ? { gte: startAt } : undefined,
              endAt: endAt ? { lte: endAt } : undefined
            }
          : {})
      },
      orderBy: { startAt: 'asc' }
    });
    res.json(slots);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error fetching availability slots', error: message });
  }
};

export const createAvailabilitySlots = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (user.role !== 'professional') {
      return res.status(403).json({ message: 'Forbidden: Professional only' });
    }

    const professional = await professionalRepository.findByUserId(user.userId);
    if (!professional) {
      return res.status(404).json({ message: 'Professional profile not found' });
    }

    const { slots } = req.body as {
      slots?: Array<{ startAt: string; endAt: string; status?: 'available' | 'blocked' }>;
    };

    if (!slots || slots.length === 0) {
      return res.status(400).json({ message: 'slots is required' });
    }

    const payload = slots.map((slot) => {
      const startAt = new Date(slot.startAt);
      const endAt = new Date(slot.endAt);
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        throw new Error('Invalid slot dates');
      }
      if (startAt >= endAt) {
        throw new Error('Slot startAt must be before endAt');
      }
      return {
        professionalId: professional.id,
        startAt,
        endAt,
        status: slot.status || 'available'
      };
    });

    await prisma.availabilitySlot.createMany({
      data: payload
    });

    await recordAudit('Professional', professional.id, 'AvailabilitySlotsCreated', {
      count: payload.length
    });

    const created = await prisma.availabilitySlot.findMany({
      where: { professionalId: professional.id },
      orderBy: { startAt: 'asc' }
    });
    res.status(201).json(created);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error creating availability slots', error: message });
  }
};
