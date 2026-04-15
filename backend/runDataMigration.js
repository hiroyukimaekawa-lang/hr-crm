// Migrate existing events → projects + project_schedules + student_project_relations
const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.gpehiglyidgrwgmgllur',
  password: 'MeRaise2025!',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected. Checking existing data...');

    // Check existing events
    const eventsRes = await client.query('SELECT * FROM events ORDER BY id ASC');
    console.log(`Found ${eventsRes.rows.length} events to migrate`);

    const alreadyMigrated = await client.query('SELECT id FROM projects WHERE id > 0 LIMIT 1');
    if (alreadyMigrated.rows.length > 0) {
      console.log('ℹ️  projects table already has data - running idempotent migration (skipping existing)...');
    }

    let migrated = 0;
    let skipped = 0;

    for (const ev of eventsRes.rows) {
      await client.query('BEGIN');
      try {
        // Check if already migrated (by matching title+created_at)
        const exists = await client.query(
          `SELECT id FROM projects WHERE title = $1 AND created_at::text LIKE $2 LIMIT 1`,
          [ev.title, (ev.created_at ? ev.created_at.toISOString().slice(0, 10) : '%') + '%']
        );

        let projectId;
        if (exists.rows.length > 0) {
          projectId = exists.rows[0].id;
          skipped++;
        } else {
          // Insert into projects
          const toInt = (v) => v != null ? Math.round(Number(v)) || null : null;
          const toNum = (v) => v != null ? parseFloat(v) || null : null;

          const proj = await client.query(`
            INSERT INTO projects (
              title, type, description, location, lp_url,
              capacity, target_seats, unit_price, target_sales, current_sales,
              entry_deadline,
              kpi_seat_to_entry_rate, kpi_entry_to_interview_rate,
              kpi_interview_to_reservation_rate, kpi_reservation_to_application_rate,
              kpi_custom_steps,
              created_at, updated_at
            ) VALUES (
              $1, 'event', $2, $3, $4,
              $5, $6, $7, $8, $9,
              $10,
              COALESCE($11, 70), COALESCE($12, 60),
              COALESCE($13, 50), COALESCE($14, 40),
              COALESCE($15, '[]'),
              COALESCE($16, NOW()), COALESCE($17, NOW())
            ) RETURNING id`,
            [
              ev.title,
              ev.description || null,
              ev.location || null,
              ev.lp_url || null,
              toInt(ev.capacity),
              toInt(ev.target_seats),
              toInt(ev.unit_price),
              toInt(ev.target_sales),
              toInt(ev.current_sales),
              ev.entry_deadline || null,
              toNum(ev.kpi_seat_to_entry_rate),
              toNum(ev.kpi_entry_to_interview_rate),
              toNum(ev.kpi_interview_to_reservation_rate),
              toNum(ev.kpi_reservation_to_application_rate),
              ev.kpi_custom_steps || '[]',
              ev.created_at || null,
              ev.updated_at || null
            ]
          );
          projectId = proj.rows[0].id;
          migrated++;
        }

        // Migrate event_dates → project_schedules
        const datesRes = await client.query(
          'SELECT * FROM event_dates WHERE event_id = $1 ORDER BY event_date ASC',
          [ev.id]
        );

        for (const d of datesRes.rows) {
          const schExists = await client.query(
            'SELECT id FROM project_schedules WHERE project_id = $1 AND schedule_date = $2 LIMIT 1',
            [projectId, d.event_date]
          );
          if (schExists.rows.length === 0) {
            await client.query(
              'INSERT INTO project_schedules (project_id, schedule_date, created_at) VALUES ($1, $2, $3)',
              [projectId, d.event_date, d.created_at || new Date()]
            );
          }
        }

        // Also handle single event_date if no event_dates rows
        if (datesRes.rows.length === 0 && ev.event_date) {
          const schExists = await client.query(
            'SELECT id FROM project_schedules WHERE project_id = $1 AND schedule_date = $2 LIMIT 1',
            [projectId, ev.event_date]
          );
          if (schExists.rows.length === 0) {
            await client.query(
              'INSERT INTO project_schedules (project_id, schedule_date) VALUES ($1, $2)',
              [projectId, ev.event_date]
            );
          }
        }

        // Migrate student_events → student_project_relations
        const seRes = await client.query(
          'SELECT * FROM student_events WHERE event_id = $1',
          [ev.id]
        );

        for (const se of seRes.rows) {
          // Find matching schedule_id from selected_event_date
          let scheduleId = null;
          if (se.selected_event_date) {
            const dateOnly = new Date(se.selected_event_date).toISOString().slice(0, 10);
            const sch = await client.query(
              'SELECT id FROM project_schedules WHERE project_id = $1 AND schedule_date = $2 LIMIT 1',
              [projectId, dateOnly]
            );
            if (sch.rows.length > 0) scheduleId = sch.rows[0].id;
          }

          // Upsert into student_project_relations
          await client.query(`
            INSERT INTO student_project_relations
              (student_id, project_id, schedule_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING`,
            [
              se.student_id,
              projectId,
              scheduleId,
              se.status || 'registered',
              se.created_at || new Date(),
              se.updated_at || new Date()
            ]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Failed to migrate event id=${ev.id} "${ev.title}":`, err.message);
      }
    }

    console.log(`\n✅ Data migration complete!`);
    console.log(`   Migrated: ${migrated} events`);
    console.log(`   Skipped (already existed): ${skipped}`);

    const projCount = await client.query('SELECT COUNT(*) FROM projects');
    const schCount = await client.query('SELECT COUNT(*) FROM project_schedules');
    const relCount = await client.query('SELECT COUNT(*) FROM student_project_relations');
    console.log(`\n📊 Current counts:`);
    console.log(`   projects: ${projCount.rows[0].count}`);
    console.log(`   project_schedules: ${schCount.rows[0].count}`);
    console.log(`   student_project_relations: ${relCount.rows[0].count}`);

  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
