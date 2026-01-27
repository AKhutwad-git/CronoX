"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelSession = exports.cancelBooking = exports.getSessions = exports.getBookings = exports.createSession = exports.createBooking = void 0;
const uuid_1 = require("uuid");
let bookings = [];
let sessions = [];
const createBooking = (req, res) => {
    const { timeTokenId, buyerId, professionalId } = req.body;
    if (!timeTokenId || !buyerId || !professionalId) {
        return res.status(400).json({ message: 'Time token ID, buyer ID, and professional ID are required' });
    }
    const newBooking = {
        id: (0, uuid_1.v4)(),
        timeTokenId,
        buyerId,
        professionalId,
        createdAt: new Date(),
    };
    bookings.push(newBooking);
    res.status(201).json(newBooking);
};
exports.createBooking = createBooking;
const createSession = (req, res) => {
    const { bookingId, title, description, duration } = req.body;
    if (!bookingId || !title || !description || !duration) {
        return res.status(400).json({ message: 'Booking ID, title, description, and duration are required' });
    }
    const newSession = {
        id: (0, uuid_1.v4)(),
        bookingId,
        title,
        description,
        duration,
        status: 'scheduled',
        createdAt: new Date(),
    };
    sessions.push(newSession);
    res.status(201).json(newSession);
};
exports.createSession = createSession;
const getBookings = (req, res) => {
    res.json(bookings);
};
exports.getBookings = getBookings;
const getSessions = (req, res) => {
    const activeSessions = sessions.filter(session => session.status !== 'cancelled');
    res.json(activeSessions);
};
exports.getSessions = getSessions;
const cancelBooking = (req, res) => {
    const booking = bookings.find(b => b.id === req.params.id);
    if (booking) {
        // Instead of soft delete, we can filter by status or remove from array
        bookings = bookings.filter(b => b.id !== req.params.id);
        res.status(204).send();
    }
    else {
        res.status(404).send('Booking not found');
    }
};
exports.cancelBooking = cancelBooking;
const cancelSession = (req, res) => {
    const session = sessions.find(s => s.id === req.params.id);
    if (session) {
        session.status = 'cancelled';
        res.status(204).send();
    }
    else {
        res.status(404).send('Session not found');
    }
};
exports.cancelSession = cancelSession;
