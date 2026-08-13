import type { ExerciseTemplate } from './exercise-db';
import type { PainRegion } from './store';

/**
 * ACUTE-PHASE REHAB — what the app gives someone whose body part is hurting now.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WENT WRONG
 * ─────────────────────────────────────────────────────────────────────────────
 * Telling the app a body part hurt got you stretches of that body part. Two
 * separate routes, both measured in the live app:
 *
 *   Restore -> Targeted Prehab -> Hamstrings
 *     Standing Hamstring Stretch      2 x 45s each side
 *     Supine Hamstring Stretch (Strap) 2 x 45s each side
 *     Nordic Curl Negative (slow)      3 x 5
 *     Hip Hinge Against Wall           "feel hamstring stretch at bottom"
 *     Pigeon Pose                      2 x 45s each side
 *     Seated Forward Fold              2 x 60s
 *
 *   Report hamstring pain on the readiness screen, then train
 *     The session's rehab slot is getRegionPrehabExercise('hamstrings'),
 *     which returns the FIRST entry for that region — the Standing Hamstring
 *     Stretch again.
 *
 * A strained muscle is a partially torn one. Holding it at its longest point
 * for 45 seconds pulls the repairing fibres apart, and a Nordic curl negative
 * is the single heaviest lengthening load a hamstring can be given — a
 * return-to-sport exercise handed to someone in week one. The same shape of
 * mistake ran through the whole table: eccentric heel drops for an acute
 * Achilles, a Copenhagen hold for a fresh groin strain, a doorway pec stretch
 * for a strained chest, end-range shoulder extension for a torn biceps tendon.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS FILE ENFORCES
 * ─────────────────────────────────────────────────────────────────────────────
 * When a body region is named as the reason for the session, that region's work
 * comes from here and only from here. Every exercise below is one of:
 *
 *   isometric            the muscle works, nothing moves, nothing lengthens
 *   controlled isotonic  short range, light load, slow, well inside the middle
 *   activation           switching the area on without loading it
 *   low-load mobility    keeping a joint moving, explicitly stopping short of
 *                        the end of the range
 *   circulation          moving blood and swelling, no muscular demand at all
 *
 * and none is any of:
 *
 *   a static or passive stretch of the injured tissue
 *   an aggressive or ballistic dynamic movement
 *   a heavy eccentric
 *   anything that leaves the ground
 *
 * Effort is prescribed in the cue as a fraction — "about a third of your
 * effort" — rather than as a weight, because in the acute phase the correct
 * load is defined by what does not hurt, not by a number.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THE STRETCHING WENT
 * ─────────────────────────────────────────────────────────────────────────────
 * Nowhere. It is all still in the app, in Restore -> Mobility & Flexibility,
 * which is the session for someone who is NOT hurt. What changed is that
 * naming a sore region no longer routes you to it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOT A DIAGNOSIS
 * ─────────────────────────────────────────────────────────────────────────────
 * This is early-stage self-management for a sore area, held deliberately below
 * the level at which it could do harm. It does not diagnose anything and it
 * does not replace an assessment. Every protocol carries the pain rule with it
 * (see ACUTE_PROTOCOL_NOTES) and the session screen shows it as a banner that
 * cannot be dismissed.
 *
 * A machine-readable copy of the whole table is generated to
 * ACUTE-REHAB-MAP.json by `npm run acute-map`, so it can be reviewed by someone
 * who does not read TypeScript. tests/acute-rehab.check.mjs fails if the two
 * ever disagree.
 */

// ─── The exercises ───────────────────────────────────────────────────────────

/** Written for the acute phase. */
const A_SUPINE_ISOMETRIC_HAMSTRING_PRESS_BENT_KNEE: ExerciseTemplate =
  {
    id: 'acute-01-supine-isometric-hamstring-press-b',
    name: 'Supine Isometric Hamstring Press (Bent Knee)',
    sets: 3,
    reps: '8 reps, hold 10s each side',
    cue: 'Lie on your back with the sore leg bent to a right angle and the heel on the floor. Press the heel gently down into the floor at about a third of your effort and hold - the hamstring switches on with nothing moving and nothing pulling.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['hamstrings'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-kn-4; classification copied, dose dialled down for the acute phase. */
const A_BANDED_CLAMSHELL: ExerciseTemplate =
  {
    id: 'acute-02-banded-clamshell',
    name: 'Banded Clamshell',
    sets: 2,
    reps: '15 each side',
    cue: 'Lie on your side, knees bent and stacked, light band above the knees - open the top knee a small way, hold a second and lower slowly. Keep the top hip from rolling backwards.',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['knee', 'hip_groin', 'glutes'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glute medius',
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from ph-r-gl-2; classification copied, dose dialled down for the acute phase. */
const A_GLUTE_BRIDGE_ISOMETRIC_HOLD: ExerciseTemplate =
  {
    id: 'acute-03-glute-bridge-isometric-hold',
    name: 'Glute Bridge (isometric hold)',
    sets: 3,
    reps: '8 reps, hold 5s each',
    cue: 'Feet flat and tucked in close to your backside, drive through the heels and lift the hips until you are straight from knee to shoulder - hold, then lower with control. Heels in close keeps the work in the glutes and off the hamstring.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes', 'lower_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glutes',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_PRONE_KNEE_BEND_HOLD: ExerciseTemplate =
  {
    id: 'acute-04-prone-knee-bend-hold',
    name: 'Prone Knee Bend Hold',
    sets: 2,
    reps: '10 reps, hold 3s each side',
    cue: 'Lie face down and bend the sore knee up to about halfway, hold it there for three seconds, then lower it slowly. The only weight is your own shin - stop short of anything that pulls or grabs.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['hamstrings'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from sq-acc-bw-5; classification copied, dose dialled down for the acute phase. */
const A_SINGLE_LEG_GLUTE_BRIDGE: ExerciseTemplate =
  {
    id: 'acute-05-single-leg-glute-bridge',
    name: 'Single-Leg Glute Bridge',
    sets: 2,
    reps: '8 each side',
    cue: 'One foot planted close to your backside, the other knee hugged in - lift until the hips are level, hold a beat, then lower slowly. Stop the set if the hamstring starts to cramp or grab.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes', 'hamstrings', 'hip_groin', 'lower_back'],
    videoId: '',
    movementPattern: 'hinge',
    primaryMuscle: 'Glutes',
    secondaryMuscles: ['Hamstrings', 'Core'],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Written for the acute phase. */
const A_GLUTE_SET_ISOMETRIC: ExerciseTemplate =
  {
    id: 'acute-06-glute-set-isometric',
    name: 'Glute Set (isometric)',
    sets: 3,
    reps: '10 reps, hold 5s each',
    cue: 'Lie on your back with the legs straight - squeeze both buttocks together at about half effort, hold, then let go completely. Nothing lifts and nothing moves at the hip.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-gl-2; classification copied, dose dialled down for the acute phase. */
const A_GLUTE_BRIDGE_ISOMETRIC_HOLD_2: ExerciseTemplate =
  {
    id: 'acute-07-glute-bridge-isometric-hold',
    name: 'Glute Bridge (isometric hold)',
    sets: 3,
    reps: '8 reps, hold 5s each',
    cue: 'Feet flat and hip-width apart - lift the hips until you are straight from knee to shoulder and squeeze at the top. Lower slowly and reset properly between reps.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes', 'lower_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glutes',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from ph-r-kn-4; classification copied, dose dialled down for the acute phase. */
const A_BANDED_CLAMSHELL_2: ExerciseTemplate =
  {
    id: 'acute-08-banded-clamshell',
    name: 'Banded Clamshell',
    sets: 2,
    reps: '15 each side',
    cue: 'On your side, knees bent and stacked, light band above the knees - open the top knee a small way, hold a second, lower slowly. Do not let the top hip roll backwards to help.',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['knee', 'hip_groin', 'glutes'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glute medius',
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_ISOMETRIC_HIP_ABDUCTION_WALL_PRESS: ExerciseTemplate =
  {
    id: 'acute-09-isometric-hip-abduction-wall-press',
    name: 'Isometric Hip Abduction (Wall Press)',
    sets: 3,
    reps: '5 reps, hold 20s each side',
    cue: 'Stand side-on to a wall with the inside leg lifted and the knee bent, then press that knee into the wall at about a third of your effort. The standing hip is the one doing the work - keep the pelvis level and the torso upright.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from sq-acc-bw-5; classification copied, dose dialled down for the acute phase. */
const A_SINGLE_LEG_GLUTE_BRIDGE_2: ExerciseTemplate =
  {
    id: 'acute-10-single-leg-glute-bridge',
    name: 'Single-Leg Glute Bridge',
    sets: 2,
    reps: '8 each side',
    cue: 'One foot planted, the other knee hugged in - lift until the hips are level, hold a beat, then lower slowly. Level hips matter far more than height.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes', 'hamstrings', 'hip_groin', 'lower_back'],
    videoId: '',
    movementPattern: 'hinge',
    primaryMuscle: 'Glutes',
    secondaryMuscles: ['Hamstrings', 'Core'],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Written for the acute phase. */
const A_SEATED_ANKLE_PUMP_SMALL_RANGE: ExerciseTemplate =
  {
    id: 'acute-11-seated-ankle-pump-small-range',
    name: 'Seated Ankle Pump (Small Range)',
    sets: 2,
    reps: '20 slow reps each side',
    cue: 'Sit with the leg out in front of you - point the toes gently away, then bring them back to flat and stop there. Small and slow, purely to move blood through the calf.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['calf_shin', 'ankle_achilles'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-cs-5; classification copied, dose dialled down for the acute phase. */
const A_SEATED_TOE_RAISE: ExerciseTemplate =
  {
    id: 'acute-12-seated-toe-raise',
    name: 'Seated Toe Raise',
    sets: 2,
    reps: '20 reps',
    cue: 'Sit with the heel on the floor and the knee bent - lift the toes and forefoot towards you, then lower slowly. Keep it easy and stop short of any pull in the calf.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['calf_shin'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Tibialis anterior',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SEATED_ISOMETRIC_CALF_PRESS: ExerciseTemplate =
  {
    id: 'acute-13-seated-isometric-calf-press',
    name: 'Seated Isometric Calf Press',
    sets: 3,
    reps: '8 reps, hold 10s each side',
    cue: 'Sit tall with the knee bent to a right angle and the foot flat - press the ball of the foot down into the floor at about a third of your effort and hold. The heel stays down and nothing moves.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['calf_shin', 'ankle_achilles'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SEATED_HEEL_RAISE_BODYWEIGHT: ExerciseTemplate =
  {
    id: 'acute-14-seated-heel-raise-bodyweight',
    name: 'Seated Heel Raise (Bodyweight)',
    sets: 2,
    reps: '12 slow reps each side',
    cue: 'Sitting with the foot flat, lift the heel as far as is comfortable, hold a second, then lower it slowly back to the floor. Keep your hands off the thigh - the only load is the weight of your own leg.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['calf_shin'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from fl-s-10-cooldown; classification copied, dose dialled down for the acute phase. */
const A_LEGS_UP_THE_WALL: ExerciseTemplate =
  {
    id: 'acute-15-legs-up-the-wall',
    name: 'Legs-Up-The-Wall',
    sets: 1,
    reps: '3 min',
    cue: 'Lie on your back with the legs resting up the wall and the ankles completely relaxed - close your eyes and breathe. This helps drain swelling out of the lower leg.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles', 'lower_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Hip external rotators',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SEATED_ANKLE_PUMP_SMALL_RANGE_2: ExerciseTemplate =
  {
    id: 'acute-16-seated-ankle-pump-small-range',
    name: 'Seated Ankle Pump (Small Range)',
    sets: 2,
    reps: '20 slow reps each side',
    cue: 'Sit with the leg supported - point the toes gently away, then bring them back to flat and stop there. Never past flat, and never into anything that pulls at the back of the heel.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['calf_shin', 'ankle_achilles'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-cs-5; classification copied, dose dialled down for the acute phase. */
const A_SEATED_TOE_RAISE_2: ExerciseTemplate =
  {
    id: 'acute-17-seated-toe-raise',
    name: 'Seated Toe Raise',
    sets: 2,
    reps: '20 reps',
    cue: 'Heel on the floor and the knee bent - lift the toes and forefoot towards you, then lower slowly. Stay in the easy part of the range throughout.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['calf_shin'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Tibialis anterior',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_ISOMETRIC_ANKLE_PRESS_IN_AND_OUT: ExerciseTemplate =
  {
    id: 'acute-18-isometric-ankle-press-in-and-out',
    name: 'Isometric Ankle Press (In and Out)',
    sets: 2,
    reps: '5 holds of 10s in each direction',
    cue: 'Sit with the foot flat and the outside of the foot against a wall or table leg - press outwards at about a third of your effort and hold, then turn round and press the inside edge in the same way. Nothing moves.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SEATED_ISOMETRIC_CALF_PRESS_2: ExerciseTemplate =
  {
    id: 'acute-19-seated-isometric-calf-press',
    name: 'Seated Isometric Calf Press',
    sets: 3,
    reps: '8 reps, hold 10s each side',
    cue: 'Sit tall with the knee bent to a right angle and the foot flat - press the ball of the foot down into the floor at about a third of your effort and hold. Heel stays down, nothing moves.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['calf_shin', 'ankle_achilles'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-aa-3; classification copied, dose dialled down for the acute phase. */
const A_SINGLE_LEG_BALANCE: ExerciseTemplate =
  {
    id: 'acute-20-single-leg-balance',
    name: 'Single-Leg Balance',
    sets: 3,
    reps: '30s each side',
    cue: 'Stand on one leg with your fingertips resting on a wall or worktop - stay flat-footed and do not rise onto the toes. Small wobbles are normal and are the point.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Tibialis anterior',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Reused from fl-s-10-cooldown; classification copied, dose dialled down for the acute phase. */
const A_LEGS_UP_THE_WALL_2: ExerciseTemplate =
  {
    id: 'acute-21-legs-up-the-wall',
    name: 'Legs-Up-The-Wall',
    sets: 1,
    reps: '3 min',
    cue: 'Lie on your back with the legs resting up the wall and the ankles loose - close your eyes and breathe. Gravity helps swelling drain out of the foot and ankle.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles', 'lower_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Hip external rotators',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from ph-r-kn-5; classification copied, dose dialled down for the acute phase. */
const A_QUAD_SET_ISOMETRIC: ExerciseTemplate =
  {
    id: 'acute-22-quad-set-isometric',
    name: 'Quad Set (isometric)',
    sets: 3,
    reps: '10 reps, hold 5s each',
    cue: 'Lie flat with a rolled towel under the knee - press the back of the knee down into the towel at about half effort, hold, then let go completely. The thigh should tighten without the leg moving anywhere.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['knee'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Quadriceps',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SHORT_ARC_QUAD_EXTENSION_TOWEL_ROLL: ExerciseTemplate =
  {
    id: 'acute-23-short-arc-quad-extension-towel-rol',
    name: 'Short-Arc Quad Extension (Towel Roll)',
    sets: 3,
    reps: '12 reps, hold 2s at the top',
    cue: 'Rolled towel under the knee, lift the heel until the knee is straight - hold, then lower slowly onto the towel. Only the last part of the range moves, so the muscle never works long.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['quads'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SUPINE_STRAIGHT_LEG_RAISE: ExerciseTemplate =
  {
    id: 'acute-24-supine-straight-leg-raise',
    name: 'Supine Straight-Leg Raise',
    sets: 3,
    reps: '10 each side',
    cue: 'Lie on your back with one knee bent and the injured leg straight - tighten the thigh, lift the leg about 30 cm, then lower it under control. Keep the knee locked straight the whole way.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['quads', 'knee'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-kn-4; classification copied, dose dialled down for the acute phase. */
const A_BANDED_CLAMSHELL_2_2: ExerciseTemplate =
  {
    id: 'acute-25-banded-clamshell',
    name: 'Banded Clamshell',
    sets: 2,
    reps: '15 each side',
    cue: 'Light band above the knees, heels together, hips and knees bent - rotate the top knee up, hold 1s, lower slowly. This works the hip while the front of the thigh rests.',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['knee', 'hip_groin', 'glutes'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glute medius',
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from ph-r-aa-3; classification copied, dose dialled down for the acute phase. */
const A_SINGLE_LEG_BALANCE_2: ExerciseTemplate =
  {
    id: 'acute-26-single-leg-balance',
    name: 'Single-Leg Balance',
    sets: 3,
    reps: '30s each side',
    cue: 'Stand on the injured leg with the knee soft but almost straight, fingertips on a wall if you need them - small wobbles are normal, thigh ache is not. Step down if it starts to ache.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Tibialis anterior',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Reused from fl-s-10-cooldown; classification copied, dose dialled down for the acute phase. */
const A_LEGS_UP_THE_WALL_2_2: ExerciseTemplate =
  {
    id: 'acute-27-legs-up-the-wall',
    name: 'Legs-Up-The-Wall',
    sets: 1,
    reps: '3 min',
    cue: 'Lie on your back with the legs resting up a wall, knees soft and the thigh completely loose - breathe slowly and let the leg go heavy.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles', 'lower_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Hip external rotators',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from ph-r-kn-5; classification copied, dose dialled down for the acute phase. */
const A_QUAD_SET_ISOMETRIC_2: ExerciseTemplate =
  {
    id: 'acute-28-quad-set-isometric',
    name: 'Quad Set (isometric)',
    sets: 3,
    reps: '10 reps, hold 5s each',
    cue: 'Lie flat with a rolled towel under the knee - press the knee gently down into the towel at about half effort and hold. This wakes the thigh up without moving the joint at all.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['knee'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Quadriceps',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SUPPORTED_HEEL_SLIDE: ExerciseTemplate =
  {
    id: 'acute-29-supported-heel-slide',
    name: 'Supported Heel Slide',
    sets: 2,
    reps: '10 slow slides each side',
    cue: 'Lie on your back and slide the heel towards you along the floor or a towel - stop at the first hint of tightness and slide straight back out. Small range only - you are keeping the knee moving, not working it to its limit.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['knee'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SUPINE_STRAIGHT_LEG_RAISE_2: ExerciseTemplate =
  {
    id: 'acute-30-supine-straight-leg-raise',
    name: 'Supine Straight-Leg Raise',
    sets: 3,
    reps: '10 each side',
    cue: 'Tighten the thigh first so the knee stays locked straight, then lift the leg about 30 cm and lower it slowly. If the knee sags into a bend on the way up, put the leg down and start again.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['quads', 'knee'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-gl-2; classification copied, dose dialled down for the acute phase. */
const A_GLUTE_BRIDGE_ISOMETRIC_HOLD_2_2: ExerciseTemplate =
  {
    id: 'acute-31-glute-bridge-isometric-hold',
    name: 'Glute Bridge (isometric hold)',
    sets: 3,
    reps: '10 reps, hold 5s each',
    cue: 'Feet flat and hip-width, push through the heels and lift the hips until the body is in a line - squeeze the glutes, hold, then lower slowly. Knees stay pointing straight ahead.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes', 'lower_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glutes',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from ph-r-kn-1; classification copied, dose dialled down for the acute phase. */
const A_TERMINAL_KNEE_EXTENSION_BAND: ExerciseTemplate =
  {
    id: 'acute-32-terminal-knee-extension-band',
    name: 'Terminal Knee Extension (band)',
    sets: 3,
    reps: '15 each side',
    cue: 'Light band behind the knee, stand tall with a small bend in it - straighten the knee fully against the band, hold 1s, then release slowly. Only the last few degrees move.',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['knee', 'quads'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Quadriceps',
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from fl-s-10-cooldown; classification copied, dose dialled down for the acute phase. */
const A_LEGS_UP_THE_WALL_2_2_2: ExerciseTemplate =
  {
    id: 'acute-33-legs-up-the-wall',
    name: 'Legs-Up-The-Wall',
    sets: 1,
    reps: '3 min',
    cue: 'Legs resting up the wall with the knees soft - lying with the leg above heart height helps any swelling drain away. Breathe slowly and stay there.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles', 'lower_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Hip external rotators',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_ISOMETRIC_ADDUCTOR_SQUEEZE_BALL_OR_TOWEL: ExerciseTemplate =
  {
    id: 'acute-34-isometric-adductor-squeeze-ball-or',
    name: 'Isometric Adductor Squeeze (Ball or Towel)',
    sets: 3,
    reps: '10 reps, hold 5s each',
    cue: 'Lie on your back, knees bent, a soft ball or rolled towel between the knees - squeeze at about half effort, hold, then let go completely. Bent knees keep the groin short and the load gentle.',
    suggestedLoad: 'Soft ball or rolled towel',
    category: 'prehab',
    targetRegions: ['hip_groin'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-gl-2; classification copied, dose dialled down for the acute phase. */
const A_GLUTE_BRIDGE_ISOMETRIC_HOLD_2_2_2: ExerciseTemplate =
  {
    id: 'acute-35-glute-bridge-isometric-hold',
    name: 'Glute Bridge (isometric hold)',
    sets: 3,
    reps: '10 reps, hold 5s each',
    cue: 'Feet hip-width and flat, lift the hips until the body is in a line - squeeze the glutes, hold, then lower slowly. Keep the knees pointing straight ahead, do not let them drift apart.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes', 'lower_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glutes',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SEATED_HIP_MARCH_LOW_LIFT: ExerciseTemplate =
  {
    id: 'acute-36-seated-hip-march-low-lift',
    name: 'Seated Hip March (Low Lift)',
    sets: 2,
    reps: '12 each side',
    cue: 'Sit tall in a chair and lift one heel a few centimetres off the floor, then set it down slowly. A tiny lift is enough - this is for the front of the hip, not a leg raise.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['hip_groin'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_LONG_LEVER_ADDUCTOR_SQUEEZE: ExerciseTemplate =
  {
    id: 'acute-37-long-lever-adductor-squeeze',
    name: 'Long-Lever Adductor Squeeze',
    sets: 3,
    reps: '8 reps, hold 5s each',
    cue: 'The same squeeze but with the legs almost straight and the ball or towel down at the ankles - still about half effort. Stop the set if the groin starts to talk back.',
    suggestedLoad: 'Soft ball or rolled towel',
    category: 'prehab',
    targetRegions: ['hip_groin'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-aa-3; classification copied, dose dialled down for the acute phase. */
const A_SINGLE_LEG_BALANCE_2_2: ExerciseTemplate =
  {
    id: 'acute-38-single-leg-balance',
    name: 'Single-Leg Balance',
    sets: 3,
    reps: '30s each side',
    cue: 'Stand on the injured side with fingertips on a wall - keep the hips level and the standing knee soft. Small wobbles are normal, groin pain is not.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Tibialis anterior',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Reused from fl-s-10-cooldown; classification copied, dose dialled down for the acute phase. */
const A_LEGS_UP_THE_WALL_2_2_2_2: ExerciseTemplate =
  {
    id: 'acute-39-legs-up-the-wall',
    name: 'Legs-Up-The-Wall',
    sets: 1,
    reps: '3 min',
    cue: 'Legs up the wall with the knees soft and the legs together - keep them touching and never let them fall out to the sides. Rest there and breathe slowly.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles', 'lower_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Hip external rotators',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_PENDULUM_SHOULDER_SWING: ExerciseTemplate =
  {
    id: 'acute-40-pendulum-shoulder-swing',
    name: 'Pendulum Shoulder Swing',
    sets: 2,
    reps: '30s each side',
    cue: 'Lean forward with your good hand on a table and let the sore arm hang loose - sway your body so the arm swings in small circles. The shoulder muscles do nothing, the movement comes from your trunk.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['front_shoulder', 'rear_shoulder'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SCAPULAR_SETTING_ISOMETRIC: ExerciseTemplate =
  {
    id: 'acute-41-scapular-setting-isometric',
    name: 'Scapular Setting (Isometric)',
    sets: 3,
    reps: '10 reps, hold 5s each',
    cue: 'Sit or stand tall and draw the shoulder blade gently back and down at about a quarter of your full effort - the arm stays completely still. This is a small squeeze, not a hard pinch.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['front_shoulder', 'rear_shoulder', 'chest'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_ISOMETRIC_SHOULDER_EXTERNAL_ROTATION_DOORFRA: ExerciseTemplate =
  {
    id: 'acute-42-isometric-shoulder-external-rotati',
    name: 'Isometric Shoulder External Rotation (Doorframe)',
    sets: 3,
    reps: '6 reps, hold 10s each side',
    cue: 'Elbow tucked to your side and bent to 90 degrees, press the back of your hand out into a doorframe at about a third of your effort. Nothing should move - if you feel a pinch, press more softly until you do not.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['front_shoulder', 'rear_shoulder'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_ISOMETRIC_SHOULDER_FLEXION_PRESS_WALL: ExerciseTemplate =
  {
    id: 'acute-43-isometric-shoulder-flexion-press-w',
    name: 'Isometric Shoulder Flexion Press (Wall)',
    sets: 3,
    reps: '6 reps, hold 10s each side',
    cue: 'Stand facing a wall with your elbow bent and your fist resting on it at hip height - press forward at about a third of your effort and hold. Keeping the elbow bent keeps the arm short and the load low.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['front_shoulder'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SUPPORTED_SHOULDER_SLIDE_TABLE: ExerciseTemplate =
  {
    id: 'acute-44-supported-shoulder-slide-table',
    name: 'Supported Shoulder Slide (Table)',
    sets: 2,
    reps: '10 slow reps each side',
    cue: 'Sit at a table with your forearm resting on a folded towel, then slide the arm forward and back as if polishing the surface. The table carries the weight of the arm - stop the moment it begins to pull.',
    suggestedLoad: 'Bodyweight (towel on a table)',
    category: 'prehab',
    targetRegions: ['front_shoulder'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-rs-4; classification copied, dose dialled down for the acute phase. */
const A_WALL_SLIDE: ExerciseTemplate =
  {
    id: 'acute-45-wall-slide',
    name: 'Wall Slide',
    sets: 2,
    reps: '8 slow reps',
    cue: 'Back flat on the wall, elbows bent to 90 degrees and touching the wall - slide up only as far as stays comfortable, then lower slowly. Nowhere near overhead in the first week.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['rear_shoulder', 'front_shoulder', 'upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Rotator cuff',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_ISOMETRIC_SHOULDER_EXTENSION_PRESS_WALL: ExerciseTemplate =
  {
    id: 'acute-46-isometric-shoulder-extension-press',
    name: 'Isometric Shoulder Extension Press (Wall)',
    sets: 3,
    reps: '6 reps, hold 10s each side',
    cue: 'Stand with your back to a wall, arm by your side and elbow softly bent, and press the back of your arm into the wall at about a third of your effort - hold, then relax. Nothing moves.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['rear_shoulder', 'tricep'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from fl-s-14-cooldown; classification copied, dose dialled down for the acute phase. */
const A_PRONE_THORACIC_EXTENSION: ExerciseTemplate =
  {
    id: 'acute-47-prone-thoracic-extension',
    name: 'Prone Thoracic Extension',
    sets: 2,
    reps: '8 reps, hold 2s at top',
    cue: 'Lie face down with your arms by your sides and lift your chest a few centimetres using the mid-back only - keep the lift small and the shoulders relaxed.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['upper_back', 'rear_shoulder'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Thoracic extensors',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from bn-acc-bw-8; classification copied, dose dialled down for the acute phase. */
const A_BAND_FACE_PULL: ExerciseTemplate =
  {
    id: 'acute-48-band-face-pull',
    name: 'Band Face Pull',
    sets: 2,
    reps: '12 slow reps',
    cue: 'Very light band at chest height, elbows kept low - pull only until your hands reach the front of your chest, then release slowly. Half the range you would normally use and a fraction of the tension.',
    suggestedLoad: 'Very light band',
    category: 'prehab',
    targetRegions: ['rear_shoulder', 'upper_back'],
    videoId: '',
    movementPattern: 'pull',
    primaryMuscle: 'Rear deltoid',
    secondaryMuscles: ['Rhomboids', 'External rotators'],
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_ISOMETRIC_PEC_SQUEEZE_PALMS_TOGETHER: ExerciseTemplate =
  {
    id: 'acute-49-isometric-pec-squeeze-palms-togeth',
    name: 'Isometric Pec Squeeze (Palms Together)',
    sets: 3,
    reps: '6 reps, hold 10s each',
    cue: 'Press your palms together in front of your chest with the elbows bent and low, at about a third of your effort - hold, then relax fully. Keep the elbows in front of the body throughout.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['chest'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_ISOMETRIC_CHEST_PRESS_INTO_WALL: ExerciseTemplate =
  {
    id: 'acute-50-isometric-chest-press-into-wall',
    name: 'Isometric Chest Press Into Wall',
    sets: 3,
    reps: '6 reps, hold 10s each side',
    cue: 'Face a wall with your hand flat on it at chest height and the elbow bent, then press gently into the wall at about a third of your effort. Nothing moves, and the elbow stays in front of your body, never behind it.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['chest'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_BAND_CHEST_PRESS_LIGHT_SHORT_RANGE: ExerciseTemplate =
  {
    id: 'acute-51-band-chest-press-light-short-range',
    name: 'Band Chest Press (Light, Short Range)',
    sets: 2,
    reps: '12 slow reps',
    cue: 'Band around your back with your hands at chest height - press forward slowly, then return only until your hands reach your chest. Never let the elbows travel behind your ribs.',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['chest'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-el-4; classification copied, dose dialled down for the acute phase. */
const A_ELBOW_FLEXION_EXTENSION_ROM: ExerciseTemplate =
  {
    id: 'acute-52-elbow-flexion-extension-rom',
    name: 'Elbow Flexion / Extension ROM',
    sets: 2,
    reps: '10 slow reps each side',
    cue: 'Bend and straighten the elbow slowly with nothing in the hand - stop just short of the point where it starts to pull, and never force the last few degrees straight.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Elbow joint',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Reused from ph-r-ew-5; classification copied, dose dialled down for the acute phase. */
const A_FOREARM_SUPINATION_PRONATION: ExerciseTemplate =
  {
    id: 'acute-53-forearm-supination-pronation',
    name: 'Forearm Supination / Pronation',
    sets: 2,
    reps: '15 each direction',
    cue: 'Elbow tucked in and bent to 90 degrees, turn the palm slowly up then down with nothing in the hand - keeps the elbow moving without asking the biceps to lift anything.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow', 'bicep', 'wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Forearm flexors',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_ISOMETRIC_ELBOW_FLEXION_HOLD_TABLE: ExerciseTemplate =
  {
    id: 'acute-54-isometric-elbow-flexion-hold-table',
    name: 'Isometric Elbow Flexion Hold (Table)',
    sets: 3,
    reps: '6 reps, hold 10s each side',
    cue: 'Sit with your palm under the edge of a table and the elbow bent to 90 degrees, then press up into it at about a third of your effort. Nothing moves - if it stings, press more softly.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['bicep'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_ISOMETRIC_SUPINATION_HOLD_TOWEL: ExerciseTemplate =
  {
    id: 'acute-55-isometric-supination-hold-towel',
    name: 'Isometric Supination Hold (Towel)',
    sets: 2,
    reps: '6 reps, hold 10s each side',
    cue: 'Elbow at your side bent to 90 degrees, hold one end of a rolled towel and try to twist your palm upward while your other hand holds it still - a third of effort, no movement.',
    suggestedLoad: 'Rolled towel',
    category: 'prehab',
    targetRegions: ['bicep'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-bi-3; classification copied, dose dialled down for the acute phase. */
const A_BAND_CURL_LIGHT_HIGH_REPS: ExerciseTemplate =
  {
    id: 'acute-56-band-curl-light-high-reps',
    name: 'Band Curl (light, high reps)',
    sets: 2,
    reps: '15 slow reps',
    cue: 'Very light band - curl up smoothly and lower only until the elbow is about two thirds straight. No heavy slow lowering and no locking the arm out at the bottom.',
    suggestedLoad: 'Very light band',
    category: 'prehab',
    targetRegions: ['bicep', 'elbow', 'wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Biceps',
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from ph-r-el-4; classification copied, dose dialled down for the acute phase. */
const A_ELBOW_FLEXION_EXTENSION_ROM_2: ExerciseTemplate =
  {
    id: 'acute-57-elbow-flexion-extension-rom',
    name: 'Elbow Flexion / Extension ROM',
    sets: 2,
    reps: '10 slow reps each side',
    cue: 'Bend and straighten the elbow slowly with nothing in the hand - stop bending as soon as you feel a pull at the back of the arm. Straightening is usually the comfortable direction.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Elbow joint',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Reused from ph-r-ew-5; classification copied, dose dialled down for the acute phase. */
const A_FOREARM_SUPINATION_PRONATION_2: ExerciseTemplate =
  {
    id: 'acute-58-forearm-supination-pronation',
    name: 'Forearm Supination / Pronation',
    sets: 2,
    reps: '15 each direction',
    cue: 'Elbow tucked in at 90 degrees, rotate the palm up and down slowly - keeps the elbow moving and blood flowing without asking the triceps to work.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow', 'bicep', 'wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Forearm flexors',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_ISOMETRIC_ELBOW_EXTENSION_PRESS_THIGH: ExerciseTemplate =
  {
    id: 'acute-59-isometric-elbow-extension-press-th',
    name: 'Isometric Elbow Extension Press (Thigh)',
    sets: 3,
    reps: '6 reps, hold 10s each side',
    cue: 'Sit with the elbow bent to 90 degrees and press the back of your fist down into your thigh at about a third of your effort - hold, then relax. The arm should not move at all.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['tricep'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_ISOMETRIC_SHOULDER_EXTENSION_PRESS_WALL_2: ExerciseTemplate =
  {
    id: 'acute-60-isometric-shoulder-extension-press',
    name: 'Isometric Shoulder Extension Press (Wall)',
    sets: 2,
    reps: '6 reps, hold 10s each side',
    cue: 'Stand with your back to a wall, arm by your side and elbow softly bent, and press the back of your arm into the wall at about a third of your effort - hold, then relax. Nothing moves.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['rear_shoulder', 'tricep'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-tr-3; classification copied, dose dialled down for the acute phase. */
const A_BAND_PUSHDOWN_LIGHT_HIGH_REPS: ExerciseTemplate =
  {
    id: 'acute-61-band-pushdown-light-high-reps',
    name: 'Band Pushdown (light, high reps)',
    sets: 2,
    reps: '15 slow reps',
    cue: 'Very light band with the elbows pinned to your sides - push down to almost straight, then let it come back up only halfway. Keep the return slow but short, and stop if the back of the arm starts to ache.',
    suggestedLoad: 'Very light band',
    category: 'prehab',
    targetRegions: ['tricep', 'elbow', 'wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Triceps',
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_OPEN_AND_CLOSE_FIST_PUMPS: ExerciseTemplate =
  {
    id: 'acute-62-open-and-close-fist-pumps',
    name: 'Open-and-Close Fist Pumps',
    sets: 2,
    reps: '20 slow reps each side',
    cue: 'Rest the forearm on your thigh, then open the hand wide and close it into a loose fist, slowly. This pumps blood and swelling through the forearm without asking the elbow to do anything',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow', 'wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-el-3; classification copied, dose dialled down for the acute phase. */
const A_ISOMETRIC_WRIST_EXTENSION_HOLD: ExerciseTemplate =
  {
    id: 'acute-63-isometric-wrist-extension-hold',
    name: 'Isometric Wrist Extension Hold',
    sets: 3,
    reps: '30s each side',
    cue: 'Palm down, press the back of your hand into your other palm and hold. Loads the tendon without moving the joint, which is what you want while it is still irritable',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Wrist extensors',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Written for the acute phase. */
const A_ISOMETRIC_WRIST_FLEXION_HOLD: ExerciseTemplate =
  {
    id: 'acute-64-isometric-wrist-flexion-hold',
    name: 'Isometric Wrist Flexion Hold',
    sets: 2,
    reps: '20s each side',
    cue: 'Palm up, press the palm gently into your other hand and hold at about a third of your strength. Works the inner forearm and the tendon on the inside of the elbow with nothing moving',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow', 'wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_ISOMETRIC_ELBOW_PRESS_BEND_AND_STRAIGHTEN: ExerciseTemplate =
  {
    id: 'acute-65-isometric-elbow-press-bend-and-str',
    name: 'Isometric Elbow Press (Bend and Straighten)',
    sets: 2,
    reps: '20s each direction',
    cue: 'Elbow bent to a right angle and tucked into your side. Press up into your other hand as if curling, hold, then press down onto your thigh as if straightening - light effort only, nothing should actually move',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_PAIN_FREE_ELBOW_BEND_AND_STRAIGHTEN: ExerciseTemplate =
  {
    id: 'acute-66-pain-free-elbow-bend-and-straighte',
    name: 'Pain-Free Elbow Bend and Straighten',
    sets: 2,
    reps: '10 slow reps each side',
    cue: 'Rest the arm on a table and bend and straighten the elbow slowly through the middle of the range only. Stop short of the point where you feel a pull at either end - this is about keeping the joint moving, not about winning back the last few degrees',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-ew-5; classification copied, dose dialled down for the acute phase. */
const A_FOREARM_SUPINATION_PRONATION_2_2: ExerciseTemplate =
  {
    id: 'acute-67-forearm-supination-pronation',
    name: 'Forearm Supination / Pronation',
    sets: 2,
    reps: '15 each direction',
    cue: 'Elbow tucked in at your side and bent to a right angle, turn the palm slowly up and then down with nothing in the hand. Stay in the easy middle of the turn and stop short of either end',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow', 'bicep', 'wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Forearm flexors',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_OPEN_AND_CLOSE_FIST_PUMPS_2: ExerciseTemplate =
  {
    id: 'acute-68-open-and-close-fist-pumps',
    name: 'Open-and-Close Fist Pumps',
    sets: 2,
    reps: '20 slow reps each side',
    cue: 'Rest the forearm on a cushion with the hand higher than the elbow, then open and close the fist slowly. This moves swelling away from the wrist without the wrist itself having to move',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['elbow', 'wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SOFT_TOWEL_SQUEEZE: ExerciseTemplate =
  {
    id: 'acute-69-soft-towel-squeeze',
    name: 'Soft Towel Squeeze',
    sets: 2,
    reps: '10 reps, hold 5s each',
    cue: 'Roll a towel into the palm and squeeze at about a third of your hardest grip, hold, then let go slowly. Keeps the hand and forearm working while the wrist stays still',
    suggestedLoad: 'Rolled towel',
    category: 'prehab',
    targetRegions: ['wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-ew-4; classification copied, dose dialled down for the acute phase. */
const A_BAND_FINGER_EXTENSION: ExerciseTemplate =
  {
    id: 'acute-70-band-finger-extension',
    name: 'Band Finger Extension',
    sets: 2,
    reps: '20 reps',
    cue: 'Loop a light band around the fingers and spread them apart slowly against it, then let them close. Works the back of the forearm without the wrist itself having to move',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Forearm flexors',
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_PAIN_FREE_WRIST_GLIDE: ExerciseTemplate =
  {
    id: 'acute-71-pain-free-wrist-glide',
    name: 'Pain-Free Wrist Glide',
    sets: 2,
    reps: '10 slow reps each direction',
    cue: 'Forearm flat on a table with the hand just off the edge. Let the hand drop a little way and lift a little way, staying well inside the range that feels easy - small and slow is the point, not big',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['wrist'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SUPPORTED_NECK_NOD_HEAD_RESTING: ExerciseTemplate =
  {
    id: 'acute-72-supported-neck-nod-head-resting',
    name: 'Supported Neck Nod (Head Resting)',
    sets: 2,
    reps: '10 reps, hold 3s each',
    cue: 'Lie on your back with the head resting on a folded towel. Nod the chin a few millimetres towards your throat as if saying a small yes, hold, then release - the head stays down on the towel the whole time',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['neck'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_ISOMETRIC_NECK_PRESS_HAND_RESISTANCE: ExerciseTemplate =
  {
    id: 'acute-73-isometric-neck-press-hand-resistan',
    name: 'Isometric Neck Press (Hand Resistance)',
    sets: 2,
    reps: '4 directions, hold 5s each',
    cue: 'Palm on the forehead, then each side of the head, then the back of the head. Press the head into the hand at about a quarter of your strength and hold - the hand wins every time, so nothing actually moves',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['neck'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SUPPORTED_NECK_ROTATION_SMALL_RANGE: ExerciseTemplate =
  {
    id: 'acute-74-supported-neck-rotation-small-rang',
    name: 'Supported Neck Rotation (Small Range)',
    sets: 2,
    reps: '8 slow reps each side',
    cue: 'Still lying down with the head supported, turn slowly to look one way, then the other. Go only as far as feels easy and come straight back - this is about keeping the neck moving, not about reaching the end of the turn',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['neck'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-nk-1; classification copied, dose dialled down for the acute phase. */
const A_CHIN_TUCK: ExerciseTemplate =
  {
    id: 'acute-75-chin-tuck',
    name: 'Chin Tuck',
    sets: 3,
    reps: '10 reps, hold 3s each',
    cue: 'Glide the chin straight back to make a gentle double chin, hold, then release. Small and slow - this switches on the deep muscles at the front of the neck and should not pull anywhere',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['neck', 'upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Neck flexors',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SCAPULAR_SETTING_SHOULDER_BLADE_SET: ExerciseTemplate =
  {
    id: 'acute-76-scapular-setting-shoulder-blade-se',
    name: 'Scapular Setting (Shoulder Blade Set)',
    sets: 2,
    reps: '10 reps, hold 5s each',
    cue: 'Sitting tall, draw the shoulder blades gently down and back, hold, then let go. Very light effort - this is about taking the work off the top of the neck, not about squeezing hard',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['neck'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-tr-5; classification copied, dose dialled down for the acute phase. */
const A_WALL_ANGEL: ExerciseTemplate =
  {
    id: 'acute-77-wall-angel',
    name: 'Wall Angel',
    sets: 2,
    reps: '10 slow reps',
    cue: 'Back and head resting flat against the wall, slide the arms slowly up and down. Frees up the upper back and shoulder blades so the neck does not have to do their work',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['tricep', 'rear_shoulder', 'upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Lower trapezius',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SUPINE_ABDOMINAL_BRACE_WITH_BREATHING: ExerciseTemplate =
  {
    id: 'acute-78-supine-abdominal-brace-with-breath',
    name: 'Supine Abdominal Brace with Breathing',
    sets: 3,
    reps: '5 reps, hold 10s each',
    cue: 'Lie on your back with knees bent - tense the stomach to about a quarter of your hardest effort and keep breathing normally all the way through the hold. Wakes the deep support muscles without moving the sore back at all',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['lower_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SUPINE_PELVIC_TILT_SMALL_RANGE: ExerciseTemplate =
  {
    id: 'acute-79-supine-pelvic-tilt-small-range',
    name: 'Supine Pelvic Tilt (Small Range)',
    sets: 2,
    reps: '10 slow reps',
    cue: 'Knees bent, feet flat - roll the pelvis back just far enough to flatten the low back against the floor, then let it settle. Keep the range tiny and never push to the end of the movement',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['lower_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-gl-2; classification copied, dose dialled down for the acute phase. */
const A_GLUTE_BRIDGE_ISOMETRIC_HOLD_2_2_2_2: ExerciseTemplate =
  {
    id: 'acute-80-glute-bridge-isometric-hold',
    name: 'Glute Bridge (isometric hold)',
    sets: 3,
    reps: '8 reps, 5s hold each',
    cue: 'Push through the heels and lift the hips only as high as stays comfortable - squeeze the glutes and hold, ribs staying down. Strong glutes take the work off the low back',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes', 'lower_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glutes',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from sq-acc-bw-17; classification copied, dose dialled down for the acute phase. */
const A_DEAD_BUG: ExerciseTemplate =
  {
    id: 'acute-81-dead-bug',
    name: 'Dead Bug',
    sets: 2,
    reps: '6 slow reps each side',
    cue: 'Brace lightly, then lower one arm and the opposite leg only as far as the low back stays flat on the floor - a short range is fine. End the rep the moment the back starts to lift',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['core_ribs', 'lower_back'],
    videoId: '',
    movementPattern: 'isometric',
    primaryMuscle: 'Transversus abdominis',
    secondaryMuscles: ['Obliques', 'Hip flexors'],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Reused from dl-acc-bw-12; classification copied, dose dialled down for the acute phase. */
const A_BIRD_DOG: ExerciseTemplate =
  {
    id: 'acute-82-bird-dog',
    name: 'Bird Dog',
    sets: 2,
    reps: '6 each side, hold 3s',
    cue: 'On all fours, slide one leg back along the floor and reach the opposite arm forward - hips stay level and the back stays still. Only lift the leg clear of the floor if that stays pain-free',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['lower_back', 'core_ribs'],
    videoId: '',
    movementPattern: 'isometric',
    primaryMuscle: 'Erector spinae',
    secondaryMuscles: ['Glutes', 'Core', 'Shoulder stabilizers'],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Reused from ph-r-nk-1; classification copied, dose dialled down for the acute phase. */
const A_CHIN_TUCK_2: ExerciseTemplate =
  {
    id: 'acute-83-chin-tuck',
    name: 'Chin Tuck',
    sets: 2,
    reps: '10 reps, hold 5s each',
    cue: 'Sit tall and glide the chin straight back to make a gentle double chin - hold, then release. Settles the neck and upper back junction before anything harder',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['neck', 'upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Neck flexors',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SCAPULAR_SETTING_ISOMETRIC_SQUEEZE: ExerciseTemplate =
  {
    id: 'acute-84-scapular-setting-isometric-squeeze',
    name: 'Scapular Setting (Isometric Squeeze)',
    sets: 3,
    reps: '8 reps, hold 5s each',
    cue: 'Sit or stand tall and draw the shoulder blades gently down and together at about a quarter effort - hold, breathe, then let go. No shrugging and no hard pinching',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from ph-r-nk-5; classification copied, dose dialled down for the acute phase. */
const A_THORACIC_CAT_COW: ExerciseTemplate =
  {
    id: 'acute-85-thoracic-cat-cow',
    name: 'Thoracic Cat-Cow',
    sets: 2,
    reps: '10 slow reps',
    cue: 'On all fours, round and arch the mid-back through a small, easy range only - stop well before the end of either direction. This is about keeping it moving, not about pulling on it',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['neck', 'upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Thoracic extensors',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Reused from ph-r-rs-4; classification copied, dose dialled down for the acute phase. */
const A_WALL_SLIDE_2: ExerciseTemplate =
  {
    id: 'acute-86-wall-slide',
    name: 'Wall Slide',
    sets: 2,
    reps: '10 slow reps',
    cue: 'Back flat against the wall, forearms in contact - slide the arms up only as far as the back stays flat and it stays comfortable, then lower slowly',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['rear_shoulder', 'front_shoulder', 'upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Rotator cuff',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_ISOMETRIC_BAND_ROW_HOLD_LIGHT: ExerciseTemplate =
  {
    id: 'acute-87-isometric-band-row-hold-light',
    name: 'Isometric Band Row Hold (Light)',
    sets: 3,
    reps: '5 reps, hold 10s each',
    cue: 'Anchor a light band at chest height, elbows tucked in, pull to about a quarter effort and simply hold there - no movement, keep breathing. Loads the mid-back without pulling on it',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from bn-acc-bw-8; classification copied, dose dialled down for the acute phase. */
const A_BAND_FACE_PULL_2: ExerciseTemplate =
  {
    id: 'acute-88-band-face-pull',
    name: 'Band Face Pull',
    sets: 2,
    reps: '15 light reps',
    cue: 'Pull a light band towards the forehead with the elbows high, stopping short of the end of the pull - slow out, slow back. Keep it light enough that ten more reps would feel easy',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['rear_shoulder', 'upper_back'],
    videoId: '',
    movementPattern: 'pull',
    primaryMuscle: 'Rear deltoid',
    secondaryMuscles: ['Rhomboids', 'External rotators'],
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SEATED_LAT_PRESS_DOWN_HOLD_CHAIR: ExerciseTemplate =
  {
    id: 'acute-89-seated-lat-press-down-hold-chair',
    name: 'Seated Lat Press-Down Hold (Chair)',
    sets: 3,
    reps: '6 reps, hold 8s each',
    cue: 'Sit on a firm chair with the hands flat on the seat beside your hips - press down gently at about a quarter effort, as if to lift yourself, and hold. This works the lat while it stays short',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['lat_mid_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from bn-acc-bw-8; classification copied, dose dialled down for the acute phase. */
const A_BAND_FACE_PULL_2_2: ExerciseTemplate =
  {
    id: 'acute-90-band-face-pull',
    name: 'Band Face Pull',
    sets: 2,
    reps: '15 light reps',
    cue: 'Pull a light band towards the forehead with the elbows high, stopping short of the end of the pull - slow both ways. Works the mid-back muscles around the sore lat rather than through it',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['rear_shoulder', 'upper_back'],
    videoId: '',
    movementPattern: 'pull',
    primaryMuscle: 'Rear deltoid',
    secondaryMuscles: ['Rhomboids', 'External rotators'],
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_BAND_STRAIGHT_ARM_PRESS_DOWN_SHORT_RANGE: ExerciseTemplate =
  {
    id: 'acute-91-band-straight-arm-press-down-short',
    name: 'Band Straight-Arm Press-Down (Short Range)',
    sets: 2,
    reps: '12 slow reps each side',
    cue: 'Anchor a light band at head height, start with the arm at forehead level rather than fully overhead - press the straight arm down to the hip, then return slowly under control. Never let the arm drift back up past your forehead',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['lat_mid_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from fl-s-14-cooldown; classification copied, dose dialled down for the acute phase. */
const A_PRONE_THORACIC_EXTENSION_2: ExerciseTemplate =
  {
    id: 'acute-92-prone-thoracic-extension',
    name: 'Prone Thoracic Extension',
    sets: 2,
    reps: '10 reps, hold 2s at top',
    cue: 'Lie face down with the arms by your sides - lift the chest a small way off the floor using the mid-back only, hold, then lower slowly. Keep the lift low and easy',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['upper_back', 'rear_shoulder'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Thoracic extensors',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };

/** Written for the acute phase. */
const A_SUPINE_RIB_BREATHING_HANDS_ON_RIBS: ExerciseTemplate =
  {
    id: 'acute-93-supine-rib-breathing-hands-on-ribs',
    name: 'Supine Rib Breathing (Hands on Ribs)',
    sets: 2,
    reps: '10 slow breaths',
    cue: 'Lie on your back with a hand on each side of the ribs - breathe in slowly and feel the ribs widen under your hands, then breathe all the way out. Keeps the rib cage moving without any strain on it',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['core_ribs'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Written for the acute phase. */
const A_SUPINE_HEEL_SLIDE_BRACED: ExerciseTemplate =
  {
    id: 'acute-94-supine-heel-slide-braced',
    name: 'Supine Heel Slide (Braced)',
    sets: 2,
    reps: '8 slow reps each side',
    cue: 'Knees bent and back flat - tense the stomach to about a quarter of your hardest effort, then slide one heel along the floor until the leg is nearly straight and draw it back. Stop short if the low back or ribs start to lift or ache.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['core_ribs'],
    videoId: '',
    movementPattern: 'rehabilitation',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
  };

/** Reused from sq-acc-bw-17; classification copied, dose dialled down for the acute phase. */
const A_DEAD_BUG_2: ExerciseTemplate =
  {
    id: 'acute-95-dead-bug',
    name: 'Dead Bug',
    sets: 2,
    reps: '6 slow reps each side',
    cue: 'Brace lightly, then lower one arm and the opposite leg only as far as the low back stays flat and the ribs stay quiet - short range is fine. Breathe out as you reach',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['core_ribs', 'lower_back'],
    videoId: '',
    movementPattern: 'isometric',
    primaryMuscle: 'Transversus abdominis',
    secondaryMuscles: ['Obliques', 'Hip flexors'],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Reused from dl-acc-bw-12; classification copied, dose dialled down for the acute phase. */
const A_BIRD_DOG_2: ExerciseTemplate =
  {
    id: 'acute-96-bird-dog',
    name: 'Bird Dog',
    sets: 2,
    reps: '6 each side, hold 3s',
    cue: 'On all fours, reach one arm forward and slide the opposite leg back - keep the hips level and the trunk still. Lift the leg clear of the floor only if that stays comfortable',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['lower_back', 'core_ribs'],
    videoId: '',
    movementPattern: 'isometric',
    primaryMuscle: 'Erector spinae',
    secondaryMuscles: ['Glutes', 'Core', 'Shoulder stabilizers'],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
  };

/** Reused from ph-r-cr-2; classification copied, dose dialled down for the acute phase. */
const A_PALLOF_PRESS_ISOMETRIC_HOLD: ExerciseTemplate =
  {
    id: 'acute-97-pallof-press-isometric-hold',
    name: 'Pallof Press (Isometric Hold)',
    sets: 2,
    reps: '15s each side',
    cue: 'Light band at chest height, press the hands out and simply hold - resist the pull, keep the ribs down and keep breathing. Use a band light enough that the hold feels easy',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['core_ribs', 'lower_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Obliques',
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
  };


// ─── The protocols ───────────────────────────────────────────────────────────

export const ACUTE_PREHAB_BY_REGION: Record<PainRegion, ExerciseTemplate[]> = {
  // Hamstrings
  hamstrings: [
    A_SUPINE_ISOMETRIC_HAMSTRING_PRESS_BENT_KNEE,
    A_BANDED_CLAMSHELL,
    A_GLUTE_BRIDGE_ISOMETRIC_HOLD,
    A_PRONE_KNEE_BEND_HOLD,
    A_SINGLE_LEG_GLUTE_BRIDGE,
  ],
  // Glutes
  glutes: [
    A_GLUTE_SET_ISOMETRIC,
    A_GLUTE_BRIDGE_ISOMETRIC_HOLD_2,
    A_BANDED_CLAMSHELL_2,
    A_ISOMETRIC_HIP_ABDUCTION_WALL_PRESS,
    A_SINGLE_LEG_GLUTE_BRIDGE_2,
  ],
  // Calf / Shin
  calf_shin: [
    A_SEATED_ANKLE_PUMP_SMALL_RANGE,
    A_SEATED_TOE_RAISE,
    A_SEATED_ISOMETRIC_CALF_PRESS,
    A_SEATED_HEEL_RAISE_BODYWEIGHT,
    A_LEGS_UP_THE_WALL,
  ],
  // Ankle / Achilles
  ankle_achilles: [
    A_SEATED_ANKLE_PUMP_SMALL_RANGE_2,
    A_SEATED_TOE_RAISE_2,
    A_ISOMETRIC_ANKLE_PRESS_IN_AND_OUT,
    A_SEATED_ISOMETRIC_CALF_PRESS_2,
    A_SINGLE_LEG_BALANCE,
    A_LEGS_UP_THE_WALL_2,
  ],
  // Quads
  quads: [
    A_QUAD_SET_ISOMETRIC,
    A_SHORT_ARC_QUAD_EXTENSION_TOWEL_ROLL,
    A_SUPINE_STRAIGHT_LEG_RAISE,
    A_BANDED_CLAMSHELL_2_2,
    A_SINGLE_LEG_BALANCE_2,
    A_LEGS_UP_THE_WALL_2_2,
  ],
  // Knee
  knee: [
    A_QUAD_SET_ISOMETRIC_2,
    A_SUPPORTED_HEEL_SLIDE,
    A_SUPINE_STRAIGHT_LEG_RAISE_2,
    A_GLUTE_BRIDGE_ISOMETRIC_HOLD_2_2,
    A_TERMINAL_KNEE_EXTENSION_BAND,
    A_LEGS_UP_THE_WALL_2_2_2,
  ],
  // Hip / Groin
  hip_groin: [
    A_ISOMETRIC_ADDUCTOR_SQUEEZE_BALL_OR_TOWEL,
    A_GLUTE_BRIDGE_ISOMETRIC_HOLD_2_2_2,
    A_SEATED_HIP_MARCH_LOW_LIFT,
    A_LONG_LEVER_ADDUCTOR_SQUEEZE,
    A_SINGLE_LEG_BALANCE_2_2,
    A_LEGS_UP_THE_WALL_2_2_2_2,
  ],
  // Front of Shoulder
  front_shoulder: [
    A_PENDULUM_SHOULDER_SWING,
    A_SCAPULAR_SETTING_ISOMETRIC,
    A_ISOMETRIC_SHOULDER_EXTERNAL_ROTATION_DOORFRA,
    A_ISOMETRIC_SHOULDER_FLEXION_PRESS_WALL,
    A_SUPPORTED_SHOULDER_SLIDE_TABLE,
    A_WALL_SLIDE,
  ],
  // Back of Shoulder
  rear_shoulder: [
    A_PENDULUM_SHOULDER_SWING,
    A_SCAPULAR_SETTING_ISOMETRIC,
    A_ISOMETRIC_SHOULDER_EXTERNAL_ROTATION_DOORFRA,
    A_ISOMETRIC_SHOULDER_EXTENSION_PRESS_WALL,
    A_PRONE_THORACIC_EXTENSION,
    A_BAND_FACE_PULL,
  ],
  // Chest
  chest: [
    A_SCAPULAR_SETTING_ISOMETRIC,
    A_ISOMETRIC_PEC_SQUEEZE_PALMS_TOGETHER,
    A_ISOMETRIC_CHEST_PRESS_INTO_WALL,
    A_BAND_CHEST_PRESS_LIGHT_SHORT_RANGE,
  ],
  // Biceps
  bicep: [
    A_ELBOW_FLEXION_EXTENSION_ROM,
    A_FOREARM_SUPINATION_PRONATION,
    A_ISOMETRIC_ELBOW_FLEXION_HOLD_TABLE,
    A_ISOMETRIC_SUPINATION_HOLD_TOWEL,
    A_BAND_CURL_LIGHT_HIGH_REPS,
  ],
  // Triceps
  tricep: [
    A_ELBOW_FLEXION_EXTENSION_ROM_2,
    A_FOREARM_SUPINATION_PRONATION_2,
    A_ISOMETRIC_ELBOW_EXTENSION_PRESS_THIGH,
    A_ISOMETRIC_SHOULDER_EXTENSION_PRESS_WALL_2,
    A_BAND_PUSHDOWN_LIGHT_HIGH_REPS,
  ],
  // Elbow
  elbow: [
    A_OPEN_AND_CLOSE_FIST_PUMPS,
    A_ISOMETRIC_WRIST_EXTENSION_HOLD,
    A_ISOMETRIC_WRIST_FLEXION_HOLD,
    A_ISOMETRIC_ELBOW_PRESS_BEND_AND_STRAIGHTEN,
    A_PAIN_FREE_ELBOW_BEND_AND_STRAIGHTEN,
    A_FOREARM_SUPINATION_PRONATION_2_2,
  ],
  // Wrist
  wrist: [
    A_OPEN_AND_CLOSE_FIST_PUMPS_2,
    A_ISOMETRIC_WRIST_EXTENSION_HOLD,
    A_ISOMETRIC_WRIST_FLEXION_HOLD,
    A_SOFT_TOWEL_SQUEEZE,
    A_BAND_FINGER_EXTENSION,
    A_PAIN_FREE_WRIST_GLIDE,
  ],
  // Neck
  neck: [
    A_SUPPORTED_NECK_NOD_HEAD_RESTING,
    A_ISOMETRIC_NECK_PRESS_HAND_RESISTANCE,
    A_SUPPORTED_NECK_ROTATION_SMALL_RANGE,
    A_CHIN_TUCK,
    A_SCAPULAR_SETTING_SHOULDER_BLADE_SET,
    A_WALL_ANGEL,
  ],
  // Lower Back
  lower_back: [
    A_SUPINE_ABDOMINAL_BRACE_WITH_BREATHING,
    A_SUPINE_PELVIC_TILT_SMALL_RANGE,
    A_GLUTE_BRIDGE_ISOMETRIC_HOLD_2_2_2_2,
    A_DEAD_BUG,
    A_BIRD_DOG,
  ],
  // Upper Back
  upper_back: [
    A_CHIN_TUCK_2,
    A_SCAPULAR_SETTING_ISOMETRIC_SQUEEZE,
    A_THORACIC_CAT_COW,
    A_WALL_SLIDE_2,
    A_ISOMETRIC_BAND_ROW_HOLD_LIGHT,
    A_BAND_FACE_PULL_2,
  ],
  // Lat / Mid Back
  lat_mid_back: [
    A_SEATED_LAT_PRESS_DOWN_HOLD_CHAIR,
    A_THORACIC_CAT_COW,
    A_BAND_FACE_PULL_2_2,
    A_BAND_STRAIGHT_ARM_PRESS_DOWN_SHORT_RANGE,
    A_PRONE_THORACIC_EXTENSION_2,
  ],
  // Core / Ribs
  core_ribs: [
    A_SUPINE_RIB_BREATHING_HANDS_ON_RIBS,
    A_SUPINE_HEEL_SLIDE_BRACED,
    A_DEAD_BUG_2,
    A_BIRD_DOG_2,
    A_PALLOF_PRESS_ISOMETRIC_HOLD,
  ],
};

/**
 * The words shown with each protocol.
 *
 * `disclaimer` is the pain rule, and it is not optional decoration: it is the
 * thing that makes a self-directed rehab session safe, because it is the user's
 * own pain that decides the dose. It is shown as a banner that cannot be
 * dismissed.
 *
 * `avoid` is what the protocol deliberately leaves out and why. Someone who
 * has been told for years to stretch a tight hamstring needs to know that the
 * absence is the treatment, not an oversight.
 */
export interface AcuteProtocolNotes {
  plainName: string;
  disclaimer: string;
  avoid: string[];
}

export const ACUTE_PROTOCOL_NOTES: Record<PainRegion, AcuteProtocolNotes> = {
  hamstrings: {
    plainName: 'Hamstrings',
    disclaimer:
      'Work only in a range that stays comfortable - nothing in this session should take your pain above 2 out of 10, and it should settle again as soon as you stop. If it hurts more than that while you work, or the leg feels worse the next morning, stop and get it assessed by a physiotherapist or doctor.',
    avoid: [
      'Standing and supine hamstring stretches - pulling on a muscle that is still knitting back together pulls the repairing fibres apart and slows healing down',
      'Nordic curl negatives and other hard lowering work - the heaviest demand there is on a hamstring, and completely wrong in the first two weeks after a strain',
      'The wall hip hinge and any hinge cued to feel a stretch at the bottom - it loads the hamstring at its longest point, which is exactly where strains happen and re-happen',
      'Pigeon Pose and the seated forward fold - long passive holds that park the healing tissue at full length for a minute at a time',
      'Running, sprinting and anything that lands - the tissue is nowhere near ready for speed',
    ],
  },
  glutes: {
    plainName: 'Glutes',
    disclaimer:
      'Stay inside a range that feels comfortable - none of this should push your pain above 2 out of 10, and it should settle as soon as you finish. If the pain goes higher than that, or the hip is more sore the following day, stop and have it assessed by a physiotherapist or doctor.',
    avoid: [
      'Figure-4 and Pigeon Pose - both pull the leg across the body, which presses the glute tendons hard against the point of the hip and is one of the most common reasons this pain drags on',
      'Loaded hip hinges - deadlifts, Romanian deadlifts, kettlebell swings and hip thrusts all ask the sore muscle for its hardest job while it is still healing',
      'Deep squats and lunges, which take the hip into the loaded, folded position the tissue least tolerates right now',
      'Jumping, running and taking stairs two at a time',
      'Long side-lying holds on the sore hip and sitting with the legs crossed - both squash the tendon against the bone for minutes at a time',
    ],
  },
  calf_shin: {
    plainName: 'Calf / Shin',
    disclaimer:
      'Keep everything inside a pain-free range - nothing here should take your pain above 2 out of 10, and it should ease off the moment you stop. If it goes higher than that, or the calf is tighter and more painful the next day, stop and get it assessed by a physiotherapist or doctor.',
    avoid: [
      'Calf and soleus stretches against a wall - a healing calf tear does not need lengthening, and that is the exact position most calves tear in',
      'Heel drops off a step and slow eccentric calf raises - the right treatment for a long-standing tendon problem and far too much for a fresh muscle strain',
      'Single-leg calf raises, which put roughly double the load through the injured calf compared with using both legs',
      'Running, skipping and jumping - every stride is a fast, forceful stretch of the tissue you are trying to protect',
      'Digging into the sore spot with a massage gun or foam roller in the first week or so, which can add to the bleeding and swelling',
    ],
  },
  ankle_achilles: {
    plainName: 'Ankle / Achilles',
    disclaimer:
      'Only work in a range that stays comfortable - nothing here should push your pain above 2 out of 10, and it should settle straight after you finish. If the pain is higher than that, or the ankle is stiffer and more sore the next morning, stop and get it assessed by a physiotherapist or doctor.',
    avoid: [
      'Eccentric heel drops off a step - the correct treatment for a long-standing Achilles problem and the wrong choice entirely for one that is freshly strained, swollen or angry',
      'Calf and soleus stretches against a wall, which pull directly on the tendon you are trying to settle',
      'Full-range ankle circles - they take an irritated joint to the end of its range in every direction, one after another',
      'Running, hopping, skipping and jumping, and anything where you push off hard',
      'Balance work with no support and up on the toes - the balance training here is deliberately flat-footed with a hand on something solid',
    ],
  },
  quads: {
    plainName: 'Quads',
    disclaimer:
      'Work only in a range that stays pain-free - 0 to 2 out of 10 at most, and no sharp pull at any point. If pain goes above a 2 while you work, or the thigh is more sore later that day or the next morning, stop and get it assessed by a physiotherapist or doctor.',
    avoid: [
      'Standing Quad Stretch, Couch Stretch and kneeling hip flexor stretches - all of them pull a torn quad into its longest position, which is the one thing torn muscle fibres cannot tolerate in the first week or two',
      'Slow Step-Down and any other eccentric or step-based quad work - lowering under control is exactly the loading pattern that tore the muscle in the first place',
      'Isometric Wall Sit and deep squats or lunges - long holds at 90 degrees put high tension through the quad while it is already lengthened',
      'Foam rolling or digging into the sore spot - pressure over a fresh strain can worsen the bleeding and bruising',
      'Running, kicking and sprinting until the leg is pain-free at full effort on the exercises below',
    ],
  },
  knee: {
    plainName: 'Knee',
    disclaimer:
      'Stay in a pain-free range throughout - 0 to 2 out of 10 is the limit, and nothing should feel sharp or catch. If pain goes above a 2, or the knee is more swollen or stiff the next morning, stop and get it assessed by a physiotherapist or doctor.',
    avoid: [
      'Slow Step-Down, step-ups and squatting past a quarter of the way down - deep bending squeezes an already irritated kneecap and loads the joint eccentrically',
      'VMO Wall Sit and any long hold at 90 degrees - high load in deep bend is the classic way to flare a sore knee',
      'Standing Quad Stretch, Figure-4 Glute Stretch and kneeling stretches - they tug on a joint that is already irritated and add nothing while it is settling',
      'Kneeling, twisting on a planted foot, jumping and running until the knee is comfortable with everything below',
      'Pushing through swelling - a knee that puffs up after a session was loaded too hard, not stretched too little',
    ],
  },
  hip_groin: {
    plainName: 'Hip / Groin',
    disclaimer:
      'Everything here should stay pain-free - up to 2 out of 10 at most, with no sharp pull in the groin. If pain goes above a 2 while you work, or the area is worse later that day or the next morning, stop and get it assessed by a physiotherapist or doctor.',
    avoid: [
      'Copenhagen Adductor Hold - one of the highest adductor loads there is, and completely wrong for a groin that is still healing',
      'Butterfly and seated groin stretches, Pigeon Pose and wide-legged positions - they take the injured inner thigh to its full length, which is where fresh strains re-tear',
      'Hip Flexor Stretch and kneeling lunge stretches - the same problem at the front of the hip if that is the part that was strained',
      'Lateral Band Walk, side lunges and wide-stance squats - these pull the groin long while it is under load and weight-bearing',
      'Kicking, sprinting and changing direction until the squeezes below are comfortable at full effort',
    ],
  },
  front_shoulder: {
    plainName: 'Front of Shoulder',
    disclaimer:
      'Work only in a range that stays pain-free - a mild ache of 0 to 2 out of 10 is acceptable, anything sharper is not. Stop and get the shoulder assessed if pain climbs above 2 out of 10 during a session or if it is more sore the day after.',
    avoid: [
      'Doorway chest stretch and pec minor stretch - both drive the arm into end-range shoulder extension, which is the exact position that pulls on a freshly strained front shoulder',
      'Cross-body and overhead stretching - end-range positions add nothing in the first ten days and can irritate a healing tendon',
      'Shoulder CAR and other full-circle mobility drills - taking the joint to its limit in every direction is the opposite of what an acute strain needs',
      'Press-ups, dips, bench pressing and overhead pressing - loaded shoulder flexion is a return-to-sport task, not a day 2-10 task',
      'Lifting the arm above shoulder height against gravity until the isometric holds feel completely comfortable',
    ],
  },
  rear_shoulder: {
    plainName: 'Back of Shoulder',
    disclaimer:
      'Stay inside a pain-free range at all times - 0 to 2 out of 10 discomfort is fine, more than that is a signal to stop. If pain goes above 2 out of 10, or the shoulder is worse the following day, stop and get it assessed.',
    avoid: [
      'Cross-body shoulder stretch - it lengthens the rear deltoid and back of the shoulder capsule, which is precisely the tissue that has been strained',
      'Band Pull-Apart and Prone Y Raise at their usual dose - both take the injured rear deltoid through full range under load and squeeze hard at the end, which is too much in the first week',
      'Shoulder CAR and full-circle mobility work - end range in every direction is the wrong ask for an acute strain',
      'Rows, pull-downs, rear flyes and any pulling with weight',
      'Sleeping on the sore side, and the sleeper stretch, which compresses and lengthens the back of the shoulder at the same time',
    ],
  },
  chest: {
    plainName: 'Chest',
    disclaimer:
      'Everything here should feel easy - keep discomfort at 0 to 2 out of 10 and ease off the moment it goes higher. If pain rises above 2 out of 10, or the chest is more sore the next day, stop the session and get it assessed.',
    avoid: [
      'Doorway chest stretch, pec minor stretch and floor angels - each one takes the chest muscle to its full length, which is the single position a healing pec strain cannot tolerate',
      'Press-ups of any kind, including incline - the bottom of a press-up is a loaded stretch of the pec',
      'Flyes, dips and bench pressing, which combine load with end-range width',
      'Letting the elbows travel behind the ribs in any exercise, including sleeping with the arm out wide or hanging off the edge of the bed',
      'Chest-opening yoga positions and foam rolling directly over the sore area',
    ],
  },
  bicep: {
    plainName: 'Biceps',
    disclaimer:
      'Only work in a range that stays pain-free - 0 to 2 out of 10 discomfort is acceptable, anything above that is not. Stop and get the arm assessed if pain goes past 2 out of 10 during the session or if it is worse the following day.',
    avoid: [
      'The arm-back bicep stretch - straightening the elbow with the arm behind you is the longest possible position for the biceps and its shoulder tendon, and a healing biceps should not go there',
      'Cross-body shoulder stretch and wrist flexor stretch, which both pull on the same tissue line',
      'Curls with weight, chin-ups and anything with a slow lowering phase - controlled lowering under load is how most biceps injuries happen in the first place',
      'Forcing the last few degrees of straightening at the elbow, whether by yourself or with someone helping',
      'Carrying shopping or heavy bags in that hand while the arm is still sore',
    ],
  },
  tricep: {
    plainName: 'Triceps',
    disclaimer:
      'Keep everything inside a pain-free range - 0 to 2 out of 10 discomfort is fine, anything sharper means stop. If pain rises above 2 out of 10, or the back of the arm is more sore the day after, stop and get it assessed.',
    avoid: [
      'Overhead and cross-body tricep stretches - both put the triceps at full length across the shoulder and the elbow at the same time, which a healing muscle cannot take',
      'Wrist extensor stretch, which pulls on the same chain at the elbow',
      'Dips, close-grip pressing, skull crushers and any overhead pressing',
      'Wall angels and overhead arm slides in the first week - taking the arm above the head lengthens the long head of the triceps at the shoulder',
      'Bending the elbow deeply while holding something heavy, such as carrying a bag with the arm bent',
    ],
  },
  elbow: {
    plainName: 'Elbow',
    disclaimer:
      'Stay inside a pain-free range for every movement here - no more than 2 out of 10 on a scale where 0 is nothing and 10 is the worst pain you can imagine. If the elbow goes above that during a movement, or feels worse in the hours afterwards, stop and get it assessed before doing this again.',
    avoid: [
      'Wrist flexor and extensor stretches - pulling the fingers back on a straight arm puts the healing tendon at the elbow on full stretch, which is exactly what keeps it irritable',
      'Eccentric Wrist Extension with a water bottle - slow heavy lowering is the right drill for a long-standing tendon problem, not for a strain that is only days old',
      'The Forearm Flexor & Extensor Stretch that normally ends this session - it is the same end-range pull with the elbow locked out',
      'Pronator Self-Release - digging a thumb into tissue that is still swollen and sore adds irritation rather than settling it',
      'Hanging, heavy gripping, press-ups and any loaded arm work - the elbow is not ready to take load through a long straight arm yet',
      'Fully straightening or fully bending the elbow to its limit - the last few degrees at either end are where a fresh strain gets pulled again',
    ],
  },
  wrist: {
    plainName: 'Wrist',
    disclaimer:
      'Everything here should stay pain-free - up to 2 out of 10 at most, on a scale where 0 is nothing and 10 is the worst pain you can imagine. If the wrist hurts more than that at any point, or is more sore later on, stop and get it looked at before repeating this session.',
    avoid: [
      'Wrist flexor and extensor stretches - taking a sore wrist to its end range pulls directly on the ligaments and tendons that are trying to knit back together',
      'Full end-range wrist circles - going as far as the joint will travel in every direction strains the injured structures at the outside of each circle',
      'The Forearm Flexor & Extensor Stretch that normally closes this session - it is a 30 second end-range hold on an injured joint',
      'Press-ups, planks, front rack holds or anything that puts bodyweight through the palm - a bent-back loaded wrist is far too much this early',
      'Loaded wrist curls, heavy gripping and hanging - the wrist should not be taking outside load until it is comfortable without it',
      'Cracking or forcing the joint to see how far it goes - testing the painful range repeatedly is what keeps it inflamed',
    ],
  },
  neck: {
    plainName: 'Neck',
    disclaimer:
      'Keep every movement inside a pain-free range - 2 out of 10 at the very most, where 0 is no pain and 10 is the worst pain you can imagine. If anything is sharper than that, or the neck is stiffer and sorer afterwards, stop and get it assessed rather than pushing on.',
    avoid: [
      'Neck side stretches, upper trap stretches and levator scapulae stretches - pulling the head away from a strained neck muscle re-stresses the tissue that is trying to heal',
      'Any end-range turning, looking up or dropping the chin to the chest - the far end of the range is where a fresh neck strain gets provoked',
      'Hands-on pulling of the head in any direction, including using the other arm to add pressure',
      'Loaded shrugs, farmer\'s carries, overhead pressing and heavy rows - they all pull on the neck through the shoulders',
      'The Prone Thoracic Extension that normally ends this session - lying face down and lifting the head holds the neck in extension for exactly the wrong length of time',
      'Fast or repeated head movements to test the range - repeatedly checking how far it will go keeps the area irritated',
    ],
  },
  lower_back: {
    plainName: 'Lower Back',
    disclaimer:
      'Everything here should feel easy - keep any discomfort at or below 2 out of 10 on a 0 to 10 pain scale, and never push into a position that hurts. If pain goes above that during the session, or the back is worse the next day, stop and get it assessed by a physio or doctor.',
    avoid: [
      'Hip Flexor Stretch - the deep lunge tips the pelvis forward and pulls the sore low back to the very end of its range',
      'Cat-Cow - it drives the injured segment into full bending backwards and forwards, which is the movement that hurts most in the first ten days',
      'Supine Spinal Twist and Seated Forward Fold - end-range twisting and folding put a direct pull on healing muscle and ligament',
      'Hollow Body Hold and McGill Side Plank - far too much trunk load for a strain that is only a few days old',
      'Any hip hinge, deadlift or good morning pattern, including Hip Hinge Against Wall - loading the back in a bent-forward position is what tends to re-tear it',
      'Rolling or digging into the sore spot - it feels productive but it just irritates fresh tissue',
    ],
  },
  upper_back: {
    plainName: 'Upper Back',
    disclaimer:
      'Stay inside a pain-free range throughout - anything you feel should be no more than 2 out of 10 on a 0 to 10 pain scale. If it climbs above that, or the mid-back feels worse in the hours afterwards, stop the session and have it assessed by a physio or doctor.',
    avoid: [
      'Thread-the-Needle Rotation and Book Opener - both take the mid-back to the end of its twist, which pulls directly on the strained muscle',
      'Prone T-Spine Extension - arms out in a T is a long lever and loads sore tissue hard for no benefit this early',
      'Band Pull-Apart - straight-arm band work puts more pull through the rhomboids and mid-traps than a fresh strain can take',
      'Cat-Cow at full range and Child\'s Pose - end-range rounding lengthens exactly what is healing',
      'Upper Trap Stretch, Levator Scapulae Stretch and Neck Side Stretch - hanging on a strained area is not treatment',
      'Rows, pull-ups and overhead pressing with any real weight until this is settled and pain-free',
    ],
  },
  lat_mid_back: {
    plainName: 'Lat / Mid Back',
    disclaimer:
      'Work only where it is pain-free - a mild 0 to 2 out of 10 on a 0 to 10 pain scale is acceptable, anything sharper is not. Stop the session and get the area assessed by a physio or doctor if pain goes above 2 out of 10, or if it is worse in the hours after.',
    avoid: [
      'Doorway Lat Stretch, Child\'s Pose with Side Reach and Side-Bend Overhead Reach - all three pull the lat out to its full length, which is the one thing a strained lat cannot tolerate in the first ten days',
      'Any overhead reaching or hanging position - the lat is already at full stretch before you have even added load',
      'Thread-the-Needle Rotation and Book Opener - end-range twisting drags on the same tissue from a different angle',
      'Band Pull-Apart - straight-arm band tension is more than a fresh strain needs',
      'Pull-ups, lat pulldowns and dumbbell rows - the classic way people re-tear a lat is going back to pulling too soon',
      'Foam rolling the sore area - pressure on a healing tear does not speed it up',
    ],
  },
  core_ribs: {
    plainName: 'Core / Ribs',
    disclaimer:
      'Keep every movement pain-free - no more than 2 out of 10 on a 0 to 10 pain scale - and breathe normally rather than holding your breath. If pain rises above 2 out of 10, or the ribs or stomach feel worse afterwards, stop and get assessed by a physio or doctor.',
    avoid: [
      'Hollow Body Hold - holding the whole body off the floor is one of the hardest loads there is for a torn stomach muscle',
      'McGill Side Plank - a side plank loads the side of the trunk at precisely the spot that is injured',
      'Child\'s Pose with Side Reach, Side-Bend Overhead Reach and Supine Spinal Twist - side bending and twisting pull the injured muscle and its rib attachments out to full length',
      'Cat-Cow - arching backwards stretches the front of the trunk, which is the healing tissue in a stomach or rib strain',
      'Sit-ups, crunches, russian twists and leg raises - full-range trunk flexion is the fastest way to set this back',
      'Any lift heavy enough that you hold your breath and strain, including coughing or sneezing unbraced if you can help it',
    ],
  },
};

/**
 * The pain rule, in one sentence, for anywhere a full disclaimer will not fit.
 *
 * Kept as a single shared constant rather than written out per screen: it is the
 * one instruction that makes the rest of this safe, and a version of it that
 * drifts on one screen is worse than none.
 */
export const PAIN_FREE_RULE =
  'Stay in a pain-free range. Nothing here should take your pain above 2 out of 10, and it should settle as soon as you stop.';

/** Every acute exercise, deduplicated. Used by the contract test and the export. */
export function allAcuteExercises(): ExerciseTemplate[] {
  const seen = new Set<string>();
  const out: ExerciseTemplate[] = [];
  for (const list of Object.values(ACUTE_PREHAB_BY_REGION)) {
    for (const e of list) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}
