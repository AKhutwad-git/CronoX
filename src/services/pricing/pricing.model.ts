import { v4 as uuidv4 } from 'uuid';

export interface FocusScore {
  value: number;
  timestamp: Date;
}

export interface PricingAudit {
  id: string;
  professionalId: string;
  timestamp: Date;
  modelVersion: string;
  inputs: {
    baseRate: number;
    focusScore: number;
    fatigue: number;
    workload: number;
    history: number;
    demand: number;
    scarcity: number;
    velocity: number;
  };
  output: {
    finalPrice: number;
  };
}
