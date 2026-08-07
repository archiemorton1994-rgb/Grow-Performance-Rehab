/**
 * Contract test: the training-balance nudge.
 *
 * WHY THIS MATTERS
 * ────────────────
 * This is the first thing in the app that comments on WHAT somebody trains
 * rather than whether they trained at all, and that makes it the easiest
 * feature in the app to get wrong in a way that matters. The whole inclusivity
 * thread was about not imposing a training style on people. A nudge that tells
 * a conditioning-and-mobility user they are neglecting their legs is precisely
 * the behaviour that work was undoing.
 *
 * So most of what is asserted here is about staying QUIET. The nudge firing is
 * one check; the seven cases where it must not fire are the rest.
 *
 * Run:  node tests/training-balance.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import {
  getTrainingBalanceNudge,
  BALANCE_WINDOW,
  MIN_SESSIONS,
  MIN_DOMINANT,
  DISMISS_DAYS,
} from '../lib/training-balance.ts';

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

const NOW = 1_700_000_000_000;
const rep = (type, n) => Array(n).fill(type);
const nudge = (sessionTypes, everTrained = null, dismissedAt = null) =>
  getTrainingBalanceNudge({
    sessionTypes,
    everTrained: everTrained ?? sessionTypes,
    dismissedAt,
    now: NOW,
  });

// ─── 1. It fires when it should ──────────────────────────────────────────────
console.log('\n[1] A real gap gets mentioned');

// Recent window is newest-first, so the five upper sessions are the recent ones
// and the two lower ones fall outside it only if the window is short. Make the
// gap explicit: recent is all upper, history contains lower.
const recentUpperOnly = rep('upper_body', 6);
const hasDoneLegs = [...recentUpperOnly, ...rep('lower_body', 3)];
const n1 = nudge(recentUpperOnly, hasDoneLegs);
check('six upper body sessions and no legs is flagged', n1 !== null, '');
check('it names the missing area', n1?.area === 'lower', `got ${n1?.area}`);
check(
  'it offers a session for that area',
  n1?.suggestion === 'lower_body',
  `got ${n1?.suggestion}`
);
check(
  'the message states what it saw rather than issuing an instruction',
  n1 != null && /You've trained/.test(n1.message) && !/should|need to|must/i.test(n1.message),
  n1?.message
);

const recentLowerOnly = rep('lower_body', 6);
const n2 = nudge(recentLowerOnly, [...recentLowerOnly, ...rep('upper_body', 2)]);
check('and it works the other way round', n2?.area === 'upper', `got ${n2?.area}`);

// ─── 2. THE IMPORTANT HALF: when it must stay quiet ──────────────────────────
console.log('\n[2] It stays quiet whenever the gap might be deliberate');

check(
  'a conditioning-only user is never told they neglect their legs',
  nudge(rep('conditioning', 10)) === null,
  'they have never chosen lower body — introducing it is exactly what the inclusivity work removed'
);
check(
  'nor a rehab-and-mobility user',
  nudge([...rep('prehab', 5), ...rep('flexibility', 5)]) === null,
  ''
);
check(
  'nor a custom-session-only user',
  nudge(rep('custom', 10)) === null,
  'the app cannot see inside a custom session, and guessing is worse than silence'
);
check(
  'someone who trains only full body is not told they neglect anything',
  nudge(rep('full_body', 10)) === null,
  'full body counts for both halves — otherwise it would flag both of them'
);
check(
  `under ${MIN_SESSIONS} sessions there is no opinion at all`,
  nudge(rep('upper_body', MIN_SESSIONS - 1), [
    ...rep('upper_body', MIN_SESSIONS - 1),
    ...rep('lower_body', 3),
  ]) === null,
  'a fortnight of upper body is not a habit'
);
check(
  `a lead of under ${MIN_DOMINANT} is a preference, not a gap`,
  nudge(
    [...rep('upper_body', MIN_DOMINANT - 1), ...rep('conditioning', 3)],
    [...rep('upper_body', MIN_DOMINANT - 1), ...rep('conditioning', 3), ...rep('lower_body', 2)]
  ) === null,
  ''
);
check(
  'someone who trains both halves is left alone',
  nudge([...rep('upper_body', 4), ...rep('lower_body', 4)]) === null,
  ''
);

// ─── 3. Dismissal is an answer, not a snooze ─────────────────────────────────
console.log('\n[3] Dismissing it means something');

const dismissible = rep('upper_body', 6);
const history = [...dismissible, ...rep('lower_body', 3)];
check(
  'dismissed yesterday: silent',
  nudge(dismissible, history, NOW - 24 * 60 * 60 * 1000) === null,
  ''
);
check(
  `dismissed ${DISMISS_DAYS - 1} days ago: still silent`,
  nudge(dismissible, history, NOW - (DISMISS_DAYS - 1) * 24 * 60 * 60 * 1000) === null,
  'a nudge you dismissed that returns the next day is not a dismissal'
);
check(
  `dismissed ${DISMISS_DAYS + 1} days ago: may speak again`,
  nudge(dismissible, history, NOW - (DISMISS_DAYS + 1) * 24 * 60 * 60 * 1000) !== null,
  ''
);

// ─── 4. Recovery ─────────────────────────────────────────────────────────────
console.log('\n[4] Recovery is judged on its own terms');

const noRecovery = [...rep('upper_body', 4), ...rep('lower_body', 4)];
const usedToStretch = [...noRecovery, ...rep('flexibility', 2)];
const n3 = nudge(noRecovery, usedToStretch);
check(
  'a balanced lifter who has stopped stretching hears about it',
  n3?.area === 'recovery',
  `got ${n3?.area ?? 'null'}`
);
check(
  'but only if they ever did any',
  nudge(noRecovery, noRecovery) === null,
  'suggesting mobility to someone who has never done it is introducing a training style'
);
check(
  'a strength gap outranks a recovery gap',
  nudge(rep('upper_body', 6), [...rep('upper_body', 6), ...rep('lower_body', 2), 'flexibility'])
    ?.area === 'lower',
  'only one nudge shows at a time, so the bigger one has to win'
);

// ─── 5. The window is a window ───────────────────────────────────────────────
console.log('\n[5] It reflects recent training, not all of it');

const reformed = [...rep('lower_body', 6), ...rep('upper_body', 20)];
check(
  `only the last ${BALANCE_WINDOW} sessions count`,
  nudge(reformed, reformed)?.area === 'upper' || nudge(reformed, reformed) === null,
  'someone who has fixed the gap should stop hearing about it, however long the old streak was'
);
const stillLopsided = rep('upper_body', 30);
check(
  'a long-running gap is still caught',
  nudge(stillLopsided, [...stillLopsided, 'lower_body']) !== null,
  ''
);

console.log('');
if (failures > 0) {
  console.error(`training-balance: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`training-balance: all ${total} checks passed\n`);
  process.exit(0);
}
