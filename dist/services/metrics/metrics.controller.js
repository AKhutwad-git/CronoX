"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetricsByUserId = exports.createMetric = exports.metrics = void 0;
const uuid_1 = require("uuid");
exports.metrics = [];
const createMetric = (req, res) => {
    const { type, value } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!type || value === undefined) {
        return res.status(400).json({ message: 'Type and value are required' });
    }
    if (typeof value !== 'number') {
        return res.status(400).json({ message: 'Value must be a number' });
    }
    const newMetric = {
        id: (0, uuid_1.v4)(),
        userId,
        type,
        value,
        timestamp: new Date(),
    };
    exports.metrics.push(newMetric);
    res.status(201).json(newMetric);
};
exports.createMetric = createMetric;
const getMetricsByUserId = (userId) => {
    return exports.metrics.filter(metric => metric.userId === userId);
};
exports.getMetricsByUserId = getMetricsByUserId;
