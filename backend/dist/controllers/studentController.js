"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSourceCategory = exports.createSourceCategory = exports.getSourceCategories = exports.importStudents = exports.deleteStudent = exports.deleteStudentTask = exports.addStudentTask = exports.updateStudentMeta = exports.updateStudentStaff = exports.updateStudentBasic = exports.updateStudentStatus = exports.deleteInterviewLog = exports.addInterviewLog = exports.linkEvent = exports.getInterviewMetrics = exports.deleteInterviewSchedule = exports.updateInterviewSchedule = exports.createInterviewSchedule = exports.getStudentDetail = exports.createStudent = exports.getStudents = void 0;
const db_1 = __importDefault(require("../config/db"));
let interviewScheduleTableReady = false;
let interviewScheduleTablePromise = null;
let cachedStudentColumns = null;
let studentExtendedColumnsReady = false;
let studentExtendedColumnsPromise = null;
let sourceCategoriesTableReady = false;
let sourceCategoriesTablePromise = null;
const ensureInterviewScheduleTables = () => __awaiter(void 0, void 0, void 0, function* () {
    if (interviewScheduleTableReady)
        return;
    if (!interviewScheduleTablePromise) {
        interviewScheduleTablePromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            yield db_1.default.query(`
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
            yield db_1.default.query(`
                ALTER TABLE interview_schedules
                ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(50) DEFAULT '面談'
            `);
            interviewScheduleTableReady = true;
        }))().finally(() => {
            interviewScheduleTablePromise = null;
        });
    }
    yield interviewScheduleTablePromise;
});
const ensureStudentExtendedColumns = () => __awaiter(void 0, void 0, void 0, function* () {
    if (studentExtendedColumnsReady)
        return;
    if (!studentExtendedColumnsPromise) {
        studentExtendedColumnsPromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            yield db_1.default.query(`
                ALTER TABLE students
                ADD COLUMN IF NOT EXISTS meeting_decided_date DATE
            `);
            yield db_1.default.query(`
                ALTER TABLE students
                ADD COLUMN IF NOT EXISTS first_interview_date DATE
            `);
            cachedStudentColumns = null;
            studentExtendedColumnsReady = true;
        }))().finally(() => {
            studentExtendedColumnsPromise = null;
        });
    }
    yield studentExtendedColumnsPromise;
});
const ensureSourceCategoriesTable = () => __awaiter(void 0, void 0, void 0, function* () {
    if (sourceCategoriesTableReady)
        return;
    if (!sourceCategoriesTablePromise) {
        sourceCategoriesTablePromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            yield db_1.default.query(`
                CREATE TABLE IF NOT EXISTS source_categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            sourceCategoriesTableReady = true;
        }))().finally(() => {
            sourceCategoriesTablePromise = null;
        });
    }
    yield sourceCategoriesTablePromise;
});
const getStudentColumns = () => __awaiter(void 0, void 0, void 0, function* () {
    if (cachedStudentColumns)
        return cachedStudentColumns;
    const result = yield db_1.default.query(`SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'students'`);
    cachedStudentColumns = new Set(result.rows.map((r) => r.column_name));
    return cachedStudentColumns;
});
const normalizeGraduationYear = (value) => {
    if (value === null || value === undefined)
        return null;
    const raw = String(value).trim();
    if (!raw)
        return null;
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
const normalizeProgressStage = (value) => {
    const raw = String(value !== null && value !== void 0 ? value : '').trim();
    if (!raw)
        return '面談調整中';
    if (raw === '調整中(初回)' || raw === '調整中')
        return '面談調整中';
    if (raw.includes('初回'))
        return '初回面談';
    if (raw.includes('2回'))
        return '2回目面談';
    if (raw.includes('顧客'))
        return '顧客化';
    if (raw.includes('トビ'))
        return 'トビ';
    return '面談調整中';
};
const normalizeReferralStatus = (value) => {
    const raw = String(value !== null && value !== void 0 ? value : '').trim();
    if (!raw)
        return '不明';
    if (raw.includes('キーマン'))
        return 'キーマン';
    if (raw.includes('出そう'))
        return '出そう';
    if (raw.includes('ワンチャン') || raw.includes('ほぼ無理'))
        return 'ほぼ無理ワンチャン';
    if (raw === '無理')
        return '無理';
    if (raw.includes('不明'))
        return '不明';
    return '不明';
};
const normalizeAcademicTrack = (value) => {
    const raw = String(value !== null && value !== void 0 ? value : '').trim();
    if (!raw)
        return null;
    if (raw.includes('文'))
        return '文系';
    if (raw.includes('理'))
        return '理系';
    return raw;
};
const oneDayBefore = (dateText) => {
    if (!dateText)
        return null;
    const d = new Date(dateText);
    if (Number.isNaN(d.getTime()))
        return null;
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
};
const getStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const staffId = req.query.staffId;
    const authUser = req.user;
    try {
        yield ensureStudentExtendedColumns();
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
        const params = [];
        // staff users can only see their own students regardless of query param
        if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) !== 'admin' && (authUser === null || authUser === void 0 ? void 0 : authUser.sub)) {
            query += ' WHERE students.staff_id = $1';
            params.push(Number(authUser.sub));
        }
        else if (staffId) {
            query += ' WHERE staff_id = $1';
            params.push(staffId);
        }
        const result = yield db_1.default.query(query, params);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getStudents = getStudents;
const createStudent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, university, prefecture, academic_track, faculty, referral_status, progress_stage, next_meeting_date, next_action, desired_industry, desired_role, graduation_year, email, phone, status, tags, staff_id, source_company, interview_reason, meeting_decided_date, first_interview_date } = req.body;
    try {
        yield ensureStudentExtendedColumns();
        const duplicateRes = yield db_1.default.query('SELECT id FROM students WHERE name = $1 AND COALESCE(university, \'\') = COALESCE($2, \'\') AND COALESCE(faculty, \'\') = COALESCE($3, \'\') LIMIT 1', [name, university || null, faculty || null]);
        if (duplicateRes.rows.length > 0) {
            res.status(409).json({ error: 'Student already exists' });
            return;
        }
        const cols = yield getStudentColumns();
        const insertCols = [];
        const insertVals = [];
        const pushCol = (col, val) => {
            if (!cols.has(col))
                return;
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
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        const result = yield db_1.default.query(`INSERT INTO students (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`, insertVals);
        const created = result.rows[0];
        const preContactDate = oneDayBefore(first_interview_date || null);
        if ((created === null || created === void 0 ? void 0 : created.id) && preContactDate) {
            yield db_1.default.query('INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3)', [created.id, preContactDate, '事前連絡']);
        }
        res.json(created);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createStudent = createStudent;
const getStudentDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield ensureStudentExtendedColumns();
        yield ensureInterviewScheduleTables();
        const studentRes = yield db_1.default.query('SELECT * FROM students WHERE id = $1', [id]);
        const eventsRes = yield db_1.default.query(`
            SELECT e.*, se.status as participation_status, se.created_at as participation_created_at
            FROM events e
            JOIN student_events se ON e.id = se.event_id
            WHERE se.student_id = $1
            ORDER BY se.created_at DESC
        `, [id]);
        const logsRes = yield db_1.default.query(`
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
        const tasksRes = yield db_1.default.query('SELECT * FROM student_tasks WHERE student_id = $1 ORDER BY due_date NULLS LAST, created_at DESC', [id]);
        const schedulesRes = yield db_1.default.query('SELECT * FROM interview_schedules WHERE student_id = $1 ORDER BY round_no ASC', [id]);
        res.json({
            student: studentRes.rows[0],
            events: eventsRes.rows,
            logs: logsRes.rows,
            tasks: tasksRes.rows,
            schedules: schedulesRes.rows
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getStudentDetail = getStudentDetail;
const createInterviewSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { round_no, scheduled_at, status, schedule_type } = req.body;
    try {
        yield ensureInterviewScheduleTables();
        const round = round_no
            ? Number(round_no)
            : Number(((_a = (yield db_1.default.query('SELECT COALESCE(MAX(round_no), 0) + 1 AS next_round FROM interview_schedules WHERE student_id = $1', [id])).rows[0]) === null || _a === void 0 ? void 0 : _a.next_round) || 1);
        const safeType = ['流入日', '面談', 'リスケ'].includes(schedule_type) ? schedule_type : '面談';
        const safeStatus = ['scheduled', 'completed', 'rescheduled', 'canceled'].includes(status)
            ? status
            : (safeType === 'リスケ' ? 'rescheduled' : safeType === '流入日' ? 'completed' : 'scheduled');
        const result = yield db_1.default.query(`INSERT INTO interview_schedules (student_id, round_no, scheduled_at, status, schedule_type)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id, round_no)
             DO UPDATE SET
                scheduled_at = EXCLUDED.scheduled_at,
                status = EXCLUDED.status,
                schedule_type = EXCLUDED.schedule_type,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`, [id, round, scheduled_at || null, safeStatus, safeType]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createInterviewSchedule = createInterviewSchedule;
const updateInterviewSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { scheduleId } = req.params;
    const { scheduled_at, actual_at, status, schedule_type } = req.body;
    try {
        yield ensureInterviewScheduleTables();
        const currentRes = yield db_1.default.query('SELECT * FROM interview_schedules WHERE id = $1', [scheduleId]);
        if (currentRes.rows.length === 0) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        const current = currentRes.rows[0];
        const scheduledChanged = (current.scheduled_at ? new Date(current.scheduled_at).toISOString() : null)
            !== (scheduled_at ? new Date(scheduled_at).toISOString() : null);
        const safeType = ['流入日', '面談', 'リスケ'].includes(schedule_type) ? schedule_type : (current.schedule_type || '面談');
        const typeChangedToReschedule = safeType === 'リスケ' && current.schedule_type !== 'リスケ';
        const nextRescheduleCount = (scheduledChanged || typeChangedToReschedule)
            ? Number(current.reschedule_count || 0) + 1
            : Number(current.reschedule_count || 0);
        let safeStatus = status || current.status;
        if (!['scheduled', 'completed', 'rescheduled', 'canceled'].includes(safeStatus))
            safeStatus = current.status;
        if (safeType === 'リスケ')
            safeStatus = 'rescheduled';
        if (scheduledChanged && safeStatus === 'scheduled')
            safeStatus = 'rescheduled';
        const result = yield db_1.default.query(`UPDATE interview_schedules
             SET scheduled_at = COALESCE($1, scheduled_at),
                 actual_at = COALESCE($2, actual_at),
                 status = $3,
                 reschedule_count = $4,
                 schedule_type = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`, [scheduled_at || null, actual_at || null, safeStatus, nextRescheduleCount, safeType, scheduleId]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateInterviewSchedule = updateInterviewSchedule;
const deleteInterviewSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { scheduleId } = req.params;
    try {
        yield ensureInterviewScheduleTables();
        const result = yield db_1.default.query('DELETE FROM interview_schedules WHERE id = $1 RETURNING id', [scheduleId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.deleteInterviewSchedule = deleteInterviewSchedule;
const getInterviewMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authUser = req.user;
    const sourceCompany = String(req.query.source_company || '').trim();
    const groupBySource = String(req.query.group_by_source || '') === '1';
    try {
        yield ensureStudentExtendedColumns();
        yield ensureInterviewScheduleTables();
        const conditions = [];
        const params = [];
        if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) !== 'admin') {
            params.push(Number((authUser === null || authUser === void 0 ? void 0 : authUser.sub) || 0));
            conditions.push(`s.staff_id = $${params.length}`);
        }
        if (sourceCompany) {
            params.push(sourceCompany);
            conditions.push(`COALESCE(s.source_company, '') = $${params.length}`);
        }
        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const settingConditions = ['s.meeting_decided_date IS NOT NULL'];
        const settingParams = [];
        if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) !== 'admin') {
            settingParams.push(Number((authUser === null || authUser === void 0 ? void 0 : authUser.sub) || 0));
            settingConditions.push(`s.staff_id = $${settingParams.length}`);
        }
        if (sourceCompany) {
            settingParams.push(sourceCompany);
            settingConditions.push(`COALESCE(s.source_company, '') = $${settingParams.length}`);
        }
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
                    fwa.followup_reschedule_rate
                FROM (SELECT DISTINCT source_company FROM base) src
                LEFT JOIN first_agg fa ON fa.source_company = src.source_company
                LEFT JOIN follow_agg fwa ON fwa.source_company = src.source_company
                ORDER BY src.source_company ASC
            `;
            const grouped = yield db_1.default.query(groupedSql, params);
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
        const result = yield db_1.default.query(sql, params);
        const settingsByDateRes = yield db_1.default.query(`
                SELECT
                    s.meeting_decided_date::date AS setting_date,
                    COALESCE(s.source_company, '未設定') AS source_company,
                    COUNT(*)::int AS setting_count
                FROM students s
                WHERE ${settingConditions.join(' AND ')}
                GROUP BY s.meeting_decided_date::date, COALESCE(s.source_company, '未設定')
                ORDER BY s.meeting_decided_date::date DESC, source_company ASC
            `, settingParams);
        res.json(Object.assign(Object.assign({}, (result.rows[0] || {})), { settings_by_date: settingsByDateRes.rows }));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getInterviewMetrics = getInterviewMetrics;
const linkEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { event_id, status } = req.body;
    try {
        const safeStatus = ['A_ENTRY', 'B_WAITING', 'C_WAITING', 'XA_CANCEL'].includes(status) ? status : 'A_ENTRY';
        yield db_1.default.query(`INSERT INTO student_events (student_id, event_id, status)
             VALUES ($1, $2, $3)
             ON CONFLICT (student_id, event_id) DO UPDATE SET status = EXCLUDED.status`, [id, event_id, safeStatus]);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.linkEvent = linkEvent;
const addInterviewLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { student_id, staff_id, log_type, event_id, content, interview_date } = req.body;
    try {
        const result = yield db_1.default.query('INSERT INTO interview_logs (student_id, staff_id, log_type, event_id, content, interview_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [student_id, staff_id, log_type || '面談', event_id || null, content, interview_date]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.addInterviewLog = addInterviewLog;
const deleteInterviewLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const result = yield db_1.default.query('DELETE FROM interview_logs WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Log not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.deleteInterviewLog = deleteInterviewLog;
const updateStudentStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = yield db_1.default.query('UPDATE students SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [status, id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateStudentStatus = updateStudentStatus;
const updateStudentBasic = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, university, prefecture, academic_track, faculty, email, phone, graduation_year, source_company, interview_reason, desired_industry, desired_role, next_meeting_date, next_action, meeting_decided_date, first_interview_date } = req.body;
    try {
        yield ensureStudentExtendedColumns();
        const cols = yield getStudentColumns();
        const setParts = [];
        const values = [];
        const pushSet = (col, val) => {
            if (!cols.has(col))
                return;
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
        if (cols.has('updated_at')) {
            setParts.push('updated_at = CURRENT_TIMESTAMP');
        }
        values.push(id);
        const result = yield db_1.default.query(`UPDATE students SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateStudentBasic = updateStudentBasic;
const updateStudentStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { staff_id } = req.body;
    try {
        const result = yield db_1.default.query('UPDATE students SET staff_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [staff_id || null, id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateStudentStaff = updateStudentStaff;
const updateStudentMeta = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { referral_status, progress_stage, source_company, next_meeting_date, next_action } = req.body;
    try {
        const result = yield db_1.default.query(`UPDATE students
             SET referral_status = COALESCE($1, referral_status),
                 progress_stage = COALESCE($2, progress_stage),
                 source_company = COALESCE($3, source_company),
                 next_meeting_date = COALESCE($4, next_meeting_date),
                 next_action = COALESCE($5, next_action),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`, [referral_status, progress_stage, source_company, next_meeting_date, next_action, id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateStudentMeta = updateStudentMeta;
const addStudentTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { due_date, content } = req.body;
    if (!content || !String(content).trim()) {
        res.status(400).json({ error: 'Task content is required' });
        return;
    }
    try {
        const result = yield db_1.default.query('INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3) RETURNING *', [id, due_date || null, content]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.addStudentTask = addStudentTask;
const deleteStudentTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { taskId } = req.params;
    try {
        const result = yield db_1.default.query('DELETE FROM student_tasks WHERE id = $1 RETURNING id', [taskId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.deleteStudentTask = deleteStudentTask;
const deleteStudent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const result = yield db_1.default.query('DELETE FROM students WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.deleteStudent = deleteStudent;
const importStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { students } = req.body;
    if (!Array.isArray(students)) {
        res.status(400).json({ error: 'Invalid payload' });
        return;
    }
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const seen = new Set();
    const headerLikeValues = new Set(['氏名', '流入経路', '初回平均(日)', 'source_company', 'name']);
    try {
        yield ensureStudentExtendedColumns();
        const cols = yield getStudentColumns();
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
            const existsRes = yield db_1.default.query(cols.has('prefecture')
                ? 'SELECT id FROM students WHERE name = $1 AND COALESCE(university, \'\') = COALESCE($2, \'\') AND COALESCE(prefecture, \'\') = COALESCE($3, \'\') LIMIT 1'
                : 'SELECT id FROM students WHERE name = $1 AND COALESCE(university, \'\') = COALESCE($2, \'\') LIMIT 1', cols.has('prefecture')
                ? [name, university || null, prefecture || null]
                : [name, university || null]);
            const updateParts = [];
            const values = [];
            const pushSet = (col, val) => {
                if (!cols.has(col))
                    return;
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
            if (cols.has('updated_at'))
                updateParts.push('updated_at = CURRENT_TIMESTAMP');
            if (existsRes.rows.length > 0) {
                const id = existsRes.rows[0].id;
                if (updateParts.length > 0) {
                    values.push(id);
                    yield db_1.default.query(`UPDATE students SET ${updateParts.join(', ')} WHERE id = $${values.length}`, values);
                }
                if (s.task_due_date) {
                    const lastTask = yield db_1.default.query('SELECT id FROM student_tasks WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);
                    if (lastTask.rows.length > 0) {
                        yield db_1.default.query('UPDATE student_tasks SET due_date = $1 WHERE id = $2', [s.task_due_date, lastTask.rows[0].id]);
                    }
                    else {
                        yield db_1.default.query('INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3)', [id, s.task_due_date, 'CSV更新タスク']);
                    }
                }
                updated++;
                continue;
            }
            const insertCols = [];
            const insertVals = [];
            const pushInsert = (col, val) => {
                if (!cols.has(col))
                    return;
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
            const placeholders = insertCols.map((_, idx) => `$${idx + 1}`).join(', ');
            const insertedRes = yield db_1.default.query(`INSERT INTO students (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id`, insertVals);
            if (s.task_due_date && ((_a = insertedRes.rows[0]) === null || _a === void 0 ? void 0 : _a.id)) {
                yield db_1.default.query('INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3)', [insertedRes.rows[0].id, s.task_due_date, 'CSV更新タスク']);
            }
            inserted++;
        }
        res.json({ inserted, updated, skipped });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.importStudents = importStudents;
const getSourceCategories = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ensureSourceCategoriesTable();
        yield db_1.default.query(`
            INSERT INTO source_categories (name)
            SELECT DISTINCT TRIM(COALESCE(source_company, '')) AS name
            FROM students
            WHERE TRIM(COALESCE(source_company, '')) <> ''
              AND TRIM(COALESCE(source_company, '')) NOT IN ('流入経路', 'source_company', '氏名', '初回平均(日)')
            ON CONFLICT (name) DO NOTHING
        `);
        const result = yield db_1.default.query('SELECT id, name, created_at FROM source_categories ORDER BY name ASC');
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getSourceCategories = getSourceCategories;
const createSourceCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const authUser = req.user;
    if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const name = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.name) || '').trim();
    if (!name) {
        res.status(400).json({ error: 'name is required' });
        return;
    }
    try {
        yield ensureSourceCategoriesTable();
        const result = yield db_1.default.query('INSERT INTO source_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id, name, created_at', [name]);
        if (result.rows.length === 0) {
            const existing = yield db_1.default.query('SELECT id, name, created_at FROM source_categories WHERE name = $1', [name]);
            res.json(existing.rows[0]);
            return;
        }
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createSourceCategory = createSourceCategory;
const deleteSourceCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authUser = req.user;
    if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const { id } = req.params;
    try {
        yield ensureSourceCategoriesTable();
        const result = yield db_1.default.query('DELETE FROM source_categories WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Category not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.deleteSourceCategory = deleteSourceCategory;
