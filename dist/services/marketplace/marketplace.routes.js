"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const marketplace_controller_1 = require("./marketplace.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
// Public routes
router.get('/tokens', marketplace_controller_1.getListedTimeTokens);
router.get('/tokens/:id', marketplace_controller_1.getTimeTokenById);
// Authenticated routes
router.get('/orders', auth_middleware_1.authenticate, marketplace_controller_1.getOrders);
// Professional-only routes
router.post('/tokens/mint', auth_middleware_1.authenticate, (0, role_middleware_1.authorize)(['professional']), marketplace_controller_1.mintTimeToken);
router.post('/tokens/:id/list', auth_middleware_1.authenticate, (0, role_middleware_1.authorize)(['professional']), marketplace_controller_1.listTimeToken);
// Buyer-only routes
router.post('/tokens/:id/purchase', auth_middleware_1.authenticate, (0, role_middleware_1.authorize)(['buyer']), marketplace_controller_1.purchaseTimeToken);
// Professional or Admin routes
router.post('/tokens/:id/consume', auth_middleware_1.authenticate, (0, role_middleware_1.authorize)(['professional', 'admin']), marketplace_controller_1.consumeTimeToken);
router.post('/tokens/:id/cancel', auth_middleware_1.authenticate, (0, role_middleware_1.authorize)(['professional', 'admin']), marketplace_controller_1.cancelTimeToken);
exports.default = router;
