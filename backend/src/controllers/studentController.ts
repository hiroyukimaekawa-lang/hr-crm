import { Request, Response } from 'express';
import pool from '../config/db';

const normalizeGraduationYear = (value: any) => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const direct = Number(raw);
    if (Number.isFinite(direct) && direct >= 1900 && direct <= 2100) {
        return direct;
    }

    const twoDigitMatch = raw.match(/(\d{2})\s*卒/);
    if (twoDigitMatch) {
        const yy = Number(twoDigitMatch[1]);
        if (!Number.isNaN(yy)) {
            return 2000 + yy;
        }
    }

    const fourDigitMatch = raw.match(/(\d{4})\s*卒/);
    if (fourDigitMatch) {
        const yyyy = Number(fourDigitMatch[1]);
        if (!Number.isNaN(yyyy)) {
            return yyyy;
        }
    }

    return null;
};

export const getStudents = async (req: Request, res: Response) => {
    const staffId = req.query.staffId;
    const authUser = (req as any).user as { sub?: string; role?: string } | undefined;
    try {
        let query = 'SELECT students.*, users.name as staff_name FROM students LEFT JOIN users ON students.staff_id = users.id';
        const params: any[] = [];

        // staff users can only see their own students regardless of query param
        if (authUser?.role !== 'admin' && authUser?.sub) {
            query += ' WHERE students.staff_id = $1';
            params.push(Number(authUser.sub));
        } else if (staffId) {
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
        academic_track,
        faculty,
        desired_industry,
        desired_role,
        graduation_year,
        email,
        phone,
        status,
        tags,
        staff_id,
        source_company,
        interview_reason
    } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO students (name, university, academic_track, faculty, desired_industry, desired_role, graduation_year, email, phone, status, tags, staff_id, source_company, interview_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
            [
                name,
                university,
                academic_track || null,
                faculty || null,
                desired_industry || null,
                desired_role || null,
                graduation_year || null,
                email || null,
                phone || null,
                status || 'active',
                tags || null,
                staff_id || null,
                source_company || null,
                interview_reason || null
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
                e.title as event_title,
                u.name as staff_name
            FROM interview_logs il
            LEFT JOIN events e ON e.id = il.event_id
            LEFT JOIN users u ON u.id = il.staff_id
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

export const deleteInterviewLog = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM interview_logs WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Log not found' });
            return;
        }
        res.json({ success: true });
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

export const deleteStudent = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const importStudents = async (req: Request, res: Response) => {
    const { students } = req.body as { students: any[] };
    if (!Array.isArray(students)) {
        res.status(400).json({ error: 'Invalid payload' });
        return;
    }

    let inserted = 0;
    let updated = 0;

    try {
        for (const s of students) {
            const name = s.name || '';
            const university = s.university || '';
            const faculty = s.faculty || '';

            const existsRes = await pool.query(
                'SELECT id FROM students WHERE name = $1 AND university = $2 AND faculty = $3',
                [name, university, faculty]
            );

            if (existsRes.rows.length > 0) {
                const id = existsRes.rows[0].id;
                await pool.query(
                    'UPDATE students SET source_company = $1, graduation_year = $2, email = $3, status = $4, staff_id = $5, interview_reason = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7',
                    [
                        s.source_company || null,
                        normalizeGraduationYear(s.graduation_year),
                        s.email || null,
                        s.status || '面談',
                        s.staff_id || null,
                        s.interview_reason || null,
                        id
                    ]
                );
                updated++;
                continue;
            }

            await pool.query(
                'INSERT INTO students (name, university, faculty, graduation_year, email, status, staff_id, source_company, interview_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [
                    name,
                    university || null,
                    faculty || null,
                    normalizeGraduationYear(s.graduation_year),
                    s.email || null,
                    s.status || '面談',
                    s.staff_id || null,
                    s.source_company || null,
                    s.interview_reason || null
                ]
            );
            inserted++;
        }

        res.json({ inserted, updated });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
