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
    faculty VARCHAR(255),
    desired_industry VARCHAR(255),
    desired_role VARCHAR(255),
    graduation_year INTEGER,
    email VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    tags TEXT[],
    staff_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    target_sales INTEGER,
    current_sales INTEGER,
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
-- Seed Data
INSERT INTO users (username, password, name, role)
VALUES ('admin', '$2b$10$K9oIoHcgYoz98Gg.UVQ2AO9Vnk57KPVQ2ekdDPC4392sslwXrUSVy', 'Admin User', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Sample Data (Students)
INSERT INTO students (id, name, university, faculty, desired_industry, desired_role, graduation_year, email, phone, status, tags, staff_id)
VALUES
    (1, '佐藤 拓也', '東京大学', '工学部', 'IT', 'エンジニア', 2026, 'sato@example.com', '090-1234-5678', '選考中', ARRAY['エンジニア志望','競技プログラミング'], 1),
    (2, '鈴木 舞', '早稲田大学', '政治経済学部', 'コンサル', '総合職', 2026, 'suzuki@example.com', '090-8765-4321', '内定', ARRAY['総合職','海外経験'], 1),
    (3, '田中 健一', '慶應義塾大学', '経済学部', 'メーカー', '営業', 2027, 'tanaka@example.com', '080-1111-2222', '面談', ARRAY['営業志望'], 1),
    (4, '高橋 莉奈', '一橋大学', '商学部', '広告', 'デザイナー', 2027, 'takahashi@example.com', '080-3333-4444', '未着手', ARRAY['デザイナー志望'], 1),
    (5, '伊藤 裕樹', '京都大学', '理学部', 'IT', 'データサイエンティスト', 2028, 'ito@example.com', '070-5555-6666', '不合格', ARRAY['データサイエンティスト'], 1),
    (6, '山田 彩', '大阪大学', '文学部', 'メーカー', '企画', 2028, 'yamada@example.com', '070-1111-2222', '辞退', ARRAY['企画志望'], 1),
    (7, '中村 悠人', '名古屋大学', '情報学部', '金融', 'アナリスト', 2027, 'nakamura@example.com', '070-2222-3333', '選考中', ARRAY['数理','英語'], 1)
ON CONFLICT (id) DO NOTHING;

-- Sample Data (Events)
INSERT INTO events (id, title, description, event_date, location, capacity, target_seats, target_sales, current_sales)
VALUES
    (1, '春季キャリアフォーラム', '各業界の企業が参加する大規模イベント', '2026-03-20 13:00:00', '東京ビッグサイト', 100, 80, 2000000, 1200000),
    (2, 'エンジニア向け座談会', '現場エンジニアとの座談会', '2026-04-15 18:00:00', 'オンライン', 50, 40, 800000, 300000),
    (3, '内定者懇親会', '内定者同士の交流イベント', '2026-06-01 17:00:00', '本社オフィス', 30, 25, 400000, 150000),
    (4, '業界研究セミナー', '複数業界の理解を深めるセミナー', '2026-02-20 19:00:00', 'オンライン', 200, 150, 500000, 220000)
ON CONFLICT (id) DO NOTHING;

-- Sample Data (Student-Event Participation)
INSERT INTO student_events (student_id, event_id, status, created_at)
VALUES
    (1, 1, 'attended', '2026-02-10 10:00:00'),
    (1, 2, 'registered', '2026-03-01 09:00:00'),
    (2, 1, 'attended', '2026-02-15 11:00:00'),
    (2, 3, 'registered', '2026-05-01 12:00:00'),
    (3, 1, 'canceled', '2026-02-20 12:30:00'),
    (7, 4, 'registered', '2026-02-05 13:00:00')
ON CONFLICT DO NOTHING;

-- Sample Data (Interview Logs)
INSERT INTO interview_logs (student_id, staff_id, log_type, event_id, content, interview_date, created_at)
VALUES
    (1, 1, '面談', NULL, '志望職種の確認とスキルヒアリング', '2026-02-01 10:00:00', '2026-02-01 10:00:00'),
    (1, 1, 'エントリー', 2, 'エンジニア向け座談会にエントリー', '2026-02-05 14:00:00', '2026-02-05 14:00:00'),
    (2, 1, '面談', NULL, '海外経験の詳細を確認', '2026-01-20 15:00:00', '2026-01-20 15:00:00'),
    (3, 1, '面談', NULL, '業界志望の整理', '2026-02-03 11:00:00', '2026-02-03 11:00:00'),
    (4, 1, 'エントリー', 1, '春季キャリアフォーラムにエントリー', '2026-02-02 16:00:00', '2026-02-02 16:00:00')
ON CONFLICT DO NOTHING;
