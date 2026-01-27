import { v4 as uuidv4 } from 'uuid';

export interface ErpInvoice {
  id: string;
  orderId: string;
  amount: number;
  gstApplicable: boolean;
  timestamp: Date;
}

// Mock ERP Service
export const createErpInvoice = async (orderId: string, amount: number): Promise<ErpInvoice> => {
  console.log(`Connecting to Blackchin ERP727...`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const newInvoice: ErpInvoice = {
    id: `BC-INV-${uuidv4()}`,
    orderId,
    amount,
    gstApplicable: true, // Assuming GST is always applicable for simplicity
    timestamp: new Date(),
  };

  console.log(`Invoice ${newInvoice.id} created in Blackchin ERP727`);
  return newInvoice;
};
