import { Request, Response } from 'express';
import pool from '../config/db';

let eventDatesTableReady = false;
let eventDatesTablePromise: Promise<void> | null = null;
let cachedEventColumns: Set<string> | null = null;

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
                ADD COLUMN IF NOT EXISTS kpi_interview_to_inflow_rate NUMERIC(5,2) DEFAULT 50
            `);
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_custom_steps TEXT DEFAULT '[]'
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
                COALESCE(date_stats.event_dates, '[]'::json) as event_dates,
                COALESCE(part_stats.registered_count, 0) as registered_count,
                COALESCE(part_stats.attended_count, 0) as attended_count,
                COALESCE(part_stats.canceled_count, 0) as canceled_count,
                COALESCE(part_stats.a_entry_count, 0) as a_entry_count,
                COALESCE(part_stats.b_waiting_count, 0) as b_waiting_count,
                COALESCE(part_stats.c_waiting_count, 0) as c_waiting_count,
                COALESCE(part_stats.xa_cancel_count, 0) as xa_cancel_count,
                COALESCE(part_stats.total_count, 0) as total_count
            FROM events e
            LEFT JOIN LATERAL (
                SELECT
                    json_agg(to_char(ed.event_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ORDER BY ed.event_date ASC) as event_dates
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
                    COUNT(se.*) FILTER (WHERE se.status = 'XA_CANCEL' OR se.status = 'canceled') as xa_cancel_count,
                    COUNT(se.*) as total_count
                FROM student_events se
                WHERE se.event_id = e.id
            ) part_stats ON true
            ORDER BY e.event_date DESC
        `);
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createEvent = async (req: Request, res: Response) => {
    const {
        title, description, event_date, event_dates, location, lp_url,
        capacity, target_seats, unit_price, target_sales, current_sales, entry_deadline,
        kpi_seat_to_entry_rate, kpi_entry_to_interview_rate, kpi_interview_to_inflow_rate, kpi_custom_steps
    } = req.body;
    try {
        await ensureEventDatesTable();
        const dates = normalizeEventDates(event_dates, event_date);
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
        push('kpi_interview_to_inflow_rate', kpi_interview_to_inflow_rate ?? 50);
        push('kpi_custom_steps', Array.isArray(kpi_custom_steps) ? JSON.stringify(kpi_custom_steps) : '[]');

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
        try { await pool.query('ROLLBACK'); } catch {}
        res.status(500).json({ error: err.message });
    }
};

export const updateEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        title, description, event_date, event_dates, location, lp_url,
        capacity, target_seats, unit_price, target_sales, current_sales, entry_deadline,
        kpi_seat_to_entry_rate, kpi_entry_to_interview_rate, kpi_interview_to_inflow_rate, kpi_custom_steps
    } = req.body;
    try {
        await ensureEventDatesTable();
        const dates = normalizeEventDates(event_dates, event_date);
        const primaryDate = dates.length > 0 ? dates[0] : null;
        const cols = await getEventColumns();
        const setParts: string[] = [];
        const values: any[] = [];
        const pushSet = (col: string, val: any) => {
            if (!cols.has(col)) return;
            values.push(val);
            setParts.push(`${col} = $${values.length}`);
        };
        pushSet('title', title);
        pushSet('description', description || null);
        pushSet('event_date', primaryDate);
        pushSet('location', location || null);
        pushSet('lp_url', lp_url || null);
        pushSet('capacity', capacity || null);
        pushSet('target_seats', target_seats || null);
        pushSet('unit_price', unit_price || null);
        pushSet('target_sales', target_sales || null);
        pushSet('current_sales', current_sales || 0);
        pushSet('entry_deadline', entry_deadline || null);
        pushSet('kpi_seat_to_entry_rate', kpi_seat_to_entry_rate ?? 70);
        pushSet('kpi_entry_to_interview_rate', kpi_entry_to_interview_rate ?? 60);
        pushSet('kpi_interview_to_inflow_rate', kpi_interview_to_inflow_rate ?? 50);
        pushSet('kpi_custom_steps', Array.isArray(kpi_custom_steps) ? JSON.stringify(kpi_custom_steps) : '[]');
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
        await pool.query('DELETE FROM event_dates WHERE event_id = $1', [id]);
        for (const dt of dates) {
            await pool.query(
                'INSERT INTO event_dates (event_id, event_date) VALUES ($1, $2)',
                [id, dt]
            );
        }
        await pool.query('COMMIT');
        res.json({ ...result.rows[0], event_dates: dates });
    } catch (err: any) {
        try { await pool.query('ROLLBACK'); } catch {}
        res.status(500).json({ error: err.message });
    }
};

export const getEventDetail = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await ensureEventDatesTable();
        const eventRes = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
        const eventDatesRes = await pool.query(
            'SELECT event_date FROM event_dates WHERE event_id = $1 ORDER BY event_date ASC',
            [id]
        );
        const participantsRes = await pool.query(`
            SELECT 
                se.student_id,
                se.status,
                se.created_at,
                s.name,
                s.university,
                s.email,
                s.phone,
                s.graduation_year,
                u.name as staff_name
            FROM student_events se
            JOIN students s ON s.id = se.student_id
            LEFT JOIN users u ON u.id = s.staff_id
            WHERE se.event_id = $1
            ORDER BY se.created_at DESC
        `, [id]);

        res.json({
            event: {
                ...eventRes.rows[0],
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
    const { status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE student_events SET status = $1 WHERE event_id = $2 AND student_id = $3 RETURNING *',
            [status, id, studentId]
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
