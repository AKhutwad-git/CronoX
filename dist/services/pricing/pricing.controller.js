"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePrice = void 0;
const uuid_1 = require("uuid");
const user_controller_1 = require("../users/user.controller");
const metrics_controller_1 = require("../metrics/metrics.controller");
const PRICING_MODEL_VERSION = '1.0.0';
let pricingAudits = [];
const calculatePrice = (req, res) => {
    const { professionalId } = req.body;
    if (!professionalId) {
        return res.status(400).json({ message: 'Professional ID is required' });
    }
    const professional = user_controller_1.professionals.find((p) => p.id === professionalId);
    if (!professional) {
        return res.status(404).json({ message: 'Professional not found' });
    }
    // 1. Read latest metrics
    const metrics = (0, metrics_controller_1.getMetricsByUserId)(professional.id);
    // 2. Compute Focus Score (placeholder)
    const focusScore = metrics.length > 0 ? Math.random() : 0.5;
    // 3. Apply contextual modifiers (placeholders)
    const fatigue = Math.random() * 0.2;
    const workload = Math.random() * 0.3;
    const history = Math.random() * 0.1;
    // 4. Apply base pricing rules
    const { baseRate } = professional;
    const minCap = baseRate * 0.8;
    const maxCap = baseRate * 2.5;
    let price = baseRate * (1 + focusScore - fatigue - workload + history);
    // 5. Apply dynamic re-pricing (placeholders)
    const demand = Math.random() * 0.4;
    const scarcity = Math.random() * 0.2;
    const velocity = Math.random() * 0.1;
    price = price * (1 + demand + scarcity + velocity);
    // Ensure price is within caps
    const finalPrice = Math.max(minCap, Math.min(maxCap, price));
    // Persist pricing inputs for audit
    const audit = {
        id: (0, uuid_1.v4)(),
        professionalId,
        timestamp: new Date(),
        modelVersion: PRICING_MODEL_VERSION,
        inputs: {
            baseRate,
            focusScore,
            fatigue,
            workload,
            history,
            demand,
            scarcity,
            velocity,
        },
        output: {
            finalPrice,
        },
    };
    pricingAudits.push(audit);
    res.json({ price: finalPrice, auditId: audit.id });
};
exports.calculatePrice = calculatePrice;
