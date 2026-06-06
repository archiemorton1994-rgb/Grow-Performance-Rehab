import { eq } from 'drizzle-orm';
import { db, pool } from './db';
import { users, otps } from '../shared/schema';

export interface AuthUser {
  id: string;
  email: string;
  createdAt?: string;
}

export interface OtpEntry {
  code: string;
  expiresAt: number;
}

export interface IStorage {
  getUserById(id: string): Promise<AuthUser | undefined>;
  getUserByEmail(email: string): Promise<AuthUser | undefined>;
  upsertUser(email: string): Promise<AuthUser>;
  setOtp(email: string, code: string, ttlMs: number): Promise<void>;
  getOtp(email: string): Promise<OtpEntry | undefined>;
  clearOtp(email: string): Promise<void>;
  loadRateLimits(storeName: string): Promise<Map<string, number[]>>;
  saveRateLimits(storeName: string, email: string, timestamps: number[]): Promise<void>;
  loadCounters(storeName: string): Promise<Map<string, number>>;
  saveCounter(storeName: string, email: string, count: number): Promise<void>;
  deleteCounter(storeName: string, email: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async getUserById(id: string): Promise<AuthUser | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<AuthUser | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async upsertUser(email: string): Promise<AuthUser> {
    const norm = email.toLowerCase().trim();
    await db.insert(users).values({ email: norm }).onConflictDoNothing();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, norm));
    return user!;
  }

  async setOtp(email: string, code: string, ttlMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs);
    await db
      .insert(otps)
      .values({ email: email.toLowerCase(), code, expiresAt })
      .onConflictDoUpdate({
        target: otps.email,
        set: { code, expiresAt },
      });
  }

  async getOtp(email: string): Promise<OtpEntry | undefined> {
    const [row] = await db
      .select()
      .from(otps)
      .where(eq(otps.email, email.toLowerCase()));
    if (!row) return undefined;
    return { code: row.code, expiresAt: row.expiresAt.getTime() };
  }

  async clearOtp(email: string): Promise<void> {
    await db.delete(otps).where(eq(otps.email, email.toLowerCase()));
  }

  async loadRateLimits(storeName: string): Promise<Map<string, number[]>> {
    const result = await pool.query<{ email: string; timestamps: string }>(
      'SELECT email, timestamps FROM rate_limits WHERE store_name = $1',
      [storeName],
    );
    const windowStart = Date.now() - 10 * 60 * 1000;
    const map = new Map<string, number[]>();
    for (const row of result.rows) {
      const ts: number[] = JSON.parse(row.timestamps).filter((t: number) => t > windowStart);
      if (ts.length > 0) {
        map.set(row.email, ts);
      }
    }
    return map;
  }

  async saveRateLimits(storeName: string, email: string, timestamps: number[]): Promise<void> {
    await pool.query(
      `INSERT INTO rate_limits (store_name, email, timestamps)
       VALUES ($1, $2, $3)
       ON CONFLICT (store_name, email) DO UPDATE SET timestamps = EXCLUDED.timestamps`,
      [storeName, email, JSON.stringify(timestamps)],
    );
  }

  async loadCounters(storeName: string): Promise<Map<string, number>> {
    const result = await pool.query<{ email: string; timestamps: string }>(
      'SELECT email, timestamps FROM rate_limits WHERE store_name = $1',
      [storeName],
    );
    const map = new Map<string, number>();
    for (const row of result.rows) {
      const count = parseInt(row.timestamps, 10);
      if (!isNaN(count) && count > 0) {
        map.set(row.email, count);
      }
    }
    return map;
  }

  async saveCounter(storeName: string, email: string, count: number): Promise<void> {
    await pool.query(
      `INSERT INTO rate_limits (store_name, email, timestamps)
       VALUES ($1, $2, $3)
       ON CONFLICT (store_name, email) DO UPDATE SET timestamps = EXCLUDED.timestamps`,
      [storeName, email, String(count)],
    );
  }

  async deleteCounter(storeName: string, email: string): Promise<void> {
    await pool.query(
      'DELETE FROM rate_limits WHERE store_name = $1 AND email = $2',
      [storeName, email],
    );
  }
}

export const storage = new DbStorage();
