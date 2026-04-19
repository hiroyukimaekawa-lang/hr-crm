require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkInoue() {
  try {
    console.log('Searching for student "井上幸音"...');
    const res = await pool.query('SELECT * FROM students WHERE name LIKE $1', ['%井上幸音%']);
    console.log('Results:', res.rows);
    
    if (res.rows.length === 0) {
      console.log('No student found with that name.');
    } else {
      const student = res.rows[0];
      console.log(`Found student ID: ${student.id}`);
      
      // Check if ID 545 exists specifically
      const res545 = await pool.query('SELECT * FROM students WHERE id = 545');
      console.log('Lookup ID 545:', res545.rows);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkInoue();
