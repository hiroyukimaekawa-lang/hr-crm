
const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('--- Sales Data (AFTER FIX) ---');
    const res = await pool.query(`
        SELECT
            e.id AS event_id,
            e.title AS event_title,
            COALESCE(e.unit_price, 0)::int AS unit_price,
            COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'attended')::int AS attended_count,
            (COALESCE(e.unit_price, 0) * COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'attended'))::bigint AS sales
        FROM events e
        LEFT JOIN student_events se ON se.event_id = e.id
        LEFT JOIN jsonb_array_elements(CASE WHEN e.event_slots IS NOT NULL AND jsonb_array_length(e.event_slots) > 0 THEN e.event_slots ELSE '[]'::jsonb END) AS slot ON true
        WHERE (LEFT(slot->>'datetime', 7) = '2026-04' OR TO_CHAR(e.event_date, 'YYYY-MM') = '2026-04')
        GROUP BY e.id, e.title, e.unit_price
        ORDER BY sales DESC
    `);
    console.log(JSON.stringify(res.rows, null, 2));

    const totalSales = res.rows.reduce((sum, r) => sum + Number(r.sales || 0), 0);
    console.log('\nTotal Sales:', totalSales);

    console.log('\n--- Breakdown of "28卒タイプ就活" status ---');
    const resType = await pool.query(`
        SELECT se.status, COUNT(*) 
        FROM student_events se 
        JOIN events e ON se.event_id = e.id 
        WHERE e.title LIKE '%タイプ就活%' 
        GROUP BY se.status
    `);
    console.log(JSON.stringify(resType.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
