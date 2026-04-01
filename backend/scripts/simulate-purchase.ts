import prisma from '../src/lib/prisma';
import { TokenState, BookingStatus } from '@prisma/client';

async function simulatePurchase() {
  const buyer = await prisma.user.findUnique({
    where: { email: 'buyer_new@test.com' }
  });

  if (!buyer) {
    console.error('Buyer not found');
    return;
  }

  const token = await prisma.timeToken.findFirst({
    where: {
      title: 'Expert Consultation',
      state: 'listed'
    }
  });

  if (!token) {
    console.error('Listed token not found');
    return;
  }

  console.log(`Processing purchase for token ${token.id} by buyer ${buyer.id}`);

  // 1. Update Token
  await prisma.timeToken.update({
    where: { id: token.id },
    data: {
      state: 'purchased' as TokenState,
      ownerId: buyer.id
    }
  });

  // 2. Create Order
  await prisma.marketplaceOrder.create({
    data: {
      tokenId: token.id,
      buyerId: buyer.id,
      pricePaid: token.price,
      currency: token.currency
    }
  });

  // 3. Create Booking
  const booking = await prisma.booking.create({
    data: {
      tokenId: token.id,
      buyerId: buyer.id,
      status: 'pending_schedule' as BookingStatus
    }
  });

  console.log('Purchase simulated successfully!');
  console.log('Booking ID:', booking.id);
  console.log('Token State: purchased');
}

simulatePurchase().catch(console.error).finally(() => prisma.$disconnect());
