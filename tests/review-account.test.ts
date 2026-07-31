/**
 * The review account is a deliberate, environment-gated bypass of the OTP
 * email step for a single address. Every assertion here exists to prove it
 * cannot become load-bearing by accident — the failure mode that matters is
 * "enabled when it should not be", not "disabled when it should be".
 */

import { resolveReviewAccount, isReviewAccountActive } from '../server/review-account';

const VALID_EMAIL = 'appreview@example.com';
const VALID_CODE = '481920';

describe('resolveReviewAccount — stays inert', () => {
  it('is disabled, silently, when neither variable is set', () => {
    const { account, warnings } = resolveReviewAccount({});
    expect(account).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('is disabled when the whole environment is unrelated', () => {
    const { account } = resolveReviewAccount({
      NODE_ENV: 'production',
      SESSION_SECRET: 'x',
      RESEND_API_KEY: 'y',
    });
    expect(account).toBeNull();
  });

  it('is disabled, loudly, when only the email is set', () => {
    const { account, warnings } = resolveReviewAccount({ REVIEW_ACCOUNT_EMAIL: VALID_EMAIL });
    expect(account).toBeNull();
    expect(warnings.join(' ')).toMatch(/BOTH/);
  });

  it('is disabled, loudly, when only the code is set', () => {
    const { account, warnings } = resolveReviewAccount({ REVIEW_ACCOUNT_CODE: VALID_CODE });
    expect(account).toBeNull();
    expect(warnings.join(' ')).toMatch(/BOTH/);
  });

  it('treats whitespace-only values as unset', () => {
    const { account } = resolveReviewAccount({
      REVIEW_ACCOUNT_EMAIL: '   ',
      REVIEW_ACCOUNT_CODE: '   ',
    });
    expect(account).toBeNull();
  });

  it('is disabled when the email is malformed', () => {
    const { account, warnings } = resolveReviewAccount({
      REVIEW_ACCOUNT_EMAIL: 'not-an-email',
      REVIEW_ACCOUNT_CODE: VALID_CODE,
    });
    expect(account).toBeNull();
    expect(warnings.join(' ')).toMatch(/valid email/i);
  });

  // The app's OTP input is maxLength=6, number-pad. Anything else is either
  // untypeable or a config mistake, and must not half-work.
  it.each([['12345'], ['1234567'], ['abcdef'], ['12 456'], ['12-456'], ['']])(
    'is disabled when the code is %p',
    (code) => {
      const { account } = resolveReviewAccount({
        REVIEW_ACCOUNT_EMAIL: VALID_EMAIL,
        REVIEW_ACCOUNT_CODE: code,
      });
      expect(account).toBeNull();
    }
  );

  it('is disabled when the expiry date is not YYYY-MM-DD', () => {
    const { account, warnings } = resolveReviewAccount({
      REVIEW_ACCOUNT_EMAIL: VALID_EMAIL,
      REVIEW_ACCOUNT_CODE: VALID_CODE,
      REVIEW_ACCOUNT_EXPIRES: '31/12/2026',
    });
    expect(account).toBeNull();
    expect(warnings.join(' ')).toMatch(/YYYY-MM-DD/);
  });

  it('is disabled when the expiry is a well-formed but impossible date', () => {
    const { account } = resolveReviewAccount({
      REVIEW_ACCOUNT_EMAIL: VALID_EMAIL,
      REVIEW_ACCOUNT_CODE: VALID_CODE,
      REVIEW_ACCOUNT_EXPIRES: '2026-13-45',
    });
    expect(account).toBeNull();
  });
});

describe('resolveReviewAccount — enabled path', () => {
  it('resolves a fully valid config', () => {
    const { account } = resolveReviewAccount({
      REVIEW_ACCOUNT_EMAIL: VALID_EMAIL,
      REVIEW_ACCOUNT_CODE: VALID_CODE,
      REVIEW_ACCOUNT_EXPIRES: '2026-12-31',
    });
    expect(account).toEqual({
      email: VALID_EMAIL,
      code: VALID_CODE,
      expiresAt: Date.parse('2026-12-31T23:59:59.999Z'),
    });
  });

  it('normalises the email so casing in the env cannot cause a silent miss', () => {
    const { account } = resolveReviewAccount({
      REVIEW_ACCOUNT_EMAIL: '  AppReview@Example.COM  ',
      REVIEW_ACCOUNT_CODE: VALID_CODE,
    });
    expect(account?.email).toBe(VALID_EMAIL);
  });

  it('warns when enabled with no expiry, so it is not silently permanent', () => {
    const { account, warnings } = resolveReviewAccount({
      REVIEW_ACCOUNT_EMAIL: VALID_EMAIL,
      REVIEW_ACCOUNT_CODE: VALID_CODE,
    });
    expect(account?.expiresAt).toBeNull();
    expect(warnings.join(' ')).toMatch(/REVIEW_ACCOUNT_EXPIRES/);
  });
});

describe('isReviewAccountActive', () => {
  const at = (iso: string) => Date.parse(iso);

  it('is false for a null account', () => {
    expect(isReviewAccountActive(null, Date.now())).toBe(false);
  });

  it('is true before the expiry date', () => {
    const account = { email: VALID_EMAIL, code: VALID_CODE, expiresAt: at('2026-12-31T23:59:59.999Z') };
    expect(isReviewAccountActive(account, at('2026-06-01T12:00:00Z'))).toBe(true);
  });

  it('is still true during the final day of the expiry date', () => {
    const account = { email: VALID_EMAIL, code: VALID_CODE, expiresAt: at('2026-12-31T23:59:59.999Z') };
    expect(isReviewAccountActive(account, at('2026-12-31T09:00:00Z'))).toBe(true);
  });

  it('is false after the expiry date', () => {
    const account = { email: VALID_EMAIL, code: VALID_CODE, expiresAt: at('2026-12-31T23:59:59.999Z') };
    expect(isReviewAccountActive(account, at('2027-01-01T00:00:01Z'))).toBe(false);
  });

  it('never expires when expiresAt is null', () => {
    const account = { email: VALID_EMAIL, code: VALID_CODE, expiresAt: null };
    expect(isReviewAccountActive(account, at('2099-01-01T00:00:00Z'))).toBe(true);
  });
});
