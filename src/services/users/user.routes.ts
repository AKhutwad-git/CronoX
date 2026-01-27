import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
  getUsers,
  getUserById,
  createUser,
  getProfessionals,
  getProfessionalById,
} from './user.controller';

const router = Router();

router.get('/', authenticate, getUsers);
router.post('/', authenticate, createUser);
router.get('/:id', authenticate, getUserById);

router.get('/professionals', getProfessionals);
router.get('/professionals/:id', getProfessionalById);

export default router;
