process.env.TZ = 'Asia/Tokyo';
console.log('[TZ Check] タイムゾーン:', process.env.TZ);
console.log('[TZ Check] 現在のJST時刻:', new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import studentRoutes from './routes/studentRoutes';
import projectRoutes from './routes/projectRoutes';
import kpiRoutes from './routes/kpiRoutes';
import legacyRoutes from './routes/legacyRoutes';
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
        'https://hrcrm-chi.vercel.app',
        'https://hr-crm-guxp.vercel.app'
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
app.use('/api/projects', projectRoutes);
app.use('/api/legacy-events', legacyRoutes);
// Legacy routes compat
app.use('/api/events', eventRoutes);
app.use('/api/kpi', kpiRoutes);

export default app;

// ローカル開発用
const isMain = require.main === module;
if (isMain) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, async () => {
        console.log(`Server running on port ${PORT}`);
        await applyPerformanceOptimizations();
    });
}
