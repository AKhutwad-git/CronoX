import { Router } from 'express';
import {
  createBooking,
  createSession,
  getBookings,
  getSessions,
  cancelBooking,
  cancelSession,
  scheduleBooking,
  getWeeklyAvailability,
  upsertWeeklyAvailability,
  getAvailabilitySlots,
  createAvailabilitySlots,
} from './scheduling.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();

router.get('/bookings', authenticate, getBookings);
router.post('/bookings', authenticate, authorize(['buyer']), createBooking);
router.post('/bookings/:id/schedule', authenticate, authorize(['professional']), scheduleBooking);
router.delete('/bookings/:id', authenticate, cancelBooking);

router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:id', authenticate, cancelSession);

router.get('/availability/weekly', authenticate, getWeeklyAvailability);
router.put('/availability/weekly', authenticate, authorize(['professional']), upsertWeeklyAvailability);
router.get('/availability/slots', authenticate, getAvailabilitySlots);
router.post('/availability/slots', authenticate, authorize(['professional']), createAvailabilitySlots);

export default router;
