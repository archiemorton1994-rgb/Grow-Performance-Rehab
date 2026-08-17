/**
 * Contract test: the home block-progress row tells the truth about a held test.
 *
 * WHAT WAS WRONG
 * ──────────────
 * A due strength test is withheld until someone has re-established a baseline
 * after a layoff — nobody walks out of a month off into a max-effort attempt.
 * The row under the session card knew nothing about that. It kept counting the
 * block that had already ended, so it read "Test week in 0 sessions" with no
 * test on offer, and then, once a session was logged, "Block 1 / 12" as though
 * a fresh block had begun. Neither is false arithmetic; both read as a stuck
 * counter, because the one fact that explains them is missing.
 *
 * The readiness screen already says this properly, out of lib/coach.ts: "Your
 * strength test is on hold until you have N sessions back in." Two surfaces
 * describing the same state must not describe it differently, so the row says
 * the same thing in the space it has.
 *
 * Two halves:
 *   STATE   — the store really does report a held test, and the number of
 *             sessions still owed really does count down as they are logged
 *   WIRING  — the row branches on that state instead of on block arithmetic
 *
 * Run:  npx tsx tests/block-progress-hold.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

// Drives the real persisted store; see the shim for why that needs a home.
import './_persist-shim.mjs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { COMEBACK_SESSIONS } from '../lib/workout-engine.ts';
import { useAppStore } from '../lib/store.ts';

const __dir = dirname(fileURLToPath(import.meta.url));

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

const CYCLE = 12;

/** A store holding `n` strength sessions, the newest `gapDays` ago. */
function seed(n, gapDays) {
  useAppStore.setState({
    completedSessions: Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      sessionType: ['squat', 'bench', 'deadlift'][i % 3],
      date: new Date(Date.now() - (gapDays + i * 3) * 86400000).toISOString(),
      equipmentTier: 'fullgym',
      hadAches: false,
      energy: 'normal',
      timeAvailable: '60',
      exerciseCount: 6,
      exerciseLogs: [],
    })),
    completedCount: n,
    testWeekFrequency: CYCLE,
    testWeekDeferred: false,
  });
}

function train() {
  useAppStore.getState().completeSession({
    sessionType: 'squat',
    date: new Date().toISOString(),
    equipmentTier: 'fullgym',
    hadAches: false,
    energy: 'normal',
    timeAvailable: '60',
    exerciseCount: 6,
    exerciseLogs: [],
  });
}

/** Exactly what the row computes: held, and how many sessions are still owed. */
function rowState() {
  const s = useAppStore.getState();
  const held = s.getTestWeekProgress().held;
  return {
    held,
    owed: held ? Math.max(0, COMEBACK_SESSIONS - (s.getReturnWindow()?.sessionsBack ?? 0)) : 0,
  };
}

// ─── 1. The state the row has to describe ────────────────────────────────────
console.log('\n[1] A full block, then a month off, then the test waits');

seed(CYCLE, 30);
const onReturn = rowState();
check(
  'the test is held rather than offered',
  onReturn.held === true,
  'without a hold there is nothing for the row to say'
);
check(
  `and ${COMEBACK_SESSIONS} sessions are owed before it comes back`,
  onReturn.owed === COMEBACK_SESSIONS,
  `owed=${onReturn.owed}`
);

train();
const afterOne = rowState();
check(
  'still held after one session back',
  afterOne.held === true,
  'one session short of the baseline the test needs'
);
check(
  'and the count owed has come down by one',
  afterOne.owed === COMEBACK_SESSIONS - 1,
  `owed=${afterOne.owed} — a number that does not move is the stuck counter again`
);

train();
check(
  'the hold lifts once the baseline is back',
  rowState().held === false,
  'held means postponed, not cancelled'
);

// A block in progress is untouched by any of this.
seed(5, 1);
const midBlock = rowState();
check(
  'an ordinary mid-block user is not held',
  midBlock.held === false && midBlock.owed === 0,
  `held=${midBlock.held} owed=${midBlock.owed}`
);

// ─── 2. The row is wired to it ───────────────────────────────────────────────
console.log('\n[2] The home row branches on the hold, not on the arithmetic');

const homeSrc = readFileSync(join(__dir, '../app/(tabs)/index.tsx'), 'utf8');

check(
  'the screen reads the hold off the store',
  /testHeld = testWeekProgress\.held/.test(homeSrc),
  'getTestWeekProgress().held is the only place this state exists'
);
check(
  'and counts the sessions owed from the same constant the coach uses',
  /COMEBACK_SESSIONS -/.test(homeSrc) && /getReturnWindow\(\)/.test(homeSrc),
  'a second copy of the threshold is a second chance to disagree with lib/coach.ts'
);

const label = homeSrc.match(/\{testHeld[\s\S]{0,480}?\}\s*<\/Text>/)?.[0] ?? '';
check(
  'the held branch comes before the countdown',
  /^\{testHeld\s*\?/.test(label.trim()),
  'held is the more specific state; checked second, the countdown wins and lies'
);
check(
  'it says the test is on hold, in the coach’s words',
  /on hold/.test(label),
  'the readiness screen already says "on hold"; two wordings for one state is worse than none'
);
check(
  'and names how many sessions are still to go',
  /sessionsUntilTestResumes/.test(label),
  '"on hold" with no end in sight is the same dead end as a stuck number'
);
check(
  'the countdown is not styled as urgent while the test is held',
  /!testHeld && sessionsUntilTest <= 2/.test(homeSrc),
  'nothing is imminent when nothing is on offer'
);

console.log('');
if (failures > 0) {
  console.error(`block-progress-hold: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`block-progress-hold: all ${total} checks passed\n`);
  process.exitCode = 0;
}
