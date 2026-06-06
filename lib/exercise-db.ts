import { EquipmentTier, ExerciseCategory, SessionType, PainRegion } from './store';

export type { ExerciseCategory };

type MainSessionType = Exclude<SessionType, 'conditioning' | 'prehab' | 'flexibility' | 'custom'>;
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
  cue: 'Treadmill, bike or brisk walk — start easy, gradually pick up pace. Get the blood moving before any stretching.',
  suggestedLoad: 'Low intensity', category: 'prep', targetRegions: [], videoId: '',
};

// ─── 1. PRE-TRAINING PREPARATION ─────────────────────────────────────────────
// Active mobility, joint prep. Minimum 3 exercises per session for safety.

const PREP: Record<MainSessionType, Record<InternalTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-prep-bw-1', name: 'Hip Flexor Kneeling Stretch', sets: 1, reps: '30s each side', cue: 'Deep lunge, back knee down, tuck pelvis under — feel the front of the hip open', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Couch Stretch', cue: 'Back foot on bench/wall, front knee on ground — deeper hip flexor stretch', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Supine Hip Flexor Stretch', cue: 'Lying on back, pull one knee to chest, extend the other leg — hip flexor stretch with zero knee load', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back', 'knee'] } },
      { id: 'sq-prep-bw-2', name: '90/90 Hip Switch', sets: 1, reps: '6 slow each side', cue: 'Control the transition through both hip positions — no rushing', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin'], videoId: '', swapAlternative: { name: 'Pigeon Pose Flow', cue: 'Front shin horizontal, breathe into outer hip — hold then pulse 5 reps', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Standing Leg Swing', cue: 'Hold wall, swing leg forward and back gently — hip joint mobility with no floor work', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back', 'knee'] } },
      { id: 'sq-prep-bw-3', name: "World's Greatest Stretch", sets: 1, reps: '5 each side', cue: 'Lunge forward, elbow to floor, reach arm to sky — pause at each position, feel the full-body stretch', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'upper_back', 'lower_back'], videoId: '', swapAlternative: { name: 'Hip Circle (Standing)', cue: 'Hands on hips, draw large slow circles each direction — open the hip joint', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Hip Rotation (chair)', cue: 'Seated, place ankle on opposite knee, gently press knee toward floor — hip external rotation stretch', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'upper_back', 'lower_back', 'knee'] } },
    ],
    dumbbells: [
      { id: 'sq-prep-db-1', name: 'Hip Flexor Kneeling Stretch', sets: 1, reps: '30s each side', cue: 'Deep lunge, back knee down, tuck pelvis under — feel the front of the hip open', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Couch Stretch', cue: 'Back foot on bench/wall, front knee on ground — deeper hip flexor stretch', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Supine Hip Flexor Stretch', cue: 'Lying on back, pull one knee to chest, extend the other leg — hip flexor stretch with zero knee load', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back', 'knee'] } },
      { id: 'sq-prep-db-2', name: 'Cossack Squat Flow', sets: 1, reps: '6 each side', cue: 'Heel down, chest tall, shift side to side — ankles and hips open up', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'ankle_achilles', 'knee'], videoId: '', swapAlternative: { name: '90/90 Hip Switch', cue: 'Sit on floor, switch between both hip positions slowly — full hip capsule prep', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Adductor Stretch', cue: 'Seated in chair, wide legs, lean forward — inner thigh prep without any ankle or knee range demand', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'ankle_achilles', 'knee'] } },
      { id: 'sq-prep-db-3', name: 'Ankle Circles + Dorsiflexion Drill', sets: 1, reps: '10 circles + 10 wall touches each', cue: 'Slow ankle circles each direction, then knee-over-toe against wall — improve squat depth and ankle mobility', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['ankle_achilles', 'knee'], videoId: '', swapAlternative: { name: 'Calf Raise + Slow Lower', cue: 'Rise all the way up, 3s eccentric — ankle strength and mobility', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Ankle Alphabet', cue: 'Seated, draw the alphabet with toes — gentle full ankle mobility with zero weight-bearing', suggestedLoad: 'Bodyweight', triggerRegions: ['ankle_achilles', 'knee', 'calf_shin'] } },
    ],
    fullgym: [
      { id: 'sq-prep-fg-1', name: 'Ankle Dorsiflexion Drill', sets: 1, reps: '10 each', cue: 'Knee over toe against wall, heel stays down — improve squat depth', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['ankle_achilles', 'knee'], videoId: '', swapAlternative: { name: 'Ankle Circles + Heel Rocks', cue: 'Circles each direction, then rock heel to toe — full ankle prep', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Ankle Rotations', cue: 'Seated, lift foot, draw slow circles each direction — full ankle range with zero weight-bearing', suggestedLoad: 'Bodyweight', triggerRegions: ['ankle_achilles', 'knee', 'calf_shin'] } },
      { id: 'sq-prep-fg-2', name: 'Hip Flexor Kneeling Stretch', sets: 1, reps: '30s each side', cue: 'Deep lunge, back knee down, tuck pelvis — stretch the hip flexor before loading', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Couch Stretch', cue: 'Back foot elevated, front knee forward — intense hip flexor opener', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Supine Hip Flexor Stretch', cue: 'Lying on back, pull one knee to chest — hip flexor prep with zero knee-on-floor demand', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back', 'knee'] } },
      { id: 'sq-prep-fg-3', name: 'Banded Hip Circle', sets: 1, reps: '10 each direction', cue: 'Band around knees, feet hip-width, draw large circles with hips — warm up hip capsule before squatting', suggestedLoad: 'Light band', category: 'prep', targetRegions: ['hip_groin', 'knee'], videoId: '', swapAlternative: { name: 'Goblet Squat Stretch', cue: 'Hold a light KB, squat deep and pry knees out — perfect hip and ankle opener', suggestedLoad: '8–12 kg' }, comfortVariant: { name: 'Standing Hip Circle (no band)', cue: 'Hands on hips, draw large slow circles — gentle hip capsule opener, no knee load', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'knee'] } },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-prep-bw-1', name: 'Doorway Chest Opener', sets: 1, reps: '30s each side', cue: 'Arm at 90°, step through doorway — feel the pec stretch and breathe into it', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Cross-Body Shoulder Stretch', cue: 'Pull arm across chest, hold 30s — posterior shoulder capsule opener', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Chest Hug', cue: 'Seated, open arms wide then hug yourself — gentle shoulder girdle prep, pain-free range', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'upper_back', 'rear_shoulder', 'neck'] } },
      { id: 'bn-prep-bw-2', name: 'Thoracic Extension on Floor', sets: 1, reps: '8 reps', cue: 'Arms overhead, arch upper back only — no lumbar extension, feel the spine open', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['upper_back', 'front_shoulder'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under body — feel thoracic rotation open up', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Cat-Cow', cue: 'Seated in chair, arch then round upper back — thoracic mobility with zero floor demand', suggestedLoad: 'Bodyweight', triggerRegions: ['upper_back', 'front_shoulder', 'lower_back'] } },
      { id: 'bn-prep-bw-3', name: 'Neck Rolls + Shoulder Circles', sets: 1, reps: '5 each direction', cue: 'Slow controlled circles — neck first, then big arm circles forward and backward. Wake up the shoulder girdle', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['neck', 'front_shoulder', 'rear_shoulder'], videoId: '', swapAlternative: { name: 'Wall Slide', cue: 'Back flat on wall, arms at 90°, slide up — elbows and wrists stay on wall', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Gentle Neck Side Stretch', cue: 'Seated, tilt ear to shoulder, hold 15s each side — decompress cervical spine gently', suggestedLoad: 'Bodyweight', triggerRegions: ['neck', 'rear_shoulder', 'upper_back'] } },
    ],
    dumbbells: [
      { id: 'bn-prep-db-1', name: 'Doorway Chest Opener', sets: 1, reps: '30s each side', cue: 'Arm at 90°, step through doorway — feel the pec stretch and breathe into it', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Cross-Body Shoulder Stretch', cue: 'Pull arm across chest, hold 30s — posterior shoulder capsule opener', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Chest Hug', cue: 'Seated, open arms wide then hug yourself — gentle shoulder girdle prep, pain-free range', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'upper_back', 'rear_shoulder', 'neck', 'elbow_wrist'] } },
      { id: 'bn-prep-db-2', name: 'Thoracic Extension on Floor', sets: 1, reps: '8 reps', cue: 'Arms overhead, arch upper back only — no lumbar extension, feel the spine open', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['upper_back', 'front_shoulder'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under — thoracic rotation each side', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Cat-Cow', cue: 'Seated in chair, arch then round upper back — thoracic mobility with zero floor demand', suggestedLoad: 'Bodyweight', triggerRegions: ['upper_back', 'front_shoulder', 'lower_back'] } },
      { id: 'bn-prep-db-3', name: 'Wall Slide', sets: 1, reps: '10 slow reps', cue: 'Back flat on wall, arms bent at 90° slide up — keep elbows and wrists on wall throughout. Shoulder health', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'rear_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Shoulder CARs', cue: 'Slow full shoulder circles — controlled articular rotation for joint health', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Pendulum Shoulder Swing', cue: 'Lean forward, let arm hang, gently swing in small circles — decompresses shoulder joint, pain-free', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'upper_back', 'neck', 'elbow_wrist'] } },
    ],
    fullgym: [
      { id: 'bn-prep-fg-1', name: 'Doorway Chest Opener', sets: 1, reps: '30s each side', cue: 'Arm at 90°, step through doorway — feel the pec stretch and breathe into it', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Cross-Body Shoulder Stretch', cue: 'Pull arm across chest — rear deltoid and capsule stretch', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Chest Hug', cue: 'Seated, open arms wide then hug — gentle shoulder mobility, zero door or standing demand', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'upper_back', 'rear_shoulder', 'neck', 'elbow_wrist'] } },
      { id: 'bn-prep-fg-2', name: 'Shoulder CARs (Controlled Articular Rotations)', sets: 1, reps: '3 slow circles each arm', cue: 'Full shoulder range, move only the shoulder — spine neutral throughout', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '', swapAlternative: { name: 'Wall Slide', cue: 'Back on wall, arms at 90°, slide overhead — perfect scapular prep', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Pendulum Shoulder Swing', cue: 'Lean forward, let arm hang, draw small circles — decompresses shoulder with zero active loading', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back', 'elbow_wrist'] } },
      { id: 'bn-prep-fg-3', name: 'Band Pull-Apart (Warm-Up)', sets: 1, reps: '15 controlled', cue: 'Arms straight, pull band to chest — squeeze shoulder blades 1s at end. Prime the rear delts and rotator cuff', suggestedLoad: 'Light band', category: 'prep', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '', swapAlternative: { name: 'Face Pull (light cable)', cue: 'Pull to forehead, external rotate at top — rotator cuff activation', suggestedLoad: 'Light cable' }, comfortVariant: { name: 'Cross-Body Arm Swing', cue: 'Standing, swing arms horizontally in front — gentle shoulder mobility, no band resistance', suggestedLoad: 'Bodyweight', triggerRegions: ['rear_shoulder', 'upper_back', 'elbow_wrist', 'front_shoulder'] } },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-prep-bw-1', name: 'Cat-Cow Flow', sets: 1, reps: '8 slow reps', cue: 'Full spinal flexion and extension — pause at each end, breathe through movement', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'upper_back'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under — thoracic rotation prep for hinge', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Pelvic Tilt (lying)', cue: 'Lying on back, knees bent — tilt pelvis to flatten lower back to floor, release, repeat — spinal warm-up, zero all-fours load', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'upper_back', 'hip_groin'] } },
      { id: 'dl-prep-bw-2', name: "Child's Pose", sets: 1, reps: '30s', cue: 'Arms extended, let hips drop — breathe into lower back and lats', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'hip_groin'], videoId: '', swapAlternative: { name: 'Seated Forward Fold', cue: 'Legs straight, reach for feet — hamstring and lower back stretch', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Supported Chair Lean', cue: 'Hold back of chair, step back, hinge forward 45° — lat and back stretch standing, no floor demand', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'hip_groin', 'upper_back'] } },
      { id: 'dl-prep-bw-3', name: 'Standing Hamstring Reach', sets: 1, reps: '8 each side', cue: 'Stand on one leg, hinge forward reaching for floor — feel the back of your thigh lengthen. Slow and controlled', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'hip_groin'], videoId: '', swapAlternative: { name: 'Inchworm', cue: 'Walk hands out to push-up, walk feet to hands — full-body warm-up chain', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Lying Hamstring Stretch', cue: 'Lying on back, pull one leg up with hands or a towel — hamstring prep, no balance or hip hinge demand', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'hip_groin', 'calf_shin'] } },
    ],
    dumbbells: [
      { id: 'dl-prep-db-1', name: 'Cat-Cow Flow', sets: 1, reps: '8 slow reps', cue: 'Full spinal flexion and extension — pause at each end, breathe through movement', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'upper_back'], videoId: '', swapAlternative: { name: 'Prone Cobra', cue: 'Face down, lift chest with hands at sides — spinal extension and glute squeeze', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Pelvic Tilt (lying)', cue: 'Lying on back, knees bent — tilt pelvis to flatten lower back to floor, release, repeat — gentle spinal prep with no all-fours load', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'upper_back', 'hip_groin'] } },
      { id: 'dl-prep-db-2', name: 'Adductor Rockback', sets: 1, reps: '8 each side', cue: 'Wide stance, rock into each hip — breathe at end range, open the groin', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Butterfly Stretch', cue: 'Soles of feet together, press knees toward floor — inner thigh and hip opener', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Groin Stretch', cue: 'Seated in chair, wide legs, lean gently forward — groin stretch with no floor or wide-stance demand', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back', 'knee'] } },
      { id: 'dl-prep-db-3', name: 'Hip Circle (Standing)', sets: 1, reps: '10 each direction', cue: 'Hands on hips, draw large circles — move slowly and feel the hip joint open. Loosen up before hinging', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: '90/90 Hip Switch', cue: 'Sit on floor, transition between hip positions slowly — full hip capsule prep', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Pelvic Tilt (lying)', cue: 'Lying on back, knees bent — tilt pelvis, hold 2s, release — hip and lumbar warm-up with no standing balance demand', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
    ],
    fullgym: [
      { id: 'dl-prep-fg-1', name: 'Cat-Cow Flow', sets: 1, reps: '8 slow reps', cue: 'Full spinal flexion and extension — pause at each end, breathe through movement', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['lower_back', 'upper_back'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under — thoracic rotation for deadlift prep', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Pelvic Tilt (lying)', cue: 'Lying on back, knees bent — tilt pelvis to flatten lower back, release, repeat — spinal warm-up with no all-fours demand', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'upper_back', 'hip_groin'] } },
      { id: 'dl-prep-fg-2', name: 'Adductor Rockback', sets: 1, reps: '8 each side', cue: 'Wide stance, rock into each hip — breathe at end range, open the groin', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['hip_groin', 'lower_back'], videoId: '', swapAlternative: { name: 'Wide-Stance Hip Hinge Stretch', cue: 'Stand wide, hinge forward and hold — hamstrings and inner thighs open', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Butterfly Stretch', cue: 'Seated, soles of feet together, press knees toward floor — groin opener with no wide-stance or all-fours demand', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back', 'knee'] } },
      { id: 'dl-prep-fg-3', name: 'Kneeling Thoracic Rotation', sets: 1, reps: '8 each side', cue: 'Kneeling, hand behind head, rotate open to the ceiling — improve thoracic mobility for a better hinge position', suggestedLoad: 'Bodyweight', category: 'prep', targetRegions: ['upper_back', 'lower_back'], videoId: '', swapAlternative: { name: 'Thread-the-Needle Rotation', cue: 'All fours, thread one arm under — same thoracic work, different position', suggestedLoad: 'Bodyweight' }, comfortVariant: { name: 'Seated Thoracic Rotation', cue: 'Seated in chair, hands behind head, rotate torso each side — thoracic prep with no kneeling demand', suggestedLoad: 'Bodyweight', triggerRegions: ['upper_back', 'lower_back', 'hip_groin', 'knee'] } },
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
        swapAlternative: { name: 'Single-Leg Glute Bridge', cue: 'One foot up, drive through the working leg — more glute demand per rep', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying flat, squeeze glutes and hold 5s — gentle activation, no hip extension', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
    ],
    dumbbells: [
      { id: 'sq-mech-db-1', name: 'Banded Clamshell', sets: 3, reps: '20 each', cue: 'Heels together, rotate top knee up — constant tension', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Fire Hydrant', cue: 'All fours, lift knee out to the side — same glute activation, no band needed', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Lateral Band Walk', cue: 'Band around ankles, stay low, step side to side — glute activation without hip rotation', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'knee'] } },
      { id: 'sq-mech-db-2', name: 'Goblet Squat Primer', sets: 3, reps: '15 slow', cue: '3s down, pause 1s, drive up — just activation weight', suggestedLoad: '8–12 kg per hand', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Sumo Squat Hold', cue: 'Wide stance, feet turned out, hold bottom position 30s — hip and groin opener before squatting', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Box Squat (light)', cue: 'Sit back to box, 3s pause — removes deep knee flexion', suggestedLoad: '6–10 kg per hand', triggerRegions: ['knee', 'hip_groin', 'ankle_achilles'] } },
    ],
    fullgym: [
      { id: 'sq-mech-fg-1', name: 'Banded Clamshell', sets: 3, reps: '20 each', cue: 'Heels together, rotate top knee up — constant tension', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Fire Hydrant', cue: 'All fours, lift knee out to the side — glute activation alternative', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Lateral Band Walk', cue: 'Band around ankles, stay low, step side to side — glute activation without hip rotation', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'knee'] } },
      { id: 'sq-mech-fg-2', name: 'Goblet Squat Primer', sets: 3, reps: '15 slow', cue: '3s down, pause 1s, drive up — just activation weight', suggestedLoad: '12–16 kg per hand', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Belt Squat (light)', cue: 'Plates suspended, walk in, squat — no spinal load, perfect activation', suggestedLoad: '20–40 kg' },
        comfortVariant: { name: 'Leg Press (light)', cue: 'Light load, full range, slow — prime quads and glutes with zero spinal load', suggestedLoad: '40–60 kg', triggerRegions: ['knee', 'hip_groin', 'lower_back'] } },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-mech-bw-1', name: 'Band Pull-Apart', sets: 3, reps: '20', cue: 'Arms straight, squeeze shoulder blades — pause 1s at chest', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Prone Y-T-W Raise', cue: 'Face down, lift arms in Y then T then W positions — squeeze each for 1s', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Doorway Chest Stretch', cue: 'Arm at 90°, lean through doorway — gentle pec and shoulder opener, no resistance', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back'] } },
      { id: 'bn-mech-bw-2', name: 'Scapular Push-Up', sets: 3, reps: '15', cue: 'Arms straight, protract scaps forward then retract back — no elbow bend', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'Wall Slide', cue: 'Back flat on wall, slide arms up — scapular activation in opposite direction', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Shoulder Shrug + Retraction', cue: 'Stand tall, shrug up then squeeze back — simple scapular activation with no load', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back', 'elbow_wrist'] } },
    ],
    dumbbells: [
      { id: 'bn-mech-db-1', name: 'Band Pull-Apart', sets: 3, reps: '20', cue: 'Arms straight, squeeze shoulder blades — pause 1s at chest', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Prone Y-T-W Raise', cue: 'Face down, arms in Y-T-W positions — rotator cuff and rear delt activation', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Doorway Chest Stretch', cue: 'Arm at 90°, lean through — gentle shoulder opener with no loading', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back', 'elbow_wrist'] } },
      { id: 'bn-mech-db-2', name: 'Light DB External Rotation', sets: 3, reps: '15 each', cue: 'Elbow pinned to side, rotate out slowly — constant tension', suggestedLoad: '2–4 kg per hand', category: 'mechanical', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'Prone Shoulder External Rotation', cue: 'Face down on bench, elbow at 90°, rotate arm up — bodyweight rotator cuff activation', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Wall Slide', cue: 'Back flat on wall, slide arms overhead — scapular and shoulder health with zero joint stress', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist', 'neck'] } },
    ],
    fullgym: [
      { id: 'bn-mech-fg-1', name: 'Band Pull-Apart', sets: 3, reps: '20', cue: 'Arms straight, squeeze shoulder blades — pause 1s at chest', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Cable Face Pull', cue: 'Pull to forehead, external rotate at top — rotator cuff primer', suggestedLoad: 'Light cable' },
        comfortVariant: { name: 'Doorway Chest Stretch', cue: 'Arm at 90°, lean gently through — shoulder opener with zero loading', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back', 'elbow_wrist'] } },
      { id: 'bn-mech-fg-2', name: 'Face Pull', sets: 3, reps: '15', cue: 'Pull to forehead, externally rotate at end position', suggestedLoad: 'Light cable', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Band Pull-Apart', cue: 'Arms straight, pull to chest — rear delt and scapular activation', suggestedLoad: 'Light band' },
        comfortVariant: { name: 'Prone Y Raise', cue: 'Face down, thumbs up, lift arms to Y position — no load, gentle posterior chain primer', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back'] } },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-mech-bw-1', name: 'Glute Bridge', sets: 3, reps: '20', cue: 'Drive through heels, squeeze top for 2s — feel the posterior chain fire', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Single-Leg Glute Bridge', cue: 'One leg up, drive through working heel — more glute demand each side', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying flat, squeeze glutes and hold 5s — no hip extension demand, lowest loading option', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-mech-bw-2', name: 'Bird Dog', sets: 3, reps: '10 each', cue: 'Opposite arm + leg, spine neutral — squeeze glute as leg extends', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['lower_back', 'core_ribs'], videoId: '',
        swapAlternative: { name: 'Dead Bug', cue: 'Flat back, lower opposite arm and leg toward floor — brace hard throughout', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Cat-Cow', cue: 'Full spinal flexion and extension — gentle spinal mobility with no core bracing demand', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'core_ribs', 'upper_back'] } },
    ],
    dumbbells: [
      { id: 'dl-mech-db-1', name: 'Glute Bridge', sets: 3, reps: '20', cue: 'Drive through heels, squeeze top for 2s — feel the posterior chain fire', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'DB Hip Thrust (activation)', cue: 'Light DB on hips, squeeze at top for 2s — prime the glutes before the main lift', suggestedLoad: '8–12 kg' },
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying flat, squeeze glutes, hold 5s — zero hip extension, lowest demand option', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-mech-db-2', name: 'KB Deadbug', sets: 3, reps: '10 each', cue: 'Press KB to ceiling, extend opposite leg — low back flat into floor', suggestedLoad: '4–8 kg per hand', category: 'mechanical', targetRegions: ['core_ribs', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Dead Bug', cue: 'Same pattern without weight — lower opposite arm and leg, keep low back flat', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Cat-Cow', cue: 'Full spinal flexion and extension — gentle mobility with zero bracing demand', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'core_ribs', 'upper_back'] } },
    ],
    fullgym: [
      { id: 'dl-mech-fg-1', name: 'Glute Bridge', sets: 3, reps: '20', cue: 'Drive through heels, squeeze top for 2s — feel the posterior chain fire', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Hip Thrust (light bar)', cue: 'Barbell across hips, drive up and squeeze — activation before the main hinge', suggestedLoad: '20–40 kg' },
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying flat, squeeze and hold 5s — zero hip extension demand', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-mech-fg-2', name: 'Banded Good Morning', sets: 3, reps: '15', cue: 'Band around neck, hinge at hips — feel hamstrings load at bottom', suggestedLoad: 'Medium band', category: 'mechanical', targetRegions: ['lower_back', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Glute Ham Raise (partial)', cue: 'Anchor feet, lower torso partway — hamstring activation without full load', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Cat-Cow Flow', cue: 'Full spinal flexion and extension — gentle lower back mobility with zero hinge loading', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'hip_groin'] } },
    ],
  },
};

// ─── 3. NEUROLOGICAL PRIMING ─────────────────────────────────────────────────

const NEURO: Record<MainSessionType, Record<InternalTier, ExerciseTemplate>> = {
  squat: {
    bodyweight: {
      id: 'sq-neuro-bw', name: 'Squat Jump', sets: 3, reps: '5 explosive', cue: 'Full squat, explode through hips — land soft, absorb with whole leg', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['knee', 'hip_groin'], videoId: '',
      swapAlternative: { name: 'Broad Jump', cue: 'Horizontal power — hinge back, explode forward, land soft', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Step-Over High Knee March', cue: 'Exaggerated marching, drive knee up with intention — no impact', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles', 'hip_groin'] },
    },
    dumbbells: {
      id: 'sq-neuro-db', name: 'Box Jump (Step-Down)', sets: 3, reps: '5 jumps', cue: 'Jump to box, step down — reset each rep', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['knee', 'hip_groin'], videoId: '',
      swapAlternative: { name: 'Squat Jump', cue: 'Full squat, explode up, land soft — same stimulus without a box', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Broad Jump', cue: 'Horizontal jump, land in athletic position, walk back — lower impact', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] },
    },
    fullgym: {
      id: 'sq-neuro-fg', name: 'Box Jump (Step-Down)', sets: 3, reps: '5 jumps', cue: 'Jump to box, step down — reset each rep', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['knee', 'hip_groin'], videoId: '',
      swapAlternative: { name: 'Depth Drop', cue: 'Step off box, absorb landing — reactive power primer without upward jump demand', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Squat Jump', cue: 'Bodyweight, full depth, land soft — no box needed', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] },
    },
  },
  bench: {
    bodyweight: {
      id: 'bn-neuro-bw', name: 'Explosive Push-Up', sets: 3, reps: '5 explosive', cue: 'Push hard enough to leave floor — land with bent elbows', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['front_shoulder', 'elbow_wrist'], videoId: '',
      swapAlternative: { name: 'Clap Push-Up', cue: 'Explosive push, clap hands at top, reset — max upper body power output', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Band Punch-Out', cue: 'Band in front, explosive punch extensions — 10 fast reps', suggestedLoad: 'Light band', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    dumbbells: {
      id: 'bn-neuro-db', name: 'Explosive Push-Up', sets: 3, reps: '5 explosive', cue: 'Push hard enough to leave floor — land with bent elbows', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['front_shoulder', 'elbow_wrist'], videoId: '',
      swapAlternative: { name: 'Clap Push-Up', cue: 'Explosive push, clap hands at top, reset — max upper body power output', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Band Punch-Out', cue: 'Band in front, explosive punch extensions — 10 fast reps', suggestedLoad: 'Light band', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    fullgym: {
      id: 'bn-neuro-fg', name: 'Med Ball Chest Pass (Wall)', sets: 3, reps: '5 explosive', cue: 'Press and release explosively, catch and reload — full intent', suggestedLoad: '4–6 kg ball', category: 'neuro', targetRegions: ['front_shoulder'], videoId: '',
      swapAlternative: { name: 'Plyo Push-Up (Hands on Bench)', cue: 'Hands on low bench, explode off — less wrist impact than full plyo', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Explosive Push-Up', cue: 'Push hard enough to leave floor, land soft — no ball needed', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
  },
  deadlift: {
    bodyweight: {
      id: 'dl-neuro-bw', name: 'Broad Jump', sets: 3, reps: '3 explosive', cue: 'Hinge back, swing arms, explode forward — land in athletic hinge', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['hip_groin', 'knee'], videoId: '',
      swapAlternative: { name: 'Vertical Jump', cue: 'Dip and explode straight up — max effort, land soft and absorb', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Standing Long Step', cue: 'Controlled split-stance hinge — slower, focus on hip drive, no impact', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles', 'hip_groin'] },
    },
    dumbbells: {
      id: 'dl-neuro-db', name: 'KB Swing (Explosive)', sets: 3, reps: '5 powerful', cue: 'Hip snap — bell goes where hips send it, not arm pull', suggestedLoad: '16–20 kg', category: 'neuro', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
      swapAlternative: { name: 'DB Power Clean', cue: 'Hinge down, explosive pull to front rack — hip snap drives the weight up', suggestedLoad: '10–16 kg per hand' },
      comfortVariant: { name: 'Broad Jump', cue: 'Hinge back, swing arms, explode forward — land soft, no load', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'knee'] },
    },
    fullgym: {
      id: 'dl-neuro-fg', name: 'KB Swing (Explosive)', sets: 3, reps: '5 powerful', cue: 'Hip snap — bell goes where hips send it, not arm pull', suggestedLoad: '20–28 kg', category: 'neuro', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
      swapAlternative: { name: 'Power Clean (Light)', cue: 'Barbell power clean — explosive hip extension drives the bar up to front rack', suggestedLoad: '40–60 kg' },
      comfortVariant: { name: 'Broad Jump', cue: 'Hinge back, swing arms, explode forward — land soft, no load', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'knee'] },
    },
  },
};

// ─── 2b. POWER GOAL MECHANICAL OVERRIDES ─────────────────────────────────────
// For power-goal sessions the mechanical phase shifts from slow activation work
// to dynamic, velocity-based pattern drills — priming the nervous system for
// explosive force expression before the neuro block.

const POWER_MECHANICAL: Record<MainSessionType, Record<InternalTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-pwr-mech-bw-1', name: 'Hip Circle (Fast Tempo)', sets: 2, reps: '10 each direction', cue: 'Stand on one foot, drive knee in full circles as fast as control allows — hip dynamic range at speed', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Banded Clamshell (fast)', cue: 'Standard clamshell but faster tempo — fire the glute quickly, not just activate it', suggestedLoad: 'Light band' },
        comfortVariant: { name: 'Lateral Band Walk', cue: 'Band around ankles, stay low, step side to side — glute activation without rotation demand', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'knee'] } },
      { id: 'sq-pwr-mech-bw-2', name: 'Lateral Bound (Stick Landing)', sets: 2, reps: '6 each side', cue: 'Push off outside foot, bound laterally, stick the single-leg landing — lower-body reactive control', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Dynamic Squat Pattern Primer', cue: 'Bodyweight squat, drive up onto toes at top — rehearse the jump pattern without leaving the floor', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Glute Bridge Pulse', cue: 'Small pulsing reps at top — feel the glutes fire, no impact', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'knee', 'ankle_achilles'] } },
    ],
    dumbbells: [
      { id: 'sq-pwr-mech-db-1', name: 'Hip Circle (Fast Tempo)', sets: 2, reps: '10 each direction', cue: 'Stand on one foot, drive knee in full circles as fast as control allows — hip dynamic range at speed', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Banded Clamshell (fast)', cue: 'Standard clamshell, fast tempo — fire the glute quickly, not just activate', suggestedLoad: 'Light band' },
        comfortVariant: { name: 'Lateral Band Walk', cue: 'Band around ankles, step side to side — glute activation without rotation', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'knee'] } },
      { id: 'sq-pwr-mech-db-2', name: 'Goblet Squat Speed Primer', sets: 2, reps: '8 fast', cue: 'Light DB, squat to full depth, drive up as fast as possible — practice the aggressive concentric you will use in the main lift', suggestedLoad: '8–12 kg', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Sumo Squat Hold + Pulse', cue: 'Wide stance, hold bottom 5s then 5 fast pulses — mobility + speed in the same window', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Box Squat (light)', cue: 'Sit back to box, controlled — reduces knee flexion demand', suggestedLoad: '6–10 kg', triggerRegions: ['knee', 'hip_groin', 'ankle_achilles'] } },
    ],
    fullgym: [
      { id: 'sq-pwr-mech-fg-1', name: 'Hip Circle (Fast Tempo)', sets: 2, reps: '10 each direction', cue: 'Stand on one foot, drive knee in full circles as fast as control allows — hip dynamic range at speed', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Banded Hip Circle (fast)', cue: 'Mini band around knees, fast hip circles — resistance makes the speed demand harder', suggestedLoad: 'Light band' },
        comfortVariant: { name: 'Lateral Band Walk', cue: 'Band around ankles, step side to side — gentler activation without rotation', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'knee'] } },
      { id: 'sq-pwr-mech-fg-2', name: 'Speed Squat Ramp (bar only)', sets: 2, reps: '5 explosive', cue: 'Bar on back, squat to depth, drive up as fast as possible — zero load, maximum intent, rehearse explosive concentric', suggestedLoad: '20 kg', category: 'mechanical', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Belt Squat Speed Ramp', cue: 'Very light weight, drive up with max intent — removes spinal load, same explosive pattern', suggestedLoad: 'Light weight' },
        comfortVariant: { name: 'Leg Press (light, fast)', cue: 'Light load, drive the sled fast — explosive intent without spinal load', suggestedLoad: '20–40 kg', triggerRegions: ['knee', 'hip_groin', 'lower_back'] } },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-pwr-mech-bw-1', name: 'Band Pull-Apart (Fast Tempo)', sets: 2, reps: '20 fast', cue: 'Arms straight, pull fast and controlled, return without pause — scapular speed training, not just activation', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Prone Y-T-W Raise (fast)', cue: 'Face down, fast Y-T-W arm positions — posterior chain speed activation', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Doorway Chest Stretch', cue: 'Arm at 90°, lean through doorway — gentle shoulder opener, no resistance', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back'] } },
      { id: 'bn-pwr-mech-bw-2', name: 'Arm Speed Drill', sets: 2, reps: '10 fast cycles', cue: 'Swinging both arms forward and back with intent — shoulder tempo and rotation prep for explosive pressing', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'Scapular Push-Up (fast)', cue: 'Arms straight, protract and retract fast — scapular speed training', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Shoulder Shrug + Retraction', cue: 'Stand tall, shrug then squeeze back — simple activation with no load', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back', 'elbow_wrist'] } },
    ],
    dumbbells: [
      { id: 'bn-pwr-mech-db-1', name: 'Band Pull-Apart (Fast Tempo)', sets: 2, reps: '20 fast', cue: 'Arms straight, pull fast and controlled, return without pause — scapular speed training', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Prone Y-T-W Raise (fast)', cue: 'Face down, fast Y-T-W positions — posterior chain speed activation', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Doorway Chest Stretch', cue: 'Arm at 90°, lean through — gentle shoulder opener with no loading', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back', 'elbow_wrist'] } },
      { id: 'bn-pwr-mech-db-2', name: 'Light DB Speed Press (seated)', sets: 2, reps: '8 explosive', cue: 'Seated, very light DBs, press with max intent — practice pressing speed before the main lift, arm speed only', suggestedLoad: '4–6 kg per hand', category: 'mechanical', targetRegions: ['front_shoulder', 'elbow_wrist'], videoId: '',
        swapAlternative: { name: 'Band Punch-Out (fast)', cue: 'Band in front, explosive punch extensions — upper body speed training', suggestedLoad: 'Light band' },
        comfortVariant: { name: 'Wall Slide', cue: 'Back flat on wall, arms slide overhead — shoulder health with zero joint stress', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist', 'neck'] } },
    ],
    fullgym: [
      { id: 'bn-pwr-mech-fg-1', name: 'Band Pull-Apart (Fast Tempo)', sets: 2, reps: '20 fast', cue: 'Arms straight, pull fast and controlled, return without pause — scapular speed and rear delt activation', suggestedLoad: 'Light band', category: 'mechanical', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Cable Face Pull (light, fast)', cue: 'Light weight, pull to forehead fast — speed with scapular control', suggestedLoad: 'Light cable' },
        comfortVariant: { name: 'Doorway Chest Stretch', cue: 'Arm at 90°, lean through — gentle shoulder opener, no resistance', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back', 'elbow_wrist'] } },
      { id: 'bn-pwr-mech-fg-2', name: 'Speed Bench Activation (bar only)', sets: 2, reps: '5 explosive', cue: 'Bar only, full bench press with max intent — practice explosive concentric, no hesitation at bottom', suggestedLoad: '20 kg', category: 'mechanical', targetRegions: ['front_shoulder', 'elbow_wrist'], videoId: '',
        swapAlternative: { name: 'Face Pull (fast)', cue: 'Pull to forehead with speed and control — scapular and rotator cuff primer', suggestedLoad: 'Light cable' },
        comfortVariant: { name: 'Prone Y Raise', cue: 'Face down, thumbs up, lift to Y — gentle posterior chain primer', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck', 'upper_back'] } },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-pwr-mech-bw-1', name: 'Hip Hinge Speed Drill', sets: 2, reps: '10 fast', cue: 'Push hips back fast, feel hamstring load, snap hips forward hard — the same hip snap you will use in the pull', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Glute Bridge Hip Snap', cue: 'Standard bridge but drive through hips explosively at top — hip extension speed training', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying flat, squeeze and hold 5s — gentle activation, no hip extension demand', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-pwr-mech-bw-2', name: 'Bird Dog (fast tempo)', sets: 2, reps: '8 each', cue: 'Opposite arm and leg, extend fast then retract fast — speed in posterior chain patterns', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['lower_back', 'core_ribs'], videoId: '',
        swapAlternative: { name: 'Dead Bug (fast)', cue: 'Same pattern, extend fast toward floor, brace hard — anti-rotation strength at speed', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Cat-Cow', cue: 'Full spinal flexion and extension — gentle mobility, no bracing demand', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'core_ribs', 'upper_back'] } },
    ],
    dumbbells: [
      { id: 'dl-pwr-mech-db-1', name: 'Hip Hinge Speed Drill', sets: 2, reps: '10 fast', cue: 'Push hips back fast, feel hamstring load, snap hips forward hard — the same hip snap you will use in the pull', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'DB Hip Thrust (activation, fast)', cue: 'Light DB on hips, snap hips to full extension quickly — prime the posterior chain at speed', suggestedLoad: '8–12 kg' },
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying flat, squeeze and hold 5s — zero hip extension, gentlest option', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-pwr-mech-db-2', name: 'KB Deadbug (controlled)', sets: 2, reps: '8 each', cue: 'Press KB to ceiling, extend opposite leg braced — low back flat, core anti-rotation prep', suggestedLoad: '4–8 kg', category: 'mechanical', targetRegions: ['core_ribs', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Dead Bug', cue: 'Same pattern without weight — lower opposite arm and leg, keep low back flat', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Cat-Cow', cue: 'Full spinal flexion and extension — gentle mobility, no bracing demand', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'core_ribs', 'upper_back'] } },
    ],
    fullgym: [
      { id: 'dl-pwr-mech-fg-1', name: 'Hip Hinge Speed Drill', sets: 2, reps: '10 fast', cue: 'Push hips back fast, feel hamstring load, snap hips forward — the same explosive hip drive you will use in the lift', suggestedLoad: 'Bodyweight', category: 'mechanical', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Hip Thrust (light bar, fast)', cue: 'Light barbell, snap hips to full extension — posterior chain speed primer', suggestedLoad: '20–40 kg' },
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying flat, squeeze and hold 5s — zero hip extension demand', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-pwr-mech-fg-2', name: 'Speed Good Morning (bar only)', sets: 2, reps: '5 fast', cue: 'Bar on back, hinge forward and drive back hard and fast — practice the same posterior chain snap pattern at speed', suggestedLoad: '20 kg', category: 'mechanical', targetRegions: ['lower_back', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Banded Good Morning (fast)', cue: 'Band around neck, hinge and drive back fast — lighter load, same speed practice', suggestedLoad: 'Medium band' },
        comfortVariant: { name: 'Cat-Cow Flow', cue: 'Full spinal flexion and extension — gentle lower back mobility', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'hip_groin'] } },
    ],
  },
};

// ─── 3b. POWER GOAL NEURO OVERRIDES ─────────────────────────────────────────
// When the user selects the "power" goal the neuro block should use max-effort,
// reactive movements that more specifically train rate-of-force development.
// These replace the standard NEURO entries and are always 5 sets (engine sets
// this via hasPowerGoal logic in generateWorkout).

const POWER_NEURO: Record<MainSessionType, Record<InternalTier, ExerciseTemplate>> = {
  squat: {
    bodyweight: {
      id: 'sq-pwr-neuro-bw', name: 'Depth Drop to Broad Jump', sets: 5, reps: '3 max-effort', cue: 'Step off step, absorb landing, immediately explode forward — minimize ground contact time', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['knee', 'hip_groin'], videoId: '',
      swapAlternative: { name: 'Squat Jump (Max Effort)', cue: 'Dip fast, explode with max intent — aim for max height every rep', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Step-Over High Knee March', cue: 'Exaggerated marching, drive knee up with intention — no impact', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles', 'hip_groin'] },
    },
    dumbbells: {
      id: 'sq-pwr-neuro-db', name: 'Loaded Jump Squat', sets: 5, reps: '3 powerful', cue: 'Light DBs at sides, full squat, explode to triple extension — land softly and reset', suggestedLoad: '5–10 kg per hand', category: 'neuro', targetRegions: ['knee', 'hip_groin'], videoId: '',
      swapAlternative: { name: 'Squat Jump (Max Effort)', cue: 'Bodyweight, max height every rep — same explosive stimulus', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Broad Jump', cue: 'Horizontal jump, land in athletic position, walk back — lower impact', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] },
    },
    fullgym: {
      id: 'sq-pwr-neuro-fg', name: 'Depth Jump', sets: 5, reps: '3 reactive', cue: 'Step off box (30–40 cm), touch ground with both feet, spring up immediately — zero pause on landing', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['knee', 'hip_groin'], videoId: '',
      swapAlternative: { name: 'Box Jump (Step-Down)', cue: 'Jump to box, step down — reset each rep, full intent', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Squat Jump', cue: 'Bodyweight, full depth, land soft — no box needed', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] },
    },
  },
  bench: {
    bodyweight: {
      id: 'bn-pwr-neuro-bw', name: 'Clap Push-Up', sets: 5, reps: '3 explosive', cue: 'Push with max force, clap at peak height, land with soft elbows — reset fully between reps', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['front_shoulder', 'elbow_wrist'], videoId: '',
      swapAlternative: { name: 'Explosive Push-Up', cue: 'Push hard enough to leave floor — land with bent elbows, full intent', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Band Punch-Out', cue: 'Band in front, explosive punch extensions — 10 fast reps', suggestedLoad: 'Light band', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    dumbbells: {
      id: 'bn-pwr-neuro-db', name: 'Clap Push-Up', sets: 5, reps: '3 explosive', cue: 'Push with max force, clap at peak height, land with soft elbows — reset fully between reps', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['front_shoulder', 'elbow_wrist'], videoId: '',
      swapAlternative: { name: 'Explosive Push-Up', cue: 'Push hard enough to leave floor — land with bent elbows, full intent', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Band Punch-Out', cue: 'Band in front, explosive punch extensions — 10 fast reps', suggestedLoad: 'Light band', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    fullgym: {
      id: 'bn-pwr-neuro-fg', name: 'Landmine Push Press', sets: 5, reps: '3 explosive per arm', cue: 'Slight dip, explosive hip extension drives the bar up — finish with full lockout and scapular elevation', suggestedLoad: '20–35 kg', category: 'neuro', targetRegions: ['front_shoulder'], videoId: '',
      swapAlternative: { name: 'Med Ball Chest Pass (Wall)', cue: 'Press and release explosively, catch and reload — full intent', suggestedLoad: '4–6 kg ball' },
      comfortVariant: { name: 'Explosive Push-Up', cue: 'Push hard enough to leave floor, land soft — no equipment needed', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
  },
  deadlift: {
    bodyweight: {
      id: 'dl-pwr-neuro-bw', name: 'Standing Long Jump', sets: 5, reps: '3 max-distance', cue: 'Dip into hinge, swing arms, explode forward with max horizontal power — land in athletic stance and hold', suggestedLoad: 'Bodyweight', category: 'neuro', targetRegions: ['hip_groin', 'knee'], videoId: '',
      swapAlternative: { name: 'Broad Jump', cue: 'Hinge back, swing arms, explode forward — land in athletic hinge', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Standing Long Step', cue: 'Controlled split-stance hinge — slower, focus on hip drive, no impact', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles', 'hip_groin'] },
    },
    dumbbells: {
      id: 'dl-pwr-neuro-db', name: 'DB Power Clean', sets: 5, reps: '3 explosive', cue: 'Start in hinged position, explosive hip snap pulls DBs to front rack — arms follow hips, not the other way', suggestedLoad: '10–16 kg per hand', category: 'neuro', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
      swapAlternative: { name: 'KB Swing (Explosive)', cue: 'Hip snap — bell goes where hips send it, not arm pull', suggestedLoad: '16–20 kg' },
      comfortVariant: { name: 'Broad Jump', cue: 'Hinge back, swing arms, explode forward — land soft, no load', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'knee'] },
    },
    fullgym: {
      id: 'dl-pwr-neuro-fg', name: 'Power Clean', sets: 5, reps: '2–3 explosive', cue: 'From mid-shin, explosive pull with max hip extension — elbows shoot through to front rack, bar stays tight to body', suggestedLoad: '40–70 kg', category: 'neuro', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
      swapAlternative: { name: 'Hang Power Clean', cue: 'Start from hang (knee height), same explosive pull — shorter range, faster rate of force development', suggestedLoad: '35–60 kg' },
      comfortVariant: { name: 'KB Swing (Explosive)', cue: 'Hip snap — bell goes where hips send it, not arm pull', suggestedLoad: '20–28 kg', triggerRegions: ['lower_back', 'knee'] },
    },
  },
};

// ─── 4. KPI LIFT (Main Strength Exercise) ────────────────────────────────────

const MAIN_LIFTS: Record<MainSessionType, Record<InternalTier, ExerciseTemplate>> = {
  squat: {
    bodyweight: {
      id: 'sq-main-bw', name: 'Bodyweight Squat', sets: 4, reps: '15–20 reps', cue: 'Chest up, knees track toes, full depth — 3s eccentric on working sets', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: ['knee', 'hip_groin'],
      videoId: '',
      swapAlternative: { name: 'Step-Up (Bodyweight)', cue: 'Drive through top foot, stand fully — knee-friendly unilateral option', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Tempo Box Squat', cue: '3s down to box, 2s pause, drive up — remove bottom ROM pressure', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'hip_groin', 'ankle_achilles'] },
    },
    dumbbells: {
      id: 'sq-main-db', name: 'Goblet Squat', sets: 4, reps: '10–12 reps', cue: 'Elbows inside knees, vertical torso — build weight each set', suggestedLoad: '16–28 kg per hand', category: 'main', targetRegions: ['knee', 'hip_groin'],
      videoId: '',
      swapAlternative: { name: 'DB Sumo Squat', cue: 'Wide stance, toes out, DB between legs — targets inner thigh and glute differently', suggestedLoad: '16–24 kg' },
      comfortVariant: { name: 'Tempo Goblet Squat', cue: '3s eccentric, pause at bottom, stand tall — lighter load', suggestedLoad: '12–16 kg per hand', triggerRegions: ['knee', 'hip_groin', 'ankle_achilles'] },
    },
    fullgym: {
      id: 'sq-main-fg', name: 'Back Squat', sets: 5, reps: '5–6 reps', cue: 'Brace hard, break hips and knees together — build to your working weight across 3 warm-up sets, then 2 heavy working sets', suggestedLoad: '60–90 kg', category: 'main', targetRegions: ['knee', 'hip_groin'],
      videoId: '',
      swapAlternative: { name: 'Front Squat', cue: 'Bar in front rack, elbows high, vertical torso — reduce 20% load, same lower body stimulus', suggestedLoad: '45–70 kg' },
      comfortVariant: { name: 'Pause Squat / Safety Bar', cue: '2s pause in hole, controlled ascent — reduce load by 20%', suggestedLoad: '40–65 kg', triggerRegions: ['knee', 'hip_groin', 'lower_back', 'ankle_achilles'] },
    },
  },
  bench: {
    bodyweight: {
      id: 'bn-main-bw', name: 'Push-Up', sets: 4, reps: '12–15 reps', cue: 'Elbows 45°, full lockout — add a pause at bottom on your heavier sets', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: ['front_shoulder', 'elbow_wrist'],
      videoId: '',
      swapAlternative: { name: 'Wide Push-Up', cue: 'Hands wider than shoulders — shifts load more to chest, less tricep', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Incline Push-Up', cue: 'Hands elevated, reduce shoulder demand — perfect form priority', suggestedLoad: 'Bodyweight', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    dumbbells: {
      id: 'bn-main-db', name: 'Dumbbell Bench Press', sets: 4, reps: '8–10 reps', cue: 'Neutral grip option, full ROM — build to a challenging weight across warm-up sets', suggestedLoad: '16–28 kg per hand', category: 'main', targetRegions: ['front_shoulder', 'elbow_wrist'],
      videoId: '',
      swapAlternative: { name: 'DB Incline Press', cue: 'Bench at 30–45°, same pressing motion — upper chest emphasis', suggestedLoad: '14–22 kg per hand' },
      comfortVariant: { name: 'Floor Dumbbell Press', cue: 'Floor limits depth — protects shoulder end-range', suggestedLoad: '12–20 kg per hand', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
    fullgym: {
      id: 'bn-main-fg', name: 'Barbell Bench Press', sets: 5, reps: '5–6 reps', cue: 'Retract scaps, arch, leg drive — build to your working weight across 3 warm-up sets, then 2 heavy working sets', suggestedLoad: '50–80 kg', category: 'main', targetRegions: ['front_shoulder', 'elbow_wrist'],
      videoId: '',
      swapAlternative: { name: 'Dumbbell Bench Press', cue: 'DBs allow full ROM and independent arm movement — same pattern, no bar', suggestedLoad: '20–32 kg per hand' },
      comfortVariant: { name: 'Close-Grip Bench Press', cue: 'Elbows tucked, reduced shoulder stress — lighter load', suggestedLoad: '40–60 kg', triggerRegions: ['front_shoulder', 'rear_shoulder', 'elbow_wrist'] },
    },
  },
  deadlift: {
    bodyweight: {
      id: 'dl-main-bw', name: 'Single-Leg Hinge', sets: 4, reps: '10 reps each side', cue: 'Hinge at hip, flat back, reach for floor — squeeze glute at top', suggestedLoad: 'Bodyweight', category: 'main', targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      swapAlternative: { name: 'Good Morning', cue: 'Bar across shoulders (or hands clasped), hinge forward — feel hamstrings stretch at bottom', suggestedLoad: 'Bodyweight' },
      comfortVariant: { name: 'Supported Hip Hinge', cue: 'Hands on wall, feel hamstring stretch — remove balance demand', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'hip_groin', 'knee'] },
    },
    dumbbells: {
      id: 'dl-main-db', name: 'Romanian Deadlift', sets: 4, reps: '8–10 reps', cue: 'Push hips back, DBs track close to legs — build to a challenging weight across warm-up sets', suggestedLoad: '18–28 kg per hand', category: 'main', targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      swapAlternative: { name: 'DB Sumo Deadlift', cue: 'Wide stance, toes out, DBs between legs — more inner thigh and glute drive', suggestedLoad: '16–26 kg per hand' },
      comfortVariant: { name: 'Single-Leg DB RDL', cue: 'One leg, lighter load — better hip dissociation', suggestedLoad: '10–16 kg per hand', triggerRegions: ['lower_back', 'hip_groin', 'knee'] },
    },
    fullgym: {
      id: 'dl-main-fg', name: 'Barbell Deadlift', sets: 5, reps: '4–5 reps', cue: 'Wedge into bar, push floor away — build to your working weight across 3 warm-up sets, then 2 heavy working sets', suggestedLoad: '80–130 kg', category: 'main', targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      swapAlternative: { name: 'Sumo Deadlift', cue: 'Wide stance, toes out, grip inside legs — same weight, more hip, less lower back', suggestedLoad: '75–120 kg' },
      comfortVariant: { name: 'Trap Bar Deadlift', cue: 'Neutral grip, more upright torso — reduce spinal stress', suggestedLoad: '60–100 kg', triggerRegions: ['lower_back', 'hip_groin', 'knee'] },
    },
  },
};

// ─── 5. PUMP ACCESSORIES (Hypertrophy) ───────────────────────────────────────

const ACCESSORIES: Record<MainSessionType, Record<InternalTier, ExerciseTemplate[]>> = {
  squat: {
    bodyweight: [
      { id: 'sq-acc-bw-1', name: 'Reverse Lunge', sets: 3, reps: '15 each', cue: 'Step back, knee lightly taps floor, drive through front foot', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Step-Up', cue: 'Drive through top foot, stand tall — same glute/quad stimulus, less knee demand', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Supported Reverse Lunge', cue: 'Hand on wall for balance — knee pain management', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] } },
      { id: 'sq-acc-bw-2', name: 'Glute Bridge', sets: 3, reps: '20', cue: 'Drive through heels, full hip extension — squeeze 2s at top', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Single-Leg Glute Bridge', cue: 'One foot up, drive through working heel — more demand each side', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Banded Clamshell', cue: 'Side-lying, controlled hip abduction', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'sq-acc-bw-3', name: 'Banded Lateral Walk', sets: 3, reps: '15 each direction', cue: 'Stay low, knees out — continuous tension on band', suggestedLoad: 'Medium band', category: 'accessory', targetRegions: ['hip_groin', 'knee'], videoId: '',
        swapAlternative: { name: 'Lateral Step-Up', cue: 'Step sideways onto a box or step — glute and hip abductor load through range', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Standing Hip Abduction (hand on wall)', cue: 'One leg, lift to side slowly — hip abductor activation with zero knee demand', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'knee', 'ankle_achilles'] } },
      { id: 'sq-acc-bw-4', name: 'Wall Sit', sets: 2, reps: '45s', cue: 'Thighs parallel, back flat — breathe steadily', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['knee'], videoId: '',
        swapAlternative: { name: 'Isometric Split Squat Hold', cue: 'Lunge position, hold still at 90° — single-leg quad endurance version', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Seated Quad Extension (chair)', cue: 'Seated, lift and hold leg straight 5s — terminal knee extension, no deep bend', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] } },
    ],
    dumbbells: [
      { id: 'sq-acc-db-1', name: 'DB Bulgarian Split Squat', sets: 3, reps: '15 each', cue: 'Upright torso, front knee tracks toe — pump reps, lighter weight', suggestedLoad: '8–14 kg per hand', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'DB Reverse Lunge', cue: 'Step back, control descent — same quad/glute pattern, no rear foot elevation', suggestedLoad: '8–14 kg per hand' },
        comfortVariant: { name: 'DB Supported Split Squat', cue: 'One hand on rack, reduce load for knee sensitivity', suggestedLoad: '6–10 kg per hand', triggerRegions: ['knee', 'ankle_achilles'] } },
      { id: 'sq-acc-db-2', name: 'DB Hip Thrust', sets: 3, reps: '15', cue: 'DB on hips, full extension — 2s squeeze at top', suggestedLoad: '16–24 kg per hand', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Single-Leg DB Hip Thrust', cue: 'One leg up, drive through working leg — double glute demand per rep', suggestedLoad: '12–18 kg' },
        comfortVariant: { name: 'Glute Bridge', cue: 'Bodyweight, higher reps — hip pain management', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'sq-acc-db-3', name: 'DB Step-Up', sets: 3, reps: '12 each', cue: 'Drive through top foot, stand fully — no push off back leg', suggestedLoad: '10–16 kg per hand', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'DB Reverse Lunge', cue: 'Step back, control the descent — same muscles, better balance accessibility', suggestedLoad: '8–14 kg per hand' },
        comfortVariant: { name: 'Bodyweight Step-Up (low box)', cue: 'No weight, lower step height — reduce knee load while keeping the pattern', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] } },
    ],
    fullgym: [
      { id: 'sq-acc-fg-1', name: 'Dumbbell Walking Lunge', sets: 3, reps: '12 each', cue: 'DBs at sides, controlled steps, upright torso — pump focus', suggestedLoad: '10–18 kg each hand', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'DB Bulgarian Split Squat', cue: 'Rear foot elevated, front knee tracks toe — more isolation and stretch', suggestedLoad: '8–14 kg per hand' },
        comfortVariant: { name: 'Bodyweight Reverse Lunge', cue: 'BW only, focus on control and range', suggestedLoad: 'Bodyweight', triggerRegions: ['knee', 'ankle_achilles'] } },
      { id: 'sq-acc-fg-2', name: 'Leg Press', sets: 3, reps: '15–20', cue: 'Full ROM, dont lock knees at top — slow 3s down', suggestedLoad: '80–120 kg', category: 'accessory', targetRegions: ['knee', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Hack Squat Machine', cue: 'Feet forward on plate, same quad focus as leg press but more upright', suggestedLoad: '60–100 kg' },
        comfortVariant: { name: 'Leg Press (Partial ROM)', cue: 'Top half of range only — reduces knee compression', suggestedLoad: '60–80 kg', triggerRegions: ['knee'] } },
      { id: 'sq-acc-fg-3', name: 'Barbell Hip Thrust', sets: 3, reps: '15', cue: 'Full extension, 2s pause at top — squeeze glutes hard', suggestedLoad: '40–70 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'DB Hip Thrust', cue: 'Same movement with dumbbells — easier to set up, same glute stimulus', suggestedLoad: '20–32 kg per hand' },
        comfortVariant: { name: 'Bodyweight Glute Bridge', cue: 'No load, focus on squeeze and hold 2s — hip/back sensitivity option', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
    ],
  },
  bench: {
    bodyweight: [
      { id: 'bn-acc-bw-1', name: 'Diamond Push-Up', sets: 3, reps: '15–20', cue: 'Hands close together, elbows track back — feel the triceps', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['elbow_wrist', 'front_shoulder'], videoId: '',
        swapAlternative: { name: 'Tricep Dip (Chair)', cue: 'Hands on chair behind, bend and straighten elbows — bodyweight tricep press', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Knee Diamond Push-Up', cue: 'Knees down, reduce load — elbow/shoulder management', suggestedLoad: 'Bodyweight', triggerRegions: ['elbow_wrist', 'front_shoulder'] } },
      { id: 'bn-acc-bw-2', name: 'Inverted Row (Table/Bar)', sets: 3, reps: '15', cue: 'Pull chest to bar, squeeze back at top — body plank-straight', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Superman Hold', cue: 'Face down, lift arms and legs — posterior chain and back activation', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Band Pull-Apart', cue: 'High reps, light band — shoulder health', suggestedLoad: 'Light band', triggerRegions: ['rear_shoulder', 'upper_back', 'elbow_wrist'] } },
      { id: 'bn-acc-bw-3', name: 'Pike Push-Up', sets: 3, reps: '12', cue: 'Hips high, head through arms at bottom — vertical push pattern', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['front_shoulder'], videoId: '',
        swapAlternative: { name: 'Wall Handstand Hold', cue: 'Kick up to wall, hold 20–30s — vertical pressing stability', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Banded Lateral Raise', cue: 'Light band, controlled — shoulder sensitive alternative', suggestedLoad: 'Light band', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck'] } },
      { id: 'bn-acc-bw-4', name: 'Prone Y-T-W Raise', sets: 2, reps: '10 each', cue: 'Face down, lift arms in Y, T, W — squeeze each position for 1s', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Band Pull-Apart (high reps)', cue: 'Light band, 30 reps — same rear delt and rhomboid stimulus standing', suggestedLoad: 'Light band' },
        comfortVariant: { name: 'Wall Slide', cue: 'Back flat on wall, slide arms overhead — zero shoulder loading, pure movement pattern', suggestedLoad: 'Bodyweight', triggerRegions: ['rear_shoulder', 'upper_back', 'neck', 'elbow_wrist'] } },
    ],
    dumbbells: [
      { id: 'bn-acc-db-1', name: 'DB Single-Arm Row', sets: 3, reps: '15 each', cue: 'Pull to hip, squeeze lat — slow 3s down', suggestedLoad: '14–22 kg per hand', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'DB Chest-Supported Row', cue: 'Lie on incline bench, pull both DBs to hips — removes lower back demand', suggestedLoad: '12–18 kg per hand' },
        comfortVariant: { name: 'Band Pull-Apart', cue: 'Light resistance, high reps — shoulder health', suggestedLoad: 'Light band', triggerRegions: ['rear_shoulder', 'upper_back', 'elbow_wrist'] } },
      { id: 'bn-acc-db-2', name: 'DB Lateral Raise', sets: 3, reps: '15–20', cue: 'Slight forward lean, thumbs up — slow and controlled', suggestedLoad: '4–8 kg per hand', category: 'accessory', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'Prone DB Rear Delt Fly', cue: 'Face down on bench, arms wide — rear delt and upper back emphasis', suggestedLoad: '4–6 kg per hand' },
        comfortVariant: { name: 'Cable/Band Lateral Raise', cue: 'Pull-through path, less impingement risk', suggestedLoad: '2–4 kg per hand', triggerRegions: ['front_shoulder', 'rear_shoulder'] } },
      { id: 'bn-acc-db-3', name: 'DB Tricep Overhead Extension', sets: 3, reps: '15', cue: 'Elbows forward, full ROM — slow negative', suggestedLoad: '8–14 kg per hand', category: 'accessory', targetRegions: ['elbow_wrist'], videoId: '',
        swapAlternative: { name: 'DB Skull Crusher', cue: 'Lie flat, lower DBs to temples — same tricep long head with different elbow angle', suggestedLoad: '6–10 kg per hand' },
        comfortVariant: { name: 'Tricep Kickback', cue: 'Hinge forward, extend arm back at elbow — zero elbow flexion load at stretched position', suggestedLoad: '4–8 kg per hand', triggerRegions: ['elbow_wrist'] } },
    ],
    fullgym: [
      { id: 'bn-acc-fg-1', name: 'Barbell Bent-Over Row', sets: 3, reps: '12–15', cue: 'Flat back, pull to sternum — pump weight, faster reps', suggestedLoad: '40–60 kg', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'Pendlay Row', cue: 'Dead stop each rep, explosive pull — heavier and more powerful version of bent-over row', suggestedLoad: '40–60 kg' },
        comfortVariant: { name: 'Cable Face Pull', cue: 'Light weight, high reps, external rotation at top', suggestedLoad: '10–15 kg', triggerRegions: ['rear_shoulder', 'upper_back', 'lower_back'] } },
      { id: 'bn-acc-fg-2', name: 'Overhead Press', sets: 3, reps: '10–12', cue: 'Brace core, press through ceiling — pump weight', suggestedLoad: '30–45 kg', category: 'accessory', targetRegions: ['front_shoulder'], videoId: '',
        swapAlternative: { name: 'DB Shoulder Press', cue: 'DBs at ear height, press overhead — independent arms, same deltoid stimulus', suggestedLoad: '14–22 kg per hand' },
        comfortVariant: { name: 'Landmine Press', cue: 'Angled press, shoulder-friendly arc', suggestedLoad: '15–25 kg', triggerRegions: ['front_shoulder', 'rear_shoulder', 'neck'] } },
      { id: 'bn-acc-fg-3', name: 'Cable Tricep Pushdown', sets: 3, reps: '20', cue: 'Elbows pinned, full extension at bottom — constant tension', suggestedLoad: '15–25 kg', category: 'accessory', targetRegions: ['elbow_wrist'], videoId: '',
        swapAlternative: { name: 'Overhead Cable Tricep Extension', cue: 'Cable behind head, extend to ceiling — hits long head more, great stretch', suggestedLoad: '10–18 kg' },
        comfortVariant: { name: 'Tricep Kickback (light DB)', cue: 'Hinge, extend arm back — very low elbow stress, pain-sensitive option', suggestedLoad: '4–6 kg per hand', triggerRegions: ['elbow_wrist'] } },
    ],
  },
  deadlift: {
    bodyweight: [
      { id: 'dl-acc-bw-1', name: 'Glute Bridge March', sets: 3, reps: '15 each', cue: 'Hips level throughout, alternate legs — glutes stay engaged', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Single-Leg Glute Bridge', cue: 'One leg extended, drive through working heel — full single-leg loading', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Supine Glute Squeeze', cue: 'Lying, squeeze and hold 5s — hip/back sensitivity', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-acc-bw-2', name: 'Superman Hold', sets: 3, reps: '10 (3s holds)', cue: 'Lift arms and legs, squeeze back — lower back hypertrophy', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['upper_back', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Reverse Hyperextension (floor)', cue: 'Face down, legs long, lift both legs — lower back and glute activation without back flexion', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Bird Dog', cue: 'Opposite arm and leg, stable spine — back-friendly', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'upper_back'] } },
      { id: 'dl-acc-bw-3', name: 'Bear Crawl', sets: 3, reps: '20 steps forward', cue: 'Knees hover 2cm off ground, move contralateral limbs — tight core', suggestedLoad: 'Bodyweight', category: 'accessory', targetRegions: ['core_ribs', 'front_shoulder'], videoId: '',
        swapAlternative: { name: 'Dead Bug', cue: 'Flat back, lower opposite arm and leg — same core anti-extension, floor-based', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Bird Dog', cue: 'All fours, opposite arm and leg — same spinal stability pattern with less shoulder demand', suggestedLoad: 'Bodyweight', triggerRegions: ['core_ribs', 'front_shoulder', 'lower_back'] } },
      { id: 'dl-acc-bw-4', name: 'Banded Good Morning', sets: 3, reps: '20', cue: 'Band around neck, hinge — feel hamstrings stretch and load', suggestedLoad: 'Medium band', category: 'accessory', targetRegions: ['lower_back', 'hip_groin'], videoId: '',
        swapAlternative: { name: 'Romanian Deadlift (bodyweight)', cue: 'Hinge at hips, reach for floor — same hamstring loading without any load', suggestedLoad: 'Bodyweight' },
        comfortVariant: { name: 'Standing Hip Hinge Against Wall', cue: 'Hands on wall, hinge back until hamstrings stretch — zero spinal compressive load', suggestedLoad: 'Bodyweight', triggerRegions: ['lower_back', 'hip_groin'] } },
    ],
    dumbbells: [
      { id: 'dl-acc-db-1', name: 'DB Hip Thrust', sets: 3, reps: '15', cue: 'DB on hips, full extension, 2s squeeze — posterior chain pump', suggestedLoad: '16–24 kg per hand', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Single-Leg DB Hip Thrust', cue: 'One leg, drive through working glute — double load demand per rep', suggestedLoad: '12–18 kg' },
        comfortVariant: { name: 'Glute Bridge', cue: 'Bodyweight, higher reps, controlled', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-acc-db-2', name: 'DB Bent-Over Row', sets: 3, reps: '15 each', cue: 'Flat back, pull to hip, squeeze lat — pump focus', suggestedLoad: '14–20 kg per hand', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'DB Single-Arm Row', cue: 'Brace on bench, pull to hip — same lat stimulus with more stability', suggestedLoad: '14–20 kg per hand' },
        comfortVariant: { name: 'Chest-Supported DB Row', cue: 'Incline bench — removes low back stress', suggestedLoad: '10–14 kg per hand', triggerRegions: ['lower_back', 'upper_back'] } },
      { id: 'dl-acc-db-3', name: 'KB Swing', sets: 3, reps: '20', cue: 'Hip snap, arms are ropes — bell floats to chest height', suggestedLoad: '14–20 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'DB Deadlift (light, fast reps)', cue: 'Lighter than working weight, explosive concentric — power endurance version of the hinge', suggestedLoad: '12–18 kg per hand' },
        comfortVariant: { name: 'Banded Good Morning', cue: 'Band around neck, hinge slowly — hip hinge pattern with minimal spinal load', suggestedLoad: 'Light band', triggerRegions: ['hip_groin', 'lower_back'] } },
    ],
    fullgym: [
      { id: 'dl-acc-fg-1', name: 'Barbell Hip Thrust', sets: 3, reps: '15', cue: 'Full extension, 2s pause, squeeze — posterior chain pump', suggestedLoad: '40–70 kg', category: 'accessory', targetRegions: ['hip_groin', 'lower_back'], videoId: '',
        swapAlternative: { name: 'Single-Leg Barbell Hip Thrust', cue: 'One leg, full extension — double per-side demand', suggestedLoad: '30–50 kg' },
        comfortVariant: { name: 'Bodyweight Glute Bridge', cue: 'BW, higher reps, no spinal load', suggestedLoad: 'Bodyweight', triggerRegions: ['hip_groin', 'lower_back'] } },
      { id: 'dl-acc-fg-2', name: 'Pendlay Row', sets: 3, reps: '12', cue: 'Dead stop each rep, explosive pull — back strength support', suggestedLoad: '40–60 kg', category: 'accessory', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '',
        swapAlternative: { name: 'T-Bar Row', cue: 'Chest pad or bent-over, narrow grip — same back stimulus, different loading angle', suggestedLoad: '30–50 kg' },
        comfortVariant: { name: 'Seated Cable Row', cue: 'Upright torso, removes lower back demand', suggestedLoad: '30–45 kg', triggerRegions: ['lower_back', 'upper_back'] } },
      { id: 'dl-acc-fg-3', name: 'Farmers Carry', sets: 3, reps: '40m', cue: 'Tall posture, grip tight, brace core — walk with purpose', suggestedLoad: '24–36 kg per hand', category: 'accessory', targetRegions: ['core_ribs', 'upper_back'], videoId: '',
        swapAlternative: { name: 'Suitcase Carry (single arm)', cue: 'One heavy dumbbell, resist lateral lean — oblique and core demand', suggestedLoad: '24–40 kg one hand' },
        comfortVariant: { name: 'Trap Bar Carry (lighter load)', cue: 'Neutral grip, lighter weight, shorter distance — same posture demand with less spinal compressive force', suggestedLoad: '16–24 kg per hand', triggerRegions: ['core_ribs', 'upper_back', 'lower_back'] } },
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
        swapAlternative: { name: 'Treadmill Sprint Intervals', cue: '30s sprint, 30s walk — cardio finisher without sled', suggestedLoad: 'Bodyweight' } },
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
      easy: { id: 'bn-fin-db-e', name: 'Bear Crawl (Easy Pace)', sets: 1, reps: '4 min (20m out, walk back)', cue: 'Hips level, slow deliberate movement — alternate opposite arm and leg, core braced throughout', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Light DB Lateral Raise Walk', cue: 'Walk slowly raising arms to shoulder height, lower — gentle shoulder recovery', suggestedLoad: '4–6 kg per hand' } },
      normal: { id: 'bn-fin-db-n', name: 'Bear Crawl Intervals', sets: 1, reps: '6 min (20m sprint / walk back)', cue: 'Drive from shoulders, hips level throughout — sprint hard for 20m, walk back and go again', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'DB Push Press Intervals', cue: '12 push presses, 30s rest — power finisher without the machine', suggestedLoad: '10–14 kg per hand' } },
      hard: { id: 'bn-fin-db-h', name: 'DB Complex', sets: 1, reps: '8 min EMOM: 5 cleans + 5 press', cue: 'Light DBs, move fast — no dropping between movements', suggestedLoad: '8–12 kg per hand', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Push-Up + DB Row EMOM', cue: 'Every minute: 8 push-ups + 6 rows each arm — easier to pace than the full complex', suggestedLoad: '10–14 kg per hand' } },
    },
    fullgym: {
      easy: { id: 'bn-fin-fg-e', name: 'Cable Push-Pull Circuit', sets: 1, reps: '4 min (alternating cable pushdown and cable row, 12 reps each)', cue: 'Slow controlled reps, light load — upper-body active recovery, no legs', suggestedLoad: '10–20 kg cable', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Tricep Pushdown + Face Pull Superset', cue: '15 pushdowns then 15 face pulls, repeat — cable-only upper-body pump finisher', suggestedLoad: '10–20 kg cable' } },
      normal: { id: 'bn-fin-fg-n', name: 'Assault Bike Intervals', sets: 1, reps: '6 min (20s sprint / 40s easy)', cue: 'All-out on sprints, survive rest — upper and lower', suggestedLoad: 'Assault bike', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Cable Row Intervals', cue: '20s hard seated row, 40s rest — upper-back metabolic work without a cardio machine', suggestedLoad: '40–60 kg cable' } },
      hard: { id: 'bn-fin-fg-h', name: 'Battle Rope EMOM', sets: 1, reps: '8 min (30s waves / 30s rest)', cue: 'Full-force alternating waves, keep slack out of the ropes — upper-body metabolic finisher', suggestedLoad: 'Battle ropes', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Push Press + Assault Bike Circuit', cue: '10 push presses then 15 cal bike, rest 30s, repeat — power finisher that stays upper-body focused', suggestedLoad: '30–40 kg barbell + bike' } },
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
        swapAlternative: { name: 'Assault Bike (Easy Pace)', cue: 'Arms and legs, 60% effort — low-impact active recovery without sled', suggestedLoad: 'Bike' } },
      normal: { id: 'dl-fin-fg-n', name: 'Treadmill Sprint Intervals', sets: 1, reps: '6 min (30s sprint / 30s walk)', cue: 'Hard sprint effort, full walk recovery — drive with hips, stay tall', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Sled Drag Intervals', cue: '20m drag, walk back — same hip hinge demand, no machine needed', suggestedLoad: '40–60 kg sled' } },
      hard: { id: 'dl-fin-fg-h', name: 'Prowler Push/Pull + Bike', sets: 1, reps: '8 min (push 20m, pull 20m, 10 cal bike)', cue: 'No rest between stations — compete against yourself', suggestedLoad: '60–80 kg sled + bike', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Treadmill Sprint + Squat Jump Circuit', cue: '30s treadmill sprint then 10 squat jumps, repeat — intense finisher without sled or bike', suggestedLoad: 'Bodyweight' } },
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
      { id: 'cond-db-e-1', name: 'Cardio Machine Warm-Up', sets: 1, reps: '3 min easy', cue: 'Bike or treadmill at easy pace — heart rate 60% max', suggestedLoad: 'Low resistance', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-db-e-2', name: 'KB Swing', sets: 4, reps: '15 — 45s rest', cue: 'Hip snap, bell to chest height — controlled and rhythmic', suggestedLoad: '12–16 kg', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-db-e-3', name: 'DB Goblet Squat', sets: 3, reps: '15 — 45s rest', cue: 'Steady tempo, feel the burn — lighter than your strength sessions', suggestedLoad: '10–16 kg per hand', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-db-e-4', name: 'Farmer Walk', sets: 3, reps: '40m each set', cue: 'Tall posture, brace core — steady pace for conditioning', suggestedLoad: '14–20 kg per hand', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-db-e-5', name: 'Cool Down Walk', sets: 1, reps: '3 min', cue: 'Easy walk, breathe deeply — lower heart rate before finishing', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
    normal: [
      { id: 'cond-db-n-1', name: 'Cardio Warm-Up', sets: 1, reps: '2 min', cue: 'Bike or treadmill, moderate pace — heart rate to 70% max', suggestedLoad: 'Low-moderate resistance', category: 'prep', targetRegions: [], videoId: '' },
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
      { id: 'cond-fg-e-1', name: 'Cardio Machine Warm-Up', sets: 1, reps: '3 min easy', cue: 'Bike or treadmill — easy pace, heart rate 60% max', suggestedLoad: 'Low resistance', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-fg-e-2', name: 'Sled Drag', sets: 4, reps: '30m — 60s rest', cue: 'Face sled, drag backward with controlled steps — low intensity, steady breathing', suggestedLoad: '40–60 kg sled', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-fg-e-3', name: 'Assault Bike (Easy)', sets: 4, reps: '2 min steady', cue: 'Moderate resistance, steady cadence — aerobic zone, conversational pace', suggestedLoad: 'Bike', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-fg-e-4', name: 'Bear Crawl (Steady Pace)', sets: 3, reps: '30m — 90s rest', cue: 'Hips level and steady, opposite arm and leg together — breathe rhythmically, no rushing', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-fg-e-5', name: 'Cool Down Walk', sets: 1, reps: '3 min', cue: 'Slow treadmill walk or light movement — heart rate below 100 bpm', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
    normal: [
      { id: 'cond-fg-n-1', name: 'Cardio Warm-Up', sets: 1, reps: '3 min', cue: 'Bike or treadmill, moderate pace — heart rate 70% max before starting', suggestedLoad: 'Moderate resistance', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-fg-n-2', name: 'Circuit A: Sled Push + Assault Bike Sprint', sets: 5, reps: '20m push / 15 cal bike — 30s rest', cue: 'Sled: drive through legs, arms extended. Bike: full effort, arms and legs together', suggestedLoad: '60–80 kg sled', category: 'mechanical', targetRegions: [], videoId: '' },
      { id: 'cond-fg-n-3', name: 'Circuit B: Bear Crawl + KB Swing + Box Jump', sets: 4, reps: '20m crawl / 15 swings / 8 jumps — 30s rest', cue: 'Bear crawl: hips level, drive from shoulders. Swing: explosive hip snap. Box jump: step down every rep', suggestedLoad: '16–20 kg KB', category: 'accessory', targetRegions: [], videoId: '' },
      { id: 'cond-fg-n-4', name: 'AMRAP Finisher', sets: 1, reps: '8 min: 10 cal bike + 15 KB swings + 10 box jumps', cue: 'Complete as many rounds as possible — note total rounds and compete next session', suggestedLoad: 'As above', category: 'finisher', targetRegions: [], videoId: '' },
      { id: 'cond-fg-n-5', name: 'Cool Down', sets: 1, reps: '3 min', cue: 'Easy bike spin, deep breathing — full recovery before leaving the gym', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: [], videoId: '' },
    ],
    hard: [
      { id: 'cond-fg-h-1', name: 'Dynamic Warm-Up', sets: 1, reps: '3 min', cue: 'Bear crawl 20m + 15 box jumps + 10 KB swings — get fully primed', suggestedLoad: 'Light', category: 'prep', targetRegions: [], videoId: '' },
      { id: 'cond-fg-h-2', name: 'Circuit A: Sled Push + Bear Crawl Sprint + Assault Bike', sets: 6, reps: '20m sled push / 10m bear crawl / 10 cal bike — 20s rest', cue: 'Maximum effort on all three. Sled: drive through legs. Bear crawl: explosive and low. Bike: full sprint. Rotate immediately', suggestedLoad: '70–90 kg sled', category: 'mechanical', targetRegions: [], videoId: '' },
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

/**
 * Returns power-goal-specific mechanical priming templates.
 * These replace the standard slow-activation exercises with dynamic,
 * velocity-based pattern drills (hip speed drills, lateral bounds, speed
 * squats/good-mornings) to prime force expression before the neuro block.
 */
export function getPowerMechanical(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate[] {
  return POWER_MECHANICAL[sessionType][toInternalTier(tier)];
}

export function getNeuro(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate {
  return NEURO[sessionType][toInternalTier(tier)];
}

/**
 * Returns power-goal-specific neurological priming templates.
 * These are more intense, reactive exercises than the standard NEURO block
 * (depth drops, power cleans, clap push-ups) designed to maximise CNS
 * activation before the KPI lift for rate-of-force development.
 */
export function getPowerNeuro(sessionType: MainSessionType, tier: EquipmentTier): ExerciseTemplate {
  return POWER_NEURO[sessionType][toInternalTier(tier)];
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

// ─── GOAL-DRIVEN CONDITIONING BLOCK ──────────────────────────────────────────
// Short 2-exercise circuits injected into strength sessions for users with a
// fat-loss goal. These replace the last accessory + standard finisher to keep
// session duration the same while adding a caloric and cardiovascular stimulus.

const GOAL_CONDITIONING_BLOCKS: Record<InternalTier, { easy: ExerciseTemplate[]; normal: ExerciseTemplate[]; hard: ExerciseTemplate[] }> = {
  bodyweight: {
    easy: [
      { id: 'gcond-bw-e-1', name: 'Mountain Climbers', sets: 3, reps: '30s — 30s rest', cue: 'Hips level, drive knees to chest alternately — moderate controlled pace, breathe steadily', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Step Touch + High Knee March', cue: 'Side step then march in place with high knees — same cardio effect, zero impact on wrists or shoulders', suggestedLoad: 'Bodyweight' } },
      { id: 'gcond-bw-e-2', name: 'Bodyweight Squat Pulse', sets: 3, reps: '20 pulses — 30s rest', cue: 'Stay at parallel, small pulsing reps — quad burn, keep chest tall', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
    ],
    normal: [
      { id: 'gcond-bw-n-1', name: 'Burpee', sets: 3, reps: '10 — 30s rest', cue: 'Jump back to plank, chest to floor, drive up and jump — full extension at top every rep', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Squat Thrust (no jump)', cue: 'Step or jump back to plank, push-up optional, step or jump back in — full-body effort without the impact', suggestedLoad: 'Bodyweight' } },
      { id: 'gcond-bw-n-2', name: 'Jump Squat', sets: 3, reps: '10 — 30s rest', cue: 'Squat to parallel, explode upward — land soft through toes to heel, immediately back down', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
    ],
    hard: [
      { id: 'gcond-bw-h-1', name: 'Burpee', sets: 4, reps: '12 — 20s rest', cue: 'Full burpee — chest to floor, jump at top with arms overhead. Go as fast as you can maintain form', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Plank Climber + Jump Squat Circuit', cue: '10 plank climbers then 10 jump squats — same total-body intensity without the coordination demand of a full burpee', suggestedLoad: 'Bodyweight' } },
      { id: 'gcond-bw-h-2', name: 'Alternating Jump Lunge', sets: 4, reps: '10 each leg — 20s rest', cue: 'Lunge down, drive both legs and switch in the air — land in opposite lunge, absorb through the front heel', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '' },
    ],
  },
  dumbbells: {
    easy: [
      { id: 'gcond-db-e-1', name: 'KB / DB Swing', sets: 4, reps: '15 — 45s rest', cue: 'Hip hinge and snap, bell to chest height — squeeze glutes at top, let it fall back between legs under control', suggestedLoad: '12–16 kg', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Goblet Squat (continuous)', cue: 'DB or KB at chest, controlled tempo — lower-back friendly, same metabolic demand without the hinge pattern', suggestedLoad: '10–16 kg' } },
      { id: 'gcond-db-e-2', name: 'Goblet Squat (continuous)', sets: 3, reps: '15 — 30s rest', cue: 'Hold dumbbell or KB at chest, full depth — steady breathing rhythm, no resting at the top', suggestedLoad: '10–16 kg', category: 'finisher', targetRegions: [], videoId: '' },
    ],
    normal: [
      { id: 'gcond-db-n-1', name: 'KB / DB Swing', sets: 4, reps: '20 — 30s rest', cue: 'Explosive hip drive — pack the lats, bell floats to chest, hips lock at top. Power conditioning', suggestedLoad: '14–20 kg', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'DB Romanian Deadlift + Jump', cue: '8 RDLs then 4 broad jumps — hip hinge power variation without the swing pattern', suggestedLoad: '12–18 kg per hand' } },
      { id: 'gcond-db-n-2', name: 'DB Thruster', sets: 4, reps: '10 — 30s rest', cue: 'Front rack, squat deep, drive up and press overhead in one motion — no pause between squat and press', suggestedLoad: '8–14 kg per hand', category: 'finisher', targetRegions: [], videoId: '' },
    ],
    hard: [
      { id: 'gcond-db-h-1', name: 'KB / DB Swing', sets: 5, reps: '20 — 20s rest', cue: 'Max power hip snap — challenge your swings with a heavier bell than usual. Track heart rate recovery', suggestedLoad: '16–24 kg', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'DB Power Clean', cue: '6 explosive power cleans from hang — lower swing volume, higher peak force — same rate-of-force demand', suggestedLoad: '14–20 kg per hand' } },
      { id: 'gcond-db-h-2', name: 'DB Thruster', sets: 5, reps: '12 — 20s rest', cue: 'Heavy front rack squat into press — this is the hardest variation, keep form locked throughout all reps', suggestedLoad: '10–16 kg per hand', category: 'finisher', targetRegions: [], videoId: '' },
    ],
  },
  fullgym: {
    easy: [
      { id: 'gcond-fg-e-1', name: 'Bear Crawl (Steady Pace)', sets: 3, reps: '2 min steady — 60s rest', cue: 'Hips level, alternate opposite arm and leg — slow and deliberate, breathe steadily, aim for a conversational pace throughout', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Assault Bike (Moderate)', cue: 'Arms and legs together, 70% max effort — same low-intensity aerobic conditioning, no coordination required', suggestedLoad: 'Bike' } },
      { id: 'gcond-fg-e-2', name: 'Assault Bike (Moderate)', sets: 3, reps: '2 min steady — 60s rest', cue: 'Arms and legs together, 70% max effort — keep cadence consistent, this should feel hard but sustainable', suggestedLoad: 'Bike', category: 'finisher', targetRegions: [], videoId: '' },
    ],
    normal: [
      { id: 'gcond-fg-n-1', name: 'Bear Crawl Intervals', sets: 5, reps: '30s hard / 30s easy', cue: 'Drive hard for 20m bear crawl, walk back slowly for recovery — hips level throughout, repeat for all rounds without stopping', suggestedLoad: 'Bodyweight', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Assault Bike Intervals', cue: '30s all-out bike sprint then 30s easy pedal — same interval structure, full-body cardio', suggestedLoad: 'Bike' } },
      { id: 'gcond-fg-n-2', name: 'Sled Push', sets: 4, reps: '20m — 45s rest', cue: 'Low position, drive through legs, arms extended — keep chest up and take short powerful steps', suggestedLoad: '50–70 kg sled', category: 'finisher', targetRegions: [], videoId: '' },
    ],
    hard: [
      { id: 'gcond-fg-h-1', name: 'Assault Bike Sprints', sets: 6, reps: '20s all-out / 40s rest', cue: 'Maximum effort for 20s — both arms and legs, no pacing. Full recovery before the next sprint', suggestedLoad: 'Bike', category: 'finisher', targetRegions: [], videoId: '',
        swapAlternative: { name: 'Bear Crawl Sprints', cue: '15m max-effort bear crawl, 40s rest — explosive full-body conditioning without the bike', suggestedLoad: 'Bodyweight' } },
      { id: 'gcond-fg-h-2', name: 'Sled Push', sets: 5, reps: '20m — 30s rest', cue: 'Heavy sled, explosive drive — minimal rest keeps heart rate elevated. Sprint back after each push', suggestedLoad: '70–100 kg sled', category: 'finisher', targetRegions: [], videoId: '' },
    ],
  },
};

export function getGoalConditioningBlock(
  tier: EquipmentTier,
  energy: 'easy' | 'normal' | 'hard',
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced'
): ExerciseTemplate[] {
  const base = GOAL_CONDITIONING_BLOCKS[toInternalTier(tier)][energy];
  // Only use the first (primary) exercise — keeps the conditioning block tight
  // and avoids bloating the session with a second finisher exercise.
  const primary = base[0];
  // Scale sets based on experience level so beginners work at lower volume
  // (−1 set, min 1) and advanced athletes at higher volume (+1 set).
  const scaledSets =
    experienceLevel === 'beginner'
      ? Math.max(1, primary.sets - 1)
      : experienceLevel === 'advanced'
      ? primary.sets + 1
      : primary.sets;
  return [{ ...primary, sets: scaledSets }];
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

// ─── REGION-SPECIFIC PREHAB ────────────────────────────────────────────────────
// Curated circuits targeting each of the 11 pain regions.
// Equipment-agnostic (all bodyweight / light band).

const PREHAB_BY_REGION: Record<PainRegion, ExerciseTemplate[]> = {
  rear_shoulder: [
    { id: 'ph-r-rs-1', name: 'Band Pull-Apart', sets: 3, reps: '15 slow reps', cue: 'Arms straight at shoulder height — pull band to sternum, squeeze shoulder blades for 1s. Rear-delt and rotator cuff activation', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '' },
    { id: 'ph-r-rs-2', name: 'Face Pull (band)', sets: 3, reps: '12 reps', cue: 'Pull band to forehead, elbows high and wide, externally rotate at end — feel rear delt and external rotators fire', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '' },
    { id: 'ph-r-rs-3', name: 'Prone Y Raise', sets: 2, reps: '10 slow reps', cue: 'Face down, arms in Y shape overhead — lift slowly, squeeze lower traps and rear delts. Control the descent', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['rear_shoulder', 'upper_back'], videoId: '' },
    { id: 'ph-r-rs-4', name: 'Wall Slide', sets: 2, reps: '10 slow reps', cue: 'Back flat on wall, arms at 90° — slide overhead keeping elbows and wrists in contact. Scapular control', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['rear_shoulder', 'front_shoulder'], videoId: '' },
    { id: 'ph-r-rs-5', name: 'Cross-Body Shoulder Stretch', sets: 2, reps: '30s each side', cue: 'Pull arm across chest at shoulder height — feel posterior capsule and rear delt. No twisting the torso', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['rear_shoulder'], videoId: '' },
  ],
  front_shoulder: [
    { id: 'ph-r-fs-1', name: 'Doorway Chest Stretch', sets: 2, reps: '30s each side', cue: 'Arm at 90°, step through doorway — breathe deeply into the pec and anterior delt stretch. No leaning forward', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['front_shoulder', 'upper_back'], videoId: '' },
    { id: 'ph-r-fs-2', name: 'Prone Shoulder External Rotation', sets: 3, reps: '12 each side', cue: 'Face down, elbow at 90°, rotate forearm upward — rotator cuff health, counteracts internal rotation dominance', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '' },
    { id: 'ph-r-fs-3', name: 'Band Pull-Apart', sets: 3, reps: '15 slow reps', cue: 'Arms straight, pull band to sternum — opens chest and activates rear structures to offset front shoulder load', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['front_shoulder', 'rear_shoulder', 'upper_back'], videoId: '' },
    { id: 'ph-r-fs-4', name: 'Pec Minor Stretch (doorway)', sets: 2, reps: '30s each side', cue: 'Arm higher (120°) in doorway — targets the pec minor specifically. Breathe into the stretch, feel coracoid area open', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['front_shoulder'], videoId: '' },
    { id: 'ph-r-fs-5', name: 'Shoulder CAR (Controlled Articular Rotation)', sets: 2, reps: '5 slow circles each side', cue: 'Full active shoulder circle — reach as far as possible in every direction. No compensating with trunk. Joint health', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['front_shoulder', 'rear_shoulder'], videoId: '' },
  ],
  elbow_wrist: [
    { id: 'ph-r-ew-1', name: 'Wrist Flexor Stretch', sets: 2, reps: '30s each side', cue: 'Arm extended, palm up, gently pull fingers back — feel medial forearm and flexor tendons. Never force', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['elbow_wrist'], videoId: '' },
    { id: 'ph-r-ew-2', name: 'Wrist Extensor Stretch', sets: 2, reps: '30s each side', cue: 'Arm extended, palm down, gently pull fingers toward you — targets extensors and lateral elbow (common extensor tendon)', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['elbow_wrist'], videoId: '' },
    { id: 'ph-r-ew-3', name: 'Wrist Circles', sets: 2, reps: '10 each direction', cue: 'Slow full-range circles — lubricate the joint, mobilise all planes. Go to end range in each direction', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['elbow_wrist'], videoId: '' },
    { id: 'ph-r-ew-4', name: 'Band Finger Extension', sets: 2, reps: '20 reps', cue: 'Loop band around fingers, spread against resistance — strengthens extensors to balance grip dominance and reduce lateral elbow load', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['elbow_wrist'], videoId: '' },
    { id: 'ph-r-ew-5', name: 'Forearm Supination / Pronation', sets: 2, reps: '15 each direction', cue: 'Elbow at 90°, slowly rotate palm up then down — radioulnar joint mobility and bicep tendon health', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['elbow_wrist'], videoId: '' },
  ],
  neck: [
    { id: 'ph-r-nk-1', name: 'Chin Tuck', sets: 3, reps: '10 reps, hold 3s each', cue: 'Gently retract chin straight back (not down) — feel a lengthening at the base of skull. Deep cervical flexor activation', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['neck', 'upper_back'], videoId: '' },
    { id: 'ph-r-nk-2', name: 'Neck Side Stretch', sets: 2, reps: '30s each side', cue: 'Ear toward shoulder, opposite hand resting gently on head — never pull. Breathe slowly, feel upper trap and SCM lengthen', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['neck'], videoId: '' },
    { id: 'ph-r-nk-3', name: 'Levator Scapulae Stretch', sets: 2, reps: '30s each side', cue: 'Turn head 45°, tuck chin toward armpit, hand on back of head for gentle assist — targets the levator scapulae', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['neck', 'upper_back'], videoId: '' },
    { id: 'ph-r-nk-4', name: 'Upper Trap Stretch', sets: 2, reps: '30s each side', cue: 'Sit, grip edge of chair, tilt head to opposite side — feel the upper trap lengthen. Keep shoulder down throughout', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['neck', 'upper_back'], videoId: '' },
    { id: 'ph-r-nk-5', name: 'Thoracic Cat-Cow', sets: 2, reps: '10 slow reps', cue: 'All fours, full spinal flexion and extension — frees cervicothoracic junction which contributes to neck loading', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['neck', 'upper_back'], videoId: '' },
  ],
  lower_back: [
    { id: 'ph-r-lb-1', name: 'Dead Bug', sets: 3, reps: '8 each side', cue: 'Low back pressed to floor throughout — reach opposite arm and leg, exhale fully at end. Anti-extension deep core', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['lower_back', 'core_ribs'], videoId: '' },
    { id: 'ph-r-lb-2', name: 'Bird Dog', sets: 3, reps: '8 each side, hold 3s', cue: 'All fours, extend opposite arm and leg — keep back flat (no hiking or rotating). Multifidus and lumbar stabilisers', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['lower_back', 'core_ribs'], videoId: '' },
    { id: 'ph-r-lb-3', name: 'Cat-Cow', sets: 2, reps: '10 slow cycles', cue: 'All fours — exhale into full flexion, inhale into extension. Move from the lumbar spine, slow and controlled', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['lower_back', 'core_ribs'], videoId: '' },
    { id: 'ph-r-lb-4', name: 'Hip Flexor Stretch', sets: 2, reps: '45s each side', cue: 'Deep lunge, back knee padded — tuck pelvis, breathe into hip flexor. Tight hip flexors drive anterior pelvic tilt and lower back pain', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['lower_back', 'hip_groin'], videoId: '' },
    { id: 'ph-r-lb-5', name: 'Glute Bridge', sets: 3, reps: '15 reps, hold 2s at top', cue: 'Feet flat, push through heels — squeeze glutes at top, keep ribs down. Glute strength directly offloads lower back', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['lower_back', 'hip_groin'], videoId: '' },
  ],
  upper_back: [
    { id: 'ph-r-ub-1', name: 'Band Pull-Apart', sets: 3, reps: '15 slow reps', cue: 'Arms at shoulder height, pull band to sternum — squeeze mid-traps and rhomboids for 1s. Scapular retraction pattern', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '' },
    { id: 'ph-r-ub-2', name: 'Thread-the-Needle Rotation', sets: 2, reps: '8 each side, hold 3s', cue: 'All fours, thread one arm under the body — breathe into the thoracic rotation. Go deeper with each breath', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '' },
    { id: 'ph-r-ub-3', name: 'Book Opener (thoracic rotation)', sets: 2, reps: '8 each side', cue: 'Side-lying, knees stacked, sweep top arm to opposite side — follow with eyes, breathe into the stretch. T-spine rotation', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['upper_back'], videoId: '' },
    { id: 'ph-r-ub-4', name: 'Prone T-Spine Extension', sets: 2, reps: '10 slow reps', cue: 'Face down, arms in T shape — lift chest and arms slowly, hold 2s. Thoracic extensors and rear delt', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['upper_back', 'rear_shoulder'], videoId: '' },
    { id: 'ph-r-ub-5', name: 'Wall Slide', sets: 2, reps: '10 slow reps', cue: 'Back flat on wall, arms overhead — keep full contact throughout the slide. Scapular upward rotation and serratus anterior', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['upper_back', 'front_shoulder'], videoId: '' },
  ],
  core_ribs: [
    { id: 'ph-r-cr-1', name: 'Dead Bug', sets: 3, reps: '8 each side', cue: 'Low back stays glued to floor — reach and extend opposite limbs, exhale fully. TVA and anti-extension control', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['core_ribs', 'lower_back'], videoId: '' },
    { id: 'ph-r-cr-2', name: 'Pallof Press (Isometric Hold)', sets: 3, reps: '20s each side', cue: 'Band at sternum height, press hands forward and hold — resist rotation, breathe. Anti-rotation oblique and TVA work', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['core_ribs', 'lower_back'], videoId: '' },
    { id: 'ph-r-cr-3', name: 'McGill Side Plank', sets: 2, reps: '20s each side', cue: 'Elbow under shoulder, knees bent — lift hips into alignment, breathe normally. QL and oblique lateral stability', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['core_ribs', 'lower_back'], videoId: '' },
    { id: 'ph-r-cr-4', name: 'Bird Dog', sets: 3, reps: '8 each side, hold 3s', cue: 'All fours, opposite arm and leg — keep spine perfectly neutral, no rotation. Deep core and multifidus', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['core_ribs', 'lower_back'], videoId: '' },
    { id: 'ph-r-cr-5', name: 'Hollow Body Hold', sets: 3, reps: '20s', cue: 'On back, arms overhead, legs straight — press lower back to floor, lift shoulders and legs slightly. Full core compression', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['core_ribs'], videoId: '' },
  ],
  knee: [
    { id: 'ph-r-kn-1', name: 'Terminal Knee Extension (band)', sets: 3, reps: '15 each side', cue: 'Band behind knee, stand on one leg — straighten knee fully against band resistance, hold 1s. VMO isolation', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['knee'], videoId: '' },
    { id: 'ph-r-kn-2', name: 'Slow Step-Down', sets: 3, reps: '10 each side', cue: 'Stand on step, lower opposite heel to floor in 3s — control the knee tracking. Eccentric quad and patella prehab', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['knee'], videoId: '' },
    { id: 'ph-r-kn-3', name: 'VMO Wall Sit', sets: 3, reps: '30s', cue: 'Narrow stance, toes forward, 90° knee angle — hold, feel inner quad working. VMO and quad endurance', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['knee'], videoId: '' },
    { id: 'ph-r-kn-4', name: 'Banded Clamshell', sets: 3, reps: '15 each side', cue: 'Band above knees, feet together — rotate top knee up, hold 1s, lower slowly. Glute med activation improves knee tracking', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['knee', 'hip_groin'], videoId: '' },
    { id: 'ph-r-kn-5', name: 'Quad Set (isometric)', sets: 2, reps: '10 reps, hold 10s each', cue: 'Lie flat, roll under knee — contract quad, press knee down, hold. Wakes VMO without load on the joint', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['knee'], videoId: '' },
  ],
  hip_groin: [
    { id: 'ph-r-hg-1', name: 'Banded Clamshell', sets: 3, reps: '15 each side', cue: 'Band above knees, feet together — rotate top knee up, hold 1s, lower slowly. Glute med and external hip rotator activation', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['hip_groin', 'knee'], videoId: '' },
    { id: 'ph-r-hg-2', name: 'Copenhagen Adductor Hold', sets: 3, reps: '20s each side', cue: 'Top leg on chair or bench, bottom leg reaches — squeeze inner thigh to hold. Adductor strength and groin prehab', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin'], videoId: '' },
    { id: 'ph-r-hg-3', name: 'Hip Flexor Stretch', sets: 2, reps: '45s each side', cue: 'Deep lunge, back knee padded, tuck pelvis — breathe into hip flexor. Anterior hip and iliopsoas length', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin', 'lower_back'], videoId: '' },
    { id: 'ph-r-hg-4', name: '90/90 Hip Stretch', sets: 2, reps: '45s each side', cue: 'On back, figure-4 position — breathe deeply, let hip open. Piriformis and external hip rotator prehab', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['hip_groin'], videoId: '' },
    { id: 'ph-r-hg-5', name: 'Lateral Band Walk', sets: 2, reps: '15 steps each direction', cue: 'Band around ankles, slight squat position — step sideways keeping toes forward. Glute med and hip abductor strength', suggestedLoad: 'Light band', category: 'prehab', targetRegions: ['hip_groin', 'knee'], videoId: '' },
  ],
  ankle_achilles: [
    { id: 'ph-r-aa-1', name: 'Heel Drop (eccentric)', sets: 3, reps: '15 each side', cue: 'Heels off step edge, lift on both then lower on one in 3–5s — eccentric Achilles tendon loading. The gold standard', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['ankle_achilles', 'calf_shin'], videoId: '' },
    { id: 'ph-r-aa-2', name: 'Tibialis Raise', sets: 3, reps: '20 reps', cue: 'Heels on wall, lift toes and forefoot toward shin — slow and controlled. Shin splint prevention and dorsiflexion prehab', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['ankle_achilles', 'calf_shin'], videoId: '' },
    { id: 'ph-r-aa-3', name: 'Single-Leg Balance', sets: 3, reps: '30s each side', cue: 'Stand on one leg, eyes open then close for extra challenge — proprioception and ankle stability. Small adjustments are normal', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['ankle_achilles'], videoId: '' },
    { id: 'ph-r-aa-4', name: 'Ankle Circles', sets: 2, reps: '10 each direction, each ankle', cue: 'Seated, foot off floor — slow full-range circles, reach maximum end range each direction. Joint lubrication', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['ankle_achilles'], videoId: '' },
    { id: 'ph-r-aa-5', name: 'Calf Stretch (wall)', sets: 2, reps: '45s each side', cue: 'Foot against base of wall, heel down — straight leg (gastroc) then bent knee (soleus). Both are needed for Achilles health', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['ankle_achilles', 'calf_shin'], videoId: '' },
  ],
  calf_shin: [
    { id: 'ph-r-cs-1', name: 'Standing Calf Raise (slow eccentric)', sets: 3, reps: '15 reps (3s down)', cue: 'Rise to toes on both feet, lower on one in 3s — eccentric overload builds tendon and muscle resilience', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['calf_shin', 'ankle_achilles'], videoId: '' },
    { id: 'ph-r-cs-2', name: 'Tibialis Raise', sets: 3, reps: '20 reps', cue: 'Heels on wall or ground, lift toes toward shin — tibialis anterior activation and shin splint prevention', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['calf_shin', 'ankle_achilles'], videoId: '' },
    { id: 'ph-r-cs-3', name: 'Soleus Stretch', sets: 2, reps: '45s each side', cue: 'Against wall, knee bent, heel down — lean forward. Targets the deeper soleus, often missed in standard calf stretches', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['calf_shin', 'ankle_achilles'], videoId: '' },
    { id: 'ph-r-cs-4', name: 'Single-Leg Calf Raise', sets: 3, reps: '12 each side', cue: 'One leg, full range — rise fully then lower slowly. Double the eccentric load on each calf compared to bilateral', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['calf_shin', 'ankle_achilles'], videoId: '' },
    { id: 'ph-r-cs-5', name: 'Seated Toe Raise', sets: 2, reps: '20 reps', cue: 'Seated, heel on floor — lift toes and forefoot as high as possible. Tibialis anterior and anterior compartment', suggestedLoad: 'Bodyweight', category: 'prehab', targetRegions: ['calf_shin'], videoId: '' },
  ],
};

const PREHAB_WARMUP: ExerciseTemplate = { id: 'ph-s-1', name: 'Cardio Warm-Up (Easy Walk / Bike)', sets: 1, reps: '3 min', cue: 'Start easy — just get blood flowing to the joints before any movement', suggestedLoad: 'Low intensity', category: 'prep', targetRegions: [], videoId: '' };
const PREHAB_COOLDOWN: ExerciseTemplate = { id: 'ph-s-9', name: 'Supine Hip 90/90 Stretch', sets: 1, reps: '45s each side', cue: 'On back, figure-4 position — breathe deeply, let hip open. Hip capsule and piriformis', suggestedLoad: 'Bodyweight', category: 'cooldown', targetRegions: ['hip_groin', 'lower_back'], videoId: '' };

export function getRegionPrehabWorkout(region: PainRegion): ExerciseTemplate[] {
  return [PREHAB_WARMUP, ...PREHAB_BY_REGION[region], PREHAB_COOLDOWN];
}

export function getRegionPrehabExercise(region: PainRegion): ExerciseTemplate {
  return PREHAB_BY_REGION[region][0];
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

export function getAllPickableExercises(tier: EquipmentTier): ExerciseTemplate[] {
  const internalTier = toInternalTier(tier);
  const seen = new Set<string>();
  const results: ExerciseTemplate[] = [];

  const add = (t: ExerciseTemplate) => {
    if (!seen.has(t.name)) {
      seen.add(t.name);
      results.push(t);
    }
  };

  const mainTypes: MainSessionType[] = ['squat', 'bench', 'deadlift'];

  for (const s of mainTypes) {
    add(MAIN_LIFTS[s][internalTier]);
  }

  for (const s of mainTypes) {
    for (const t of ACCESSORIES[s][internalTier]) {
      add(t);
    }
  }

  const regions = Object.values(PREHAB_BY_REGION) as ExerciseTemplate[][];
  for (const regionExercises of regions) {
    for (const t of regionExercises) {
      add(t);
    }
  }

  const categoryOrder: Record<string, number> = { main: 0, accessory: 1, prehab: 2 };
  results.sort((a, b) => {
    const oa = categoryOrder[a.category] ?? 99;
    const ob = categoryOrder[b.category] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return results;
}
