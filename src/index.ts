// Load environment variables FIRST before any other imports
import 'dotenv/config';

import express from 'express';
import net from 'net';
import cors from 'cors';
import { config } from './lib/config';
import { logger } from './lib/logger';
import prisma from './lib/prisma';
import { correlationIdMiddleware } from './middleware/correlation.middleware';
import { globalErrorHandler, notFoundHandler } from './middleware/error.middleware';
import authRoutes from './services/users/auth.routes';
import userRoutes from './services/users/user.routes';
import marketplaceRoutes from './services/marketplace/marketplace.routes';
import schedulingRoutes from './services/scheduling/scheduling.routes';
import paymentRoutes from './services/payments/payment.routes';
import pricingRoutes from './services/pricing/pricing.routes';
import metricsRoutes from './services/metrics/metrics.routes';
import auditingRoutes from './services/auditing/auditing.routes';
import sessionRoutes from './services/scheduling/session.routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/scheduling', sessionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/auditing', auditingRoutes);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

/**
 * Graceful shutdown handler
 * Closes database connections and exits cleanly
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

/**
 * Start the server with database connection check
 */
async function startServer(): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const tester = net
        .createServer()
        .once('error', (error: NodeJS.ErrnoException) => {
          reject(error);
        })
        .once('listening', () => {
          tester.close(() => resolve());
        })
        .listen(config.server.port);
    }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Fatal: Port ${config.server.port} is already in use.`);
      } else {
        logger.error('Fatal: Port availability check failed.', error);
      }
      process.exit(1);
    });

    // Verify database connection before starting
    logger.info('Checking database connection...');
    await prisma.$connect();
    logger.info('✅ Database connection successful');

    // Start HTTP server
    const server = app.listen(config.server.port, () => {
      logger.info(`🚀 Backend server is running at http://localhost:${config.server.port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.server.port} is already in use`);
      } else {
        logger.error('Server error', error);
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('❌ Failed to start server', error);
    logger.error('Database connection failed. Exiting...');
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions (don't crash the server)
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', error);
  // In production, you might want to restart gracefully
  // For now, we log but don't crash
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Promise Rejection', reason);
});

// Start the application
startServer();
