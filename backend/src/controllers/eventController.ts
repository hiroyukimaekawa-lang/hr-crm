import { Request, Response } from 'express';
import pool from '../config/db';

export const getEvents = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                e.*,
                COUNT(se.*) FILTER (WHERE se.status = 'registered') as registered_count,
                COUNT(se.*) FILTER (WHERE se.status = 'attended') as attended_count,
                COUNT(se.*) FILTER (WHERE se.status = 'canceled') as canceled_count,
                COUNT(se.*) as total_count,
                COALESCE(
                    json_agg(
                        jsonb_build_object('id', s.id, 'name', s.name)
                    ) FILTER (WHERE se.status = 'registered'),
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
    const { title, description, event_date, location, capacity, target_seats, target_sales, current_sales } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO events (title, description, event_date, location, capacity, target_seats, target_sales, current_sales) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [
                title,
                description,
                event_date,
                location || null,
                capacity || null,
                target_seats || null,
                target_sales || null,
                current_sales || 0
            ]
        );
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
                s.graduation_year
            FROM student_events se
            JOIN students s ON s.id = se.student_id
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
