import { EquipmentTier, SessionType, PainRegion } from './store';

export type ExerciseCategory = 'prep' | 'mechanical' | 'neuro' | 'main' | 'accessory' | 'prehab' | 'finisher' | 'cooldown';

type MainSessionType = Exclude<SessionType, 'conditioning' | 'prehab' | 'flexibility'>;
type InternalTier = 'bodyweight' | 'dumbbells' | 'fullgym';

export function toInternalTier(tier: EquipmentTier): InternalTier {
  if (tier === 'bands' || tier === 'bodyweight') return 'bodyweight';
  if (tier === 'kettlebells' || tier === 'dumbbells') return 'dumbbells';
  return 'fullgym';
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  sets: number;
  reps: string;
  cue: string;
  suggestedLoad: string;
  category: ExerciseCategory;
  targetRegions: PainRegion[];
  videoId: string;
  swapAlternative?: {
    name: string;
    cue: string;
    suggestedLoad: string;
  };
  comfortVariant?: {
    name: string;
    cue: string;
    suggestedLoad: string;
    triggerRegions: PainRegion[];
  };
}

// ─── CARDIO WARM-UP (Universal — used for ALL sessions including 30 min) ──────

export const CARDIO_WARMUP: ExerciseTemplate = {
  id: 'cardio-warmup', name: 'Cardio Machine Warm-Up', sets: 1, reps: '2 min steady',
  cue: 'Treadmill, bike, rower or brisk walk — start easy, gradually pick up pace. Get the blood moving before any stretching.',
  suggestedLoad: 'Low intensity', category: 'prep', targetRegions: [], videoId: '',
};

// ─── 1. PRE-TRAINING PREPARATION ─────────────────────────────────────────────
// Active mobility, joint prep. Minimum 3 exercises per session for safety.

const PREP: Record<MainSessionType, Record<InternalTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-prep-bw-1', name: 'Hip Flexor Kneeling Stretch', sets: 1, reps: '30s each side', cue: 'Deep lunge, back knee down, tuck pelvis under — feel the front of the hip open', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Couch Stretch', cue: 'Back foot on bench/wall, front knee on ground — deeper hip flexor stretch', suggestedLoad: 'Bodyweight' } },
      { id: 'sq-prep-bw-2', name: '90/90 Hip Switch', sets: 1, reps: '6 slow each side', cue: 'Control the transition through both hip positions — no rushing', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin'], videoId: '', swapAlternative: { name: 'Pigeon Pose Flow', cue: 'Front shin horizontal, breathe into outer hip — hold then pulse 5 reps', suggestedLoad: 'Bodyweight' } },
      { id: 'sq-prep-bw-3', name: "World's Greatest Stretch", sets: 1, reps: '5 each side', cue: 'Lunge forward, elbow to floor, reach arm to sky — pause at each position, feel the full-body stretch', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'upper_back', 'lower_back'], videoId: '', swapAlternative: { name: 'Hip Circle (Standing)', cue: 'Hands on hips, draw large slow circles each direction — open the hip joint', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'sq-prep-db-1', name: 'Hip Flexor Kneeling Stretch', sets: 1, reps: '30s each side', cue: 'Deep lunge, back knee down, tuck pelvis under — feel the front of the hip open', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Couch Stretch', cue: 'Back foot on bench/wall, front knee on ground — deeper hip flexor stretch', suggestedLoad: 'Bodyweight' } },
      { id: 'sq-prep-db-2', name: 'Cossack Squat Flow', sets: 1, reps: '6 each side', cue: 'Heel down, chest tall, shift side to side — ankles and hips open up', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'ankle_achilles', 'knee'], videoId: '', swapAlternative: { name: '90/90 Hip Switch', cue: 'Sit on floor, switch between both hip positions slowly — full hip capsule prep', suggestedLoad: 'Bodyweight' } },
      { id: 'sq-prep-db-3', name: 'Ankle Circles + Dorsiflexion Drill', sets: 1, reps: '10 circles + 10 wall touches each', cue: 'Slow ankle circles each direction, then knee-over-toe against wall — improve squat depth and ankle mobility', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['ankle_achilles', 'knee'], videoId: '', swapAlternative: { name: 'Calf Raise + Slow Lower', cue: 'Rise all the way up, 3s eccentric — ankle strength and mobility', suggestedLoad: 'Bodyweight' } },
    ],
    fullgym: [
      { id: 'sq-prep-fg-1', name: 'Ankle Dorsiflexion Drill', sets: 1, reps: '10 each', cue: 'Knee over toe against wall, heel stays down — improve squat depth', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['ankle_achilles', 'knee'], videoId: '', swapAlternative: { name: 'Ankle Circles + Heel Rocks', cue: 'Circles each direction, then rock heel to toe — full ankle prep', suggestedLoad: 'Bodyweight' } },
      { id: 'sq-prep-fg-2', name: 'Hip Flexor Kneeling Stretch', sets: 1, reps: '30s each side', cue: 'Deep lunge, back knee down, tuck pelvis — stretch the hip flexor before loading', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Couch Stretch', cue: 'Back foot elevated, front knee forward — intense hip flexor opener', suggestedLoad: 'Bodyweight' } },
      { id: 'sq-prep-fg-3', name: 'Banded Hip Circle', sets: 1, reps: '10 each direction', cue: 'Band around knees, feet hip-width, draw large circles with hips — warm up hip capsule before squatting', suggestedLoad: 'Light band', category: 'prep', targetRegions: ['hip_groin', 'knee'], videoId: '', swapAlternative: { name: 'Goblet Squat Stretch', cue: 'Hold a light KB, squat deep and pry knees out — perfect hip and ankle opener', suggestedLoad: '8–12 kg' } },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-prep-bw-1', name: 'Doorway Chest Opener', sets: 1, reps: '30s each side', cue: 'Arm at 90°, step through doorway — feel the pec stretch and breathe into it', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Cross-Body Shoulder Stretch', cue: 'Pull arm across chest, hold 30s — posterior shoulder capsule opener', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-prep-bw-2', name: 'Thoracic Extension on Floor', sets: 1, reps: '8 reps', cue: 'Arms overhead, arch upper back only — no lumbar extension, feel the spine open', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['upper_back', 'front_shoulder'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under body — feel thoracic rotation open up', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-prep-bw-3', name: 'Neck Rolls + Shoulder Circles', sets: 1, reps: '5 each direction', cue: 'Slow controlled circles — neck first, then big arm circles forward and backward. Wake up the shoulder girdle', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['neck', 'front_shoulder', 'rear_shoulder'], videoId: '', swapAlternative: { name: 'Wall Slide', cue: 'Back flat on wall, arms at 90°, slide up — elbows and wrists stay on wall', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'bn-prep-db-1', name: 'Doorway Chest Opener', sets: 1, reps: '30s each side', cue: 'Arm at 90°, step through doorway — feel the pec stretch and breathe into it', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Cross-Body Shoulder Stretch', cue: 'Pull arm across chest, hold 30s — posterior shoulder capsule opener', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-prep-db-2', name: 'Thoracic Extension on Floor', sets: 1, reps: '8 reps', cue: 'Arms overhead, arch upper back only — no lumbar extension, feel the spine open', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['upper_back', 'front_shoulder'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under — thoracic rotation each side', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-prep-db-3', name: 'Wall Slide', sets: 1, reps: '10 slow reps', cue: 'Back flat on wall, arms bent at 90° slide up — keep elbows and wrists on wall throughout. Shoulder health', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'rear_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Shoulder CARs', cue: 'Slow full shoulder circles — controlled articular rotation for joint health', suggestedLoad: 'Bodyweight' } },
    ],
    fullgym: [
      { id: 'bn-prep-fg-1', name: 'Doorway Chest Opener', sets: 1, reps: '30s each side', cue: 'Arm at 90°, step through doorway — feel the pec stretch and breathe into it', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Cross-Body Shoulder Stretch', cue: 'Pull arm across chest — rear deltoid and capsule stretch', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-prep-fg-2', name: 'Shoulder CARs (Controlled Articular Rotations)', sets: 1, reps: '3 slow circles each arm', cue: 'Full shoulder range, move only the shoulder — spine neutral throughout', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '', swapAlternative: { name: 'Wall Slide', cue: 'Back on wall, arms at 90°, slide overhead — perfect scapular prep', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-prep-fg-3', name: 'Band Pull-Apart (Warm-Up)', sets: 1, reps: '15 controlled', cue: 'Arms straight, pull band to chest — squeeze shoulder blades 1s at end. Prime the rear delts and rotator cuff', suggestedLoad: 'Light band', category: 'prep', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Face Pull (light cable)', cue: 'Pull to forehead, external rotate at top — rotator cuff activation', suggestedLoad: 'Light cable' } },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-prep-bw-1', name: 'Cat-Cow Flow', sets: 1, reps: '8 slow reps', cue: 'Full spinal flexion and extension — pause at each end, breathe through movement', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'upper_back'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under — thoracic rotation prep for hinge', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-prep-bw-2', name: "Child's Pose", sets: 1, reps: '30s', cue: 'Arms extended, let hips drop — breathe into lower back and lats', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'hip_groin'], videoId: '', swapAlternative: { name: 'Seated Forward Fold', cue: 'Legs straight, reach for feet — hamstring and lower back stretch', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-prep-bw-3', name: 'Standing Hamstring Reach', sets: 1, reps: '8 each side', cue: 'Stand on one leg, hinge forward reaching for floor — feel the back of your thigh lengthen. Slow and controlled', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'hip_groin'], videoId: '', swapAlternative: { name: 'Inchworm', cue: 'Walk hands out to push-up, walk feet to hands — full-body warm-up chain', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'dl-prep-db-1', name: 'Cat-Cow Flow', sets: 1, reps: '8 slow reps', cue: 'Full spinal flexion and extension — pause at each end, breathe through movement', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'upper_back'], videoId: '', swapAlternative: { name: 'Prone Cobra', cue: 'Face down, lift chest with hands at sides — spinal extension and glute squeeze', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-prep-db-2', name: 'Adductor Rockback', sets: 1, reps: '8 each side', cue: 'Wide stance, rock into each hip — breathe at end range, open the groin', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Butterfly Stretch', cue: 'Soles of feet together, press knees toward floor — inner thigh and hip opener', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-prep-db-3', name: 'Hip Circle (Standing)', sets: 1, reps: '10 each direction', cue: 'Hands on hips, draw large circles — move slowly and feel the hip joint open. Loosen up before hinging', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: '90/90 Hip Switch', cue: 'Sit on floor, transition between hip positions slowly — full hip capsule prep', suggestedLoad: 'Bodyweight' } },
    ],
    fullgym: [
      { id: 'dl-prep-fg-1', name: 'Cat-Cow Flow', sets: 1, reps: '8 slow reps', cue: 'Full spinal flexion and extension — pause at each end, breathe through movement', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'upper_back'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under — thoracic rotation for deadlift prep', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-prep-fg-2', name: 'Adductor Rockback', sets: 1, reps: '8 each side', cue: 'Wide stance, rock into each hip — breathe at end range, open the groin', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Wide-Stance Hip Hinge Stretch', cue: 'Stand wide, hinge forward and hold — hamstrings and inner thighs open', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-prep-fg-3', name: 'Kneeling Thoracic Rotation', sets: 1, reps: '8 each side', cue: 'Kneeling, hand behind head, rotate open to the ceiling — improve thoracic mobility for a better hinge position', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['upper_back', 'lower_back'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under — same thoracic work, different position', suggestedLoad: 'Bodyweight' } },
    ],
  },
};

// ─── 2. MECHANICAL PRIMING ───────────────────────────────────────────────────

const MECHANICAL: Record<MainSessionType, Record<InternalTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-mech-bw-1', name: 'Banded Clamshell', sets: 3, reps: '20 each', cue: 'Heels together, rotate top knee up — constant tension', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Fire Hydrant', cue: 'All fours, lift knee out to side keeping 90° bend — glute activation same pattern', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Lateral Band Walk', cue: 'Band around ankles, stay low, step side to side — glute activation without hip rotation', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'knee'] } },
      { id: 'sq-mech-bw-2', name: 'Glute Bridge Pulse', sets: 3, reps: '25 pulses', cue: 'Small pulsing reps at top — feel the glutes burn, no rest', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Single-Leg Glute Bridge', cue: 'One foot up, drive through the working leg — more glute demand per rep', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'sq-mech-db-1', name: 'Banded Clamshell', sets: 3, reps: '20 each', cue: 'Heels together, rotate top knee up — constant tension', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Fire Hydrant', cue: 'All fours, lift knee out to the side — same glute activation, no band needed', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Lateral Band Walk', cue: 'Band around ankles, stay low, step side to side — glute activation without hip rotation', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'knee'] } },
      { id: 'sq-mech-db-2', name: 'Goblet Squat Primer', sets: 3, reps: '15 slow', cue: '3s down, pause 1s, drive up — just activation weight', suggestedLoad: '8–12 kg per hand', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Sumo Squat Hold', cue: 'Wide stance, feet turned out, hold bottom position 30s — hip and groin opener before squatting', suggestedLoad: 'Bodyweight' } },
    ],
    fullgym: [
      { id: 'sq-mech-fg-1', name: 'Banded Clamshell', sets: 3, reps: '20 each', cue: 'Heels together, rotate top knee up — constant tension', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Fire Hydrant', cue: 'All fours, lift knee out to the side — glute activation alternative', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Lateral Band Walk', cue: 'Band around ankles, stay low, step side to side — glute activation without hip rotation', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'knee'] } },
      { id: 'sq-mech-fg-2', name: 'Goblet Squat Primer', sets: 3, reps: '15 slow', cue: '3s down, pause 1s, drive up — just activation weight', suggestedLoad: '12–16 kg per hand', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Belt Squat (light)', cue: 'Plates suspended, walk in, squat — no spinal load, perfect activation', suggestedLoad: '20–40 kg' } },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-mech-bw-1', name: 'Band Pull-Apart', sets: 3, reps: '20', cue: 'Arms straight, squeeze shoulder blades — pause 1s at chest', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Prone Y-T-W Raise', cue: 'Face down, lift arms in Y then T then W positions — squeeze each for 1s', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-mech-bw-2', name: 'Scapular Push-Up', sets: 3, reps: '15', cue: 'Arms straight, protract scaps forward then retract back — no elbow bend', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'Wall Slide', cue: 'Back flat on wall, slide arms up — scapular activation in opposite direction', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'bn-mech-db-1', name: 'Band Pull-Apart', sets: 3, reps: '20', cue: 'Arms straight, squeeze shoulder blades — pause 1s at chest', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Prone Y-T-W Raise', cue: 'Face down, arms in Y-T-W positions — rotator cuff and rear delt activation', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-mech-db-2', name: 'Light DB External Rotation', sets: 3, reps: '15 each', cue: 'Elbow pinned to side, rotate out slowly — constant tension', suggestedLoad: '2–4 kg per hand', category: 'mechanical', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'Prone Shoulder External Rotation', cue: 'Face down on bench, elbow at 90°, rotate arm up — bodyweight rotator cuff activation', suggestedLoad: 'Bodyweight' } },
    ],
    fullgym: [
      { id: 'bn-mech-fg-1', name: 'Band Pull-Apart', sets: 3, reps: '20', cue: 'Arms straight, squeeze shoulder blades — pause 1s at chest', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Cable Face Pull', cue: 'Pull to forehead, external rotate at top — rotator cuff primer', suggestedLoad: 'Light cable' } },
      { id: 'bn-mech-fg-2', name: 'Face Pull', sets: 3, reps: '15', cue: 'Pull to forehead, externally rotate at end position', suggestedLoad: 'Light cable', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Band Pull-Apart', cue: 'Arms straight, pull to chest — rear delt and scapular activation', suggestedLoad: 'Light band' } },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-mech-bw-1', name: 'Glute Bridge', sets: 3, reps: '20', cue: 'Drive through heels, squeeze top for 2s — feel the posterior chain fire', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Single-Leg Glute Bridge', cue: 'One leg up, drive through working heel — more glute demand each side', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-mech-bw-2', name: 'Bird Dog', sets: 3, reps: '10 each', cue: 'Opposite arm + leg, spine neutral — squeeze glute as leg extends', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['lower_back', 'core_ribs'], videoId: '',
        swapAlternative: { name: 'Dead Bug', cue: 'Flat back, lower opposite arm and leg toward floor — brace hard throughout', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'dl-mech-db-1', name: 'Glute Bridge', sets: 3, reps: '20', cue: 'Drive through heels, squeeze top for 2s — feel the posterior chain fire', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'DB Hip Thrust (activation)', cue: 'Light DB on hips, squeeze at top for 2s — prime the glutes before the main lift', suggestedLoad: '8–12 kg' } },
      { id: 'dl-mech-db-2', name: 'KB Deadbug', sets: 3, reps: '10 each', cue: 'Press KB to ceiling, extend opposite leg — low back flat into floor', suggestedLoad: '4–8 kg per hand', category: 'mechanical', targetRegions: ['core_ribs', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Dead Bug', cue: 'Same pattern without weight — lower opposite arm and leg, keep low back flat', suggestedLoad: 'Bodyweight' } },
    ],
    fullgym: [
      { id: 'dl-mech-fg-1', name: 'Glute Bridge', sets: 3, reps: '20', cue: 'Drive through heels, squeeze top for 2s — feel the posterior chain fire', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Hip Thrust (light bar)', cue: 'Barbell across hips, drive up and squeeze — activation before the main hinge', suggestedLoad: '20–40 kg' } },
      { id: 'dl-mech-fg-2', name: 'Banded Good Morning', sets: 3, reps: '15', cue: 'Band around neck, hinge at hips — feel hamstrings load at bottom', suggestedLoad: 'Medium band', category: 'mechanical', targetRegions: ['lower_back', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Glute Ham Raise (partial)', cue: 'Anchor feet, lower torso partway — hamstring activation without full load', suggestedLoad: 'Bodyweight' } },
    ],
  },
};

// ─── 3. NEUROLOGICAL PRIMING ─────────────────────────────────────────────────

const NEURO: Record<MainSessionType, Record<InternalTier, ExerciseTemplate>> = {
  squat: {
    bodyweight: {
      id: 'sq-neuro-bw', name: 'Squat Jump', sets: 3, reps: '5 explosive', cue: 'Full squat, explode through hips — land soft, absorb with whole leg', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['knee', 'hip_groin'], videoId: '',
      comfortVariant: { name: 'Step-Over High Knee March', cue: 'Exaggerated marching, drive knee up with intention — no impact', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles', 'hip_groin'] },
    },
    dumbbells: {
      id: 'sq-neuro-db', name: 'Box Jump (Step-Down)', sets: 3, reps: '5 jumps', cue: 'Jump to box, step down — reset each rep', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['knee', 'hip_groin'], videoId: '',
      comfortVariant: { name: 'Broad Jump', cue: 'Horizontal jump, land in athletic position, walk back — lower impact', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] },
    },
    fullgym: {
      id: 'sq-neuro-fg', name: 'Box Jump (Step-Down)', sets: 3, reps: '5 jumps', cue: 'Jump to box, step down — reset each rep', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['knee', 'hip_groin'], videoId: '',
      comfortVariant: { name: 'Squat Jump', cue: 'Bodyweight, full depth, land soft — no box needed', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] },
    },
  },
  bench: {
    bodyweight: {
      id: 'bn-neuro-bw', name: 'Explosive Push-Up', sets: 3, reps: '5 explosive', cue: 'Push hard enough to leave floor — land with bent elbows', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['front_shoulder', 'elbow_wrist'], videoId: '',
      comfortVariant: { name: 'Band Punch-Out', cue: 'Band in front, explosive punch extensions — 10 fast reps', suggestedLoad: 'Light band', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    dumbbells: {
      id: 'bn-neuro-db', name: 'Explosive Push-Up', sets: 3, reps: '5 explosive', cue: 'Push hard enough to leave floor — land with bent elbows', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['front_shoulder', 'elbow_wrist'], videoId: '',
      comfortVariant: { name: 'Band Punch-Out', cue: 'Band in front, explosive punch extensions — 10 fast reps', suggestedLoad: 'Light band', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    fullgym: {
      id: 'bn-neuro-fg', name: 'Med Ball Chest Pass (Wall)', sets: 3, reps: '5 explosive', cue: 'Press and release explosively, catch and reload — full intent', suggestedLoad: '4–6 kg ball', category: 'neuro', targetRegions: ['front_shoulder'], videoId: '',
      comfortVariant: { name: 'Explosive Push-Up', cue: 'Push hard enough to leave floor, land soft — no ball needed', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
  },
  deadlift: {
    bodyweight: {
      id: 'dl-neuro-bw', name: 'Broad Jump', sets: 3, reps: '3 explosive', cue: 'Hinge back, swing arms, explode forward — land in athletic hinge', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['hip_groin', 'knee'], videoId: '',
      comfortVariant: { name: 'Standing Long Step', cue: 'Controlled split-stance hinge — slower, focus on hip drive, no impact', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles', 'hip_groin'] },
    },
    dumbbells: {
      id: 'dl-neuro-db', name: 'KB Swing (Explosive)', sets: 3, reps: '5 powerful', cue: 'Hip snap — bell goes where hips send it, not arm pull', suggestedLoad: '16–20 kg', category: 'neuro', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
      comfortVariant: { name: 'Broad Jump', cue: 'Hinge back, swing arms, explode forward — land soft, no load', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'knee'] },
    },
    fullgym: {
      id: 'dl-neuro-fg', name: 'KB Swing (Explosive)', sets: 3, reps: '5 powerful', cue: 'Hip snap — bell goes where hips send it, not arm pull', suggestedLoad: '20–28 kg', category: 'neuro', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
      comfortVariant: { name: 'Broad Jump', cue: 'Hinge back, swing arms, explode forward — land soft, no load', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'knee'] },
    },
  },
};

// ─── 4. KPI LIFT (Main Strength Exercise) ────────────────────────────────────

const MAIN_LIFTS: Record<MainSessionType, Record<InternalTier, ExerciseTemplate>> = {
  squat: {
    bodyweight: {
      id: 'sq-main-bw', name: 'Bodyweight Squat', sets: 4, reps: '15–20 reps', cue: 'Chest up, knees track toes, full depth — 3s eccentric on working sets', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: ['knee', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Tempo Box Squat', cue: '3s down to box, 2s pause, drive up — remove bottom ROM pressure', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'hip_groin', 'ankle_achilles'] },
    },
    dumbbells: {
      id: 'sq-main-db', name: 'Goblet Squat', sets: 4, reps: '10–12 reps', cue: 'Elbows inside knees, vertical torso — build weight each set', suggestedLoad: '16–28 kg per hand', category: 'main', targetRegions: ['knee', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Tempo Goblet Squat', cue: '3s eccentric, pause at bottom, stand tall — lighter load', suggestedLoad: '12–16 kg per hand', triggerRegions: ['knee', 'hip_groin', 'ankle_achilles'] },
    },
    fullgym: {
      id: 'sq-main-fg', name: 'Back Squat', sets: 5, reps: '5–6 reps', cue: 'Brace hard, break hips and knees together — build to your working weight across 3 warm-up sets, then 2 heavy working sets', suggestedLoad: '60–90 kg', category: 'main', targetRegions: ['knee', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Pause Squat / Safety Bar', cue: '2s pause in hole, controlled ascent — reduce load by 20%', suggestedLoad: '40–65 kg', triggerRegions: ['knee', 'hip_groin', 'lower_back', 'ankle_achilles'] },
    },
  },
  bench: {
    bodyweight: {
      id: 'bn-main-bw', name: 'Push-Up', sets: 4, reps: '12–15 reps', cue: 'Elbows 45°, full lockout — add a pause at bottom on your heavier sets', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: ['front_shoulder', 'elbow_wrist'],
      videoId: '',
      comfortVariant: { name: 'Incline Push-Up', cue: 'Hands elevated, reduce shoulder demand — perfect form priority', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    dumbbells: {
      id: 'bn-main-db', name: 'Dumbbell Bench Press', sets: 4, reps: '8–10 reps', cue: 'Neutral grip option, full ROM — build to a challenging weight across warm-up sets', suggestedLoad: '16–28 kg per hand', category: 'main', targetRegions: ['front_shoulder', 'elbow_wrist'],
      videoId: '',
      comfortVariant: { name: 'Floor Dumbbell Press', cue: 'Floor limits depth — protects shoulder end-range', suggestedLoad: '12–20 kg per hand', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    fullgym: {
      id: 'bn-main-fg', name: 'Barbell Bench Press', sets: 5, reps: '5–6 reps', cue: 'Retract scaps, arch, leg drive — build to your working weight across 3 warm-up sets, then 2 heavy working sets', suggestedLoad: '50–80 kg', category: 'main', targetRegions: ['front_shoulder', 'elbow_wrist'],
      videoId: '',
      comfortVariant: { name: 'Close-Grip Bench Press', cue: 'Elbows tucked, reduced shoulder stress — lighter load', suggestedLoad: '40–60 kg', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
  },
  deadlift: {
    bodyweight: {
      id: 'dl-main-bw', name: 'Single-Leg Hinge', sets: 4, reps: '10 reps each side', cue: 'Hinge at hip, flat back, reach for floor — squeeze glute at top', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Supported Hip Hinge', cue: 'Hands on wall, feel hamstring stretch — remove balance demand', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'hip_groin', 'knee'] },
    },
    dumbbells: {
      id: 'dl-main-db', name: 'Romanian Deadlift', sets: 4, reps: '8–10 reps', cue: 'Push hips back, DBs track close to legs — build to a challenging weight across warm-up sets', suggestedLoad: '18–28 kg per hand', category: 'main', targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Single-Leg DB RDL', cue: 'One leg, lighter load — better hip dissociation', suggestedLoad: '10–16 kg per hand', triggerRegions: ['lower_back', 'hip_groin', 'knee'] },
    },
    fullgym: {
      id: 'dl-main-fg', name: 'Barbell Deadlift', sets: 5, reps: '4–5 reps', cue: 'Wedge into bar, push floor away — build to your working weight across 3 warm-up sets, then 2 heavy working sets', suggestedLoad: '80–130 kg', category: 'main', targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      comfortVariant: { name: 'Trap Bar Deadlift', cue: 'Neutral grip, more upright torso — reduce spinal stress', suggestedLoad: '60–100 kg', triggerRegions: ['lower_back', 'hip_groin', 'knee'] },
    },
  },
};

// ─── 5. PUMP ACCESSORIES (Hypertrophy) ───────────────────────────────────────

const ACCESSORIES: Record<MainSessionType, Record<InternalTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-acc-bw-1', name: 'Reverse Lunge', sets: 3, reps: '15 each', cue: 'Step back, knee lightly taps floor, drive through front foot', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        comfortVariant: { name: 'Supported Reverse Lunge', cue: 'Hand on wall for balance — knee pain management', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] } },
      { id: 'sq-acc-bw-2', name: 'Glute Bridge', sets: 3, reps: '20', cue: 'Drive through heels, full hip extension — squeeze 2s at top', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Banded Clamshell', cue: 'Side-lying, controlled hip abduction', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'sq-acc-bw-3', name: 'Banded Lateral Walk', sets: 3, reps: '15 each direction', cue: 'Stay low, knees out — continuous tension on band', suggestedLoad: 'Medium band', category: 'accessory', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Lateral Step-Up', cue: 'Step sideways onto a box or step — glute and hip abductor load through range', suggestedLoad: 'Bodyweight' } },
      { id: 'sq-acc-bw-4', name: 'Wall Sit', sets: 2, reps: '45s', cue: 'Thighs parallel, back flat — breathe steadily', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['knee'], videoId: '',
        swapAlternative: { name: 'Isometric Split Squat Hold', cue: 'Lunge position, hold still at 90° — single-leg quad endurance version', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'sq-acc-db-1', name: 'DB Bulgarian Split Squat', sets: 3, reps: '15 each', cue: 'Upright torso, front knee tracks toe — pump reps, lighter weight', suggestedLoad: '8–14 kg per hand', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        comfortVariant: { name: 'DB Supported Split Squat', cue: 'One hand on rack, reduce load for knee sensitivity', suggestedLoad: '6–10 kg per hand', triggerRegions: ['knee', 'ankle_achilles'] } },
      { id: 'sq-acc-db-2', name: 'DB Hip Thrust', sets: 3, reps: '15', cue: 'DB on hips, full extension — 2s squeeze at top', suggestedLoad: '16–24 kg per hand', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Glute Bridge', cue: 'Bodyweight, higher reps — hip pain management', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'sq-acc-db-3', name: 'DB Step-Up', sets: 3, reps: '12 each', cue: 'Drive through top foot, stand fully — no push off back leg', suggestedLoad: '10–16 kg per hand', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'DB Reverse Lunge', cue: 'Step back, control the descent — same muscles, better balance accessibility', suggestedLoad: '8–14 kg per hand' } },
    ],
    fullgym: [
      { id: 'sq-acc-fg-1', name: 'Dumbbell Walking Lunge', sets: 3, reps: '12 each', cue: 'DBs at sides, controlled steps, upright torso — pump focus', suggestedLoad: '10–18 kg each hand', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        comfortVariant: { name: 'Bodyweight Reverse Lunge', cue: 'BW only, focus on control and range', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] } },
      { id: 'sq-acc-fg-2', name: 'Leg Press', sets: 3, reps: '15–20', cue: 'Full ROM, dont lock knees at top — slow 3s down', suggestedLoad: '80–120 kg', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        comfortVariant: { name: 'Leg Press (Partial ROM)', cue: 'Top half of range only — reduces knee compression', suggestedLoad: '60–80 kg', triggerRegions: ['knee'] } },
      { id: 'sq-acc-fg-3', name: 'Barbell Hip Thrust', sets: 3, reps: '15', cue: 'Full extension, 2s pause at top — squeeze glutes hard', suggestedLoad: '40–70 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'DB Hip Thrust', cue: 'Same movement with dumbbells — easier to set up, same glute stimulus', suggestedLoad: '20–32 kg per hand' } },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-acc-bw-1', name: 'Diamond Push-Up', sets: 3, reps: '15–20', cue: 'Hands close together, elbows track back — feel the triceps', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['elbow_wrist', 'front_shoulder'], videoId: '',
        comfortVariant: { name: 'Knee Diamond Push-Up', cue: 'Knees down, reduce load — elbow/shoulder management', suggestedLoad: 'Bodyweight', triggerRegions: ['elbow_wrist', 'front_shoulder'] } },
      { id: 'bn-acc-bw-2', name: 'Inverted Row (Table/Bar)', sets: 3, reps: '15', cue: 'Pull chest to bar, squeeze back at top — body plank-straight', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        comfortVariant: { name: 'Band Pull-Apart', cue: 'High reps, light band — shoulder health', suggestedLoad: 'Light band', triggerRegions: ['rear_shoulder', 'upper_back', 'elbow_wrist'] } },
      { id: 'bn-acc-bw-3', name: 'Pike Push-Up', sets: 3, reps: '12', cue: 'Hips high, head through arms at bottom — vertical push pattern', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['front_shoulder'], videoId: '',
        comfortVariant: { name: 'Banded Lateral Raise', cue: 'Light band, controlled — shoulder sensitive alternative', suggestedLoad: 'Light band', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck'] } },
      { id: 'bn-acc-bw-4', name: 'Prone Y-T-W Raise', sets: 2, reps: '10 each', cue: 'Face down, lift arms in Y, T, W — squeeze each position for 1s', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Band Pull-Apart (high reps)', cue: 'Light band, 30 reps — same rear delt and rhomboid stimulus standing', suggestedLoad: 'Light band' } },
    ],
    dumbbells: [
      { id: 'bn-acc-db-1', name: 'DB Single-Arm Row', sets: 3, reps: '15 each', cue: 'Pull to hip, squeeze lat — slow 3s down', suggestedLoad: '14–22 kg per hand', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'Band Pull-Apart', cue: 'Light resistance, high reps — shoulder health', suggestedLoad: 'Light band', triggerRegions: ['rear_shoulder', 'upper_back', 'elbow_wrist'] } },
      { id: 'bn-acc-db-2', name: 'DB Lateral Raise', sets: 3, reps: '15–20', cue: 'Slight forward lean, thumbs up — slow and controlled', suggestedLoad: '4–8 kg per hand', category: 'accessory', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'Cable/Band Lateral Raise', cue: 'Pull-through path, less impingement risk', suggestedLoad: '2–4 kg per hand', triggerRegions: ['front_shoulder', 'rear_shoulder'] } },
      { id: 'bn-acc-db-3', name: 'DB Tricep Overhead Extension', sets: 3, reps: '15', cue: 'Elbows forward, full ROM — slow negative', suggestedLoad: '8–14 kg per hand', category: 'accessory', targetRegions: ['elbow_wrist'], videoId: '',
        swapAlternative: { name: 'DB Skull Crusher', cue: 'Lie flat, lower DBs to temples — same tricep long head with different elbow angle', suggestedLoad: '6–10 kg per hand' } },
    ],
    fullgym: [
      { id: 'bn-acc-fg-1', name: 'Barbell Bent-Over Row', sets: 3, reps: '12–15', cue: 'Flat back, pull to sternum — pump weight, faster reps', suggestedLoad: '40–60 kg', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'Cable Face Pull', cue: 'Light weight, high reps, external rotation at top', suggestedLoad: '10–15 kg', triggerRegions: ['rear_shoulder', 'upper_back', 'lower_back'] } },
      { id: 'bn-acc-fg-2', name: 'Overhead Press', sets: 3, reps: '10–12', cue: 'Brace core, press through ceiling — pump weight', suggestedLoad: '30–45 kg', category: 'accessory', targetRegions: ['front_shoulder'], videoId: '',
        comfortVariant: { name: 'Landmine Press', cue: 'Angled press, shoulder-friendly arc', suggestedLoad: '15–25 kg', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck'] } },
      { id: 'bn-acc-fg-3', name: 'Cable Tricep Pushdown', sets: 3, reps: '20', cue: 'Elbows pinned, full extension at bottom — constant tension', suggestedLoad: '15–25 kg', category: 'accessory', targetRegions: ['elbow_wrist'], videoId: '',
        swapAlternative: { name: 'Overhead Cable Tricep Extension', cue: 'Cable behind head, extend to ceiling — hits long head more, great stretch', suggestedLoad: '10–18 kg' } },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-acc-bw-1', name: 'Glute Bridge March', sets: 3, reps: '15 each', cue: 'Hips level throughout, alternate legs — glutes stay engaged', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying, squeeze and hold 5s — hip/back sensitivity', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-acc-bw-2', name: 'Superman Hold', sets: 3, reps: '10 (3s holds)', cue: 'Lift arms and legs, squeeze back — lower back hypertrophy', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['upper_back', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Bird Dog', cue: 'Opposite arm and leg, stable spine — back-friendly', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'upper_back'] } },
      { id: 'dl-acc-bw-3', name: 'Bear Crawl', sets: 3, reps: '20 steps forward', cue: 'Knees hover 2cm off ground, move contralateral limbs — tight core', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['core_ribs', 'front_shoulder'], videoId: '',
        swapAlternative: { name: 'Dead Bug', cue: 'Flat back, lower opposite arm and leg — same core anti-extension, floor-based', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-acc-bw-4', name: 'Banded Good Morning', sets: 3, reps: '20', cue: 'Band around neck, hinge — feel hamstrings stretch and load', suggestedLoad: 'Medium band', category: 'accessory', targetRegions: ['lower_back', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Romanian Deadlift (bodyweight)', cue: 'Hinge at hips, reach for floor — same hamstring loading without any load', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'dl-acc-db-1', name: 'DB Hip Thrust', sets: 3, reps: '15', cue: 'DB on hips, full extension, 2s squeeze — posterior chain pump', suggestedLoad: '16–24 kg per hand', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Glute Bridge', cue: 'Bodyweight, higher reps, controlled', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-acc-db-2', name: 'DB Bent-Over Row', sets: 3, reps: '15 each', cue: 'Flat back, pull to hip, squeeze lat — pump focus', suggestedLoad: '14–20 kg per hand', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'Chest-Supported DB Row', cue: 'Incline bench — removes low back stress', suggestedLoad: '10–14 kg per hand', triggerRegions: ['lower_back', 'upper_back'] } },
      { id: 'dl-acc-db-3', name: 'KB Swing', sets: 3, reps: '20', cue: 'Hip snap, arms are ropes — bell floats to chest height', suggestedLoad: '14–20 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'DB Deadlift (light, fast reps)', cue: 'Lighter than working weight, explosive concentric — power endurance version of the hinge', suggestedLoad: '12–18 kg per hand' } },
    ],
    fullgym: [
      { id: 'dl-acc-fg-1', name: 'Barbell Hip Thrust', sets: 3, reps: '15', cue: 'Full extension, 2s pause, squeeze — posterior chain pump', suggestedLoad: '40–70 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        comfortVariant: { name: 'Bodyweight Glute Bridge', cue: 'BW, higher reps, no spinal load', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-acc-fg-2', name: 'Pendlay Row', sets: 3, reps: '12', cue: 'Dead stop each rep, explosive pull — back strength support', suggestedLoad: '40–60 kg', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        comfortVariant: { name: 'Seated Cable Row', cue: 'Upright torso, removes lower back demand', suggestedLoad: '30–45 kg', triggerRegions: ['lower_back', 'upper_back'] } },
      { id: 'dl-acc-fg-3', name: 'Farmers Carry', sets: 3, reps: '40m', cue: 'Tall posture, grip tight, brace core — walk with purpose', suggestedLoad: '24–36 kg per hand', category: 'accessory', targetRegions: ['core_ribs', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Suitcase Carry (single arm)', cue: 'One heavy dumbbell, resist lateral lean — oblique and core demand', suggestedLoad: '24–40 kg one hand' } },
    ],
  },
};

// ─── 6. PREHAB (Joint Health & Balance) ──────────────────────────────────────

const PREHAB: Record<MainSessionType, Record<InternalTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-ph-bw-1', name: 'Standing Calf Raise', sets: 2, reps: '20', cue: 'Full range — rise to toes, lower slowly (ankle health)', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['ankle_achilles', 'calf_shin'], videoId: '',
        swapAlternative: { name: 'Heel Drop (Eccentric)', cue: 'Heels off step edge, lower 3s — eccentric load for Achilles health', suggestedLoad: 'Bodyweight' } },
      { id: 'sq-ph-bw-2', name: 'Hip Flexor Stretch', sets: 2, reps: '30s each', cue: 'Deep lunge, back knee down, tuck pelvis — breathe into hip flexor', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Pigeon Pose', cue: 'Front shin horizontal, breathe into outer hip — deeper hip prehab stretch', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'sq-ph-db-1', name: 'Standing Calf Raise', sets: 2, reps: '20', cue: 'Full range — rise to toes, lower slowly (ankle health)', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['ankle_achilles', 'calf_shin'], videoId: '',
        swapAlternative: { name: 'Seated Calf Raise', cue: 'Seated, weight on knees — targets soleus specifically', suggestedLoad: '10–16 kg' } },
      { id: 'sq-ph-db-2', name: 'Adductor Side-Lying Stretch', sets: 2, reps: '30s each', cue: 'Side-lying, top leg long, breathe into inner thigh', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Butterfly Stretch', cue: 'Seated, soles together, press knees toward floor — inner thigh and groin prehab', suggestedLoad: 'Bodyweight' } },
    ],
    fullgym: [
      { id: 'sq-ph-fg-1', name: 'Standing Calf Raise (loaded)', sets: 2, reps: '15', cue: 'Hold DB, full range — rise and lower with 3s eccentric', suggestedLoad: '10–16 kg', category: 'prehab', targetRegions: ['ankle_achilles', 'calf_shin'], videoId: '',
        swapAlternative: { name: 'Single-Leg Calf Raise', cue: 'One leg, full range — double the load demand on each calf', suggestedLoad: 'Bodyweight' } },
      { id: 'sq-ph-fg-2', name: 'Hip Flexor Stretch', sets: 2, reps: '30s each', cue: 'Deep lunge, back knee down, tuck pelvis — breathe into hip flexor', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Couch Stretch', cue: 'Rear foot elevated, front knee tracking — intense hip flexor prehab', suggestedLoad: 'Bodyweight' } },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-ph-bw-1', name: 'Doorway Chest Stretch', sets: 2, reps: '30s each side', cue: 'Arm at 90°, step through doorway — feel pec stretch', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['front_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Cross-Body Shoulder Stretch', cue: 'Pull arm across chest — rear deltoid and posterior capsule prehab', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-ph-bw-2', name: 'Prone Shoulder External Rotation', sets: 2, reps: '12 each', cue: 'Face down, elbow at 90°, rotate arm up — rotator cuff health', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['rear_shoulder', 'front_shoulder'], videoId: '',
        swapAlternative: { name: 'Wall Slide', cue: 'Back on wall, arms slide up — scapular control and shoulder health', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'bn-ph-db-1', name: 'DB Shoulder External Rotation', sets: 2, reps: '12 each', cue: 'Elbow at 90°, rotate out slowly — rotator cuff health', suggestedLoad: '2–4 kg per hand', category: 'prehab', targetRegions: ['rear_shoulder', 'front_shoulder'], videoId: '',
        swapAlternative: { name: 'Prone Shoulder External Rotation', cue: 'Face down, elbow at 90° — bodyweight version of the same rotator cuff drill', suggestedLoad: 'Bodyweight' } },
      { id: 'bn-ph-db-2', name: 'Thoracic Extension (foam roll)', sets: 2, reps: '30s at each level', cue: 'Roll thoracic spine section by section — upper back mobility', suggestedLoad: 'Foam roller', category: 'prehab', targetRegions: ['upper_back', 'front_shoulder'], videoId: '',
        swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under — thoracic mobility without foam roller', suggestedLoad: 'Bodyweight' } },
    ],
    fullgym: [
      { id: 'bn-ph-fg-1', name: 'Cable External Rotation', sets: 2, reps: '12 each', cue: 'Elbow pinned, rotate arm out — shoulder joint health', suggestedLoad: '3–6 kg', category: 'prehab', targetRegions: ['rear_shoulder', 'front_shoulder'], videoId: '',
        swapAlternative: { name: 'Band External Rotation', cue: 'Elbow pinned to side, rotate out against band — rotator cuff prehab', suggestedLoad: 'Light band' } },
      { id: 'bn-ph-fg-2', name: 'Thoracic Extension (foam roll)', sets: 2, reps: '30s at each level', cue: 'Roll thoracic spine section by section — upper back mobility', suggestedLoad: 'Foam roller', category: 'prehab', targetRegions: ['upper_back', 'front_shoulder'], videoId: '',
        swapAlternative: { name: 'Cat-Cow Flow', cue: 'Full spinal flexion and extension — thoracic mobility without foam roller', suggestedLoad: 'Bodyweight' } },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-ph-bw-1', name: 'Standing Hamstring Stretch', sets: 2, reps: '30s each', cue: 'Foot on low surface, hinge forward — feel posterior chain lengthen', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['lower_back', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Seated Forward Fold', cue: 'Legs straight, reach forward — hamstring prehab stretch from the floor', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-ph-bw-2', name: 'Pigeon Pose', sets: 2, reps: '30s each', cue: 'Front shin parallel, breathe into outer hip — hip capsule stretch', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Figure-4 Stretch', cue: 'On back, cross ankle over knee, pull toward chest — hip external rotator prehab', suggestedLoad: 'Bodyweight' } },
    ],
    dumbbells: [
      { id: 'dl-ph-db-1', name: 'Standing Hamstring Stretch', sets: 2, reps: '30s each', cue: 'Foot on low surface, hinge forward — feel posterior chain lengthen', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['lower_back', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Lying Hamstring Stretch', cue: 'On back, pull one leg toward chest — same hamstring prehab in a relaxed position', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-ph-db-2', name: 'Adductor Side-Lying Stretch', sets: 2, reps: '30s each', cue: 'Side-lying, top leg long — breathe into inner thigh', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin', 'calf_shin'], videoId: '',
        swapAlternative: { name: 'Butterfly Stretch', cue: 'Seated, soles together, press knees toward floor — inner thigh prehab', suggestedLoad: 'Bodyweight' } },
    ],
    fullgym: [
      { id: 'dl-ph-fg-1', name: 'Standing Hamstring Stretch', sets: 2, reps: '30s each', cue: 'Foot on low surface, hinge forward — feel posterior chain lengthen', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['lower_back', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Nordic Hamstring Curl (slow eccentric)', cue: 'Ankles secured, lower your body slowly — strong eccentric hamstring prehab', suggestedLoad: 'Bodyweight' } },
      { id: 'dl-ph-fg-2', name: 'Pigeon Pose', sets: 2, reps: '30s each', cue: 'Front shin parallel, breathe into outer hip — hip capsule stretch', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Figure-4 Stretch', cue: 'On back, ankle over knee, pull toward chest — hip prehab with less hip flexion demand', suggestedLoad: 'Bodyweight' } },
    ],
  },
};

// ─── 7. CONDITIONING FINISHER (Optional) ─────────────────────────────────────

const FINISHERS: Record<MainSessionType, Record<InternalTier, { easy: ExerciseTemplate; normal: ExerciseTemplate; hard: ExerciseTemplate }>> = {
  squat: {
    bodyweight: {
      easy: { id: 'sq-fin-bw-e', name: 'Steady Walk / Light Jog', sets: 1, reps: '4 min', cue: 'Easy pace — let heart rate settle and breathing return', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Marching in Place', cue: 'High knees, steady rhythm — low impact active recovery', suggestedLoad: 'Bodyweight' } },
      normal: { id: 'sq-fin-bw-n', name: 'Jump Rope Intervals', sets: 1, reps: '6 min (30s on / 15s rest)', cue: 'Light bounces, stay on toes — keep rhythm', suggestedLoad: 'Jump rope', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Stepping Jacks', cue: 'Step side to side, arms overhead — same cardio effect without the impact', suggestedLoad: 'Bodyweight' } },
      hard: { id: 'sq-fin-bw-h', name: 'Burpee Ladder', sets: 1, reps: '8 min (1-2-3-4-3-2-1)', cue: 'Full extension at top, chest to floor — move fast', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Squat Jump + Push-Up Intervals', cue: '10 squat jumps then 10 push-ups, repeat — lower impact than burpees', suggestedLoad: 'Bodyweight' } },
    },
    dumbbells: {
      easy: { id: 'sq-fin-db-e', name: 'Stationary Bike / Walk', sets: 1, reps: '4 min easy', cue: 'Low resistance, steady pace — recovery conditioning', suggestedLoad: 'Machine', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Light Farmer Walk', cue: 'Walk slowly with light weights — gentle active recovery', suggestedLoad: '8–12 kg per hand' } },
      normal: { id: 'sq-fin-db-n', name: 'KB Swing Intervals', sets: 1, reps: '6 min (15 swings / 30s rest)', cue: 'Hip snap, bell to chest height — keep moving', suggestedLoad: '14–20 kg', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Goblet Squat Intervals', cue: '15 goblet squats, 30s rest — same legs focus, lower impact', suggestedLoad: '12–16 kg' } },
      hard: { id: 'sq-fin-db-h', name: 'DB Thruster + Shuttle Run', sets: 1, reps: '8 min AMRAP', cue: '5 thrusters then 20m shuttle — push the pace', suggestedLoad: '10–14 kg per hand', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'DB Squat + Press Intervals', cue: '10 squat to press, 30s rest — full-body finisher without the sprint', suggestedLoad: '10–14 kg per hand' } },
    },
    fullgym: {
      easy: { id: 'sq-fin-fg-e', name: 'Light Sled Drag', sets: 1, reps: '4 min continuous', cue: 'Backward drag, easy pace — active recovery', suggestedLoad: '40–60 kg sled', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Treadmill Walk (incline)', cue: '10% incline, comfortable pace — easy active recovery, no sled needed', suggestedLoad: 'Bodyweight' } },
      normal: { id: 'sq-fin-fg-n', name: 'Sled Push Intervals', sets: 1, reps: '6 min (20m push / walk back)', cue: 'Arms extended, drive through legs — push hard', suggestedLoad: '60–80 kg sled', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Rowing Machine Intervals', cue: '30s hard row, 30s easy — full-body conditioning without sled', suggestedLoad: 'Rower' } },
      hard: { id: 'sq-fin-fg-h', name: 'Sled Push/Pull Complex', sets: 1, reps: '8 min (push 20m, drag 20m)', cue: 'Push then drag, minimal rest between efforts', suggestedLoad: '60–100 kg sled', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Assault Bike + Squat Jump Circuit', cue: '20s bike sprint then 10 squat jumps, repeat — hard finisher without sled', suggestedLoad: 'Assault bike' } },
    },
  },
  bench: {
    bodyweight: {
      easy: { id: 'bn-fin-bw-e', name: 'Shadow Boxing', sets: 1, reps: '4 min easy', cue: 'Light punches, keep moving — active recovery', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Arm Circles + Step Touch', cue: 'Gentle shoulder circles then side steps — very low-impact active recovery', suggestedLoad: 'Bodyweight' } },
      normal: { id: 'bn-fin-bw-n', name: 'Mountain Climber Intervals', sets: 1, reps: '6 min (20s on / 10s rest)', cue: 'Hands under shoulders, drive knees — keep hips down', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Push-Up + Plank Intervals', cue: '10 push-ups then 20s plank hold, repeat — same muscles, lower heart rate demand', suggestedLoad: 'Bodyweight' } },
      hard: { id: 'bn-fin-bw-h', name: 'Burpee to Broad Jump', sets: 1, reps: '8 min AMRAP', cue: 'Burpee then jump forward, walk back — no stopping', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Explosive Push-Up + Squat Jump Circuit', cue: '8 explosive push-ups then 8 squat jumps, repeat — high intensity without the full burpee', suggestedLoad: 'Bodyweight' } },
    },
    dumbbells: {
      easy: { id: 'bn-fin-db-e', name: 'Light Bike / Row', sets: 1, reps: '4 min easy', cue: 'Steady pace, calm breathing — gentle cardio', suggestedLoad: 'Machine', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Light DB Lateral Raise Walk', cue: 'Walk slowly raising arms to shoulder height, lower — gentle shoulder recovery', suggestedLoad: '4–6 kg per hand' } },
      normal: { id: 'bn-fin-db-n', name: 'Rower Intervals', sets: 1, reps: '6 min (250m hard / 30s easy)', cue: 'Drive with legs, pull to chest — legs do the work', suggestedLoad: 'Rower', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'DB Push Press Intervals', cue: '12 push presses, 30s rest — power finisher without the machine', suggestedLoad: '10–14 kg per hand' } },
      hard: { id: 'bn-fin-db-h', name: 'DB Complex', sets: 1, reps: '8 min EMOM: 5 cleans + 5 press', cue: 'Light DBs, move fast — no dropping between movements', suggestedLoad: '8–12 kg per hand', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Push-Up + DB Row EMOM', cue: 'Every minute: 8 push-ups + 6 rows each arm — easier to pace than the full complex', suggestedLoad: '10–14 kg per hand' } },
    },
    fullgym: {
      easy: { id: 'bn-fin-fg-e', name: 'Light Bike Spin', sets: 1, reps: '4 min easy', cue: 'Low resistance, steady cadence — active recovery', suggestedLoad: 'Bike', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Incline Treadmill Walk', cue: 'Steady pace, moderate incline — low-impact recovery cardio', suggestedLoad: 'Bodyweight' } },
      normal: { id: 'bn-fin-fg-n', name: 'Assault Bike Intervals', sets: 1, reps: '6 min (20s sprint / 40s easy)', cue: 'All-out on sprints, survive rest — upper and lower', suggestedLoad: 'Assault bike', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Rowing Machine Intervals', cue: '20s hard row, 40s easy — same cardio stimulus, arms and legs', suggestedLoad: 'Rower' } },
      hard: { id: 'bn-fin-fg-h', name: 'Sled Push + Assault Bike', sets: 1, reps: '8 min (push 20m, bike 15 cal)', cue: 'Alternate rounds, push pace — compete with last round', suggestedLoad: '60 kg sled + bike', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Rowing + Battle Rope Circuit', cue: '200m row then 20s battle ropes, repeat — intense finisher without the sled', suggestedLoad: 'Rower + battle ropes' } },
    },
  },
  deadlift: {
    bodyweight: {
      easy: { id: 'dl-fin-bw-e', name: 'Walking Lunges', sets: 1, reps: '4 min continuous', cue: 'Easy pace, long strides — legs keep moving', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Step-Up Walk (chair or step)', cue: 'Step up and down slowly — low-impact leg finisher if lunges are too intense', suggestedLoad: 'Bodyweight' } },
      normal: { id: 'dl-fin-bw-n', name: 'Shuttle Run Intervals', sets: 1, reps: '6 min (20m sprints / jog back)', cue: 'Touch the line, quick turns — drive with hips', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Reverse Lunge Intervals', cue: '15 reverse lunges each leg, 30s rest — same hip drive demand without the sprint', suggestedLoad: 'Bodyweight' } },
      hard: { id: 'dl-fin-bw-h', name: 'Bear Crawl + Sprint', sets: 1, reps: '8 min (10m crawl, 20m sprint)', cue: 'Stay low on crawl, explode on sprint — full effort', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Squat Jump + Walking Lunge Circuit', cue: '10 squat jumps then 10m walking lunges, repeat — high intensity without the sprint', suggestedLoad: 'Bodyweight' } },
    },
    dumbbells: {
      easy: { id: 'dl-fin-db-e', name: 'Farmer Walk', sets: 1, reps: '4 min continuous', cue: 'Tall posture, steady pace — grip strength and conditioning', suggestedLoad: '16–20 kg per hand', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Light DB Carry Walk', cue: 'Walk at comfortable pace with lighter weights — easier on grip and lower back', suggestedLoad: '8–12 kg per hand' } },
      normal: { id: 'dl-fin-db-n', name: 'KB Swing + Shuttle', sets: 1, reps: '6 min (10 swings, 20m shuttle)', cue: 'Explosive hips, quick transitions — keep intensity', suggestedLoad: '16–20 kg', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'KB Swing Intervals', cue: '15 swings, 30s rest — same hip power, skip the shuttle', suggestedLoad: '14–20 kg' } },
      hard: { id: 'dl-fin-db-h', name: 'DB Man Maker', sets: 1, reps: '8 min AMRAP', cue: 'Push-up, row each side, clean, press — one fluid complex', suggestedLoad: '10–14 kg per hand', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'DB Deadlift + Push Press Circuit', cue: '8 deadlifts + 8 push presses, repeat — full-body finisher without the complexity', suggestedLoad: '12–16 kg per hand' } },
    },
    fullgym: {
      easy: { id: 'dl-fin-fg-e', name: 'Prowler Drag (light)', sets: 1, reps: '4 min (20m drags)', cue: 'Face sled, drag backward — easy active recovery', suggestedLoad: '40–60 kg sled', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Rowing Machine (easy pace)', cue: 'Long slow strokes, relaxed — low-impact active recovery without sled', suggestedLoad: 'Rower' } },
      normal: { id: 'dl-fin-fg-n', name: 'Rower Sprints', sets: 1, reps: '6 min (200m sprint / 30s rest)', cue: 'Powerful leg drive, damper 6-7 — legs initiate the pull', suggestedLoad: 'Rower', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Sled Drag Intervals', cue: '20m drag, walk back — same hip hinge demand as rowing, no machine needed', suggestedLoad: '40–60 kg sled' } },
      hard: { id: 'dl-fin-fg-h', name: 'Prowler Push/Pull + Bike', sets: 1, reps: '8 min (push 20m, pull 20m, 10 cal bike)', cue: 'No rest between stations — compete against yourself', suggestedLoad: '60–80 kg sled + bike', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Rowing + Squat Jump Circuit', cue: '250m row then 10 squat jumps, repeat — intense finisher without sled or bike', suggestedLoad: 'Rower' } },
    },
  },
};

// ─── 8. COOL DOWN ─────────────────────────────────────────────────────────────

const COOLDOWN: ExerciseTemplate[] = [
  { id: 'cooldown-1', name: 'Diaphragmatic Breathing', sets: 1, reps: '3 min (slow deep breaths)', cue: 'Inhale through nose 4s, exhale through mouth 6s — down-regulate nervous system, let heart rate drop', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['core_ribs'], videoId: '' },
];

// ─── CONDITIONING SESSION ─────────────────────────────────────────────────────
// Fat burn / cardiovascular focus. HIIT-style circuits.

const CONDITIONING_WORKOUTS: Record<InternalTier, { easy: ExerciseTemplate[]; normal: ExerciseTemplate[]; hard: ExerciseTemplate[] }> = {
  bodyweight: {
    easy: [
      { id: 'cond-bw-e-1', name: 'Cardio Machine Warm-Up', sets: 1, reps: '3 min easy', cue: 'Walk, light jog or marching — gradually raise heart rate to 60% max', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-bw-e-2', name: 'Bodyweight Squat', sets: 3, reps: '20', cue: 'Steady pace, controlled — full depth, breathe out on way up', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-bw-e-3', name: 'Push-Up', sets: 3, reps: '15', cue: 'Steady tempo — no rest between sets, keep going at your own pace', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-bw-e-4', name: 'Alternating Reverse Lunge', sets: 3, reps: '20 total', cue: 'Step back each time, control the descent — keep hips level', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-bw-e-5', name: 'Mountain Climbers', sets: 3, reps: '30s each set', cue: 'Hips level, drive knees alternately — moderate pace', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-bw-e-6', name: 'Cool Down Walk + Breathing', sets: 1, reps: '3 min', cue: 'Slow walk, deep belly breaths — heart rate below 100 bpm before finishing', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
    normal: [
      { id: 'cond-bw-n-1', name: 'Jog / Skip Warm-Up', sets: 1, reps: '2 min', cue: 'Build from walk to jog — get heart rate to 70% max before starting circuits', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-bw-n-2', name: 'Circuit A: Squat Jump + Push-Up + High Knees', sets: 4, reps: '10 / 10 / 20 — 30s rest between rounds', cue: 'Back-to-back with no rest within the round. Squat jump: land soft. Push-up: full ROM. High knees: drive arms', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-bw-n-3', name: 'Circuit B: Burpee + Reverse Lunge + Plank', sets: 4, reps: '8 / 12 each / 30s — 30s rest between rounds', cue: 'Burpee: full lockout at top. Lunge: knee almost touches floor. Plank: brace hard, breathe', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-bw-n-4', name: 'Tabata Finisher: Mountain Climbers', sets: 8, reps: '20s work / 10s rest', cue: 'Max effort on work intervals — this is the final push, give everything', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-bw-n-5', name: 'Cool Down + Stretch', sets: 1, reps: '3 min', cue: 'Hip flexor stretch + forward fold + deep breathing — bring heart rate down properly', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
    hard: [
      { id: 'cond-bw-h-1', name: 'Dynamic Warm-Up', sets: 1, reps: '3 min', cue: 'Leg swings, arm circles, jumping jacks, butt kicks — fully primed before circuits', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-bw-h-2', name: 'Circuit A: Burpee + Squat Jump + Plyo Lunge', sets: 5, reps: '10 / 10 / 10 each — 20s rest between rounds', cue: 'Maximum intent on each rep — land soft on jumps, reset position on lunges', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-bw-h-3', name: 'Circuit B: Sprint (20m) + Push-Up + Bear Crawl (10m)', sets: 5, reps: 'Max sprint / 12 push-ups / 10m crawl — 20s rest', cue: 'Sprint at full effort. Push-ups: chest to floor. Bear crawl: hips low, move fast', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-bw-h-4', name: 'AMRAP Finisher', sets: 1, reps: '8 min: 5 burpees + 10 squat jumps + 15 push-ups', cue: 'Complete as many rounds as possible — track your rounds and try to beat it next time', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-bw-h-5', name: 'Cool Down + Stretch', sets: 1, reps: '3 min', cue: 'Slow walk, hip flexor stretch, quad stretch, deep breathing — full recovery before leaving', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
  },
  dumbbells: {
    easy: [
      { id: 'cond-db-e-1', name: 'Cardio Machine Warm-Up', sets: 1, reps: '3 min easy', cue: 'Bike, rower or treadmill at easy pace — heart rate 60% max', suggestedLoad: 'Low resistance', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-db-e-2', name: 'KB Swing', sets: 4, reps: '15 — 45s rest', cue: 'Hip snap, bell to chest height — controlled and rhythmic', suggestedLoad: '12–16 kg', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-db-e-3', name: 'DB Goblet Squat', sets: 3, reps: '15 — 45s rest', cue: 'Steady tempo, feel the burn — lighter than your strength sessions', suggestedLoad: '10–16 kg per hand', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-db-e-4', name: 'Farmer Walk', sets: 3, reps: '40m each set', cue: 'Tall posture, brace core — steady pace for conditioning', suggestedLoad: '14–20 kg per hand', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-db-e-5', name: 'Cool Down Walk', sets: 1, reps: '3 min', cue: 'Easy walk, breathe deeply — lower heart rate before finishing', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
    normal: [
      { id: 'cond-db-n-1', name: 'Cardio Warm-Up', sets: 1, reps: '2 min', cue: 'Bike or rower, moderate pace — heart rate to 70% max', suggestedLoad: 'Low-moderate resistance', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-db-n-2', name: 'Circuit A: KB Swing + Goblet Squat + Push-Up', sets: 4, reps: '15 swings / 12 squats / 10 push-ups — 30s rest', cue: 'Back-to-back within the round. KB snap drives the swing. Goblet: full depth. Push-up: chest to floor', suggestedLoad: '14–18 kg KB, 12–16 kg per hand goblet', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-db-n-3', name: 'Circuit B: DB Thruster + Renegade Row + Jump Squat', sets: 4, reps: '10 / 8 each / 10 — 30s rest', cue: 'Thruster: squat to press. Renegade row: hips level. Jump squat: land soft and reset', suggestedLoad: '10–14 kg per hand thrusters/rows', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-db-n-4', name: 'EMOM Finisher: KB Swings', sets: 10, reps: '15 swings at start of each minute', cue: 'Start each minute with 15 swings then rest — stay consistent for all 10 minutes', suggestedLoad: '14–20 kg', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-db-n-5', name: 'Cool Down + Stretch', sets: 1, reps: '3 min', cue: 'Easy movement, hip flexor stretch, deep breathing', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
    hard: [
      { id: 'cond-db-h-1', name: 'Dynamic Warm-Up', sets: 1, reps: '3 min', cue: 'Jumping jacks, arm swings, light KB swings — fully primed for hard work', suggestedLoad: 'Light KB', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-db-h-2', name: 'Circuit A: DB Man Maker + Thruster + Swing', sets: 5, reps: '5 man makers / 8 thrusters / 12 swings — 20s rest', cue: 'Man maker: push-up, row each arm, clean, press. Thrusters: full range. Swings: explosive', suggestedLoad: '10–14 kg per hand man makers/thrusters, 16–24 kg swings', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-db-h-3', name: 'Circuit B: KB Snatch + Jump Squat + Renegade Row', sets: 5, reps: '5 each arm / 10 / 8 each — 20s rest', cue: 'Snatch: hip pop, punch up. Jump squat: max height. Row: hips locked', suggestedLoad: '14–20 kg KB, 10–14 kg rows', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-db-h-4', name: 'Tabata Finisher: Alternating Swings', sets: 8, reps: '20s work / 10s rest', cue: 'Alternating single-arm swings — max reps per interval, track total to beat next time', suggestedLoad: '16–20 kg', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-db-h-5', name: 'Cool Down + Stretch', sets: 1, reps: '3 min', cue: 'Light farmer walk, then hip flexor and hamstring stretch, deep breathing', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
  },
  fullgym: {
    easy: [
      { id: 'cond-fg-e-1', name: 'Cardio Machine Warm-Up', sets: 1, reps: '3 min easy', cue: 'Bike, treadmill or rower — easy pace, heart rate 60% max', suggestedLoad: 'Low resistance', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-fg-e-2', name: 'Sled Drag', sets: 4, reps: '30m — 60s rest', cue: 'Face sled, drag backward with controlled steps — low intensity, steady breathing', suggestedLoad: '40–60 kg sled', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-fg-e-3', name: 'Assault Bike (Easy)', sets: 4, reps: '2 min steady', cue: 'Moderate resistance, steady cadence — aerobic zone, conversational pace', suggestedLoad: 'Bike', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-fg-e-4', name: 'Rower (Easy)', sets: 3, reps: '500m — 90s rest', cue: 'Smooth stroke, damper 4-5 — legs, hips, arms in sequence', suggestedLoad: 'Rower', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-fg-e-5', name: 'Cool Down Walk', sets: 1, reps: '3 min', cue: 'Slow treadmill walk or light movement — heart rate below 100 bpm', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
    normal: [
      { id: 'cond-fg-n-1', name: 'Cardio Warm-Up', sets: 1, reps: '3 min', cue: 'Bike or rower, moderate pace — heart rate 70% max before starting', suggestedLoad: 'Moderate resistance', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-fg-n-2', name: 'Circuit A: Sled Push + Assault Bike Sprint', sets: 5, reps: '20m push / 15 cal bike — 30s rest', cue: 'Sled: drive through legs, arms extended. Bike: full effort, arms and legs together', suggestedLoad: '60–80 kg sled', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-fg-n-3', name: 'Circuit B: Rower Sprint + KB Swing + Box Jump', sets: 4, reps: '250m / 15 swings / 8 jumps — 30s rest', cue: 'Row: explosive leg drive. Swing: hip snap. Box jump: step down every rep', suggestedLoad: 'Rower + 16–20 kg KB', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-fg-n-4', name: 'AMRAP Finisher', sets: 1, reps: '8 min: 10 cal bike + 15 KB swings + 10 box jumps', cue: 'Complete as many rounds as possible — note total rounds and compete next session', suggestedLoad: 'As above', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-fg-n-5', name: 'Cool Down', sets: 1, reps: '3 min', cue: 'Easy bike spin, deep breathing — full recovery before leaving the gym', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
    hard: [
      { id: 'cond-fg-h-1', name: 'Dynamic Warm-Up', sets: 1, reps: '3 min', cue: 'Row 500m + 15 box jumps + 10 KB swings — get fully primed', suggestedLoad: 'Light', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-fg-h-2', name: 'Circuit A: Sled Push + Rower Sprint + Assault Bike', sets: 6, reps: '20m push / 200m row / 10 cal bike — 20s rest', cue: 'Maximum effort on all three. Rotate stations immediately — no dawdling', suggestedLoad: '70–90 kg sled', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-fg-h-3', name: 'Circuit B: KB Snatch + Box Jump + Burpee', sets: 5, reps: '5 each arm / 8 / 8 — 20s rest', cue: 'Snatch: explosive hip drive. Box jump: max height, step down. Burpee: full lockout at top', suggestedLoad: '16–24 kg KB', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-fg-h-4', name: 'Partner or Solo Death By: Assault Bike', sets: 1, reps: '1 cal min 1, 2 cal min 2... until failure', cue: 'Start at 1 calorie per minute, add 1 each minute — go until you cannot complete the target before the minute ends', suggestedLoad: 'Assault bike', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-fg-h-5', name: 'Cool Down', sets: 1, reps: '3 min', cue: 'Easy bike spin, hip flexor stretch, deep breathing — mandatory full cool down after this intensity', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
  },
};

// ─── STRENGTH TEST PROTOCOL (AMRAP @ 90%) ────────────────────────────────────
// Safety protocol: clients perform one AMRAP set at a weight they can
// comfortably lift at least twice. Estimated 1RM = weight × (1 + reps ÷ 30).

const ORM_TEST: Record<MainSessionType, Record<InternalTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-1rm-bw-1', name: 'BW Squat Warm-Up', sets: 1, reps: '10', cue: 'Full depth, controlled — prepare joints before the test set', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'sq-1rm-bw-2', name: 'Bodyweight Squat AMRAP', sets: 1, reps: 'AMRAP — max clean reps', cue: 'Full depth every rep — push until form breaks, then stop. Log your total reps.', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: [], videoId: '' },
    ],
    dumbbells: [
      { id: 'sq-1rm-db-1', name: 'Goblet Squat Ramp-Up', sets: 3, reps: '8, 5, 3 (increasing)', cue: 'Increase weight each set to prepare joints — last set should feel moderately hard', suggestedLoad: '8 / 14 / 20 kg', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'sq-1rm-db-2', name: 'Goblet Squat AMRAP @ 90%', sets: 1, reps: 'AMRAP — max clean reps', cue: 'Choose a weight you can comfortably lift at least twice. Do as many clean reps as possible — stop when form breaks. Log weight and reps.', suggestedLoad: '~90% of your working weight', category: 'main', targetRegions: [], videoId: '' },
    ],
    fullgym: [
      { id: 'sq-1rm-fg-1', name: 'Back Squat Ramp-Up', sets: 4, reps: '8, 5, 3, 2 (increasing)', cue: 'Bar → 40% → 60% → 75% of your working weight — prepare for the AMRAP set', suggestedLoad: 'Ramp up', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'sq-1rm-fg-2', name: 'Back Squat AMRAP @ 90%', sets: 1, reps: 'AMRAP — max clean reps', cue: 'Load ~90% of your normal working weight — a weight you can lift at least twice. Do as many perfect reps as possible. Stop at form failure. Log weight and reps.', suggestedLoad: '~90% of working weight', category: 'main', targetRegions: [], videoId: '' },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-1rm-bw-1', name: 'Push-Up Warm-Up', sets: 1, reps: '10', cue: 'Full ROM, controlled — shoulder and chest prep before the test set', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'bn-1rm-bw-2', name: 'Push-Up AMRAP', sets: 1, reps: 'AMRAP — max clean reps', cue: 'Chest to floor, full lockout every rep — stop when you can no longer maintain form. Log your total reps.', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: [], videoId: '' },
    ],
    dumbbells: [
      { id: 'bn-1rm-db-1', name: 'DB Press Ramp-Up', sets: 3, reps: '8, 5, 3 (increasing)', cue: 'Increase weight each set to prepare — last set should feel moderately hard', suggestedLoad: '8 / 14 / 20 kg per hand', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'bn-1rm-db-2', name: 'DB Press AMRAP @ 90%', sets: 1, reps: 'AMRAP — max clean reps', cue: 'Choose a weight you can comfortably press at least twice. Do as many clean reps as possible — stop when form breaks. Log weight and reps.', suggestedLoad: '~90% of your working weight', category: 'main', targetRegions: [], videoId: '' },
    ],
    fullgym: [
      { id: 'bn-1rm-fg-1', name: 'Bench Press Ramp-Up', sets: 4, reps: '8, 5, 3, 2 (increasing)', cue: 'Bar → 40% → 60% → 75% of your working weight — prepare for the AMRAP set', suggestedLoad: 'Ramp up', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'bn-1rm-fg-2', name: 'Bench Press AMRAP @ 90%', sets: 1, reps: 'AMRAP — max clean reps', cue: 'Load ~90% of your normal working weight — a weight you can press at least twice. Do as many perfect reps as possible. Stop at form failure. Log weight and reps.', suggestedLoad: '~90% of working weight', category: 'main', targetRegions: [], videoId: '' },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-1rm-bw-1', name: 'Hinge Warm-Up', sets: 1, reps: '10', cue: 'BW hinge, feel hamstrings load — posterior chain prep before the test set', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'dl-1rm-bw-2', name: 'Single-Leg Hinge AMRAP', sets: 1, reps: 'AMRAP each side — max clean reps', cue: 'Maintain flat back throughout — stop when form breaks. Log your total reps per side.', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: [], videoId: '' },
    ],
    dumbbells: [
      { id: 'dl-1rm-db-1', name: 'DB RDL Ramp-Up', sets: 3, reps: '8, 5, 3 (increasing)', cue: 'Increase weight each set to prepare — last set should feel moderately hard', suggestedLoad: '10 / 18 / 24 kg per hand', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'dl-1rm-db-2', name: 'DB RDL AMRAP @ 90%', sets: 1, reps: 'AMRAP — max clean reps', cue: 'Choose a weight you can comfortably lift at least twice. Do as many clean reps as possible — stop when form breaks. Log weight and reps.', suggestedLoad: '~90% of your working weight', category: 'main', targetRegions: [], videoId: '' },
    ],
    fullgym: [
      { id: 'dl-1rm-fg-1', name: 'Deadlift Ramp-Up', sets: 4, reps: '5, 3, 2, 1 (increasing)', cue: 'Bar → 40% → 60% → 80% of your working weight — prepare for the AMRAP set', suggestedLoad: 'Ramp up', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'dl-1rm-fg-2', name: 'Deadlift AMRAP @ 90%', sets: 1, reps: 'AMRAP — max clean reps', cue: 'Load ~90% of your normal working weight — a weight you can lift at least twice. Do as many perfect reps as possible. Stop at form failure. Log weight and reps.', suggestedLoad: '~90% of working weight', category: 'main', targetRegions: [], videoId: '' },
    ],
  },
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export function getPrep(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate[] {
  return PREP[sessionType][toInternalTier(tier)];
}

export function getMechanical(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate[] {
  return MECHANICAL[sessionType][toInternalTier(tier)];
}

export function getNeuro(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate {
  return NEURO[sessionType][toInternalTier(tier)];
}

export function getMainLift(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate {
  return MAIN_LIFTS[sessionType][toInternalTier(tier)];
}

export function getAccessories(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate[] {
  return ACCESSORIES[sessionType][toInternalTier(tier)];
}

export function getPrehab(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate[] {
  return PREHAB[sessionType][toInternalTier(tier)];
}

export function getFinisher(sessionType: MainSessionType, tier: EquipmentTier, energy: 'easy' | 'normal' | 'hard'): ExerciseTemplate {
  return FINISHERS[sessionType][toInternalTier(tier)][energy];
}

export function getCooldown(): ExerciseTemplate[] {
  return COOLDOWN;
}

export function getConditioningWorkout(tier: EquipmentTier, energy: 'easy' | 'normal' | 'hard'): ExerciseTemplate[] {
  return CONDITIONING_WORKOUTS[toInternalTier(tier)][energy];
}

export function get1RMProtocol(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate[] {
  return ORM_TEST[sessionType][toInternalTier(tier)];
}

// ─── STANDALONE PREHAB SESSION ────────────────────────────────────────────────
// A targeted joint-health circuit. Equipment-agnostic (all bodyweight/band).

const STANDALONE_PREHAB: ExerciseTemplate[] = [
  { id: 'ph-s-1', name: 'Cardio Warm-Up (Easy Walk / Bike)', sets: 1, reps: '3 min', cue: 'Start easy — just get blood flowing to the joints before any movement', suggestedLoad: 'Low intensity', category: 'prep', targetRegions: [], videoId: '' },
  { id: 'ph-s-2', name: 'Dead Bug', sets: 2, reps: '8 each side', cue: 'Low back pressed to floor throughout — reach opposite arm and leg, exhale fully. Core anti-extension', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['lower_back', 'core_ribs'], videoId: '' },
  { id: 'ph-s-3', name: 'Banded Clamshell', sets: 2, reps: '15 each side', cue: 'Band around knees, feet together — rotate top knee up, hold 1s, lower slowly. Glute med activation', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['hip_groin', 'knee'], videoId: '' },
  { id: 'ph-s-4', name: 'Band Pull-Apart', sets: 2, reps: '15 slow reps', cue: 'Arms straight, pull band to sternum — squeeze shoulder blades for 1s. Rotator cuff and rear-delt health', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['front_shoulder', 'rear_shoulder', 'upper_back'], videoId: '' },
  { id: 'ph-s-5', name: 'Pallof Press (Isometric Hold)', sets: 2, reps: '20s each side', cue: 'Press hands away from body, resist rotation — tall spine, breathe. Anti-rotation core stability', suggestedLoad: 'Light band or cable', category: 'prehab', targetRegions: ['core_ribs', 'lower_back'], videoId: '' },
  { id: 'ph-s-6', name: 'Copenhagen Adductor Hold', sets: 2, reps: '20s each side', cue: 'Top leg on bench, bottom leg reaches — hold, squeeze inner thigh. Groin and adductor load', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin', 'knee'], videoId: '' },
  { id: 'ph-s-7', name: 'Wall Slide', sets: 2, reps: '10 slow reps', cue: 'Back flat on wall, arms at 90° slide overhead — keep elbows and wrists touching wall. Shoulder health', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '' },
  { id: 'ph-s-8', name: 'Tibialis Raise', sets: 2, reps: '15 each side', cue: 'Heels on ground, lift toes toward shin — slow and controlled. Shin splint prevention and ankle health', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['ankle_achilles', 'calf_shin'], videoId: '' },
  { id: 'ph-s-9', name: 'Supine Hip 90/90 Stretch', sets: 1, reps: '45s each side', cue: 'On back, figure-4 position — breathe deeply, let hip open. Hip capsule and piriformis', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['hip_groin', 'lower_back'], videoId: '' },
];

export function getStandalonePrehabWorkout(): ExerciseTemplate[] {
  return STANDALONE_PREHAB;
}

// ─── STANDALONE FLEXIBILITY SESSION ──────────────────────────────────────────
// Long-hold stretching and mobility. No equipment needed.

const STANDALONE_FLEXIBILITY: ExerciseTemplate[] = [
  { id: 'fl-s-1', name: 'Diaphragmatic Breathing', sets: 1, reps: '10 deep breaths', cue: 'Lie on back, hands on belly — breathe in for 4s, out for 6s. Activate parasympathetic system before stretching', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: [], videoId: '' },
  { id: 'fl-s-2', name: 'Hip Flexor Kneeling Stretch', sets: 2, reps: '45s each side', cue: 'Deep lunge, back knee padded — tuck pelvis, hold for duration. Desk worker hip flexor release', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['hip_groin', 'lower_back'], videoId: '' },
  { id: 'fl-s-3', name: 'Doorway Chest Opener', sets: 2, reps: '45s each side', cue: 'Arm at 90°, step through doorway — breathe deeply into the pec stretch. Undo desk posture', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['front_shoulder', 'upper_back'], videoId: '' },
  { id: 'fl-s-4', name: 'Thread-the-Needle Rotation', sets: 2, reps: '6 each side, hold 3s', cue: 'All fours, thread one arm under body — feel thoracic rotation, breathe and settle deeper', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '' },
  { id: 'fl-s-5', name: 'Pigeon Pose', sets: 2, reps: '60s each side', cue: 'Front shin as horizontal as comfortable — relax all weight into the pose, breathe through outer hip tension', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['hip_groin', 'lower_back'], videoId: '' },
  { id: 'fl-s-6', name: 'Supine Hamstring Stretch (Strap)', sets: 2, reps: '45s each leg', cue: 'Lie on back, loop towel or strap around foot — straighten knee until gentle tension. No forcing', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['knee', 'lower_back'], videoId: '' },
  { id: 'fl-s-7', name: 'Child\'s Pose with Side Reach', sets: 2, reps: '30s each side', cue: 'From child\'s pose, walk hands to one side — feel the lat and QL stretch on the opposite hip', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['lower_back', 'upper_back'], videoId: '' },
  { id: 'fl-s-8', name: 'Calf Stretch (Wall)', sets: 2, reps: '45s each side', cue: 'Foot against base of wall, heel down, lean in — straight-leg then bent-knee for soleus', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['ankle_achilles', 'calf_shin'], videoId: '' },
  { id: 'fl-s-9', name: 'Neck Side Stretch', sets: 2, reps: '30s each side', cue: 'Ear to shoulder, gentle hand pressure — do not pull. Breathe slowly, hold without bouncing', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['neck', 'upper_back'], videoId: '' },
  { id: 'fl-s-10', name: 'Legs-Up-The-Wall', sets: 1, reps: '2 min', cue: 'Legs vertical against wall, arms relaxed — close eyes and breathe. Full body recovery and circulation', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['ankle_achilles', 'lower_back'], videoId: '' },
];

export function getStandaloneFlexibilityWorkout(): ExerciseTemplate[] {
  return STANDALONE_FLEXIBILITY;
}
