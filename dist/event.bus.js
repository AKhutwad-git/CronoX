"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onEvent = exports.emitEvent = void 0;
const uuid_1 = require("uuid");
const audit_controller_1 = require("./services/auditing/audit.controller");
const listeners = {};
const emitEvent = (eventType, data, actor = 'system') => {
    const eventId = (0, uuid_1.v4)();
    const event = {
        id: eventId,
        type: eventType,
        timestamp: new Date(),
        data,
    };
    (0, audit_controller_1.createAuditLog)(eventId, data.id, eventType, actor, data);
    if (listeners[eventType]) {
        listeners[eventType].forEach(listener => listener(event));
    }
};
exports.emitEvent = emitEvent;
const onEvent = (eventType, listener) => {
    if (!listeners[eventType]) {
        listeners[eventType] = [];
    }
    listeners[eventType].push(listener);
};
exports.onEvent = onEvent;
