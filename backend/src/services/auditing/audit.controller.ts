import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuditLogRepository } from './audit-log.repository';
import { Actor } from './audit.model';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const auditLogRepository = new AuditLogRepository();

// Create a new audit log
export const createAuditLog = async (
  eventId: string,
  entityId: string,
  eventType: string,
  actor: Actor,
  details: Record<string, unknown>
) => {
  try {
    await auditLogRepository.create({
      // id: eventId, // Repository create() might typically generate ID. 
      // If we want to use eventId as ID, we need BaseRepo support or pass manual ID field if supported.
      // BaseRepository create separates ID generation usually?
      // For now, we'll let Repo generate its ID or check if we can force it.
      // If eventId is crucial for tracing, we put it in metadata.
      // Schema has id field.
      entityType: 'SystemEvent', // Or deduce from details?
      entityId,
      eventType,
      metadata: { ...details, actor, originalEventId: eventId }
    });
  } catch (error: unknown) {
    console.error('Failed to create audit log', error);
  }
};

// Get all audit logs
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await auditLogRepository.findAll();
    res.json(logs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Error fetching audit logs', error: message });
  }
};
