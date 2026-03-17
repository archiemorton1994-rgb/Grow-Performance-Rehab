import { EquipmentTier, EnergyLevel, FitnessGoal, PainRegion, SessionType, TimeAvailable, UserProfile } from './store';
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

type MainSessionType = Exclude<SessionType, 'conditioning'>;

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
 * Exercises with non-numeric loads (Bodyweight, Band, Machine, Cardio) are returned unchanged.
 * Numeric values are rounded to the nearest 2.5 kg with a minimum of 2.5 kg.
 */
function personalizeLoad(
  rawLoad: string,
  profile: UserProfile,
  isUpperBodySession: boolean
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

  const REF_BW = 80;
  const bwRatio = profile.bodyweightKg / REF_BW;

  const expFactor: Record<string, number> = { beginner: 0.45, intermediate: 0.70, advanced: 1.0 };
  const goalFactor: Record<string, number> = { strength: 1.08, muscle: 1.0, fat_loss: 0.72, fitness: 0.85, rehab: 0.50 };
  const sexFactor = profile.sex === 'female' ? (isUpperBodySession ? 0.55 : 0.72) :
                    profile.sex === 'other' ? 0.85 : 1.0;

  const activeGoals = profile.goals?.length ? profile.goals : ['fitness' as FitnessGoal];
  const avgGoalFactor = activeGoals.reduce((sum, g) => sum + (goalFactor[g] ?? 1.0), 0) / activeGoals.length;

  const scale = bwRatio * (expFactor[profile.experienceLevel] ?? 0.70) * avgGoalFactor * sexFactor;

  const roundTo2_5 = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5);

  return rawLoad.replace(/\d+(?:\.\d+)?/g, (match) => {
    const num = parseFloat(match);
    if (num <= 0) return match;
    return String(roundTo2_5(num * scale));
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

function applyPersonalization(ex: Exercise, profile: UserProfile | undefined, isUpperBody: boolean): Exercise {
  if (!profile) return ex;
  return {
    ...ex,
    suggestedLoad: personalizeLoad(ex.suggestedLoad, profile, isUpperBody),
    swapLoad: ex.swapLoad ? personalizeLoad(ex.swapLoad, profile, isUpperBody) : ex.swapLoad,
  };
}

export function generateWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck,
  profile?: UserProfile
): Exercise[] {
  if (sessionType === 'conditioning') {
    return generateConditioningWorkout(equipmentTier, readiness, profile);
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

  // ── 2. Pre-Training Prep (3 stretches for ALL sessions — safety) ─────────
  const prep = getPrep(mainType, equipmentTier);
  if (timeAvailable === '30') {
    // All 3 prep stretches for 30-min safety
    for (const p of prep) exercises.push(templateToExercise(p));
  } else {
    // 45/60 min: 1 prep exercise (first stretch, more time spent on full session)
    exercises.push(templateToExercise(prep[0]));
  }

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

  // ── 7. Prehab (45 and 60 min only) ──────────────────────────────────────
  if (timeAvailable !== '30') {
    const prehab = getPrehab(mainType, equipmentTier);
    const phEx = templateToExercise(prehab[0]);
    phEx.sets = 1;
    exercises.push(phEx);
  }

  // ── 8. Conditioning Finisher (45 and 60 min only) ────────────────────────
  if (timeAvailable !== '30') {
    const finisher = getFinisher(mainType, equipmentTier, finisherKey);
    const finBadge = energy !== 'normal' ? 'volume' as const : undefined;
    exercises.push(templateToExercise(finisher, finBadge));
  }

  // ── 9. Cool Down (60 min only) ────────────────────────────────────────────
  if (timeAvailable === '60') {
    const cooldown = getCooldown();
    exercises.push(templateToExercise(cooldown[0]));
  }

  const isUpperBody = mainType === 'bench';
  return exercises.map((ex) => applyPersonalization(ex, profile, isUpperBody));
}

function generateConditioningWorkout(
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck,
  profile?: UserProfile
): Exercise[] {
  const { energy } = readiness;
  const energyKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
  const templates = getConditioningWorkout(equipmentTier, energyKey);
  return templates.map((t) => applyPersonalization(templateToExercise(t), profile, false));
}

export function generate1RMWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
): Exercise[] {
  if (sessionType === 'conditioning') return [];
  const protocol = get1RMProtocol(sessionType as MainSessionType, equipmentTier);
  return protocol.map((t) => templateToExercise(t));
}

export function getRestPeriod(category: ExerciseCategory): string {
  switch (category) {
    case 'prep': return 'Breathe deeply — no rest needed';
    case 'mechanical': return 'Rest 30–45 sec between sets';
    case 'neuro': return 'Rest 45–60 sec between sets — full recovery before each';
    case 'main': return 'Rest 2–3 min between sets — full recovery is key';
    case 'accessory': return 'Rest 60–90 sec between sets';
    case 'prehab': return 'Rest 30–45 sec between sets';
    case 'finisher': return 'Follow the circuit timing';
    case 'cooldown': return 'Breathe slowly throughout';
    default: return 'Rest as needed';
  }
}

export function getWeightGuide(category: ExerciseCategory, sets: number): string[] {
  if (category === 'main') {
    if (sets <= 3) return [
      'Set 1: Easy warm-up (~50% of working weight)',
      'Set 2: Build (~70%) — feel the movement',
      'Set 3: Working weight — challenging but controlled',
    ];
    if (sets === 4) return [
      'Set 1: Easy warm-up (~50% of working weight)',
      'Set 2: Build (~65%) — feel the movement',
      'Set 3: Working weight (~80%) — stop well before failure',
      'Set 4: Match Set 3 or slightly heavier if form was perfect',
    ];
    return [
      'Set 1: Light warm-up (~40% of working weight)',
      'Set 2: Build (~60%) — feel the pattern',
      'Set 3: Build (~75%) — approaching working weight',
      ...Array.from({ length: sets - 3 }, (_, i) =>
        `Set ${i + 4}: Working weight — controlled, never grinding`
      ),
    ];
  }
  if (category === 'accessory') {
    return Array.from({ length: sets }, (_, i) =>
      i === 0
        ? 'Set 1: Start moderate — perfect form first'
        : i === sets - 1
          ? `Set ${i + 1}: Match or +2 kg if previous set felt easy`
          : `Set ${i + 1}: Maintain or small increase if form is perfect`
    );
  }
  return [];
}

export function getSessionLabel(type: SessionType): string {
  switch (type) {
    case 'squat': return 'Lower Body';
    case 'bench': return 'Upper Body';
    case 'deadlift': return 'Full Body';
    case 'conditioning': return 'Conditioning';
  }
}

export function getSessionSubtitle(type: SessionType): string {
  switch (type) {
    case 'squat': return 'Squat pattern — quads, glutes, hamstrings';
    case 'bench': return 'Push pattern — chest, shoulders, triceps';
    case 'deadlift': return 'Hinge pattern — posterior chain, back, core';
    case 'conditioning': return 'Fat burn — high calorie, cardio focus';
  }
}

export function getSessionIcon(type: SessionType): string {
  switch (type) {
    case 'squat': return 'fitness';
    case 'bench': return 'body';
    case 'deadlift': return 'barbell';
    case 'conditioning': return 'flame';
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
