import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, AuditLog } from '@prisma/client';

export type CreateAuditLogData = Prisma.AuditLogCreateInput;

export class AuditLogRepository extends BaseRepository<
  AuditLog,
  Prisma.AuditLogCreateInput,
  Prisma.AuditLogUpdateInput
> {
  protected get model() {
    return prisma.auditLog as unknown as RepositoryModel<
      AuditLog,
      Prisma.AuditLogCreateInput,
      Prisma.AuditLogUpdateInput
    >;
  }

  async findByEntityId(entityId: string) {
    return prisma.auditLog.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByEventType(eventType: string) {
    return prisma.auditLog.findMany({
      where: { eventType },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Actor search is not supported by schema directly.
  // We can't implement findByActorId without raw query on JSONB or searching all.
  // We'll omit it for now or return empty.

  async create(data: CreateAuditLogData) {
    return prisma.auditLog.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        eventType: data.eventType,
        metadata: data.metadata ?? Prisma.JsonNull
      }
    });
  }

  async update(id: string, data: Prisma.AuditLogUpdateInput): Promise<AuditLog> {
    throw new Error('Audit logs are immutable and cannot be updated');
  }

  async delete(id: string): Promise<AuditLog> {
    throw new Error('Audit logs are immutable and cannot be deleted');
  }

  async getRecentEvents(limit: number = 100) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async getEventsByTimeRange(startTime: Date, endTime: Date) {
    return prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startTime,
          lte: endTime
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
