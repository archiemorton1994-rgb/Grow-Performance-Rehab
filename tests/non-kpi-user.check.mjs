/**
 * Contract test: the app does not force the three barbell lifts on everyone.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Plenty of people who would use this app do not squat, bench and deadlift.
 * Custom-session-only users, people who follow the conditioning and mobility
 * work in their own pattern, people doing weeks of rehab. Reported by the
 * owner: "regardless of what you put or what you intend to do, test week and
 * the KPI lifts are there whether you like it or not."
 *
 * Two things were forcing it, and neither was obvious from the code:
 *
 *  1. getCurrentSessionType could ONLY return squat, bench or deadlift, and it
 *     counts strength sessions to pick between them — filtering non-strength
 *     ones out first. So a conditioning-only user sat at a count of zero
 *     forever and Home said "Today: Squat Session" every single day, with
 *     nothing they logged able to move it.
 *  2. TestWeekFrequency was `12 | 18`. There was no off. And the only decline
 *     control in the app rendered exclusively for bodyweight/bands users, so
 *     anyone on dumbbells or above could not postpone a max-effort barbell test
 *     at all.
 *
 * Run:  node tests/non-kpi-user.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dir, rel), 'utf8');
const store = read('../lib/store.ts');
const readiness = read('../app/readiness.tsx');
const profile = read('../app/(tabs)/profile.tsx');
const home = read('../app/(tabs)/index.tsx');

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

// ─── 1. Test weeks can be turned off ─────────────────────────────────────────
console.log('\n[1] Test weeks are declinable');

check(
  "TestWeekFrequency includes 'never'",
  /export type TestWeekFrequency = 12 \| 18 \| 'never'/.test(store),
  ''
);
check(
  'getTestWeekProgress short-circuits when off',
  /if \(testWeekFrequency === 'never'\) return idleOff;/.test(store),
  'expected an early return before the resume-a-part-finished-block branch'
);
check(
  'the off switch is checked BEFORE the resume branch',
  store.indexOf("testWeekFrequency === 'never'") < store.indexOf('Part-way through'),
  'someone who turns tests off mid-block must be released, not told they owe two more'
);
check(
  'Settings offers Never alongside 12 and 18',
  /\(\[12, 18, 'never'\] as const\)/.test(profile),
  ''
);

// ─── 2. Declining is available to everyone, at the moment it is imposed ──────
console.log('\n[2] The decline control is not equipment-gated');

check(
  'the defer banner no longer requires sub-dumbbell equipment to render',
  !/effectiveTestWeek &&\s*\n?\s*TIER_ORDER\.indexOf\(effectiveTier\) < TIER_ORDER\.indexOf\('dumbbells'\) && \(/.test(
    readiness
  ),
  'the whole banner was behind an equipment check, so most users had no way out'
);
check(
  'there is a turn-tests-off action on the readiness screen',
  /testID="disable-test-weeks"/.test(readiness) && /setTestWeekFrequency\('never'\)/.test(readiness),
  'declining must be possible where the test is imposed, not only in a settings sheet'
);
check(
  'postponing is still available too',
  /testID="postpone-test-week"/.test(readiness),
  'not now and never are different answers'
);

// ─── 3. Home stops recommending a lift you never do ──────────────────────────
console.log('\n[3] The home suggestion follows what you actually train');

check(
  'a non-KPI rotation exists',
  /export const NON_KPI_ROTATION: SessionType\[\]/.test(store),
  ''
);
check(
  'it contains no KPI lift',
  !/NON_KPI_ROTATION[\s\S]{0,200}?'(squat|bench|deadlift)'/.test(store),
  'the whole point is that it suggests something else'
);
check(
  'getCurrentSessionType can return a non-KPI type',
  /if \(completedSessions\.length >= NON_KPI_EVIDENCE\) \{\s*\n\s*return NON_KPI_ROTATION/.test(store),
  ''
);
check(
  'it only diverts when there is zero barbell history',
  /if \(strengthCount > 0\) return SESSION_ORDER/.test(store),
  'anyone who does lift must keep the strength rotation exactly as it was'
);
check(
  'the divert needs more than one session of evidence',
  /export const NON_KPI_EVIDENCE = ([2-9]|\d\d)/.test(store),
  'switching on the first non-strength session would be too twitchy'
);

// ─── 4. The countdown is hidden when there is nothing to count to ────────────
console.log('\n[4] Home does not count down to an event that will not happen');

check(
  'the block progress bar is gated on tests being on',
  /const showBlockProgress = testsOn &&/.test(home),
  'a "Test week in 3 sessions" bar is nonsense once tests are off'
);

console.log('');
if (failures > 0) {
  console.error(`non-kpi-user: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`non-kpi-user: all ${total} checks passed\n`);
  process.exit(0);
}
