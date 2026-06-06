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

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const otpRateLimitStore = new Map<string, number[]>();

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (otpRateLimitStore.get(email) ?? []).filter(t => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    otpRateLimitStore.set(email, timestamps);
    return true;
  }
  timestamps.push(now);
  otpRateLimitStore.set(email, timestamps);
  return false;
}

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

    if (isRateLimited(normalised)) {
      return res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' });
    }

    const code = generateOtp();
    storage.setOtp(normalised, code, OTP_TTL_MS);

    try {
      await sendOtpEmail(normalised, code);
    } catch (err) {
      console.error('[OTP] Email send failed:', err);
      return res.status(500).json({ message: 'Failed to send code. Please try again.' });
    }

    const devCode = !IS_PRODUCTION ? code : undefined;
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
    ul { color: #444; padding-left: 20px; }
    li { margin-bottom: 6px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="updated">Last updated: April 2026</p>
  ${body}
  <p style="margin-top:48px;color:#888;font-size:13px">Grow Performance &amp; Rehab · <a href="mailto:hello@growperformance.app">hello@growperformance.app</a></p>
</body>
</html>`;

  app.get('/privacy', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(legalPageHtml('Privacy Policy', `
      <p>This Privacy Policy describes how Grow Performance &amp; Rehab ("Grow", "we", "us", or "our") collects, uses, and protects information about you when you use our mobile application and related services (collectively, the "Service").</p>

      <h2>1. Information We Collect</h2>
      <p><strong>Information you provide directly:</strong></p>
      <ul>
        <li><strong>Email address</strong> — collected when you create an account. Used exclusively to send your one-time login code and to identify your account.</li>
        <li><strong>Profile information</strong> — name, sex, experience level, fitness goals, and bodyweight. Stored locally on your device and used to personalise your training programme.</li>
        <li><strong>Workout data</strong> — session logs, weights lifted, pain regions, readiness ratings, and exercise feedback. Stored locally on your device to power your progress tracking.</li>
      </ul>
      <p><strong>Information collected automatically:</strong></p>
      <ul>
        <li>Basic server logs (IP address, request timestamps) retained for up to 30 days for security and operational purposes.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Authenticate your identity via one-time email codes;</li>
        <li>Deliver and personalise your training sessions;</li>
        <li>Track your fitness progress and strength history;</li>
        <li>Maintain and improve the Service;</li>
        <li>Respond to your support requests.</li>
      </ul>
      <p>We do not use your information for advertising, behavioural profiling, or targeted marketing. We do not sell your personal data to any third party.</p>

      <h2>3. Third-Party Services</h2>
      <p>We use a limited number of trusted third-party services to operate the Service:</p>
      <ul>
        <li><strong>RevenueCat</strong> — manages your subscription and in-app purchase receipts. RevenueCat receives your anonymised app user ID and subscription status. RevenueCat does not receive your email address. See <a href="https://www.revenuecat.com/privacy" target="_blank">RevenueCat's Privacy Policy</a>.</li>
        <li><strong>Resend</strong> — delivers your one-time login code by email. Resend processes your email address solely to deliver transactional messages on our behalf. See <a href="https://resend.com/legal/privacy-policy" target="_blank">Resend's Privacy Policy</a>.</li>
        <li><strong>Apple App Store</strong> — handles subscription billing. We do not store or process your payment card details. See <a href="https://www.apple.com/legal/privacy/" target="_blank">Apple's Privacy Policy</a>.</li>
      </ul>

      <h2>4. Data Storage and Security</h2>
      <p>Your workout data and profile are stored locally on your device using industry-standard secure storage. Your email address and authentication tokens are stored on our servers and protected with appropriate technical and organisational measures.</p>
      <p>No method of transmission or storage is 100% secure. While we take reasonable steps to protect your information, we cannot guarantee absolute security.</p>

      <h2>5. Data Retention and Deletion</h2>
      <p>We retain your account data for as long as your account is active. You may request deletion of your account and all associated data by emailing us at <a href="mailto:hello@growperformance.app">hello@growperformance.app</a>. We will action deletion requests within 30 days.</p>

      <h2>6. Children's Privacy</h2>
      <p>The Service is not directed at children under the age of 13 (or under 16 in the European Economic Area). We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us and we will promptly delete it.</p>

      <h2>7. Your Rights</h2>
      <p>Depending on your location, you may have rights to access, correct, or delete your personal information. To exercise any of these rights, please contact us at the address below.</p>

      <h2>8. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last updated" date above. Your continued use of the Service after changes constitutes acceptance of the revised policy.</p>

      <h2>9. Contact</h2>
      <p>Questions or requests regarding this Privacy Policy should be directed to: <a href="mailto:hello@growperformance.app">hello@growperformance.app</a>.</p>
    `));
  });

  app.get('/terms', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(legalPageHtml('Terms of Service', `
      <p>These Terms of Service ("Terms") govern your access to and use of the Grow Performance &amp; Rehab mobile application and related services (collectively, the "Service"), provided by Grow Performance &amp; Rehab ("Grow", "we", "us", or "our"). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.</p>

      <h2>1. Eligibility</h2>
      <p>You must be at least 13 years old (or 16 years old in the European Economic Area) to use the Service. By using the Service, you represent that you meet this requirement.</p>

      <h2>2. Account Registration</h2>
      <p>You must provide a valid email address to create an account. You are responsible for maintaining the confidentiality of your login codes and for all activity that occurs under your account. You agree to notify us immediately at <a href="mailto:hello@growperformance.app">hello@growperformance.app</a> if you suspect unauthorised access to your account.</p>

      <h2>3. Subscriptions and Billing</h2>
      <p>Access to the Service requires an active subscription.</p>
      <ul>
        <li><strong>Price:</strong> £7.99 per month (or equivalent in your local currency as displayed at checkout).</li>
        <li><strong>Free trial:</strong> New subscribers receive a 14-day free trial. You will not be charged until the trial period ends.</li>
        <li><strong>Automatic renewal:</strong> Your subscription renews automatically at the end of each billing period unless you cancel at least 24 hours before the renewal date.</li>
        <li><strong>Cancellation:</strong> You may cancel your subscription at any time through your Apple ID account settings. Cancellation takes effect at the end of the current billing period; no partial refunds are provided for unused time.</li>
        <li><strong>Billing:</strong> All billing is handled by Apple through the App Store. We do not process or store your payment card details.</li>
      </ul>

      <h2>4. Health and Safety Disclaimer</h2>
      <p>The Service provides fitness programming and educational content for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment.</p>
      <ul>
        <li>Always consult a qualified healthcare professional before starting or modifying a new exercise programme, particularly if you have any existing medical conditions, injuries, or pain.</li>
        <li>If you experience pain, dizziness, shortness of breath, or any other symptoms during exercise, stop immediately and seek medical attention.</li>
        <li>You assume full responsibility for any physical activity you undertake based on content provided by the Service.</li>
      </ul>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose or in violation of any applicable regulations;</li>
        <li>Attempt to reverse-engineer, decompile, or extract source code from the Service;</li>
        <li>Share your account credentials with others;</li>
        <li>Interfere with the operation of the Service or our servers.</li>
      </ul>

      <h2>6. Intellectual Property</h2>
      <p>All content, design, software, and materials within the Service are the property of Grow Performance &amp; Rehab and are protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable licence to use the Service for personal, non-commercial purposes.</p>

      <h2>7. Disclaimer of Warranties</h2>
      <p>The Service is provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components.</p>

      <h2>8. Limitation of Liability</h2>
      <p>To the maximum extent permitted by applicable law, Grow Performance &amp; Rehab shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including but not limited to personal injury, loss of profits, loss of data, or business interruption — arising out of or related to your use of the Service, even if we have been advised of the possibility of such damages.</p>

      <h2>9. Governing Law</h2>
      <p>These Terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>

      <h2>10. Changes to These Terms</h2>
      <p>We may update these Terms from time to time. We will notify you of material changes by updating the "Last updated" date above. Your continued use of the Service after changes constitutes acceptance of the revised Terms.</p>

      <h2>11. Contact</h2>
      <p>Questions about these Terms? Contact us at <a href="mailto:hello@growperformance.app">hello@growperformance.app</a>.</p>
    `));
  });

  const httpServer = createServer(app);
  return httpServer;
}
