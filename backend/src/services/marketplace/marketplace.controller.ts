import { Request, Response, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TimeTokenRepository } from './time-token.repository';
import { MarketplaceOrderRepository } from './marketplace-order.repository';
import { AuditLogRepository } from '../auditing/audit-log.repository';
import { ProfessionalRepository } from '../users/professional.repository';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { TimeTokenState } from './marketplace.model';
import { Prisma, TimeToken } from '@prisma/client';
import { logger } from '../../lib/logger';

const timeTokenRepository = new TimeTokenRepository();
const orderRepository = new MarketplaceOrderRepository();
const auditLogRepository = new AuditLogRepository();
const professionalRepository = new ProfessionalRepository();

// Helper to transition state logic (pure function)
type TimeTokenRecord = TimeToken;

type MintTokenBody = {
  startTime?: string;
  duration: number;
  price: number;
};

const isTimeTokenState = (value: string): value is TimeTokenState =>
  ['drafted', 'listed', 'purchased', 'consumed', 'cancelled'].includes(value);

const canTransition = (from: TimeTokenState, to: TimeTokenState): boolean => {
  const validTransitions: Record<TimeTokenState, TimeTokenState[]> = {
    drafted: ['listed', 'cancelled'],
    listed: ['purchased', 'cancelled'],
    purchased: ['consumed', 'cancelled'],
    consumed: [],
    cancelled: [],
  };
  return !!validTransitions[from]?.includes(to);
};

const emitEvent = async (eventType: string, data: Record<string, unknown>) => {
  try {
    await auditLogRepository.create({
      entityType: 'TimeToken', // or generic 'MarketplaceEvent'
      entityId: typeof data.tokenId === 'string' ? data.tokenId : 'unknown',
      eventType,
      metadata: data as Prisma.InputJsonValue,
    });
  } catch (err: unknown) {
    console.error('Failed to emit event', err);
  }
};

export const mintTimeToken: RequestHandler = async (req, res: Response) => {
  try {
    const { startTime, duration, price } = (req as AuthenticatedRequest).body as MintTokenBody;
    const user = (req as AuthenticatedRequest).user;

    if (!user || user.role !== 'professional') {
      return res.status(403).json({ message: 'Forbidden: You can only mint tokens for yourself.' });
    }

    const professional = await professionalRepository.findByUserId(user.userId);
    if (!professional) {
        return res.status(404).json({ message: 'Professional profile not found' });
    }

    // Use createWithValidation. Note: startTime is ignored by repo logic as per schema.
    const newToken = await timeTokenRepository.createWithValidation({
      professionalId: professional.id,
      duration,
      price
    });

    await emitEvent('TokenMinted', { tokenId: newToken.id, professionalId: professional.id, price });
    res.status(201).json(newToken);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error minting token', error: message });
  }
};

const transitionTokenState = async (
  req: AuthenticatedRequest,
  res: Response,
  newState: TimeTokenState
) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const token = (await timeTokenRepository.findById(id as string)) as TimeTokenRecord | null;

    if (!token) {
      return res.status(404).json({ message: 'TimeToken not found' });
    }

    if (user?.role !== 'admin') {
      const professional = await professionalRepository.findByUserId(user?.userId || '');
      if (!professional || token.professionalId !== professional.id) {
        return res.status(403).json({ message: 'Forbidden: You do not own this token.' });
      }
    }

    if (!isTimeTokenState(token.state) || !canTransition(token.state, newState)) {
      return res.status(400).json({ message: `Invalid state transition from ${token.state} to ${newState}` });
    }

    // Update state
    const updatedToken = (await timeTokenRepository.update(id as string, {
      state: newState,
    })) as TimeTokenRecord;

    if (newState === 'purchased') {
      const buyerId = user?.userId;
      if (!buyerId) return res.status(401).json({ message: 'Unauthorized' });

      // Update buyer/owner
      await timeTokenRepository.update(updatedToken.id, { ownerId: buyerId });

      await emitEvent('TokenPurchased', { tokenId: token.id, buyerId, price: token.price });
    } else if (newState === 'consumed') {
      await emitEvent('TokenConsumed', { tokenId: token.id, buyerId: token.ownerId });
    }

    res.json(updatedToken);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error updating token', error: message });
  }
};

export const listTimeToken: RequestHandler = async (req, res: Response) =>
  transitionTokenState(req as AuthenticatedRequest, res, 'listed');

export const consumeTimeToken: RequestHandler = async (req, res: Response) => {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    try {
        if (!id) {
            return res.status(400).json({ message: 'Token id is required' });
        }

        const token = (await timeTokenRepository.findById(id)) as TimeTokenRecord | null;
        if (!token) {
            return res.status(404).json({ message: 'TimeToken not found' });
        }

        if (token.state !== 'purchased') {
             return res.status(400).json({ message: 'Token must be purchased to be consumed' });
        }

        if (!canTransition(token.state, 'consumed')) {
            return res.status(400).json({ message: 'Invalid state transition' });
        }

        const updatedToken = (await timeTokenRepository.update(id, {
          state: 'consumed',
        })) as TimeTokenRecord;
        await emitEvent('TokenConsumed', { tokenId: token.id, buyerId: token.ownerId });
        res.json(updatedToken);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Error consuming token', error: message });
    }
};

export const purchaseTimeToken: RequestHandler = async (req, res: Response) => {
  const { id } = req.params;
  const user = (req as AuthenticatedRequest).user;

  try {
    const token = (await timeTokenRepository.findById(id as string)) as TimeTokenRecord | null;

    if (!token) {
      return res.status(404).json({ message: 'TimeToken not found' });
    }

    if (token.state !== 'listed') {
      return res.status(400).json({ message: 'This token is not available for purchase.' });
    }

    const buyerId = user?.userId;
    if (!buyerId) return res.status(401).json({ message: 'Unauthorized' });

    // Use createWithValidation for Atomic-like operation (Repo handles Order creation logic part)
    // But Repo createWithValidation checks TOKEN state.
    // So we should NOT update token state directly HERE if Repo does it.
    // Checking MarketplaceOrderRepository.createWithValidation (Step 603): It updates timeToken state to purchased.
    // So we just call orderRepository.createWithValidation.

    // BUT we need token.price for validation/payment logic.
    // Controller can pass it.

    // Note: older logic updated token state here.
    // I moved that logic to OrderRepository.createWithValidation.
    // So I call that.

    const newOrder = await orderRepository.createWithValidation({
      timeTokenId: token.id,
      buyerId,
      pricePaid: Number(token.price),
      currency: token.currency || 'INR'
    });

    await emitEvent('TokenPurchased', { tokenId: token.id, buyerId, price: token.price });
    res.json({ token, order: newOrder });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error purchasing token', error: message });
  }
};

export const getListedTimeTokens: RequestHandler = async (req, res: Response) => {
  try {
    logger.info('[marketplace] GET /api/marketplace/tokens received');
    const tokens = await timeTokenRepository.findByState('listed');
    logger.info('[marketplace] GET /api/marketplace/tokens result', { count: tokens.length });
    res.json(tokens);
  } catch (error: unknown) {
    logger.error('[marketplace] GET /api/marketplace/tokens failed', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    res.status(500).json({ 
      message: 'Internal server error while fetching tokens',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getOrders: RequestHandler = async (req, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    let orders: unknown[] = [];
    if (user.role === 'admin') {
      orders = await orderRepository.findAll();
    } else if (user.role === 'professional') {
      orders = await orderRepository.findByProfessional(user.userId);
    } else {
      orders = await orderRepository.findByBuyerId(user.userId);
    }
    res.json(orders);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error fetching orders', error: message });
  }
};

export const cancelTimeToken: RequestHandler = async (req, res: Response) =>
  transitionTokenState(req as AuthenticatedRequest, res, 'cancelled');

export const getTimeTokenById: RequestHandler = async (req, res: Response) => {
  try {
    logger.info('[marketplace] GET /api/marketplace/tokens/:id received', { id: req.params.id });
    const token = await timeTokenRepository.findByIdWithProfessional(req.params.id as string);
    if (!token) {
      return res.status(404).json({ message: 'TimeToken not found' });
    }
    res.json(token);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ message: 'Error', error: message });
  }
};
