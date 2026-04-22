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
    decomposeFromRevenue,
    suggestChannelAllocation,
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

export const kpiEvents = async (req: Request, res: Response) => {
    try {
        const filters: KpiFilters = {
            month: req.query.month as string | undefined,
            week: req.query.week as string | undefined,
            date: req.query.date as string | undefined,
            periodType: req.query.period_type as string | undefined,
        };
        const result = await getEventKpi(filters);
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

// ─────────────────────── POST /api/kpi/decompose ───────────────────────

export const kpiDecompose = async (req: Request, res: Response) => {
    try {
        const { revenue_target, unit_price, deal_cvr, interview_cvr, month, overrides } = req.body;

        if (!revenue_target || revenue_target <= 0) {
            res.status(400).json({ error: 'revenue_target is required and must be > 0' });
            return;
        }

        const decomposition = decomposeFromRevenue({
            revenue_target: Number(revenue_target),
            unit_price: Number(unit_price) || 1,
            deal_cvr: Number(deal_cvr) || 50,
            interview_cvr: Number(interview_cvr) || 60,
        });

        // If month is provided, also suggest channel allocation
        let allocation;
        if (month) {
            allocation = await suggestChannelAllocation(
                decomposition,
                month,
                overrides || {}
            );
        }

        res.json({
            decomposition,
            allocation: allocation || null,
        });
    } catch (err: any) {
        console.error('KPI decompose error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────── PUT /api/kpi/allocation ───────────────────────

export const kpiAllocation = async (req: Request, res: Response) => {
    try {
        const { revenue_target, unit_price, deal_cvr, interview_cvr, month, overrides } = req.body;

        if (!revenue_target || !month) {
            res.status(400).json({ error: 'revenue_target and month are required' });
            return;
        }

        const decomposition = decomposeFromRevenue({
            revenue_target: Number(revenue_target),
            unit_price: Number(unit_price) || 1,
            deal_cvr: Number(deal_cvr) || 50,
            interview_cvr: Number(interview_cvr) || 60,
        });

        const allocation = await suggestChannelAllocation(
            decomposition,
            month,
            overrides || {}
        );

        res.json(allocation);
    } catch (err: any) {
        console.error('KPI allocation error:', err);
        res.status(500).json({ error: err.message });
    }
};
