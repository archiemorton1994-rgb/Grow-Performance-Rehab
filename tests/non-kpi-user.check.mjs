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
 * The second of those is settled a different way now: strength test weeks are
 * retired outright, so there is nothing to decline and nothing that can be
 * imposed. Section 1 holds the retirement at the surface; the behaviour is in
 * tests/test-weeks-retired.check.mjs.
 *
 * Run:  node tests/non-kpi-user.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dir, rel), 'utf8');
/** Source with comments removed, so a docblock explaining a retirement cannot
 *  be mistaken for the code it describes. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
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

// ─── 1. Test weeks are retired, not merely declinable ────────────────────────
console.log('\n[1] Nobody can be given a strength test at all');

/*
 * THIS SECTION USED TO GUARD THE OPT-OUT, and the opt-out is now the only
 * option there is.
 *
 * It asserted that TestWeekFrequency had a 'never' value, that the store
 * short-circuited on it before the resume branch, that Settings offered Never
 * beside Every 12 and Every 18, and that the readiness screen carried both a
 * postpone link and a turn-tests-off link, since the decline control used to be
 * hidden behind an equipment check and most people had no way out of a
 * max-effort barbell test.
 *
 * All of that was about making an escape hatch reachable. There is nothing left
 * to escape: strength test weeks are retired and the type has one value. So the
 * promise this section makes is the stronger one, and it is made of the source
 * of every screen that used to offer or impose a test rather than of one flag.
 *
 * The behaviour underneath is in tests/test-weeks-retired.check.mjs, which runs
 * the real store and the real engine rather than reading either of them.
 */
check(
  "TestWeekFrequency has exactly one value, 'never'",
  /export type TestWeekFrequency = 'never';/.test(store),
  'a number in this type is a number some code path could put back'
);
check(
  'nothing in the store can compute a due test',
  !/getTestWeekProgress|isTestWeekDue|setTestWeekFrequency|deferTestWeek/.test(store),
  'those four were the whole mechanism: the progress object, the due flag, the setter and the postponement'
);
check(
  'the readiness screen cannot be handed one',
  !/isTestWeek/.test(stripComments(readiness)) &&
    !/testID="disable-test-weeks"/.test(readiness) &&
    !/testID="postpone-test-week"/.test(readiness),
  'it read an isTestWeek route param and changed the whole screen on it'
);
check(
  'and Settings no longer offers a frequency to choose',
  !/\[12, 18, 'never'\]/.test(profile) && !/setTestWeekFrequency/.test(profile),
  'three buttons for a setting with one value is a question with one answer'
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

// Mirror of getCurrentSessionType. History is newest-first, as
// completedSessions is. There used to be a second, higher evidence threshold
// for anyone who had opted in to strength test weeks; test weeks are retired,
// so there is one threshold and everybody is measured against it.
function suggest(history, cycleStartOffset = 0) {
  const sessions = history.map((t) => ({ sessionType: t }));
  const strengthCount = sessions.filter((s) => SESSION_ORDER.includes(s.sessionType)).length;
  const recent = sessions.slice(0, RECENT_WINDOW);
  const liftsRecently = recent.some((s) => SESSION_ORDER.includes(s.sessionType));
  if (liftsRecently || sessions.length < NON_KPI_EVIDENCE) {
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

// ─── 3b-ii. One diverting threshold, for everybody ───────────────────────────
console.log('\n[3b-ii] The barbell rotation is given up on the same evidence for everyone');

/*
 * THERE USED TO BE TWO THRESHOLDS HERE, and the second one is retired with test
 * weeks.
 *
 * Saying "test me every 12 sessions" was read as saying the three lifts were
 * part of the plan, so it took a full recent window rather than NON_KPI_EVIDENCE
 * sessions to move that person off the barbell rotation. The fault it fixed was
 * circular: three conditioning sessions in someone's first fortnight diverted
 * them, and once diverted they could never be tested either, because a test only
 * came due on a strength session. Opting in led to never being offered the thing
 * you opted into.
 *
 * Nobody can opt in now, so there is one threshold left and it is the lighter
 * one. What still has to hold is that the divert works and is reversible.
 */
check(
  'the store reads one threshold, with no opt-in branch left',
  /if \(completedSessions\.length < NON_KPI_EVIDENCE\) return true;/.test(store) &&
    !/testWeekFrequency === 'never' \? NON_KPI_EVIDENCE/.test(store),
  'a second threshold keyed on a setting nobody can change is a branch that can never be taken'
);

const divertScenarios = [
  ['a brand-new user is offered a KPI lift', [], SESSION_ORDER[0]],
  [
    'one non-KPI session is not enough evidence to divert',
    ['conditioning'],
    SESSION_ORDER[0],
  ],
  [
    NON_KPI_EVIDENCE + ' non-KPI sessions divert them',
    Array(NON_KPI_EVIDENCE).fill('conditioning'),
    'conditioning',
  ],
  [
    'and one KPI lift brings the rotation straight back',
    ['squat', ...Array(RECENT_WINDOW).fill('conditioning')],
    SESSION_ORDER[1],
  ],
];
for (const [label, history, expected] of divertScenarios) {
  const got = suggest(history);
  check(label, got === expected, 'got "' + got + '", expected "' + expected + '"');
}

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
  // The guard may carry other conditions and now does: somebody on a programme
  // is not running the barbell cycle either. What has to hold is that
  // onStrengthProgramme is one of them, not that it is the only one.
  /\{[^}]*onStrengthProgramme && \(\s*\r?\n?\s*<View style=\{styles\.cycleBadge\}>/.test(program),
  'a cycle number means nothing to someone not running cycles'
);
check(
  'the cycle-position dots are hidden too',
  /\{onStrengthProgramme && \(\s*\n?\s*<View style=\{styles\.arcCard\}>/.test(program),
  ''
);
/*
 * THE "UNTIL TEST" TILE IS GONE, and so is the gate that decided who saw it.
 *
 * Three checks here used to pin that gate. The tile counted down to the next
 * strength test, and it read onStrengthProgramme to decide whether to: that is
 * about what somebody TRAINS, whereas whether a test was coming was about what
 * they had AGREED TO, and the two are different people. Somebody who squats,
 * benches and deadlifts with tests switched off was counted down to an event
 * they could never find.
 *
 * Test weeks are retired, the tile shows the week streak for everybody, and the
 * context line takes nothing but a session count.
 */
check(
  'the tile shows the week streak rather than a countdown',
  /<Text style=\{styles\.cycleNumber\}>\{getStreakDays\(\)\}<\/Text>/.test(program) &&
    /<Text style=\{styles\.cycleLabel\}>week streak<\/Text>/.test(program),
  'there is nothing left to count down to'
);
check(
  'the context line takes a session count and nothing else',
  /programContextMessage\(strengthCount\)/.test(program),
  'it used to be handed a test-week frequency and a due flag'
);
check(
  'and nothing on the screen reads a frequency any more',
  !/testWeekFrequency|sessionsUntilTest/.test(program),
  'both were only ever there to feed the countdown'
);
check(
  'the subtitle is no longer unconditionally the three lifts',
  !/^\s*Squat · Bench · Deadlift · \{getEquipmentLabel/m.test(program) &&
    /trainingMix/.test(program),
  'it read "Squat · Bench · Deadlift" to everyone'
);
/**
 * RUN IT, DO NOT LOOK FOR IT.
 *
 * This used to assert that a function called getNonStrengthMessage existed in
 * program.tsx. It did exist, and it had four branches of which TWO WERE
 * UNREACHABLE - isOnStrengthProgramme returns true below its evidence
 * threshold, so nobody with zero or one sessions is ever on that path. The
 * check passed throughout. Existence was never the thing worth guarding.
 *
 * nonStrengthContextMessage now lives in lib/program-copy.ts, is pure, and is
 * executed here across the states a real conditioning-and-mobility user passes
 * through.
 */
const { nonStrengthContextMessage } = await import('../lib/program-copy.ts');
const NON_KPI_STATES = [
  { sessionCount: 3, mix: 'Conditioning · Mobility', weekCount: 0, weeklyGoal: 3, streakWeeks: 0 },
  { sessionCount: 8, mix: 'Conditioning · Mobility', weekCount: 2, weeklyGoal: 3, streakWeeks: 1 },
  { sessionCount: 12, mix: 'Conditioning', weekCount: 3, weeklyGoal: 3, streakWeeks: 4 },
  { sessionCount: 40, mix: 'Mobility · Full Body', weekCount: 1, weeklyGoal: 3, streakWeeks: 5 },
  { sessionCount: 300, mix: 'Conditioning · Mobility', weekCount: 0, weeklyGoal: 2, streakWeeks: 0 },
];
const nonKpiLines = NON_KPI_STATES.map(nonStrengthContextMessage);
check(
  `there is copy that does not mention cycles or tests (${nonKpiLines.length} states)`,
  nonKpiLines.every((l) => !/\b(cycle|block|test|1RM|squat|bench|deadlift)\b/i.test(l)),
  nonKpiLines.filter((l) => /\b(cycle|block|test|1RM|squat|bench|deadlift)\b/i.test(l)).join(' | ')
);
check(
  'and it says something DIFFERENT as their training changes',
  new Set(nonKpiLines).size === nonKpiLines.length,
  `${new Set(nonKpiLines).size} distinct lines from ${nonKpiLines.length} states: ${nonKpiLines.join(' | ')}`
);
check(
  'it names what they actually train, every time',
  nonKpiLines.every((l, i) => l.toLowerCase().includes(NON_KPI_STATES[i].mix.toLowerCase())),
  nonKpiLines.join(' | ')
);
check(
  'a week one session short is told so',
  /One more session this week/.test(
    nonStrengthContextMessage({
      sessionCount: 20,
      mix: 'Conditioning',
      weekCount: 2,
      weeklyGoal: 3,
      streakWeeks: 0,
    })
  ),
  'the most useful thing this screen knows about a non-barbell user is how close their week is'
);
check(
  'and the copy follows house style',
  !nonKpiLines.some((l) => /—|–|―|--/.test(l)),
  nonKpiLines.filter((l) => /—|–|―|--/.test(l)).join(' | ')
);

// ─── 4. Home counts down to nothing at all ───────────────────────────────────
console.log('\n[4] Home does not count down to an event that will not happen');

/*
 * This used to assert that the block-progress row was gated on tests being on,
 * because a row reading "Test week in 3 sessions" is nonsense to somebody who
 * has switched tests off. The whole row is gone: every word of it was about the
 * test-week cycle, and nobody has one. What Home says about a block now comes
 * from the programme tile, which counts the block that is actually running.
 */
check(
  'the block-progress row is gone, not hidden behind a condition',
  !/showBlockProgress|blockProgressLabel|blockBarFill/.test(home),
  'a row that can never render is a row that can come back'
);
check(
  'and Home says nothing about a test week',
  !/\btest\s*week\b/i.test(stripComments(home)) && !/testWeekFrequency/.test(home),
  'the pill above the greeting, the start button and the row all named one'
);

console.log('');
if (failures > 0) {
  console.error(`non-kpi-user: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`non-kpi-user: all ${total} checks passed\n`);
  process.exitCode = 0;
}
