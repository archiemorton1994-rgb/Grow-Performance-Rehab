/**
 * What is wrong with a typed best lift, in words, or null when nothing is.
 *
 * MOVED OUT OF app/onboarding.tsx, where it lived next to the swipe pager that
 * the profile tree replaces. It is pure logic with no React in it, and it was
 * only reachable by a contract test that extracted the function's SOURCE TEXT
 * out of a .tsx file by name and evaluated it, because app/onboarding.tsx
 * imports react-native and cannot be imported under tsx. That worked, and it
 * meant the test was reading a copy rather than running the real thing.
 *
 * WHY IT IS CHECKED AT ALL
 * ────────────────────────
 * A one rep max sets the working weight directly, so 10000 here prescribes a bar
 * nobody can load, and the session screen then refuses to log the weight the app
 * itself just suggested, with nothing on screen connecting the two.
 *
 * Blank is a legitimate answer. The question is optional and says so, and
 * "I do not know my best lifts" has to be answerable.
 */
import {
  MIN_ONE_REP_MAX_KG,
  MAX_ONE_REP_MAX_KG,
  isPlausibleOneRepMaxKg,
} from './store';
import { TYPED_NUMBER } from './bodyweight';

export function oneRepMaxIssue(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!TYPED_NUMBER.test(trimmed)) return 'Enter a number, or leave this blank';
  if (!isPlausibleOneRepMaxKg(parseFloat(trimmed))) {
    return `Enter a best lift between ${MIN_ONE_REP_MAX_KG} and ${MAX_ONE_REP_MAX_KG} kg, or leave it blank.`;
  }
  return null;
}

/**
 * The same idea for age.
 *
 * Asked for the first time by the profile tree. The bounds are deliberately
 * wide: this exists to catch 3 and 900, not to argue with anybody's real age.
 * Under 14 the app should not be prescribing barbell loads at all, and over 100
 * is a typo rather than a user.
 */
export const MIN_AGE_YEARS = 14;
export const MAX_AGE_YEARS = 100;

export function ageIssue(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return 'Enter your age as a whole number';
  const n = parseInt(trimmed, 10);
  if (n < MIN_AGE_YEARS || n > MAX_AGE_YEARS) {
    return `Enter an age between ${MIN_AGE_YEARS} and ${MAX_AGE_YEARS}.`;
  }
  return null;
}
