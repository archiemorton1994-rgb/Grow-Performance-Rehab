/**
 * Contract test: a shorter session is the same session with less in it.
 *
 * WHAT THIS IS FOR
 * ────────────────
 * The builder now asks how long you have got, and removes blocks to fit. The
 * rules it has to honour were given in one sentence:
 *
 *   "It should always prioritise cardio warm up, active mobility, activation
 *    and KPI lift ... athletic performance would prioritise power primer.
 *    Muscle & Aesthetics would be accessories. General fitness would be
 *    conditioning."
 *
 * Those are the promises, and they are what this checks — not the contents of
 * the table that currently satisfies them. A 30-minute athletic session that
 * has dropped its power primer is not a short athletic session, it is a
 * different session, and that is the failure this must catch however the table
 * is later edited.
 *
 * The monotonicity check is the one that is easy to break by accident: it is
 * very natural to tune the 45-minute shape and leave 60 with fewer accessories
 * than 45 has, so that choosing MORE time silently takes work away.
 *
 * Run:  npx tsx tests/session-duration.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import {
  blocksForSession,
  estimatedMinutes,
  durationForPicks,
  SESSION_DURATIONS,
  SESSION_GOALS,
  PROTECTED_BLOCKS,
  GOAL_SIGNATURE_BLOCK,
} from '../lib/session-builder.ts';

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

const GOALS = SESSION_GOALS.map((g) => g.key);

check(
  `three goals and three lengths (${GOALS.length} x ${SESSION_DURATIONS.length})`,
  GOALS.length === 3 && SESSION_DURATIONS.length === 3,
  `${GOALS.join(',')} / ${SESSION_DURATIONS.join(',')}`
);

// ── 1. The spine is never cut ────────────────────────────────────────────────
console.log('\n[1] Warm-up, mobility, activation and the lift survive every length');
for (const goal of GOALS) {
  for (const d of SESSION_DURATIONS) {
    const ids = new Set(blocksForSession(goal, d).map((b) => b.id));
    const missing = PROTECTED_BLOCKS.filter((p) => !ids.has(p));
    check(`${goal} at ${d} min keeps all four`, missing.length === 0, `missing ${missing.join(', ')}`);
  }
}

// ── 2. Each goal keeps the block it exists for ───────────────────────────────
console.log('\n[2] The goal still means something at 30 minutes');
for (const goal of GOALS) {
  const want = GOAL_SIGNATURE_BLOCK[goal];
  for (const d of SESSION_DURATIONS) {
    const ids = new Set(blocksForSession(goal, d).map((b) => b.id));
    check(`${goal} at ${d} min keeps its ${want}`, ids.has(want), `${[...ids].join(', ')}`);
  }
}

// ── 3. More time never takes anything away ───────────────────────────────────
console.log('\n[3] Choosing a longer session can only ever add');
for (const goal of GOALS) {
  for (let i = 1; i < SESSION_DURATIONS.length; i++) {
    const shorter = blocksForSession(goal, SESSION_DURATIONS[i - 1]);
    const longer = blocksForSession(goal, SESSION_DURATIONS[i]);
    const longerById = new Map(longer.map((b) => [b.id, b]));

    const lost = shorter.filter((b) => !longerById.has(b.id)).map((b) => b.id);
    check(
      `${goal}: nothing in ${SESSION_DURATIONS[i - 1]} is missing from ${SESSION_DURATIONS[i]}`,
      lost.length === 0,
      lost.join(', ')
    );

    const shrunk = shorter
      .filter((b) => longerById.has(b.id) && longerById.get(b.id).picks < b.picks)
      .map((b) => `${b.id} ${b.picks}->${longerById.get(b.id).picks}`);
    check(
      `${goal}: no block shrinks going ${SESSION_DURATIONS[i - 1]} -> ${SESSION_DURATIONS[i]}`,
      shrunk.length === 0,
      shrunk.join(', ')
    );
  }
}

// ── 4. The number on screen is true ──────────────────────────────────────────
// The screen prints "about 45 min". A shape that actually runs an hour makes
// that a lie, and the lie is the whole feature.
console.log('\n[4] Each shape is close to the length it is offered as');
const TOLERANCE = 5;
for (const goal of GOALS) {
  for (const d of SESSION_DURATIONS) {
    const mins = estimatedMinutes(blocksForSession(goal, d));
    const drift = mins - Number(d);
    check(
      `${goal} at ${d} min estimates ${mins} min (${drift >= 0 ? '+' : ''}${drift})`,
      Math.abs(drift) <= TOLERANCE,
      `more than ${TOLERANCE} minutes out`
    );
  }
}

// ── 5. Lengths are ordered ───────────────────────────────────────────────────
console.log('\n[5] A 60 is longer than a 45 is longer than a 30');
for (const goal of GOALS) {
  const mins = SESSION_DURATIONS.map((d) => estimatedMinutes(blocksForSession(goal, d)));
  check(
    `${goal}: ${mins.join(' < ')}`,
    mins[0] < mins[1] && mins[1] < mins[2],
    'the shapes are not in increasing order of length'
  );
}

// ── 6. Reopening a saved session can always show all of it ───────────────────
console.log('\n[6] A restored session opens at a length that can show every block');
for (const goal of GOALS) {
  for (const d of SESSION_DURATIONS) {
    const filled = blocksForSession(goal, d).map((b) => b.id);
    const inferred = durationForPicks(goal, filled);
    const shown = new Set(blocksForSession(goal, inferred).map((b) => b.id));
    const hidden = filled.filter((id) => !shown.has(id));
    check(
      `${goal} built at ${d} reopens at ${inferred} with nothing hidden`,
      hidden.length === 0,
      `unreachable: ${hidden.join(', ')}`
    );
  }
}

console.log('');
if (failures > 0) {
  console.error(`session-duration: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`session-duration: all ${total} checks passed\n`);
  process.exitCode = 0;
}
