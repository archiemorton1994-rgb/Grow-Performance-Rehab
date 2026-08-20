import type { ExerciseCategory, FitnessGoal } from './store';

/**
 * HOW MANY REPS, HOW MANY SETS, HOW HARD, AND HOW LONG TO REST.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS
 * ─────────────────────────────────────────────────────────────────────────────
 * The programming spec, written as data a coach can read and disagree with.
 * Goal decides the rep range, tier decides how far that range bends for a given
 * movement, and together they decide how close to failure a set should be and
 * how long the rest is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT DELIBERATELY DOES NOT DO
 * ─────────────────────────────────────────────────────────────────────────────
 * It does not overwrite the prescriptions already in lib/exercise-db.ts. Those
 * were written movement by movement by a physiotherapist, and a config that
 * silently replaced "3 x 8-10, controlled tempo" with a generic goal default
 * would be a downgrade wearing the clothes of a feature.
 *
 * It is used three ways, all additive:
 *
 *   1. THE RANGE TO PROGRESS WITHIN. Where a template already gives a range
 *      ("8-10"), that range wins and this supplies nothing. Where it gives a
 *      single number ("12"), this says what range that number sits in, so the
 *      reps have somewhere to climb before the load has to move.
 *   2. THE EFFORT TARGET. Reps in reserve is information the app never gave:
 *      the weight says how heavy, RIR says how hard, and without it "8 reps" is
 *      half a prescription.
 *   3. REST. The app already varies rest by category, but not by goal - and the
 *      same back squat wants three minutes for a powerlifter and ninety seconds
 *      for someone chasing size.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TIERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Mapped from the categories the app already has rather than invented alongside
 * them. A second tiering system that disagreed with the first is how two sources
 * of truth start.
 *
 *   tier1  main                     the heavy compound the session is built on
 *   tier2  accessory                secondary compounds and loaded assistance
 *   tier3  prehab, neuro,           isolation, rehab and drill work: higher
 *          mechanical               reps and lighter, whatever the goal
 */
export type ExerciseTier = 'tier1' | 'tier2' | 'tier3';

export function tierOf(category: ExerciseCategory): ExerciseTier | null {
  switch (category) {
    case 'main':
      return 'tier1';
    case 'accessory':
      return 'tier2';
    case 'prehab':
    case 'neuro':
    case 'mechanical':
      return 'tier3';
    // prep, finisher, cardio and cooldown are not strength prescriptions. A
    // finisher is meant to be a scramble and a cooldown is breathing; giving
    // either a rep target and an effort target would be pretending they are
    // working sets.
    default:
      return null;
  }
}

/**
 * The three training intentions the spec describes, mapped from the six goals
 * onboarding already asks about.
 *
 * Mapped rather than replaced: the user answered that question on a screen that
 * exists, and asking it again in different words would be the app admitting it
 * was not listening.
 */
export type Intent = 'strength' | 'hypertrophy' | 'endurance';

const GOAL_INTENT: Record<FitnessGoal, Intent> = {
  strength: 'strength',
  power: 'strength',
  muscle: 'hypertrophy',
  // Fat loss trains like endurance in practice: moderate load, higher reps,
  // shorter rest.
  fat_loss: 'endurance',
  fitness: 'hypertrophy',
  // Rehab is deliberately hypertrophy-shaped rather than strength-shaped - a
  // forgiving rep range, and an effort target a long way from failure.
  rehab: 'hypertrophy',
};

/** Which intent to program for when the user picked more than one goal. */
export function intentFor(goals: readonly FitnessGoal[] | undefined): Intent {
  const active = goals?.length ? goals : (['fitness'] as FitnessGoal[]);
  // Strength wins a tie because it is the least forgiving to get wrong: a
  // 5-rep prescription trained as 15 is a different session, whereas a 12-rep
  // prescription trained as 8 is merely a heavier one.
  if (active.some((g) => GOAL_INTENT[g] === 'strength')) return 'strength';
  if (active.some((g) => GOAL_INTENT[g] === 'hypertrophy')) return 'hypertrophy';
  return 'endurance';
}

export interface RepPrescription {
  /** Inclusive rep range for a working set. */
  reps: { min: number; max: number };
  /** Working sets, excluding warm-ups. */
  sets: { min: number; max: number };
  /** Reps left in the tank on a normal working set. Lower is harder. */
  rir: { min: number; max: number };
  /** Seconds between working sets. */
  restSeconds: { min: number; max: number };
  /**
   * Whether the last working set is pushed close to failure.
   *
   * Hypertrophy only, and only on tiers 1 and 2. It is the most effective thing
   * in the spec and the easiest to misapply: an all-out set on a rehab exercise
   * is how someone turns shoulder prehab into a shoulder injury.
   */
  lastSetToFailure: boolean;
}

/**
 * intent x tier -> the prescription.
 *
 * Written out in full rather than computed, so a coach can read the whole table
 * and change one cell without reasoning about a formula.
 */
export const REP_SCHEME: Record<Intent, Record<ExerciseTier, RepPrescription>> = {
  strength: {
    tier1: {
      reps: { min: 3, max: 5 },
      sets: { min: 3, max: 5 },
      rir: { min: 1, max: 2 },
      restSeconds: { min: 180, max: 300 },
      lastSetToFailure: false,
    },
    tier2: {
      reps: { min: 6, max: 8 },
      sets: { min: 3, max: 4 },
      rir: { min: 2, max: 3 },
      restSeconds: { min: 120, max: 180 },
      lastSetToFailure: false,
    },
    tier3: {
      reps: { min: 10, max: 15 },
      sets: { min: 2, max: 3 },
      rir: { min: 2, max: 3 },
      restSeconds: { min: 45, max: 75 },
      lastSetToFailure: false,
    },
  },
  hypertrophy: {
    tier1: {
      reps: { min: 6, max: 10 },
      sets: { min: 3, max: 4 },
      rir: { min: 1, max: 2 },
      restSeconds: { min: 120, max: 180 },
      lastSetToFailure: true,
    },
    tier2: {
      reps: { min: 8, max: 12 },
      sets: { min: 3, max: 4 },
      rir: { min: 1, max: 2 },
      restSeconds: { min: 90, max: 120 },
      lastSetToFailure: true,
    },
    tier3: {
      reps: { min: 12, max: 20 },
      sets: { min: 2, max: 3 },
      rir: { min: 2, max: 3 },
      restSeconds: { min: 45, max: 75 },
      lastSetToFailure: false,
    },
  },
  endurance: {
    tier1: {
      reps: { min: 12, max: 20 },
      sets: { min: 2, max: 3 },
      rir: { min: 2, max: 3 },
      restSeconds: { min: 60, max: 90 },
      lastSetToFailure: false,
    },
    tier2: {
      reps: { min: 15, max: 20 },
      sets: { min: 2, max: 3 },
      rir: { min: 2, max: 3 },
      restSeconds: { min: 45, max: 60 },
      lastSetToFailure: false,
    },
    tier3: {
      reps: { min: 15, max: 25 },
      sets: { min: 2, max: 3 },
      rir: { min: 2, max: 3 },
      restSeconds: { min: 30, max: 60 },
      lastSetToFailure: false,
    },
  },
};

export function prescriptionFor(
  goals: readonly FitnessGoal[] | undefined,
  category: ExerciseCategory
): RepPrescription | null {
  const tier = tierOf(category);
  if (!tier) return null;
  return REP_SCHEME[intentFor(goals)][tier];
}

/**
 * "Leave about 2 reps in the tank", for the card.
 *
 * Plain English on purpose. "RIR 2" means nothing to most people and this app is
 * used by beginners; the instruction is the same either way.
 */
export function effortHint(p: RepPrescription, isFinalSet: boolean): string {
  if (isFinalSet && p.lastSetToFailure) {
    return 'Last set: push close to failure, but stop the moment form goes';
  }
  const { min, max } = p.rir;
  const n = min === max ? `${min}` : `${min}-${max}`;
  return `Leave about ${n} rep${max === 1 ? '' : 's'} in the tank`;
}

/** The rest instruction for this goal and movement, in seconds. */
export function restSecondsFor(
  goals: readonly FitnessGoal[] | undefined,
  category: ExerciseCategory
): number | null {
  const p = prescriptionFor(goals, category);
  if (!p) return null;
  return Math.round((p.restSeconds.min + p.restSeconds.max) / 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// DOUBLE PROGRESSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A rep prescription the app can count, or null when it is not that kind of set.
 *
 * The catalogue's `reps` field is free text holding at least five different
 * kinds of thing: a count ("12"), a range ("8-10"), a per-side count
 * ("15 each side"), a duration ("45s each side", "3 min") and an instruction
 * ("AMRAP - max clean reps", "5 explosive").
 *
 * Only the first three can be added to. A duration or an AMRAP returning null is
 * the point rather than a limitation: adding a rep to a three-minute carry is
 * meaningless, an AMRAP already asks for every rep there is, and "5 explosive"
 * is chosen for a quality that more reps would destroy.
 */
export function parseReps(reps: string): { min: number; max: number; suffix: string } | null {
  const text = reps.trim();
  if (/\b\d+\s*(s|sec|secs|seconds|min|mins|minutes)\b/i.test(text)) return null;
  if (/amrap|max\b|failure/i.test(text)) return null;
  if (/explosive|slow/i.test(text)) return null;

  const range = text.match(/^(\d+)\s*-\s*(\d+)(.*)$/);
  if (range) {
    const min = parseInt(range[1], 10);
    const max = parseInt(range[2], 10);
    if (min > 0 && max >= min) return { min, max, suffix: range[3] ?? '' };
    return null;
  }
  const single = text.match(/^(\d+)(.*)$/);
  if (single) {
    const n = parseInt(single[1], 10);
    if (n > 0) return { min: n, max: n, suffix: single[2] ?? '' };
  }
  return null;
}

/** Render a rep range back into the catalogue's own format. */
export function formatReps(min: number, max: number, suffix: string): string {
  return (min === max ? `${min}` : `${min}-${max}`) + suffix;
}

export interface NextPrescription {
  /** The reps to prescribe next time, in the catalogue's format. */
  reps: string;
  /** True when the load should rise instead - the rep range has been topped out. */
  addLoad: boolean;
  /** Plain-English reason, for the card. */
  note: string;
}

/**
 * DOUBLE PROGRESSION: earn the reps first, then the weight.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Load was the only lever the app had, and the smallest honest step is a 2.5 kg
 * plate. On a 20 kg dumbbell press that is a 12.5% jump; on a 40 kg squat, over
 * 6%. So the engine had two answers available - nothing, or too much - and for a
 * normal session below about 50 kg its answer was nothing at all, three sessions
 * running, until a "bank three clean sessions" rule allowed the big jump.
 *
 * Three sessions of visible standstill is the difference between an app that
 * feels like it is working and one that does not, and it lands hardest on
 * beginners, who progress fastest and need the encouragement most.
 *
 * Adding a rep is a 5-10% increase in work at a fraction of the joint cost, and
 * it is what any coach does between plates. Reps climb to the top of the range,
 * then the weight goes up and the reps drop back to the bottom.
 */
export function nextPrescription(
  currentReps: string,
  baseReps: string,
  achievedAllSets: boolean,
  goals: readonly FitnessGoal[] | undefined,
  category: ExerciseCategory,
  /** What the user said about how it felt, if they said anything. */
  rating?: 'very_easy' | 'easy' | 'hard'
): NextPrescription | null {
  // Tier 3 keeps the dose it was written with.
  //
  // Prehab, rehab and drill work are prescribed by a physiotherapist for a
  // reason - "2 x 15 each side" on a rotator cuff is a clinical dose, not an
  // opening bid to be negotiated upward. Double progression belongs to the
  // lifting, so this declines to have an opinion and the caller keeps whatever
  // the template said.
  const tier = tierOf(category);
  if (tier !== 'tier1' && tier !== 'tier2') return null;

  const parsed = parseReps(currentReps);
  if (!parsed) return null;
  if (!achievedAllSets) {
    return {
      reps: currentReps,
      addLoad: false,
      note: 'Same again - finish every set at this weight first',
    };
  }

  /**
   * The range comes from the TEMPLATE, not from the current prescription.
   *
   * This is the whole reason baseReps is a separate argument. Climbing "8-10"
   * produces "9-10" and then "10" - at which point the range has disappeared
   * from the string, and re-deriving it from "10" alone fell back to the goal
   * default. A physiotherapist's authored 8-10 quietly became the generic 6-8
   * two sessions in, which is precisely the kind of "improvement" that makes an
   * app worse. The template is asked every time instead.
   */
  const base = parseReps(baseReps);
  const scheme = prescriptionFor(goals, category);
  const baseHasRange = !!base && base.max > base.min;
  const ceiling = baseHasRange ? base!.max : (scheme?.reps.max ?? parsed.max);
  const floor = baseHasRange ? base!.min : (scheme?.reps.min ?? parsed.min);
  const topOfRange = () => formatReps(floor, ceiling, parsed.suffix);

  if (parsed.min >= ceiling) {
    return {
      reps: topOfRange(),
      addLoad: true,
      note: 'Top of the rep range - the weight goes up and the reps start again',
    };
  }

  /**
   * How big a step the reps take, taken from the answer the user already gives.
   *
   * The three difficulty buttons had two outcomes between them: measured across
   * every weight, "Easy" and "Too easy" produced an identical jump, because the
   * percentage between them was smaller than one plate. Answering honestly and
   * answering generously got you the same session.
   *
   * Reps are a finer grid than plates, so the same three answers can finally
   * mean three different things:
   *
   *   too easy   go straight to the top of the range - the weight is wrong, and
   *              creeping up one rep at a time wastes weeks getting there
   *   easy       two reps
   *   normal     one rep
   *
   * "Hard" never reaches this line: it is a failed performance, and the branch
   * above holds everything where it is.
   */
  const step = rating === 'very_easy' ? Math.max(1, ceiling - parsed.min) : rating === 'easy' ? 2 : 1;
  const nextMin = Math.min(parsed.min + step, ceiling);

  return {
    reps: formatReps(nextMin, ceiling, parsed.suffix),
    addLoad: false,
    note:
      rating === 'very_easy' && nextMin === ceiling
        ? `That was too easy - straight to ${ceiling} reps at this weight`
        : nextMin - parsed.min > 1
          ? `Two more reps at the same weight - ${nextMin} to beat`
          : `One more rep at the same weight - ${nextMin} to beat`,
  };
}
