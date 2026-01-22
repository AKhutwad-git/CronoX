import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

const isPrismaError = (value: unknown): value is { message?: string; meta?: { code?: string } } =>
    typeof value === 'object' && value !== null;

async function applySql() {
    try {
        logger.info('Starting manual database initialization...');

        // Test connection first
        await prisma.$connect();
        logger.info('Database connected.');

        const sqlPath = path.join(__dirname, 'init-db.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        // Split statements (simple split by ;)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await prisma.$executeRawUnsafe(statement);
                logger.info(`Executed: ${statement.substring(0, 30)}...`);
            } catch (error: unknown) {
                if (
                    isPrismaError(error) &&
                    (error.message?.includes('already exists') ||
                        error.meta?.code === '42710' ||
                        error.meta?.code === '42P07')
                ) {
                    logger.warn(`Skipped (exists): ${statement.substring(0, 30)}...`);
                } else {
                    logger.error(`Failed: ${statement.substring(0, 50)}...`, error);
                }
            }
        }

        logger.info('✅ Database initialization complete.');
    } catch (error) {
        logger.error('❌ Database initialization failed', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

applySql();
