import type { Express, Request, Response } from 'express';
import { createServer, type Server } from 'node:http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

const JWT_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-prod';
const JWT_EXPIRY = '30d';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const existing = await storage.getUserByEmail(email.trim());
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await storage.createUser(email.trim(), passwordHash);
    const token = signToken(user.id, user.email);

    return res.status(201).json({ token, user: { id: user.id, email: user.email } });
  });

  app.post('/api/auth/signin', async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await storage.getUserByEmail(email.trim());
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken(user.id, user.email);
    return res.json({ token, user: { id: user.id, email: user.email } });
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Unauthorised.' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const user = await storage.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    return res.json({ user: { id: user.id, email: user.email } });
  });

  const httpServer = createServer(app);
  return httpServer;
}
