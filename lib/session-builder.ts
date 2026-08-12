import type { CustomExercise, ExerciseCategory, PainRegion } from './store';
import {
  getAllPickableExercises,
  getMainLift,
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
};

const MOBILITY_BLOCK: BuilderBlock = {
  id: 'mobility',
  category: 'active_stretch',
  sessionCategory: 'prep',
  title: 'Active Mobility',
  purpose: 'Open the range the day’s main lift asks for.',
  picks: 2,
  optional: true,
};

const ACTIVATION_BLOCK: BuilderBlock = {
  id: 'activation',
  category: 'activation',
  sessionCategory: 'mechanical',
  title: 'Specific Activation',
  purpose: 'Wake up the muscles the main lift depends on.',
  picks: 1,
  optional: true,
};

const POWER_BLOCK: BuilderBlock = {
  id: 'power',
  category: 'power',
  sessionCategory: 'neuro',
  title: 'Power Primer',
  purpose: 'One explosive movement while you are fresh.',
  picks: 1,
  optional: true,
};

const KPI_BLOCK: BuilderBlock = {
  id: 'kpi',
  category: 'kpi',
  sessionCategory: 'main',
  title: 'KPI Lift',
  purpose: 'The lift this session is built around. Everything after it supports this.',
  picks: 1,
  optional: false,
};

const ACCESSORY_BLOCK: BuilderBlock = {
  id: 'accessory',
  category: 'accessory',
  sessionCategory: 'accessory',
  title: 'Accessories',
  purpose: 'Support work for the same muscles the KPI lift trains.',
  picks: 2,
  optional: true,
};

const VOLUME_BLOCK: BuilderBlock = {
  id: 'volume',
  category: 'accessory',
  sessionCategory: 'accessory',
  title: 'Volume Block',
  purpose: 'Extra sets on the same muscles, isolation first.',
  picks: 2,
  optional: true,
};

const CORE_PREHAB_BLOCK: BuilderBlock = {
  id: 'core_prehab',
  category: 'core_prehab',
  sessionCategory: 'prehab',
  title: 'Core & Prehab',
  purpose: 'Trunk stability and joint work for what you just loaded.',
  picks: 1,
  optional: true,
};

const CONDITIONING_BLOCK: BuilderBlock = {
  id: 'conditioning',
  category: 'conditioning',
  sessionCategory: 'finisher',
  title: 'Conditioning',
  purpose: 'A hard finish to end the session on.',
  picks: 1,
  optional: true,
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
    // A warm-up machine and a conditioning finisher are compatible with any
    // session that exists. Narrowing them by the KPI lift would invent a
    // restriction the spec does not ask for and coaches do not apply.
    case 'cardio':
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

/** Equipment a warm-up needs a gym for. */
const GYM_CARDIO_EQUIPMENT = /^(fullgym|full gym|machine|cable machine)$/i;

/**
 * The cardio warm-ups are the one pool with no equipment tiers of their own.
 *
 * They sit in a flat list because the generator uses them for every session, so
 * the catalogue records them as available at every tier — and the generator
 * then filters them itself, offering only the bodyweight ones to anyone short
 * of a full gym. Without the same filter here, the first thing a bodyweight
 * user is offered, and the option they get by default, is a treadmill.
 */
function equipmentAllows(block: BuilderBlock, t: ExerciseTemplate, owned: InternalTier[]): boolean {
  if (block.category !== 'cardio') return true;
  if (owned.includes('fullgym')) return true;
  return !GYM_CARDIO_EQUIPMENT.test(t.equipmentRequired ?? '');
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
    case 'cardio':
      // The dedicated warm-up machines first, the cool-down walks last.
      return t.category === 'prep' ? 0 : 2;
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
      equipmentAllows(block, e.template, owned) &&
      !taken.has(e.template.name.toLowerCase())
  );

  const programmed = programmedMainLiftNames(owned);
  const sort = (list: IndexedExercise[]) =>
    [...list]
      .sort(
        (a, b) =>
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
 * Re-filter the blocks that come after the KPI lift once that lift changes.
 *
 * Every step after the KPI step promises to be "matched to" it, and a block
 * that was filled before the lift changed quietly stops keeping that promise:
 * choose a deadlift, let the accessories fill themselves with back squats, go
 * back and switch to a bench press, and the session says "support work for the
 * same muscles the KPI lift trains" above two squats.
 *
 * Only picks that no longer fit at all are dropped, and a block is topped back
 * up to the number it held, so a deliberate choice that still makes sense
 * survives. A block the user has not opened yet is left alone — it fills itself
 * against the new lift when they reach it — and one they emptied on purpose
 * stays empty.
 */
export function refreshForKpi(
  goal: SessionGoal,
  picks: BuilderPicks,
  ctx: RelevanceContext,
  owned: InternalTier[]
): BuilderPicks {
  const blocks = blocksForGoal(goal);
  const kpiIndex = blocks.findIndex((b) => b.id === 'kpi');
  if (kpiIndex < 0) return picks;

  const next: BuilderPicks = { ...picks };
  let changed = false;

  for (const block of blocks.slice(kpiIndex + 1)) {
    const current = next[block.id];
    if (!current || current.length === 0) continue;

    const kept = current.filter((p) => relevanceOf(block.category, p.template, ctx) !== 'none');
    if (kept.length === current.length) continue;

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
      const isCardio = block.id === 'cardio';
      out.push({
        id: pick.template.id,
        name: pick.template.name,
        sets: isCardio ? 1 : pick.sets,
        reps: isCardio ? `${cardioMinutes} min steady` : pick.reps,
        cue: pick.template.cue,
        suggestedLoad: pick.template.suggestedLoad,
        category: block.sessionCategory,
      });
    }
  }

  return out;
}
