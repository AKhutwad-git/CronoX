const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createProfessionalProfile() {
  try {
    // First check if professional exists for user
    const user = await prisma.user.findUnique({ where: { email: 'ron@gmail.com' } });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    let professional = await prisma.professional.findFirst({ where: { userId: user.id } });
    
    if (!professional) {
      professional = await prisma.professional.create({
        data: {
          userId: user.id,
          baseRate: 100,
          currency: 'INR',
          status: 'active',
          fullName: 'Ron Professional',
          bio: 'Experienced professional ready to help',
          availabilitySummary: 'Available weekdays 9-5',
          skills: ['consulting', 'mentoring'],
          certifications: ['cert1', 'cert2']
        }
      });
      console.log('Professional profile created:', professional.id);
    } else {
      console.log('Professional profile already exists:', professional.id);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createProfessionalProfile();
