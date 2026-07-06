import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool, { schema });

/**
 * Ensure required tables exist. Called once at server startup so fresh
 * environments self-initialise without a separate migration step.
 */
export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      store_name TEXT NOT NULL,
      email      TEXT NOT NULL,
      timestamps TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (store_name, email)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS otps (
      email      TEXT PRIMARY KEY,
      code       TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_data (
      user_id  VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data     JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await Promise.all([cleanupExpiredRateLimits(), cleanupExpiredOtps()]);
  setInterval(cleanupExpiredRateLimits, 60 * 60 * 1000);
  setInterval(cleanupExpiredOtps, 60 * 60 * 1000);
}

/**
 * Delete OTP rows that have passed their expires_at timestamp.
 */
async function cleanupExpiredOtps(): Promise<void> {
  await pool.query(`DELETE FROM otps WHERE expires_at <= NOW()`);
}

/**
 * Delete rate_limit rows whose JSON timestamp arrays contain no entries
 * within the 10-minute sliding window. Rows using the plain-integer
 * counter format (store_name != 'otp') are left untouched.
 */
async function cleanupExpiredRateLimits(): Promise<void> {
  const windowMs = 10 * 60 * 1000;
  await pool.query(
    `
    DELETE FROM rate_limits
    WHERE timestamps LIKE '[%'
      AND (
        timestamps = '[]'
        OR (
          SELECT MAX(elem::bigint)
          FROM jsonb_array_elements_text(timestamps::jsonb) AS elem
        ) <= (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint - $1
      )
  `,
    [windowMs]
  );
}

export { pool };
