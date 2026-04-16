import { Request, Response } from 'express';
import pool from '../config/db';

export const getLegacyEvents = async (req: Request, res: Response) => {
    try {
        // Fetch from legacy 'events' table
        // We join with event_dates to get all instances
        const result = await pool.query(`
            SELECT 
                e.id,
                e.title as name,
                COALESCE(ed.event_date, e.event_date) as event_date,
                e.created_at,
                'legacy' as source,
                e.description,
                e.location,
                e.capacity,
                e.target_seats,
                e.unit_price,
                e.type as legacy_type
            FROM events e
            LEFT JOIN event_dates ed ON ed.event_id = e.id
            ORDER BY COALESCE(ed.event_date, e.event_date) DESC
        `);
        
        res.json(result.rows);
    } catch (err: any) {
        console.error('getLegacyEvents error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const migrateLegacyEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await pool.query('BEGIN');
        
        // 1. Fetch legacy event
        const legacyRes = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
        if (legacyRes.rows.length === 0) {
            await pool.query('ROLLBACK');
            res.status(404).json({ error: 'Legacy event not found' });
            return;
        }
        const le = legacyRes.rows[0];
        
        // 2. Fetch specific dates for this event
        const datesRes = await pool.query('SELECT event_date FROM event_dates WHERE event_id = $1', [id]);
        const dates = datesRes.rows.length > 0 ? datesRes.rows.map(r => r.event_date) : [le.event_date];
        
        // 3. Insert into projects
        const projectInsert = await pool.query(`
            INSERT INTO projects (
                title, description, graduation_year, type,
                location, lp_url, capacity, target_seats, unit_price
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [
            le.title,
            le.description,
            le.graduation_year || null,
            'event', // Default to event
            le.location,
            null, // lp_url not in legacy
            le.capacity,
            le.target_seats,
            le.unit_price
        ]);
        const projectId = projectInsert.rows[0].id;
        
        // 4. Insert into project_schedules
        for (const d of dates) {
            if (!d) continue;
            await pool.query(
                'INSERT INTO project_schedules (project_id, schedule_date) VALUES ($1, $2)',
                [projectId, d]
            );
        }
        
        await pool.query('COMMIT');
        res.json({ success: true, projectId });
    } catch (err: any) {
        try { await pool.query('ROLLBACK'); } catch { }
        console.error('migrateLegacyEvent error:', err);
        res.status(500).json({ error: err.message });
    }
};
