"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErpInvoice = void 0;
const uuid_1 = require("uuid");
// Mock ERP Service
const createErpInvoice = async (orderId, amount) => {
    console.log(`Connecting to Blackchin ERP727...`);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    const newInvoice = {
        id: `BC-INV-${(0, uuid_1.v4)()}`,
        orderId,
        amount,
        gstApplicable: true, // Assuming GST is always applicable for simplicity
        timestamp: new Date(),
    };
    console.log(`Invoice ${newInvoice.id} created in Blackchin ERP727`);
    return newInvoice;
};
exports.createErpInvoice = createErpInvoice;
