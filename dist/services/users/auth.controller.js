"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const uuid_1 = require("uuid");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_controller_1 = require("./user.controller");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const register = async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, and role are required' });
    }
    const existingUser = user_controller_1.users.find((user) => user.email === email);
    if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
    const newUser = {
        id: (0, uuid_1.v4)(),
        email,
        password: hashedPassword,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    user_controller_1.users.push(newUser);
    res.status(201).json({ message: 'User created successfully' });
};
exports.register = register;
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = user_controller_1.users.find(user => user.email === email);
    if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcryptjs_1.default.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: '1h',
    });
    res.json({ token });
};
exports.login = login;
