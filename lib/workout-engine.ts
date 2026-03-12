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

  // ── 1. Pre-Training Preparation (45 and 60 min only) ────────────────────
  if (timeAvailable !== '30') {
    const prep = getPrep(sessionType, equipmentTier);
    for (const p of prep) {
      exercises.push(templateToExercise(p));
    }
  }

  // ── 2. Mechanical Priming (all session lengths) ──────────────────────────
  const mechanical = getMechanical(sessionType, equipmentTier);
  for (const m of mechanical) {
    exercises.push(templateToExercise(m));
  }

  // ── 3. Neurological Priming (45 and 60 min only) ────────────────────────
  if (timeAvailable !== '30') {
    const neuroTemplate = getNeuro(sessionType, equipmentTier);
    exercises.push(applyComfortOrBadge(neuroTemplate, hasAches, painRegion));
  }

  // ── 4. KPI Lift ──────────────────────────────────────────────────────────
  const mainTemplate = getMainLift(sessionType, equipmentTier);
  let baseSets = mainTemplate.sets;
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

  // ── 5. Pump Accessories ──────────────────────────────────────────────────
  const allAccessories = getAccessories(sessionType, equipmentTier);
  const accessoriesToInclude = timeAvailable === '30'
    ? allAccessories.slice(0, 1)
    : timeAvailable === '45'
      ? allAccessories.slice(0, 2)
      : allAccessories;

  for (const acc of accessoriesToInclude) {
    exercises.push(applyComfortOrBadge(acc, hasAches, painRegion));
  }

  // ── 6. Prehab (45 and 60 min only) ──────────────────────────────────────
  if (timeAvailable !== '30') {
    const prehab = getPrehab(sessionType, equipmentTier);
    for (const ph of prehab) {
      exercises.push(templateToExercise(ph));
    }
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
    for (const cd of cooldown) {
      exercises.push(templateToExercise(cd));
    }
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
    case 'squat': return 'Squat Day';
    case 'bench': return 'Bench Day';
    case 'deadlift': return 'Deadlift Day';
  }
}

export function getSessionSubtitle(type: SessionType): string {
  switch (type) {
    case 'squat': return 'Lower Body — Squat Pattern';
    case 'bench': return 'Upper Body — Horizontal Push';
    case 'deadlift': return 'Full Body — Hinge Pattern';
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
