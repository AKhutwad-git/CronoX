const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function createBuyerUser() {
  try {
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const buyer = await prisma.user.create({
      data: {
        email: 'buyer@test.com',
        passwordHash: hashedPassword,
        role: 'buyer',
      }
    });
    
    console.log('Buyer user created:', buyer);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('Buyer user already exists');
    } else {
      console.error('Error creating buyer:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createBuyerUser();
