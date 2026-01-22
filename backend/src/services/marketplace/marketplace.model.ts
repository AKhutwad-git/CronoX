import { v4 as uuidv4 } from 'uuid';

export type TimeTokenState = 'drafted' | 'listed' | 'purchased' | 'consumed' | 'cancelled';

export interface TimeToken {
  id: string;
  professionalId: string;
  buyerId?: string;
  startTime: Date;
  duration: number; // in minutes
  price: number; // in INR
  status: TimeTokenState;
}

export interface MarketplaceOrder {
  id: string;
  timeTokenId: string;
  buyerId: string;
  createdAt: Date;
  deletedAt?: Date;
}
