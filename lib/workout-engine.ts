import { EquipmentTier, EnergyLevel, PainArea, SessionType } from './store';

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  cue: string;
  suggestedLoad: string;
  category: 'main' | 'accessory' | 'finisher';
  badge?: 'comfort' | 'volume';
}

interface ReadinessCheck {
  hasAches: boolean;
  painArea?: PainArea;
  energy: EnergyLevel;
}

interface MainLift {
  bodyweight: { name: string; load: string };
  dumbbells: { name: string; load: string };
  fullgym: { name: string; load: string };
  comfortVariant: { bodyweight: { name: string; load: string }; dumbbells: { name: string; load: string }; fullgym: { name: string; load: string } };
}

interface AccessoryExercise {
  name: string;
  sets: number;
  reps: string;
  cue: string;
  load: string;
  targetArea: PainArea;
  rehabVariant?: { name: string; cue: string; load: string };
}

const MAIN_LIFTS: Record<SessionType, MainLift> = {
  squat: {
    bodyweight: { name: 'Bodyweight Squat', load: 'Bodyweight' },
    dumbbells: { name: 'Goblet Squat', load: '20-30 lb DB' },
    fullgym: { name: 'Back Squat', load: '135-185 lb' },
    comfortVariant: {
      bodyweight: { name: 'Tempo BW Squat', load: 'Bodyweight (3s down)' },
      dumbbells: { name: 'Tempo Goblet Squat', load: '15-20 lb DB' },
      fullgym: { name: 'Pause Back Squat', load: '95-135 lb' },
    },
  },
  bench: {
    bodyweight: { name: 'Push-Up', load: 'Bodyweight' },
    dumbbells: { name: 'Dumbbell Press', load: '25-40 lb DBs' },
    fullgym: { name: 'Barbell Bench Press', load: '95-155 lb' },
    comfortVariant: {
      bodyweight: { name: 'Incline Push-Up', load: 'Bodyweight' },
      dumbbells: { name: 'Floor DB Press', load: '20-30 lb DBs' },
      fullgym: { name: 'Close-Grip Bench', load: '75-115 lb' },
    },
  },
  deadlift: {
    bodyweight: { name: 'Hinge Tempo', load: 'Bodyweight' },
    dumbbells: { name: 'Dumbbell RDL', load: '30-45 lb DBs' },
    fullgym: { name: 'Barbell Deadlift', load: '185-275 lb' },
    comfortVariant: {
      bodyweight: { name: 'Supported Hinge', load: 'Bodyweight' },
      dumbbells: { name: 'Single-Leg DB RDL', load: '15-25 lb DB' },
      fullgym: { name: 'Trap Bar Deadlift', load: '135-205 lb' },
    },
  },
};

const ACCESSORIES: Record<SessionType, AccessoryExercise[]> = {
  squat: [
    {
      name: 'Bulgarian Split Squat',
      sets: 3,
      reps: '10 each',
      cue: 'Keep torso upright',
      load: 'BW or light DBs',
      targetArea: 'legs',
      rehabVariant: { name: 'Supported Split Squat', cue: 'Hold wall for balance', load: 'Bodyweight' },
    },
    {
      name: 'Banded Lateral Walk',
      sets: 3,
      reps: '12 each',
      cue: 'Stay low, knees out',
      load: 'Light band',
      targetArea: 'legs',
    },
    {
      name: 'Plank Hold',
      sets: 3,
      reps: '30-45s',
      cue: 'Squeeze glutes, flat back',
      load: 'Bodyweight',
      targetArea: 'back',
      rehabVariant: { name: 'Dead Bug', cue: 'Press low back into floor', load: 'Bodyweight' },
    },
  ],
  bench: [
    {
      name: 'Dumbbell Row',
      sets: 3,
      reps: '10 each',
      cue: 'Pull to hip, squeeze',
      load: '25-40 lb DB',
      targetArea: 'upper',
      rehabVariant: { name: 'Band Pull-Apart', cue: 'Squeeze shoulder blades', load: 'Light band' },
    },
    {
      name: 'Overhead Press',
      sets: 3,
      reps: '8-10',
      cue: 'Brace core, press straight',
      load: '15-25 lb DBs',
      targetArea: 'upper',
      rehabVariant: { name: 'Lateral Raise', cue: 'Light and controlled', load: '5-10 lb DBs' },
    },
    {
      name: 'Tricep Dip',
      sets: 3,
      reps: '10-12',
      cue: 'Elbows back, not flared',
      load: 'Bodyweight',
      targetArea: 'upper',
    },
  ],
  deadlift: [
    {
      name: 'Hip Thrust',
      sets: 3,
      reps: '12-15',
      cue: 'Drive through heels',
      load: 'BW or DB on hips',
      targetArea: 'legs',
      rehabVariant: { name: 'Glute Bridge', cue: 'Squeeze at top', load: 'Bodyweight' },
    },
    {
      name: 'Bent-Over Row',
      sets: 3,
      reps: '10-12',
      cue: 'Flat back, pull to belly',
      load: '20-35 lb DBs',
      targetArea: 'back',
      rehabVariant: { name: 'Seated Band Row', cue: 'Sit tall, squeeze blades', load: 'Medium band' },
    },
    {
      name: 'Farmers Carry',
      sets: 3,
      reps: '40 steps',
      cue: 'Tall posture, grip tight',
      load: '30-50 lb DBs',
      targetArea: 'back',
    },
  ],
};

const FINISHERS: Record<SessionType, { easy: Exercise; normal: Exercise; hard: Exercise }> = {
  squat: {
    easy: { name: 'Bodyweight Squat Burnout', sets: 1, reps: '4 min AMRAP', cue: 'Keep moving, rest as needed', suggestedLoad: 'Bodyweight', category: 'finisher' },
    normal: { name: 'Squat Tabata', sets: 1, reps: '6 min (20s on / 10s off)', cue: 'Full range of motion', suggestedLoad: 'Bodyweight', category: 'finisher' },
    hard: { name: 'Squat Complex', sets: 1, reps: '8 min EMOM', cue: 'Quality reps, push pace', suggestedLoad: 'Light load', category: 'finisher' },
  },
  bench: {
    easy: { name: 'Push-Up Ladder', sets: 1, reps: '4 min (1-2-3-4-3-2-1)', cue: 'Full lockout each rep', suggestedLoad: 'Bodyweight', category: 'finisher' },
    normal: { name: 'Upper Body Circuit', sets: 1, reps: '6 min (3 rounds)', cue: 'Minimal rest between moves', suggestedLoad: 'Light', category: 'finisher' },
    hard: { name: 'Press Complex', sets: 1, reps: '8 min AMRAP', cue: 'Alternate push and pull', suggestedLoad: 'Moderate load', category: 'finisher' },
  },
  deadlift: {
    easy: { name: 'Hinge Flow', sets: 1, reps: '4 min easy pace', cue: 'Smooth transitions', suggestedLoad: 'Bodyweight', category: 'finisher' },
    normal: { name: 'Posterior Chain Blast', sets: 1, reps: '6 min (3 rounds)', cue: 'Glutes and hamstrings', suggestedLoad: 'Light', category: 'finisher' },
    hard: { name: 'Deadlift Density', sets: 1, reps: '8 min EMOM', cue: 'Fast but controlled', suggestedLoad: 'Moderate load', category: 'finisher' },
  },
};

export function generateWorkout(
  sessionType: SessionType,
  equipmentTier: EquipmentTier,
  readiness: ReadinessCheck
): Exercise[] {
  const exercises: Exercise[] = [];
  const mainLiftData = MAIN_LIFTS[sessionType];

  let baseSets = 4;
  if (readiness.energy === 'low') baseSets = 3;
  if (readiness.energy === 'high') baseSets = 5;

  let mainLift: { name: string; load: string };
  let mainBadge: 'comfort' | 'volume' | undefined;

  if (readiness.hasAches) {
    mainLift = mainLiftData.comfortVariant[equipmentTier];
    mainBadge = 'comfort';
  } else {
    mainLift = mainLiftData[equipmentTier];
  }

  if (readiness.energy !== 'normal') {
    mainBadge = mainBadge || 'volume';
  }

  exercises.push({
    name: mainLift.name,
    sets: baseSets,
    reps: '8-10',
    cue: getMainLiftCue(sessionType),
    suggestedLoad: mainLift.load,
    category: 'main',
    badge: mainBadge,
  });

  const accessories = ACCESSORIES[sessionType];
  for (const acc of accessories) {
    let name = acc.name;
    let cue = acc.cue;
    let load = acc.load;
    let badge: 'comfort' | undefined;

    if (readiness.hasAches && readiness.painArea === acc.targetArea && acc.rehabVariant) {
      name = acc.rehabVariant.name;
      cue = acc.rehabVariant.cue;
      load = acc.rehabVariant.load;
      badge = 'comfort';
    }

    exercises.push({
      name,
      sets: acc.sets,
      reps: acc.reps,
      cue,
      suggestedLoad: load,
      category: 'accessory',
      badge,
    });
  }

  const finisherKey = readiness.energy === 'low' ? 'easy' : readiness.energy === 'high' ? 'hard' : 'normal';
  const finisher = { ...FINISHERS[sessionType][finisherKey] };
  if (readiness.energy !== 'normal') {
    finisher.badge = 'volume';
  }
  exercises.push(finisher);

  return exercises;
}

function getMainLiftCue(sessionType: SessionType): string {
  switch (sessionType) {
    case 'squat':
      return 'Keep chest up, drive through heels';
    case 'bench':
      return 'Retract shoulder blades, control the descent';
    case 'deadlift':
      return 'Hinge at hips, neutral spine throughout';
  }
}

export function getSessionLabel(type: SessionType): string {
  switch (type) {
    case 'squat':
      return 'Squat Day';
    case 'bench':
      return 'Bench Day';
    case 'deadlift':
      return 'Deadlift Day';
  }
}

export function getSessionSubtitle(type: SessionType): string {
  switch (type) {
    case 'squat':
      return 'Lower Body Focus';
    case 'bench':
      return 'Upper Body Focus';
    case 'deadlift':
      return 'Full Body Focus';
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
  }
}

export function getEquipmentLabel(tier: EquipmentTier): string {
  switch (tier) {
    case 'bodyweight':
      return 'Bodyweight / Bands';
    case 'dumbbells':
      return 'Dumbbells / Kettlebells';
    case 'fullgym':
      return 'Full Gym / Barbell';
  }
}
