import { Request, Response, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TimeTokenRepository } from './time-token.repository';
import { MarketplaceOrderRepository } from './marketplace-order.repository';
import { AuditLogRepository } from '../auditing/audit-log.repository';
import { ProfessionalRepository } from '../users/professional.repository';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { Prisma, TimeToken, TokenState } from '@prisma/client';
import { logger } from '../../lib/logger';

const timeTokenRepository = new TimeTokenRepository();
const orderRepository = new MarketplaceOrderRepository();
const auditLogRepository = new AuditLogRepository();
const professionalRepository = new ProfessionalRepository();
const listedTokensCache = new Map<
  string,
  { expiresAt: number; payload: { items: unknown[]; totalCount: number; currentPage: number; pageSize: number } }
>();
const listedTokensCacheTtlMs = 15000;

const clearListedTokensCache = () => {
  listedTokensCache.clear();
};

// Helper to transition state logic (pure function)
type TimeTokenRecord = TimeToken;

type MintTokenBody = {
  startTime?: string;
  duration: number;
  price: number;
  title?: string;
  description?: string;
  topics?: string[];
  expertiseTags?: string[];
};

const isTokenState = (value: string): value is TokenState =>
  ['drafted', 'listed', 'purchased', 'consumed', 'cancelled'].includes(value);

const canTransition = (from: TokenState, to: TokenState): boolean => {
  const validTransitions: Record<TokenState, TokenState[]> = {
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
    const { startTime, duration, price, title, description, topics, expertiseTags } = (req as AuthenticatedRequest).body as MintTokenBody;
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
      price,
      title,
      description,
      topics,
      expertiseTags
    });

    clearListedTokensCache();
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
  newState: TokenState
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

    if (!isTokenState(token.state) || !canTransition(token.state, newState)) {
      return res.status(400).json({ message: `Invalid state transition from ${token.state} to ${newState}` });
    }

    // Update state
    const updatedToken = (await timeTokenRepository.update(id as string, {
      state: newState,
    })) as TimeTokenRecord;

    clearListedTokensCache();
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
        clearListedTokensCache();
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

    const tokenWithProfessional = await timeTokenRepository.findByIdWithProfessional(id as string);
    if (!tokenWithProfessional) {
      return res.status(404).json({ message: 'TimeToken not found' });
    }
    // FocusScore is advisory, not a hard gate for purchases
    try {
      const { getLatestValidFocusScore } = await import('../metrics/focus-score.service');
      const validScore = await getLatestValidFocusScore(tokenWithProfessional.professional.userId);
      if (!validScore) {
        logger.warn(`[marketplace] No valid FocusScore for professional ${tokenWithProfessional.professional.userId}, proceeding with purchase anyway`);
      }
    } catch (fsErr) {
      logger.warn('[marketplace] FocusScore check failed, proceeding', fsErr instanceof Error ? { error: fsErr.message } : undefined);
    }

    const buyerId = user?.userId;
    if (!buyerId) return res.status(401).json({ message: 'Unauthorized' });

    // Phase 4: Create a Stripe PaymentIntent instead of immediate order creation
    const { createPaymentIntent } = await import('../payments/stripe.service');
    
    const paymentIntent = await createPaymentIntent(Number(token.price), token.currency || 'INR', {
      tokenId: token.id,
      buyerId: buyerId
    });

    // We do not create the MarketplaceOrder here anymore. 
    // The Stripe Webhook (stripe.controller.ts) will create it upon payment success.

    res.json({ token, clientSecret: paymentIntent.client_secret });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error purchasing token', error: message });
  }
};

export const getListedTimeTokens: RequestHandler = async (req, res: Response) => {
  try {
    logger.info('[marketplace] GET /api/marketplace/tokens received');
    const parseList = (value: unknown) => {
      if (Array.isArray(value)) {
        return value.flatMap((entry) => String(entry).split(',')).map((entry) => entry.trim()).filter(Boolean);
      }
      if (typeof value === 'string') {
        return value.split(',').map((entry) => entry.trim()).filter(Boolean);
      }
      return [];
    };

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const skills = parseList(req.query.skills);
    const topics = parseList(req.query.topics);

    const minPriceRaw = typeof req.query.minPrice === 'string' ? Number(req.query.minPrice) : undefined;
    const maxPriceRaw = typeof req.query.maxPrice === 'string' ? Number(req.query.maxPrice) : undefined;
    const minPrice = Number.isFinite(minPriceRaw) ? minPriceRaw : undefined;
    const maxPrice = Number.isFinite(maxPriceRaw) ? maxPriceRaw : undefined;

    const pageRaw = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
    const pageSizeRaw = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : 12;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 50) : 12;

    const cacheKey = JSON.stringify({
      search,
      skills: [...skills].sort(),
      topics: [...topics].sort(),
      minPrice,
      maxPrice,
      page,
      pageSize
    });
    const cached = listedTokensCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.payload);
    }

    const { totalCount, items } = await timeTokenRepository.findListedCardsWithFilters({
      search,
      skills,
      topics,
      minPrice,
      maxPrice,
      page,
      pageSize
    });

    const payload = { items, totalCount, currentPage: page, pageSize };
    listedTokensCache.set(cacheKey, { expiresAt: Date.now() + listedTokensCacheTtlMs, payload });
    logger.info('[marketplace] GET /api/marketplace/tokens result', { count: items.length, totalCount, page, pageSize });
    res.json(payload);
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
    const hasPagination = typeof req.query.page === 'string' || typeof req.query.pageSize === 'string';
    const pageRaw = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
    const pageSizeRaw = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : 20;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 50) : 20;

    if (hasPagination) {
      let result: { totalCount: number; items: unknown[] };
      if (user.role === 'admin') {
        result = await orderRepository.findAllPaginated(page, pageSize);
      } else if (user.role === 'professional') {
        result = await orderRepository.findByProfessionalPaginated(user.userId, page, pageSize);
      } else {
        result = await orderRepository.findByBuyerIdPaginated(user.userId, page, pageSize);
      }
      res.set('X-Total-Count', String(result.totalCount));
      res.set('X-Page', String(page));
      res.set('X-Page-Size', String(pageSize));
      return res.json(result.items);
    }

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

    // Bio-Temporal advisory check (non-blocking)
    if (token.state === 'listed') {
      try {
        const { getLatestValidFocusScore } = await import('../metrics/focus-score.service');
        const validScore = await getLatestValidFocusScore(token.professional.userId);
        if (!validScore) {
          logger.warn(`[marketplace] No valid FocusScore for professional ${token.professional.userId} on token ${token.id}`);
        }
      } catch (fsErr) {
        logger.warn('[marketplace] FocusScore check failed', fsErr instanceof Error ? { error: fsErr.message } : undefined);
      }
    }

    res.json(token);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ message: 'Error', error: message });
  }
};
