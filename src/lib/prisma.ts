import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import { logger } from './logger';

if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL is not set');
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
  ],
  adapter,
});

prisma.$on('error', (e) => {
  logger.error('Prisma Error', e);
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma Warning', e);
});

// prisma.$on('query', (e) => {
//   logger.info('Prisma Query', { query: e.query, params: e.params, duration: e.duration });
// });

export default prisma;