// Standalone migration: create projects/schedules/time_slots/student_project_relations
const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.gpehiglyidgrwgmgllur',
  password: 'MeRaise2025!',
  ssl: { rejectUnauthorized: false }
});

const SQL = `
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'event',
    description TEXT,
    graduation_year INTEGER,
    entry_deadline TIMESTAMP,
    kpi_seat_to_entry_rate NUMERIC(5,2) DEFAULT 70,
    kpi_entry_to_interview_rate NUMERIC(5,2) DEFAULT 60,
    kpi_interview_to_reservation_rate NUMERIC(5,2) DEFAULT 50,
    kpi_reservation_to_application_rate NUMERIC(5,2) DEFAULT 40,
    kpi_custom_steps TEXT DEFAULT '[]',
    yomi_statuses JSONB DEFAULT '["A_ENTRY","B_WAITING","C_WAITING","D_PASS","E_FAIL","XA_CANCEL"]',
    location VARCHAR(255),
    lp_url VARCHAR(255),
    capacity INTEGER,
    target_seats INTEGER,
    unit_price INTEGER,
    target_sales INTEGER,
    current_sales INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_schedules (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_time_slots (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES project_schedules(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER,
    note VARCHAR(255),
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_project_relations (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    schedule_id INTEGER REFERENCES project_schedules(id) ON DELETE SET NULL,
    time_slot_id INTEGER REFERENCES project_time_slots(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'registered',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_project_unique_triplet
    ON student_project_relations(student_id, project_id, COALESCE(schedule_id, 0), COALESCE(time_slot_id, 0));
CREATE INDEX IF NOT EXISTS idx_student_project_project_id ON student_project_relations(project_id);
CREATE INDEX IF NOT EXISTS idx_student_project_student_id ON student_project_relations(student_id);
`;

async function run() {
  try {
    console.log('Connecting to DB...');
    await client.connect();
    console.log('Connected. Running migration...');
    await client.query(SQL);
    console.log('✅ Migration complete! Tables created (or already existed).');

    // Verify tables exist
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('projects','project_schedules','project_time_slots','student_project_relations')
      ORDER BY table_name;
    `);
    console.log('Tables confirmed:', res.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
