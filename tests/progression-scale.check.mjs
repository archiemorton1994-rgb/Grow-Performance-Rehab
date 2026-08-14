/**
 * Contract test: the weight jump is sized against the lift, not against a
 * fixed number of kilograms.
 *
 * WHAT WENT WRONG
 * ───────────────
 * Progression was a flat step — hold on a failure, +2.5 kg normally, +5 kg on a
 * streak or a thumbs-up, +7.5 kg on "5+ reps left" — applied identically to
 * every exercise in the app. Measured over twelve sessions with NO feedback
 * given, which is the default path and what most users will actually get:
 *
 *     Barbell Deadlift    140 kg -> 192.5 kg    +38%
 *     Overhead Press       40 kg ->  92.5 kg   +131%
 *     DB Lateral Raise     10 kg ->  62.5 kg   +525%
 *
 * One tap of "5+ reps left" moved a lateral raise 75% in a single session.
 *
 * HOW THIS TEST IS WRITTEN
 * ────────────────────────
 * It judges the OUTPUT the way a lifter experiences it — walk a weight forward
 * session by session and look at where it ends up — rather than asserting the
 * percentages in the table. The percentages are a means; "a light dumbbell does
 * not triple in three months of ordinary training" is the promise.
 *
 * Run:  npx tsx tests/progression-scale.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { progressedLoad } from '../lib/workout-engine.ts';
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

/** Walk a weight forward, the way the engine does session after session. */
function run(startKg, sessions, perf) {
  let kg = startKg;
  let streak = 0;
  let moves = 0;
  for (let i = 0; i < sessions; i++) {
    const next = progressedLoad(kg, perf, streak, toGrid);
    if (next > kg) moves++;
    // The store resets the streak whenever explicit feedback arrives.
    streak = perf === undefined ? streak + 1 : 0;
    kg = next;
  }
  return { kg, moves, gain: (kg - startKg) / startKg };
}

// ── 1. A failure holds ───────────────────────────────────────────────────────
console.log('\n[1] A failed session never adds weight');
for (const kg of [140, 40, 10]) {
  check(`${kg} kg holds after a failure`, progressedLoad(kg, 'failed', 9, toGrid) === kg);
}

// ── 2. Nothing runs away on the default path ─────────────────────────────────
// Twelve sessions of just turning up and saying nothing.
console.log('\n[2] Twelve quiet sessions do not produce an impossible weight');
const QUIET = [
  { name: 'Barbell Deadlift', start: 140, ceiling: 0.45 },
  { name: 'Back Squat', start: 100, ceiling: 0.45 },
  { name: 'Overhead Press', start: 40, ceiling: 0.45 },
  { name: 'DB Lateral Raise', start: 10, ceiling: 1.0 },
  { name: 'DB Bicep Curl', start: 12, ceiling: 1.0 },
];
for (const l of QUIET) {
  const r = run(l.start, 12, undefined);
  check(
    `${l.name}: ${l.start} -> ${r.kg} kg (+${Math.round(r.gain * 100)}%, moved ${r.moves}/12)`,
    r.gain <= l.ceiling,
    `gained more than ${Math.round(l.ceiling * 100)}%`
  );
}

// ── 3. A light lift does not move every single session ───────────────────────
// This is the one the flat step got most wrong. The smallest plate is 25% of a
// 10 kg dumbbell, so the honest answer is to wait, not to take it every time.
console.log('\n[3] A light dumbbell waits for the jump it cannot make smaller');
const light = run(10, 12, undefined);
check(
  `a 10 kg lift moved ${light.moves} times in 12 quiet sessions, not 12`,
  light.moves < 12 && light.moves > 0,
  light.moves === 0 ? 'it never progresses at all' : 'it still climbs every session'
);

// ── 4. A heavy lift is NOT slowed down ───────────────────────────────────────
// One grid step is under 2% of a deadlift, which is a normal week's work.
console.log('\n[4] A heavy barbell lift still progresses every session');
const heavy = run(140, 12, undefined);
check(
  `a 140 kg lift moved ${heavy.moves}/12 quiet sessions`,
  heavy.moves === 12,
  'the gate is catching lifts it should not'
);

// ── 5. The step scales with the load ─────────────────────────────────────────
console.log('\n[5] The same feedback means a bigger jump on a bigger lift');
const bigJump = progressedLoad(140, 'very_easy', 0, toGrid) - 140;
const smallJump = progressedLoad(40, 'very_easy', 0, toGrid) - 40;
check(
  `"5+ reps left" adds ${bigJump} kg at 140 kg and ${smallJump} kg at 40 kg`,
  bigJump > smallJump,
  'the step is still flat'
);
check(
  'and neither is more than a tenth of the weight',
  bigJump / 140 <= 0.1 && smallJump / 40 <= 0.1,
  `${((bigJump / 140) * 100).toFixed(0)}% / ${((smallJump / 40) * 100).toFixed(0)}%`
);

// ── 6. Progress is always real ───────────────────────────────────────────────
// A percentage that rounds back onto the weight it came from is the app telling
// someone they earned something and then handing them the same bar.
console.log('\n[6] When it moves, it moves by something the gym can load');
for (const kg of [140, 100, 70, 40, 20, 12, 10]) {
  const next = progressedLoad(kg, 'very_easy', 0, toGrid);
  check(
    `${kg} kg -> ${next} kg`,
    next > kg && toGrid(next) === next,
    next === kg ? 'no change at all' : 'not a loadable weight'
  );
}

console.log('');
if (failures > 0) {
  console.error(`progression-scale: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`progression-scale: all ${total} checks passed\n`);
  process.exitCode = 0;
}
