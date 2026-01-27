
import prisma from '../lib/prisma';

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful!');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
