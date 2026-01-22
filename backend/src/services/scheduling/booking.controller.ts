import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { BookingRepository } from './booking.repository';
import { SessionRepository } from './session.repository';
import { TimeTokenRepository } from '../marketplace/time-token.repository';
import { ProfessionalRepository } from '../users/professional.repository';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

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
        
        // 1. Validate Token
        const token = await timeTokenRepository.findById(tokenId);
        if (!token) {
             return res.status(404).json({ message: 'TimeToken not found' });
        }
        
        if (token.ownerId !== user.userId) {
            return res.status(403).json({ message: 'Forbidden: You do not own this token' });
        }

        // 2. Create Booking
        const newBooking = await bookingRepository.createWithValidation({
            timeTokenId: tokenId,
            buyerId: user.userId,
            professionalId: token.professionalId,
            scheduledAt: new Date(scheduledAt)
        });
        
        // 3. Create Session
        const startTime = new Date(scheduledAt);
        const endTime = new Date(startTime.getTime() + token.durationMinutes * 60000);
        
        const newSession = await sessionRepository.createWithValidation({
            bookingId: newBooking.id,
            professionalId: token.professionalId,
            startTime,
            endTime,
            status: 'pending'
        });
        
        res.status(201).json({ booking: newBooking, session: newSession });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
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
        
        res.json(bookings);
    } catch (error: unknown) {
         const message = error instanceof Error ? error.message : 'Unknown error';
         res.status(500).json({ message: 'Error fetching bookings', error: message });
    }
};
