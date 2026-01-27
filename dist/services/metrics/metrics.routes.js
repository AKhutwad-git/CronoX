"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const metrics_controller_1 = require("./metrics.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/', auth_middleware_1.authenticate, metrics_controller_1.createMetric);
exports.default = router;
