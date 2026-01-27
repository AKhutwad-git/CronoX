import { Request, Response } from 'express';
import { BookingRepository } from './booking.repository';
import { SessionRepository } from './session.repository';
import { TimeTokenRepository } from '../marketplace/time-token.repository';
import { ProfessionalRepository } from '../users/professional.repository';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';

const bookingRepository = new BookingRepository();
const sessionRepository = new SessionRepository();
const timeTokenRepository = new TimeTokenRepository();
const professionalRepository = new ProfessionalRepository();

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

    await sessionRepository.updateSessionStatus(id, 'failed');
    logger.info('[scheduling] session cancelled', { sessionId: id });
    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[scheduling] session cancel failed', error);
    res.status(500).json({ message: 'Error cancelling session', error: message });
  }
};
