import { Request, Response } from 'express';
import pool from '../config/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { signJwt } from '../utils/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
    const { username, password, name, role } = req.body;
    try {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await pool.query(
            'INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role',
            [username, hashedPassword, name, role || 'staff']
        );

        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;
    try {
        const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = signJwt(
            { sub: String(user.id), name: user.name, role: user.role },
            secret,
            60 * 60 * 24 * 7
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, role: user.role }
        });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

export const getUsers = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT id, name FROM users');
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createInvite = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || user.role !== 'admin') {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const token = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const result = await pool.query(
            'INSERT INTO invites (token, role, expires_at) VALUES ($1, $2, $3) RETURNING token, expires_at',
            [token, 'staff', expiresAt]
        );

        // Prefer explicit APP_URL, otherwise derive from browser Origin header.
        const origin = req.get('origin');
        const appUrl = (process.env.APP_URL || origin || 'http://localhost:5173').replace(/\/$/, '');
        const inviteUrl = `${appUrl}/register?token=${result.rows[0].token}`;

        res.json({
            token: result.rows[0].token,
            expires_at: result.rows[0].expires_at,
            invite_url: inviteUrl
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const registerByInvite = async (req: Request, res: Response): Promise<void> => {
    const { token, username, password, name } = req.body;
    try {
        const inviteRes = await pool.query(
            'SELECT * FROM invites WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
            [token]
        );
        const invite = inviteRes.rows[0];
        if (!invite) {
            res.status(400).json({ error: 'Invalid or expired invite' });
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userRes = await pool.query(
            'INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role',
            [username, hashedPassword, name, invite.role || 'staff']
        );

        await pool.query(
            'UPDATE invites SET used_at = NOW(), used_by = $1 WHERE id = $2',
            [userRes.rows[0].id, invite.id]
        );

        res.status(201).json(userRes.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
