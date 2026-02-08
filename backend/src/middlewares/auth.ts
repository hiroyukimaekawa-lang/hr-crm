import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../utils/jwt';

// JWT Auth Middleware
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
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

        const payload = verifyJwt(token, secret);
        (req as any).user = payload;
        next();
    } catch (err: any) {
        res.status(401).json({ error: 'Unauthorized' });
    }
};
