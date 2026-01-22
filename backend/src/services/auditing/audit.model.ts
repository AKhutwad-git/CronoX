export type Actor = 'system' | 'buyer' | 'professional' | 'admin';

export interface AuditLog {
  id: string;
  eventId: string;
  entityId: string;
  eventType: string;
  actor: Actor;
  timestamp: Date;
  details: Record<string, unknown>;
}
