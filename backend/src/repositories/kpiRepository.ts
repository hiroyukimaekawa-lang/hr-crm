/**
 * KPI Repository — canonical SQL queries for KPI data.
 *
 * All funnel data is normalised through the `canonical_funnel` CTE so that
 * every API returns the same numbers for the same student_id, regardless of
 * which raw table originated the row.
 */
import pool from '../config/db';

// ─────────────────────── Types ───────────────────────
export interface KpiFilters {
    month?: string;        // 'YYYY-MM'
    week?: string;         // 'YYYY-Www' (ISO)
    date?: string;         // 'YYYY-MM-DD'
    staffId?: number;
    sourceCompany?: string;
    graduationYear?: number;
    eventId?: number;
    scopeType?: string;    // 'global'|'staff'|'source'|'event'
    periodType?: string;   // 'daily'|'weekly'|'monthly'
    groupBy?: string;      // 'staff'|'source'
}

export interface GoalRow {
    scope_type: string;
    scope_id: number | null;
    source_company: string | null;
    period_type: string;
    period_start: string;
    period_end?: string | null;
    metric_key: string;
    metric_label?: string;
    target_value: number;
    meta?: any;
}

export interface FunnelCounts {
    applications: number;
    reservations: number;
    interview_scheduled: number;
    interview_completed: number;
}

export interface EventKpiRow {
    event_id: number;
    event_title: string;
    deadline: string | null;
    days_remaining: number;
    target_seats: number;
    current_seats: number;
    current_entries: number;
    unit_price: number;
    kpi_seat_to_entry_rate: number;
    kpi_entry_to_interview_rate: number;
    kpi_interview_to_reservation_rate: number;
    kpi_reservation_to_application_rate: number;
    kpi_interview_to_inflow_rate: number;
    kpi_custom_steps: any[];
    status_breakdown: Record<string, number>;
    event_slots: any[]; // Raw slots
    slots: any[];       // Aggregated actuals
    source: string;
}

// ─────────────────────── Table Init ───────────────────────
let kpiTableReady = false;
let kpiTablePromise: Promise<void> | null = null;

export const ensureKpiTable = async () => {
    if (kpiTableReady) return;
    if (!kpiTablePromise) {
        kpiTablePromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS kpi_goal_settings (
                    id SERIAL PRIMARY KEY,
                    scope_type VARCHAR(20) NOT NULL DEFAULT 'global',
                    scope_id INTEGER,
                    source_company VARCHAR(255),
                    period_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
                    period_start DATE NOT NULL,
                    period_end DATE,
                    metric_key VARCHAR(100) NOT NULL,
                    metric_label VARCHAR(255),
                    target_value NUMERIC(15,2) NOT NULL DEFAULT 0,
                    meta JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            try {
                await pool.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_kpi_goal') THEN
                            ALTER TABLE kpi_goal_settings
                            ADD CONSTRAINT uq_kpi_goal
                            UNIQUE (scope_type, COALESCE(scope_id, 0), COALESCE(source_company, ''), period_type, period_start, metric_key);
                        END IF;
                    END $$;
                `);
            } catch { /* exists */ }
            try {
                await pool.query(`CREATE INDEX IF NOT EXISTS idx_kpi_goals_scope ON kpi_goal_settings(scope_type, period_type, period_start)`);
                await pool.query(`CREATE INDEX IF NOT EXISTS idx_kpi_goals_metric ON kpi_goal_settings(metric_key, period_start)`);
            } catch { /* ok */ }
            kpiTableReady = true;
        })().finally(() => { kpiTablePromise = null; });
    }
    await kpiTablePromise;
};

// ─────────────────────── Dependent Table Init ───────────────────────
let depTablesReady = false;
let depTablesPromise: Promise<void> | null = null;

const ensureDepTables = async () => {
    if (depTablesReady) return;
    if (!depTablesPromise) {
        depTablesPromise = (async () => {
            try { await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`); } catch { /* ok */ }
            // ensure applications, interviews, etc exists
            depTablesReady = true;
        })().finally(() => { depTablesPromise = null; });
    }
    await depTablesPromise;
};

// ─────────────────────── Helpers ───────────────────────

const buildFunnelFilters = (filters: KpiFilters, startIndex = 1) => {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = startIndex;
    if (filters.staffId) { conditions.push(`s.staff_id = $${idx++}`); params.push(filters.staffId); }
    if (filters.sourceCompany) { conditions.push(`s.source_company = $${idx++}`); params.push(filters.sourceCompany); }
    if (filters.graduationYear) { conditions.push(`s.graduation_year = $${idx++}`); params.push(filters.graduationYear); }
    return { whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '', params, paramIndex: idx };
};

const buildDateFilter = (column: string, filters: KpiFilters, params: any[], startIndex: number) => {
    let idx = startIndex;
    if (filters.month) {
        const cond = `TO_CHAR(${column} AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM') = $${idx++}`;
        params.push(filters.month);
        return { condition: cond, paramIndex: idx };
    }
    if (filters.date) {
        const cond = `TO_CHAR(${column} AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD') = $${idx++}`;
        params.push(filters.date);
        return { condition: cond, paramIndex: idx };
    }
    if (filters.week) {
        const cond = `TO_CHAR(${column} AT TIME ZONE 'Asia/Tokyo', 'IYYY-\"W\"IW') = $${idx++}`;
        params.push(filters.week);
        return { condition: cond, paramIndex: idx };
    }
    return { condition: '', paramIndex: idx };
};

// ─────────────────────── Canonical Funnel ───────────────────────

export const getCanonicalFunnelCounts = async (filters: KpiFilters): Promise<FunnelCounts & { per_staff?: any[]; per_source?: any[] }> => {
    await ensureDepTables();
    const { whereClause, params, paramIndex } = buildFunnelFilters(filters);
    let currentIdx = paramIndex;

    const appDateFilter = buildDateFilter(`cf.application_at`, filters, params, currentIdx);
    const appCond = appDateFilter.condition ? `AND ${appDateFilter.condition}` : '';
    currentIdx = appDateFilter.paramIndex;

    const intDateFilter = buildDateFilter(`cf.interview_scheduled_at`, filters, params, currentIdx);
    const intCond = intDateFilter.condition ? `AND ${intDateFilter.condition}` : '';
    currentIdx = intDateFilter.paramIndex;

    const groupByCol = filters.groupBy === 'staff' ? 's.staff_id' : filters.groupBy === 'source' ? 's.source_company' : null;
    const selectExtra = groupByCol ? `, ${groupByCol} AS group_key` : '';
    const groupByClause = groupByCol ? `GROUP BY ${groupByCol}` : '';

    const sql = `
        WITH canonical_funnel AS (
            SELECT
                s.id AS student_id,
                s.staff_id,
                s.source_company,
                s.graduation_year,
                COALESCE(a.applied_at, m.applied_at, s.created_at) AS application_at,
                COALESCE(a.reservation_created_at, m.reservation_created_at) AS reservation_at,
                fi.scheduled_at AS interview_scheduled_at,
                COALESCE(fi.interviewed_at, m.interview_actual_at) AS interview_completed_at
            FROM students s
            LEFT JOIN applications a ON a.student_id = s.id
            LEFT JOIN matcher_funnel_logs m ON m.student_id = s.id
            LEFT JOIN (
                SELECT student_id, scheduled_at, interviewed_at,
                       ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY scheduled_at ASC NULLS LAST, id ASC) AS rn
                FROM interviews
            ) fi ON fi.student_id = s.id AND fi.rn = 1
            ${whereClause}
        )
        SELECT
            COUNT(DISTINCT CASE WHEN cf.student_id IS NOT NULL ${appCond} THEN cf.student_id END)::int AS applications,
            COUNT(DISTINCT CASE WHEN cf.reservation_at IS NOT NULL ${appCond} THEN cf.student_id END)::int AS reservations,
            COUNT(DISTINCT CASE WHEN cf.interview_scheduled_at IS NOT NULL ${intCond} THEN cf.student_id END)::int AS interview_scheduled,
            COUNT(DISTINCT CASE WHEN cf.interview_completed_at IS NOT NULL ${intCond} THEN cf.student_id END)::int AS interview_completed
            ${selectExtra}
        FROM canonical_funnel cf
        JOIN students s ON s.id = cf.student_id
        ${groupByClause}
    `;
    const result = await pool.query(sql, params);
    if (groupByCol) {
        return {
            applications: 0, reservations: 0, interview_scheduled: 0, interview_completed: 0,
            ...(filters.groupBy === 'staff' ? { per_staff: result.rows } : { per_source: result.rows })
        };
    }
    const row = result.rows[0] || {};
    return {
        applications: Number(row.applications || 0),
        reservations: Number(row.reservations || 0),
        interview_scheduled: Number(row.interview_scheduled || 0),
        interview_completed: Number(row.interview_completed || 0),
    };
};

export const getDailyApplicationTrend = async (filters: KpiFilters, limit = 62) => {
    const { whereClause, params, paramIndex } = buildFunnelFilters(filters);
    let monthCond = '';
    if (filters.month) {
        monthCond = `AND TO_CHAR(COALESCE(a.applied_at, s.created_at) AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM') = $${paramIndex}`;
        params.push(filters.month);
    }
    const sql = `
        SELECT
            TO_CHAR((COALESCE(a.applied_at, s.created_at) AT TIME ZONE 'Asia/Tokyo'), 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE s.graduation_year = 2027)::int AS count_27,
            COUNT(*) FILTER (WHERE s.graduation_year = 2028)::int AS count_28
        FROM applications a
        JOIN students s ON s.id = a.student_id
        ${whereClause ? whereClause + ' ' + monthCond : (monthCond ? 'WHERE 1=1 ' + monthCond : '')}
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT ${limit}
    `;
    const result = await pool.query(sql, params);
    return result.rows;
};

// ─────────────────────── Goals ───────────────────────

export const getGoals = async (filters: KpiFilters): Promise<GoalRow[]> => {
    await ensureKpiTable();
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (filters.scopeType) { conditions.push(`scope_type = $${idx++}`); params.push(filters.scopeType); }
    if (filters.staffId) { conditions.push(`scope_id = $${idx++}`); params.push(filters.staffId); }
    if (filters.sourceCompany) { conditions.push(`source_company = $${idx++}`); params.push(filters.sourceCompany); }
    if (filters.eventId) { conditions.push(`scope_id = $${idx++}`); params.push(filters.eventId); }
    if (filters.periodType) { conditions.push(`period_type = $${idx++}`); params.push(filters.periodType); }
    if (filters.month) { conditions.push(`period_start = $${idx++}`); params.push(filters.month + '-01'); }
    if (filters.date) { conditions.push(`period_start = $${idx++}`); params.push(filters.date); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await pool.query(`SELECT * FROM kpi_goal_settings ${where} ORDER BY period_start DESC, metric_key ASC`, params);
    return result.rows;
};

export const upsertGoals = async (goals: GoalRow[]): Promise<void> => {
    await ensureKpiTable();
    for (const g of goals) {
        const updateResult = await pool.query(`
            UPDATE kpi_goal_settings
            SET target_value = $1, metric_label = COALESCE($2, metric_label), period_end = COALESCE($3, period_end), meta = COALESCE($4::jsonb, meta), updated_at = CURRENT_TIMESTAMP
            WHERE scope_type = $5 AND COALESCE(scope_id, 0) = COALESCE($6::int, 0) AND COALESCE(source_company, '') = COALESCE($7, '') AND period_type = $8 AND period_start = $9 AND metric_key = $10
        `, [g.target_value, g.metric_label || null, g.period_end || null, g.meta ? JSON.stringify(g.meta) : null, g.scope_type || 'global', g.scope_id ?? null, g.source_company || null, g.period_type || 'monthly', g.period_start, g.metric_key]);
        if (updateResult.rowCount === 0) {
            await pool.query(`
                INSERT INTO kpi_goal_settings (scope_type, scope_id, source_company, period_type, period_start, period_end, metric_key, metric_label, target_value, meta)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT DO NOTHING
            `, [g.scope_type || 'global', g.scope_id ?? null, g.source_company || null, g.period_type || 'monthly', g.period_start, g.period_end || null, g.metric_key, g.metric_label || null, g.target_value, g.meta ? JSON.stringify(g.meta) : '{}']);
        }
    }
};

// ─────────────────────── Event KPI (Unified to Projects) ───────────────────────

export const getEventKpiData = async (): Promise<EventKpiRow[]> => {
    await ensureDepTables();
    const now = new Date();
    const todayStr = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayDate = new Date(todayStr + 'T00:00:00');

    // 1. Modern Projects
    const projectsRes = await pool.query(`
        SELECT
            p.id, p.title, p.target_seats, p.unit_price,
            COALESCE(p.kpi_seat_to_entry_rate, 70) AS kpi_seat_to_entry_rate,
            COALESCE(p.kpi_entry_to_interview_rate, 60) AS kpi_entry_to_interview_rate,
            COALESCE(p.kpi_interview_to_reservation_rate, 50) AS kpi_interview_to_reservation_rate,
            COALESCE(p.kpi_reservation_to_application_rate, 40) AS kpi_reservation_to_application_rate,
            COALESCE(p.kpi_interview_to_inflow_rate, 50) AS kpi_interview_to_inflow_rate,
            COALESCE(p.kpi_custom_steps, '[]') AS kpi_custom_steps,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object('datetime', to_char(ps.schedule_date, 'YYYY-MM-DD\"T\"HH24:MI:SS')))
              FROM project_schedules ps WHERE ps.project_id = p.id
            ), '[]'::jsonb) AS event_slots,
            COALESCE(p.entry_deadline::text, (
              SELECT TO_CHAR(MAX(ps.schedule_date), 'YYYY-MM-DD\"T\"HH24:MI:SS')
              FROM project_schedules ps WHERE ps.project_id = p.id
            )) AS deadline,
            'project' as source
        FROM projects p
    `);

    // 2. Legacy Events
    const legacyRes = await pool.query(`
        SELECT
            e.id, e.title, e.target_seats, e.unit_price,
            70 AS kpi_seat_to_entry_rate,
            60 AS kpi_entry_to_interview_rate,
            50 AS kpi_interview_to_reservation_rate,
            40 AS kpi_reservation_to_application_rate,
            50 AS kpi_interview_to_inflow_rate,
            '[]'::jsonb AS kpi_custom_steps,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object('datetime', to_char(ed.event_date, 'YYYY-MM-DD\"T\"HH24:MI:SS')))
              FROM event_dates ed WHERE ed.event_id = e.id
            ), '[]'::jsonb) AS event_slots,
            COALESCE(e.event_date::text, (
              SELECT TO_CHAR(MAX(ed.event_date), 'YYYY-MM-DD\"T\"HH24:MI:SS')
              FROM event_dates ed WHERE ed.event_id = e.id
            )) AS deadline,
            'event' as source
        FROM events e
    `);

    const allEvents = [...projectsRes.rows, ...legacyRes.rows];

    // Status breakdowns
    const projectStatusRes = await pool.query(`
        SELECT project_id as event_id, status, COUNT(*)::int AS cnt
        FROM student_project_relations GROUP BY project_id, status
    `);
    const legacyStatusRes = await pool.query(`
        SELECT event_id, status, COUNT(*)::int AS cnt
        FROM student_events GROUP BY event_id, status
    `);

    const projectSlotStatusRes = await pool.query(`
        SELECT spr.project_id as event_id, to_char(ps.schedule_date, 'YYYY-MM-DD"T"HH24:MI') as slot_date, spr.status, COUNT(*)::int AS cnt
        FROM student_project_relations spr
        JOIN project_schedules ps ON ps.id = spr.schedule_id
        GROUP BY spr.project_id, slot_date, spr.status
    `);
    const legacySlotStatusRes = await pool.query(`
        -- Legacy slots are usually in event_dates but student_events doesn't link to a specific date ID in all versions.
        -- We'll just group by the event_id for now if it's legacy.
        SELECT event_id, TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI') as slot_date, status, COUNT(*)::int AS cnt
        FROM student_events
        GROUP BY event_id, slot_date, status
    `);

    const breakdownMap: Record<string, Record<string, number>> = {};
    const populateBD = (rows: any[], source: string) => {
        for (const r of rows) {
            const key = `${source}-${r.event_id}`;
            if (!breakdownMap[key]) breakdownMap[key] = {};
            breakdownMap[key][r.status] = Number(r.cnt);
        }
    };
    populateBD(projectStatusRes.rows, 'project');
    populateBD(legacyStatusRes.rows, 'event');

    const slotBreakdownMap: Record<string, Record<string, Record<string, number>>> = {};
    const populateSlotBD = (rows: any[], source: string) => {
        for (const r of rows) {
            const key = `${source}-${r.event_id}`;
            if (!slotBreakdownMap[key]) slotBreakdownMap[key] = {};
            if (!slotBreakdownMap[key][r.slot_date]) slotBreakdownMap[key][r.slot_date] = {};
            slotBreakdownMap[key][r.slot_date][r.status] = Number(r.cnt);
        }
    };
    populateSlotBD(projectSlotStatusRes.rows, 'project');
    populateSlotBD(legacySlotStatusRes.rows, 'event');

    return allEvents.map((e: any) => {
        const key = `${e.source}-${e.id}`;
        const bd = breakdownMap[key] || {};
        const sbd = slotBreakdownMap[key] || {};
        const ent = (bd['entry']||0) + (bd['A_ENTRY']||0) + (bd['attended']||0) + (bd['reserved']||0) + (bd['registered']||0);
        const st = (bd['attended']||0);
        const rawSlots = e.event_slots || [];
        const norm = (dt: string) => dt ? dt.slice(0, 16) : dt;
        const normSbd: any = {}; Object.entries(sbd).forEach(([k, v]) => { normSbd[norm(k)] = v; });
        const keys = new Set([...rawSlots.map((s: any) => norm(s.datetime)), ...Object.keys(normSbd)]);
        const slots = Array.from(keys).filter(Boolean).map(k => {
            const b = normSbd[k] || {};
            return {
                date: k,
                entries: (b['entry']||0) + (b['A_ENTRY']||0) + (b['attended']||0) + (b['reserved']||0) + (b['registered']||0),
                seats: b['attended']||0,
                status_breakdown: b,
                target_seats: 0
            };
        }).sort((a, b) => b.date.localeCompare(a.date));

        const dlStr = e.deadline ? e.deadline.slice(0, 10) : null;
        let daysRem = 0; if (dlStr) { daysRem = Math.floor((new Date(dlStr+'T00:00:00').getTime() - todayDate.getTime())/86400000); }

        return {
            event_id: e.id, event_title: e.title, deadline: dlStr, days_remaining: daysRem,
            target_seats: Number(e.target_seats || 0), current_seats: st, current_entries: ent,
            event_slots: rawSlots, unit_price: Number(e.unit_price || 0),
            kpi_seat_to_entry_rate: Number(e.kpi_seat_to_entry_rate),
            kpi_entry_to_interview_rate: Number(e.kpi_entry_to_interview_rate),
            kpi_interview_to_reservation_rate: Number(e.kpi_interview_to_reservation_rate),
            kpi_reservation_to_application_rate: Number(e.kpi_reservation_to_application_rate),
            kpi_interview_to_inflow_rate: Number(e.kpi_interview_to_inflow_rate),
            kpi_custom_steps: JSON.parse(JSON.stringify(e.kpi_custom_steps || [])),
            status_breakdown: bd, slots, source: e.source
        };
    });
};

export const getSalesActuals = async (filters: KpiFilters) => {
    await ensureDepTables();
    const params: any[] = [];
    let idx = 1;
    let projectPeriodWhere = '';
    let legacyPeriodWhere = '';

    if (filters.month) {
        projectPeriodWhere = `(TO_CHAR(ps.schedule_date, 'YYYY-MM') = $${idx} OR TO_CHAR(p.entry_deadline, 'YYYY-MM') = $${idx})`;
        legacyPeriodWhere = `(TO_CHAR(ed.event_date, 'YYYY-MM') = $${idx} OR TO_CHAR(e.event_date, 'YYYY-MM') = $${idx})`;
        params.push(filters.month);
        idx++;
    } else if (filters.date) {
        projectPeriodWhere = `(TO_CHAR(ps.schedule_date, 'YYYY-MM-DD') = $${idx} OR TO_CHAR(p.entry_deadline, 'YYYY-MM-DD') = $${idx})`;
        legacyPeriodWhere = `(TO_CHAR(ed.event_date, 'YYYY-MM-DD') = $${idx} OR TO_CHAR(e.event_date, 'YYYY-MM-DD') = $${idx})`;
        params.push(filters.date);
        idx++;
    } else if (filters.week) {
        projectPeriodWhere = `(TO_CHAR(ps.schedule_date, 'IYYY-\"W\"IW') = $${idx} OR TO_CHAR(p.entry_deadline, 'IYYY-\"W\"IW') = $${idx})`;
        legacyPeriodWhere = `(TO_CHAR(ed.event_date, 'IYYY-\"W\"IW') = $${idx} OR TO_CHAR(e.event_date, 'IYYY-\"W\"IW') = $${idx})`;
        params.push(filters.week);
        idx++;
    }

    const sql = `
        WITH all_sales AS (
            -- Modern Projects
            SELECT 
                p.id AS event_id, 
                p.title AS event_title, 
                COALESCE(p.unit_price, 0)::int AS unit_price,
                spr.id AS participant_id,
                'project' as source
            FROM projects p
            LEFT JOIN project_schedules ps ON ps.project_id = p.id
            LEFT JOIN student_project_relations spr ON spr.project_id = p.id AND spr.status = 'attended'
            ${projectPeriodWhere ? `WHERE ${projectPeriodWhere}` : ''}
            
            UNION ALL
            
            -- Legacy Events
            SELECT 
                e.id AS event_id, 
                e.title AS event_title, 
                COALESCE(e.unit_price, 0)::int AS unit_price,
                se.id AS participant_id,
                'event' as source
            FROM events e
            LEFT JOIN event_dates ed ON ed.event_id = e.id
            LEFT JOIN student_events se ON se.event_id = e.id AND se.status = 'attended'
            ${legacyPeriodWhere ? `WHERE ${legacyPeriodWhere}` : ''}
        )
        SELECT 
            event_id, 
            event_title, 
            unit_price,
            source,
            COUNT(DISTINCT participant_id)::int AS attended_count,
            (unit_price * COUNT(DISTINCT participant_id))::bigint AS sales
        FROM all_sales
        GROUP BY event_id, event_title, unit_price, source
        HAVING (unit_price * COUNT(DISTINCT participant_id)) > 0 OR COUNT(DISTINCT participant_id) > 0
        ORDER BY sales DESC
    `;
    const res = await pool.query(sql, params);
    return {
        events: res.rows,
        totalSales: res.rows.reduce((s, r) => s + Number(r.sales || 0), 0),
        totalAttendance: res.rows.reduce((s, r) => s + Number(r.attended_count || 0), 0)
    };
};
