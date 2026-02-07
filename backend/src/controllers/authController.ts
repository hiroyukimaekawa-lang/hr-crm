import { Request, Response } from 'express';
import pool from '../config/db';
import bcrypt from 'bcryptjs';

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

        res.json({
            token: 'fake-jwt-token-' + user.id,
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
