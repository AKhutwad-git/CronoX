export type PaymentStatus = 'pending' | 'settled' | 'failed' | 'refund_requested' | 'refunded';

export interface Payment {
  id: string;
  sessionId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  erpInvoiceRef?: string;
  settledAt?: Date;
  createdAt: Date;
}
