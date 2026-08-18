import { MIN_BODYWEIGHT_KG, MAX_BODYWEIGHT_KG, type WeightUnit } from './store';
import { displayUnitToKg, kgToDisplayUnit } from './utils';

/** A plainly typed number. No signs, no exponents, no thousands separators. */
export const TYPED_NUMBER = /^\d+(\.\d+)?$/;

/**
 * What is wrong with a typed bodyweight, in words, or null when nothing is.
 *
 * WHY IT IS CHECKED AT ALL
 * ────────────────────────
 * Bodyweight scales every accessory load the app prescribes, so an absurd one is
 * not a cosmetic profile error: the session screen then refuses to log the
 * weights it suggested (its own 500 kg ceiling), and nothing on screen connects
 * the two. The old gate was `parseFloat(text) > 0`, which accepted 9999.
 *
 * WHY IT LIVES HERE
 * ─────────────────
 * There were two copies — one in onboarding and one in Profile — and they had
 * already drifted: Profile's understood kg and lbs, onboarding's assumed kg. So
 * a user entering pounds during onboarding had "176" read as 176 KILOS, which
 * is above the plausible ceiling and was rejected as "too high", while the same
 * number in Profile was accepted as 80 kg. One definition, both callers.
 *
 * The quoted range is rounded INWARD when converted, so every number the message
 * names as acceptable really is accepted.
 */
export function bodyweightIssue(text: string, unit: WeightUnit): string | null {
  const trimmed = text.trim();
  if (!TYPED_NUMBER.test(trimmed)) {
    return `Enter your bodyweight as a number, for example ${unit === 'kg' ? '80' : '176'}`;
  }
  const kg = displayUnitToKg(parseFloat(trimmed), unit);
  const min = Math.ceil(kgToDisplayUnit(MIN_BODYWEIGHT_KG, unit));
  const max = Math.floor(kgToDisplayUnit(MAX_BODYWEIGHT_KG, unit));
  if (kg < MIN_BODYWEIGHT_KG) {
    return `That looks too low. Enter a bodyweight between ${min} and ${max} ${unit}.`;
  }
  if (kg > MAX_BODYWEIGHT_KG) {
    return `That looks too high. Your bodyweight sets your starting weights, so it needs to be between ${min} and ${max} ${unit}.`;
  }
  return null;
}

/**
 * What the app assumes when someone would rather not say.
 *
 * Answering is optional, and it has to stay optional — but the load maths needs
 * a number, so declining means accepting an assumption. The onboarding step says
 * this figure out loud rather than banking it silently, which is the difference
 * between an assumption and a guess the user never agreed to.
 */
export const ASSUMED_BODYWEIGHT_KG = 75;
