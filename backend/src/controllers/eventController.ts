import { Request, Response } from 'express';
import pool from '../config/db';
import { normalizeToHour } from './studentController';

let eventDatesTableReady = false;
let eventDatesTablePromise: Promise<void> | null = null;
let cachedEventColumns: Set<string> | null = null;
let studentEventsColumnsReady = false;
let studentEventsColumnsPromise: Promise<void> | null = null;

const ensureEventDatesTable = async () => {
    if (eventDatesTableReady) return;
    if (!eventDatesTablePromise) {
        eventDatesTablePromise = (async () => {
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS entry_deadline TIMESTAMP
            `);
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_seat_to_entry_rate NUMERIC(5,2) DEFAULT 70
            `);
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_entry_to_interview_rate NUMERIC(5,2) DEFAULT 60
            `);
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_interview_to_reservation_rate NUMERIC(5,2) DEFAULT 50
            `);
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_reservation_to_application_rate NUMERIC(5,2) DEFAULT 40
            `);
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_custom_steps TEXT DEFAULT '[]'
            `);
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS yomi_statuses JSONB DEFAULT '["A_ENTRY", "B_WAITING", "C_WAITING", "D_PASS", "E_FAIL", "XA_CANCEL"]'
            `);
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS event_slots JSONB DEFAULT '[]'
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS event_dates (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    event_date TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            eventDatesTableReady = true;
        })().finally(() => {
            eventDatesTablePromise = null;
        });
    }
    await eventDatesTablePromise;
};

const ensureStudentEventsColumns = async () => {
    if (studentEventsColumnsReady) return;
    if (!studentEventsColumnsPromise) {
        studentEventsColumnsPromise = (async () => {
            // Ensure selected_event_date column exists
            await pool.query(`
                ALTER TABLE student_events
                ADD COLUMN IF NOT EXISTS selected_event_date TIMESTAMP
            `);

            // Ensure surrogate primary key for student_events to allow multiple rows
            // per (student_id, event_id) with different selected_event_date
            await pool.query(`
                ALTER TABLE student_events
                ADD COLUMN IF NOT EXISTS id SERIAL
            `);

            // Drop legacy primary key on (student_id, event_id) if it exists
            await pool.query(`
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.table_constraints
                        WHERE table_schema = 'public'
                          AND table_name = 'student_events'
                          AND constraint_type = 'PRIMARY KEY'
                          AND constraint_name = 'student_events_pkey'
                    ) THEN
                        ALTER TABLE student_events DROP CONSTRAINT student_events_pkey;
                    END IF;
                END
                $$;
            `);

            // Ensure primary key on id
            await pool.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.table_constraints
                        WHERE table_schema = 'public'
                          AND table_name = 'student_events'
                          AND constraint_type = 'PRIMARY KEY'
                    ) THEN
                        ALTER TABLE student_events
                        ADD CONSTRAINT student_events_pkey PRIMARY KEY (id);
                    END IF;
                END
                $$;
            `);

            // Unique index so that the same student/event/date triplet is not duplicated
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_student_events_unique_triplet
                ON student_events(student_id, event_id, selected_event_date)
            `);

            studentEventsColumnsReady = true;
        })().finally(() => {
            studentEventsColumnsPromise = null;
        });
    }
    await studentEventsColumnsPromise;
};

const normalizeEventDates = (event_dates: any, event_date: any): string[] => {
    const raw = Array.isArray(event_dates) ? event_dates : [];
    const merged = raw.length > 0 ? raw : (event_date ? [event_date] : []);
    const cleaned = merged
        .map((v: any) => String(v || '').trim())
        .filter((v: string) => !!v);
    return Array.from(new Set(cleaned));
};

const getEventColumns = async () => {
    if (cachedEventColumns) return cachedEventColumns;
    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'events'`
    );
    cachedEventColumns = new Set(result.rows.map((r: any) => r.column_name));
    return cachedEventColumns;
};

export const getEvents = async (req: Request, res: Response) => {
    try {
        await ensureEventDatesTable();
        const result = await pool.query(`
            SELECT 
                e.*,
                COALESCE(e.event_slots, '[]'::jsonb) as event_slots,
                COALESCE(date_stats.event_dates, '[]'::json) as event_dates,
                COALESCE(part_stats.registered_count, 0) as registered_count,
                COALESCE(part_stats.attended_count, 0) as attended_count,
                COALESCE(part_stats.canceled_count, 0) as canceled_count,
                COALESCE(part_stats.a_entry_count, 0) as a_entry_count,
                COALESCE(part_stats.b_waiting_count, 0) as b_waiting_count,
                COALESCE(part_stats.c_waiting_count, 0) as c_waiting_count,
                COALESCE(part_stats.d_pass_count, 0) as d_pass_count,
                COALESCE(part_stats.e_fail_count, 0) as e_fail_count,
                COALESCE(part_stats.xa_cancel_count, 0) as xa_cancel_count,
                COALESCE(part_stats.total_count, 0) as total_count
            FROM events e
            LEFT JOIN LATERAL (
                SELECT
                    json_agg(to_char(ed.event_date, 'YYYY-MM-DD"T"HH24:MI:SS') ORDER BY ed.event_date ASC) as event_dates
                FROM event_dates ed
                WHERE ed.event_id = e.id
            ) date_stats ON true
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(se.*) FILTER (WHERE se.status = 'registered' OR se.status = 'A_ENTRY') as registered_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'attended') as attended_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'canceled') as canceled_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'A_ENTRY' OR se.status = 'registered') as a_entry_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'B_WAITING') as b_waiting_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'C_WAITING') as c_waiting_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'D_PASS') as d_pass_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'E_FAIL') as e_fail_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'XA_CANCEL' OR se.status = 'canceled') as xa_cancel_count,
                    COUNT(se.*) as total_count
                FROM student_events se
                WHERE se.event_id = e.id
            ) part_stats ON true
            ORDER BY e.event_date DESC
        `);
        const events = result.rows.map(r => ({ ...r, source: 'event' }));
        res.json(events);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createEvent = async (req: Request, res: Response) => {
    const {
        title, description, event_date, event_dates, location, lp_url,
        capacity, target_seats, unit_price, target_sales, current_sales, entry_deadline,
        kpi_seat_to_entry_rate, kpi_entry_to_interview_rate, 
        kpi_interview_to_reservation_rate, kpi_reservation_to_application_rate,
        kpi_custom_steps,
        event_slots
    } = req.body;
    try {
        await ensureEventDatesTable();
        let dates = normalizeEventDates(event_dates, event_date);
        
        // event_slotsがあればevent_datesを同期
        if (Array.isArray(event_slots) && event_slots.length > 0) {
            dates = event_slots.map((s: any) => s.datetime).filter(Boolean);
        }

        const primaryDate = dates.length > 0 ? dates[0] : null;
        const cols = await getEventColumns();
        const insertCols: string[] = [];
        const insertVals: any[] = [];
        const push = (col: string, val: any) => {
            if (!cols.has(col)) return;
            insertCols.push(col);
            insertVals.push(val);
        };
        push('title', title);
        push('description', description || null);
        push('event_date', primaryDate);
        push('location', location || null);
        push('lp_url', lp_url || null);
        push('capacity', capacity || null);
        push('target_seats', target_seats || null);
        push('unit_price', unit_price || null);
        push('target_sales', target_sales || null);
        push('current_sales', current_sales || 0);
        push('entry_deadline', entry_deadline || null);
        push('kpi_seat_to_entry_rate', kpi_seat_to_entry_rate ?? 70);
        push('kpi_entry_to_interview_rate', kpi_entry_to_interview_rate ?? 60);
        push('kpi_interview_to_reservation_rate', kpi_interview_to_reservation_rate ?? 50);
        push('kpi_reservation_to_application_rate', kpi_reservation_to_application_rate ?? 40);
        push('kpi_custom_steps', Array.isArray(kpi_custom_steps) ? JSON.stringify(kpi_custom_steps) : '[]');
        push('event_slots', Array.isArray(event_slots) ? JSON.stringify(event_slots) : '[]');

        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query('BEGIN');
        const result = await pool.query(
            `INSERT INTO events (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            insertVals
        );
        const created = result.rows[0];
        for (const dt of dates) {
            await pool.query(
                'INSERT INTO event_dates (event_id, event_date) VALUES ($1, $2)',
                [created.id, dt]
            );
        }
        await pool.query('COMMIT');
        res.json({ ...created, event_dates: dates });
    } catch (err: any) {
        try { await pool.query('ROLLBACK'); } catch { }
        res.status(500).json({ error: err.message });
    }
};

export const updateEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        title, description, location, lp_url,
        yomi_statuses, event_slots,
        // event_date, event_dates are used for legacy/internal syncing
        event_date, event_dates 
    } = req.body;
    try {
        await ensureEventDatesTable();
        let dates = normalizeEventDates(event_dates, event_date);

        // event_slotsがあればevent_datesを同期
        if (Array.isArray(event_slots) && event_slots.length > 0) {
            dates = event_slots.map((s: any) => s.datetime).filter(Boolean);
        }

        const cols = await getEventColumns();
        const setParts: string[] = [];
        const values: any[] = [];
        const pushSet = (col: string, val: any) => {
            if (!cols.has(col) || val === undefined) return;
            values.push(val);
            setParts.push(`${col} = $${values.length}`);
        };

        pushSet('title', title);
        pushSet('description', description);
        pushSet('location', location);
        pushSet('lp_url', lp_url);
        
        if (yomi_statuses !== undefined) {
            values.push(JSON.stringify(yomi_statuses));
            setParts.push(`yomi_statuses = $${values.length}`);
        }
        if (event_slots !== undefined) {
            values.push(Array.isArray(event_slots) ? JSON.stringify(event_slots) : '[]');
            setParts.push(`event_slots = $${values.length}`);
        }
        values.push(id);

        await pool.query('BEGIN');
        const result = await pool.query(
            `UPDATE events
             SET ${setParts.join(', ')}
             WHERE id = $${values.length}
             RETURNING *`,
            values
        );
        if (result.rows.length === 0) {
            await pool.query('ROLLBACK');
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        if (event_dates !== undefined || event_slots !== undefined || event_date !== undefined) {
            await pool.query('DELETE FROM event_dates WHERE event_id = $1', [id]);
            for (const dt of dates) {
                await pool.query(
                    'INSERT INTO event_dates (event_id, event_date) VALUES ($1, $2)',
                    [id, dt]
                );
            }
        }
        await pool.query('COMMIT');
        res.json({ ...result.rows[0], event_dates: dates });
    } catch (err: any) {
        try { await pool.query('ROLLBACK'); } catch { }
        res.status(500).json({ error: err.message });
    }
};

export const updateEventKpi = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        entry_deadline, capacity, target_seats, unit_price, target_sales, current_sales,
        kpi_seat_to_entry_rate, kpi_entry_to_interview_rate, 
        kpi_interview_to_reservation_rate, kpi_reservation_to_application_rate,
        kpi_custom_steps, event_slots
    } = req.body;
    try {
        await ensureEventDatesTable();
        const cols = await getEventColumns();
        const setParts: string[] = [];
        const values: any[] = [];
        const pushSet = (col: string, val: any) => {
            if (!cols.has(col) || val === undefined) return;
            values.push(val);
            setParts.push(`${col} = $${values.length}`);
        };

        pushSet('entry_deadline', entry_deadline);
        pushSet('capacity', capacity);
        pushSet('target_seats', target_seats);
        pushSet('unit_price', unit_price);
        pushSet('target_sales', target_sales);
        pushSet('current_sales', current_sales);
        pushSet('kpi_seat_to_entry_rate', kpi_seat_to_entry_rate);
        pushSet('kpi_entry_to_interview_rate', kpi_entry_to_interview_rate);
        pushSet('kpi_interview_to_reservation_rate', kpi_interview_to_reservation_rate);
        pushSet('kpi_reservation_to_application_rate', kpi_reservation_to_application_rate);
        if (kpi_custom_steps !== undefined) {
          pushSet('kpi_custom_steps', Array.isArray(kpi_custom_steps) ? JSON.stringify(kpi_custom_steps) : '[]');
        }
        if (event_slots !== undefined) {
          pushSet('event_slots', Array.isArray(event_slots) ? JSON.stringify(event_slots) : '[]');
        }

        if (setParts.length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE events
             SET ${setParts.join(', ')}
             WHERE id = $${values.length}
             RETURNING *`,
            values
        );
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getEventDetail = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await ensureEventDatesTable();
        await ensureStudentEventsColumns();
        const eventRes = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
        const eventDatesRes = await pool.query(
            'SELECT event_date FROM event_dates WHERE event_id = $1 ORDER BY event_date ASC',
            [id]
        );
        const participantsRes = await pool.query(`
            SELECT 
                se.id as student_event_id,
                se.student_id,
                se.status,
                se.created_at,
                to_char(se.selected_event_date, 'YYYY-MM-DD"T"HH24:MI:SS') as selected_event_date,
                s.name,
                s.university,
                s.email,
                s.phone,
                s.graduation_year,
                u.name as staff_name,
                t.content as next_task_content,
                t.due_date as next_task_date
            FROM student_events se
            JOIN students s ON s.id = se.student_id
            LEFT JOIN users u ON u.id = s.staff_id
            LEFT JOIN LATERAL (
              SELECT content, due_date
              FROM student_tasks
              WHERE student_id = se.student_id
                AND COALESCE(completed, FALSE) = FALSE
              ORDER BY due_date ASC NULLS LAST
              LIMIT 1
            ) t ON true
            WHERE se.event_id = $1
            ORDER BY se.created_at DESC
        `, [id]);

        res.json({
            event: {
                ...eventRes.rows[0],
                source: 'event',
                event_dates: eventDatesRes.rows.map((r: any) => r.event_date)
            },
            participants: participantsRes.rows
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const updateParticipantStatus = async (req: Request, res: Response) => {
    const { id, studentId } = req.params;
    const { status, selected_event_date } = req.body;
    try {
        await ensureStudentEventsColumns();
        const result = await pool.query(
            `UPDATE student_events
             SET status = $1,
                 selected_event_date = COALESCE($2, selected_event_date)
             WHERE id = $3 AND event_id = $4
             RETURNING *`,
            [status, normalizeToHour(selected_event_date) || null, studentId, id]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE interview_logs SET event_id = NULL WHERE event_id = $1', [id]);
        const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
export const getKgiProgress = async (req: Request, res: Response) => {
    try {
        await ensureEventDatesTable();
        await ensureStudentEventsColumns();

        // Today in JST
        const now = new Date();
        const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const todayStr = jstNow.toISOString().slice(0, 10);
        const todayDate = new Date(todayStr + 'T00:00:00');

        const eventsRes = await pool.query(`
            SELECT
                e.id,
                e.title,
                e.target_seats,
                e.capacity AS capacity_entry,
                COALESCE(e.kpi_seat_to_entry_rate, 70) AS kpi_seat_to_entry_rate,
                COALESCE(e.kpi_entry_to_interview_rate, 60) AS kpi_entry_to_interview_rate,
                COALESCE(e.kpi_interview_to_reservation_rate, 50) AS kpi_interview_to_reservation_rate,
                COALESCE(e.kpi_reservation_to_application_rate, 40) AS kpi_reservation_to_application_rate,
                COALESCE(e.kpi_custom_steps, '[]') AS kpi_custom_steps,
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
                ) AS deadline,
                (
                  SELECT MAX(slot->>'datetime')
                  FROM jsonb_array_elements(
                    CASE WHEN e.event_slots IS NOT NULL
                         AND jsonb_array_length(e.event_slots) > 0
                    THEN e.event_slots ELSE '[]'::jsonb END
                  ) AS slot
                ) AS last_slot_date
            FROM events e
            ORDER BY COALESCE(
                e.entry_deadline::text,
                (
                  SELECT MAX(slot->>'datetime')
                  FROM jsonb_array_elements(
                    CASE WHEN e.event_slots IS NOT NULL
                         AND jsonb_array_length(e.event_slots) > 0
                    THEN e.event_slots ELSE '[]'::jsonb END
                  ) AS slot
                )
            ) DESC NULLS LAST
        `);

        const statusBreakdownRes = await pool.query(`
            SELECT
                se.event_id,
                se.status,
                COUNT(*) AS cnt
            FROM student_events se
            GROUP BY se.event_id, se.status
        `);

        const breakdownMap: Record<number, Record<string, number>> = {};
        for (const row of statusBreakdownRes.rows) {
            if (!breakdownMap[row.event_id]) breakdownMap[row.event_id] = {};
            breakdownMap[row.event_id][row.status] = Number(row.cnt);
        }

        const result = eventsRes.rows.map((e: any) => {
            const breakdown = breakdownMap[e.id] || {};
            const currentEntry = (breakdown['A_ENTRY'] || 0) + (breakdown['registered'] || 0);
            const currentSeats = breakdown['attended'] || 0;
            const targetSeats = Number(e.target_seats || 0);
            const kpiInterviewToInflow = Number(e.kpi_interview_to_inflow_rate || 50);

            // カスタムステップをパース
            let customSteps: Array<{ label: string; rate: number; position: number }> = [];
            try {
                const raw = typeof e.kpi_custom_steps === 'string'
                    ? JSON.parse(e.kpi_custom_steps)
                    : (Array.isArray(e.kpi_custom_steps) ? e.kpi_custom_steps : []);
                if (Array.isArray(raw)) {
                    customSteps = raw.map((x: any) => ({
                        label: String(x?.label || ''),
                        rate: Number(x?.rate || 50),
                        position: Number(x?.position || 4)
                    })).filter((x) => x.label);
                }
            } catch { customSteps = []; }

            // ① 目標エントリー数：常にKPI逆算値を使用
            const kpiRate = Number(e.kpi_seat_to_entry_rate || 70);
            const targetEntry = targetSeats > 0 ? Math.round(targetSeats / (kpiRate / 100)) : 0;

            // ② 残り必要エントリー数
            const remainingEntry = Math.max(targetEntry - currentEntry, 0);

            // ③ デイリー必要面談数
            const kpiEntryToInterview = Number(e.kpi_entry_to_interview_rate || 60);
            
            let daysRemaining = 0;
            let deadlineStr: string | null = null;
            
            // 優先順位：
            // 1. entry_deadline（設定されている場合）
            // 2. event_slots の最終日程（last_slot_date）
            // 3. どちらもない場合は null
            const toJSTDateString = (value: string): string => {
              const d = new Date(value);
              const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
              return jst.toISOString().slice(0, 10);
            };

            const effectiveDeadline = e.deadline || e.last_slot_date;
            if (effectiveDeadline) {
              const raw = String(effectiveDeadline);
              const deadlineDateStr = raw.includes('Z') || raw.includes('+')
                ? toJSTDateString(raw)
                : raw.slice(0, 10);
              deadlineStr = deadlineDateStr;
              const deadlineDate = new Date(deadlineDateStr + 'T00:00:00');
              const diffMs = deadlineDate.getTime() - todayDate.getTime();
              daysRemaining = Math.floor(diffMs / 86400000);
            }

            const dailyRequiredInterview = daysRemaining > 0
                ? Math.round((remainingEntry / (kpiEntryToInterview / 100) / daysRemaining) * 10) / 10
                : null; // 締切済みはnull

            return {
                event_id: e.id,
                event_title: e.title,
                deadline: deadlineStr,
                days_remaining: daysRemaining,
                target_entry: targetEntry,
                kpi_target_entry: targetEntry,        // 目標エントリー（KPI逆算値）
                remaining_entry: remainingEntry,      // 残り必要エントリー数
                daily_required_interview: dailyRequiredInterview, // デイリー必要面談数
                kpi_rate: kpiRate,
                kpi_entry_to_interview_rate: kpiEntryToInterview,
                kpi_interview_to_reservation_rate: Number(e.kpi_interview_to_reservation_rate || 50),
                kpi_reservation_to_application_rate: Number(e.kpi_reservation_to_application_rate || 40),
                kpi_custom_steps: customSteps,
                current_entry: currentEntry,
                target_seats: targetSeats,
                current_seats: currentSeats,
                daily_entry_gap: dailyRequiredInterview || 0, // 互換性のため
                status_breakdown: breakdown
            };
        });

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
