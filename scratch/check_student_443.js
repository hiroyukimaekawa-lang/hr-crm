
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    ssl: { rejectUnauthorized: false }
});

async function checkStudent() {
  try {
    const studentId = 443;
    console.log(`--- Student Info for ID ${studentId} ---`);
    const res = await pool.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (res.rows.length === 0) {
      console.log('Student not found');
    } else {
      console.log(JSON.stringify(res.rows[0], null, 2));
    }

    console.log(`\n--- Matcher Funnel for ID ${studentId} ---`);
    const matcherRes = await pool.query('SELECT * FROM matcher_funnel_logs WHERE student_id = $1', [studentId]);
    console.log(JSON.stringify(matcherRes.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkStudent();
