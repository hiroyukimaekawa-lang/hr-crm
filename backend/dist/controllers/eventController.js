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
const getEventColumns = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield db_1.default.query(`SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'events'`);
    return new Set(result.rows.map((r) => r.column_name));
});
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
    const { title, description, event_date, location, lp_url, capacity, target_seats, unit_price, target_sales, current_sales } = req.body;
    try {
        const cols = yield getEventColumns();
        const insertCols = [];
        const insertVals = [];
        const push = (col, val) => {
            if (!cols.has(col))
                return;
            insertCols.push(col);
            insertVals.push(val);
        };
        push('title', title);
        push('description', description || null);
        push('event_date', event_date || null);
        push('location', location || null);
        push('lp_url', lp_url || null);
        push('capacity', capacity || null);
        push('target_seats', target_seats || null);
        push('unit_price', unit_price || null);
        push('target_sales', target_sales || null);
        push('current_sales', current_sales || 0);
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        const result = yield db_1.default.query(`INSERT INTO events (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`, insertVals);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createEvent = createEvent;
const updateEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { title, description, event_date, location, lp_url, capacity, target_seats, unit_price, target_sales, current_sales } = req.body;
    try {
        const cols = yield getEventColumns();
        const setParts = [];
        const values = [];
        const pushSet = (col, val) => {
            if (!cols.has(col))
                return;
            values.push(val);
            setParts.push(`${col} = $${values.length}`);
        };
        pushSet('title', title);
        pushSet('description', description || null);
        pushSet('event_date', event_date || null);
        pushSet('location', location || null);
        pushSet('lp_url', lp_url || null);
        pushSet('capacity', capacity || null);
        pushSet('target_seats', target_seats || null);
        pushSet('unit_price', unit_price || null);
        pushSet('target_sales', target_sales || null);
        pushSet('current_sales', current_sales || 0);
        values.push(id);
        const result = yield db_1.default.query(`UPDATE events
             SET ${setParts.join(', ')}
             WHERE id = $${values.length}
             RETURNING *`, values);
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
