import { Router } from 'express';
import { getPayments } from './payment.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.get('/payments', authenticate, getPayments);

export default router;
