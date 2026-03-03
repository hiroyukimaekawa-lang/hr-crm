-- Users (Staff)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    -- Plain text for trial as requested
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Students
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    university VARCHAR(255),
    academic_track VARCHAR(20),
    faculty VARCHAR(255),
    referral_status VARCHAR(50) DEFAULT '不明',
    progress_stage VARCHAR(50) DEFAULT '初回面談',
    meeting_decided_date DATE,
    first_interview_date DATE,
    next_meeting_date DATE,
    next_action TEXT,
    desired_industry VARCHAR(255),
    desired_role VARCHAR(255),
    graduation_year INTEGER,
    email VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    tags TEXT[],
    staff_id INTEGER REFERENCES users(id),
    source_company VARCHAR(255),
    interview_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Student Tasks
CREATE TABLE IF NOT EXISTS student_tasks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    due_date DATE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Events
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date TIMESTAMP,
    entry_deadline TIMESTAMP,
    kpi_seat_to_entry_rate NUMERIC(5,2) DEFAULT 70,
    kpi_entry_to_interview_rate NUMERIC(5,2) DEFAULT 60,
    kpi_interview_to_inflow_rate NUMERIC(5,2) DEFAULT 50,
    kpi_custom_steps TEXT DEFAULT '[]',
    location VARCHAR(255),
    capacity INTEGER,
    target_seats INTEGER,
    unit_price INTEGER,
    target_sales INTEGER,
    current_sales INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Event Dates (multiple dates for one event title)
CREATE TABLE IF NOT EXISTS event_dates (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Student-Event Linking
CREATE TABLE IF NOT EXISTS student_events (
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'registered',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, event_id)
);
-- Interview Logs
CREATE TABLE IF NOT EXISTS interview_logs (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES users(id),
    log_type VARCHAR(50) DEFAULT '面談',
    event_id INTEGER REFERENCES events(id),
    content TEXT NOT NULL,
    interview_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Interview Schedules (for lead-time / reschedule KPI)
CREATE TABLE IF NOT EXISTS interview_schedules (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    round_no INTEGER NOT NULL,
    scheduled_at TIMESTAMP,
    actual_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    schedule_type VARCHAR(50) NOT NULL DEFAULT '面談',
    reschedule_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, round_no)
);
-- Invites
CREATE TABLE IF NOT EXISTS invites (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'staff',
    used_at TIMESTAMP,
    used_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_students_staff_id ON students(staff_id);
CREATE INDEX IF NOT EXISTS idx_students_source_company ON students(source_company);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_dedupe ON students(name, university, faculty);
CREATE INDEX IF NOT EXISTS idx_students_next_meeting_date ON students(next_meeting_date);
CREATE INDEX IF NOT EXISTS idx_student_tasks_student_created ON student_tasks(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_tasks_student_due_date ON student_tasks(student_id, due_date);
CREATE INDEX IF NOT EXISTS idx_student_events_event_id ON student_events(event_id);
CREATE INDEX IF NOT EXISTS idx_student_events_student_id ON student_events(student_id);
CREATE INDEX IF NOT EXISTS idx_student_events_event_status ON student_events(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_dates_event_id_date ON event_dates(event_id, event_date);
CREATE INDEX IF NOT EXISTS idx_interview_logs_student_created ON interview_logs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_student_round ON interview_schedules(student_id, round_no);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_student_type ON interview_schedules(student_id, schedule_type);
-- Seed Data
INSERT INTO users (username, password, name, role)
VALUES ('admin', '$2b$10$K9oIoHcgYoz98Gg.UVQ2AO9Vnk57KPVQ2ekdDPC4392sslwXrUSVy', 'Admin User', 'admin') ON CONFLICT (username) DO NOTHING;

-- Sample Data (Events)
INSERT INTO events (id, title, description, event_date, location, capacity, target_seats, unit_price, target_sales, current_sales)
VALUES
    (2, 'エンジニア向け座談会', '現場エンジニアとの座談会', '2026-04-15 18:00:00', 'オンライン', 50, 40, 20000, 800000, 300000),
    (3, '内定者懇親会', '内定者同士の交流イベント', '2026-06-01 17:00:00', '本社オフィス', 30, 25, 16000, 400000, 150000),
    (4, '業界研究セミナー', '複数業界の理解を深めるセミナー', '2026-02-20 19:00:00', 'オンライン', 200, 150, 3000, 500000, 220000)
ON CONFLICT (id) DO NOTHING;
