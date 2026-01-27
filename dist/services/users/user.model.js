"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFocusScore = void 0;
const uuid_1 = require("uuid");
const createFocusScore = (professionalId) => ({
    id: (0, uuid_1.v4)(),
    professionalId,
    score: 100, // Initial score
    history: [],
    updatedAt: new Date(),
});
exports.createFocusScore = createFocusScore;
