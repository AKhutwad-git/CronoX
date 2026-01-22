export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Payment {
  id: string;
  orderId: string;
  amount: number; // in INR
  status: PaymentStatus;
  erpInvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}
