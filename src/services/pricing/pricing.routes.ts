import { Router } from 'express';
import { calculatePrice } from './pricing.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.post('/calculate', authenticate, calculatePrice);

export default router;
