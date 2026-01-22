export interface Booking {
  id: string;
  timeTokenId: string;
  buyerId: string;
  professionalId: string;
  scheduledAt?: Date;
  createdAt: Date;
}
