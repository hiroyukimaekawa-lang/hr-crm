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
-- Seed Data
INSERT INTO users (username, password, name, role)
VALUES ('admin', '$2b$10$K9oIoHcgYoz98Gg.UVQ2AO9Vnk57KPVQ2ekdDPC4392sslwXrUSVy', 'Admin User', 'admin') ON CONFLICT (username) DO NOTHING;

-- Sample Data (Events)
INSERT INTO events (id, title, description, event_date, location, capacity, target_seats, unit_price, target_sales, current_sales)
VALUES
    (1, '春季キャリアフォーラム', '各業界の企業が参加する大規模イベント', '2026-03-20 13:00:00', '東京ビッグサイト', 100, 80, 25000, 2000000, 1200000),
    (2, 'エンジニア向け座談会', '現場エンジニアとの座談会', '2026-04-15 18:00:00', 'オンライン', 50, 40, 20000, 800000, 300000),
    (3, '内定者懇親会', '内定者同士の交流イベント', '2026-06-01 17:00:00', '本社オフィス', 30, 25, 16000, 400000, 150000),
    (4, '業界研究セミナー', '複数業界の理解を深めるセミナー', '2026-02-20 19:00:00', 'オンライン', 200, 150, 3000, 500000, 220000)
ON CONFLICT (id) DO NOTHING;
