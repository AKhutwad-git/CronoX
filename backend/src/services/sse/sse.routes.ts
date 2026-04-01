import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { sseHandler } from './sse.controller';

const router = Router();

router.get('/events', authenticate, sseHandler);

export default router;
