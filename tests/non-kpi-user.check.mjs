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
    /\.slice\(0, RECENT_WINDOW\)\s*\n?\s*\.some\(\(s\) => SESSION_ORDER\.includes/.test(store),
  'an all-time count means one squat two years ago pins someone to the barbell rotation forever'
);
check(
  'a recent lift keeps the strength rotation exactly as it was',
  /if \(get\(\)\.isOnStrengthProgramme\(\)\) \{\s*\n\s*return SESSION_ORDER/.test(store),
  ''
);
// The home card and the Your Program screen must not answer "which programme is
// this person on" separately — they would drift, and Home would suggest
// conditioning while Program drew a barbell timeline.
check(
  'the decision lives in one shared selector',
  /isOnStrengthProgramme: \(\) => \{/.test(store),
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
// This used to read "'custom' is never suggested", which was the right rule for
// the wrong reason. generateWorkout returns [] for custom, so it must never
// enter the ROTATION — otherwise someone who mixes custom and conditioning
// would eventually be handed an empty workout. But excluding it from the answer
// entirely meant a custom-ONLY user, with no other vocabulary to draw on, was
// offered a generated full-body session they had never once chosen. It is held
// back from the rotation and used as the last resort instead.
check(
  "'custom' is held out of the rotation",
  /if \(s\.sessionType === 'custom'\) \{\s*\n\s*hasCustom = true;\s*\n\s*continue;/.test(store),
  'mixing it into the rotation would eventually hand the user an empty workout'
);
check(
  'but a custom-only user is still offered their own session',
  /return hasCustom \? 'custom' : NON_KPI_FALLBACK;/.test(store),
  'the fallback pointed them at a generated full-body session they never chose'
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
// as completedSessions is. `testsOn` matters: saying yes to test weeks raises
// how much evidence is needed before the barbell rotation is abandoned.
function suggest(history, cycleStartOffset = 0, testsOn = false) {
  const sessions = history.map((t) => ({ sessionType: t }));
  const strengthCount = sessions.filter((s) => SESSION_ORDER.includes(s.sessionType)).length;
  const recent = sessions.slice(0, RECENT_WINDOW);
  const liftsRecently = recent.some((s) => SESSION_ORDER.includes(s.sessionType));
  const evidenceNeeded = testsOn ? RECENT_WINDOW : NON_KPI_EVIDENCE;
  if (liftsRecently || sessions.length < evidenceNeeded) {
    return SESSION_ORDER[(strengthCount + cycleStartOffset) % 3];
  }
  const vocabulary = [];
  let hasCustom = false;
  for (const s of sessions) {
    if (SESSION_ORDER.includes(s.sessionType)) continue;
    if (s.sessionType === 'custom') {
      hasCustom = true;
      continue;
    }
    if (!vocabulary.includes(s.sessionType)) vocabulary.push(s.sessionType);
  }
  if (vocabulary.length > 0) return vocabulary[vocabulary.length - 1];
  return hasCustom ? 'custom' : NON_KPI_FALLBACK;
}

const scenarios = [
  ['four conditioning sessions is answered with conditioning', ['conditioning', 'conditioning', 'conditioning', 'conditioning'], 'conditioning'],
  ['eight rehab sessions is answered with rehab', Array(8).fill('prehab'), 'prehab'],
  ['a lifter mid-cycle keeps the rotation', ['bench', 'squat', 'deadlift', 'bench', 'squat'], 'deadlift'],
  ['a lifter who spent six sessions rehabbing is offered rehab', ['prehab', 'prehab', 'prehab', 'prehab', 'prehab', 'prehab', 'deadlift', 'bench', 'squat'], 'prehab'],
  ['and one squat restores the rotation where it left off', ['squat', 'prehab', 'prehab', 'prehab', 'prehab', 'prehab', 'prehab', 'deadlift', 'bench', 'squat'], 'bench'],
  ['a custom-only user is offered their own session, not a generated one', ['custom', 'custom', 'custom', 'custom'], 'custom'],
  ['custom plus conditioning suggests the conditioning', ['custom', 'conditioning', 'custom', 'conditioning'], 'conditioning'],
];
for (const [label, history, expected] of scenarios) {
  const got = suggest(history);
  check(label, got === expected, `got "${got}", expected "${expected}"`);
}

// ─── 3b-ii. Opting IN must keep the barbell rotation ─────────────────────────
console.log('\n[3b-ii] Saying yes to test weeks keeps the KPI programme');

// The failure this guards against is circular and easy to miss: a flat
// three-session threshold meant three conditioning sessions in someone's first
// fortnight moved them off the barbell rotation — and once off it they could
// never be tested either, because a test only comes due on a strength session.
// Opting in led to never being offered the thing you opted into.
check(
  'the threshold depends on the opt-in',
  /const evidenceNeeded = testWeekFrequency === 'never' \? NON_KPI_EVIDENCE : RECENT_WINDOW;/.test(
    store
  ),
  'without this, opting in and then doing anything else for a fortnight silently cancels it'
);

const optedInScenarios = [
  ['a brand-new opted-in user is offered a KPI lift', [], SESSION_ORDER[0]],
  [
    `${NON_KPI_EVIDENCE} non-KPI sessions do NOT divert an opted-in user`,
    Array(NON_KPI_EVIDENCE).fill('conditioning'),
    SESSION_ORDER[0],
  ],
  [
    `${RECENT_WINDOW - 1} still does not`,
    Array(RECENT_WINDOW - 1).fill('conditioning'),
    SESSION_ORDER[0],
  ],
  [
    `a full window of ${RECENT_WINDOW} finally does`,
    Array(RECENT_WINDOW).fill('conditioning'),
    'conditioning',
  ],
  [
    'and one KPI lift brings the rotation straight back',
    ['squat', ...Array(RECENT_WINDOW).fill('conditioning')],
    SESSION_ORDER[1],
  ],
];
for (const [label, history, expected] of optedInScenarios) {
  const got = suggest(history, 0, true);
  check(label, got === expected, `got "${got}", expected "${expected}"`);
}

// The opposite user must keep the lighter threshold — they said the opposite,
// and taking three sessions at their word is the whole point.
check(
  `someone who declined test weeks still diverts after ${NON_KPI_EVIDENCE}`,
  suggest(Array(NON_KPI_EVIDENCE).fill('conditioning'), 0, false) === 'conditioning',
  'raising the bar for everyone would undo the inclusivity work'
);

// 'custom' is the one suggestion the home card cannot send through readiness:
// generateWorkout returns [] for it, so a custom session is built rather than
// generated. It used to be excluded from the answer entirely for that reason,
// which meant a custom-only user was offered a generated full-body session they
// had never once chosen. The suggestion is honest now, and it is the ROUTING
// that has to differ.
const home = read('../app/(tabs)/index.tsx');
check(
  "a suggested custom session opens the builder, not readiness",
  /suggestedSession === 'custom'\)\s*\{[\s\S]{0,120}?router\.push\('\/custom-session'\)/.test(home),
  'sending it to readiness would end in an empty workout, which is why it used to be suppressed'
);
check(
  'and that branch returns before the readiness push',
  /router\.push\('\/custom-session'\);[\s\S]{0,40}?return;/.test(home),
  'without the return it would push both screens'
);

// ─── 3c. "Your Program" shows the programme they are actually on ─────────────
console.log('\n[3c] The Your Program screen stops drawing a barbell cycle');

const program = read('../app/program.tsx');

check(
  'it asks the same question the home card does',
  /const onStrengthProgramme = isOnStrengthProgramme\(\);/.test(program),
  'answering it separately would let Home suggest conditioning while this screen drew a squat timeline'
);
check(
  'the non-barbell timeline is built from real history',
  /if \(!onStrengthProgramme\) \{[\s\S]{0,400}?completedSessions\.slice\(0, NON_KPI_TIMELINE\)/.test(
    program
  ),
  'it used to build every timeline from SESSION_ORDER[i % 3] regardless'
);
check(
  'it ends on whatever the home card suggests next',
  /items\.push\(\{ sessionType: suggestedNext, status: 'current'/.test(program),
  ''
);
check(
  'the cycle badge is hidden off the barbell programme',
  /\{onStrengthProgramme && \(\s*\n?\s*<View style=\{styles\.cycleBadge\}>/.test(program),
  'a cycle number means nothing to someone not running cycles'
);
check(
  'the cycle-position dots are hidden too',
  /\{onStrengthProgramme && \(\s*\n?\s*<View style=\{styles\.arcCard\}>/.test(program),
  ''
);
check(
  '"until test" is replaced rather than left counting down',
  /onStrengthProgramme \? 'until test' : 'week streak'/.test(program),
  ''
);
check(
  'the subtitle is no longer unconditionally the three lifts',
  !/^\s*Squat · Bench · Deadlift · \{getEquipmentLabel/m.test(program) &&
    /trainingMix/.test(program),
  'it read "Squat · Bench · Deadlift" to everyone'
);
check(
  'there is copy that does not mention cycles or tests',
  /function getNonStrengthMessage\(/.test(program),
  'getContextMessage talks of little else'
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
