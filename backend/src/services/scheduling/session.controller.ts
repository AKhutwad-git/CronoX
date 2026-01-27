import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import prisma from '../../lib/prisma';
import { SessionRepository } from './session.repository';
import { ProfessionalRepository } from '../users/professional.repository';
import { logger } from '../../lib/logger';

const sessionRepository = new SessionRepository();
const professionalRepository = new ProfessionalRepository();

// Get all sessions for the authenticated user
export const getSessions = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        if (user.role === 'admin') {
            const sessions = await sessionRepository.findAll();
            if (sessions.length === 0) {
                logger.warn('[sessions] sessions empty', { userId: user.userId, role: user.role });
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
                logger.warn('[sessions] sessions empty', { userId: user.userId, role: user.role });
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
            logger.warn('[sessions] sessions empty', { userId: user.userId, role: user.role });
        }
        return res.json(sessions);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[sessions] sessions fetch failed', error);
        res.status(500).json({ message: 'Error fetching sessions', error: message });
    }
};

// Start a session
export const startSession = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
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

        logger.info('[sessions] session started', { sessionId: id });
        res.json(updated);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[sessions] session start failed', error);
        res.status(500).json({ message: 'Error starting session', error: message });
    }
};

// End a session
export const endSession = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
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
        logger.info('[sessions] session ended', { sessionId: id, status });
        res.json(updated);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[sessions] session end failed', error);
        res.status(500).json({ message: 'Error ending session', error: message });
    }
};
