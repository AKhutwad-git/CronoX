import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import {
  getUsers,
  getUserById,
  createUser,
  createTestProfessional,
  getProfessionals,
  getProfessionalById,
  getProfessionalMe,
  createProfessionalProfile,
  updateProfessionalProfile,
  updateProfessionalVerification,
  pingUserPresence,
} from './user.controller';

const router = Router();

router.post('/me/ping', authenticate, pingUserPresence);

router.get('/', authenticate, getUsers);
router.post('/', authenticate, createUser);
router.post('/test-create-professional', createTestProfessional); // Temporary test endpoint
router.get('/professionals', getProfessionals);
router.get('/professionals/me', authenticate, authorize(['professional']), getProfessionalMe);
router.post('/professionals/me', authenticate, authorize(['professional']), createProfessionalProfile);
router.patch('/professionals/me', authenticate, authorize(['professional']), updateProfessionalProfile);
router.patch('/professionals/:id/verification', authenticate, authorize(['admin']), updateProfessionalVerification);
router.get('/professionals/:id', getProfessionalById);
router.get('/:id', authenticate, getUserById);

export default router;
