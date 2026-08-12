import type { ExerciseTemplate } from './exercise-db';

/**
 * What kind of movement an exercise is, independent of where it happens to be
 * filed in the session template.
 *
 * WHY THIS EXISTS
 * ───────────────
 * "Main Lift" meant `category === 'main'`, and exactly 22 of 447 exercises are
 * filed that way — essentially the barbell big three and their close variants.
 * So a Goblet Squat, a Lat Pulldown and a Romanian Deadlift could never be a
 * main lift, in any split, for anyone. That is only correct if the app assumes
 * everybody is a powerlifter.
 *
 *   "'Main Lifts' aren't strictly limited to the powerlifting Big Three, but
 *    instead support all major multi-joint compound movement patterns while
 *    retaining flexibility for different training styles like Push/Pull/Legs,
 *    Bodybuilding, and S&C."
 *
 * `category` still describes where an exercise sits in a GENERATED session —
 * that is a programming decision and the engine depends on it. `tier` describes
 * what the movement IS. A Goblet Squat is a primary compound whichever slot it
 * happens to occupy; whether it leads your session is a question about your
 * programme, not about the exercise.
 *
 * DERIVED, NOT HAND-TAGGED
 * ────────────────────────
 * 447 exercises and growing. Hand-tagging goes stale the first week someone
 * adds a movement and forgets a field, and the failure is silent — the exercise
 * simply stops appearing where it should. Everything here is computed from data
 * the templates already carry, with a small override list for the handful the
 * rules get wrong. Same approach as lib/exercise-safety.ts, for the same reason.
 */

/**
 * The six compound patterns a training split is usually built from, plus the
 * categories that are not part of that scheme.
 *
 * `push` and `pull` in the database do not distinguish horizontal from
 * vertical, which is the distinction that actually matters when you are
 * building a Push/Pull/Legs or Upper/Lower week — bench and overhead press are
 * both "push" and you would not program them as the same slot.
 */
export type PatternGroup =
  | 'knee_dominant'
  | 'hip_dominant'
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'carry'
  | 'core'
  | 'conditioning'
  | 'mobility';

export const PATTERN_GROUP_LABELS: Record<PatternGroup, string> = {
  knee_dominant: 'Squat',
  hip_dominant: 'Hinge',
  horizontal_push: 'Push (horizontal)',
  vertical_push: 'Push (vertical)',
  horizontal_pull: 'Pull (horizontal)',
  vertical_pull: 'Pull (vertical)',
  carry: 'Carry',
  core: 'Core',
  conditioning: 'Conditioning',
  mobility: 'Mobility',
};

/** Order the six compound patterns are offered in — legs, push, pull. */
export const COMPOUND_PATTERN_ORDER: PatternGroup[] = [
  'knee_dominant',
  'hip_dominant',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
];

const VERTICAL_PUSH =
  /overhead|\bohp\b|military|shoulder press|push press|\bjerk\b|handstand|pike push|landmine press|arnold|\bz press\b|thruster/i;
const VERTICAL_PULL = /pull-?up|chin-?up|pulldown|pullover|lat pull|\bhang\b|muscle-?up|climb/i;

/**
 * What kind of movement this is.
 *
 * The database's `movementPattern` is the starting point; push and pull are
 * then split by name, because the horizontal/vertical distinction is the one
 * that matters for building a split and the database does not carry it.
 */
export function patternGroupOf(t: ExerciseTemplate): PatternGroup {
  const p = t.movementPattern;
  const name = t.name;

  if (p === 'squat' || p === 'lunge') return 'knee_dominant';
  if (p === 'hinge') return 'hip_dominant';
  if (p === 'carry') return 'carry';
  if (p === 'rotation' || p === 'isometric') return 'core';
  if (p === 'conditioning') return 'conditioning';
  if (p === 'mobility' || p === 'rehabilitation') return 'mobility';
  if (p === 'push') return VERTICAL_PUSH.test(name) ? 'vertical_push' : 'horizontal_push';
  if (p === 'pull') return VERTICAL_PULL.test(name) ? 'vertical_pull' : 'horizontal_pull';

  // No pattern recorded: fall back to the name, then to core, which is the
  // least wrong place for something unclassifiable to sit.
  if (VERTICAL_PUSH.test(name)) return 'vertical_push';
  if (VERTICAL_PULL.test(name)) return 'vertical_pull';
  return 'core';
}

/**
 * How central a movement is.
 *
 *   primary_compound – multi-joint, loadable, worth building a session around
 *   accessory        – multi-joint but supporting, or a lighter compound
 *   isolation        – one joint, one muscle
 *
 * This is what makes "Main Lift" a property of the MOVEMENT rather than of the
 * template slot it was filed in.
 */
export type ExerciseTier = 'primary_compound' | 'accessory' | 'isolation';

/**
 * One joint, one muscle — recognised by what it is called.
 *
 * `pullover` and `straight arm` are the same movement on two implements: the
 * arms never bend, so the shoulder is the only joint doing anything. Both read
 * as vertical pulls by pattern, which is right, and both were being offered as
 * lifts to build a session around, which is not. `kick` covers the quadruped
 * glute kicks alongside the tricep kickbacks that were already here.
 */
const ISOLATION_NAMES =
  /\bcurl\b|curls\b|\braise\b|raises\b|\bfly\b|flye|extension|pushdown|\bkick|pec deck|calf raise|shrug|wrist|rotator|face pull|pull-?apart|leg curl|leg extension|pullover|straight.?arm/i;

/**
 * Muscles nothing is built around.
 *
 * A main lift is named by the muscle it drives, and these are not muscles
 * anybody drives — they are the small stabilisers and the grip, which work hard
 * on plenty of movements and lead none of them. The secondary-muscle count
 * cannot see this: a Dead Hang lists the lats and the shoulder stabilisers
 * behind "Grip/Forearms" and so counts as multi-joint, and a Curtsy Lunge lists
 * three behind "Glute medius". Both were offered as lifts to open a session
 * with, next to a back squat.
 *
 * The same test the session builder already applies when it decides what counts
 * as activation work — lib/session-builder.ts, STABILISER_MUSCLES — for the same
 * reason: nobody trains their rotator cuff or their glute medius for size.
 */
const SUPPORTING_PRIME_MOVERS =
  /glute medius|rotator cuff|infraspinatus|\bgrip\b|forearm|serratus|transversus|tibialis|hip flexor|neck/i;

/**
 * Exercises the rules get wrong, and why.
 *
 * Deliberately short. A long override list means the rules are wrong and should
 * be fixed instead.
 */
const TIER_OVERRIDES: Record<string, ExerciseTier> = {
  // Machine compounds: the database records no secondary muscles for these, but
  // a leg press and a lat pulldown are unambiguously multi-joint and are the
  // main lift in plenty of real programmes.
  'leg press': 'primary_compound',
  'lat pulldown': 'primary_compound',
  'hack squat': 'primary_compound',
  'chest press machine': 'primary_compound',
  'seated cable row': 'primary_compound',
  // A hip thrust is a loaded hinge that most databases record with one muscle.
  'barbell hip thrust': 'primary_compound',
  // Nordic curls are named "curl" but are a hamstring compound, not a bicep
  // isolation — the name rule gets this one exactly backwards.
  'nordic hamstring curl': 'accessory',
  'partial nordic curl': 'accessory',
};

/** Patterns that can carry a session. Conditioning and mobility cannot. */
const COMPOUND_PATTERNS = new Set<PatternGroup>(COMPOUND_PATTERN_ORDER);

export function tierOf(t: ExerciseTemplate): ExerciseTier {
  const override = TIER_OVERRIDES[t.name.toLowerCase()];
  if (override) return override;

  const group = patternGroupOf(t);
  const secondaries = t.secondaryMuscles?.length ?? 0;

  // Anything that is not one of the six compound patterns is not a main lift,
  // whatever else is true of it.
  if (!COMPOUND_PATTERNS.has(group)) {
    return secondaries >= 2 ? 'accessory' : 'isolation';
  }
  if (ISOLATION_NAMES.test(t.name)) return 'isolation';
  // Aimed at a stabiliser, so multi-joint or not it is support work.
  if (SUPPORTING_PRIME_MOVERS.test(t.primaryMuscle ?? '')) {
    return secondaries >= 1 ? 'accessory' : 'isolation';
  }
  // Two or more supporting muscles is the practical definition of multi-joint
  // in this database, and it is the same threshold the session generator
  // already uses to decide whether something can fill a compound slot.
  if (secondaries >= 2) return 'primary_compound';
  return secondaries >= 1 ? 'accessory' : 'isolation';
}

/**
 * Can this exercise lead a session?
 *
 * The question the custom builder asks. Note what it does NOT ask: whether the
 * template is filed under `category: 'main'`. That field says where the
 * generator puts it, which is a different question from what the movement is.
 */
export function canBeMainLift(t: ExerciseTemplate): boolean {
  return tierOf(t) === 'primary_compound';
}

export const TIER_LABELS: Record<ExerciseTier, string> = {
  primary_compound: 'Compound',
  accessory: 'Accessory',
  isolation: 'Isolation',
};
