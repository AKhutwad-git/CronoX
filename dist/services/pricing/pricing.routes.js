"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pricing_controller_1 = require("./pricing.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/calculate', auth_middleware_1.authenticate, pricing_controller_1.calculatePrice);
exports.default = router;
