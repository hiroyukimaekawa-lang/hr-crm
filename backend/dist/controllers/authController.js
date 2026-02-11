"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerByInvite = exports.createInvite = exports.getUsers = exports.login = exports.register = void 0;
const db_1 = __importDefault(require("../config/db"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const jwt_1 = require("../utils/jwt");
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, name, role } = req.body;
    try {
        // Hash password
        const salt = yield bcryptjs_1.default.genSalt(10);
        const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
        const result = yield db_1.default.query('INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role', [username, hashedPassword, name, role || 'staff']);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
        const result = yield db_1.default.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // Compare hashed password
        const isMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const token = (0, jwt_1.signJwt)({ sub: String(user.id), name: user.name, role: user.role }, secret, 60 * 60 * 24 * 7);
        res.json({
            token,
            user: { id: user.id, name: user.name, role: user.role }
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
exports.login = login;
const getUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Staff dropdown should avoid duplicate display names and exclude admin.
        const result = yield db_1.default.query(`
            SELECT DISTINCT ON (name) id, name
            FROM users
            WHERE role = 'staff'
            ORDER BY name, created_at DESC, id DESC
        `);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getUsers = getUsers;
const createInvite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        if (!user || user.role !== 'admin') {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const token = crypto_1.default.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const result = yield db_1.default.query('INSERT INTO invites (token, role, expires_at) VALUES ($1, $2, $3) RETURNING token, expires_at', [token, 'staff', expiresAt]);
        // Prefer explicit APP_URL, otherwise derive from browser Origin header.
        const origin = req.get('origin');
        const appUrl = (process.env.APP_URL || origin || 'http://localhost:5173').replace(/\/$/, '');
        const inviteUrl = `${appUrl}/register?token=${result.rows[0].token}`;
        res.json({
            token: result.rows[0].token,
            expires_at: result.rows[0].expires_at,
            invite_url: inviteUrl
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createInvite = createInvite;
const registerByInvite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, username, password, name } = req.body;
    try {
        const inviteRes = yield db_1.default.query('SELECT * FROM invites WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()', [token]);
        const invite = inviteRes.rows[0];
        if (!invite) {
            res.status(400).json({ error: 'Invalid or expired invite' });
            return;
        }
        const salt = yield bcryptjs_1.default.genSalt(10);
        const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
        const userRes = yield db_1.default.query('INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role', [username, hashedPassword, name, invite.role || 'staff']);
        yield db_1.default.query('UPDATE invites SET used_at = NOW(), used_by = $1 WHERE id = $2', [userRes.rows[0].id, invite.id]);
        res.status(201).json(userRes.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.registerByInvite = registerByInvite;
