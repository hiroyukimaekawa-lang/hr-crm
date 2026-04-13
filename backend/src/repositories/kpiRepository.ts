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
    event_slots: any[]; // Raw slots from events table
    slots: any[];       // Aggregated actuals
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
            // Unique constraint (safe to re-run)
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
            } catch { /* constraint may already exist */ }
            // Indexes
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
// getCanonicalFunnelCounts が参照するテーブルを事前に作成する
// (studentController の ensure* が呼ばれていない場合でも安全に動く)
let depTablesReady = false;
let depTablesPromise: Promise<void> | null = null;

const ensureDepTables = async () => {
    if (depTablesReady) return;
    if (!depTablesPromise) {
        depTablesPromise = (async () => {
            // pgcrypto が必要な場合は先に作成
            try { await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`); } catch { /* ok */ }

            await pool.query(`
                CREATE TABLE IF NOT EXISTS applications (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
                    student_name VARCHAR(255) NOT NULL DEFAULT '',
                    source VARCHAR(255),
                    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    first_message_sent_at TIMESTAMP,
                    reservation_status VARCHAR(100),
                    reservation_date TIMESTAMP,
                    reservation_created_at TIMESTAMP,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS matcher_funnel_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    student_id INTEGER UNIQUE REFERENCES students(id) ON DELETE CASCADE,
                    applied_at TIMESTAMP,
                    message_sent_at TIMESTAMP,
                    reservation_created_at TIMESTAMP,
                    interview_scheduled_at TIMESTAMP,
                    interview_actual_at TIMESTAMP,
                    reservation_status TEXT,
                    interview_status TEXT,
                    created_at TIMESTAMP DEFAULT now()
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS interviews (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                    scheduled_at TIMESTAMP,
                    interviewed_at TIMESTAMP,
                    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // events テーブルに必要なカラムを保証
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS entry_deadline TIMESTAMP,
                ADD COLUMN IF NOT EXISTS kpi_seat_to_entry_rate NUMERIC(5,2) DEFAULT 70,
                ADD COLUMN IF NOT EXISTS kpi_entry_to_interview_rate NUMERIC(5,2) DEFAULT 60,
                ADD COLUMN IF NOT EXISTS kpi_interview_to_reservation_rate NUMERIC(5,2) DEFAULT 50,
                ADD COLUMN IF NOT EXISTS kpi_reservation_to_application_rate NUMERIC(5,2) DEFAULT 40,
                ADD COLUMN IF NOT EXISTS kpi_interview_to_inflow_rate NUMERIC(5,2) DEFAULT 50,
                ADD COLUMN IF NOT EXISTS kpi_custom_steps TEXT DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS yomi_statuses JSONB DEFAULT '["A_ENTRY", "B_WAITING", "C_WAITING", "D_PASS", "E_FAIL", "XA_CANCEL"]',
                ADD COLUMN IF NOT EXISTS event_slots JSONB DEFAULT '[]'
            `);

            // student_events テーブルに必要なカラムを保証
            await pool.query(`
                ALTER TABLE student_events
                ADD COLUMN IF NOT EXISTS selected_event_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS id SERIAL
            `);

            depTablesReady = true;
        })().finally(() => { depTablesPromise = null; });
    }
    await depTablesPromise;
};

// ─────────────────────── Canonical Funnel CTE ───────────────────────

/**
 * Build WHERE conditions for the canonical funnel CTE.
 * Returns { whereClause, params, paramIndex }
 */
const buildFunnelFilters = (filters: KpiFilters, startIndex = 1) => {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = startIndex;

    if (filters.staffId) {
        conditions.push(`s.staff_id = $${idx++}`);
        params.push(filters.staffId);
    }
    if (filters.sourceCompany) {
        conditions.push(`s.source_company = $${idx++}`);
        params.push(filters.sourceCompany);
    }
    if (filters.graduationYear) {
        conditions.push(`s.graduation_year = $${idx++}`);
        params.push(filters.graduationYear);
    }

    return {
        whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
        params,
        paramIndex: idx
    };
};

/**
 * Build a date filter for a specific column.
 */
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
        // ISO week: 'YYYY-Www' e.g. '2026-W15'
        const cond = `TO_CHAR(${column} AT TIME ZONE 'Asia/Tokyo', 'IYYY-"W"IW') = $${idx++}`;
        params.push(filters.week);
        return { condition: cond, paramIndex: idx };
    }
    return { condition: '', paramIndex: idx };
};

/**
 * Get canonical funnel counts — the single source of truth.
 */
export const getCanonicalFunnelCounts = async (
    filters: KpiFilters
): Promise<FunnelCounts & {
    per_staff?: any[];
    per_source?: any[];
}> => {
    // 依存テーブル（applications / interviews / matcher_funnel_logs）を保証
    await ensureDepTables();

    const { whereClause, params, paramIndex } = buildFunnelFilters(filters);
    let currentIdx = paramIndex;

    // Build sub-filters for specific stages that might have different date columns
    // 1. Applications: COALESCE(a.applied_at, s.created_at)
    // 2. Interviews: fi.scheduled_at / interviewed_at
    
    // We'll use buildDateFilter helper to generate the SQL fragments
    const appDateFilter = buildDateFilter(`COALESCE(a.applied_at, m.applied_at, s.created_at)`, filters, params, currentIdx);
    const appCond = appDateFilter.condition ? `AND ${appDateFilter.condition}` : '';
    currentIdx = appDateFilter.paramIndex;

    const intDateFilter = buildDateFilter(`fi.scheduled_at`, filters, params, currentIdx);
    const intCond = intDateFilter.condition ? `AND ${intDateFilter.condition}` : '';
    currentIdx = intDateFilter.paramIndex;

    const groupByCol = filters.groupBy === 'staff' ? 's.staff_id' :
                       filters.groupBy === 'source' ? 's.source_company' : null;

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
            ...(filters.groupBy === 'staff'
                ? { per_staff: result.rows }
                : { per_source: result.rows })
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

/**
 * Get daily funnel trend (applications per day).
 */
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

// ─────────────────────── Goals CRUD ───────────────────────

export const getGoals = async (filters: KpiFilters): Promise<GoalRow[]> => {
    await ensureKpiTable();
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.scopeType) {
        conditions.push(`scope_type = $${idx++}`);
        params.push(filters.scopeType);
    }
    if (filters.staffId) {
        conditions.push(`scope_id = $${idx++}`);
        params.push(filters.staffId);
    }
    if (filters.sourceCompany) {
        conditions.push(`source_company = $${idx++}`);
        params.push(filters.sourceCompany);
    }
    if (filters.eventId) {
        conditions.push(`scope_id = $${idx++}`);
        params.push(filters.eventId);
    }
    if (filters.periodType) {
        conditions.push(`period_type = $${idx++}`);
        params.push(filters.periodType);
    }
    if (filters.month) {
        conditions.push(`period_start = $${idx++}`);
        params.push(filters.month + '-01');
    }
    if (filters.date) {
        conditions.push(`period_start = $${idx++}`);
        params.push(filters.date);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await pool.query(
        `SELECT * FROM kpi_goal_settings ${where} ORDER BY period_start DESC, metric_key ASC`,
        params
    );
    return result.rows;
};

export const upsertGoals = async (goals: GoalRow[]): Promise<void> => {
    await ensureKpiTable();
    for (const g of goals) {
        // PostgreSQL は COALESCE が含まれる制約名に ON CONFLICT ON CONSTRAINT を使えないため
        // 手動で UPDATE → INSERT のパターンで対応する
        const updateResult = await pool.query(`
            UPDATE kpi_goal_settings
            SET
                target_value = $1,
                metric_label = COALESCE($2, metric_label),
                period_end   = COALESCE($3, period_end),
                meta         = COALESCE($4::jsonb, meta),
                updated_at   = CURRENT_TIMESTAMP
            WHERE
                scope_type                        = $5
                AND COALESCE(scope_id, 0)         = COALESCE($6::int, 0)
                AND COALESCE(source_company, '')  = COALESCE($7, '')
                AND period_type                   = $8
                AND period_start                  = $9
                AND metric_key                    = $10
        `, [
            g.target_value,
            g.metric_label || null,
            g.period_end   || null,
            g.meta ? JSON.stringify(g.meta) : null,
            g.scope_type   || 'global',
            g.scope_id     ?? null,
            g.source_company || null,
            g.period_type  || 'monthly',
            g.period_start,
            g.metric_key,
        ]);

        // UPDATE で既存行がなければ INSERT
        if (updateResult.rowCount === 0) {
            await pool.query(`
                INSERT INTO kpi_goal_settings
                    (scope_type, scope_id, source_company, period_type, period_start, period_end, metric_key, metric_label, target_value, meta)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT DO NOTHING
            `, [
                g.scope_type    || 'global',
                g.scope_id      ?? null,
                g.source_company || null,
                g.period_type   || 'monthly',
                g.period_start,
                g.period_end    || null,
                g.metric_key,
                g.metric_label  || null,
                g.target_value,
                g.meta ? JSON.stringify(g.meta) : '{}',
            ]);
        }
    }
};


// ─────────────────────── Event KPI ───────────────────────

export const getEventKpiData = async (): Promise<EventKpiRow[]> => {
    // 依存テーブルとカラム(events / student_events)を保証
    await ensureDepTables();

    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayStr = jstNow.toISOString().slice(0, 10);
    const todayDate = new Date(todayStr + 'T00:00:00');

    const eventsRes = await pool.query(`
        SELECT
            e.id,
            e.title,
            e.target_seats,
            e.unit_price,
            COALESCE(e.kpi_seat_to_entry_rate, 70) AS kpi_seat_to_entry_rate,
            COALESCE(e.kpi_entry_to_interview_rate, 60) AS kpi_entry_to_interview_rate,
            COALESCE(e.kpi_interview_to_reservation_rate, 50) AS kpi_interview_to_reservation_rate,
            COALESCE(e.kpi_reservation_to_application_rate, 40) AS kpi_reservation_to_application_rate,
            COALESCE(e.kpi_interview_to_inflow_rate, 50) AS kpi_interview_to_inflow_rate,
            COALESCE(e.kpi_custom_steps, '[]') AS kpi_custom_steps,
            COALESCE(e.event_slots, '[]'::jsonb) AS event_slots,
            COALESCE(
                e.entry_deadline::text,
                (
                  SELECT MAX(slot->>'datetime')
                  FROM jsonb_array_elements(
                    CASE WHEN e.event_slots IS NOT NULL
                         AND jsonb_array_length(e.event_slots) > 0
                    THEN e.event_slots ELSE '[]'::jsonb END
                  ) AS slot
                )
            ) AS deadline
        FROM events e
        ORDER BY deadline DESC NULLS LAST
    `);

    const statusRes = await pool.query(`
        SELECT event_id, status, COUNT(*)::int AS cnt
        FROM student_events
        GROUP BY event_id, status
    `);

    const slotStatusRes = await pool.query(`
        SELECT event_id, to_char(selected_event_date, 'YYYY-MM-DD"T"HH24:MI:SS') as slot_date, status, COUNT(*)::int AS cnt
        FROM student_events
        WHERE selected_event_date IS NOT NULL
        GROUP BY event_id, selected_event_date, status
    `);

    const breakdownMap: Record<number, Record<string, number>> = {};
    for (const row of statusRes.rows) {
        if (!breakdownMap[row.event_id]) breakdownMap[row.event_id] = {};
        breakdownMap[row.event_id][row.status] = Number(row.cnt);
    }

    const slotBreakdownMap: Record<number, Record<string, Record<string, number>>> = {};
    for (const row of slotStatusRes.rows) {
        if (!slotBreakdownMap[row.event_id]) slotBreakdownMap[row.event_id] = {};
        if (!slotBreakdownMap[row.event_id][row.slot_date]) slotBreakdownMap[row.event_id][row.slot_date] = {};
        slotBreakdownMap[row.event_id][row.slot_date][row.status] = Number(row.cnt);
    }

    const toJSTDateString = (value: string): string => {
        const d = new Date(value);
        const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        return jst.toISOString().slice(0, 10);
    };

    return eventsRes.rows.map((e: any) => {
        const breakdown = breakdownMap[e.id] || {};
        const slotBreakdown = slotBreakdownMap[e.id] || {};

        // 合計エントリー数：ステータスが entry, A_ENTRY, attended, reserved のいずれかであるものをカウント
        const currentEntries = (breakdown['entry'] || 0) + 
                               (breakdown['A_ENTRY'] || 0) + 
                               (breakdown['attended'] || 0) + 
                               (breakdown['reserved'] || 0);
        const currentSeats = breakdown['attended'] || 0;

        // 開催日ごとのスロット内訳
        const slots = Object.entries(slotBreakdown).map(([date, b]) => ({
            date,
            entries: (b['entry'] || 0) + (b['A_ENTRY'] || 0) + (b['attended'] || 0) + (b['reserved'] || 0),
            seats: b['attended'] || 0,
            status_breakdown: b
        }));

        let daysRemaining = 0;
        let deadlineStr: string | null = null;
        if (e.deadline) {
            const raw = String(e.deadline);
            deadlineStr = raw.includes('Z') || raw.includes('+')
                ? toJSTDateString(raw)
                : raw.slice(0, 10);
            const deadlineDate = new Date(deadlineStr + 'T00:00:00');
            daysRemaining = Math.floor((deadlineDate.getTime() - todayDate.getTime()) / 86400000);
        }

        let customSteps: any[] = [];
        try {
            const raw = typeof e.kpi_custom_steps === 'string'
                ? JSON.parse(e.kpi_custom_steps)
                : (Array.isArray(e.kpi_custom_steps) ? e.kpi_custom_steps : []);
            if (Array.isArray(raw)) {
                customSteps = raw.filter((x: any) => x?.label);
            }
        } catch { customSteps = []; }

        return {
            event_id: e.id,
            event_title: e.title,
            deadline: deadlineStr,
            days_remaining: daysRemaining,
            target_seats: Number(e.target_seats || 0),
            current_seats: currentSeats,
            current_entries: currentEntries,
            unit_price: Number(e.unit_price || 0),
            kpi_seat_to_entry_rate: Number(e.kpi_seat_to_entry_rate),
            kpi_entry_to_interview_rate: Number(e.kpi_entry_to_interview_rate),
            kpi_interview_to_reservation_rate: Number(e.kpi_interview_to_reservation_rate),
            kpi_reservation_to_application_rate: Number(e.kpi_reservation_to_application_rate),
            kpi_interview_to_inflow_rate: Number(e.kpi_interview_to_inflow_rate),
            kpi_custom_steps: customSteps,
            event_slots: e.event_slots,
            status_breakdown: breakdown,
            slots
        };
    });
};

// ─────────────────────── Monthly Sales Actuals ───────────────────────

/**
 * Get Sales Actuals for a given period (Monthly, Weekly, or Daily).
 */
export const getSalesActuals = async (filters: KpiFilters) => {
    // 依存テーブルとカラム(events / student_events)を保証
    await ensureDepTables();

    const params: any[] = [];
    let idx = 1;
    
    // We'll filter either by e.event_date or slots matching the period
    const monthFilter = filters.month ? `LEFT(slot->>'datetime', 7) = $${idx} OR TO_CHAR(e.event_date, 'YYYY-MM') = $${idx}` : '';
    if (filters.month) params.push(filters.month);
    
    let dateFilter = '';
    if (!filters.month) {
        const df = buildDateFilter(`COALESCE((slot->>'datetime')::timestamp, e.event_date)`, filters, params, idx);
        dateFilter = df.condition;
        idx = df.paramIndex;
    }

    const periodCond = filters.month ? monthFilter : dateFilter;
    const whereClause = periodCond ? `WHERE (${periodCond})` : '';

    const sql = `
        SELECT
            e.id AS event_id,
            e.title AS event_title,
            COALESCE(e.unit_price, 0)::int AS unit_price,
            COUNT(se.*) FILTER (WHERE se.status = 'attended')::int AS attended_count,
            (COALESCE(e.unit_price, 0) * COUNT(se.*) FILTER (WHERE se.status = 'attended'))::bigint AS sales
        FROM events e
        LEFT JOIN student_events se ON se.event_id = e.id
        LEFT JOIN jsonb_array_elements(CASE WHEN e.event_slots IS NOT NULL AND jsonb_array_length(e.event_slots) > 0 THEN e.event_slots ELSE '[]'::jsonb END) AS slot ON true
        ${whereClause}
        GROUP BY e.id, e.title, e.unit_price
        ORDER BY sales DESC
    `;

    const result = await pool.query(sql, params);

    const totalSales = result.rows.reduce((sum: number, r: any) => sum + Number(r.sales || 0), 0);
    const totalAttendance = result.rows.reduce((sum: number, r: any) => sum + Number(r.attended_count || 0), 0);

    return {
        events: result.rows,
        totalSales,
        totalAttendance
    };
};
