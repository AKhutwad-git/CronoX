"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = exports.createAuditLog = void 0;
const uuid_1 = require("uuid");
let auditLogs = [];
const createAuditLog = (log) => {
    const newLog = {
        id: (0, uuid_1.v4)(),
        ...log,
        timestamp: new Date(),
    };
    auditLogs.push(newLog);
};
exports.createAuditLog = createAuditLog;
const getAuditLogs = (req, res) => {
    res.json(auditLogs);
};
exports.getAuditLogs = getAuditLogs;
