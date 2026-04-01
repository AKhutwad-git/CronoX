import prisma from '../src/lib/prisma';
import { BookingStatus, SessionStatus } from '@prisma/client';

async function completeSimulation() {
  const booking = await prisma.booking.findFirst({
    where: { status: 'pending_schedule' as BookingStatus },
    include: { token: { include: { professional: true } } }
  });

  if (!booking) {
    console.error('No pending booking found');
    return;
  }

  const scheduledAt = new Date('2026-03-25T05:00:00Z');
  console.log(`Scheduling booking ${booking.id} for ${scheduledAt.toISOString()}`);

  // 1. Schedule Booking
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      scheduledAt,
      status: 'scheduled' as BookingStatus
    }
  });

  // 2. Create Session
  const session = await prisma.session.create({
    data: {
      bookingId: booking.id,
      professionalId: booking.token.professionalId,
      status: 'pending' as SessionStatus
    }
  });

  console.log('Session created:', session.id);

  // 3. Move to Active/Completed
  await prisma.session.update({
    where: { id: session.id },
    data: {
      startedAt: new Date(),
      status: 'active' as SessionStatus
    }
  });

  await prisma.session.update({
    where: { id: session.id },
    data: {
      endedAt: new Date(Date.now() + 60 * 60 * 1000),
      status: 'completed' as SessionStatus
    }
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'completed' as BookingStatus }
  });

  console.log('Simulation lifecycle COMPLETED!');
}

completeSimulation().catch(console.error).finally(() => prisma.$disconnect());
