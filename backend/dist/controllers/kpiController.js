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
Object.defineProperty(exports, "__esModule", { value: true });
exports.kpiFunnel = exports.kpiGoalsBulk = exports.kpiGoals = exports.kpiEvents = exports.kpiOverview = void 0;
const kpiService_1 = require("../services/kpiService");
// ─────────────────────── GET /api/kpi/overview ───────────────────────
const kpiOverview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filters = {
            month: req.query.month,
            week: req.query.week,
            date: req.query.date,
            staffId: req.query.staff_id ? Number(req.query.staff_id) : undefined,
            sourceCompany: req.query.source_company,
            graduationYear: req.query.graduation_year ? Number(req.query.graduation_year) : undefined,
            groupBy: req.query.group_by,
        };
        // Default to current month if none specified
        if (!filters.month && !filters.week && !filters.date) {
            const now = new Date();
            const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
            filters.month = jst.toISOString().slice(0, 7);
        }
        const result = yield (0, kpiService_1.getOverview)(filters);
        res.json(result);
    }
    catch (err) {
        console.error('KPI overview error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.kpiOverview = kpiOverview;
// ─────────────────────── GET /api/kpi/events ───────────────────────
const kpiEvents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filters = {
            month: req.query.month,
            week: req.query.week,
            date: req.query.date,
            periodType: req.query.period_type,
        };
        const result = yield (0, kpiService_1.getEventKpi)(filters);
        res.json(result);
    }
    catch (err) {
        console.error('KPI events error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.kpiEvents = kpiEvents;
// ─────────────────────── GET /api/kpi/goals ───────────────────────
const kpiGoals = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filters = {
            scopeType: req.query.scope_type,
            staffId: req.query.staff_id ? Number(req.query.staff_id) : undefined,
            sourceCompany: req.query.source_company,
            eventId: req.query.event_id ? Number(req.query.event_id) : undefined,
            periodType: req.query.period_type,
            month: req.query.month,
            date: req.query.date,
        };
        const result = yield (0, kpiService_1.getKpiGoals)(filters);
        res.json(result);
    }
    catch (err) {
        console.error('KPI goals error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.kpiGoals = kpiGoals;
// ─────────────────────── PUT /api/kpi/goals/bulk ───────────────────────
const kpiGoalsBulk = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const goals = req.body.goals || req.body;
        if (!Array.isArray(goals) || goals.length === 0) {
            res.status(400).json({ error: 'goals array is required' });
            return;
        }
        // Validate each goal
        for (const g of goals) {
            if (!g.metric_key || !g.period_start) {
                res.status(400).json({ error: 'Each goal must have metric_key and period_start' });
                return;
            }
        }
        yield (0, kpiService_1.upsertKpiGoals)(goals);
        res.json({ success: true, count: goals.length });
    }
    catch (err) {
        console.error('KPI goals bulk error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.kpiGoalsBulk = kpiGoalsBulk;
// ─────────────────────── GET /api/kpi/funnel ───────────────────────
const kpiFunnel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filters = {
            month: req.query.month,
            staffId: req.query.staff_id ? Number(req.query.staff_id) : undefined,
            sourceCompany: req.query.source_company,
            graduationYear: req.query.graduation_year ? Number(req.query.graduation_year) : undefined,
        };
        const result = yield (0, kpiService_1.getOverview)(filters);
        res.json(result.funnel);
    }
    catch (err) {
        console.error('KPI funnel error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.kpiFunnel = kpiFunnel;
