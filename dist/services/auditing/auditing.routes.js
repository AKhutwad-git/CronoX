"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auditing_controller_1 = require("./auditing.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.authenticate, (0, role_middleware_1.authorize)(['admin']), auditing_controller_1.getAuditLogs);
exports.default = router;
