import prisma from '../src/lib/prisma';

async function verify() {
  let pro = await prisma.user.findUnique({
    where: { email: 'pro@test.com' },
    include: {
      professional: {
        include: {
          weeklyAvailability: true,
          tokens: true
        }
      }
    }
  });

  if (!pro || !pro.professional) {
    console.log('Professional not found');
    return;
  }

  // Ensure availability is UTC (240-720) for Wednesday (3)
  if (pro.professional.weeklyAvailability.length === 0 || pro.professional.weeklyAvailability[0].startMinute !== 240) {
    console.log('Resetting availability to UTC (04:00-12:00)...');
    await prisma.weeklyAvailability.deleteMany({ where: { professionalId: pro.professional.id } });
    await prisma.weeklyAvailability.create({
      data: {
        professionalId: pro.professional.id,
        dayOfWeek: 3,
        startMinute: 240,
        endMinute: 720,
        timezone: 'UTC'
      }
    });
  }

  // Ensure token exists
  if (pro.professional.tokens.length === 0) {
    console.log('Creating Expert Consultation token...');
    await prisma.timeToken.create({
      data: {
        professionalId: pro.professional.id,
        title: 'Expert Consultation',
        description: 'Deep dive into technical architecture.',
        price: 500,
        durationMinutes: 60,
        state: 'listed'
      } as any // Use any to bypass strict enum if needed, but state: listed matches schema
    });
  }

  // Final verification
  const finalPro = await prisma.user.findUnique({
    where: { email: 'pro@test.com' },
    include: { professional: { include: { weeklyAvailability: true, tokens: true } } }
  });

  console.log('Professional ID:', finalPro?.professional?.id);
  console.log('Weekly Availability:', JSON.stringify(finalPro?.professional?.weeklyAvailability, null, 2));
  console.log('Tokens:', JSON.stringify(finalPro?.professional?.tokens, null, 2));
}

verify().catch(console.error).finally(() => prisma.$disconnect());
