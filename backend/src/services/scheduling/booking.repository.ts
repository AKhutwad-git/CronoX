import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, Booking, Session } from '@prisma/client';

export interface CreateBookingData {
  timeTokenId: string;
  buyerId: string;
  professionalId: string;
  scheduledAt: Date;
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

  private async validateBookingData(data: CreateBookingData) {
    if (!data.scheduledAt) {
      throw new Error('scheduledAt is required');
    }

    if (data.scheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

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

    if (buyer.role !== 'buyer') {
      throw new Error('Valid buyer required');
    }

    return timeToken;
  }

  async createWithValidation(data: CreateBookingData) {
    await this.validateBookingData(data);

    const existing = await prisma.booking.findUnique({
      where: { tokenId: data.timeTokenId }
    });

    if (existing) {
      throw new Error('Booking already exists for this token');
    }

    return this.create({
      token: { connect: { id: data.timeTokenId } },
      buyer: { connect: { id: data.buyerId } },
      scheduledAt: data.scheduledAt,
      status: 'scheduled'
    });
  }

  async createWithSession(data: CreateBookingData): Promise<{ booking: Booking; session: Session }> {
    return prisma.$transaction(async (tx) => {
      if (!data.scheduledAt) {
        throw new Error('scheduledAt is required');
      }

      if (data.scheduledAt <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }

      const timeToken = await tx.timeToken.findUnique({
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

      const buyer = await tx.user.findUnique({
        where: { id: data.buyerId }
      });

      if (!buyer) {
        throw new Error('Buyer not found');
      }

      if (buyer.role !== 'buyer') {
        throw new Error('Valid buyer required');
      }

      const existing = await tx.booking.findUnique({
        where: { tokenId: data.timeTokenId }
      });

      if (existing) {
        throw new Error('Booking already exists for this token');
      }

      const booking = await tx.booking.create({
        data: {
          token: { connect: { id: data.timeTokenId } },
          buyer: { connect: { id: data.buyerId } },
          scheduledAt: data.scheduledAt,
          status: 'scheduled'
        }
      });

      const startTime = data.scheduledAt;
      const endTime = new Date(startTime.getTime() + timeToken.durationMinutes * 60000);

      const session = await tx.session.create({
        data: {
          booking: { connect: { id: booking.id } },
          professional: { connect: { id: timeToken.professionalId } },
          startedAt: startTime,
          endedAt: endTime,
          status: 'pending'
        }
      });

      return { booking, session };
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
