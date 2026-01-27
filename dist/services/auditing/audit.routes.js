"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const audit_controller_1 = require("./audit.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.authenticate, (0, role_middleware_1.authorize)(['admin']), audit_controller_1.getAuditLogs);
exports.default = router;
