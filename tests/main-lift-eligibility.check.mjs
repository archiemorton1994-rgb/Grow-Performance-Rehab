/**
 * Contract test: what the app will let you build a session around.
 *
 * WHAT WAS WRONG
 * ──────────────
 * "Main Lift" is a property of the movement rather than of the template slot —
 * that is the whole point of lib/exercise-classification.ts, and it is right.
 * But the rule that decided it counted supporting muscles, and a count cannot
 * tell a lift from a hold. Four movements came out as lifts to open a session
 * with, alongside a back squat:
 *
 *   Dead Hang      hanging off a bar, listed under "Grip/Forearms"
 *   Donkey Kick    a banded glute kick on all fours
 *   Curtsy Lunge   glute-medius work, listed with three supporting muscles
 *   DB Pullover    arms straight, one joint moving
 *
 * Two rules replace the count where the count was blind, and both say something
 * general rather than naming exercises: a movement aimed at a small stabiliser
 * or at the grip is support work whatever else is true of it, and a straight-arm
 * movement is a one-joint movement whatever it is filed as.
 *
 * WHAT THIS PROTECTS
 * ──────────────────
 *   DEMOTED  the four, and the movements the same rules catch, stay out
 *   KEPT     the demotion did not take the real lifts with it
 *   USABLE   every focus and every equipment tier still has a KPI step worth
 *            looking at — a rule that empties a list is not an improvement
 *
 * Run:  npx tsx tests/main-lift-eligibility.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises } from '../lib/exercise-db.ts';
import { canBeMainLift, patternGroupOf, tierOf } from '../lib/exercise-classification.ts';
import {
  SESSION_FOCUSES,
  blocksForGoal,
  optionsForBlock,
  ownedTiersFor,
} from '../lib/session-builder.ts';

let failures = 0;
let total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

const all = getAllPickableExercises();
const byName = new Map(all.map((p) => [p.template.name.toLowerCase(), p.template]));
const get = (n) => byName.get(n.toLowerCase());

// ─── 1. The movements that are not lifts ─────────────────────────────────────
console.log('\n[1] A hold, a kick and a stabiliser drill are not main lifts');

const DEMOTED = [
  ['Dead Hang', 'a hang is not a lift, and the grip is not a prime mover'],
  ['Donkey Kick', 'one joint, on all fours, against a band'],
  ['Curtsy Lunge', 'glute-medius work — nobody builds a session on it'],
  ['DB Pullover', 'the elbows never bend'],
  // Caught by the same two rules, and just as wrong where they were.
  ['Straight Arm Pulldown', 'the same movement as a pullover, on a cable'],
  ['Scapular Push-Up', 'a scapular drill, listed under the serratus'],
];
for (const [name, why] of DEMOTED) {
  const t = get(name);
  check(`"${name}" cannot lead a session`, !!t && !canBeMainLift(t), t ? why : 'not in the catalogue');
}

// The rules, stated as properties, so a new exercise that trips them is caught
// on the day it is added rather than the day somebody notices it in the list.
const STABILISER_PRIME_MOVER =
  /glute medius|rotator cuff|infraspinatus|\bgrip\b|forearm|serratus|transversus|tibialis|hip flexor|neck/i;
const eligible = all.filter((p) => canBeMainLift(p.template));

const stabiliserLed = eligible
  .filter((p) => STABILISER_PRIME_MOVER.test(p.template.primaryMuscle ?? ''))
  .map((p) => `${p.template.name} (${p.template.primaryMuscle})`);
check(
  'nothing offered as a main lift is aimed at a stabiliser or the grip',
  stabiliserLed.length === 0,
  stabiliserLed.join(', ')
);

const straightArm = eligible
  .filter((p) => /pullover|straight.?arm/i.test(p.template.name))
  .map((p) => p.template.name);
check(
  'and nothing offered as a main lift keeps its elbows locked',
  straightArm.length === 0,
  straightArm.join(', ')
);

// ─── 2. The real lifts survived ──────────────────────────────────────────────
console.log('\n[2] The rules did not take the actual lifts with them');

const KEPT = [
  'Back Squat',
  'Barbell Deadlift',
  'Barbell Bench Press',
  'Barbell Row',
  'Overhead Press',
  'Goblet Squat',
  'Romanian Deadlift',
  'Lat Pulldown',
  'Leg Press',
  'Pull-Up',
  'Chin-Up',
  'Push-Up',
  'Bulgarian Split Squat',
  'Barbell Hip Thrust',
  'Inverted Row',
  'DB Shoulder Press',
];
for (const name of KEPT) {
  const t = get(name);
  check(`"${name}" still can`, !!t && canBeMainLift(t), t ? `now ${tierOf(t)}` : 'not in the catalogue');
}

check(
  `the pool is still a pool, not a shortlist (${eligible.length})`,
  eligible.length > 100,
  'a goblet squat leading a session is the reason this module exists'
);

const emptyPatterns = ['knee_dominant', 'hip_dominant', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'].filter(
  (g) => eligible.filter((p) => patternGroupOf(p.template) === g).length === 0
);
check(
  'every compound pattern still has lifts in it',
  emptyPatterns.length === 0,
  `${emptyPatterns.join(', ')} — a split cannot be built from an empty pattern`
);

// ─── 3. The KPI step is still worth opening ──────────────────────────────────
console.log('\n[3] Every focus, at every equipment tier, still offers a choice');

const kpiBlock = blocksForGoal('athletic').find((b) => b.id === 'kpi');
const demotedNames = new Set(DEMOTED.map(([n]) => n.toLowerCase()));
const thin = [];
const leaked = [];
for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
  const owned = ownedTiersFor(tier);
  for (const focus of SESSION_FOCUSES) {
    const { options } = optionsForBlock(kpiBlock, { focus: focus.key, kpi: null }, owned);
    // Four is the floor a bodyweight pull day honestly has; below that the step
    // stops being a choice and the rules have cut too deep.
    if (options.length < 4) thin.push(`${tier}/${focus.key}=${options.length}`);
    for (const t of options) {
      if (demotedNames.has(t.name.toLowerCase())) leaked.push(`${tier}/${focus.key}: ${t.name}`);
    }
  }
}
check('no focus and tier is left with fewer than four lifts', thin.length === 0, thin.join(', '));
check(
  'and none of the demoted movements is still on offer there',
  leaked.length === 0,
  leaked.join(', ')
);

console.log('');
if (failures > 0) {
  console.error(`main-lift-eligibility: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`main-lift-eligibility: all ${total} checks passed\n`);
  process.exit(0);
}
