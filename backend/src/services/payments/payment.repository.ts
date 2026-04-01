import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, Payment, PaymentStatus } from '@prisma/client';

export interface CreatePaymentData {
  sessionId: string;
  amount: number;
  status?: PaymentStatus;
  erpInvoiceId?: string;
}

export class PaymentRepository extends BaseRepository<
  Payment,
  Prisma.PaymentCreateInput,
  Prisma.PaymentUpdateInput
> {
  protected get model() {
    return prisma.payment as unknown as RepositoryModel<
      Payment,
      Prisma.PaymentCreateInput,
      Prisma.PaymentUpdateInput
    >;
  }

  async delete(id: string): Promise<Payment> {
    throw new Error('Payments cannot be deleted. Use status updates instead.');
  }

  async findBySessionId(sessionId: string) {
    return prisma.payment.findUnique({
      where: { sessionId },
      include: { session: true }
    });
  }

  async findAllPaginated(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [totalCount, items] = await prisma.$transaction([
      prisma.payment.count(),
      prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    return { totalCount, items };
  }

  async findByProfessionalIdPaginated(professionalId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.PaymentWhereInput = {
      session: {
        professionalId
      }
    };
    const [totalCount, items] = await prisma.$transaction([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    return { totalCount, items };
  }

  async findByBuyerIdPaginated(buyerId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.PaymentWhereInput = {
      session: {
        booking: {
          buyerId
        }
      }
    };
    const [totalCount, items] = await prisma.$transaction([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    return { totalCount, items };
  }

  async createWithValidation(data: CreatePaymentData) {
    const session = await prisma.session.findUnique({
      where: { id: data.sessionId }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const existing = await prisma.payment.findUnique({
      where: { sessionId: data.sessionId }
    });

    if (existing) {
      throw new Error('Payment already exists for session');
    }

    return prisma.payment.create({
      data: {
        sessionId: data.sessionId,
        amount: data.amount,
        status: data.status || 'pending',
        erpInvoiceRef: data.erpInvoiceId
      }
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    newStatus: PaymentStatus | 'completed' | 'processing' | 'pending_review' | 'disputed',
    erpInvoiceId?: string
  ) {
    const validStatuses: PaymentStatus[] = [
      'pending',
      'settled',
      'failed',
      'refund_requested',
      'refunded',
      'pending_review' as PaymentStatus,
      'disputed' as PaymentStatus
    ];

    // Mapping completed -> settled
    let normalizedStatus: PaymentStatus;
    if (newStatus === 'completed') {
      normalizedStatus = 'settled';
    } else if (newStatus === 'processing') {
      normalizedStatus = 'pending';
    } else {
      normalizedStatus = newStatus as any;
    }

    if (!validStatuses.includes(normalizedStatus)) {
      throw new Error('Invalid payment status');
    }

    const updateData: Prisma.PaymentUpdateInput = { status: normalizedStatus };
    if (erpInvoiceId) {
      updateData.erpInvoiceRef = erpInvoiceId;
    }
    if (normalizedStatus === 'settled') {
      updateData.settledAt = new Date();
    }

    return this.update(paymentId, updateData);
  }
}
