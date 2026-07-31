/**
 * App Store review account.
 *
 * Sign-in is passwordless: the server emails a 6-digit OTP and the `devCode`
 * shortcut is gated behind NODE_ENV === 'development', so an App Store reviewer
 * hitting production has no way to obtain a code without access to the mailbox.
 * Giving Apple mailbox credentials works but routinely trips the mail provider's
 * "verify it's you" challenge when the reviewer signs in from an unfamiliar
 * location, which fails review for reasons unrelated to the app.
 *
 * This module resolves an optional, environment-configured review account: one
 * specific email address whose OTP is a fixed value the reviewer is told up
 * front. Deliberate properties:
 *
 *   - Inert unless BOTH REVIEW_ACCOUNT_EMAIL and REVIEW_ACCOUNT_CODE are set to
 *     valid values. A partial or malformed config disables it entirely rather
 *     than falling back to something permissive.
 *   - Scoped to exactly one address. Every other account is untouched.
 *   - The address lives only in the environment, never in this repo, so it is
 *     not discoverable from source.
 *   - Optionally self-disabling via REVIEW_ACCOUNT_EXPIRES, so forgetting to
 *     unset it after approval is not indefinitely load-bearing.
 *
 * The caller is responsible for applying the normal rate limits *before*
 * consulting this module — see the call sites in routes.ts.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The OTP input in app/auth/index.tsx is maxLength=6, number-pad. */
const CODE_RE = /^\d{6}$/;

const EXPIRY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ReviewAccount {
  email: string;
  code: string;
  /** Epoch ms after which the account stops working, or null for no expiry. */
  expiresAt: number | null;
}

export interface ResolveResult {
  account: ReviewAccount | null;
  /** Operator-facing messages: config errors, or a reminder that it is live. */
  warnings: string[];
}

/**
 * Pure resolver. Validates the review-account environment configuration.
 * Returns `account: null` for any incomplete or invalid config.
 */
export function resolveReviewAccount(env: Record<string, string | undefined>): ResolveResult {
  const warnings: string[] = [];

  const rawEmail = (env.REVIEW_ACCOUNT_EMAIL ?? '').trim();
  const rawCode = (env.REVIEW_ACCOUNT_CODE ?? '').trim();

  // Neither set: the normal case. Silent, no warning.
  if (!rawEmail && !rawCode) {
    return { account: null, warnings };
  }

  // Exactly one set: almost certainly a half-finished deploy config. Say so
  // loudly, but stay disabled.
  if (!rawEmail || !rawCode) {
    warnings.push(
      'REVIEW_ACCOUNT_EMAIL and REVIEW_ACCOUNT_CODE must BOTH be set. Review account is disabled.'
    );
    return { account: null, warnings };
  }

  const email = rawEmail.toLowerCase();

  if (!EMAIL_RE.test(email)) {
    warnings.push('REVIEW_ACCOUNT_EMAIL is not a valid email address. Review account is disabled.');
    return { account: null, warnings };
  }

  if (!CODE_RE.test(rawCode)) {
    warnings.push(
      'REVIEW_ACCOUNT_CODE must be exactly 6 digits to match the app\'s code input. Review account is disabled.'
    );
    return { account: null, warnings };
  }

  let expiresAt: number | null = null;
  const rawExpiry = (env.REVIEW_ACCOUNT_EXPIRES ?? '').trim();
  if (rawExpiry) {
    if (!EXPIRY_RE.test(rawExpiry)) {
      warnings.push(
        'REVIEW_ACCOUNT_EXPIRES must be a YYYY-MM-DD date. Review account is disabled.'
      );
      return { account: null, warnings };
    }
    // End of the given day, UTC, so the account works for all of that date.
    const parsed = Date.parse(`${rawExpiry}T23:59:59.999Z`);
    if (Number.isNaN(parsed)) {
      warnings.push(
        'REVIEW_ACCOUNT_EXPIRES is not a real calendar date. Review account is disabled.'
      );
      return { account: null, warnings };
    }
    expiresAt = parsed;
  } else {
    warnings.push(
      'Review account is active with no expiry date. Set REVIEW_ACCOUNT_EXPIRES=YYYY-MM-DD, or unset REVIEW_ACCOUNT_EMAIL once the app is approved.'
    );
  }

  return { account: { email, code: rawCode, expiresAt }, warnings };
}

/** True when the account exists and has not passed its expiry date. */
export function isReviewAccountActive(account: ReviewAccount | null, now: number): boolean {
  if (!account) return false;
  if (account.expiresAt !== null && now > account.expiresAt) return false;
  return true;
}
