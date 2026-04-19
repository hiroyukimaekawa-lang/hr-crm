const { Pool } = require('pg');
require('dotenv').config({ path: '/Users/maekawahiroyuki/Desktop/hr-crm/backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkGoals() {
  try {
    const res = await pool.query(`
      SELECT * FROM kpi_goals 
      WHERE (period_start >= '2026-04-01' AND period_start < '2026-05-01')
      OR (scope_type IN ('event', 'project'))
      ORDER BY period_start DESC, scope_id
    `);
    console.log('Goals found:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkGoals();
