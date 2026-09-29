import type {
  EnergyLevel,
  EquipmentTier,
  ExerciseFeedback,
  ExercisePerformance,
  ExperienceLevel,
  PainRegion,
  PainSeverity,
  TimeAvailable,
  UserProfile,
  WeightUnit,
} from './store';
import type { ExerciseTemplate } from './exercise-db';
import {
  getCooldown,
  getRegionPrehabExercise,
  getStandalonePrehabWorkout,
  possibleFor,
} from './exercise-db';
import type { StressTag } from './exercise-safety';
import {
  restrictedTagsFor,
  restrictedTagsOn,
  restrictedTagsOnRecord,
  substitutionNote,
} from './exercise-safety';
import type {
  ConditioningExercise,
  KitKey,
  LibraryExercise,
  LibraryLevel,
  LibraryPattern,
} from './exercise-library';
import {
  CONDITIONING_EXERCISES,
  LIBRARY_EXERCISES,
  WARMUP_CARDIO_EXERCISES,
  hasAuthoredContent,
  isCardioOpener,
  isPulseRaiser,
  patternsOf,
} from './exercise-library';
import { canPerformWith } from './kit';
import type { Exercise } from './workout-engine';
import {
  LONGER_WARMUP_AGE,
  applyInjurySafety,
  applyPersonalization,
  capToKit,
  daysSinceLastTrained,
  easeForDeloadWeek,
  getEffectiveTier,
  getGoalVolumeDeltas,
  getLayoff,
  getPainRegionLabel,
  templateToExercise,
} from './workout-engine';

/**
 * THE STRENGTH SESSION, BUILT FROM ARCHIE'S LIBRARY.
 *
 * LOWER BODY AND UPPER BODY ARE BUILT HERE. This was built beside the old
 * engine and is switched on one session type at a time, so that each switch can
 * be read, argued with and corrected on its own. `generateWorkout` in
 * lib/workout-engine.ts holds the list of types that are live
 * (LIBRARY_LIVE_TYPES) and does the routing; everything else still comes from
 * the old catalogue.
 *
 * WHAT IT BUILDS, IN ORDER (plan section 1; decisions 7 to 10)
 * ───────────────────────────────────────────────────────────
 *   1. Cardio         two minutes of it, on a machine where there is one and on
 *                     foot where there is not - see `warmupCardioTiers`, and
 *                     never sled work - see `isPulseRaiser`.
 *   2. Drills         the ones Archie named for this day first - see
 *                     NAMED_WARMUP_DRILLS - and then Restore drills, 1 / 2 / 2
 *                     by session length, chosen for the day they stand in front
 *                     of - see WARMUP_ORDER.
 *   3. Power          Athlete ceiling only, and only at 45 or 60 minutes.
 *   4. Pattern slots  the movements the session is actually about.
 *   5. Finisher       at 60 minutes, or at 45 for a fat loss or fitness goal.
 *   6. Rehab          only when an area is flagged.
 *   7. Cool-down      at 45 and 60 minutes.
 *
 * THE LEVEL CEILING IS THE WHOLE SAFETY MODEL
 * ───────────────────────────────────────────
 * The library files every exercise at one of four levels, and those levels are
 * the ONLY thing standing between a brand-new beginner and a depth jump. A
 * slot's pool is drawn at the person's level and WIDENS DOWNWARD ONLY, never
 * up, taking easier rungs until it has MIN_SLOT_POOL choices. Where a pattern
 * has nothing at all the slot is dropped, and the plan sheet says what kit
 * would have filled it.
 *
 * This is the one rule here that must not later be "fixed" by falling back to
 * the whole pool when a pool comes up short. The old engine's `atEarnedLevel`
 * does exactly that, deliberately, because its pools are curated per equipment
 * tier and a warm-up one rung too hard is a small price. Here the pool IS the
 * library, and the thing one rung above a beginner's squat is a barbell back
 * squat. A shorter session is the right answer; a heavier one is not.
 *
 * DETERMINISTIC, WITH NO DAY INDEX
 * ────────────────────────────────
 * Everything that varies varies on `sessionTypeCount`, which is how many
 * sessions of this type the person has finished. Nothing reads the clock, so
 * the same answers build the same session today, tomorrow and on the screen
 * that previews it. The old engine seeds on the session count PLUS the day
 * index, which means a session regenerated after midnight is a different one.
 *
 * WHY THE INPUT IS AN OBJECT AND NOT SIXTEEN POSITIONAL ARGUMENTS
 * ──────────────────────────────────────────────────────────────
 * `generateWorkout` next door takes fifteen, appended one at a time, and every
 * one of them is a chance to shift the arguments after it at twenty call sites.
 * The rotation seed has been lost that way once already. A named field cannot
 * be passed in the wrong slot, and cannot be set somewhere the generator does
 * not read and silently do nothing.
 */

/** The three strength sessions the library builds. */
export type LibrarySessionType = 'lower_body' | 'upper_body' | 'full_body';

/**
 * The least a slot's pool may hold before it stops widening downward.
 *
 * Three, because two is a coin toss and one is the same exercise every session.
 * A floor on VARIETY, not a promise: a pattern with two records in the whole
 * library below the ceiling ends up with two, because widening stops at level 1
 * and there is nowhere else honest to go.
 */
export const MIN_SLOT_POOL = 3;

/**
 * How often the main exercise changes, in sessions of this type.
 *
 * Four. The main exercise is the one being progressed, and progression needs
 * the same movement most of the time; every other slot turns over every three.
 * Both are index steps rather than shuffles, so the sequence is the pool in the
 * document's own order, walked forward.
 */
export const MAIN_ROTATION_EVERY = 4;

/** How often every other slot moves along its pool. */
export const SLOT_ROTATION_EVERY = 3;

/** Today's answers, in the shape the injury screen already reads. */
export interface LibraryReadiness {
  hasAches: boolean;
  painRegion?: PainRegion | PainRegion[];
  painSeverity?: PainSeverity;
  acute?: boolean;
  energy: EnergyLevel;
  timeAvailable: TimeAvailable;
  deload?: boolean;
}

/**
 * A pattern the session asked for and did not get, and what would have filled it.
 *
 * Structured rather than only a sentence, because the honest answer to "does
 * this upper body session contain any pulling?" is "yes, or it says why not",
 * and something has to be able to ask that without reading English. `line` is
 * what the plan sheet prints.
 */
export interface LibraryGap {
  pattern: LibraryPattern;
  line: string;
}

export interface LibrarySession {
  exercises: Exercise[];
  /** Empty in the ordinary case. See LibraryGap. */
  gaps: LibraryGap[];
}

export interface LibrarySessionInput {
  sessionType: LibrarySessionType;
  /** Everything they ticked, not the single best rung. See lib/kit.ts. */
  equipment: readonly EquipmentTier[];
  readiness: LibraryReadiness;
  profile?: UserProfile;
  /**
   * Completed sessions OF THIS TYPE, all time. The only thing variety turns on.
   *
   * Per type rather than overall, so a Lower Body session moves along its own
   * pools whether or not Upper Body days happen in between: somebody training
   * lower twice a week does not want their squat changing every fourth session
   * of any kind.
   */
  sessionTypeCount?: number;
  /** Lifting sessions all time, for the load estimate's confidence. */
  strengthSessionCount?: number;
  /** How many of those predate this library. See lib/store.ts. */
  libraryEpochSessionCount?: number;
  exerciseFeedback?: Record<string, ExerciseFeedback>;
  lastLoggedWeights?: Record<string, number>;
  exerciseNormalStreak?: Record<string, number>;
  exerciseStuckStreak?: Record<string, number>;
  lastSessionPerformance?: Record<string, ExercisePerformance>;
  /** Where each exercise sits in its rep range, earned over past sessions. */
  exerciseRepTarget?: Record<string, string>;
  /** Whole days since the last completed session; null when there is no gap. */
  daysSinceLastSession?: number | null;
  loadUnit?: WeightUnit;
}

/** Beginner 1, Intermediate 2, Advanced 3, Athlete 4. */
const LEVEL_FOR_EXPERIENCE: Record<ExperienceLevel, LibraryLevel> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  athlete: 4,
};

/**
 * The hardest level this person may be prescribed.
 *
 * What they told us, plus what they have shown us. `earnedLevelBonus` is rungs
 * banked by finishing blocks and by taking the step-up offer, capped here at
 * the top of the library rather than left to run past it.
 *
 * ATHLETE IS CHOSEN, NEVER GIVEN. Level 4 is jumps, throws and depth work
 * (Archie's decision 8), and the Athlete answer on the experience page means
 * "training for sport or peak performance" - a fact about somebody's life, not
 * a score. So earned rungs stop one below it: the only route to level 4 is
 * saying so about yourself.
 *
 * Without this clamp the ceiling was simply base + bonus, and the rungs
 * outlived the answer they were added to. Somebody who reached two rungs as a
 * beginner and then corrected their experience to Advanced in the edit sheet
 * came out on 3 + 2, which the old `min(4, ...)` rounded down to Athlete: depth
 * jumps prescribed to somebody who had never claimed to be an athlete, by two
 * separate decisions neither of which was about jumping.
 */
export function levelCeilingFor(profile?: {
  experienceLevel?: ExperienceLevel;
  earnedLevelBonus?: number;
}): LibraryLevel {
  const experience = profile?.experienceLevel ?? 'intermediate';
  const base = LEVEL_FOR_EXPERIENCE[experience] ?? 2;
  const bonus = Math.max(0, Math.floor(profile?.earnedLevelBonus ?? 0));
  const top: LibraryLevel = experience === 'athlete' ? 4 : 3;
  return Math.min(top, base + bonus) as LibraryLevel;
}

/**
 * A share of the FIRST-TIME weight estimate, by age (plan decision 12).
 *
 * The estimate behind it is built from a reference lifter of eighty kilos with
 * a couple of years behind them, and it is a guess about a movement this person
 * has never performed. Under eighteen the skeleton is still growing; from fifty
 * connective tissue takes longer to answer a new load; from sixty longer again.
 *
 * None of this touches a weight anybody has actually lifted. Every path in
 * personalizeLoad that reads a logged weight returns before the factor is used,
 * so a birthday can never take weight off a lift somebody owns.
 */
export function ageLoadFactor(ageYears?: number): number {
  const age = ageYears ?? 0;
  if (age <= 0) return 1;
  if (age < 18) return 0.85;
  if (age >= 60) return 0.8;
  if (age >= 50) return 0.9;
  return 1;
}

/**
 * How many mobility drills go in before the work.
 *
 * Fewer than the old engine's warm-up, because this session has a pulse raiser
 * in front of them and a cool-down behind them, and the half-hour session has
 * to leave room for the movements it is actually about. Past fifty the
 * 45-minute session keeps a third, which is the idea `prepCountFor` carries
 * next door and the one use of the age answer nobody would argue with.
 */
export function mobilityCountFor(timeAvailable: TimeAvailable, ageYears?: number): number {
  if (timeAvailable === '30') return 1;
  if (timeAvailable === '45') return (ageYears ?? 0) >= LONGER_WARMUP_AGE ? 3 : 2;
  return 2;
}

/**
 * WHAT A WARM-UP DRILL IS FOR, READ OFF THE DRILL'S OWN RECORD.
 *
 * Four families, because four is what the thirteen Restore drills a Train
 * warm-up can reach honestly divide into: hip and glute work, trunk work, shin
 * and calf work, and shoulder and upper back work.
 *
 * NOT A LIST OF NAMES, AND THAT IS THE POINT. The family is decided by the
 * regions the record itself says it targets, so a drill written later is placed
 * by what it is written to do rather than by somebody remembering to add it
 * here. The fault this replaces was a warm-up that could not tell a lower body
 * day from an upper body day at all, and a hand-written list per session type
 * would have gone stale the first time a drill was added to Restore.
 */
export type WarmupFamily = 'glute_hip' | 'core' | 'lower_limb' | 'upper';

/** All four, so a preference order that forgot one still cannot leave a hole. */
export const WARMUP_FAMILIES: readonly WarmupFamily[] = [
  'glute_hip',
  'core',
  'lower_limb',
  'upper',
];

/**
 * Which regions put a drill in which family, FIRST MATCH WINS.
 *
 * The order of these three lines is doing real work. Glute and hip is read
 * first because a Glute Bridge names the lower back as well as the glutes and
 * is plainly a glute drill; reading trunk first would file it as core and a
 * lower body day would lose its best drill. Trunk is read before the lower limb
 * because a Dead Bug names nothing below the hip anyway. Anything left over is
 * the fourth family, which is shoulder, arm, upper back and neck work.
 */
const WARMUP_FAMILY_REGIONS: readonly (readonly [WarmupFamily, readonly PainRegion[]])[] = [
  ['glute_hip', ['glutes', 'hip_groin']],
  ['core', ['core_ribs', 'lower_back']],
  ['lower_limb', ['knee', 'quads', 'hamstrings', 'calf_shin', 'ankle_achilles']],
];

/** What this drill is for. Exported so a check can ask the same question. */
export function warmupFamilyOf(drill: ExerciseTemplate): WarmupFamily {
  for (const [family, regions] of WARMUP_FAMILY_REGIONS) {
    if (drill.targetRegions.some((region) => regions.includes(region))) return family;
  }
  return 'upper';
}

/**
 * WHICH DRILLS EACH DAY WANTS, IN ORDER, ONE ENTRY PER WARM-UP SLOT.
 *
 * Archie, 25 September 2026: "During lower body sessions glute exercises should
 * be a priority in the warm up instead of Deadbug or other core exercises."
 *
 * What he was looking at was worse than a bad order. A lower body day and an
 * upper body day were getting the IDENTICAL warm-up, in all 13,104 combinations
 * of kit, level, length, age, sore area and rotation that the sweep behind this
 * change generated, because nothing about the warm-up knew which session it was
 * standing in front of. So this is not a reordering. It is the warm-up learning
 * what day it is.
 *
 * HOW TO READ A ROW. Slot 0 takes the first entry, slot 1 the second and so on,
 * and where a family has nothing left to give - the kit rules it out, the sore
 * area withholds it, or the session is already doing it - the slot falls
 * through to the next entry in the row, and then to any family at all. A lower
 * body warm-up therefore opens on hip work at every kit and every level, spends
 * its second slot on hip work too, and only reaches core at a fourth slot,
 * which no session length ever asks for. Core is not deleted from the pool: it
 * takes the second drill on an upper body day and the third on a full body
 * day, which is where Archie says it belongs. Measured over the sweep, every
 * warm-up it can build is one of nine shapes, three per day, and they are
 * printed by tests/warmup-shape.check.mjs section [4].
 *
 * WHY A FAMILY IS NAMED TWICE. Repeating 'glute_hip' is how a row says "this
 * matters more here", without spelling out which drill. Every glute drill
 * written from now on inherits both slots by having glutes or the hip in its
 * own targetRegions, which a hand-written list could not do.
 *
 * FULL BODY NAMES EACH FAMILY ONCE, deliberately: that session squats, hinges,
 * pushes and pulls, so its warm-up covers the hip and then the shoulder rather
 * than doubling up on either. At thirty minutes there is only one slot and a
 * full body day opens on the same hip drill a lower body day does, which is the
 * right answer for both - they both squat - rather than a rule bent to make the
 * two look different.
 */
export const WARMUP_ORDER: Record<LibrarySessionType, readonly WarmupFamily[]> = {
  lower_body: ['glute_hip', 'glute_hip', 'lower_limb', 'core', 'upper'],
  upper_body: ['upper', 'core', 'upper', 'glute_hip', 'lower_limb'],
  full_body: ['glute_hip', 'upper', 'core', 'lower_limb'],
};

/**
 * WHICH FAMILIES ONE SLOT MAY TRY, BEST FIRST, AND WHY THERE ARE FOUR OF THEM.
 *
 * The slot's own entry comes first, then the rest of the row from that point,
 * then every family there is. So the preference decides the ORDER and never the
 * eligibility: a family with nothing left to give - the kit rules it out, the
 * sore area withholds it, or the session is already doing all of it - hands the
 * slot on rather than leaving it empty.
 *
 * A separate function rather than a loop inside the builder because the tail is
 * the part that cannot be reached with today's thirteen drills. Every family
 * still has something in it in every combination the sweep generates, so the
 * fall-through never fires and a check watching generated sessions could not
 * tell whether it was there. Here it can be asked directly, which is the
 * difference between defensive code and untested code.
 */
export function warmupFamilyOrder(sessionType: LibrarySessionType, slot: number): WarmupFamily[] {
  const order = WARMUP_ORDER[sessionType];
  const from = slot % order.length;
  const tried: WarmupFamily[] = [];
  for (const family of [...order.slice(from), ...order, ...WARMUP_FAMILIES]) {
    if (!tried.includes(family)) tried.push(family);
  }
  return tried;
}

/**
 * THE DRILLS ARCHIE NAMED, ONE ENTRY PER SLOT, BEST RECORD FIRST.
 *
 * Archie, 29 September 2026: Full Body gets Banded Face Pulls AND Hip Circles,
 * Upper Body gets Banded Face Pulls, Lower Body gets Hip Circles. "These
 * exercises should be the go to exercises but should still have swap options if
 * the client wants to do a different exercise."
 *
 * A LIST OF NAMES, WHICH IS THE OPPOSITE OF WHAT WARMUP_ORDER ABOVE IS, AND ON
 * PURPOSE. Three days earlier he described a RULE - glutes before a leg day -
 * and a rule is what the family order holds, so that a drill written next year
 * inherits it. This time he named the exercises themselves, and a rule dressed
 * up to produce two particular records would be the code pretending to have
 * reasons it has not got. The two live one above the other: these lead, and the
 * family order fills every slot they do not.
 *
 * BY ID RATHER THAN BY NAME, so a spelling change cannot quietly empty a row;
 * ids that match nothing are caught by tests/warmup-named.check.mjs.
 *
 * SECOND ENTRY IS THE NO-KIT ANSWER, in his words: "banded face pulls swaps to
 * doorframe rows". Hip Circles has no second entry because it needs nothing -
 * he asked for plain hip circles rather than banded ones for exactly that
 * reason - so everybody gets it whatever they own.
 */
export const NAMED_WARMUP_DRILLS: Record<LibrarySessionType, readonly (readonly string[])[]> = {
  lower_body: [['ph-s-16']],
  upper_body: [['bn-acc-bw-8', 'lib-pull-door-frame-rows']],
  full_body: [['bn-acc-bw-8', 'lib-pull-door-frame-rows'], ['ph-s-16']],
};

/**
 * WHAT MAY OPEN A SESSION, IN TIERS, BEST TIER FIRST.
 *
 * Archie, 29 September 2026: "the warm up exercises should be a cardio option
 * for 2 minutes (incline walk, assault bike etc.)". So the first tier is the
 * cardio records that need a machine, because those are the ones he named and
 * because a gym is where they are. The second is the cardio that needs nothing
 * - skipping and the walk - which is his own answer for somebody at home, and
 * which a beginner reaches as the walk alone, since decision 7 keeps skipping
 * away from beginners and is not overruled here.
 *
 * THE THIRD TIER IS STAGE 7'S RULE, KEPT UNDERNEATH RATHER THAN DELETED. The
 * Bear Crawl and the Duck Walk are still allowed to open a session when there
 * is no cardio left at all. Today there always is - the walk needs nothing and
 * carries no stress tag - so this tier cannot fire, which is exactly why it is
 * a function that can be asked directly rather than a branch inside the builder
 * that no sweep could reach.
 *
 * EMPTY TIERS ARE DROPPED, so a caller walking them in order never has to
 * decide what an empty pool means.
 */
export function warmupCardioTiers(
  available: readonly ConditioningExercise[]
): ConditioningExercise[][] {
  const cardio = available.filter(isCardioOpener);
  return [
    cardio.filter((e) => e.kit.length > 0),
    cardio.filter((e) => e.kit.length === 0),
    available.filter((e) => !isCardioOpener(e)),
  ].filter((tier) => tier.length > 0);
}

/**
 * How long the opening cardio card runs for. Archie's number, not a guess.
 *
 * Written over whatever the record itself asks for, because the records were
 * written as conditioning work and say so: the treadmill walk is five minutes,
 * the rower five hundred metres, skipping sixty seconds. Two minutes is what he
 * asked a warm-up to be, and `doseOfPrescription` reads this sentence as time,
 * so the card gets a countdown rather than a rep counter.
 */
export const CARDIO_OPENER_REPS = '2 min';

/**
 * The pattern slots each session asks for, in order, and two versions of each.
 *
 * ALTERNATING, because a Lower Body day that always opened with a squat would
 * leave the hinge permanently second, and the second slot is not the one that
 * gets progressed. Full Body alternates the same way between Squat and Hinge,
 * and the other of the two takes the third slot, so both always appear.
 *
 * The first slot FILLED is the main exercise. Not the first slot asked for: if
 * a pattern has nothing at this person's level with this person's kit, the slot
 * is dropped and the next pattern in the list takes its place.
 *
 * NO LIST REPEATS THE PATTERN IT OPENS WITH, AND NO LEG DAY ASKS FOR CORE.
 * ──────────────────────────────────────────────────────────────────────
 * Both are Archie's accessory rules (24 September 2026) written into the tables
 * rather than left for the loop to correct every time. Upper Body used to ask
 * for a second push after a push and a second pull after a pull; Lower Body used
 * to spend its third slot on core. `accessoryPatternsFor` below enforces the
 * same two rules on whatever the loop actually does, because the main exercise
 * is the first slot FILLED and a dropped opener moves it down the list.
 *
 * WHAT THAT COSTS UPPER BODY, said out loud because it is a visible change.
 * Pushing and pulling are the only two non-core patterns an Upper Body day has,
 * so a session that opens on a press cannot ask for a second press, and a full
 * hour comes back as one press, two rows and two core pieces. Lower Body loses
 * nothing: it has three leg patterns and only needs two of them.
 */
const SLOT_PATTERNS: Record<LibrarySessionType, readonly (readonly LibraryPattern[])[]> = {
  full_body: [
    ['squat', 'push', 'hinge', 'pull', 'core', 'lunge'],
    ['hinge', 'push', 'squat', 'pull', 'core', 'lunge'],
  ],
  upper_body: [
    ['push', 'pull', 'core', 'pull', 'core'],
    ['pull', 'push', 'core', 'push', 'core'],
  ],
  lower_body: [
    ['squat', 'hinge', 'lunge', 'hinge', 'lunge'],
    ['hinge', 'squat', 'lunge', 'squat', 'lunge'],
  ],
};

/**
 * How many of those slots the clock allows.
 *
 * Exported so a check can ask what a session ASKED for before counting what it
 * got. A slot the library cannot fill is dropped rather than padded, so the two
 * numbers come apart at home, and the gap between them is a fact about Archie's
 * list rather than a bug: see tests/train-library.check.mjs section 15.
 */
export const SLOT_COUNTS: Record<LibrarySessionType, Record<TimeAvailable, number>> = {
  full_body: { '30': 4, '45': 5, '60': 6 },
  upper_body: { '30': 3, '45': 4, '60': 5 },
  lower_body: { '30': 3, '45': 4, '60': 5 },
};

/** The patterns each session type is about, which is what the power block uses. */
const SESSION_PATTERNS: Record<LibrarySessionType, readonly LibraryPattern[]> = {
  full_body: ['squat', 'hinge', 'push', 'pull', 'core', 'lunge'],
  upper_body: ['push', 'pull', 'core'],
  lower_body: ['squat', 'hinge', 'lunge', 'core'],
};

/**
 * THE HARDEST RUNG AN ACCESSORY MAY SIT ON, GIVEN THE MAIN LIFT.
 *
 * Archie, 24 September 2026: "athlete level squat variation should be followed
 * by an advanced/intermediate or beginner exercise to avoid the client getting
 * too fatigued and injured from attempting two athlete level movements." So an
 * accessory is at least one rung BELOW the main lift of that session, and the
 * rung it is measured against is the main lift's own level from the library,
 * not the person's ceiling: somebody at Athlete whose squat slot came back
 * Advanced is the person this rule is protecting.
 *
 * MEASURED BEFORE THE RULE EXISTED, over the 4,608 sessions the check below
 * sweeps: 90.1% of accessory cards sat at or above the main lift's level and
 * 16.3% sat strictly above it. Behind an ATHLETE main lift, 560 of 732
 * accessory cards were themselves athlete level. That is an athlete being given
 * a second athlete movement to follow the first, which is the exact thing he
 * described. Afterwards: 0.0% above, and 0 of 792.
 *
 * WHAT HAPPENS UNDER A BEGINNER MAIN LIFT, said out loud because there is no
 * rung below level 1 and the alternative is an accidental empty session: the
 * floor holds at 1 and the accessories sit ALONGSIDE the main lift rather than
 * below it. Nothing in the library is easier than level 1, a beginner's main
 * lift is a bodyweight squat rather than a loaded barbell, and "one rung below"
 * would mean "no accessories at all". It is deliberate, and
 * tests/accessory-selection.check.mjs asserts it as its own case.
 */
export function accessoryLevelCeiling(mainLevel: LibraryLevel): LibraryLevel {
  return Math.max(1, mainLevel - 1) as LibraryLevel;
}

/**
 * The patterns an accessory may be drawn from, hardest rule first.
 *
 * TWO OF ARCHIE'S THREE ACCESSORY RULES LIVE HERE.
 *
 * A DIFFERENT MOVEMENT FROM THE MAIN LIFT: "hinge then squat or lunge or squat
 * then hinge or lunge or Lunge then squat or hinge." So the main lift's own
 * pattern is out, whichever pattern that turned out to be.
 *
 * AND ON A LEG DAY, LEG WORK: "accessory movements should be leg related not
 * completely core related when doing a lower body workout." Core is out of the
 * Lower Body list above, and it is left out of this one everywhere, which is
 * the stronger half of the same rule: core is a slot a session ASKS for, never
 * a filler a short pool falls back on. Without that, a home Upper Body session
 * whose one pulling exercise was already used came back as a press and three
 * planks - every rule obeyed, and not a session anybody would recognise.
 */
export function accessoryPatternsFor(
  sessionType: LibrarySessionType,
  mainPattern: LibraryPattern
): LibraryPattern[] {
  return SESSION_PATTERNS[sessionType].filter((p) => p !== mainPattern && p !== 'core');
}

/** What a missing pattern is called in a sentence somebody has to read. */
const PATTERN_WORDS: Record<LibraryPattern, string> = {
  push: 'pushing',
  pull: 'pulling',
  hinge: 'hinge',
  squat: 'squat',
  lunge: 'lunge',
  core: 'core',
};

/**
 * Kit, in the words somebody ticking a box would use.
 *
 * Exported so the conditioning session next door says "a rowing machine" in the
 * same words this one does. Two copies of this table is how one of them starts
 * calling a sled "a sled" on one screen and "a prowler" on the next.
 */
export const KIT_WORDS: Record<KitKey, string> = {
  plates: 'weight plates',
  blocks: 'a block',
  bench: 'a bench',
  box: 'a box or sturdy step',
  band: 'resistance bands',
  dumbbell: 'dumbbells',
  kettlebell: 'a kettlebell',
  barbell: 'a barbell',
  landmine: 'a landmine attachment',
  corner: 'a corner',
  rack: 'a rack',
  trx: 'a suspension trainer',
  medball: 'a medicine ball',
  slamball: 'a slam ball',
  cable: 'a cable machine',
  latpulldown: 'a lat pulldown machine',
  pullupbar: 'a pull-up bar',
  trapbar: 'a trap bar',
  abwheel: 'an ab wheel',
  doorframe: 'a door frame',
  sled: 'a sled',
  assaultbike: 'an assault bike',
  treadmill: 'a treadmill',
  rower: 'a rowing machine',
  rope: 'a skipping rope',
};

/**
 * The one pull that needs nothing (decision 4).
 *
 * WHAT KEEPS PULLING IN A HOME SESSION, AND WHAT DOES NOT
 * ──────────────────────────────────────────────────────
 * Not a special case in the slot loop. This record is Beginner, and a door
 * frame is one of the three things lib/kit.ts says everybody owns, so it is
 * already inside every pull pool at every level: widening downward reaches it
 * whatever the ceiling, and nobody has to be handed it by name.
 *
 * A branch that fetched it when the pull slot came up empty was written, and
 * deleted: it could not fire, because the only conditions under which the slot
 * IS empty - the record already used, or ruled out by a sore shoulder - are the
 * same conditions the branch itself re-tested. Dead code that looks like a
 * safety net is worse than none, so the guarantee is stated here and asserted in
 * tests/train-library.check.mjs, which builds real home sessions at every level
 * and looks for the pull.
 *
 * Named rather than left implicit because this is the one record in the library
 * whose kit line carries the whole promise. Re-file it, raise its level or give
 * it a requirement and the check fails, which is the point.
 */
export const NO_KIT_PULL = 'Door Frame Rows';

/**
 * Tags the app will not CHOOSE for a beginner, whether or not anything hurts.
 *
 * `restrictedTagsFor` already adds high impact for a beginner who reports a
 * complaint, which leaves the pain-free beginner - the person this rule is most
 * obviously about. Decision 7 says beginners are not given skipping in warm-ups
 * or finishers, and the same sentence is true of a depth jump. Every
 * high-impact record in the library is Athlete level, so the ceiling already
 * covers the jumps; this is what covers Skipping, which has no level at all.
 */
const BEGINNER_NEVER: readonly StressTag[] = ['high_impact'];

/** Goals that earn a finisher at 45 minutes as well as at 60. */
const FINISHER_GOALS = ['fat_loss', 'fitness'];

/** A record carrying everything the safety screen reads. */
type ScreenableRecord = ExerciseTemplate & { stress?: readonly StressTag[] };

/**
 * What this movement asks of the body that today rules out.
 *
 * Asked BOTH ways round on purpose. `restrictedTagsOnRecord` reads the record's
 * own authored tags unioned with its name, its reps and its cue, which is the
 * strict reading. `restrictedTagsOn` reads exactly what `applyInjurySafety`
 * will read later: the name and the cue, with no movement pattern. Screening on
 * the union means the backstop can never find something this function let
 * through - which matters, because the backstop substitutes from the OLD
 * catalogue, so anything it has to fix arrives as an exercise that is not in
 * Archie's library at all.
 */
function hitsOn(record: ScreenableRecord, banned: Set<StressTag>): StressTag[] {
  if (banned.size === 0) return [];
  const asRecord = restrictedTagsOnRecord(
    {
      name: record.name,
      movementPattern: record.movementPattern,
      reps: record.reps,
      cue: record.cue,
      stress: record.stress,
    },
    banned
  );
  const asCard = restrictedTagsOn(record.name, banned, undefined, record.cue);
  return [...new Set([...asRecord, ...asCard])];
}

/**
 * Library records of one pattern, at the ceiling and below, best rung first.
 *
 * Widening is the only direction this moves. It stops as soon as the pool holds
 * MIN_SLOT_POOL entries, so somebody at Advanced with seven advanced squats
 * never sees a beginner one, while somebody at Athlete - where the library has
 * no non-power lunges at all - drops to Advanced and finds seven.
 *
 * Power records are excluded and used only by the power block: a jump is not a
 * squat slot, and decision 8 keeps jumps and throws at Athlete alone.
 */
export function slotPool(
  pattern: LibraryPattern,
  ceiling: LibraryLevel,
  equipment: readonly EquipmentTier[]
): LibraryExercise[] {
  const eligible = LIBRARY_EXERCISES.filter(
    (e) =>
      patternsOf(e).includes(pattern) &&
      e.role !== 'power' &&
      hasAuthoredContent(e) &&
      canPerformWith(e, equipment)
  );
  const pool: LibraryExercise[] = [];
  for (let level = ceiling; level >= 1; level--) {
    pool.push(...eligible.filter((e) => e.level === level));
    if (pool.length >= MIN_SLOT_POOL) break;
  }
  return pool;
}

/**
 * Which kit, if they had it, would have filled this slot.
 *
 * Read off the records that were actually refused rather than guessed: every
 * record of this pattern inside the ceiling that the kit rules out is asked
 * which of its requirements went unmet, and the keys named most often are the
 * ones worth mentioning. The three things everybody owns can never appear,
 * because a record needing them is never refused.
 */
function kitThatWouldUnlock(
  pattern: LibraryPattern,
  ceiling: LibraryLevel,
  equipment: readonly EquipmentTier[]
): KitKey[] {
  const counts = new Map<KitKey, number>();
  for (const record of LIBRARY_EXERCISES) {
    if (!patternsOf(record).includes(pattern)) continue;
    if (record.role === 'power' || record.level > ceiling || !hasAuthoredContent(record)) continue;
    if (canPerformWith(record, equipment)) continue;
    const missing = new Set<KitKey>();
    for (const group of record.kit) {
      if (canPerformWith({ kit: [group], libraryName: record.libraryName }, equipment)) continue;
      for (const key of group) missing.add(key);
    }
    for (const key of missing) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([key]) => key);
}

/** "Dumbbells or a kettlebell would open more up." */
export function kitSentence(keys: KitKey[]): string {
  if (keys.length === 0) return 'Nothing on the equipment list would change that.';
  const words = keys.map((k) => KIT_WORDS[k]);
  const list = words.length === 1 ? words[0] : `${words[0]} or ${words[1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} would open more up.`;
}

/**
 * Walk a pool from a starting index, taking the first entry that fits.
 *
 * The index is where variation lives; the walk is what makes it safe. An entry
 * already in the session, or one today rules out, is stepped over rather than
 * allowed to collapse the slot, and the step is the `k` in the plan's
 * `pool[(floor(n / 4) + k) % len]`: deterministic, and the same every time the
 * same session is rebuilt.
 */
function pickFrom<T>(pool: readonly T[], startIndex: number, fits: (item: T) => boolean): T | null {
  if (pool.length === 0) return null;
  const start = ((Math.trunc(startIndex) % pool.length) + pool.length) % pool.length;
  for (let k = 0; k < pool.length; k++) {
    const item = pool[(start + k) % pool.length];
    if (fits(item)) return item;
  }
  return null;
}

/**
 * Which half of the body a record loads, from its own pattern rather than the
 * session it landed in.
 *
 * The first-time weight estimate needs it, and the difference is not small: the
 * female factor is 0.55 on upper body work and 0.72 on lower. The old engine
 * answers it per SESSION, so every movement in a full body session is treated
 * as upper body and a woman's first squat estimate comes out a fifth light.
 *
 * Core counts as lower. A suitcase carry is held in the hands and limited by
 * the trunk and the hips, and treating it as upper body would prescribe it
 * lighter than everything else in the session.
 */
export function isUpperBodyPattern(pattern?: LibraryPattern): boolean {
  return pattern === 'push' || pattern === 'pull';
}

/**
 * THREE SETS IS WHAT AN ACCESSORY IS, AND THE LIBRARY ALREADY SAYS SO.
 *
 * Every one of the forty accessory-role records in lib/exercise-library.ts
 * carries `sets: 3`. The old recipe computed a number from the level, the goal
 * and the energy and threw the record's own answer away, which is how the
 * accessory block came out anywhere from one set to five: measured over 15,120
 * generated sessions it was two sets 41% of the time, three 31%, four 20% and
 * five 7%.
 */
const ACCESSORY_SETS = 3;

/** Sets before anything is spent on them, from the level, the goals and today. */
function setsFor(
  role: 'main' | 'accessory',
  profile: UserProfile | undefined,
  energy: EnergyLevel,
  /**
   * The record that filled the slot, so its own prescription can be read.
   *
   * Read only for accessory work. A record the library files as a main lift
   * brings a set count that includes its warm-up climb, and that number belongs
   * to the slot it was written for - four sets of Barbell Bulgarian Split
   * Squats is a main lift's ramp, not an accessory's dose.
   */
  chosen?: LibraryExercise
): number {
  if (role === 'accessory') {
    let sets = chosen?.role === 'accessory' ? chosen.sets : ACCESSORY_SETS;
    /**
     * THE REDUCTIONS THAT SURVIVE, AND WHY EACH ONE DOES.
     *
     * Three is the NORMAL, not an absolute. Everything below protects somebody
     * having a bad day, and honouring a round number by deleting one of them
     * would be a safety regression dressed up as tidiness. The other two
     * reductions are applied later, over the finished list: an easier week
     * (easeForDeloadWeek) and a severe pain report (screenForPain), both in
     * lib/workout-engine.ts.
     *
     * Rehab is kept here for the same reason it outranks strength in the rep
     * table: somebody who has told the app they are injured should not have
     * their accessory volume raised by fifty per cent because a round number
     * was easier to explain. The level and the other five goals no longer move
     * it, which is what Archie asked for.
     */
    if ((profile?.goals ?? []).includes('rehab')) sets -= 1;
    if (energy === 'low') sets -= 1;
    return Math.max(2, Math.min(5, sets));
  }
  const level = profile?.experienceLevel ?? 'intermediate';
  let sets = level === 'beginner' ? 2 : 3;
  if (level === 'advanced' || level === 'athlete') sets = 4;
  const { mainSetsDelta } = getGoalVolumeDeltas(profile?.goals ?? []);
  sets += mainSetsDelta;
  if (energy === 'low') sets -= 1;
  if (energy === 'high') sets += 1;
  return Math.max(2, Math.min(5, sets));
}

/**
 * One key per MOVEMENT, so the same exercise cannot appear twice under two
 * spellings.
 *
 * The session draws on three lists written at different times. Restore calls it
 * a "Dead Bug" and the library calls it a "Deadbug"; Restore has a "Glute
 * Bridge" and so does the library's Hinge, Beginner row. A plain lower-cased
 * comparison sees four exercises where there are two, and a beginner's session
 * came back with the same movement in the warm-up and again in the work.
 *
 * Letters and digits only, so spacing, hyphens and brackets stop mattering.
 */
function sameMovementKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Words that name the implement or the stance rather than the movement.
 *
 * "Dumbbell Bench Press" and "Incline Dumbbell Bench Press" are two records and
 * one movement, and so are the seated and the standing dumbbell press: Archie's
 * list holds them apart because the coaching differs, but two cards one under
 * the other reading almost the same words is the complaint this exists for.
 */
const IMPLEMENT_WORDS = new Set([
  'a',
  'and',
  'band',
  'banded',
  'bar',
  'barbell',
  'bodyweight',
  'cable',
  'db',
  'dumbbell',
  'kb',
  'kettlebell',
  'landmine',
  'machine',
  'of',
  'resistance',
  'seated',
  'smith',
  'standing',
  'suspension',
  'the',
  'trap',
  'trapbar',
  'trx',
  'weighted',
  'with',
]);

/** The words in a name that describe the movement itself. */
function movementWords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/[\s-]+/)
      .map((w) => (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
      .filter((w) => w.length > 1 && !IMPLEMENT_WORDS.has(w))
  );
}

/**
 * TWO NAMES THAT READ AS THE SAME MOVEMENT IN DIFFERENT KIT.
 *
 * A softer test than `sameMovementKey`, and it is used softly: a record that
 * reads as a repeat is stepped over while anything else fits, and taken when
 * nothing else does. It exists because the accessory rules made a session ask
 * for the same PATTERN twice - a leg day is a squat and then hinges and lunges,
 * with no core slot to break them up - and the first sweep after that change
 * produced Kettlebell Goblet Squats above Landmine Goblet Squats, and a Cable
 * Romanian Deadlift above a Single Leg Romanian Deadlift.
 *
 * One name's movement words being contained in the other's is what counts, so
 * "Goblet Squats" does not swallow every squat in the library: a single word in
 * common is only a repeat when it is the whole of both names.
 */
function readsAsSameMovement(a: string, b: string): boolean {
  const first = movementWords(a);
  const second = movementWords(b);
  const [small, large] = first.size <= second.size ? [first, second] : [second, first];
  if (small.size === 0) return false;
  if (small.size === 1) return small.size === large.size && [...small].every((w) => large.has(w));
  return [...small].every((w) => large.has(w));
}

/**
 * The strength session, built from the library.
 *
 * Returns the cards AND what it could not build, because the second half is the
 * honest part: "nobody without equipment has a pulling exercise" is a fact
 * about the library, and hiding it behind a session that quietly contains five
 * pushes would be the app pretending.
 */
export function generateLibrarySession(input: LibrarySessionInput): LibrarySession {
  const {
    sessionType,
    readiness,
    profile,
    sessionTypeCount = 0,
    strengthSessionCount = 0,
    libraryEpochSessionCount = 0,
    exerciseFeedback,
    lastLoggedWeights,
    exerciseNormalStreak,
    exerciseStuckStreak,
    lastSessionPerformance,
    exerciseRepTarget,
    loadUnit = 'kg',
  } = input;
  const daysSinceLastSession =
    input.daysSinceLastSession === undefined ? daysSinceLastTrained() : input.daysSinceLastSession;
  /**
   * An empty selection means bodyweight, not "no exercises at all".
   *
   * `canPerformWith` already reads an empty list as the three things everybody
   * owns, but `possibleFor` - which the Restore pools go through - reads it as
   * owning nothing, and would hand back an empty warm-up.
   */
  const equipment: EquipmentTier[] =
    input.equipment.length > 0 ? [...input.equipment] : ['bodyweight'];

  const { energy, timeAvailable } = readiness;
  const n = Math.max(0, Math.trunc(sessionTypeCount));
  const ceiling = levelCeilingFor(profile);
  const experience = profile?.experienceLevel ?? 'intermediate';
  const layoff = getLayoff(daysSinceLastSession);
  const effectiveTier = getEffectiveTier(equipment);

  /**
   * EVERY AREA THAT MATTERS, NOT ONLY WHAT HURTS TODAY.
   *
   * Three lists merged: what they reported on the readiness screen, what a
   * clinician told them to stay off, and what was already sore when they signed
   * up. The second and third were collected, stored, synced and read by nothing
   * for a long time, which is how two sessions built side by side, identical
   * but for a standing knee problem, came back the same card for card.
   *
   * Today's report leads, because it decides which area the rehab slot treats.
   */
  const reportedToday = readiness.painRegion
    ? Array.isArray(readiness.painRegion)
      ? readiness.painRegion
      : [readiness.painRegion]
    : [];
  const flagged = [
    ...new Set([
      ...reportedToday,
      ...(profile?.standingSoreRegions ?? []),
      ...(profile?.clinicalAvoid ?? []),
    ]),
  ];
  const screenedReadiness: LibraryReadiness =
    flagged.every((r) => reportedToday.includes(r)) && flagged.length === reportedToday.length
      ? readiness
      : { ...readiness, painRegion: flagged };

  const banned = restrictedTagsFor(flagged, experience, readiness.painSeverity ?? 'mild');
  /**
   * What may not be CHOSEN, which is a wider list than what may not stay.
   *
   * The beginner impact rule lives here rather than in `banned` because it is
   * not a pain adaptation: nothing has to be swapped and labelled, the records
   * simply never enter a pool. Labelling it would put "swapped to protect your
   * knee" on the card of somebody whose knee is fine.
   */
  const neverChoose = new Set<StressTag>([
    ...banned,
    ...(experience === 'beginner' ? BEGINNER_NEVER : []),
  ]);
  const regionLabel = flagged.length > 0 ? getPainRegionLabel(flagged[0]) : 'injury';

  const gaps: LibraryGap[] = [];
  const used = new Set<string>();
  const free = (record: { name: string }) => !used.has(sameMovementKey(record.name));
  const choosable = (record: ScreenableRecord) =>
    free(record) && hitsOn(record, neverChoose).length === 0;

  /** Cards in build order, each remembering what it is for. */
  const built: { card: Exercise; loadPattern?: LibraryPattern; satisfies?: LibraryPattern }[] = [];
  const add = (card: Exercise, loadPattern?: LibraryPattern, satisfies?: LibraryPattern): void => {
    used.add(sameMovementKey(card.name));
    built.push({ card, loadPattern, satisfies });
  };

  /**
   * Restore's own mobility drills, filed here as prep because in this session
   * that is what they are. Filed as prehab they would be exempt from the injury
   * screen, and that exemption exists for the rehab slot, which is chosen FOR a
   * sore area and must not be screened away because it mentions it.
   *
   * Read by the pulse raiser as well as by the mobility block, which is why it
   * is defined above both rather than beside the one that used to own it.
   */
  const mobilityPool = possibleFor(getStandalonePrehabWorkout(), equipment).filter(
    (t) => t.category === 'prehab'
  );

  /**
   * The same drills again, filed by what each one is for.
   *
   * Built from the pool rather than written down, so a drill added to Restore
   * joins a family on its own targetRegions, and a family the kit empties out
   * simply has nothing in it here.
   */
  const mobilityByFamily = new Map<WarmupFamily, ExerciseTemplate[]>();
  for (const drill of mobilityPool) {
    const family = warmupFamilyOf(drill);
    const drills = mobilityByFamily.get(family);
    if (drills) drills.push(drill);
    else mobilityByFamily.set(family, [drill]);
  }
  /**
   * THE DRILL FOR ONE WARM-UP SLOT, CHOSEN FOR THE DAY IT STANDS IN FRONT OF.
   *
   * The slot's own entry in this session type's row is tried first, then the
   * rest of the row from that point, then every family there is. So this cannot
   * come back empty while the pool still holds anything the person can safely
   * do: the preference decides the ORDER and never the eligibility.
   *
   * THE ORDER IS NOT ALLOWED TO OVERRULE THE SCREEN. Every candidate goes
   * through `choosable`, which is the pain screen and the beginner rule, so a
   * glute drill withheld from a sore glute stays withheld even though glute
   * work now leads a lower body day. The slot falls through to the next family
   * rather than the drill being forced in at the top.
   *
   * The rotation offset is the one every other slot uses, moved along by the
   * slot index, so a day that asks one family for two drills gets two different
   * drills and the pair turns over with the block.
   */
  const pickDrill = (slot: number): ExerciseTemplate | null => {
    for (const family of warmupFamilyOrder(sessionType, slot)) {
      const drill = pickFrom(
        mobilityByFamily.get(family) ?? [],
        Math.floor(n / SLOT_ROTATION_EVERY) + slot,
        choosable
      );
      if (drill) return drill;
    }
    return null;
  };

  /**
   * WHICH MOVEMENTS THE WORK BELOW IS GOING TO ASK FOR.
   *
   * Read here, above the warm-up, rather than where the slots are filled,
   * because one of the drills Archie named can collide with them - see
   * `wouldStripTheWork`. Nothing about it depends on the warm-up, so moving it
   * up changes no answer.
   */
  const patterns = SLOT_PATTERNS[sessionType][n % SLOT_PATTERNS[sessionType].length];
  const slotCount = SLOT_COUNTS[sessionType][timeAvailable];
  const asked = new Set<LibraryPattern>(patterns.slice(0, slotCount));

  // ── 1. Two minutes of cardio ──────────────────────────────────────────────
  // Archie, 29 September 2026: "the warm up exercises should be a cardio option
  // for 2 minutes (incline walk, assault bike etc.)". Skipping is not offered to
  // a beginner here or in the finisher (decision 7), which the beginner impact
  // rule above takes care of, so a beginner at home opens on the walk.
  const conditioningPool = CONDITIONING_EXERCISES.filter(
    (e) => hasAuthoredContent(e) && canPerformWith(e, equipment)
  );
  /**
   * THE SLED IS CONDITIONING, NOT A WARM-UP (Archie, 25 September 2026).
   *
   * `isPulseRaiser` in lib/exercise-library.ts holds the rule and says why. It
   * applies to this slot and to the swap button behind it, and to nothing else:
   * the finisher below still draws on the whole list, so the sled keeps its
   * place in the session, just not at the top of it.
   *
   * It is now the second question rather than the first, because everything the
   * cardio tiers offer is already something Archie named as a warm-up. The sled
   * cannot reach the tiers at all: no sled record says it works the
   * cardiovascular system, and the tier that would take one is the third, which
   * this filter empties of sled work before `warmupCardioTiers` ever sees it.
   */
  const pulsePool = conditioningPool.filter(isPulseRaiser);
  /**
   * The walk, when the kit and the day allow it, on the end of that list.
   *
   * It is not on Archie's nine and must not be: see WARMUP_CARDIO_EXERCISES in
   * lib/exercise-library.ts. It is here because this is the one slot it is for.
   */
  const openerPool = [
    ...pulsePool,
    ...WARMUP_CARDIO_EXERCISES.filter((e) => hasAuthoredContent(e) && canPerformWith(e, equipment)),
  ];
  /** The same records by id, so the swap pass below can tell one of them from a
   *  Restore drill that stood in for it. */
  const conditioningById = new Map(
    [...conditioningPool, ...WARMUP_CARDIO_EXERCISES].map((e) => [e.id, e])
  );
  const openerTiers = warmupCardioTiers(openerPool);
  /**
   * The best tier that has something this person may do today.
   *
   * Every tier is walked from the same rotation position, so the choice within
   * a tier turns over with the block exactly as it did before, and a tier that
   * is empty or entirely withheld hands the slot to the next one rather than
   * leaving the session without an opener.
   */
  let opener: ConditioningExercise | null = null;
  for (const tier of openerTiers) {
    opener = pickFrom(tier, Math.floor(n / SLOT_ROTATION_EVERY), choosable);
    if (opener) break;
  }
  if (opener) {
    /**
     * TWO MINUTES, WRITTEN OVER THE RECORD'S OWN PRESCRIPTION.
     *
     * Only for a cardio option, which is all this slot can hold today. If the
     * third tier ever fires, a Bear Crawl keeps the fifteen metres it is written
     * at rather than being put on a two minute clock it was never written for.
     */
    const asCardio = isCardioOpener(opener);
    add({
      ...templateToExercise(opener),
      category: 'prep',
      sets: 1,
      reps: asCardio ? CARDIO_OPENER_REPS : opener.reps,
      suggestedLoad: 'Easy pace',
    });
  } else {
    /**
     * NOTHING AT ALL FITS, SO THE SESSION OPENS ON RESTORE MOBILITY.
     *
     * It used to stand in with ph-s-1, "Cardio Warm-Up (Easy Walk / Bike)" - the
     * card the Restore Joint Health session opens on. That was the last place in
     * a Train session where an old template could still reach the user: it names
     * a stationary bike, which is on neither Archie's conditioning list nor the
     * machine picker any more, and it carries no video because it is an
     * instruction rather than a movement.
     *
     * A mobility drill is a real record from the same pool the block below
     * draws on, so the session opens on something that can be demonstrated, and
     * the person simply gets one more drill than they otherwise would. Nothing
     * is hidden by that: every card still says what it is.
     *
     * It used to be reachable - a beginner with no kit and a sore ankle lost
     * Skipping to the beginner rule and Duck Walks and Bear Crawl to the ankle -
     * and it no longer is, because the Brisk Walk needs nothing and carries no
     * stress tag. It stays because a content change that retired the walk would
     * otherwise leave that person's session with no warm-up at all.
     */
    const stand = pickDrill(0);
    if (stand) {
      add({ ...templateToExercise(stand), category: 'prep' });
    }
  }

  // ── 2. The drills Archie named, then the family order underneath ──────────
  /**
   * A NAMED DRILL THE SESSION IS ABOUT TO NEED FOR ITS OWN WORK IS LEFT ALONE.
   *
   * Door Frame Rows is the no-band answer Archie gave for Banded Face Pulls,
   * and it is also the ONLY pulling exercise in the whole library that needs no
   * equipment (lib/kit.ts says so, and decision 4 is why). Somebody at home has
   * one pull; taking it into the warm-up would hand them an upper body session
   * with no pulling in it at all, because `used` stops the same record being
   * prescribed twice.
   *
   * So the rule is not about that record by name: a named drill is refused
   * unless the session has ANOTHER exercise of that pattern to work with. At
   * home with dumbbells or nothing, it has not, so the warm-up falls through to
   * the family order and the one pull stays where it counts. With bands the
   * pull pool holds three, so Archie's face pulls lead the warm-up and the work
   * still has a pull.
   *
   * ASKED AT LEVEL 1, WHICH IS THE RUNG EVERYBODY CAN REACH, and this is the
   * part a first attempt got wrong. Asking at the person's own ceiling said
   * yes to an Athlete with dumbbells, because the library holds a harder pull
   * they could in principle do - and then the accessory cap, which is a rung
   * below the main lift, put it out of reach and the session came back with no
   * pulling in it at all. The question is not "does a heavier one exist", it is
   * "is there another one this session can certainly use".
   */
  const wouldStripTheWork = (record: LibraryExercise): boolean =>
    patternsOf(record).some(
      (pattern) =>
        asked.has(pattern) &&
        !slotPool(pattern, 1, equipment).some((e) => e.id !== record.id && choosable(e))
    );
  /**
   * THE NAMED DRILLS THAT SURVIVE, IN ARCHIE'S ORDER.
   *
   * One entry per slot he named, each one the first record of its row that this
   * person can do today. A row that comes back with nothing is dropped rather
   * than left as a hole, which is what moves the family order up into its slot.
   */
  const namedDrills: ExerciseTemplate[] = [];
  for (const row of NAMED_WARMUP_DRILLS[sessionType]) {
    for (const id of row) {
      const fromLibrary = LIBRARY_EXERCISES.find((e) => e.id === id);
      const record =
        fromLibrary ??
        (mobilityPool.find((t) => t.id === id) as ExerciseTemplate | undefined) ??
        null;
      if (!record) continue;
      if (fromLibrary && (!canPerformWith(fromLibrary, equipment) || wouldStripTheWork(fromLibrary)))
        continue;
      if (!choosable(record)) continue;
      namedDrills.push(record);
      break;
    }
  }
  /**
   * HOW MANY DRILLS GO IN, WHICH IS NEVER FEWER THAN THE ONES HE NAMED.
   *
   * `mobilityCountFor` protects the half-hour session by giving it one drill,
   * and a Full Body day has two named drills. Archie asked for both of them on
   * that day, so the floor is what he named and the clock decides the rest: a
   * thirty-minute Full Body warm-up is the cardio and two drills, and a
   * thirty-minute Lower Body warm-up is the cardio and one.
   *
   * COUNTED OFF WHAT HE NAMED, NOT OFF WHAT SURVIVED. A full body day whose
   * face pulls are gone - no band, and the door frame row left where the work
   * needs it - still gets two drills, and the family order fills the second.
   * Counting the survivors instead would hand that person a shorter warm-up
   * than the one next to them, which is the hole this is here to close.
   */
  const mobilityCount = Math.max(
    mobilityCountFor(timeAvailable, profile?.ageYears),
    NAMED_WARMUP_DRILLS[sessionType].length
  );
  for (let i = 0; i < mobilityCount; i++) {
    const drill = namedDrills[i] ?? pickDrill(i);
    if (!drill) break;
    /**
     * Two sets, which is the dose every Restore drill in this block is written
     * at. The two Archie named are Train records written as accessory work at
     * three sets, and three sets of a band drill in front of the session is
     * work rather than a warm-up.
     */
    add({ ...templateToExercise(drill), category: 'prep', sets: 2 });
  }

  // ── 3. Power ──────────────────────────────────────────────────────────────
  // Athlete ceiling only, which is decision 8 read exactly: the library files
  // every jump and throw at level 4, and below that ceiling there is no power
  // block and nothing replaces it. Not at 30 minutes, where it would cost the
  // session a movement it is actually about.
  if (ceiling === 4 && timeAvailable !== '30') {
    const powerPool = LIBRARY_EXERCISES.filter(
      (e) =>
        e.role === 'power' &&
        e.level === 4 &&
        hasAuthoredContent(e) &&
        canPerformWith(e, equipment) &&
        patternsOf(e).some((p) => SESSION_PATTERNS[sessionType].includes(p))
    );
    const power = pickFrom(powerPool, Math.floor(n / SLOT_ROTATION_EVERY), choosable);
    if (power) {
      /**
       * Four sets, and the record's own explosive rep count.
       *
       * The plan asks for "4 x 3-5". Writing "3-5" into the reps would make
       * parseReps read it as a countable range and start adding reps to a depth
       * jump, which is the one thing `dose: 'quality'` exists to prevent. Every
       * power record is already written at three to six explosive reps, so the
       * prescription is the one the plan asked for and the dose stays honest.
       */
      add({ ...templateToExercise(power), category: 'neuro', sets: 4 }, power.pattern);
    }
  }

  // ── 4. Pattern slots ──────────────────────────────────────────────────────
  // `patterns`, `slotCount` and `asked` are read above the warm-up, because one
  // of the drills Archie named can collide with the work these ask for.
  /** Why a pattern could not be filled, kept for the sweep below. */
  const reasons = new Map<LibraryPattern, string>();
  /**
   * WHY A PATTERN THE LIST ASKED FOR DID NOT HAPPEN, IN THE PERSON'S WORDS.
   *
   * Two sentences, and which one is right turns on whether the library holds
   * anything of that pattern at the rung this person has earned with the kit
   * they own. That is read at their OWN ceiling and not at the accessory cap:
   * the cap is a rule this app lays on top of the library, so reading the
   * capped pool would tell somebody at Intermediate that nothing at their level
   * exists while an intermediate row sat there with only the cap holding it
   * back. The first sentence to be recorded for a pattern is the one kept, so
   * the earliest slot that asked for it is the one that explains it.
   */
  const noteMissing = (missing: LibraryPattern): void => {
    if (reasons.has(missing)) return;
    const atTheirLevel = slotPool(missing, ceiling, equipment);
    const unlock = kitSentence(kitThatWouldUnlock(missing, ceiling, equipment));
    reasons.set(
      missing,
      atTheirLevel.length === 0
        ? `No ${PATTERN_WORDS[missing]} exercise in the library matches your level and your kit. ${unlock}`
        : `No ${PATTERN_WORDS[missing]} exercise was safe to give you today. ${unlock}`
    );
  };
  let filled = 0;
  /**
   * The main lift, once the first slot is filled. Both accessory rules read it.
   *
   * The exercise, not the pattern that was asked for: a Lower Body session
   * whose squat slot came up empty is a session whose main lift is a hinge, and
   * the accessories have to be a rung below THAT and a different movement from
   * THAT. Reading the list instead of the card is how the rule would quietly
   * stop applying on exactly the sessions that need it most.
   */
  let main: LibraryExercise | null = null;
  /** How many cards each pattern already holds, so a stand-in spreads the work. */
  const patternUse = new Map<LibraryPattern, number>();
  /**
   * The movements already in the work part of the session, by name.
   *
   * Only the work: a warm-up drill and an accessory sharing a word is not what
   * this is for, and `used` already stops the same record appearing twice.
   */
  const workNames: string[] = [];
  const readsAsRepeat = (name: string) => workNames.some((n) => readsAsSameMovement(n, name));
  /**
   * Walk a pool for something that fits AND does not read as a repeat, and only
   * then for something that merely fits.
   *
   * Soft, in that order, because a second goblet squat is worse than a repeat
   * and an empty slot is worse than both.
   */
  const pickFresh = (
    pool: readonly LibraryExercise[],
    startIndex: number,
    fits: (item: LibraryExercise) => boolean
  ): LibraryExercise | null =>
    pickFrom(pool, startIndex, (item) => fits(item) && !readsAsRepeat(item.name)) ??
    pickFrom(pool, startIndex, fits);
  for (let i = 0; i < patterns.length && filled < slotCount; i++) {
    const askedPattern = patterns[i];
    const role: 'main' | 'accessory' = filled === 0 ? 'main' : 'accessory';
    const index =
      role === 'main'
        ? Math.floor(n / MAIN_ROTATION_EVERY)
        : Math.floor(n / SLOT_ROTATION_EVERY) + i;

    /**
     * WHAT THIS SLOT MAY TAKE, AND THE ORDER IN WHICH THE RULES GIVE WAY.
     *
     * A main slot has one attempt: the pattern the list asked for, at the
     * person's own ceiling. Everything below is the accessory rules.
     *
     * An accessory slot is capped at `accessoryLevelCeiling` - one rung below
     * the main lift - for EVERY attempt, and that cap never moves. It is the
     * rule Archie gave a clinical reason for, and the honest answer when it
     * cannot be met is a shorter session, not a heavier one. This file already
     * says so about the level ceiling above, and it is the same sentence.
     *
     * The pattern is the rule that bends, and it bends in this order:
     *
     *   1. the pattern the list asked for, when the rules allow it;
     *   2. the other allowed patterns, least used in this session first, so a
     *      thin pool spreads the work rather than piling it on one movement;
     *   3. the main lift's OWN pattern, one rung lighter. This is the bend, and
     *      it is the right one: an easier second squat is what a tired person
     *      can do safely, whereas a second maximal movement of a different
     *      pattern is the exact injury Archie described.
     *   4. on a LEG DAY ONLY, core. See below.
     *   5. nothing, and the slot is dropped as it always was.
     *
     * WHERE IT BENDS, MEASURED over the 4,608 sessions in
     * tests/accessory-selection.check.mjs. With nothing sore it bends 40 times
     * in 15,036 accessory cards, and only at home: no kit, bodyweight, and
     * bodyweight with a bench. The library holds exactly one pulling exercise
     * that needs no kit, so an Upper Body session that has used Door Frame Rows
     * has no second pull to give and takes an easier press instead. With an
     * area sore it bends 524 times and at every kit set, which is right: a sore
     * knee takes every squat and lunge out of a leg day, and an easier hinge is
     * a better answer than a fourth exercise for the same knee.
     */
    const attempts: { pattern: LibraryPattern; ceiling: LibraryLevel }[] = [];
    if (role === 'main' || !main) {
      attempts.push({ pattern: askedPattern, ceiling });
    } else {
      const cap = accessoryLevelCeiling(main.level);
      const allowed = accessoryPatternsFor(sessionType, main.pattern);
      // No leg day asks for core any more, so the second half of this is a
      // second lock on the same door rather than a live branch: put core back
      // into SLOT_PATTERNS.lower_body and rule 3 still holds. Both locks are
      // mutation-tested in tests/accessory-selection.check.mjs.
      const askedIsAllowed =
        askedPattern !== main.pattern && !(sessionType === 'lower_body' && askedPattern === 'core');
      const timesUsed = (p: LibraryPattern) => patternUse.get(p) ?? 0;
      const rest = allowed
        .filter((p) => p !== askedPattern)
        .sort((a, b) => timesUsed(a) - timesUsed(b) || allowed.indexOf(a) - allowed.indexOf(b));
      for (const p of askedIsAllowed ? [askedPattern, ...rest] : rest) {
        attempts.push({ pattern: p, ceiling: cap });
      }
      attempts.push({ pattern: main.pattern, ceiling: cap });
      /**
       * AND ON A LEG DAY, CORE, AFTER EVERYTHING ELSE AND BEFORE NOTHING AT ALL.
       *
       * Rule 3 says a leg day's accessories are leg work, and this is the one
       * case where it gives way: a sore hip or a sore knee can rule out every
       * squat, hinge and lunge in reach, and then the choice is a core piece or
       * an empty slot. Measured before this line existed, somebody reporting a
       * sore hip lost three of the ten cards in their Lower Body session, which
       * is the app punishing them for telling it the truth -
       * tests/injury-safety.check.mjs holds that loss to two.
       *
       * It is last, and it is Lower Body only. An Upper Body day already asks
       * for core in a slot of its own, so falling back to it there would not be
       * "the last thing left", it would be a third plank in a session that was
       * meant to be pressing and pulling.
       */
      if (sessionType === 'lower_body') attempts.push({ pattern: 'core', ceiling: cap });
    }

    /**
     * One attempt: the pool for a pattern at a rung, walked and screened.
     *
     * Everything inside was the body of this loop before the attempts above
     * existed, and it is unchanged: the same pool, the same main-lift
     * preference, the same two walks. What is new is that it can be asked the
     * same question about a second pattern when the first one has nothing left.
     */
    const walk = (slotPattern: LibraryPattern, slotCeiling: LibraryLevel) => {
      const wholePool = slotPool(slotPattern, slotCeiling, equipment);
      /**
       * THE MAIN SLOT TAKES A MAIN LIFT, AND ARCHIE'S LIST SAYS WHICH THEY ARE.
       *
       * Every record carries a `role` - main, accessory or power - and the first
       * slot is the exercise the session is built around. Walking the whole
       * pattern pool for it put a Band Pull Apart at the top of a beginner's Upper
       * Body session and a Wall Sit at the top of their Lower Body one: both are
       * the right pattern, both are level 1, and neither is a lift. A beginner is
       * the person most likely to meet this, because the shallow end of every
       * pattern is where the accessory work lives.
       *
       * The whole pool is still there to fall back on. A pattern whose only owned
       * record at this rung is an accessory gives an accessory rather than a gap:
       * "no pressing at all today" is a worse answer than "pressing, lightly".
       *
       * An accessory slot takes the whole pool and always did. The library files
       * forty records as accessories and the rest as main lifts, and a main lift
       * a rung below today's main lift is exactly what Archie asked for: Barbell
       * Back Squats followed by Dumbbell Romanian Deadlifts is the session he
       * described. What the rung rule removes is the SECOND hard movement, not
       * every compound.
       */
      const mainPool = wholePool.filter((e) => e.role === 'main');
      const pool = role === 'main' && mainPool.length > 0 ? mainPool : wholePool;

      /**
       * SCREEN BEFORE PICKING, and take the same pattern wherever one is clean.
       *
       * `wanted` is what variation asked for; `chosen` is what today allows. When
       * they differ the walk has carried on through the SAME pattern's pool, so a
       * sore shoulder moves an overhead press to a floor press rather than
       * deleting the pressing from an upper body day. The card says what it
       * replaced and offers it back, exactly as every other swap does.
       */
      const wanted = pickFresh(pool, index, free);
      /**
     * AND A STAND-IN FOR SOMETHING THAT HURTS IS NEVER A HARDER RUNG.
     *
     * This is what replaced the old engine's comfort variants, so it has to do
     * the job they were written to do: the gentler version, not merely a
     * different one. The walk alone could not promise that. `slotPool` is
     * ordered from the ceiling downwards and the walk is circular, so stepping
     * over a blocked record could wrap round onto a harder one - measured
     * across 53,282 generated cards, 134 of the 1,880 substitutions did exactly
     * that, including a Wall Sit ruled out by a sore hip coming back as Goblet
     * Squats, and a Waiter Carry ruled out by a sore elbow coming back as
     * Kettlebell Marches. Somebody says an area hurts and the app hands them
     * more load than it was about to.
     *
     * So when today rules the wanted record out, the same walk is run again
     * over the rungs at or below its level first, and only if nothing there is
     * clean and owned does it fall back to the whole pattern's pool - because a
     * slot filled by a harder record of the right pattern is still better than
     * a Lower Body session with no squatting in it, and the gap line is worse
     * than both.
     *
     * Nothing changes when nothing is blocked: `wanted` is chosen and the
     * second walk never runs.
     */
    /**
     * AND THE RUNG RULE OUTRANKS THE MAIN-LIFT RULE, in the one case they meet.
     *
     * The main slot is drawn from `mainPool` above, so the easier walk runs over
     * the main lifts alone - and if none of those at or below the rung is clean
     * today it would fall through to a HARDER main lift while an easier clean
     * record of the same pattern sat in the accessory half of the pool. Measured:
     * an upper body session at home with a sore wrist replaced Door Frame Rows
     * (rung 1) with Bent Over Dumbbell Rows (rung 3). That exact case no longer
     * reproduces - Archie let Door Frame Rows through a sore wrist on
     * 21 September 2026 - but the rule it bought is general and stays.
     *
     * Which of the two rules gives way is a clinical question rather than a
     * tidiness one, and it is not close. "The first slot should be a lift" is
     * about how a session reads; "do not hand somebody more load than you were
     * about to, straight after they told you something hurts" is the promise the
     * substitution exists to keep. So the second walk widens to the whole pattern
     * before the fall-through to a harder record, and the main-lift preference
     * still decides every slot where nothing is blocked.
     */
      const atOrBelow = (from: readonly LibraryExercise[]) =>
        wanted && !choosable(wanted) ? from.filter((record) => record.level <= wanted.level) : [];
      const easier = atOrBelow(pool);
      const easierAnyRole = pool === wholePool ? [] : atOrBelow(wholePool);
      const chosen =
        (easier.length > 0 ? pickFresh(easier, index, choosable) : null) ??
        (easierAnyRole.length > 0 ? pickFresh(easierAnyRole, index, choosable) : null) ??
        pickFresh(pool, index, choosable);
      return { pool, wanted, chosen };
    };

    /**
     * The attempts, in order, stopping at the first one that fills the slot.
     *
     * `pattern` is what the slot ended up being about, which is what the gap
     * sweep below counts as satisfied.
     */
    let pattern = attempts[0].pattern;
    let attempt = walk(pattern, attempts[0].ceiling);
    /**
     * AND THE ASKED PATTERN EXPLAINS ITSELF EVEN WHEN SOMETHING ELSE FILLS IN.
     *
     * Recorded here rather than only where the slot is dropped, because the
     * relaxation below means a slot can be FILLED and the pattern still not
     * happen: a sore knee takes every lunge out of a leg day, the slot takes a
     * second hinge instead, and the session contains no lunging. Without this
     * the sweep at the end fell through to "No lunging exercise made it into
     * today's session" followed by a sentence about buying a box, which blames
     * the kit for something the screen did. 788 of the 4,608 sessions in
     * tests/accessory-selection.check.mjs read that way before this line.
     */
    if (pattern === askedPattern && !attempt.chosen) noteMissing(askedPattern);
    for (let a = 1; a < attempts.length && !attempt.chosen; a++) {
      pattern = attempts[a].pattern;
      attempt = walk(pattern, attempts[a].ceiling);
    }
    const { wanted, chosen } = attempt;
    /**
     * Only labelled when today's areas are what moved it.
     *
     * A record stepped over because it is already in the session, or because
     * the beginner impact rule never offers it, has not been "swapped to
     * protect" anything, and saying so on the card would name a sore area
     * somebody has not got.
     */
    const swappedFrom =
      wanted && chosen && wanted.name !== chosen.name && hitsOn(wanted, banned).length > 0
        ? wanted
        : null;

    if (!chosen) {
      /**
       * THE SLOT IS DROPPED, AND THE NEXT PATTERN IN THE LIST TAKES IT.
       *
       * Not filled with something of a different pattern, which was tried and
       * was worse: a knee that ruled out every lunge in reach turned the fourth
       * slot of a LOWER BODY session into a Banded Serratus Punch, under a card
       * reading "swapped from Box Step Over to protect your knee". A shorter
       * lower body session is an honest answer; a shoulder exercise wearing a
       * knee caption is not.
       *
       * So the whole substitute universe is the library, the conditioning list
       * and Restore, and within it a stand-in is always the same pattern: the
       * walk above has already been down the level ladder looking for one.
       */
      // Only about a pattern this slot actually went looking for. The one case
      // where it did not is a pattern the accessory rules forbid, and that is
      // always either the main lift's own - which the session plainly contains
      // - or core on a leg day, which no leg day asks for any more.
      if (attempts.some((a) => a.pattern === askedPattern)) noteMissing(askedPattern);
      continue;
    }

    const card: Exercise = {
      ...templateToExercise(chosen),
      category: role === 'main' ? 'main' : 'accessory',
      sets: setsFor(role, profile, energy, chosen),
    };
    if (swappedFrom) {
      card.badge = 'comfort';
      card.safetyNote = substitutionNote(swappedFrom.name, regionLabel);
      // The revert, through the swap slot every card already has, so "put it
      // back" costs no new screen and behaves like every other swap. The
      // record's own id rides along, so sets logged after a revert are filed
      // against the exercise that was put back rather than its stand-in.
      card.hasSwap = true;
      card.swapId = swappedFrom.id;
      card.swapName = swappedFrom.name;
      card.swapCue = undefined;
      card.swapLoad = undefined;
      card.swap2Id = undefined;
      card.swap2Name = undefined;
      card.swap2Cue = undefined;
      card.swap2Load = undefined;
    }
    // Which pattern this card is FOR, and which one it is filed under. They
    // differ for the one record the document lists twice, and the slot it
    // filled is the one that counts as satisfied.
    add(card, chosen.pattern, patternsOf(chosen).includes(pattern) ? pattern : chosen.pattern);
    if (role === 'main') main = chosen;
    patternUse.set(chosen.pattern, (patternUse.get(chosen.pattern) ?? 0) + 1);
    workNames.push(chosen.name);
    filled++;
  }

  /**
   * A pattern the session asked for and did not end up containing.
   *
   * Swept at the end rather than declared the moment a slot is dropped, because
   * the lists repeat: an upper body session asks for a pull twice, and the
   * second one coming up empty because the first one took the only exercise
   * available is not a gap, it is a short list. What matters is whether the
   * session contains any pulling at all, so that is the question asked.
   */
  for (const pattern of asked) {
    if (built.some((b) => b.satisfies === pattern)) continue;
    gaps.push({
      pattern,
      line:
        reasons.get(pattern) ??
        `No ${PATTERN_WORDS[pattern]} exercise made it into today's session. ${kitSentence(kitThatWouldUnlock(pattern, ceiling, equipment))}`,
    });
  }

  // ── 5. Finisher ───────────────────────────────────────────────────────────
  // Added on top of the strength work and never in place of it: it is only
  // reached once the slots above have taken everything the clock allows.
  const wantsFinisher =
    timeAvailable === '60' ||
    (timeAvailable === '45' && (profile?.goals ?? []).some((g) => FINISHER_GOALS.includes(g)));
  if (wantsFinisher) {
    const finisher = pickFrom(conditioningPool, Math.floor(n / SLOT_ROTATION_EVERY) + 1, choosable);
    if (finisher) add({ ...templateToExercise(finisher), category: 'finisher' });
  }

  // ── 6. Rehab ──────────────────────────────────────────────────────────────
  // Only when an area is flagged, and always the gentlest drill that area has
  // (decision 10). An area named at sign-up keeps getting it: that answer means
  // "look after this", and the acute list is ordered gentlest first, so its head
  // is the right card whether the area is sore today or has been for months.
  if (flagged.length > 0) {
    const rehab = getRegionPrehabExercise(flagged[0], { acute: true });
    if (rehab && free(rehab)) add({ ...templateToExercise(rehab), category: 'prehab', sets: 1 });
  }

  // ── 7. Cool-down ──────────────────────────────────────────────────────────
  if (timeAvailable !== '30') {
    const cooldown = pickFrom(
      possibleFor(getCooldown(), equipment),
      Math.floor(n / SLOT_ROTATION_EVERY),
      choosable
    );
    if (cooldown) add({ ...templateToExercise(cooldown), category: 'cooldown' });
  }

  // ── Personalise, then the same post-passes generateWorkout runs ───────────
  const ageFactor = ageLoadFactor(profile?.ageYears);
  const personalised = built.map(({ card, loadPattern }) =>
    applyPersonalization(
      card,
      profile,
      isUpperBodyPattern(loadPattern),
      exerciseFeedback,
      undefined,
      strengthSessionCount,
      lastLoggedWeights,
      exerciseNormalStreak,
      exerciseStuckStreak,
      lastSessionPerformance,
      layoff,
      loadUnit,
      libraryEpochSessionCount,
      ageFactor
    )
  );

  /**
   * The backstop, and it should have nothing to substitute.
   *
   * Everything above was screened against the same banned set BEFORE it was
   * picked, so what is left for this pass is what only it can do: the set
   * reduction severe pain earns, and the explosive and finisher blocks that
   * moderate and above drop. If it ever starts substituting, something upstream
   * let a banned movement through - and what it substitutes comes from the old
   * catalogue, which tests/train-library.check.mjs sees as a name that is not in
   * the library.
   */
  const screened = applyInjurySafety(
    personalised,
    screenedReadiness,
    effectiveTier,
    profile,
    n,
    sessionType
  );

  // The rep target the person has EARNED, over the library's default. Last, so
  // a substituted exercise keeps its own prescription rather than inheriting the
  // reps of the movement it replaced.
  const targeted = !exerciseRepTarget
    ? screened
    : screened.map((ex) =>
        ex.id && exerciseRepTarget[ex.id] ? { ...ex, reps: exerciseRepTarget[ex.id] } : ex
      );
  const eased = readiness.deload ? easeForDeloadWeek(targeted, loadUnit) : targeted;
  const capped = capToKit(eased, profile?.maxKitKg ?? 0, effectiveTier);

  /**
   * WHAT ELSE ON THE NINE THE PULSE RAISER AND THE FINISHER COULD BE.
   *
   * Every other card in this session is answered by `fillSwapAlternatives` in
   * lib/workout-engine.ts, which walks the picker's index for exercises of the
   * same CATEGORY. These two are the pair it cannot answer: the session files
   * them as 'prep' and 'finisher', which are jobs in a session rather than
   * anything a record calls itself, so the walk finds an empty category and
   * offers nothing at all. Archie's rule about the button is plain -
   * "EVERYthing should be swappable at least once, sometimes twice" - and a
   * finisher with nothing behind it is the complaint that rule came from.
   *
   * So they are answered here, from the same nine the session drew them from,
   * and only from the records this person can do today and is not already
   * doing. Two cards built from one record share an id and the session screen
   * logs sets against the id, so offering a record already in the session would
   * write one card's sets on top of another's.
   *
   * WHICH MEANS AT HOME THE BUTTON CAN STILL BE EMPTY, and that is the honest
   * answer: three of the nine need no equipment, and a home session that has
   * already used two of them has one left to offer and then nothing. Reaching
   * off Archie's list to fill it would put work in front of somebody that the
   * rest of the app has stopped prescribing.
   */
  const conditioningRoles = new Set(['prep', 'finisher']);
  const usedIds = new Set(capped.map((e) => e.id));
  const usedNames = new Set(capped.map((e) => sameMovementKey(e.name)));
  const spareConditioning = conditioningPool.filter(
    (record) => !usedIds.has(record.id) && !usedNames.has(sameMovementKey(record.name))
  );
  /**
   * AND THE WARM-UP'S OWN SHORTER LIST, which is the same rule one layer down.
   *
   * Taking the sled off the top of the session and then offering it behind the
   * button would be the same card back, one tap away. So a warm-up card is
   * offered what could have opened the session instead, and the finisher, which
   * is conditioning and is meant to be hard, keeps the whole nine.
   *
   * IN THE SAME TIERS THE OPENER ITSELF WAS CHOSEN FROM (Archie, 29 September
   * 2026), so the button behind two minutes of cardio leads with the other
   * cardio options rather than with a Bear Crawl. Sorted, not filtered: the
   * crawls are still reachable one place further down, because "I would rather
   * do something else" is the whole point of the button.
   */
  const sparePulse = warmupCardioTiers(
    openerPool.filter(
      (record) => !usedIds.has(record.id) && !usedNames.has(sameMovementKey(record.name))
    )
  ).flat();
  /**
   * AND THE MOBILITY DRILLS, WHICH HAVE THE SAME PROBLEM FOR THE SAME REASON.
   *
   * A mobility card is a Restore drill filed as 'prep' because that is its job
   * here, and no template calls itself 'prep', so the engine's category walk
   * finds nothing for it either. A Copenhagen Adductor Hold was left with
   * nothing behind its button on every session that opened with one.
   */
  /**
   * AND IN THE SAME ORDER THE WARM-UP ITSELF USES, which is the rest of
   * Archie's second rule rather than a separate idea.
   *
   * A lower body day that leads on glute work and then offers a Dead Bug behind
   * the button has answered him on the card and taken it back one tap later.
   * Measured before this sort existed, over the same sweep: 20,823 of the
   * 24,024 warm-up drill cards on a leg day offered core work in the first
   * slot, 87 per cent of them. Afterwards none do, and core reaches the second
   * slot on 948 of them, every one a three-drill warm-up that has already spent
   * the hip and lower limb drills its kit allows. So the spare drills are
   * ordered by the same preference row the slots were filled from, which puts
   * another hip drill behind a hip drill on a leg day and leaves core where it
   * is welcome.
   *
   * SORTED RATHER THAN FILTERED, deliberately, because an empty button is
   * worse than a drill lower down the order. Nothing here is a safety rule -
   * the screen a few lines below still decides what a person may be offered at
   * all, and this only decides what order the survivors come in. With today's
   * thirteen drills a leg day never runs far enough down the row to reach core
   * work, because two hip drills and two lower limb drills are always spare;
   * retire enough of those and core comes back rather than the button going
   * blank.
   */
  const swapFamilyRank = warmupFamilyOrder(sessionType, 0);
  const swapRankOf = (drill: ExerciseTemplate) => swapFamilyRank.indexOf(warmupFamilyOf(drill));
  const spareMobility = mobilityPool
    .filter((t) => !usedIds.has(t.id) && !usedNames.has(sameMovementKey(t.name)))
    .sort((a, b) => swapRankOf(a) - swapRankOf(b));
  const mobilityByName = new Map(mobilityPool.map((t) => [sameMovementKey(t.name), t]));
  /**
   * AND THE DRILLS ARCHIE NAMED, WHICH ARE THE SAME PROBLEM AGAIN.
   *
   * Banded Face Pulls and Door Frame Rows are records from his exercise
   * library, not from Restore, so neither list above finds them and a warm-up
   * card built from one would have had nothing behind its button - on every
   * upper body and full body session anybody with a band ever gets. He was
   * plain about that: "These exercises should be the go to exercises but should
   * still have swap options if the client wants to do a different exercise."
   *
   * They are answered from the mobility drills, in the family order this day
   * uses, which is what the rest of the pool IS on a warm-up card. Hip Circles
   * needs no entry here because it is a Restore drill and the line above
   * already finds it.
   */
  const namedDrillIds = new Set(namedDrills.map((t) => t.id));
  const withOwnSwaps = capped.map((card) => {
    if (!conditioningRoles.has(card.category) || card.safetyNote) return card;
    const fromNine = conditioningById.has(card.id);
    const fromRestore =
      mobilityByName.has(sameMovementKey(card.name)) || namedDrillIds.has(card.id ?? '');
    if (!fromNine && !fromRestore) return card;
    /**
     * A WARM-UP CARD IS NEVER LEFT WITH AN EMPTY BUTTON.
     *
     * The cardio card runs out first: at home a beginner opens on the walk, and
     * a sore ankle and a sore wrist between them can take the Duck Walk and the
     * Bear Crawl as well. The mobility drills go on the end of its list rather
     * than an empty button being shipped, and they are last, so nobody at a gym
     * is ever offered a Wall Slide in place of the rower.
     */
    const options = (
      fromNine
        ? card.category === 'prep'
          ? [...sparePulse, ...spareMobility]
          : spareConditioning
        : spareMobility
    ).filter((record) => choosable(record));
    if (options.length === 0) return card;
    const [first, second] = options;
    return {
      ...card,
      hasSwap: true,
      swapId: first.id,
      swapName: first.name,
      swapCue: first.cue,
      swapLoad: first.suggestedLoad,
      swap2Id: second?.id,
      swap2Name: second?.name,
      swap2Cue: second?.cue,
      swap2Load: second?.suggestedLoad,
    };
  });

  return { exercises: withOwnSwaps, gaps };
}
