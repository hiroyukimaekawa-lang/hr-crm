/**
 * KPI Controller — HTTP layer for KPI endpoints.
 *
 * Every response uses the standardised { target, actual, gap, achievementRate }
 * shape so the front-end never re-computes.
 */
import { Request, Response } from 'express';
import {
    getOverview,
    getEventKpi,
    getKpiGoals,
    upsertKpiGoals,
} from '../services/kpiService';
import { KpiFilters, GoalRow } from '../repositories/kpiRepository';

// ─────────────────────── GET /api/kpi/overview ───────────────────────

export const kpiOverview = async (req: Request, res: Response) => {
    try {
        const filters: KpiFilters = {
            month: req.query.month as string | undefined,
            week: req.query.week as string | undefined,
            date: req.query.date as string | undefined,
            staffId: req.query.staff_id ? Number(req.query.staff_id) : undefined,
            sourceCompany: req.query.source_company as string | undefined,
            graduationYear: req.query.graduation_year ? Number(req.query.graduation_year) : undefined,
            groupBy: req.query.group_by as string | undefined,
        };

        // Default to current month if none specified
        if (!filters.month && !filters.week && !filters.date) {
            const now = new Date();
            const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
            filters.month = jst.toISOString().slice(0, 7);
        }

        const result = await getOverview(filters);
        res.json(result);
    } catch (err: any) {
        console.error('KPI overview error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────── GET /api/kpi/events ───────────────────────

export const kpiEvents = async (_req: Request, res: Response) => {
    try {
        const result = await getEventKpi();
        res.json(result);
    } catch (err: any) {
        console.error('KPI events error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────── GET /api/kpi/goals ───────────────────────

export const kpiGoals = async (req: Request, res: Response) => {
    try {
        const filters: KpiFilters = {
            scopeType: req.query.scope_type as string | undefined,
            staffId: req.query.staff_id ? Number(req.query.staff_id) : undefined,
            sourceCompany: req.query.source_company as string | undefined,
            eventId: req.query.event_id ? Number(req.query.event_id) : undefined,
            periodType: req.query.period_type as string | undefined,
            month: req.query.month as string | undefined,
            date: req.query.date as string | undefined,
        };
        const result = await getKpiGoals(filters);
        res.json(result);
    } catch (err: any) {
        console.error('KPI goals error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────── PUT /api/kpi/goals/bulk ───────────────────────

export const kpiGoalsBulk = async (req: Request, res: Response) => {
    try {
        const goals: GoalRow[] = req.body.goals || req.body;
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

        await upsertKpiGoals(goals);
        res.json({ success: true, count: goals.length });
    } catch (err: any) {
        console.error('KPI goals bulk error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────── GET /api/kpi/funnel ───────────────────────

export const kpiFunnel = async (req: Request, res: Response) => {
    try {
        const filters: KpiFilters = {
            month: req.query.month as string | undefined,
            staffId: req.query.staff_id ? Number(req.query.staff_id) : undefined,
            sourceCompany: req.query.source_company as string | undefined,
            graduationYear: req.query.graduation_year ? Number(req.query.graduation_year) : undefined,
        };
        const result = await getOverview(filters);
        res.json(result.funnel);
    } catch (err: any) {
        console.error('KPI funnel error:', err);
        res.status(500).json({ error: err.message });
    }
};
