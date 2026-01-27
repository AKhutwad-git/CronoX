"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeTokenById = exports.cancelTimeToken = exports.getOrders = exports.getListedTimeTokens = exports.purchaseTimeToken = exports.consumeTimeToken = exports.listTimeToken = exports.mintTimeToken = exports.orders = exports.timeTokens = void 0;
const uuid_1 = require("uuid");
exports.timeTokens = [];
exports.orders = [];
let events = [];
const emitEvent = (eventType, data) => {
    const event = { id: (0, uuid_1.v4)(), type: eventType, timestamp: new Date(), data };
    events.push(event);
    if (eventType === 'TokenConsumed') {
        const order = exports.orders.find(o => o.timeTokenId === data.tokenId);
        if (order) {
        }
    }
};
const canTransition = (from, to) => {
    const validTransitions = {
        drafted: ['listed', 'cancelled'],
        listed: ['purchased', 'cancelled'],
        purchased: ['consumed', 'cancelled'],
    };
    return !!validTransitions[from]?.includes(to);
};
const mintTimeToken = (req, res) => {
    const { professionalId, startTime, duration, price } = req.body;
    const professional = req.user;
    if (!professional || professional.userId !== professionalId || professional.role !== 'professional') {
        return res.status(403).json({ message: 'Forbidden: You can only mint tokens for yourself.' });
    }
    const newToken = {
        id: (0, uuid_1.v4)(),
        professionalId,
        startTime: new Date(startTime),
        duration,
        price,
        status: 'drafted',
    };
    exports.timeTokens.push(newToken);
    emitEvent('TokenMinted', { tokenId: newToken.id, professionalId, price });
    res.status(201).json(newToken);
};
exports.mintTimeToken = mintTimeToken;
const transitionTokenState = (req, res, newState) => {
    const { id } = req.params;
    const token = exports.timeTokens.find(t => t.id === id);
    const user = req.user;
    if (!token) {
        return res.status(404).json({ message: 'TimeToken not found' });
    }
    if (token.professionalId !== user?.userId && user?.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: You do not own this token.' });
    }
    if (!canTransition(token.status, newState)) {
        return res.status(400).json({ message: `Invalid state transition from ${token.status} to ${newState}` });
    }
    token.status = newState;
    if (newState === 'purchased') {
        const buyerId = user?.userId;
        if (!buyerId)
            return res.status(401).json({ message: 'Unauthorized' });
        token.buyerId = buyerId;
        emitEvent('TokenPurchased', { tokenId: token.id, buyerId, price: token.price });
    }
    else if (newState === 'consumed') {
        emitEvent('TokenConsumed', { tokenId: token.id, buyerId: token.buyerId });
    }
    res.json(token);
};
const listTimeToken = (req, res) => transitionTokenState(req, res, 'listed');
exports.listTimeToken = listTimeToken;
const consumeTimeToken = (tokenId) => {
    const token = exports.timeTokens.find(t => t.id === tokenId);
    if (token && canTransition(token.status, 'consumed')) {
        token.status = 'consumed';
        emitEvent('TokenConsumed', { tokenId: token.id, buyerId: token.buyerId });
    }
};
exports.consumeTimeToken = consumeTimeToken;
const purchaseTimeToken = (req, res) => {
    const { id } = req.params;
    const token = exports.timeTokens.find(t => t.id === id);
    const user = req.user;
    if (!token) {
        return res.status(404).json({ message: 'TimeToken not found' });
    }
    if (token.status !== 'listed') {
        return res.status(400).json({ message: 'This token is not available for purchase.' });
    }
    const buyerId = user?.userId;
    if (!buyerId)
        return res.status(401).json({ message: 'Unauthorized' });
    if (!canTransition(token.status, 'purchased')) {
        return res.status(400).json({ message: `Invalid state transition from ${token.status} to purchased` });
    }
    token.status = 'purchased';
    token.buyerId = buyerId;
    const newOrder = {
        id: (0, uuid_1.v4)(),
        timeTokenId: token.id,
        buyerId,
        createdAt: new Date(),
    };
    exports.orders.push(newOrder);
    emitEvent('TokenPurchased', { tokenId: token.id, buyerId, price: token.price });
    res.json({ token, order: newOrder });
};
exports.purchaseTimeToken = purchaseTimeToken;
const getListedTimeTokens = (req, res) => {
    const listedTokens = exports.timeTokens.filter(t => t.status === 'listed');
    res.json(listedTokens);
};
exports.getListedTimeTokens = getListedTimeTokens;
const getOrders = (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ message: 'Unauthorized' });
    let userOrders = [];
    if (user.role === 'admin') {
        userOrders = exports.orders;
    }
    else if (user.role === 'professional') {
        const professionalTokens = exports.timeTokens.filter(t => t.professionalId === user.userId).map(t => t.id);
        userOrders = exports.orders.filter(o => professionalTokens.includes(o.timeTokenId));
    }
    else {
        userOrders = exports.orders.filter(o => o.buyerId === user.userId);
    }
    res.json(userOrders);
};
exports.getOrders = getOrders;
const cancelTimeToken = (req, res) => transitionTokenState(req, res, 'cancelled');
exports.cancelTimeToken = cancelTimeToken;
const getTimeTokenById = (req, res) => {
    const token = exports.timeTokens.find(t => t.id === req.params.id);
    if (token) {
        res.json(token);
    }
    else {
        res.status(404).send('TimeToken not found');
    }
};
exports.getTimeTokenById = getTimeTokenById;
