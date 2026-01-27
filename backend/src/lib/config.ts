import 'dotenv/config';
import { logger } from './logger';

// Validate required environment variables at startup
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'] as const;

function validateEnv(): void {
    const missing: string[] = [];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    if (missing.length > 0) {
        const message = `Missing required environment variables: ${missing.join(', ')}`;
        logger.error(message);
        throw new Error(message);
    }

    // Validate JWT_SECRET is not a weak default
    const jwtSecret = process.env.JWT_SECRET!;
    if (jwtSecret.length < 32 || jwtSecret === 'your-secret-key') {
        const message = 'JWT_SECRET must be at least 32 characters and not a default value';
        logger.error(message);
        throw new Error(message);
    }
}

// Run validation immediately on import
validateEnv();

// Export validated config
export const config = {
    database: {
        url: process.env.DATABASE_URL!,
    },
    jwt: {
        secret: process.env.JWT_SECRET!,
        expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as string,
    },
    server: {
        port: parseInt(process.env.PORT || '4000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
    },
} as const;

export type Config = typeof config;
