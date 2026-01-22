import { Request, Response } from 'express';
import { BookingRepository } from './booking.repository';
import { SessionRepository } from './session.repository';
import { TimeTokenRepository } from '../marketplace/time-token.repository';
import { ProfessionalRepository } from '../users/professional.repository';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import prisma from '../../lib/prisma';

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

    const newBooking = await bookingRepository.createWithValidation({
      timeTokenId: tokenId,
      buyerId: user.userId,
      professionalId: token.professionalId,
      scheduledAt: new Date(scheduledAt),
    });

    res.status(201).json(newBooking);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
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

    const token = await timeTokenRepository.findById(booking.tokenId);
    if (!token) {
      return res.status(404).json({ message: 'TimeToken not found' });
    }

    const newSession = await sessionRepository.createWithValidation({
      bookingId,
      professionalId: token.professionalId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: 'pending'
    });

    res.status(201).json(newSession);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
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
    res.json(bookings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error fetching bookings', error: message });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    if (user.role === 'admin') {
      const sessions = await sessionRepository.findAll();
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
      return res.json(sessions);
    }

    const sessions = await prisma.session.findMany({
      where: {
        booking: {
          buyerId: user.userId
        }
      }
    });
    return res.json(sessions);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error fetching sessions', error: message });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) return res.status(400).json({ message: 'Booking id is required' });

    const booking = await bookingRepository.findById(id);
    if (!booking) return res.status(404).send('Booking not found');

    await bookingRepository.update(id, { status: 'cancelled' });
    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error cancelling booking', error: message });
  }
};

export const cancelSession = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) return res.status(400).json({ message: 'Session id is required' });

    const session = await sessionRepository.findById(id);
    if (!session) return res.status(404).send('Session not found');

    await sessionRepository.updateSessionStatus(id, 'failed');
    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error cancelling session', error: message });
  }
};
