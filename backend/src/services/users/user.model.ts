import { v4 as uuidv4 } from 'uuid';

export type UserRole = 'buyer' | 'professional';

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Professional extends User {
  specialty: string;
  focusScore: FocusScore;
  baseRate: number;
}

export interface Metric {
  id: string;
  name: string;
  value: number;
  timestamp: Date;
}

export interface FocusScore {
  id: string;
  professionalId: string;
  score: number;
  history: Metric[];
  updatedAt: Date;
}

export const createFocusScore = (professionalId: string): FocusScore => ({
  id: uuidv4(),
  professionalId,
  score: 100, // Initial score
  history: [],
  updatedAt: new Date(),
});
