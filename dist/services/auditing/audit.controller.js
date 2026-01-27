"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = exports.createAuditLog = exports.auditLogs = void 0;
const uuid_1 = require("uuid");
// In-memory data store
exports.auditLogs = [];
// Create a new audit log
const createAuditLog = (eventId, entityId, eventType, actor, details) => {
    const newLog = {
        id: (0, uuid_1.v4)(),
        eventId,
        entityId,
        eventType,
        actor,
        timestamp: new Date(),
        details,
    };
    exports.auditLogs.push(newLog);
};
exports.createAuditLog = createAuditLog;
// Get all audit logs
const getAuditLogs = (req, res) => {
    res.json(exports.auditLogs);
};
exports.getAuditLogs = getAuditLogs;
