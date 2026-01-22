import { Router } from 'express';
import { getSessions, startSession, endSession } from './session.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();

router.get('/sessions', authenticate, getSessions);
router.post('/sessions/:id/start', authenticate, authorize(['professional', 'admin']), startSession);
router.post('/sessions/:id/end', authenticate, authorize(['professional', 'admin']), endSession);

export default router;
