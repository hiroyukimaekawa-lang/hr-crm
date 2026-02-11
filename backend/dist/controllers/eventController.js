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
exports.deleteEvent = exports.updateParticipantStatus = exports.getEventDetail = exports.updateEvent = exports.createEvent = exports.getEvents = void 0;
const db_1 = __importDefault(require("../config/db"));
const getEvents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.default.query(`
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getEvents = getEvents;
const createEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description, event_date, location, capacity, target_seats, unit_price, target_sales, current_sales } = req.body;
    try {
        const result = yield db_1.default.query('INSERT INTO events (title, description, event_date, location, capacity, target_seats, unit_price, target_sales, current_sales) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', [
            title,
            description,
            event_date,
            location || null,
            capacity || null,
            target_seats || null,
            unit_price || null,
            target_sales || null,
            current_sales || 0
        ]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createEvent = createEvent;
const updateEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { title, description, event_date, location, capacity, target_seats, unit_price, target_sales, current_sales } = req.body;
    try {
        const result = yield db_1.default.query(`UPDATE events
             SET title = $1,
                 description = $2,
                 event_date = $3,
                 location = $4,
                 capacity = $5,
                 target_seats = $6,
                 unit_price = $7,
                 target_sales = $8,
                 current_sales = $9
             WHERE id = $10
             RETURNING *`, [
            title,
            description || null,
            event_date || null,
            location || null,
            capacity || null,
            target_seats || null,
            unit_price || null,
            target_sales || null,
            current_sales || 0,
            id
        ]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateEvent = updateEvent;
const getEventDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const eventRes = yield db_1.default.query('SELECT * FROM events WHERE id = $1', [id]);
        const participantsRes = yield db_1.default.query(`
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getEventDetail = getEventDetail;
const updateParticipantStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, studentId } = req.params;
    const { status } = req.body;
    try {
        const result = yield db_1.default.query('UPDATE student_events SET status = $1 WHERE event_id = $2 AND student_id = $3 RETURNING *', [status, id, studentId]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateParticipantStatus = updateParticipantStatus;
const deleteEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.default.query('UPDATE interview_logs SET event_id = NULL WHERE event_id = $1', [id]);
        const result = yield db_1.default.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.deleteEvent = deleteEvent;
