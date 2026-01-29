export type SessionStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'cancelled_by_buyer'
  | 'cancelled_by_professional'
  | 'refund_requested'
  | 'refunded';

export interface Session {
  id: string;
  bookingId: string;
  professionalId: string;
  startedAt?: Date;
  endedAt?: Date;
  status: SessionStatus;
  createdAt: Date;
}
