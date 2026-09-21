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
 * WHICH SCREEN THIS IS ABOUT, because the name no longer says it on its own
 * ────────────────────────────────────────────────────────────────────────
 * `canBeMainLift` is read in exactly two places, and neither of them is Train:
 * lib/session-builder.ts and app/custom-session.tsx, which is the screen where
 * somebody assembles a session themselves. lib/session-builder.ts is imported
 * by that screen and by nothing else. So this file is the contract for the
 * exercises the CUSTOM builder offers as a lead.
 *
 * WHAT THAT BUILDER NOW DRAWS ON. Its index used to be every collection in
 * lib/exercise-db.ts. It is now Archie's exercise library, the nine conditioning
 * records and the Restore work, and nothing else. So the two halves of this file
 * ask different questions and both are worth asking:
 *
 *   sections 1 and 2 test `canBeMainLift` itself as a rule, over the whole
 *   database, because a rule with a hole in it is worth catching wherever the
 *   hole shows;
 *   section 3 tests the step somebody actually opens, over the library records
 *   it actually offers.
 *
 * The library builder (lib/library-session.ts) still does not consult
 * `canBeMainLift` or `tierOf` at all: it walks the pattern's own pool down the
 * level ladder. Where the two disagree about a library record the document wins
 * and the builder follows it — a Wall Sit passes `canBeMainLift` and the
 * library calls it support work, so the step does not offer it as a lead.
 *
 * The same promise for the sessions Train builds - the exercise that leads one
 * is a compound, at every level and every tier, with the single exception
 * written down - is held in tests/session-variety.check.mjs section 2, where
 * it is measured on generated sessions rather than on a pool.
 *
 * Run:  npx tsx tests/main-lift-eligibility.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises } from '../lib/exercise-db.ts';
import { canBeMainLift, patternGroupOf, tierOf } from '../lib/exercise-classification.ts';
import { LIBRARY_EXERCISES } from '../lib/exercise-library.ts';
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
/** What the document itself calls each movement: main, accessory or power. */
const LIBRARY_ROLE = new Map(LIBRARY_EXERCISES.map((e) => [e.name.toLowerCase(), e.role]));

// ─── 1. The movements that are not lifts ─────────────────────────────────────
console.log('\n[1] A hold, a kick and a stabiliser drill are not main lifts');

/**
 * RE-POINTED AT WHAT THE APP CAN ACTUALLY SERVE.
 *
 * Four of the six were old-catalogue exercises - a Dead Hang, a Donkey Kick, a
 * DB Pullover and a Straight Arm Pulldown - and they are deleted. A name
 * nothing can serve cannot be offered as a main lift, so asserting that it is
 * not offered proves nothing at all.
 *
 * Each rule they stood for keeps an example the app still has: the grip is not
 * a prime mover (a carry), the glute medius is not one either (a curtsy lunge),
 * a scapular drill is not a lift (Restore's Scapular Setting), and a movement
 * whose elbows never bend is not a pull (a Band Straight-Arm Press-Down).
 */
const DEMOTED = [
  ['Dumbbell Farmers Carry', 'a carry is held, not lifted, and the grip is not a prime mover'],
  ['Curtsy Lunge', 'glute-medius work — nobody builds a session on it'],
  ['Band Straight-Arm Press-Down (Short Range)', 'the elbows never bend'],
  ['Scapular Setting (Isometric Squeeze)', 'a scapular drill, listed under the serratus'],
  ['Wall Sit', 'an isometric hold is not a lift'],
  ['Band Pull Aparts', 'a light band for the rear shoulder, one joint'],
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

/**
 * THE REAL LIFTS, IN ARCHIE'S SPELLINGS.
 *
 * The same sixteen movements as far as the library still has them: it holds no
 * Leg Press, no Barbell Hip Thrust and no barbell bench or overhead press, so
 * those are covered by the nearest thing on the list that does the same job.
 * A name the app cannot serve cannot be verified as still able to lead a
 * session, which is what every one of these read as after the purge.
 */
const KEPT = [
  'Barbell Back Squat',
  'Barbell Deadlift',
  'Dumbbell Bench Press',
  'Barbell Row',
  'Standing Dumbbell Press',
  'Kettlebell Goblet Squats',
  'Kettlebell Romanian Deadlift',
  'Lat Pulldowns',
  'Trapbar Deadlift (low handles)',
  'Pull Ups',
  'Chin Ups',
  'Push Up',
  'Bulgarian Split Squat',
  'Sumo Deadlift',
  'Rack Rows',
  'Seated Dumbbell Press',
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
/**
 * Driven at the top rung, and at four rather than one.
 *
 * The floor below is a claim about the RULES not cutting too deep, so it has to
 * be asked of the whole pool the rules see. The level ceiling is a separate cut
 * and a deliberate one: a beginner with no kit really does have a single
 * pressing main in the library, which is the library being honest rather than
 * the eligibility rules being wrong. That cut is guarded in
 * tests/session-builder.check.mjs section 4b.
 */
const TOP_RUNG = 4;

/**
 * THE FLOOR IS TIED TO THE LIBRARY, NOT TO A NUMBER.
 *
 * It used to be "at least four lifts per focus and tier", which was an honest
 * reading of a 442-exercise catalogue and is not one of a 160-record library:
 * the only pull a bodyweight user has in the library is Door Frame Rows, and
 * the library puts it there on purpose so that nobody is left without a pull.
 * Holding the step to four would have meant one of two bad answers — inventing
 * a lift, or widening past the kit rules the step exists to respect.
 *
 * So the question is asked the other way round, which is the question this file
 * was always really asking: does the step offer every main movement the library
 * has for that person, or do the eligibility rules drop one? An eligibility
 * rule that started refusing squats would empty the step, and that is what
 * fails here — not a count.
 */
const REFUSED = [];
for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
  const owned = ownedTiersFor(tier);
  for (const focus of SESSION_FOCUSES) {
    const { options } = optionsForBlock(kpiBlock, { focus: focus.key, kpi: null, ceiling: TOP_RUNG }, owned);
    const offered = new Set(options.map((t) => t.name));
    // Everything the equipment rules already let this person see in the whole
    // index, narrowed to the patterns this focus trains.
    const { all: everything } = optionsForBlock(
      blocksForGoal('athletic').find((b) => b.id === 'accessory'),
      { focus: focus.key, kpi: null, ceiling: TOP_RUNG },
      owned
    );
    for (const t of everything) {
      if (!focus.patterns.includes(patternGroupOf(t))) continue;
      if (offered.has(t.name)) continue;
      // The library's own word outranks the movement rules. A Wall Sit and a
      // Glute Bridge are both loaded enough for canBeMainLift to accept, and
      // the document calls both support work; keeping them out of this step is
      // the library working, not an eligibility rule cutting too deep.
      if (LIBRARY_ROLE.get(t.name.toLowerCase()) !== 'main') continue;
      if (canBeMainLift(t)) REFUSED.push(`${tier}/${focus.key}: ${t.name}`);
    }
    if (options.length === 0) thin.push(`${tier}/${focus.key}=0`);
    for (const t of options) {
      if (demotedNames.has(t.name.toLowerCase())) leaked.push(`${tier}/${focus.key}: ${t.name}`);
    }
  }
}
check('no focus and tier is left without a lift at all', thin.length === 0, thin.join(', '));
check(
  'and no movement the rules accept as a main lift is missing from the step',
  REFUSED.length === 0,
  [...new Set(REFUSED)].slice(0, 8).join(', ')
);
check(
  'and none of the demoted movements is still on offer there',
  leaked.length === 0,
  leaked.join(', ')
);

console.log('');
if (failures > 0) {
  console.error(`main-lift-eligibility: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`main-lift-eligibility: all ${total} checks passed\n`);
  process.exitCode = 0;
}
