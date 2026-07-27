import {
  EquipmentTier,
  EnergyLevel,
  ExerciseFeedback,
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

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  cue: string;
  suggestedLoad: string;
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
  lastSessionPerformance?: Record<string, 'easy' | 'normal' | 'failed'>
): string {
  if (!profile.bodyweightKg || profile.bodyweightKg <= 0) return rawLoad;

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
    return rawLoad;
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
      return `${lastKg} kg`;
    }
    // No-feedback streak: consecutive sessions this exercise was logged without
    // any explicit feedback (thumbs / tooEasy). Maintained per-exercise in the
    // store so it resets to 0 precisely when feedback is received for *this*
    // exercise, not based on unrelated global session count changes.
    const normalStreak = exerciseId ? (exerciseNormalStreak?.[exerciseId] ?? 0) : 0;
    const step = performance === 'easy' || normalStreak >= 3 ? 5 : 2.5;
    // Apply exact additive step (hold / +2.5 / +5) as specified.
    // feedbackMult is NOT applied on top - it is only used in the heuristic
    // path below (when there is no previous logged weight to anchor from).
    const progressedKg = roundTo2_5(lastKg + step);
    if (__DEV__) {
      console.log(
        `[personalizeLoad] exId=${exerciseId} lastKg=${lastKg} perf=${performance} normalStreak=${normalStreak} +${step} → ${progressedKg}kg`
      );
    }
    return `${progressedKg} kg`;
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
    const goalPct: Record<string, number> = {
      strength: 0.85,
      muscle: 0.75,
      fat_loss: 0.65,
      fitness: 0.7,
      rehab: 0.5,
      power: 0.9,
    };
    const activeGoals = profile.goals?.length ? profile.goals : ['fitness' as FitnessGoal];
    const avgPct =
      activeGoals.reduce((sum, g) => sum + (goalPct[g] ?? 0.7), 0) / activeGoals.length;
    const targetKg = roundTo2_5(ormKg * avgPct * combinedMult);
    return `${targetKg} kg`;
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

  return rawLoad.replace(/\d+(?:\.\d+)?/g, (match) => {
    const num = parseFloat(match);
    if (num <= 0) return match;
    return String(roundTo2_5(num * scale * combinedMult));
  });
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
  lastSessionPerformance?: Record<string, 'easy' | 'normal' | 'failed'>
): Exercise {
  if (!profile) return ex;
  const isMainLift = ex.category === 'main';

  // Derive a human-readable progression note from the same signals used in
  // personalizeLoad, so ExerciseCard can explain the suggested load to the user.
  let progressionNote: string | undefined;
  const lastKg = ex.id ? (lastLoggedWeights?.[ex.id] ?? 0) : 0;
  if (lastKg > 0) {
    const performance = ex.id ? lastSessionPerformance?.[ex.id] : undefined;
    const normalStreak = ex.id ? (exerciseNormalStreak?.[ex.id] ?? 0) : 0;
    if (performance === 'failed') {
      progressionNote = 'Load held - take your time with this weight';
    } else if (performance === 'easy') {
      progressionNote = 'Load increased - strong performance last session';
    } else if (normalStreak >= 3) {
      progressionNote = `Load bumped - ${normalStreak} consistent sessions, time to progress`;
    } else {
      progressionNote = 'Load adjusted from your last session';
    }
  }

  return {
    ...ex,
    suggestedLoad: personalizeLoad(
      ex.suggestedLoad,
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
    ),
    swapLoad: ex.swapLoad
      ? personalizeLoad(
          ex.swapLoad,
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
        )
      : ex.swapLoad,
    progressionNote,
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
  lastSessionPerformance?: Record<string, 'easy' | 'normal' | 'failed'>
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
      return getRegionPrehabWorkout(primaryRegion).map((t) => templateToExercise(t));
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
  const prep = getPrep(mainType, equipmentTier);
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
      : getPrehab(mainType, equipmentTier)[0];
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
  lastSessionPerformance?: Record<string, 'easy' | 'normal' | 'failed'>
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

  // ── 2. Main exercises — pattern-first, never drop required movements ───────
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

  // Always include required-pattern exercises first; shuffle only the bonus extras
  const requiredExercises = allMainExercises.slice(0, minRequired);
  const optionalExercises = allMainExercises.slice(minRequired);
  const optionalCount = Math.max(0, mainCount - minRequired);
  const shuffledOptional = seededShuffleDiverse(optionalExercises, sessionSeed);
  const selectedMain = [...requiredExercises, ...shuffledOptional.slice(0, optionalCount)];

  // Scale full_body sets to fit the time budget (never drop movements):
  //   30/45 min → 2 sets each; 60 min → keep template defaults; low energy also caps at 2
  const fullBodySets =
    sessionType === 'full_body' && (timeAvailable !== '60' || energy === 'low') ? 2 : 0;

  for (let i = 0; i < selectedMain.length; i++) {
    const t = selectedMain[i];
    const ex = applyComfortOrBadge(t, hasAches, painRegion, equipmentTier);
    // Only the first movement is the session's KPI lift; the rest are accessories
    const withCategory = i === 0 ? ex : { ...ex, category: 'accessory' as const };
    exercises.push(fullBodySets > 0 ? { ...withCategory, sets: fullBodySets } : withCategory);
  }

  // ── 3. Prehab (45 min only — 60 min uses finisher instead) ────────────────
  if (timeAvailable === '45') {
    const prehabTemplate = painRegion
      ? getRegionPrehabExercise(Array.isArray(painRegion) ? painRegion[0] : painRegion)
      : getPrehab(
          sessionType === 'upper_body'
            ? 'bench'
            : sessionType === 'full_body'
              ? 'deadlift'
              : 'squat',
          equipmentTier
        )[0];
    const phEx = templateToExercise(prehabTemplate);
    phEx.sets = 1;
    exercises.push(phEx);
  }

  // ── 4. Finisher (60 min only) ─────────────────────────────────────────────
  if (timeAvailable === '60') {
    const finisherKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
    const finisherSource: MainSessionType =
      sessionType === 'upper_body' ? 'bench' : sessionType === 'lower_body' ? 'squat' : 'deadlift';
    const finisherPool = getFinisher(finisherSource, equipmentTier, finisherKey);
    if (finisherPool.length > 0) {
      exercises.push(templateToExercise(finisherPool[0]));
    }
  }

  // ── 5. Cooldown (ALL sessions — always closes with recovery) ──────────────
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
  lastSessionPerformance?: Record<string, 'easy' | 'normal' | 'failed'>
): Exercise[] {
  const { energy } = readiness;
  const energyKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
  const templates = getConditioningWorkout(equipmentTier, energyKey);
  const personalized = templates.map((t) =>
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

/** Named conditioning intensity levels, mapped from the Flex tab level picker. */
export type ConditioningLevel = 'beginner' | 'intermediate' | 'advanced';

const CONDITIONING_LEVEL_TO_READINESS: Record<
  ConditioningLevel,
  Pick<ReadinessCheck, 'energy' | 'timeAvailable'>
> = {
  beginner: { energy: 'low', timeAvailable: '30' },
  intermediate: { energy: 'normal', timeAvailable: '45' },
  advanced: { energy: 'high', timeAvailable: '60' },
};

/**
 * Generate a standalone conditioning session directly from a named intensity
 * level. Provides a clean, level-first API so callers do not need to map
 * energy/timeAvailable manually - the engine handles that internally.
 */
export function generateWorkoutForConditioningLevel(
  level: ConditioningLevel,
  equipmentTier: EquipmentTier,
  profile?: UserProfile,
  exerciseFeedback?: Record<string, ExerciseFeedback>,
  /** Count of completed STRENGTH sessions only - see personalizeLoad. */
  strengthSessionCount: number = 0,
  lastLoggedWeights?: Record<string, number>
): Exercise[] {
  const readiness: ReadinessCheck = {
    hasAches: false,
    painRegion: undefined,
    ...CONDITIONING_LEVEL_TO_READINESS[level],
  };
  return generateConditioningWorkout(
    equipmentTier,
    readiness,
    profile,
    exerciseFeedback,
    strengthSessionCount,
    lastLoggedWeights
  );
}

export function generate1RMWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  _strengthSessionCount: number = 0
): Exercise[] {
  if (sessionType === 'conditioning' || sessionType === 'custom') return [];
  const protocol = get1RMProtocol(sessionType as MainSessionType, equipmentTier);
  const exercises = protocol.map((t) => templateToExercise(t));
  return equipmentTier === 'kettlebells' ? applyKettlebellNaming(exercises) : exercises;
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
  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);
  let targetKg: number | null = null;
  if (suggestedLoad) {
    const numMatch = suggestedLoad.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) targetKg = parseFloat(numMatch[1]);
  }
  if (targetKg === null) return Array(sets).fill(0);

  const w = (pct: number) => roundTo2_5(targetKg! * pct);

  if (category === 'main') {
    if (sets <= 3) return [w(0.5), w(0.7), targetKg];
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
    elbow_wrist: 'Elbow / Wrist',
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
