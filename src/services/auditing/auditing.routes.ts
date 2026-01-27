import { Router } from 'express';
import { getAuditLogs } from './audit.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();

router.get('/', authenticate, authorize(['admin']), getAuditLogs);

export default router;
