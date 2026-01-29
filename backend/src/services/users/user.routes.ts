import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import {
  getUsers,
  getUserById,
  createUser,
  getProfessionals,
  getProfessionalById,
  getProfessionalMe,
  updateProfessionalProfile,
  updateProfessionalVerification,
} from './user.controller';

const router = Router();

router.get('/', authenticate, getUsers);
router.post('/', authenticate, createUser);
router.get('/:id', authenticate, getUserById);

router.get('/professionals', getProfessionals);
router.get('/professionals/me', authenticate, authorize(['professional']), getProfessionalMe);
router.patch('/professionals/me', authenticate, authorize(['professional']), updateProfessionalProfile);
router.patch('/professionals/:id/verification', authenticate, authorize(['admin']), updateProfessionalVerification);
router.get('/professionals/:id', getProfessionalById);

export default router;
