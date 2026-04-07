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

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

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
  if (!IS_PRODUCTION) {
    console.log(`[OTP] ${email} → ${code}`);
  }

  if (IS_PRODUCTION && !resendClient) {
    console.error('[OTP] RESEND_API_KEY is not set. Email delivery is unavailable in production.');
    throw new Error('Email service not configured. Set RESEND_API_KEY to enable OTP delivery.');
  }

  if (!resendClient) {
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

    const devCode = !IS_PRODUCTION && !resendClient ? code : undefined;
    return res.json({ message: 'Code sent.', devCode });
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

  const legalPageHtml = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Grow Performance & Rehab</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 680px; margin: 48px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; }
    h1 { color: #2f6b46; font-size: 28px; margin-bottom: 8px; }
    p.updated { color: #888; font-size: 14px; margin-bottom: 32px; }
    h2 { color: #2f6b46; font-size: 18px; margin-top: 32px; }
    p { color: #444; }
    a { color: #2f6b46; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="updated">Last updated: April 2025</p>
  ${body}
  <p style="margin-top:48px;color:#888;font-size:13px">Grow Performance &amp; Rehab · <a href="mailto:hello@growperformance.app">hello@growperformance.app</a></p>
</body>
</html>`;

  app.get('/privacy', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(legalPageHtml('Privacy Policy', `
      <p><strong>Placeholder — update with your real Privacy Policy before App Store submission.</strong></p>
      <h2>1. Information We Collect</h2>
      <p>We collect your email address for authentication purposes only. Workout data you enter is stored securely on our servers and is not shared with third parties.</p>
      <h2>2. How We Use Your Information</h2>
      <p>Your email is used solely to deliver login codes and to identify your account. We do not sell or share your personal information.</p>
      <h2>3. Data Retention</h2>
      <p>You may delete your account at any time by contacting us. All associated data will be permanently removed within 30 days.</p>
      <h2>4. Subscriptions</h2>
      <p>Subscription billing is handled by Apple (App Store). We do not store payment card details.</p>
      <h2>5. Contact</h2>
      <p>Questions? Email us at <a href="mailto:hello@growperformance.app">hello@growperformance.app</a>.</p>
    `));
  });

  app.get('/terms', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(legalPageHtml('Terms of Service', `
      <p><strong>Placeholder — update with your real Terms of Service before App Store submission.</strong></p>
      <h2>1. Acceptance</h2>
      <p>By using Grow Performance & Rehab you agree to these Terms. If you do not agree, do not use the app.</p>
      <h2>2. Subscriptions</h2>
      <p>Grow is a subscription service priced at £7.99/month. A 14-day free trial is offered to new subscribers. Subscriptions renew automatically unless cancelled at least 24 hours before the renewal date.</p>
      <h2>3. Health Disclaimer</h2>
      <p>Grow provides fitness programming for informational purposes only. Always consult a qualified healthcare professional before starting a new exercise programme, particularly if you have any pain or medical conditions.</p>
      <h2>4. Limitation of Liability</h2>
      <p>We are not liable for any injury, loss, or damage arising from use of the app or reliance on its content.</p>
      <h2>5. Changes</h2>
      <p>We may update these Terms from time to time. Continued use of the app after changes constitutes acceptance.</p>
      <h2>6. Contact</h2>
      <p>Questions? Email us at <a href="mailto:hello@growperformance.app">hello@growperformance.app</a>.</p>
    `));
  });

  const httpServer = createServer(app);
  return httpServer;
}
