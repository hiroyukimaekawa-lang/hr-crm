const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || \`postgres://postgres.gpehiglyidgrwgmgllur:MeRaise2025!@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres\`
});

async function run() {
  try {
    const res = await pool.query("SELECT id, title, event_date, entry_deadline FROM events WHERE title ILIKE '%ジョブハント%' OR title ILIKE '%Job Hunt%'");
    console.log('--- FOUND EVENTS ---');
    console.log(JSON.stringify(res.rows, null, 2));
    
    if (res.rows.length === 0) {
      const all = await pool.query("SELECT id, title FROM events ORDER BY id DESC LIMIT 20");
      console.log('--- LATEST 20 EVENTS ---');
      console.log(JSON.stringify(all.rows, null, 2));
    }
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await pool.end();
  }
}

run();
