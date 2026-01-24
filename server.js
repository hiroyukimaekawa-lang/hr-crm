const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL Connection Pool
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err.stack);
    } else {
        console.log('Database connected successfully at:', res.rows[0].now);
    }
});

// --- API Endpoints ---

// 1. Get all students with their status
app.get('/api/students', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT s.*, st.name as status_name 
      FROM students s
      LEFT JOIN applications a ON s.id = a.student_id
      LEFT JOIN statuses st ON a.status_id = st.id
      ORDER BY s.created_at DESC
    `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 2. Register a new student
app.post('/api/students', async (req, res) => {
    const { name, email, phone, university, major, graduation_year } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO students (name, email, phone, university, major, graduation_year) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, email, phone, university, major, graduation_year]
        );

        const newStudent = result.rows[0];

        // Default status: '未対応 (New)' (ID: 1)
        await pool.query(
            'INSERT INTO applications (student_id, status_id) VALUES ($1, $2)',
            [newStudent.id, 1]
        );

        res.status(201).json(newStudent);
    } catch (err) {
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Update student status
app.put('/api/students/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status_id } = req.body;

    try {
        await pool.query(
            'UPDATE applications SET status_id = $1, last_updated = CURRENT_TIMESTAMP WHERE student_id = $2',
            [status_id, id]
        );
        res.json({ message: 'Status updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. Add a note for a student
app.post('/api/students/:id/notes', async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO notes (student_id, content) VALUES ($1, $2) RETURNING *',
            [id, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 5. Get notes for a student
app.get('/api/students/:id/notes', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM notes WHERE student_id = $1 ORDER BY created_at DESC', [id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// サーバーを起動
app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました`);
});