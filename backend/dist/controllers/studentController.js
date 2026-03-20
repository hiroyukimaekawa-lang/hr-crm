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
exports.deleteGraduationYearCategory = exports.createGraduationYearCategory = exports.getGraduationYearCategories = exports.deleteSourceCategory = exports.createSourceCategory = exports.getSourceCategories = exports.importStudents = exports.getFunnelKpi = exports.getStudentEventProposals = exports.createEventProposal = exports.createInterviewRecord = exports.updateApplicationReservation = exports.createApplication = exports.getFunnelMasterData = exports.getMatcherFunnelKpi = exports.registerMatcherInterview = exports.registerMatcherReservation = exports.registerMatcherMessage = exports.registerMatcherApply = exports.getMatcherFunnelByStudent = exports.deleteStudent = exports.deleteStudentTask = exports.completeStudentTask = exports.addStudentTask = exports.updateStudentMeta = exports.updateStudentStaff = exports.updateStudentBasic = exports.updateStudentStatus = exports.updateInterviewLog = exports.deleteInterviewLog = exports.addInterviewLog = exports.linkEvent = exports.getInterviewMetrics = exports.deleteInterviewSchedule = exports.updateInterviewSchedule = exports.createInterviewSchedule = exports.getStudentDetail = exports.createStudent = exports.getStudents = exports.normalizeToHour = void 0;
const db_1 = __importDefault(require("../config/db"));
let interviewScheduleTableReady = false;
let interviewScheduleTablePromise = null;
let cachedStudentColumns = null;
let studentExtendedColumnsReady = false;
let studentExtendedColumnsPromise = null;
let sourceCategoriesTableReady = false;
let sourceCategoriesTablePromise = null;
let graduationYearCategoriesTableReady = false;
let graduationYearCategoriesTablePromise = null;
let studentTaskColumnsReady = false;
let studentTaskColumnsPromise = null;
let salesFunnelTablesReady = false;
let salesFunnelTablesPromise = null;
let matcherFunnelTableReady = false;
let matcherFunnelTablePromise = null;
let studentEventsColumnsReady = false;
let studentEventsColumnsPromise = null;
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
            yield db_1.default.query(`
                ALTER TABLE students
                ADD COLUMN IF NOT EXISTS second_interview_date DATE
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
const ensureGraduationYearCategoriesTable = () => __awaiter(void 0, void 0, void 0, function* () {
    if (graduationYearCategoriesTableReady)
        return;
    if (!graduationYearCategoriesTablePromise) {
        graduationYearCategoriesTablePromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            yield db_1.default.query(`
                CREATE TABLE IF NOT EXISTS graduation_year_categories (
                    id SERIAL PRIMARY KEY,
                    year INTEGER UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            graduationYearCategoriesTableReady = true;
        }))().finally(() => {
            graduationYearCategoriesTablePromise = null;
        });
    }
    yield graduationYearCategoriesTablePromise;
});
const ensureStudentTaskColumns = () => __awaiter(void 0, void 0, void 0, function* () {
    if (studentTaskColumnsReady)
        return;
    if (!studentTaskColumnsPromise) {
        studentTaskColumnsPromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            yield db_1.default.query(`
                CREATE TABLE IF NOT EXISTS student_tasks (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                    due_date DATE,
                    content TEXT NOT NULL DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            yield db_1.default.query(`
                ALTER TABLE student_tasks
                ADD COLUMN IF NOT EXISTS due_date DATE
            `);
            yield db_1.default.query(`
                ALTER TABLE student_tasks
                ADD COLUMN IF NOT EXISTS content TEXT DEFAULT ''
            `);
            yield db_1.default.query(`
                ALTER TABLE student_tasks
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            `);
            yield db_1.default.query(`
                ALTER TABLE student_tasks
                ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE
            `);
            studentTaskColumnsReady = true;
        }))().finally(() => {
            studentTaskColumnsPromise = null;
        });
    }
    yield studentTaskColumnsPromise;
});
const ensureSalesFunnelTables = () => __awaiter(void 0, void 0, void 0, function* () {
    if (salesFunnelTablesReady)
        return;
    if (!salesFunnelTablesPromise) {
        salesFunnelTablesPromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            yield db_1.default.query(`
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
            yield db_1.default.query(`
                CREATE TABLE IF NOT EXISTS interviews (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                    scheduled_at TIMESTAMP,
                    interviewed_at TIMESTAMP,
                    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);
            yield db_1.default.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS company VARCHAR(255)
            `);
            yield db_1.default.query(`
                CREATE TABLE IF NOT EXISTS event_dates (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    event_date TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            yield db_1.default.query(`
                CREATE TABLE IF NOT EXISTS lost_reasons (
                    id SERIAL PRIMARY KEY,
                    reason_name VARCHAR(255) UNIQUE NOT NULL
                )
            `);
            yield db_1.default.query(`
                CREATE TABLE IF NOT EXISTS event_proposals (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    proposed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(50) NOT NULL DEFAULT 'proposed',
                    lost_reason_id INTEGER REFERENCES lost_reasons(id) ON DELETE SET NULL,
                    selected_event_date TIMESTAMP,
                    memo TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);
            yield db_1.default.query(`
                ALTER TABLE event_proposals
                ADD COLUMN IF NOT EXISTS selected_event_date TIMESTAMP
            `);
            yield db_1.default.query(`
                ALTER TABLE event_proposals
                ADD COLUMN IF NOT EXISTS reason TEXT
            `);
            yield db_1.default.query(`
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
        }))().finally(() => {
            salesFunnelTablesPromise = null;
        });
    }
    yield salesFunnelTablesPromise;
});
const ensureMatcherFunnelTable = () => __awaiter(void 0, void 0, void 0, function* () {
    if (matcherFunnelTableReady)
        return;
    if (!matcherFunnelTablePromise) {
        matcherFunnelTablePromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            yield db_1.default.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
            yield db_1.default.query(`
                CREATE TABLE IF NOT EXISTS matcher_funnel_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    student_id INTEGER UNIQUE REFERENCES students(id) ON DELETE CASCADE,
                    applied_at TIMESTAMP,
                    message_sent_at TIMESTAMP,
                    reservation_created_at TIMESTAMP,
                    interview_scheduled_at TIMESTAMP,
                    interview_actual_at TIMESTAMP,
                    reservation_status TEXT,
                    interview_status TEXT,
                    created_at TIMESTAMP DEFAULT now()
                )
            `);
            matcherFunnelTableReady = true;
        }))().finally(() => {
            matcherFunnelTablePromise = null;
        });
    }
    yield matcherFunnelTablePromise;
});
const ensureStudentEventsColumns = () => __awaiter(void 0, void 0, void 0, function* () {
    if (studentEventsColumnsReady)
        return;
    if (!studentEventsColumnsPromise) {
        studentEventsColumnsPromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            // Ensure selected_event_date column exists
            yield db_1.default.query(`
                ALTER TABLE student_events
                ADD COLUMN IF NOT EXISTS selected_event_date TIMESTAMP
            `);
            // Ensure surrogate primary key for student_events to allow multiple rows
            // per (student_id, event_id) with different selected_event_date
            yield db_1.default.query(`
                ALTER TABLE student_events
                ADD COLUMN IF NOT EXISTS id SERIAL
            `);
            // Drop legacy primary key on (student_id, event_id) if it exists
            yield db_1.default.query(`
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
            yield db_1.default.query(`
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
            yield db_1.default.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_student_events_unique_triplet
                ON student_events(student_id, event_id, selected_event_date)
            `);
            studentEventsColumnsReady = true;
        }))().finally(() => {
            studentEventsColumnsPromise = null;
        });
    }
    yield studentEventsColumnsPromise;
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
const normalizeToHour = (value) => {
    const raw = normalizeNullableText(value);
    if (!raw)
        return null;
    // 日付のみ (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return `${raw} 00:00:00`;
    }
    // YYYY-MM-DDTHH:mm または YYYY-MM-DD HH:mm 形式（フロントのdatetime-local）
    // → JSTとしてそのまま保存（UTCに変換しない）
    const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):?(\d{2})?/);
    if (directMatch) {
        const datePart = directMatch[1];
        const hourPart = directMatch[2];
        const minutePart = directMatch[3] || '00';
        return `${datePart} ${hourPart}:${minutePart}:00`;
    }
    // ISO文字列（末尾にZまたはタイムゾーンあり）→ JSTに変換
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()))
        return null;
    // JSTオフセット(+9時間)を適用
    const jstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = jstDate.getUTCFullYear();
    const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstDate.getUTCDate()).padStart(2, '0');
    const hh = String(jstDate.getUTCHours()).padStart(2, '0');
    const min = String(jstDate.getUTCMinutes()).padStart(2, '0');
    const sec = String(jstDate.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
};
exports.normalizeToHour = normalizeToHour;
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
const normalizeNullableText = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    const text = String(value).trim();
    return text ? text : null;
};
const ensureSourceCategoryFromStudent = (sourceCompany_1, ...args_1) => __awaiter(void 0, [sourceCompany_1, ...args_1], void 0, function* (sourceCompany, queryable = db_1.default) {
    const normalized = normalizeNullableText(sourceCompany);
    if (!normalized)
        return;
    if (['流入経路', 'source_company', '氏名', '初回平均(日)'].includes(normalized))
        return;
    yield ensureSourceCategoriesTable();
    yield queryable.query('INSERT INTO source_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [normalized]);
});
const ensureGraduationYearCategoryFromStudent = (graduationYear_1, ...args_1) => __awaiter(void 0, [graduationYear_1, ...args_1], void 0, function* (graduationYear, queryable = db_1.default) {
    if (graduationYear === undefined || graduationYear === null || graduationYear === '')
        return;
    const year = Number(graduationYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
        return;
    yield ensureGraduationYearCategoriesTable();
    yield queryable.query('INSERT INTO graduation_year_categories (year) VALUES ($1) ON CONFLICT (year) DO NOTHING', [year]);
});
const getStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const staffId = req.query.staffId;
    const authUser = req.user;
    try {
        yield ensureStudentExtendedColumns();
        yield ensureStudentTaskColumns();
        yield ensureMatcherFunnelTable();
        let query = `
            SELECT
                students.*,
                users.name as staff_name,
                st.content as latest_task_content,
                st.due_date as latest_task_due_date,
                mf.applied_at as matcher_applied_at,
                mf.reservation_created_at as matcher_reservation_created_at,
                mf.interview_scheduled_at as matcher_interview_scheduled_at,
                mf.interview_actual_at as matcher_interview_actual_at
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
            LEFT JOIN LATERAL (
                SELECT applied_at, reservation_created_at, interview_scheduled_at, interview_actual_at
                FROM matcher_funnel_logs
                WHERE student_id = students.id
                ORDER BY created_at DESC
                LIMIT 1
            ) mf ON true
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
    var _a;
    const { name, university, prefecture, academic_track, faculty, referral_status, progress_stage, next_meeting_date, next_action, desired_industry, desired_role, graduation_year, email, phone, status, tags, staff_id, source_company, interview_reason, applied_at, meeting_decided_date, first_interview_date, second_interview_date } = req.body;
    try {
        yield ensureStudentExtendedColumns();
        yield ensureMatcherFunnelTable();
        yield ensureSalesFunnelTables();
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
        const normalizedGraduationYear = normalizeGraduationYear(graduation_year);
        pushCol('graduation_year', normalizedGraduationYear);
        pushCol('email', email || null);
        pushCol('phone', phone || null);
        pushCol('status', status || 'active');
        pushCol('tags', tags || null);
        pushCol('staff_id', staff_id || null);
        pushCol('source_company', source_company || null);
        pushCol('interview_reason', interview_reason || null);
        const normalizedMeetingDecidedDate = (0, exports.normalizeToHour)(meeting_decided_date);
        const normalizedFirstInterviewDate = (0, exports.normalizeToHour)(first_interview_date);
        pushCol('meeting_decided_date', normalizedMeetingDecidedDate);
        pushCol('first_interview_date', normalizedFirstInterviewDate);
        pushCol('second_interview_date', second_interview_date || null);
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        const normalizedSourceCompany = normalizeNullableText(source_company);
        const result = yield db_1.default.query(`INSERT INTO students (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`, insertVals);
        const created = result.rows[0];
        yield ensureSourceCategoryFromStudent(normalizedSourceCompany);
        yield ensureGraduationYearCategoryFromStudent(normalizedGraduationYear);
        yield db_1.default.query(`INSERT INTO matcher_funnel_logs (student_id, applied_at, reservation_status, reservation_created_at, interview_scheduled_at)
             VALUES ($1, COALESCE($2, CURRENT_TIMESTAMP), $3, $4, $5)
             ON CONFLICT (student_id)
             DO UPDATE SET
               applied_at = COALESCE(EXCLUDED.applied_at, matcher_funnel_logs.applied_at),
               reservation_status = COALESCE(EXCLUDED.reservation_status, matcher_funnel_logs.reservation_status),
               reservation_created_at = COALESCE(EXCLUDED.reservation_created_at, matcher_funnel_logs.reservation_created_at),
               interview_scheduled_at = COALESCE(EXCLUDED.interview_scheduled_at, matcher_funnel_logs.interview_scheduled_at)`, [
            created.id,
            (0, exports.normalizeToHour)((_a = req.body) === null || _a === void 0 ? void 0 : _a.applied_at),
            'pending',
            normalizedMeetingDecidedDate,
            normalizedFirstInterviewDate
        ]);
        yield db_1.default.query(`INSERT INTO applications (
                student_id, student_name, source, applied_at, reservation_status, reservation_date
            ) VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP), $5, $6)`, [
            created.id,
            created.name,
            normalizedSourceCompany,
            (0, exports.normalizeToHour)(applied_at) || normalizedMeetingDecidedDate || null,
            '初回面談',
            normalizedMeetingDecidedDate
        ]);
        const preContactDate = oneDayBefore(normalizedFirstInterviewDate || null);
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
        yield ensureStudentTaskColumns();
        yield ensureMatcherFunnelTable();
        yield ensureStudentEventsColumns();
        const studentRes = yield db_1.default.query('SELECT * FROM students WHERE id = $1', [id]);
        const eventsRes = yield db_1.default.query(`
            SELECT
                e.id,
                e.title,
                e.description,
                e.location,
                e.event_slots,
                e.capacity,
                e.target_seats,
                e.unit_price,
                e.target_sales,
                e.current_sales,
                e.kpi_seat_to_entry_rate,
                e.kpi_entry_to_interview_rate,
                e.kpi_interview_to_inflow_rate,
                e.kpi_custom_steps,
                e.yomi_statuses,
                e.entry_deadline,
                e.lp_url,
                to_char(e.event_date, 'YYYY-MM-DD"T"HH24:MI:SS') as event_date,
                COALESCE(eds.event_dates, '[]'::json) as event_dates,
                se.id as student_event_id,
                se.status as participation_status,
                se.created_at as participation_created_at,
                to_char(se.selected_event_date, 'YYYY-MM-DD"T"HH24:MI:SS') as selected_event_date
            FROM events e
            JOIN student_events se ON e.id = se.event_id
            LEFT JOIN LATERAL (
                SELECT json_agg(to_char(ed.event_date, 'YYYY-MM-DD"T"HH24:MI:SS') ORDER BY ed.event_date ASC) as event_dates
                FROM event_dates ed
                WHERE ed.event_id = e.id
            ) eds ON true
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
        const tasksRes = yield db_1.default.query('SELECT * FROM student_tasks WHERE student_id = $1 AND COALESCE(completed, FALSE) = FALSE ORDER BY due_date NULLS LAST, created_at DESC', [id]);
        const schedulesRes = yield db_1.default.query('SELECT * FROM interview_schedules WHERE student_id = $1 ORDER BY round_no ASC', [id]);
        const matcherRes = yield db_1.default.query(`SELECT *
             FROM matcher_funnel_logs
             WHERE student_id = $1
             ORDER BY created_at DESC
             LIMIT 1`, [id]);
        res.json({
            student: studentRes.rows[0],
            events: eventsRes.rows,
            logs: logsRes.rows,
            tasks: tasksRes.rows,
            schedules: schedulesRes.rows,
            matcher_funnel: matcherRes.rows[0] || null
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
        const scheduledChanged = current.scheduled_at !== null &&
            (current.scheduled_at ? new Date(current.scheduled_at).toISOString() : null) !==
                (scheduled_at ? new Date(scheduled_at).toISOString() : null);
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
    const groupByStaff = String(req.query.group_by_staff || '') === '1';
    try {
        yield ensureStudentExtendedColumns();
        yield ensureInterviewScheduleTables();
        const conditions = [];
        const params = [];
        const pushAuthFilters = (alias) => {
            if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) !== 'admin') {
                params.push(Number((authUser === null || authUser === void 0 ? void 0 : authUser.sub) || 0));
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
            const byStaff = yield db_1.default.query(byStaffSql, params);
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
                ${whereClause ? `${whereClause} AND s.meeting_decided_date IS NOT NULL` : 'WHERE s.meeting_decided_date IS NOT NULL'}
                GROUP BY s.meeting_decided_date::date, COALESCE(s.source_company, '未設定')
                ORDER BY s.meeting_decided_date::date DESC, source_company ASC
            `, params);
        const interviewsByDateRes = yield db_1.default.query(`
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
            `, params);
        const summaryRes = yield db_1.default.query(`
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
            `, params);
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
        res.json(Object.assign(Object.assign({}, (result.rows[0] || {})), { settings_by_date: settingsByDateRes.rows, interviews_by_date: interviewsByDateRes.rows, account_summary: Object.assign(Object.assign({}, summary), { first_interview_execution_rate: settingsCount > 0
                    ? Number(((executedCount / settingsCount) * 100).toFixed(2))
                    : null }) }));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getInterviewMetrics = getInterviewMetrics;
const linkEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { event_id, status, selected_event_date } = req.body;
    try {
        yield ensureStudentEventsColumns();
        const safeStatus = ['A_ENTRY', 'B_WAITING', 'C_WAITING', 'D_PASS', 'E_FAIL', 'XA_CANCEL'].includes(status) ? status : 'A_ENTRY';
        yield db_1.default.query(`INSERT INTO student_events (student_id, event_id, status, selected_event_date)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (student_id, event_id, selected_event_date)
             DO UPDATE SET
                status = EXCLUDED.status`, [id, event_id, safeStatus, (0, exports.normalizeToHour)(selected_event_date)]);
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
const updateInterviewLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { content } = req.body;
    try {
        const result = yield db_1.default.query('UPDATE interview_logs SET content = $1, created_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [content, id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Log not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateInterviewLog = updateInterviewLog;
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
    const { name, university, prefecture, academic_track, faculty, email, phone, graduation_year, source_company, interview_reason, desired_industry, desired_role, next_meeting_date, next_action, meeting_decided_date, first_interview_date, second_interview_date } = req.body;
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
        const normalizedGraduationYear = normalizeGraduationYear(graduation_year);
        pushSet('graduation_year', normalizedGraduationYear);
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
        const result = yield db_1.default.query(`UPDATE students SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        yield ensureSourceCategoryFromStudent(source_company);
        yield ensureGraduationYearCategoryFromStudent(normalizedGraduationYear);
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
    try {
        const cols = yield getStudentColumns();
        const setParts = [];
        const values = [];
        const appendSet = (column, value) => {
            if (!cols.has(column))
                return;
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
        const result = yield db_1.default.query(`UPDATE students
             SET ${setParts.join(', ')}
             WHERE id = $${values.length}
             RETURNING *`, values);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'source_company')) {
            yield ensureSourceCategoryFromStudent(req.body.source_company);
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
        yield ensureStudentTaskColumns();
        const result = yield db_1.default.query('INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3) RETURNING *', [id, due_date || null, content]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.addStudentTask = addStudentTask;
const completeStudentTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { taskId } = req.params;
    try {
        yield ensureStudentTaskColumns();
        const result = yield db_1.default.query('UPDATE student_tasks SET completed = TRUE WHERE id = $1 RETURNING id', [taskId]);
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
exports.completeStudentTask = completeStudentTask;
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
const upsertMatcherFunnelByStudentId = (studentId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield ensureMatcherFunnelTable();
    const studentRes = yield db_1.default.query('SELECT id FROM students WHERE id = $1', [studentId]);
    if (studentRes.rows.length === 0) {
        return null;
    }
    const columns = Object.keys(payload);
    if (columns.length === 0) {
        const exists = yield db_1.default.query('SELECT * FROM matcher_funnel_logs WHERE student_id = $1 LIMIT 1', [studentId]);
        return exists.rows[0] || null;
    }
    const insertCols = ['student_id', ...columns];
    const insertVals = [studentId, ...columns.map((c) => payload[c])];
    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
    const updateSet = columns.map((c) => `${c} = COALESCE(EXCLUDED.${c}, matcher_funnel_logs.${c})`).join(', ');
    const result = yield db_1.default.query(`INSERT INTO matcher_funnel_logs (${insertCols.join(', ')})
         VALUES (${placeholders})
         ON CONFLICT (student_id) DO UPDATE SET ${updateSet}
         RETURNING *`, insertVals);
    return result.rows[0];
});
const getMatcherFunnelByStudent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield ensureMatcherFunnelTable();
        const result = yield db_1.default.query('SELECT * FROM matcher_funnel_logs WHERE student_id = $1 LIMIT 1', [id]);
        res.json(result.rows[0] || null);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getMatcherFunnelByStudent = getMatcherFunnelByStudent;
const registerMatcherApply = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { applied_at } = req.body || {};
    try {
        const row = yield upsertMatcherFunnelByStudentId(String(id), {
            applied_at: (0, exports.normalizeToHour)(applied_at) || (0, exports.normalizeToHour)(new Date().toISOString())
        });
        if (!row) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        res.json(row);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.registerMatcherApply = registerMatcherApply;
const registerMatcherMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { message_sent_at } = req.body || {};
    try {
        const row = yield upsertMatcherFunnelByStudentId(String(id), {
            message_sent_at: (0, exports.normalizeToHour)(message_sent_at) || (0, exports.normalizeToHour)(new Date().toISOString())
        });
        if (!row) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        res.json(row);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.registerMatcherMessage = registerMatcherMessage;
const registerMatcherReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { reservation_created_at, reservation_status, interview_scheduled_at } = req.body || {};
    try {
        const normalizedReservationCreatedAt = (0, exports.normalizeToHour)(reservation_created_at) || (0, exports.normalizeToHour)(new Date().toISOString());
        const normalizedInterviewScheduledAt = (0, exports.normalizeToHour)(interview_scheduled_at);
        const row = yield upsertMatcherFunnelByStudentId(String(id), {
            reservation_created_at: normalizedReservationCreatedAt,
            reservation_status: normalizeNullableText(reservation_status) || 'reserved',
            interview_scheduled_at: normalizedInterviewScheduledAt
        });
        if (!row) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        yield db_1.default.query(`UPDATE students
             SET meeting_decided_date = COALESCE($1, meeting_decided_date),
                 first_interview_date = COALESCE($2, first_interview_date),
                 next_meeting_date = COALESCE($2, next_meeting_date, $1)
             WHERE id = $3`, [normalizedReservationCreatedAt, normalizedInterviewScheduledAt, id]);
        res.json(row);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.registerMatcherReservation = registerMatcherReservation;
const registerMatcherInterview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { interview_actual_at, interview_status, interview_scheduled_at } = req.body || {};
    try {
        const normalizedInterviewActualAt = (0, exports.normalizeToHour)(interview_actual_at);
        const normalizedInterviewScheduledAt = (0, exports.normalizeToHour)(interview_scheduled_at);
        const row = yield upsertMatcherFunnelByStudentId(String(id), {
            interview_actual_at: normalizedInterviewActualAt,
            interview_status: normalizeNullableText(interview_status) || 'completed',
            interview_scheduled_at: normalizedInterviewScheduledAt
        });
        if (!row) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        yield db_1.default.query(`UPDATE students
             SET first_interview_date = COALESCE($1, first_interview_date),
                 next_meeting_date = CASE
                    WHEN COALESCE($2, '') = 'completed' THEN NULL
                    ELSE COALESCE($1, next_meeting_date)
                 END
             WHERE id = $3`, [normalizedInterviewScheduledAt, normalizeNullableText(interview_status), id]);
        res.json(row);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.registerMatcherInterview = registerMatcherInterview;
const getMatcherFunnelKpi = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ensureMatcherFunnelTable();
        const result = yield db_1.default.query(`
            WITH base AS (
                SELECT * FROM matcher_funnel_logs
            )
            SELECT
                COUNT(*) FILTER (WHERE applied_at IS NOT NULL)::int AS applications,
                COUNT(*) FILTER (WHERE message_sent_at IS NOT NULL)::int AS "messagesSent",
                COUNT(*) FILTER (WHERE reservation_created_at IS NOT NULL)::int AS reservations,
                COUNT(*) FILTER (WHERE interview_actual_at IS NOT NULL AND COALESCE(interview_status, '') = 'completed')::int AS "interviewsCompleted",
                ROUND(
                    (COUNT(*) FILTER (WHERE message_sent_at IS NOT NULL)::numeric / NULLIF(COUNT(*) FILTER (WHERE applied_at IS NOT NULL), 0)) * 100, 2
                ) AS "applicationToMessageRate",
                ROUND(
                    (COUNT(*) FILTER (WHERE reservation_created_at IS NOT NULL)::numeric / NULLIF(COUNT(*) FILTER (WHERE applied_at IS NOT NULL), 0)) * 100, 2
                ) AS "applicationToReservationRate",
                ROUND(
                    (COUNT(*) FILTER (WHERE interview_actual_at IS NOT NULL)::numeric / NULLIF(COUNT(*) FILTER (WHERE reservation_created_at IS NOT NULL), 0)) * 100, 2
                ) AS "reservationToInterviewRate",
                ROUND(AVG(EXTRACT(EPOCH FROM (reservation_created_at - applied_at)) / 86400.0)
                    FILTER (WHERE reservation_created_at IS NOT NULL AND applied_at IS NOT NULL), 2) AS "leadTimeApplyToReservation",
                ROUND(AVG(EXTRACT(EPOCH FROM (interview_actual_at - reservation_created_at)) / 86400.0)
                    FILTER (WHERE interview_actual_at IS NOT NULL AND reservation_created_at IS NOT NULL), 2) AS "leadTimeReservationToInterview",
                ROUND(
                    (COUNT(*) FILTER (WHERE interview_status = 'no_show')::numeric / NULLIF(COUNT(*) FILTER (WHERE reservation_created_at IS NOT NULL), 0)) * 100, 2
                ) AS "noShowRate",
                ROUND(
                    (COUNT(*) FILTER (WHERE interview_status = 'rescheduled')::numeric / NULLIF(COUNT(*) FILTER (WHERE reservation_created_at IS NOT NULL), 0)) * 100, 2
                ) AS "rescheduleRate"
            FROM base
        `);
        res.json(result.rows[0] || {
            applications: 0,
            messagesSent: 0,
            reservations: 0,
            interviewsCompleted: 0,
            applicationToMessageRate: 0,
            applicationToReservationRate: 0,
            reservationToInterviewRate: 0,
            leadTimeApplyToReservation: 0,
            leadTimeReservationToInterview: 0,
            noShowRate: 0,
            rescheduleRate: 0
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getMatcherFunnelKpi = getMatcherFunnelKpi;
const getFunnelMasterData = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ensureSalesFunnelTables();
        const [eventsRes, reasonsRes] = yield Promise.all([
            db_1.default.query(`
                SELECT
                    e.id,
                    e.title AS event_name,
                    e.event_date,
                    e.company,
                    COALESCE(
                        json_agg(ed.event_date ORDER BY ed.event_date ASC) FILTER (WHERE ed.event_date IS NOT NULL),
                        '[]'::json
                    ) AS event_dates
                FROM events e
                LEFT JOIN event_dates ed ON ed.event_id = e.id
                GROUP BY e.id
                ORDER BY e.event_date DESC NULLS LAST, e.id DESC
            `),
            db_1.default.query('SELECT id, reason_name FROM lost_reasons ORDER BY id ASC')
        ]);
        res.json({
            events: eventsRes.rows,
            lost_reasons: reasonsRes.rows
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getFunnelMasterData = getFunnelMasterData;
const createApplication = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { source, applied_at, first_message_sent_at, reservation_status, reservation_date, reservation_created_at } = req.body || {};
    try {
        yield ensureSalesFunnelTables();
        const studentRes = yield db_1.default.query('SELECT id, name, source_company FROM students WHERE id = $1', [id]);
        if (studentRes.rows.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        const st = studentRes.rows[0];
        const result = yield db_1.default.query(`INSERT INTO applications (
                student_id, student_name, source, applied_at, first_message_sent_at,
                reservation_status, reservation_date, reservation_created_at
            ) VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP), $5, $6, $7, $8)
            RETURNING *`, [
            st.id,
            st.name,
            normalizeNullableText(source) || st.source_company || null,
            (0, exports.normalizeToHour)(applied_at),
            normalizeNullableText(first_message_sent_at),
            normalizeNullableText(reservation_status),
            (0, exports.normalizeToHour)(reservation_date),
            (0, exports.normalizeToHour)(reservation_created_at)
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createApplication = createApplication;
const updateApplicationReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { reservation_status, reservation_date, reservation_created_at, first_message_sent_at } = req.body || {};
    try {
        yield ensureSalesFunnelTables();
        const normalizedReservationDate = (0, exports.normalizeToHour)(reservation_date);
        const normalizedReservationCreatedAt = (0, exports.normalizeToHour)(reservation_created_at);
        const normalizedFirstMessageSentAt = (0, exports.normalizeToHour)(first_message_sent_at);
        const appRes = yield db_1.default.query('SELECT * FROM applications WHERE student_id = $1 ORDER BY applied_at DESC NULLS LAST, id DESC LIMIT 1', [id]);
        if (appRes.rows.length === 0) {
            const studentRes = yield db_1.default.query('SELECT id, name, source_company, created_at FROM students WHERE id = $1 LIMIT 1', [id]);
            if (studentRes.rows.length === 0) {
                res.status(404).json({ error: 'Student not found' });
                return;
            }
            const st = studentRes.rows[0];
            const inserted = yield db_1.default.query(`INSERT INTO applications (
                    student_id, student_name, source, applied_at,
                    reservation_status, reservation_date, reservation_created_at, first_message_sent_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *`, [
                st.id,
                st.name,
                normalizeNullableText(st.source_company),
                normalizedReservationCreatedAt || normalizedReservationDate || st.created_at || new Date().toISOString(),
                normalizeNullableText(reservation_status),
                normalizedReservationDate,
                normalizedReservationCreatedAt,
                normalizedFirstMessageSentAt
            ]);
            yield db_1.default.query(`UPDATE students
                 SET meeting_decided_date = COALESCE($1, meeting_decided_date),
                     next_meeting_date = COALESCE(next_meeting_date, $1)
                 WHERE id = $2`, [normalizedReservationCreatedAt || normalizedReservationDate, id]);
            res.json(inserted.rows[0]);
            return;
        }
        const app = appRes.rows[0];
        const result = yield db_1.default.query(`UPDATE applications
             SET reservation_status = $1,
                 reservation_date = $2,
                 reservation_created_at = $3,
                 first_message_sent_at = COALESCE($4, first_message_sent_at)
             WHERE id = $5
             RETURNING *`, [
            normalizeNullableText(reservation_status),
            normalizedReservationDate,
            normalizedReservationCreatedAt,
            normalizedFirstMessageSentAt,
            app.id
        ]);
        yield db_1.default.query(`UPDATE students
             SET meeting_decided_date = COALESCE($1, meeting_decided_date),
                 next_meeting_date = COALESCE(next_meeting_date, $1)
             WHERE id = $2`, [normalizedReservationCreatedAt || normalizedReservationDate, id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateApplicationReservation = updateApplicationReservation;
const createInterviewRecord = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { scheduled_at, interviewed_at, status } = req.body || {};
    try {
        yield ensureSalesFunnelTables();
        const normalizedScheduledAt = (0, exports.normalizeToHour)(scheduled_at);
        const normalizedInterviewedAt = (0, exports.normalizeToHour)(interviewed_at);
        const result = yield db_1.default.query(`INSERT INTO interviews (student_id, scheduled_at, interviewed_at, status)
             VALUES ($1, $2, $3, $4)
             RETURNING *`, [
            id,
            normalizedScheduledAt,
            normalizedInterviewedAt,
            normalizeNullableText(status) || 'completed'
        ]);
        yield db_1.default.query(`UPDATE students
             SET first_interview_date = COALESCE($1, first_interview_date),
                 next_meeting_date = COALESCE($1, next_meeting_date)
             WHERE id = $2`, [normalizedScheduledAt, id]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createInterviewRecord = createInterviewRecord;
const createEventProposal = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { event_id, proposed_at, status, lost_reason_id, selected_event_date, memo, reason } = req.body || {};
    if (!event_id) {
        res.status(400).json({ error: 'event_id is required' });
        return;
    }
    try {
        yield ensureSalesFunnelTables();
        const result = yield db_1.default.query(`INSERT INTO event_proposals (student_id, event_id, proposed_at, status, lost_reason_id, selected_event_date, memo, reason)
             VALUES ($1, $2, COALESCE($3, CURRENT_TIMESTAMP), $4, $5, $6, $7, $8)
             RETURNING *`, [
            id,
            Number(event_id),
            normalizeNullableText(proposed_at),
            normalizeNullableText(status) || 'proposed',
            lost_reason_id ? Number(lost_reason_id) : null,
            (0, exports.normalizeToHour)(selected_event_date),
            normalizeNullableText(memo),
            normalizeNullableText(reason)
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createEventProposal = createEventProposal;
const getStudentEventProposals = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield ensureSalesFunnelTables();
        const result = yield db_1.default.query(`SELECT
                ep.id,
                ep.student_id,
                ep.event_id,
                ep.proposed_at,
                ep.status,
                ep.lost_reason_id,
                ep.selected_event_date,
                ep.memo,
                ep.reason,
                ep.created_at,
                e.title AS event_name,
                e.event_date,
                lr.reason_name AS lost_reason_name
             FROM event_proposals ep
             LEFT JOIN events e ON e.id = ep.event_id
             LEFT JOIN lost_reasons lr ON lr.id = ep.lost_reason_id
             WHERE ep.student_id = $1
             ORDER BY ep.proposed_at DESC, ep.id DESC`, [id]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getStudentEventProposals = getStudentEventProposals;
const getFunnelKpi = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ensureSalesFunnelTables();
        // クエリパラメータ
        const monthParam = String(req.query.month || '').trim(); // YYYY-MM
        const sourceCompany = String(req.query.source_company || '').trim();
        const groupByMonth = String(req.query.group_by_month || '') === '1';
        const groupBySource = String(req.query.group_by_source || '') === '1';
        // フィルタ条件文字列
        const mf = monthParam ? `'${monthParam.replace(/'/g, '')}'` : null;
        const appMonthCond = mf ? `AND TO_CHAR(a.applied_at, 'YYYY-MM') = ${mf}` : '';
        const resMonthCond = mf ? `AND TO_CHAR(a.reservation_created_at, 'YYYY-MM') = ${mf}` : '';
        const intMonthCond = mf ? `AND TO_CHAR(i.scheduled_at, 'YYYY-MM') = ${mf}` : '';
        const dailyAppCond = mf ? `AND TO_CHAR(applied_at, 'YYYY-MM') = ${mf}` : '';
        const dailySetCond = mf ? `AND TO_CHAR(reservation_created_at, 'YYYY-MM') = ${mf}` : '';
        const sourceFilter = sourceCompany ? `AND a.source_company = '${sourceCompany.replace(/'/g, "''")}'` : '';
        // interviews / event_proposals には直接 source_company がないので students と JOIN する必要がある箇所で使う
        const sourceFilterWithStudentJoin = sourceCompany ? `JOIN students s ON s.id = t.student_id WHERE s.source_company = '${sourceCompany.replace(/'/g, "''")}'` : '';
        // 既存のクエリが JOIN students s を持っている場合は `AND s.source_company = ...` を使う
        const sSourceFilter = sourceCompany ? `AND s.source_company = '${sourceCompany.replace(/'/g, "''")}'` : '';
        // ─── group_by_month: 月別集計 ───
        if (groupByMonth) {
            const monthlyRes = yield db_1.default.query(`
                WITH months AS (
                    SELECT TO_CHAR(a.applied_at, 'YYYY-MM') AS month FROM applications a JOIN students s ON s.id = a.student_id WHERE a.applied_at IS NOT NULL ${sSourceFilter}
                    UNION
                    SELECT TO_CHAR(a.reservation_created_at, 'YYYY-MM') FROM applications a JOIN students s ON s.id = a.student_id WHERE a.reservation_created_at IS NOT NULL ${sSourceFilter}
                    UNION
                    SELECT TO_CHAR(i.scheduled_at, 'YYYY-MM') FROM interviews i JOIN students s ON s.id = i.student_id WHERE i.scheduled_at IS NOT NULL ${sSourceFilter}
                ),
                app_bm AS (
                    SELECT TO_CHAR(a.applied_at, 'YYYY-MM') AS month, COUNT(DISTINCT a.student_id)::int AS cnt
                    FROM applications a JOIN students s ON s.id = a.student_id WHERE a.applied_at IS NOT NULL ${sSourceFilter} GROUP BY 1
                ),
                reserve_bm AS (
                    SELECT TO_CHAR(a.reservation_created_at, 'YYYY-MM') AS month, COUNT(DISTINCT a.student_id)::int AS cnt
                    FROM applications a JOIN students s ON s.id = a.student_id WHERE a.reservation_created_at IS NOT NULL ${sSourceFilter} GROUP BY 1
                ),
                interview_bm AS (
                    SELECT TO_CHAR(i.scheduled_at, 'YYYY-MM') AS month, COUNT(DISTINCT i.student_id)::int AS cnt
                    FROM interviews i JOIN students s ON s.id = i.student_id WHERE i.scheduled_at IS NOT NULL ${sSourceFilter} GROUP BY 1
                ),
                first_interview_per_student AS (
                    SELECT DISTINCT ON (i.student_id)
                        i.student_id,
                        i.scheduled_at,
                        i.interviewed_at,
                        i.status
                    FROM interviews i
                    JOIN students s ON s.id = i.student_id
                    WHERE i.student_id IS NOT NULL ${sSourceFilter}
                    ORDER BY i.student_id, COALESCE(i.scheduled_at, i.interviewed_at, i.created_at) ASC, i.id ASC
                ),
                completed_bm AS (
                    SELECT TO_CHAR(scheduled_at, 'YYYY-MM') AS month, COUNT(DISTINCT student_id)::int AS cnt
                    FROM first_interview_per_student
                    WHERE COALESCE(status,'') IN ('completed','面談実施','interviewed') OR interviewed_at IS NOT NULL
                    GROUP BY 1
                ),
                noshow_bm AS (
                    SELECT TO_CHAR(i.scheduled_at, 'YYYY-MM') AS month, COUNT(DISTINCT i.student_id)::int AS cnt
                    FROM interviews i JOIN students s ON s.id = i.student_id WHERE i.scheduled_at IS NOT NULL AND COALESCE(i.status,'') = 'no_show' ${sSourceFilter} GROUP BY 1
                ),
                reschedule_bm AS (
                    SELECT TO_CHAR(i.scheduled_at, 'YYYY-MM') AS month, COUNT(DISTINCT i.student_id)::int AS cnt
                    FROM interviews i JOIN students s ON s.id = i.student_id WHERE i.scheduled_at IS NOT NULL AND COALESCE(i.status,'') = 'rescheduled' ${sSourceFilter} GROUP BY 1
                )
                SELECT
                    m.month,
                    COALESCE(a.cnt, 0) AS applications_students,
                    COALESCE(r.cnt, 0) AS reserved_students,
                    COALESCE(i.cnt, 0) AS interview_scheduled_students,
                    COALESCE(c.cnt, 0) AS interviewed_students,
                    COALESCE(n.cnt, 0) AS no_show_students,
                    COALESCE(rsc.cnt, 0) AS rescheduled_students,
                    ROUND(COALESCE(r.cnt,0)::numeric / NULLIF(COALESCE(a.cnt,0),0) * 100, 2) AS application_to_reservation_rate,
                    ROUND(COALESCE(c.cnt,0)::numeric / NULLIF(COALESCE(r.cnt,0),0) * 100, 2) AS reservation_to_interview_rate,
                    ROUND(COALESCE(n.cnt,0)::numeric / NULLIF(COALESCE(i.cnt,0),0) * 100, 2) AS no_show_rate,
                    ROUND(COALESCE(rsc.cnt,0)::numeric / NULLIF(COALESCE(i.cnt,0),0) * 100, 2) AS reschedule_rate
                FROM (SELECT DISTINCT month FROM months) m
                LEFT JOIN app_bm a ON a.month = m.month
                LEFT JOIN reserve_bm r ON r.month = m.month
                LEFT JOIN interview_bm i ON i.month = m.month
                LEFT JOIN completed_bm c ON c.month = m.month
                LEFT JOIN noshow_bm n ON n.month = m.month
                LEFT JOIN reschedule_bm rsc ON rsc.month = m.month
                ORDER BY m.month DESC
            `);
            res.json(monthlyRes.rows);
            return;
        }
        if (groupBySource) {
            const bySourceRes = yield db_1.default.query(`
                WITH src AS (
                    SELECT DISTINCT COALESCE(NULLIF(TRIM(source_company), ''), '未設定') AS source_company
                    FROM students
                ),
                app_s AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company), ''), '未設定') AS source_company,
                           COUNT(DISTINCT a.student_id)::int AS cnt
                    FROM applications a JOIN students s ON s.id = a.student_id
                    WHERE a.student_id IS NOT NULL ${appMonthCond} GROUP BY 1
                ),
                reserve_s AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company), ''), '未設定') AS source_company,
                           COUNT(DISTINCT a.student_id)::int AS cnt
                    FROM applications a JOIN students s ON s.id = a.student_id
                    WHERE a.student_id IS NOT NULL AND a.reservation_created_at IS NOT NULL ${resMonthCond} GROUP BY 1
                ),
                interview_s AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company), ''), '未設定') AS source_company,
                           COUNT(DISTINCT i.student_id)::int AS cnt
                    FROM interviews i JOIN students s ON s.id = i.student_id
                    WHERE i.student_id IS NOT NULL AND i.scheduled_at IS NOT NULL ${intMonthCond} GROUP BY 1
                ),
                first_interview_per_student AS (
                    SELECT DISTINCT ON (student_id)
                        student_id,
                        scheduled_at,
                        interviewed_at,
                        status
                    FROM interviews
                    WHERE student_id IS NOT NULL
                    ORDER BY student_id, COALESCE(scheduled_at, interviewed_at, created_at) ASC, id ASC
                ),
                interview_completed_s AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company), ''), '未設定') AS source_company,
                           COUNT(DISTINCT fi.student_id)::int AS cnt
                    FROM first_interview_per_student fi JOIN students s ON s.id = fi.student_id
                    WHERE (COALESCE(fi.status,'') IN ('completed','面談実施','interviewed') OR fi.interviewed_at IS NOT NULL)
                      ${intMonthCond} GROUP BY 1
                ),
                interview_no_show_s AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company), ''), '未設定') AS source_company,
                           COUNT(DISTINCT i.student_id)::int AS cnt
                    FROM interviews i JOIN students s ON s.id = i.student_id
                    WHERE i.student_id IS NOT NULL AND COALESCE(i.status,'') = 'no_show' ${intMonthCond} GROUP BY 1
                ),
                interview_rescheduled_s AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company), ''), '未設定') AS source_company,
                           COUNT(DISTINCT i.student_id)::int AS cnt
                    FROM interviews i JOIN students s ON s.id = i.student_id
                    WHERE i.student_id IS NOT NULL AND COALESCE(i.status,'') = 'rescheduled' ${intMonthCond} GROUP BY 1
                ),
                proposal_s AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company),''),'未設定') AS source_company,
                           COUNT(DISTINCT ep.student_id)::int AS cnt
                    FROM event_proposals ep JOIN students s ON s.id = ep.student_id GROUP BY 1
                ),
                join_s AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company),''),'未設定') AS source_company,
                           COUNT(DISTINCT ep.student_id)::int AS cnt
                    FROM event_proposals ep JOIN students s ON s.id = ep.student_id
                    WHERE COALESCE(ep.status,'') IN ('joined','参加','参加確定','accepted') GROUP BY 1
                ),
                daily_app AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company),''),'未設定') AS source_company, COUNT(*)::int AS cnt
                    FROM applications a JOIN students s ON s.id = a.student_id
                    WHERE DATE(a.applied_at) = CURRENT_DATE GROUP BY 1
                ),
                daily_avg AS (
                    SELECT source_company, ROUND(AVG(cnt)::numeric, 2) AS avg_daily_applications
                    FROM (
                        SELECT COALESCE(NULLIF(TRIM(s.source_company),''),'未設定') AS source_company,
                               DATE(a.applied_at) AS day, COUNT(*)::int AS cnt
                        FROM applications a JOIN students s ON s.id = a.student_id
                        WHERE a.applied_at >= (CURRENT_DATE - INTERVAL '30 days') GROUP BY 1,2
                    ) t GROUP BY source_company
                ),
                daily_setting AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company),''),'未設定') AS source_company, COUNT(*)::int AS cnt
                    FROM applications a JOIN students s ON s.id = a.student_id
                    WHERE DATE(a.reservation_created_at) = CURRENT_DATE GROUP BY 1
                ),
                app_to_reserve_lt AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company),''),'未設定') AS source_company,
                        ROUND(AVG(EXTRACT(EPOCH FROM (a.reservation_created_at - a.applied_at))/86400.0)::numeric, 2) AS days
                    FROM applications a JOIN students s ON s.id = a.student_id
                    WHERE a.applied_at IS NOT NULL AND a.reservation_created_at IS NOT NULL GROUP BY 1
                ),
                latest_interview AS (
                    SELECT DISTINCT ON (i.student_id) i.student_id, i.scheduled_at
                    FROM interviews i WHERE i.student_id IS NOT NULL
                    ORDER BY i.student_id, COALESCE(i.scheduled_at, i.interviewed_at, i.created_at) DESC, i.id DESC
                ),
                reserve_to_interview_lt AS (
                    SELECT COALESCE(NULLIF(TRIM(s.source_company),''),'未設定') AS source_company,
                        ROUND(AVG(EXTRACT(EPOCH FROM (li.scheduled_at - a.reservation_created_at))/86400.0)::numeric, 2) AS days
                    FROM applications a JOIN students s ON s.id = a.student_id
                    JOIN latest_interview li ON li.student_id = a.student_id
                    WHERE a.reservation_created_at IS NOT NULL AND li.scheduled_at IS NOT NULL GROUP BY 1
                )
                SELECT
                    src.source_company,
                    COALESCE(daily_app.cnt, 0)::int AS daily_applications,
                    COALESCE(daily_setting.cnt, 0)::int AS daily_settings,
                    COALESCE(daily_avg.avg_daily_applications, 0)::numeric(10,2) AS avg_daily_applications,
                    COALESCE(app_s.cnt, 0)::int AS applications_students,
                    COALESCE(reserve_s.cnt, 0)::int AS reserved_students,
                    COALESCE(interview_s.cnt, 0)::int AS interview_scheduled_students,
                    COALESCE(interview_completed_s.cnt, 0)::int AS interviewed_students,
                    COALESCE(interview_no_show_s.cnt, 0)::int AS no_show_students,
                    COALESCE(interview_rescheduled_s.cnt, 0)::int AS rescheduled_students,
                    COALESCE(proposal_s.cnt, 0)::int AS proposed_students,
                    COALESCE(join_s.cnt, 0)::int AS joined_students,
                    app_to_reserve_lt.days AS apply_to_reservation_lead_time_days_avg,
                    reserve_to_interview_lt.days AS reservation_to_interview_lead_time_days_avg,
                    ROUND((COALESCE(reserve_s.cnt,0)::numeric / NULLIF(COALESCE(app_s.cnt,0),0)) * 100, 2) AS application_to_reservation_rate,
                    ROUND((COALESCE(interview_completed_s.cnt,0)::numeric / NULLIF(COALESCE(reserve_s.cnt,0),0)) * 100, 2) AS reservation_to_interview_rate,
                    ROUND((COALESCE(proposal_s.cnt,0)::numeric / NULLIF(COALESCE(interview_completed_s.cnt,0),0)) * 100, 2) AS interview_to_proposal_rate,
                    ROUND((COALESCE(join_s.cnt,0)::numeric / NULLIF(COALESCE(proposal_s.cnt,0),0)) * 100, 2) AS proposal_to_join_rate,
                    ROUND((COALESCE(interview_completed_s.cnt,0)::numeric / NULLIF(COALESCE(interview_s.cnt,0),0)) * 100, 2) AS interview_completed_rate,
                    ROUND((COALESCE(interview_no_show_s.cnt,0)::numeric / NULLIF(COALESCE(interview_s.cnt,0),0)) * 100, 2) AS no_show_rate,
                    ROUND((COALESCE(interview_rescheduled_s.cnt,0)::numeric / NULLIF(COALESCE(interview_s.cnt,0),0)) * 100, 2) AS reschedule_rate
                FROM src
                LEFT JOIN app_s ON app_s.source_company = src.source_company
                LEFT JOIN reserve_s ON reserve_s.source_company = src.source_company
                LEFT JOIN interview_s ON interview_s.source_company = src.source_company
                LEFT JOIN interview_completed_s ON interview_completed_s.source_company = src.source_company
                LEFT JOIN interview_no_show_s ON interview_no_show_s.source_company = src.source_company
                LEFT JOIN interview_rescheduled_s ON interview_rescheduled_s.source_company = src.source_company
                LEFT JOIN proposal_s ON proposal_s.source_company = src.source_company
                LEFT JOIN join_s ON join_s.source_company = src.source_company
                LEFT JOIN daily_app ON daily_app.source_company = src.source_company
                LEFT JOIN daily_setting ON daily_setting.source_company = src.source_company
                LEFT JOIN daily_avg ON daily_avg.source_company = src.source_company
                LEFT JOIN app_to_reserve_lt ON app_to_reserve_lt.source_company = src.source_company
                LEFT JOIN reserve_to_interview_lt ON reserve_to_interview_lt.source_company = src.source_company
                ORDER BY src.source_company ASC
            `);
            res.json(bySourceRes.rows);
            return;
        }
        // ─── 全体集計（月フィルタ対応） ───
        const [dailyRes, dailySettingsRes, summaryRes, lostRes] = yield Promise.all([
            db_1.default.query(`
                SELECT DATE(a.applied_at) AS day, COUNT(*)::int AS count
                FROM applications a JOIN students s ON s.id = a.student_id
                WHERE a.applied_at IS NOT NULL ${dailyAppCond} ${sSourceFilter}
                GROUP BY DATE(a.applied_at) ORDER BY day DESC LIMIT 62
            `),
            db_1.default.query(`
                SELECT DATE(a.reservation_created_at) AS day, COUNT(*)::int AS count
                FROM applications a JOIN students s ON s.id = a.student_id
                WHERE a.reservation_created_at IS NOT NULL ${dailySetCond} ${sSourceFilter}
                GROUP BY DATE(a.reservation_created_at) ORDER BY day DESC LIMIT 62
            `),
            db_1.default.query(`
                WITH app_s AS (
                    SELECT COUNT(DISTINCT a.student_id)::int AS cnt FROM applications a JOIN students s ON s.id = a.student_id
                    WHERE a.student_id IS NOT NULL ${appMonthCond} ${sSourceFilter}
                ),
                reserve_s AS (
                    SELECT COUNT(DISTINCT a.student_id)::int AS cnt FROM applications a JOIN students s ON s.id = a.student_id
                    WHERE a.student_id IS NOT NULL AND a.reservation_created_at IS NOT NULL ${resMonthCond} ${sSourceFilter}
                ),
                interview_s AS (
                    SELECT COUNT(DISTINCT i.student_id)::int AS cnt FROM interviews i JOIN students s ON s.id = i.student_id
                    WHERE i.student_id IS NOT NULL AND i.scheduled_at IS NOT NULL ${intMonthCond} ${sSourceFilter}
                ),
                first_interview_per_student AS (
                    SELECT DISTINCT ON (i.student_id)
                        i.student_id,
                        i.scheduled_at,
                        i.interviewed_at,
                        i.status
                    FROM interviews i
                    JOIN students s ON s.id = i.student_id
                    WHERE i.student_id IS NOT NULL ${sSourceFilter}
                    ORDER BY i.student_id,
                             COALESCE(i.scheduled_at, i.interviewed_at, i.created_at) ASC,
                             i.id ASC
                ),
                interview_completed_s AS (
                    SELECT COUNT(DISTINCT student_id)::int AS cnt
                    FROM first_interview_per_student
                    WHERE COALESCE(status,'') IN ('completed','面談実施','interviewed')
                       OR interviewed_at IS NOT NULL
                ),
                interview_no_show_s AS (
                    SELECT COUNT(DISTINCT i.student_id)::int AS cnt FROM interviews i JOIN students s ON s.id = i.student_id
                    WHERE i.student_id IS NOT NULL AND COALESCE(i.status,'') = 'no_show' ${intMonthCond} ${sSourceFilter}
                ),
                interview_rescheduled_s AS (
                    SELECT COUNT(DISTINCT i.student_id)::int AS cnt FROM interviews i JOIN students s ON s.id = i.student_id
                    WHERE i.student_id IS NOT NULL AND COALESCE(i.status,'') = 'rescheduled' ${intMonthCond} ${sSourceFilter}
                ),
                apply_to_reserve_lt AS (
                    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (a.reservation_created_at - a.applied_at))/86400.0)::numeric, 2) AS days
                    FROM applications a JOIN students s ON s.id = a.student_id WHERE a.applied_at IS NOT NULL AND a.reservation_created_at IS NOT NULL ${sSourceFilter}
                ),
                latest_interview AS (
                    SELECT DISTINCT ON (i.student_id) i.student_id, i.scheduled_at
                    FROM interviews i JOIN students s ON s.id = i.student_id WHERE i.student_id IS NOT NULL ${sSourceFilter}
                    ORDER BY i.student_id, COALESCE(i.scheduled_at, i.interviewed_at, i.created_at) DESC, i.id DESC
                ),
                reserve_to_interview_lt AS (
                    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (li.scheduled_at - a.reservation_created_at))/86400.0)::numeric, 2) AS days
                    FROM applications a JOIN latest_interview li ON li.student_id = a.student_id
                    JOIN students s ON s.id = a.student_id
                    WHERE a.reservation_created_at IS NOT NULL AND li.scheduled_at IS NOT NULL ${sSourceFilter}
                ),
                proposal_s AS (SELECT COUNT(DISTINCT ep.student_id)::int AS cnt FROM event_proposals ep JOIN students s ON s.id = ep.student_id WHERE true ${sSourceFilter}),
                join_s AS (
                    SELECT COUNT(DISTINCT ep.student_id)::int AS cnt FROM event_proposals ep JOIN students s ON s.id = ep.student_id
                    WHERE COALESCE(ep.status,'') IN ('joined','参加','参加確定','accepted') ${sSourceFilter}
                )
                SELECT
                    app_s.cnt AS applications_students,
                    reserve_s.cnt AS reserved_students,
                    interview_s.cnt AS interview_scheduled_students,
                    interview_completed_s.cnt AS interviewed_students,
                    interview_no_show_s.cnt AS no_show_students,
                    interview_rescheduled_s.cnt AS rescheduled_students,
                    proposal_s.cnt AS proposed_students,
                    join_s.cnt AS joined_students,
                    apply_to_reserve_lt.days AS apply_to_reservation_lead_time_days_avg,
                    reserve_to_interview_lt.days AS reservation_to_interview_lead_time_days_avg
                FROM app_s, reserve_s, interview_s, interview_completed_s, interview_no_show_s,
                     interview_rescheduled_s, proposal_s, join_s, apply_to_reserve_lt, reserve_to_interview_lt
            `),
            db_1.default.query(`
                SELECT COALESCE(lr.reason_name,'未設定') AS reason_name, COUNT(*)::int AS count
                FROM event_proposals ep
                JOIN students s ON s.id = ep.student_id
                LEFT JOIN lost_reasons lr ON lr.id = ep.lost_reason_id
                WHERE ep.lost_reason_id IS NOT NULL AND COALESCE(ep.status,'') IN ('lost','失注') ${sSourceFilter}
                GROUP BY COALESCE(lr.reason_name,'未設定')
                ORDER BY count DESC, reason_name ASC LIMIT 10
            `)
        ]);
        const s = summaryRes.rows[0] || {};
        const applicationsStudents = Number(s.applications_students || 0);
        const reservedStudents = Number(s.reserved_students || 0);
        const interviewScheduledStudents = Number(s.interview_scheduled_students || 0);
        const interviewedStudents = Number(s.interviewed_students || 0);
        const noShowStudents = Number(s.no_show_students || 0);
        const rescheduledStudents = Number(s.rescheduled_students || 0);
        const proposedStudents = Number(s.proposed_students || 0);
        const joinedStudents = Number(s.joined_students || 0);
        const rate = (a, b) => (b > 0 ? Number(((a / b) * 100).toFixed(2)) : 0);
        res.json({
            daily_applications: dailyRes.rows,
            daily_settings: dailySettingsRes.rows,
            application_to_reservation_rate: rate(reservedStudents, applicationsStudents),
            // 予約→面談率: 実施数 / 予約済み（分母を予約者数に修正）
            reservation_to_interview_rate: rate(interviewedStudents, reservedStudents),
            interview_to_proposal_rate: rate(proposedStudents, interviewedStudents),
            proposal_to_join_rate: rate(joinedStudents, proposedStudents),
            apply_to_reservation_lead_time_days_avg: s.apply_to_reservation_lead_time_days_avg !== null ? Number(s.apply_to_reservation_lead_time_days_avg) : null,
            reservation_to_interview_lead_time_days_avg: s.reservation_to_interview_lead_time_days_avg !== null ? Number(s.reservation_to_interview_lead_time_days_avg) : null,
            interview_completed_rate: rate(interviewedStudents, interviewScheduledStudents),
            // 飛ばれ率・リスケ率の分母を面談設定数（scheduled）に修正
            no_show_rate: rate(noShowStudents, interviewScheduledStudents),
            reschedule_rate: rate(rescheduledStudents, interviewScheduledStudents),
            lost_reason_ranking: lostRes.rows,
            counts: {
                applications_students: applicationsStudents,
                reserved_students: reservedStudents,
                interview_scheduled_students: interviewScheduledStudents,
                interviewed_students: interviewedStudents,
                no_show_students: noShowStudents,
                rescheduled_students: rescheduledStudents,
                proposed_students: proposedStudents,
                joined_students: joinedStudents
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getFunnelKpi = getFunnelKpi;
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
    let client = null;
    try {
        yield ensureStudentExtendedColumns();
        client = yield db_1.default.connect();
        yield client.query('BEGIN');
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
            const existsRes = yield client.query(cols.has('prefecture')
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
            const normalizedGraduationYear = normalizeGraduationYear(s.graduation_year);
            pushSet('source_company', s.source_company || null);
            pushSet('graduation_year', normalizedGraduationYear);
            pushSet('staff_id', s.staff_id || null);
            pushSet('referral_status', normalizeReferralStatus(s.referral_status));
            pushSet('progress_stage', normalizeProgressStage(s.progress_stage));
            pushSet('next_meeting_date', s.next_meeting_date || null);
            pushSet('academic_track', normalizeAcademicTrack(s.academic_track));
            pushSet('prefecture', s.prefecture || null);
            pushSet('meeting_decided_date', s.meeting_decided_date || null);
            pushSet('first_interview_date', s.first_interview_date || null);
            pushSet('second_interview_date', s.second_interview_date || null);
            if (cols.has('updated_at'))
                updateParts.push('updated_at = CURRENT_TIMESTAMP');
            if (existsRes.rows.length > 0) {
                const id = existsRes.rows[0].id;
                if (updateParts.length > 0) {
                    values.push(id);
                    yield client.query(`UPDATE students SET ${updateParts.join(', ')} WHERE id = $${values.length}`, values);
                }
                yield ensureSourceCategoryFromStudent(s.source_company, client);
                yield ensureGraduationYearCategoryFromStudent(normalizedGraduationYear, client);
                if (s.task_due_date) {
                    const lastTask = yield client.query('SELECT id FROM student_tasks WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);
                    if (lastTask.rows.length > 0) {
                        yield client.query('UPDATE student_tasks SET due_date = $1 WHERE id = $2', [s.task_due_date, lastTask.rows[0].id]);
                    }
                    else {
                        yield client.query('INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3)', [id, s.task_due_date, 'CSV更新タスク']);
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
            const normalizedInsertGraduationYear = normalizeGraduationYear(s.graduation_year);
            pushInsert('academic_track', normalizeAcademicTrack(s.academic_track));
            pushInsert('graduation_year', normalizedInsertGraduationYear);
            pushInsert('staff_id', s.staff_id || null);
            pushInsert('source_company', s.source_company || null);
            pushInsert('referral_status', normalizeReferralStatus(s.referral_status));
            pushInsert('progress_stage', normalizeProgressStage(s.progress_stage));
            pushInsert('next_meeting_date', s.next_meeting_date || null);
            pushInsert('meeting_decided_date', s.meeting_decided_date || null);
            pushInsert('first_interview_date', s.first_interview_date || null);
            pushInsert('second_interview_date', s.second_interview_date || null);
            const placeholders = insertCols.map((_, idx) => `$${idx + 1}`).join(', ');
            const insertedRes = yield client.query(`INSERT INTO students (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id`, insertVals);
            yield ensureSourceCategoryFromStudent(s.source_company, client);
            yield ensureGraduationYearCategoryFromStudent(normalizedInsertGraduationYear, client);
            if (s.task_due_date && ((_a = insertedRes.rows[0]) === null || _a === void 0 ? void 0 : _a.id)) {
                yield client.query('INSERT INTO student_tasks (student_id, due_date, content) VALUES ($1, $2, $3)', [insertedRes.rows[0].id, s.task_due_date, 'CSV更新タスク']);
            }
            inserted++;
        }
        yield client.query('COMMIT');
        res.json({ inserted, updated, skipped });
    }
    catch (err) {
        if (client) {
            try {
                yield client.query('ROLLBACK');
            }
            catch (_b) {
                // ignore rollback failure
            }
        }
        res.status(500).json({ inserted: 0, updated: 0, skipped: 0, error: err.message });
    }
    finally {
        client === null || client === void 0 ? void 0 : client.release();
    }
});
exports.importStudents = importStudents;
const getSourceCategories = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ensureSourceCategoriesTable();
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
const getGraduationYearCategories = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ensureGraduationYearCategoriesTable();
        const result = yield db_1.default.query('SELECT id, year, created_at FROM graduation_year_categories ORDER BY year ASC');
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getGraduationYearCategories = getGraduationYearCategories;
const createGraduationYearCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const authUser = req.user;
    if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const year = Number((_a = req.body) === null || _a === void 0 ? void 0 : _a.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        res.status(400).json({ error: 'year is required (2000-2100)' });
        return;
    }
    try {
        yield ensureGraduationYearCategoriesTable();
        const result = yield db_1.default.query('INSERT INTO graduation_year_categories (year) VALUES ($1) ON CONFLICT (year) DO NOTHING RETURNING id, year, created_at', [year]);
        if (result.rows.length === 0) {
            const existing = yield db_1.default.query('SELECT id, year, created_at FROM graduation_year_categories WHERE year = $1', [year]);
            res.json(existing.rows[0]);
            return;
        }
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createGraduationYearCategory = createGraduationYearCategory;
const deleteGraduationYearCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authUser = req.user;
    if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const { id } = req.params;
    try {
        yield ensureGraduationYearCategoriesTable();
        const result = yield db_1.default.query('DELETE FROM graduation_year_categories WHERE id = $1 RETURNING id', [id]);
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
exports.deleteGraduationYearCategory = deleteGraduationYearCategory;
