"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayments = exports.processSettlement = exports.payments = void 0;
const uuid_1 = require("uuid");
const erp_service_1 = require("./erp.service");
const marketplace_controller_1 = require("../marketplace/marketplace.controller");
// In-memory data store
exports.payments = [];
// Process a payment settlement
const processSettlement = async (orderId, amount) => {
    const newPayment = {
        id: (0, uuid_1.v4)(),
        orderId,
        amount,
        status: 'processing',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    exports.payments.push(newPayment);
    try {
        const invoice = await (0, erp_service_1.createErpInvoice)(orderId, amount);
        newPayment.erpInvoiceId = invoice.id;
        newPayment.status = 'completed';
        newPayment.updatedAt = new Date();
    }
    catch (error) {
        newPayment.status = 'failed';
        newPayment.updatedAt = new Date();
        console.error('ERP invoice creation failed:', error);
    }
};
exports.processSettlement = processSettlement;
// Get all payments for the authenticated user
const getPayments = (req, res) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    let userOrders = [];
    if (user.role === 'admin') {
        userOrders = marketplace_controller_1.orders;
    }
    else if (user.role === 'professional') {
        const professionalTokens = marketplace_controller_1.timeTokens
            .filter((t) => t.professionalId === user.userId)
            .map(t => t.id);
        userOrders = marketplace_controller_1.orders.filter((o) => professionalTokens.includes(o.timeTokenId));
    }
    else {
        userOrders = marketplace_controller_1.orders.filter((o) => o.buyerId === user.userId);
    }
    const userOrderIds = userOrders.map((o) => o.id);
    const userPayments = exports.payments.filter(p => userOrderIds.includes(p.orderId));
    res.json(userPayments);
};
exports.getPayments = getPayments;
