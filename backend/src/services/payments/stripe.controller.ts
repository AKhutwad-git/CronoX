import { Request, Response } from 'express';
import { stripe, STRIPE_WEBHOOK_SECRET } from './stripe.service';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';

const isIdempotentError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  return (
    message.includes('Unique constraint failed') ||
    message.includes('not available for purchase') ||
    message.includes('already exists') ||
    message.includes('Booking already exists')
  );
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  console.log("Webhook HIT");

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // ✅ ALWAYS use Stripe constructEvent (no JSON.parse)
    if (!sig) {
      return res.status(400).send('Webhook Error: Missing stripe-signature');
    }

    event = stripe.webhooks.constructEvent(
      req.body, // MUST be raw buffer
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Webhook Error: ${message}`);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any;

        logger.info(`PaymentIntent for ${paymentIntent.amount} was successful!`);

        const tokenId = paymentIntent.metadata?.tokenId;
        const buyerId = paymentIntent.metadata?.buyerId;

        if (!tokenId || !buyerId) {
          logger.warn(`Missing metadata for paymentIntent ${paymentIntent.id}`);
          break;
        }

        // 🔹 Fetch token
        const token = await prisma.timeToken.findUnique({
          where: { id: tokenId },
        });

        if (!token) {
          throw new Error(`Token ${tokenId} not found`);
        }

        if (token.state !== 'listed') {
          logger.warn(`Token ${tokenId} not in listed state`);
          break;
        }

        // 🔹 Update token → purchased
        await prisma.timeToken.update({
          where: { id: tokenId },
          data: {
            state: 'purchased',
            ownerId: buyerId,
          },
        });

        logger.info(`Token ${tokenId} updated to purchased`);

        // 🔹 Create order (idempotent-safe)
        try {
          const { MarketplaceOrderRepository } = await import('../marketplace/marketplace-order.repository');
          const orderRepo = new MarketplaceOrderRepository();

          await orderRepo.createWithValidation({
            timeTokenId: tokenId,
            buyerId,
            pricePaid: paymentIntent.amount / 100,
            currency: paymentIntent.currency.toUpperCase(),
          });

          logger.info(`Order created for token ${tokenId}`);
        } catch (err) {
          if (!isIdempotentError(err)) {
            throw err;
          }
          logger.info(`Order already exists for token ${tokenId}`);
        }

        // 🔹 Check existing booking
        const existingBooking = await prisma.booking.findUnique({
          where: { tokenId },
        });

        if (existingBooking) {
          logger.info(`Booking already exists for token ${tokenId}`);
          break;
        }

        // 🔹 Create booking
        const booking = await prisma.booking.create({
          data: {
            tokenId,
            buyerId,
            scheduledAt: null,
            status: 'pending_schedule',
          },
        });

        logger.info(`Booking created for token ${tokenId}`);

        // 🔔 Notifications (temporary)
        console.log(
          `[NOTIFY PRO]: New booking ${booking.id} for token ${tokenId}`
        );
        console.log(
          `[NOTIFY BUYER]: Booking ${booking.id} created successfully`
        );

        break;
      }

      default:
        logger.info(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: unknown) {
    logger.error('Error processing webhook', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};