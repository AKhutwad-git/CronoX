import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

type TableRow = {
    table_name: string;
    table_schema: string;
};

async function verifyDb() {
    try {
        logger.info('Verifying database tables...');

        // Query information_schema
        const result = await prisma.$queryRaw`
      SELECT table_name, table_schema
      FROM information_schema.tables 
      WHERE table_schema = 'public' OR table_schema = 'cronox'
    `;

        const rows = result as TableRow[];
        logger.info(`Found ${rows.length} tables.`);
        rows.forEach(r => logger.info(` - ${r.table_schema}.${r.table_name}`));

        const tables = rows.map(r => r.table_name);
        // Note: Database tables are case sensitive if created with quotes. 
        // My init-db.sql used quotes "User", so they should be "User".
        const expected = ['User', 'Professional', 'TimeToken', 'MarketplaceOrder', 'Booking', 'Session', 'Payment', 'AuditLog'];
        const missing = expected.filter(t => !tables.includes(t));

        if (missing.length > 0) {
            logger.error(`❌ Missing tables: ${missing.join(', ')}`);
            process.exit(1);
        } else {
            logger.info('✅ All expected tables found.');

            // Check if they are in the correct schema
            const schemaCounts = rows.reduce<Record<string, number>>((acc, row) => {
                acc[row.table_schema] = (acc[row.table_schema] || 0) + 1;
                return acc;
            }, {});
            logger.info('Schema distribution:', schemaCounts);
        }
    } catch (error) {
        logger.error('❌ Verification failed', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifyDb();
