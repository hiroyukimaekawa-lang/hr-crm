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
exports.importStudents = exports.deleteStudent = exports.deleteStudentTask = exports.addStudentTask = exports.updateStudentMeta = exports.updateStudentStaff = exports.updateStudentBasic = exports.updateStudentStatus = exports.deleteInterviewLog = exports.addInterviewLog = exports.linkEvent = exports.getStudentDetail = exports.createStudent = exports.getStudents = void 0;
const db_1 = __importDefault(require("../config/db"));
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
const getStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const staffId = req.query.staffId;
    const authUser = req.user;
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
    const { name, university, academic_track, faculty, referral_status, progress_stage, next_meeting_date, next_action, desired_industry, desired_role, graduation_year, email, phone, status, tags, staff_id, source_company, interview_reason } = req.body;
    try {
        const duplicateRes = yield db_1.default.query('SELECT id FROM students WHERE name = $1 AND COALESCE(university, \'\') = COALESCE($2, \'\') AND COALESCE(faculty, \'\') = COALESCE($3, \'\') LIMIT 1', [name, university || null, faculty || null]);
        if (duplicateRes.rows.length > 0) {
            res.status(409).json({ error: 'Student already exists' });
            return;
        }
        const result = yield db_1.default.query('INSERT INTO students (name, university, academic_track, faculty, referral_status, progress_stage, next_meeting_date, next_action, desired_industry, desired_role, graduation_year, email, phone, status, tags, staff_id, source_company, interview_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *', [
            name,
            university,
            academic_track || null,
            faculty || null,
            referral_status || '不明',
            progress_stage || '初回面談',
            next_meeting_date || null,
            next_action || null,
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
        ]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createStudent = createStudent;
const getStudentDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
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
        res.json({
            student: studentRes.rows[0],
            events: eventsRes.rows,
            logs: logsRes.rows,
            tasks: tasksRes.rows
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getStudentDetail = getStudentDetail;
const linkEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { event_id } = req.body;
    try {
        yield db_1.default.query('INSERT INTO student_events (student_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, event_id]);
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
    const { name, university, academic_track, faculty, email, phone, graduation_year, source_company, interview_reason, desired_industry, desired_role, next_meeting_date, next_action } = req.body;
    try {
        const result = yield db_1.default.query(`UPDATE students
             SET name = $1,
                 university = $2,
                 academic_track = $3,
                 faculty = $4,
                 email = $5,
                 phone = $6,
                 graduation_year = $7,
                 source_company = $8,
                 interview_reason = $9,
                 desired_industry = $10,
                 desired_role = $11,
                 next_meeting_date = $12,
                 next_action = $13,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $14
             RETURNING *`, [
            name || null,
            university || null,
            academic_track || null,
            faculty || null,
            email || null,
            phone || null,
            normalizeGraduationYear(graduation_year),
            source_company || null,
            interview_reason || null,
            desired_industry || null,
            desired_role || null,
            next_meeting_date || null,
            next_action || null,
            id
        ]);
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
    const { students } = req.body;
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
            const existsRes = yield db_1.default.query('SELECT id FROM students WHERE name = $1 AND university = $2 AND faculty = $3', [name, university, faculty]);
            if (existsRes.rows.length > 0) {
                const id = existsRes.rows[0].id;
                yield db_1.default.query('UPDATE students SET source_company = $1, graduation_year = $2, email = $3, status = $4, staff_id = $5, interview_reason = $6, referral_status = $7, progress_stage = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9', [
                    s.source_company || null,
                    normalizeGraduationYear(s.graduation_year),
                    s.email || null,
                    s.status || '面談',
                    s.staff_id || null,
                    s.interview_reason || null,
                    s.referral_status || '不明',
                    s.progress_stage || '初回面談',
                    id
                ]);
                updated++;
                continue;
            }
            yield db_1.default.query('INSERT INTO students (name, university, faculty, graduation_year, email, status, staff_id, source_company, interview_reason, referral_status, progress_stage) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [
                name,
                university || null,
                faculty || null,
                normalizeGraduationYear(s.graduation_year),
                s.email || null,
                s.status || '面談',
                s.staff_id || null,
                s.source_company || null,
                s.interview_reason || null,
                s.referral_status || '不明',
                s.progress_stage || '初回面談'
            ]);
            inserted++;
        }
        res.json({ inserted, updated });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.importStudents = importStudents;
