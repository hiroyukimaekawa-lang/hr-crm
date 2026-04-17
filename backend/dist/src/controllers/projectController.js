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
exports.getKgiProgress = exports.deleteProject = exports.updateParticipantStatus = exports.getProjectDetail = exports.updateProjectKpi = exports.updateProject = exports.createProject = exports.getProjects = void 0;
const db_1 = __importDefault(require("../config/db"));
const getProjectColumns = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield db_1.default.query(`SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'projects'`);
    return new Set(result.rows.map((r) => r.column_name));
});
const getProjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.default.query(`
            SELECT 
                p.*,
                COALESCE(date_stats.project_schedules, '[]'::json) as project_schedules,
                COALESCE(part_stats.registered_count, 0) as registered_count,
                COALESCE(part_stats.attended_count, 0) as attended_count,
                COALESCE(part_stats.canceled_count, 0) as canceled_count,
                COALESCE(part_stats.a_entry_count, 0) as a_entry_count,
                COALESCE(part_stats.b_waiting_count, 0) as b_waiting_count,
                COALESCE(part_stats.c_waiting_count, 0) as c_waiting_count,
                COALESCE(part_stats.d_pass_count, 0) as d_pass_count,
                COALESCE(part_stats.e_fail_count, 0) as e_fail_count,
                COALESCE(part_stats.xa_cancel_count, 0) as xa_cancel_count,
                COALESCE(part_stats.total_count, 0) as total_count
            FROM projects p
            LEFT JOIN LATERAL (
                SELECT
                    json_agg(
                        json_build_object(
                            'id', ps.id,
                            'date', to_char(ps.schedule_date, 'YYYY-MM-DD"T"HH24:MI:SS'),
                            'time_slots', COALESCE((
                                SELECT json_agg(
                                    json_build_object(
                                        'id', pts.id,
                                        'start_time', pts.start_time,
                                        'end_time', pts.end_time,
                                        'capacity', pts.capacity,
                                        'note', pts.note
                                    ) ORDER BY pts.start_time ASC
                                ) FROM project_time_slots pts WHERE pts.schedule_id = ps.id
                            ), '[]'::json)
                        ) ORDER BY ps.schedule_date ASC
                    ) as project_schedules
                FROM project_schedules ps
                WHERE ps.project_id = p.id
            ) date_stats ON true
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(spr.*) FILTER (WHERE spr.status = 'registered' OR spr.status = 'A_ENTRY') as registered_count,
                    COUNT(spr.*) FILTER (WHERE spr.status = 'attended') as attended_count,
                    COUNT(spr.*) FILTER (WHERE spr.status = 'canceled') as canceled_count,
                    COUNT(spr.*) FILTER (WHERE spr.status = 'A_ENTRY' OR spr.status = 'registered') as a_entry_count,
                    COUNT(spr.*) FILTER (WHERE spr.status = 'B_WAITING') as b_waiting_count,
                    COUNT(spr.*) FILTER (WHERE spr.status = 'C_WAITING') as c_waiting_count,
                    COUNT(spr.*) FILTER (WHERE spr.status = 'D_PASS') as d_pass_count,
                    COUNT(spr.*) FILTER (WHERE spr.status = 'E_FAIL') as e_fail_count,
                    COUNT(spr.*) FILTER (WHERE spr.status = 'XA_CANCEL' OR spr.status = 'canceled') as xa_cancel_count,
                    COUNT(spr.*) as total_count
                FROM student_project_relations spr
                WHERE spr.project_id = p.id
            ) part_stats ON true
            ORDER BY p.created_at DESC
        `);
        // map backward compatibility
        const projects = result.rows.map(r => (Object.assign(Object.assign({}, r), { source: 'project', event_dates: (r.project_schedules || []).map((s) => s.date) })));
        res.json(projects);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getProjects = getProjects;
const createProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description, event_date, event_dates, location, lp_url, type, graduation_year, project_schedules, capacity, target_seats, unit_price, target_sales, current_sales, entry_deadline, kpi_seat_to_entry_rate, kpi_entry_to_interview_rate, kpi_interview_to_reservation_rate, kpi_reservation_to_application_rate, kpi_custom_steps, event_slots } = req.body;
    try {
        const cols = yield getProjectColumns();
        const insertCols = [];
        const insertVals = [];
        const push = (col, val) => {
            if (!cols.has(col))
                return;
            insertCols.push(col);
            insertVals.push(val);
        };
        push('title', title);
        push('type', type || 'event');
        push('description', description || null);
        push('graduation_year', graduation_year || null);
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
        push('kpi_interview_to_reservation_rate', kpi_interview_to_reservation_rate !== null && kpi_interview_to_reservation_rate !== void 0 ? kpi_interview_to_reservation_rate : 50);
        push('kpi_reservation_to_application_rate', kpi_reservation_to_application_rate !== null && kpi_reservation_to_application_rate !== void 0 ? kpi_reservation_to_application_rate : 40);
        push('kpi_custom_steps', Array.isArray(kpi_custom_steps) ? JSON.stringify(kpi_custom_steps) : '[]');
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        yield db_1.default.query('BEGIN');
        const result = yield db_1.default.query(`INSERT INTO projects (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`, insertVals);
        const created = result.rows[0];
        // schedules setup
        // backwards compatibility with event_dates + new project_schedules format
        let schedulesToInsert = [];
        if (project_schedules && Array.isArray(project_schedules)) {
            schedulesToInsert = project_schedules;
        }
        else {
            const rawDates = Array.isArray(event_dates) ? event_dates : (event_date ? [event_date] : []);
            const cleaned = Array.from(new Set(rawDates.map(d => String(d || '').trim()).filter(Boolean)));
            schedulesToInsert = cleaned.map(d => ({ date: d, time_slots: event_slots || [] }));
        }
        for (const sch of schedulesToInsert) {
            if (!sch.date)
                continue;
            const schRes = yield db_1.default.query('INSERT INTO project_schedules (project_id, schedule_date) VALUES ($1, $2) RETURNING id', [created.id, sch.date]);
            const scheduleId = schRes.rows[0].id;
            if (sch.time_slots && Array.isArray(sch.time_slots)) {
                for (const ts of sch.time_slots) {
                    if (!ts.start_time || !ts.end_time)
                        continue;
                    yield db_1.default.query('INSERT INTO project_time_slots (schedule_id, start_time, end_time, capacity, location, note) VALUES ($1, $2, $3, $4, $5, $6)', [scheduleId, ts.start_time, ts.end_time, ts.capacity || null, ts.location || null, ts.note || null]);
                }
            }
        }
        yield db_1.default.query('COMMIT');
        res.json(Object.assign({}, created));
    }
    catch (err) {
        try {
            yield db_1.default.query('ROLLBACK');
        }
        catch (_a) { }
        res.status(500).json({ error: err.message });
    }
});
exports.createProject = createProject;
const updateProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { title, description, location, lp_url, type, graduation_year, project_schedules, yomi_statuses, event_slots, event_date, event_dates } = req.body;
    try {
        const cols = yield getProjectColumns();
        const setParts = [];
        const values = [];
        const pushSet = (col, val) => {
            if (!cols.has(col) || val === undefined)
                return;
            values.push(val);
            setParts.push(`${col} = $${values.length}`);
        };
        pushSet('title', title);
        pushSet('type', type);
        pushSet('description', description);
        pushSet('graduation_year', graduation_year);
        pushSet('location', location);
        pushSet('lp_url', lp_url);
        if (yomi_statuses !== undefined) {
            values.push(JSON.stringify(yomi_statuses));
            setParts.push(`yomi_statuses = $${values.length}`);
        }
        values.push(id);
        yield db_1.default.query('BEGIN');
        if (setParts.length > 0) {
            const result = yield db_1.default.query(`UPDATE projects
                SET ${setParts.join(', ')}
                WHERE id = $${values.length}
                RETURNING *`, values);
            if (result.rows.length === 0) {
                yield db_1.default.query('ROLLBACK');
                res.status(404).json({ error: 'Project not found' });
                return;
            }
        }
        let schedulesToSync = null;
        if (project_schedules && Array.isArray(project_schedules)) {
            schedulesToSync = project_schedules;
        }
        else if (event_dates !== undefined || event_date !== undefined) {
            const rawDates = Array.isArray(event_dates) ? event_dates : (event_date ? [event_date] : []);
            const cleaned = Array.from(new Set(rawDates.map(d => String(d || '').trim()).filter(Boolean)));
            schedulesToSync = cleaned.map(d => ({ date: d, time_slots: event_slots || [] }));
        }
        if (schedulesToSync !== null) {
            // Simplify replacement: delete old schedules and re-insert 
            // Note: In a production app with related student_project_relations data, 
            // deleting schedules will CASCADE or SET NULL on student relation. 
            // Since student_project_relations deletes ON DELETE CASCADE on schedules? 
            // Ah! If we delete schedules, we lose student relations if it sets null or deletes!
            // Wait, schema:
            // student_project_relations: schedule_id INTEGER REFERENCES project_schedules(id) ON DELETE SET NULL
            // Time slots: ON DELETE SET NULL.
            // If we blindly delete, we lose relational integrity! We should update carefully or keep existing.
            // For now, let's keep the existing logic simpler: only add missing schedules safely, or avoid changing if not needed, 
            // but for full edit, let's just insert new ones and delete removed ones manually based on dates.
            const currentSchRes = yield db_1.default.query('SELECT id, schedule_date FROM project_schedules WHERE project_id = $1', [id]);
            const existingDatesMap = {};
            currentSchRes.rows.forEach(r => existingDatesMap[r.schedule_date.toISOString().split('T')[0]] = r.id);
            const keptScheduleIds = new Set();
            for (const sch of schedulesToSync) {
                if (!sch.date)
                    continue;
                const keyDateStr = new Date(sch.date).toISOString().split('T')[0];
                let scheduleId = existingDatesMap[keyDateStr];
                if (!scheduleId) {
                    const schRes = yield db_1.default.query('INSERT INTO project_schedules (project_id, schedule_date) VALUES ($1, $2) RETURNING id', [id, sch.date]);
                    scheduleId = schRes.rows[0].id;
                }
                keptScheduleIds.add(scheduleId);
                // Sycn time slots
                if (sch.time_slots && Array.isArray(sch.time_slots)) {
                    // Delete old timeslots
                    yield db_1.default.query('DELETE FROM project_time_slots WHERE schedule_id = $1', [scheduleId]);
                    for (const ts of sch.time_slots) {
                        // support 'datetime' for backwards compat or 'start_time/end_time'
                        if (ts.start_time && ts.end_time) {
                            yield db_1.default.query('INSERT INTO project_time_slots (schedule_id, start_time, end_time, capacity, location, note) VALUES ($1, $2, $3, $4, $5, $6)', [scheduleId, ts.start_time, ts.end_time, ts.capacity || null, ts.location || null, ts.note || null]);
                        }
                        else if (ts.datetime) {
                            const dummyTime = '12:00:00';
                            yield db_1.default.query('INSERT INTO project_time_slots (schedule_id, start_time, end_time, location, note) VALUES ($1, $2, $3, $4, $5)', [scheduleId, dummyTime, dummyTime, ts.location || null, ts.note || null]);
                        }
                    }
                }
            }
            // Remove dropped schedules 
            for (const existingKey of Object.keys(existingDatesMap)) {
                const eid = existingDatesMap[existingKey];
                if (!keptScheduleIds.has(eid)) {
                    yield db_1.default.query('DELETE FROM project_schedules WHERE id = $1', [eid]);
                }
            }
        }
        yield db_1.default.query('COMMIT');
        res.json({ success: true });
    }
    catch (err) {
        try {
            yield db_1.default.query('ROLLBACK');
        }
        catch (_a) { }
        res.status(500).json({ error: err.message });
    }
});
exports.updateProject = updateProject;
const updateProjectKpi = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { entry_deadline, capacity, target_seats, unit_price, target_sales, current_sales, kpi_seat_to_entry_rate, kpi_entry_to_interview_rate, kpi_interview_to_reservation_rate, kpi_reservation_to_application_rate, kpi_custom_steps } = req.body;
    try {
        const cols = yield getProjectColumns();
        const setParts = [];
        const values = [];
        const pushSet = (col, val) => {
            if (!cols.has(col) || val === undefined)
                return;
            values.push(val);
            setParts.push(`${col} = $${values.length}`);
        };
        pushSet('entry_deadline', entry_deadline);
        pushSet('capacity', capacity);
        pushSet('target_seats', target_seats);
        pushSet('unit_price', unit_price);
        pushSet('target_sales', target_sales);
        pushSet('current_sales', current_sales);
        pushSet('kpi_seat_to_entry_rate', kpi_seat_to_entry_rate);
        pushSet('kpi_entry_to_interview_rate', kpi_entry_to_interview_rate);
        pushSet('kpi_interview_to_reservation_rate', kpi_interview_to_reservation_rate);
        pushSet('kpi_reservation_to_application_rate', kpi_reservation_to_application_rate);
        if (kpi_custom_steps !== undefined) {
            pushSet('kpi_custom_steps', Array.isArray(kpi_custom_steps) ? JSON.stringify(kpi_custom_steps) : '[]');
        }
        if (setParts.length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }
        values.push(id);
        const result = yield db_1.default.query(`UPDATE projects
             SET ${setParts.join(', ')}
             WHERE id = $${values.length}
             RETURNING *`, values);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateProjectKpi = updateProjectKpi;
const getProjectDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const projectRes = yield db_1.default.query('SELECT * FROM projects WHERE id = $1', [id]);
        const scheduleRes = yield db_1.default.query(`
            SELECT 
                ps.id as schedule_id,
                ps.schedule_date,
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', pts.id,
                            'start_time', pts.start_time,
                            'end_time', pts.end_time,
                            'capacity', pts.capacity,
                            'note', pts.note
                        ) ORDER BY pts.start_time ASC
                    ) FROM project_time_slots pts WHERE pts.schedule_id = ps.id
                ) as time_slots
            FROM project_schedules ps
            WHERE ps.project_id = $1
            ORDER BY ps.schedule_date ASC
        `, [id]);
        const participantsRes = yield db_1.default.query(`
            SELECT 
                spr.id as student_event_id,
                spr.student_id,
                spr.status,
                spr.created_at,
                ps.schedule_date,
                pts.start_time,
                pts.end_time,
                spr.schedule_id,
                spr.time_slot_id,
                to_char(ps.schedule_date, 'YYYY-MM-DD"T"HH24:MI:SS') as selected_event_date,
                s.name,
                s.university,
                s.email,
                s.phone,
                s.graduation_year,
                u.name as staff_name,
                t.content as next_task_content,
                t.due_date as next_task_date
            FROM student_project_relations spr
            JOIN students s ON s.id = spr.student_id
            LEFT JOIN users u ON u.id = s.staff_id
            LEFT JOIN project_schedules ps ON ps.id = spr.schedule_id
            LEFT JOIN project_time_slots pts ON pts.id = spr.time_slot_id
            LEFT JOIN LATERAL (
              SELECT content, due_date
              FROM student_tasks
              WHERE student_id = spr.student_id
                AND COALESCE(completed, FALSE) = FALSE
              ORDER BY due_date ASC NULLS LAST
              LIMIT 1
            ) t ON true
            WHERE spr.project_id = $1
            ORDER BY spr.created_at DESC
        `, [id]);
        const p = projectRes.rows[0];
        res.json({
            event: Object.assign(Object.assign({}, p), { source: 'project', project_schedules: scheduleRes.rows, 
                // fallback for compat
                event_dates: scheduleRes.rows.map((r) => r.schedule_date) }),
            participants: participantsRes.rows
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getProjectDetail = getProjectDetail;
const updateParticipantStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, relationId } = req.params;
    const { status, selected_event_date, schedule_id, time_slot_id } = req.body;
    try {
        let setScheduleId = schedule_id;
        // backwards compat lookup
        if (selected_event_date && !schedule_id) {
            const parsedDate = new Date(selected_event_date).toISOString().split('T')[0];
            const schRes = yield db_1.default.query('SELECT id FROM project_schedules WHERE project_id = $1 AND schedule_date = $2', [id, parsedDate]);
            if (schRes.rows.length > 0) {
                setScheduleId = schRes.rows[0].id;
            }
        }
        const result = yield db_1.default.query(`UPDATE student_project_relations
             SET status = $1,
                 schedule_id = COALESCE($2, schedule_id),
                 time_slot_id = COALESCE($3, time_slot_id)
             WHERE id = $4 AND project_id = $5
             RETURNING *`, [status, setScheduleId, time_slot_id || null, relationId, id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateParticipantStatus = updateParticipantStatus;
const deleteProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        // nullify event_id in interview_logs
        yield db_1.default.query('UPDATE interview_logs SET event_id = NULL WHERE event_id = $1', [id]);
        const result = yield db_1.default.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.deleteProject = deleteProject;
const getKgiProgress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const now = new Date();
        const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const todayStr = jstNow.toISOString().slice(0, 10);
        const todayDate = new Date(todayStr + 'T00:00:00');
        const eventsRes = yield db_1.default.query(`
            SELECT
                p.id,
                p.title,
                p.target_seats,
                p.capacity AS capacity_entry,
                COALESCE(p.kpi_seat_to_entry_rate, 70) AS kpi_seat_to_entry_rate,
                COALESCE(p.kpi_entry_to_interview_rate, 60) AS kpi_entry_to_interview_rate,
                COALESCE(p.kpi_interview_to_reservation_rate, 50) AS kpi_interview_to_reservation_rate,
                COALESCE(p.kpi_reservation_to_application_rate, 40) AS kpi_reservation_to_application_rate,
                COALESCE(p.kpi_custom_steps, '[]') AS kpi_custom_steps,
                COALESCE(p.entry_deadline::text, (
                  SELECT MAX(schedule_date::text) FROM project_schedules WHERE project_id = p.id
                )) AS deadline,
                (SELECT MAX(schedule_date::text) FROM project_schedules WHERE project_id = p.id) AS last_slot_date
            FROM projects p
            ORDER BY p.created_at DESC NULLS LAST
        `);
        const statusBreakdownRes = yield db_1.default.query(`
            SELECT
                spr.project_id,
                spr.status,
                COUNT(*) AS cnt
            FROM student_project_relations spr
            GROUP BY spr.project_id, spr.status
        `);
        const breakdownMap = {};
        for (const row of statusBreakdownRes.rows) {
            if (!breakdownMap[row.project_id])
                breakdownMap[row.project_id] = {};
            breakdownMap[row.project_id][row.status] = Number(row.cnt);
        }
        const result = eventsRes.rows.map((e) => {
            const breakdown = breakdownMap[e.id] || {};
            const currentEntry = (breakdown['A_ENTRY'] || 0) + (breakdown['registered'] || 0);
            const currentSeats = breakdown['attended'] || 0;
            const targetSeats = Number(e.target_seats || 0);
            const kpiRate = Number(e.kpi_seat_to_entry_rate || 70);
            const targetEntry = targetSeats > 0 ? Math.round(targetSeats / (kpiRate / 100)) : 0;
            const remainingEntry = Math.max(targetEntry - currentEntry, 0);
            // custom steps
            let customSteps = [];
            try {
                const raw = typeof e.kpi_custom_steps === 'string'
                    ? JSON.parse(e.kpi_custom_steps)
                    : (Array.isArray(e.kpi_custom_steps) ? e.kpi_custom_steps : []);
                if (Array.isArray(raw))
                    customSteps = raw;
            }
            catch (_a) {
                customSteps = [];
            }
            const kpiEntryToInterview = Number(e.kpi_entry_to_interview_rate || 60);
            let daysRemaining = 0;
            let deadlineStr = null;
            const effectiveDeadline = e.deadline || e.last_slot_date;
            if (effectiveDeadline) {
                const raw = String(effectiveDeadline);
                const deadlineDateStr = raw.includes('Z') || raw.includes('+')
                    ? raw.slice(0, 10)
                    : raw.slice(0, 10);
                deadlineStr = deadlineDateStr;
                const deadlineDate = new Date(deadlineDateStr + 'T00:00:00');
                const diffMs = deadlineDate.getTime() - todayDate.getTime();
                daysRemaining = Math.floor(diffMs / 86400000);
            }
            const dailyRequiredInterview = daysRemaining > 0
                ? Math.round((remainingEntry / (kpiEntryToInterview / 100) / daysRemaining) * 10) / 10
                : null;
            return {
                event_id: e.id, // For backwards compatibility UI expects event_id
                event_title: e.title,
                deadline: deadlineStr,
                days_remaining: daysRemaining,
                target_entry: targetEntry,
                kpi_target_entry: targetEntry,
                remaining_entry: remainingEntry,
                daily_required_interview: dailyRequiredInterview,
                kpi_rate: kpiRate,
                kpi_entry_to_interview_rate: kpiEntryToInterview,
                kpi_interview_to_reservation_rate: Number(e.kpi_interview_to_reservation_rate || 50),
                kpi_reservation_to_application_rate: Number(e.kpi_reservation_to_application_rate || 40),
                kpi_custom_steps: customSteps,
                current_entry: currentEntry,
                target_seats: targetSeats,
                current_seats: currentSeats,
                daily_entry_gap: dailyRequiredInterview || 0,
                status_breakdown: breakdown
            };
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getKgiProgress = getKgiProgress;
