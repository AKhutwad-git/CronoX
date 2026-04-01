import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUsers() {
  const timestamp = Date.now();
  const proEmail = `pro+${timestamp}@test.com`;
  const buyerEmail = `buyer+${timestamp}@test.com`;
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const proUser = await prisma.user.create({
      data: {
        email: proEmail,
        passwordHash: hashedPassword,
        role: 'professional',
        professional: {
          create: {
            baseRate: 50,
            currency: 'USD',
            status: 'active',
            fullName: `Test Pro ${timestamp}`,
            bio: 'Test bio',
            availabilitySummary: 'Available always',
            skills: ['testing'],
          }
        }
      },
      include: { professional: true }
    });
    console.log(`Created Professional: ${proEmail} (ID: ${proUser.id})`);

    const buyerUser = await prisma.user.create({
      data: {
        email: buyerEmail,
        passwordHash: hashedPassword,
        role: 'buyer'
      }
    });
    console.log(`Created Buyer: ${buyerEmail} (ID: ${buyerUser.id})`);

  } catch (err) {
    console.error('Error creating users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
