import { EquipmentTier, SessionType, PainRegion } from './store';

export interface ExerciseTemplate {
  id: string;
  name: string;
  sets: number;
  reps: string;
  cue: string;
  suggestedLoad: string;
  category: 'warmup' | 'main' | 'accessory' | 'finisher';
  targetRegions: PainRegion[];
  videoId: string;
  comfortVariant?: {
    name: string;
    cue: string;
    suggestedLoad: string;
    triggerRegions: PainRegion[];
  };
}

const WARMUPS: Record<SessionType, Record<EquipmentTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-wu-bw-1', name: '90/90 Hip Switch', sets: 2, reps: '8 each', cue: 'Control the transition, breathe', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: ['hip_groin'], videoId: '', },
      { id: 'sq-wu-bw-2', name: 'Cossack Squat Flow', sets: 2, reps: '6 each', cue: 'Heel down, chest tall (Horschig)', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: ['hip_groin', 'knee'], videoId: '', },
    ],
    dumbbells: [
      { id: 'sq-wu-db-1', name: '90/90 Hip Switch', sets: 2, reps: '8 each', cue: 'Control the transition, breathe', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: ['hip_groin'], videoId: '', },
      { id: 'sq-wu-db-2', name: 'Goblet Squat Hold', sets: 2, reps: '20s hold', cue: 'Elbows push knees out (Horschig)', suggestedLoad: '8-12 kg', category: 'warmup', targetRegions: ['hip_groin', 'knee'], videoId: '', },
    ],
    fullgym: [
      { id: 'sq-wu-fg-1', name: '90/90 Hip Switch', sets: 2, reps: '8 each', cue: 'Control the transition, breathe', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: ['hip_groin'], videoId: '', },
      { id: 'sq-wu-fg-2', name: 'Goblet Squat Hold', sets: 2, reps: '20s hold', cue: 'Elbows push knees out (Horschig)', suggestedLoad: '12-16 kg', category: 'warmup', targetRegions: ['hip_groin', 'knee'], videoId: '', },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-wu-bw-1', name: 'Band Pull-Apart', sets: 2, reps: '15', cue: 'Squeeze shoulder blades back (Rusin)', suggestedLoad: 'Light band', category: 'warmup', targetRegions: ['rear_shoulder'], videoId: '', },
      { id: 'bn-wu-bw-2', name: 'Scapular Push-Up', sets: 2, reps: '10', cue: 'Protract and retract fully', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '', },
    ],
    dumbbells: [
      { id: 'bn-wu-db-1', name: 'Band Pull-Apart', sets: 2, reps: '15', cue: 'Squeeze shoulder blades back (Rusin)', suggestedLoad: 'Light band', category: 'warmup', targetRegions: ['rear_shoulder'], videoId: '', },
      { id: 'bn-wu-db-2', name: 'Light DB External Rotation', sets: 2, reps: '10 each', cue: 'Elbow pinned to side (Rusin)', suggestedLoad: '2-4 kg', category: 'warmup', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '', },
    ],
    fullgym: [
      { id: 'bn-wu-fg-1', name: 'Band Pull-Apart', sets: 2, reps: '15', cue: 'Squeeze shoulder blades back (Rusin)', suggestedLoad: 'Light band', category: 'warmup', targetRegions: ['rear_shoulder'], videoId: '', },
      { id: 'bn-wu-fg-2', name: 'Face Pull', sets: 2, reps: '12', cue: 'Pull to forehead, rotate out (Rusin)', suggestedLoad: 'Light cable', category: 'warmup', targetRegions: ['rear_shoulder'], videoId: '', },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-wu-bw-1', name: 'Cat-Cow', sets: 2, reps: '8', cue: 'Full range, breathe with each rep', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: ['lower_back', 'upper_back'], videoId: '', },
      { id: 'dl-wu-bw-2', name: 'Glute Bridge March', sets: 2, reps: '8 each', cue: 'Hips level, squeeze glute at top', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: ['hip_groin', 'lower_back'], videoId: '', },
    ],
    dumbbells: [
      { id: 'dl-wu-db-1', name: 'Cat-Cow', sets: 2, reps: '8', cue: 'Full range, breathe with each rep', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: ['lower_back', 'upper_back'], videoId: '', },
      { id: 'dl-wu-db-2', name: 'KB Deadbug', sets: 2, reps: '6 each', cue: 'Press low back into floor (Horschig)', suggestedLoad: '4-8 kg', category: 'warmup', targetRegions: ['core_ribs', 'lower_back'], videoId: '', },
    ],
    fullgym: [
      { id: 'dl-wu-fg-1', name: 'Cat-Cow', sets: 2, reps: '8', cue: 'Full range, breathe with each rep', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: ['lower_back', 'upper_back'], videoId: '', },
      { id: 'dl-wu-fg-2', name: 'Banded Good Morning', sets: 2, reps: '10', cue: 'Hinge at hips, feel hamstrings load', suggestedLoad: 'Medium band', category: 'warmup', targetRegions: ['lower_back', 'hip_groin'], videoId: '', },
    ],
  },
};

const MAIN_LIFTS: Record<SessionType, Record<EquipmentTier, ExerciseTemplate>> = {
  squat: {
    bodyweight: {
      id: 'sq-main-bw', name: 'Bodyweight Squat', sets: 4, reps: '12-15', cue: 'Chest up, knees track toes, full depth (Horschig)', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: ['knee', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Tempo Box Squat', cue: '3s down to box, pause, stand (Horschig)', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'hip_groin', 'ankle_achilles'] },
    },
    dumbbells: {
      id: 'sq-main-db', name: 'Goblet Squat', sets: 4, reps: '10-12', cue: 'Elbows inside knees, vertical torso (Horschig)', suggestedLoad: '16-24 kg', category: 'main', targetRegions: ['knee', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Tempo Goblet Squat', cue: '3s eccentric, pause at bottom (Horschig)', suggestedLoad: '12-16 kg', triggerRegions: ['knee', 'hip_groin', 'ankle_achilles'] },
    },
    fullgym: {
      id: 'sq-main-fg', name: 'Back Squat', sets: 4, reps: '6-8', cue: 'Brace hard, break at hips and knees together (Horschig)', suggestedLoad: '60-80 kg', category: 'main', targetRegions: ['knee', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Safety Bar / Pause Squat', cue: '2s pause in hole, controlled ascent', suggestedLoad: '40-60 kg', triggerRegions: ['knee', 'hip_groin', 'lower_back', 'ankle_achilles'] },
    },
  },
  bench: {
    bodyweight: {
      id: 'bn-main-bw', name: 'Push-Up', sets: 4, reps: '12-15', cue: 'Elbows 45 degrees, full lockout (Rusin)', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: ['front_shoulder', 'elbow_wrist'],
      videoId: '',
      comfortVariant: { name: 'Incline Push-Up', cue: 'Hands elevated, reduce shoulder load (Rusin)', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    dumbbells: {
      id: 'bn-main-db', name: 'Dumbbell Bench Press', sets: 4, reps: '10-12', cue: 'Neutral grip option for shoulder comfort (Rusin)', suggestedLoad: '14-22 kg each', category: 'main', targetRegions: ['front_shoulder', 'elbow_wrist'],
      videoId: '',
      comfortVariant: { name: 'Floor Dumbbell Press', cue: 'Limit ROM to protect shoulders (Rusin)', suggestedLoad: '12-18 kg each', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    fullgym: {
      id: 'bn-main-fg', name: 'Barbell Bench Press', sets: 4, reps: '6-8', cue: 'Arch, retract scaps, leg drive (Rusin)', suggestedLoad: '50-70 kg', category: 'main', targetRegions: ['front_shoulder', 'elbow_wrist'],
      videoId: '',
      comfortVariant: { name: 'Close-Grip Bench Press', cue: 'Elbows tucked, reduced shoulder stress (Rusin)', suggestedLoad: '40-55 kg', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
  },
  deadlift: {
    bodyweight: {
      id: 'dl-main-bw', name: 'Single-Leg Hinge', sets: 4, reps: '10 each', cue: 'Hinge at hip, flat back, reach for floor', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Supported Hip Hinge', cue: 'Hands on wall, focus on hamstring stretch', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'hip_groin', 'knee'] },
    },
    dumbbells: {
      id: 'dl-main-db', name: 'Dumbbell Romanian Deadlift', sets: 4, reps: '10-12', cue: 'Push hips back, DBs slide down thighs', suggestedLoad: '16-24 kg each', category: 'main', targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Single-Leg DB RDL', cue: 'Lighter load, better balance (Horschig)', suggestedLoad: '10-14 kg', triggerRegions: ['lower_back', 'hip_groin', 'knee'] },
    },
    fullgym: {
      id: 'dl-main-fg', name: 'Barbell Deadlift', sets: 4, reps: '5-6', cue: 'Wedge into the bar, push floor away (Horschig)', suggestedLoad: '80-120 kg', category: 'main', targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Trap Bar Deadlift', cue: 'Neutral grip, more upright torso, joint-friendly', suggestedLoad: '60-90 kg', triggerRegions: ['lower_back', 'hip_groin', 'knee'] },
    },
  },
};

const ACCESSORIES: Record<SessionType, Record<EquipmentTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-acc-bw-1', name: 'Reverse Lunge', sets: 3, reps: '10 each', cue: 'Step back, knee kiss floor, stand tall', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        comfortVariant: { name: 'Supported Reverse Lunge', cue: 'Hold wall or chair for balance', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] }, },
      { id: 'sq-acc-bw-2', name: 'Glute Bridge', sets: 3, reps: '15', cue: 'Squeeze glutes hard at top, 2s hold', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Banded Clamshell', cue: 'Side-lying, control the opening', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'lower_back'] }, },
      { id: 'sq-acc-bw-3', name: 'Banded Lateral Walk', sets: 3, reps: '12 each', cue: 'Stay low, knees out, small steps', suggestedLoad: 'Medium band', category: 'accessory', targetRegions: ['hip_groin', 'knee'], videoId: '', },
      { id: 'sq-acc-bw-4', name: 'Wall Sit', sets: 3, reps: '30-45s', cue: 'Thighs parallel, back flat on wall', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['knee'], videoId: '', },
    ],
    dumbbells: [
      { id: 'sq-acc-db-1', name: 'DB Bulgarian Split Squat', sets: 3, reps: '8 each', cue: 'Upright torso, front knee tracks toe', suggestedLoad: '10-16 kg each', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        comfortVariant: { name: 'DB Supported Split Squat', cue: 'One hand on rack, lighter load', suggestedLoad: '8-10 kg', triggerRegions: ['knee', 'ankle_achilles'] }, },
      { id: 'sq-acc-db-2', name: 'DB Hip Thrust', sets: 3, reps: '12', cue: 'Drive through heels, full hip extension', suggestedLoad: '16-24 kg on hips', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Glute Bridge', cue: 'Bodyweight, feet flat, squeeze at top', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] }, },
      { id: 'sq-acc-db-3', name: 'DB Step-Up', sets: 3, reps: '8 each', cue: 'Drive through top foot, dont push off back', suggestedLoad: '10-14 kg each', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '', },
    ],
    fullgym: [
      { id: 'sq-acc-fg-1', name: 'Barbell Walking Lunge', sets: 3, reps: '8 each', cue: 'Bar on back, controlled steps, upright torso', suggestedLoad: '30-50 kg', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        comfortVariant: { name: 'Reverse Lunge (BW)', cue: 'Bodyweight only, focus on control', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] }, },
      { id: 'sq-acc-fg-2', name: 'Leg Press', sets: 3, reps: '10-12', cue: 'Full ROM, dont lock knees at top', suggestedLoad: '80-120 kg', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        comfortVariant: { name: 'Leg Extension (light)', cue: 'Partial ROM if knee sensitive', suggestedLoad: '20-30 kg', triggerRegions: ['knee'] }, },
      { id: 'sq-acc-fg-3', name: 'Barbell Hip Thrust', sets: 3, reps: '10', cue: 'Full extension, pause at top, squeeze', suggestedLoad: '40-70 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '', },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-acc-bw-1', name: 'Diamond Push-Up', sets: 3, reps: '8-10', cue: 'Hands close, elbows back not flared', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['elbow_wrist', 'front_shoulder'], videoId: '',
        comfortVariant: { name: 'Knee Push-Up', cue: 'Reduce load, focus on scap control (Rusin)', suggestedLoad: 'Bodyweight', triggerRegions: ['elbow_wrist', 'front_shoulder'] }, },
      { id: 'bn-acc-bw-2', name: 'Band Pull-Apart', sets: 3, reps: '15', cue: 'Squeeze shoulder blades, pull to chest (Rusin)', suggestedLoad: 'Medium band', category: 'accessory', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '', },
      { id: 'bn-acc-bw-3', name: 'Pike Push-Up', sets: 3, reps: '8', cue: 'Hips high, head through arms', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['front_shoulder'], videoId: '',
        comfortVariant: { name: 'Banded Lateral Raise', cue: 'Light band, controlled tempo', suggestedLoad: 'Light band', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck'] }, },
      { id: 'bn-acc-bw-4', name: 'Prone Y-T-W Raise', sets: 3, reps: '8 each', cue: 'Face down, lift arms in Y, T, W pattern (Rusin)', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '', },
    ],
    dumbbells: [
      { id: 'bn-acc-db-1', name: 'DB Single-Arm Row', sets: 3, reps: '10 each', cue: 'Pull to hip, squeeze back, control negative', suggestedLoad: '14-22 kg', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'Band Pull-Apart', cue: 'Light resistance, high reps (Rusin)', suggestedLoad: 'Light band', triggerRegions: ['rear_shoulder', 'upper_back', 'elbow_wrist'] }, },
      { id: 'bn-acc-db-2', name: 'DB Lateral Raise', sets: 3, reps: '12', cue: 'Slight lean forward, controlled tempo', suggestedLoad: '4-8 kg each', category: 'accessory', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'DB Front Raise (light)', cue: 'Thumbs up grip, slow tempo', suggestedLoad: '2-4 kg each', triggerRegions: ['front_shoulder', 'rear_shoulder'] }, },
      { id: 'bn-acc-db-3', name: 'DB Skull Crusher', sets: 3, reps: '10', cue: 'Elbows fixed, lower to forehead level', suggestedLoad: '6-10 kg each', category: 'accessory', targetRegions: ['elbow_wrist'], videoId: '', },
    ],
    fullgym: [
      { id: 'bn-acc-fg-1', name: 'Barbell Bent-Over Row', sets: 3, reps: '8-10', cue: 'Flat back, pull to sternum (Rusin)', suggestedLoad: '40-60 kg', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'Cable Face Pull', cue: 'Light weight, external rotate at top (Rusin)', suggestedLoad: '10-15 kg', triggerRegions: ['rear_shoulder', 'upper_back', 'lower_back'] }, },
      { id: 'bn-acc-fg-2', name: 'Overhead Press', sets: 3, reps: '8', cue: 'Brace core, press through ceiling', suggestedLoad: '30-45 kg', category: 'accessory', targetRegions: ['front_shoulder'], videoId: '',
        comfortVariant: { name: 'Landmine Press', cue: 'Angled press, easier on shoulders (Rusin)', suggestedLoad: '15-25 kg', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck'] }, },
      { id: 'bn-acc-fg-3', name: 'Cable Tricep Pushdown', sets: 3, reps: '12', cue: 'Elbows pinned, full extension', suggestedLoad: '15-25 kg', category: 'accessory', targetRegions: ['elbow_wrist'], videoId: '', },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-acc-bw-1', name: 'Glute Bridge March', sets: 3, reps: '10 each', cue: 'Hips level throughout, alternate legs', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying face up, squeeze and hold 5s', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] }, },
      { id: 'dl-acc-bw-2', name: 'Superman Hold', sets: 3, reps: '8 (3s hold)', cue: 'Lift arms and legs, squeeze back', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['upper_back', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Bird Dog', cue: 'Opposite arm and leg, stable core', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'upper_back'] }, },
      { id: 'dl-acc-bw-3', name: 'Bear Crawl', sets: 3, reps: '20 steps', cue: 'Knees hover 2 inches off ground, tight core', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['core_ribs', 'front_shoulder'], videoId: '', },
      { id: 'dl-acc-bw-4', name: 'Banded Good Morning', sets: 3, reps: '12', cue: 'Band around neck, hinge with flat back', suggestedLoad: 'Medium band', category: 'accessory', targetRegions: ['lower_back', 'hip_groin'], videoId: '', },
    ],
    dumbbells: [
      { id: 'dl-acc-db-1', name: 'DB Hip Thrust', sets: 3, reps: '12', cue: 'DB on hips, full extension, squeeze top', suggestedLoad: '16-24 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Glute Bridge', cue: 'Bodyweight, controlled tempo', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] }, },
      { id: 'dl-acc-db-2', name: 'DB Bent-Over Row', sets: 3, reps: '10 each', cue: 'Flat back, pull to hip, squeeze lat', suggestedLoad: '14-20 kg', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'Chest-Supported DB Row', cue: 'Incline bench, remove low back stress', suggestedLoad: '10-14 kg', triggerRegions: ['lower_back', 'upper_back'] }, },
      { id: 'dl-acc-db-3', name: 'KB Swing', sets: 3, reps: '15', cue: 'Hip snap, arms are ropes (Edgley)', suggestedLoad: '12-20 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '', },
    ],
    fullgym: [
      { id: 'dl-acc-fg-1', name: 'Barbell Hip Thrust', sets: 3, reps: '10', cue: 'Full extension, 2s squeeze at top', suggestedLoad: '40-70 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Glute Bridge (BW)', cue: 'Bodyweight, higher reps, no spinal load', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] }, },
      { id: 'dl-acc-fg-2', name: 'Pendlay Row', sets: 3, reps: '8', cue: 'Dead stop each rep, explosive pull', suggestedLoad: '40-60 kg', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'Seated Cable Row', cue: 'Upright torso, no back strain', suggestedLoad: '30-45 kg', triggerRegions: ['lower_back', 'upper_back'] }, },
      { id: 'dl-acc-fg-3', name: 'Farmers Carry', sets: 3, reps: '40m', cue: 'Tall posture, grip tight, brace core (Edgley)', suggestedLoad: '24-36 kg each', category: 'accessory', targetRegions: ['core_ribs', 'upper_back'], videoId: '', },
    ],
  },
};

const FINISHERS: Record<SessionType, Record<EquipmentTier, { easy: ExerciseTemplate; normal: ExerciseTemplate; hard: ExerciseTemplate }>> = {
  squat: {
    bodyweight: {
      easy: { id: 'sq-fin-bw-e', name: 'Steady Walk / Light Jog', sets: 1, reps: '4 min', cue: 'Easy pace, recover breathing', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      normal: { id: 'sq-fin-bw-n', name: 'Jump Rope Intervals', sets: 1, reps: '6 min (30s on / 15s off)', cue: 'Light bounces, stay on toes (Edgley)', suggestedLoad: 'Jump rope', category: 'finisher', targetRegions: [], videoId: '' },
      hard: { id: 'sq-fin-bw-h', name: 'Burpee Ladder', sets: 1, reps: '8 min (1-2-3-4-3-2-1 repeat)', cue: 'Full extension at top, chest to floor (Edgley)', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
    },
    dumbbells: {
      easy: { id: 'sq-fin-db-e', name: 'Stationary Bike / Walk', sets: 1, reps: '4 min easy', cue: 'Low resistance, steady pace', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      normal: { id: 'sq-fin-db-n', name: 'KB Swing Intervals', sets: 1, reps: '6 min (15 swings / 30s rest)', cue: 'Hip snap, bell to chest height (Edgley)', suggestedLoad: '12-16 kg', category: 'finisher', targetRegions: [], videoId: '' },
      hard: { id: 'sq-fin-db-h', name: 'DB Thruster + Shuttle Run', sets: 1, reps: '8 min AMRAP', cue: '5 thrusters, 20m shuttle, repeat (Edgley)', suggestedLoad: '10-14 kg each', category: 'finisher', targetRegions: [], videoId: '' },
    },
    fullgym: {
      easy: { id: 'sq-fin-fg-e', name: 'Light Sled Drag', sets: 1, reps: '4 min continuous', cue: 'Backward drag, easy pace, stay upright', suggestedLoad: '40-60 kg sled', category: 'finisher', targetRegions: [], videoId: '' },
      normal: { id: 'sq-fin-fg-n', name: 'Sled Push Intervals', sets: 1, reps: '6 min (20m push / walk back)', cue: 'Arms extended, drive through legs (Edgley)', suggestedLoad: '60-80 kg sled', category: 'finisher', targetRegions: [], videoId: '' },
      hard: { id: 'sq-fin-fg-h', name: 'Sled Push/Pull Complex', sets: 1, reps: '8 min (push 20m, drag 20m)', cue: 'Push then drag, minimal rest (Edgley)', suggestedLoad: '60-100 kg sled', category: 'finisher', targetRegions: [], videoId: '' },
    },
  },
  bench: {
    bodyweight: {
      easy: { id: 'bn-fin-bw-e', name: 'Shadow Boxing', sets: 1, reps: '4 min easy', cue: 'Light punches, keep moving, breathe', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      normal: { id: 'bn-fin-bw-n', name: 'Mountain Climber Intervals', sets: 1, reps: '6 min (20s on / 10s off)', cue: 'Hands under shoulders, drive knees fast', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      hard: { id: 'bn-fin-bw-h', name: 'Burpee to Broad Jump', sets: 1, reps: '8 min AMRAP', cue: 'Burpee then jump forward, walk back (Edgley)', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
    },
    dumbbells: {
      easy: { id: 'bn-fin-db-e', name: 'Light Bike / Row', sets: 1, reps: '4 min easy', cue: 'Steady pace, calm breathing', suggestedLoad: 'Machine', category: 'finisher', targetRegions: [], videoId: '' },
      normal: { id: 'bn-fin-db-n', name: 'Rower Intervals', sets: 1, reps: '6 min (250m hard / 30s easy)', cue: 'Drive with legs, pull to chest (Edgley)', suggestedLoad: 'Rower', category: 'finisher', targetRegions: [], videoId: '' },
      hard: { id: 'bn-fin-db-h', name: 'DB Complex', sets: 1, reps: '8 min EMOM: 5 cleans + 5 press', cue: 'Light DBs, move fast, no rest between (Edgley)', suggestedLoad: '8-12 kg each', category: 'finisher', targetRegions: [], videoId: '' },
    },
    fullgym: {
      easy: { id: 'bn-fin-fg-e', name: 'Light Bike Spin', sets: 1, reps: '4 min easy', cue: 'Low resistance, steady cadence', suggestedLoad: 'Bike', category: 'finisher', targetRegions: [], videoId: '' },
      normal: { id: 'bn-fin-fg-n', name: 'Assault Bike Intervals', sets: 1, reps: '6 min (20s sprint / 40s easy)', cue: 'All-out sprint intervals (Edgley)', suggestedLoad: 'Assault bike', category: 'finisher', targetRegions: [], videoId: '' },
      hard: { id: 'bn-fin-fg-h', name: 'Sled Push + Assault Bike', sets: 1, reps: '8 min (push 20m, bike 15 cal)', cue: 'Alternate every round, push pace (Edgley)', suggestedLoad: '60 kg sled + bike', category: 'finisher', targetRegions: [], videoId: '' },
    },
  },
  deadlift: {
    bodyweight: {
      easy: { id: 'dl-fin-bw-e', name: 'Walking Lunges', sets: 1, reps: '4 min continuous', cue: 'Easy pace, long strides', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      normal: { id: 'dl-fin-bw-n', name: 'Shuttle Run Intervals', sets: 1, reps: '6 min (20m sprints / jog back)', cue: 'Touch line each end, quick turns (Edgley)', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      hard: { id: 'dl-fin-bw-h', name: 'Bear Crawl + Sprint', sets: 1, reps: '8 min (10m crawl, 20m sprint)', cue: 'Stay low on crawl, explode on sprint (Edgley)', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
    },
    dumbbells: {
      easy: { id: 'dl-fin-db-e', name: 'Farmer Walk', sets: 1, reps: '4 min continuous', cue: 'Tall posture, steady pace', suggestedLoad: '16-20 kg each', category: 'finisher', targetRegions: [], videoId: '' },
      normal: { id: 'dl-fin-db-n', name: 'KB Swing + Shuttle', sets: 1, reps: '6 min (10 swings, 20m shuttle)', cue: 'Explosive hips, quick transitions (Edgley)', suggestedLoad: '16-20 kg', category: 'finisher', targetRegions: [], videoId: '' },
      hard: { id: 'dl-fin-db-h', name: 'DB Man Maker', sets: 1, reps: '8 min AMRAP', cue: 'Push-up, row each side, clean, press (Edgley)', suggestedLoad: '10-14 kg each', category: 'finisher', targetRegions: [], videoId: '' },
    },
    fullgym: {
      easy: { id: 'dl-fin-fg-e', name: 'Prowler Drag (light)', sets: 1, reps: '4 min (20m drags)', cue: 'Face sled, drag backward, easy pace', suggestedLoad: '40-60 kg sled', category: 'finisher', targetRegions: [], videoId: '' },
      normal: { id: 'dl-fin-fg-n', name: 'Rower Sprints', sets: 1, reps: '6 min (200m sprint / 30s rest)', cue: 'Powerful leg drive, damper 6-7 (Edgley)', suggestedLoad: 'Rower', category: 'finisher', targetRegions: [], videoId: '' },
      hard: { id: 'dl-fin-fg-h', name: 'Prowler Push/Pull + Bike', sets: 1, reps: '8 min (push 20m, pull 20m, 10 cal bike)', cue: 'No rest between stations (Edgley)', suggestedLoad: '60-80 kg sled + bike', category: 'finisher', targetRegions: [], videoId: '' },
    },
  },
};

const ORM_TEST: Record<SessionType, Record<EquipmentTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-1rm-bw-1', name: 'BW Squat Warm-Up', sets: 2, reps: '10', cue: 'Full depth, controlled', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: [], videoId: '' },
      { id: 'sq-1rm-bw-2', name: 'Max Rep Bodyweight Squat', sets: 3, reps: 'Max reps (2 min rest)', cue: 'Full depth every rep, stop when form breaks', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: [], videoId: '' },
    ],
    dumbbells: [
      { id: 'sq-1rm-db-1', name: 'Goblet Squat Warm-Up', sets: 3, reps: '8, 5, 3 (ramp up)', cue: 'Increase weight each set', suggestedLoad: '8 / 12 / 16 kg', category: 'warmup', targetRegions: [], videoId: '' },
      { id: 'sq-1rm-db-2', name: 'Goblet Squat Heavy Single', sets: 5, reps: '3, 2, 1, 1, 1 (ramp)', cue: 'Find heaviest clean single (Horschig)', suggestedLoad: 'Build to max', category: 'main', targetRegions: [], videoId: '' },
    ],
    fullgym: [
      { id: 'sq-1rm-fg-1', name: 'Back Squat Warm-Up', sets: 4, reps: '8, 5, 3, 2 (ramp up)', cue: 'Bar, 40%, 60%, 75% of estimated max', suggestedLoad: 'Ramp up', category: 'warmup', targetRegions: [], videoId: '' },
      { id: 'sq-1rm-fg-2', name: 'Back Squat 1RM Attempts', sets: 3, reps: '1 (3-5 min rest)', cue: 'Attempt 90%, 95%, 100%+ of estimated max', suggestedLoad: 'Max attempt', category: 'main', targetRegions: [], videoId: '' },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-1rm-bw-1', name: 'Push-Up Warm-Up', sets: 2, reps: '10', cue: 'Full ROM, controlled', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: [], videoId: '' },
      { id: 'bn-1rm-bw-2', name: 'Max Rep Push-Up Test', sets: 3, reps: 'Max reps (2 min rest)', cue: 'Chest to floor, full lockout, stop at failure', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: [], videoId: '' },
    ],
    dumbbells: [
      { id: 'bn-1rm-db-1', name: 'DB Press Warm-Up', sets: 3, reps: '8, 5, 3 (ramp up)', cue: 'Increase weight each set', suggestedLoad: '8 / 12 / 16 kg', category: 'warmup', targetRegions: [], videoId: '' },
      { id: 'bn-1rm-db-2', name: 'DB Press Heavy Single', sets: 5, reps: '3, 2, 1, 1, 1 (ramp)', cue: 'Find heaviest clean single', suggestedLoad: 'Build to max', category: 'main', targetRegions: [], videoId: '' },
    ],
    fullgym: [
      { id: 'bn-1rm-fg-1', name: 'Bench Press Warm-Up', sets: 4, reps: '8, 5, 3, 2 (ramp up)', cue: 'Bar, 40%, 60%, 75% of estimated max', suggestedLoad: 'Ramp up', category: 'warmup', targetRegions: [], videoId: '' },
      { id: 'bn-1rm-fg-2', name: 'Bench Press 1RM Attempts', sets: 3, reps: '1 (3-5 min rest)', cue: 'Attempt 90%, 95%, 100%+ of estimated max', suggestedLoad: 'Max attempt', category: 'main', targetRegions: [], videoId: '' },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-1rm-bw-1', name: 'Hinge Warm-Up', sets: 2, reps: '10', cue: 'Bodyweight hinge, feel hamstrings', suggestedLoad: 'Bodyweight', category: 'warmup', targetRegions: [], videoId: '' },
      { id: 'dl-1rm-bw-2', name: 'Max Rep Single-Leg Hinge', sets: 3, reps: 'Max reps each (2 min rest)', cue: 'Maintain flat back throughout', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: [], videoId: '' },
    ],
    dumbbells: [
      { id: 'dl-1rm-db-1', name: 'DB RDL Warm-Up', sets: 3, reps: '8, 5, 3 (ramp up)', cue: 'Increase weight each set', suggestedLoad: '10 / 16 / 20 kg', category: 'warmup', targetRegions: [], videoId: '' },
      { id: 'dl-1rm-db-2', name: 'DB RDL Heavy Single', sets: 5, reps: '3, 2, 1, 1, 1 (ramp)', cue: 'Find heaviest clean single', suggestedLoad: 'Build to max', category: 'main', targetRegions: [], videoId: '' },
    ],
    fullgym: [
      { id: 'dl-1rm-fg-1', name: 'Deadlift Warm-Up', sets: 4, reps: '5, 3, 2, 1 (ramp up)', cue: 'Bar, 40%, 60%, 80% of estimated max', suggestedLoad: 'Ramp up', category: 'warmup', targetRegions: [], videoId: '' },
      { id: 'dl-1rm-fg-2', name: 'Deadlift 1RM Attempts', sets: 3, reps: '1 (3-5 min rest)', cue: 'Attempt 90%, 95%, 100%+ of estimated max', suggestedLoad: 'Max attempt', category: 'main', targetRegions: [], videoId: '' },
    ],
  },
};

export function getWarmups(sessionType: SessionType, tier: EquipmentTier): ExerciseTemplate[] {
  return WARMUPS[sessionType][tier];
}

export function getMainLift(sessionType: SessionType, tier: EquipmentTier): ExerciseTemplate {
  return MAIN_LIFTS[sessionType][tier];
}

export function getAccessories(sessionType: SessionType, tier: EquipmentTier): ExerciseTemplate[] {
  return ACCESSORIES[sessionType][tier];
}

export function getFinisher(sessionType: SessionType, tier: EquipmentTier, energy: 'easy' | 'normal' | 'hard'): ExerciseTemplate {
  return FINISHERS[sessionType][tier][energy];
}

export function get1RMProtocol(sessionType: SessionType, tier: EquipmentTier): ExerciseTemplate[] {
  return ORM_TEST[sessionType][tier];
}
