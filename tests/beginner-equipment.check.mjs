/**
 * Contract test: a beginner may own anything, and the LEVEL is what keeps them
 * safe.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Until this phase the app held a beginner to bodyweight and bands on every
 * screen that asked about equipment: the sign-up kit page, the readiness
 * picker, Train, Home, Recover and the Profile sheet, which also deleted the
 * other tiers when somebody saved "beginner" in Edit Details. It was not a
 * display choice. It was the only thing standing between a brand-new lifter and
 * a barbell back squat, because the sessions were drawn from weekly pools that
 * had no notion of a level: pick the full-gym pool and you got the full-gym
 * exercises, whoever you were.
 *
 * It cost a beginner 18 of the 36 Beginner exercises on Archie's list - all four
 * cable rows, both kettlebell deadlifts, both plate presses, the carries and
 * everything using a bench or box - and it told somebody who had just paid for a
 * gym membership that the gym was something to grow into.
 *
 * Strength sessions are built from the exercise library now, and every record in
 * it carries a level. So the protection moved: the level ceiling decides which
 * exercises exist for you, and the equipment answer decides only what they may
 * be done with. This file holds BOTH halves of that trade, because either one
 * alone is a bug:
 *
 *   [1] the kit question is asked of everybody the same way, at every level
 *   [2] a beginner at a full gym is given nothing above Beginner, through the
 *       real generateWorkout door, for every Train tile and every session length
 *   [3] the ceiling is what is doing it - the same full gym at a higher level
 *       really does hand back higher-level records and barbell work
 *   [4] the Beginner exercises the lock used to hide are now reachable, and
 *       were genuinely out of reach on bodyweight and bands
 *
 * [3] and [4] are not decoration. Without [3], [2] would pass just as happily if
 * the library were empty, if every record were level 1, or if the full-gym kit
 * expansion stopped working; without [4], removing the lock could have changed
 * nothing at all and this file would still be green.
 *
 * Nothing here greps a screen. Every assertion runs the real rule or the real
 * generator and reads what comes back.
 *
 * Run:  npx tsx tests/beginner-equipment.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS, TIER_ORDER } from '../lib/store.ts';
import { LIBRARY_EXERCISES } from '../lib/exercise-library.ts';
import { toggleTier, pickExperience, EMPTY_SIGN_UP } from '../lib/sign-up.ts';
import { generateWorkout } from '../lib/workout-engine.ts';
import { levelCeilingFor } from '../lib/library-session.ts';
import { TRAIN_SESSION_TYPES } from '../lib/train-screen.ts';

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

/** One key per movement, so two spellings of the same exercise are one thing. */
const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const libraryByKey = new Map(LIBRARY_EXERCISES.map((e) => [key(e.name), e]));

/** Every kit key a record asks for, flattened out of its AND-of-ORs. */
const kitKeysOf = (record) => (record.kit ?? []).flat();

/**
 * The bar lifts, as the library itself names their kit rather than as words in
 * a title. "Kettlebell Romanian Deadlift" and "Plate Bench Press" both contain
 * the name of a barbell lift and neither one is barbell work; asking the record
 * what it needs is the only way to tell them apart.
 */
const BAR_KIT = ['barbell', 'trapbar'];
const needsABar = (record) => kitKeysOf(record).some((k) => BAR_KIT.includes(k));

function profileFor(experienceLevel, extra = {}) {
  return {
    name: 'Matrix',
    sex: 'female',
    experienceLevel,
    goals: ['fitness'],
    bodyweightKg: 72,
    ageYears: 30,
    earnedLevelBonus: 0,
    standingSoreRegions: [],
    clinicalAvoid: [],
    ...extra,
  };
}

const FULL_GYM = [...TIER_ORDER];
const DURATIONS = ['30', '45', '60'];
const ENERGIES = ['low', 'normal', 'high'];
const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * Exactly as app/session.tsx calls it: the single tier resolved for today, then
 * the whole owned set and the per-type count in the facts object at the end.
 */
function build(sessionType, experienceLevel, equipment, duration, energy, seed) {
  return generateWorkout(
    sessionType,
    equipment[equipment.length - 1],
    { energy, timeAvailable: duration, hasAches: false },
    profileFor(experienceLevel),
    undefined,
    undefined,
    seed,
    undefined,
    undefined,
    undefined,
    null,
    'kg',
    undefined,
    undefined,
    0,
    { equipment, sessionTypeCount: seed }
  );
}

// ─── 1. The kit question, asked of everybody ─────────────────────────────────
console.log('\n[1] Every level is offered every piece of kit');

check(
  'a beginner can tick each of the five tiles',
  TIER_ORDER.every((tier) => toggleTier([], tier).includes(tier)),
  TIER_ORDER.filter((tier) => !toggleTier([], tier).includes(tier)).join(', ')
);
check(
  'and so can everybody else, by the same rule',
  EXPERIENCE_LEVELS.every(() => TIER_ORDER.every((tier) => toggleTier([], tier).includes(tier))),
  'the rule takes no experience argument at all now, which is what makes this true'
);
check(
  'ticking full gym as a beginner really selects a full gym',
  toggleTier([], 'fullgym').join(',') === TIER_ORDER.join(','),
  toggleTier([], 'fullgym').join(',')
);
check(
  'and answering the experience question does not touch the kit answer',
  pickExperience(
    { ...EMPTY_SIGN_UP, experience: 'advanced', equipment: ['fullgym'] },
    'beginner'
  ).equipment.join(',') === 'fullgym',
  'it used to clear it, so correcting your level on the way through unticked your gym'
);

// ─── 2. The matrix ───────────────────────────────────────────────────────────
console.log('\n[2] A beginner at a full gym is given only Beginner exercises');

const beginnerCeiling = levelCeilingFor(profileFor('beginner'));
check(
  'a beginner who has earned nothing has a ceiling of Beginner',
  beginnerCeiling === 1,
  `ceiling is ${beginnerCeiling}`
);

const above = [];
const barWork = [];
const threw = [];
const libraryCardsByType = {};
const beginnerKitSeen = new Set();
let beginnerCards = 0;
let beginnerSessions = 0;

for (const sessionType of TRAIN_SESSION_TYPES) {
  libraryCardsByType[sessionType] = 0;
  for (const duration of DURATIONS) {
    for (const energy of ENERGIES) {
      for (const seed of SEEDS) {
        const where = `${sessionType} / full gym / beginner / ${duration} min / ${energy} / session ${seed}`;
        let session;
        try {
          session = build(sessionType, 'beginner', FULL_GYM, duration, energy, seed);
        } catch (err) {
          threw.push(`${where}: ${err && err.message}`);
          continue;
        }
        beginnerSessions++;
        beginnerCards += session.length;
        for (const ex of session) {
          const record = libraryByKey.get(key(ex.name));
          if (!record) continue;
          libraryCardsByType[sessionType]++;
          for (const k of kitKeysOf(record)) beginnerKitSeen.add(k);
          if (record.level > 1) above.push(`${where}: ${ex.name} is level ${record.level}`);
          if (needsABar(record)) barWork.push(`${where}: ${ex.name}`);
        }
      }
    }
  }
}

console.log(
  `    ${beginnerSessions} sessions, ${beginnerCards} cards, library records per tile: ` +
    TRAIN_SESSION_TYPES.map((t) => `${t} ${libraryCardsByType[t]}`).join(', ')
);
check('nothing throws, whatever the tile or the length', threw.length === 0, threw[0]);
check(
  'not one exercise above Beginner, anywhere in the matrix',
  above.length === 0,
  `${above.length} of ${beginnerCards} cards, e.g. ${above[0]}`
);
check(
  'and never a barbell or trap bar, however it is spelled',
  barWork.length === 0,
  `${barWork.length} cards, e.g. ${barWork[0]}`
);

/**
 * The matrix has to be looking at something. Written as a table of what each
 * tile actually builds through this door, measured rather than assumed.
 *
 * Two of the five tiles contribute no library records yet and both are honest:
 * Conditioning is still served out of the old pools until its own phase lands
 * (it is swept here anyway, so the day it switches it is already covered), and
 * "Build your own" is assembled by the session builder rather than by
 * generateWorkout at all. Naming them is what stops "nothing above Beginner"
 * quietly becoming a statement about an empty list.
 */
const BUILDS_FROM_THE_LIBRARY = ['full_body', 'upper_body', 'lower_body'];
const thin = BUILDS_FROM_THE_LIBRARY.filter((t) => libraryCardsByType[t] < 100);
check(
  `each strength tile really produced library exercises (${BUILDS_FROM_THE_LIBRARY.map((t) => `${t}: ${libraryCardsByType[t]}`).join(', ')})`,
  thin.length === 0 && BUILDS_FROM_THE_LIBRARY.every((t) => TRAIN_SESSION_TYPES.includes(t)),
  thin.join(', ')
);
check(
  'and "Build your own" is not built by this door at all, so the sweep is not quietly counting it',
  libraryCardsByType.custom === 0,
  `custom produced ${libraryCardsByType.custom} library cards through generateWorkout`
);

// ─── 3. The ceiling is what is doing it ──────────────────────────────────────
console.log('\n[3] The same full gym at a higher level does hand back more');

function sweepLevels(experienceLevel) {
  const levels = new Set();
  let bars = 0;
  for (const sessionType of BUILDS_FROM_THE_LIBRARY) {
    for (const duration of DURATIONS) {
      for (const seed of SEEDS) {
        for (const ex of build(sessionType, experienceLevel, FULL_GYM, duration, 'normal', seed)) {
          const record = libraryByKey.get(key(ex.name));
          if (!record) continue;
          levels.add(record.level);
          if (needsABar(record)) bars++;
        }
      }
    }
  }
  return { levels: [...levels].sort(), bars };
}

const intermediate = sweepLevels('intermediate');
const advanced = sweepLevels('advanced');
check(
  `an intermediate at the same gym is given Intermediate work (levels ${intermediate.levels.join(', ')})`,
  intermediate.levels.includes(2),
  'if this is only level 1 then the beginner assertion above proves nothing'
);
check(
  `an advanced lifter is given Advanced work (levels ${advanced.levels.join(', ')})`,
  advanced.levels.includes(3),
  ''
);
check(
  `and barbell work really is on offer to somebody who has earned it (${advanced.bars} cards)`,
  advanced.bars > 0,
  'a bar that reaches nobody would make "never a barbell" true for the wrong reason'
);

// ─── 4. What the lock was costing a beginner ─────────────────────────────────
console.log('\n[4] The Beginner exercises the lock used to hide are reachable');

/**
 * Asked as kit keys rather than as exercise names, so renaming a record in
 * Archie's list cannot quietly turn this green. These four are the ones pivot
 * scope 4.5 counted: the cable rows, the kettlebell deadlifts, the plate presses
 * and the box work, 18 Beginner entries between them and every one of them
 * unreachable while the lock stood.
 */
const WAS_LOCKED_AWAY = ['cable', 'kettlebell', 'plates', 'box'];
const missing = WAS_LOCKED_AWAY.filter((k) => !beginnerKitSeen.has(k));
check(
  `a beginner at a full gym is now given ${WAS_LOCKED_AWAY.join(', ')} work`,
  missing.length === 0,
  `never once reached: ${missing.join(', ')}`
);

const homeKitSeen = new Set();
for (const sessionType of BUILDS_FROM_THE_LIBRARY) {
  for (const duration of DURATIONS) {
    for (const seed of SEEDS) {
      for (const ex of build(
        sessionType,
        'beginner',
        ['bodyweight', 'bands'],
        duration,
        'normal',
        seed
      )) {
        const record = libraryByKey.get(key(ex.name));
        if (!record) continue;
        for (const k of kitKeysOf(record)) homeKitSeen.add(k);
      }
    }
  }
}
const stillReachableAtHome = WAS_LOCKED_AWAY.filter((k) => homeKitSeen.has(k));
check(
  'and none of it was reachable on bodyweight and bands, which is what the lock held them to',
  stillReachableAtHome.length === 0,
  `${stillReachableAtHome.join(', ')} turned up without the kit for it, which is a different bug`
);

// ─── Result ──────────────────────────────────────────────────────────────────
console.log(
  failed === 0
    ? `\nbeginner-equipment: all ${passed} checks passed\n`
    : `\nbeginner-equipment: ${failed}/${passed + failed} check(s) FAILED\n`
);
process.exitCode = failed === 0 ? 0 : 1;
