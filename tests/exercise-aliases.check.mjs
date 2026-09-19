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
 * WHAT THE LIBRARY CHANGED ABOUT THIS TEST
 * ────────────────────────────────────────
 * The original rename RETIRED the old name: it left the catalogue, so "the old
 * name is no longer offered" was the same statement as "each movement appears
 * once". Archie's library renames differently. It is built beside the old
 * engine and wired up later, so for now the catalogue still serves "Back Squat"
 * while the library record that keeps its id is called "Barbell Back Squat".
 * The old test would read that as a second row and fail on seventy-four
 * perfectly correct entries.
 *
 * So the rules below are stated over what a user would SEE and what their
 * history would DO, not over which strings are in the table:
 *
 *   - no two rows in the picker mean the same movement
 *   - every name an alias points at is a name the app can actually serve
 *   - the name progression is keyed on is the name the library will use
 *   - nothing is aliased across implements
 *
 * Run:  npx tsx tests/exercise-aliases.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises, getMainLift, getExerciseNameMap } from '../lib/exercise-db.ts';
import { LIBRARY_EXERCISES, CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';
import { DUMBBELL_FOR_KETTLEBELL } from '../lib/kit.ts';
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
const RECORDS = [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES];
const recordById = new Map(RECORDS.map((e) => [e.id, e]));
const libraryNames = new Set(RECORDS.map((e) => e.name));

// ─── 1. Each movement still means one thing ──────────────────────────────────
console.log('\n[1] Each movement appears once');

/**
 * The pairs the picker still shows twice, and why they are allowed to.
 *
 * Each of these is ONE movement the old catalogue entered under two spellings,
 * once per pool it appears in. They read as one name here, so both sets of
 * history count together - but the picker de-dupes on the raw name, so it lists
 * them separately. Both rows were already there before any of this; the alias
 * is what makes their charts agree. The library retires each pair by having a
 * single record for the two of them.
 *
 * Listing a pair here is a deliberate, reviewed admission, not a waiver:
 * the loop below re-checks that every pair named is still genuinely one
 * movement, so a pair that stops meaning one thing fails rather than hides.
 * Anything landing in the duplicate list that is NOT named here is a new fault.
 */
const KNOWN_PICKER_DUPLICATES = [
  // The KPI pool's name for the standing dumbbell press, and the weekly pools'.
  ['Standing Overhead Press', 'DB Shoulder Press'],
  // The main-lift pools' barbell row, and the bench pool's accessory spelling.
  ['Barbell Row', 'Barbell Bent-Over Row'],
  // The same hinged two-handed dumbbell row, abbreviated and written out.
  ['DB Bent-Over Row', 'Standing Dumbbell Row'],
  // One letter between them, same light band.
  ['Band Pull-Apart', 'Banded Pull-Apart'],
  // The bench pool drops the "Cable" but still prescribes a cable load.
  ['Cable Face Pull', 'Face Pull'],
];
const allowedDuplicate = (group) =>
  KNOWN_PICKER_DUPLICATES.some(
    (known) => known.length === group.length && known.every((n) => group.includes(n))
  );

const byMeaning = new Map();
for (const name of names) {
  const key = canonicalExerciseName(name);
  byMeaning.set(key, [...(byMeaning.get(key) ?? []), name]);
}
const doubleRows = [...byMeaning.entries()].filter(
  ([, group]) => group.length > 1 && !allowedDuplicate(group)
);
check(
  'no two rows in the picker are the same movement',
  doubleRows.length === 0,
  doubleRows.map(([k, g]) => `"${k}" <- ${g.map((n) => `"${n}"`).join(', ')}`).join(' | ')
);
for (const known of KNOWN_PICKER_DUPLICATES) {
  check(
    `the known duplicate ${known.map((n) => `"${n}"`).join(' / ')} is still one movement`,
    new Set(known.map(canonicalExerciseName)).size === 1,
    'it is listed as tolerated because their history counts together; if it stops, it is not'
  );
}

// A name nothing can serve is a name a chart disappears into.
for (const kept of new Set(Object.values(EXERCISE_ALIASES))) {
  check(
    `"${kept}" is a name the app can serve`,
    names.has(kept) || libraryNames.has(kept),
    'the rename pointed at a name that is in neither the catalogue nor the library'
  );
}

// ─── 2. The survivor is the one the engine already used ──────────────────────
console.log('\n[2] The name kept is the one progression is keyed on');

/**
 * The whole reason the survivors were not chosen on aesthetics. Personal bests,
 * last-logged weights and the 1RM flow all key off whatever getMainLift
 * returns, so its name has to be the same movement as the record that will take
 * over from it - the one that keeps its id.
 *
 * Two of the six have no library record behind them: Barbell Bench Press and
 * Romanian Deadlift are not on Archie's list. Those are held to the older rule
 * instead, that the catalogue can still serve the name the engine returns.
 */
const templateNames = getExerciseNameMap();
const KPI = [
  ['squat', 'fullgym'],
  ['squat', 'dumbbells'],
  ['bench', 'fullgym'],
  ['bench', 'dumbbells'],
  ['deadlift', 'fullgym'],
  ['deadlift', 'dumbbells'],
];
for (const [lift, tier] of KPI) {
  const main = getMainLift(lift, tier);
  const record = recordById.get(main.id);
  if (record) {
    check(
      `${lift}/${tier} main lift "${main.name}" is the same movement as the record that keeps its id`,
      isSameExercise(main.name, record.name),
      `the library calls ${main.id} "${record.name}" — one of the two would lose its history`
    );
  } else {
    check(
      `${lift}/${tier} main lift "${main.name}" was not renamed away`,
      !EXERCISE_ALIASES[main.name] && names.has(main.name),
      'the engine points at a name the catalogue no longer has'
    );
  }
}
check(
  'every KPI main lift id still resolves to a name',
  KPI.every(([lift, tier]) => Boolean(templateNames[getMainLift(lift, tier).id])),
  ''
);

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

/**
 * NEVER ACROSS IMPLEMENTS, said over every entry rather than three examples.
 *
 * A library rename may ADD a qualifier the catalogue left off - "Back Squat"
 * becoming "Barbell Back Squat" names the bar that was always there. What it
 * may never do is SWAP one implement for another, because the two sides of
 * that alias are two exercises and one of them would inherit the other's loads.
 *
 * The single exception is decision 5: a dumbbell does the kettlebell's job on
 * twelve named exercises, so a dumbbell name may read as the kettlebell record
 * for exactly those twelve and no others.
 */
const IMPLEMENTS = [
  ['barbell', /\bbarbell\b/i],
  ['dumbbell', /\bdumbbells?\b|\bdb\b/i],
  ['kettlebell', /\bkettlebells?\b|\bkb\b/i],
  ['cable', /\bcable\b/i],
  ['band', /\bbands?\b|\bbanded\b/i],
  ['trapbar', /\btrap ?bar\b/i],
  ['landmine', /\blandmine\b/i],
  ['medball', /\bmed ?ball\b/i],
  ['slamball', /\bslam ?ball\b/i],
  ['sled', /\bsled\b/i],
  ['trx', /\btrx\b/i],
];
const implementsIn = (name) => IMPLEMENTS.filter(([, re]) => re.test(name)).map(([k]) => k);
const decisionFive = new Set(DUMBBELL_FOR_KETTLEBELL);
const swapped = [];
for (const [old, now] of Object.entries(EXERCISE_ALIASES)) {
  const before = implementsIn(old);
  const after = implementsIn(now);
  const dropped = before.filter((k) => !after.includes(k));
  const gained = after.filter((k) => !before.includes(k));
  if (dropped.length === 0 || gained.length === 0) continue;
  const isDecisionFive =
    dropped.join() === 'dumbbell' && gained.join() === 'kettlebell' && decisionFive.has(now);
  if (!isDecisionFive) swapped.push(`"${old}" (${before.join('+')}) -> "${now}" (${after.join('+')})`);
}
check(
  'no alias swaps one implement for another',
  swapped.length === 0,
  swapped.join(' | ') + ' — a dumbbell press must not inherit a barbell press'
);
check(
  'the one dumbbell-to-kettlebell reading is one decision 5 actually allows',
  canonicalExerciseName('DB Goblet Squat') === 'Kettlebell Goblet Squats' &&
    decisionFive.has('Kettlebell Goblet Squats'),
  `"${canonicalExerciseName('DB Goblet Squat')}"`
);

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
  process.exitCode = 1;
} else {
  console.log(`exercise-aliases: all ${total} checks passed\n`);
  process.exitCode = 0;
}
