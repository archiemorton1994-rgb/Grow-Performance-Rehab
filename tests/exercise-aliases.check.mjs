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
 * once". Archie's library is a different list rather than a rename of the old
 * one, and now that the old catalogue is deleted a good part of the alias table
 * describes exercises the app no longer has at all.
 *
 * So the rules below are stated over what a user would SEE and what their
 * history would DO, not over which strings are in the table:
 *
 *   - no two rows in the picker mean the same movement
 *   - a rename whose OLD name the app can still serve lands on a name it can
 *     serve too (a rename between two dead names loses nobody anything)
 *   - every record is served under the name its chart is filed under
 *   - nothing is aliased across implements
 *
 * Run:  npx tsx tests/exercise-aliases.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises, getExerciseNameMap } from '../lib/exercise-db.ts';
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
const libraryNames = new Set(RECORDS.map((e) => e.name));

// ─── 1. Each movement still means one thing ──────────────────────────────────
console.log('\n[1] Each movement appears once');

/**
 * The pairs the picker still shows twice, and why they are allowed to.
 *
 * Listing a pair here is a deliberate, reviewed admission, not a waiver: the
 * loop below re-checks that every pair named is still genuinely one movement,
 * so a pair that stops meaning one thing fails rather than hides. Anything
 * landing in the duplicate list that is NOT named here is a new fault.
 *
 * THE PAIRS CHANGED WHEN THE OLD CATALOGUE WENT, AND SO DID THE REASON.
 *
 * Every pair here used to be one movement the old catalogue had entered twice,
 * once per pool. All five of those are deleted along with the pools.
 *
 * The three that remain are a different thing entirely, and a legitimate one:
 * Archie's library and Restore both hold the movement, at two doses, for two
 * jobs. A Band Pull Apart is accessory work on the library's list and a rehab
 * drill in Restore's; a Deadbug is a core exercise and a lumbar-control drill.
 * Both rows belong in the picker because they are prescribed differently. The
 * alias is what makes their charts count together, which is the whole point.
 */
const KNOWN_PICKER_DUPLICATES = [
  // The library's accessory spelling and Restore's rehab spelling.
  ['Band Pull Aparts', 'Band Pull-Apart'],
  ['Banded Face Pulls', 'Band Face Pull'],
  ['Deadbug', 'Dead Bug'],
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

/**
 * A NAME NOTHING CAN SERVE IS A NAME A CHART DISAPPEARS INTO - asked of the
 * renames that can still do that.
 *
 * This used to demand that every surviving name be servable. That was right
 * while the alias table and the catalogue described the same universe. Seven
 * entries now point at names the app no longer has at all: "Bench Press" to
 * "Barbell Bench Press", "Dead Hangs" to "Dead Hang", and five more. Archie's
 * library does not contain those movements, so both halves of each of those
 * renames are history: they still usefully collapse two old spellings of one
 * old exercise into a single chart, and there is nothing live to disappear.
 *
 * What would genuinely lose somebody their history is a rename whose SOURCE the
 * app can still serve pointing at a name it cannot. Their card would say one
 * thing and their chart would be filed under another. That is the rule now, and
 * it is the stronger half of the old one: every live name must land somewhere
 * live, and a rename between two dead names has to be dead on both sides.
 */
const servable = (n) => names.has(n) || libraryNames.has(n);
for (const [from, kept] of Object.entries(EXERCISE_ALIASES)) {
  if (!servable(from)) continue;
  check(
    `"${from}" is renamed to "${kept}", which the app can serve`,
    servable(kept),
    'a live exercise renamed onto a name nothing serves files its chart out of reach'
  );
}
const liveTargets = [...new Set(Object.values(EXERCISE_ALIASES))].filter(
  (kept) => names.has(kept) || libraryNames.has(kept)
);
check(
  `and the table is mostly about live exercises (${liveTargets.length} of ${new Set(Object.values(EXERCISE_ALIASES)).size} surviving names are servable)`,
  liveTargets.length > 30,
  'if almost nothing it renames is servable, the rules above are checking history only'
);

// ─── 2. The survivor is the one the engine already used ──────────────────────
console.log('\n[2] The name kept is the one progression is keyed on');

/**
 * THE QUESTION MOVED WHEN THE KPI POOLS DID.
 *
 * This used to ask `getMainLift` for the six lift-and-tier combinations the old
 * engine had, and check that the name it returned was the same movement as the
 * library record keeping its id - because personal bests, last-logged weights
 * and the 1RM flow all keyed off that name. Those pools are deleted and so is
 * `getMainLift`; the library record IS the main lift now.
 *
 * Which turns the same worry into one sentence, asked of every record rather
 * than of six cells: THE NAME ON THE CARD IS THE NAME THE CHART IS UNDER. A
 * record served as "Barbell Back Squat" whose canonical name is something else
 * would show a personal best that belongs to another movement, and file its own
 * sets where nothing looks for them.
 */
const templateNames = getExerciseNameMap();
const notCanonical = RECORDS.filter((e) => canonicalExerciseName(e.name) !== e.name).map(
  (e) => `${e.name} charts as "${canonicalExerciseName(e.name)}"`
);
check(
  `every one of the ${RECORDS.length} records is served under the name it is charted under`,
  notCanonical.length === 0,
  notCanonical.slice(0, 6).join(' | ')
);
check(
  `and every record id resolves to a name (${RECORDS.length} records)`,
  RECORDS.every((e) => Boolean(templateNames[e.id])),
  RECORDS.filter((e) => !templateNames[e.id])
    .slice(0, 6)
    .map((e) => `${e.id} (${e.name})`)
    .join(', ')
);

// ─── 3. Genuine variants were left alone ─────────────────────────────────────
console.log('\n[3] Different equipment is a different exercise');

// Re-pointed at the library's spellings: the old catalogue's Barbell Bench
// Press, Back Squat, Goblet Squat and plain Romanian Deadlift are deleted, and
// a pair of names nothing can serve proves nothing about what the picker shows.
for (const pair of [
  ['Dumbbell Bench Press', 'Plate Bench Press'],
  ['Barbell Back Squat', 'Kettlebell Goblet Squats'],
  ['Barbell Deadlift', 'Kettlebell Romanian Deadlift'],
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
