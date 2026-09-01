// Types only, and spelled `import type` so it stays that way. The store now
// imports back from this module to publish when the user last trained, and a
// type-only edge cannot close that loop into a runtime cycle.
import type {
  EquipmentTier,
  EnergyLevel,
  ExerciseFeedback,
  ExercisePerformance,
  ExperienceLevel,
  FitnessGoal,
  PainRegion,
  SessionType,
  TimeAvailable,
  UserProfile,
  WeightUnit,
} from './store';
// The one runtime dependency this module has outside the exercise database:
// the grid a gym can actually load. `lib/utils.ts` imports nothing at runtime,
// so the contract tests that import this file directly stay free of the store.
import { cardioWarmupPoolForSession } from './cardio-warmup';
import { kgToDisplayUnit, roundToLoadable, toLoadableForUnit } from './utils';
import {
  ExerciseCategory,
  ExerciseTemplate,
  type InternalTier,
  CARDIO_WARMUP,
  CARDIO_WARMUPS,
  toInternalTier,
  getPrep,
  getMechanical,
  getPowerMechanical,
  getNeuro,
  getPowerNeuro,
  getMainLift,
  getAccessories,
  getPrehab,
  getFinisher,
  getCooldown,
  getConditioningWorkout,
  get1RMProtocol,
  getStandalonePrehabWorkout,
  getStandaloneFlexibilityWorkout,
  getRegionPrehabWorkout,
  getRegionPrehabSupplements,
  getRegionPrehabExercise,
  getGoalConditioningBlock,
  getWeeklyLowerBodyExercises,
  getWeeklyUpperBodyExercises,
  getWeeklyFullBodyExercises,
  getAllPickableExercises,
  type PickableExercise,
  canPerformWith,
  possibleFor,
  getRegionsByExerciseNameMap,
} from './exercise-db';
import { byLevelPreference, withinLevel } from './exercise-levels';
import { levelBandForExperience } from './programme';
import {
  isEquipmentVariant,
  isSameMuscleAlternative,
  kitOf,
  movementCoreOf,
  movementNounOf,
  muscleGroupOf,
  swapReasonFor,
  type MuscleGroup,
  type SwapKind,
} from './exercise-swaps';
import { applyGripVariant } from './grip-variants';
import {
  DROPPABLE_CATEGORIES,
  HIGH_INTENSITY_CATEGORIES,
  REGION_BOUND_CATEGORIES,
  SEVERE_SET_REDUCTION,
  SEVERITY_DROPS_INTENSITY,
  SET_REDUCED_CATEGORIES,
  bodyRegionOf,
  canSubstituteFor,
  SCREEN_EXEMPT_CATEGORIES,
  SCREEN_EXEMPT_SESSION_TYPES,
  restrictedTagsFor,
  restrictedTagsOn,
  disclaimsLengthening,
  substitutionNote,
  substitutionRestrictedTags,
  STRESS_TAG_LABELS,
  RESTRICTED_BY_REGION,
  type StressTag,
} from './exercise-safety';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  cue: string;
  suggestedLoad: string;
  /**
   * The weight(s) the engine computed for this exercise, in kg — either a
   * single working weight or an explicit per-set ladder. Canonical unit; the
   * UI converts for display.
   *
   * `suggestedLoad` is display text and nothing more. Whenever a weight has
   * actually been calculated it is recorded here, and callers pass this through
   * `expandSetTargets` rather than pattern-matching the sentence. Rewording a
   * load can therefore never change what the app tells you to lift.
   *
   * Deliberately NOT stored pre-expanded per set: `sets` is adjusted after
   * generation (neuro sets are raised, accessory sets flex with time and
   * energy), so a fixed-length array would go stale. Expanding at the point of
   * use keeps it correct whatever the set count ends up being.
   *
   * Absent when no weight applies (bodyweight, bands, timed work) or when the
   * load came verbatim from the exercise database, in which case callers fall
   * back to `getWeightGuideKg`.
   */
  loadKg?: number[];
  category: ExerciseCategory;
  badge?: 'comfort' | 'volume';
  videoId: string;
  /**
   * A full @GrowPerformanceRehabilitation link written on the template itself.
   *
   * Threaded alongside videoId at every point an Exercise is built from a
   * template — including the comfort-swap and grip-variant paths that rebuild
   * the object — because a field that survives one route and not another fails
   * silently: the right video simply never opens, with nothing to say why.
   * tests/exercise-video.check.mjs holds both fields to that.
   *
   * Usually absent. The normal place to record a video is the table in
   * lib/exercise-videos.ts, which is keyed by name and so needs no threading at
   * all.
   */
  youtubeUrl?: string;
  hasSwap: boolean;
  swapName?: string;
  swapCue?: string;
  swapLoad?: string;
  swap2Name?: string;
  swap2Cue?: string;
  swap2Load?: string;
  /**
   * WHAT each alternative is, and one line saying so.
   *
   * The two slots used to come out of one ranking, which meant the sheet
   * showed two things and could not say why either was there. A user taps
   * swap for one of two reasons - the kit is taken, or they want different
   * work for the same muscles - and now each slot answers one of them. See
   * lib/exercise-swaps.ts.
   *
   * Undefined on the injury-screen revert, which sets swapName to the
   * exercise it removed and labels that itself.
   */
  swapKind?: SwapKind;
  swapReason?: string;
  swap2Kind?: SwapKind;
  swap2Reason?: string;
  isDumbbellExercise?: boolean;
  /** Surface a contextual note in the session UI when load was derived from last session data. */
  progressionNote?: string;
  /** Whether progressionNote describes a step up or a hold - drives which icon the UI shows. */
  progressionDirection?: 'up' | 'hold';
  /** Marks a custom-session cardio exercise; shows duration/speed inputs instead of weight/reps. */
  type?: 'cardio';
  /**
   * Set when the injury screen changed or flagged this exercise — either
   * "swapped from X to protect your knee" or, where nothing safe could replace
   * it, a caution naming what to watch. Shown on the card so the adaptation is
   * visible rather than mysterious.
   */
  safetyNote?: string;
  /**
   * The muscle the movement is FOR, copied from the template.
   *
   * Carried on the exercise rather than looked up when needed, because the
   * lookup is unreliable: a session's main lift can arrive as a variation
   * whose name is not in the catalogue, and every metadata comparison then
   * silently matches nothing. That is how a knee-safe front squat came back
   * as a deadlift, and then — after the first fix — how a quad-safe front
   * squat came back as a BENCH PRESS despite a body-region filter being in
   * place. Data that travels with the object cannot go missing.
   */
  primaryMuscle?: string;
}

interface ReadinessCheck {
  hasAches: boolean;
  painRegion?: PainRegion | PainRegion[];
  /** How bad it is. Moderate and above also cost the session its explosive and
   *  finisher blocks — see SEVERITY_DROPS_INTENSITY in lib/exercise-safety.ts. */
  painSeverity?: 'mild' | 'moderate' | 'severe';
  /**
   * The named region is hurting NOW, as opposed to being the area someone wants
   * to look after. It routes the rehab work to lib/acute-rehab.ts, where
   * nothing stretches or hard-loads the injured tissue.
   *
   * WHY IT IS A SEPARATE FLAG AND NOT INFERRED FROM painRegion
   * ──────────────────────────────────────────────────────────
   * The first version of this treated any named region as acute, which is right
   * for the readiness screen — you only report pain there because something
   * hurts — and wrong for the Restore tab, where naming a region is how you ask
   * for work on it at all. That version left anyone six weeks into knee rehab on
   * the acute protocol permanently, with no route back to the fuller
   * maintenance work and no way to say they had got better.
   *
   * So the two callers answer it differently: the readiness screen always sets
   * it, and the Restore tab asks, defaulting to yes.
   */
  acute?: boolean;
  energy: EnergyLevel;
  timeAvailable: TimeAvailable;
  /**
   * This session falls in a planned easier week. See deloadWeeksFor in
   * lib/programme.ts for which weeks those are and why.
   *
   * On the readiness check rather than as another positional parameter because
   * it is the same KIND of fact as the other four: something true about today
   * that changes what today's session should be. It also means every generator
   * already has it in hand, though only the post-pass below reads it.
   */
  deload?: boolean;
}

/**
 * A day index that flips at the device's local midnight, not UTC midnight —
 * used to seed exercise rotation so variety changes overnight rather than
 * mid-afternoon/evening for non-UTC users.
 */
function getLocalDayIndex(): number {
  const now = new Date();
  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * TIME AWAY FROM TRAINING
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The load calculation had no concept of elapsed time at all. Eight strong
 * squat sessions took the working weight to 80 kg, and coming back the next
 * day, after five weeks or after a year produced the identical prescription,
 * to the kilogram. The app knew the gap perfectly well — the streak reset, the
 * bodyweight reminder fired — the number simply never reached the weight.
 *
 * Detraining is neither linear nor symmetrical. Strength holds for the first
 * week or two and then falls away; the tissue tolerance that keeps you from
 * pulling something goes sooner than the strength does. So the curve holds flat
 * through a fortnight, bends through the weeks after it, and stops mattering
 * once the weights on record have stopped being evidence about the person.
 *
 * The anchors below are a cautious shape, not a model of anyone's physiology.
 * The cost of being 10% light on the first session back is one easy session.
 * The cost of being 20% heavy is a strain, and a strain ends the comeback.
 */

/** Days away before any of this applies. Missing a week is life happening, and
 *  a prescription that flinches at it teaches you the app is nervous. */
export const LAYOFF_GRACE_DAYS = 10;

/** Days away after which the weights on record stop being evidence. Past this
 *  the app prescribes as it would for someone it has never met. */
export const LAYOFF_RESET_DAYS = 90;

/** Sessions back before a max-effort test can come due again. */
export const COMEBACK_SESSIONS = 2;

/** [days away, share of the usual load]. Interpolated between. */
const LAYOFF_CURVE: readonly (readonly [number, number])[] = [
  [LAYOFF_GRACE_DAYS, 1],
  [21, 0.9],
  [35, 0.775],
  [LAYOFF_RESET_DAYS, 0.65],
];

/** Above this share of the usual load, quoting a percentage is noise rather
 *  than information — "eased back to 99%" reads like a rounding error even
 *  though the bar really is one plate lighter. Copy says so in words instead. */
const LAYOFF_SLIGHT_ABOVE = 0.95;

/** Where someone is after a break: how long it was, and what it costs today. */
export interface Layoff {
  daysAway: number;
  /** Share of the usual load, 0-1. */
  factor: number;
  /** True once the history is too old to prescribe from at all. */
  reset: boolean;
  /** The cut is real but too small to be worth quoting as a number. */
  slight: boolean;
}

/**
 * Whole days between two instants, counted local-midnight to local-midnight so
 * "yesterday" is 1 whatever the clock said — the same calendar convention
 * getLocalDayIndex and the home screen's "days ago" label already use.
 */
export function wholeDaysBetween(fromIso: string, toMs: number): number {
  const from = new Date(fromIso);
  const to = new Date(toMs);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.floor((b - a) / 86400000));
}

/** Share of the usual load to prescribe after `daysAway` off. */
export function layoffFactor(daysAway: number | null): number {
  if (daysAway === null || daysAway <= LAYOFF_GRACE_DAYS) return 1;
  const last = LAYOFF_CURVE[LAYOFF_CURVE.length - 1];
  if (daysAway >= last[0]) return last[1];
  for (let i = 1; i < LAYOFF_CURVE.length; i++) {
    const [d0, f0] = LAYOFF_CURVE[i - 1];
    const [d1, f1] = LAYOFF_CURVE[i];
    if (daysAway <= d1) return f0 + ((f1 - f0) * (daysAway - d0)) / (d1 - d0);
  }
  return last[1];
}

/** The break worth acting on, or null when there is nothing to act on. */
export function getLayoff(daysAway: number | null): Layoff | null {
  if (daysAway === null || daysAway <= LAYOFF_GRACE_DAYS) return null;
  const factor = layoffFactor(daysAway);
  return {
    daysAway,
    factor,
    reset: daysAway >= LAYOFF_RESET_DAYS,
    slight: factor > LAYOFF_SLIGHT_ABOVE,
  };
}

/** "12 days", "3 weeks", "4 months" — for copy that has to name the gap. */
export function describeTimeAway(days: number): string {
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

/** How long ago the most recent of these sessions was, or null if there are none. */
export function daysAwayFrom(datesNewestFirst: string[], now: number = Date.now()): number | null {
  const latest = datesNewestFirst[0];
  return latest === undefined ? null : wholeDaysBetween(latest, now);
}

/** How long the most recent break was, and how far through the comeback they are. */
export interface ReturnWindow {
  daysAway: number;
  /** Qualifying sessions logged since the break ended. Zero while still away. */
  sessionsBack: number;
}

/**
 * Where someone is in a comeback, or null when there is no break in play.
 *
 * Two lists because two different questions. `allDates` measures the break —
 * any training at all breaks it, not just barbell work. `countedDates` is the
 * subset that counts as re-establishing a baseline; pass the same array when
 * everything counts.
 *
 * `sessionsBack: 0` is a real answer, not an absent one: it means they are away
 * right now and the next thing they log is their first session back.
 */
export function getReturnWindow(
  allDatesNewestFirst: string[],
  countedDatesNewestFirst: string[],
  now: number = Date.now()
): ReturnWindow | null {
  if (allDatesNewestFirst.length === 0) return null;
  const away = wholeDaysBetween(allDatesNewestFirst[0], now);
  if (away > LAYOFF_GRACE_DAYS) return { daysAway: away, sessionsBack: 0 };
  for (let i = 0; i < allDatesNewestFirst.length - 1; i++) {
    const resumedAt = Date.parse(allDatesNewestFirst[i]);
    if (Number.isNaN(resumedAt)) continue;
    if (wholeDaysBetween(allDatesNewestFirst[i + 1], resumedAt) > LAYOFF_GRACE_DAYS) {
      return {
        daysAway: wholeDaysBetween(allDatesNewestFirst[i + 1], resumedAt),
        sessionsBack: countedDatesNewestFirst.filter((d) => Date.parse(d) >= resumedAt).length,
      };
    }
  }
  return null;
}

/**
 * When the user last trained.
 *
 * WHY THIS IS HELD HERE
 * ─────────────────────
 * The load calculation needs the gap, and this module is deliberately free of
 * the store: every contract test imports it directly and none of them can
 * afford to drag persistence, zustand and AsyncStorage in behind it. So the
 * store publishes the date to the engine instead, from one subscription, which
 * is the only arrangement where the date cannot go stale behind a mutation path
 * that forgot to update it.
 *
 * `generateWorkout` still takes the gap as an argument and only falls back to
 * this when the caller does not supply one, so every rule above stays testable
 * without anyone touching module state.
 */
let lastTrainedAt: string | null = null;

export function setLastTrainedDate(iso: string | null): void {
  lastTrainedAt = iso;
}

export function daysSinceLastTrained(now: number = Date.now()): number | null {
  return lastTrainedAt === null ? null : wholeDaysBetween(lastTrainedAt, now);
}

type MainSessionType = Exclude<
  SessionType,
  'conditioning' | 'prehab' | 'flexibility' | 'custom' | 'upper_body' | 'lower_body' | 'full_body'
>;
type WeeklySessionType = 'upper_body' | 'lower_body' | 'full_body';

/**
 * Deterministic Fisher-Yates shuffle seeded by an integer.
 * Produces consistent ordering for the same seed value, rotating
 * exercises predictably as the user's session count and date change.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type MovementPattern = NonNullable<ExerciseTemplate['movementPattern']>;

/**
 * Reorder a list to spread out repeated movement patterns while preserving as
 * much of the incoming (already-shuffled) order as possible. Greedy and fully
 * deterministic: walk the list in order, but whenever the next item would repeat
 * the previous item's movement pattern, pull forward the earliest later item
 * with a different pattern instead. Items without a movementPattern share a
 * single "undefined" bucket, so untagged items are treated as one pattern.
 *
 * Because it only reorders (never drops) and adds no randomness, it composes
 * cleanly on top of `seededShuffle` as a secondary sort key.
 */
function diversifyByMovementPattern<T extends { movementPattern?: MovementPattern }>(
  arr: T[]
): T[] {
  if (arr.length <= 2) return [...arr];
  const remaining = [...arr];
  const result: T[] = [];
  let prevPattern: MovementPattern | undefined;
  let hasPrev = false;
  while (remaining.length > 0) {
    let idx = 0;
    if (hasPrev) {
      const diffIdx = remaining.findIndex((e) => e.movementPattern !== prevPattern);
      if (diffIdx !== -1) idx = diffIdx;
    }
    const [next] = remaining.splice(idx, 1);
    result.push(next);
    prevPattern = next.movementPattern;
    hasPrev = true;
  }
  return result;
}

/**
 * `seededShuffle` with an optional secondary pass that spreads out repeated
 * movement patterns (see `diversifyByMovementPattern`). When `diversify` is
 * true, a rotated selection is far less likely to stack two same-pattern
 * exercises back to back — e.g. two 'push' accessories in the same session.
 */
/**
 * Do two exercise names describe effectively the same movement?
 *
 * Exact-name dedupe is not enough once the accessory pool is wide: a session
 * came out with "Incline Barbell Bench Press" as the main and "Incline Barbell
 * Press" as an accessory, which are the same exercise typed twice.
 *
 * Equipment and stance words carry no movement information, so they are dropped
 * before comparing. A match needs the smaller name to be a subset of the larger
 * AND to have at least two words left — otherwise "Barbell Row" would swallow
 * every other row in the database and cost more variety than it saves.
 */
const NAME_NOISE = new Set([
  'barbell',
  'dumbbell',
  'db',
  'kb',
  'kettlebell',
  'cable',
  'machine',
  'seated',
  'standing',
  'the',
  'with',
  'a',
]);
function movementTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/[\s-]+/)
      .filter((w) => w.length > 1 && !NAME_NOISE.has(w))
  );
}
function isSameMovement(a: string, b: string): boolean {
  const ta = movementTokens(a);
  const tb = movementTokens(b);
  if (ta.size === 0 || tb.size === 0) return a.toLowerCase().trim() === b.toLowerCase().trim();
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size < 2) return small.size === large.size && [...small].every((w) => large.has(w));
  return [...small].every((w) => large.has(w));
}

/** How often a weekly session's MAIN movement is served by its alternative
 *  instead. Rare on purpose — the main lift is what you are progressing, and
 *  progression needs the same movement most of the time. */
const MAIN_VARIATION_EVERY = 4;

/** Appended to the base lift's id so a main-lift variation carries its own
 *  progression rather than the base lift's. See the loop that uses it. */
const MAIN_VARIATION_ID_SUFFIX = '-variation';

/** How often each REQUIRED slot swaps to a different exercise of the same
 *  movement pattern. Staggered per slot, so this is the period for one slot,
 *  not for the session — a typical session has one of them varied. */
const REQUIRED_VARIATION_EVERY = 3;

/** Minimum secondary muscles for an exercise to count as compound enough to
 *  fill a required movement slot. See the filter that uses it. */
const MIN_COMPOUND_SECONDARIES = 2;

/**
 * Muscle families, used to decide whether one exercise can stand in for another
 * in a required slot.
 *
 * movementPattern alone is far too coarse for this. It has one value, 'push',
 * covering both an overhead press and a cable tricep pushdown, and one value,
 * 'pull', covering both a barbell row and a bicep curl. Substituting on pattern
 * alone produced exactly that: a session whose vertical-press slot was filled by
 * a triceps isolation, and whose horizontal-pull slot was filled by a curl. The
 * movement coverage the required slots exist to guarantee was silently gone.
 *
 * primaryMuscle is the finer signal — every one of the 447 pickable exercises
 * has it — but an exact match is too strict in the other direction: a Barbell
 * Row is 'Mid back' and a T-Bar Row is 'Rhomboids', and swapping those is
 * precisely what is wanted. Grouping them fixes both ends.
 *
 * Anything not listed falls back to requiring an exact primaryMuscle match,
 * which is conservative — an unknown muscle simply will not be substituted.
 */
const MUSCLE_FAMILIES: string[][] = [
  ['chest', 'pectorals', 'upper pectorals', 'lower pectorals'],
  ['anterior deltoid', 'lateral deltoid', 'deltoids', 'rear deltoid'],
  ['triceps'],
  ['latissimus dorsi', 'lats', 'mid back', 'rhomboids', 'trapezius', 'upper back'],
  ['biceps', 'brachialis'],
  ['quadriceps'],
  ['glutes', 'glute medius'],
  ['hamstrings', 'posterior chain', 'erector spinae'],
  ['adductors'],
];

function sameMuscleFamily(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return true;
  return MUSCLE_FAMILIES.some((fam) => fam.includes(x) && fam.includes(y));
}

/** How many rotating general joint-health movements a MAINTENANCE rehab session
 *  picks up alongside its region-specific core. Keeps the total in line with the
 *  seven the standalone prehab session already prescribes. Not used by the acute
 *  path, which is a fixed list — see generateWorkout. */
const REHAB_SUPPLEMENT = 2;

function seededShuffleDiverse<T extends { movementPattern?: MovementPattern }>(
  arr: T[],
  seed: number,
  diversify: boolean = true
): T[] {
  const shuffled = seededShuffle(arr, seed);
  return diversify ? diversifyByMovementPattern(shuffled) : shuffled;
}

function templateToExercise(
  t: ExerciseTemplate,
  badge?: 'comfort' | 'volume',
  isDumbbell?: boolean
): Exercise {
  // swap1 = swapAlternative (preferred) or comfortVariant
  // swap2 = comfortVariant when swapAlternative is also present (gives two distinct alternatives)
  const swap1 = t.swapAlternative ?? t.comfortVariant;
  const swap2 = t.swapAlternative && t.comfortVariant ? t.comfortVariant : undefined;
  return {
    id: t.id,
    name: t.name,
    sets: t.sets,
    reps: t.reps,
    cue: t.cue,
    suggestedLoad: t.suggestedLoad,
    category: t.category,
    badge,
    videoId: t.videoId,
    youtubeUrl: t.youtubeUrl,
    hasSwap: !!swap1,
    swapName: swap1?.name,
    swapCue: swap1?.cue,
    swapLoad: swap1?.suggestedLoad,
    swap2Name: swap2?.name,
    swap2Cue: swap2?.cue,
    swap2Load: swap2?.suggestedLoad,
    isDumbbellExercise: isDumbbell,
    primaryMuscle: t.primaryMuscle,
  };
}

function isDumbbellTier(tier: EquipmentTier): boolean {
  return tier === 'dumbbells' || tier === 'kettlebells';
}

/**
 * Where each goal's working sets sit as a fraction of a one-rep max. The same
 * numbers personalizeLoad's bootstrap path uses.
 */
const GOAL_LOAD_FRACTION: Record<string, number> = {
  strength: 0.85,
  muscle: 0.75,
  fat_loss: 0.65,
  fitness: 0.7,
  rehab: 0.5,
  power: 0.9,
};
const DEFAULT_LOAD_FRACTION = 0.7;

/**
 * The fraction of a one-rep max this user's working sets are meant to sit at,
 * averaged when they picked more than one goal.
 */
export function goalLoadFraction(profile: UserProfile): number {
  const activeGoals = profile.goals?.length ? profile.goals : ['fitness' as FitnessGoal];
  return (
    activeGoals.reduce((sum, g) => sum + (GOAL_LOAD_FRACTION[g] ?? DEFAULT_LOAD_FRACTION), 0) /
    activeGoals.length
  );
}

/**
 * Working weight for a main KPI lift derived directly from a 1RM, using the
 * same goal-appropriate percentages personalizeLoad's bootstrap path uses
 * (strength: 85%, muscle: 75%, fat_loss: 65%, fitness: 70%, rehab: 50%,
 * power: 90%). Exported so a freshly-tested 1RM can also re-baseline
 * lastLoggedWeights when a test week completes (see completeSession in
 * lib/store.ts) - without this, a new 1RM only ever mattered the very first
 * time a lift was suggested, since personalizeLoad's lastLoggedWeight+step
 * path takes priority over this one for every session after that.
 */
export function workingWeightFromOrm(
  ormKg: number,
  profile: UserProfile,
  /** The unit the user's gym is stocked in - decides the grid this lands on. */
  loadUnit: WeightUnit = 'kg'
): number {
  return roundToLoadable(ormKg * goalLoadFraction(profile), loadUnit);
}

/**
 * The one-rep max implied by what someone is currently being trained at.
 *
 * Exactly the inverse of `workingWeightFromOrm`: the app prescribes
 * `goalFraction x 1RM`, so the 1RM it is working from is `working / goalFraction`.
 */
export function ormFromWorkingWeight(workingKg: number, profile: UserProfile): number {
  return workingKg / goalLoadFraction(profile);
}

/**
 * The fraction of a one-rep max a max-reps test is loaded at.
 *
 * This is the whole reason the test used to punish four goals out of six. It
 * was set at 90% of the WORKING weight, which only lands near a true max for
 * the strength and power goals - every other goal trains further below its max
 * by design, so the same 90% put the bar far too light, and the reps needed
 * just to break even ran to 14, 18, 21, and for rehab 36. Epley (below) is a
 * straight line through one point; past about ten reps it drifts badly, so
 * those users were being judged in the part of the formula that does not work,
 * and the app concluded they had got weaker.
 *
 * Anchoring to the estimated 1RM instead makes break-even depend only on this
 * number and nothing else: Epley says a set at fraction f of a max is worth
 * 30 x (1/f - 1) reps, so break-even is the same handful of reps for every
 * goal. 80% puts that at 7.5 reps - comfortably inside the range where the
 * formula is trustworthy, and light enough to be a reasonable ask of someone
 * who has never tested. Published rep-max tables put roughly 8 reps at 80%,
 * so a user who is exactly where the app thinks they are keeps their weight.
 *
 * In whole reps, and for every goal: 7 or 8 changes nothing, 9 earns more
 * weight, 6 or fewer takes some off.
 */
export const TEST_LOAD_FRACTION_OF_ORM = 0.8;

/**
 * The reps that leave a user's working weight exactly where it was, derived
 * from the test load rather than written down beside it so the sentence the
 * user reads cannot drift away from the arithmetic that judges them.
 */
export const TEST_EXPECTED_REPS = Math.round(30 * (1 / TEST_LOAD_FRACTION_OF_ORM - 1));

/**
 * What to actually put on the bar for a max-reps test, given what the lift is
 * currently being trained at.
 */
export function testLoadFromWorkingWeight(
  workingKg: number,
  profile: UserProfile,
  /** The unit the user's gym is stocked in - decides the grid this lands on. */
  loadUnit: WeightUnit = 'kg'
): number {
  return roundToLoadable(
    ormFromWorkingWeight(workingKg, profile) * TEST_LOAD_FRACTION_OF_ORM,
    loadUnit
  );
}

/** Epley: the one-rep max implied by `reps` clean reps at `weightKg`. */
export function estimateOrmFromAmrap(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/**
 * The most a single test is allowed to move a block's programming, either way.
 *
 * A test is evidence, not a verdict. Before this, one flat day wrote itself
 * straight into the working weight: the app would go on showing a 144 kg
 * personal best while prescribing 65 kg, with nothing on screen reconciling
 * the two, and climbing back at +2.5 kg a session took twenty-three of them.
 * Capping the move means a bad day costs a little and a fluke costs nothing -
 * and it closes the other end too, because Epley inflates fast past ten reps
 * and an over-read max is a bar nobody can lift next block.
 */
export const MAX_TEST_WEIGHT_MOVE = 0.1;

/**
 * How far off prediction a test has to land before it means anything, in reps.
 *
 * A max-reps test is quantised twice over. The user does 7 reps or 8, never
 * 7.5 - half a rep of slop before anything else happens. And the weight they
 * were told to load had to be a weight their gym can make, which in pounds is
 * the nearest 5 lb; a bar a plate heavier than intended costs most of a rep on
 * its own. So a result within about a rep of prediction is the equipment and
 * the arithmetic talking, not the user's strength.
 *
 * It bit in practice: a pounds user whose strength had not moved at all came
 * out a plate lighter after a test, purely from which side of the nearest 5 lb
 * their true working weight fell on. Reading that as a strength loss and
 * taking weight off for it is the behaviour this whole change exists to stop,
 * so the tolerance is a rep plus the headroom the grid needs - and the error
 * it prefers to make is leaving someone's weight alone, which costs them
 * nothing (weights still climb session to session between tests) rather than
 * cutting someone who did nothing wrong.
 */
export const TEST_DEADBAND_REPS = 1.25;

/**
 * The working weight to carry into the next block, given the max a test just
 * estimated. Held where it is when the result was within `TEST_DEADBAND_REPS`
 * of what the current weight predicted, then clamped to within
 * `MAX_TEST_WEIGHT_MOVE` of it. With no current weight to protect there is
 * nothing to hold or clamp against.
 *
 * Takes the estimated max rather than a finished working weight on purpose:
 * the deadband has to be judged before the gym's grid gets involved, or the
 * grid's own rounding is what decides whether the deadband was cleared.
 */
export function workingWeightAfterTest(
  currentKg: number,
  estimatedMaxKg: number,
  profile: UserProfile,
  /** The unit the user's gym is stocked in - decides the grid this lands on. */
  loadUnit: WeightUnit = 'kg'
): number {
  const raw = estimatedMaxKg * goalLoadFraction(profile);
  if (!(currentKg > 0)) return roundToLoadable(raw, loadUnit);
  // In reps, because reps are the unit the test was actually taken in - and
  // because the same difference in kilograms means a different number of reps
  // depending on how heavy the bar was.
  const testKg = testLoadFromWorkingWeight(currentKg, profile, loadUnit);
  const repsOffPrediction =
    testKg > 0
      ? (30 * (estimatedMaxKg - ormFromWorkingWeight(currentKg, profile))) / testKg
      : Infinity;
  if (Math.abs(repsOffPrediction) <= TEST_DEADBAND_REPS) return currentKg;
  // The band is put on the gym's grid before the clamp, not after. Clamping to
  // a raw bound and rounding afterwards can land a step the wrong side of the
  // line it was clamped to; clamping between two loadable weights cannot.
  const lo = roundToLoadable(currentKg * (1 - MAX_TEST_WEIGHT_MOVE), loadUnit);
  const hi = roundToLoadable(currentKg * (1 + MAX_TEST_WEIGHT_MOVE), loadUnit);
  return Math.min(hi, Math.max(lo, roundToLoadable(raw, loadUnit)));
}

/**
 * Should this user be asked for an all-out set at all?
 *
 * On a rehab goal, no. The test load is a fixed fraction of the estimated max
 * for everyone (see TEST_LOAD_FRACTION_OF_ORM), which is what makes it a fair
 * test - but rehab working weights sit at half of a max by design, so a fair
 * test means roughly 1.6x what that user trains at, taken to failure. A
 * maximal single-set effort on healing tissue is the specific thing rehab
 * programming exists to avoid, so the honest options were "test properly" or
 * "do not test", and for someone who has told us they are rehabbing it is the
 * second. Their weights still climb session to session; only the max-effort
 * set is withheld, and the session says so rather than quietly changing.
 */
export function skipsMaxTest(profile: UserProfile): boolean {
  return (profile.goals ?? []).includes('rehab' as FitnessGoal);
}

/**
 * Personalizes a suggestedLoad string based on the user's profile.
 *
 * Reference athlete in the exercise database: intermediate male, ~80 kg, muscle goal.
 * Scale = (userBW / 80) × experienceFactor × sexFactor × goalFactor
 *
 * When `ormKg` is provided (stored 1RM for this session's main lift), the load for
 * main-lift exercises is derived from the user's own 1RM using a goal-appropriate
 * percentage (strength: 85%, muscle: 75%, fat_loss: 65%, fitness: 70%, rehab: 50%),
 * which is far more accurate than the heuristic scaling approach.
 *
 * Exercises with non-numeric loads (Bodyweight, Band, Machine, Cardio) are returned unchanged.
 * Numeric values are rounded onto the grid the user's gym can actually load -
 * 2.5 kg for a kilogram gym, 5 lb for a pound one. See `roundToLoadable`.
 */
/**
 * A prescribed load: the words shown to the user, and the weights behind them.
 * `kg` is null when there is no weight to speak of (bodyweight, bands, timed
 * work) or when the text came verbatim from the exercise database.
 */
interface PersonalisedLoad {
  text: string;
  kg: number[] | null;
}

/**
 * How much weight last session earned you.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A PERCENTAGE AND NOT A NUMBER OF KILOGRAMS
 * ─────────────────────────────────────────────────────────────────────────────
 * It used to be a flat step: hold on a failure, +2.5 kg normally, +5 kg after
 * three clean sessions or a thumbs-up, +7.5 kg on "5+ reps left". The same
 * kilograms for every exercise in the app, which is only sensible if every
 * exercise is loaded like a deadlift. Measured over twelve sessions with NO
 * feedback given at all — the default path, what a user gets by just training:
 *
 *     Barbell Deadlift    140 kg -> 192.5 kg    +38%
 *     Overhead Press       40 kg ->  92.5 kg   +131%
 *     DB Lateral Raise     10 kg ->  62.5 kg   +525%
 *
 * A 62 kg lateral raise is not a hard session, it is an impossible one, and the
 * app arrived at it by adding the same 2.5 kg it adds to a deadlift. One tap of
 * "5+ reps left" moved a lateral raise 75% in a single session.
 *
 * A share of the current load is the right unit: 2.5 kg is 1.8% of a deadlift
 * and 25% of a lateral raise, and it is the percentage that decides whether the
 * jump is reasonable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PART THAT MATTERS MOST: THE GYM HAS A SMALLEST PLATE
 * ─────────────────────────────────────────────────────────────────────────────
 * On the 2.5 kg grid the smallest possible increase to a 10 kg dumbbell is 25%.
 * No percentage can fix that, because the equipment cannot express it. So when
 * the smallest available jump is too big a share of the current load, the answer
 * is not a smaller step — it is to WAIT, and take the jump once there is enough
 * evidence to justify it.
 *
 * That is what a coach does with a light lift: hold, accumulate clean sessions,
 * then move up a dumbbell. It makes a lateral raise progress on roughly every
 * fourth session instead of every single one, and leaves the deadlift — where
 * one grid step is under 2% — moving every session exactly as it did before.
 */
const PROGRESSION_PCT = {
  /** "5+ reps left in the tank". */
  very_easy: 0.05,
  /** Thumbs-up, or a session logged as easy. */
  easy: 0.03,
  /** Three clean sessions in a row with nothing said. */
  streak: 0.03,
  /** The default: it went fine, nothing reported. */
  normal: 0.015,
} as const;

/**
 * The biggest share of the current load a single session may add unasked.
 *
 * Above this the jump is gated on evidence rather than taken automatically.
 *
 * 5%, because that is where the grid stops being fine enough to express a
 * sensible week. One 2.5 kg step is 1.8% of a 140 kg deadlift and 6% of a 40 kg
 * overhead press: the deadlift can move every session and the press cannot,
 * and a single threshold on the PERCENTAGE is what tells the two apart.
 */
const MAX_UNEARNED_JUMP = 0.05;

/**
 * Clean sessions needed to bank one oversized jump.
 *
 * The streak counts consecutive sessions with nothing reported and is only
 * reset by explicit feedback (see completeSession) — it does NOT reset when a
 * weight increase is taken. So a plain `streak >= 3` gate delays a light lift's
 * first jump by three sessions and then lets it climb every session after,
 * which is most of the original problem still in place: a 10 kg lateral raise
 * reached 32.5 kg over twelve sessions instead of 62.5 kg.
 *
 * Taking the jump only on every third clean session makes the evidence have to
 * rebuild each time, which is the behaviour the streak would have if it reset
 * itself. A lateral raise moves up a dumbbell about once a month of weekly
 * training; a deadlift is unaffected, because one grid step there is under 2%
 * and never reaches this gate at all.
 */
export const CLEAN_SESSIONS_PER_BIG_JUMP = 3;

/**
 * The most a single session may add when separating one feedback tier from
 * another on a coarse grid. See the tier-separation step in progressedLoad.
 */
const TIER_SEPARATION_CAP = 0.1;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STALLING, AND WHAT THE APP DOES ABOUT IT
 * ─────────────────────────────────────────────────────────────────────────────
 * Adding weight was automatic and taking it off was not, and that asymmetry was
 * the real gap in progression — not the size of the step.
 *
 * The app already knew. `exerciseStuckStreak` counts consecutive failed
 * sessions per exercise, and at three the session summary says, in these words:
 *
 *     "Held at this weight for 3 sessions in a row - a deload or swapping this
 *      exercise for a while could help it move again."
 *
 * It named the remedy and did not apply it. The engine never read that counter,
 * so a stalled lift sat at the same weight indefinitely while the app suggested
 * the user work out the deload themselves. One level up, coach.ts has
 * DELOAD_WEEKS = 4 and also only suggests. Two places that spot the need for a
 * deload; none that performed one.
 *
 * Ten per cent off after three stalls is the ordinary coaching answer, and it
 * turns a long ramp into repeated failure into a wave: climb, stall, back off,
 * come again. It is also what bounds the climb — a lift that runs ahead of the
 * lifter now has something that brings it back, which is a better fix than
 * making every step smaller for everybody.
 */
const DELOAD_AFTER_STALLS = 3;
/** What a deload leaves you holding. */
const DELOAD_FRACTION = 0.9;

/**
 * How fast the weight climbs, by how long someone has been training.
 *
 * The app asks for this at onboarding and uses it for impact restrictions and
 * equipment, then ignored it here — so a beginner and a fifteen-year lifter got
 * the same percentage. Novice linear progression is real and the beginner keeps
 * it; nobody at 140 kg adds to their deadlift every session, and offering it
 * only walks them into the stall faster.
 *
 * Measured over twelve quiet sessions, which is where it actually bites — the
 * three-clean-sessions tier, not the default one:
 *
 *     Barbell Deadlift   beginner 192.5 kg (+38%)   intermediate 170 kg (+21%)
 *     Back Squat         beginner   135 kg (+35%)   intermediate 130 kg (+30%)
 *
 * BE AWARE: `advanced` and `intermediate` produce the same weights below about
 * 208 kg, and that is not a bug to fix but a fact to know. One grid step is
 * 2.5 kg, and 1.2% of anything lighter than 208 kg rounds to that same single
 * step — the equipment cannot express the difference. It is kept as a separate
 * entry because above that weight it does differ, and because collapsing it
 * would mean re-deriving it the day the app supports finer plates.
 *
 * This matters much less than it did before deloading existed. A rate that is
 * slightly too fast now ends in a stall and a 10% reset rather than in a number
 * that climbs forever, so the system is self-limiting whatever this says.
 */
const EXPERIENCE_RATE: Record<string, number> = {
  beginner: 1,
  intermediate: 0.6,
  advanced: 0.4,
};

/**
 * What a stalled lift is given instead of the same weight again.
 *
 * Returns the deloaded weight at every DELOAD_AFTER_STALLS-th consecutive
 * failure, and the weight unchanged otherwise. Stepping only on the third,
 * sixth, ninth failure matters: the stuck counter is reset by a session that
 * does NOT fail, so a bare `>= 3` would take another 10% off every single
 * session until something gave.
 */
export function deloadedLoad(
  lastKg: number,
  stuckStreak: number,
  toGrid: (v: number) => number
): number | null {
  if (lastKg <= 0) return null;
  if (stuckStreak < DELOAD_AFTER_STALLS) return null;
  if (stuckStreak % DELOAD_AFTER_STALLS !== 0) return null;
  const target = toGrid(lastKg * DELOAD_FRACTION);
  // A coarse grid can round a 10% cut back onto the weight it came from on a
  // light lift. A deload that changes nothing is the bug this exists to fix.
  return target < lastKg ? target : null;
}

export function progressedLoad(
  lastKg: number,
  performance: ExercisePerformance | undefined,
  normalStreak: number,
  toGrid: (v: number) => number,
  experienceLevel?: string
): number {
  // Belt and braces: the caller already returns early on a failure, but this is
  // exported and its name promises a progression, not a hold.
  if (performance === 'failed' || lastKg <= 0) return lastKg;

  const rate = EXPERIENCE_RATE[experienceLevel ?? 'intermediate'] ?? EXPERIENCE_RATE.intermediate;
  const pct =
    (performance === 'very_easy'
      ? PROGRESSION_PCT.very_easy
      : performance === 'easy'
        ? PROGRESSION_PCT.easy
        : normalStreak >= 3
          ? PROGRESSION_PCT.streak
          : PROGRESSION_PCT.normal) * rate;

  /** The next weight up from `kg` that the gym can actually load. */
  const stepUp = (kg: number): number => {
    for (let probe = kg + 0.25; probe <= kg * 1.6 + 5; probe += 0.25) {
      const g = toGrid(probe);
      if (g > kg) return g;
    }
    return kg;
  };

  let next = toGrid(lastKg * (1 + pct));
  // A percentage can round back onto the weight it came from — 1.5% of 140 kg
  // is 2.1 kg, which rounds to 140. One increment up, so a session that earned
  // something is never handed the same bar.
  if (next <= lastKg) next = stepUp(lastKg);
  if (next <= lastKg) return lastKg;

  /**
   * Three answers have to feel like three answers.
   *
   * On a coarse grid the tiers collapse: 1.5% and 3% of a 145 lb squat are 2.2
   * and 4.4 lb, and the smallest pound jump is 5 — so saying "that felt easy"
   * moved the bar exactly as far as saying nothing at all. A feedback prompt
   * whose answers do not change anything teaches people to stop answering, and
   * this app leans on those answers for everything.
   *
   * So an ANSWER takes one extra increment when the grid has flattened it into
   * the default — but only while the result stays inside TIER_SEPARATION_CAP.
   * On a 10 kg dumbbell one step is already 25%; a second would be 50%, and no
   * answer to a feedback prompt justifies that.
   *
   * A clean streak deliberately does NOT get this. It is the app's own
   * inference, not something the user said, so there is no prompt for it to
   * make feel worthwhile — and letting it bump turned a 100 kg squat into a
   * 5 kg-per-session climb, 100 -> 152.5 kg over twelve quiet sessions.
   */
  if (performance === 'easy' || performance === 'very_easy') {
    const baseline = stepUp(lastKg);
    if (next <= baseline) {
      const bumped = stepUp(baseline);
      if (bumped > baseline && (bumped - lastKg) / lastKg <= TIER_SEPARATION_CAP) next = bumped;
    }
  }

  // Is the smallest jump the gym can express too big to hand over unasked?
  const jump = (next - lastKg) / lastKg;
  if (jump > MAX_UNEARNED_JUMP) {
    // Saying it was easy is evidence enough on its own — the user was asked and
    // answered. Otherwise the jump has to be banked, and the bank has to refill
    // before the next one.
    const said = performance === 'very_easy' || performance === 'easy';
    const banked = normalStreak > 0 && normalStreak % CLEAN_SESSIONS_PER_BIG_JUMP === 0;
    if (!said && !banked) return lastKg;
  }
  return next;
}

function personalizeLoad(
  rawLoad: string,
  profile: UserProfile,
  isUpperBodySession: boolean,
  exerciseId?: string,
  exerciseFeedback?: Record<string, ExerciseFeedback>,
  ormKg?: number,
  isMainLift?: boolean,
  /** Count of completed STRENGTH sessions (squat/bench/deadlift) only - not total sessions. */
  strengthSessionCount: number = 0,
  lastLoggedWeights?: Record<string, number>,
  exerciseNormalStreak?: Record<string, number>,

  exerciseStuckStreak?: Record<string, number>,
  lastSessionPerformance?: Record<string, ExercisePerformance>,
  /** Time away from training, or null when there has been none worth acting on. */
  layoff?: Layoff | null,
  /**
   * The unit the user's gym is stocked in.
   *
   * The engine has to know it. Every weight here is decided by adding a step to
   * a weight and rounding the result, and a grid applied afterwards at the
   * render boundary would leave the number it rounds drifting off-grid session
   * after session. See `roundToLoadable` for the full reasoning.
   */
  loadUnit: WeightUnit = 'kg'
): PersonalisedLoad {
  /** Load text the engine did not compute — no structured weight to attach. */
  const verbatim = (text: string): PersonalisedLoad => ({ text, kg: null });
  /** A weight this function worked out. `kg` is what the UI will actually use. */
  const computed = (kg: number): PersonalisedLoad => ({ text: `${kg} kg`, kg: [kg] });

  if (!profile.bodyweightKg || profile.bodyweightKg <= 0) return verbatim(rawLoad);

  const lower = rawLoad.toLowerCase();
  if (
    lower.includes('bodyweight') ||
    lower.includes('band') ||
    lower.includes('foam') ||
    lower.includes('machine') ||
    lower.includes('rower') ||
    lower.includes('bike') ||
    lower.includes('skip') ||
    lower.includes('jog') ||
    lower.includes('shuttle') ||
    lower.includes('low intensity') ||
    lower.includes('moderate pace') ||
    lower.includes('circuit') ||
    lower.includes('effort') ||
    !/\d/.test(rawLoad)
  ) {
    return verbatim(rawLoad);
  }

  const toGrid = (v: number) => roundToLoadable(v, loadUnit);
  const feedbackMult =
    exerciseId && exerciseFeedback?.[exerciseId]?.multiplier
      ? exerciseFeedback[exerciseId].multiplier
      : 1.0;

  // ── Auto session-count multiplier (+1% per 3 strength sessions, max +20%) ──
  // This baseline increment models the natural progressive overload across a
  // training block. It is driven by the count of completed STRENGTH sessions
  // only (squat / bench / deadlift) - conditioning, prehab, and flexibility
  // do not load the main lifts and so must not advance the multiplier.
  // The caller is responsible for filtering; the parameter name reflects this.
  const autoMult = Math.min(1.2, 1 + Math.floor(strengthSessionCount / 3) * 0.01);
  // Combine feedback and auto progression, capped at the existing 1.5 max.
  // feedbackMult: carries "too easy" (+7%), thumbs up (+3%), thumbs down (-5%)
  // adjustments from prior sessions and stacks multiplicatively on top of the
  // baseline autoMult.
  const combinedMult = Math.min(1.5, feedbackMult * autoMult);

  // ── Time away ────────────────────────────────────────────────────────────
  // Two adjustments, and which applies depends on how long it has been.
  //
  // Under LAYOFF_RESET_DAYS the app still believes the weights on record and
  // simply prescribes a share of them. Past it, it stops believing them: the
  // progression and feedback earned before the break are discarded too, because
  // a year-old "that felt easy" is not evidence about today, and what is left
  // is the same bootstrap a brand-new user gets.
  /** Share of the usual load the break has cost. Not applied past the reset
   *  point, where the history it would scale is discarded outright. */
  const layoffMult = layoff && !layoff.reset ? layoff.factor : 1;
  /** Progression banked before the break, dropped once the break is long
   *  enough that the app is starting over. */
  const earnedMult = layoff?.reset ? 1 : combinedMult;

  // ── Per-exercise progression: lastLoggedWeight + step per session ────────
  // See progressedLoad above for how the step is sized.
  // Keyed by stable exerciseId (not display name) so kettlebell-relabelled
  // names still match the ID that was logged in the previous session.
  //
  // Primary signal: lastSessionPerformance[exerciseId] - set by completeSession
  // from actual set completion data, then optionally overridden by post-session
  // thumbs/tooEasy feedback. This ensures progression is scoped to the most
  // recent session, not a persistent state that keeps triggering jumps:
  //
  //   'failed'              → hold weight (incomplete sets / thumbs-down)
  //   'very_easy'           → +7.5 kg (in-session "5+ more left" feedback)
  //   'easy'                → +5 kg (easy session or thumbs-up feedback)
  //   'normal' + streak ≥3  → +5 kg (3+ consistent normal sessions = ready)
  //   'normal' / undefined  → +2.5 kg (standard progressive overload)
  // When a user had aches, exercise IDs get a '-comfort' suffix.  When switching
  // between ache/ache-free sessions the lookup ID changes (e.g. 'squat' ↔ 'squat-comfort').
  // Check the alternate variant so the progression anchor is never lost.
  const baseId = exerciseId?.replace(/-comfort$/, '');
  const isComfortVariant = exerciseId !== baseId; // true when exerciseId ends with '-comfort'
  let lastKg = 0;
  if (exerciseId) {
    // Primary lookup: exact match.
    const primary = lastLoggedWeights?.[exerciseId];
    if (primary !== undefined) {
      lastKg = primary;
    } else if (isComfortVariant) {
      // Was logged as comfort, now playing standard variant → check base ID.
      lastKg = lastLoggedWeights?.[baseId!] ?? 0;
    } else {
      // Was logged as standard, now playing comfort variant → check comfort ID.
      lastKg = lastLoggedWeights?.[`${exerciseId}-comfort`] ?? 0;
    }
  }
  if (lastKg > 0 && layoff && !layoff.reset) {
    // A comeback replaces progression rather than adding to it. The step exists
    // to answer "how did last session go", and last session was weeks ago.
    return computed(toGrid(lastKg * layoff.factor));
  }
  if (lastKg > 0 && !layoff?.reset) {
    const performance = exerciseId ? lastSessionPerformance?.[exerciseId] : undefined;
    if (performance === 'failed') {
      // Three failures in a row is a stall, not a bad day. Back the weight off
      // rather than handing over the same bar for a fourth attempt — see
      // deloadedLoad, and the summary screen that has been recommending exactly
      // this to the user while the engine did nothing about it.
      const stuck = exerciseId ? (exerciseStuckStreak?.[exerciseId] ?? 0) : 0;
      const deloaded = deloadedLoad(lastKg, stuck, toGrid);
      if (deloaded !== null) {
        if (__DEV__) {
          console.log(
            `[personalizeLoad] exId=${exerciseId} DELOAD ${lastKg}kg → ${deloaded}kg (stuck=${stuck})`
          );
        }
        return computed(deloaded);
      }
      // Incomplete sets or thumbs-down - hold at same weight
      if (__DEV__) {
        console.log(
          `[personalizeLoad] exId=${exerciseId} HOLDING at ${lastKg}kg (performance=failed, stuck=${stuck})`
        );
      }
      return computed(lastKg);
    }
    // No-feedback streak: consecutive sessions this exercise was logged without
    // any explicit feedback (thumbs / tooEasy). Maintained per-exercise in the
    // store so it resets to 0 precisely when feedback is received for *this*
    // exercise, not based on unrelated global session count changes.
    const normalStreak = exerciseId ? (exerciseNormalStreak?.[exerciseId] ?? 0) : 0;
    const progressedKg = progressedLoad(
      lastKg,
      performance,
      normalStreak,
      toGrid,
      profile?.experienceLevel
    );
    if (__DEV__) {
      console.log(
        `[personalizeLoad] exId=${exerciseId} lastKg=${lastKg} perf=${performance} normalStreak=${normalStreak} → ${progressedKg}kg`
      );
    }
    return computed(progressedKg);
  }

  /**
   * The most a comeback may prescribe.
   *
   * Past LAYOFF_RESET_DAYS the app falls back to the estimate it would give a
   * stranger — but that estimate must never come back HEAVIER than the weight
   * this person actually walked away from. It can: a 1RM tested eight months
   * ago is still the best one on file, and 85% of it can exceed the last real
   * working weight. So the lift they left, cut hard, caps every path below.
   * Null whenever there is nothing to cap against.
   */
  const comebackCeilingKg =
    layoff?.reset && lastKg > 0 ? toGrid(lastKg * layoff.factor) : null;

  if (__DEV__ && exerciseId && combinedMult !== 1.0) {
    console.log(
      `[personalizeLoad] ex=${exerciseId} (heuristic) strengthSessions=${strengthSessionCount}` +
        ` autoMult=${autoMult.toFixed(3)} feedbackMult=${feedbackMult.toFixed(3)}` +
        ` combinedMult=${combinedMult.toFixed(3)}`
    );
  }

  // ── 1RM-based load for the main KPI lift ────────────────────────────────
  // When the user entered their 1RM during onboarding (or a test week), use it
  // to calculate the working weight directly rather than relying on body-weight
  // heuristics.  Goal-specific percentages mirror common periodisation practice.
  if (ormKg && ormKg > 0 && isMainLift) {
    const targetKg = toGrid(
      workingWeightFromOrm(ormKg, profile, loadUnit) * earnedMult * layoffMult
    );
    return computed(comebackCeilingKg === null ? targetKg : Math.min(targetKg, comebackCeilingKg));
  }

  // ── Heuristic scaling (fallback when no 1RM is available) ───────────────
  const REF_BW = 80;
  const bwRatio = profile.bodyweightKg / REF_BW;

  const expFactor: Record<string, number> = { beginner: 0.45, intermediate: 0.7, advanced: 1.0 };
  const goalFactor: Record<string, number> = {
    strength: 1.08,
    muscle: 1.0,
    fat_loss: 0.72,
    fitness: 0.85,
    rehab: 0.5,
    power: 1.05,
  };
  /**
   * "Prefer not to say" is a MIDPOINT, on both halves of the body.
   *
   * It used to be a single 0.85 while male and female both split upper from
   * lower — and the gap between the sexes is far wider on upper body (0.55 vs
   * 1.0) than on lower (0.72 vs 1.0). So one flat number could not sit between
   * them on both, and 0.85 sat close to male on the half where the difference
   * is largest.
   *
   * In practice: a woman who chose the privacy answer on the sex step — offered
   * under the hint "Helps us calibrate your lifting loads" — was prescribed
   * about 55% more weight on her first bench session than the identical woman
   * who chose Female, and 18% more on squat and deadlift days. With no 1RM
   * entered and no history, this heuristic IS the first session's weight, so
   * she fails her opening set and the app looks like it does not know her.
   *
   * Halfway between the two on each half instead. Declining to answer should
   * cost accuracy in both directions equally, not push one group's loads up.
   */
  const sexFactor =
    profile.sex === 'female'
      ? isUpperBodySession
        ? 0.55
        : 0.72
      : profile.sex === 'other'
        ? isUpperBodySession
          ? 0.775
          : 0.86
        : 1.0;

  const activeGoals = profile.goals?.length ? profile.goals : ['fitness' as FitnessGoal];
  const avgGoalFactor =
    activeGoals.reduce((sum, g) => sum + (goalFactor[g] ?? 1.0), 0) / activeGoals.length;

  const scale = bwRatio * (expFactor[profile.experienceLevel] ?? 0.7) * avgGoalFactor * sexFactor;

  // Every weight in the string is scaled, so the sentence the user reads keeps
  // whatever shape it had — a range stays a range. The scaled values are
  // collected as we go rather than re-parsed out of the result; that round trip
  // is exactly what this removes. Only a stated ladder travels as several
  // weights, because only a ladder means one weight per set.
  //
  // A comeback ceiling is folded in as one more multiplier rather than clamping
  // each number where it stands: clamping individually would squash a stated
  // ramp into a flat line, which is a different prescription, not a lighter one.
  const rawNumbers = (rawLoad.match(/\d+(?:\.\d+)?/g) ?? [])
    .map((n) => parseFloat(n))
    .filter((n) => n > 0);
  const rawRef = statesLadder(rawLoad) ? Math.max(0, ...rawNumbers) : (rawNumbers[0] ?? 0);
  const uncappedRefKg = rawRef * scale * earnedMult * layoffMult;
  const ceilingScale =
    comebackCeilingKg !== null && uncappedRefKg > comebackCeilingKg
      ? comebackCeilingKg / uncappedRefKg
      : 1;

  const scaled: number[] = [];
  const text = rawLoad.replace(/\d+(?:\.\d+)?/g, (match) => {
    const num = parseFloat(match);
    if (num <= 0) return match;
    const kg = toGrid(num * scale * earnedMult * layoffMult * ceilingScale);
    scaled.push(kg);
    return String(kg);
  });
  const prescribed = statesLadder(rawLoad) ? scaled : scaled.slice(0, 1);
  return { text, kg: prescribed.length > 0 ? prescribed : null };
}

function shouldSwapForComfort(
  template: ExerciseTemplate,
  painRegion?: PainRegion | PainRegion[]
): boolean {
  if (!painRegion || !template.comfortVariant) return false;
  const regions = Array.isArray(painRegion) ? painRegion : [painRegion];
  return regions.some((r) => template.comfortVariant!.triggerRegions.includes(r));
}

function applyComfortOrBadge(
  template: ExerciseTemplate,
  hasAches: boolean,
  painRegion: PainRegion | PainRegion[] | undefined,
  tier: EquipmentTier,
  overrideSets?: number,
  overrideCategory?: ExerciseCategory
): Exercise {
  const isDumbbell = isDumbbellTier(tier);
  /**
   * A comfort variant is only comfort if they can actually do it.
   *
   * These are hand-authored gentler versions, and a great many of them reach for
   * a band: a Glute Bridge offers a Banded Clamshell, a Pike Push-Up offers a
   * Banded Lateral Raise. Handed to somebody who ticked "No Equipment" the
   * kinder option is the one they cannot perform, and it arrives at exactly the
   * moment they have said something hurts.
   *
   * Falling through to the ordinary exercise is the right failure: it is the
   * movement they were already going to do, and the injury screen above this
   * has separately removed anything genuinely unsafe for the area.
   */
  const comfortIsPossible =
    !!template.comfortVariant &&
    canPerformWith(template.comfortVariant.equipmentRequired ?? template.equipmentRequired, [tier]);
  if (hasAches && shouldSwapForComfort(template, painRegion) && comfortIsPossible && template.comfortVariant) {
    const cv = template.comfortVariant;
    return {
      id: template.id + '-comfort',
      name: cv.name,
      sets: overrideSets ?? template.sets,
      reps: template.reps,
      cue: cv.cue,
      suggestedLoad: cv.suggestedLoad,
      category: overrideCategory ?? template.category,
      badge: 'comfort',
      videoId: template.videoId,
      youtubeUrl: template.youtubeUrl,
      hasSwap: false,
      isDumbbellExercise: isDumbbell,
      // A comfort variant is the same movement made kinder, so it trains the
      // same muscle. Dropping this made the exercise region-less, and a
      // region-less exercise can be replaced by anything at all.
      primaryMuscle: template.primaryMuscle,
    };
  }
  const ex = templateToExercise(template, undefined, isDumbbell);
  if (overrideSets !== undefined) ex.sets = overrideSets;
  if (overrideCategory !== undefined) ex.category = overrideCategory;
  return ex;
}

/**
 * SESSION STRUCTURE (8 phases):
 *
 * 1. Pre-Training Preparation  (prep)        - cardio warmup + active mobility
 * 2. Mechanical Priming        (mechanical)   - bands, activation, constant tension
 * 3. Neurological Priming      (neuro)        - explosive movement, 1-5 reps
 * 4. KPI Lift                  (main)         - main strength exercise with ramp + work sets
 * 5. Pump Accessories          (accessory)    - hypertrophy support, 15-25 reps
 * 6. Prehab                    (prehab)       - joint health, holds
 * 7. Conditioning Finisher     (finisher)     - 2-10 min, energy-scaled (optional)
 * 8. Post-Training Cool Down   (cooldown)     - breathing
 *
 * Time scaling:
 *   30 min → cardio + 3 prep stretches + mechanical + KPI + 1 accessory (SAFETY: always warm up)
 *   45 min → all prep + mechanical + neuro + KPI + 2 acc + prehab + finisher
 *   60 min → all 8 phases - full session
 */
/**
 * Returns set-count adjustments based on the user's goal mix.
 *
 * mainSetsDelta: added to the KPI lift base sets (strength → +1, rehab → -1)
 * accSetsDelta:  added to each accessory set count (muscle/fat_loss → +1, strength/rehab → -1)
 *
 * When two goals are selected the deltas are averaged and rounded.
 */
function getGoalVolumeDeltas(goals: FitnessGoal[]): {
  mainSetsDelta: number;
  accSetsDelta: number;
} {
  const mainDelta: Record<FitnessGoal, number> = {
    strength: 1,
    muscle: 0,
    fat_loss: 0,
    fitness: 0,
    rehab: -1,
    power: 1,
  };
  const accDelta: Record<FitnessGoal, number> = {
    strength: -1,
    muscle: 1,
    fat_loss: 1,
    fitness: 0,
    rehab: -1,
    power: 0,
  };
  const active = goals?.length ? goals : (['fitness'] as FitnessGoal[]);
  const avgMain = active.reduce((s, g) => s + (mainDelta[g] ?? 0), 0) / active.length;
  const avgAcc = active.reduce((s, g) => s + (accDelta[g] ?? 0), 0) / active.length;
  return { mainSetsDelta: Math.round(avgMain), accSetsDelta: Math.round(avgAcc) };
}

/**
 * Standard kettlebell weights in kg - the required set per project spec.
 * 8 kg minimum (no 4/6), 40 kg maximum (no 48+).
 */
const KB_WEIGHTS = [8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40];

function nearestKbWeight(kg: number): number {
  return KB_WEIGHTS.reduce((prev, curr) =>
    Math.abs(curr - kg) < Math.abs(prev - kg) ? curr : prev
  );
}

function relabelForKettlebell(text: string): string {
  return text
    .replace(/\bdumbbells?\b/gi, (match) => {
      const isPlural = /s$/i.test(match);
      const isCapital = /^[A-Z]/.test(match);
      const base = isCapital ? 'Kettlebell' : 'kettlebell';
      return isPlural ? base + 's' : base;
    })
    .replace(/\bDBs?\b/g, (match) => (match.endsWith('s') ? 'KBs' : 'KB'));
}

/**
 * Rewrite a prescribed load in the weights a kettlebell owner actually has.
 *
 * IT USED TO ROUND EVERY NUMBER TO THE NEAREST BELL, INDEPENDENTLY.
 *
 * The lightest bell is 8 kg, so "2-4 kg per hand" — the physio's own
 * prescription for rotator-cuff external rotations, the most load-sensitive
 * drill in the app and one that sits in the prehab slot — was printed as
 * "8-8 kg per hand". Two to four times the intended load, on a rehab exercise,
 * for someone who has told the app their shoulder hurts.
 *
 * It also produced collapsed nonsense wherever both ends of a range rounded to
 * the same bell: "6-10 kg" became "8-8 kg", across fourteen cards.
 *
 * Two rules now:
 *
 *   1. NEVER round a load UP past what was prescribed. A bell heavier than the
 *      top of the range is not the nearest available option, it is a different
 *      exercise. Sub-8 kg prescriptions are left exactly as written — bands or a
 *      light dumbbell are the honest answer, and the user can read the number.
 *   2. A range that collapses to one bell prints as one number, not "8-8".
 */
function relabelLoadForKettlebell(load: string): string {
  const labelled = relabelForKettlebell(load);

  // A range: round each end on its own, then tidy up if they meet.
  const range = labelled.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) {
    const lo = parseFloat(range[1]);
    const hi = parseFloat(range[2]);
    if (lo <= 100 && hi <= 100) {
      // The whole range is lighter than the lightest bell. Rounding it up would
      // more than double the prescription, so it stays as written.
      if (hi < KB_WEIGHTS[0]) return labelled;
      const loKb = Math.min(nearestKbWeight(lo), nearestKbWeight(hi));
      const hiKb = nearestKbWeight(hi);
      const replacement = loKb === hiKb ? String(loKb) : `${loKb}-${hiKb}`;
      return labelled.replace(range[0], replacement);
    }
  }

  return labelled.replace(/\d+(?:\.\d+)?/g, (match) => {
    const num = parseFloat(match);
    if (num > 100) return match;
    // Same rule for a single figure: never heavier than what was asked for.
    if (num < KB_WEIGHTS[0]) return match;
    return String(nearestKbWeight(num));
  });
}

/**
 * Post-processes the exercise list to use KB terminology when the user's
 * equipment tier is 'kettlebells'. Names, cues, and loads all get relabelled.
 */
function applyKettlebellNaming(exercises: Exercise[]): Exercise[] {
  return exercises.map((ex) => ({
    ...ex,
    name: relabelForKettlebell(ex.name),
    cue: relabelForKettlebell(ex.cue),
    suggestedLoad: relabelLoadForKettlebell(ex.suggestedLoad),
    swapName: ex.swapName ? relabelForKettlebell(ex.swapName) : ex.swapName,
    swapCue: ex.swapCue ? relabelForKettlebell(ex.swapCue) : ex.swapCue,
    swapLoad: ex.swapLoad ? relabelLoadForKettlebell(ex.swapLoad) : ex.swapLoad,
  }));
}

function applyPersonalization(
  ex: Exercise,
  profile: UserProfile | undefined,
  isUpperBody: boolean,
  exerciseFeedback?: Record<string, ExerciseFeedback>,
  ormKg?: number,
  /** Count of completed STRENGTH sessions only - see personalizeLoad. */
  strengthSessionCount: number = 0,
  lastLoggedWeights?: Record<string, number>,
  exerciseNormalStreak?: Record<string, number>,

  exerciseStuckStreak?: Record<string, number>,
  lastSessionPerformance?: Record<string, ExercisePerformance>,
  layoff?: Layoff | null,
  /** The unit the user's gym is stocked in - see personalizeLoad. */
  loadUnit: WeightUnit = 'kg'
): Exercise {
  if (!profile) return ex;
  const isMainLift = ex.category === 'main';

  // Derive a human-readable progression note from the same signals used in
  // personalizeLoad, so ExerciseCard can explain the suggested load to the user.
  // Mirrors getNextHint()'s reasoning/voice in session-summary.tsx, phrased for
  // "why this weight right now" rather than "what happens next time" - the two
  // are the same underlying decision, seen at different points in the loop.
  let progressionNote: string | undefined;
  let progressionDirection: 'up' | 'hold' | undefined;
  const lastKg = ex.id ? (lastLoggedWeights?.[ex.id] ?? 0) : 0;
  if (lastKg > 0 && layoff) {
    // Silence would be the worst option here. The weight visibly went DOWN, and
    // every other note on this card explains a step up — leaving the old copy
    // in place would have the card claim it nudged the weight up on the exact
    // session where it cut it. Direction stays 'hold' rather than gaining a
    // 'down' case: the icon that reads it lives in app/session.tsx, and a dash
    // beside "eased back" is honest where an upward arrow would not be.
    const away = describeTimeAway(layoff.daysAway);
    progressionNote = layoff.reset
      ? `Starting fresh - ${away} away, so this is an estimate again`
      : layoff.slight
        ? `Eased back slightly - ${away} since your last session`
        : `Eased back to ${Math.round(layoff.factor * 100)}% - ${away} since your last session`;
    progressionDirection = 'hold';
  } else if (lastKg > 0) {
    const performance = ex.id ? lastSessionPerformance?.[ex.id] : undefined;
    const normalStreak = ex.id ? (exerciseNormalStreak?.[ex.id] ?? 0) : 0;
    if (performance === 'failed') {
      // A deload has to say so. Every other note on a failed session says "held
      // steady", and on the session where the weight actually came DOWN that
      // would be the card describing something the engine did not do — the same
      // fault the time-off note above exists to avoid. Direction stays 'hold'
      // for the same reason it does there: a dash beside "eased back" is honest
      // where an upward arrow is not.
      const stuck = ex.id ? (exerciseStuckStreak?.[ex.id] ?? 0) : 0;
      const deloaded = deloadedLoad(lastKg, stuck, (v) => roundToLoadable(v, loadUnit));
      const ratedDown = ex.id ? exerciseFeedback?.[ex.id]?.thumbs === 'down' : false;
      progressionNote =
        deloaded !== null
          ? `Eased back ${Math.round((1 - DELOAD_FRACTION) * 100)}% - stuck here ${stuck} sessions, so this is a reset to build from`
          : ratedDown
            ? 'Held steady - you rated this tough last time'
            : 'Held steady - a set was left incomplete last time';
      progressionDirection = 'hold';
    } else if (performance === 'very_easy') {
      progressionNote = 'Bumped up big - you said you had plenty left last time';
      progressionDirection = 'up';
    } else if (performance === 'easy') {
      progressionNote = 'Bumped up - you rated this easy last time';
      progressionDirection = 'up';
    } else if (normalStreak >= 3) {
      progressionNote = `Bumped up - ${normalStreak} clean sessions in a row`;
      progressionDirection = 'up';
    } else {
      progressionNote = 'Nudged up - clean session last time';
      progressionDirection = 'up';
    }
  }

  const personalise = (raw: string) =>
    personalizeLoad(
      raw,
      profile,
      isUpperBody,
      ex.id,
      exerciseFeedback,
      ormKg,
      isMainLift,
      strengthSessionCount,
      lastLoggedWeights,
      exerciseNormalStreak,

      exerciseStuckStreak,
      lastSessionPerformance,
      layoff,
      loadUnit
    );

  const main = personalise(ex.suggestedLoad);
  const swap = ex.swapLoad ? personalise(ex.swapLoad) : null;

  return {
    ...ex,
    suggestedLoad: main.text,
    // Structured weights travel with the exercise so the UI never has to read
    // them back out of the sentence above.
    loadKg: main.kg ?? undefined,
    swapLoad: swap ? swap.text : ex.swapLoad,
    progressionNote,
    progressionDirection,
  };
}

/**
 * Share of the usual load in a planned easier week.
 *
 * The same 10% the stall deload takes off, and deliberately so: a person who
 * has met one of these should recognise the other. Ten percent is enough to be
 * felt and small enough that nobody reads it as the app losing their weights,
 * which matters more here than it does after a stall, because after a stall
 * there is at least an obvious reason.
 */
export const DELOAD_WEEK_LOAD = 0.9;

/**
 * The categories that lose a set in an easier week.
 *
 * The hard work, and only the hard work. Taking a set off the prep block makes
 * the warm-up worse and the week no easier, and taking one off the prehab block
 * takes away the part of the session an easier week is the best time to do.
 */
const DELOAD_DROPS_A_SET: ExerciseCategory[] = ['main', 'accessory', 'finisher'];

/**
 * LESS WEIGHT, ONE FEWER SET, AND IT SAYS SO ON EVERY CARD.
 *
 * The third of those is not decoration. Every other note the app writes about a
 * load explains a step up; a session that quietly prescribes 10% less than last
 * time, with the usual "nudged up" underneath it, is the app appearing to have
 * lost the user's weights. That is the single most damaging thing a deload can
 * look like, so the note is rewritten here rather than left to whatever
 * applyPersonalization decided before the week was taken into account.
 *
 * Runs over the finished list so it lands on what is actually being shown,
 * including a swapped-in substitute, for the same reason the earned rep target
 * is applied there.
 */
export function easeForDeloadWeek(
  list: Exercise[],
  loadUnit: WeightUnit = 'kg'
): Exercise[] {
  const toGrid = (v: number) => roundToLoadable(v, loadUnit);
  return list.map((ex): Exercise => {
    const sets =
      DELOAD_DROPS_A_SET.includes(ex.category) && ex.sets > 2 ? ex.sets - 1 : ex.sets;
    // A load that never resolved to a number is a rep range, a band or a time,
    // and there is nothing here to take off. Its set count still comes down.
    const hasWeight = (ex.loadKg ?? []).some((kg) => kg > 0) || /\d/.test(ex.suggestedLoad);
    if (!hasWeight) {
      return sets === ex.sets
        ? ex
        : { ...ex, sets, progressionNote: 'Easier week - one set fewer', progressionDirection: 'hold' };
    }
    const eased = ex.suggestedLoad.replace(/\d+(?:\.\d+)?/g, (match) => {
      const num = parseFloat(match);
      if (num <= 0) return match;
      const kg = toGrid(num * DELOAD_WEEK_LOAD);
      // A coarse grid can round a 10% cut straight back onto the weight it came
      // from on a light lift. Saying "eased back" over an unchanged number is
      // the one outcome worse than not easing at all.
      return String(kg < num ? kg : num);
    });
    return {
      ...ex,
      sets,
      suggestedLoad: eased,
      loadKg: ex.loadKg
        ? ex.loadKg.map((kg) => (kg > 0 ? Math.min(kg, toGrid(kg * DELOAD_WEEK_LOAD)) : kg))
        : ex.loadKg,
      progressionNote: `Easier week - about ${Math.round((1 - DELOAD_WEEK_LOAD) * 100)}% off, so the next block has somewhere to climb from`,
      progressionDirection: 'hold',
    };
  });
}

/**
 * Every generation path, then the injury screen.
 *
 * The screen runs LAST, over the finished list, rather than being threaded
 * through each generator. That is deliberate: there are five separate paths
 * that build a session (KPI, weekly, conditioning, prehab, flexibility) plus
 * comfort variants, grip variants and kettlebell renaming layered on top, and a
 * filter applied at any one of them is a filter three others quietly skip.
 * Screening the output is the only place where "nothing unsafe reaches the
 * user" is a statement about the whole app rather than about one code path.
 */
export function generateWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck,
  profile?: UserProfile,
  exerciseFeedback?: Record<string, ExerciseFeedback>,
  bestOrmKg?: number,
  /** Count of completed STRENGTH sessions (squat/bench/deadlift) only - drives auto-progression. */
  strengthSessionCount: number = 0,
  lastLoggedWeights?: Record<string, number>,
  exerciseNormalStreak?: Record<string, number>,
  lastSessionPerformance?: Record<string, ExercisePerformance>,
  /**
   * Whole days since the last completed session. Defaults to whatever the store
   * last published (see setLastTrainedDate), so the one caller that builds a
   * real session gets time-off handling without having to know about it, and a
   * test can pass an explicit number instead of reaching into module state.
   */
  daysSinceLastSession: number | null = daysSinceLastTrained(),
  /**
   * The unit the user's gym is stocked in, which decides the grid every weight
   * below is rounded onto. Defaults to kilograms so nothing that does not care
   * about it has to say so. See `roundToLoadable` in lib/utils.ts for why this
   * cannot live at the render boundary instead.
   */
  loadUnit: WeightUnit = 'kg',
  /**
   * Consecutive failed sessions per exercise, which is what triggers a deload.
   *
   * LAST ON PURPOSE, breaking the grouping with the other two per-exercise
   * records above it. This signature is positional and is called from the
   * session screen and from a couple of dozen check scripts; slotting a
   * thirteenth parameter into the middle would silently shift every argument
   * after it at every one of those call sites. An awkward position is a much
   * smaller problem than a test suite quietly passing the wrong data.
   */
  exerciseStuckStreak?: Record<string, number>,
  /**
   * Where each exercise currently sits in its rep range, earned over previous
   * sessions. Appended LAST for the same reason exerciseStuckStreak was.
   *
   * Absent, or absent for a given exercise, means "use what the catalogue says"
   * - which is every account before its first session, all timed and AMRAP
   * work, and all rehab dosing, forever.
   */
  exerciseRepTarget?: Record<string, string>
): Exercise[] {
  const layoff = getLayoff(daysSinceLastSession);
  // Screen first, then fill the swap slots — so the alternatives on offer are
  // alternatives to what the user is actually being shown, and a substituted
  // exercise gets its own stand-ins rather than inheriting the removed one's.
  const screened = applyInjurySafety(
    generateWorkoutUnscreened(
      sessionType,
      equipmentTier,
      readiness,
      profile,
      exerciseFeedback,
      bestOrmKg,
      strengthSessionCount,
      lastLoggedWeights,
      exerciseNormalStreak,

      exerciseStuckStreak,
      lastSessionPerformance,
      layoff,
      loadUnit
    ),
    readiness,
    equipmentTier,
    profile,
    strengthSessionCount,
    sessionType
  );
  const withSwaps = fillSwapAlternatives(
    screened,
    readiness,
    equipmentTier,
    profile,
    strengthSessionCount + getLocalDayIndex()
  );

  /**
   * Apply the rep target the user has EARNED, over the catalogue's default.
   *
   * Last, and on the final list, so it lands on the exercises actually being
   * shown: a swapped-in substitute keeps its own prescription rather than
   * inheriting the rep count of the movement it replaced.
   */
  const targeted = !exerciseRepTarget
    ? withSwaps
    : withSwaps.map((ex) =>
        ex.id && exerciseRepTarget[ex.id] ? { ...ex, reps: exerciseRepTarget[ex.id] } : ex
      );

  // LAST, after the earned rep target, so an easier week eases the prescription
  // the user actually has rather than the catalogue's default one.
  return readiness.deload ? easeForDeloadWeek(targeted, loadUnit) : targeted;
}

/**
 * A safe replacement for a movement the user should not be doing today.
 *
 * Order of preference, most specific first:
 *
 *   1. The template's own `injuryFriendlyAlternatives` — hand-authored, so it
 *      is the closest thing to a considered clinical opinion in the database.
 *   2. Its `swapAlternative` / `comfortVariant`, if those are themselves clean.
 *   3. The wider catalogue: same category, same movement pattern, same primary
 *      muscle where possible, carrying none of the banned tags.
 *
 * The pick within (3) is seeded rather than random so regenerating the same
 * session produces the same substitution — a session that reshuffles itself on
 * every render is not a session anyone can follow.
 */
/** Equipment tiers in ascending order — anything at or below the user's tier
 *  is available to them. */
const TIER_RANK: InternalTier[] = ['bodyweight', 'dumbbells', 'fullgym'];

/**
 * Every safe stand-in for a movement, best match first.
 *
 * Shared by two callers that want the same ranking for different reasons: the
 * injury screen takes the top one as a forced substitution, and the swap
 * builder takes the next few to offer as manual alternatives. Keeping one
 * ranking means the exercise the app picks FOR you and the ones it offers you
 * are drawn from the same idea of what is alike.
 */
/**
 * Everything the user could safely be offered instead of `original`.
 *
 * Pulled out of rankedAlternatives so the equipment picker applies exactly
 * the same filters. Two pickers with two copies of "is this safe for them"
 * is one copy away from the swap sheet offering what the injury screen just
 * removed, which is the failure tests/swap-options.check.mjs section [3]
 * exists to catch.
 */
interface AlternativePool {
  pickable: PickableExercise[];
  byName: Map<string, PickableExercise>;
  source?: ExerciseTemplate;
  isUsable: (p: PickableExercise) => boolean;
}

/**
 * The catalogue keyed by lower-cased name, built once.
 *
 * getAllPickableExercises() is itself cached, but this map was being rebuilt
 * from its 689 entries on every call — once per exercise per session, and the
 * contract tests generate thousands of sessions.
 */
let _pickableByName: Map<string, PickableExercise> | null = null;
function pickableByName(): Map<string, PickableExercise> {
  if (!_pickableByName) {
    _pickableByName = new Map(
      getAllPickableExercises().map((p) => [p.template.name.toLowerCase(), p])
    );
  }
  return _pickableByName;
}

function alternativePool(
  original: Exercise,
  banned: Set<StressTag>,
  tier: EquipmentTier,
  usedNames: Set<string>
): AlternativePool {
  const pickable = getAllPickableExercises();
  const byName = pickableByName();
  const source = byName.get(original.name.toLowerCase())?.template;
  const internal = toInternalTier(tier);

  const isClean = (t: ExerciseTemplate) =>
    restrictedTagsOn(t.name, banned, t.movementPattern).length === 0;
  // A stand-in has to train the same half of the body. Without this, a
  // lower-body session with a sore quad had its main lift replaced by a BENCH
  // PRESS and an accessory by a FACE PULL — both safe for the quad, neither a
  // leg exercise. See bodyRegionOf.
  const region = REGION_BOUND_CATEGORIES.includes(original.category)
    ? bodyRegionOf(original.primaryMuscle ?? source?.primaryMuscle)
    : 'other';
  // Anything at the user's tier OR BELOW. Someone with a full gym can obviously
  // do a goblet squat; restricting substitutes to exact-tier matches meant a
  // full-gym user with a sore back had every squat variation ruled out (all the
  // barbell ones are spinal loading) and got handed a leg curl as their main
  // lift, because the dumbbell and bodyweight squats were invisible to it.
  const tierRank = TIER_RANK.indexOf(internal);
  const isUsable = (p: PickableExercise) =>
    p.tiers.some((t) => TIER_RANK.indexOf(t) <= tierRank) &&
    // AND the kit it actually needs. The rank test above is a three-rung ladder
    // that cannot tell a band from a press-up, so somebody who ticked "No
    // Equipment" was offered banded stand-ins behind the swap button and as
    // forced injury substitutions. canPerformWith asks the real question.
    canPerformWith(p.template.equipmentRequired, [tier]) &&
    !usedNames.has(p.template.name.toLowerCase()) &&
    canSubstituteFor(region, p.template.primaryMuscle) &&
    isClean(p.template);

  return { pickable, byName, source, isUsable };
}

function rankedAlternatives(
  original: Exercise,
  banned: Set<StressTag>,
  tier: EquipmentTier,
  usedNames: Set<string>
): ExerciseTemplate[] {
  const { pickable, byName, source, isUsable } = alternativePool(
    original,
    banned,
    tier,
    usedNames
  );

  const ranked: ExerciseTemplate[] = [];
  const push = (t: ExerciseTemplate) => {
    if (!ranked.some((r) => r.name === t.name)) ranked.push(t);
  };

  // (1) and (2): alternatives the database already names for this movement.
  // Hand-authored, so they lead — someone chose them for this exercise.
  const named = [
    ...(source?.injuryFriendlyAlternatives ?? []),
    source?.swapAlternative?.name,
    source?.comfortVariant?.name,
  ].filter((n): n is string => !!n);
  for (const name of named) {
    const candidate = byName.get(name.toLowerCase());
    if (candidate && isUsable(candidate)) push(candidate.template);
  }

  // (3) the catalogue, narrowing from most-alike to least.
  //
  // The trailing-word tier exists because the session's names do not always
  // exist in the catalogue: the main lift can arrive as a variation ("Barbell
  // Front Squat") whose base template is filed elsewhere, so `source` comes
  // back undefined and every metadata comparison below silently matches
  // nothing. That is not theoretical — it is how a knee-safe FRONT SQUAT
  // substitution came back as a DEADLIFT, by falling all the way through to
  // "any main lift, alphabetically". The last word of an exercise name is
  // almost always the movement itself (Squat, Press, Row, Curl, Deadlift), so
  // it is a reliable last-ditch match on shape.
  const lastWord = (n: string) =>
    n
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .trim()
      .split(/\s+/)
      .pop();
  const originalMovement = lastWord(original.name);
  const inCategory = pickable.filter((p) => p.template.category === original.category && isUsable(p));
  const tiers = [
    inCategory.filter(
      (p) =>
        source != null &&
        p.template.movementPattern === source.movementPattern &&
        p.template.primaryMuscle === source.primaryMuscle
    ),
    inCategory.filter((p) => source != null && p.template.movementPattern === source.movementPattern),
    inCategory.filter((p) => lastWord(p.template.name) === originalMovement),
    inCategory.filter((p) => source != null && p.template.primaryMuscle === source.primaryMuscle),
    inCategory,
  ];
  for (const group of tiers) {
    // Sorted before it is walked so the order does not depend on catalogue
    // order, which is an accident of how the database file grew.
    const closeness = (p: (typeof pickable)[number]) =>
      -Math.max(...p.tiers.map((t) => TIER_RANK.indexOf(t)));
    for (const p of [...group].sort(
      // Closest equipment tier first, then alphabetically so the choice never
      // depends on catalogue order.
      (a, b) => closeness(a) - closeness(b) || a.template.name.localeCompare(b.template.name)
    )) {
      push(p.template);
    }
  }
  return ranked;
}

function findSafeReplacement(
  original: Exercise,
  banned: Set<StressTag>,
  tier: EquipmentTier,
  usedNames: Set<string>,
  seed: number
): ExerciseTemplate | null {
  const ranked = rankedAlternatives(original, banned, tier, usedNames);
  if (ranked.length > 0) {
    // Seeded rather than always-first so the same session regenerated produces
    // the same substitution, but two different sessions do not both land on the
    // alphabetically-first candidate.
    return ranked[Math.abs(seed) % ranked.length];
  }

  const pickable = getAllPickableExercises();
  const byName = new Map(pickable.map((p) => [p.template.name.toLowerCase(), p]));
  const sourceRegion = REGION_BOUND_CATEGORIES.includes(original.category)
    ? bodyRegionOf(
        original.primaryMuscle ?? byName.get(original.name.toLowerCase())?.template.primaryMuscle
      )
    : 'other';
  const isClean = (t: ExerciseTemplate) =>
    restrictedTagsOn(t.name, banned, t.movementPattern).length === 0 &&
    canSubstituteFor(sourceRegion, t.primaryMuscle);

  // A main lift must not simply vanish, so widen past the equipment tier before
  // giving up — a bodyweight alternative is a worse session than the barbell
  // one, and a better session than no main lift at all. It still has to be the
  // right half of the body: no main lift is better than the wrong one, because
  // the wrong one silently changes what session you are doing.
  if (original.category === 'main') {
    const anyTier = pickable.filter(
      (p) =>
        p.template.category === 'main' &&
        !usedNames.has(p.template.name.toLowerCase()) &&
        isClean(p.template)
    );
    if (anyTier.length > 0) {
      const sorted = [...anyTier].sort((a, b) => a.template.name.localeCompare(b.template.name));
      return sorted[Math.abs(seed) % sorted.length].template;
    }
  }
  return null;
}

/**
 * Removes or replaces anything the user's reported complaint rules out.
 *
 * Runs over a finished session. Each exercise that carries a banned tag is
 * replaced by the closest safe movement; where nothing safe exists and the
 * block is optional, it is dropped rather than kept. Replacements carry the
 * original as their swap alternative, so a user who disagrees can put it back
 * with the swap button that is already on every card.
 */
/**
 * Gives every exercise two alternatives to swap to, and says what each one is.
 *
 * WHAT CHANGED AND WHY
 * ────────────────────
 * Both slots used to come out of one ranking, so the sheet showed two things
 * and could not tell you why either was there. On a good day that was two
 * versions of the same idea; on a bad day two movements sharing nothing but a
 * muscle. Meanwhile a user taps swap for one of exactly two reasons:
 *
 *   "The cable station is taken"   → this movement, different kit
 *   "My shoulder has had enough"   → different movement, same muscles
 *
 * So slot one is now the equipment answer and slot two is the muscle answer,
 * each labelled. See lib/exercise-swaps.ts for what makes two exercises one or
 * the other.
 *
 * WHAT IT KEEPS
 * ─────────────
 * Hand-authored alternatives still lead. `swapAlternative` and
 * `comfortVariant` were chosen movement by movement by a physiotherapist and a
 * derived match is a guess by comparison — so they are CLASSIFIED into the slot
 * they fit rather than displaced from it. Only what the catalogue leaves empty
 * is filled, from the same safety-filtered pool the injury screen draws on:
 * within the user's equipment, the right half of the body, and never something
 * their reported complaint rules out. A swap that hands you an exercise you
 * cannot do is worse than no swap.
 *
 * WHERE IT FALLS SHORT, HONESTLY
 * ──────────────────────────────
 * Measured over generated sessions across every type and tier: 94% of
 * swappable exercises have a same-muscle alternative, and 23% of the lifting
 * blocks have an equipment variant. A Nordic curl, an inverted row and most
 * warm-up drills simply have no other way to be loaded, and the rule that finds
 * the rest is deliberately strict - see isEquipmentVariant, where loosening it
 * bought ten points of coverage and started calling a Spanish squat a back
 * squat.
 *
 * So when the equipment slot comes up empty it takes a second same-muscle
 * option and is labelled as one. Two alternatives that say what they are beat
 * one that says what it is and one that pretends.
 *
 * Seeded, so the derived options move between sessions rather than being the
 * same two forever, and never duplicate something already in today's session.
 */
/** How many alternatives the swap sheet can show. Two, because swapCount is
 *  0 | 1 | 2 and is persisted in resumed sessions. */
const SWAP_OPTIONS = 2;

interface SwapOption {
  name: string;
  cue?: string;
  load?: string;
  kind: SwapKind;
  reason: string;
}

/**
 * The catalogue indexed by the three things that make one exercise an
 * alternative for another, built once and in a fixed order.
 *
 * Without this the fill walked all 689 templates for every exercise in every
 * session, running the safety filter on each — which took the swap fill from
 * about a second to six minutes across the contract tests. The comparisons are
 * cheap; doing them 689 times when a hash lookup returns the four candidates
 * that could possibly match is not.
 *
 * Every list is stored in the display order: closest equipment tier first, then
 * alphabetically, so which alternative you are offered never depends on the
 * order the catalogue file happened to grow in.
 */
interface SwapIndex {
  /** Movement with the kit stripped out: 'pallof press'. The exact rule. */
  byCore: Map<string, PickableExercise[]>;
  /** movementPattern | primaryMuscle | movement noun. The near rule. */
  byNear: Map<string, PickableExercise[]>;
  byGroup: Map<MuscleGroup, PickableExercise[]>;
}

const nearKey = (c: { movementPattern?: string; primaryMuscle?: string; name: string }) =>
  `${c.movementPattern ?? ''}|${c.primaryMuscle ?? ''}|${movementNounOf(c.name)}`;

let _swapIndex: SwapIndex | null = null;
function swapIndex(): SwapIndex {
  if (_swapIndex) return _swapIndex;
  const closeness = (p: PickableExercise) => -Math.max(...p.tiers.map((t) => TIER_RANK.indexOf(t)));
  const ordered = [...getAllPickableExercises()].sort(
    (x, y) => closeness(x) - closeness(y) || x.template.name.localeCompare(y.template.name)
  );
  const byCore = new Map<string, PickableExercise[]>();
  const byNear = new Map<string, PickableExercise[]>();
  const byGroup = new Map<MuscleGroup, PickableExercise[]>();
  const push = <K>(map: Map<K, PickableExercise[]>, key: K, p: PickableExercise) => {
    const list = map.get(key);
    if (list) list.push(p);
    else map.set(key, [p]);
  };
  for (const p of ordered) {
    push(byCore, movementCoreOf(p.template.name), p);
    push(byNear, nearKey(p.template), p);
    const group = muscleGroupOf(p.template.primaryMuscle);
    if (group) push(byGroup, group, p);
  }
  _swapIndex = { byCore, byNear, byGroup };
  return _swapIndex;
}

/**
 * Rotate the starting point so the offered alternatives move between sessions.
 *
 * Seeded rather than random: regenerating the same session has to produce the
 * same sheet, or a resumed session offers different swaps from the one that was
 * paused.
 */
function rotate<T>(list: T[], seed: number): T[] {
  if (list.length === 0) return list;
  const offset = Math.abs(seed) % list.length;
  return [...list.slice(offset), ...list.slice(0, offset)];
}

/**
 * A stand-in for a stretch or a rehab drill, drawn from its OWN kind of work.
 *
 * WHY THESE TWO NEEDED THEIR OWN PATH. Cooldowns and prehab used to be returned
 * from the fill untouched, so the swap button never appeared on them at all.
 * Measured across 3,152 generated exercises: 810 of them, a quarter of
 * everything anybody is ever shown, had nothing behind the button. Every single
 * cooldown, and 522 of 558 rehab drills.
 *
 * The reason they were excluded is real and is not "nobody got round to it". A
 * rehab drill was chosen FOR the sore joint, so trading it for a bench press
 * undoes the session, and the general fill crosses categories and muscle groups
 * freely by design. So the answer is not to remove the exclusion, it is to swap
 * within the same job:
 *
 *   SAME CATEGORY   a stretch trades for a stretch, a drill for a drill.
 *                   rankedAlternatives already narrows to the category.
 *   SAME BODY AREA  and this one has to be added here. REGION_BOUND_CATEGORIES
 *                   is main and accessory only, which is correct for the
 *                   general fill and wrong here: it would let a knee protocol's
 *                   Quad Set trade for a shoulder Wall Slide, which is a
 *                   different session wearing the same label.
 *
 * Everything else the fill guarantees still applies, because this goes through
 * the same pool: nothing banned by the injury screen, and nothing needing kit
 * the user has not got.
 */
function sameJobAlternatives(
  ex: Exercise,
  banned: Set<StressTag>,
  tier: EquipmentTier,
  used: Set<string>,
  seed: number
): SwapOption[] {
  const source = pickableByName().get(ex.name.toLowerCase())?.template;
  const area = bodyRegionOf(ex.primaryMuscle ?? source?.primaryMuscle);

  /**
   * A REHAB DRILL is held to the pain regions it is tagged with, not to the
   * coarse upper/lower/core split.
   *
   * bodyRegionOf was the first thing tried and it is not nearly strict enough:
   * a knee drill and an ankle stretch are both "lower", so a knee protocol
   * offered Ankle Circles. Worse, the protocol exercises are frequently not in
   * the pickable catalogue at all, which left the muscle unknown, the region
   * 'other', and the filter passing everything - a Terminal Knee Extension
   * offering a Band Chest Press. Caught by tests/swap-options.check.mjs section
   * [5], which has always asserted this and until now had no swaps to assert it
   * against.
   *
   * targetRegions is the tagging the app already uses to decide which drill
   * belongs to which complaint, so the rule is: the stand-in may train a subset
   * of what the original trains, and nothing outside it. An untagged drill
   * offers nothing, because an untagged drill cannot be shown to be safe.
   */
  const regionsByName = ex.category === 'prehab' ? getRegionsByExerciseNameMap() : null;
  const ownRegions = regionsByName ? (regionsByName[ex.name] ?? []) : [];
  const staysOnTarget = (name: string) => {
    if (!regionsByName) return true;
    if (ownRegions.length === 0) return false;
    const alt = regionsByName[name] ?? [];
    return alt.length > 0 && alt.every((r) => ownRegions.includes(r));
  };

  /**
   * The CUE is read as well as the name, which rankedAlternatives does not do.
   *
   * Its own cleanliness test passes the name and the movement pattern and stops
   * there, and that is not enough here: "Incline Push-Up (slow)" is a chest
   * accommodation whose cue says "reduce chest stretch depth", so the tissue it
   * loads is named in the sentence rather than in the title. The screen keeps it
   * out of a session for somebody with a chest complaint, and without this it
   * came back one tap behind a rehab drill in that same session. Caught by
   * tests/stretch-screen.check.mjs, which sweeps 1,824 sessions for exactly
   * this.
   *
   * The general fill already reads authored cues for the same reason. This is
   * that rule applied to the derived options too.
   */
  const cueIsClean = (t: ExerciseTemplate) =>
    restrictedTagsOn(t.name, banned, t.movementPattern, t.cue).length === 0;

  /**
   * ...and an ACCOMMODATION is not a stand-in for a rehab drill.
   *
   * The cue check above passes "Incline Push-Up (slow)" for a chest complaint,
   * correctly: its wording disclaims the stretch, which is what stops the
   * screen deleting the gentler push-up and leaving the harder one. But the
   * drill it was being offered against is Scapular Setting, a zero-load
   * isometric hold, and trading that for a loaded press in a session where the
   * user has just reported chest pain is the app making the session harder than
   * it found it. See disclaimsLengthening in lib/exercise-safety.ts.
   */
  const isAccommodation = (t: ExerciseTemplate) =>
    disclaimsLengthening(`${t.name} ${t.cue ?? ''}`);

  const candidates = rankedAlternatives(ex, banned, tier, used).filter(
    (t) =>
      t.name !== ex.name &&
      t.category === ex.category &&
      canSubstituteFor(area, t.primaryMuscle) &&
      cueIsClean(t) &&
      !(ex.category === 'prehab' && isAccommodation(t)) &&
      staysOnTarget(t.name)
  );
  const reason =
    ex.category === 'cooldown'
      ? 'Another stretch for the same area.'
      : 'Another drill for the same area.';
  const out: SwapOption[] = [];
  const take = (list: ExerciseTemplate[], why: string) => {
    for (const t of rotate(list, seed)) {
      if (out.length >= SWAP_OPTIONS) break;
      if (out.some((o) => o.name === t.name)) continue;
      used.add(t.name.toLowerCase());
      out.push({ ...describe('movement', t), reason: why });
    }
  };
  take(candidates, reason);

  /**
   * A COOLDOWN falls back to any other cooldown; a REHAB DRILL never does.
   *
   * The catalogue holds eight cooldowns, so when the one same-area stretch is
   * already in today's session there is nothing left that matches, and eighteen
   * sessions in the measurement ended with a stretch that had nothing behind
   * its button. Offering a different area's stretch to finish on is honest and
   * costs nobody anything.
   *
   * The same relaxation on a rehab drill would not be honest. That drill is in
   * the session because of the joint it is for, and "we had run out of knee
   * work so here is a shoulder one" is the exact substitution the region check
   * above exists to prevent. A drill with nothing left to offer keeps its
   * button hidden, which is the truthful outcome.
   */
  if (out.length === 0 && ex.category === 'cooldown') {
    take(
      rankedAlternatives(ex, banned, tier, used).filter(
        (t) => t.name !== ex.name && t.category === 'cooldown' && cueIsClean(t)
      ),
      'Another way to finish.'
    );
  }
  return out;
}

/**
 * A pool held to the rungs this person has earned, easiest-suited first.
 *
 * WHAT IT DOES AND WHAT IT DELIBERATELY DOES NOT.
 *
 *   IT FILTERS the accessory, warm-up and finisher pools by the movement-level
 *   ceiling from lib/exercise-levels.ts, so somebody new to structured training
 *   stops being handed level 3 and 4 work as "accessories". That is the visible
 *   half of the ladders.
 *
 *   IT DOES NOT TOUCH THE MAIN LIFT. A squat session's main movement is the
 *   squat, and holding a beginner off the barbell there is the earn-the-barbell
 *   rule, which needs their LOGGED history rather than a label: nobody is
 *   promoted by answering a question differently. That is the next piece of
 *   work and it is not this one.
 *
 *   IT NEVER EMPTIES A POOL. A ceiling that leaves a session without its warm-up
 *   is a worse outcome than a warm-up that is a rung too hard, so a pool with
 *   nothing left inside the ceiling comes back untouched. Measured across the
 *   catalogue in tests/exercise-levels.check.mjs: at every ceiling the app can
 *   apply, every pattern keeps at least three movements, so this is a backstop
 *   rather than a routine escape.
 *
 * Unlevelled work - rehab, conditioning, mobility - passes straight through.
 * See the docblock in lib/exercise-levels.ts for why that is not an oversight.
 */
function atEarnedLevel(pool: ExerciseTemplate[], profile?: UserProfile): ExerciseTemplate[] {
  /**
   * The WHOLE profile, not just the experience answer.
   *
   * The ceiling is what somebody told us plus what they have shown us, and the
   * second half arrives as earnedLevelBonus. Taking only the string here is how
   * a rung earned by finishing a block would be recorded, displayed on the
   * report, and then quietly ignored by the thing that picks the exercises.
   */
  const band = levelBandForExperience(
    (profile?.experienceLevel as ExperienceLevel) ?? 'intermediate',
    profile?.earnedLevelBonus ?? 0
  );
  const kept = pool.filter((t) => withinLevel(t.name, t.movementPattern, band.max));
  return byLevelPreference(kept.length > 0 ? kept : pool, band, (t) => t);
}

function describe(kind: SwapKind, t: ExerciseTemplate): SwapOption {
  return {
    name: t.name,
    cue: t.cue,
    load: t.suggestedLoad,
    kind,
    reason: swapReasonFor(
      kind,
      kitOf(t.name, t.equipmentRequired),
      muscleGroupOf(t.primaryMuscle)
    ),
  };
}

export function fillSwapAlternatives(
  exercises: Exercise[],
  readiness: ReadinessCheck,
  tier: EquipmentTier,
  profile?: UserProfile,
  seed: number = 0
): Exercise[] {
  const regions = readiness?.painRegion
    ? Array.isArray(readiness.painRegion)
      ? readiness.painRegion
      : [readiness.painRegion]
    : [];
  // Every option on this sheet is one the app is offering, not one the user
  // already had, so it is held to the choose-on-their-behalf standard — see
  // substitutionRestrictedTags. Removing the thing that hurts and then putting
  // a burpee round one tap behind it is the same failure with an extra step.
  const banned = substitutionRestrictedTags(
    restrictedTagsFor(regions, profile?.experienceLevel, readiness?.painSeverity)
  );
  const inSession = new Set(exercises.map((e) => e.name.toLowerCase()));

  return exercises.map((ex, i) => {
    // A safety substitution carries the exercise it REPLACED as its swap, on
    // purpose: that is the revert, and it is labelled as one. Leave it alone.
    if (ex.safetyNote) return ex;

    // A cooldown and a rehab drill swap within their own job rather than not at
    // all. See sameJobAlternatives for why they cannot go through the general
    // fill, and why leaving them with nothing was the worse of the two answers.
    if (ex.category === 'cooldown' || ex.category === 'prehab') {
      const options = sameJobAlternatives(ex, banned, tier, new Set(inSession), seed + i);
      if (options.length === 0) return ex;
      return {
        ...ex,
        swapName: options[0]?.name,
        swapCue: options[0]?.cue,
        swapLoad: options[0]?.load,
        swapKind: options[0]?.kind,
        swapReason: options[0]?.reason,
        swap2Name: options[1]?.name,
        swap2Cue: options[1]?.cue,
        swap2Load: options[1]?.load,
        swap2Kind: options[1]?.kind,
        swap2Reason: options[1]?.reason,
        hasSwap: true,
      };
    }

    // `inSession` still contains this exercise's own name, so it can never be
    // offered as its own alternative.
    const used = new Set(inSession);
    const { byName, source, isUsable } = alternativePool(ex, banned, tier, used);
    // What the comparison needs to know about the exercise on the card. The
    // generated exercise carries the name it is shown under, which is not
    // always the catalogue's — grip variants and kettlebell relabelling rewrite
    // it — so the name comes from the card and the metadata from the template.
    const self = {
      name: ex.name,
      equipmentRequired: source?.equipmentRequired,
      movementPattern: source?.movementPattern,
      primaryMuscle: ex.primaryMuscle ?? source?.primaryMuscle,
    };

    /**
     * A hand-authored alternative is only kept if it is actually usable.
     *
     * This closes a hole the fill exposed rather than created. The injury
     * screen filtered the SESSION, but the alternatives hanging off each
     * exercise were never checked — so a user with knee pain could be shown a
     * screened, knee-safe session and then find "Treadmill Sprint Intervals"
     * behind the swap button. The app removed the thing and then offered it
     * back one tap later.
     */
    /**
     * ...and only if they own the kit for it.
     *
     * The same shape of hole as the injury one described above, one field
     * across. A Fire Hydrant correctly declared as bodyweight carries "Banded
     * Clamshell" as its authored swap; a Glute Bridge carries the same. Somebody
     * who ticked "No Equipment" was shown a clean bodyweight session and then
     * found band work one tap behind every exercise on it.
     *
     * The variant's own declaration wins where it has one. Where it does not,
     * the catalogue entry of the same name does, and failing both it inherits
     * the exercise it hangs off, which is the reading that was always intended.
     */
    const authoredKit = (name?: string): string | undefined => {
      if (!name) return source?.equipmentRequired;
      const lower = name.toLowerCase();
      if (source?.swapAlternative?.name === name && source.swapAlternative.equipmentRequired)
        return source.swapAlternative.equipmentRequired;
      if (source?.comfortVariant?.name === name && source.comfortVariant.equipmentRequired)
        return source.comfortVariant.equipmentRequired;
      return byName.get(lower)?.template.equipmentRequired ?? source?.equipmentRequired;
    };
    const ownsAuthored = (name?: string) => canPerformWith(authoredKit(name), [tier]);

    const authored: { name: string; cue?: string; load?: string }[] = [];
    if (
      ex.swapName &&
      ex.swapName !== ex.name &&
      // The authored CUE is passed too. An alternative written by hand carries
      // its own wording, which is frequently not the catalogue entry's, and a
      // stretch instruction lives in the sentence rather than the title -
      // "Bodyweight Good Morning" reads as a hinge until you get to "feel the
      // hamstring stretch", which is what the protocol withholds from a strain.
      restrictedTagsOn(ex.swapName, banned, undefined, ex.swapCue).length === 0 &&
      ownsAuthored(ex.swapName)
    ) {
      authored.push({ name: ex.swapName, cue: ex.swapCue, load: ex.swapLoad });
    }
    if (
      ex.swap2Name &&
      ex.swap2Name !== ex.name &&
      ex.swap2Name !== authored[0]?.name &&
      restrictedTagsOn(ex.swap2Name, banned, undefined, ex.swap2Cue).length === 0 &&
      ownsAuthored(ex.swap2Name)
    ) {
      authored.push({ name: ex.swap2Name, cue: ex.swap2Cue, load: ex.swap2Load });
    }

    let equipment: SwapOption | null = null;
    let movement: SwapOption | null = null;

    // (1) Classify what the physiotherapist already wrote. An authored option
    //     whose template is missing from the catalogue still counts — it is a
    //     considered choice — and lands in the muscle slot, which is the
    //     weaker claim of the two and so the safe place for an unknown.
    for (const option of authored) {
      const t = byName.get(option.name.toLowerCase())?.template;
      const isKit = t ? isEquipmentVariant(self, t) : false;
      const kind: SwapKind = isKit ? 'equipment' : 'movement';
      const filled: SwapOption = {
        ...option,
        kind,
        reason: swapReasonFor(
          kind,
          t ? kitOf(t.name, t.equipmentRequired) : kitOf(option.name),
          t ? muscleGroupOf(t.primaryMuscle) : muscleGroupOf(self.primaryMuscle)
        ),
      };
      if (kind === 'equipment' && !equipment) equipment = filled;
      else if (!movement) movement = filled;
    }
    for (const option of [equipment, movement]) {
      if (option) used.add(option.name.toLowerCase());
    }

    // (2) Fill whichever slot the catalogue left empty, from the index rather
    //     than by walking the catalogue. Only candidates that could possibly
    //     match are looked at, and the safety filter — the expensive part — is
    //     the LAST test applied, on the one candidate that got that far.
    const index = swapIndex();
    const firstMatch = (
      list: PickableExercise[] | undefined,
      matches: (t: ExerciseTemplate) => boolean
    ): ExerciseTemplate | undefined => {
      for (const p of rotate(list ?? [], seed + i)) {
        if (used.has(p.template.name.toLowerCase())) continue;
        if (!matches(p.template)) continue;
        if (!isUsable(p)) continue;
        return p.template;
      }
      return undefined;
    };

    const take = (option: SwapOption) => {
      used.add(option.name.toLowerCase());
      return option;
    };

    if (!equipment && source) {
      const isKit = (t: ExerciseTemplate) => isEquipmentVariant(self, t);
      const match =
        firstMatch(index.byCore.get(movementCoreOf(ex.name)), isKit) ??
        firstMatch(index.byNear.get(nearKey(self)), isKit);
      if (match) equipment = take(describe('equipment', match));
    }

    const group = source ? muscleGroupOf(self.primaryMuscle) : null;
    const inGroup = group ? index.byGroup.get(group) : undefined;
    const isSameMuscle = (t: ExerciseTemplate) => isSameMuscleAlternative(self, t);
    // Same category first. A main lift swapped for an accessory keeps the main
    // lift's sets and reps, which is how a lateral raise ends up prescribed as
    // a heavy five-by-five — so a main lift stays in its own category or goes
    // without.
    const nextSameMuscle = () =>
      firstMatch(inGroup, (t) => t.category === ex.category && isSameMuscle(t)) ??
      (ex.category === 'main'
        ? undefined
        : // Crossing block is allowed, but not into a stretch or a rehab drill.
          // Those carry the slot's sets and reps when swapped in, and a
          // Supine Spinal Twist prescribed as three sets of eight is not the
          // deadlift the user came to do.
          firstMatch(
            inGroup,
            (t) => t.category !== 'cooldown' && t.category !== 'prehab' && isSameMuscle(t)
          ));

    if (!movement) {
      const match = nextSameMuscle();
      if (match) movement = take(describe('movement', match));
    }

    // (3) Most exercises have no equipment variant at all — a Nordic curl and
    //     an inverted row have no other way to be loaded. Rather than show one
    //     option and an empty space, the slot takes a second same-muscle
    //     alternative and is labelled as one.
    const options = [equipment, movement].filter((o): o is SwapOption => o != null);
    if (options.length < SWAP_OPTIONS && inGroup) {
      const match = nextSameMuscle();
      if (match) options.push(take(describe('movement', match)));
    }

    // (4) And where the catalogue records no muscle group at all — 63 of the
    //     689 templates are 'Full body', 'Cardiovascular system' or blank — fall
    //     back to the ranking the injury screen uses, so the button still does
    //     something. Labelled as the weaker claim it is.
    if (options.length < SWAP_OPTIONS) {
      const ranked = rankedAlternatives(ex, banned, tier, used).filter((t) => t.name !== ex.name);
      for (const t of rotate(ranked, seed + i)) {
        if (options.length >= SWAP_OPTIONS) break;
        if (options.some((o) => o.name === t.name)) continue;
        options.push(take(describe('movement', t)));
      }
    }

    return {
      ...ex,
      swapName: options[0]?.name,
      swapCue: options[0]?.cue,
      swapLoad: options[0]?.load,
      swapKind: options[0]?.kind,
      swapReason: options[0]?.reason,
      swap2Name: options[1]?.name,
      swap2Cue: options[1]?.cue,
      swap2Load: options[1]?.load,
      swap2Kind: options[1]?.kind,
      swap2Reason: options[1]?.reason,
      hasSwap: options.length > 0,
    };
  });
}

export function applyInjurySafety(
  exercises: Exercise[],
  readiness: ReadinessCheck,
  tier: EquipmentTier,
  profile?: UserProfile,
  seed: number = 0,
  sessionType?: SessionType
): Exercise[] {
  if (sessionType && (SCREEN_EXEMPT_SESSION_TYPES as readonly string[]).includes(sessionType)) {
    return exercises;
  }
  const regions = readiness?.painRegion
    ? Array.isArray(readiness.painRegion)
      ? readiness.painRegion
      : [readiness.painRegion]
    : [];
  const severity = readiness?.painSeverity ?? 'mild';
  const banned = restrictedTagsFor(regions, profile?.experienceLevel, severity);
  if (banned.size === 0) return exercises;
  // What may STAY is `banned`; what the app may put there instead is stricter.
  // See substitutionRestrictedTags — the difference is the whole reason a card
  // reading "to protect your elbow" could serve a broad jump.
  const bannedForSubstitution = substitutionRestrictedTags(banned);

  const regionLabel = regions.length > 0 ? getPainRegionLabel(regions[0]) : 'injury';

  /**
   * Which sore area is responsible for THIS swap.
   *
   * The caption used the first area tapped for every card in the session, so a
   * user reporting a shoulder and then a knee got "Swapped from Squat Jump to
   * protect your front shoulder" on the knee swaps. The adaptation was right;
   * the reason printed on it was wrong, which reads as the app not having
   * understood what it was told.
   *
   * The culprit is whichever reported area actually restricts the tag that
   * caused the swap. Falls back to the first area when nothing matches, which
   * is the old behaviour and the only sensible answer at that point.
   */
  const labelForHit = (tag: StressTag | undefined): string => {
    if (regions.length <= 1 || !tag) return regionLabel;
    const culprit = regions.find((r) => (RESTRICTED_BY_REGION[r] ?? []).includes(tag));
    return getPainRegionLabel(culprit ?? regions[0]);
  };
  const usedNames = new Set(exercises.map((e) => e.name.toLowerCase()));
  const screened: Exercise[] = [];

  // Moderate and above also lose the explosive and finisher blocks. Those are
  // where an already-irritated joint gets aggravated fastest, and they are the
  // parts of a session nobody needs on a bad day.
  const dropIntensity = SEVERITY_DROPS_INTENSITY[severity] === true;
  // Severe takes a set off every working block on top of that. Without it,
  // severe and moderate were the same session to the byte.
  const setsFor = (ex: Exercise) =>
    severity === 'severe' && SET_REDUCED_CATEGORIES.includes(ex.category)
      ? Math.max(1, ex.sets - SEVERE_SET_REDUCTION)
      : ex.sets;

  exercises.forEach((ex, i) => {
    // ex.cue, not just ex.name. stressTagsFor resolves a cue from the
    // catalogue by name and names are not unique - two Dumbbell Bench Press
    // entries carry different cues, and the lookup keeps one of them. The
    // card in hand knows which one it is.
    const hits = SCREEN_EXEMPT_CATEGORIES.includes(ex.category)
      ? []
      : restrictedTagsOn(ex.name, banned, undefined, ex.cue);
    if (dropIntensity && HIGH_INTENSITY_CATEGORIES.includes(ex.category)) return;
    if (hits.length === 0) {
      screened.push(ex.sets === setsFor(ex) ? ex : { ...ex, sets: setsFor(ex) });
      return;
    }
    usedNames.delete(ex.name.toLowerCase());
    const replacement = findSafeReplacement(ex, bannedForSubstitution, tier, usedNames, seed + i);
    if (!replacement) {
      // Nothing safe to put here. Optional blocks go; anything else stays, with
      // the warning attached — silently deleting someone's main lift and saying
      // nothing is worse than showing it with a caution on it.
      if (DROPPABLE_CATEGORIES.includes(ex.category)) return;
      screened.push({
        ...ex,
        sets: setsFor(ex),
        safetyNote: `Take care with your ${labelForHit(hits[0]).toLowerCase()} here. This involves ${STRESS_TAG_LABELS[hits[0]]}`,
      });
      usedNames.add(ex.name.toLowerCase());
      return;
    }
    usedNames.add(replacement.name.toLowerCase());
    const swapped = templateToExercise(replacement, undefined, isDumbbellTier(tier));
    screened.push({
      ...swapped,
      // Keep the set count the session was built with: it has already been
      // scaled for time, energy and goals, and the replacement's own default
      // would quietly undo that.
      sets: setsFor(ex),
      // And keep the SLOT'S ROLE for the same reason. The swapped-in exercise
      // arrived with its own category, so replacing a main lift with something
      // filed as 'mechanical' silently left the session with no main lift at
      // all — no anchor to progress, and nothing for the block counter to read.
      // It showed up the moment chest pain could remove a bench press: every
      // main lift on a bench day is a chest press, so the substitute always came
      // from another category. A swap fills the slot it was called for.
      category: ex.category,
      badge: 'comfort',
      safetyNote: substitutionNote(ex.name, labelForHit(hits[0])),
      // The revert. Uses the swap slot every card already has, so "put it back"
      // costs no new UI and behaves exactly like every other swap.
      hasSwap: true,
      swapName: ex.name,
      swapCue: ex.cue,
      swapLoad: ex.suggestedLoad,
      swap2Name: undefined,
      swap2Cue: undefined,
      swap2Load: undefined,
    });
  });

  return screened;
}

function generateWorkoutUnscreened(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck,
  profile?: UserProfile,
  exerciseFeedback?: Record<string, ExerciseFeedback>,
  bestOrmKg?: number,
  strengthSessionCount: number = 0,
  lastLoggedWeights?: Record<string, number>,
  exerciseNormalStreak?: Record<string, number>,

  exerciseStuckStreak?: Record<string, number>,
  lastSessionPerformance?: Record<string, ExercisePerformance>,
  layoff?: Layoff | null,
  /** The unit the user's gym is stocked in - see personalizeLoad. */
  loadUnit: WeightUnit = 'kg'
): Exercise[] {
  if (sessionType === 'conditioning') {
    return generateConditioningWorkout(
      equipmentTier,
      readiness,
      profile,
      exerciseFeedback,
      strengthSessionCount,
      lastLoggedWeights,
      exerciseNormalStreak,

      exerciseStuckStreak,
      lastSessionPerformance,
      layoff,
      loadUnit
    );
  }
  if (sessionType === 'prehab') {
    if (readiness?.painRegion) {
      const primaryRegion = Array.isArray(readiness.painRegion)
        ? readiness.painRegion[0]
        : readiness.painRegion;

      // Targeted rehab used to return the same fixed seven exercises, in the
      // same order, every single time — so six weeks of knee rehab was the
      // identical session forty times over. Nobody sticks with that.
      //
      // The region-specific work is kept in full and kept first: it is chosen
      // for that joint and is the point of the session. What varies is the
      // order it is worked in, and a couple of extra movements rotated in.
      //
      // Those extras used to come from the standalone prehab pool unfiltered,
      // which is how an elbow session ended up with a thoracic rotation and a
      // band pull-apart in it. They now have to be aimed at the injured region,
      // and where a region has too few to fill both slots the session is simply
      // shorter — padding it with someone else's rehab is worse than ending
      // early.
      const acute = readiness.acute === true;
      /**
       * NOT equipment-filtered, and this is a deliberate exception.
       *
       * Everything else in this file now refuses to prescribe kit the user does
       * not own. These circuits are the one place that rule collides with a
       * bigger one. They are hand-authored injury protocols: a fixed warm-up,
       * the exercises chosen for that specific joint, and a cool-down, in that
       * order, and two contract tests guard both the structure and the fact that
       * every exercise picked for the joint survives.
       *
       * Filtering them broke both. Some of the knee and shoulder work is done
       * against a light band, so a bodyweight user lost part of the protocol and
       * the remaining list no longer split into its three phases.
       *
       * Dropping a rehab exercise because somebody has no band is a clinical
       * decision, and the right fix is a bodyweight alternative authored for each
       * one by a physiotherapist rather than a filter deleting it. Until those
       * exist, the protocol stays whole and this is the one place the app can
       * still name a band somebody may not have.
       */
      const regionPlan = getRegionPrehabWorkout(primaryRegion, { acute });
      const warmup = regionPlan.filter((e) => e.category === 'prep');
      const core = regionPlan.filter((e) => e.category === 'prehab');
      const cooldown = regionPlan.filter((e) => e.category === 'cooldown');

      // THE ACUTE SESSION IS NEITHER ROTATED NOR SUPPLEMENTED.
      //
      // Both are right for maintenance work done over six weeks and both are
      // wrong in the first days after a strain:
      //
      //   Rotation — the protocol is ordered gentlest first and builds through
      //     the session. Shuffling it puts the hardest movement on cold tissue.
      //   Supplements — they are drawn from the whole rehab library, which is
      //     exactly how a Pigeon Pose could find its way back into a hamstring
      //     session through the side door.
      //
      // The variety it costs is variety nobody needs here: the acute phase is
      // days, and doing the same five things each day is how you notice you are
      // getting better. The maintenance path below keeps both, unchanged.
      if (acute) return [...warmup, ...core].map((t) => templateToExercise(t));

      const seed = (strengthSessionCount ?? 0) + getLocalDayIndex();
      const rotatedCore = seededShuffleDiverse(core, seed);
      const { direct, related } = getRegionPrehabSupplements(primaryRegion);
      const supplement = [
        ...seededShuffleDiverse(direct, seed),
        ...seededShuffleDiverse(related, seed),
      ].slice(0, REHAB_SUPPLEMENT);

      return [...warmup, ...rotatedCore, ...supplement, ...cooldown].map((t) =>
        templateToExercise(t)
      );
    }
    // Standalone prehab: rotate the middle exercise pool so users see
    // fresh joint-health work across sessions rather than the same 7 each time.
    // Bookend structure: [warmup (prep)] + [7-of-13 rotated middle (prehab)] + [cooldown].
    const PICK = 7;
    const allPrehab = possibleFor(getStandalonePrehabWorkout(), equipmentTier);
    const warmup = allPrehab.filter((e) => e.category === 'prep');
    const middle = allPrehab.filter((e) => e.category === 'prehab');
    const cooldown = allPrehab.filter((e) => e.category === 'cooldown');
    const daySeed = strengthSessionCount + getLocalDayIndex();
    const rotated = seededShuffleDiverse(middle, daySeed).slice(0, PICK);
    return [...warmup, ...rotated, ...cooldown].map((t) => templateToExercise(t));
  }
  if (sessionType === 'flexibility') {
    // Rotate the middle stretch pool so users see fresh exercises across sessions.
    // Bookend structure: [warmup (prep)] + [8-of-14 rotated middle] + [cooldown bookend].
    const allFlex = possibleFor(getStandaloneFlexibilityWorkout(), equipmentTier);
    const warmup = allFlex.slice(0, 1); // Diaphragmatic Breathing (always first)
    const cooldown = allFlex.slice(-1); // Legs-Up-The-Wall (always last)
    const middle = allFlex.slice(1, -1); // 14-exercise shuffleable pool

    // Alternate between two complementary 8-exercise subsets on even vs odd days.
    // subsetA = middle[0..7], subsetB = middle[6..13] — only 2 exercises in common (indices 6–7).
    // This caps back-to-back day overlap at 2/8 (25%) vs the ~57% from random independent draws.
    // A seeded shuffle within the chosen subset still varies ordering session-to-session.
    const dayIndex = getLocalDayIndex();
    const isEvenDay = dayIndex % 2 === 0;
    const subset = isEvenDay ? middle.slice(0, 8) : middle.slice(6);
    const daySeed = (strengthSessionCount ?? 0) + dayIndex;
    const rotated = seededShuffleDiverse(subset, daySeed);
    return [...warmup, ...rotated, ...cooldown].map((t) => templateToExercise(t));
  }
  if (sessionType === 'custom') {
    return [];
  }
  if (sessionType === 'upper_body' || sessionType === 'lower_body' || sessionType === 'full_body') {
    return generateWeeklyWorkout(
      sessionType,
      equipmentTier,
      readiness,
      profile,
      exerciseFeedback,
      strengthSessionCount,
      lastLoggedWeights,
      exerciseNormalStreak,

      exerciseStuckStreak,
      lastSessionPerformance,
      layoff,
      loadUnit
    );
  }

  const mainType = sessionType as MainSessionType;
  const exercises: Exercise[] = [];
  const { hasAches, painRegion, energy, timeAvailable } = readiness;
  const finisherKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
  const { mainSetsDelta, accSetsDelta } = profile
    ? getGoalVolumeDeltas(profile.goals)
    : { mainSetsDelta: 0, accSetsDelta: 0 };

  // Shared seed for all seededShuffleDiverse calls in this session: rotates
  // by session count AND by day so exercises change even on same-day replays.
  const sessionSeed = (strengthSessionCount ?? 0) + getLocalDayIndex();

  // ── 1. Cardio Warm-Up (ALL sessions including 30 min - safety requirement) ──
  // The machine is chosen for the half of the body this session is about to
  // load rather than shuffled out of a pool that had nothing to do with it, and
  // every other machine is one tap away in the swap sheet - see
  // lib/cardio-warmup.ts. Home users keep the bodyweight warm-ups: choosing
  // between machines is not a choice they have.
  const warmupPool =
    toInternalTier(equipmentTier) === 'fullgym'
      ? cardioWarmupPoolForSession(sessionType)
      : CARDIO_WARMUPS.filter((w) => w.equipmentRequired === 'bodyweight');
  const cardioWarmup = seededShuffleDiverse(warmupPool, sessionSeed)[0] ?? CARDIO_WARMUP;
  exercises.push(templateToExercise(cardioWarmup));

  // ── 2. Pre-Training Prep ─────────────────────────────────────────────────
  //   30 min → all 3 stretches (safety warmup - never skip)
  //   45 min → first 2 stretches
  //   60 min → all 3 stretches
  const prep = seededShuffleDiverse(
    atEarnedLevel(getPrep(mainType, equipmentTier), profile),
    sessionSeed
  );
  const prepCount = timeAvailable === '45' ? 2 : 3;
  /**
   * WARM-UPS APPLY THEIR COMFORT VARIANTS TOO, AND USED NOT TO.
   *
   * This called templateToExercise directly, as the mechanical block below
   * did, while neuro, main and accessory all went through applyComfortOrBadge.
   * So 18 prep templates and all 30 mechanical templates carried a
   * hand-authored comfortVariant with triggerRegions that could never fire.
   *
   * Measured before the change by running this generator: 11,600 cards for
   * users who had reported a pain region, and not one prep or mechanical card
   * carried a comfort id. Over the same run neuro applied 100, main 280 and
   * accessory 280.
   *
   * What that cost is the exact contradiction this app exists to avoid. A user
   * with an acute front-shoulder strain was given "Shoulder CARs, full shoulder
   * range" in their warm-up, while lib/acute-rehab.ts says in as many words
   * that taking the joint to its limit in every direction is the opposite of
   * what an acute strain needs - and this entry's own unreachable comfort
   * variant was the pendulum swing that the acute protocol prescribes first.
   */
  for (const p of prep.slice(0, prepCount))
    exercises.push(applyComfortOrBadge(p, hasAches, painRegion, equipmentTier));

  // ── 3. Mechanical Priming (1 exercise for 30/45, 2 for 60) ──────────────
  // Power goal: use velocity-based drills (hip speed circles, lateral bounds,
  // speed squats/bench/good-mornings) instead of slow activation work.
  const hasPowerGoal = profile?.goals?.includes('power') ?? false;
  const mechanicalPool =
    hasPowerGoal && !hasAches
      ? getPowerMechanical(mainType, equipmentTier)
      : getMechanical(mainType, equipmentTier);
  const mechanical = seededShuffleDiverse(
    atEarnedLevel(mechanicalPool, profile),
    sessionSeed
  );
  if (timeAvailable === '60') {
    for (const m of mechanical.slice(0, 2))
      exercises.push(applyComfortOrBadge(m, hasAches, painRegion, equipmentTier));
  } else {
    exercises.push(applyComfortOrBadge(mechanical[0], hasAches, painRegion, equipmentTier));
  }

  // ── 4. Neurological Priming (45 and 60 min only) ────────────────────────
  // Power goal: use goal-specific plyometric templates (depth jumps, power
  // cleans, clap push-ups) that maximise rate-of-force development before the
  // KPI lift - not just extra sets of the generic explosive exercise.
  if (timeAvailable !== '30') {
    const neuroPool =
      hasPowerGoal && !hasAches
        ? [getPowerNeuro(mainType, equipmentTier)]
        : getNeuro(mainType, equipmentTier);
    // The power block is where the jumps live, and jumping is level 3 work
    // on the squat ladder. Somebody new to structured training was being
    // primed with lateral bounds and split squat jumps before their first
    // squat; the zero-load screen in PROGRESSION-LADDERS.md exists to stop
    // exactly that. getPowerNeuro returns a single template and is left alone
    // for the same reason the main lift is - see atEarnedLevel.
    const neuroTemplate = seededShuffleDiverse(
      atEarnedLevel(neuroPool, profile),
      sessionSeed
    )[0];
    const neuroEx = applyComfortOrBadge(neuroTemplate, hasAches, painRegion, equipmentTier);
    // Power goal: always perform 5 sets in the neuro block.
    if (hasPowerGoal && !hasAches) {
      neuroEx.sets = Math.max(neuroEx.sets, 5);
    }
    exercises.push(neuroEx);
  }

  // ── 5. KPI Lift ──────────────────────────────────────────────────────────
  const mainTemplate = getMainLift(mainType, equipmentTier);
  let baseSets = mainTemplate.sets + mainSetsDelta;
  if (timeAvailable === '30') baseSets = Math.max(baseSets - 1, 3);
  if (energy === 'low') baseSets = Math.max(baseSets - 1, 2);
  if (energy === 'high') baseSets = baseSets + 1;
  baseSets = Math.max(baseSets, 2);

  if (hasAches && shouldSwapForComfort(mainTemplate, painRegion) && mainTemplate.comfortVariant) {
    const cv = mainTemplate.comfortVariant;
    exercises.push({
      id: mainTemplate.id + '-comfort',
      name: cv.name,
      sets: baseSets,
      reps: mainTemplate.reps,
      cue: cv.cue,
      suggestedLoad: cv.suggestedLoad,
      category: 'main',
      badge: 'comfort',
      videoId: mainTemplate.videoId,
      youtubeUrl: mainTemplate.youtubeUrl,
      hasSwap: false,
      isDumbbellExercise: isDumbbellTier(equipmentTier),
      primaryMuscle: mainTemplate.primaryMuscle,
    });
  } else {
    const badge = energy !== 'normal' ? ('volume' as const) : undefined;
    const ex = templateToExercise(mainTemplate, badge, isDumbbellTier(equipmentTier));
    ex.sets = baseSets;
    exercises.push(ex);
  }

  // ── 6. Pump Accessories (1 for 30 min, 2 for 45 and 60 min) ─────────────
  // Seeded shuffle ensures accessories rotate across sessions and days so
  // users see different exercises rather than always the same first two.
  // Diversify by movement pattern so the 1-2 chosen accessories don't stack the
  // same pattern (e.g. two 'push' moves) within a single session.
  const allAccessories = seededShuffleDiverse(
    atEarnedLevel(getAccessories(mainType, equipmentTier), profile),
    sessionSeed
  );
  // Conditioning-compatible goals: fat_loss targets caloric burn; fitness builds
  // general conditioning capacity. Both benefit from a single conditioning
  // exercise that replaces the standard finisher slot.
  //  30-min + conditioning goal : 0 accessories (1 conditioning ex replaces the 1)
  //  30-min + other goals       : 1 accessory (no finisher)
  //  45/60-min + conditioning   : 1 accessory (1 conditioning ex replaces the 2nd)
  //  45/60-min + other goals    : 2 accessories + standard single finisher
  const hasConditioningGoal =
    (profile?.goals?.includes('fat_loss') || profile?.goals?.includes('fitness')) ?? false;
  const accCount =
    timeAvailable === '30' ? (hasConditioningGoal ? 0 : 1) : hasConditioningGoal ? 1 : 2;

  for (const acc of allAccessories.slice(0, accCount)) {
    const accEx = applyComfortOrBadge(acc, hasAches, painRegion, equipmentTier);
    accEx.sets = Math.max(1, Math.min(accEx.sets + accSetsDelta, 4));
    exercises.push(accEx);
  }

  // ── 7. Finisher / Goal-Conditioning Block ────────────────────────────────
  // Conditioning goals (fat_loss/fitness): inject 2-exercise conditioning
  // circuit at ALL session durations - including 30 min, where it fills the
  // slot that would otherwise have no finisher, keeping total load appropriate.
  // Other goals: standard single-exercise finisher at 45 and 60 min only
  // (30-min sessions remain tight with 1 accessory + KPI lift, no finisher).
  const finBadge = energy !== 'normal' ? ('volume' as const) : undefined;
  if (hasConditioningGoal) {
    const condBlock = getGoalConditioningBlock(
      equipmentTier,
      finisherKey,
      profile?.experienceLevel
    );
    if (__DEV__) {
      console.log(
        '[workout-engine] Conditioning block injected (goal=fat_loss|fitness, level=' +
          (profile?.experienceLevel ?? 'intermediate') +
          '):',
        condBlock.map((e) => e.name)
      );
    }
    for (const t of condBlock) exercises.push(templateToExercise(t, finBadge));
  } else if (timeAvailable !== '30') {
    const finisherPool = atEarnedLevel(
      getFinisher(mainType, equipmentTier, finisherKey),
      profile
    );
    const finisher = seededShuffleDiverse(finisherPool, sessionSeed)[0] ?? finisherPool[0];
    exercises.push(templateToExercise(finisher, finBadge));
  }

  // ── 8. Prehab / Cool-Down Stretches (45 and 60 min only) ─────────────────
  if (timeAvailable !== '30') {
    // The user told the readiness screen this area hurts, so the rehab slot in
    // their session is the acute one. It used to be PREHAB_BY_REGION[region][0]
    // — for hamstrings, a 45-second-a-side Standing Hamstring Stretch on a
    // muscle they had just reported as strained.
    const prehabTemplate = readiness?.painRegion
      ? getRegionPrehabExercise(
          Array.isArray(readiness.painRegion) ? readiness.painRegion[0] : readiness.painRegion,
          { acute: true }
        )
      : seededShuffleDiverse(getPrehab(mainType, equipmentTier), sessionSeed)[0];
    const phEx = templateToExercise(prehabTemplate);
    phEx.sets = 1;
    exercises.push(phEx);
  }

  // ── 9. Cool Down breathing (60 min only) ─────────────────────────────────
  if (timeAvailable === '60') {
    const cooldown = possibleFor(getCooldown(), equipmentTier);
    exercises.push(templateToExercise(cooldown[0]));
  }

  const isUpperBody = mainType === 'bench';
  const personalized = exercises.map((ex) =>
    applyPersonalization(
      ex,
      profile,
      isUpperBody,
      exerciseFeedback,
      bestOrmKg,
      strengthSessionCount,
      lastLoggedWeights,
      exerciseNormalStreak,

      exerciseStuckStreak,
      lastSessionPerformance,
      layoff,
      loadUnit
    )
  );
  const kettlebelled =
    equipmentTier === 'kettlebells' ? applyKettlebellNaming(personalized) : personalized;

  /**
   * Deduplicate by name, with one exception that has to come first.
   *
   * A COLLISION WITH THE REHAB SLOT IS RESOLVED IN THE REHAB SLOT'S FAVOUR.
   * Plain first-wins dedup drops whichever card was assembled later, and the
   * rehab slot is assembled after the warm-up. When comfort variants were
   * switched on for prep, a bench session for a sore shoulder started opening
   * with a Pendulum Shoulder Swing - which is precisely what the acute protocol
   * prescribes for that region - so the two collided and the acute card was the
   * one deleted. The movement survived; the card explaining what it was for,
   * and carrying the acute prescription, did not.
   *
   * The rehab slot is the point of the whole pain-adaptation path, so it wins.
   */
  const rehabNames = new Set(
    kettlebelled.filter((ex) => ex.category === 'prehab').map((ex) => ex.name.toLowerCase().trim())
  );
  const seenNames = new Set<string>();
  const deduped = kettlebelled.filter((ex) => {
    const key = ex.name.toLowerCase().trim();
    if (ex.category !== 'prehab' && rehabNames.has(key)) return false;
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  // Activation (mechanical priming) exercises are always 1 set -
  // they exist purely to prime the tissue, not accumulate volume.
  const setsEnforced = deduped.map((ex) =>
    ex.category === 'mechanical' ? { ...ex, sets: 1 } : ex
  );

  // Guarantee ordering: finisher always last, cooldown always after finisher.
  // This is a stable sort - all non-finisher/non-cooldown exercises keep their
  // relative order exactly as assembled above.
  const catOrder = (cat: string) => (cat === 'cooldown' ? 2 : cat === 'finisher' ? 1 : 0);
  return setsEnforced.sort((a, b) => catOrder(a.category) - catOrder(b.category));
}

function generateWeeklyWorkout(
  sessionType: WeeklySessionType,
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck,
  profile?: UserProfile,
  exerciseFeedback?: Record<string, ExerciseFeedback>,
  strengthSessionCount: number = 0,
  lastLoggedWeights?: Record<string, number>,
  exerciseNormalStreak?: Record<string, number>,

  exerciseStuckStreak?: Record<string, number>,
  lastSessionPerformance?: Record<string, ExercisePerformance>,
  layoff?: Layoff | null,
  /** The unit the user's gym is stocked in - see personalizeLoad. */
  loadUnit: WeightUnit = 'kg'
): Exercise[] {
  const { hasAches, painRegion, energy, timeAvailable } = readiness;
  const sessionSeed = (strengthSessionCount ?? 0) + getLocalDayIndex();
  const exercises: Exercise[] = [];

  // ── 1. Cardio Warm-Up (always) ─────────────────────────────────────────────
  // The machine is chosen for the half of the body this session is about to
  // load rather than shuffled out of a pool that had nothing to do with it, and
  // every other machine is one tap away in the swap sheet - see
  // lib/cardio-warmup.ts. Home users keep the bodyweight warm-ups: choosing
  // between machines is not a choice they have.
  const warmupPool =
    toInternalTier(equipmentTier) === 'fullgym'
      ? cardioWarmupPoolForSession(sessionType)
      : CARDIO_WARMUPS.filter((w) => w.equipmentRequired === 'bodyweight');
  const cardioWarmup = seededShuffleDiverse(warmupPool, sessionSeed)[0] ?? CARDIO_WARMUP;
  exercises.push(templateToExercise(cardioWarmup));

  // ── 2. Pre-Training Prep (active mobility) — mirrors the KPI session
  //   builder's prep step, which this function was missing: raising the heart
  //   rate isn't the same as mobilising the joints about to be loaded.
  //   45 min → 2 stretches, 30/60 min → 3. Pattern-matched the same way
  //   prehab/finisher already are below (upper→bench, lower→squat, full→deadlift).
  const prepSource: MainSessionType =
    sessionType === 'upper_body' ? 'bench' : sessionType === 'lower_body' ? 'squat' : 'deadlift';
  const prep = seededShuffleDiverse(
    atEarnedLevel(getPrep(prepSource, equipmentTier), profile),
    sessionSeed
  );
  const prepCount = timeAvailable === '45' ? 2 : 3;
  for (const p of prep.slice(0, prepCount)) exercises.push(templateToExercise(p));

  // ── 3. Main exercises — pattern-first, never drop required movements ───────
  // Pool is ordered by pattern priority so first N exercises always cover all
  // required movement patterns. Optional "bonus" exercises (beyond minRequired)
  // are seeded-shuffled for variety across sessions.
  //
  //   30 min → 3-4 main     45 min → 4-5 main     60 min → 5-6 main
  //   (full_body adds 1 extra to cover the additional pattern)
  //
  const getterFn =
    sessionType === 'lower_body'
      ? getWeeklyLowerBodyExercises
      : sessionType === 'upper_body'
        ? getWeeklyUpperBodyExercises
        : getWeeklyFullBodyExercises;

  const allMainExercises = getterFn(equipmentTier);

  // Per-type required-pattern counts (deterministic coverage guarantee):
  //   lower_body: squat + hinge + single-leg = 3 patterns (positions 1-3 in pool)
  //   upper_body: H.Push + H.Pull + V.Push + V.Pull = 4 patterns (positions 1-4 in pool)
  //   full_body:  always all 6 patterns — sets are scaled to fit time, movements are never dropped
  //               30/45 min → 2 sets per exercise; 60 min → full template sets
  //
  // Pool order is deterministic: required patterns are always taken first.
  // "Optional" extras (beyond minRequired) are seeded-shuffled for session variety.
  const minRequired = sessionType === 'upper_body' ? 4 : sessionType === 'full_body' ? 6 : 3;

  // Time-based total exercise count
  //   lower/upper: 30 min → 3–4 main   45 min → 4–5 main   60 min → 5 main
  //   full_body: always all 6 (sets scaled below to fit time)
  const baseCount =
    sessionType === 'full_body'
      ? 6 // all 6 patterns every session — volume adapted, not coverage
      : sessionType === 'upper_body'
        ? timeAvailable === '30'
          ? 4 // 4 required patterns only
          : 5 // 4 required + 1 optional extra
        : // lower_body
          timeAvailable === '30'
          ? 3
          : timeAvailable === '45'
            ? 4
            : 5;

  // Low energy: remove 1 optional extra for lower/upper; full_body never drops a movement
  const mainCount =
    sessionType === 'full_body'
      ? 6
      : energy === 'low'
        ? Math.max(baseCount - 1, minRequired)
        : baseCount;

  // Required patterns first — coverage is guaranteed and the curated choices are
  // respected. What fills the OPTIONAL slots is where variety comes from.
  //
  // Those slots used to be filled from the leftovers of the same 5-exercise
  // weekly list, which is why an upper body session was the same five movements
  // every time: with 4 required patterns out of a pool of 5 there was one
  // leftover, and often none at all. Meanwhile the KPI sessions have been
  // drawing accessories from a pool of 14-18 all along.
  //
  // The optional slots now come from that same accessory pool, mapped by
  // session type exactly as the prehab and finisher blocks below already do.
  // Coverage, curation and set structure are untouched; only the extras rotate.
  const curatedRequired = allMainExercises.slice(0, minRequired);
  const optionalCount = Math.max(0, mainCount - minRequired);
  const accessorySource: MainSessionType =
    sessionType === 'upper_body' ? 'bench' : sessionType === 'lower_body' ? 'squat' : 'deadlift';
  const widePool = [
    // The OPTIONAL half of the weekly list. The required half above is this
    // session's identity and is left exactly as curated, same reasoning as the
    // main lift: a ceiling may narrow the variety, never the session.
    ...atEarnedLevel(allMainExercises.slice(minRequired), profile),
    ...atEarnedLevel(getAccessories(accessorySource, equipmentTier), profile),
  ];

  // The main movement is resolved BEFORE anything is filtered, so nothing else
  // in the session can duplicate whichever variant it ended up as.
  const mainTemplate = allMainExercises[0];
  const rotateMain =
    mainTemplate?.swapAlternative != null &&
    MAIN_VARIATION_EVERY > 0 &&
    sessionSeed % MAIN_VARIATION_EVERY === 0;
  const resolvedMainName = rotateMain
    ? (mainTemplate.swapAlternative?.name ?? mainTemplate.name)
    : (mainTemplate?.name ?? '');

  // The REQUIRED slots rotate too, one at a time.
  //
  // Making the optional slots draw on the wide pool fixed half the problem: the
  // extras varied, but an upper body session still opened with the same bench,
  // row, press and pulldown every single time, because the required slots were
  // always positions 0..N of a hand-picked list of five.
  //
  // Each required slot now occasionally takes a different exercise OF THE SAME
  // MOVEMENT PATTERN from the wide pool — a barbell row becoming a T-bar row or
  // a seated cable row. Coverage is untouched: the substitute is only ever
  // accepted if it declares the same pattern, so the session still contains
  // exactly the movements it is supposed to.
  //
  // Staggered by slot (sessionSeed + i) rather than switching them together, so
  // a typical session has one slot varied rather than all of them — a coach
  // changing one thing at a time, not a different workout every week. Slot 0 is
  // excluded because the main lift has its own, rarer, rotation above.
  const requiredExercises = curatedRequired.map((t, i) => {
    if (i === 0 || REQUIRED_VARIATION_EVERY <= 0) return t;
    if ((sessionSeed + i) % REQUIRED_VARIATION_EVERY !== 0) return t;
    if (!t.movementPattern) return t;
    const sameMovementAlternatives = widePool.filter(
      (a) =>
        a.movementPattern === t.movementPattern &&
        // The pattern alone would let a tricep pushdown stand in for an
        // overhead press — see MUSCLE_FAMILIES.
        sameMuscleFamily(a.primaryMuscle, t.primaryMuscle) &&
        // ...and the muscle family alone still allows an isolation to take a
        // required slot: a cable front raise shares the deltoid family with an
        // overhead press, but filling the vertical-press slot with it means the
        // session contains no vertical pressing at all. secondaryMuscles
        // separates the two cleanly — compounds carry two or more (overhead
        // press 3, landmine press 3, barbell row 2), isolations carry none or
        // one (front raise 1, leg extension 0, tricep pushdown 0).
        (a.secondaryMuscles?.length ?? 0) >= MIN_COMPOUND_SECONDARIES &&
        !isSameMovement(a.name, t.name) &&
        !isSameMovement(a.name, resolvedMainName) &&
        !curatedRequired.some((r) => isSameMovement(a.name, r.name))
    );
    if (sameMovementAlternatives.length === 0) return t;
    return seededShuffleDiverse(sameMovementAlternatives, sessionSeed + i)[0];
  });

  const takenNames = [...requiredExercises.map((t) => t.name), resolvedMainName].filter(Boolean);
  const accessoryPool = widePool.filter(
    (t) => !takenNames.some((n) => isSameMovement(n, t.name))
  );
  const shuffledOptional = seededShuffleDiverse(accessoryPool, sessionSeed);
  const selectedMain = [...requiredExercises, ...shuffledOptional.slice(0, optionalCount)];

  // Scale full_body sets to fit the time budget (never drop movements):
  //   30/45 min → 2 sets each; 60 min → keep template defaults; low energy also caps at 2
  const fullBodySets =
    sessionType === 'full_body' && (timeAvailable !== '60' || energy === 'low') ? 2 : 0;

  for (let i = 0; i < selectedMain.length; i++) {
    // Occasional main-lift variation: every MAIN_VARIATION_EVERY sessions the
    // session's first movement is served by its curated alternative instead —
    // barbell bench becoming an incline or dumbbell press, say. Deliberately
    // rare rather than a shuffle: the main lift is the thing you are trying to
    // progress, and progression needs the same movement most of the time. The
    // alternative is the one already declared on the template, so it is a
    // choice someone made rather than a pattern match.
    //
    // It trains under its OWN id, which is the part that was wrong. The
    // variation used to keep the base lift's id so progression carried over —
    // which sounds right and is not. An incline bench is not a flat bench:
    // inheriting the id meant the incline was prescribed at the flat bench's
    // working weight, and then wrote its own, necessarily lighter, result back
    // over it. One id, two movements, and neither one's history was true.
    //
    // A derived id is stable across sessions, so the variation builds its own
    // progression line and the base lift's is left exactly where it was. The
    // first time it appears there is nothing to progress from, which is the
    // honest answer for a movement that has never been performed.
    const base = selectedMain[i];
    const t =
      i === 0
        ? rotateMain && base.swapAlternative
          ? { ...base, ...base.swapAlternative, id: `${base.id}${MAIN_VARIATION_ID_SUFFIX}` }
          : base
        : // Accessories additionally rotate their grip or stance where a
          // curated variant exists — see lib/grip-variants.ts. The id is kept,
          // so a wide-grip inverted row continues the base's progression rather
          // than starting a new one. Offset by the slot so two accessories in
          // the same session do not flip in lockstep.
          applyGripVariant(base, sessionSeed + i);
    const ex = applyComfortOrBadge(t, hasAches, painRegion, equipmentTier);
    // Only the first movement is the session's KPI lift; the rest are accessories
    const withCategory = i === 0 ? ex : { ...ex, category: 'accessory' as const };
    exercises.push(fullBodySets > 0 ? { ...withCategory, sets: fullBodySets } : withCategory);
  }

  // ── 4. Prehab (45 min only — 60 min uses finisher instead) ────────────────
  if (timeAvailable === '45') {
    // Same rule as the KPI path above: a named region is a sore region, so the
    // rehab slot comes from the acute protocol.
    const prehabTemplate = painRegion
      ? getRegionPrehabExercise(Array.isArray(painRegion) ? painRegion[0] : painRegion, {
          acute: true,
        })
      : seededShuffleDiverse(
          getPrehab(
            sessionType === 'upper_body'
              ? 'bench'
              : sessionType === 'full_body'
                ? 'deadlift'
                : 'squat',
            equipmentTier
          ),
          sessionSeed
        )[0];
    const phEx = templateToExercise(prehabTemplate);
    phEx.sets = 1;
    exercises.push(phEx);
  }

  // ── 5. Finisher (60 min only) ─────────────────────────────────────────────
  if (timeAvailable === '60') {
    const finisherKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
    const finisherSource: MainSessionType =
      sessionType === 'upper_body' ? 'bench' : sessionType === 'lower_body' ? 'squat' : 'deadlift';
    const finisherPool = atEarnedLevel(
      getFinisher(finisherSource, equipmentTier, finisherKey),
      profile
    );
    if (finisherPool.length > 0) {
      // Rotated on the same seed as everything else in this session. It used to
      // be finisherPool[0], so every 60-minute weekly session for the rest of
      // time ended on the same exercise — while the KPI sessions, drawing from
      // these very same pools, had been rotating theirs all along.
      const finisher = seededShuffleDiverse(finisherPool, sessionSeed)[0] ?? finisherPool[0];
      exercises.push(templateToExercise(finisher));
    }
  }

  // ── 6. Cooldown (ALL sessions — always closes with recovery) ──────────────
  const cooldownPool = possibleFor(getCooldown(), equipmentTier);
  if (cooldownPool.length > 0) {
    exercises.push(templateToExercise(cooldownPool[0]));
  }

  // Personalize loads
  const isUpperBodySession = sessionType === 'upper_body' || sessionType === 'full_body';
  const personalized = exercises.map((ex) =>
    applyPersonalization(
      ex,
      profile,
      isUpperBodySession,
      exerciseFeedback,
      undefined,
      strengthSessionCount,
      lastLoggedWeights,
      exerciseNormalStreak,

      exerciseStuckStreak,
      lastSessionPerformance,
      layoff,
      loadUnit
    )
  );

  const kettlebelled =
    equipmentTier === 'kettlebells' ? applyKettlebellNaming(personalized) : personalized;

  // Deduplicate
  const seenNames = new Set<string>();
  const deduped = kettlebelled.filter((ex) => {
    const key = ex.name.toLowerCase().trim();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  // Guarantee ordering: cooldown always last
  const catOrder = (cat: string) => (cat === 'cooldown' ? 2 : cat === 'finisher' ? 1 : 0);
  return deduped.sort((a, b) => catOrder(a.category) - catOrder(b.category));
}

function generateConditioningWorkout(
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck,
  profile?: UserProfile,
  exerciseFeedback?: Record<string, ExerciseFeedback>,
  /** Count of completed STRENGTH sessions only - see personalizeLoad. */
  strengthSessionCount: number = 0,
  lastLoggedWeights?: Record<string, number>,
  exerciseNormalStreak?: Record<string, number>,

  exerciseStuckStreak?: Record<string, number>,
  lastSessionPerformance?: Record<string, ExercisePerformance>,
  layoff?: Layoff | null,
  /** The unit the user's gym is stocked in - see personalizeLoad. */
  loadUnit: WeightUnit = 'kg'
): Exercise[] {
  const { energy, timeAvailable } = readiness;
  const energyKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
  const templates = possibleFor(getConditioningWorkout(equipmentTier, energyKey), equipmentTier);

  // Insert active mobility stretches right after the cardio warm-up (always
  // templates[0] in this pool) — raising the heart rate isn't the same as
  // mobilising the joints about to be loaded, and this pool was missing that
  // step entirely. Same 45min→2 / else→3 scaling used by the other builders.
  const prepCount = timeAvailable === '45' ? 2 : 3;
  const sessionSeed = (strengthSessionCount ?? 0) + getLocalDayIndex();
  const prepTemplates = seededShuffleDiverse(getPrep('squat', equipmentTier), sessionSeed).slice(
    0,
    prepCount
  );
  // The work block rotates, like every other session builder's does. This one
  // took its list verbatim, which made a conditioning session byte-identical
  // every day, forever, at every equipment tier and energy level — the only
  // thing that ever moved was the order of the stretches spliced in above.
  //
  // The slots whose position carries meaning keep it: the warm-up opens, the
  // finisher is the last hard effort, the cooldown closes. Only the circuits
  // between them move.
  //
  // Worth being straight about the ceiling. The database holds exactly ONE
  // prescribed circuit per tier and energy level, so what changes day to day is
  // the order of two or three efforts, not which efforts they are. Rotation was
  // the engine half of this defect; the other half is more entries in
  // CONDITIONING_WORKOUTS, and that is lib/exercise-db.ts.
  const rest = templates.slice(1);
  const finisher = rest.filter((t) => t.category === 'finisher');
  const cooldown = rest.filter((t) => t.category === 'cooldown');
  const work = seededShuffleDiverse(
    rest.filter((t) => t.category !== 'finisher' && t.category !== 'cooldown'),
    sessionSeed
  );
  const withPrep =
    templates.length > 0
      ? [templates[0], ...prepTemplates, ...work, ...finisher, ...cooldown]
      : templates;

  const personalized = withPrep.map((t) =>
    applyPersonalization(
      templateToExercise(t),
      profile,
      false,
      exerciseFeedback,
      undefined,
      strengthSessionCount,
      lastLoggedWeights,
      exerciseNormalStreak,

      exerciseStuckStreak,
      lastSessionPerformance,
      layoff,
      loadUnit
    )
  );
  return equipmentTier === 'kettlebells' ? applyKettlebellNaming(personalized) : personalized;
}

/** Share of the ramp-up's top set each warm-up set should use, by set count. */
const RAMP_FRACTIONS: Record<number, number[]> = {
  1: [0.6],
  2: [0.5, 0.75],
  3: [0.5, 0.7, 0.85],
  4: [0.4, 0.6, 0.75, 0.85],
  5: [0.4, 0.55, 0.7, 0.8, 0.9],
};

/**
 * The 1RM test protocol, with loads worked out from what the user has actually
 * been lifting.
 *
 * Previously this just mapped templates straight through, so the ramp-up said
 * "Ramp up" and the test set said "~90% of working weight" — no numbers
 * anywhere. Every weight had to be worked out and typed by hand, in the middle
 * of the session that matters most, and the guide that did appear was garbage
 * (see the percent-stripping note in getWeightGuideKg).
 *
 * `testKg` is the weight to put on the bar for the all-out set - work it out
 * with `testLoadFromWorkingWeight`, which anchors it to the user's estimated
 * one-rep max rather than to their goal-scaled working weight. It used to be a
 * working weight that this function then took 90% of, which is what made the
 * test unfair to every goal except strength and power; see
 * TEST_LOAD_FRACTION_OF_ORM for the full story. Passing nothing keeps the old
 * generic copy, the right fallback for someone with no history on the lift.
 */
export function generate1RMWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  _strengthSessionCount: number = 0,
  testKg?: number,
  /** The unit the user's gym is stocked in - see personalizeLoad. */
  loadUnit: WeightUnit = 'kg'
): Exercise[] {
  if (sessionType === 'conditioning' || sessionType === 'custom') return [];
  const protocol = possibleFor(get1RMProtocol(sessionType as MainSessionType, equipmentTier), equipmentTier);
  let exercises = protocol.map((t) => templateToExercise(t));

  const toGrid = (v: number) => roundToLoadable(v, loadUnit);
  const bodyweightTier = equipmentTier === 'bodyweight' || equipmentTier === 'bands';

  // Plain language first, for every tier. "AMRAP @ 90%" is gym shorthand that
  // meant nothing to the person actually taking the test.
  exercises = exercises.map((e) => {
    if (e.category !== 'main') return e;
    const base = e.name.replace(/\s*AMRAP(\s*@\s*\d+\s*%)?/i, '').trim();
    const eachSide = /each side/i.test(e.reps);
    return {
      ...e,
      name: `${base}: Max Reps Test`,
      reps: eachSide ? 'Max clean reps each side' : 'Max clean reps',
    };
  });

  if (testKg && testKg > 0 && !bodyweightTier) {
    const topKg = toGrid(testKg);
    // `suggestedLoad` stays in kilograms because that is the unit every reader
    // of it expects (parseLoadKg, convertLoadString at render). The CUE is
    // prose nothing parses, and it is the sentence the user actually follows,
    // so it is written in the unit they train in.
    const say = (kg: number) => `${kgToDisplayUnit(kg, loadUnit)} ${loadUnit}`;
    exercises = exercises.map((e) => {
      if (e.category === 'main') {
        return {
          ...e,
          suggestedLoad: `${topKg} kg`,
          loadKg: [topKg],
          cue: `Load ${say(topKg)} and do as many clean reps as you can. Around ${TEST_EXPECTED_REPS} means you are exactly where the app thinks you are, so there is no target to beat. Just be honest, and stop the moment form slips: that last ugly rep does not count and is where people get hurt. Your one-rep max is worked out from the weight and how many reps you managed.`,
        };
      }
      if (e.category === 'prep') {
        const fractions = RAMP_FRACTIONS[e.sets] ?? RAMP_FRACTIONS[4];
        const ladder = fractions.map((f) => toGrid(topKg * f));
        return {
          ...e,
          suggestedLoad: `${ladder.join(' / ')} kg`,
          loadKg: ladder,
          cue: `Work up to the test weight: ${ladder.map(say).join(', ')}. These are warm-ups, not work sets, so stop each one well short of hard.`,
        };
      }
      return e;
    });
  }

  return equipmentTier === 'kettlebells' ? applyKettlebellNaming(exercises) : exercises;
}

/**
 * The real KPI-lift exercise ID (e.g. 'sq-main-fg') a normal session for
 * this type/tier would suggest - as opposed to the different ID a 1RM-test
 * protocol uses for the same lift. Lets a test-week completion write its
 * result to the ID that lastLoggedWeights lookups will actually hit next
 * time, instead of the test's own exercise ID (which normal sessions never
 * read from). Null for session types that don't have a single KPI lift.
 */
export function getMainLiftExerciseId(
  sessionType: SessionType,
  equipmentTier: EquipmentTier
): string | null {
  if (
    sessionType === 'conditioning' ||
    sessionType === 'custom' ||
    sessionType === 'prehab' ||
    sessionType === 'flexibility' ||
    sessionType === 'upper_body' ||
    sessionType === 'lower_body' ||
    sessionType === 'full_body'
  ) {
    return null;
  }
  return getMainLift(sessionType as MainSessionType, equipmentTier).id;
}

/**
 * Numeric rest-timer defaults per category, in seconds.
 *
 * Single source of truth shared with `getRestPeriod` (the verbal copy below)
 * and consumed by the in-session `RestTimer` countdown widget. Categories
 * that should NOT auto-start a countdown (prep stretches flow continuously,
 * the conditioning finisher is meant to keep moving, cooldown is breathing)
 * are intentionally absent - `RestTimer` renders nothing when the lookup
 * misses.
 */
export const REST_PERIOD_SECONDS: Partial<Record<ExerciseCategory, number>> = {
  main: 150, // 2–3 min → midpoint
  accessory: 75, // 60–90 s → midpoint
  neuro: 60, // 45–60 s
  mechanical: 45, // 30–45 s
  prehab: 35, // 30–45 s
};

export function getRestPeriod(category: ExerciseCategory): string {
  switch (category) {
    case 'prep':
      return 'Move between exercises without rest - breathe into each stretch';
    case 'mechanical':
      return 'Rest 30-45 sec between sets';
    case 'neuro':
      return 'Rest 45-60 sec between sets - full recovery before each';
    case 'main':
      return 'Rest 2-3 min between sets - full recovery is key';
    case 'accessory':
      return 'Rest 60-90 sec between sets';
    case 'prehab':
      return 'Rest 30-45 sec between sets';
    case 'finisher':
      return 'Rest only if you need to - keep moving';
    case 'cooldown':
      return 'Breathe slowly - no rest needed';
    default:
      return 'Rest as needed';
  }
}

export function getWeightGuide(
  category: ExerciseCategory,
  sets: number,
  weightUnit: 'kg' | 'lbs' = 'kg',
  suggestedLoad?: string
): string[] {
  const unit = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // Try to extract the target weight number from the personalised load string
  let targetKg: number | null = null;
  if (suggestedLoad) {
    const numMatch = suggestedLoad.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) targetKg = parseFloat(numMatch[1]);
  }

  // `suggestedLoad` is kilograms. This used to print its numbers unconverted
  // and then label them "lbs", so a pounds user was told to warm up at half a
  // weight in the wrong unit.
  const say = (kg: number) => kgToDisplayUnit(roundToLoadable(kg, unit), unit);
  const target = targetKg === null ? null : kgToDisplayUnit(toLoadableForUnit(targetKg, unit), unit);

  const w = (pct: number): string => {
    if (targetKg === null) return '';
    return ` (~${say(targetKg * pct)} ${unit})`;
  };

  if (category === 'main') {
    if (sets <= 3)
      return [
        `Set 1: Light warm-up${w(0.5)} - easy, just feel the pattern`,
        `Set 2: Build up${w(0.7)} - approaching working weight`,
        `Set 3: Working weight${target !== null ? ` (${target} ${unit})` : ''} - challenging but fully controlled`,
      ];
    if (sets === 4)
      return [
        `Set 1: Light warm-up${w(0.5)} - easy, just feel the pattern`,
        `Set 2: Build up${w(0.65)} - getting into position`,
        `Set 3: Approach set${w(0.875)} - close to working weight, stay sharp`,
        `Set 4: Working weight${target !== null ? ` (${target} ${unit})` : ''} - your one quality set`,
      ];
    // 5+ sets: ramp progressively; penultimate set is always ~87.5%, final set is working weight
    const rampGuides: string[] = [
      `Set 1: Very light warm-up${w(0.4)} - just waking up the pattern`,
      `Set 2: Build up${w(0.55)} - comfortable, focus on form`,
    ];
    // Middle sets ramp from 70% up to ~75% (before the fixed penultimate ~87.5%)
    const middleCount = sets - 4; // sets after Set 2 and before penultimate and final
    for (let i = 0; i < middleCount; i++) {
      const pct = 0.7 + 0.05 * i;
      rampGuides.push(`Set ${i + 3}: Getting close${w(Math.min(pct, 0.8))} - building confidence`);
    }
    // Penultimate set: always ~87.5%
    rampGuides.push(
      `Set ${sets - 1}: Approach set${w(0.875)} - close to working weight, stay sharp`
    );
    // Final set: working weight
    rampGuides.push(
      `Set ${sets}: Working weight${target !== null ? ` (${target} ${unit})` : ''} - your one quality set, full control`
    );
    return rampGuides;
  }
  if (category === 'accessory') {
    return Array.from({ length: sets }, (_, i) =>
      i === 0
        ? 'Set 1: Start at a comfortable weight - nail the technique first'
        : i === sets - 1
          ? `Set ${i + 1}: Match or add ${weightUnit === 'lbs' ? '5 lbs' : '2 kg'} if the previous set felt easy`
          : `Set ${i + 1}: Keep the same weight or increase slightly if form is solid`
    );
  }
  return [];
}

/**
 * Returns the recommended numeric kg for each set, mirroring the percentage
 * ramps used by `getWeightGuide`. Used to pre-fill weight inputs in the
 * session screen so users don't have to type in the recommended value.
 *
 * Returns 0 for sets with no numeric recommendation (band/bodyweight exercises
 * or categories where no specific weight is prescribed).
 */
export function getWeightGuideKg(
  category: ExerciseCategory,
  sets: number,
  suggestedLoad?: string,
  /** The unit the user's gym is stocked in - see personalizeLoad. */
  loadUnit: WeightUnit = 'kg'
): number[] {
  return expandSetTargets(category, sets, parseLoadKg(suggestedLoad), loadUnit);
}

/**
 * Every weight expressed in a load string, in order, in kg.
 *
 * This is the ONLY place a prescribed weight is recovered from prose, and it
 * exists purely as a fallback for loads that come straight from the exercise
 * database. Anything the engine computes carries `Exercise.targetKg` instead,
 * so its numbers never round-trip through English.
 *
 * Percentages are stripped first. "~90% of working weight" used to parse as
 * 90 kg and then get halved by the ramp, so the 1RM test set offered a 45 kg
 * guide that came from a percent sign.
 */
export function parseLoadKg(suggestedLoad?: string): number[] {
  const text = suggestedLoad?.replace(/\d+(?:\.\d+)?\s*%/g, '') ?? '';
  const numbers = (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
  return statesLadder(text) ? numbers : numbers.slice(0, 1);
}

/**
 * Whether a load names a weight per set rather than a single working weight.
 *
 * Ladders are written with slashes — "80/60/40 kg" in the database, and the
 * 1RM ramp builds its own the same way. Every other load carrying more than one
 * number is a range ("30-47.5 kg") or two implements ("14-18 kg KB, 12-16 kg
 * per hand goblet"), and neither of those states a progression. Telling them
 * apart matters because a two-number load and a two-set exercise otherwise look
 * identical to `expandSetTargets`, which then prescribed the bottom of a range
 * as the warm-up for the top of it.
 */
function statesLadder(text: string): boolean {
  return /\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?/.test(text);
}

/**
 * Turn the prescribed weight(s) for an exercise into one target per set.
 *
 * `numbers` is either an explicit per-set ladder (a ramp-up naming each set) or
 * a working weight the ramp is derived from. Categories that carry no barbell
 * load get zeros, which the UI reads as "no guide".
 */
export function expandSetTargets(
  category: ExerciseCategory,
  sets: number,
  numbers: number[],
  /** The unit the user's gym is stocked in - see personalizeLoad. */
  loadUnit: WeightUnit = 'kg'
): number[] {
  const toGrid = (v: number) => roundToLoadable(v, loadUnit);
  // Numbers that arrive already rounded - a stated ladder, a working weight the
  // engine computed - only need regridding when they are about to be read in a
  // unit they were not rounded in. `toLoadableForUnit` is identity in kg, so a
  // load the database wrote as "12 kg" still reads as 12 kg.
  const asGiven = (v: number) => toLoadableForUnit(v, loadUnit);

  // An explicit ladder wins: the protocol has already stated each set.
  if (numbers.length === sets && sets > 1) return numbers.map(asGiven);
  if (numbers.length === 0) return Array(sets).fill(0);

  // Otherwise the single value is the working weight the ramp is built from.
  // A range ("8-12 kg per hand", "40-60 kg") has already been reduced to its
  // bottom by the time it gets here — the app has always prescribed the bottom
  // of the range, and taking the top would quietly add load to a third of the
  // catalogue.
  const targetKg = asGiven(numbers[0]);
  const w = (pct: number) => toGrid(targetKg * pct);

  if (category === 'main') {
    // Return exactly `sets` entries. This used to hand back three regardless,
    // so a single-set exercise took entry [0] — half the target weight.
    if (sets === 1) return [targetKg];
    if (sets === 2) return [w(0.7), targetKg];
    if (sets === 3) return [w(0.5), w(0.7), targetKg];
    if (sets === 4) return [w(0.5), w(0.65), w(0.875), targetKg];
    const result: number[] = [w(0.4), w(0.55)];
    const middleCount = sets - 4;
    for (let i = 0; i < middleCount; i++) {
      result.push(w(Math.min(0.7 + 0.05 * i, 0.8)));
    }
    result.push(w(0.875));
    result.push(targetKg);
    return result;
  }
  if (category === 'accessory') {
    return Array(sets).fill(targetKg);
  }
  return Array(sets).fill(0);
}

/**
 * Applies a stored "too easy" multiplier to a personalised load string.
 * Used by the post-session feedback flow to adjust future session weights.
 */
export function applyFeedbackMultiplier(load: string, multiplier: number): string {
  if (multiplier === 1 || !/\d/.test(load)) return load;
  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);
  return load.replace(/\d+(?:\.\d+)?/g, (match) => {
    const num = parseFloat(match);
    if (num <= 0) return match;
    return String(roundTo2_5(num * multiplier));
  });
}

export function getSessionLabel(type: SessionType): string {
  switch (type) {
    case 'squat':
      return 'Squat Session';
    case 'bench':
      return 'Bench Session';
    case 'deadlift':
      return 'Deadlift Session';
    case 'upper_body':
      return 'Upper Body';
    case 'lower_body':
      return 'Lower Body';
    case 'full_body':
      return 'Full Body';
    case 'conditioning':
      return 'Conditioning';
    case 'prehab':
      return 'Prehab';
    case 'flexibility':
      return 'Flexibility';
    case 'custom':
      return 'Custom Session';
  }
}

export function getSessionSubtitle(type: SessionType): string {
  switch (type) {
    case 'squat':
      return 'KPI lift - quads, glutes, hamstrings';
    case 'bench':
      return 'KPI lift - chest, shoulders, triceps';
    case 'deadlift':
      return 'KPI lift - hinge, posterior chain, back';
    case 'upper_body':
      return 'Push & pull - full upper coverage';
    case 'lower_body':
      return 'Squat, hinge & lunge - full leg coverage';
    case 'full_body':
      return '6 movement patterns - complete session';
    case 'conditioning':
      return 'Fat burn - high calorie, cardio focus';
    case 'prehab':
      return 'Joint health - full body injury prevention circuit';
    case 'flexibility':
      return 'Stretch & mobility - full body long holds';
    case 'custom':
      return 'Your hand-picked exercise selection';
  }
}

export function getSessionIcon(type: SessionType): string {
  switch (type) {
    case 'squat':
      return 'fitness';
    case 'bench':
      return 'body';
    case 'deadlift':
      return 'barbell';
    case 'upper_body':
      return 'barbell';
    case 'lower_body':
      return 'walk';
    case 'full_body':
      return 'fitness';
    case 'conditioning':
      return 'flame';
    case 'prehab':
      return 'shield-checkmark';
    case 'flexibility':
      return 'leaf';
    case 'custom':
      return 'create';
  }
}

export function getEquipmentLabel(tier: EquipmentTier): string {
  switch (tier) {
    case 'bodyweight':
      return 'No Equipment';
    case 'bands':
      return 'Resistance Bands';
    case 'dumbbells':
      return 'Dumbbells';
    case 'kettlebells':
      return 'Kettlebells';
    case 'fullgym':
      return 'Full Gym';
  }
}

export function getEquipmentIcon(tier: EquipmentTier): string {
  switch (tier) {
    case 'bodyweight':
      return 'person-outline';
    case 'bands':
      return 'git-compare-outline';
    case 'dumbbells':
      return 'barbell-outline';
    case 'kettlebells':
      return 'barbell-outline';
    case 'fullgym':
      return 'barbell-outline';
  }
}

export function getPainRegionLabel(region: PainRegion): string {
  const labels: Record<PainRegion, string> = {
    front_shoulder: 'Front Shoulder',
    rear_shoulder: 'Rear Shoulder',
    elbow: 'Elbow',
    wrist: 'Wrist',
    neck: 'Neck',
    lower_back: 'Lower Back',
    upper_back: 'Upper Back',
    core_ribs: 'Core / Ribs',
    knee: 'Knee',
    hip_groin: 'Hip / Groin',
    ankle_achilles: 'Ankle / Achilles',
    calf_shin: 'Calf / Shin',
    chest: 'Chest',
    bicep: 'Bicep / Front Arm',
    tricep: 'Tricep / Back Arm',
    quads: 'Quads (Front Thigh)',
    hamstrings: 'Hamstrings (Back Thigh)',
    glutes: 'Glutes',
    lat_mid_back: 'Lat / Mid Back',
  };
  return labels[region];
}

export function getEffectiveTier(tiers: EquipmentTier[]): EquipmentTier {
  const TIER_ORDER: EquipmentTier[] = [
    'bodyweight',
    'bands',
    'dumbbells',
    'kettlebells',
    'fullgym',
  ];
  if (!tiers || tiers.length === 0) return 'bodyweight';
  let bestIdx = 0;
  for (const t of tiers) {
    const idx = TIER_ORDER.indexOf(t);
    if (idx > bestIdx) bestIdx = idx;
  }
  return TIER_ORDER[bestIdx];
}
