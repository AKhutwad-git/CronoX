import { Router } from 'express';
import { createBooking, getBookings } from './booking.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();

router.post('/bookings', authenticate, authorize(['buyer']), createBooking);
router.get('/bookings', authenticate, getBookings);

export default router;
