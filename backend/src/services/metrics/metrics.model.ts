import { v4 as uuidv4 } from 'uuid';

export interface Metric {
  id: string;
  userId: string;
  type: string;
  value: number;
  timestamp: Date;
}
