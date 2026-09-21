/**
 * Contract test: exercise classification, and the plate calculator.
 *
 * WHY CLASSIFICATION MATTERS
 * ──────────────────────────
 * Asked for: "'Main Lifts' aren't strictly limited to the powerlifting Big
 * Three, but instead support all major multi-joint compound movement patterns
 * while retaining flexibility for different training styles."
 *
 * "Main Lift" meant `category === 'main'`, which is 22 of 447 exercises —
 * essentially the barbell big three and their closest variants. A Goblet Squat,
 * a Lat Pulldown or a Romanian Deadlift could never be a main lift, in any
 * split, for anyone. That is only correct if every user is a powerlifter.
 *
 * The distinction that makes this work is between what an exercise IS (its
 * tier) and where the session generator FILES it (its category). Those had been
 * the same field doing two jobs.
 *
 * WHAT READS THESE RULES, AND WHAT ARCHIE'S LIBRARY ADDED
 * ──────────────────────────────────────────────────────
 * In the app, `canBeMainLift` and `tierOf` are read by the CUSTOM session
 * builder and nowhere else (lib/session-builder.ts, app/custom-session.tsx),
 * over the old catalogue in lib/exercise-db.ts. Sections 1 to 3 are that
 * contract and it is still live. The Train sessions do not consult these rules
 * at all: lib/library-session.ts walks each pattern's own pool down the level
 * ladder, so what may lead one of those is a property of Archie's list.
 *
 * Section 3b is the piece the library did add, and it is not decoration.
 * tests/session-variety.check.mjs holds the promise that no isolation movement
 * ever leads a Train session, and it asks that question by running `tierOf`
 * over library RECORDS - a shape these rules were never written for. If the
 * classifier answered "compound" for everything it was handed off that list,
 * because a field it reads is spelled differently there, that promise would go
 * quietly green while the app got worse. So this asks the rules to prove they
 * really discriminate over Archie's list before another file leans on them.
 *
 * Run:  npx tsx tests/exercise-classification.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises } from '../lib/exercise-db.ts';
import {
  canBeMainLift,
  patternGroupOf,
  tierOf,
  COMPOUND_PATTERN_ORDER,
} from '../lib/exercise-classification.ts';
import {
  calculatePlates,
  describePlates,
  groupPlates,
  isBarbellExercise,
  BAR_WEIGHT,
} from '../lib/plate-math.ts';

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

// ─── 1. Main lifts are not just the big three ────────────────────────────────
console.log('\n[1] A main lift is a movement, not a template slot');

const eligible = all.filter((p) => canBeMainLift(p.template));
/**
 * A LIBRARY-TIED FLOOR: MORE THAN ARE FILED AS 'main', NOT A ROUND NUMBER.
 *
 * It read "more than 100", which described a seven-hundred-entry catalogue that
 * no longer exists. What the rule is about is that eligibility is decided by the
 * MOVEMENT rather than by the slot a record happens to be filed in, so the
 * honest floor is that comparison itself: strictly more exercises can lead a
 * session than are filed as main lifts.
 */
const filedAsMain = all.filter((p) => p.template.category === 'main').length;
check(
  `more can lead a session than are filed as one (${eligible.length} against ${filedAsMain})`,
  filedAsMain > 0 && eligible.length > filedAsMain,
  'the whole point is that a goblet squat can lead a session'
);

// Re-pointed at the library's spellings. The old catalogue's Goblet Squat,
// Romanian Deadlift, Lat Pulldown, Push-Up and Leg Press are deleted, and a name
// nothing can serve proves nothing about what may lead a session.
for (const name of [
  'Kettlebell Goblet Squats',
  'Kettlebell Romanian Deadlift',
  'Lat Pulldowns',
  'Dumbbell Bench Press',
  'Push Up',
  'Barbell Back Squat',
]) {
  const t = get(name);
  check(`"${name}" can be a main lift`, !!t && canBeMainLift(t), t ? 'classified below compound' : 'not in the catalogue');
}

// Likewise: the library's isolation work is banded, plated and bodyweight rather
// than the old catalogue's cable stations and dumbbell curls.
for (const name of [
  'Banded Face Pulls',
  'Cable Face Pulls',
  'Standing Calf Raise (slow eccentric)',
]) {
  const t = get(name);
  check(`"${name}" is isolation, not a main lift`, !!t && !canBeMainLift(t), '');
}

// ─── 2. All six patterns are covered ─────────────────────────────────────────
console.log('\n[2] Every compound pattern has main lifts in it');

const empty = [];
for (const g of COMPOUND_PATTERN_ORDER) {
  const n = eligible.filter((p) => patternGroupOf(p.template) === g).length;
  if (n === 0) empty.push(g);
}
check(
  `all ${COMPOUND_PATTERN_ORDER.length} compound patterns are represented`,
  empty.length === 0,
  `${empty.join(', ')} — a split cannot be built from a pattern with nothing in it`
);

// The database records both bench and overhead press as "push". That is the one
// distinction a Push/Pull/Legs or Upper/Lower week actually needs.
check(
  'bench press and overhead press are different patterns',
  patternGroupOf(get('Dumbbell Bench Press')) === 'horizontal_push' &&
    patternGroupOf(get('Standing Dumbbell Press')) === 'vertical_push',
  `${patternGroupOf(get('Dumbbell Bench Press'))} vs ${patternGroupOf(get('Standing Dumbbell Press'))}`
);
check(
  'rows and pull-ups are different patterns',
  patternGroupOf(get('Barbell Row')) === 'horizontal_pull' &&
    patternGroupOf(get('Pull Ups')) === 'vertical_pull',
  `${patternGroupOf(get('Barbell Row'))} vs ${patternGroupOf(get('Pull Ups'))}`
);

// ─── 3. Tier and category stay separate ──────────────────────────────────────
console.log('\n[3] What it is, and where the generator puts it, are different questions');

/**
 * Two exercises are filed as `category: 'main'` and are not compounds.
 *
 * This assertion found them, and they are a DATA problem rather than a rules
 * problem: a Lying Leg Curl is a single-joint hamstring isolation and a Pallof
 * Press is an anti-rotation core exercise. Neither is a main lift by any
 * definition, and both were being offered as one before tier existed.
 *
 * Named rather than tolerated, so the list cannot quietly grow. If a third
 * appears, this fails and someone has to look at it.
 */
/**
 * The old catalogue's two went with it; Archie's list has three of its own.
 *
 * All three curtsy lunges are filed `category: 'main'` because a curtsy lunge is
 * what the library puts in a lunge SLOT, and the classifier says none of them
 * can open a session because their prime mover is the glute medius - which is
 * the rule's own documented judgement, written down beside
 * SUPPORTING_PRIME_MOVERS: nobody builds a session around a stabiliser. The two
 * answers are about different questions and are both right.
 */
const KNOWN_MISFILED = ['Curtsy Lunge', 'Dumbbell Curtsy Lunge', 'Kettlebell Curtsy Lunge'];
const mainCategory = all.filter((p) => p.template.category === 'main');
const misfiled = mainCategory
  .filter((p) => !canBeMainLift(p.template))
  .map((p) => p.template.name);
check(
  "nothing new is filed as category 'main' that is not a compound",
  misfiled.every((n) => KNOWN_MISFILED.includes(n)),
  `${misfiled.filter((n) => !KNOWN_MISFILED.includes(n)).join(', ')} — filed as a main lift but classified below compound`
);
/**
 * Tier and category disagree in BOTH directions, which is the whole claim.
 *
 * The floor was "more than 50 compounds are filed as something other than
 * main", a number taken from the old catalogue. Said as the rule instead: there
 * are compounds filed elsewhere, and there are records filed as main that are
 * not compounds. If either were empty, tier really would be category under
 * another name.
 */
const compoundsFiledElsewhere = eligible.filter((p) => p.template.category !== 'main').length;
check(
  `compounds are filed elsewhere (${compoundsFiledElsewhere}) and main-filed records are not all compounds (${misfiled.length})`,
  compoundsFiledElsewhere > 0 && misfiled.length > 0,
  'if these matched, tier would just be category under another name'
);

/**
 * Nordic curls are named "curl" and are a hamstring compound. The name rule
 * gets this exactly backwards, which is what the override list is for.
 *
 * Asked of Restore's "Nordic Curl Negative (slow)", which is what the app
 * serves now: the old catalogue's "Nordic Hamstring Curl" is deleted, and the
 * override list still carries both spellings so neither loses its answer.
 */
check(
  'the override list catches what the name rule gets wrong',
  tierOf(get('Nordic Curl Negative (slow)')) !== 'isolation',
  'a nordic curl is not a bicep curl'
);

// ─── 3b. The rules answer honestly about Archie's library too ────────────────
console.log("\n[3b] And they really discriminate over Archie's list");

const { LIBRARY_EXERCISES } = await import('../lib/exercise-library.ts');
const libTier = new Map(LIBRARY_EXERCISES.map((r) => [r.name, tierOf(r)]));
const libCount = (t) => [...libTier.values()].filter((x) => x === t).length;

check(
  `every record in the library gets an answer (${LIBRARY_EXERCISES.length} records)`,
  LIBRARY_EXERCISES.length > 100 && [...libTier.values()].every(Boolean),
  'a record the rules cannot read would be silently absent from every tier below'
);

/**
 * ALL THREE TIERS, because one tier for everything is the failure mode.
 *
 * A library record is not an ExerciseTemplate, and if a field the rules read
 * were spelled differently there `tierOf` would fall through to one answer for
 * the whole list rather than throwing. Measured today: 123 compound, 33
 * accessory, 4 isolation. The bar is set at "each tier has something in it",
 * not at those numbers, so re-levelling an exercise does not fail this.
 */
check(
  `all three tiers are represented (${libCount('primary_compound')} compound, ${libCount('accessory')} accessory, ${libCount('isolation')} isolation)`,
  libCount('primary_compound') > 0 && libCount('accessory') > 0 && libCount('isolation') > 0,
  'one tier for the whole library means the rules are not reading it, and every check that leans on them is green for nothing'
);

/**
 * And on the records a physio would name, one per tier.
 *
 * The Banded Serratus Punch is the interesting one: it is support work aimed at
 * a stabiliser, and it is the single exception written down in
 * tests/session-variety.check.mjs for the exercise that may lead a session.
 * If it ever reads as a compound here, that exception goes stale there, so the
 * two files fail together rather than drifting apart.
 */
for (const [name, tier] of [
  ['Barbell Deadlift', 'primary_compound'],
  ['Push Up', 'primary_compound'],
  ['Banded Serratus Punch', 'accessory'],
  ['Banded Face Pulls', 'isolation'],
]) {
  check(
    `"${name}" reads as ${tier}`,
    libTier.get(name) === tier,
    libTier.has(name)
      ? `read as ${libTier.get(name)}`
      : 'not in the library at all, so this assertion has stopped measuring anything'
  );
}

// ─── 4. The plate calculator ─────────────────────────────────────────────────
console.log('\n[4] What to actually put on the bar');

// 100 kg = a 20 kg bar plus 40 a side. Greedy from the heaviest plate gives
// 25 + 15 — two plates, not the three that 20 + 15 + 5 would need. Fewer plates
// is both faster to load and what anyone actually does.
const p100 = calculatePlates(100, 'kg');
check(
  '100 kg = 20 kg bar + 25, 15 per side',
  p100.perSide.join(',') === '25,15' && p100.achievable === 100,
  p100.perSide.join(',')
);
check(
  'and it uses the fewest plates that reach the number',
  p100.perSide.length === 2,
  `${p100.perSide.length} plates a side`
);
const p60 = calculatePlates(60, 'kg');
check('60 kg = 20 per side', p60.perSide.join(',') === '20', p60.perSide.join(','));
check('an empty bar has no plates', calculatePlates(20, 'kg').perSide.length === 0, '');
check('below the bar is flagged, not negative', calculatePlates(15, 'kg').belowBar === true, '');

// The app's own progression works in 2.5 kg steps, which is 1.25 a side. Without
// the small plates, half the weights it prescribes would be unloadable.
const p825 = calculatePlates(82.5, 'kg');
check(
  '82.5 kg loads exactly, using the 1.25s',
  p825.achievable === 82.5 && p825.shortfall === 0,
  `${p825.achievable} (short by ${p825.shortfall})`
);

// Not every number is loadable, and saying so is better than silently rounding.
const odd = calculatePlates(83, 'kg');
check(
  'an unloadable target reports its shortfall',
  odd.shortfall > 0 && odd.achievable < 83,
  `${odd.achievable} / short ${odd.shortfall}`
);

check('pounds use a 45 lb bar', calculatePlates(135, 'lbs').bar === BAR_WEIGHT.lbs, '');
check(
  '135 lb = 45 per side',
  calculatePlates(135, 'lbs').perSide.join(',') === '45',
  calculatePlates(135, 'lbs').perSide.join(',')
);

check(
  'repeats are grouped for display',
  groupPlates([20, 20, 5]).length === 2 && groupPlates([20, 20, 5])[0].count === 2,
  ''
);
check(
  'the one-line description reads like a person wrote it',
  describePlates(p100, 'kg') === '20 kg bar · 25 + 15 per side',
  describePlates(p100, 'kg')
);

// ─── 5. It only offers itself where it applies ───────────────────────────────
console.log('\n[5] The calculator does not appear on a press-up');

for (const n of ['Barbell Bench Press', 'Conventional Deadlift', 'Back Squat', 'Overhead Press']) {
  check(`"${n}" is a barbell lift`, isBarbellExercise(n), '');
}
for (const n of ['Dumbbell Bench Press', 'Push-Up', 'Cable Chest Fly', 'Band Face Pull', 'KB Swing']) {
  check(`"${n}" is not`, !isBarbellExercise(n), '');
}

console.log('');
if (failures > 0) {
  console.error(`exercise-classification: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`exercise-classification: all ${total} checks passed\n`);
  process.exitCode = 0;
}
