import { v4 as uuidv4 } from 'uuid';

export interface MarketplaceOrder {
  id: string;
  tokenId: string;
  buyerId: string;
  professionalId: string;
  price: number; // in INR
  timestamp: Date;
}
