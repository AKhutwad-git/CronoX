"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endSession = exports.startSession = exports.getSessions = void 0;
const booking_controller_1 = require("./booking.controller");
const marketplace_controller_1 = require("../marketplace/marketplace.controller");
// Get all sessions for the authenticated user
const getSessions = (req, res) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const userBookings = booking_controller_1.bookings.filter(b => b.buyerId === user.userId || b.professionalId === user.userId);
    const userBookingIds = userBookings.map(b => b.id);
    const userSessions = booking_controller_1.sessions.filter(s => userBookingIds.includes(s.bookingId));
    res.json(userSessions);
};
exports.getSessions = getSessions;
// Start a session
const startSession = (req, res) => {
    const { id } = req.params;
    const session = booking_controller_1.sessions.find(s => s.id === id);
    if (!session) {
        return res.status(404).json({ message: 'Session not found' });
    }
    session.startTime = new Date();
    session.status = 'active';
    res.json(session);
};
exports.startSession = startSession;
// End a session
const endSession = (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const session = booking_controller_1.sessions.find(s => s.id === id);
    if (!session) {
        return res.status(404).json({ message: 'Session not found' });
    }
    if (session.status !== 'active') {
        return res.status(400).json({ message: 'Session is not active' });
    }
    session.endTime = new Date();
    session.status = status;
    if (status === 'completed') {
        const booking = booking_controller_1.bookings.find(b => b.id === session.bookingId);
        if (booking) {
            (0, marketplace_controller_1.consumeTimeToken)(booking.timeTokenId);
        }
    }
    res.json(session);
};
exports.endSession = endSession;
