/**
 * THE POUNDS FAULT, AND PUTTING IT RIGHT WITHOUT GUESSING.
 *
 * WHAT WENT WRONG
 * ───────────────
 * The profile builder validated a typed bodyweight in the unit the person had
 * chosen - lib/bodyweight.ts exists for exactly that - and then stored the raw
 * number as kilograms with no conversion. Somebody who picked pounds and typed
 * 176 passed the check, was congratulated, and had 176 KILOGRAMS written to
 * their profile. The same happened to the three best lifts, which go straight
 * into oneRepMaxes.
 *
 * Neither is cosmetic. Bodyweight scales every accessory load the app
 * prescribes and the maxes set every working weight, so both were more than
 * doubled for everybody who trains in pounds.
 *
 * WHAT IS NOT WRONG, which is most of it. The session screen has always
 * converted properly, so every logged set, every rep and every test-week max is
 * correct, and so is any bodyweight since edited on the Profile or Home screens.
 * Only the two figures typed in the builder are affected.
 *
 * HOW AN AFFECTED ACCOUNT IS IDENTIFIED
 * ─────────────────────────────────────
 * The builder writes the bodyweight straight into state rather than through
 * setUserProfile, so it is the one path that never stamps `bodyweightUpdatedAt`.
 * An account showing pounds, with a bodyweight and no such stamp, took that
 * number from the builder and nobody has corrected it since. That is an
 * identification rather than a heuristic.
 *
 * The one thing it cannot see is somebody who changed units in settings after
 * building. A person who built in kilograms and later switched to pounds looks
 * identical, and their number is fine. That is why the size test below exists,
 * and why the card this feeds ASKS rather than silently rewriting anything.
 *
 * NOTHING HERE CHANGES ANY DATA. It reports what it has found and what the
 * figure would be if it was pounds. Deciding is the user's, and applying it is
 * the store's.
 *
 * NO REACT AND NO REACT NATIVE, so tests/unit-correction.check.mjs can run this
 * rather than read it.
 */
import { displayUnitToKg } from './utils';
import { MAX_BODYWEIGHT_KG, MIN_BODYWEIGHT_KG } from './store';
import type { OneRepMax, SessionType, WeightUnit } from './store';

/**
 * Below this stored figure the card is not shown, and the reason is that asking
 * would be wrong more often than right.
 *
 * A stored 100 read as pounds is a 45 kg adult, which is possible and rare. Read
 * as kilograms it is a heavy but entirely ordinary bodyweight. Under 100 the
 * balance tips: almost everybody there is somebody who built in kilograms, and
 * putting a "did you mean pounds?" card in front of them would be the app
 * inventing a problem.
 *
 * Above it the balance is the other way round, and it climbs fast: a stored 176
 * is 80 kg in pounds and a near-professional-heavyweight in kilograms.
 */
export const ASK_ABOVE_KG = 100;

/** One of the three best lifts typed in the builder, and what it should be. */
export interface CorrectedLift {
  lift: SessionType;
  storedKg: number;
  correctedKg: number;
}

export interface UnitCorrection {
  /** The bodyweight as it is recorded now, in kilograms. */
  storedKg: number;
  /** The same figure read as pounds instead. */
  correctedKg: number;
  /** The builder-typed maxes, which were broken by the same thing at the same moment. */
  lifts: CorrectedLift[];
  /**
   * The stored figure is impossible as a bodyweight in kilograms.
   *
   * When this is true there is nothing to ask: the card states what happened and
   * offers the fix, because offering "no, I really am 340 kg" as an option would
   * be the app pretending not to know something it does know. setUserProfile
   * would refuse that value anyway, so the card would come back for ever.
   */
  certain: boolean;
}

/**
 * The maxes the BUILDER wrote, told apart from every other kind.
 *
 * Three fingerprints together, because no one of them is enough. The builder
 * pushes its three in a single set() so they share one timestamp to the
 * millisecond; it records them at one rep, which the calculator and the test
 * week do not; and it leaves `source` off, which only it and entries written
 * before that field existed do.
 *
 * The oldest such group is taken, so somebody who has tested since keeps the
 * good number they earned and only the bad one they typed is corrected.
 */
export function builderTypedMaxes(oneRepMaxes: OneRepMax[]): OneRepMax[] {
  const candidates = oneRepMaxes.filter(
    (m) => m.source === undefined && m.reps === 1 && m.unit === 'kg' && m.weight > 0
  );
  if (candidates.length === 0) return [];
  const earliest = candidates.reduce((a, b) => (a.date <= b.date ? a : b)).date;
  return candidates.filter((m) => m.date === earliest);
}

/**
 * Does this account look like it was recorded in pounds and stored as kilograms?
 *
 * Null when there is nothing to say, which is the answer for everybody who
 * trains in kilograms, everybody who has since corrected their weight, and
 * everybody whose figure is ordinary enough that asking would be noise.
 */
export function unitCorrectionFor(input: {
  weightUnit: WeightUnit;
  bodyweightKg: number;
  /** Null means nothing has written a bodyweight through setUserProfile. */
  bodyweightUpdatedAt: string | null;
  oneRepMaxes: OneRepMax[];
}): UnitCorrection | null {
  if (input.weightUnit !== 'lbs') return null;
  // Somebody has already put a bodyweight in by hand, so whatever the builder
  // wrote has been overwritten with a properly converted figure.
  if (input.bodyweightUpdatedAt !== null) return null;
  const storedKg = input.bodyweightKg;
  if (!Number.isFinite(storedKg) || storedKg < ASK_ABOVE_KG) return null;

  const correctedKg = Math.round(displayUnitToKg(storedKg, 'lbs') * 10) / 10;
  /**
   * BOTH ENDS, and the upper one was missing until a test asked for a stored
   * 3000. Reading that as pounds gives 1360 kg, and the card cheerfully offered
   * "put it right, I am 1360.8 kg".
   *
   * A correction nobody could weigh is not a correction. When the figure makes
   * no sense read either way it is corrupt in some way this cannot repair, and
   * the honest answer is to say nothing rather than to propose a number that is
   * merely less absurd than the one on file.
   */
  if (correctedKg < MIN_BODYWEIGHT_KG || correctedKg > MAX_BODYWEIGHT_KG) return null;

  return {
    storedKg,
    correctedKg,
    lifts: builderTypedMaxes(input.oneRepMaxes).map((m) => ({
      lift: m.lift,
      storedKg: m.weight,
      correctedKg: Math.round(displayUnitToKg(m.weight, 'lbs') * 10) / 10,
    })),
    certain: storedKg > MAX_BODYWEIGHT_KG,
  };
}
