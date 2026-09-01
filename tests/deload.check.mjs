/**
 * Contract test: a stalled lift gets backed off, not handed the same bar again.
 *
 * WHAT WAS MISSING
 * ────────────────
 * Adding weight was automatic and taking it off was not. The app already KNEW
 * when someone was stuck — `exerciseStuckStreak` counts consecutive failed
 * sessions per exercise — and at three the session summary said, in these words:
 *
 *     "Held at this weight for 3 sessions in a row - a deload or swapping this
 *      exercise for a while could help it move again."
 *
 * It named the remedy and did not apply it. The engine never read that counter,
 * so a stalled lift sat at the same weight indefinitely while the app asked the
 * user to work out the deload for themselves. coach.ts did the same one level
 * up: DELOAD_WEEKS = 4, also only a suggestion. Two places that spotted the
 * need; none that acted.
 *
 * That asymmetry — confident about adding load, timid about removing it — was
 * the real gap in progression, and a bigger problem than the size of the step.
 *
 * WHAT THIS ASSERTS
 * ─────────────────
 * The behaviour a lifter would recognise: one bad day is not a stall, three in
 * a row is, the cut is real, it does not spiral, and the card says so.
 *
 * Run:  npx tsx tests/deload.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import {
  progressedLoad,
  deloadedLoad,
  easeForDeloadWeek,
  generateWorkout,
  DELOAD_WEEK_LOAD,
} from '../lib/workout-engine.ts';
import { roundToLoadable } from '../lib/utils.ts';

const toGrid = (v) => roundToLoadable(v, 'kg');

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

// ── 1. One bad day is not a stall ────────────────────────────────────────────
console.log('\n[1] A single failure holds; it does not cut the weight');
for (const n of [0, 1, 2]) {
  check(`${n} failure(s) in a row: no deload`, deloadedLoad(140, n, toGrid) === null);
}

// ── 2. Three in a row is ─────────────────────────────────────────────────────
console.log('\n[2] Three in a row backs the weight off');
const d = deloadedLoad(140, 3, toGrid);
check(`140 kg -> ${d} kg`, d !== null && d < 140, 'nothing happened');
check(
  'the cut is about a tenth, not a token',
  d !== null && (140 - d) / 140 >= 0.07 && (140 - d) / 140 <= 0.13,
  d === null ? 'no deload' : `${(((140 - d) / 140) * 100).toFixed(0)}%`
);
check('and it lands on a weight the gym can load', d !== null && toGrid(d) === d);

// ── 3. It does not spiral ────────────────────────────────────────────────────
// The stuck counter is only reset by a session that does NOT fail, so a bare
// `>= 3` would take another 10% off every session until something gave.
console.log('\n[3] Failing again holds before it cuts again');
check('4 failures: holds', deloadedLoad(140, 4, toGrid) === null);
check('5 failures: holds', deloadedLoad(140, 5, toGrid) === null);
check('6 failures: cuts again', deloadedLoad(140, 6, toGrid) !== null);

// ── 4. The whole shape, as a lifter would live it ────────────────────────────
console.log('\n[4] Climb, stall, back off, come again');
let kg = 140;
let stuck = 0;
const weights = [];
for (let s = 1; s <= 12; s++) {
  const failed = s > 4;
  if (failed) {
    stuck += 1;
    const dl = deloadedLoad(kg, stuck, toGrid);
    if (dl !== null) kg = dl;
  } else {
    kg = progressedLoad(kg, undefined, s - 1, toGrid, 'intermediate');
    stuck = 0;
  }
  weights.push(kg);
}
const peak = Math.max(...weights);
const end = weights[weights.length - 1];
console.log(`     ${weights.join(' -> ')}`);
check('the weight rises, then comes back down', peak > 140 && end < peak, weights.join(' -> '));
check(
  'and it is not still climbing at the end',
  end < peak,
  'a stall that never resolves is the thing this fixes'
);

// ── 5. A light lift is not cut below something loadable ──────────────────────
console.log('\n[5] A deload that cannot change anything does not pretend to');
// 10% of 2.5 kg is not expressible on a 2.5 kg grid.
check('a 2.5 kg lift holds rather than reporting a phantom cut', deloadedLoad(2.5, 3, toGrid) === null);

// ── 6. The card tells the truth ──────────────────────────────────────────────
// Every other note on a failed session says "held steady". On the session where
// the weight actually came down that would describe something that did not
// happen — the same fault the time-off note exists to avoid.
console.log('\n[6] The card says the weight came down');
const engine = readFileSync(new URL('../lib/workout-engine.ts', import.meta.url), 'utf8');
check(
  'the progression note has a deload case',
  /deloaded !== null[\s\S]{0,120}Eased back/.test(engine),
  'a deloaded card would still read "Held steady"'
);
check(
  'and it reads the stuck streak to decide',
  /exerciseStuckStreak\?\.\[ex\.id\]/.test(engine),
  'the note is not derived from the same signal as the weight'
);

// ── 7. Experience level is actually used ─────────────────────────────────────
// It is collected at onboarding and was ignored here, so a beginner and a
// fifteen-year lifter got identical jumps.
console.log('\n[7] A beginner climbs faster than an experienced lifter');
function run(level) {
  let w = 140;
  let streak = 0;
  for (let i = 0; i < 12; i++) {
    w = progressedLoad(w, undefined, streak, toGrid, level);
    streak++;
  }
  return w;
}
const beginner = run('beginner');
const intermediate = run('intermediate');
check(
  `beginner reaches ${beginner} kg, intermediate ${intermediate} kg`,
  beginner > intermediate,
  'experience level is being ignored'
);
check(
  'an unknown level is treated as intermediate, not as the fastest',
  run(undefined) === intermediate,
  'a missing profile should not get novice progression'
);

// ─── The PLANNED easier week, which is the other half of the same idea ──────
//
// Everything above is the app noticing damage: three failed sessions, so back
// the weight off. A deload week is the app preventing it, and it is the only
// load reduction in here that happens while everything is going well - which is
// exactly why it has to be announced as loudly as it is applied.
console.log('\n[Planned easier week]');

const ex = (over = {}) => ({
  id: 'x',
  name: 'Back Squat',
  sets: 4,
  reps: '5',
  cue: '',
  suggestedLoad: '100 kg',
  loadKg: [100],
  category: 'main',
  videoId: '',
  hasSwap: false,
  ...over,
});

const eased = easeForDeloadWeek([ex()], 'kg')[0];

check(
  'the bar comes down, in the sentence AND in the number the app lifts from',
  eased.suggestedLoad.includes('90') && eased.loadKg[0] === 90,
  `${eased.suggestedLoad} / ${JSON.stringify(eased.loadKg)}`
);
check(
  // Two halves of one prescription. Taking 10% off and leaving the volume where
  // it was is a lighter session, not an easier week.
  'and a set comes off the hard work',
  eased.sets === 3,
  `${eased.sets}`
);
check(
  // The single most damaging way a deload can look. Every other note the app
  // writes about a load explains a step up; the same note over a weight that
  // just dropped 10% is the app appearing to have lost the user's numbers.
  'the card says why, rather than leaving a lighter weight to be discovered',
  /easier week/i.test(eased.progressionNote ?? '') && eased.progressionDirection === 'hold',
  eased.progressionNote
);
check(
  'nothing is eased below two working sets',
  easeForDeloadWeek([ex({ sets: 2 })], 'kg')[0].sets === 2,
  ''
);
check(
  // The warm-up is not the hard work, and neither is the rehab. Taking a set
  // off either makes the session worse and the week no easier.
  'prep, prehab and cooldown keep their sets',
  ['prep', 'prehab', 'cooldown', 'mechanical', 'neuro'].every(
    (category) => easeForDeloadWeek([ex({ category, sets: 4 })], 'kg')[0].sets === 4
  ),
  ''
);
check(
  'work with no weight on it still loses its set, and is not given a number',
  (() => {
    const band = easeForDeloadWeek(
      [ex({ suggestedLoad: 'Bodyweight', loadKg: undefined, category: 'accessory' })],
      'kg'
    )[0];
    return band.sets === 3 && band.suggestedLoad === 'Bodyweight';
  })(),
  ''
);
check(
  // A coarse grid can round a 10% cut straight back onto the weight it came
  // from. "Eased back" printed over an unchanged number is the one outcome
  // worse than not easing at all.
  'a cut that the grid rounds away never reads as heavier than it was',
  easeForDeloadWeek([ex({ suggestedLoad: '2.5 kg', loadKg: [2.5] })], 'kg')[0].loadKg[0] <= 2.5,
  ''
);
check(
  'the share taken off is a real cut and a modest one',
  DELOAD_WEEK_LOAD > 0.8 && DELOAD_WEEK_LOAD < 1,
  `${DELOAD_WEEK_LOAD}`
);

// The whole path, not just the transform: a flag on the readiness check has to
// reach the finished list, or the week is planned and never happens.
const profile = {
  name: 'T',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['strength'],
  bodyweightKg: 80,
};
const build = (deload) =>
  generateWorkout(
    'squat',
    'fullgym',
    { hasAches: false, energy: 'normal', timeAvailable: '60', deload },
    profile,
    undefined,
    undefined,
    10,
    { squat: 100 },
    undefined,
    undefined,
    0
  );

const plain = build(false);
const light = build(true);

check(
  'a deload flag on the readiness check reaches the session that is built',
  (() => {
    const setsPlain = plain.reduce((n, e) => n + e.sets, 0);
    const setsLight = light.reduce((n, e) => n + e.sets, 0);
    return plain.length > 0 && setsLight < setsPlain;
  })(),
  `${plain.reduce((n, e) => n + e.sets, 0)} sets vs ${light.reduce((n, e) => n + e.sets, 0)}`
);
check(
  'and every weight in it is lighter than the same session without the flag',
  (() => {
    const weightOf = (list) =>
      list
        .filter((e) => (e.loadKg ?? []).some((k) => k > 0))
        .map((e) => `${e.id}:${Math.max(...e.loadKg)}`);
    const a = new Map(weightOf(plain).map((x) => x.split(':')));
    const b = new Map(weightOf(light).map((x) => x.split(':')));
    if (a.size === 0) return false;
    let compared = 0;
    for (const [id, kg] of a) {
      if (!b.has(id)) continue;
      compared++;
      if (Number(b.get(id)) > Number(kg)) return false;
    }
    return compared > 0;
  })(),
  ''
);

console.log('');
if (failures > 0) {
  console.error(`deload: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`deload: all ${total} checks passed\n`);
  process.exitCode = 0;
}
