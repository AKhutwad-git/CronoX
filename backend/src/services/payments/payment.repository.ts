import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, Payment, PaymentStatus } from '@prisma/client';

export interface CreatePaymentData {
  sessionId: string;
  amount: number;
  status?: 'pending' | 'settled' | 'failed';
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

  async createWithValidation(data: CreatePaymentData) {
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
    newStatus: PaymentStatus | 'completed' | 'processing',
    erpInvoiceId?: string
  ) {
    const validStatuses = ['pending', 'settled', 'failed']; // Schema has 'settled', controller had 'completed'
    // Schema Step 53: enum PaymentStatus { pending, settled, failed }

    // Mapping completed -> settled
    let normalizedStatus: PaymentStatus;
    if (newStatus === 'completed') {
      normalizedStatus = 'settled';
    } else if (newStatus === 'processing') {
      normalizedStatus = 'pending';
    } else {
      normalizedStatus = newStatus;
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
