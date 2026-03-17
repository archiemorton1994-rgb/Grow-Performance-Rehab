import { EquipmentTier, EnergyLevel, PainRegion, SessionType, TimeAvailable } from './store';
import {
  ExerciseCategory,
  ExerciseTemplate,
  getPrep,
  getMechanical,
  getNeuro,
  getMainLift,
  getAccessories,
  getPrehab,
  getFinisher,
  getCooldown,
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
}

interface ReadinessCheck {
  hasAches: boolean;
  painRegion?: PainRegion;
  energy: EnergyLevel;
  timeAvailable: TimeAvailable;
}

function templateToExercise(t: ExerciseTemplate, badge?: 'comfort' | 'volume'): Exercise {
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
  };
}

function shouldSwapForComfort(template: ExerciseTemplate, painRegion?: PainRegion): boolean {
  if (!painRegion || !template.comfortVariant) return false;
  return template.comfortVariant.triggerRegions.includes(painRegion);
}

function applyComfortOrBadge(
  template: ExerciseTemplate,
  hasAches: boolean,
  painRegion: PainRegion | undefined,
  overrideSets?: number,
  overrideCategory?: ExerciseCategory
): Exercise {
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
    };
  }
  const ex = templateToExercise(template);
  if (overrideSets !== undefined) ex.sets = overrideSets;
  if (overrideCategory !== undefined) ex.category = overrideCategory;
  return ex;
}

/**
 * SESSION STRUCTURE (8 phases):
 *
 * 1. Pre-Training Preparation  (prep)        — breathing, mobility
 * 2. Mechanical Priming        (mechanical)   — bands, activation, constant tension
 * 3. Neurological Priming      (neuro)        — explosive movement, 1-5 reps
 * 4. KPI Lift                  (main)         — main strength exercise with ramp + work sets
 * 5. Pump Accessories          (accessory)    — hypertrophy support, 15-25 reps
 * 6. Prehab                    (prehab)       — joint health, holds
 * 7. Conditioning Finisher     (finisher)     — 2-10 min, energy-scaled (optional)
 * 8. Post-Training Cool Down   (cooldown)     — breathing + stretch
 *
 * Time scaling:
 *   30 min → mechanical + KPI + 1 accessory               (4 phases, no prep/neuro/prehab/finisher/cooldown)
 *   45 min → prep + mechanical + neuro + KPI + 2 acc + prehab + finisher  (7 phases)
 *   60 min → all 8 phases — full session
 */
export function generateWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck
): Exercise[] {
  const exercises: Exercise[] = [];
  const { hasAches, painRegion, energy, timeAvailable } = readiness;
  const finisherKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';

  // Time budgets (including rest periods):
  //   30 min → ~20-25 min of work: 1 mech + KPI + 1 acc                   = 3 exercises
  //   45 min → ~38-42 min of work: 1 prep + 1 mech + neuro + KPI + 2 acc + 1 prehab + finisher  = 8 exercises
  //   60 min → ~52-58 min of work: 1 prep + 2 mech + neuro + KPI + 2 acc + 1 prehab + finisher + cooldown = 10 exercises

  // ── 1. Pre-Training Preparation (45 and 60 min only — 1 exercise) ────────
  if (timeAvailable !== '30') {
    const prep = getPrep(sessionType, equipmentTier);
    exercises.push(templateToExercise(prep[0]));
  }

  // ── 2. Mechanical Priming (all lengths — 1 exercise for 30/45, 2 for 60) ─
  const mechanical = getMechanical(sessionType, equipmentTier);
  if (timeAvailable === '60') {
    for (const m of mechanical) exercises.push(templateToExercise(m));
  } else {
    exercises.push(templateToExercise(mechanical[0]));
  }

  // ── 3. Neurological Priming (45 and 60 min only) ────────────────────────
  if (timeAvailable !== '30') {
    const neuroTemplate = getNeuro(sessionType, equipmentTier);
    exercises.push(applyComfortOrBadge(neuroTemplate, hasAches, painRegion));
  }

  // ── 4. KPI Lift ──────────────────────────────────────────────────────────
  const mainTemplate = getMainLift(sessionType, equipmentTier);
  let baseSets = mainTemplate.sets;
  // Scale sets to time: 30 min → fewer, 60 min → more
  if (timeAvailable === '30') baseSets = Math.max(baseSets - 1, 3);
  if (energy === 'low') baseSets = Math.max(baseSets - 1, 2);
  if (energy === 'high') baseSets = baseSets + 1;

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
    });
  } else {
    const badge = energy !== 'normal' ? 'volume' as const : undefined;
    exercises.push({ ...templateToExercise(mainTemplate, badge), sets: baseSets });
  }

  // ── 5. Pump Accessories (1 for 30 min, 2 for 45 and 60 min) ─────────────
  const allAccessories = getAccessories(sessionType, equipmentTier);
  const accCount = timeAvailable === '30' ? 1 : 2;
  const accessoriesToInclude = allAccessories.slice(0, accCount);

  for (const acc of accessoriesToInclude) {
    // Reduce sets to 2 for accessories to keep time tight
    const accEx = applyComfortOrBadge(acc, hasAches, painRegion);
    accEx.sets = Math.min(accEx.sets, 2);
    exercises.push(accEx);
  }

  // ── 6. Prehab (45 and 60 min only — 1 exercise) ─────────────────────────
  if (timeAvailable !== '30') {
    const prehab = getPrehab(sessionType, equipmentTier);
    const phEx = templateToExercise(prehab[0]);
    phEx.sets = 1;
    exercises.push(phEx);
  }

  // ── 7. Conditioning Finisher (45 and 60 min only) ────────────────────────
  if (timeAvailable !== '30') {
    const finisher = getFinisher(sessionType, equipmentTier, finisherKey);
    const finBadge = energy !== 'normal' ? 'volume' as const : undefined;
    exercises.push(templateToExercise(finisher, finBadge));
  }

  // ── 8. Cool Down (60 min only) ────────────────────────────────────────────
  if (timeAvailable === '60') {
    const cooldown = getCooldown();
    exercises.push(templateToExercise(cooldown[0]));
  }

  return exercises;
}

export function generate1RMWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
): Exercise[] {
  const protocol = get1RMProtocol(sessionType, equipmentTier);
  return protocol.map((t) => templateToExercise(t));
}

export function getSessionLabel(type: SessionType): string {
  switch (type) {
    case 'squat': return 'Lower Body';
    case 'bench': return 'Upper Body';
    case 'deadlift': return 'Full Body';
  }
}

export function getSessionSubtitle(type: SessionType): string {
  switch (type) {
    case 'squat': return 'Squat pattern — quads, glutes, hamstrings';
    case 'bench': return 'Push pattern — chest, shoulders, triceps';
    case 'deadlift': return 'Hinge pattern — posterior chain, back, core';
  }
}

export function getSessionIcon(type: SessionType): string {
  switch (type) {
    case 'squat': return 'fitness';
    case 'bench': return 'body';
    case 'deadlift': return 'barbell';
  }
}

export function getEquipmentLabel(tier: EquipmentTier): string {
  switch (tier) {
    case 'bodyweight': return 'Bodyweight / Bands';
    case 'dumbbells': return 'Dumbbells / Kettlebells';
    case 'fullgym': return 'Full Gym / Barbell';
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
