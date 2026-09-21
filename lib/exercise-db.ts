import { EquipmentTier, ExerciseCategory, PainRegion } from './store';
// The acute-phase protocols. Kept in their own file rather than in this one:
// they are the safety-critical half of the rehab content and need to be
// readable on their own. That mattered most when this file was twenty thousand
// lines of Train catalogue; the catalogue is gone and the reason is not, since
// what is left here is the rest of the rehab content and the two halves are
// easier to check against each other side by side than interleaved.
import { ACUTE_PREHAB_BY_REGION } from './acute-rehab';
/**
 * Archie's library and his nine conditioning exercises, so that the two region
 * lookups below know the exercises people are now given. Sessions built from
 * the library serve records that are not in any collection in this file, and a
 * muscle map that has never heard of what somebody trained shades nothing: a
 * lower body session of Trapbar Deadlifts and Kettlebell Box Squats left the
 * legs grey on the Stats tab. lib/exercise-library.ts imports only a TYPE from
 * here, so this adds no runtime cycle.
 */
import { CONDITIONING_EXERCISES, LIBRARY_EXERCISES } from './exercise-library';

export { ACUTE_PREHAB_BY_REGION, ACUTE_PROTOCOL_NOTES, PAIN_FREE_RULE } from './acute-rehab';
export type { AcuteProtocolNotes } from './acute-rehab';

export type { ExerciseCategory };

export type InternalTier = 'bodyweight' | 'dumbbells' | 'fullgym';
const INTERNAL_TIERS: InternalTier[] = ['bodyweight', 'dumbbells', 'fullgym'];

/**
 * THREE THINGS WENT WITH THE CATALOGUE, and they are worth naming.
 *
 * `MainSessionType` - the squat, bench and deadlift days. Nothing is named
 * after a lift any more (decision 1); lib/session-type.ts maps the three stored
 * ids onto lower, upper and full body at the door.
 *
 * `effectiveOf` - "which of the kit they own picks the POOL". Only a table
 * keyed by equipment tier needs that question answered, and there are none
 * left: a library record states the kit it needs and is asked directly, which
 * is why somebody with dumbbells and a bench is no longer quietly served the
 * whole dumbbell shelf. See canPerformWith in lib/kit.ts.
 *
 * `ExperienceLevel` - the old pools were not filed by level at all; the rung a
 * person has reached is a property of the library record now, and the ceiling
 * that reads it lives in lib/library-session.ts.
 */
export function toInternalTier(tier: EquipmentTier): InternalTier {
  if (tier === 'bands' || tier === 'bodyweight') return 'bodyweight';
  if (tier === 'kettlebells' || tier === 'dumbbells') return 'dumbbells';
  return 'fullgym';
}

/**
 * Which equipment tier owns each named piece of kit.
 *
 * "Bodyweight" was being used in this file to mean NO EXTERNAL LOAD, while
 * onboarding sells the same word as NO EQUIPMENT. A pull-up is bodyweight-loaded
 * and still needs a bar, so the two readings quietly disagreed: a Chin-Up sat in
 * two bodyweight pools, an Ab Wheel Rollout requiring a 'machine' sat in a third,
 * and nothing downstream could tell, because the tier a movement is FILED under
 * and the kit it NEEDS were separate facts that nobody reconciled.
 *
 * This table is the single place that reconciles them. Every equipment gate in
 * the app derives from it rather than forming its own opinion.
 *
 * Bands sit at the bodyweight tier because the app itself puts them there —
 * toInternalTier() collapses 'bands' and 'bodyweight' into one internal tier, so
 * separating them would mean a fourth tier and a re-filing of the whole
 * catalogue. A pull-up bar gets no such benefit of the doubt.
 */
const EQUIPMENT_TIER: Record<string, InternalTier> = {
  bodyweight: 'bodyweight',
  'resistance bands': 'bodyweight',
  dumbbells: 'dumbbells',
  kettlebell: 'dumbbells',
  'ab wheel': 'fullgym',
  barbell: 'fullgym',
  'cable machine': 'fullgym',
  'foam roller': 'fullgym',
  'full gym': 'fullgym',
  fullgym: 'fullgym',
  machine: 'fullgym',
  'pull-up bar': 'fullgym',
  'stability ball': 'fullgym',
};

/** Every value `equipmentRequired` is allowed to take. */
export const EQUIPMENT_NAMES: string[] = Object.keys(EQUIPMENT_TIER);

/**
 * WHICH OF THE FIVE CHOICES CAN SUPPLY EACH PIECE OF KIT.
 *
 * This is the table EQUIPMENT_TIER above should have been all along. That one
 * answers "how well equipped must you be", on a three-rung ladder, which cannot
 * express the one thing users kept reporting: somebody who ticked "No Equipment"
 * and nothing else has no resistance bands, and 'bands' and 'bodyweight' sit on
 * the same rung of that ladder.
 *
 * Capability is not a ladder. It is a set. A person owns some of these five
 * things and not others, and an exercise is possible when at least one of the
 * things they own supplies what it needs.
 *
 * TWO DELIBERATE SUBSTITUTIONS, both of which a physiotherapist would make:
 *   - dumbbells and kettlebells satisfy each other. A goblet squat, a row and a
 *     Romanian deadlift are the same exercise with either, and the catalogue
 *     files them together for that reason.
 *   - a full gym supplies everything, bands included. Every gym has bands.
 *
 * And one deliberate refusal: bodyweight supplies NOTHING except bodyweight. A
 * pull-up bar is not bodyweight because the movement is unloaded, and neither is
 * a band because it is light. That conflation is the whole bug.
 */
const EQUIPMENT_SUPPLIED_BY: Record<string, EquipmentTier[]> = {
  // 'bench' is on this line and no other: owning a bench, box or sturdy step
  // never stops somebody doing bodyweight work, and it supplies nothing this
  // old table names. What it does supply is written in lib/kit.ts, which is
  // the table the library reads.
  bodyweight: ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym', 'bench'],
  'resistance bands': ['bands', 'fullgym'],
  dumbbells: ['dumbbells', 'kettlebells', 'fullgym'],
  kettlebell: ['dumbbells', 'kettlebells', 'fullgym'],
  'ab wheel': ['fullgym'],
  barbell: ['fullgym'],
  'cable machine': ['fullgym'],
  'foam roller': ['fullgym'],
  'full gym': ['fullgym'],
  fullgym: ['fullgym'],
  machine: ['fullgym'],
  'pull-up bar': ['fullgym'],
  'stability ball': ['fullgym'],
};

/**
 * A pool, minus anything this person has not got the kit for.
 *
 * The exported form of the same filter the accessors apply internally, for
 * the pools that take no equipment tier at all: the prehab circuits, the
 * stretch pool, the cooldowns. Their comments call them equipment-agnostic
 * and several of them contain light band work.
 */
export function possibleFor(
  pool: ExerciseTemplate[] | undefined,
  tier: EquipmentTier | readonly EquipmentTier[]
): ExerciseTemplate[] {
  return onlyPossible(pool, ownedFrom(tier));
}

/**
 * Can this person do this exercise, with what they said they have.
 *
 * Anything undeclared or unrecognised needs a full gym, which is the same way
 * tierRequiredFor fails. Hiding a mis-tagged movement from somebody who cannot
 * perform it costs a beginner nothing; showing it costs them the session.
 */
export function canPerformWith(
  equipmentRequired: string | undefined,
  owned: readonly EquipmentTier[]
): boolean {
  const suppliers = EQUIPMENT_SUPPLIED_BY[(equipmentRequired ?? '').toLowerCase()] ?? ['fullgym'];
  return suppliers.some((tier) => owned.includes(tier));
}

/**
 * The list a pool accessor filters against.
 *
 * Callers hold either the user's whole selection or the single effective tier
 * derived from it. A single tier is treated as owning only itself, which is the
 * strict reading and the correct one: somebody whose effective tier is
 * 'bodyweight' owns bodyweight and nothing else.
 */
function ownedFrom(tier: EquipmentTier | readonly EquipmentTier[]): readonly EquipmentTier[] {
  return Array.isArray(tier) ? tier : [tier as EquipmentTier];
}

/**
 * The pool, minus anything this person has not got the kit for.
 *
 * AND minus the ALTERNATIVES they have not got the kit for. An exercise carries
 * a hand-authored swap and a gentler comfort variant, and a great many of those
 * reach for a band the parent movement never needed: a Fire Hydrant offers a
 * Banded Clamshell, a Glute Bridge offers the same. Filtering the pool but
 * leaving those attached moves the leak one tap behind the swap button rather
 * than closing it.
 *
 * Stripped rather than replaced. A missing alternative costs one option on a
 * sheet; an impossible one costs the session.
 */
function onlyPossible(
  pool: ExerciseTemplate[] | undefined,
  owned: readonly EquipmentTier[]
): ExerciseTemplate[] {
  return (pool ?? [])
    .filter((t) => canPerformWith(t.equipmentRequired, owned))
    .map((t) => withPossibleVariants(t, owned));
}

/** A template with any alternative the user cannot perform removed. */
export function withPossibleVariants(
  t: ExerciseTemplate,
  owned: readonly EquipmentTier[]
): ExerciseTemplate {
  const swapOk =
    !t.swapAlternative ||
    canPerformWith(t.swapAlternative.equipmentRequired ?? t.equipmentRequired, owned);
  const comfortOk =
    !t.comfortVariant ||
    canPerformWith(t.comfortVariant.equipmentRequired ?? t.equipmentRequired, owned);
  if (swapOk && comfortOk) return t;
  const out: ExerciseTemplate = { ...t };
  if (!swapOk) delete out.swapAlternative;
  if (!comfortOk) delete out.comfortVariant;
  return out;
}

/**
 * The lowest tier that owns the kit a template asks for.
 *
 * Anything unrecognised — including a template that declares nothing at all —
 * is treated as gym equipment. Failing closed hides a mis-tagged movement from
 * the people who cannot perform it, which is the direction of error that costs
 * a beginner nothing.
 */
export function tierRequiredFor(equipmentRequired: string | undefined): InternalTier {
  return EQUIPMENT_TIER[(equipmentRequired ?? '').toLowerCase()] ?? 'fullgym';
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
  /**
   * A full link to the @GrowPerformanceRehabilitation video for this movement.
   *
   * Almost always left off. The normal place to put a video is the one table in
   * lib/exercise-videos.ts, keyed by exercise name — 800-odd templates is far
   * too many to hunt through, and a single alphabetical list is something a
   * non-programmer can maintain. This field exists for the occasional case where
   * writing the link next to the exercise is genuinely more convenient, and it
   * wins over the table when both are present.
   */
  youtubeUrl?: string;
  // Optional metadata for filtering, display and future smart selection
  movementPattern?:
    | 'squat'
    | 'hinge'
    | 'push'
    | 'pull'
    | 'carry'
    | 'lunge'
    | 'rotation'
    | 'isometric'
    | 'conditioning'
    | 'mobility'
    | 'rehabilitation';
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  equipmentRequired?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  isUnilateral?: boolean;
  injuryFriendlyAlternatives?: string[];
  swapAlternative?: {
    name: string;
    cue: string;
    suggestedLoad: string;
    /**
     * The kit THIS variant needs, when it differs from its parent's.
     *
     * Absent means "the same as the exercise it hangs off", which is right for
     * a genuine variation and wrong for the forty-one variants that quietly
     * reached for a band, a cable or a machine the parent never needed. Filled
     * in from each variant's own name, which is where every one of them says so.
     */
    equipmentRequired?: string;
  };
  comfortVariant?: {
    name: string;
    cue: string;
    suggestedLoad: string;
    triggerRegions: PainRegion[];
    /** See swapAlternative.equipmentRequired. */
    equipmentRequired?: string;
  };
}

/**
 * WHAT THIS FILE USED TO BE, AND WHAT IS LEFT OF IT.
 *
 * Until this commit it was the Train catalogue: roughly seventeen thousand
 * lines holding a warm-up pool, a mechanical and a neurological priming block,
 * power-goal overrides for both, one main lift per session type per equipment
 * tier, the accessory pools, a prehab slot, the finishers, four conditioning
 * pools, the goal-conditioning circuits, the 1RM test protocols and three
 * weekly session tables. Every session the app built came out of them.
 *
 * None of that is how a session is built any more. Train reads Archie's
 * exercise library (docs/EXERCISE-LIBRARY.md, lib/exercise-library.ts),
 * Conditioning reads his nine conditioning records, and both take their warm-up
 * and their cool-down from the same two places. The generators that read the
 * old pools were deleted a commit before this one, the walks and the checks
 * that reached them a commit after, and the pools themselves here.
 *
 * WHAT REMAINS IS RESTORE, which was never part of the move: the cool-down
 * below, the standalone joint-health and mobility sessions, the region-by-region
 * rehab work and its cool-downs. Restore prescribes rehabilitation rather than
 * training, so it is written and reasoned about differently, and nothing in the
 * rebuild asked it to change. The acute protocols live next door in
 * lib/acute-rehab.ts for the same reason.
 *
 * The old ids are NOT forgotten: lib/exercise-aliases.ts maps what people
 * logged against them onto the records that replaced them, so a history screen
 * still has a name to show and progress carries forward.
 */

// ─── COOL DOWN ────────────────────────────────────────────────────────────────

const COOLDOWN: ExerciseTemplate[] = [
  {
    id: 'cooldown-1',
    name: 'Diaphragmatic Breathing',
    sets: 1,
    reps: '3 min (slow deep breaths)',
    cue: 'Inhale through nose 4s, exhale through mouth 6s - down-regulate nervous system, let heart rate drop',
    suggestedLoad: 'Bodyweight',
    category: 'cooldown',
    targetRegions: [],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Diaphragm',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
];

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

/**
 * The stretches a session closes on.
 *
 * Read by both library builders (lib/library-session.ts and
 * lib/library-conditioning.ts), which is why it outlived the pools around it:
 * a cool-down is a cool-down whichever list the work above it came from.
 */
export function getCooldown(): ExerciseTemplate[] {
  return COOLDOWN;
}

// ─── STANDALONE PREHAB SESSION ────────────────────────────────────────────────
// A targeted joint-health circuit. Equipment-agnostic (all bodyweight/band).

const STANDALONE_PREHAB: ExerciseTemplate[] = [
  {
    id: 'ph-s-1',
    name: 'Cardio Warm-Up (Easy Walk / Bike)',
    sets: 1,
    reps: '3 min',
    cue: 'Start easy - just get blood flowing to the joints before any movement',
    suggestedLoad: 'Low intensity',
    category: 'prep',
    targetRegions: [],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Full body',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-2',
    name: 'Dead Bug',
    sets: 2,
    reps: '8 each side',
    cue: 'Low back pressed to floor throughout - reach opposite arm and leg, exhale fully. Core anti-extension',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['lower_back', 'core_ribs'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Core',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-3',
    name: 'Banded Clamshell',
    sets: 2,
    reps: '15 each side',
    cue: 'Band around knees, feet together - rotate top knee up, hold 1s, lower slowly. Glute med activation',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['hip_groin', 'knee', 'glutes'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glute medius',
    secondaryMuscles: [],
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-4',
    name: 'Band Pull-Apart',
    sets: 2,
    reps: '15 slow reps',
    cue: 'Arms straight, pull band to sternum - squeeze shoulder blades for 1s. Rotator cuff and rear-delt health',
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['front_shoulder', 'rear_shoulder', 'upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Rear deltoid',
    secondaryMuscles: [],
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-5',
    name: 'Pallof Press (Isometric Hold)',
    sets: 2,
    reps: '20s each side',
    cue: 'Press hands away from body, resist rotation - tall spine, breathe. Anti-rotation core stability',
    // The load used to read "Light band or cable" while the movement claimed to
    // need nothing, which offered a cable machine to people without one.
    suggestedLoad: 'Light band',
    category: 'prehab',
    targetRegions: ['core_ribs', 'lower_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Obliques',
    secondaryMuscles: [],
    equipmentRequired: 'resistance bands',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-6',
    name: 'Copenhagen Adductor Hold',
    sets: 2,
    reps: '20s each side',
    cue: 'Top leg on bench, bottom leg reaches - hold, squeeze inner thigh. Groin and adductor load',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['hip_groin', 'knee'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Adductors',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-7',
    name: 'Wall Slide',
    sets: 2,
    reps: '10 slow reps',
    cue: 'Back flat on wall, arms at 90° slide overhead - keep elbows and wrists touching wall. Shoulder health',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['front_shoulder', 'rear_shoulder', 'upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Rotator cuff',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-8',
    name: 'Tibialis Raise',
    sets: 2,
    reps: '15 each side',
    cue: 'Heels on ground, lift toes toward shin - slow and controlled. Shin splint prevention and ankle health',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles', 'calf_shin'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Calves',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  // ── Additional pool entries (13 total middle exercises; 7 picked per session via seeded rotation)
  {
    id: 'ph-s-10',
    name: 'Bird Dog',
    sets: 2,
    reps: '8 each side, hold 3s',
    cue: 'All fours, extend opposite arm and leg - keep back flat, zero rotation. Multifidus and lumbar stabiliser activation',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['lower_back', 'core_ribs'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Core',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-11',
    name: 'Glute Bridge',
    sets: 2,
    reps: '15 reps, hold 2s at top',
    cue: 'Feet flat, drive through heels - squeeze glutes hard at top, keep ribs down. Glute strength directly offloads the lower back',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['glutes', 'lower_back', 'hip_groin', 'hamstrings'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glutes',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-12',
    name: 'Prone Y Raise',
    sets: 2,
    reps: '10 slow reps',
    cue: 'Face down, arms in Y shape overhead - lift slowly, squeeze lower traps and rear delts. Builds the shoulder base that protects the rotator cuff',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['rear_shoulder', 'upper_back'],
    videoId: '',
    movementPattern: 'rehabilitation',
    // Was 'Thoracic extensors', which classifies this as CORE work — its own
    // cue says lower traps and rear delts, and the third entry under this same
    // name already said 'Lower trapezius'. One movement was reading as upper
    // body in one place and core in another, and that decides what the injury
    // screen is allowed to substitute for it.
    primaryMuscle: 'Lower trapezius',
    secondaryMuscles: ['Rear deltoid', 'Rhomboids'],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-13',
    name: 'Side-Lying Hip Abduction',
    sets: 2,
    reps: '15 each side',
    cue: 'Side-lying, top leg straight - lift to just above hip height, lower slowly. Glute medius strength for knee and hip protection',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['hip_groin', 'knee'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glute medius',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-14',
    name: 'Thread the Needle (Thoracic Rotation)',
    sets: 2,
    reps: '8 each side',
    cue: 'All fours, thread one arm under body and rotate - reach as far as possible then open fully to the ceiling. Thoracic spine mobility',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['upper_back', 'neck'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Thoracic extensors',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'ph-s-15',
    name: 'Single-Leg Calf Raise (Eccentric)',
    sets: 2,
    reps: '12 each leg',
    cue: 'Rise on both feet, lower slowly on one for 3 counts - eccentric load protects the Achilles tendon and builds ankle stability',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles', 'calf_shin'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Calves',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: true,
    injuryFriendlyAlternatives: [],
  },
  // ── Cooldown bookend — always last ──────────────────────────────────────────
  {
    id: 'ph-s-9',
    name: 'Figure-4 Glute Stretch',
    sets: 1,
    reps: '45s each side',
    cue: 'On back, figure-4 position - breathe deeply, let hip open. Hip capsule and piriformis',
    suggestedLoad: 'Bodyweight',
    category: 'cooldown',
    targetRegions: ['hip_groin', 'lower_back', 'glutes'],
    videoId: '',
    movementPattern: 'rehabilitation',
    primaryMuscle: 'Glutes',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
];

export function getStandalonePrehabWorkout(): ExerciseTemplate[] {
  return STANDALONE_PREHAB;
}

// ─── REGION-SPECIFIC PREHAB ────────────────────────────────────────────────────
// Curated circuits targeting each of the 11 pain regions.
// Equipment-agnostic (all bodyweight / light band).

const PREHAB_BY_REGION: Record<PainRegion, ExerciseTemplate[]> = {
  rear_shoulder: [
    {
      id: 'ph-r-rs-1',
      name: 'Band Pull-Apart',
      sets: 3,
      reps: '15 slow reps',
      cue: 'Arms straight at shoulder height - pull band to sternum, squeeze shoulder blades for 1s. Rear-delt and rotator cuff activation',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['rear_shoulder', 'upper_back', 'front_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rear deltoid',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      // "Band Face Pull" is the name three swap alternatives and three
      // injury-friendly alternative lists already resolve by; "Face Pull (band)"
      // was the same movement under a second spelling, and the picker listed
      // both.
      id: 'ph-r-rs-2',
      name: 'Band Face Pull',
      sets: 3,
      reps: '12 reps',
      cue: 'Pull band to forehead, elbows high and wide, externally rotate at end - feel rear delt and external rotators fire',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['rear_shoulder', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rear deltoid',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-rs-3',
      name: 'Prone Y Raise',
      sets: 2,
      reps: '10 slow reps',
      cue: 'Face down, arms in Y shape overhead - lift slowly, squeeze lower traps and rear delts. Control the descent',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['rear_shoulder', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Lower trapezius',
      secondaryMuscles: ['Rear deltoid', 'Rhomboids'],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-rs-4',
      name: 'Wall Slide',
      sets: 2,
      reps: '10 slow reps',
      cue: 'Back flat on wall, arms at 90° - slide overhead keeping elbows and wrists in contact. Scapular control',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['rear_shoulder', 'front_shoulder', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rotator cuff',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-rs-5',
      name: 'Cross-Body Shoulder Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Pull arm across chest at shoulder height - feel posterior capsule and rear delt. No twisting the torso',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['rear_shoulder', 'bicep', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Deltoids',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  front_shoulder: [
    {
      id: 'ph-r-fs-1',
      name: 'Doorway Chest Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Arm at 90°, step through doorway - breathe deeply into the pec and anterior delt stretch. No leaning forward',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['front_shoulder', 'upper_back', 'chest'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Pectorals',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-fs-2',
      name: 'Prone Shoulder External Rotation',
      sets: 3,
      reps: '12 each side',
      cue: 'Face down, elbow at 90°, rotate forearm upward - rotator cuff health, counteracts internal rotation dominance',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['front_shoulder', 'rear_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rotator cuff',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-fs-3',
      name: 'Band Pull-Apart',
      sets: 3,
      reps: '15 slow reps',
      cue: 'Arms straight, pull band to sternum - opens chest and activates rear structures to offset front shoulder load',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['front_shoulder', 'rear_shoulder', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rear deltoid',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-fs-4',
      name: 'Pec Minor Stretch (doorway)',
      sets: 2,
      reps: '30s each side',
      cue: 'Arm higher (120°) in doorway - targets the pec minor specifically. Breathe into the stretch, feel coracoid area open',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['front_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Pectorals',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-fs-5',
      name: 'Shoulder CAR (Controlled Articular Rotation)',
      sets: 2,
      reps: '5 slow circles each side',
      cue: 'Full active shoulder circle - reach as far as possible in every direction. No compensating with trunk. Joint health',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['front_shoulder', 'rear_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Deltoids',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  wrist: [
    {
      id: 'ph-r-ew-1',
      name: 'Wrist Flexor Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Arm extended, palm up, gently pull fingers back - feel medial forearm and flexor tendons. Never force',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['wrist', 'elbow'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Forearm flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ew-2',
      name: 'Wrist Extensor Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Arm extended, palm down, gently pull fingers toward you - targets extensors and lateral elbow (common extensor tendon)',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['wrist', 'elbow'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Forearm flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ew-3',
      name: 'Wrist Circles',
      sets: 2,
      reps: '10 each direction',
      cue: 'Slow full-range circles - lubricate the joint, mobilise all planes. Go to end range in each direction',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['wrist'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Forearm flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ew-4',
      name: 'Band Finger Extension',
      sets: 2,
      reps: '20 reps',
      cue: 'Loop band around fingers, spread against resistance - strengthens extensors to balance grip dominance and reduce lateral elbow load',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['wrist'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Forearm flexors',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  elbow: [
    {
      id: 'ph-r-ew-5',
      name: 'Forearm Supination / Pronation',
      sets: 2,
      reps: '15 each direction',
      cue: 'Elbow at 90°, slowly rotate palm up then down - radioulnar joint mobility and bicep tendon health',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['elbow', 'bicep', 'wrist'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Forearm flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-el-2',
      name: 'Eccentric Wrist Extension',
      sets: 3,
      reps: '12 each side',
      // Elbow prehab reaches every user, and this one used to arrive reading
      // "Light dumbbell 1-2 kg" for someone who owns none. A filled bottle is
      // the same one to two kilos.
      cue: 'Forearm resting on your thigh, palm down, holding a full water bottle. Lift it with your other hand, then lower it over 3 slow seconds - slow lowering is what builds the tendon back up',
      suggestedLoad: 'Full water bottle (1-2 kg)',
      category: 'prehab',
      targetRegions: ['elbow'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Wrist extensors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: true,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-el-3',
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
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: true,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-el-4',
      name: 'Elbow Flexion / Extension ROM',
      sets: 2,
      reps: '10 each side',
      cue: 'Straighten the elbow fully, then bend it as far as it goes, slowly. Restores the last few degrees at each end, which heavy pressing tends to take away',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['elbow'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Elbow joint',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: true,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-el-5',
      name: 'Pronator Self-Release',
      sets: 1,
      reps: '45s each side',
      cue: 'Thumb into the muscle just below the inner crease of the elbow, roll slowly along it. Eases the pull on the inner elbow that builds up from heavy gripping',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['elbow'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Pronator teres',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: true,
      injuryFriendlyAlternatives: [],
    },
  ],
  neck: [
    {
      id: 'ph-r-nk-1',
      name: 'Chin Tuck',
      sets: 3,
      reps: '10 reps, hold 3s each',
      cue: 'Gently retract chin straight back (not down) - feel a lengthening at the base of skull. Deep cervical flexor activation',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['neck', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Neck flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-nk-2',
      name: 'Neck Side Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Ear toward shoulder, opposite hand resting gently on head - never pull. Breathe slowly, feel upper trap and SCM lengthen',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['neck', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Neck flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-nk-3',
      name: 'Levator Scapulae Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Turn head 45°, tuck chin toward armpit, hand on back of head for gentle assist - targets the levator scapulae',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['neck', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Neck flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-nk-4',
      name: 'Upper Trap Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Sit, grip edge of chair, tilt head to opposite side - feel the upper trap lengthen. Keep shoulder down throughout',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['neck', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Neck flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-nk-5',
      name: 'Thoracic Cat-Cow',
      sets: 2,
      reps: '10 slow reps',
      cue: 'All fours, full spinal flexion and extension - frees cervicothoracic junction which contributes to neck loading',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['neck', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Thoracic extensors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  lower_back: [
    {
      id: 'ph-r-lb-1',
      name: 'Dead Bug',
      sets: 3,
      reps: '8 each side',
      cue: 'Low back pressed to floor throughout - reach opposite arm and leg, exhale fully at end. Anti-extension deep core',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['lower_back', 'core_ribs'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Core',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-lb-2',
      name: 'Bird Dog',
      sets: 3,
      reps: '8 each side, hold 3s',
      cue: 'All fours, extend opposite arm and leg - keep back flat (no hiking or rotating). Multifidus and lumbar stabilisers',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['lower_back', 'core_ribs'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Core',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-lb-3',
      name: 'Cat-Cow',
      sets: 2,
      reps: '10 slow cycles',
      cue: 'All fours - exhale into full flexion, inhale into extension. Move from the lumbar spine, slow and controlled',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['lower_back', 'core_ribs'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Core',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-lb-4',
      name: 'Hip Flexor Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'Deep lunge, back knee padded - tuck pelvis, breathe into hip flexor. Tight hip flexors drive anterior pelvic tilt and lower back pain',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['lower_back', 'hip_groin'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Hip flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-lb-5',
      name: 'Glute Bridge',
      sets: 3,
      reps: '15 reps, hold 2s at top',
      cue: 'Feet flat, push through heels - squeeze glutes at top, keep ribs down. Glute strength directly offloads lower back',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['glutes', 'lower_back', 'hip_groin', 'hamstrings'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glutes',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  upper_back: [
    {
      id: 'ph-r-ub-1',
      name: 'Band Pull-Apart',
      sets: 3,
      reps: '15 slow reps',
      cue: 'Arms at shoulder height, pull band to sternum - squeeze mid-traps and rhomboids for 1s. Scapular retraction pattern',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['upper_back', 'rear_shoulder', 'front_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rear deltoid',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ub-2',
      name: 'Thread-the-Needle Rotation',
      sets: 2,
      reps: '8 each side, hold 3s',
      cue: 'All fours, thread one arm under the body - breathe into the thoracic rotation. Go deeper with each breath',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['upper_back', 'rear_shoulder', 'lat_mid_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rhomboids',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ub-3',
      name: 'Book Opener (thoracic rotation)',
      sets: 2,
      reps: '8 each side',
      cue: 'Side-lying, knees stacked, sweep top arm to opposite side - follow with eyes, breathe into the stretch. T-spine rotation',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['upper_back', 'lat_mid_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Thoracic extensors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ub-4',
      name: 'Prone T-Spine Extension',
      sets: 2,
      reps: '10 slow reps',
      cue: 'Face down, arms in T shape - lift chest and arms slowly, hold 2s. Thoracic extensors and rear delt',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['upper_back', 'rear_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Thoracic extensors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ub-5',
      name: 'Wall Slide',
      sets: 2,
      reps: '10 slow reps',
      cue: 'Back flat on wall, arms overhead - keep full contact throughout the slide. Scapular upward rotation and serratus anterior',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['upper_back', 'front_shoulder', 'rear_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rotator cuff',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  core_ribs: [
    {
      id: 'ph-r-cr-1',
      name: 'Dead Bug',
      sets: 3,
      reps: '8 each side',
      cue: 'Low back stays glued to floor - reach and extend opposite limbs, exhale fully. TVA and anti-extension control',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['core_ribs', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Core',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-cr-2',
      name: 'Pallof Press (Isometric Hold)',
      sets: 3,
      reps: '20s each side',
      cue: 'Band at sternum height, press hands forward and hold - resist rotation, breathe. Anti-rotation oblique and TVA work',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['core_ribs', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Obliques',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-cr-3',
      name: 'McGill Side Plank',
      sets: 2,
      reps: '20s each side',
      cue: 'Elbow under shoulder, knees bent - lift hips into alignment, breathe normally. QL and oblique lateral stability',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['core_ribs', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Core',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-cr-4',
      name: 'Bird Dog',
      sets: 3,
      reps: '8 each side, hold 3s',
      cue: 'All fours, opposite arm and leg - keep spine perfectly neutral, no rotation. Deep core and multifidus',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['core_ribs', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Core',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-cr-5',
      name: 'Hollow Body Hold',
      sets: 3,
      reps: '20s',
      cue: 'On back, arms overhead, legs straight - press lower back to floor, lift shoulders and legs slightly. Full core compression',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['core_ribs'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Core',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  knee: [
    {
      id: 'ph-r-kn-1',
      name: 'Terminal Knee Extension (band)',
      sets: 3,
      reps: '15 each side',
      cue: 'Band behind knee, stand on one leg - straighten knee fully against band resistance, hold 1s. VMO isolation',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['knee', 'quads'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Quadriceps',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-kn-2',
      name: 'Slow Step-Down',
      sets: 3,
      reps: '10 each side',
      cue: 'Stand on step, lower opposite heel to floor in 3s - control the knee tracking. Eccentric quad and patella prehab',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Quadriceps',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-kn-3',
      name: 'VMO Wall Sit',
      sets: 3,
      reps: '30s',
      cue: 'Narrow stance, toes forward, 90° knee angle - hold, feel inner quad working. VMO and quad endurance',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Quadriceps',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-kn-4',
      name: 'Banded Clamshell',
      sets: 3,
      reps: '15 each side',
      cue: 'Band above knees, feet together - rotate top knee up, hold 1s, lower slowly. Glute med activation improves knee tracking',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['knee', 'hip_groin', 'glutes'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glute medius',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-kn-5',
      name: 'Quad Set (isometric)',
      sets: 2,
      reps: '10 reps, hold 10s each',
      cue: 'Lie flat, roll under knee - contract quad, press knee down, hold. Wakes VMO without load on the joint',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Quadriceps',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  hip_groin: [
    {
      id: 'ph-r-hg-1',
      name: 'Banded Clamshell',
      sets: 3,
      reps: '15 each side',
      cue: 'Band above knees, feet together - rotate top knee up, hold 1s, lower slowly. Glute med and external hip rotator activation',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['hip_groin', 'knee', 'glutes'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glute medius',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-hg-2',
      name: 'Copenhagen Adductor Hold',
      sets: 3,
      reps: '20s each side',
      cue: 'Top leg on chair or bench, bottom leg reaches - squeeze inner thigh to hold. Adductor strength and groin prehab',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['hip_groin', 'knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Adductors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-hg-3',
      name: 'Hip Flexor Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'Deep lunge, back knee padded, tuck pelvis - breathe into hip flexor. Anterior hip and iliopsoas length',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['hip_groin', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Hip flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-hg-4',
      name: 'Figure-4 Glute Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'On back, figure-4 position - breathe deeply, let hip open. Piriformis and external hip rotator prehab',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['hip_groin', 'lower_back', 'glutes'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glutes',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-hg-5',
      name: 'Lateral Band Walk',
      sets: 2,
      reps: '15 steps each direction',
      cue: 'Band around ankles, slight squat position - step sideways keeping toes forward. Glute med and hip abductor strength',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['hip_groin', 'knee', 'glutes'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glute medius',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  ankle_achilles: [
    {
      id: 'ph-r-aa-1',
      name: 'Heel Drop (eccentric)',
      sets: 3,
      reps: '15 each side',
      cue: 'Heels off step edge, lift on both then lower on one in 3-5s - slow lowering is what builds the tendon back up',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['ankle_achilles', 'calf_shin'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Calves',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-aa-2',
      name: 'Tibialis Raise',
      sets: 3,
      reps: '20 reps',
      cue: 'Heels on wall, lift toes and forefoot toward shin - slow and controlled. Shin splint prevention and dorsiflexion prehab',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['ankle_achilles', 'calf_shin'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Calves',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-aa-3',
      name: 'Single-Leg Balance',
      sets: 3,
      reps: '30s each side',
      cue: 'Stand on one leg, eyes open then close for extra challenge - proprioception and ankle stability. Small adjustments are normal',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['ankle_achilles'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Tibialis anterior',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: true,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-aa-4',
      name: 'Ankle Circles',
      sets: 2,
      reps: '10 each direction, each ankle',
      cue: 'Seated, foot off floor - slow full-range circles, reach maximum end range each direction. Joint lubrication',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['ankle_achilles'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Calves',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-aa-5',
      name: 'Calf Stretch (Wall)',
      sets: 2,
      reps: '45s each side',
      cue: 'Foot against base of wall, heel down - straight leg (gastroc) then bent knee (soleus). Both are needed for Achilles health',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['ankle_achilles', 'calf_shin'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Calves',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  calf_shin: [
    {
      id: 'ph-r-cs-1',
      name: 'Standing Calf Raise (slow eccentric)',
      sets: 3,
      reps: '15 reps (3s down)',
      cue: 'Rise to toes on both feet, lower on one in 3s - eccentric overload builds tendon and muscle resilience',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['calf_shin', 'ankle_achilles'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Calves',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-cs-2',
      name: 'Tibialis Raise',
      sets: 3,
      reps: '20 reps',
      cue: 'Heels on wall or ground, lift toes toward shin - tibialis anterior activation and shin splint prevention',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['calf_shin', 'ankle_achilles'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Calves',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-cs-3',
      name: 'Soleus Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'Against wall, knee bent, heel down - lean forward. Targets the deeper soleus, often missed in standard calf stretches',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['calf_shin', 'ankle_achilles'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Calves',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-cs-4',
      name: 'Single-Leg Calf Raise',
      sets: 3,
      reps: '12 each side',
      cue: 'One leg, full range - rise fully then lower slowly. Double the eccentric load on each calf compared to bilateral',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['calf_shin', 'ankle_achilles'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Calves',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: true,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-cs-5',
      name: 'Seated Toe Raise',
      sets: 2,
      reps: '20 reps',
      cue: 'Seated, heel on floor - lift toes and forefoot as high as possible. Tibialis anterior and anterior compartment',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['calf_shin'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Tibialis anterior',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  chest: [
    {
      id: 'ph-r-ch-1',
      name: 'Doorway Chest Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'Arm at 90°, step through doorway - breathe into the pec stretch, no pushing or forcing',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['chest', 'front_shoulder', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Pectorals',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ch-2',
      name: 'Incline Push-Up (slow)',
      sets: 3,
      reps: '10 slow reps',
      cue: 'Hands elevated on bench or step, 3s down - reduce chest stretch depth to manage soreness',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['chest', 'front_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Pectorals',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ch-3',
      name: 'Pec Minor Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'Arm at 120° in doorway - targets the pec minor specifically, breathe and relax',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['chest', 'front_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Pectorals',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ch-4',
      name: 'Band Pull-Apart',
      sets: 3,
      reps: '15 slow reps',
      cue: 'Arms straight at shoulder height - pull band to sternum, opens chest and counters pressing load',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['rear_shoulder', 'upper_back', 'front_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rear deltoid',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-ch-5',
      // Region prehab is served straight to the user with no equipment filter
      // in front of it, so a movement here has to work for everyone. This one
      // asked for a foam roller.
      name: 'Floor Angel',
      sets: 2,
      reps: '30s at each level',
      cue: 'Lie on your back, knees bent, arms out at shoulder height with the backs of the hands on the floor. Slide them slowly overhead and back, keeping hands, elbows and lower back in contact throughout - opens the chest after heavy pressing',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['chest', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Thoracic extensors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  bicep: [
    {
      id: 'ph-r-bi-1',
      name: 'Bicep Stretch (arm back)',
      sets: 2,
      reps: '45s each side',
      cue: 'Arm behind body, palm up, gentle shoulder extension - feel the bicep and anterior shoulder lengthen',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['bicep', 'front_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Biceps',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-bi-2',
      name: 'Forearm Supination / Pronation',
      sets: 2,
      reps: '15 each direction',
      cue: 'Elbow at 90°, slowly rotate palm up then down - bicep tendon health and radioulnar joint mobility',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['bicep', 'elbow', 'wrist'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Forearm flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-bi-3',
      name: 'Band Curl (light, high reps)',
      sets: 3,
      reps: '20 reps',
      cue: 'Light band, full range - slow eccentric. Keeps blood flowing without overloading the sore muscle',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['bicep', 'elbow', 'wrist'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Biceps',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-bi-4',
      name: 'Wrist Flexor Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Arm extended, palm up, gently pull fingers back - releases the flexors that share load with the bicep',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['elbow', 'wrist'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Forearm flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-bi-5',
      name: 'Cross-Body Shoulder Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Pull arm across chest - rear deltoid and bicep long head decompression',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['bicep', 'rear_shoulder', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Deltoids',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  tricep: [
    {
      id: 'ph-r-tr-1',
      name: 'Overhead Tricep Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'Arm overhead, bend elbow, push with opposite hand - feel the long head of the tricep lengthen',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['tricep', 'elbow', 'wrist'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Triceps',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-tr-2',
      name: 'Cross-Body Tricep Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Pull bent arm across chest - targets the lateral and medial head of the tricep',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['tricep', 'rear_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Triceps',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-tr-3',
      name: 'Band Pushdown (light, high reps)',
      sets: 3,
      reps: '20 reps',
      cue: 'Light band, elbows pinned - full extension, slow release. Active recovery for the tricep without loading',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['tricep', 'elbow', 'wrist'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Triceps',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-tr-4',
      name: 'Wrist Extensor Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Arm extended, palm down, pull fingers toward you - releases lateral elbow and tricep tendon area',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['elbow', 'wrist'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Forearm flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-tr-5',
      name: 'Wall Angel',
      sets: 2,
      reps: '10 slow reps',
      cue: 'Back flat on wall, slide arms up and down - scapular and elbow mobility to relieve tricep loading',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['tricep', 'rear_shoulder', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Lower trapezius',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  quads: [
    {
      id: 'ph-r-qu-1',
      name: 'Standing Quad Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'Hand on wall, pull heel to glute - breathe into the front thigh stretch, keep knees together',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['quads', 'knee', 'hip_groin'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Quadriceps',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-qu-2',
      name: 'Terminal Knee Extension (band)',
      sets: 3,
      reps: '15 each side',
      cue: 'Band behind knee, straighten fully against resistance, hold 1s - VMO and quad activation without deep bend',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['quads', 'knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Quadriceps',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-qu-3',
      name: 'Slow Step-Down (eccentric)',
      sets: 3,
      reps: '10 each side',
      cue: 'Stand on step, lower heel to floor in 3s - eccentric quad loading with minimal volume',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['quads', 'knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Quadriceps',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-qu-4',
      name: 'Couch Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'Rear foot on couch or wall, kneeling lunge - deep quad and hip flexor stretch for post-training soreness',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['quads', 'hip_groin'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Hip flexors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-qu-5',
      name: 'Isometric Wall Sit',
      sets: 2,
      reps: '30s',
      cue: 'Thighs parallel, back flat - hold, breathe. Isometric quad load without the eccentric stress',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['quads', 'knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Quadriceps',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  hamstrings: [
    {
      id: 'ph-r-hm-1',
      name: 'Standing Hamstring Stretch',
      sets: 2,
      reps: '45s each side',
      cue: 'Foot on low surface, hinge forward - feel the posterior chain lengthen, no rounding of the spine',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['hamstrings', 'lower_back', 'hip_groin'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Hamstrings',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-hm-2',
      name: 'Supine Hamstring Stretch (Strap)',
      sets: 2,
      reps: '45s each side',
      cue: 'Lie on back, loop towel around foot - straighten knee until gentle tension, hold and breathe',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['hamstrings', 'knee', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Hamstrings',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-hm-3',
      name: 'Nordic Curl Negative (slow)',
      sets: 3,
      reps: '5 reps',
      // Graded on purpose. This is the hardest eccentric there is, and the
      // person reading it has told us their hamstring hurts — so the range is
      // theirs to choose and the easier version is one tap away.
      cue: 'Ankles secured, lower forward only as far as you can still control - hands down to catch yourself, then push back up. A quarter of the range done well beats a full rep you drop through',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['hamstrings', 'knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Hamstrings',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'advanced',
      isUnilateral: false,
      injuryFriendlyAlternatives: ['Sliding Leg Curl'],
      swapAlternative: {
        name: 'Sliding Leg Curl',
        cue: 'On your back, heels on a towel or socks on a smooth floor - bridge the hips up, slide the heels out slowly, then drag them back in. Same eccentric, a fraction of the load',
        suggestedLoad: 'Bodyweight',
      },
    },
    {
      id: 'ph-r-hm-4',
      name: 'Hip Hinge Against Wall',
      sets: 3,
      reps: '15 slow reps',
      cue: 'Hands on wall, push hips back - feel hamstring stretch at bottom, drive glutes to stand. Deload version of RDL',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['hamstrings', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Hamstrings',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-hm-5',
      name: 'Pigeon Pose',
      sets: 2,
      reps: '45s each side',
      cue: 'Front shin horizontal, breathe into outer hip - releases hip external rotators which assist hamstring function',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['hip_groin', 'lower_back', 'glutes'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glutes',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  glutes: [
    {
      id: 'ph-r-gl-1',
      name: 'Banded Clamshell',
      sets: 3,
      reps: '15 each side',
      cue: 'Band above knees, feet together - rotate top knee up, hold 1s, lower slowly. Glute med activation',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['glutes', 'hip_groin', 'knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glute medius',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-gl-2',
      name: 'Glute Bridge (isometric hold)',
      sets: 3,
      reps: '10 reps, 5s hold each',
      cue: 'Push through heels, squeeze glutes hard at top - isometric loading without the soreness-inducing eccentric',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['glutes', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glutes',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-gl-3',
      name: 'Pigeon Pose',
      sets: 2,
      reps: '60s each side',
      cue: 'Front shin horizontal, breathe deeply - releases the piriformis and deep external rotators of the glute',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['glutes', 'hip_groin', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glutes',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-gl-4',
      name: 'Lateral Band Walk',
      sets: 2,
      reps: '15 steps each direction',
      cue: 'Band around ankles, slight squat position - step sideways, toes forward. Glute med and lateral chain',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['glutes', 'hip_groin', 'knee'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glute medius',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-gl-5',
      name: 'Single-Leg Glute Bridge',
      sets: 2,
      reps: '10 each side',
      cue: 'One foot planted, other knee hugged in - drive through the heel until the hips are level, hold a beat at the top and lower slowly',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['glutes', 'hip_groin', 'hamstrings', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Glutes',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
  lat_mid_back: [
    {
      id: 'ph-r-lm-1',
      name: "Child's Pose with Side Reach",
      sets: 2,
      reps: '45s each side',
      cue: "From child's pose, walk hands to one side - feel the lat and QL stretch on the opposite side",
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['lat_mid_back', 'lower_back', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Latissimus dorsi',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-lm-2',
      name: 'Thread-the-Needle Rotation',
      sets: 2,
      reps: '8 each side, hold 3s',
      cue: 'All fours, thread arm under body - thoracic rotation that releases mid-back and lat tension',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['lat_mid_back', 'upper_back', 'rear_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rhomboids',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-lm-3',
      name: 'Band Pull-Apart',
      sets: 3,
      reps: '15 slow reps',
      cue: 'Arms at shoulder height, pull band to sternum - mid-trap and rhomboid activation to balance lat soreness',
      suggestedLoad: 'Light band',
      category: 'prehab',
      targetRegions: ['rear_shoulder', 'upper_back', 'front_shoulder'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Rear deltoid',
      secondaryMuscles: [],
      equipmentRequired: 'resistance bands',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-lm-4',
      name: 'Book Opener (thoracic rotation)',
      sets: 2,
      reps: '8 each side',
      cue: 'Side-lying, knees stacked, sweep top arm back - breathe into the stretch, T-spine rotation and lat release',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['lat_mid_back', 'upper_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Thoracic extensors',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
    {
      id: 'ph-r-lm-5',
      name: 'Doorway Lat Stretch',
      sets: 2,
      reps: '30s each side',
      cue: 'Grip doorframe at hip height, sit back and lean away - direct lat lengthening after pulling work',
      suggestedLoad: 'Bodyweight',
      category: 'prehab',
      targetRegions: ['lat_mid_back', 'lower_back'],
      videoId: '',
      movementPattern: 'rehabilitation',
      primaryMuscle: 'Latissimus dorsi',
      secondaryMuscles: [],
      equipmentRequired: 'bodyweight',
      difficulty: 'beginner',
      isUnilateral: false,
      injuryFriendlyAlternatives: [],
    },
  ],
};

/**
 * Regions whose rehab work genuinely overlaps.
 *
 * Some regions have only a handful of exercises tagged for them, and topping a
 * session up from whatever else is lying around is how elbow rehab ended up
 * containing a thoracic rotation and a hip stretch. Every pair listed here
 * shares a muscle or a joint complex — the forearm muscles cross both the elbow
 * and the wrist, the calf and the Achilles are one unit, the biceps and triceps
 * long heads cross the shoulder — so work borrowed from a neighbour still lands
 * on the structure that hurts. Anything not listed is not a neighbour.
 */
export const PREHAB_RELATED_REGIONS: Record<PainRegion, PainRegion[]> = {
  front_shoulder: ['rear_shoulder', 'chest', 'bicep'],
  rear_shoulder: ['front_shoulder', 'upper_back', 'tricep'],
  elbow: ['wrist', 'bicep', 'tricep'],
  wrist: ['elbow'],
  neck: ['upper_back'],
  upper_back: ['neck', 'rear_shoulder', 'lat_mid_back'],
  lat_mid_back: ['upper_back', 'lower_back'],
  lower_back: ['core_ribs', 'glutes', 'lat_mid_back'],
  core_ribs: ['lower_back'],
  chest: ['front_shoulder'],
  bicep: ['elbow', 'front_shoulder'],
  tricep: ['elbow', 'rear_shoulder'],
  hip_groin: ['glutes', 'quads'],
  glutes: ['hip_groin', 'hamstrings', 'lower_back'],
  knee: ['quads', 'hamstrings'],
  quads: ['knee', 'hip_groin'],
  hamstrings: ['knee', 'glutes'],
  calf_shin: ['ankle_achilles'],
  ankle_achilles: ['calf_shin'],
};

/**
 * Extra work a targeted session can rotate in, still aimed at the injured area.
 *
 * `direct` is tagged for the region itself; `related` is tagged for one of its
 * neighbours and exists because several regions — elbow and wrist especially —
 * have no spare exercises of their own, and a session that never changes is one
 * nobody finishes six weeks of. Callers take from `direct` first and only reach
 * into `related` to fill what is left, so a region with plenty of its own work
 * never borrows.
 *
 * Drawn from the whole rehab library rather than the standalone pool: that pool
 * holds nothing whatsoever for an elbow or a wrist, which is precisely why the
 * session used to reach for a shoulder or a hip exercise instead.
 */
export function getRegionPrehabSupplements(region: PainRegion): {
  direct: ExerciseTemplate[];
  related: ExerciseTemplate[];
} {
  // Cased loosely on purpose. The two lists are edited independently and have
  // drifted apart on capitalisation before; showing the same stretch twice in
  // one session because of a capital letter reads as a mistake.
  const seen = new Set(
    [...PREHAB_BY_REGION[region], PREHAB_COOLDOWN_BY_REGION[region]].map((e) =>
      e.name.toLowerCase()
    )
  );
  const direct: ExerciseTemplate[] = [];
  const related: ExerciseTemplate[] = [];
  for (const t of [...STANDALONE_PREHAB, ...Object.values(PREHAB_BY_REGION).flat()]) {
    if (t.category !== 'prehab' || seen.has(t.name.toLowerCase())) continue;
    seen.add(t.name.toLowerCase());
    if (t.targetRegions.includes(region)) direct.push(t);
    else if (PREHAB_RELATED_REGIONS[region].some((r) => t.targetRegions.includes(r)))
      related.push(t);
  }
  return { direct, related };
}

// Reuse the same exercise object STANDALONE_PREHAB already defines, rather
// than redeclaring it, so a future edit to one can't silently drift from
// the other.
const PREHAB_WARMUP: ExerciseTemplate = STANDALONE_PREHAB.find((e) => e.id === 'ph-s-1')!;

/**
 * Options for the region-targeted rehab work.
 *
 * `acute` means the region was named because it HURTS — either the user picked
 * it on the Restore tab, or they reported pain there on the readiness screen.
 * It routes the whole block to lib/acute-rehab.ts, where nothing stretches the
 * injured tissue and nothing loads it hard. See that file for what was going
 * wrong before it existed.
 */
export interface PrehabOptions {
  acute?: boolean;
}

/**
 * The targeted session for one body region.
 *
 * ACUTE PATH — no cooldown, and no supplements either (see the engine).
 * Both are stretching by design: every entry in PREHAB_COOLDOWN_BY_REGION is a
 * long passive hold, and the supplement pool is drawn from the whole rehab
 * library, which is how a hamstring session could rotate a Pigeon Pose back in
 * through the side door. The acute protocols are complete as written and are
 * ordered gentlest first, so they are not shuffled either — the order is the
 * progression.
 */
export function getRegionPrehabWorkout(
  region: PainRegion,
  opts: PrehabOptions = {}
): ExerciseTemplate[] {
  if (opts.acute) return [PREHAB_WARMUP, ...ACUTE_PREHAB_BY_REGION[region]];
  return [PREHAB_WARMUP, ...PREHAB_BY_REGION[region], PREHAB_COOLDOWN_BY_REGION[region]];
}

/**
 * The single rehab movement dropped into a strength session.
 *
 * This is the one that mattered most and was hardest to see. A user who reported
 * hamstring pain on the readiness screen got their normal training session with
 * `PREHAB_BY_REGION.hamstrings[0]` appended — a Standing Hamstring Stretch, 45
 * seconds a side, on a muscle they had just told the app was hurt. Same for the
 * quads (Standing Quad Stretch), the chest (Doorway Chest Stretch), the biceps
 * (end-range shoulder extension) and the Achilles (an eccentric heel drop).
 *
 * The acute list leads with its gentlest exercise deliberately, so taking the
 * first entry is still the right rule — it now yields an isometric.
 *
 * Undefined when the region's list is empty, and the session then goes without
 * its rehab slot rather than failing to build. See tests/empty-pools.check.mjs.
 */
export function getRegionPrehabExercise(
  region: PainRegion,
  opts: PrehabOptions = {}
): ExerciseTemplate | undefined {
  if (opts.acute) return ACUTE_PREHAB_BY_REGION[region][0];
  return PREHAB_BY_REGION[region][0];
}

// ─── STANDALONE FLEXIBILITY SESSION ──────────────────────────────────────────
// Long-hold stretching and mobility. No equipment needed.
//
// WHY THE MIDDLE IS FILED AS 'prehab' AND NOT 'cooldown'
// ──────────────────────────────────────────────────────
// `category` is what the session card prints as its badge. Every stretch here
// used to be filed 'cooldown', so a ten-card flexibility session rendered as
// one "Warm-Up" followed by nine "Cool Down" — nothing in it was labelled as
// the work, and scrolling it read as a session that ended before it started.
//
// 'prehab' is not a new idea invented here: nine of these fourteen stretches
// are ALREADY filed 'prehab' where they appear in PREHAB_BY_REGION, and the
// standalone prehab session next door is built from exactly this shape —
// prep bookend, a body of 'prehab' work, cooldown bookend. The flexibility
// pool was the outlier, and it was the outlier in the direction that made the
// session unreadable.
//
// The two bookends keep their categories: the session opens on breathing and
// closes on legs-up-the-wall, and those genuinely are a warm-up and a cool
// down. The engine slices this array by POSITION (first / last / middle), so
// the rotating pool must stay category-homogeneous or a stray "Warm-Up" badge
// would surface halfway down the list on even days.

const STANDALONE_FLEXIBILITY: ExerciseTemplate[] = [
  // ── Warmup bookend (always first) ────────────────────────────────────────
  {
    id: 'fl-s-1',
    name: 'Diaphragmatic Breathing',
    sets: 1,
    reps: '10 deep breaths',
    cue: 'Lie on back, hands on belly - breathe in for 4s, out for 6s. Activate parasympathetic system before stretching',
    suggestedLoad: 'Bodyweight',
    category: 'prep',
    targetRegions: [],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Diaphragm',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  // ── Middle pool (shuffled each session — 8 of 14 picked) ─────────────────
  {
    id: 'fl-s-2',
    name: 'Hip Flexor Kneeling Stretch',
    sets: 2,
    reps: '45s each side',
    cue: 'Deep lunge, back knee padded - tuck pelvis, hold for duration. Desk worker hip flexor release',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['hip_groin', 'lower_back', 'quads'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Hip flexors',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-3',
    name: 'Doorway Chest Opener',
    sets: 2,
    reps: '45s each side',
    cue: 'Arm at 90°, step through doorway - breathe deeply into the pec stretch. Undo desk posture',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['front_shoulder', 'upper_back', 'chest'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Pectorals',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-4',
    name: 'Thread-the-Needle Rotation',
    sets: 2,
    reps: '6 each side, hold 3s',
    cue: 'All fours, thread one arm under body - feel thoracic rotation, breathe and settle deeper',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['upper_back', 'rear_shoulder', 'lat_mid_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Rhomboids',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-5',
    name: 'Pigeon Pose',
    sets: 2,
    reps: '60s each side',
    cue: 'Front shin as horizontal as comfortable - relax all weight into the pose, breathe through outer hip tension',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['hip_groin', 'lower_back', 'glutes'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Glutes',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-6',
    name: 'Supine Hamstring Stretch (Strap)',
    sets: 2,
    reps: '45s each leg',
    cue: 'Lie on back, loop towel or strap around foot - straighten knee until gentle tension. No forcing',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['knee', 'lower_back', 'hamstrings'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Hamstrings',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-7',
    name: "Child's Pose with Side Reach",
    sets: 2,
    reps: '30s each side',
    cue: "From child's pose, walk hands to one side - feel the lat and QL stretch on the opposite hip",
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['lower_back', 'upper_back', 'lat_mid_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Latissimus dorsi',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-8',
    name: 'Calf Stretch (Wall)',
    sets: 2,
    reps: '45s each side',
    cue: 'Foot against base of wall, heel down, lean in - straight-leg then bent-knee for soleus',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['ankle_achilles', 'calf_shin'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Calves',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-9',
    name: 'Neck Side Stretch',
    sets: 2,
    reps: '30s each side',
    cue: 'Ear to shoulder, gentle hand pressure - do not pull. Breathe slowly, hold without bouncing',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['neck', 'upper_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Neck flexors',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-11',
    name: 'Figure-4 Glute Stretch',
    sets: 2,
    reps: '45s each side',
    cue: 'Lie on back, cross ankle over opposite knee, pull thigh toward chest - gentle outer hip and piriformis release',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['hip_groin', 'lower_back', 'glutes'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Glutes',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-12',
    name: 'Standing Quad Stretch',
    sets: 2,
    reps: '45s each side',
    cue: 'Stand on one leg, pull heel to glute - keep knees together and stand tall. Wall for balance if needed',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['knee', 'hip_groin', 'quads'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Quadriceps',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-13',
    name: 'Seated Forward Fold',
    sets: 2,
    reps: '60s',
    cue: 'Sit with legs straight, hinge from hips (not rounding the back) and reach toward feet. Breathe and settle with each exhale',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['knee', 'lower_back', 'hamstrings'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Hamstrings',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-14',
    // Renamed for what it is. "Thoracic Extension (Floor)" and "Thoracic
    // Extension on Floor" sat in the picker as two rows a punctuation mark
    // apart, and they are NOT the same movement: that one is supine with the
    // arms overhead, this one is prone and lifts the chest off the floor. Two
    // names close enough to be read as a typo, describing two different things,
    // is the worst version of this problem — a user picking one gets the other.
    name: 'Prone Thoracic Extension',
    sets: 2,
    reps: '10 reps, hold 2s at top',
    cue: 'Lie face down, arms by sides - gently lift chest off floor using mid-back muscles only. Relieves thoracic stiffness',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['upper_back', 'rear_shoulder'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Thoracic extensors',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-15',
    name: 'Cross-Body Shoulder Stretch',
    sets: 2,
    reps: '30s each side',
    cue: 'Pull one arm across chest with the opposite forearm - feel the rear delt and upper back. Relax the shoulder down',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['rear_shoulder', 'upper_back', 'bicep'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Posterior deltoid',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  {
    id: 'fl-s-16',
    name: 'Supine Spinal Twist',
    sets: 2,
    reps: '45s each side',
    cue: 'Lie on back, draw one knee across body to the floor - keep both shoulders grounded. Breathe and let gravity do the work',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    targetRegions: ['lower_back', 'upper_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Spinal rotators',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
  // ── Cooldown bookend (always last) ───────────────────────────────────────
  {
    id: 'fl-s-10',
    name: 'Legs-Up-The-Wall',
    sets: 1,
    reps: '2 min',
    cue: 'Legs vertical against wall, arms relaxed - close eyes and breathe. Full body recovery and circulation',
    suggestedLoad: 'Bodyweight',
    category: 'cooldown',
    targetRegions: ['ankle_achilles', 'lower_back'],
    videoId: '',
    movementPattern: 'mobility',
    primaryMuscle: 'Hip external rotators',
    secondaryMuscles: [],
    equipmentRequired: 'bodyweight',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  },
];

export function getStandaloneFlexibilityWorkout(): ExerciseTemplate[] {
  return STANDALONE_FLEXIBILITY;
}

// ─── TARGETED REHAB COOLDOWNS ─────────────────────────────────────────────────
// Lives below the stretch pool because it reuses those objects; it is read from
// getRegionPrehabWorkout() above, which only runs once the module is loaded.

// The stretch pool has nothing for a forearm or an upper arm, so a targeted
// session for those regions had nothing relevant to end on.
const FOREARM_COOLDOWN: ExerciseTemplate = {
  id: 'ph-c-1',
  name: 'Forearm Flexor & Extensor Stretch',
  sets: 1,
  reps: '30s each way, each arm',
  cue: 'Arm straight out, palm up - pull fingers down and back, then flip the palm down and repeat. Elbow stays locked out',
  suggestedLoad: 'Bodyweight',
  category: 'cooldown',
  targetRegions: ['elbow', 'wrist', 'bicep'],
  videoId: '',
  movementPattern: 'mobility',
  primaryMuscle: 'Forearms',
  secondaryMuscles: [],
  equipmentRequired: 'bodyweight',
  difficulty: 'beginner',
  isUnilateral: true,
  injuryFriendlyAlternatives: [],
};

const SIDE_BEND_COOLDOWN: ExerciseTemplate = {
  id: 'ph-c-2',
  name: 'Side-Bend Overhead Reach',
  sets: 1,
  reps: '40s each side',
  cue: 'Reach one arm overhead and lean away - lengthen from the hip all the way to the fingertips, ribs down',
  suggestedLoad: 'Bodyweight',
  category: 'cooldown',
  targetRegions: ['tricep', 'lat_mid_back', 'rear_shoulder'],
  videoId: '',
  movementPattern: 'mobility',
  primaryMuscle: 'Latissimus dorsi',
  secondaryMuscles: [],
  equipmentRequired: 'bodyweight',
  difficulty: 'beginner',
  isUnilateral: true,
  injuryFriendlyAlternatives: [],
};

/**
 * A flexibility-pool stretch, refiled as the cool-down of a targeted rehab
 * session.
 *
 * The same stretch plays two roles. In the flexibility session it is the WORK,
 * which is why the pool files it as 'prehab'; here it is how a rehab session
 * ENDS, and the engine finds that ending by asking for `category === 'cooldown'`.
 * Returning the pool object unchanged would have silently emptied the cool-down
 * slot of eleven of the nineteen regions the moment the pool was refiled.
 *
 * A distinct id, not a shared one: `getExerciseCategoryMap()` is keyed by id,
 * so one id carrying two categories would make that map depend on walk order —
 * the exact defect this pass exists to remove. The name is untouched, so no
 * logged history splits, and FOREARM_COOLDOWN below is the same idea written
 * out longhand.
 */
const flexStretch = (name: string): ExerciseTemplate => {
  const base = STANDALONE_FLEXIBILITY.find((e) => e.name === name)!;
  return { ...base, id: `${base.id}-cooldown`, category: 'cooldown' };
};

/**
 * How a targeted rehab session ends, region by region.
 *
 * There used to be one cooldown for all of them — a supine hip 90/90 — so elbow
 * rehab, wrist rehab and neck rehab all finished with a hip stretch. A cooldown
 * has to reach the structure that was just worked, or it is only making the
 * session longer.
 *
 * None of these repeats a movement the region already trains: the same stretch
 * twice in one session reads as a bug, so where the obvious choice was already
 * in the region's own list the next-best stretch for that structure is used.
 */
const PREHAB_COOLDOWN_BY_REGION: Record<PainRegion, ExerciseTemplate> = {
  front_shoulder: flexStretch('Doorway Chest Opener'),
  rear_shoulder: flexStretch('Thread-the-Needle Rotation'),
  chest: flexStretch('Doorway Chest Opener'),
  elbow: FOREARM_COOLDOWN,
  wrist: FOREARM_COOLDOWN,
  bicep: FOREARM_COOLDOWN,
  tricep: SIDE_BEND_COOLDOWN,
  neck: flexStretch('Prone Thoracic Extension'),
  upper_back: flexStretch('Prone Thoracic Extension'),
  lat_mid_back: SIDE_BEND_COOLDOWN,
  lower_back: flexStretch('Supine Spinal Twist'),
  core_ribs: flexStretch("Child's Pose with Side Reach"),
  hip_groin: flexStretch('Pigeon Pose'),
  glutes: flexStretch('Figure-4 Glute Stretch'),
  quads: flexStretch('Hip Flexor Kneeling Stretch'),
  hamstrings: flexStretch('Seated Forward Fold'),
  knee: flexStretch('Standing Quad Stretch'),
  calf_shin: flexStretch('Calf Stretch (Wall)'),
  ankle_achilles: flexStretch('Legs-Up-The-Wall'),
};

/**
 * EVERYTHING THE RESTORE TAB ITSELF PRESCRIBES, AND NOTHING ELSE.
 *
 * Restore builds its sessions out of five lists and no others: the standalone
 * joint-health circuit, the long-hold stretch session, the per-region rehab
 * work, the gentle stretch each region finishes on, and the acute protocols.
 * That is the whole of it - `getStandalonePrehabWorkout`,
 * `getStandaloneFlexibilityWorkout` and `getRegionPrehabWorkout` between them
 * read these five and nothing more.
 *
 * WHY IT IS COLLECTED HERE RATHER THAN INFERRED. The swap sheet is filled from
 * `getAllPickableExercises`, which deep-walks every collection in this file,
 * Train pools included. On a Restore session that meant a fifth of the filled
 * swap slots offered something Restore does not prescribe: measured across
 * 2,800 Restore sessions, 7,392 of 37,366 - a Diaphragmatic Breathing card in
 * the Mobility session offering a Med Ball Slam, an Assault Bike warm-up behind
 * a rehab drill, a Tib Raise out of the Train prehab slot. The cards themselves
 * were always clean. It was one tap behind them that leaked.
 *
 * Asked as "does this exercise have a Restore row", by name, because that is
 * the question the leak is - and because a handful of Restore movements are
 * filed under a Train template by `getAllPickableExercises` (first name wins),
 * so asking by id would quietly drop them from their own tab.
 *
 * Memoised: the lists are module constants and the answer cannot change.
 */
let _restoreCache: ExerciseTemplate[] | null = null;
export function getRestoreExercises(): ExerciseTemplate[] {
  if (_restoreCache) return _restoreCache;
  const byName = new Map<string, ExerciseTemplate>();
  const add = (t: ExerciseTemplate) => {
    const key = t.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, t);
  };
  for (const t of STANDALONE_PREHAB) add(t);
  for (const t of STANDALONE_FLEXIBILITY) add(t);
  for (const list of Object.values(PREHAB_BY_REGION)) for (const t of list) add(t);
  for (const t of Object.values(PREHAB_COOLDOWN_BY_REGION)) add(t);
  for (const list of Object.values(ACUTE_PREHAB_BY_REGION)) for (const t of list) add(t);
  _restoreCache = [...byName.values()];
  return _restoreCache;
}

/**
 * Every pool a session generator reads from, by name.
 *
 * FOR tests/empty-pools.check.mjs, NOT FOR THE APP. That check empties each
 * pool in turn, in memory, and builds every kind of session to prove none of
 * them crashes or shows a blank card - because a read of an empty pool used to
 * throw and take the whole session with it. It can only empty what it can
 * reach, so a new pool that a generator reads belongs in this list too.
 *
 * WHAT IS LEFT ON IT IS RESTORE, and that is the point. It was twenty-two
 * entries and eighteen of them were the old Train catalogue, which the library
 * replaced. The library and the nine conditioning records are not here on
 * purpose: they are not pools that can be empty in the sense this list means.
 * A pool here is a cell keyed by session type and equipment tier that a
 * generator indexes into blind; the library builders ask their own list what it
 * holds, report an honest gap when it holds nothing, and are held to that by
 * tests/train-library.check.mjs and tests/library-conditioning.check.mjs.
 *
 * The same arrays, not copies. Nothing in the app should read or change them
 * through here; the accessors above are the way in.
 *
 * Not listed: PREHAB_COOLDOWN_BY_REGION, which holds one exercise per cell
 * rather than a pool, so there is nothing to empty.
 */
export const SESSION_POOLS = {
  COOLDOWN,
  STANDALONE_PREHAB,
  STANDALONE_FLEXIBILITY,
  PREHAB_BY_REGION,
  ACUTE_PREHAB_BY_REGION,
};

export interface PickableExercise {
  template: ExerciseTemplate;
  /**
   * Equipment tiers this exercise appears under. An exercise found outside any
   * tier-keyed collection (cooldowns, standalone mobility) needs no equipment
   * and is marked as available in all tiers.
   */
  tiers: InternalTier[];
}

/** Ordering for the picker: what you build a session around comes first. */
const PICKER_CATEGORY_ORDER: Record<string, number> = {
  main: 0,
  accessory: 1,
  mechanical: 2,
  neuro: 3,
  prep: 4,
  finisher: 5,
  cardio: 6,
  prehab: 7,
  cooldown: 8,
};

let _pickableCache: PickableExercise[] | null = null;

/**
 * Every exercise a user can put in a custom session.
 *
 * This used to take a single EquipmentTier, collapse it through
 * toInternalTier(), and read only MAIN_LIFTS / ACCESSORIES / PREHAB_BY_REGION
 * for that one tier. Two things fell out of that:
 *
 *   - A Full Gym user saw only fullgym variants — no dumbbell or bodyweight
 *     movements at all, even though they can obviously do them. 41 dumbbell
 *     and 44 bodyweight exercises were unreachable.
 *   - Whole collections were never walked: conditioning, mobility, cooldowns,
 *     warm-ups, finishers and the weekly-session pools. Of 461 exercise names
 *     in the database only 130 could be reached, and 247 could not be reached
 *     by any user on any tier.
 *
 * It now deep-walks every collection and reports the tiers each exercise
 * belongs to, so the picker can show everything and filter by equipment rather
 * than silently hiding most of the database.
 *
 * ORM_TEST is deliberately excluded — those are 1RM testing protocols from the
 * retired test-week flow, not movements to drop into a session. The table is
 * kept so the exercises a past test week logged still resolve to a name on the
 * history screens; nothing builds a session out of it any more.
 */
export function getAllPickableExercises(): PickableExercise[] {
  if (_pickableCache) return _pickableCache;

  const byName = new Map<string, PickableExercise>();

  const add = (t: ExerciseTemplate, tier: InternalTier | null) => {
    const existing = byName.get(t.name);
    if (existing) {
      // Same movement offered under another tier — widen its availability
      // rather than listing it twice.
      if (tier && !existing.tiers.includes(tier)) existing.tiers.push(tier);
      return;
    }
    byName.set(t.name, { template: t, tiers: tier ? [tier] : [...INTERNAL_TIERS] });
  };

  const walk = (node: unknown, tier: InternalTier | null) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child, tier);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      typeof obj.category === 'string'
    ) {
      add(obj as unknown as ExerciseTemplate, tier);
      return;
    }
    // The collections nest tier-keyed records at varying depths. Detect one and
    // carry its tier down, so an exercise is tagged with the equipment it was
    // filed under regardless of how deeply it sits.
    const keys = Object.keys(obj);
    const isTierMap =
      keys.length > 0 && keys.every((k) => (INTERNAL_TIERS as string[]).includes(k));
    for (const k of keys) walk(obj[k], isTierMap ? (k as InternalTier) : tier);
  };

  walk(
    [
      /**
       * ARCHIE'S LIBRARY, HIS NINE, AND WHAT RESTORE PRESCRIBES. THAT IS ALL.
       *
       * This list used to be twenty collections long, and everything but the last
       * few was the old Train catalogue: MAIN_LIFTS, ACCESSORIES, PREP,
       * MECHANICAL, NEURO, the two POWER pools, FINISHERS, the four CONDITIONING
       * pools, GOAL_CONDITIONING_BLOCKS, ORM_TEST and the three WEEKLY tables.
       * Every session type they fed is built from the library now, so a collection
       * left in this walk would put deleted movements back into the app through
       * the side door: the swap sheet, the injury screen's forced substitutions,
       * the muscle maps, the video status document and the count on the paywall
       * all read one of these walks.
       *
       * tests/library-only.check.mjs holds this to exactly the three lists, by
       * name and in both directions: nothing reachable that has no record, and no
       * record that cannot be reached.
       */
      LIBRARY_EXERCISES,
      CONDITIONING_EXERCISES,
      STANDALONE_PREHAB,
      STANDALONE_FLEXIBILITY,
      PREHAB_BY_REGION,
      ACUTE_PREHAB_BY_REGION,
      PREHAB_WARMUP,
      PREHAB_COOLDOWN_BY_REGION,
      COOLDOWN,
    ],
    null
  );

  const results = [...byName.values()];

  // Where the filing and the declared kit disagreed, the filing used to win.
  // That is how a Cardio Machine Warm-Up — filed in a flat list, so recorded as
  // available at every tier — stayed on the menu for someone with no equipment,
  // and got handed to them by the injury screen as a "safe" substitute for a
  // jump rope. Availability is the stricter of the two facts.
  for (const p of results) {
    const need = INTERNAL_TIERS.indexOf(tierRequiredFor(p.template.equipmentRequired));
    const owned = p.tiers.filter((t) => INTERNAL_TIERS.indexOf(t) >= need);
    p.tiers = owned.length > 0 ? owned : INTERNAL_TIERS.slice(need);
  }

  results.sort((a, b) => {
    const oa = PICKER_CATEGORY_ORDER[a.template.category] ?? 99;
    const ob = PICKER_CATEGORY_ORDER[b.template.category] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.template.name.localeCompare(b.template.name);
  });

  _pickableCache = results;
  return results;
}

let _categoryMapCache: Record<string, ExerciseCategory> | null = null;
let _targetRegionsMapCache: Record<string, PainRegion[]> | null = null;
let _nameMapCache: Record<string, string> | null = null;
let _regionsByNameCache: Record<string, PainRegion[]> | null = null;

/**
 * Build a flat { exerciseId -> category } lookup by deep-walking every exercise
 * collection in this module. Robust to the nested DB shape: any object that has
 * both a string `id` and a string `category` is recorded. Memoized.
 */
export function getExerciseCategoryMap(): Record<string, ExerciseCategory> {
  if (_categoryMapCache) return _categoryMapCache;

  const map: Record<string, ExerciseCategory> = {};
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.id === 'string' && typeof obj.category === 'string') {
      map[obj.id] = obj.category as ExerciseCategory;
    }
    for (const key of Object.keys(obj)) walk(obj[key]);
  };

  walk([
    /**
     * ARCHIE'S LIBRARY, HIS NINE, AND WHAT RESTORE PRESCRIBES. THAT IS ALL.
     *
     * This list used to be twenty collections long, and everything but the last
     * few was the old Train catalogue: MAIN_LIFTS, ACCESSORIES, PREP,
     * MECHANICAL, NEURO, the two POWER pools, FINISHERS, the four CONDITIONING
     * pools, GOAL_CONDITIONING_BLOCKS, ORM_TEST and the three WEEKLY tables.
     * Every session type they fed is built from the library now, so a collection
     * left in this walk would put deleted movements back into the app through
     * the side door: the swap sheet, the injury screen's forced substitutions,
     * the muscle maps, the video status document and the count on the paywall
     * all read one of these walks.
     *
     * tests/library-only.check.mjs holds this to exactly the three lists, by
     * name and in both directions: nothing reachable that has no record, and no
     * record that cannot be reached.
     */
    LIBRARY_EXERCISES,
    CONDITIONING_EXERCISES,
    STANDALONE_PREHAB,
    STANDALONE_FLEXIBILITY,
    PREHAB_BY_REGION,
    ACUTE_PREHAB_BY_REGION,
    PREHAB_WARMUP,
    PREHAB_COOLDOWN_BY_REGION,
    COOLDOWN,
  ]);

  _categoryMapCache = map;
  return map;
}

/**
 * Build a flat { exerciseId -> targetRegions[] } lookup by deep-walking every
 * exercise collection in this module. Any object that has both a string `id`
 * and an array `targetRegions` is recorded. Memoized.
 */
export function getExerciseTargetRegionsMap(): Record<string, PainRegion[]> {
  if (_targetRegionsMapCache) return _targetRegionsMapCache;

  const map: Record<string, PainRegion[]> = {};
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.id === 'string' && Array.isArray(obj.targetRegions)) {
      map[obj.id] = obj.targetRegions as PainRegion[];
    }
    for (const key of Object.keys(obj)) walk(obj[key]);
  };

  walk([
    /**
     * ARCHIE'S LIBRARY, HIS NINE, AND WHAT RESTORE PRESCRIBES. THAT IS ALL.
     *
     * This list used to be twenty collections long, and everything but the last
     * few was the old Train catalogue: MAIN_LIFTS, ACCESSORIES, PREP,
     * MECHANICAL, NEURO, the two POWER pools, FINISHERS, the four CONDITIONING
     * pools, GOAL_CONDITIONING_BLOCKS, ORM_TEST and the three WEEKLY tables.
     * Every session type they fed is built from the library now, so a collection
     * left in this walk would put deleted movements back into the app through
     * the side door: the swap sheet, the injury screen's forced substitutions,
     * the muscle maps, the video status document and the count on the paywall
     * all read one of these walks.
     *
     * tests/library-only.check.mjs holds this to exactly the three lists, by
     * name and in both directions: nothing reachable that has no record, and no
     * record that cannot be reached.
     */
    LIBRARY_EXERCISES,
    CONDITIONING_EXERCISES,
    STANDALONE_PREHAB,
    STANDALONE_FLEXIBILITY,
    PREHAB_BY_REGION,
    ACUTE_PREHAB_BY_REGION,
    PREHAB_WARMUP,
    PREHAB_COOLDOWN_BY_REGION,
    COOLDOWN,
  ]);

  _targetRegionsMapCache = map;
  return map;
}

/**
 * Build a flat { exerciseName -> targetRegions[] } lookup by deep-walking every
 * exercise collection in this module. Indexes:
 *   - Named exercises (id + name + targetRegions) by their `name`
 *   - Comfort variants and swap alternatives, by their name, mapped to the
 *     parent exercise's targetRegions (neither carries an id or regions of its
 *     own, and both are near-identical movements to their parent).
 *
 * Use this as a fallback when an exerciseId is not found in
 * getExerciseTargetRegionsMap() — a comfort-variant swap logged under an
 * auto-generated id, or a weekly main lift that rotated to its alternative and
 * was logged under a variation id so that it progresses separately.
 *
 * A real exercise always wins over a variant of the same name: the variant is
 * an approximation and the template is the fact.
 */
export function getRegionsByExerciseNameMap(): Record<string, PainRegion[]> {
  if (_regionsByNameCache) return _regionsByNameCache;

  const map: Record<string, PainRegion[]> = {};
  const fromVariants: Record<string, PainRegion[]> = {};
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    const regions =
      Array.isArray(obj.targetRegions) && obj.targetRegions.length > 0
        ? (obj.targetRegions as PainRegion[])
        : null;
    if (typeof obj.name === 'string' && regions) {
      map[obj.name] = regions;
    }
    if (regions) {
      for (const key of ['comfortVariant', 'swapAlternative'] as const) {
        const variant = obj[key];
        if (typeof variant === 'object' && variant !== null) {
          const name = (variant as Record<string, unknown>).name;
          if (typeof name === 'string') fromVariants[name] = regions;
        }
      }
    }
    for (const key of Object.keys(obj)) walk(obj[key]);
  };

  walk([
    /**
     * ARCHIE'S LIBRARY, HIS NINE, AND WHAT RESTORE PRESCRIBES. THAT IS ALL.
     *
     * This list used to be twenty collections long, and everything but the last
     * few was the old Train catalogue: MAIN_LIFTS, ACCESSORIES, PREP,
     * MECHANICAL, NEURO, the two POWER pools, FINISHERS, the four CONDITIONING
     * pools, GOAL_CONDITIONING_BLOCKS, ORM_TEST and the three WEEKLY tables.
     * Every session type they fed is built from the library now, so a collection
     * left in this walk would put deleted movements back into the app through
     * the side door: the swap sheet, the injury screen's forced substitutions,
     * the muscle maps, the video status document and the count on the paywall
     * all read one of these walks.
     *
     * tests/library-only.check.mjs holds this to exactly the three lists, by
     * name and in both directions: nothing reachable that has no record, and no
     * record that cannot be reached.
     */
    LIBRARY_EXERCISES,
    CONDITIONING_EXERCISES,
    STANDALONE_PREHAB,
    STANDALONE_FLEXIBILITY,
    PREHAB_BY_REGION,
    ACUTE_PREHAB_BY_REGION,
    PREHAB_WARMUP,
    PREHAB_COOLDOWN_BY_REGION,
    COOLDOWN,
  ]);

  for (const [name, regions] of Object.entries(fromVariants)) {
    if (!map[name]) map[name] = regions;
  }

  _regionsByNameCache = map;
  return map;
}

/**
 * Build a flat { exerciseId -> name } lookup by deep-walking every exercise
 * collection in this module. Any object that has both a string `id` and a
 * string `name` is recorded. Memoized.
 */
export function getExerciseNameMap(): Record<string, string> {
  if (_nameMapCache) return _nameMapCache;

  const map: Record<string, string> = {};
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.id === 'string' && typeof obj.name === 'string') {
      map[obj.id] = obj.name;
    }
    for (const key of Object.keys(obj)) walk(obj[key]);
  };

  walk([
    /**
     * ARCHIE'S LIBRARY, HIS NINE, AND WHAT RESTORE PRESCRIBES. THAT IS ALL.
     *
     * This list used to be twenty collections long, and everything but the last
     * few was the old Train catalogue: MAIN_LIFTS, ACCESSORIES, PREP,
     * MECHANICAL, NEURO, the two POWER pools, FINISHERS, the four CONDITIONING
     * pools, GOAL_CONDITIONING_BLOCKS, ORM_TEST and the three WEEKLY tables.
     * Every session type they fed is built from the library now, so a collection
     * left in this walk would put deleted movements back into the app through
     * the side door: the swap sheet, the injury screen's forced substitutions,
     * the muscle maps, the video status document and the count on the paywall
     * all read one of these walks.
     *
     * tests/library-only.check.mjs holds this to exactly the three lists, by
     * name and in both directions: nothing reachable that has no record, and no
     * record that cannot be reached.
     */
    LIBRARY_EXERCISES,
    CONDITIONING_EXERCISES,
    STANDALONE_PREHAB,
    STANDALONE_FLEXIBILITY,
    PREHAB_BY_REGION,
    ACUTE_PREHAB_BY_REGION,
    PREHAB_WARMUP,
    PREHAB_COOLDOWN_BY_REGION,
    COOLDOWN,
  ]);

  _nameMapCache = map;
  return map;
}


/**
 * LAZY, because this used to run on every cold start.
 *
 * getExerciseNameMap deep-walks every collection in the database. As a top
 * level const it ran at module load, before anything rendered, on every launch:
 * 65ms on a developer's desktop, and a few hundred on the cheap Android this
 * app is meant to work on. Nothing needs it until a screen asks, and only two
 * things ever ask - the paywall's stats row and a contract test.
 *
 * getExerciseNameMap memoises, so the two counts below share one walk.
 */
export function exerciseCount(): number {
  return Object.keys(getExerciseNameMap()).length;
}

/**
 * Distinct MOVEMENTS, which is what "exercises" means to somebody reading it.
 *
 * EXERCISE_COUNT counts catalogue entries, and the same movement is filed under
 * several ids so it can appear in different pools and at different equipment
 * tiers. That is the right number for the internal sanity checks that use it,
 * and the wrong one to print on the paywall: 979 entries are 707 movements, so
 * "979+ exercises" counted a lot of them twice.
 */
export function distinctExerciseCount(): number {
  return new Set(Object.values(getExerciseNameMap()).map((name) => name.toLowerCase().trim())).size;
}
