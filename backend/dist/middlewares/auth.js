"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
// JWT Auth Middleware
const authenticate = (req, res, next) => {
    try {
        const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const token = authHeader.startsWith('Bearer ')
            ? authHeader.replace('Bearer ', '')
            : authHeader;
        const payload = (0, jwt_1.verifyJwt)(token, secret);
        req.user = payload;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Unauthorized' });
    }
};
exports.authenticate = authenticate;
