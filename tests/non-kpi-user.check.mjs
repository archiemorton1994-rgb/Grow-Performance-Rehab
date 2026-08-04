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
  'the decision is made on a recent window, not an all-time count',
  /export const RECENT_WINDOW = ([2-9]|\d\d)/.test(store) &&
    /const recent = completedSessions\.slice\(0, RECENT_WINDOW\)/.test(store),
  'an all-time count means one squat two years ago pins someone to the barbell rotation forever'
);
check(
  'a recent lift keeps the strength rotation exactly as it was',
  /if \(liftsRecently \|\| completedSessions\.length < NON_KPI_EVIDENCE\) \{\s*\n\s*return SESSION_ORDER/.test(
    store
  ),
  ''
);
check(
  'the divert needs more than one session of evidence',
  /export const NON_KPI_EVIDENCE = ([2-9]|\d\d)/.test(store),
  'switching on the first non-strength session would be too twitchy'
);
check(
  'the suggestion comes from the types they have actually trained',
  /const vocabulary: SessionType\[\] = \[\];/.test(store),
  'a fixed fallback rotation would just be a different arbitrary default'
);
check(
  "'custom' is never suggested",
  /if \(s\.sessionType === 'custom'\) continue;/.test(store),
  'generateWorkout returns [] for custom, so suggesting it hands the user an empty workout'
);

// ─── 3b. Behaviour, run against the real constants ───────────────────────────
console.log('\n[3b] The suggestion, simulated');

// Read the constants out of the source rather than importing it: lib/store.ts
// pulls in '@/lib/...' as runtime values and plain node cannot resolve the
// alias. Extraction is asserted below, so a rename fails loudly here instead of
// silently simulating against stale defaults.
const grab = (re, label) => {
  const m = store.match(re);
  check(`read ${label} from lib/store.ts`, m != null, 'constant renamed or removed?');
  return m;
};
const SESSION_ORDER = (
  grab(/export const SESSION_ORDER: SessionType\[\] = \[([^\]]+)\]/, 'SESSION_ORDER')?.[1] ?? ''
)
  .split(',')
  .map((s) => s.trim().replace(/'/g, ''))
  .filter(Boolean);
const RECENT_WINDOW = Number(
  grab(/export const RECENT_WINDOW = (\d+)/, 'RECENT_WINDOW')?.[1] ?? NaN
);
const NON_KPI_EVIDENCE = Number(
  grab(/export const NON_KPI_EVIDENCE = (\d+)/, 'NON_KPI_EVIDENCE')?.[1] ?? NaN
);
const NON_KPI_FALLBACK =
  grab(/export const NON_KPI_FALLBACK: SessionType = '([a-z_]+)'/, 'NON_KPI_FALLBACK')?.[1] ?? '';

// Mirror of getCurrentSessionType's non-test-week path. History is newest-first,
// as completedSessions is.
function suggest(history, cycleStartOffset = 0) {
  const sessions = history.map((t) => ({ sessionType: t }));
  const strengthCount = sessions.filter((s) => SESSION_ORDER.includes(s.sessionType)).length;
  const recent = sessions.slice(0, RECENT_WINDOW);
  const liftsRecently = recent.some((s) => SESSION_ORDER.includes(s.sessionType));
  if (liftsRecently || sessions.length < NON_KPI_EVIDENCE) {
    return SESSION_ORDER[(strengthCount + cycleStartOffset) % 3];
  }
  const vocabulary = [];
  for (const s of sessions) {
    if (SESSION_ORDER.includes(s.sessionType)) continue;
    if (s.sessionType === 'custom') continue;
    if (!vocabulary.includes(s.sessionType)) vocabulary.push(s.sessionType);
  }
  return vocabulary.length > 0 ? vocabulary[vocabulary.length - 1] : NON_KPI_FALLBACK;
}

const scenarios = [
  ['four conditioning sessions is answered with conditioning', ['conditioning', 'conditioning', 'conditioning', 'conditioning'], 'conditioning'],
  ['eight rehab sessions is answered with rehab', Array(8).fill('prehab'), 'prehab'],
  ['a lifter mid-cycle keeps the rotation', ['bench', 'squat', 'deadlift', 'bench', 'squat'], 'deadlift'],
  ['a lifter who spent six sessions rehabbing is offered rehab', ['prehab', 'prehab', 'prehab', 'prehab', 'prehab', 'prehab', 'deadlift', 'bench', 'squat'], 'prehab'],
  ['and one squat restores the rotation where it left off', ['squat', 'prehab', 'prehab', 'prehab', 'prehab', 'prehab', 'prehab', 'deadlift', 'bench', 'squat'], 'bench'],
  ['a custom-only user is never handed an empty custom session', ['custom', 'custom', 'custom', 'custom'], NON_KPI_FALLBACK],
  ['custom plus conditioning suggests the conditioning', ['custom', 'conditioning', 'custom', 'conditioning'], 'conditioning'],
];
for (const [label, history, expected] of scenarios) {
  const got = suggest(history);
  check(label, got === expected, `got "${got}", expected "${expected}"`);
}

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
