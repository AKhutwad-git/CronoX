export type SessionStatus = 'pending' | 'active' | 'completed' | 'failed' | 'scheduled' | 'cancelled';

export interface Session {
  id: string;
  bookingId: string;
  title: string;
  description: string;
  duration: number;
  startTime?: Date;
  endTime?: Date;
  status: SessionStatus;
  createdAt: Date;
}
