/**
 * Contract test: App Store review-account wiring in server/routes.ts.
 *
 * WHY THIS MATTERS
 * ────────────────
 * server/review-account.ts is unit-tested for its own logic (see
 * tests/review-account.test.ts). What that test cannot see is *where* the
 * resulting branch sits inside the request handlers, and that placement is the
 * whole security story:
 *
 *  - If the review branch runs BEFORE the rate-limit check, the fixed 6-digit
 *    code becomes brute-forceable at unlimited speed. Sitting after it, the
 *    review address is capped by the same VERIFY_RATE_LIMIT_MAX as everyone
 *    else, which puts a 6-digit space out of reach.
 *  - If the fixed code is ever echoed into a response body (the way `devCode`
 *    is in development), anyone who guesses the review address gets the code
 *    handed to them.
 *  - If the branch stops consulting isReviewAccount() — e.g. someone inlines a
 *    plain email comparison during a refactor — the env validation and the
 *    expiry check are silently bypassed.
 *
 * Checks:
 *  1. SOURCE   — routes.ts imports the resolver, does not reimplement it
 *  2. SOURCE   — env vars are never read directly in routes.ts
 *  3. SOURCE   — isReviewAccount() gates on isReviewAccountActive (expiry honoured)
 *  4. ORDERING — request-code: review branch comes after its rate-limit check
 *  5. ORDERING — verify-code: review branch comes after its rate-limit check
 *  6. LEAK     — the fixed code is never placed in a response body
 *  7. SOURCE   — a wrong code on the review account still returns 401
 *
 * Run:  node tests/review-account.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dir, '../server/routes.ts'), 'utf8');

let failures = 0;
let total = 0;

function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// ─── 1. SOURCE — resolver is imported, not reimplemented ──────────────────────
console.log('\n[1] Source — routes.ts delegates to server/review-account');

check(
  'resolveReviewAccount and isReviewAccountActive are imported from ./review-account',
  /import\s*\{[^}]*resolveReviewAccount[^}]*isReviewAccountActive[^}]*\}\s*from\s*'\.\/review-account'/.test(
    src
  ),
  'import not found — routes.ts may have inlined its own copy of the validation logic, which the unit tests do not cover'
);

check(
  'resolveReviewAccount is called with process.env',
  src.includes('resolveReviewAccount(process.env)'),
  'call not found — the review account config is never resolved'
);

// ─── 2. SOURCE — no direct env reads ──────────────────────────────────────────
console.log('\n[2] Source — REVIEW_ACCOUNT_* env vars are only read by the resolver');

check(
  'routes.ts never reads process.env.REVIEW_ACCOUNT_* directly',
  !/process\.env\.REVIEW_ACCOUNT_/.test(src),
  'a direct env read bypasses the validation in review-account.ts (6-digit code check, email check, expiry check)'
);

// ─── 3. SOURCE — expiry is honoured on every request ──────────────────────────
console.log('\n[3] Source — isReviewAccount() honours the expiry date');

const guardMatch = src.match(/function isReviewAccount\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
const guardBody = guardMatch ? guardMatch[1] : '';

check(
  'isReviewAccount() helper exists',
  guardBody !== '',
  'helper not found — call sites may be comparing emails directly'
);

check(
  'isReviewAccount() calls isReviewAccountActive',
  guardBody.includes('isReviewAccountActive('),
  'expiry is not re-checked per request — REVIEW_ACCOUNT_EXPIRES would have no effect on a long-running server'
);

check(
  'isReviewAccount() compares against the resolved account email',
  guardBody.includes('REVIEW_ACCOUNT') && guardBody.includes('email'),
  'the guard does not scope to the configured address'
);

// ─── 4/5. ORDERING — review branch must sit after the rate-limit check ────────
// Locate each handler body, then compare the offset of its isRateLimited call
// against the offset of its isReviewAccount call.
function handlerBody(route) {
  const start = src.indexOf(`app.post('${route}'`);
  if (start === -1) return null;
  const next = src.indexOf('\n  app.', start + 10);
  return { text: src.slice(start, next === -1 ? src.length : next), start };
}

for (const [step, route, limiter] of [
  ['4', '/api/auth/request-code', 'otpRateLimitStore'],
  ['5', '/api/auth/verify-code', 'verifyRateLimitStore'],
]) {
  console.log(`\n[${step}] Ordering — ${route}: review branch runs after the rate-limit check`);

  const handler = handlerBody(route);
  check(`${route} handler found`, handler !== null, 'route may have been renamed or removed');

  if (handler) {
    const limiterIdx = handler.text.indexOf(`isRateLimited(${limiter}`);
    const reviewIdx = handler.text.indexOf('isReviewAccount(normalised)');

    check(
      `${route} still applies isRateLimited(${limiter}, ...)`,
      limiterIdx !== -1,
      'rate limiting was removed from this handler'
    );
    check(
      `${route} consults isReviewAccount(normalised)`,
      reviewIdx !== -1,
      'review branch is missing from this handler'
    );
    check(
      `${route} rate-limit check precedes the review branch`,
      limiterIdx !== -1 && reviewIdx !== -1 && limiterIdx < reviewIdx,
      'the review address is exempt from rate limiting — the fixed 6-digit code becomes brute-forceable'
    );
  }
}

// ─── 6. LEAK — the fixed code must never reach a response body ────────────────
console.log('\n[6] Leak — the fixed review code is never returned to the client');

// Every res.json(...) argument in the file, checked for the review code.
const resJsonArgs = [...src.matchAll(/res\.json\(([\s\S]*?)\);/g)].map((m) => m[1]);

check(
  'no res.json() payload references REVIEW_ACCOUNT.code',
  !resJsonArgs.some((arg) => /REVIEW_ACCOUNT[!.\s]*\.?code/.test(arg)),
  'the fixed code is being echoed to the client — anyone who guesses the review address obtains it'
);

const requestHandler = handlerBody('/api/auth/request-code');
check(
  'the review branch in request-code returns no code field',
  requestHandler !== null &&
    /isReviewAccount\(normalised\)\)\s*\{[\s\S]{0,300}?res\.json\(\{\s*message:\s*'Code sent\.'\s*\}\)/.test(
      requestHandler.text
    ),
  "expected the review branch to return only { message: 'Code sent.' }, matching the normal path's shape"
);

// ─── 7. SOURCE — a wrong code still fails ─────────────────────────────────────
console.log('\n[7] Source — a wrong code on the review account is still rejected');

const verifyHandler = handlerBody('/api/auth/verify-code');
const reviewBlock = verifyHandler
  ? verifyHandler.text.slice(verifyHandler.text.indexOf('isReviewAccount(normalised)'))
  : '';

check(
  'the review branch compares the submitted code against REVIEW_ACCOUNT.code',
  /code\.trim\(\)\s*!==\s*REVIEW_ACCOUNT!?\.code/.test(reviewBlock),
  'the review branch is not checking the submitted code at all — the address would sign in with any input'
);

check(
  'a mismatched code returns 401',
  /status\(401\)/.test(reviewBlock.slice(0, 400)),
  'a wrong code does not produce an auth failure'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`review-account: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`review-account: all ${total} checks passed\n`);
  process.exitCode = 0;
}
