"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfessionalById = exports.getProfessionals = exports.getUserById = exports.getUsers = exports.createUser = exports.professionals = exports.users = void 0;
const uuid_1 = require("uuid");
const user_model_1 = require("./user.model");
exports.users = [];
exports.professionals = [];
const createUser = (req, res) => {
    const { email, role, specialty } = req.body;
    if (!email || !role) {
        return res.status(400).json({ message: 'Email and role are required' });
    }
    const newUser = {
        id: (0, uuid_1.v4)(),
        email,
        password: 'password', // Add a placeholder password
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    exports.users.push(newUser);
    if (role === 'professional') {
        const newProfessional = {
            ...newUser,
            specialty: specialty || 'General',
            focusScore: (0, user_model_1.createFocusScore)(newUser.id),
            baseRate: 100, // Add a default base rate
        };
        exports.professionals.push(newProfessional);
        return res.status(201).json(newProfessional);
    }
    res.status(201).json(newUser);
};
exports.createUser = createUser;
const getUsers = (req, res) => {
    res.json(exports.users);
};
exports.getUsers = getUsers;
const getUserById = (req, res) => {
    const user = exports.users.find((u) => u.id === req.params.id);
    if (user) {
        res.json(user);
    }
    else {
        res.status(404).send('User not found');
    }
};
exports.getUserById = getUserById;
const getProfessionals = (req, res) => {
    res.json(exports.professionals);
};
exports.getProfessionals = getProfessionals;
const getProfessionalById = (req, res) => {
    const professional = exports.professionals.find((p) => p.id === req.params.id);
    if (professional) {
        res.json(professional);
    }
    else {
        res.status(404).send('Professional not found');
    }
};
exports.getProfessionalById = getProfessionalById;
