import { randomUUID } from 'crypto';

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface IStorage {
  getUserById(id: string): Promise<AuthUser | undefined>;
  getUserByEmail(email: string): Promise<AuthUser | undefined>;
  createUser(email: string, passwordHash: string): Promise<AuthUser>;
}

export class MemStorage implements IStorage {
  private users = new Map<string, AuthUser>();

  async getUserById(id: string): Promise<AuthUser | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<AuthUser | undefined> {
    return Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async createUser(email: string, passwordHash: string): Promise<AuthUser> {
    const user: AuthUser = {
      id: randomUUID(),
      email: email.toLowerCase().trim(),
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }
}

export const storage = new MemStorage();
