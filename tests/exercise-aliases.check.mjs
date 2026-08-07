/**
 * Contract test: one movement, one name — without losing anyone's history.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Reported: "in custom there is 'barbell bench' and then regular bench. Same
 * for other key lifts. Whichever exercises are being used as main KPI lifts,
 * the other must go. Anything where they are genuine variants can stay."
 *
 * The cause was two collections. The same movement had been entered once in the
 * KPI-lift pool and once in the weekly-session pool, under slightly different
 * names. Both entries were real — a KPI bench is 5×5-6 and a weekly bench is
 * 4×8-10, so the programming genuinely differs — but there is only one Bench
 * Press, and the picker was showing it twice.
 *
 * THE DANGEROUS PART is not the rename. Completed sessions store `exerciseName`
 * as a string, and personal bests, progress charts and recalled notes all key
 * off it. Renaming an exercise therefore splits every user's history in two:
 * their bench stops having a personal best, their chart restarts at zero, and
 * the old data sits there under a name nothing looks for. Most of this file is
 * about that, not about the names.
 *
 * Run:  npx tsx tests/exercise-aliases.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises, getMainLift } from '../lib/exercise-db.ts';
import { EXERCISE_ALIASES, canonicalExerciseName, isSameExercise } from '../lib/exercise-aliases.ts';

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
const names = new Set(all.map((p) => p.template.name));

// ─── 1. The retired names are gone from the catalogue ────────────────────────
console.log('\n[1] Each movement appears once');

for (const old of Object.keys(EXERCISE_ALIASES)) {
  check(`"${old}" is no longer offered`, !names.has(old), 'the picker would show it as a second row');
}
for (const kept of new Set(Object.values(EXERCISE_ALIASES))) {
  check(`"${kept}" survives`, names.has(kept), 'the rename pointed at a name that does not exist');
}

// ─── 2. The survivor is the one the engine already used ──────────────────────
console.log('\n[2] The name kept is the one progression is keyed on');

// This is the whole reason the survivors were not chosen on aesthetics. Personal
// bests, last-logged weights and the 1RM flow all key off whatever getMainLift
// returns; keeping the other name in each pair would have moved the problem
// rather than fixed it.
const KPI = [
  ['squat', 'fullgym'],
  ['squat', 'dumbbells'],
  ['bench', 'fullgym'],
  ['bench', 'dumbbells'],
  ['deadlift', 'fullgym'],
  ['deadlift', 'dumbbells'],
];
for (const [lift, tier] of KPI) {
  const name = getMainLift(lift, tier).name;
  check(
    `${lift}/${tier} main lift "${name}" was not renamed away`,
    !EXERCISE_ALIASES[name] && names.has(name),
    'the engine points at a name the catalogue no longer has'
  );
}

// ─── 3. Genuine variants were left alone ─────────────────────────────────────
console.log('\n[3] Different equipment is a different exercise');

for (const pair of [
  ['Barbell Bench Press', 'Dumbbell Bench Press'],
  ['Back Squat', 'Goblet Squat'],
  ['Barbell Deadlift', 'Romanian Deadlift'],
]) {
  check(
    `"${pair[0]}" and "${pair[1]}" both remain`,
    names.has(pair[0]) && names.has(pair[1]),
    'these are two exercises, not one exercise with two names'
  );
  check(
    `and they are not treated as the same movement`,
    !isSameExercise(pair[0], pair[1]),
    ''
  );
}

// ─── 4. Nobody's history is orphaned ─────────────────────────────────────────
console.log('\n[4] Data logged under the old name still counts');

for (const [old, now] of Object.entries(EXERCISE_ALIASES)) {
  check(
    `a session logged as "${old}" resolves to "${now}"`,
    canonicalExerciseName(old) === now,
    'without this the user loses that exercise\'s personal best and its whole chart'
  );
}
check(
  'a name with no alias is returned untouched',
  canonicalExerciseName('Barbell Hip Thrust') === 'Barbell Hip Thrust',
  'this is applied indiscriminately wherever history is read, so it must be safe on everything'
);
check(
  'aliases do not chain',
  Object.values(EXERCISE_ALIASES).every((v) => !EXERCISE_ALIASES[v]),
  'an alias pointing at another alias resolves to the wrong name in one pass'
);

// ─── 5. The store reads history through it ───────────────────────────────────
console.log('\n[5] The places that read history actually use it');

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const store = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../lib/store.ts'),
  'utf8'
);

check(
  'exercise progress merges on the canonical name',
  /const key = canonicalExerciseName\(log\.exerciseName\);/.test(store),
  'keyed on the raw id, one bench press produced two half-length charts — one per collection it was filed in'
);
check(
  'recalled notes match through it',
  /canonicalExerciseName\(log\.exerciseName\) === canonicalExerciseName\(exerciseName\)/.test(store),
  'a note written against the old name is a note about the same movement'
);

console.log('');
if (failures > 0) {
  console.error(`exercise-aliases: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`exercise-aliases: all ${total} checks passed\n`);
  process.exit(0);
}
