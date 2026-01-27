import { Router } from 'express';
import {
  mintTimeToken,
  listTimeToken,
  purchaseTimeToken,
  consumeTimeToken,
  cancelTimeToken,
  getListedTimeTokens,
  getTimeTokenById,
  getOrders,
} from './marketplace.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();

// Public routes
router.get('/tokens', getListedTimeTokens);
router.get('/tokens/:id', getTimeTokenById);

// Authenticated routes
router.get('/orders', authenticate, getOrders);

// Professional-only routes
router.post('/tokens/mint', authenticate, authorize(['professional']), mintTimeToken);
router.post('/tokens/:id/list', authenticate, authorize(['professional']), listTimeToken);

// Buyer-only routes
router.post('/tokens/:id/purchase', authenticate, authorize(['buyer']), purchaseTimeToken);

// Professional or Admin routes
router.post('/tokens/:id/consume', authenticate, authorize(['professional', 'admin']), consumeTimeToken);
router.post('/tokens/:id/cancel', authenticate, authorize(['professional', 'admin']), cancelTimeToken);

export default router;
