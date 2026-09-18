/**
 * Contract test: the rotation keeps moving, and a long history does not make an
 * unfamiliar exercise heavier.
 *
 * TWO FAULTS THAT SHARE ONE NUMBER
 * ────────────────────────────────
 * The session screen counted "strength sessions" and fed the answer to two
 * different jobs: it seeds the shuffle that decides which exercises you get,
 * and it nudges the weight quoted for an exercise you have never logged.
 *
 *   THE ROTATION FROZE. The count looked for the three lift-named ids, which
 *   was right while those were the only sessions the app built. The app now
 *   builds Lower, Upper and Full Body, so everybody on them counted zero for
 *   ever: one seed, the same exercises, session after session, and nothing they
 *   logged could move it.
 *
 *   FIXING THAT ALONE WOULD HAVE MADE EVERY FIRST-TIME WEIGHT JUMP. A weight
 *   for an exercise with no history is worked out from bodyweight and nudged up
 *   1% per three sessions to a ceiling of +20%. A count pinned at zero for
 *   years would have leapt to that ceiling in a single launch, and the app
 *   would have handed somebody a movement they had never performed a fifth
 *   above its estimate, on the strength of sessions that were never that
 *   movement.
 *
 * So the two jobs now read two numbers. The rotation counts every lifting
 * session anybody has ever done; the weight counts only those logged since the
 * current exercise library, which is what `libraryEpochSessionCount` records.
 *
 * WHAT THIS FILE HOLDS
 *   1. Which sessions count as lifting, and which deliberately do not.
 *   2. Somebody who only does Lower, Upper and Full Body sees the rotation move.
 *   3. A long history is quoted exactly the weights it was quoted before, and
 *      is never quoted a heavier one.
 *   4. Signing in on a new handset does not undo point 3.
 *   5. A reset clears the mark, and it travels with the history it measures.
 *   6. The screen actually hands both numbers to the generator.
 *
 * Run:  npx tsx tests/rotation-seed.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import './_persist-shim.mjs';

globalThis.__DEV__ = false;

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const { generateWorkout } = await import('../lib/workout-engine.ts');
const { useAppStore, STRENGTH_SESSION_TYPES } = await import('../lib/store.ts');
const { countLiftingSessions, isLiftingSession } = await import('../lib/session-type.ts');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PROFILE = {
  name: 'A',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};
const READY = { energy: 'normal', timeAvailable: '60', hasAches: false };

const session = (i, sessionType) => ({
  id: `fixture-${i}-${sessionType}`,
  date: new Date(2024, 0, 1 + i).toISOString(),
  sessionType,
  exerciseLogs: [],
  durationMinutes: 45,
});
const historyOf = (types, n) => Array.from({ length: n }, (_, i) => session(i, types[i % types.length]));

const WEEKLY_HISTORY = historyOf(['lower_body', 'upper_body', 'full_body'], 300);
const LEGACY_HISTORY = historyOf(['squat', 'bench', 'deadlift'], 300);

/**
 * A session generated for real, with both counts said out loud.
 *
 * Every argument between them is passed explicitly rather than defaulted, so
 * nothing in this file depends on module state: `daysSinceLastSession` is null,
 * which is "no time off", and there is no logged weight for any exercise, which
 * is what makes every weight below a FIRST-TIME estimate - the only path the
 * session-count multiplier is applied on.
 */
const gen = (type, liftingCount, epoch) =>
  generateWorkout(
    type,
    'fullgym',
    READY,
    PROFILE,
    {},
    undefined,
    liftingCount,
    undefined,
    undefined,
    undefined,
    null,
    'kg',
    undefined,
    undefined,
    epoch
  );

const kgOf = (ex) => (Array.isArray(ex.loadKg) ? ex.loadKg[0] : ex.loadKg);
/** Exercise id to the weight the app would put on the card, for the loaded ones. */
const weights = (workout) =>
  new Map(workout.filter((ex) => ex.id && kgOf(ex) != null).map((ex) => [ex.id, kgOf(ex)]));
const shapeOf = (workout) => workout.map((ex) => ex.id).join('|');

// ─── 1. Which sessions count ────────────────────────────────────────────────
console.log('\n[1] A lifting session is one that puts a weight through the body');

const MIXED = [
  session(1, 'lower_body'),
  session(2, 'upper_body'),
  session(3, 'full_body'),
  session(4, 'squat'),
  session(5, 'bench'),
  session(6, 'deadlift'),
  session(7, 'conditioning'),
  session(8, 'prehab'),
  session(9, 'flexibility'),
  session(10, 'custom'),
];

check(
  'the three sessions the app builds today count',
  ['lower_body', 'upper_body', 'full_body'].every((t) => isLiftingSession(t)),
  'these are the sessions people are actually given; if they do not count, nothing does'
);
check(
  'so do the three lift-named ids they replaced',
  ['squat', 'bench', 'deadlift'].every((t) => isLiftingSession(t)),
  'a squat day from three years ago is a lower body day, and somebody who logged 200 of them has lifted 200 times'
);
check(
  'conditioning, prehab, flexibility and a custom session do not',
  ['conditioning', 'prehab', 'flexibility', 'custom'].every((t) => !isLiftingSession(t)),
  'none of them load the lifts being progressed, so none may claim credit for progressing them'
);
check(
  `a mixed history of ${MIXED.length} counts 6`,
  countLiftingSessions(MIXED) === 6,
  `counted ${countLiftingSessions(MIXED)}`
);
check(
  'a record written by a build we have never met is not counted',
  countLiftingSessions([session(1, 'something_new'), session(2, 'lower_body')]) === 1,
  'the lookup returns nothing and the session is skipped, rather than throwing on somebody launch'
);

check(
  'the rule this replaced saw none of a Lower/Upper/Full history',
  WEEKLY_HISTORY.filter((s) => STRENGTH_SESSION_TYPES.includes(s.sessionType)).length === 0 &&
    countLiftingSessions(WEEKLY_HISTORY) === WEEKLY_HISTORY.length,
  'the old rule named the three lift ids literally, so 300 sessions of Lower, Upper and Full Body counted zero'
);

// ─── 2. The rotation moves ───────────────────────────────────────────────────
console.log('\n[2] Somebody who only does Lower, Upper and Full Body sees it move');

for (let k = 0; k <= 12; k++) {
  if (countLiftingSessions(WEEKLY_HISTORY.slice(0, k)) !== k) {
    check(`the count advances by one per session (at ${k})`, false, 'it did not');
    break;
  }
  if (k === 12) check('the count advances by one per session, twelve sessions running', true);
}

for (const type of ['lower_body', 'upper_body', 'full_body']) {
  const moving = new Set();
  const frozen = new Set();
  for (let n = 0; n < 12; n++) {
    moving.add(shapeOf(gen(type, n, 0)));
    frozen.add(shapeOf(gen(type, 0, 0)));
  }
  check(
    `${type}: twelve sessions give ${moving.size} different exercise lists`,
    moving.size >= 8,
    `only ${moving.size} - the count is what rotates the pool, so it has to advance`
  );
  check(
    `${type}: and with the count pinned they are all the same list`,
    frozen.size === 1,
    'if this is not 1, the rotation is moved by something other than the count and section 2 proves nothing'
  );
}

// ─── 3. A long history is quoted the same weights ───────────────────────────
console.log('\n[3] A long history does not buy a heavier first-time weight');

const KEY = 'grow-app-storage';
/** Load a real persisted blob the way a cold start does: version compare, migrate, merge. */
async function rehydrateWith(state, version) {
  globalThis.window.localStorage.setItem(KEY, JSON.stringify({ state, version }));
  await useAppStore.persist.rehydrate();
  return useAppStore.getState();
}
const BASE = { onboardingComplete: true, earnedBadges: [] };
/** The last version released before the mark existed. */
const SHIPPED_VERSION = 35;

const storeVersion = useAppStore.persist.getOptions().version;
check(
  'the persist version is above the one that shipped without the mark',
  typeof storeVersion === 'number' && storeVersion > SHIPPED_VERSION,
  `version is ${storeVersion}; migrate() only runs when the stored number is lower, so without the bump none of this section happens on a real phone`
);

const migratedWeekly = await rehydrateWith(
  { ...BASE, completedSessions: WEEKLY_HISTORY },
  SHIPPED_VERSION
);
check(
  'the migration stamps the mark at what is already on record',
  migratedWeekly.libraryEpochSessionCount === 300,
  `stamped ${migratedWeekly.libraryEpochSessionCount} against 300 lifting sessions`
);
const migratedFresh = await rehydrateWith({ ...BASE, completedSessions: [] }, SHIPPED_VERSION);
check(
  'a brand new account is stamped at zero',
  migratedFresh.libraryEpochSessionCount === 0,
  'nothing in their history predates the library, because there is no history'
);
const alreadyStamped = await rehydrateWith(
  { ...BASE, completedSessions: WEEKLY_HISTORY, libraryEpochSessionCount: 7 },
  SHIPPED_VERSION
);
check(
  'a mark already on the device is left alone',
  alreadyStamped.libraryEpochSessionCount === 7,
  're-stamping it on every launch would erase the training somebody has done since'
);

/**
 * THE ASSERTION THE WHOLE PHASE EXISTS FOR.
 *
 * What this person was quoted BEFORE: their count was pinned at zero, so the
 * multiplier was 1.0 and the estimate was the plain bodyweight one.
 * What they are quoted AFTER: their real count of 300, with the mark at 300.
 * The exercises differ, because the rotation has been unfrozen and is meant to
 * differ. Every exercise that appears in both must carry the same weight.
 */
const beforeWeekly = weights(gen('lower_body', 0, 0));
const afterWeekly = weights(
  gen('lower_body', countLiftingSessions(WEEKLY_HISTORY), migratedWeekly.libraryEpochSessionCount)
);
const sharedWeekly = [...afterWeekly.keys()].filter((id) => beforeWeekly.has(id));
check(
  `there are ${sharedWeekly.length} exercises in both sessions to compare`,
  sharedWeekly.length >= 3,
  'too few shared exercises for the comparison below to mean anything'
);
check(
  'every one of them is quoted exactly the weight it was quoted before',
  sharedWeekly.every((id) => afterWeekly.get(id) === beforeWeekly.get(id)),
  sharedWeekly
    .filter((id) => afterWeekly.get(id) !== beforeWeekly.get(id))
    .map((id) => `${id}: ${beforeWeekly.get(id)} -> ${afterWeekly.get(id)}`)
    .join(', ')
);

const noMark = weights(gen('lower_body', countLiftingSessions(WEEKLY_HISTORY), 0));
const sharedNoMark = [...noMark.keys()].filter((id) => beforeWeekly.has(id));
check(
  'and without the mark every one of them would be heavier',
  sharedNoMark.length >= 3 && sharedNoMark.every((id) => noMark.get(id) > beforeWeekly.get(id)),
  'if this passes without the mark too, the mark is doing nothing and the assertion above is vacuous'
);
check(
  'by up to a fifth, which is the ceiling the multiplier reaches',
  sharedNoMark.some((id) => noMark.get(id) >= beforeWeekly.get(id) * 1.15),
  sharedNoMark.map((id) => `${id}: ${beforeWeekly.get(id)} -> ${noMark.get(id)}`).join(', ')
);

/**
 * THE OTHER LONG-STANDING USER, and the one place this eases weights off.
 *
 * Somebody whose history is the three lift-named ids WAS counted, so they were
 * already at the +20% ceiling. Their sessions were logged against a different
 * set of exercises, so the mark takes that ceiling away - deliberately, and in
 * the safe direction. What must never happen is the reverse.
 */
const migratedLegacy = await rehydrateWith(
  { ...BASE, completedSessions: LEGACY_HISTORY },
  SHIPPED_VERSION
);
check(
  'a lift-named history is stamped at its full length too',
  migratedLegacy.libraryEpochSessionCount === 300,
  `stamped ${migratedLegacy.libraryEpochSessionCount}`
);
const beforeLegacy = noMark; // what the old code gave them: 300 counted, no mark
const afterLegacy = weights(
  gen('lower_body', countLiftingSessions(LEGACY_HISTORY), migratedLegacy.libraryEpochSessionCount)
);
const sharedLegacy = [...afterLegacy.keys()].filter((id) => beforeLegacy.has(id));
check(
  'their first-time weights come DOWN, never up',
  sharedLegacy.length >= 3 && sharedLegacy.every((id) => afterLegacy.get(id) <= beforeLegacy.get(id)),
  sharedLegacy
    .filter((id) => afterLegacy.get(id) > beforeLegacy.get(id))
    .map((id) => `${id}: ${beforeLegacy.get(id)} -> ${afterLegacy.get(id)}`)
    .join(', ')
);
check(
  'and at least one of them really does come down',
  sharedLegacy.some((id) => afterLegacy.get(id) < beforeLegacy.get(id)),
  'if nothing moved, the ceiling was never being applied and this fixture is not testing it'
);
check(
  'a lift-named history and a weekly one of the same length are quoted alike',
  afterLegacy.size > 0 && [...afterLegacy.entries()].every(([id, kg]) => afterWeekly.get(id) === kg),
  'the stored ids differ; the training they represent does not'
);
check(
  'the mark changes the weights and nothing else',
  ['lower_body', 'upper_body', 'full_body'].every(
    (type) => shapeOf(gen(type, 300, 300)) === shapeOf(gen(type, 300, 0))
  ),
  'the rotation has to read the all-time count, not the count since the library; reading the second would throw a long-standing user back to the exercises they were given on their first day'
);

// ─── 4. Signing in on a new handset ─────────────────────────────────────────
console.log('\n[4] The mark moves with the history it measures');

const profileFor = () => useAppStore.getState().userProfile;

await rehydrateWith({ ...BASE, completedSessions: [] }, SHIPPED_VERSION);
useAppStore.getState().mergeServerData({
  completedSessions: WEEKLY_HISTORY,
  libraryEpochSessionCount: 300,
  userProfile: profileFor(),
});
check(
  'a new phone restoring 300 sessions restores the mark with them',
  useAppStore.getState().libraryEpochSessionCount === 300 &&
    useAppStore.getState().completedSessions.length === 300,
  `mark ${useAppStore.getState().libraryEpochSessionCount}, sessions ${useAppStore.getState().completedSessions.length} - without this the whole restored career counts as training done since this library`
);

await rehydrateWith({ ...BASE, completedSessions: [] }, SHIPPED_VERSION);
useAppStore
  .getState()
  .mergeServerData({ completedSessions: WEEKLY_HISTORY, userProfile: profileFor() });
check(
  'a payload from an older build, with no mark in it, is treated as all history',
  useAppStore.getState().libraryEpochSessionCount === 300,
  `mark ${useAppStore.getState().libraryEpochSessionCount}; every session in a payload written before the mark existed predates the library by definition`
);

await rehydrateWith(
  { ...BASE, completedSessions: WEEKLY_HISTORY, libraryEpochSessionCount: 300 },
  storeVersion
);
const plusTen = [
  ...WEEKLY_HISTORY,
  ...Array.from({ length: 10 }, (_, i) => session(900 + i, 'full_body')),
];
useAppStore.getState().mergeServerData({
  completedSessions: plusTen,
  libraryEpochSessionCount: 300,
  userProfile: profileFor(),
});
check(
  'ten sessions logged on a second phone since the mark still count as ten',
  useAppStore.getState().libraryEpochSessionCount === 300 &&
    countLiftingSessions(useAppStore.getState().completedSessions) -
      useAppStore.getState().libraryEpochSessionCount ===
      10,
  `mark ${useAppStore.getState().libraryEpochSessionCount} against ${countLiftingSessions(useAppStore.getState().completedSessions)} sessions - training done on another handset must not be thrown away either`
);

// ─── 5. The reset, and the payload ──────────────────────────────────────────
console.log('\n[5] A reset clears it, and it travels');

await rehydrateWith(
  { ...BASE, completedSessions: WEEKLY_HISTORY, libraryEpochSessionCount: 300 },
  storeVersion
);
useAppStore.getState().resetProgress();
check(
  'Reset Progress clears the mark along with the history it counts',
  useAppStore.getState().libraryEpochSessionCount === 0,
  'left standing above an empty history, it would sit over every future session and no first-time weight would ever rise again'
);

await rehydrateWith(
  { ...BASE, completedSessions: WEEKLY_HISTORY, libraryEpochSessionCount: 300 },
  storeVersion
);
check(
  'the sync payload carries it',
  useAppStore.getState().getDataForSync().libraryEpochSessionCount === 300,
  'sign-out wipes the device, so a field missing from the payload is destroyed rather than un-synced'
);

// ─── 6. The screen hands both numbers over ──────────────────────────────────
console.log('\n[6] The session screen passes both counts to the generator');

/**
 * Arity, not spelling. The generator takes the two counts in different
 * positions, so a screen that stops short by one argument silently falls back
 * to the default - which for the mark means "no mark", the exact fault section
 * 3 exists to prevent, arriving with nothing to show for it. Nothing here cares
 * what the arguments are CALLED; only that the call is as long as the signature.
 */
/** The text between a `(` and its matching `)`, with comments and strings taken out. */
function innerOf(source, openAt) {
  let out = '';
  let depth = 0;
  let i = openAt;
  while (i < source.length) {
    const ch = source[i];
    const two = source.slice(i, i + 2);
    if (depth > 0 && two === '//') {
      const nl = source.indexOf('\n', i);
      i = nl < 0 ? source.length : nl;
      continue;
    }
    if (depth > 0 && two === '/*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    if (depth > 0 && (ch === '"' || ch === "'" || ch === '`')) {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) {
        if (source[j] === '\\') j++;
        j++;
      }
      // A string default can hold a comma. Replaced by a placeholder rather
      // than kept, so it can never look like an argument separator.
      out += 'STR';
      i = j + 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      if (depth > 1) out += ch;
      i++;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return out;
      out += ch;
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** `Record<string, number>` is ONE parameter, not two. Remove the type arguments first. */
function stripGenerics(text) {
  let out = text;
  for (let pass = 0; pass < 8; pass++) {
    const next = out.replace(/<[^<>]*>/g, '');
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Split on the commas that separate arguments, ignoring any nested inside one. */
function splitTop(text) {
  const parts = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const engineSrc = read('lib/workout-engine.ts');
const screenSrc = read('app/session.tsx');
const declAt = engineSrc.indexOf('export function generateWorkout(');
const callAt = screenSrc.indexOf('generateWorkout(');
const declared =
  declAt < 0 ? [] : splitTop(stripGenerics(innerOf(engineSrc, engineSrc.indexOf('(', declAt))));
const supplied = callAt < 0 ? [] : splitTop(innerOf(screenSrc, screenSrc.indexOf('(', callAt)));

check(
  `the generator declares ${declared.length} parameters and the test can see them`,
  declared.length >= 14,
  'the signature has moved and this rule has gone blind'
);
check(
  'the session screen passes every one of them',
  supplied.length === declared.length,
  `the screen passes ${supplied.length} of ${declared.length}; the missing ones fall back to their defaults, and the default for the library mark is "there is no mark"`
);

console.log(`\nrotation-seed: ${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
