import {
  EquipmentTier,
  EnergyLevel,
  ExerciseFeedback,
  ExercisePerformance,
  FitnessGoal,
  PainRegion,
  SessionType,
  TimeAvailable,
  UserProfile,
} from './store';
import {
  ExerciseCategory,
  ExerciseTemplate,
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
  getRegionPrehabExercise,
  getGoalConditioningBlock,
  getWeeklyLowerBodyExercises,
  getWeeklyUpperBodyExercises,
  getWeeklyFullBodyExercises,
} from './exercise-db';
import { applyGripVariant } from './grip-variants';

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
  hasSwap: boolean;
  swapName?: string;
  swapCue?: string;
  swapLoad?: string;
  swap2Name?: string;
  swap2Cue?: string;
  swap2Load?: string;
  isDumbbellExercise?: boolean;
  /** Surface a contextual note in the session UI when load was derived from last session data. */
  progressionNote?: string;
  /** Whether progressionNote describes a step up or a hold - drives which icon the UI shows. */
  progressionDirection?: 'up' | 'hold';
  /** Marks a custom-session cardio exercise; shows duration/speed inputs instead of weight/reps. */
  type?: 'cardio';
}

interface ReadinessCheck {
  hasAches: boolean;
  painRegion?: PainRegion | PainRegion[];
  energy: EnergyLevel;
  timeAvailable: TimeAvailable;
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

/** How many rotating general joint-health movements a targeted rehab session
 *  picks up alongside its region-specific core. Keeps the total in line with the
 *  seven the standalone prehab session already prescribes. */
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
    hasSwap: !!swap1,
    swapName: swap1?.name,
    swapCue: swap1?.cue,
    swapLoad: swap1?.suggestedLoad,
    swap2Name: swap2?.name,
    swap2Cue: swap2?.cue,
    swap2Load: swap2?.suggestedLoad,
    isDumbbellExercise: isDumbbell,
  };
}

function isDumbbellTier(tier: EquipmentTier): boolean {
  return tier === 'dumbbells' || tier === 'kettlebells';
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
export function workingWeightFromOrm(ormKg: number, profile: UserProfile): number {
  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);
  const goalPct: Record<string, number> = {
    strength: 0.85,
    muscle: 0.75,
    fat_loss: 0.65,
    fitness: 0.7,
    rehab: 0.5,
    power: 0.9,
  };
  const activeGoals = profile.goals?.length ? profile.goals : ['fitness' as FitnessGoal];
  const avgPct = activeGoals.reduce((sum, g) => sum + (goalPct[g] ?? 0.7), 0) / activeGoals.length;
  return roundTo2_5(ormKg * avgPct);
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
 * Numeric values are rounded to the nearest 2.5 kg with a minimum of 2.5 kg.
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
  lastSessionPerformance?: Record<string, ExercisePerformance>
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

  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);
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

  // ── Per-exercise progression: lastLoggedWeight + step per session ────────
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
  if (lastKg > 0) {
    const performance = exerciseId ? lastSessionPerformance?.[exerciseId] : undefined;
    if (performance === 'failed') {
      // Incomplete sets or thumbs-down - hold at same weight
      if (__DEV__) {
        console.log(
          `[personalizeLoad] exId=${exerciseId} HOLDING at ${lastKg}kg (performance=failed)`
        );
      }
      return computed(lastKg);
    }
    // No-feedback streak: consecutive sessions this exercise was logged without
    // any explicit feedback (thumbs / tooEasy). Maintained per-exercise in the
    // store so it resets to 0 precisely when feedback is received for *this*
    // exercise, not based on unrelated global session count changes.
    const normalStreak = exerciseId ? (exerciseNormalStreak?.[exerciseId] ?? 0) : 0;
    const step =
      performance === 'very_easy' ? 7.5 : performance === 'easy' || normalStreak >= 3 ? 5 : 2.5;
    // Apply exact additive step (hold / +2.5 / +5 / +7.5) as specified.
    // feedbackMult is NOT applied on top - it is only used in the heuristic
    // path below (when there is no previous logged weight to anchor from).
    const progressedKg = roundTo2_5(lastKg + step);
    if (__DEV__) {
      console.log(
        `[personalizeLoad] exId=${exerciseId} lastKg=${lastKg} perf=${performance} normalStreak=${normalStreak} +${step} → ${progressedKg}kg`
      );
    }
    return computed(progressedKg);
  }

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
    const targetKg = roundTo2_5(workingWeightFromOrm(ormKg, profile) * combinedMult);
    return computed(targetKg);
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
  const sexFactor =
    profile.sex === 'female'
      ? isUpperBodySession
        ? 0.55
        : 0.72
      : profile.sex === 'other'
        ? 0.85
        : 1.0;

  const activeGoals = profile.goals?.length ? profile.goals : ['fitness' as FitnessGoal];
  const avgGoalFactor =
    activeGoals.reduce((sum, g) => sum + (goalFactor[g] ?? 1.0), 0) / activeGoals.length;

  const scale = bwRatio * (expFactor[profile.experienceLevel] ?? 0.7) * avgGoalFactor * sexFactor;

  // Scales every weight in the string, so a ladder like "8 / 14 / 20 kg" stays
  // a ladder. The scaled values are collected as we go rather than re-parsed
  // out of the result — that round trip is exactly what this removes.
  const scaled: number[] = [];
  const text = rawLoad.replace(/\d+(?:\.\d+)?/g, (match) => {
    const num = parseFloat(match);
    if (num <= 0) return match;
    const kg = roundTo2_5(num * scale * combinedMult);
    scaled.push(kg);
    return String(kg);
  });
  return { text, kg: scaled.length > 0 ? scaled : null };
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
  if (hasAches && shouldSwapForComfort(template, painRegion) && template.comfortVariant) {
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
      hasSwap: false,
      isDumbbellExercise: isDumbbell,
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

function relabelLoadForKettlebell(load: string): string {
  const labelled = relabelForKettlebell(load);
  return labelled.replace(/\d+(?:\.\d+)?/g, (match) => {
    const num = parseFloat(match);
    if (num > 100) return match;
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
  lastSessionPerformance?: Record<string, ExercisePerformance>
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
  if (lastKg > 0) {
    const performance = ex.id ? lastSessionPerformance?.[ex.id] : undefined;
    const normalStreak = ex.id ? (exerciseNormalStreak?.[ex.id] ?? 0) : 0;
    if (performance === 'failed') {
      const ratedDown = ex.id ? exerciseFeedback?.[ex.id]?.thumbs === 'down' : false;
      progressionNote = ratedDown
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
      lastSessionPerformance
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
  lastSessionPerformance?: Record<string, ExercisePerformance>
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
      lastSessionPerformance
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
      // order it is worked in, and a couple of general joint-health movements
      // rotated in from the standalone prehab pool — the same supplement the
      // standalone session already draws on, at the same dosage it already
      // uses.
      const regionPlan = getRegionPrehabWorkout(primaryRegion);
      const warmup = regionPlan.filter((e) => e.category === 'prep');
      const core = regionPlan.filter((e) => e.category === 'prehab');
      const cooldown = regionPlan.filter((e) => e.category === 'cooldown');

      const seed = (strengthSessionCount ?? 0) + getLocalDayIndex();
      const rotatedCore = seededShuffleDiverse(core, seed);
      const supplementPool = getStandalonePrehabWorkout()
        .filter((e) => e.category === 'prehab')
        .filter((e) => !core.some((c) => c.name === e.name));
      const supplement = seededShuffleDiverse(supplementPool, seed).slice(0, REHAB_SUPPLEMENT);

      return [...warmup, ...rotatedCore, ...supplement, ...cooldown].map((t) =>
        templateToExercise(t)
      );
    }
    // Standalone prehab: rotate the middle exercise pool so users see
    // fresh joint-health work across sessions rather than the same 7 each time.
    // Bookend structure: [warmup (prep)] + [7-of-13 rotated middle (prehab)] + [cooldown].
    const PICK = 7;
    const allPrehab = getStandalonePrehabWorkout();
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
    const allFlex = getStandaloneFlexibilityWorkout();
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
      lastSessionPerformance
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
  const warmupPool =
    toInternalTier(equipmentTier) === 'fullgym'
      ? CARDIO_WARMUPS
      : CARDIO_WARMUPS.filter((w) => w.equipmentRequired === 'bodyweight');
  const cardioWarmup = seededShuffleDiverse(warmupPool, sessionSeed)[0] ?? CARDIO_WARMUP;
  exercises.push(templateToExercise(cardioWarmup));

  // ── 2. Pre-Training Prep ─────────────────────────────────────────────────
  //   30 min → all 3 stretches (safety warmup - never skip)
  //   45 min → first 2 stretches
  //   60 min → all 3 stretches
  const prep = seededShuffleDiverse(getPrep(mainType, equipmentTier), sessionSeed);
  const prepCount = timeAvailable === '45' ? 2 : 3;
  for (const p of prep.slice(0, prepCount)) exercises.push(templateToExercise(p));

  // ── 3. Mechanical Priming (1 exercise for 30/45, 2 for 60) ──────────────
  // Power goal: use velocity-based drills (hip speed circles, lateral bounds,
  // speed squats/bench/good-mornings) instead of slow activation work.
  const hasPowerGoal = profile?.goals?.includes('power') ?? false;
  const mechanicalPool =
    hasPowerGoal && !hasAches
      ? getPowerMechanical(mainType, equipmentTier)
      : getMechanical(mainType, equipmentTier);
  const mechanical = seededShuffleDiverse(mechanicalPool, sessionSeed);
  if (timeAvailable === '60') {
    for (const m of mechanical.slice(0, 2))
      exercises.push(templateToExercise(m, undefined, isDumbbellTier(equipmentTier)));
  } else {
    exercises.push(templateToExercise(mechanical[0], undefined, isDumbbellTier(equipmentTier)));
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
    const neuroTemplate = seededShuffleDiverse(neuroPool, sessionSeed)[0];
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
      hasSwap: false,
      isDumbbellExercise: isDumbbellTier(equipmentTier),
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
  const allAccessories = seededShuffleDiverse(getAccessories(mainType, equipmentTier), sessionSeed);
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
    const finisherPool = getFinisher(mainType, equipmentTier, finisherKey);
    const finisher = seededShuffleDiverse(finisherPool, sessionSeed)[0] ?? finisherPool[0];
    exercises.push(templateToExercise(finisher, finBadge));
  }

  // ── 8. Prehab / Cool-Down Stretches (45 and 60 min only) ─────────────────
  if (timeAvailable !== '30') {
    const prehabTemplate = readiness?.painRegion
      ? getRegionPrehabExercise(
          Array.isArray(readiness.painRegion) ? readiness.painRegion[0] : readiness.painRegion
        )
      : seededShuffleDiverse(getPrehab(mainType, equipmentTier), sessionSeed)[0];
    const phEx = templateToExercise(prehabTemplate);
    phEx.sets = 1;
    exercises.push(phEx);
  }

  // ── 9. Cool Down breathing (60 min only) ─────────────────────────────────
  if (timeAvailable === '60') {
    const cooldown = getCooldown();
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
      lastSessionPerformance
    )
  );
  const kettlebelled =
    equipmentTier === 'kettlebells' ? applyKettlebellNaming(personalized) : personalized;

  // Deduplicate: remove any exercise whose name (case-insensitive) has already appeared
  const seenNames = new Set<string>();
  const deduped = kettlebelled.filter((ex) => {
    const key = ex.name.toLowerCase().trim();
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
  lastSessionPerformance?: Record<string, ExercisePerformance>
): Exercise[] {
  const { hasAches, painRegion, energy, timeAvailable } = readiness;
  const sessionSeed = (strengthSessionCount ?? 0) + getLocalDayIndex();
  const exercises: Exercise[] = [];

  // ── 1. Cardio Warm-Up (always) ─────────────────────────────────────────────
  const warmupPool =
    toInternalTier(equipmentTier) === 'fullgym'
      ? CARDIO_WARMUPS
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
  const prep = seededShuffleDiverse(getPrep(prepSource, equipmentTier), sessionSeed);
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
    ...allMainExercises.slice(minRequired),
    ...getAccessories(accessorySource, equipmentTier),
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
    const base = selectedMain[i];
    const t =
      i === 0
        ? rotateMain && base.swapAlternative
          ? { ...base, ...base.swapAlternative, id: base.id }
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
    const prehabTemplate = painRegion
      ? getRegionPrehabExercise(Array.isArray(painRegion) ? painRegion[0] : painRegion)
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
    const finisherPool = getFinisher(finisherSource, equipmentTier, finisherKey);
    if (finisherPool.length > 0) {
      exercises.push(templateToExercise(finisherPool[0]));
    }
  }

  // ── 6. Cooldown (ALL sessions — always closes with recovery) ──────────────
  const cooldownPool = getCooldown();
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
      lastSessionPerformance
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
  lastSessionPerformance?: Record<string, ExercisePerformance>
): Exercise[] {
  const { energy, timeAvailable } = readiness;
  const energyKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
  const templates = getConditioningWorkout(equipmentTier, energyKey);

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
  const withPrep =
    templates.length > 0 ? [templates[0], ...prepTemplates, ...templates.slice(1)] : templates;

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
      lastSessionPerformance
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
 * `workingKg` should be what the lift is currently being trained at. The test
 * set is 90% of it, held for max reps, which is what the Epley estimate below
 * expects. Passing nothing keeps the old generic copy, which is the right
 * fallback for someone with no history on the lift.
 */
export function generate1RMWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  _strengthSessionCount: number = 0,
  workingKg?: number
): Exercise[] {
  if (sessionType === 'conditioning' || sessionType === 'custom') return [];
  const protocol = get1RMProtocol(sessionType as MainSessionType, equipmentTier);
  let exercises = protocol.map((t) => templateToExercise(t));

  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);
  const bodyweightTier = equipmentTier === 'bodyweight' || equipmentTier === 'bands';

  // Plain language first, for every tier. "AMRAP @ 90%" is gym shorthand that
  // meant nothing to the person actually taking the test.
  exercises = exercises.map((e) => {
    if (e.category !== 'main') return e;
    const base = e.name.replace(/\s*AMRAP(\s*@\s*\d+\s*%)?/i, '').trim();
    const eachSide = /each side/i.test(e.reps);
    return {
      ...e,
      name: `${base} — Max Reps Test`,
      reps: eachSide ? 'Max clean reps each side' : 'Max clean reps',
    };
  });

  if (workingKg && workingKg > 0 && !bodyweightTier) {
    const testKg = roundTo2_5(workingKg * 0.9);
    exercises = exercises.map((e) => {
      if (e.category === 'main') {
        return {
          ...e,
          suggestedLoad: `${testKg} kg`,
          loadKg: [testKg],
          cue: `Load ${testKg} kg and do as many clean reps as you can. Stop the moment form slips — that last ugly rep does not count and is where people get hurt. Your one-rep max is worked out from the weight and how many reps you managed.`,
        };
      }
      if (e.category === 'prep') {
        const fractions = RAMP_FRACTIONS[e.sets] ?? RAMP_FRACTIONS[4];
        const ladder = fractions.map((f) => roundTo2_5(testKg * f));
        return {
          ...e,
          suggestedLoad: `${ladder.join(' / ')} kg`,
          loadKg: ladder,
          cue: `Work up to the test weight: ${ladder.join(' kg, ')} kg. These are warm-ups, not work sets — stop each one well short of hard.`,
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
  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);
  const unit = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // Try to extract the target weight number from the personalised load string
  let targetKg: number | null = null;
  if (suggestedLoad) {
    const numMatch = suggestedLoad.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) targetKg = parseFloat(numMatch[1]);
  }

  const w = (pct: number): string => {
    if (targetKg === null) return '';
    const val = roundTo2_5(targetKg * pct);
    return ` (~${val} ${unit})`;
  };

  if (category === 'main') {
    if (sets <= 3)
      return [
        `Set 1: Light warm-up${w(0.5)} - easy, just feel the pattern`,
        `Set 2: Build up${w(0.7)} - approaching working weight`,
        `Set 3: Working weight${targetKg !== null ? ` (${targetKg} ${unit})` : ''} - challenging but fully controlled`,
      ];
    if (sets === 4)
      return [
        `Set 1: Light warm-up${w(0.5)} - easy, just feel the pattern`,
        `Set 2: Build up${w(0.65)} - getting into position`,
        `Set 3: Approach set${w(0.875)} - close to working weight, stay sharp`,
        `Set 4: Working weight${targetKg !== null ? ` (${targetKg} ${unit})` : ''} - your one quality set`,
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
      `Set ${sets}: Working weight${targetKg !== null ? ` (${targetKg} ${unit})` : ''} - your one quality set, full control`
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
  suggestedLoad?: string
): number[] {
  return expandSetTargets(category, sets, parseLoadKg(suggestedLoad));
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
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
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
  numbers: number[]
): number[] {
  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);

  // An explicit ladder wins: the protocol has already stated each set.
  if (numbers.length === sets && sets > 1) return numbers;
  if (numbers.length === 0) return Array(sets).fill(0);

  // Otherwise the first value is the working weight. Deliberately not the
  // highest: 229 database loads are ranges ("8-12 kg per hand", "40-60 kg"),
  // and the app has always prescribed the bottom of the range. Taking the top
  // would quietly add load to a third of the catalogue.
  const targetKg = numbers[0];
  const w = (pct: number) => roundTo2_5(targetKg * pct);

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
