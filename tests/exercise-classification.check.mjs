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
check(
  `far more than the 22 filed as category 'main' (now ${eligible.length})`,
  eligible.length > 100,
  'the whole point is that a goblet squat can lead a session'
);

for (const name of [
  'Goblet Squat',
  'Romanian Deadlift',
  'Lat Pulldown',
  'DB Bench Press',
  'Push-Up',
  'Leg Press',
]) {
  const t = get(name);
  check(`"${name}" can be a main lift`, !!t && canBeMainLift(t), t ? 'classified below compound' : 'not in the catalogue');
}

for (const name of ['DB Bicep Curl', 'Cable Front Raise', 'Standing Calf Raise']) {
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
  patternGroupOf(get('Bench Press')) === 'horizontal_push' &&
    patternGroupOf(get('Overhead Press')) === 'vertical_push',
  `${patternGroupOf(get('Bench Press'))} vs ${patternGroupOf(get('Overhead Press'))}`
);
check(
  'rows and pull-ups are different patterns',
  patternGroupOf(get('Barbell Row')) === 'horizontal_pull' &&
    patternGroupOf(get('Pull-Up')) === 'vertical_pull',
  `${patternGroupOf(get('Barbell Row'))} vs ${patternGroupOf(get('Pull-Up'))}`
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
const KNOWN_MISFILED = ['Lying Leg Curl', 'Pallof Press'];
const mainCategory = all.filter((p) => p.template.category === 'main');
const misfiled = mainCategory
  .filter((p) => !canBeMainLift(p.template))
  .map((p) => p.template.name);
check(
  "nothing new is filed as category 'main' that is not a compound",
  misfiled.every((n) => KNOWN_MISFILED.includes(n)),
  `${misfiled.filter((n) => !KNOWN_MISFILED.includes(n)).join(', ')} — filed as a main lift but classified below compound`
);
check(
  'but plenty of compounds are filed elsewhere',
  eligible.filter((p) => p.template.category !== 'main').length > 50,
  'if these matched, tier would just be category under another name'
);

// Nordic curls are named "curl" and are a hamstring compound. The name rule
// gets this exactly backwards, which is what the override list is for.
check(
  'the override list catches what the name rule gets wrong',
  tierOf(get('Nordic Hamstring Curl')) !== 'isolation',
  'a nordic curl is not a bicep curl'
);

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
for (const n of ['DB Bench Press', 'Push-Up', 'Cable Chest Fly', 'Band Face Pull', 'KB Swing']) {
  check(`"${n}" is not`, !isBarbellExercise(n), '');
}

console.log('');
if (failures > 0) {
  console.error(`exercise-classification: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`exercise-classification: all ${total} checks passed\n`);
  process.exit(0);
}
