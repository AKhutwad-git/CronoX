import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from '../lib/logger';

export interface ErrorWithStatus extends Error {
    status?: number;
    statusCode?: number;
}

/**
 * Global error handler middleware
 * Catches all errors and returns consistent JSON response
 * Logs errors with correlation ID for traceability
 */
export const globalErrorHandler: ErrorRequestHandler = (
    err: ErrorWithStatus,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    const correlationId = req.headers['x-correlation-id'] as string || 'unknown';
    const statusCode = err.status || err.statusCode || 500;

    // Log the error with context
    logger.error('Unhandled error', err, {
        correlationId,
        path: req.path,
        method: req.method,
        statusCode,
    });

    // Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction && statusCode === 500
        ? 'Internal server error'
        : err.message || 'Internal server error';

    res.status(statusCode).json({
        error: {
            message,
            correlationId,
            ...(isProduction ? {} : { stack: err.stack }),
        },
    });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    const correlationId = req.headers['x-correlation-id'] as string || 'unknown';

    res.status(404).json({
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            correlationId,
        },
    });
};
