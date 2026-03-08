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
let eventDatesTableReady = false;
let eventDatesTablePromise = null;
let cachedEventColumns = null;
const ensureEventDatesTable = () => __awaiter(void 0, void 0, void 0, function* () {
    if (eventDatesTableReady)
        return;
    if (!eventDatesTablePromise) {
        eventDatesTablePromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            yield db_1.default.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS entry_deadline TIMESTAMP
            `);
            yield db_1.default.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_seat_to_entry_rate NUMERIC(5,2) DEFAULT 70
            `);
            yield db_1.default.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_entry_to_interview_rate NUMERIC(5,2) DEFAULT 60
            `);
            yield db_1.default.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_interview_to_inflow_rate NUMERIC(5,2) DEFAULT 50
            `);
            yield db_1.default.query(`
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS kpi_custom_steps TEXT DEFAULT '[]'
            `);
            yield db_1.default.query(`
                CREATE TABLE IF NOT EXISTS event_dates (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    event_date TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            eventDatesTableReady = true;
        }))().finally(() => {
            eventDatesTablePromise = null;
        });
    }
    yield eventDatesTablePromise;
});
const normalizeEventDates = (event_dates, event_date) => {
    const raw = Array.isArray(event_dates) ? event_dates : [];
    const merged = raw.length > 0 ? raw : (event_date ? [event_date] : []);
    const cleaned = merged
        .map((v) => String(v || '').trim())
        .filter((v) => !!v);
    return Array.from(new Set(cleaned));
};
const getEventColumns = () => __awaiter(void 0, void 0, void 0, function* () {
    if (cachedEventColumns)
        return cachedEventColumns;
    const result = yield db_1.default.query(`SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'events'`);
    cachedEventColumns = new Set(result.rows.map((r) => r.column_name));
    return cachedEventColumns;
});
const getEvents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ensureEventDatesTable();
        const result = yield db_1.default.query(`
            SELECT 
                e.*,
                COALESCE(date_stats.event_dates, '[]'::json) as event_dates,
                COALESCE(part_stats.registered_count, 0) as registered_count,
                COALESCE(part_stats.attended_count, 0) as attended_count,
                COALESCE(part_stats.canceled_count, 0) as canceled_count,
                COALESCE(part_stats.a_entry_count, 0) as a_entry_count,
                COALESCE(part_stats.b_waiting_count, 0) as b_waiting_count,
                COALESCE(part_stats.c_waiting_count, 0) as c_waiting_count,
                COALESCE(part_stats.xa_cancel_count, 0) as xa_cancel_count,
                COALESCE(part_stats.total_count, 0) as total_count
            FROM events e
            LEFT JOIN LATERAL (
                SELECT
                    json_agg(to_char(ed.event_date, 'YYYY-MM-DD"T"HH24:MI:SS') ORDER BY ed.event_date ASC) as event_dates
                FROM event_dates ed
                WHERE ed.event_id = e.id
            ) date_stats ON true
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(se.*) FILTER (WHERE se.status = 'registered' OR se.status = 'A_ENTRY') as registered_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'attended') as attended_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'canceled') as canceled_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'A_ENTRY' OR se.status = 'registered') as a_entry_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'B_WAITING') as b_waiting_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'C_WAITING') as c_waiting_count,
                    COUNT(se.*) FILTER (WHERE se.status = 'XA_CANCEL' OR se.status = 'canceled') as xa_cancel_count,
                    COUNT(se.*) as total_count
                FROM student_events se
                WHERE se.event_id = e.id
            ) part_stats ON true
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
    const { title, description, event_date, event_dates, location, lp_url, capacity, target_seats, unit_price, target_sales, current_sales, entry_deadline, kpi_seat_to_entry_rate, kpi_entry_to_interview_rate, kpi_interview_to_inflow_rate, kpi_custom_steps } = req.body;
    try {
        yield ensureEventDatesTable();
        const dates = normalizeEventDates(event_dates, event_date);
        const primaryDate = dates.length > 0 ? dates[0] : null;
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
        push('event_date', primaryDate);
        push('location', location || null);
        push('lp_url', lp_url || null);
        push('capacity', capacity || null);
        push('target_seats', target_seats || null);
        push('unit_price', unit_price || null);
        push('target_sales', target_sales || null);
        push('current_sales', current_sales || 0);
        push('entry_deadline', entry_deadline || null);
        push('kpi_seat_to_entry_rate', kpi_seat_to_entry_rate !== null && kpi_seat_to_entry_rate !== void 0 ? kpi_seat_to_entry_rate : 70);
        push('kpi_entry_to_interview_rate', kpi_entry_to_interview_rate !== null && kpi_entry_to_interview_rate !== void 0 ? kpi_entry_to_interview_rate : 60);
        push('kpi_interview_to_inflow_rate', kpi_interview_to_inflow_rate !== null && kpi_interview_to_inflow_rate !== void 0 ? kpi_interview_to_inflow_rate : 50);
        push('kpi_custom_steps', Array.isArray(kpi_custom_steps) ? JSON.stringify(kpi_custom_steps) : '[]');
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        yield db_1.default.query('BEGIN');
        const result = yield db_1.default.query(`INSERT INTO events (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`, insertVals);
        const created = result.rows[0];
        for (const dt of dates) {
            yield db_1.default.query('INSERT INTO event_dates (event_id, event_date) VALUES ($1, $2)', [created.id, dt]);
        }
        yield db_1.default.query('COMMIT');
        res.json(Object.assign(Object.assign({}, created), { event_dates: dates }));
    }
    catch (err) {
        try {
            yield db_1.default.query('ROLLBACK');
        }
        catch (_a) { }
        res.status(500).json({ error: err.message });
    }
});
exports.createEvent = createEvent;
const updateEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { title, description, event_date, event_dates, location, lp_url, capacity, target_seats, unit_price, target_sales, current_sales, entry_deadline, kpi_seat_to_entry_rate, kpi_entry_to_interview_rate, kpi_interview_to_inflow_rate, kpi_custom_steps } = req.body;
    try {
        yield ensureEventDatesTable();
        const dates = normalizeEventDates(event_dates, event_date);
        const primaryDate = dates.length > 0 ? dates[0] : null;
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
        pushSet('event_date', primaryDate);
        pushSet('location', location || null);
        pushSet('lp_url', lp_url || null);
        pushSet('capacity', capacity || null);
        pushSet('target_seats', target_seats || null);
        pushSet('unit_price', unit_price || null);
        pushSet('target_sales', target_sales || null);
        pushSet('current_sales', current_sales || 0);
        pushSet('entry_deadline', entry_deadline || null);
        pushSet('kpi_seat_to_entry_rate', kpi_seat_to_entry_rate !== null && kpi_seat_to_entry_rate !== void 0 ? kpi_seat_to_entry_rate : 70);
        pushSet('kpi_entry_to_interview_rate', kpi_entry_to_interview_rate !== null && kpi_entry_to_interview_rate !== void 0 ? kpi_entry_to_interview_rate : 60);
        pushSet('kpi_interview_to_inflow_rate', kpi_interview_to_inflow_rate !== null && kpi_interview_to_inflow_rate !== void 0 ? kpi_interview_to_inflow_rate : 50);
        pushSet('kpi_custom_steps', Array.isArray(kpi_custom_steps) ? JSON.stringify(kpi_custom_steps) : '[]');
        values.push(id);
        yield db_1.default.query('BEGIN');
        const result = yield db_1.default.query(`UPDATE events
             SET ${setParts.join(', ')}
             WHERE id = $${values.length}
             RETURNING *`, values);
        if (result.rows.length === 0) {
            yield db_1.default.query('ROLLBACK');
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        yield db_1.default.query('DELETE FROM event_dates WHERE event_id = $1', [id]);
        for (const dt of dates) {
            yield db_1.default.query('INSERT INTO event_dates (event_id, event_date) VALUES ($1, $2)', [id, dt]);
        }
        yield db_1.default.query('COMMIT');
        res.json(Object.assign(Object.assign({}, result.rows[0]), { event_dates: dates }));
    }
    catch (err) {
        try {
            yield db_1.default.query('ROLLBACK');
        }
        catch (_a) { }
        res.status(500).json({ error: err.message });
    }
});
exports.updateEvent = updateEvent;
const getEventDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield ensureEventDatesTable();
        const eventRes = yield db_1.default.query('SELECT * FROM events WHERE id = $1', [id]);
        const eventDatesRes = yield db_1.default.query('SELECT event_date FROM event_dates WHERE event_id = $1 ORDER BY event_date ASC', [id]);
        const participantsRes = yield db_1.default.query(`
            SELECT 
                se.student_id,
                se.status,
                se.created_at,
                s.name,
                s.university,
                s.email,
                s.phone,
                s.graduation_year,
                u.name as staff_name
            FROM student_events se
            JOIN students s ON s.id = se.student_id
            LEFT JOIN users u ON u.id = s.staff_id
            WHERE se.event_id = $1
            ORDER BY se.created_at DESC
        `, [id]);
        res.json({
            event: Object.assign(Object.assign({}, eventRes.rows[0]), { event_dates: eventDatesRes.rows.map((r) => r.event_date) }),
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
