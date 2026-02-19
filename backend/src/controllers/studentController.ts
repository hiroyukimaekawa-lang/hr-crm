import { Request, Response } from 'express';
import pool from '../config/db';

const getStudentColumns = async () => {
    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'students'`
    );
    return new Set(result.rows.map((r: any) => r.column_name));
};

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

const normalizeProgressStage = (value: any) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '面談調整中';
    if (raw === '調整中(初回)' || raw === '調整中') return '面談調整中';
    if (raw.includes('初回')) return '初回面談';
    if (raw.includes('2回')) return '2回目面談';
    if (raw.includes('顧客')) return '顧客化';
    if (raw.includes('トビ')) return 'トビ';
    return '面談調整中';
};

const normalizeReferralStatus = (value: any) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '不明';
    if (raw.includes('キーマン')) return 'キーマン';
    if (raw.includes('出そう')) return '出そう';
    if (raw.includes('ワンチャン') || raw.includes('ほぼ無理')) return 'ほぼ無理ワンチャン';
    if (raw === '無理') return '無理';
    if (raw.includes('不明')) return '不明';
    return '不明';
};

const normalizeAcademicTrack = (value: any) => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (raw.includes('文')) return '文系';
    if (raw.includes('理')) return '理系';
    return raw;
};

export const getStudents = async (req: Request, res: Response) => {
    const staffId = req.query.staffId;
    const authUser = (req as any).user as { sub?: string; role?: string } | undefined;
    try {
        let query = `
            SELECT
                students.*,
                users.name as staff_name,
                st.content as latest_task_content,
                st.due_date as latest_task_due_date
            FROM students
            LEFT JOIN users ON students.staff_id = users.id
            LEFT JOIN LATERAL (
                SELECT content, due_date
                FROM student_tasks
                WHERE student_id = students.id
                ORDER BY created_at DESC
                LIMIT 1
            ) st ON true
        `;
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
        prefecture,
        academic_track,
        faculty,
        referral_status,
        progress_stage,
        next_meeting_date,
        next_action,
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
        const duplicateRes = await pool.query(
            'SELECT id FROM students WHERE name = $1 AND COALESCE(university, \'\') = COALESCE($2, \'\') AND COALESCE(faculty, \'\') = COALESCE($3, \'\') LIMIT 1',
            [name, university || null, faculty || null]
        );
        if (duplicateRes.rows.length > 0) {
            res.status(409).json({ error: 'Student already exists' });
            return;
        }

        const cols = await getStudentColumns();
        const insertCols: string[] = [];
        const insertVals: any[] = [];

        const pushCol = (col: string, val: any) => {
            if (!cols.has(col)) return;
            insertCols.push(col);
            insertVals.push(val);
        };

        pushCol('name', name);
        pushCol('university', university || null);
        pushCol('prefecture', prefecture || null);
        pushCol('academic_track', academic_track || null);
        pushCol('faculty', faculty || null);
        pushCol('referral_status', normalizeReferralStatus(referral_status));
        pushCol('progress_stage', normalizeProgressStage(progress_stage));
        pushCol('next_meeting_date', next_meeting_date || null);
        pushCol('next_action', next_action || null);
        pushCol('desired_industry', desired_industry || null);
        pushCol('desired_role', desired_role || null);
        pushCol('graduation_year', normalizeGraduationYear(graduation_year));
        pushCol('email', email || null);
        pushCol('phone', phone || null);
        pushCol('status', status || 'active');
        pushCol('tags', tags || null);
        pushCol('staff_id', staff_id || null);
        pushCol('source_company', source_company || null);
        pushCol('interview_reason', interview_reason || null);

        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        const result = await pool.query(
            `INSERT INTO students (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            insertVals
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
        const tasksRes = await pool.query(
            'SELECT * FROM student_tasks WHERE student_id = $1 ORDER BY due_date NULLS LAST, created_at DESC',
            [id]
        );

        res.json({
            student: studentRes.rows[0],
            events: eventsRes.rows,
            logs: logsRes.rows,
            tasks: tasksRes.rows
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const linkEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { event_id, status } = req.body;
    try {
        const safeStatus = ['A_ENTRY', 'B_WAITING', 'C_WAITING', 'XA_CANCEL'].includes(status) ? status : 'A_ENTRY';
        await pool.query(
            `INSERT INTO student_events (student_id, event_id, status)
             VALUES ($1, $2, $3)
             ON CONFLICT (student_id, event_id) DO UPDATE SET status = EXCLUDED.status`,
            [id, event_id, safeStatus]
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

export const updateStudentBasic = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        name,
        university,
        prefecture,
        academic_track,
        faculty,
        email,
        phone,
        graduation_year,
        source_company,
        interview_reason,
        desired_industry,
        desired_role,
        next_meeting_date,
        next_action
    } = req.body;
    try {
        const cols = await getStudentColumns();
        const setParts: string[] = [];
        const values: any[] = [];

        const pushSet = (col: string, val: any) => {
            if (!cols.has(col)) return;
            values.push(val);
            setParts.push(`${col} = $${values.length}`);
        };

        pushSet('name', name || null);
        pushSet('university', university || null);
        pushSet('prefecture', prefecture || null);
        pushSet('academic_track', academic_track || null);
        pushSet('faculty', faculty || null);
        pushSet('email', email || null);
        pushSet('phone', phone || null);
        pushSet('graduation_year', normalizeGraduationYear(graduation_year));
        pushSet('source_company', source_company || null);
        pushSet('interview_reason', interview_reason || null);
        pushSet('desired_industry', desired_industry || null);
        pushSet('desired_role', desired_role || null);
        pushSet('next_meeting_date', next_meeting_date || null);
        pushSet('next_action', next_action || null);
        if (cols.has('updated_at')) {
            setParts.push('updated_at = CURRENT_TIMESTAMP');
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE students SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`,
            values
        );
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
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

export const updateStudentMeta = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { referral_status, progress_stage, source_company, next_meeting_date, next_action } = req.body;
    try {
        const result = await pool.query(
            `UPDATE students
             SET referral_status = COALESCE($1, referral_status),
                 progress_stage = COALESCE($2, progress_stage),
                 source_company = COALESCE($3, source_company),
                 next_meeting_date = COALESCE($4, next_meeting_date),
                 next_action = COALESCE($5, next_action),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [referral_status, progress_stage, source_company, next_meeting_date, next_action, id]
        );
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const addStudentTask = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { due_date, content } = req.body;
    if (!content || !String(content).trim()) {
        res.status(400).json({ error: 'Task content is required' });
        return;
    }
    try {
        const result = await pool.query(
            'INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3) RETURNING *',
            [id, due_date || null, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteStudentTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    try {
        const result = await pool.query('DELETE FROM student_tasks WHERE id = $1 RETURNING id', [taskId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        res.json({ success: true });
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
    let skipped = 0;
    const seen = new Set<string>();

    try {
        const cols = await getStudentColumns();
        for (const s of students) {
            const name = s.name || '';
            const university = s.university || '';
            const prefecture = s.prefecture || '';
            const dedupeKey = `${name}__${university}__${prefecture}`;
            if (!name) {
                skipped++;
                continue;
            }
            if (seen.has(dedupeKey)) {
                skipped++;
                continue;
            }
            seen.add(dedupeKey);

            const existsRes = await pool.query(
                cols.has('prefecture')
                    ? 'SELECT id FROM students WHERE name = $1 AND COALESCE(university, \'\') = COALESCE($2, \'\') AND COALESCE(prefecture, \'\') = COALESCE($3, \'\') LIMIT 1'
                    : 'SELECT id FROM students WHERE name = $1 AND COALESCE(university, \'\') = COALESCE($2, \'\') LIMIT 1',
                cols.has('prefecture')
                    ? [name, university || null, prefecture || null]
                    : [name, university || null]
            );

            const updateParts: string[] = [];
            const values: any[] = [];
            const pushSet = (col: string, val: any) => {
                if (!cols.has(col)) return;
                values.push(val);
                updateParts.push(`${col} = $${values.length}`);
            };

            pushSet('source_company', s.source_company || null);
            pushSet('graduation_year', normalizeGraduationYear(s.graduation_year));
            pushSet('staff_id', s.staff_id || null);
            pushSet('referral_status', normalizeReferralStatus(s.referral_status));
            pushSet('progress_stage', normalizeProgressStage(s.progress_stage));
            pushSet('next_meeting_date', s.next_meeting_date || null);
            pushSet('academic_track', normalizeAcademicTrack(s.academic_track));
            pushSet('prefecture', s.prefecture || null);
            if (cols.has('updated_at')) updateParts.push('updated_at = CURRENT_TIMESTAMP');

            if (existsRes.rows.length > 0) {
                const id = existsRes.rows[0].id;
                if (updateParts.length > 0) {
                    values.push(id);
                    await pool.query(
                        `UPDATE students SET ${updateParts.join(', ')} WHERE id = $${values.length}`,
                        values
                    );
                }

                if (s.task_due_date) {
                    const lastTask = await pool.query(
                        'SELECT id FROM student_tasks WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1',
                        [id]
                    );
                    if (lastTask.rows.length > 0) {
                        await pool.query(
                            'UPDATE student_tasks SET due_date = $1 WHERE id = $2',
                            [s.task_due_date, lastTask.rows[0].id]
                        );
                    } else {
                        await pool.query(
                            'INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3)',
                            [id, s.task_due_date, 'CSV更新タスク']
                        );
                    }
                }
                updated++;
                continue;
            }

            const insertCols: string[] = [];
            const insertVals: any[] = [];
            const pushInsert = (col: string, val: any) => {
                if (!cols.has(col)) return;
                insertCols.push(col);
                insertVals.push(val);
            };

            pushInsert('name', name);
            pushInsert('university', university || null);
            pushInsert('prefecture', s.prefecture || null);
            pushInsert('academic_track', normalizeAcademicTrack(s.academic_track));
            pushInsert('graduation_year', normalizeGraduationYear(s.graduation_year));
            pushInsert('staff_id', s.staff_id || null);
            pushInsert('source_company', s.source_company || null);
            pushInsert('referral_status', normalizeReferralStatus(s.referral_status));
            pushInsert('progress_stage', normalizeProgressStage(s.progress_stage));
            pushInsert('next_meeting_date', s.next_meeting_date || null);

            const placeholders = insertCols.map((_: any, idx: number) => `$${idx + 1}`).join(', ');
            const insertedRes = await pool.query(
                `INSERT INTO students (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
                insertVals
            );

            if (s.task_due_date && insertedRes.rows[0]?.id) {
                await pool.query(
                    'INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3)',
                    [insertedRes.rows[0].id, s.task_due_date, 'CSV更新タスク']
                );
            }
            inserted++;
        }

        res.json({ inserted, updated, skipped });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
