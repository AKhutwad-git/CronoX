import { Prisma, PrismaClient } from '@prisma/client';
import prisma from './prisma';
import { logger } from './logger';

export type RepositoryModel<T, TCreateData, TUpdateData> = {
  findUnique: (args: unknown) => Promise<T | null>;
  findMany: (args?: unknown) => Promise<T[]>;
  create: (args: { data: TCreateData }) => Promise<T>;
  update: (args: { where: { id: string }; data: TUpdateData }) => Promise<T>;
};

export abstract class BaseRepository<T, TCreateData, TUpdateData> {
  protected abstract get model(): RepositoryModel<T, TCreateData, TUpdateData>;

  protected handleError(error: unknown, context: string): never {
    logger.error(`Database Error in ${context}`, error);
    throw error;
  }

  async findById(id: string): Promise<T | null> {
    try {
      return await this.model.findUnique({ where: { id } });
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  async findAll(): Promise<T[]> {
    try {
      return await this.model.findMany();
    } catch (error) {
      this.handleError(error, 'findAll');
    }
  }

  async create(data: TCreateData): Promise<T> {
    try {
      return await this.model.create({ data });
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  async update(id: string, data: TUpdateData): Promise<T> {
    try {
      return await this.model.update({ where: { id }, data });
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  async delete(id: string): Promise<T> {
    try {
      return await this.model.update({ 
        where: { id }, 
        data: { deletedAt: new Date() } as TUpdateData 
      });
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const item = await this.model.findUnique({ 
        where: { id }, 
        select: { id: true } 
      });
      return !!item;
    } catch (error) {
      this.handleError(error, 'exists');
    }
  }

  protected async withTransaction<T>(fn: (prisma: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await prisma.$transaction(fn);
    } catch (error) {
      this.handleError(error, 'withTransaction');
    }
  }
}
