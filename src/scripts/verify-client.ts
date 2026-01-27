import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

async function verifyClient() {
    try {
        logger.info('Verifying database via Prisma Client query...');

        // Attempt to query the User table
        // If the table doesn't exist, this will throw a specific error
        const count = await prisma.user.count();

        logger.info(`✅ Success! User table exists. Current user count: ${count}`);

        // Also verify another table to be sure
        const profCount = await prisma.professional.count();
        logger.info(`✅ Success! Professional table exists. Count: ${profCount}`);

    } catch (error: unknown) {
        logger.error('❌ Verification failed', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifyClient();
