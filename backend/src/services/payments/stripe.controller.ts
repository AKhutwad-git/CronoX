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
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // For local dev where signatures are hard to pass correctly without ngrok, skip strict check if test keys
    if (STRIPE_WEBHOOK_SECRET === 'whsec_placeholder') {
      event = JSON.parse(req.body.toString());
    } else {
      if (!sig) return res.status(400).send('Webhook Error: Missing stripe-signature');
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Webhook Error: ${message}`);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        logger.info(`PaymentIntent for ${paymentIntent.amount} was successful!`);
        
        const tokenId = paymentIntent.metadata?.tokenId;
        const buyerId = paymentIntent.metadata?.buyerId;
        
        if (tokenId && buyerId) {
          const { MarketplaceOrderRepository } = await import('../marketplace/marketplace-order.repository');
          const { SessionRepository } = await import('../scheduling/session.repository');
          const orderRepo = new MarketplaceOrderRepository();
          const sessionRepo = new SessionRepository();
          
          try {
            await orderRepo.createWithValidation({
              timeTokenId: tokenId,
              buyerId: buyerId,
              pricePaid: paymentIntent.amount / 100, // convert back to standard currency
              currency: paymentIntent.currency.toUpperCase()
            });
            logger.info(`Token purchase fulfilled for token ${tokenId} by buyer ${buyerId}`);
          } catch (fulfillError: unknown) {
            if (!isIdempotentError(fulfillError)) {
              throw fulfillError;
            }
            logger.info(`Token purchase already fulfilled for token ${tokenId}`);
          }

          const existingBooking = await prisma.booking.findUnique({
            where: { tokenId },
            include: { session: true }
          });
          if (existingBooking?.session) {
            logger.info(`Booking and session already exist for token ${tokenId}`);
            break;
          }

          if (!existingBooking) {
            const token = await prisma.timeToken.findUnique({
              where: { id: tokenId },
              include: { professional: true }
            });
            if (!token || token.state !== 'purchased' || token.ownerId !== buyerId) {
              throw new Error(`Unable to create booking for token ${tokenId}: purchase state not finalized`);
            }

            const scheduledAt = new Date(Date.now() + 10 * 60 * 1000);
            const booking = await prisma.booking.create({
              data: {
                tokenId,
                buyerId,
                scheduledAt,
                status: 'scheduled'
              }
            });
            logger.info(`Booking created for token ${tokenId}`);

            const endTime = new Date(scheduledAt.getTime() + token.durationMinutes * 60000);
            try {
              await sessionRepo.createWithValidation({
                bookingId: booking.id,
                professionalId: token.professionalId,
                startTime: scheduledAt,
                endTime,
                status: 'pending'
              });
              logger.info(`Session created for booking ${booking.id} on token ${tokenId}`);
            } catch (sessionError: unknown) {
              logger.warn(`Session auto-creation failed for booking ${booking.id}`, sessionError);
            }
          } else if (!existingBooking.session) {
            const token = await prisma.timeToken.findUnique({
              where: { id: tokenId }
            });
            if (!token) {
              throw new Error(`Unable to create session for token ${tokenId}: token missing`);
            }
            const startTime = existingBooking.scheduledAt;
            const endTime = new Date(startTime.getTime() + token.durationMinutes * 60000);
            try {
              await sessionRepo.createWithValidation({
                bookingId: existingBooking.id,
                professionalId: token.professionalId,
                startTime,
                endTime,
                status: 'pending'
              });
              logger.info(`Session created for existing booking on token ${tokenId}`);
            } catch (sessionError: unknown) {
              logger.warn(`Session auto-creation failed for existing booking ${existingBooking.id}`, sessionError);
            }
          }
        } else {
          logger.warn(`PaymentIntent successful but missing tokenId/buyerId in metadata: ${paymentIntent.id}`);
        }
        break;
      }
      default:
        logger.info(`Unhandled event type ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (err: unknown) {
     logger.error('Error processing webhook event', err);
     res.status(500).json({ error: 'Internal server error processing webhook' });
  }
};
