import type { Express, Request, Response } from 'express';
import { createServer, type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { storage } from './storage';

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}
const JWT_EXPIRY = '30d';
const OTP_TTL_MS = 10 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function signToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET!, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as { userId: string; email: string };
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpEmail(email: string, code: string): Promise<void> {
  if (!resendClient) {
    console.log(`[OTP] ${email} → ${code}`);
    return;
  }
  await resendClient.emails.send({
    from: 'Grow Performance <noreply@growperformance.app>',
    to: email,
    subject: `Your Grow login code: ${code}`,
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px">
        <h2 style="color:#2f6b46;margin-bottom:8px">Your login code</h2>
        <p style="color:#555;margin-bottom:24px">Use this code to sign in to Grow Performance & Rehab. It expires in 10 minutes.</p>
        <div style="background:#f4f4f4;border-radius:12px;padding:24px;text-align:center;font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a">${code}</div>
        <p style="color:#999;font-size:13px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post('/api/auth/request-code', async (req: Request, res: Response) => {
    const { email } = req.body ?? {};

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    const normalised = email.trim().toLowerCase();
    const code = generateOtp();
    storage.setOtp(normalised, code, OTP_TTL_MS);

    try {
      await sendOtpEmail(normalised, code);
    } catch (err) {
      console.error('[OTP] Email send failed:', err);
      return res.status(500).json({ message: 'Failed to send code. Please try again.' });
    }

    return res.json({ message: 'Code sent.' });
  });

  app.post('/api/auth/verify-code', async (req: Request, res: Response) => {
    const { email, code } = req.body ?? {};

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'A verification code is required.' });
    }

    const normalised = email.trim().toLowerCase();
    const entry = storage.getOtp(normalised);

    if (!entry) {
      return res.status(401).json({ message: 'No code was requested for this email. Please request a new one.' });
    }
    if (Date.now() > entry.expiresAt) {
      storage.clearOtp(normalised);
      return res.status(401).json({ message: 'Code has expired. Please request a new one.' });
    }
    if (entry.code !== code.trim()) {
      return res.status(401).json({ message: 'Incorrect code. Please try again.' });
    }

    storage.clearOtp(normalised);
    const user = await storage.upsertUser(normalised);
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
