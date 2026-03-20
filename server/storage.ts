import { randomUUID } from 'crypto';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
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

export class MemStorage implements IStorage {
  private users = new Map<string, AuthUser>();
  private otps = new Map<string, OtpEntry>();

  async getUserById(id: string): Promise<AuthUser | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<AuthUser | undefined> {
    return Array.from(this.users.values()).find(
      (u) => u.email === email.toLowerCase(),
    );
  }

  async upsertUser(email: string): Promise<AuthUser> {
    const existing = await this.getUserByEmail(email);
    if (existing) return existing;
    const user: AuthUser = {
      id: randomUUID(),
      email: email.toLowerCase().trim(),
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
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

export const storage = new MemStorage();
