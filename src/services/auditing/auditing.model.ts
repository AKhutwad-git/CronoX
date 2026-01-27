import { v4 as uuidv4 } from 'uuid';

export interface AuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  timestamp: Date;
  userId: string;
}
