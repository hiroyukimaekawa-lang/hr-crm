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
exports.getLegacyEventParticipants = exports.migrateLegacyEvent = exports.getLegacyEvents = void 0;
const db_1 = __importDefault(require("../config/db"));
const getLegacyEvents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Fetch from legacy 'events' table
        // We join with event_dates to get all instances
        const result = yield db_1.default.query(`
            SELECT 
                e.id,
                e.title as name,
                COALESCE(ed.event_date, e.event_date) as event_date,
                e.created_at,
                'legacy' as source,
                e.description,
                e.location,
                e.capacity,
                e.target_seats,
                e.unit_price,
                'event' as legacy_type,
                (SELECT COUNT(*) FROM student_events se WHERE se.event_id = e.id) as participant_count
            FROM events e
            LEFT JOIN event_dates ed ON ed.event_id = e.id
            ORDER BY COALESCE(ed.event_date, e.event_date) DESC
        `);
        res.json(result.rows);
    }
    catch (err) {
        console.error('getLegacyEvents error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.getLegacyEvents = getLegacyEvents;
const migrateLegacyEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.default.query('BEGIN');
        // 1. Fetch legacy event
        const legacyRes = yield db_1.default.query('SELECT * FROM events WHERE id = $1', [id]);
        if (legacyRes.rows.length === 0) {
            yield db_1.default.query('ROLLBACK');
            res.status(404).json({ error: 'Legacy event not found' });
            return;
        }
        const le = legacyRes.rows[0];
        // 2. Fetch specific dates for this event
        const datesRes = yield db_1.default.query('SELECT event_date FROM event_dates WHERE event_id = $1', [id]);
        const dates = datesRes.rows.length > 0 ? datesRes.rows.map(r => r.event_date) : [le.event_date];
        // 3. Insert into projects
        const projectInsert = yield db_1.default.query(`
            INSERT INTO projects (
                title, description, graduation_year, type,
                location, lp_url, capacity, target_seats, unit_price
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [
            le.title,
            le.description,
            le.graduation_year || null,
            'event', // Default to event
            le.location,
            null, // lp_url not in legacy
            le.capacity,
            le.target_seats,
            le.unit_price
        ]);
        const projectId = projectInsert.rows[0].id;
        // 4. Insert into project_schedules
        for (const d of dates) {
            if (!d)
                continue;
            yield db_1.default.query('INSERT INTO project_schedules (project_id, schedule_date) VALUES ($1, $2)', [projectId, d]);
        }
        yield db_1.default.query('COMMIT');
        res.json({ success: true, projectId });
    }
    catch (err) {
        try {
            yield db_1.default.query('ROLLBACK');
        }
        catch (_a) { }
        console.error('migrateLegacyEvent error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.migrateLegacyEvent = migrateLegacyEvent;
const getLegacyEventParticipants = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const result = yield db_1.default.query(`
            SELECT 
                se.student_id,
                se.status,
                s.name as name,
                s.university as university,
                u.name as staff_name,
                -- Try to get selected_event_date if it exists in DB, otherwise fallback
                se.created_at as selected_event_date
            FROM student_events se
            JOIN students s ON se.student_id = s.id
            LEFT JOIN users u ON s.staff_id = u.id
            WHERE se.event_id = $1
            ORDER BY se.created_at DESC
        `, [id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('getLegacyEventParticipants error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.getLegacyEventParticipants = getLegacyEventParticipants;
