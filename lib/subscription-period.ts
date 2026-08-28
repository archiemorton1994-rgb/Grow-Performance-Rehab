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

/**
 * MOVED HERE FROM app/subscription.tsx, and exported.
 *
 * Two screens now make a claim about a trial: the paywall, and the offer
 * screen that sits between the showcase and it. Two implementations of "what
 * are we allowed to say about a free period" is exactly the class of bug this
 * app has spent a week removing, so there is one, and a contract test runs it
 * rather than reading it.
 */
/**
 * What the card promises, given the offer AND whether this person can have it.
 *
 * `trialEligible` is the half that was missing. Apple grants an introductory
 * offer once per Apple ID, so anyone who has tried the app before — trial used,
 * subscription cancelled, or simply reinstalling on a new phone — was shown
 * "Start 14-Day Free Trial", tapped it, and was charged the full month
 * immediately by Apple's own sheet. They believe they signed up for a free
 * trial and see a charge the same day. That is a refund request, a one-star
 * review, and a fair accusation of a misleading claim.
 *
 * Ineligible users get the honest version: Subscribe, and the price.
 */
export function getTrialText(
  pkg: PurchasesPackage | null,
  trialEligible: boolean
): { badge: string; cta: string; sub: string; offerHeadline: string } {
  if (!trialEligible) {
    return { badge: '', cta: 'Subscribe', sub: '', offerHeadline: '' };
  }
  const intro = pkg?.product?.introPrice;
  if (intro && intro.price === 0 && intro.periodNumberOfUnits > 0) {
    const n = intro.periodNumberOfUnits;
    const unit = (intro.periodUnit as string).toUpperCase();
    let period = `${n}-day`;
    if (unit === 'WEEK') period = n === 1 ? '1-week' : `${n}-week`;
    else if (unit === 'MONTH') period = n === 1 ? '1-month' : `${n}-month`;
    else if (unit === 'YEAR') period = n === 1 ? '1-year' : `${n}-year`;
    /**
     * THE HEADLINE IS BUILT HERE BECAUSE THIS IS WHERE THE NUMBER IS.
     *
     * app/offer.tsx used to write it as
     * `Your first ${badge.replace(' free trial', '')} are on us`, which turns
     * "14-day free trial" into "Your first 14-day are on us". Ungrammatical for
     * every possible length, and for a one-month offer "are" would be wrong
     * too. One place knows both the number and the unit, so one place writes
     * the sentence.
     */
    const plural = n === 1 ? '' : 's';
    const noun =
      unit === 'WEEK' ? 'week' : unit === 'MONTH' ? 'month' : unit === 'YEAR' ? 'year' : 'day';
    const spanWords = n === 1 ? `${noun}` : `${n} ${noun}${plural}`;
    return {
      badge: `${period} free trial`,
      cta: `Start ${period.charAt(0).toUpperCase() + period.slice(1)} Free Trial`,
      sub: `Try free for ${period.replace('-', ' ')}, then`,
      offerHeadline: `Your first ${spanWords} ${n === 1 ? 'is' : 'are'} on us`,
    };
  }
  // No introPrice on the package: the store is not offering a trial on this
  // product, whatever this app would like to say. Claiming "14 days free" here
  // was a hardcoded promise nothing backed.
  return { badge: '', cta: 'Subscribe', sub: '', offerHeadline: '' };
}
