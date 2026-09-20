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
import type { KitKey, LibraryExercise, LibraryLevel, LibraryPattern } from './exercise-library';
import {
  CONDITIONING_EXERCISES,
  LIBRARY_EXERCISES,
  hasAuthoredContent,
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
 *   1. Pulse raiser   one conditioning item at an easy pace, kit permitting.
 *   2. Mobility       Restore drills, 1 / 2 / 2 by session length.
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
 */
const SLOT_PATTERNS: Record<LibrarySessionType, readonly (readonly LibraryPattern[])[]> = {
  full_body: [
    ['squat', 'push', 'hinge', 'pull', 'core', 'lunge'],
    ['hinge', 'push', 'squat', 'pull', 'core', 'lunge'],
  ],
  upper_body: [
    ['push', 'pull', 'core', 'push', 'pull'],
    ['pull', 'push', 'core', 'pull', 'push'],
  ],
  lower_body: [
    ['squat', 'hinge', 'core', 'lunge', 'hinge'],
    ['hinge', 'squat', 'core', 'lunge', 'squat'],
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

/** Sets before anything is spent on them, from the level, the goals and today. */
function setsFor(
  role: 'main' | 'accessory',
  profile: UserProfile | undefined,
  energy: EnergyLevel
): number {
  const level = profile?.experienceLevel ?? 'intermediate';
  let sets = level === 'beginner' ? 2 : 3;
  if (role === 'main' && (level === 'advanced' || level === 'athlete')) sets = 4;
  const { mainSetsDelta, accSetsDelta } = getGoalVolumeDeltas(profile?.goals ?? []);
  sets += role === 'main' ? mainSetsDelta : accSetsDelta;
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

  // ── 1. Pulse raiser ───────────────────────────────────────────────────────
  // One conditioning item, at a pace that raises the pulse and nothing more.
  // Skipping is not offered to a beginner here or in the finisher (decision 7),
  // which the beginner impact rule above takes care of.
  const conditioningPool = CONDITIONING_EXERCISES.filter(
    (e) => hasAuthoredContent(e) && canPerformWith(e, equipment)
  );
  const pulse = pickFrom(conditioningPool, Math.floor(n / SLOT_ROTATION_EVERY), choosable);
  if (pulse) {
    add({ ...templateToExercise(pulse), category: 'prep', sets: 1, suggestedLoad: 'Easy pace' });
  } else {
    /**
     * NOTHING ON THE NINE FITS, SO THE SESSION OPENS ON RESTORE MOBILITY.
     *
     * Reachable: a beginner with no kit and a sore ankle loses Skipping to the
     * beginner rule and Duck Walks and Bear Crawl to the ankle, and owns none of
     * the machines.
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
     */
    const stand = pickFrom(mobilityPool, Math.floor(n / SLOT_ROTATION_EVERY), choosable);
    if (stand) {
      add({ ...templateToExercise(stand), category: 'prep' });
    }
  }

  // ── 2. Mobility ───────────────────────────────────────────────────────────
  const mobilityCount = mobilityCountFor(timeAvailable, profile?.ageYears);
  for (let i = 0; i < mobilityCount; i++) {
    const drill = pickFrom(mobilityPool, Math.floor(n / SLOT_ROTATION_EVERY) + i, choosable);
    if (!drill) break;
    add({ ...templateToExercise(drill), category: 'prep' });
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
  const patterns = SLOT_PATTERNS[sessionType][n % SLOT_PATTERNS[sessionType].length];
  const slotCount = SLOT_COUNTS[sessionType][timeAvailable];
  const asked = new Set<LibraryPattern>(patterns.slice(0, slotCount));
  /** Why a pattern could not be filled, kept for the sweep below. */
  const reasons = new Map<LibraryPattern, string>();
  let filled = 0;
  for (let i = 0; i < patterns.length && filled < slotCount; i++) {
    const pattern = patterns[i];
    const role: 'main' | 'accessory' = filled === 0 ? 'main' : 'accessory';
    const index =
      role === 'main'
        ? Math.floor(n / MAIN_ROTATION_EVERY)
        : Math.floor(n / SLOT_ROTATION_EVERY) + i;
    const pool = slotPool(pattern, ceiling, equipment);

    /**
     * SCREEN BEFORE PICKING, and take the same pattern wherever one is clean.
     *
     * `wanted` is what variation asked for; `chosen` is what today allows. When
     * they differ the walk has carried on through the SAME pattern's pool, so a
     * sore shoulder moves an overhead press to a floor press rather than
     * deleting the pressing from an upper body day. The card says what it
     * replaced and offers it back, exactly as every other swap does.
     */
    const wanted = pickFrom(pool, index, free);
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
    const easier =
      wanted && !choosable(wanted) ? pool.filter((record) => record.level <= wanted.level) : [];
    const chosen =
      (easier.length > 0 ? pickFrom(easier, index, choosable) : null) ??
      pickFrom(pool, index, choosable);
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
      if (!reasons.has(pattern)) {
        reasons.set(
          pattern,
          pool.length === 0
            ? `No ${PATTERN_WORDS[pattern]} exercise in the library matches your level and your kit. ${kitSentence(kitThatWouldUnlock(pattern, ceiling, equipment))}`
            : `No ${PATTERN_WORDS[pattern]} exercise was safe to give you today. ${kitSentence(kitThatWouldUnlock(pattern, ceiling, equipment))}`
        );
      }
      continue;
    }

    const card: Exercise = {
      ...templateToExercise(chosen),
      category: role === 'main' ? 'main' : 'accessory',
      sets: setsFor(role, profile, energy),
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

  return { exercises: capped, gaps };
}
