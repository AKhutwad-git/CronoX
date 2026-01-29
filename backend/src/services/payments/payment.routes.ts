import { Router } from 'express';
import {
  getPayments,
  requestRefund,
  approveRefund,
  rejectRefund,
  disputePayment
} from './payment.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();

router.get('/', authenticate, getPayments);
router.post('/:id/refund', authenticate, authorize(['buyer', 'professional', 'admin']), requestRefund);
router.post('/:id/refund/approve', authenticate, authorize(['professional', 'admin']), approveRefund);
router.post('/:id/refund/reject', authenticate, authorize(['professional', 'admin']), rejectRefund);
router.post('/:id/dispute', authenticate, authorize(['buyer', 'admin']), disputePayment);

export default router;
