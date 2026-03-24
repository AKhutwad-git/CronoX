import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../lib/config';
import { logger } from '../lib/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
  correlationId?: string;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const correlationId = req.headers['x-correlation-id'] as string;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; role: string };
    req.user = decoded;
    req.correlationId = correlationId;
    next();
  } catch (error) {
    logger.error('Token verification failed', error, { correlationId });
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
