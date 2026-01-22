import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, Session, SessionStatus } from '@prisma/client';
import { processSettlement } from '../payments/payment.controller'; // Ensure this doesn't cause cycle if controller imports repo.
// session.repository -> payment.controller -> payment.repo. Safe.

export interface CreateSessionData {
  bookingId: string;
  professionalId: string;
  startTime: Date;
  endTime: Date;
  status?: SessionStatus;
}

export class SessionRepository extends BaseRepository<
  Session,
  Prisma.SessionCreateInput,
  Prisma.SessionUpdateInput
> {
  protected get model() {
    return prisma.session as unknown as RepositoryModel<
      Session,
      Prisma.SessionCreateInput,
      Prisma.SessionUpdateInput
    >;
  }

  async findByBookingId(bookingId: string) {
    return prisma.session.findMany({ where: { bookingId } });
  }

  async createWithValidation(data: CreateSessionData) {
    // Basic creation
    return this.create({
      booking: { connect: { id: data.bookingId } },
      professional: { connect: { id: data.professionalId } },
      startedAt: data.startTime,
      endedAt: data.endTime,
      status: data.status || 'pending'
    });
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus) {
    // Status validation
    const validStatuses = ['pending', 'active', 'completed', 'failed'];
    if (!validStatuses.includes(status)) throw new Error('Invalid status');

    if (status === 'completed') {
       return this.completeSession(sessionId);
    }

    const updateData: Prisma.SessionUpdateInput = { status };
    if (status === 'failed') {
      updateData.endedAt = new Date();
    }
    return this.update(sessionId, updateData);
  }

  async completeSession(sessionId: string) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      if (!session) throw new Error("Session not found");

      // pending or active can complete
      if (!['pending', 'active'].includes(session.status)) throw new Error("Session must be pending or active to complete");

      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: { status: 'completed', endedAt: new Date() }
      });


      // Trigger Payment creation (Atomic in concept, but Payment is separate table).
      // We can create Payment here inside transaction.
      // We need amount. Session -> Booking -> Token -> Price?
      // Need to fetch details.

      const booking = await tx.booking.findUnique({
        where: { id: session.bookingId },
        include: {
          token: true
        }
      });

      if (booking && booking.token) {
        const amount = Number(booking.token.price); // Decimal to Number

        await tx.payment.create({
          data: {
            sessionId: sessionId,
            amount: amount,
            status: 'pending', // Pending settlement
          }
        });

        if (booking.token.state === 'purchased') {
          await tx.timeToken.update({
            where: { id: booking.token.id },
            data: { state: 'consumed' }
          });
        }

        // Audit
        await tx.auditLog.create({
          data: {
            entityType: 'Session',
            entityId: sessionId,
            eventType: 'SessionCompleted',
            metadata: {
              paymentAmount: amount
            }
          }
        });
      }

      return updatedSession;
    });
  }
}
