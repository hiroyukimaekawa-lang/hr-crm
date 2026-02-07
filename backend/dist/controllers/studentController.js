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
exports.addInterviewLog = exports.linkEvent = exports.getStudentDetail = exports.createStudent = exports.getStudents = void 0;
const db_1 = __importDefault(require("../config/db"));
const getStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const staffId = req.query.staffId;
    try {
        let query = 'SELECT students.*, users.name as staff_name FROM students LEFT JOIN users ON students.staff_id = users.id';
        const params = [];
        if (staffId) {
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
    const { name, university, email, phone, staff_id } = req.body;
    try {
        const result = yield db_1.default.query('INSERT INTO students (name, university, email, phone, staff_id) VALUES ($1, $2, $3, $4, $5) RETURNING *', [name, university, email, phone, staff_id]);
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
            SELECT e.* FROM events e
            JOIN student_events se ON e.id = se.event_id
            WHERE se.student_id = $1
        `, [id]);
        const logsRes = yield db_1.default.query('SELECT * FROM interview_logs WHERE student_id = $1 ORDER BY created_at DESC', [id]);
        res.json({
            student: studentRes.rows[0],
            events: eventsRes.rows,
            logs: logsRes.rows
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
    const { student_id, staff_id, content, interview_date } = req.body;
    try {
        const result = yield db_1.default.query('INSERT INTO interview_logs (student_id, staff_id, content, interview_date) VALUES ($1, $2, $3, $4) RETURNING *', [student_id, staff_id, content, interview_date]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.addInterviewLog = addInterviewLog;
