import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, Professional } from '@prisma/client';

export interface CreateProfessionalData {
  userId: string;
  baseRate: number;
  currency?: string;
}

export class ProfessionalRepository extends BaseRepository<
  Professional,
  Prisma.ProfessionalUncheckedCreateInput,
  Prisma.ProfessionalUncheckedUpdateInput
> {
  protected get model() {
    return prisma.professional as unknown as RepositoryModel<
      Professional,
      Prisma.ProfessionalUncheckedCreateInput,
      Prisma.ProfessionalUncheckedUpdateInput
    >;
  }

  async findByUserId(userId: string) {
    return prisma.professional.findUnique({
      where: { userId },
      include: { user: true }
    });
  }

  // Removed findBySpecialty as schema does not support it

  async createWithValidation(data: CreateProfessionalData) {
    // Validate user exists and is a professional
    const user = await prisma.user.findUnique({
      where: { id: data.userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== 'professional') {
      throw new Error('User must have professional role');
    }

    // Validate base rate is positive
    if (data.baseRate <= 0) {
      throw new Error('Base rate must be positive');
    }

    // Removed focusScore as it is not on Professional model
    return this.create({
      userId: data.userId,
      baseRate: data.baseRate,
      currency: data.currency || 'INR',
      status: 'active'
    });
  }

  // Removed updateFocusScore as it is not on Professional model
}
