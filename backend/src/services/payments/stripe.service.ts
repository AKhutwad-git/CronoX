import Stripe from 'stripe';
import { config } from '../../lib/config';

// Ensure the STRIPE_SECRET_KEY is at least partially mocked if not in environment
const stripeSecret = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

export const stripe = new Stripe(stripeSecret, {
  apiVersion: '2026-02-25.clover',
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

export const createPaymentIntent = async (amount: number, currency: string = 'INR', metadata?: Record<string, string>) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to subunits (e.g. paise)
      currency: currency.toLowerCase(),
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return paymentIntent;
  } catch (error) {
    console.error('Stripe createPaymentIntent error', error);
    throw error;
  }
};
