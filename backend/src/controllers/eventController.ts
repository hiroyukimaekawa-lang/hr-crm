import { Request, Response } from 'express';
import pool from '../config/db';

const getEventColumns = async () => {
    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'events'`
    );
    return new Set(result.rows.map((r: any) => r.column_name));
};

export const getEvents = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                e.*,
                COUNT(se.*) FILTER (WHERE se.status = 'registered' OR se.status = 'A_ENTRY') as registered_count,
                COUNT(se.*) FILTER (WHERE se.status = 'attended') as attended_count,
                COUNT(se.*) FILTER (WHERE se.status = 'canceled') as canceled_count,
                COUNT(se.*) FILTER (WHERE se.status = 'A_ENTRY' OR se.status = 'registered') as a_entry_count,
                COUNT(se.*) FILTER (WHERE se.status = 'B_WAITING') as b_waiting_count,
                COUNT(se.*) FILTER (WHERE se.status = 'C_WAITING') as c_waiting_count,
                COUNT(se.*) as total_count,
                COALESCE(
                    json_agg(
                        jsonb_build_object('id', s.id, 'name', s.name)
                    ) FILTER (WHERE se.status = 'registered' OR se.status = 'A_ENTRY'),
                    '[]'::json
                ) as registered_participants
            FROM events e
            LEFT JOIN student_events se ON e.id = se.event_id
            LEFT JOIN students s ON s.id = se.student_id
            GROUP BY e.id
            ORDER BY e.event_date DESC
        `);
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createEvent = async (req: Request, res: Response) => {
    const { title, description, event_date, location, lp_url, capacity, target_seats, unit_price, target_sales, current_sales } = req.body;
    try {
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
        push('event_date', event_date || null);
        push('location', location || null);
        push('lp_url', lp_url || null);
        push('capacity', capacity || null);
        push('target_seats', target_seats || null);
        push('unit_price', unit_price || null);
        push('target_sales', target_sales || null);
        push('current_sales', current_sales || 0);

        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        const result = await pool.query(
            `INSERT INTO events (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            insertVals
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const updateEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, event_date, location, lp_url, capacity, target_seats, unit_price, target_sales, current_sales } = req.body;
    try {
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
        pushSet('event_date', event_date || null);
        pushSet('location', location || null);
        pushSet('lp_url', lp_url || null);
        pushSet('capacity', capacity || null);
        pushSet('target_seats', target_seats || null);
        pushSet('unit_price', unit_price || null);
        pushSet('target_sales', target_sales || null);
        pushSet('current_sales', current_sales || 0);
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
        const eventRes = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
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
            event: eventRes.rows[0],
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
