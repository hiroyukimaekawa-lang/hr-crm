import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import studentRoutes from './routes/studentRoutes';
import eventRoutes from './routes/eventRoutes';
import { applyPerformanceOptimizations } from './config/performance';

dotenv.config();

const app = express();
const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');
const allowedOrigins = Array.from(new Set(
    [
        process.env.ALLOWED_ORIGINS || '',
        process.env.FRONTEND_URL || '',
        'http://localhost:5173',
        'https://hrcrm-chi.vercel.app'
    ]
        .flatMap((entry) => entry.split(','))
        .map((origin) => normalizeOrigin(origin))
        .filter(Boolean)
));
const corsOptionsDelegate: cors.CorsOptionsDelegate = (req, callback) => {
    const reqAny = req as any;
    // ログイン機能のみ従来どおり許可（任意Origin）
    if (String(reqAny?.url || '').startsWith('/api/auth')) {
        callback(null, { origin: true, credentials: true });
        return;
    }

    callback(null, {
        origin: (origin, originCallback) => {
            if (!origin) {
                originCallback(null, true);
                return;
            }
            const normalized = normalizeOrigin(origin);
            const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalized);
            if (allowedOrigins.includes(normalized) || isVercelPreview) {
                originCallback(null, true);
                return;
            }
            originCallback(new Error('Not allowed by CORS'));
        },
        credentials: true
    });
};

// Middleware
app.use(cors(corsOptionsDelegate));
app.options(/.*/, cors(corsOptionsDelegate));
app.use(express.json());

// Routes
// これにより、例えば /api/auth/login や /api/students などに分岐されます
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/events', eventRoutes);

// 旧APIとの互換性のためのエイリアス（必要に応じて）
app.post('/api/login', (req, res) => res.redirect(307, '/api/auth/login'));
app.post('/api/interview-logs', (req, res) => res.redirect(307, '/api/students/interview-logs'));
app.delete('/api/interview-logs/:id', (req, res) => res.redirect(307, `/api/students/interview-logs/${req.params.id}`));

module.exports = app;
export default app;

// ローカル開発用
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, async () => {
        console.log(`Server running on port ${PORT}`);
        await applyPerformanceOptimizations();
    });
}
