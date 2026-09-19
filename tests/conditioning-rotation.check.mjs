/**
 * Contract test: a conditioning session is not the same session every day.
 *
 * WHAT WAS WRONG
 * ──────────────
 * Every session builder in the engine runs its pools through the seeded
 * shuffle. The conditioning builder took its list verbatim. Measured over 30
 * simulated days: day-to-day overlap of 1.000 on every pair, one distinct
 * exercise set, identical at all fifteen combinations of equipment tier and
 * energy level. Someone doing conditioning twice a week for five weeks did the
 * identical four exercises ten times, and the only thing that ever moved was
 * the order of three warm-up stretches spliced in above them.
 *
 * WHAT THIS FILE PROTECTS, AND WHAT IT HONESTLY CANNOT
 * ────────────────────────────────────────────────────
 * Rotation was the engine half of that defect. The other half is data: the
 * database holds exactly ONE prescribed circuit per tier and energy level, so
 * after the shuffle what changes day to day is the ORDER of the work, not which
 * work it is. This file therefore asserts what the engine can be held to —
 * the session is not frozen, and nothing was dropped or reordered into
 * nonsense — and deliberately does not assert exercise-level variety, because
 * the engine cannot deliver it from a pool of one. That needs more entries in
 * CONDITIONING_WORKOUTS.
 *
 * The three fixed points are fixed on purpose. A warm-up that is not first is
 * not a warm-up; a finisher that is not the last hard effort is not a finisher;
 * a cooldown in the middle of a session is a mistake.
 *
 * Run:  npx tsx tests/conditioning-rotation.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { generateWorkout } from '../lib/workout-engine.ts';
import { getConditioningWorkout } from '../lib/exercise-db.ts';

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

const TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const ENERGIES = ['low', 'normal', 'high'];
const ENERGY_KEY = { low: 'easy', normal: 'normal', high: 'hard' };

/**
 * A conditioning session as it would be built on a given day.
 *
 * The rotation seed is `strengthSessionCount + getLocalDayIndex()`, and the day
 * index comes from the real clock. Walking the session count therefore walks
 * exactly the same seed sequence a run of consecutive days would, without
 * anyone having to monkeypatch Date.
 */
function session(tier, energy, seedStep) {
  return generateWorkout(
    'conditioning',
    tier,
    { hasAches: false, energy, timeAvailable: '60' },
    { name: 'T', sex: 'male', experienceLevel: 'intermediate', goals: ['fitness'], bodyweightKg: 85 },
    {},
    undefined,
    seedStep
  );
}

const DAYS = 30;

// ─── 1. It moves ─────────────────────────────────────────────────────────────
console.log('\n[1] The conditioning WORK is no longer frozen');

/**
 * The conditioning work, warm-ups excluded.
 *
 * Measuring the whole session would not catch the defect this file exists for.
 * The prep stretches spliced in above the work already rotated — that is the
 * "only the order of three stretches changing" the audit measured — so a test
 * that compares whole sessions goes green with the work block still frozen
 * solid. Confirmed by mutation: un-shuffling the work leaves a whole-session
 * comparison passing.
 */
const workOf = (tier, energy, seedStep) =>
  session(tier, energy, seedStep)
    .filter((e) => e.category !== 'prep')
    .map((e) => e.name)
    .join('|');

let frozenCells = [];
for (const tier of TIERS) {
  for (const energy of ENERGIES) {
    const orders = new Set(Array.from({ length: DAYS }, (_, d) => workOf(tier, energy, d)));
    if (orders.size < 2) frozenCells.push(`${tier}/${energy}`);
  }
}
check(
  `the work varies in all ${TIERS.length * ENERGIES.length} tier x energy cells`,
  frozenCells.length === 0,
  frozenCells.length ? `still frozen: ${frozenCells.join(', ')}` : ''
);

check(
  'consecutive days do not always hand back the identical work',
  (() => {
    let differing = 0;
    for (const tier of TIERS) {
      for (const energy of ENERGIES) {
        for (let d = 1; d < DAYS; d++) {
          if (workOf(tier, energy, d - 1) !== workOf(tier, energy, d)) differing++;
        }
      }
    }
    return differing > 0;
  })(),
  'day-to-day overlap was 1.000 on all 29 pairs'
);

// ─── 2. Nothing was dropped to get that variety ──────────────────────────────
console.log('\n[2] Rotation reorders; it never loses work');

let lostWork = [];
for (const tier of TIERS) {
  for (const energy of ENERGIES) {
    const pool = getConditioningWorkout(tier, ENERGY_KEY[energy]);
    for (let d = 0; d < DAYS; d++) {
      const built = session(tier, energy, d);
      // The prep stretches spliced in are extra; every pool exercise must still
      // be present. Kettlebell relabelling and the injury screen can rename or
      // substitute, so this compares category counts rather than names.
      const need = pool.filter((t) => t.category !== 'prep').length;
      const got = built.filter((e) => e.category !== 'prep').length;
      if (got < need) lostWork.push(`${tier}/${energy} day ${d}: ${got} of ${need}`);
    }
  }
}
check(
  'every prescribed effort survives the shuffle',
  lostWork.length === 0,
  lostWork.slice(0, 3).join('; ')
);

// ─── 3. The order that carries meaning is fixed ──────────────────────────────
console.log('\n[3] Warm-up first, finisher last hard effort, cooldown last');

let misplaced = { warmup: [], cooldown: [], finisher: [] };
for (const tier of TIERS) {
  for (const energy of ENERGIES) {
    for (let d = 0; d < DAYS; d++) {
      const built = session(tier, energy, d);
      if (built.length === 0) continue;
      if (built[0].category !== 'prep') misplaced.warmup.push(`${tier}/${energy}/${d}`);
      const cooldownIdx = built.findIndex((e) => e.category === 'cooldown');
      if (cooldownIdx !== -1 && cooldownIdx !== built.length - 1) {
        misplaced.cooldown.push(`${tier}/${energy}/${d}`);
      }
      const finisherIdx = built.findIndex((e) => e.category === 'finisher');
      if (finisherIdx !== -1) {
        const after = built.slice(finisherIdx + 1);
        if (after.some((e) => e.category !== 'cooldown')) {
          misplaced.finisher.push(`${tier}/${energy}/${d}`);
        }
      }
    }
  }
}
check('a warm-up opens every session', misplaced.warmup.length === 0, misplaced.warmup.slice(0, 3).join(', '));
check('a cooldown closes it', misplaced.cooldown.length === 0, misplaced.cooldown.slice(0, 3).join(', '));
check(
  'nothing but the cooldown comes after the finisher',
  misplaced.finisher.length === 0,
  misplaced.finisher.slice(0, 3).join(', ')
);

/**
 * SECTIONS 4 AND 5 ARE ASKED OF ALL THREE LIFTING TYPES NOW.
 *
 * They used to be asked of Upper Body alone, which was a fair sample while one
 * generator built all three. It is not any more: Lower, Upper and Full Body are
 * each built from Archie's library (LIBRARY_LIVE_TYPES in
 * lib/workout-engine.ts) and each rotates on its OWN count of sessions of that
 * type, so a rotation that froze on one of them would not show up on another.
 * Full Body is the one this phase switched over, and it is the one that asks
 * for all six patterns at once, so it is the likeliest to run out of pool and
 * settle on a single answer.
 */
const LIFTING_TYPES = ['lower_body', 'upper_body', 'full_body'];
const LIFTER = {
  name: 'T',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 85,
};
const HOUR = { hasAches: false, energy: 'normal', timeAvailable: '60' };
const buildLifting = (type, d, weights) =>
  generateWorkout(type, 'fullgym', HOUR, LIFTER, {}, undefined, d, weights, {}, {}, 0, {
    equipment: ['fullgym'],
    sessionTypeCount: d,
  });

// ─── 4. The weekly finisher rotates too ──────────────────────────────────────
console.log('\n[4] The weekly split no longer ends on the same exercise forever');

for (const type of LIFTING_TYPES) {
  const seen = new Set();
  for (let d = 0; d < DAYS; d++) {
    const fin = buildLifting(type, d).find((e) => e.category === 'finisher');
    if (fin) seen.add(fin.name);
  }
  check(
    `a 60-minute ${type} session varies its finisher (${seen.size} over ${DAYS} days)`,
    seen.size > 1,
    `only ever finished on: ${[...seen].join(', ') || 'nothing at all'}`
  );
}

// ─── 5. The lead exercise is its own exercise ────────────────────────────────
console.log('\n[5] The exercise that leads a session carries its own progression');

/**
 * THE SAME PROMISE, AFTER THE MECHANISM UNDER IT CHANGED.
 *
 * This was written about the old engine's main-lift variation: every fourth
 * session the lead was served by its curated alternative, and it used to keep
 * the base lift's id, so an incline bench was prescribed at the flat bench's
 * working weight and then wrote its own lighter result back over it. One id,
 * two movements, neither history true. The fix gave the variation a derived id
 * of its own.
 *
 * That rotation is gone - nothing the app builds appends a derived id any more,
 * which tests/muscle-map-variation.check.mjs now pins - but the promise it was
 * made to keep is not about the mechanism. It is: when the lead of a session
 * changes, the new exercise must not be handed the old one's weight. The
 * library keeps it a different way, by giving every record in Archie's list its
 * own id and its own history, and it is worth holding to exactly as it was.
 *
 * So both assertions are unchanged in what they ask and are now asked of each
 * lifting type. The second one is the one that matters: log 140 kg against the
 * exercise that led one session, and no OTHER exercise may come back prescribed
 * at 140 kg in any of the next forty.
 */
for (const type of LIFTING_TYPES) {
  const ids = new Set();
  for (let d = 0; d < 40; d++) {
    const main = buildLifting(type, d).find((e) => e.category === 'main');
    if (main) ids.add(main.id);
  }
  check(
    `${type}: the lead changes, and changes id with itself (${ids.size} over 40)`,
    ids.size > 1,
    'sharing the id had an incline bench prescribed at the flat bench weight, then logging its own lighter result back over it'
  );
}

for (const type of LIFTING_TYPES) {
  check(
    `${type}: and the lift you logged keeps a weight the next one cannot inherit`,
    (() => {
      const weights = {};
      // Find the base id first, then give it a heavy logged weight and confirm
      // no later session comes out prescribing it for something else.
      const baseId = buildLifting(type, 1).find((e) => e.category === 'main')?.id;
      if (!baseId) return false;
      weights[baseId] = 140;
      let others = 0;
      for (let d = 0; d < 40; d++) {
        const main = buildLifting(type, d, weights).find((e) => e.category === 'main');
        if (!main || main.id === baseId) continue;
        others++;
        if ((main.loadKg?.[0] ?? 0) >= 140) return false;
      }
      // A type whose lead never changes proves nothing here, so say so rather
      // than passing on an empty loop.
      return others > 0;
    })(),
    'an exercise inheriting another one id was prescribed that lift load'
  );
}

console.log(
  failures === 0
    ? `\nconditioning-rotation: all ${total} checks passed\n`
    : `\nconditioning-rotation: ${failures} of ${total} checks FAILED\n`
);
process.exitCode = failures === 0 ? 0 : 1;
