import { Router } from 'express';
import { createMetric } from './metrics.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.post('/', authenticate, createMetric);

export default router;
