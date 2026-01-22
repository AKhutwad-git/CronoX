import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, TimeToken } from '@prisma/client';
import { TimeTokenState } from './marketplace.model';

export interface CreateTimeTokenData {
  professionalId: string;
  duration: number;
  price: number;
  state?: TimeTokenState;
}

export interface UpdateTimeTokenData {
  buyerId?: string;
  state?: TimeTokenState;
  duration?: number;
  price?: number;
}

export class TimeTokenRepository extends BaseRepository<
  TimeToken,
  Prisma.TimeTokenUncheckedCreateInput,
  Prisma.TimeTokenUncheckedUpdateInput
> {
  protected get model() {
    return prisma.timeToken as unknown as RepositoryModel<
      TimeToken,
      Prisma.TimeTokenUncheckedCreateInput,
      Prisma.TimeTokenUncheckedUpdateInput
    >;
  }

  async findByProfessionalId(professionalId: string) {
    return prisma.timeToken.findMany({
      where: { professionalId },
      include: { professional: { include: { user: true } } }
    });
  }

  async findByBuyerId(buyerId: string) {
    return prisma.timeToken.findMany({
      where: { ownerId: buyerId },
      include: { professional: { include: { user: true } } }
    });
  }

  async findByState(state: TimeTokenState) {
    return prisma.timeToken.findMany({
      where: { state },
      include: {
        professional: { include: { user: true } },
        owner: true
      }
    });
  }

  async createWithValidation(data: CreateTimeTokenData) {
    const professional = await prisma.professional.findUnique({
      where: { id: data.professionalId }
    });

    if (!professional) {
      throw new Error('Professional not found');
    }

    if (data.duration <= 0) {
      throw new Error('Duration must be positive');
    }

    if (data.price <= 0) {
      throw new Error('Price must be positive');
    }

    return this.create({
      professionalId: data.professionalId,
      durationMinutes: data.duration,
      price: data.price,
      state: data.state || 'drafted'
    });
  }

  private canTransition(from: TimeTokenState, to: TimeTokenState): boolean {
    const validTransitions: Record<TimeTokenState, TimeTokenState[]> = {
      drafted: ['listed', 'cancelled'],
      listed: ['purchased', 'cancelled'],
      purchased: ['consumed', 'cancelled'],
      consumed: [],
      cancelled: []
    };
    return validTransitions[from]?.includes(to) || false;
  }

  async updateState(tokenId: string, newState: TimeTokenState, buyerId?: string) {
    const token = await this.findById(tokenId);
    if (!token) {
      throw new Error('Token not found');
    }

    if (!this.canTransition(token.state, newState)) {
      throw new Error(`Invalid state transition from ${token.state} to ${newState}`);
    }

    const updateData: Record<string, unknown> = { state: newState };
    if (buyerId && newState === 'purchased') {
      updateData.ownerId = buyerId;
    }

    return this.update(tokenId, updateData);
  }

  async updateStatus(tokenId: string, newState: TimeTokenState, buyerId?: string) {
    // Backward compatibility shim
    return this.updateState(tokenId, newState, buyerId);
  }

  async listToken(tokenId: string) {
    return this.updateState(tokenId, 'listed');
  }
}
