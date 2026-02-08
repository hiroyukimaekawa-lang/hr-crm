import { Request, Response } from 'express';
import pool from '../config/db';

export const getStudents = async (req: Request, res: Response) => {
    const staffId = req.query.staffId;
    try {
        let query = 'SELECT students.*, users.name as staff_name FROM students LEFT JOIN users ON students.staff_id = users.id';
        const params = [];
        if (staffId) {
            query += ' WHERE staff_id = $1';
            params.push(staffId);
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createStudent = async (req: Request, res: Response) => {
    const {
        name,
        university,
        faculty,
        desired_industry,
        desired_role,
        graduation_year,
        email,
        phone,
        status,
        tags,
        staff_id
    } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO students (name, university, faculty, desired_industry, desired_role, graduation_year, email, phone, status, tags, staff_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
            [
                name,
                university,
                faculty || null,
                desired_industry || null,
                desired_role || null,
                graduation_year || null,
                email,
                phone,
                status || 'active',
                tags || null,
                staff_id
            ]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getStudentDetail = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
        const eventsRes = await pool.query(`
            SELECT e.*, se.status as participation_status, se.created_at as participation_created_at
            FROM events e
            JOIN student_events se ON e.id = se.event_id
            WHERE se.student_id = $1
            ORDER BY se.created_at DESC
        `, [id]);
        const logsRes = await pool.query(`
            SELECT 
                il.*,
                e.title as event_title
            FROM interview_logs il
            LEFT JOIN events e ON e.id = il.event_id
            WHERE il.student_id = $1
            ORDER BY il.created_at DESC
        `, [id]);

        res.json({
            student: studentRes.rows[0],
            events: eventsRes.rows,
            logs: logsRes.rows
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const linkEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { event_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO student_events (student_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, event_id]
        );
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const addInterviewLog = async (req: Request, res: Response) => {
    const { student_id, staff_id, log_type, event_id, content, interview_date } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO interview_logs (student_id, staff_id, log_type, event_id, content, interview_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [student_id, staff_id, log_type || '面談', event_id || null, content, interview_date]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const updateStudentStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE students SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const updateStudentStaff = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { staff_id } = req.body;
    try {
        const result = await pool.query(
            'UPDATE students SET staff_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [staff_id || null, id]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
