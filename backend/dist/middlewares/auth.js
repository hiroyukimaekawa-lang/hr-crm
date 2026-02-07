"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
// Simple Auth Middleware
const authenticate = (req, res, next) => {
    // For trial, login is bypassed as requested.
    // In real app, verify JWT here.
    // const token = req.headers['authorization'];
    // if (!token) return res.status(401).json({ error: 'Unauthorized' });
    next();
};
exports.authenticate = authenticate;
