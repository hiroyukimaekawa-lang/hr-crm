import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import studentRoutes from './routes/studentRoutes';
import eventRoutes from './routes/eventRoutes';
import { applyPerformanceOptimizations } from './config/performance';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await applyPerformanceOptimizations();
});
