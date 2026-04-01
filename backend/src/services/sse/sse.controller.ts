import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { logger } from '../../lib/logger';

const sseClients: Record<string, Response> = {};
const onlineUsers = new Set<string>();

export const isUserOnline = (userId: string) => {
  return onlineUsers.has(userId);
};

export const sseHandler = (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userId = user.userId;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx if present

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', userId })}\n\n`);

  // Store client connection
  sseClients[userId] = res;
  onlineUsers.add(userId);
  logger.info(`[SSE] Client connected: ${userId}`);
  logger.info(`[SSE] User ONLINE: ${userId}`);
  console.log("Online users:", Array.from(onlineUsers));

  // Cleanup on disconnect
  req.on('close', () => {
    delete sseClients[userId];
    onlineUsers.delete(userId);
    logger.info(`[SSE] Client disconnected: ${userId}`);
    logger.info(`[SSE] User OFFLINE: ${userId}`);
    console.log("Online users:", Array.from(onlineUsers));
  });
};

export const sendSSE = (userId: string, event: { type: string; bookingId?: string; [key: string]: any }) => {
  const client = sseClients[userId];
  if (client) {
    client.write(`data: ${JSON.stringify(event)}\n\n`);
    logger.info(`[SSE] Sent event ${event.type} to user ${userId}`);
    return true;
  }
  return false;
};

// Heartbeat to keep connections alive
setInterval(() => {
  const ping = JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() });
  Object.values(sseClients).forEach((client) => {
    client.write(`data: ${ping}\n\n`);
  });
}, 15000);
