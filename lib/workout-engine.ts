import { EquipmentTier, EnergyLevel, PainRegion, SessionType, TimeAvailable } from './store';
import {
  ExerciseTemplate,
  getWarmups,
  getMainLift,
  getAccessories,
  getFinisher,
  get1RMProtocol,
} from './exercise-db';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  cue: string;
  suggestedLoad: string;
  category: 'warmup' | 'main' | 'accessory' | 'finisher';
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

export function generateWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck
): Exercise[] {
  const exercises: Exercise[] = [];
  const { hasAches, painRegion, energy, timeAvailable } = readiness;

  const warmups = getWarmups(sessionType, equipmentTier);
  if (timeAvailable !== '30') {
    for (const wu of warmups) {
      exercises.push(templateToExercise(wu));
    }
  }

  const mainTemplate = getMainLift(sessionType, equipmentTier);
  let baseSets = mainTemplate.sets;
  if (energy === 'low') baseSets = Math.max(baseSets - 1, 2);
  if (energy === 'high') baseSets = baseSets + 1;

  let mainBadge: 'comfort' | 'volume' | undefined;

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
    mainBadge = 'comfort';
  } else {
    const badge = energy !== 'normal' ? 'volume' as const : undefined;
    exercises.push({
      ...templateToExercise(mainTemplate, badge),
      sets: baseSets,
    });
    if (badge) mainBadge = badge;
  }

  const allAccessories = getAccessories(sessionType, equipmentTier);
  let accessoriesToInclude: ExerciseTemplate[];

  if (timeAvailable === '30') {
    accessoriesToInclude = allAccessories.slice(0, 1);
  } else if (timeAvailable === '45') {
    accessoriesToInclude = allAccessories.slice(0, 2);
  } else {
    accessoriesToInclude = allAccessories;
  }

  for (const acc of accessoriesToInclude) {
    if (hasAches && shouldSwapForComfort(acc, painRegion) && acc.comfortVariant) {
      const cv = acc.comfortVariant;
      exercises.push({
        id: acc.id + '-comfort',
        name: cv.name,
        sets: acc.sets,
        reps: acc.reps,
        cue: cv.cue,
        suggestedLoad: cv.suggestedLoad,
        category: 'accessory',
        badge: 'comfort',
        videoId: acc.videoId,
      });
    } else {
      exercises.push(templateToExercise(acc));
    }
  }

  if (timeAvailable !== '30') {
    const finisherKey = energy === 'low' ? 'easy' : energy === 'high' ? 'hard' : 'normal';
    const finisher = getFinisher(sessionType, equipmentTier, finisherKey);
    const finBadge = energy !== 'normal' ? 'volume' as const : undefined;
    exercises.push(templateToExercise(finisher, finBadge));
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
    case 'squat': return 'Lower Body Focus';
    case 'bench': return 'Upper Body Focus';
    case 'deadlift': return 'Full Body Focus';
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
