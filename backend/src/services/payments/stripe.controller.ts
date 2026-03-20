import { Request, Response } from 'express';
import { stripe, STRIPE_WEBHOOK_SECRET } from './stripe.service';
import { logger } from '../../lib/logger';
import { processSettlement } from './payment.controller';

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
          const orderRepo = new MarketplaceOrderRepository();
          
          try {
            await orderRepo.createWithValidation({
              timeTokenId: tokenId,
              buyerId: buyerId,
              pricePaid: paymentIntent.amount / 100, // convert back to standard currency
              currency: paymentIntent.currency.toUpperCase()
            });
            logger.info(`Token purchase fulfilled for token ${tokenId} by buyer ${buyerId}`);
          } catch (fulfillError) {
             logger.error(`Error fulfilling token purchase for ${tokenId}`, fulfillError);
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
