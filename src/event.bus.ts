import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from './services/auditing/audit.controller';
import { Actor } from './services/auditing/audit.model';

type EventPayload = Record<string, unknown>;
type EventListener = (event: {
  id: string;
  type: string;
  timestamp: Date;
  data: EventPayload;
}) => void;

const listeners: { [key: string]: EventListener[] } = {};

export const emitEvent = (eventType: string, data: EventPayload, actor: Actor = 'system') => {
  const eventId = uuidv4();
  const event = {
    id: eventId,
    type: eventType,
    timestamp: new Date(),
    data,
  };

  const entityId = typeof data.id === 'string' ? data.id : 'unknown';
  createAuditLog(eventId, entityId, eventType, actor, data).catch(err =>
    console.error('Audit log failed', err)
  );

  if (listeners[eventType]) {
    listeners[eventType].forEach(listener => listener(event));
  }
};

export const onEvent = (eventType: string, listener: EventListener) => {
  if (!listeners[eventType]) {
    listeners[eventType] = [];
  }
  listeners[eventType].push(listener);
};
