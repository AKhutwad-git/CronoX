import { Request, Response } from 'express';
import { BookingRepository } from './booking.repository';
import { TimeTokenRepository } from '../marketplace/time-token.repository';
import { ProfessionalRepository } from '../users/professional.repository';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { logger } from '../../lib/logger';

const bookingRepository = new BookingRepository();
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
            return res.status(400).json({ message: 'tokenId and scheduledAt are required' });
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

        logger.info('[booking] booking creation requested', {
            tokenId,
            buyerId: user.userId,
            scheduledAt: scheduledDate.toISOString()
        });

        const result = await bookingRepository.createWithSession({
            timeTokenId: tokenId,
            buyerId: user.userId,
            professionalId: token.professionalId,
            scheduledAt: scheduledDate
        });

        logger.info('[booking] booking created', {
            bookingId: result.booking.id,
            sessionId: result.session.id,
            tokenId
        });

        res.status(201).json(result);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[booking] booking creation failed', error);
        res.status(500).json({ message: 'Error creating booking', error: message });
    }
};

export const getBookings = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });
        
        let bookings;
        if (user.role === 'professional') {
             const professional = await professionalRepository.findByUserId(user.userId);
             if (!professional) {
                 return res.status(404).json({ message: 'Professional profile not found' });
             }
             bookings = await bookingRepository.findByProfessionalId(professional.id);
        } else {
             bookings = await bookingRepository.findByBuyerId(user.userId);
        }
        
        if (Array.isArray(bookings) && bookings.length === 0) {
            logger.warn('[booking] bookings empty', { userId: user.userId, role: user.role });
        }
        res.json(bookings);
    } catch (error: unknown) {
         const message = error instanceof Error ? error.message : 'Unknown error';
         logger.error('[booking] bookings fetch failed', error);
         res.status(500).json({ message: 'Error fetching bookings', error: message });
    }
};
