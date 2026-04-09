const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool();

async function run() {
  try {
    const res = await pool.query("SELECT * FROM events WHERE title LIKE '%ジョブハント%' OR title LIKE '%Job Hunt%' ORDER BY id DESC LIMIT 10");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
