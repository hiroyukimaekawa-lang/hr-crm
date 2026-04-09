const appMonthCond = '';
const sSourceFilter = '';
const yearFilter = '';
const intMonthCond = '';

const sql = `
WITH app_s AS (
    SELECT COUNT(DISTINCT a.student_id)::int AS cnt FROM applications a JOIN students s ON s.id = a.student_id
    WHERE a.student_id IS NOT NULL ${appMonthCond} ${sSourceFilter} ${yearFilter}
),
first_interview_per_student AS (
    SELECT
        i.student_id,
        i.scheduled_at,
        i.interviewed_at,
        i.status,
        ROW_NUMBER() OVER (PARTITION BY i.student_id ORDER BY i.scheduled_at ASC NULLS LAST, i.id ASC) as rn
    FROM interviews i
    JOIN students s ON s.id = i.student_id
    WHERE i.student_id IS NOT NULL ${sSourceFilter} ${yearFilter}
),
reserve_s AS (
    SELECT COUNT(DISTINCT student_id)::int AS cnt 
    FROM first_interview_per_student
    WHERE rn = 1 
      AND (status = 'scheduled' OR interviewed_at IS NOT NULL)
      ${intMonthCond.replace('i.scheduled_at', 'scheduled_at')}
),
interview_completed_s AS (
    SELECT COUNT(DISTINCT student_id)::int AS cnt
    FROM first_interview_per_student
    WHERE rn = 1 
      AND interviewed_at IS NOT NULL
      ${intMonthCond.replace('i.scheduled_at', 'scheduled_at')}
)
SELECT * FROM app_s, reserve_s, interview_completed_s
`;

const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/hrcrm_db' });
client.connect().then(() => client.query(sql)).then(console.log).catch(console.error).finally(() => client.end());
