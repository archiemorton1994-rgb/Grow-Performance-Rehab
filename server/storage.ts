import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from '../shared/schema';

export interface AuthUser {
  id: string;
  email: string;
  createdAt?: string;
}

interface OtpEntry {
  code: string;
  expiresAt: number;
}

export interface IStorage {
  getUserById(id: string): Promise<AuthUser | undefined>;
  getUserByEmail(email: string): Promise<AuthUser | undefined>;
  upsertUser(email: string): Promise<AuthUser>;
  setOtp(email: string, code: string, ttlMs: number): void;
  getOtp(email: string): OtpEntry | undefined;
  clearOtp(email: string): void;
}

export class DbStorage implements IStorage {
  private otps = new Map<string, OtpEntry>();

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

  setOtp(email: string, code: string, ttlMs: number): void {
    this.otps.set(email.toLowerCase(), { code, expiresAt: Date.now() + ttlMs });
  }

  getOtp(email: string): OtpEntry | undefined {
    return this.otps.get(email.toLowerCase());
  }

  clearOtp(email: string): void {
    this.otps.delete(email.toLowerCase());
  }
}

export const storage = new DbStorage();
