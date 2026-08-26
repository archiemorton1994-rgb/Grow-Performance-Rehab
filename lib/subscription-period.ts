import type { PurchasesPackage } from 'react-native-purchases';

/**
 * How often a package bills, in words, read off the package itself.
 *
 * WHY THIS EXISTS AS ITS OWN FILE
 * ───────────────────────────────
 * The paywall used to hardcode "month" in four places: the plan name, the price
 * suffix, the sub-line and the auto-renew notice. What it actually buys is
 * `offerings.current?.monthly ?? offerings.current?.availablePackages[0]`, so
 * the moment the current RevenueCat offering has no package under the reserved
 * "monthly" identifier, it falls through to whatever is first in the list. An
 * annual product sold as "£X / month" is the worst mistake that screen could
 * make, and nothing in the code prevented it.
 *
 * It lives here, away from app/subscription.tsx, so a contract test can RUN it
 * rather than regex the source. Nothing in this file imports React Native.
 *
 * `subscriptionPeriod` is ISO 8601 (P1M, P1Y, P1W). `packageType` is the
 * fallback for the documented case where the store returns no period.
 */
export interface PeriodWords {
  /** "month", for "£4.99 / month". Empty when the period is unknown. */
  per: string;
  /** "Monthly", for the plan name. Empty when unknown. */
  planWord: string;
  /** "monthly", for "renews monthly". Empty when unknown. */
  adverb: string;
}

const BY_ISO: Record<string, PeriodWords> = {
  P1W: { per: 'week', planWord: 'Weekly', adverb: 'weekly' },
  P1M: { per: 'month', planWord: 'Monthly', adverb: 'monthly' },
  P2M: { per: '2 months', planWord: 'Two Monthly', adverb: 'every two months' },
  P3M: { per: '3 months', planWord: 'Quarterly', adverb: 'quarterly' },
  P6M: { per: '6 months', planWord: 'Half Yearly', adverb: 'every six months' },
  P1Y: { per: 'year', planWord: 'Annual', adverb: 'annually' },
};

const BY_TYPE: Record<string, PeriodWords> = {
  WEEKLY: BY_ISO.P1W,
  MONTHLY: BY_ISO.P1M,
  TWO_MONTH: BY_ISO.P2M,
  THREE_MONTH: BY_ISO.P3M,
  SIX_MONTH: BY_ISO.P6M,
  ANNUAL: BY_ISO.P1Y,
};

/** Empty strings, so callers print no period at all rather than guessing one. */
const UNKNOWN: PeriodWords = { per: '', planWord: '', adverb: '' };

export function periodWordsFor(pkg: PurchasesPackage | null | undefined): PeriodWords {
  if (!pkg) return UNKNOWN;
  const iso = pkg.product?.subscriptionPeriod ?? null;
  if (iso && BY_ISO[iso]) return BY_ISO[iso];
  const byType = BY_TYPE[String(pkg.packageType)];
  return byType ?? UNKNOWN;
}

/**
 * What the date on the subscription card actually means.
 *
 * expirationDate comes back from the store whether or not auto-renew is still
 * on, so the card used to print "Renews 4 Sep" at somebody who had cancelled
 * the day before, on the very date their access runs out. willRenew is the one
 * field that tells those apart, and it defaults to false, so an unknown answer
 * gives the cautious wording rather than a promise to bill again.
 */
export function subscriptionDateLabel(isOnTrial: boolean, willRenew: boolean): string {
  if (isOnTrial) return willRenew ? 'First charge' : 'Free trial ends';
  return willRenew ? 'Renews' : 'Ends';
}
