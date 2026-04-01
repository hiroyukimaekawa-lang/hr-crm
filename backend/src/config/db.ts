import { Pool, types } from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();
dns.setDefaultResultOrder('ipv4first');

// DATE型 (OID 1082) をJS Dateに変換せず文字列のまま返す
// → タイムゾーンによる日付ずれを防止
types.setTypeParser(1082, (val: string) => val);

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
    keepAlive: true,
    ssl: {
        rejectUnauthorized: false,
        servername: process.env.DB_SSL_SERVERNAME || process.env.DB_HOST,
    },
});

export default pool;
