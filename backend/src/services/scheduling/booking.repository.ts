import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, Booking } from '@prisma/client';

export interface CreateBookingData {
  timeTokenId: string;
  buyerId: string;
  professionalId: string;
  scheduledAt?: Date;
}

export class BookingRepository extends BaseRepository<
  Booking,
  Prisma.BookingCreateInput,
  Prisma.BookingUpdateInput
> {
  protected get model() {
    return prisma.booking as unknown as RepositoryModel<
      Booking,
      Prisma.BookingCreateInput,
      Prisma.BookingUpdateInput
    >;
  }

  async findByBuyerId(buyerId: string) {
    return prisma.booking.findMany({
      where: { buyerId },
      include: {
        token: {
          include: {
            professional: { include: { user: true } }
          }
        },
        session: true
      }
    });
  }

  async findByProfessionalId(professionalId: string) {
    // Booking doesn't have professionalId, so we filter by token's professional
    return prisma.booking.findMany({
      where: {
        token: {
          professionalId: professionalId
        }
      },
      include: {
        token: true,
        buyer: true,
        session: true
      }
    });
  }

  async findByTimeTokenId(timeTokenId: string) {
    return prisma.booking.findMany({
      where: { tokenId: timeTokenId },
      include: {
        buyer: true,
        token: { include: { professional: { include: { user: true } } } },
        session: true
      }
    });
  }

  async createWithValidation(data: CreateBookingData) {
    const timeToken = await prisma.timeToken.findUnique({
      where: { id: data.timeTokenId },
      include: { professional: true }
    });

    if (!timeToken) {
      throw new Error('Time token not found');
    }

    if (timeToken.state !== 'purchased') {
      throw new Error('Time token must be purchased before booking');
    }

    if (timeToken.ownerId !== data.buyerId) {
      throw new Error('Buyer does not own this time token');
    }

    if (timeToken.professionalId !== data.professionalId) {
      throw new Error('Professional does not match time token owner');
    }

    const buyer = await prisma.user.findUnique({
      where: { id: data.buyerId }
    });

    if (!buyer) {
      throw new Error('Buyer not found');
    }

    // data.scheduledAt is optional in interface but required in Schema?
    // Schema: scheduledAt DateTime @map("scheduled_at") (No default)
    // So distinct from createdAt. Must be provided.
    // If interface says optional, we must fallback or throw.
    if (!data.scheduledAt) {
      throw new Error('scheduledAt is required');
    }

    if (data.scheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    return this.create({
      token: { connect: { id: data.timeTokenId } },
      buyer: { connect: { id: data.buyerId } },
      scheduledAt: data.scheduledAt,
      status: 'scheduled'
    });
  }

  async updateScheduledTime(bookingId: string, newScheduledAt: Date) {
    if (newScheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    return this.update(bookingId, { scheduledAt: newScheduledAt });
  }

  async getBookingWithDetails(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        token: {
          include: {
            professional: { include: { user: true } }
          }
        },
        buyer: true,
        session: true
      }
    });
  }
}
