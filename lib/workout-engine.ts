import { EquipmentTier, EnergyLevel, ExerciseFeedback, FitnessGoal, PainRegion, SessionType, TimeAvailable, UserProfile } from './store';
import {
  ExerciseCategory,
  ExerciseTemplate,
  CARDIO_WARMUP,
  getPrep,
  getMechanical,
  getNeuro,
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
  isDumbbellExercise?: boolean;
}

interface ReadinessCheck {
  hasAches: boolean;
  painRegion?: PainRegion;
  energy: EnergyLevel;
  timeAvailable: TimeAvailable;
}

type MainSessionType = Exclude<SessionType, 'conditioning' | 'prehab' | 'flexibility'>;

function templateToExercise(t: ExerciseTemplate, badge?: 'comfort' | 'volume', isDumbbell?: boolean): Exercise {
  // Prefer explicit swapAlternative for user-initiated swaps; fall back to comfortVariant
  const swap = t.swapAlternative ?? t.comfortVariant;
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
    hasSwap: !!(t.swapAlternative || t.comfortVariant),
    swapName: swap?.name,
    swapCue: swap?.cue,
    swapLoad: swap?.suggestedLoad,
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
  completedCount: number = 0
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
    !(/\d/.test(rawLoad))
  ) {
    return rawLoad;
  }

  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);
  const feedbackMult = (exerciseId && exerciseFeedback?.[exerciseId]?.multiplier)
    ? exerciseFeedback[exerciseId].multiplier
    : 1.0;

  // ── Auto session-count multiplier (+1% per 3 sessions, max +20%) ─────────
  const autoMult = Math.min(1.20, 1 + Math.floor(completedCount / 3) * 0.01);
  // Combine feedback and auto progression, capped at the existing 1.5 max
  const combinedMult = Math.min(1.5, feedbackMult * autoMult);

  // ── 1RM-based load for the main KPI lift ────────────────────────────────
  // When the user entered their 1RM during onboarding (or a test week), use it
  // to calculate the working weight directly rather than relying on body-weight
  // heuristics.  Goal-specific percentages mirror common periodisation practice.
  if (ormKg && ormKg > 0 && isMainLift) {
    const goalPct: Record<string, number> = {
      strength: 0.85, muscle: 0.75, fat_loss: 0.65, fitness: 0.70, rehab: 0.50,
    };
    const activeGoals = profile.goals?.length ? profile.goals : ['fitness' as FitnessGoal];
    const avgPct = activeGoals.reduce((sum, g) => sum + (goalPct[g] ?? 0.70), 0) / activeGoals.length;
    const targetKg = roundTo2_5(ormKg * avgPct * combinedMult);
    return `${targetKg} kg`;
  }

  // ── Heuristic scaling (fallback when no 1RM is available) ───────────────
  const REF_BW = 80;
  const bwRatio = profile.bodyweightKg / REF_BW;

  const expFactor: Record<string, number> = { beginner: 0.45, intermediate: 0.70, advanced: 1.0 };
  const goalFactor: Record<string, number> = { strength: 1.08, muscle: 1.0, fat_loss: 0.72, fitness: 0.85, rehab: 0.50 };
  const sexFactor = profile.sex === 'female' ? (isUpperBodySession ? 0.55 : 0.72) :
                    profile.sex === 'other' ? 0.85 : 1.0;

  const activeGoals = profile.goals?.length ? profile.goals : ['fitness' as FitnessGoal];
  const avgGoalFactor = activeGoals.reduce((sum, g) => sum + (goalFactor[g] ?? 1.0), 0) / activeGoals.length;

  const scale = bwRatio * (expFactor[profile.experienceLevel] ?? 0.70) * avgGoalFactor * sexFactor;

  return rawLoad.replace(/\d+(?:\.\d+)?/g, (match) => {
    const num = parseFloat(match);
    if (num <= 0) return match;
    return String(roundTo2_5(num * scale * combinedMult));
  });
}

function shouldSwapForComfort(template: ExerciseTemplate, painRegion?: PainRegion): boolean {
  if (!painRegion || !template.comfortVariant) return false;
  return template.comfortVariant.triggerRegions.includes(painRegion);
}

function applyComfortOrBadge(
  template: ExerciseTemplate,
  hasAches: boolean,
  painRegion: PainRegion | undefined,
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
 * 1. Pre-Training Preparation  (prep)        — cardio warmup + active mobility
 * 2. Mechanical Priming        (mechanical)   — bands, activation, constant tension
 * 3. Neurological Priming      (neuro)        — explosive movement, 1-5 reps
 * 4. KPI Lift                  (main)         — main strength exercise with ramp + work sets
 * 5. Pump Accessories          (accessory)    — hypertrophy support, 15-25 reps
 * 6. Prehab                    (prehab)       — joint health, holds
 * 7. Conditioning Finisher     (finisher)     — 2-10 min, energy-scaled (optional)
 * 8. Post-Training Cool Down   (cooldown)     — breathing
 *
 * Time scaling:
 *   30 min → cardio + 3 prep stretches + mechanical + KPI + 1 accessory (SAFETY: always warm up)
 *   45 min → all prep + mechanical + neuro + KPI + 2 acc + prehab + finisher
 *   60 min → all 8 phases — full session
 */
/**
 * Returns set-count adjustments based on the user's goal mix.
 *
 * mainSetsDelta: added to the KPI lift base sets (strength → +1, rehab → -1)
 * accSetsDelta:  added to each accessory set count (muscle/fat_loss → +1, strength/rehab → -1)
 *
 * When two goals are selected the deltas are averaged and rounded.
 */
function getGoalVolumeDeltas(goals: FitnessGoal[]): { mainSetsDelta: number; accSetsDelta: number } {
  const mainDelta: Record<FitnessGoal, number> = { strength: 1, muscle: 0, fat_loss: 0, fitness: 0, rehab: -1 };
  const accDelta: Record<FitnessGoal, number>  = { strength: -1, muscle: 1, fat_loss: 1, fitness: 0, rehab: -1 };
  const active = goals?.length ? goals : (['fitness'] as FitnessGoal[]);
  const avgMain = active.reduce((s, g) => s + (mainDelta[g] ?? 0), 0) / active.length;
  const avgAcc  = active.reduce((s, g) => s + (accDelta[g]  ?? 0), 0) / active.length;
  return { mainSetsDelta: Math.round(avgMain), accSetsDelta: Math.round(avgAcc) };
}

/**
 * Standard kettlebell weights in kg — the required set per project spec.
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
  completedCount: number = 0
): Exercise {
  if (!profile) return ex;
  const isMainLift = ex.category === 'main';
  return {
    ...ex,
    suggestedLoad: personalizeLoad(ex.suggestedLoad, profile, isUpperBody, ex.id, exerciseFeedback, ormKg, isMainLift, completedCount),
    swapLoad: ex.swapLoad ? personalizeLoad(ex.swapLoad, profile, isUpperBody, ex.id, exerciseFeedback, ormKg, isMainLift, completedCount) : ex.swapLoad,
  };
}

export function generateWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck,
  profile?: UserProfile,
  exerciseFeedback?: Record<string, ExerciseFeedback>,
  bestOrmKg?: number,
  completedCount: number = 0
): Exercise[] {
  if (sessionType === 'conditioning') {
    return generateConditioningWorkout(equipmentTier, readiness, profile, exerciseFeedback, completedCount);
  }
  if (sessionType === 'prehab') {
    const prehabExercises = readiness?.painRegion
      ? getRegionPrehabWorkout(readiness.painRegion)
      : getStandalonePrehabWorkout();
    return prehabExercises.map((t) => templateToExercise(t));
  }
  if (sessionType === 'flexibility') {
    return getStandaloneFlexibilityWorkout().map((t) => templateToExercise(t));
  }

  const mainType = sessionType as MainSessionType;
  const exercises: Exercise[] = [];
  const { hasAches, painRegion, energy, timeAvailable } = readiness;
  const finisherKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
  const { mainSetsDelta, accSetsDelta } = profile
    ? getGoalVolumeDeltas(profile.goals)
    : { mainSetsDelta: 0, accSetsDelta: 0 };

  // ── 1. Cardio Warm-Up (ALL sessions including 30 min — safety requirement) ──
  exercises.push(templateToExercise(CARDIO_WARMUP));

  // ── 2. Pre-Training Prep ─────────────────────────────────────────────────
  //   30 min → all 3 stretches (safety warmup — never skip)
  //   45 min → first 2 stretches
  //   60 min → all 3 stretches
  const prep = getPrep(mainType, equipmentTier);
  const prepCount = timeAvailable === '45' ? 2 : 3;
  for (const p of prep.slice(0, prepCount)) exercises.push(templateToExercise(p));

  // ── 3. Mechanical Priming (1 exercise for 30/45, 2 for 60) ──────────────
  const mechanical = getMechanical(mainType, equipmentTier);
  if (timeAvailable === '60') {
    for (const m of mechanical) exercises.push(templateToExercise(m, undefined, isDumbbellTier(equipmentTier)));
  } else {
    exercises.push(templateToExercise(mechanical[0], undefined, isDumbbellTier(equipmentTier)));
  }

  // ── 4. Neurological Priming (45 and 60 min only) ────────────────────────
  if (timeAvailable !== '30') {
    const neuroTemplate = getNeuro(mainType, equipmentTier);
    exercises.push(applyComfortOrBadge(neuroTemplate, hasAches, painRegion, equipmentTier));
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
    const badge = energy !== 'normal' ? 'volume' as const : undefined;
    const ex = templateToExercise(mainTemplate, badge, isDumbbellTier(equipmentTier));
    ex.sets = baseSets;
    exercises.push(ex);
  }

  // ── 6. Pump Accessories (1 for 30 min, 2 for 45 and 60 min) ─────────────
  const allAccessories = getAccessories(mainType, equipmentTier);
  const accCount = timeAvailable === '30' ? 1 : 2;

  for (const acc of allAccessories.slice(0, accCount)) {
    const accEx = applyComfortOrBadge(acc, hasAches, painRegion, equipmentTier);
    accEx.sets = Math.max(1, Math.min(accEx.sets + accSetsDelta, 4));
    exercises.push(accEx);
  }

  // ── 7. Conditioning Finisher (45 and 60 min only) ────────────────────────
  if (timeAvailable !== '30') {
    const finisher = getFinisher(mainType, equipmentTier, finisherKey);
    const finBadge = energy !== 'normal' ? 'volume' as const : undefined;
    exercises.push(templateToExercise(finisher, finBadge));
  }

  // ── 8. Prehab / Cool-Down Stretches (45 and 60 min only) ─────────────────
  if (timeAvailable !== '30') {
    const prehabTemplate = readiness?.painRegion
      ? getRegionPrehabExercise(readiness.painRegion)
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
  const personalized = exercises.map((ex) => applyPersonalization(ex, profile, isUpperBody, exerciseFeedback, bestOrmKg, completedCount));
  const kettlebelled = equipmentTier === 'kettlebells' ? applyKettlebellNaming(personalized) : personalized;

  // Deduplicate: remove any exercise whose name (case-insensitive) has already appeared
  const seenNames = new Set<string>();
  return kettlebelled.filter((ex) => {
    const key = ex.name.toLowerCase().trim();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
}

function generateConditioningWorkout(
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck,
  profile?: UserProfile,
  exerciseFeedback?: Record<string, ExerciseFeedback>,
  completedCount: number = 0
): Exercise[] {
  const { energy } = readiness;
  const energyKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
  const templates = getConditioningWorkout(equipmentTier, energyKey);
  const personalized = templates.map((t) => applyPersonalization(templateToExercise(t), profile, false, exerciseFeedback, undefined, completedCount));
  return equipmentTier === 'kettlebells' ? applyKettlebellNaming(personalized) : personalized;
}

export function generate1RMWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
): Exercise[] {
  if (sessionType === 'conditioning') return [];
  const protocol = get1RMProtocol(sessionType as MainSessionType, equipmentTier);
  const exercises = protocol.map((t) => templateToExercise(t));
  return equipmentTier === 'kettlebells' ? applyKettlebellNaming(exercises) : exercises;
}

export function getRestPeriod(category: ExerciseCategory): string {
  switch (category) {
    case 'prep': return 'Move between exercises without rest — breathe into each stretch';
    case 'mechanical': return 'Rest 30–45 sec between sets';
    case 'neuro': return 'Rest 45–60 sec between sets — full recovery before each';
    case 'main': return 'Rest 2–3 min between sets — full recovery is key';
    case 'accessory': return 'Rest 60–90 sec between sets';
    case 'prehab': return 'Rest 30–45 sec between sets';
    case 'finisher': return 'Rest only if you need to — keep moving';
    case 'cooldown': return 'Breathe slowly — no rest needed';
    default: return 'Rest as needed';
  }
}

export function getWeightGuide(category: ExerciseCategory, sets: number, weightUnit: 'kg' | 'lbs' = 'kg', suggestedLoad?: string): string[] {
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
    if (sets <= 3) return [
      `Set 1: Light warm-up${w(0.5)} — easy, just feel the pattern`,
      `Set 2: Build up${w(0.7)} — approaching working weight`,
      `Set 3: Working weight${targetKg !== null ? ` (${targetKg} ${unit})` : ''} — challenging but fully controlled`,
    ];
    if (sets === 4) return [
      `Set 1: Light warm-up${w(0.5)} — easy, just feel the pattern`,
      `Set 2: Build up${w(0.65)} — getting into position`,
      `Set 3: Approach set${w(0.875)} — close to working weight, stay sharp`,
      `Set 4: Working weight${targetKg !== null ? ` (${targetKg} ${unit})` : ''} — your one quality set`,
    ];
    // 5+ sets: ramp progressively; penultimate set is always ~87.5%, final set is working weight
    const rampGuides: string[] = [
      `Set 1: Very light warm-up${w(0.4)} — just waking up the pattern`,
      `Set 2: Build up${w(0.55)} — comfortable, focus on form`,
    ];
    // Middle sets ramp from 70% up to ~75% (before the fixed penultimate ~87.5%)
    const middleCount = sets - 4; // sets after Set 2 and before penultimate and final
    for (let i = 0; i < middleCount; i++) {
      const pct = 0.7 + (0.05 * i);
      rampGuides.push(`Set ${i + 3}: Getting close${w(Math.min(pct, 0.8))} — building confidence`);
    }
    // Penultimate set: always ~87.5%
    rampGuides.push(`Set ${sets - 1}: Approach set${w(0.875)} — close to working weight, stay sharp`);
    // Final set: working weight
    rampGuides.push(
      `Set ${sets}: Working weight${targetKg !== null ? ` (${targetKg} ${unit})` : ''} — your one quality set, full control`
    );
    return rampGuides;
  }
  if (category === 'accessory') {
    return Array.from({ length: sets }, (_, i) =>
      i === 0
        ? 'Set 1: Start at a comfortable weight — nail the technique first'
        : i === sets - 1
          ? `Set ${i + 1}: Match or add ${weightUnit === 'lbs' ? '5 lbs' : '2 kg'} if the previous set felt easy`
          : `Set ${i + 1}: Keep the same weight or increase slightly if form is solid`
    );
  }
  return [];
}

/**
 * Applies a stored "too easy" multiplier to a personalised load string.
 * Used by the post-session feedback flow to adjust future session weights.
 */
export function applyFeedbackMultiplier(load: string, multiplier: number): string {
  if (multiplier === 1 || !(/\d/.test(load))) return load;
  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);
  return load.replace(/\d+(?:\.\d+)?/g, (match) => {
    const num = parseFloat(match);
    if (num <= 0) return match;
    return String(roundTo2_5(num * multiplier));
  });
}

export function getSessionLabel(type: SessionType): string {
  switch (type) {
    case 'squat': return 'Lower Body';
    case 'bench': return 'Upper Body';
    case 'deadlift': return 'Full Body';
    case 'conditioning': return 'Conditioning';
    case 'prehab': return 'Prehab';
    case 'flexibility': return 'Flexibility';
  }
}

export function getSessionSubtitle(type: SessionType): string {
  switch (type) {
    case 'squat': return 'Squat pattern — quads, glutes, hamstrings';
    case 'bench': return 'Push pattern — chest, shoulders, triceps';
    case 'deadlift': return 'Hinge pattern — posterior chain, back, core';
    case 'conditioning': return 'Fat burn — high calorie, cardio focus';
    case 'prehab': return 'Joint health — full body injury prevention circuit';
    case 'flexibility': return 'Stretch & mobility — full body long holds';
  }
}

export function getSessionIcon(type: SessionType): string {
  switch (type) {
    case 'squat': return 'fitness';
    case 'bench': return 'body';
    case 'deadlift': return 'barbell';
    case 'conditioning': return 'flame';
    case 'prehab': return 'shield-checkmark';
    case 'flexibility': return 'leaf';
  }
}

export function getEquipmentLabel(tier: EquipmentTier): string {
  switch (tier) {
    case 'bodyweight': return 'Bodyweight';
    case 'bands': return 'Resistance Bands';
    case 'dumbbells': return 'Dumbbells';
    case 'kettlebells': return 'Kettlebells';
    case 'fullgym': return 'Full Gym';
  }
}

export function getEquipmentIcon(tier: EquipmentTier): string {
  switch (tier) {
    case 'bodyweight': return 'person-outline';
    case 'bands': return 'git-compare-outline';
    case 'dumbbells': return 'barbell-outline';
    case 'kettlebells': return 'fitness-outline';
    case 'fullgym': return 'business-outline';
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
  };
  return labels[region];
}


export function getEffectiveTier(tiers: EquipmentTier[]): EquipmentTier {
  const TIER_ORDER: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
  if (!tiers || tiers.length === 0) return 'bodyweight';
  let bestIdx = 0;
  for (const t of tiers) {
    const idx = TIER_ORDER.indexOf(t);
    if (idx > bestIdx) bestIdx = idx;
  }
  return TIER_ORDER[bestIdx];
}
