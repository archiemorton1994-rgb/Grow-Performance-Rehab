import type { CustomExercise, ExerciseCategory, PainRegion } from './store';
import {
  getAllPickableExercises,
  getMainLift,
  tierRequiredFor,
  type ExerciseTemplate,
  type InternalTier,
} from './exercise-db';
import {
  canBeMainLift,
  patternGroupOf,
  tierOf,
  type PatternGroup,
} from './exercise-classification';
import { bodyRegionOf, type BodyRegion } from './exercise-safety';

/**
 * The assembly line behind the custom session builder.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Asked for: "replace its current unorganized exercise repository with a
 * structured, step-by-step assembly line that guides users through a logical
 * session flow ... rather than presenting a chaotic, random category list."
 *
 * The catalogue was 442 exercises behind a filter sheet. Everything was
 * reachable and nothing was ordered, so building a sensible session required
 * the user to already know what a sensible session looks like. This module is
 * the knowledge that was missing: which of the eight blocks an exercise belongs
 * to, and which exercises actually go with the lift someone has chosen.
 *
 * DERIVED, NOT HAND-TAGGED
 * ────────────────────────
 * Every category here is computed from fields the templates already carry —
 * `category`, `movementPattern`, `primaryMuscle`, `secondaryMuscles`,
 * `targetRegions` — with a short override list where the rules are wrong. Same
 * approach, and the same reason, as lib/exercise-classification.ts: 442
 * exercises hand-tagged in a second place go stale the first week somebody adds
 * a movement, and the failure is silent. Deriving also means a correction to
 * the database arrives here on its own.
 */

// ─── The eight builder categories ────────────────────────────────────────────

/**
 * Where an exercise belongs in a guided build.
 *
 * Distinct from `ExerciseCategory`, which says where the session GENERATOR
 * files a movement. The two overlap but are not the same question: the
 * generator has no "KPI vs accessory" distinction (both are just exercises in
 * a slot), and it has no reason to separate a continuous cardio warm-up from a
 * dynamic stretch, because it picks both itself.
 */
export type BuilderCategory =
  | 'cardio'
  | 'active_stretch'
  | 'activation'
  | 'power'
  | 'kpi'
  | 'accessory'
  | 'core_prehab'
  | 'conditioning';

export const BUILDER_CATEGORIES: BuilderCategory[] = [
  'cardio',
  'active_stretch',
  'activation',
  'power',
  'kpi',
  'accessory',
  'core_prehab',
  'conditioning',
];

export const BUILDER_CATEGORY_LABELS: Record<BuilderCategory, string> = {
  cardio: 'Cardio',
  active_stretch: 'Active Stretch',
  activation: 'Activation',
  power: 'Power',
  kpi: 'KPI Lift',
  accessory: 'Accessory',
  core_prehab: 'Core & Prehab',
  conditioning: 'Conditioning',
};

// ─── Muscle groups ───────────────────────────────────────────────────────────

/**
 * Coarser than `primaryMuscle`, finer than upper/lower.
 *
 * The database records 46 distinct primary muscles, several of which are the
 * same thing under two names ("Lats" and "Latissimus dorsi", "Forearms" and
 * "Grip/Forearms"). Matching accessories to a KPI lift on the raw string finds
 * almost nothing; matching on upper/lower finds almost everything. This is the
 * level at which "trains the same thing as a back squat" is a useful question.
 */
export type MuscleGroup =
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'hips'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'full_body';

/**
 * Biceps, triceps and forearms are three groups rather than one "arms".
 *
 * Lumped together, a bicep curl comes back as a relevant accessory to a bench
 * press, because the bench uses the triceps and both are "arms". Split, the
 * curls follow the rows and pull-ups where they belong.
 *
 * The spinal erectors and thoracic extensors are filed under core rather than
 * back for the same reason: they are secondary on almost every hinge in the
 * database, and treating them as back made good mornings look like relevant
 * preparation for a pull-up.
 */
const MUSCLE_PATTERNS: [MuscleGroup, RegExp][] = [
  ['quads', /quadricep|\bvmo\b|\bquads?\b/i],
  ['hamstrings', /hamstring/i],
  ['glutes', /glute/i],
  ['calves', /\bcalf\b|calves|gastrocnemius|soleus|tibialis/i],
  ['hips', /adductor|abductor|hip flexor|hip external|glute medius|groin/i],
  ['chest', /pectoral|\bchest\b|serratus/i],
  ['back', /latissimus|\blats?\b|rhomboid|trapezius|mid back|\bback\b/i],
  ['shoulders', /deltoid|rotator cuff|infraspinatus|\bshoulder/i],
  ['biceps', /bicep|brachialis/i],
  ['triceps', /tricep/i],
  ['forearms', /forearm|\bgrip\b|wrist|pronator|elbow/i],
  // Not the neck: core work is trunk work, and treating a neck stretch as core
  // stability put one in front of everybody doing a squat session.
  [
    'core',
    /\bcore\b|abdomin|oblique|transversus|diaphragm|erector spinae|thoracic extensor|spinal rotator/i,
  ],
  ['full_body', /full body|cardiovascular/i],
];

/** Every group a muscle name belongs to — "Glute medius" is hips AND glutes. */
function groupsOfMuscle(muscle: string | undefined, into: Set<MuscleGroup>): void {
  if (!muscle) return;
  for (const [group, re] of MUSCLE_PATTERNS) {
    if (re.test(muscle)) into.add(group);
  }
}

/** What an exercise trains, primary and supporting muscles together. */
export function muscleGroupsOf(t: ExerciseTemplate): Set<MuscleGroup> {
  const groups = new Set<MuscleGroup>();
  groupsOfMuscle(t.primaryMuscle, groups);
  for (const m of t.secondaryMuscles ?? []) groupsOfMuscle(m, groups);
  return groups;
}

/** What an exercise is mainly for, ignoring the muscles it merely involves. */
function primaryGroupsOf(t: ExerciseTemplate): Set<MuscleGroup> {
  const groups = new Set<MuscleGroup>();
  groupsOfMuscle(t.primaryMuscle, groups);
  return groups;
}

/** Full-body work counts as a match for anything — it genuinely is. */
function groupsOverlap(a: Set<MuscleGroup>, b: Set<MuscleGroup>): boolean {
  if (a.has('full_body') || b.has('full_body')) return true;
  return groupsOverlapStrict(a, b);
}

/**
 * The same test without the full-body wildcard.
 *
 * Activation and accessory work has to name a muscle. "Full body" is both a
 * legitimate tag for a general warm-up and where several mis-tagged exercises
 * ended up — a Wall Sit and a Seated Toe Raise are both recorded as full body —
 * so honouring the wildcard here fills the activation step with work that
 * primes nothing in particular.
 */
function groupsOverlapStrict(a: Set<MuscleGroup>, b: Set<MuscleGroup>): boolean {
  for (const g of a) if (g !== 'full_body' && b.has(g)) return true;
  return false;
}

// ─── Categorising the catalogue ──────────────────────────────────────────────

/**
 * Names the rules get wrong, and why.
 *
 * Deliberately short — a long list means the rules are wrong and should be
 * fixed instead. Keyed by lowercase name because ids are not stable across the
 * tier-keyed collections, and the catalogue is deduplicated by name.
 */
const CATEGORY_OVERRIDES: Record<string, BuilderCategory> = {
  // Filed as an accessory with "Hip adductors" as its muscle, so the trunk rule
  // does not catch it. A Copenhagen plank is a groin-injury-prevention hold —
  // the exact thing the Core & Prehab block is for.
  'copenhagen plank': 'core_prehab',
  // Filed as a mechanical primer, which is where the generator uses them, but
  // they are full conditioning circuits and belong in the finisher block.
  'circuit a: sled push + assault bike sprint': 'conditioning',
  'circuit a: sled push + bear crawl sprint + assault bike': 'conditioning',
  'circuit a: burpee + squat jump + plyo lunge': 'conditioning',
  'circuit a: db man maker + thruster + swing': 'conditioning',
  'circuit a: kb swing + goblet squat + push-up': 'conditioning',
  'circuit a: squat jump + push-up + high knees': 'conditioning',
  // A sled drag is a conditioning movement wherever it is filed.
  'sled drag': 'conditioning',
  // Recorded with movementPattern 'conditioning', which routes it to the
  // finisher block; it is an ordinary lunge and belongs with the accessories.
  'alternating reverse lunge': 'accessory',
};

/** Continuous, machine-or-locomotion cardio, recognised by what it is called. */
const CONTINUOUS_CARDIO =
  /cardio|treadmill|rower|rowing|stationary bike|assault bike|elliptical|ski erg|\bjog\b|\bskip\b|jump rope|\bwalk\b|\bbike\b/i;

/** A stretch rather than a contraction — it prepares range, it does not prime. */
const STRETCH_NAMES =
  /stretch|\bpose\b|opener|cat-?cow|thread.the.needle|forward fold|release|\brom\b|supination|child's/i;

/**
 * Small stabilisers. Work aimed at these is activation whatever else it is
 * filed as: nobody trains their rotator cuff or glute medius for size.
 */
const STABILISER_MUSCLES =
  /rotator cuff|infraspinatus|glute medius|serratus|transversus|rear deltoid|hip external|tibialis|neck flexor/i;

/** Trunk muscles — what makes an isometric a core exercise rather than a quad one. */
const TRUNK_MUSCLES = /\bcore\b|abdomin|oblique|transversus|erector spinae|diaphragm/i;

/**
 * The one block an exercise belongs to.
 *
 * Total: every pickable exercise lands somewhere. The default arm is
 * `accessory`, which is both the largest block and the least wrong place for
 * something the rules cannot place — an unclassifiable movement offered as an
 * accessory is a mild oddity, whereas one offered as a KPI lift or omitted
 * entirely is a real problem.
 */
export function builderCategoryOf(t: ExerciseTemplate): BuilderCategory {
  const override = CATEGORY_OVERRIDES[t.name.toLowerCase()];
  if (override) return override;

  const pattern = patternGroupOf(t);

  switch (t.category) {
    case 'neuro':
      return 'power';
    case 'mechanical':
      return 'activation';
    case 'prehab':
      return 'core_prehab';
    case 'finisher':
      return 'conditioning';
    case 'main':
      // Two exercises are filed as a main lift and are not compounds — a Lying
      // Leg Curl and a Pallof Press. Trusting the field would put both in the
      // KPI step, so the classification decides and the filing only nominates.
      if (canBeMainLift(t)) return 'kpi';
      return TRUNK_MUSCLES.test(t.primaryMuscle ?? '') ? 'core_prehab' : 'accessory';
    case 'cardio':
      return 'cardio';
    case 'prep':
      // The warm-up block holds three different things: continuous cardio, the
      // dynamic stretches, and a couple of banded drills that are activation in
      // everything but filing.
      if (t.movementPattern === 'conditioning' || CONTINUOUS_CARDIO.test(t.name)) return 'cardio';
      if (t.movementPattern === 'push' || t.movementPattern === 'pull') return 'activation';
      return 'active_stretch';
    case 'cooldown':
      // The "Cool Down Walk" family is continuous low-intensity locomotion,
      // which is exactly what the cardio block asks for; the rest are stretches.
      return t.movementPattern === 'conditioning' ? 'cardio' : 'active_stretch';
    case 'accessory':
    default:
      if (pattern === 'conditioning' || pattern === 'carry') return 'conditioning';
      if (pattern === 'core') {
        return TRUNK_MUSCLES.test(t.primaryMuscle ?? '') ? 'core_prehab' : 'accessory';
      }
      if (canBeMainLift(t)) return 'kpi';
      return 'accessory';
  }
}

/**
 * Every block an exercise may be offered in.
 *
 * One primary category is what the spec asks the database to carry, and it is
 * what the taxonomy test asserts. But blocks genuinely overlap, and pretending
 * they do not costs the user real options: a Goblet Squat is a KPI lift and
 * also a perfectly ordinary accessory, and a Banded Clamshell is prehab work
 * and also exactly the activation drill the spec names by name. So the primary
 * category decides where an exercise is FILED, and this decides where it can be
 * OFFERED.
 */
export function builderRolesOf(t: ExerciseTemplate): BuilderCategory[] {
  const primary = builderCategoryOf(t);
  const roles = new Set<BuilderCategory>([primary]);

  // Every compound is an accessory in someone's programme — that is what a
  // second and third compound in a session is.
  if (primary === 'kpi') roles.add('accessory');

  // Prehab splits cleanly in two by what the movement actually asks of you: a
  // stretch prepares range, a contraction primes a muscle.
  if (primary === 'core_prehab') {
    roles.add(STRETCH_NAMES.test(t.name) ? 'active_stretch' : 'activation');
  }

  // Mobility drills filed as priming work are still mobility drills.
  if (primary === 'activation' && t.movementPattern === 'mobility') roles.add('active_stretch');

  // Light banded work in the warm-up block primes as much as it mobilises.
  if (primary === 'active_stretch' && /\bband/i.test(t.name)) roles.add('activation');

  // Stabiliser work is activation wherever it is filed, as long as it is not a
  // loaded compound in disguise.
  if (STABILISER_MUSCLES.test(t.primaryMuscle ?? '') && !canBeMainLift(t)) roles.add('activation');

  return [...roles];
}

// ─── Goal, focus and the block template ──────────────────────────────────────

/**
 * The primary objective, which decides which blocks the session has at all.
 */
export type SessionGoal = 'athletic' | 'aesthetic' | 'fitness';

export const SESSION_GOALS: { key: SessionGoal; label: string; blurb: string }[] = [
  {
    key: 'athletic',
    label: 'Athletic Performance',
    blurb: 'Explosive power primer before the main lift',
  },
  {
    key: 'aesthetic',
    label: 'Muscle & Aesthetics',
    blurb: 'No power work, an extra volume block instead',
  },
  {
    key: 'fitness',
    label: 'General Fitness',
    blurb: 'Balanced session with a longer conditioning finish',
  },
];

/**
 * What is being trained today.
 *
 * The spec's warm-up is "designed around the target movements of the day", and
 * the day's movements are not known until the KPI lift is chosen two steps
 * later. Asking for the focus up front — as part of the same "Goal Selection &
 * Session Rules" step — is what lets the preparation sequence be specific
 * rather than generic, and it keeps the KPI step down from 187 lifts to the
 * ones that match what the user just warmed up for.
 */
export type SessionFocus = 'lower' | 'push' | 'pull' | 'full';

export const SESSION_FOCUSES: {
  key: SessionFocus;
  label: string;
  blurb: string;
  patterns: PatternGroup[];
}[] = [
  {
    key: 'lower',
    label: 'Lower Body',
    blurb: 'Squat and hinge patterns',
    patterns: ['knee_dominant', 'hip_dominant'],
  },
  {
    key: 'push',
    label: 'Upper Push',
    blurb: 'Bench and overhead patterns',
    patterns: ['horizontal_push', 'vertical_push'],
  },
  {
    key: 'pull',
    label: 'Upper Pull',
    blurb: 'Row and pull-up patterns',
    patterns: ['horizontal_pull', 'vertical_pull'],
  },
  {
    key: 'full',
    label: 'Full Body',
    blurb: 'Any pattern, upper and lower',
    patterns: [
      'knee_dominant',
      'hip_dominant',
      'horizontal_push',
      'vertical_push',
      'horizontal_pull',
      'vertical_pull',
    ],
  },
];

const FOCUS_PATTERNS: Record<SessionFocus, PatternGroup[]> = SESSION_FOCUSES.reduce(
  (acc, f) => {
    acc[f.key] = f.patterns;
    return acc;
  },
  {} as Record<SessionFocus, PatternGroup[]>
);

const FOCUS_REGION: Record<SessionFocus, BodyRegion> = {
  lower: 'lower',
  push: 'upper',
  pull: 'upper',
  full: 'other',
};

/** One step of the build. */
export type BlockId =
  | 'cardio'
  | 'mobility'
  | 'activation'
  | 'power'
  | 'kpi'
  | 'accessory'
  | 'volume'
  | 'core_prehab'
  | 'conditioning';

export interface BuilderBlock {
  id: BlockId;
  /** Which slice of the catalogue this block draws from. */
  category: BuilderCategory;
  /** Where its picks sit in a performed session — drives rest periods and order. */
  sessionCategory: ExerciseCategory;
  title: string;
  /** One line saying why the block is there, shown above the list. */
  purpose: string;
  /** How many exercises the block is built around. The user may pick fewer. */
  picks: number;
  /** Can this block be skipped entirely? Only the KPI lift cannot. */
  optional: boolean;
  /**
   * Does this step's list actually narrow to the KPI lift?
   *
   * The screen prints "Matched to <lift>" above every step, and for two of them
   * that was simply untrue: the conditioning list was byte-identical whichever
   * lift was chosen, and the KPI step claimed to be matched to the lift it was
   * still asking the user to pick. A step now says what it did, and this is the
   * field that decides which sentence it prints — so a block whose filter
   * changes cannot leave the old claim on screen.
   */
  followsLift: boolean;
}

/**
 * Not optional, unlike every other block bar the KPI lift.
 *
 * Two reasons. The generator treats a cardio warm-up as a safety requirement
 * and puts one at the front of every session it builds, so a custom session
 * without one is the only session in the app that starts cold. And the session
 * screen decides which exercise gets the warm-up countdown by looking for a
 * warm-up exercise in first position — skip this block and the countdown lands
 * on the first mobility drill instead, telling someone to hold a six-rep
 * Cossack squat for five minutes.
 */
const CARDIO_BLOCK: BuilderBlock = {
  id: 'cardio',
  category: 'cardio',
  sessionCategory: 'prep',
  title: 'Cardio Warm-Up',
  purpose: 'Raise your temperature before anything is stretched or loaded.',
  picks: 1,
  optional: false,
  followsLift: true,
};

const MOBILITY_BLOCK: BuilderBlock = {
  id: 'mobility',
  category: 'active_stretch',
  sessionCategory: 'prep',
  title: 'Active Mobility',
  purpose: 'Open the range the day’s main lift asks for.',
  picks: 2,
  optional: true,
  followsLift: true,
};

const ACTIVATION_BLOCK: BuilderBlock = {
  id: 'activation',
  category: 'activation',
  sessionCategory: 'mechanical',
  title: 'Specific Activation',
  purpose: 'Wake up the muscles the main lift depends on.',
  picks: 1,
  optional: true,
  followsLift: true,
};

const POWER_BLOCK: BuilderBlock = {
  id: 'power',
  category: 'power',
  sessionCategory: 'neuro',
  title: 'Power Primer',
  purpose: 'One explosive movement while you are fresh.',
  picks: 1,
  optional: true,
  followsLift: true,
};

const KPI_BLOCK: BuilderBlock = {
  id: 'kpi',
  category: 'kpi',
  sessionCategory: 'main',
  title: 'KPI Lift',
  purpose: 'The lift this session is built around. Everything after it supports this.',
  picks: 1,
  optional: false,
  // This step is filtered by the FOCUS, not by the lift — it is the step that
  // chooses the lift. It arrives with its top option already selected, so
  // claiming to be matched to that selection asked the user to choose the thing
  // it had just told them it was following.
  followsLift: false,
};

const ACCESSORY_BLOCK: BuilderBlock = {
  id: 'accessory',
  category: 'accessory',
  sessionCategory: 'accessory',
  title: 'Accessories',
  purpose: 'Support work for the same muscles the KPI lift trains.',
  picks: 2,
  optional: true,
  followsLift: true,
};

const VOLUME_BLOCK: BuilderBlock = {
  id: 'volume',
  category: 'accessory',
  sessionCategory: 'accessory',
  title: 'Volume Block',
  purpose: 'Extra sets on the same muscles, isolation first.',
  picks: 2,
  optional: true,
  followsLift: true,
};

const CORE_PREHAB_BLOCK: BuilderBlock = {
  id: 'core_prehab',
  category: 'core_prehab',
  sessionCategory: 'prehab',
  title: 'Core & Prehab',
  purpose: 'Trunk stability and joint work for what you just loaded.',
  picks: 1,
  optional: true,
  followsLift: true,
};

const CONDITIONING_BLOCK: BuilderBlock = {
  id: 'conditioning',
  category: 'conditioning',
  sessionCategory: 'finisher',
  title: 'Conditioning',
  purpose: 'A hard finish to end the session on.',
  picks: 1,
  optional: true,
  // Deliberately not narrowed by the lift — see relevanceOf. The step used to
  // print "Matched to <lift>" over a list that was the same 264 movements for
  // every lift in the catalogue; it now says what it actually does.
  followsLift: false,
};

/**
 * The block template for a goal.
 *
 * Athletic Performance keeps the Power Primer. Aesthetics drops it and adds a
 * second accessory block in its place, both as asked.
 *
 * General Fitness was left to define. It drops the power primer too — depth
 * jumps and power cleans are skill-heavy movements that earn their place in a
 * performance programme and not in a general one — keeps a single accessory
 * block, and finishes with two conditioning movements instead of one. Someone
 * training for general fitness gets more from ten minutes of work capacity than
 * from a fourth set of curls.
 */
export function blocksForGoal(goal: SessionGoal): BuilderBlock[] {
  const prep = [CARDIO_BLOCK, MOBILITY_BLOCK, ACTIVATION_BLOCK];
  if (goal === 'athletic') {
    return [
      ...prep,
      POWER_BLOCK,
      KPI_BLOCK,
      ACCESSORY_BLOCK,
      CORE_PREHAB_BLOCK,
      CONDITIONING_BLOCK,
    ];
  }
  if (goal === 'aesthetic') {
    return [
      ...prep,
      KPI_BLOCK,
      ACCESSORY_BLOCK,
      VOLUME_BLOCK,
      CORE_PREHAB_BLOCK,
      CONDITIONING_BLOCK,
    ];
  }
  return [
    ...prep,
    KPI_BLOCK,
    ACCESSORY_BLOCK,
    CORE_PREHAB_BLOCK,
    { ...CONDITIONING_BLOCK, picks: 2 },
  ];
}

// ─── What "relevant" means, per block ────────────────────────────────────────

/** What the later steps filter against. */
export interface RelevanceContext {
  focus: SessionFocus;
  /** Null until the KPI step is done — before then, the focus stands in for it. */
  kpi: ExerciseTemplate | null;
}

/**
 * What each pattern needs prepared before it is loaded.
 *
 * Wider than "the muscles the lift uses", on purpose: a back squat is limited
 * by ankle and thoracic range far more often than by anything in the quad, and
 * a mobility list that offered only quad work would be missing the two drills
 * that actually help.
 */
const PATTERN_PREP_GROUPS: Record<PatternGroup, MuscleGroup[]> = {
  knee_dominant: ['quads', 'glutes', 'hips', 'calves', 'hamstrings', 'core'],
  hip_dominant: ['hamstrings', 'glutes', 'hips', 'core', 'calves'],
  horizontal_push: ['chest', 'shoulders', 'triceps', 'back', 'core'],
  vertical_push: ['shoulders', 'chest', 'back', 'triceps', 'core'],
  horizontal_pull: ['back', 'shoulders', 'biceps', 'forearms', 'chest', 'core'],
  vertical_pull: ['back', 'shoulders', 'biceps', 'forearms', 'chest', 'core'],
  carry: ['back', 'core', 'shoulders', 'forearms'],
  core: ['core', 'back', 'hips'],
  conditioning: ['full_body'],
  mobility: ['full_body'],
};

/**
 * The joints a pattern puts under load.
 *
 * Prehab work carries `targetRegions`, which is the most reliable field in the
 * database for this question — it is what the injury screen and the targeted
 * rehab sessions already run on.
 */
const PATTERN_STRESSED_REGIONS: Record<PatternGroup, PainRegion[]> = {
  knee_dominant: ['knee', 'quads', 'hip_groin', 'lower_back', 'ankle_achilles', 'glutes'],
  hip_dominant: ['lower_back', 'hamstrings', 'glutes', 'hip_groin', 'core_ribs'],
  horizontal_push: ['front_shoulder', 'chest', 'tricep', 'elbow', 'wrist'],
  vertical_push: ['front_shoulder', 'rear_shoulder', 'upper_back', 'neck', 'elbow', 'wrist'],
  horizontal_pull: ['lat_mid_back', 'rear_shoulder', 'upper_back', 'bicep', 'elbow'],
  vertical_pull: ['lat_mid_back', 'rear_shoulder', 'upper_back', 'bicep', 'elbow', 'wrist'],
  carry: ['lat_mid_back', 'upper_back', 'core_ribs', 'wrist'],
  core: ['core_ribs', 'lower_back'],
  conditioning: ['knee', 'ankle_achilles', 'calf_shin'],
  mobility: [],
};

const FOCUS_GROUPS: Record<SessionFocus, MuscleGroup[]> = {
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'hips'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'shoulders', 'biceps', 'forearms'],
  full: [
    'quads',
    'hamstrings',
    'glutes',
    'calves',
    'hips',
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'forearms',
  ],
};

/** The patterns the session is built on: the KPI lift's, or the focus's. */
function contextPatterns(ctx: RelevanceContext): PatternGroup[] {
  return ctx.kpi ? [patternGroupOf(ctx.kpi)] : FOCUS_PATTERNS[ctx.focus];
}

/**
 * The muscles the session trains: the KPI lift's, or the focus's.
 *
 * Core is deliberately dropped. It is a supporting muscle on most of the
 * catalogue, so leaving it in makes every plank a relevant accessory to every
 * lift — and trunk work has a block of its own two steps later.
 */
function contextGroups(ctx: RelevanceContext): Set<MuscleGroup> {
  if (!ctx.kpi) return new Set(FOCUS_GROUPS[ctx.focus]);
  const groups = muscleGroupsOf(ctx.kpi);
  groups.delete('core');
  return groups;
}

/**
 * Which half of the body the session is training.
 *
 * Falls back to the focus when the lift's own muscle does not answer it. That
 * is not a rare edge: the Barbell Deadlift is recorded with "Erector spinae" as
 * its primary muscle, which reads as core, and without the fallback a deadlift
 * session would find no relevant power work at all.
 */
function contextRegion(ctx: RelevanceContext): BodyRegion {
  if (!ctx.kpi) return FOCUS_REGION[ctx.focus];
  const region = bodyRegionOf(ctx.kpi.primaryMuscle);
  return region === 'upper' || region === 'lower' ? region : FOCUS_REGION[ctx.focus];
}

function unionGroups(patterns: PatternGroup[], table: Record<PatternGroup, MuscleGroup[]>) {
  const out = new Set<MuscleGroup>();
  for (const p of patterns) for (const g of table[p]) out.add(g);
  return out;
}

function unionRegions(patterns: PatternGroup[]) {
  const out = new Set<PainRegion>();
  for (const p of patterns) for (const r of PATTERN_STRESSED_REGIONS[p]) out.add(r);
  return out;
}

/**
 * What a cardio warm-up actually moves, read from its name.
 *
 * Every other filter in this file runs on the database's own fields. This one
 * cannot: fifteen of the seventeen warm-ups record "Full body" as their primary
 * muscle and carry no secondary muscles at all, so those fields cannot tell a
 * rower from an exercise bike. The modality is written down in exactly one
 * place, which is the name, and a warm-up step that ignores it is the step that
 * offered the same seventeen options — in the same alphabetical order, led by
 * an assault bike — to a chin-up session and a squat session alike.
 *
 * Upper-limb drills are mapped to pulling as well as pressing. Arm circles and
 * a halo prepare the shoulder for a chin-up exactly as much as for a bench
 * press, and treating them as pressing-only left a pull day with four matches.
 */
const CARDIO_AFFINITY: [RegExp, PatternGroup[]][] = [
  [/\brow(ing|er)?\b|ski ?erg/i, ['horizontal_pull', 'vertical_pull', 'hip_dominant']],
  [/\bbike\b|cycl/i, ['knee_dominant']],
  [/tread|\bwalk\b|\bjog\b|\brun\b|march/i, ['knee_dominant', 'hip_dominant']],
  [/jump rope|\bskip\b/i, ['knee_dominant']],
  [
    /shadow box|arm circle|arm swing|\bhalo\b|battle rope/i,
    ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'],
  ],
  [/squat/i, ['knee_dominant']],
  [/hinge|\bswing\b/i, ['hip_dominant']],
];

/** The patterns a warm-up prepares. Empty means a general one, which prepares any. */
function cardioAffinity(t: ExerciseTemplate): Set<PatternGroup> {
  const out = new Set<PatternGroup>();
  for (const [re, patterns] of CARDIO_AFFINITY) {
    if (re.test(t.name)) for (const p of patterns) out.add(p);
  }
  return out;
}

/**
 * Dedicated cardio kit, as opposed to a drill that happens to raise the pulse.
 *
 * The block's job is stated in its own purpose line — "raise your temperature" —
 * and five minutes on the machine that drives the day's pattern does that
 * better than a mixed calisthenic drill. This is what puts the rower first on a
 * pulling day rather than whichever matching drill sorts first alphabetically.
 */
const CARDIO_MACHINES = /\bbike\b|tread|\brow(ing|er)?\b|ski ?erg|elliptical|jump rope|\bskip\b/i;

/** The finishing modalities the brief names, plus their obvious siblings. */
const FINISHER_MODALITIES =
  /sled|prowler|battle rope|rope slam|assault bike|air bike|ski erg|rower|farmer|carry|yoke|sprint|shuttle/i;

/**
 * The same machines at a pace that is not a finish.
 *
 * The block is for "high-intensity finisher movements", and the conditioning
 * pool holds both an Assault Bike Sprint and an Assault Bike (Easy Pace).
 * Ranking on the machine alone offered the easy one first.
 */
const RECOVERY_PACE = /\beasy\b|\blight\b|\bmoderate\b|steady|recovery|cool.?down|\bwalk\b/i;

/** How well an exercise fits a block given what the session is built on. */
export type Relevance = 'direct' | 'related' | 'none';

const RELEVANCE_RANK: Record<Relevance, number> = { direct: 0, related: 1, none: 2 };

export function relevanceOf(
  category: BuilderCategory,
  t: ExerciseTemplate,
  ctx: RelevanceContext
): Relevance {
  const sameHalf = () => {
    const region = contextRegion(ctx);
    if (region === 'other') return true;
    const candidate = bodyRegionOf(t.primaryMuscle);
    return candidate === region || candidate === 'other';
  };

  switch (category) {
    case 'cardio': {
      // The warm-up exists to prepare the lift that follows it, so a rower
      // leads a pulling day and a bike leads a leg day. A general warm-up has
      // no pattern of its own and genuinely suits any lift, so it stays a
      // direct match everywhere.
      //
      // Nothing here is ever graded 'none'. An exercise bike before a bench
      // press is a worse warm-up than arm circles, not a wrong one, and 'none'
      // is the grade that hides an option from the step and deletes it from a
      // session when the lift changes. Ranking is what separates the two.
      const affinity = cardioAffinity(t);
      if (affinity.size === 0) return 'direct';
      return contextPatterns(ctx).some((p) => affinity.has(p)) ? 'direct' : 'related';
    }

    // A finisher is not matched to the KPI lift, here or in any coach's
    // programme: what you can bear at the end of a session is a question about
    // time and gas in the tank, not about which compound you opened with.
    // Kept deliberately unfiltered — and the step now says so rather than
    // printing "Matched to <lift>" over a list that never changed.
    case 'conditioning':
      return 'direct';

    case 'kpi':
      return FOCUS_PATTERNS[ctx.focus].includes(patternGroupOf(t)) ? 'direct' : 'related';

    case 'active_stretch': {
      const wanted = unionGroups(contextPatterns(ctx), PATTERN_PREP_GROUPS);
      if (groupsOverlap(muscleGroupsOf(t), wanted)) return 'direct';
      return sameHalf() ? 'related' : 'none';
    }

    case 'activation':
    case 'accessory': {
      // The candidate is judged on what it is FOR, not on everything it
      // involves — otherwise a good morning is a relevant accessory to a
      // pull-up, because both involve the spinal erectors.
      if (groupsOverlapStrict(primaryGroupsOf(t), contextGroups(ctx))) return 'direct';
      return sameHalf() ? 'related' : 'none';
    }

    case 'power': {
      // Plyometrics are grouped by which half of the body they throw, which is
      // the only distinction the power pool actually carries — every jump is
      // filed under Glutes or Quadriceps, every throw under Pectorals.
      const region = contextRegion(ctx);
      if (region === 'other') return 'direct';
      const candidate = bodyRegionOf(t.primaryMuscle);
      if (candidate === region) return 'direct';
      return candidate === 'other' ? 'related' : 'none';
    }

    case 'core_prehab': {
      // Trunk work supports every pattern there is, so it is always direct;
      // joint work has to be aimed at a joint the session actually loads.
      if (muscleGroupsOf(t).has('core')) return 'direct';
      const stressed = unionRegions(contextPatterns(ctx));
      if ((t.targetRegions ?? []).some((r) => stressed.has(r))) return 'direct';
      return sameHalf() ? 'related' : 'none';
    }
  }
}

// ─── The pool, and what each step offers ─────────────────────────────────────

const TIER_RANK: Record<InternalTier, number> = { bodyweight: 0, dumbbells: 1, fullgym: 2 };

/**
 * Equipment tiers are cumulative — someone with a full gym owns dumbbells and
 * their own bodyweight too. Same rule the catalogue already uses.
 */
export function ownedTiersFor(tier: InternalTier): InternalTier[] {
  const own = TIER_RANK[tier];
  return (['bodyweight', 'dumbbells', 'fullgym'] as InternalTier[]).filter(
    (t) => TIER_RANK[t] <= own
  );
}

interface IndexedExercise {
  template: ExerciseTemplate;
  tiers: InternalTier[];
  roles: BuilderCategory[];
  groups: Set<MuscleGroup>;
}

let _indexCache: IndexedExercise[] | null = null;

function index(): IndexedExercise[] {
  if (_indexCache) return _indexCache;
  _indexCache = getAllPickableExercises().map((p) => ({
    template: p.template,
    tiers: p.tiers,
    roles: builderRolesOf(p.template),
    groups: muscleGroupsOf(p.template),
  }));
  return _indexCache;
}

/** Every pickable exercise whose primary category is this one. */
export function exercisesInCategory(category: BuilderCategory): ExerciseTemplate[] {
  return index()
    .filter((e) => builderCategoryOf(e.template) === category)
    .map((e) => e.template);
}

function availableIn(e: IndexedExercise, owned: InternalTier[]): boolean {
  // No tier recorded means the movement needs no equipment.
  if (e.tiers.length === 0) return true;
  return e.tiers.some((t) => owned.includes(t));
}

/**
 * Does this user own what the movement asks for?
 *
 * This gate ran on the cardio block alone, because a treadmill in the warm-up
 * step was the leak somebody noticed: the cardio warm-ups sit in a flat list
 * with no tier of their own, so the catalogue recorded them as available
 * everywhere and the first thing a bodyweight user was offered was a machine.
 *
 * Every other block leaked the same way and less visibly, because a leak is
 * only obvious when the exercise is NAMED after its equipment. The Core &
 * Prehab step's top-ranked option — the one it auto-fills with — was an Ab
 * Wheel Rollout for all twelve bodyweight builds and all twelve dumbbell ones,
 * and it read as harmless because its suggested load is the word "Bodyweight".
 *
 * The requirement is now checked directly rather than inferred from where the
 * catalogue happens to file a movement, so the two cannot disagree again.
 */
function equipmentAllows(t: ExerciseTemplate, owned: InternalTier[]): boolean {
  return owned.includes(tierRequiredFor(t.equipmentRequired));
}

/**
 * How thin a list is allowed to get before the filter is widened.
 *
 * Six is the point at which a step stops feeling like a choice. The spec asks
 * for friction removed, not choice removed, so a filter that would leave two
 * options is the wrong filter for that user's equipment and gets relaxed —
 * first to the same half of the body, then to the whole block.
 */
const MIN_OPTIONS = 6;

/**
 * The KPI step is the exception.
 *
 * Widening it would offer bench presses to somebody who just spent three steps
 * warming up their hips, which breaks the promise the earlier steps made. If a
 * bodyweight user's chosen focus has only four compounds in it, four is the
 * honest answer — and the "show everything" control is one tap away.
 */
function minOptionsFor(block: BuilderBlock): number {
  return block.id === 'kpi' ? 1 : MIN_OPTIONS;
}

export interface StepOptions {
  /** Relevant, equipment-legal, ranked best-first. */
  options: ExerciseTemplate[];
  /** True when the strict filter was too thin and had to be relaxed. */
  widened: boolean;
  /** The whole block at this equipment level, for the "show everything" escape hatch. */
  all: ExerciseTemplate[];
}

/**
 * Ranking within a step.
 *
 * Deterministic, so the same build offers the same order twice — a list that
 * reshuffles between visits is one nobody can learn.
 */
/**
 * The lift the app itself would programme for this tier, by name.
 *
 * The KPI step used to rank every `main` template the same and let the
 * alphabet break the tie, so a bodyweight lower-body session led with — and
 * defaulted to — a Bodyweight Good Morning ahead of a Bodyweight Squat. Rather
 * than invent a second opinion about which lift is the centrepiece, borrow the
 * one the generator already acts on.
 */
function programmedMainLiftNames(owned: InternalTier[]): Set<string> {
  const names = new Set<string>();
  for (const tier of owned) {
    for (const sessionType of ['squat', 'bench', 'deadlift'] as const) {
      names.add(getMainLift(sessionType, tier).name.toLowerCase());
    }
  }
  return names;
}

function rankOf(
  block: BuilderBlock,
  t: ExerciseTemplate,
  ctx: RelevanceContext,
  programmed: Set<string>
): number {
  const target = contextGroups(ctx);
  let shared = 0;
  for (const g of muscleGroupsOf(t)) if (target.has(g)) shared++;
  // Work aimed squarely at what the lift trains beats work that merely touches
  // it: after a back squat, quad and glute movements come before the rest.
  const onTarget = groupsOverlapStrict(primaryGroupsOf(t), target) ? 0 : 10;

  switch (block.id) {
    case 'cardio': {
      // The machine that drives the day's pattern first, then anything else
      // that prepares it, then the general warm-ups, then the rest. Ranking on
      // `category` alone did not order this list at all: sixteen of the
      // seventeen options are filed as 'prep', so the tie-break fell through to
      // the alphabet and every session in the app — squat, bench and chin-up —
      // opened with, and defaulted to, an Assault Bike Warm-Up.
      const affinity = cardioAffinity(t);
      const machine = CARDIO_MACHINES.test(t.name);
      const matches = affinity.size > 0 && contextPatterns(ctx).some((p) => affinity.has(p));
      const base = matches ? (machine ? 0 : 1) : affinity.size === 0 ? 2 : machine ? 3 : 4;
      // The cool-down walks sit in this block because they are continuous
      // locomotion, but a warm-up beats one at warming up.
      return base * 2 + (t.category === 'prep' ? 0 : 1);
    }
    case 'kpi':
      // The exact lift the generator would programme leads, then the rest of
      // the main lifts, then everything else eligible to carry a session.
      if (programmed.has(t.name.toLowerCase())) return 0;
      return t.category === 'main' ? 1 : 2;
    case 'volume':
      // An extra volume block is where isolation work belongs.
      return (tierOf(t) === 'isolation' ? 0 : 20) + onTarget;
    case 'conditioning':
      // Sleds, ropes, bikes and carries are the movements asked for by name, so
      // they lead. Ranking on `movementPattern` alone did not achieve that:
      // nearly the whole block is tagged 'conditioning', so the tie-break fell
      // through to the alphabet and every session in the app defaulted to an
      // Alternating Jump Lunge.
      if (RECOVERY_PACE.test(t.name)) return 3;
      if (FINISHER_MODALITIES.test(t.name)) return 0;
      return t.movementPattern === 'conditioning' || t.movementPattern === 'carry' ? 1 : 2;
    case 'core_prehab': {
      // Trunk stability leads, then joint work aimed at what this session
      // actually loaded. The other way round, a push session defaulted to a
      // light band curl — genuine elbow prehab, and a strange thing to be the
      // one thing standing between a bench press and going home. Judged on the
      // primary muscle, because half the block lists the core as a supporting
      // one and a bicep stretch is not trunk work.
      const stressed = unionRegions(contextPatterns(ctx));
      if (primaryGroupsOf(t).has('core')) return 0;
      return (t.targetRegions ?? []).some((r) => stressed.has(r)) ? 1 : 2;
    }
    default:
      return onTarget - shared;
  }
}

/**
 * What a step offers, given the goal, the focus and the KPI lift so far.
 *
 * `exclude` is the names already picked elsewhere in this build — an exercise
 * cannot fill two blocks of the same session.
 */
export function optionsForBlock(
  block: BuilderBlock,
  ctx: RelevanceContext,
  owned: InternalTier[],
  exclude: Set<string> = new Set()
): StepOptions {
  const taken = new Set([...exclude].map((n) => n.toLowerCase()));
  const pool = index().filter(
    (e) =>
      e.roles.includes(block.category) &&
      availableIn(e, owned) &&
      equipmentAllows(e.template, owned) &&
      !taken.has(e.template.name.toLowerCase())
  );

  const programmed = programmedMainLiftNames(owned);
  const sort = (list: IndexedExercise[]) =>
    [...list]
      .sort(
        (a, b) =>
          // Relevance outranks everything, because the two lists below are not
          // all one grade. A widened step, and the "show everything" list behind
          // the All button, both contain work the lift has no use for, and
          // ordering those by the block's own rule alone buried the matches: a
          // dumbbell user building a chin-up session was offered — and filled
          // the step with — a DB Power Clean, ahead of the four upper-body
          // plyometrics the step exists to offer.
          RELEVANCE_RANK[relevanceOf(block.category, a.template, ctx)] -
            RELEVANCE_RANK[relevanceOf(block.category, b.template, ctx)] ||
          rankOf(block, a.template, ctx, programmed) - rankOf(block, b.template, ctx, programmed) ||
          a.template.name.localeCompare(b.template.name)
      )
      .map((e) => e.template);

  const min = minOptionsFor(block);
  const direct = pool.filter((e) => relevanceOf(block.category, e.template, ctx) === 'direct');
  if (direct.length >= min) {
    return { options: sort(direct), widened: false, all: sort(pool) };
  }

  const related = pool.filter((e) => relevanceOf(block.category, e.template, ctx) !== 'none');
  if (related.length >= min) {
    return { options: sort(related), widened: true, all: sort(pool) };
  }

  return { options: sort(pool), widened: true, all: sort(pool) };
}

// ─── Keeping the later blocks honest when the KPI lift changes ───────────────

/** The sets and reps a template prescribes, before the user edits them. */
function pickFrom(t: ExerciseTemplate): BuilderPick {
  return { template: t, sets: t.sets, reps: t.reps };
}

/**
 * Re-filter every other block once the KPI lift changes.
 *
 * Every step promises to be built around the lift, and a block that was filled
 * before the lift changed quietly stops keeping that promise: choose a
 * deadlift, let the accessories fill themselves with back squats, go back and
 * switch to a bench press, and the session says "support work for the same
 * muscles the KPI lift trains" above two squats.
 *
 * THE WARM-UP COUNTS TOO. This walked forwards from the KPI step only, so
 * switching a lower-body build to a bench press refilled the accessories with
 * pressing work and left the four steps in front of it aimed at the old lift —
 * a Cossack squat, a hip flexor stretch, a banded lateral walk and a box jump,
 * in front of a bench press. Those four steps are the warm-up. Preparing the
 * lift you are no longer about to do is not a cosmetic mismatch, it is the
 * whole point of the block being there.
 *
 * WHOSE CHOICE IS IT. A pick the USER made is kept as long as it still fits at
 * all, and the block is topped back up to the number it held — a deliberate
 * choice that still makes sense must survive a change of mind about the lift.
 * A pick the APP made, by filling a step the user walked straight through, is
 * simply made again against the new lift. Both were previously treated as the
 * user's, which is how an assault bike chosen for a squat day stayed put under
 * a heading reading "Matched to Barbell Bench Press": it is a legitimate warm-up
 * for a bench press, so nothing dropped it, and nobody had ever chosen it.
 *
 * `autoFilled` is those app-filled blocks. Default empty, i.e. treat everything
 * as the user's and preserve it — the cautious direction for a caller that does
 * not track the difference.
 *
 * A block the user has not opened yet is left alone — it fills itself against
 * the new lift when they reach it — and one they emptied on purpose stays empty.
 */
export function refreshForKpi(
  goal: SessionGoal,
  picks: BuilderPicks,
  ctx: RelevanceContext,
  owned: InternalTier[],
  autoFilled: ReadonlySet<BlockId> = new Set()
): BuilderPicks {
  const blocks = blocksForGoal(goal);
  if (!blocks.some((b) => b.id === 'kpi')) return picks;

  const next: BuilderPicks = { ...picks };
  let changed = false;

  for (const block of blocks) {
    // The lift itself is what everything else is being re-filtered against.
    if (block.id === 'kpi') continue;
    const current = next[block.id];
    if (!current || current.length === 0) continue;

    const appChose = autoFilled.has(block.id);
    const kept = appChose
      ? []
      : current.filter((p) => relevanceOf(block.category, p.template, ctx) !== 'none');
    if (!appChose && kept.length === current.length) continue;

    const exclude = new Set<string>();
    for (const [id, list] of Object.entries(next)) {
      if (id === block.id) continue;
      for (const p of list ?? []) exclude.add(p.template.name);
    }
    for (const p of kept) exclude.add(p.template.name);

    const { options } = optionsForBlock(block, ctx, owned, exclude);
    const topped = [...kept];
    for (const t of options) {
      if (topped.length >= current.length) break;
      topped.push(pickFrom(t));
    }
    // Re-picking an app-filled block usually lands on the same exercise. Say
    // nothing changed when nothing did, so the screen does not re-render the
    // whole session on every tap of an already-chosen lift.
    const same =
      topped.length === current.length &&
      topped.every((p, i) => p.template.id === current[i].template.id);
    if (same) continue;
    next[block.id] = topped;
    changed = true;
  }

  return changed ? next : picks;
}

// ─── Turning picks into a session ────────────────────────────────────────────

/** The 1-5 minute cardio warm-up the spec asks for. */
export const CARDIO_MINUTES = [1, 2, 3, 4, 5];
export const DEFAULT_CARDIO_MINUTES = 3;

export interface BuilderPick {
  template: ExerciseTemplate;
  sets: number;
  reps: string;
  /**
   * Set only on the flat catalogue's five cardio machines (Treadmill, Bike,
   * Rower, Ski Erg, Other Cardio), which are not exercises in the database at
   * all. The session screen keys its duration-and-distance logger off this, so
   * a saved template that contains one has to carry it back out again — drop it
   * and the user is asked for sets and reps on a treadmill.
   */
  type?: 'cardio';
}

export type BuilderPicks = Partial<Record<BlockId, BuilderPick[]>>;

/**
 * The session, in the order a generated one arrives in.
 *
 * Sets, reps and the suggested load come straight off the template unless the
 * user has edited them, so a custom session prescribes exactly what a generated
 * one would for the same movement. The category is the BLOCK's, not the
 * template's: a Goblet Squat chosen as the KPI lift gets main-lift rest periods,
 * and the same movement chosen as an accessory gets accessory rest periods.
 * That is the whole point of choosing a slot for it.
 */
export function assembleSession(
  goal: SessionGoal,
  picks: BuilderPicks,
  cardioMinutes: number = DEFAULT_CARDIO_MINUTES
): CustomExercise[] {
  const out: CustomExercise[] = [];
  const seen = new Set<string>();

  for (const block of blocksForGoal(goal)) {
    for (const pick of picks[block.id] ?? []) {
      const key = pick.template.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // A self-logging cardio machine keeps its own prescription: the session
      // screen asks it for a duration directly, so writing "3 min steady" into
      // its reps would put a number on screen the logger then contradicts.
      const timed = block.id === 'cardio' && pick.type !== 'cardio';
      out.push({
        id: pick.template.id,
        name: pick.template.name,
        sets: timed ? 1 : pick.sets,
        reps: timed ? `${cardioMinutes} min steady` : pick.reps,
        cue: pick.template.cue,
        suggestedLoad: pick.template.suggestedLoad,
        category: block.sessionCategory,
        ...(pick.type ? { type: pick.type } : {}),
      });
    }
  }

  return out;
}

// ─── Reading a saved session back into a build ───────────────────────────────

/**
 * A saved template, expressed as the build that would have produced it.
 *
 * Reusing a saved session used to drop the user into the flat catalogue with a
 * tray of chips — the one screen the assembly line was built to replace, and
 * the only place in the flow where the eight blocks stopped existing. The data
 * was never the problem: a template stores each exercise with the block's own
 * session category, so the structure survives being saved. It was simply never
 * read back. This reads it back, so a reused session opens on the review screen
 * and can be adjusted step by step exactly like a fresh one.
 *
 * Total by construction: every exercise in the template lands in some block of
 * the returned goal, because losing one silently is worse than filing it oddly.
 */
export interface RestoredBuild {
  goal: SessionGoal;
  focus: SessionFocus;
  picks: BuilderPicks;
  cardioMinutes: number;
}

/**
 * Where a saved exercise can go, best first.
 *
 * `prep` covers both warm-up blocks; the cardio one is separated out by
 * category rather than by position, below.
 */
const BLOCKS_FOR_SESSION_CATEGORY: Record<ExerciseCategory, BlockId[]> = {
  prep: ['mobility'],
  cardio: ['cardio'],
  mechanical: ['activation'],
  neuro: ['power'],
  // A session with two compounds in it has one KPI lift and one accessory —
  // that is what a second compound is.
  main: ['kpi', 'accessory'],
  accessory: ['accessory', 'volume'],
  prehab: ['core_prehab'],
  finisher: ['conditioning'],
  cooldown: ['mobility'],
};

let _byIdCache: Map<string, ExerciseTemplate> | null = null;
let _byNameCache: Map<string, ExerciseTemplate> | null = null;

/**
 * The live template behind a saved exercise.
 *
 * By id first, then by name, because ids are not stable across the tier-keyed
 * collections while the catalogue is deduplicated by name — a template saved on
 * one equipment tier and reopened on another would otherwise lose its cue,
 * muscles and video and come back as a bare name. When neither matches, the
 * saved copy stands in for itself: a template must never lose an exercise
 * because the catalogue moved on.
 */
function templateFor(ex: CustomExercise): ExerciseTemplate {
  if (!_byIdCache || !_byNameCache) {
    _byIdCache = new Map();
    _byNameCache = new Map();
    for (const e of index()) {
      if (!_byIdCache.has(e.template.id)) _byIdCache.set(e.template.id, e.template);
      const key = e.template.name.toLowerCase();
      if (!_byNameCache.has(key)) _byNameCache.set(key, e.template);
    }
  }
  return (
    _byIdCache.get(ex.id) ??
    _byNameCache.get(ex.name.toLowerCase()) ?? {
      id: ex.id,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      cue: ex.cue,
      suggestedLoad: ex.suggestedLoad,
      category: ex.category,
      targetRegions: [],
      videoId: '',
    }
  );
}

/**
 * Which goal's template this session was built on, read from its shape.
 *
 * The three goals differ in exactly three ways, and each is visible in the
 * saved list: only Athletic Performance has a power primer, only Muscle &
 * Aesthetics has a second accessory block, and only General Fitness finishes
 * with two conditioning movements. Athletic is the fallback because it is the
 * one goal whose blocks are all optional bar the two that no goal can skip, so
 * guessing it wrong costs the user a step they can skip rather than a block
 * their session had nowhere to put.
 */
function goalFromSession(exercises: CustomExercise[]): SessionGoal {
  const count = (c: ExerciseCategory) => exercises.filter((e) => e.category === c).length;
  if (count('neuro') > 0) return 'athletic';
  if (count('accessory') > 2) return 'aesthetic';
  if (count('finisher') > 1) return 'fitness';
  return 'athletic';
}

/** The focus a KPI lift implies, so the steps filter the way they first did. */
function focusFromKpi(kpi: ExerciseTemplate | undefined): SessionFocus {
  if (!kpi) return 'full';
  const pattern = patternGroupOf(kpi);
  return SESSION_FOCUSES.find((f) => f.key !== 'full' && f.patterns.includes(pattern))?.key ?? 'full';
}

/** The duration a saved cardio warm-up was prescribed for, if it still reads as one. */
function cardioMinutesFrom(picks: BuilderPicks): number {
  for (const pick of picks.cardio ?? []) {
    const minutes = Number(/^\s*(\d+)\s*min steady\s*$/i.exec(pick.reps)?.[1]);
    if (CARDIO_MINUTES.includes(minutes)) return minutes;
  }
  return DEFAULT_CARDIO_MINUTES;
}

export function buildFromSession(exercises: CustomExercise[]): RestoredBuild {
  const goal = goalFromSession(exercises);
  const blocks = new Map(blocksForGoal(goal).map((b) => [b.id, b]));
  const picks: BuilderPicks = {};

  for (const ex of exercises) {
    const template = templateFor(ex);
    const id = ((): BlockId => {
      // The catalogue's five self-logging machines are cardio whatever they
      // were filed as — they are saved with category 'accessory'.
      if (ex.type === 'cardio') return 'cardio';
      if (ex.category === 'prep' && builderCategoryOf(template) === 'cardio') return 'cardio';
      const candidates = (BLOCKS_FOR_SESSION_CATEGORY[ex.category] ?? []).filter((b) =>
        blocks.has(b)
      );
      for (const candidate of candidates) {
        if ((picks[candidate] ?? []).length < (blocks.get(candidate)?.picks ?? 0)) return candidate;
      }
      // Everything this category could use is full, or this goal has no block
      // for it at all. Accessories is where an unplaceable movement does the
      // least harm — same reasoning as builderCategoryOf's default arm.
      return candidates[candidates.length - 1] ?? 'accessory';
    })();

    picks[id] = [
      ...(picks[id] ?? []),
      {
        template,
        sets: ex.sets,
        reps: ex.reps,
        ...(ex.type ? { type: ex.type } : {}),
      },
    ];
  }

  return {
    goal,
    focus: focusFromKpi(picks.kpi?.[0]?.template),
    picks,
    cardioMinutes: cardioMinutesFrom(picks),
  };
}
