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

/**
 * Which intent to program for when the user picked more than one goal.
 *
 * REHAB OUTRANKS EVERYTHING, INCLUDING STRENGTH.
 *
 * Strength wins every other tie because it is the least forgiving to get wrong:
 * a 5-rep prescription trained as 15 is a different session, whereas a 12-rep
 * prescription trained as 8 is merely a heavier one. Erring toward the more
 * specific answer is the safer mistake.
 *
 * It is not the safer mistake here. Rehab plus strength was resolving to
 * strength, which prescribed 3-5 rep main lifts - near-maximal triples - to
 * somebody who had just told the app they are rehabbing an injury. The effort
 * target was already softened for them (see softenForRehab), so they were being
 * told to leave 2-3 reps back on a set of three, which is both unsafe and
 * incoherent as a prescription.
 *
 * Someone rehabbing who also wants to get strong still gets stronger; they get
 * there through a rep range their tissue can tolerate. That is what a
 * physiotherapist would write, and this app is one.
 */
export function intentFor(goals: readonly FitnessGoal[] | undefined): Intent {
  const active = goals?.length ? goals : (['fitness'] as FitnessGoal[]);
  if (active.includes('rehab')) return GOAL_INTENT.rehab;
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

/**
 * REHAB NEVER GOES TO FAILURE, WHATEVER ELSE WAS TICKED.
 *
 * Rehab is mapped to the hypertrophy row of the table, which is right for the
 * rep range and wrong for the effort: that row carries "last set close to
 * failure" and a 1-2 rep reserve. So someone rehabbing a shoulder was being
 * programmed a maximal set on their main lift - and if they had also ticked
 * muscle or strength, the same thing happened by a different route.
 *
 * This was invisible for as long as the effort target was computed and never
 * shown. It is on the card now, so it has to be right.
 *
 * Rehab wins this one outright rather than by the usual tie-break. The rep
 * range tie-break is about specificity - a 5-rep prescription trained as 15 is
 * a different session - and being wrong there costs a mediocre workout. Being
 * wrong here costs an injury, and the person has told the app they already have
 * one.
 */
function softenForRehab(p: RepPrescription): RepPrescription {
  return {
    ...p,
    lastSetToFailure: false,
    rir: { min: Math.max(p.rir.min, 2), max: Math.max(p.rir.max, 3) },
  };
}

export function prescriptionFor(
  goals: readonly FitnessGoal[] | undefined,
  category: ExerciseCategory
): RepPrescription | null {
  const tier = tierOf(category);
  if (!tier) return null;
  const p = REP_SCHEME[intentFor(goals)][tier];
  return goals?.includes('rehab') ? softenForRehab(p) : p;
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
  // Rounded to five seconds because it is read off a clock by a person.
  // The midpoint of a 45-60 s window is 52.5, and a timer counting down from
  // 53 seconds looks like an accident rather than a prescription.
  const midpoint = (p.restSeconds.min + p.restSeconds.max) / 2;
  return Math.round(midpoint / 5) * 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOUBLE PROGRESSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A rep prescription the app can count, or null when it is not that kind of set.
 *
 * The catalogue's `reps` field is free text holding at least eight different
 * kinds of thing: a count ("12"), a range ("8-10"), a per-side count
 * ("15 each side"), a shared count ("20 total"), a DISTANCE ("40m",
 * "500 m", "20 steps forward"), a duration ("45s each side", "3 min"), an
 * instruction ("AMRAP - max clean reps", "5 explosive") and a whole circuit
 * round bolted together with plus signs ("10 each side + 16 total").
 *
 * Only the first four are repetitions. Everything else returning null is the
 * point rather than a limitation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DISTANCES ARE WHY THIS IS SO STRICT
 * ─────────────────────────────────────────────────────────────────────────────
 * The first version of this read any leading number and kept the rest as an
 * opaque suffix, on the theory that "40" and "m" could be progressed and
 * reprinted separately. They cannot. A metre is not a rep, and the goal table
 * has no opinion about 40 of them - so a completed 40 m farmer's carry came back
 * as "8-12 m", and a 500 m row came back as "8-12 m". Measured across the
 * catalogue: 159 of 243 countable tier-1/tier-2 prescriptions were CUT by a
 * single good session, the worst by 99%.
 *
 * A carry, a sled drag and a rowing interval are prescribed in distance for the
 * same reason a plank is prescribed in seconds, and this refuses all of them for
 * the same reason it already refused the plank.
 */
export function parseReps(reps: string): { min: number; max: number; suffix: string } | null {
  const text = reps.trim();
  if (/\b\d+\s*(s|sec|secs|seconds|min|mins|minutes)\b/i.test(text)) return null;
  if (/amrap|max\b|failure/i.test(text)) return null;
  if (/explosive|slow/i.test(text)) return null;
  // Distance, not repetitions. "\bm\b" cannot catch "min" - the time rule above
  // has already taken those - and it must not catch the "m" inside a word.
  if (/\d\s*m\b|\bmetres?\b|\bmeters?\b|\bsteps?\b|\blengths?\b|\bfloors?\b/i.test(text))
    return null;
  // A circuit round is several prescriptions in one string ("10 each side + 16
  // total"). Progressing the first number and reprinting the others verbatim
  // describes a session nobody wrote.
  if (text.includes('+')) return null;
  // A complex is one continuous set of several movements; "6 of each" is its
  // structure, not a rep target to negotiate upward.
  if (/\bof each\b|unbroken/i.test(text)) return null;

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
  rating?: 'very_easy' | 'easy' | 'hard',
  /**
   * Whether there is any weight on this exercise to add.
   *
   * False for the 43 bodyweight lifts in the catalogue that carry a countable
   * rep range. Topping out the range on those used to hand back "the weight goes
   * up and the reps start again" - and then no weight went up, because there is
   * none, so the earned reps were thrown away and the user climbed the same
   * range again, forever. Holding at the top is at least honest.
   */
  loadable: boolean = true
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

  /**
   * THE GOAL TABLE ONLY DESCRIBES A NUMBER THAT SITS INSIDE ITS RANGE.
   *
   * Where the template gives a range, that range wins and none of this applies.
   * Where it gives a single number, the table is asked what range that number
   * sits in - which is a sensible question for a 12-rep accessory and a
   * meaningless one for a 20-rep glute bridge or a 40-rep march. Answering it
   * anyway declared the exercise "topped out" on the spot and reset it to the
   * goal's own floor, so a physiotherapist's 20 became 8 the first time anybody
   * completed it. Across the catalogue that silently cut 159 of 243 countable
   * prescriptions after one good session.
   *
   * A number above the ceiling is not a number this table has anything to say
   * about, so it says nothing and the template stands. Load progression is
   * untouched and carries on as it did before double progression existed.
   */
  if (!baseHasRange && base && scheme && base.max > scheme.reps.max) return null;

  const ceiling = baseHasRange ? base!.max : (scheme?.reps.max ?? parsed.max);
  const floor = baseHasRange ? base!.min : (scheme?.reps.min ?? parsed.min);
  const topOfRange = () => formatReps(floor, ceiling, parsed.suffix);

  if (parsed.min >= ceiling) {
    if (!loadable) {
      return {
        reps: formatReps(ceiling, ceiling, parsed.suffix),
        addLoad: false,
        note: 'Top of the rep range - hold here until you can make the movement harder',
      };
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// OBJECTIVE AUTO-REGULATION: WHAT THE REPS SAY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A set that carries enough to judge a prescription by.
 *
 * Structurally the store's SetLog, declared narrowly so this file stays free of
 * store imports and can be tested on plain objects.
 */
export interface LoggedSet {
  reps: number;
  completed: boolean;
  skipped?: boolean;
}

/**
 * THE WEIGHT WAS TOO LIGHT, AND THE LOG ALREADY PROVES IT.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Everything the app knew about how a session felt came from three buttons.
 * Buttons are a report; reps are a measurement. Someone prescribed 8-12 who
 * logs 20 has demonstrated the weight is wrong more convincingly than any
 * answer they could tap, and they have already typed the evidence in — the rep
 * count is a required field on every set.
 *
 * So this reads it. No new question, no extra tap, and it works for the user who
 * never touches the feedback buttons at all, which the buttons by definition
 * cannot.
 *
 * WHY THE LAST SET
 * ────────────────
 * On a main lift the last set is the working set — every rung below it is a
 * stated fraction of one number, so beating a warm-up's rep target proves
 * nothing (see lib/auto-regulation.ts, which has the same rule for the same
 * reason). On a hypertrophy accessory the last set is the one taken closest to
 * failure. Both point at the same set, and it is the only one worth reading.
 *
 * WHY IT TAKES A LOT TO FIRE
 * ──────────────────────────
 * Two guards, and a rep count has to clear both:
 *
 *   - a PROPORTION, because one extra rep means something different on a 3-rep
 *     squat than on a 20-rep calf raise
 *   - an ABSOLUTE margin, because a single rep either way is miscounting, a
 *     half rep argued into a whole one, or a good day - not a prescription
 *     error
 *
 * Erring toward silence is deliberate. A missed signal costs one session; a
 * false one adds weight to a bar that did not deserve it.
 */
const OVERSHOOT_EASY_RATIO = 1.2;
const OVERSHOOT_EASY_REPS = 2;
const OVERSHOOT_VERY_EASY_RATIO = 1.5;
const OVERSHOOT_VERY_EASY_REPS = 3;

/**
 * AND THE SAME MEASUREMENT, IN THE OTHER DIRECTION.
 *
 * The rep count was read as evidence only when it went UP. Somebody prescribed
 * 8-12 who logged 5, 5, 5 and ticked each set off was recorded as a clean
 * normal session: the load held, the clean-session streak advanced toward a
 * weight jump, and the rep floor was raised from 8 to 9 with the note "One more
 * rep at the same weight - 9 to beat". The app asked a person who managed five
 * to come back and do nine.
 *
 * That asymmetry is the same shape as the one the warm-up ramp work fixed on
 * the load side: the app believed the good news and ignored the bad. A rep
 * count is a measurement whichever way it points.
 *
 * Measured against the FLOOR of the range rather than the ceiling, because the
 * floor is what the prescription actually asks for - the top of the range is a
 * target to work towards, not a pass mark.
 *
 * A PROPORTION RATHER THAN A COUNT, because the same number of missing reps
 * means completely different things at different volumes. Two short of twelve
 * is a slow last set; two short of four is a failed heavy single. A quarter
 * below the floor says the same thing at both ends, and it leaves the ordinary
 * case alone - dropping a rep on the last set of a straight-sets scheme is what
 * fatigue looks like, not failure.
 */
const UNDERSHOOT_HARD_RATIO = 0.75;

export function measuredRating(
  targetReps: string,
  sets: readonly LoggedSet[],
  category: ExerciseCategory
): 'very_easy' | 'easy' | 'hard' | null {
  // Tier 3 is a clinical dose, and beating it is not an argument for more
  // weight. "2 x 15 each side" on a rotator cuff done for 20 means the person
  // felt good, not that the physiotherapist was wrong - and this is the exact
  // class of exercise where being wrong turns prehab into an injury.
  const tier = tierOf(category);
  if (tier !== 'tier1' && tier !== 'tier2') return null;

  /**
   * PER-SIDE TARGETS ARE NOT COMPARABLE TO A SINGLE LOGGED NUMBER.
   *
   * "12 each side" asks for 24 repetitions and one box to type them into. The
   * bar prefills 12, which is the reading the app intends - but somebody who
   * counts the way the sentence reads types 24, and 24 against a ceiling of 12
   * is a 100% overshoot. That is the app adding weight because a user did
   * exactly what they were told, in the only other sensible unit.
   *
   * Nothing on the screen can tell the two readings apart, so this declines to
   * guess. The three feedback buttons still work on these exercises, and so does
   * ordinary load progression; only the silent measurement steps back.
   */
  if (/\beach\b|\bper side\b/i.test(targetReps)) return null;

  const target = parseReps(targetReps);
  if (!target) return null;

  // An exercise with a set left unfinished is not evidence the weight was
  // light, whatever the sets before it did.
  if (sets.length === 0) return null;
  if (!sets.every((s) => s.completed && !s.skipped)) return null;

  const last = sets[sets.length - 1];
  const logged = last?.reps ?? 0;
  if (logged <= 0) return null;

  const ceiling = target.max;
  if (ceiling <= 0) return null;
  const over = logged - ceiling;
  const ratio = logged / ceiling;

  if (over >= OVERSHOOT_VERY_EASY_REPS && ratio >= OVERSHOOT_VERY_EASY_RATIO) return 'very_easy';
  if (over >= OVERSHOOT_EASY_REPS && ratio >= OVERSHOOT_EASY_RATIO) return 'easy';

  // Short of what was asked. See UNDERSHOOT_HARD_RATIO.
  const floor = target.min;
  if (floor > 0) {
    if (logged / floor <= UNDERSHOOT_HARD_RATIO) return 'hard';
  }
  return null;
}

/**
 * Did they actually reach the bottom of the rep range they were given?
 *
 * Double progression means: hit the floor, and next time the floor goes up one.
 * The engine was checking only that every set had been ticked off, never what
 * was typed into them - so somebody prescribed 8-12 who logged 7, 7, 7 was
 * moved to 9-12, then 10-12, then 11-12, then handed more weight. The floor ran
 * away from a lifter who never reached it.
 *
 * measuredRating catches the severe version of this and calls the session hard.
 * This is the quieter half: not bad enough to hold the load, just not the
 * evidence a step up needs.
 *
 * Returns TRUE whenever it cannot tell, and there are five ways it cannot:
 * a clinical dose it has no business judging, a per-side target whose unit is
 * ambiguous, an AMRAP or timed target with no countable floor, sets that were
 * not all completed (already judged in lib/set-performance.ts), and a set ticked
 * off with no rep count typed in - where the tick is the only signal there is
 * and refusing to progress on it would punish somebody for not typing.
 */
export function metRepFloor(
  targetReps: string,
  sets: readonly LoggedSet[],
  category: ExerciseCategory
): boolean {
  const tier = tierOf(category);
  if (tier !== 'tier1' && tier !== 'tier2') return true;
  if (/\beach\b|\bper side\b/i.test(targetReps)) return true;

  const target = parseReps(targetReps);
  if (!target || target.min <= 0) return true;
  if (sets.length === 0) return true;
  if (!sets.every((s) => s.completed && !s.skipped)) return true;

  const logged = sets[sets.length - 1]?.reps ?? 0;
  if (logged <= 0) return true;
  return logged >= target.min;
}

/**
 * What the user SAID, and what the reps SHOWED, resolved into one answer.
 *
 * THE ONE RULE THAT MATTERS: "Too Hard" is never overruled.
 *
 * A rep count is evidence about a weight. "Too Hard" is a person telling the app
 * they were at their limit, and the app answering that with more weight because
 * the arithmetic disagreed would be the single worst thing it could do - it is
 * the guardrail the whole auto-regulation file is built around, and it does not
 * stop applying because a different signal is louder.
 *
 * Above that line the two are combined by taking whichever says the session was
 * easier. Both are evidence in the same direction; the stronger one wins. In
 * particular a user who never taps a button still progresses, which is the
 * point.
 *
 * A MEASURED SHORTFALL COUNTS AS "TOO HARD" TOO.
 *
 * The rule above is about not overruling caution, and reps well below the floor
 * are caution arriving from the other direction. So either signal saying the
 * session was hard settles it, including against a tapped "Easy" - somebody who
 * managed five of a prescribed eight and called it easy has still only managed
 * five, and the next session is built on what was lifted.
 */
export function combineWithMeasuredReps(
  said: 'very_easy' | 'easy' | 'hard' | null | undefined,
  measured: 'very_easy' | 'easy' | 'hard' | null
): 'very_easy' | 'easy' | 'hard' | null {
  if (said === 'hard' || measured === 'hard') return 'hard';
  const rank = (r: 'very_easy' | 'easy' | 'hard' | null | undefined) =>
    r === 'very_easy' ? 2 : r === 'easy' ? 1 : 0;
  return rank(said) >= rank(measured) ? (said ?? null) : measured;
}
