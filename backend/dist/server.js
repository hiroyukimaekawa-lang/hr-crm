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
process.env.TZ = 'Asia/Tokyo';
console.log('[TZ Check] タイムゾーン:', process.env.TZ);
console.log('[TZ Check] 現在のJST時刻:', new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const studentRoutes_1 = __importDefault(require("./routes/studentRoutes"));
const eventRoutes_1 = __importDefault(require("./routes/eventRoutes"));
const kpiRoutes_1 = __importDefault(require("./routes/kpiRoutes"));
const performance_1 = require("./config/performance");
dotenv_1.default.config();
const app = (0, express_1.default)();
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, '');
const allowedOrigins = Array.from(new Set([
    process.env.ALLOWED_ORIGINS || '',
    process.env.FRONTEND_URL || '',
    'http://localhost:5173',
    'https://hrcrm-chi.vercel.app'
]
    .flatMap((entry) => entry.split(','))
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)));
const corsOptionsDelegate = (req, callback) => {
    const reqAny = req;
    // ログイン機能のみ従来どおり許可（任意Origin）
    if (String((reqAny === null || reqAny === void 0 ? void 0 : reqAny.url) || '').startsWith('/api/auth')) {
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
app.use((0, cors_1.default)(corsOptionsDelegate));
app.options(/.*/, (0, cors_1.default)(corsOptionsDelegate));
app.use(express_1.default.json());
// Routes
// これにより、例えば /api/auth/login や /api/students などに分岐されます
app.use('/api/auth', authRoutes_1.default);
app.use('/api/students', studentRoutes_1.default);
app.use('/api/events', eventRoutes_1.default);
app.use('/api/kpi', kpiRoutes_1.default);
// 旧APIとの互換性のためのエイリアス（必要に応じて）
app.post('/api/login', (req, res) => res.redirect(307, '/api/auth/login'));
app.post('/api/interview-logs', (req, res) => res.redirect(307, '/api/students/interview-logs'));
app.put('/api/interview-logs/:id', (req, res) => res.redirect(307, `/api/students/interview-logs/${req.params.id}`));
app.delete('/api/interview-logs/:id', (req, res) => res.redirect(307, `/api/students/interview-logs/${req.params.id}`));
module.exports = app;
exports.default = app;
// ローカル開発用
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
        console.log(`Server running on port ${PORT}`);
        yield (0, performance_1.applyPerformanceOptimizations)();
    }));
}
