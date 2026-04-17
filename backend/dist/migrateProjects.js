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
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '.env') });
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL
});
function migrate() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting migration from events to projects...');
        const client = yield pool.connect();
        try {
            yield client.query('BEGIN');
            console.log('1. Copying events to projects...');
            const eventsRes = yield client.query('SELECT * FROM events');
            for (const event of eventsRes.rows) {
                // Check if project already exists to make script idempotent
                const checkRes = yield client.query('SELECT id FROM projects WHERE id = $1', [event.id]);
                if (checkRes.rows.length === 0) {
                    yield client.query(`
                    INSERT INTO projects (
                        id, title, type, description,  
                        entry_deadline, kpi_seat_to_entry_rate, kpi_entry_to_interview_rate, 
                        kpi_interview_to_reservation_rate, kpi_reservation_to_application_rate,
                        kpi_custom_steps, yomi_statuses, location, lp_url,
                        capacity, target_seats, unit_price, target_sales, current_sales,
                        created_at
                    ) VALUES (
                        $1, $2, 'event', $3, 
                        $4, $5, $6, 
                        $7, $8, 
                        $9, $10, $11, $12,
                        $13, $14, $15, $16, $17, 
                        $18
                    )
                `, [
                        event.id, event.title, event.description,
                        event.entry_deadline, event.kpi_seat_to_entry_rate, event.kpi_entry_to_interview_rate,
                        event.kpi_interview_to_reservation_rate, event.kpi_reservation_to_application_rate,
                        event.kpi_custom_steps, event.yomi_statuses, event.location, event.lp_url,
                        event.capacity, event.target_seats, event.unit_price, event.target_sales, event.current_sales,
                        event.created_at
                    ]);
                }
            }
            // Sync sequences just in case
            yield client.query(`SELECT setval('projects_id_seq', COALESCE((SELECT MAX(id)+1 FROM projects), 1), false)`);
            console.log('2. Migrating event_dates to project_schedules...');
            const eventDatesRes = yield client.query('SELECT * FROM event_dates');
            const eventDateScheduleMap = {}; // event_id -> { YYYY-MM-DD: schedule_id }
            for (const ed of eventDatesRes.rows) {
                const dateStr = ed.event_date.toISOString().split('T')[0];
                const checkRes = yield client.query('SELECT id FROM project_schedules WHERE project_id = $1 AND schedule_date = $2', [ed.event_id, dateStr]);
                let scheduleId;
                if (checkRes.rows.length === 0) {
                    const insertRes = yield client.query('INSERT INTO project_schedules (project_id, schedule_date, created_at) VALUES ($1, $2, $3) RETURNING id', [ed.event_id, dateStr, ed.created_at]);
                    scheduleId = insertRes.rows[0].id;
                }
                else {
                    scheduleId = checkRes.rows[0].id;
                }
                if (!eventDateScheduleMap[ed.event_id]) {
                    eventDateScheduleMap[ed.event_id] = {};
                }
                eventDateScheduleMap[ed.event_id][dateStr] = scheduleId;
            }
            console.log('3. Migrating student_events to student_project_relations...');
            const studentEventsRes = yield client.query('SELECT * FROM student_events');
            for (const se of studentEventsRes.rows) {
                let scheduleId = null;
                if (se.selected_event_date) {
                    const dateStr = se.selected_event_date.toISOString().split('T')[0];
                    if (eventDateScheduleMap[se.event_id] && eventDateScheduleMap[se.event_id][dateStr]) {
                        scheduleId = eventDateScheduleMap[se.event_id][dateStr];
                    }
                    else {
                        // Try to find schedule directly
                        const scheduleRes = yield client.query('SELECT id FROM project_schedules WHERE project_id = $1 AND schedule_date = $2', [se.event_id, dateStr]);
                        if (scheduleRes.rows.length > 0) {
                            scheduleId = scheduleRes.rows[0].id;
                        }
                        else {
                            // Create ad-hoc schedule if missing
                            const insertRes = yield client.query('INSERT INTO project_schedules (project_id, schedule_date) VALUES ($1, $2) RETURNING id', [se.event_id, dateStr]);
                            scheduleId = insertRes.rows[0].id;
                            if (!eventDateScheduleMap[se.event_id])
                                eventDateScheduleMap[se.event_id] = {};
                            eventDateScheduleMap[se.event_id][dateStr] = scheduleId;
                        }
                    }
                }
                // Check if exists
                const checkRes = yield client.query(`SELECT id FROM student_project_relations 
                 WHERE student_id = $1 AND project_id = $2 
                 AND COALESCE(schedule_id, 0) = COALESCE($3, 0)`, [se.student_id, se.event_id, scheduleId]);
                if (checkRes.rows.length === 0) {
                    yield client.query(`
                    INSERT INTO student_project_relations (
                        id, student_id, project_id, schedule_id, status, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6
                    )
                `, [
                        se.id, se.student_id, se.event_id, scheduleId, se.status, se.created_at
                    ]);
                }
            }
            yield client.query(`SELECT setval('student_project_relations_id_seq', COALESCE((SELECT MAX(id)+1 FROM student_project_relations), 1), false)`);
            yield client.query('COMMIT');
            console.log('Migration completed successfully!');
        }
        catch (e) {
            yield client.query('ROLLBACK');
            console.error('Migration failed:', e);
        }
        finally {
            client.release();
            yield pool.end();
        }
    });
}
migrate();
