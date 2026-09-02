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
import type { WeightUnit } from './store';
import { displayUnitToKg, kgToDisplayUnit } from './utils';
import { TYPED_NUMBER } from './bodyweight';

/**
 * IN THE UNIT THEY CHOSE, which it was not.
 *
 * The typed number was compared straight against the kilogram bounds and the
 * message quoted kilograms, to somebody who had picked pounds two questions
 * earlier. A 550 lb deadlift - 249 kg, an entirely ordinary strong lift - was
 * refused with "Enter a best lift between 5 and 500 kg", and at the other end a
 * typed 10 sailed through as a 4.5 kg best.
 *
 * The bodyweight question next door had always converted before checking. This
 * is the same shape, so the two now agree.
 */
export function oneRepMaxIssue(text: string, unit: WeightUnit = 'kg'): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!TYPED_NUMBER.test(trimmed)) return 'Enter a number, or leave this blank';
  if (!isPlausibleOneRepMaxKg(displayUnitToKg(parseFloat(trimmed), unit))) {
    const lo = Math.ceil(kgToDisplayUnit(MIN_ONE_REP_MAX_KG, unit));
    const hi = Math.floor(kgToDisplayUnit(MAX_ONE_REP_MAX_KG, unit));
    return `Enter a best lift between ${lo} and ${hi} ${unit}, or leave it blank.`;
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
