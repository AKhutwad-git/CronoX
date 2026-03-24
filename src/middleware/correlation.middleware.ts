import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger, emitTelemetryEvent } from '../lib/logger';
import { AuthenticatedRequest } from './auth.middleware';

type RequestMetric = {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
};

const requestMetrics = new Map<string, RequestMetric>();

export const getRequestMetricsSnapshot = () =>
  Array.from(requestMetrics.entries()).map(([key, metric]) => ({
    key,
    ...metric,
    averageDurationMs: metric.count ? metric.totalDurationMs / metric.count : 0
  }));

const toRouteKey = (req: Request) => {
  const routePath = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
  return `${req.method} ${routePath}`;
};

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationHeader = req.headers['x-correlation-id'];
  const correlationId = Array.isArray(correlationHeader) ? correlationHeader[0] : correlationHeader || uuidv4();
  const startTime = process.hrtime.bigint();

  req.headers['x-correlation-id'] = correlationId;
  (req as AuthenticatedRequest).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  logger.info('request_received', {
    correlationId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  emitTelemetryEvent('request', {
    correlationId,
    method: req.method,
    path: req.originalUrl
  });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
    const statusCode = res.statusCode;
    const routeKey = toRouteKey(req);
    const metric = requestMetrics.get(routeKey) || {
      count: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      minDurationMs: Number.POSITIVE_INFINITY
    };
    metric.count += 1;
    metric.totalDurationMs += durationMs;
    metric.maxDurationMs = Math.max(metric.maxDurationMs, durationMs);
    metric.minDurationMs = Math.min(metric.minDurationMs, durationMs);
    if (statusCode >= 400) {
      metric.errorCount += 1;
    }
    requestMetrics.set(routeKey, metric);

    logger.info('request_completed', {
      correlationId,
      method: req.method,
      path: req.originalUrl,
      route: routeKey,
      statusCode,
      durationMs
    });

    emitTelemetryEvent('metric', {
      correlationId,
      method: req.method,
      path: req.originalUrl,
      route: routeKey,
      statusCode,
      durationMs,
      errorCount: metric.errorCount,
      requestCount: metric.count
    });
  });

  next();
};
