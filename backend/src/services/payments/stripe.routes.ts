import { Router } from 'express';
import express from 'express';
import { handleStripeWebhook } from './stripe.controller';

const router = Router();

// We need the raw body for Stripe webhook signature verification
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

export default router;
