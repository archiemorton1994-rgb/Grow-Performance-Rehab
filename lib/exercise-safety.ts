import type { ExperienceLevel, ExerciseCategory, PainRegion } from './store';

/**
 * Which exercises are unsafe for which complaint.
 *
 * THE PROBLEM THIS SOLVES
 * ───────────────────────
 * Telling the app your knee hurts changed almost nothing. The only adaptation
 * was `comfortVariant` — a hand-authored alternative attached to a small number
 * of templates, which fires only when that specific template is picked AND the
 * complaint is in its trigger list. Everything else went through untouched. A
 * beginner reporting knee pain was measured getting Squat Jumps, Burpees, Box
 * Jumps, a jump-rope warm-up and Bulgarian Split Squats in the same week.
 *
 * HOW IT WORKS
 * ────────────
 * Two tables, both meant to be read and edited by a human:
 *
 *   1. TAG_RULES  — what a movement does to the body, recognised from its name.
 *   2. RESTRICTED_BY_REGION — what a given complaint should not be doing.
 *
 * Classifying by name rather than by a per-exercise field is deliberate. There
 * are 447 pickable exercises and hand-tagging all of them would be wrong within
 * a month of the database growing; the names are descriptive and consistent
 * ("Squat Jump", "Bulgarian Split Squat", "Circuit B: Burpee + Reverse Lunge"),
 * and a compound circuit name matches on every movement it contains, which a
 * single per-exercise tag could not express.
 *
 * A NOTE ON WHAT THIS IS NOT
 * ──────────────────────────
 * This is a screening rule, not a diagnosis or a treatment plan. It is
 * deliberately blunt in one direction: it removes things. It does not decide
 * that anything is *good* for a complaint — the targeted rehab sessions and the
 * database's own `injuryFriendlyAlternatives` do that, and they were authored
 * by someone qualified. The mapping below is written as plain data precisely so
 * that a physio can correct it without touching any logic.
 */

export type StressTag =
  /** Both feet leave the ground, or the movement is a landing/deceleration. */
  | 'high_impact'
  /** The knee bends past roughly 90° under load. */
  | 'deep_knee_flexion'
  /** Resisted knee extension with the foot free — hard on the kneecap. */
  | 'open_chain_knee'
  /** A loaded hip hinge: deadlifts, RDLs, good mornings, swings. */
  | 'loaded_hinge'
  /** A load sitting on the spine — bar on the back, standing overhead work. */
  | 'spinal_compression'
  /** The low back rounds under load. */
  | 'lumbar_flexion'
  /** Pressing or reaching overhead. */
  | 'overhead'
  /** The shoulder is taken to the end of its range under load. */
  | 'shoulder_end_range'
  /** Heavy elbow flexion/extension in isolation. */
  | 'elbow_load'
  /** Weight bearing through an extended wrist, or a hard front rack. */
  | 'wrist_load'
  /** Loaded through the ankle/achilles. */
  | 'ankle_load'
  /** Load hanging from, or pulling on, the neck and upper traps. */
  | 'neck_load'
  /** Sustained hard gripping. */
  | 'grip_load';

/**
 * Name patterns → what the movement asks of the body.
 *
 * Order does not matter; every rule that matches contributes its tag. Patterns
 * are matched case-insensitively against the whole exercise name, so a circuit
 * picks up a tag from any movement inside it.
 */
const TAG_RULES: { tag: StressTag; test: RegExp }[] = [
  // Feet leaving the ground, and the landings that follow.
  { tag: 'high_impact', test: /\bjump|jumping|plyo|burpee|\bhop\b|bound\b|skater|tuck jump|depth drop|depth jump|power skip|\bskip\b|jump rope|high knees|mountain climber|sprint|stepping jack|jumping jack|box jump|broad jump|vertical jump|drop squat/i },
  { tag: 'ankle_load', test: /\bjump|plyo|burpee|\bhop\b|bound\b|skater|sprint|jump rope|\bskip\b|calf raise|calf press|heel raise|toe raise|pogo/i },

  // Knee.
  { tag: 'deep_knee_flexion', test: /bulgarian|split squat|sissy squat|pistol|cossack|curtsy|hack squat|deep squat|\bfront squat\b|overhead squat|walking lunge|reverse lunge|lateral lunge|forward lunge|\blunge\b|step-up|step up|knee drive/i },
  { tag: 'open_chain_knee', test: /leg extension|knee extension|quad extension/i },

  // Hip and low back.
  { tag: 'loaded_hinge', test: /deadlift|romanian|\brdl\b|good morning|kb swing|kettlebell swing|\bswing\b|hip thrust|clean\b|snatch|jefferson|back extension|hyperextension|jump shrug/i },
  { tag: 'spinal_compression', test: /back squat|front squat|overhead squat|zercher|barbell squat|standing (?:overhead|military|shoulder) press|push press|jerk|\bthruster\b|farmer|yoke|good morning|\bshrug\b/i },
  { tag: 'lumbar_flexion', test: /sit-up|situp|crunch|toe touch|jackknife|v-up|\bv up\b|roll-?up|jefferson curl|russian twist/i },

  // Shoulder, elbow, wrist, neck.
  { tag: 'overhead', test: /overhead|\bohp\b|military press|shoulder press|push press|\bjerk\b|snatch|handstand|pull-?up|chin-?up|lat pulldown|\bthruster\b|\bpress-?out\b/i },
  // \brings?\b, not ring\b. Without the leading boundary it matched "Nordic
  // HamstRING Curl", so reporting shoulder pain removed a hamstring exercise.
  { tag: 'shoulder_end_range', test: /\bdips?\b|\bfly\b|\bflye\b|pec deck|upright row|behind[- ]the[- ]neck|behind neck|\bpullover\b|deep push-?up|\brings?\b/i },
  { tag: 'elbow_load', test: /\bcurl\b|curls\b|skull ?crusher|triceps? extension|triceps? pushdown|pushdown|kickback|\bdip\b|dips\b|chin-?up|preacher|concentration/i },
  { tag: 'wrist_load', test: /push-?up|plank|bear crawl|front rack|handstand|burpee|renegade|\bdip\b|dips\b|upright row|wrist curl|mountain climber/i },
  { tag: 'neck_load', test: /\bshrug\b|behind[- ]the[- ]neck|behind neck|neck (?:curl|extension|bridge)|\bbridge\b/i },
  // Sustained hard gripping — carries, hangs, heavy pulls from the floor. NOT
  // every row: a cable row is a back exercise you happen to hold, and banning
  // all rowing on a sore wrist took out 20% of the catalogue for no good reason.
  { tag: 'grip_load', test: /deadlift|farmer|\bcarry\b|carries|\bhang\b|hanging|pull-?up|chin-?up|snatch|\bclean\b|fat grip|grip strength|gripper|kettlebell swing|\bkb swing\b/i },
];

/**
 * What each complaint should be kept away from.
 *
 * Read this as "someone whose X is bothering them today should not be doing…".
 * It is intentionally conservative for joints and lighter for muscles: a sore
 * quad is a reason to avoid deep loaded knee bending for a session, a painful
 * knee is a reason to avoid it and everything that lands hard on top.
 */
export const RESTRICTED_BY_REGION: Record<PainRegion, StressTag[]> = {
  // ── Joints ────────────────────────────────────────────────────────────────
  knee: ['high_impact', 'deep_knee_flexion', 'open_chain_knee'],
  ankle_achilles: ['high_impact', 'ankle_load'],
  hip_groin: ['high_impact', 'deep_knee_flexion', 'loaded_hinge'],
  lower_back: ['high_impact', 'spinal_compression', 'lumbar_flexion', 'loaded_hinge'],
  upper_back: ['spinal_compression', 'overhead', 'neck_load'],
  neck: ['neck_load', 'overhead', 'spinal_compression'],
  front_shoulder: ['overhead', 'shoulder_end_range'],
  rear_shoulder: ['overhead', 'shoulder_end_range'],
  elbow: ['elbow_load', 'overhead', 'wrist_load'],
  wrist: ['wrist_load', 'grip_load'],

  // ── Muscles / soft tissue ─────────────────────────────────────────────────
  calf_shin: ['high_impact', 'ankle_load'],
  quads: ['deep_knee_flexion', 'open_chain_knee', 'high_impact'],
  hamstrings: ['loaded_hinge', 'high_impact'],
  glutes: ['loaded_hinge', 'high_impact'],
  chest: ['shoulder_end_range'],
  bicep: ['elbow_load', 'grip_load'],
  tricep: ['elbow_load', 'overhead'],
  lat_mid_back: ['loaded_hinge', 'spinal_compression'],
  core_ribs: ['lumbar_flexion', 'loaded_hinge'],
};

/** Plain-English name for a tag, for the line shown on a substituted card. */
export const STRESS_TAG_LABELS: Record<StressTag, string> = {
  high_impact: 'jumping and landing',
  deep_knee_flexion: 'deep knee bending',
  open_chain_knee: 'loaded knee extension',
  loaded_hinge: 'loaded hip hinging',
  spinal_compression: 'loading through the spine',
  lumbar_flexion: 'rounding the lower back',
  overhead: 'overhead work',
  shoulder_end_range: 'end-range shoulder work',
  elbow_load: 'loaded elbow work',
  wrist_load: 'weight through the wrists',
  ankle_load: 'loading the ankle',
  neck_load: 'loading the neck and traps',
  grip_load: 'hard gripping',
};

/**
 * Everything a movement asks of the body, derived from its name.
 *
 * `movementPattern` is used only as a backstop for names the patterns miss —
 * a hinge or a squat that is named after its equipment rather than its shape.
 */
export function stressTagsFor(name: string, movementPattern?: string): StressTag[] {
  const tags = new Set<StressTag>();
  for (const rule of TAG_RULES) {
    if (rule.test.test(name)) tags.add(rule.tag);
  }
  if (movementPattern === 'hinge' && /barbell|dumbbell|\bdb\b|\bkb\b|kettlebell|trap bar/i.test(name)) {
    tags.add('loaded_hinge');
  }
  return [...tags];
}

/**
 * The tags that are off-limits for this user today.
 *
 * BEGINNER SAFETY OVERRIDE. A beginner reporting any complaint at all loses
 * high-impact work across the board, not just the impact that happens to load
 * the sore joint. Someone new to training has neither the landing mechanics nor
 * the tissue tolerance to absorb plyometrics, and "my shoulder hurts" is not a
 * reason to have them doing box jumps either. Experienced lifters keep whatever
 * their specific complaint does not rule out.
 */
export function restrictedTagsFor(
  regions: PainRegion[] | undefined,
  experience?: ExperienceLevel
): Set<StressTag> {
  const banned = new Set<StressTag>();
  if (!regions || regions.length === 0) return banned;
  for (const r of regions) {
    for (const tag of RESTRICTED_BY_REGION[r] ?? []) banned.add(tag);
  }
  if (experience === 'beginner') banned.add('high_impact');
  return banned;
}

/** The restricted tags a given movement carries. Empty means it is fine. */
export function restrictedTagsOn(
  name: string,
  banned: Set<StressTag>,
  movementPattern?: string
): StressTag[] {
  if (banned.size === 0) return [];
  return stressTagsFor(name, movementPattern).filter((t) => banned.has(t));
}

/**
 * Blocks the screen must not touch.
 *
 * The prehab block is chosen FOR the sore region — when someone reports knee
 * pain, `getRegionPrehabWorkout('knee')` hands back the knee work. Screening it
 * removes the treatment because it mentions the knee, which is exactly
 * backwards. Measured: without this exemption, reporting knee pain deleted
 * Terminal Knee Extension (a standard patellofemoral rehab exercise) and
 * replaced it with a step-down, which is harder on the joint.
 *
 * Whole session types are exempted for the same reason: a rehab or mobility
 * session IS the adaptation.
 */
export const SCREEN_EXEMPT_CATEGORIES: ExerciseCategory[] = ['prehab'];
export const SCREEN_EXEMPT_SESSION_TYPES = ['prehab', 'flexibility'] as const;

/**
 * Categories that may simply be dropped when nothing safe can replace them.
 *
 * A session without a finisher is a shorter session; a session without its main
 * lift is not the session the user asked for. Where a main lift cannot be made
 * safe the search widens rather than giving up (see the engine), so this list
 * is about optional blocks only.
 */
export const DROPPABLE_CATEGORIES: ExerciseCategory[] = [
  'finisher',
  'neuro',
  'mechanical',
  'cardio',
];

/** The sentence shown on a card that was changed for safety. */
export function substitutionNote(originalName: string, regionLabel: string): string {
  return `Swapped from ${originalName} to protect your ${regionLabel.toLowerCase()}`;
}
