import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from './auditing.model';

const auditLogs: AuditLog[] = [];

export const createAuditLog = (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
  const newLog: AuditLog = {
    id: uuidv4(),
    ...log,
    timestamp: new Date(),
  };
  auditLogs.push(newLog);
};

export const getAuditLogs = (req: Request, res: Response) => {
  res.json(auditLogs);
};
