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
 * Rotation was the engine half of that defect. The other half was data: the old
 * database held exactly ONE prescribed circuit per tier and energy level, so
 * after the shuffle what changed day to day was the ORDER of the work, not which
 * work it was. This file therefore asserted what the engine could be held to —
 * the session is not frozen, and nothing was dropped or reordered into
 * nonsense — and deliberately did not assert exercise-level variety, because
 * the engine could not deliver it from a pool of one.
 *
 * CONDITIONING IS BUILT FROM ARCHIE'S NINE NOW, and the same promises are asked
 * of that session instead. The nine are the whole universe of conditioning work
 * (lib/library-conditioning.ts), the blocks are consecutive entries of whatever
 * the kit and the day allow, and which entry the session starts on moves with
 * how many conditioning sessions the person has finished. So "it is not frozen"
 * is still the question, and it is now asked of a list of nine rather than of a
 * pool of one — which is also why section 2 no longer counts a retired circuit's
 * entries. What it counts instead is whether the session gives as many blocks as
 * the clock asked for, which is the same promise ("rotation never loses work")
 * stated over the thing that actually decides the length.
 *
 * The fixed points are fixed on purpose. A warm-up that is not first is not a
 * warm-up, and a cooldown in the middle of a session is a mistake.
 *
 * Run:  npx tsx tests/conditioning-rotation.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { generateWorkout } from '../lib/workout-engine.ts';
import { BLOCKS_BY_TIME } from '../lib/library-conditioning.ts';
import { CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';
import { canPerformWith } from '../lib/kit.ts';

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
 * The conditioning work, and ONLY the work.
 *
 * Measuring the whole session would not catch the defect this file exists for.
 * The prep stretches spliced in above the work already rotated — that is the
 * "only the order of three stretches changing" the audit measured — so a test
 * that compares whole sessions goes green with the work block still frozen
 * solid. Confirmed by mutation: un-shuffling the work leaves a whole-session
 * comparison passing.
 *
 * The cool-down is excluded for the same reason, and it has to be said out loud
 * now: the new session rotates its Restore cool-down on the same count the
 * blocks move on, so a comparison that let the cool-down in would report
 * variety on a session whose every interval was identical.
 */
const workOf = (tier, energy, seedStep) =>
  session(tier, energy, seedStep)
    .filter((e) => e.category === 'cardio')
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

/**
 * How many blocks this person could be given at all, worked out here rather
 * than read off the session being measured.
 *
 * The clock asks for two, three or four blocks by length. The list can be
 * shorter than that: nine records, only three of which need no equipment, and
 * one of those three is withheld from a beginner (decision 7). So the honest
 * floor is "the clock, or the whole list if the list is shorter", and the extra
 * subtraction is the pulse raiser, which comes off the list only when there is
 * one to spare. Computed from the records and the kit, so it follows the
 * library rather than pinning a number per tier.
 */
const LIFTER_TIME = '60';
function blocksOwed(tier) {
  const usable = CONDITIONING_EXERCISES.filter((e) => canPerformWith(e, [tier]));
  const asked = BLOCKS_BY_TIME[LIFTER_TIME];
  return Math.min(asked, usable.length > asked ? usable.length - 1 : usable.length);
}

let lostWork = [];
for (const tier of TIERS) {
  const need = blocksOwed(tier);
  for (const energy of ENERGIES) {
    for (let d = 0; d < DAYS; d++) {
      const built = session(tier, energy, d);
      // Blocks only. The pulse raiser at the top and the Restore cool-down at
      // the bottom are not the work, and counting them would let a session that
      // had lost an interval pass on the strength of its warm-up.
      const got = built.filter((e) => e.category === 'cardio').length;
      if (got < need) lostWork.push(`${tier}/${energy} day ${d}: ${got} of ${need}`);
    }
  }
}
check(
  'every block the kit can fill is still prescribed, on every day of the rotation',
  lostWork.length === 0,
  lostWork.slice(0, 3).join('; ')
);

check(
  `and the floor being measured is a real one (${TIERS.map((t) => `${t}:${blocksOwed(t)}`).join(', ')})`,
  TIERS.every((t) => blocksOwed(t) >= 1) && blocksOwed('fullgym') === BLOCKS_BY_TIME[LIFTER_TIME],
  'a floor of zero blocks would pass on an empty session'
);

// ─── 3. The order that carries meaning is fixed ──────────────────────────────
console.log('\n[3] Warm-up first, the work in the middle, cooldown last');

let misplaced = { warmup: [], cooldown: [], work: [] };
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
      /**
       * NOTHING BUT THE COOL-DOWN AFTER THE LAST HARD EFFORT.
       *
       * This used to be asked of the `finisher` card, which was the old
       * conditioning circuit's closing block. The new session has no finisher -
       * every effort in it is an interval block - so the same rule is asked of
       * the last block instead: once the hard work has started, the only thing
       * allowed after it is the cool-down. A warm-up drill turning up after the
       * intervals would be exactly the mistake the old clause guarded.
       */
      const lastBlock = built.map((e) => e.category).lastIndexOf('cardio');
      if (lastBlock !== -1) {
        const after = built.slice(lastBlock + 1);
        if (after.some((e) => e.category !== 'cooldown')) {
          misplaced.work.push(`${tier}/${energy}/${d}`);
        }
      }
    }
  }
}
check('a warm-up opens every session', misplaced.warmup.length === 0, misplaced.warmup.slice(0, 3).join(', '));
check('a cooldown closes it', misplaced.cooldown.length === 0, misplaced.cooldown.slice(0, 3).join(', '));
check(
  'nothing but the cooldown comes after the last block of work',
  misplaced.work.length === 0,
  misplaced.work.slice(0, 3).join(', ')
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
