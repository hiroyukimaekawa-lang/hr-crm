import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    console.log('Starting migration from events to projects...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('1. Copying events to projects...');
        const eventsRes = await client.query('SELECT * FROM events');
        
        for (const event of eventsRes.rows) {
            // Check if project already exists to make script idempotent
            const checkRes = await client.query('SELECT id FROM projects WHERE id = $1', [event.id]);
            if (checkRes.rows.length === 0) {
                await client.query(`
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
        await client.query(`SELECT setval('projects_id_seq', COALESCE((SELECT MAX(id)+1 FROM projects), 1), false)`);

        console.log('2. Migrating event_dates to project_schedules...');
        const eventDatesRes = await client.query('SELECT * FROM event_dates');
        const eventDateScheduleMap: Record<number, Record<string, number>> = {}; // event_id -> { YYYY-MM-DD: schedule_id }

        for (const ed of eventDatesRes.rows) {
            const dateStr = ed.event_date.toISOString().split('T')[0];
            const checkRes = await client.query(
                'SELECT id FROM project_schedules WHERE project_id = $1 AND schedule_date = $2',
                [ed.event_id, dateStr]
            );
            
            let scheduleId;
            if (checkRes.rows.length === 0) {
                const insertRes = await client.query(
                    'INSERT INTO project_schedules (project_id, schedule_date, created_at) VALUES ($1, $2, $3) RETURNING id',
                    [ed.event_id, dateStr, ed.created_at]
                );
                scheduleId = insertRes.rows[0].id;
            } else {
                scheduleId = checkRes.rows[0].id;
            }

            if (!eventDateScheduleMap[ed.event_id]) {
                eventDateScheduleMap[ed.event_id] = {};
            }
            eventDateScheduleMap[ed.event_id][dateStr] = scheduleId;
        }

        console.log('3. Migrating student_events to student_project_relations...');
        const studentEventsRes = await client.query('SELECT * FROM student_events');
        
        for (const se of studentEventsRes.rows) {
            let scheduleId = null;
            if (se.selected_event_date) {
                const dateStr = se.selected_event_date.toISOString().split('T')[0];
                if (eventDateScheduleMap[se.event_id] && eventDateScheduleMap[se.event_id][dateStr]) {
                    scheduleId = eventDateScheduleMap[se.event_id][dateStr];
                } else {
                    // Try to find schedule directly
                    const scheduleRes = await client.query(
                        'SELECT id FROM project_schedules WHERE project_id = $1 AND schedule_date = $2',
                        [se.event_id, dateStr]
                    );
                    if (scheduleRes.rows.length > 0) {
                        scheduleId = scheduleRes.rows[0].id;
                    } else {
                        // Create ad-hoc schedule if missing
                        const insertRes = await client.query(
                            'INSERT INTO project_schedules (project_id, schedule_date) VALUES ($1, $2) RETURNING id',
                            [se.event_id, dateStr]
                        );
                        scheduleId = insertRes.rows[0].id;
                        if (!eventDateScheduleMap[se.event_id]) eventDateScheduleMap[se.event_id] = {};
                        eventDateScheduleMap[se.event_id][dateStr] = scheduleId;
                    }
                }
            }

            // Check if exists
            const checkRes = await client.query(
                `SELECT id FROM student_project_relations 
                 WHERE student_id = $1 AND project_id = $2 
                 AND COALESCE(schedule_id, 0) = COALESCE($3, 0)`,
                [se.student_id, se.event_id, scheduleId]
            );

            if (checkRes.rows.length === 0) {
                await client.query(`
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
        await client.query(`SELECT setval('student_project_relations_id_seq', COALESCE((SELECT MAX(id)+1 FROM student_project_relations), 1), false)`);

        await client.query('COMMIT');
        console.log('Migration completed successfully!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
