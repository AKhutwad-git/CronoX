"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBookings = exports.createBooking = exports.sessions = exports.bookings = void 0;
const uuid_1 = require("uuid");
const marketplace_controller_1 = require("../marketplace/marketplace.controller");
// In-memory data stores
exports.bookings = [];
exports.sessions = [];
// Create a new booking
const createBooking = (req, res) => {
    const { tokenId, scheduledAt } = req.body;
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const token = marketplace_controller_1.timeTokens.find((t) => t.id === tokenId);
    if (!token) {
        return res.status(404).json({ message: 'TimeToken not found' });
    }
    if (token.buyerId !== user.userId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this token' });
    }
    if (exports.bookings.some(b => b.timeTokenId === tokenId)) {
        return res.status(400).json({ message: 'This token has already been booked' });
    }
    const newBooking = {
        id: (0, uuid_1.v4)(),
        timeTokenId: tokenId,
        buyerId: user.userId,
        professionalId: token.professionalId,
        scheduledAt: new Date(scheduledAt),
        createdAt: new Date(),
    };
    exports.bookings.push(newBooking);
    // Create a corresponding session
    const newSession = {
        id: (0, uuid_1.v4)(),
        bookingId: newBooking.id,
        title: 'Session',
        description: '',
        duration: token.duration,
        status: 'pending',
        createdAt: new Date(),
    };
    exports.sessions.push(newSession);
    res.status(201).json({ booking: newBooking, session: newSession });
};
exports.createBooking = createBooking;
// Get all bookings for the authenticated user
const getBookings = (req, res) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const userBookings = exports.bookings.filter(b => b.buyerId === user.userId || b.professionalId === user.userId);
    res.json(userBookings);
};
exports.getBookings = getBookings;
