import { Request, Response, NextFunction } from 'express';

// Simple Auth Middleware
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    // For trial, login is bypassed as requested.
    // In real app, verify JWT here.
    // const token = req.headers['authorization'];
    // if (!token) return res.status(401).json({ error: 'Unauthorized' });
    next();
};
