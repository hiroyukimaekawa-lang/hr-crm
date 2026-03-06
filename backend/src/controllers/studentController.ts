import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';

let interviewScheduleTableReady = false;
let interviewScheduleTablePromise: Promise<void> | null = null;
let cachedStudentColumns: Set<string> | null = null;
let studentExtendedColumnsReady = false;
let studentExtendedColumnsPromise: Promise<void> | null = null;
let sourceCategoriesTableReady = false;
let sourceCategoriesTablePromise: Promise<void> | null = null;
let studentTaskColumnsReady = false;
let studentTaskColumnsPromise: Promise<void> | null = null;
let salesFunnelTablesReady = false;
let salesFunnelTablesPromise: Promise<void> | null = null;

const ensureInterviewScheduleTables = async () => {
    if (interviewScheduleTableReady) return;
    if (!interviewScheduleTablePromise) {
        interviewScheduleTablePromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS interview_schedules (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                    round_no INTEGER NOT NULL,
                    scheduled_at TIMESTAMP,
                    actual_at TIMESTAMP,
                    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
                    reschedule_count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (student_id, round_no)
                )
            `);
            await pool.query(`
                ALTER TABLE interview_schedules
                ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(50) DEFAULT '面談'
            `);
            interviewScheduleTableReady = true;
        })().finally(() => {
            interviewScheduleTablePromise = null;
        });
    }
    await interviewScheduleTablePromise;
};

const ensureStudentExtendedColumns = async () => {
    if (studentExtendedColumnsReady) return;
    if (!studentExtendedColumnsPromise) {
        studentExtendedColumnsPromise = (async () => {
            await pool.query(`
                ALTER TABLE students
                ADD COLUMN IF NOT EXISTS meeting_decided_date DATE
            `);
            await pool.query(`
                ALTER TABLE students
                ADD COLUMN IF NOT EXISTS first_interview_date DATE
            `);
            await pool.query(`
                ALTER TABLE students
                ADD COLUMN IF NOT EXISTS second_interview_date DATE
            `);
            cachedStudentColumns = null;
            studentExtendedColumnsReady = true;
        })().finally(() => {
            studentExtendedColumnsPromise = null;
        });
    }
    await studentExtendedColumnsPromise;
};

const ensureSourceCategoriesTable = async () => {
    if (sourceCategoriesTableReady) return;
    if (!sourceCategoriesTablePromise) {
        sourceCategoriesTablePromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS source_categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            sourceCategoriesTableReady = true;
        })().finally(() => {
            sourceCategoriesTablePromise = null;
        });
    }
    await sourceCategoriesTablePromise;
};

const ensureStudentTaskColumns = async () => {
    if (studentTaskColumnsReady) return;
    if (!studentTaskColumnsPromise) {
        studentTaskColumnsPromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS student_tasks (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                    due_date DATE,
                    content TEXT NOT NULL DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query(`
                ALTER TABLE student_tasks
                ADD COLUMN IF NOT EXISTS due_date DATE
            `);
            await pool.query(`
                ALTER TABLE student_tasks
                ADD COLUMN IF NOT EXISTS content TEXT DEFAULT ''
            `);
            await pool.query(`
                ALTER TABLE student_tasks
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            `);
            await pool.query(`
                ALTER TABLE student_tasks
                ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE
            `);
            studentTaskColumnsReady = true;
        })().finally(() => {
            studentTaskColumnsPromise = null;
        });
    }
    await studentTaskColumnsPromise;
};

const ensureSalesFunnelTables = async () => {
    if (salesFunnelTablesReady) return;
    if (!salesFunnelTablesPromise) {
        salesFunnelTablesPromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS applications (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
                    student_name VARCHAR(255) NOT NULL,
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
                CREATE TABLE IF NOT EXISTS interviews (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                    scheduled_at TIMESTAMP,
                    interviewed_at TIMESTAMP,
                    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS company VARCHAR(255)
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS lost_reasons (
                    id SERIAL PRIMARY KEY,
                    reason_name VARCHAR(255) UNIQUE NOT NULL
                )
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS event_proposals (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    proposed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(50) NOT NULL DEFAULT 'proposed',
                    lost_reason_id INTEGER REFERENCES lost_reasons(id) ON DELETE SET NULL,
                    memo TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query(`
                INSERT INTO lost_reasons (reason_name)
                VALUES
                    ('日程が合わない'),
                    ('優先度が低い'),
                    ('連絡不通'),
                    ('他社で決定'),
                    ('その他')
                ON CONFLICT (reason_name) DO NOTHING
            `);
            salesFunnelTablesReady = true;
        })().finally(() => {
            salesFunnelTablesPromise = null;
        });
    }
    await salesFunnelTablesPromise;
};

const getStudentColumns = async () => {
    if (cachedStudentColumns) return cachedStudentColumns;
    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'students'`
    );
    cachedStudentColumns = new Set(result.rows.map((r: any) => r.column_name));
    return cachedStudentColumns;
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

const oneDayBefore = (dateText?: string | null) => {
    if (!dateText) return null;
    const d = new Date(dateText);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
};

const normalizeNullableText = (value: any) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
};

const ensureSourceCategoryFromStudent = async (
    sourceCompany: any,
    queryable: Pick<PoolClient, 'query'> | typeof pool = pool
) => {
    const normalized = normalizeNullableText(sourceCompany);
    if (!normalized) return;
    if (['流入経路', 'source_company', '氏名', '初回平均(日)'].includes(normalized)) return;
    await ensureSourceCategoriesTable();
    await queryable.query(
        'INSERT INTO source_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [normalized]
    );
};

export const getStudents = async (req: Request, res: Response) => {
    const staffId = req.query.staffId;
    const authUser = (req as any).user as { sub?: string; role?: string } | undefined;
    try {
        await ensureStudentExtendedColumns();
        await ensureStudentTaskColumns();
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
                  AND COALESCE(completed, FALSE) = FALSE
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
        interview_reason,
        meeting_decided_date,
        first_interview_date,
        second_interview_date
    } = req.body;
    try {
        await ensureStudentExtendedColumns();
        await ensureSalesFunnelTables();
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
        pushCol('next_meeting_date', next_meeting_date || first_interview_date || null);
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
        pushCol('meeting_decided_date', meeting_decided_date || null);
        pushCol('first_interview_date', first_interview_date || null);
        pushCol('second_interview_date', second_interview_date || null);

        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        const normalizedSourceCompany = normalizeNullableText(source_company);
        const result = await pool.query(
            `INSERT INTO students (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            insertVals
        );
        const created = result.rows[0];
        await ensureSourceCategoryFromStudent(normalizedSourceCompany);
        await pool.query(
            `INSERT INTO applications (
                student_id, student_name, source, applied_at, reservation_status, reservation_date
            ) VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP), $5, $6)`,
            [
                created.id,
                created.name,
                normalizedSourceCompany,
                meeting_decided_date || null,
                '初回面談',
                meeting_decided_date || null
            ]
        );
        const preContactDate = oneDayBefore(first_interview_date || null);
        if (created?.id && preContactDate) {
            await pool.query(
                'INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3)',
                [created.id, preContactDate, '事前連絡']
            );
        }
        res.json(created);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getStudentDetail = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await ensureStudentExtendedColumns();
        await ensureInterviewScheduleTables();
        await ensureStudentTaskColumns();
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
            'SELECT * FROM student_tasks WHERE student_id = $1 AND COALESCE(completed, FALSE) = FALSE ORDER BY due_date NULLS LAST, created_at DESC',
            [id]
        );
        const schedulesRes = await pool.query(
            'SELECT * FROM interview_schedules WHERE student_id = $1 ORDER BY round_no ASC',
            [id]
        );

        res.json({
            student: studentRes.rows[0],
            events: eventsRes.rows,
            logs: logsRes.rows,
            tasks: tasksRes.rows,
            schedules: schedulesRes.rows
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createInterviewSchedule = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { round_no, scheduled_at, status, schedule_type } = req.body;
    try {
        await ensureInterviewScheduleTables();
        const round = round_no
            ? Number(round_no)
            : Number((await pool.query('SELECT COALESCE(MAX(round_no), 0) + 1 AS next_round FROM interview_schedules WHERE student_id = $1', [id])).rows[0]?.next_round || 1);
        const safeType = ['流入日', '面談', 'リスケ'].includes(schedule_type) ? schedule_type : '面談';
        const safeStatus = ['scheduled', 'completed', 'rescheduled', 'canceled'].includes(status)
            ? status
            : (safeType === 'リスケ' ? 'rescheduled' : safeType === '流入日' ? 'completed' : 'scheduled');
        const result = await pool.query(
            `INSERT INTO interview_schedules (student_id, round_no, scheduled_at, status, schedule_type)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id, round_no)
             DO UPDATE SET
                scheduled_at = EXCLUDED.scheduled_at,
                status = EXCLUDED.status,
                schedule_type = EXCLUDED.schedule_type,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [id, round, scheduled_at || null, safeStatus, safeType]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const updateInterviewSchedule = async (req: Request, res: Response) => {
    const { scheduleId } = req.params;
    const { scheduled_at, actual_at, status, schedule_type } = req.body;
    try {
        await ensureInterviewScheduleTables();
        const currentRes = await pool.query('SELECT * FROM interview_schedules WHERE id = $1', [scheduleId]);
        if (currentRes.rows.length === 0) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        const current = currentRes.rows[0];
        const scheduledChanged =
            current.scheduled_at !== null &&
            (current.scheduled_at ? new Date(current.scheduled_at).toISOString() : null) !==
            (scheduled_at ? new Date(scheduled_at).toISOString() : null);
        const safeType = ['流入日', '面談', 'リスケ'].includes(schedule_type) ? schedule_type : (current.schedule_type || '面談');
        const typeChangedToReschedule = safeType === 'リスケ' && current.schedule_type !== 'リスケ';
        const nextRescheduleCount = (scheduledChanged || typeChangedToReschedule)
            ? Number(current.reschedule_count || 0) + 1
            : Number(current.reschedule_count || 0);
        let safeStatus = status || current.status;
        if (!['scheduled', 'completed', 'rescheduled', 'canceled'].includes(safeStatus)) safeStatus = current.status;
        if (safeType === 'リスケ') safeStatus = 'rescheduled';
        if (scheduledChanged && safeStatus === 'scheduled') safeStatus = 'rescheduled';

        const result = await pool.query(
            `UPDATE interview_schedules
             SET scheduled_at = COALESCE($1, scheduled_at),
                 actual_at = COALESCE($2, actual_at),
                 status = $3,
                 reschedule_count = $4,
                 schedule_type = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [scheduled_at || null, actual_at || null, safeStatus, nextRescheduleCount, safeType, scheduleId]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteInterviewSchedule = async (req: Request, res: Response) => {
    const { scheduleId } = req.params;
    try {
        await ensureInterviewScheduleTables();
        const result = await pool.query('DELETE FROM interview_schedules WHERE id = $1 RETURNING id', [scheduleId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getInterviewMetrics = async (req: Request, res: Response) => {
    const authUser = (req as any).user as { sub?: string; role?: string } | undefined;
    const sourceCompany = String(req.query.source_company || '').trim();
    const groupBySource = String(req.query.group_by_source || '') === '1';
    const groupByStaff = String(req.query.group_by_staff || '') === '1';
    try {
        await ensureStudentExtendedColumns();
        await ensureInterviewScheduleTables();

        const conditions: string[] = [];
        const params: any[] = [];
        const pushAuthFilters = (alias: string) => {
            if (authUser?.role !== 'admin') {
                params.push(Number(authUser?.sub || 0));
                conditions.push(`${alias}.staff_id = $${params.length}`);
            }
            if (sourceCompany) {
                params.push(sourceCompany);
                conditions.push(`COALESCE(${alias}.source_company, '') = $${params.length}`);
            }
        };
        pushAuthFilters('s');
        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const commonCte = `
            WITH base AS (
                SELECT
                    sch.*,
                    s.created_at AS inflow_at,
                    s.staff_id,
                    COALESCE(s.source_company, '未設定') AS source_company
                FROM interview_schedules sch
                JOIN students s ON s.id = sch.student_id
                ${whereClause}
            ),
            first_round AS (
                SELECT * FROM base WHERE round_no = 1
            ),
            follow_round AS (
                SELECT
                    b.*,
                    LAG(b.actual_at) OVER (PARTITION BY b.student_id ORDER BY b.round_no) AS prev_actual_at
                FROM base b
                WHERE b.round_no >= 2
            )
        `;

        if (groupByStaff) {
            const byStaffSql = `
                WITH student_base AS (
                    SELECT
                        s.id AS student_id,
                        s.staff_id,
                        COALESCE(u.name, '未割当') AS staff_name,
                        s.meeting_decided_date
                    FROM students s
                    LEFT JOIN users u ON u.id = s.staff_id
                    ${whereClause}
                ),
                first_executed AS (
                    SELECT DISTINCT sch.student_id
                    FROM interview_schedules sch
                    WHERE sch.round_no = 1
                      AND sch.status = 'completed'
                      AND sch.actual_at IS NOT NULL
                )
                SELECT
                    sb.staff_id,
                    sb.staff_name,
                    COUNT(*) FILTER (WHERE sb.meeting_decided_date IS NOT NULL)::int AS settings_count,
                    COUNT(*) FILTER (WHERE sb.meeting_decided_date IS NOT NULL AND fe.student_id IS NOT NULL)::int AS first_interview_executed_count,
                    ROUND(
                        (
                            COUNT(*) FILTER (WHERE sb.meeting_decided_date IS NOT NULL AND fe.student_id IS NOT NULL)::numeric
                            / NULLIF(COUNT(*) FILTER (WHERE sb.meeting_decided_date IS NOT NULL), 0)
                        ) * 100,
                        2
                    ) AS first_interview_execution_rate
                FROM student_base sb
                LEFT JOIN first_executed fe ON fe.student_id = sb.student_id
                GROUP BY sb.staff_id, sb.staff_name
                ORDER BY sb.staff_name ASC
            `;
            const byStaff = await pool.query(byStaffSql, params);
            res.json(byStaff.rows);
            return;
        }

        if (groupBySource) {
            const groupedSql = `
                ${commonCte}
                , first_agg AS (
                    SELECT
                        source_company,
                        ROUND(AVG(EXTRACT(EPOCH FROM (actual_at - inflow_at)) / 86400.0)::numeric, 2) AS first_lead_time_days_avg,
                        COUNT(*) AS first_total,
                        COUNT(*) FILTER (WHERE reschedule_count > 0) AS first_rescheduled,
                        ROUND((COUNT(*) FILTER (WHERE reschedule_count > 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS first_reschedule_rate
                    FROM first_round
                    GROUP BY source_company
                ),
                follow_agg AS (
                    SELECT
                        source_company,
                        ROUND(AVG(EXTRACT(EPOCH FROM (actual_at - prev_actual_at)) / 86400.0)::numeric, 2) AS followup_lead_time_days_avg,
                        COUNT(*) AS followup_total,
                        COUNT(*) FILTER (WHERE reschedule_count > 0) AS followup_rescheduled,
                        ROUND((COUNT(*) FILTER (WHERE reschedule_count > 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS followup_reschedule_rate
                    FROM follow_round
                    GROUP BY source_company
                ),
                student_agg AS (
                    SELECT
                        COALESCE(s.source_company, '未設定') AS source_company,
                        COUNT(*) FILTER (WHERE s.meeting_decided_date IS NOT NULL)::int AS settings_count,
                        COUNT(*) FILTER (WHERE s.first_interview_date IS NOT NULL)::int AS first_interviews_count,
                        COUNT(*) FILTER (WHERE s.second_interview_date IS NOT NULL)::int AS second_interviews_count,
                        (
                            COUNT(*) FILTER (WHERE s.first_interview_date IS NOT NULL)
                            + COUNT(*) FILTER (WHERE s.second_interview_date IS NOT NULL)
                        )::int AS interviews_count,
                        ROUND(
                            AVG((s.first_interview_date::date - s.meeting_decided_date::date)::numeric)
                            FILTER (WHERE s.meeting_decided_date IS NOT NULL AND s.first_interview_date IS NOT NULL),
                            2
                        ) AS setting_to_first_interview_lead_time_days_avg,
                        COUNT(*) FILTER (
                            WHERE s.meeting_decided_date IS NOT NULL
                              AND EXISTS (
                                  SELECT 1
                                  FROM interview_schedules sch
                                  WHERE sch.student_id = s.id
                                    AND sch.round_no = 1
                                    AND sch.status = 'completed'
                                    AND sch.actual_at IS NOT NULL
                              )
                        )::int AS first_interview_executed_count
                    FROM students s
                    ${whereClause}
                    GROUP BY COALESCE(s.source_company, '未設定')
                )
                SELECT
                    src.source_company,
                    fa.first_lead_time_days_avg,
                    COALESCE(fa.first_total, 0) AS first_total,
                    COALESCE(fa.first_rescheduled, 0) AS first_rescheduled,
                    fa.first_reschedule_rate,
                    fwa.followup_lead_time_days_avg,
                    COALESCE(fwa.followup_total, 0) AS followup_total,
                    COALESCE(fwa.followup_rescheduled, 0) AS followup_rescheduled,
                    fwa.followup_reschedule_rate,
                    COALESCE(sa.settings_count, 0) AS settings_count,
                    COALESCE(sa.first_interviews_count, 0) AS first_interviews_count,
                    COALESCE(sa.second_interviews_count, 0) AS second_interviews_count,
                    COALESCE(sa.interviews_count, 0) AS interviews_count,
                    sa.setting_to_first_interview_lead_time_days_avg,
                    COALESCE(sa.first_interview_executed_count, 0) AS first_interview_executed_count,
                    ROUND(
                        (
                            COALESCE(sa.first_interview_executed_count, 0)::numeric
                            / NULLIF(COALESCE(sa.settings_count, 0), 0)
                        ) * 100,
                        2
                    ) AS first_interview_execution_rate
                FROM (
                    SELECT DISTINCT source_company FROM base
                    UNION
                    SELECT source_company FROM student_agg
                ) src
                LEFT JOIN first_agg fa ON fa.source_company = src.source_company
                LEFT JOIN follow_agg fwa ON fwa.source_company = src.source_company
                LEFT JOIN student_agg sa ON sa.source_company = src.source_company
                ORDER BY src.source_company ASC
            `;
            const grouped = await pool.query(groupedSql, params);
            res.json(grouped.rows);
            return;
        }

        const sql = `
            ${commonCte}
            , first_agg AS (
                SELECT
                    ROUND(AVG(EXTRACT(EPOCH FROM (actual_at - inflow_at)) / 86400.0)::numeric, 2) AS first_lead_time_days_avg,
                    COUNT(*) AS first_total,
                    COUNT(*) FILTER (WHERE reschedule_count > 0) AS first_rescheduled,
                    ROUND((COUNT(*) FILTER (WHERE reschedule_count > 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS first_reschedule_rate
                FROM first_round
            ),
            follow_agg AS (
                SELECT
                    ROUND(AVG(EXTRACT(EPOCH FROM (actual_at - prev_actual_at)) / 86400.0)::numeric, 2) AS followup_lead_time_days_avg,
                    COUNT(*) AS followup_total,
                    COUNT(*) FILTER (WHERE reschedule_count > 0) AS followup_rescheduled,
                    ROUND((COUNT(*) FILTER (WHERE reschedule_count > 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS followup_reschedule_rate
                FROM follow_round
            )
            SELECT
                fa.first_lead_time_days_avg,
                COALESCE(fa.first_total, 0) AS first_total,
                COALESCE(fa.first_rescheduled, 0) AS first_rescheduled,
                fa.first_reschedule_rate,
                fwa.followup_lead_time_days_avg,
                COALESCE(fwa.followup_total, 0) AS followup_total,
                COALESCE(fwa.followup_rescheduled, 0) AS followup_rescheduled,
                fwa.followup_reschedule_rate
            FROM first_agg fa
            CROSS JOIN follow_agg fwa
        `;

        const result = await pool.query(sql, params);
        const settingsByDateRes = await pool.query(
            `
                SELECT
                    s.meeting_decided_date::date AS setting_date,
                    COALESCE(s.source_company, '未設定') AS source_company,
                    COUNT(*)::int AS setting_count
                FROM students s
                ${whereClause ? `${whereClause} AND s.meeting_decided_date IS NOT NULL` : 'WHERE s.meeting_decided_date IS NOT NULL'}
                GROUP BY s.meeting_decided_date::date, COALESCE(s.source_company, '未設定')
                ORDER BY s.meeting_decided_date::date DESC, source_company ASC
            `,
            params
        );
        const interviewsByDateRes = await pool.query(
            `
                SELECT
                    s.first_interview_date::date AS interview_date,
                    COALESCE(s.source_company, '未設定') AS source_company,
                    'first'::text AS interview_round,
                    COUNT(*)::int AS interview_count
                FROM students s
                ${whereClause ? `${whereClause} AND s.first_interview_date IS NOT NULL` : 'WHERE s.first_interview_date IS NOT NULL'}
                GROUP BY s.first_interview_date::date, COALESCE(s.source_company, '未設定')
                UNION ALL
                SELECT
                    s.second_interview_date::date AS interview_date,
                    COALESCE(s.source_company, '未設定') AS source_company,
                    'second'::text AS interview_round,
                    COUNT(*)::int AS interview_count
                FROM students s
                ${whereClause ? `${whereClause} AND s.second_interview_date IS NOT NULL` : 'WHERE s.second_interview_date IS NOT NULL'}
                GROUP BY s.second_interview_date::date, COALESCE(s.source_company, '未設定')
                ORDER BY interview_date DESC, source_company ASC
            `,
            params
        );
        const summaryRes = await pool.query(
            `
                SELECT
                    COUNT(*) FILTER (WHERE s.meeting_decided_date IS NOT NULL)::int AS settings_count,
                    COUNT(*) FILTER (WHERE s.first_interview_date IS NOT NULL)::int AS first_interviews_count,
                    COUNT(*) FILTER (WHERE s.second_interview_date IS NOT NULL)::int AS second_interviews_count,
                    (
                        COUNT(*) FILTER (WHERE s.first_interview_date IS NOT NULL)
                        + COUNT(*) FILTER (WHERE s.second_interview_date IS NOT NULL)
                    )::int AS interviews_count,
                    ROUND(
                        AVG((s.first_interview_date::date - s.meeting_decided_date::date)::numeric)
                        FILTER (WHERE s.meeting_decided_date IS NOT NULL AND s.first_interview_date IS NOT NULL),
                        2
                    ) AS setting_to_first_interview_lead_time_days_avg,
                    COUNT(*) FILTER (
                        WHERE s.meeting_decided_date IS NOT NULL
                          AND EXISTS (
                              SELECT 1
                              FROM interview_schedules sch
                              WHERE sch.student_id = s.id
                                AND sch.round_no = 1
                                AND sch.status = 'completed'
                                AND sch.actual_at IS NOT NULL
                          )
                    )::int AS first_interview_executed_count
                FROM students s
                ${whereClause}
            `,
            params
        );
        const summary = summaryRes.rows[0] || {
            settings_count: 0,
            first_interviews_count: 0,
            second_interviews_count: 0,
            interviews_count: 0,
            setting_to_first_interview_lead_time_days_avg: null,
            first_interview_executed_count: 0
        };
        const settingsCount = Number(summary.settings_count || 0);
        const executedCount = Number(summary.first_interview_executed_count || 0);
        res.json({
            ...(result.rows[0] || {}),
            settings_by_date: settingsByDateRes.rows,
            interviews_by_date: interviewsByDateRes.rows,
            account_summary: {
                ...summary,
                first_interview_execution_rate: settingsCount > 0
                    ? Number(((executedCount / settingsCount) * 100).toFixed(2))
                    : null
            }
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
        next_action,
        meeting_decided_date,
        first_interview_date,
        second_interview_date
    } = req.body;
    try {
        await ensureStudentExtendedColumns();
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
        pushSet('meeting_decided_date', meeting_decided_date || null);
        pushSet('first_interview_date', first_interview_date || null);
        pushSet('second_interview_date', second_interview_date || null);
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
    try {
        const cols = await getStudentColumns();
        const setParts: string[] = [];
        const values: any[] = [];

        const appendSet = (column: string, value: any) => {
            if (!cols.has(column)) return;
            values.push(value);
            setParts.push(`${column} = $${values.length}`);
        };

        if (Object.prototype.hasOwnProperty.call(req.body, 'referral_status')) {
            const v = req.body.referral_status;
            appendSet('referral_status', v === null || v === '' ? null : normalizeReferralStatus(v));
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'progress_stage')) {
            const v = req.body.progress_stage;
            appendSet('progress_stage', v === null || v === '' ? null : normalizeProgressStage(v));
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'source_company')) {
            appendSet('source_company', normalizeNullableText(req.body.source_company));
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'next_meeting_date')) {
            appendSet('next_meeting_date', normalizeNullableText(req.body.next_meeting_date));
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'next_action')) {
            appendSet('next_action', normalizeNullableText(req.body.next_action));
        }

        if (setParts.length === 0) {
            res.status(400).json({ error: 'No updatable fields provided' });
            return;
        }

        if (cols.has('updated_at')) {
            setParts.push('updated_at = CURRENT_TIMESTAMP');
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE students
             SET ${setParts.join(', ')}
             WHERE id = $${values.length}
             RETURNING *`,
            values
        );
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'source_company')) {
            await ensureSourceCategoryFromStudent(req.body.source_company);
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
        await ensureStudentTaskColumns();
        const result = await pool.query(
            'INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3) RETURNING *',
            [id, due_date || null, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const completeStudentTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    try {
        await ensureStudentTaskColumns();
        const result = await pool.query(
            'UPDATE student_tasks SET completed = TRUE WHERE id = $1 RETURNING id',
            [taskId]
        );
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        res.json({ success: true });
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

export const getFunnelMasterData = async (_req: Request, res: Response) => {
    try {
        await ensureSalesFunnelTables();
        const [eventsRes, reasonsRes] = await Promise.all([
            pool.query('SELECT id, title AS event_name, event_date, company FROM events ORDER BY event_date DESC NULLS LAST, id DESC'),
            pool.query('SELECT id, reason_name FROM lost_reasons ORDER BY id ASC')
        ]);
        res.json({
            events: eventsRes.rows,
            lost_reasons: reasonsRes.rows
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createApplication = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        source,
        applied_at,
        first_message_sent_at,
        reservation_status,
        reservation_date,
        reservation_created_at
    } = req.body || {};
    try {
        await ensureSalesFunnelTables();
        const studentRes = await pool.query('SELECT id, name, source_company FROM students WHERE id = $1', [id]);
        if (studentRes.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        const st = studentRes.rows[0];
        const result = await pool.query(
            `INSERT INTO applications (
                student_id, student_name, source, applied_at, first_message_sent_at,
                reservation_status, reservation_date, reservation_created_at
            ) VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP), $5, $6, $7, $8)
            RETURNING *`,
            [
                st.id,
                st.name,
                normalizeNullableText(source) || st.source_company || null,
                normalizeNullableText(applied_at),
                normalizeNullableText(first_message_sent_at),
                normalizeNullableText(reservation_status),
                normalizeNullableText(reservation_date),
                normalizeNullableText(reservation_created_at)
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const updateApplicationReservation = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reservation_status, reservation_date, reservation_created_at, first_message_sent_at } = req.body || {};
    try {
        await ensureSalesFunnelTables();
        const appRes = await pool.query(
            'SELECT * FROM applications WHERE student_id = $1 ORDER BY applied_at DESC NULLS LAST, id DESC LIMIT 1',
            [id]
        );
        if (appRes.rows.length === 0) {
            res.status(404).json({ error: 'Application not found for student' });
            return;
        }
        const app = appRes.rows[0];
        const result = await pool.query(
            `UPDATE applications
             SET reservation_status = $1,
                 reservation_date = $2,
                 reservation_created_at = $3,
                 first_message_sent_at = COALESCE($4, first_message_sent_at)
             WHERE id = $5
             RETURNING *`,
            [
                normalizeNullableText(reservation_status),
                normalizeNullableText(reservation_date),
                normalizeNullableText(reservation_created_at),
                normalizeNullableText(first_message_sent_at),
                app.id
            ]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createInterviewRecord = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { scheduled_at, interviewed_at, status } = req.body || {};
    try {
        await ensureSalesFunnelTables();
        const result = await pool.query(
            `INSERT INTO interviews (student_id, scheduled_at, interviewed_at, status)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                id,
                normalizeNullableText(scheduled_at),
                normalizeNullableText(interviewed_at),
                normalizeNullableText(status) || 'completed'
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createEventProposal = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { event_id, proposed_at, status, lost_reason_id, memo } = req.body || {};
    if (!event_id) {
        res.status(400).json({ error: 'event_id is required' });
        return;
    }
    try {
        await ensureSalesFunnelTables();
        const result = await pool.query(
            `INSERT INTO event_proposals (student_id, event_id, proposed_at, status, lost_reason_id, memo)
             VALUES ($1, $2, COALESCE($3, CURRENT_TIMESTAMP), $4, $5, $6)
             RETURNING *`,
            [
                id,
                Number(event_id),
                normalizeNullableText(proposed_at),
                normalizeNullableText(status) || 'proposed',
                lost_reason_id ? Number(lost_reason_id) : null,
                normalizeNullableText(memo)
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getFunnelKpi = async (_req: Request, res: Response) => {
    try {
        await ensureSalesFunnelTables();
        const [dailyRes, summaryRes, lostRes] = await Promise.all([
            pool.query(`
                SELECT DATE(applied_at) AS day, COUNT(*)::int AS count
                FROM applications
                GROUP BY DATE(applied_at)
                ORDER BY day DESC
                LIMIT 31
            `),
            pool.query(`
                WITH app_s AS (
                    SELECT COUNT(DISTINCT student_id)::int AS cnt
                    FROM applications
                    WHERE student_id IS NOT NULL
                ),
                reserve_s AS (
                    SELECT COUNT(DISTINCT student_id)::int AS cnt
                    FROM applications
                    WHERE student_id IS NOT NULL
                      AND (
                        COALESCE(reservation_status, '') IN ('reserved', '予約済み', '予約')
                        OR reservation_created_at IS NOT NULL
                      )
                ),
                interview_s AS (
                    SELECT COUNT(DISTINCT student_id)::int AS cnt
                    FROM interviews
                    WHERE student_id IS NOT NULL
                      AND (COALESCE(status, '') IN ('completed', '面談実施', 'interviewed') OR interviewed_at IS NOT NULL)
                ),
                proposal_s AS (
                    SELECT COUNT(DISTINCT student_id)::int AS cnt
                    FROM event_proposals
                ),
                join_s AS (
                    SELECT COUNT(DISTINCT student_id)::int AS cnt
                    FROM event_proposals
                    WHERE COALESCE(status, '') IN ('joined', '参加', '参加確定', 'accepted')
                )
                SELECT
                    app_s.cnt AS applications_students,
                    reserve_s.cnt AS reserved_students,
                    interview_s.cnt AS interviewed_students,
                    proposal_s.cnt AS proposed_students,
                    join_s.cnt AS joined_students
                FROM app_s, reserve_s, interview_s, proposal_s, join_s
            `),
            pool.query(`
                SELECT COALESCE(lr.reason_name, '未設定') AS reason_name, COUNT(*)::int AS count
                FROM event_proposals ep
                LEFT JOIN lost_reasons lr ON lr.id = ep.lost_reason_id
                WHERE ep.lost_reason_id IS NOT NULL
                GROUP BY COALESCE(lr.reason_name, '未設定')
                ORDER BY count DESC, reason_name ASC
                LIMIT 10
            `)
        ]);
        const s = summaryRes.rows[0] || {};
        const applicationsStudents = Number(s.applications_students || 0);
        const reservedStudents = Number(s.reserved_students || 0);
        const interviewedStudents = Number(s.interviewed_students || 0);
        const proposedStudents = Number(s.proposed_students || 0);
        const joinedStudents = Number(s.joined_students || 0);
        const rate = (a: number, b: number) => (b > 0 ? Number(((a / b) * 100).toFixed(2)) : 0);
        res.json({
            daily_applications: dailyRes.rows,
            application_to_reservation_rate: rate(reservedStudents, applicationsStudents),
            reservation_to_interview_rate: rate(interviewedStudents, reservedStudents),
            interview_to_proposal_rate: rate(proposedStudents, interviewedStudents),
            proposal_to_join_rate: rate(joinedStudents, proposedStudents),
            lost_reason_ranking: lostRes.rows,
            counts: {
                applications_students: applicationsStudents,
                reserved_students: reservedStudents,
                interviewed_students: interviewedStudents,
                proposed_students: proposedStudents,
                joined_students: joinedStudents
            }
        });
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
    const headerLikeValues = new Set(['氏名', '流入経路', '初回平均(日)', 'source_company', 'name']);

    let client: PoolClient | null = null;
    try {
        await ensureStudentExtendedColumns();
        client = await pool.connect();
        await client.query('BEGIN');
        const cols = await getStudentColumns();
        for (const s of students) {
            const name = s.name || '';
            const university = s.university || '';
            const prefecture = s.prefecture || '';
            const dedupeKey = `${name}__${university}__${prefecture}`;
            if (!name || headerLikeValues.has(String(name).trim())) {
                skipped++;
                continue;
            }
            if (headerLikeValues.has(String(s.source_company || '').trim())) {
                s.source_company = null;
            }
            if (seen.has(dedupeKey)) {
                skipped++;
                continue;
            }
            seen.add(dedupeKey);

            const existsRes = await client.query(
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
            pushSet('meeting_decided_date', s.meeting_decided_date || null);
            pushSet('first_interview_date', s.first_interview_date || null);
            pushSet('second_interview_date', s.second_interview_date || null);
            if (cols.has('updated_at')) updateParts.push('updated_at = CURRENT_TIMESTAMP');

            if (existsRes.rows.length > 0) {
                const id = existsRes.rows[0].id;
                if (updateParts.length > 0) {
                    values.push(id);
                    await client.query(
                        `UPDATE students SET ${updateParts.join(', ')} WHERE id = $${values.length}`,
                        values
                    );
                }
                await ensureSourceCategoryFromStudent(s.source_company, client);

                if (s.task_due_date) {
                    const lastTask = await client.query(
                        'SELECT id FROM student_tasks WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1',
                        [id]
                    );
                    if (lastTask.rows.length > 0) {
                        await client.query(
                            'UPDATE student_tasks SET due_date = $1 WHERE id = $2',
                            [s.task_due_date, lastTask.rows[0].id]
                        );
                    } else {
                        await client.query(
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
            pushInsert('meeting_decided_date', s.meeting_decided_date || null);
            pushInsert('first_interview_date', s.first_interview_date || null);
            pushInsert('second_interview_date', s.second_interview_date || null);

            const placeholders = insertCols.map((_: any, idx: number) => `$${idx + 1}`).join(', ');
            const insertedRes = await client.query(
                `INSERT INTO students (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
                insertVals
            );
            await ensureSourceCategoryFromStudent(s.source_company, client);

            if (s.task_due_date && insertedRes.rows[0]?.id) {
                await client.query(
                    'INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3)',
                    [insertedRes.rows[0].id, s.task_due_date, 'CSV更新タスク']
                );
            }
            inserted++;
        }

        await client.query('COMMIT');
        res.json({ inserted, updated, skipped });
    } catch (err: any) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch {
                // ignore rollback failure
            }
        }
        res.status(500).json({ inserted: 0, updated: 0, skipped: 0, error: err.message });
    } finally {
        client?.release();
    }
};

export const getSourceCategories = async (_req: Request, res: Response) => {
    try {
        await ensureSourceCategoriesTable();
        const result = await pool.query('SELECT id, name, created_at FROM source_categories ORDER BY name ASC');
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createSourceCategory = async (req: Request, res: Response) => {
    const authUser = (req as any).user as { role?: string } | undefined;
    if (authUser?.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const name = String(req.body?.name || '').trim();
    if (!name) {
        res.status(400).json({ error: 'name is required' });
        return;
    }
    try {
        await ensureSourceCategoriesTable();
        const result = await pool.query(
            'INSERT INTO source_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id, name, created_at',
            [name]
        );
        if (result.rows.length === 0) {
            const existing = await pool.query('SELECT id, name, created_at FROM source_categories WHERE name = $1', [name]);
            res.json(existing.rows[0]);
            return;
        }
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteSourceCategory = async (req: Request, res: Response) => {
    const authUser = (req as any).user as { role?: string } | undefined;
    if (authUser?.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const { id } = req.params;
    try {
        await ensureSourceCategoriesTable();
        const result = await pool.query('DELETE FROM source_categories WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Category not found' });
            return;
        }
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
