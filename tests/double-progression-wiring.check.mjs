/**
 * Contract test: double progression is actually connected to a session.
 *
 * The logic lives in lib/rep-scheme.ts and is tested there. This is about the
 * wiring, which is where it nearly went wrong twice.
 *
 * ── THE TWO GATES CANCELLED ────────────────────────────────────────────────
 * Topping out the rep range sets `addLoad`. But the load engine independently
 * refuses any jump larger than 5% until three clean sessions have banked it - a
 * rule written when load was the only lever. Climbing 8 reps to 12 already took
 * four sessions, so the two gates double-counted and the weight NEVER MOVED.
 * Simulated on a 40 kg accessory: twelve sessions, reps cycling 8-12 over and
 * over, 40 kg throughout. Topping out the reps IS the earning, so it banks the
 * jump.
 *
 * ── AND A HELD LOAD LOOKED LIKE A STALL ────────────────────────────────────
 * While reps climb the weight must hold, which is recorded as a 'failed'
 * performance because that is what "hold the load" means to the engine. Left
 * there, three good sessions of rep progress would have been indistinguishable
 * from three failures and earned a 10% deload. Rep progress is excluded from the
 * stall counter.
 */
globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { readFileSync } from 'fs';
import { generateWorkout, DELOAD_AFTER_STALLS } from '../lib/workout-engine.ts';
import { useAppStore } from '../lib/store.ts';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const store = read('lib/store.ts');
const engine = read('lib/workout-engine.ts');
const session = read('app/session.tsx');

console.log('\n[1] The session records what it asked for');

check(
  'the prescribed target is written onto the completed log',
  /targetReps: ex\.reps,/.test(session) && /category: ex\.category,/.test(session),
  '"12 reps logged" only answers "did they hit the target" against the target that was on screen'
);
check(
  'and the log type carries it',
  /targetReps\?: string;/.test(store) && /category\?: ExerciseCategory;/.test(store),
  ''
);

console.log('\n[2] Completion decides where the reps go next');

check(
  'completeSession asks for the next prescription',
  /nextPrescription\(/.test(store),
  ''
);
/**
 * WAS A SPELLING TEST. It pinned the exact expression handed to
 * nextPrescription, so it went red the moment that expression was lifted into a
 * named variable - while the behaviour it guards was untouched. Worse, it would
 * have stayed green if the argument had been swapped for the catalogue default
 * as long as the characters still matched somewhere in the file.
 *
 * The claim is about what the rep target DOES across sessions, so ask that.
 */
const climbTarget = (() => {
  useAppStore.getState().setUserProfile({
    name: 'A',
    sex: 'male',
    experienceLevel: 'intermediate',
    goals: ['muscle'],
    bodyweightKg: 82,
  });
  const clean = (i) => ({
    sessionType: 'lower_body',
    date: new Date(Date.parse('2026-06-01T09:00:00Z') + i * 3 * 86400000).toISOString(),
    equipmentTier: 'fullgym',
    hadAches: false,
    painRegions: [],
    energy: 'good',
    timeAvailable: '45',
    exerciseCount: 1,
    durationSeconds: 2700,
    exerciseLogs: [
      {
        exerciseId: 'wlb-fg-rdl',
        exerciseName: 'Romanian Deadlift',
        targetReps: '8-12',
        category: 'accessory',
        sets: [
          { weight: 60, reps: 12, completed: true, skipped: false },
          { weight: 60, reps: 12, completed: true, skipped: false },
          { weight: 60, reps: 12, completed: true, skipped: false },
        ],
      },
    ],
  });
  const seen = [];
  for (let i = 0; i < 3; i++) {
    useAppStore.getState().completeSession(clean(i));
    seen.push(useAppStore.getState().exerciseRepTarget['wlb-fg-rdl']);
  }
  return seen;
})();

check(
  'the climb carries forward instead of restarting from the catalogue every session',
  // Handing nextPrescription only the catalogue default would produce the same
  // second rung every session, for ever. A climb that carries forward cannot
  // repeat its first value three times.
  climbTarget.length === 3 && new Set(climbTarget).size > 1,
  'rep target after each of three clean sessions: ' + climbTarget.join(' then ')
);
check(
  'every set has to be finished for reps to move',
  /log\.sets\.every\(\(set\) => set\.completed && !set\.skipped\)/.test(store),
  'reps must not climb off the back of a set that was not completed'
);
check(
  'a failed performance blocks it too',
  /hitEverySet && reachedTheFloor && perfWithFeedback !== 'failed'/.test(store),
  ''
);
check(
  'and so does falling short of the rep floor',
  store.includes('const reachedTheFloor = metRepFloor(log.targetReps, log.sets, log.category);'),
  'ticking every box is not the same as doing the reps - without this the floor climbs away from anyone who never reaches it'
);
check(
  'the earned target is persisted',
  /exerciseRepTarget: newRepTarget,/.test(store),
  ''
);

console.log('\n[3] The two levers never fire at once');

check(
  'while reps climb, the load holds',
  /repsStillClimbing\.add\(log\.exerciseId\);\s*\r?\n?\s*newPerformance\[log\.exerciseId\] = 'failed';/.test(
    store
  ),
  'a plate on top of an extra rep is two jumps in one session'
);
check(
  'a topped-out range banks the load jump',
  /newStreak\[log\.exerciseId\] = CLEAN_SESSIONS_PER_BIG_JUMP;/.test(store),
  'without this the rep gate and the load gate cancel and the weight never moves at all'
);
check(
  'and that banked value is not overwritten by the streak block below it',
  /if \(earnedTheJump\.has\(log\.exerciseId\)\) \{/.test(store),
  ''
);

console.log('\n[4] Holding for reps is not a stall');

/**
 * THIS ASSERTION IS THE REASON THE STALL WAS BROKEN FOR SO LONG.
 *
 * It was a regex over the source, and it stayed green while the thing it
 * guards did the opposite of what it says. The exclusion it pinned was being
 * applied to EVERY held load, not only to a held load with climbing reps,
 * because a failed session comes back from nextPrescription as "same again"
 * and that was read as rep progress. Six consecutive failed sessions left the
 * stall counter at zero, so the 10% drop never fired for anybody, ever.
 *
 * The claim has two halves and a source regex can see neither. Both are now
 * measured by running the store.
 */
const stallAfter = (finishEverySet) => {
  useAppStore.getState().resetProgress?.();
  useAppStore.getState().setUserProfile({
    name: 'A',
    sex: 'male',
    experienceLevel: 'intermediate',
    goals: ['muscle'],
    bodyweightKg: 82,
  });
  const session = (i) => ({
    sessionType: 'lower_body',
    date: new Date(Date.parse('2027-01-01T09:00:00Z') + i * 3 * 86400000).toISOString(),
    equipmentTier: 'fullgym',
    hadAches: false,
    painRegions: [],
    energy: 'good',
    timeAvailable: '45',
    exerciseCount: 1,
    durationSeconds: 2700,
    exerciseLogs: [
      {
        exerciseId: 'stall-probe',
        exerciseName: 'Romanian Deadlift',
        targetReps: '8-12',
        category: 'accessory',
        sets: [
          { weight: 60, reps: 12, completed: true, skipped: false },
          { weight: 60, reps: 12, completed: true, skipped: false },
          // The whole difference between the two runs is this last set.
          finishEverySet
            ? { weight: 60, reps: 12, completed: true, skipped: false }
            : { weight: 60, reps: 4, completed: false, skipped: false },
        ],
      },
    ],
  });
  for (let i = 0; i < 3; i++) useAppStore.getState().completeSession(session(i));
  return useAppStore.getState().exerciseStuckStreak['stall-probe'] ?? 0;
};

const stalledRun = stallAfter(false);
const climbingRun = stallAfter(true);

check(
  'three genuinely failed sessions reach the count that triggers the 10% drop',
  stalledRun >= DELOAD_AFTER_STALLS,
  'stall counter after three failed sessions: ' + stalledRun + ', needs ' + DELOAD_AFTER_STALLS
);
check(
  'while a load held because the REPS are climbing never counts as a stall',
  climbingRun === 0,
  'stall counter after three clean climbing sessions: ' + climbingRun
);

console.log('\n[5] The earned reps reach the card');

const WIRING_PROFILE = {
  name: 'T',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['strength'],
  bodyweightKg: 80,
};
/** A real session, with the earned targets handed over BY POSITION, as every caller does. */
const buildSession = (targets) =>
  generateWorkout(
    'squat',
    'fullgym',
    { hasAches: false, energy: 'normal', timeAvailable: '60' },
    WIRING_PROFILE,
    undefined,
    undefined,
    10,
    {},
    undefined,
    undefined,
    0,
    'kg',
    undefined,
    targets
  );

check(
  'the engine accepts them',
  /exerciseRepTarget\?: Record<string, string>/.test(engine),
  ''
);
check(
  /**
   * WAS "APPENDED LAST", WHICH HAS SINCE STOPPED BEING TRUE AND NEVER WAS THE RULE.
   *
   * The assertion was that `exerciseRepTarget` is the final parameter of
   * generateWorkout, anchored on the closing `): Exercise[]`. A later parameter
   * was then appended after it - correctly, and for the same reason this one was
   * appended - and the pin went red while the wiring it guards was never in any
   * danger. That is the defect this repo keeps making: a test that pins where
   * the code is written rather than what it does.
   *
   * The rule is that the targets arrive WHERE THE CALLERS PUT THEM. The session
   * screen and a couple of dozen check scripts all pass them by position, so a
   * parameter that moves silently rebinds every one of them to something else.
   * Pass them by position, and see whether they come out on the card.
   */
  'the earned targets are read from the position every caller passes them in',
  (() => {
    const base = buildSession(undefined);
    const anchor = base.find((ex) => ex.id && typeof ex.reps === 'string');
    if (!anchor) return false;
    const moved = buildSession({ [anchor.id]: '99' });
    return moved.find((ex) => ex.id === anchor.id)?.reps === '99';
  })(),
  'handed over 14th and read as some other parameter, so every positional caller is quietly filling the wrong slot'
);
check(
  'they are applied to the final list, after swaps',
  /withSwaps\.map\(\(ex\) =>[\s\S]{0,160}?exerciseRepTarget\[ex\.id\]/.test(engine),
  'a swapped-in substitute must keep its own prescription, not inherit the replaced movement\'s reps'
);
check(
  /**
   * WAS PINNED TO A SPELLING, AND WENT RED OVER A RENAME.
   *
   * The assertion was the literal line `if (!exerciseRepTarget) return
   * withSwaps;`. That early return had to become a named variable so a second
   * post-pass could run after it, and this failed over the shape of the code
   * while the promise it guards was never in any danger.
   *
   * The promise is that somebody who has earned nothing gets the reps the
   * catalogue prescribes. Ask the engine.
   */
  'an exercise with no earned target is untouched',
  (() => {
    const none = buildSession(undefined);
    const otherId = buildSession({ 'no-such-exercise-id': '99' });
    return (
      none.length > 0 &&
      none.length === otherId.length &&
      none.every((ex, i) => ex.reps === otherId[i].reps)
    );
  })(),
  'every account before its first session, and all timed and rehab work forever'
);
/**
 * THE CALL ITSELF, not the whole screen.
 *
 * The assertion below used to be anchored on `exerciseRepTarget` being the
 * closing argument, which stopped being true when a later argument was appended
 * after it. Relaxing that anchor on its own was not safe: the same two names sit
 * next to each other again in the hook's dependency array a few lines below, so
 * a relaxed pattern matched THAT and passed happily with the argument removed
 * from the call. Cut the call out first, and the pattern has only one place to
 * look.
 */
const callStart = session.indexOf('generateWorkout(');
const callEnd = session.indexOf('  }, [', callStart);
const callText = callStart >= 0 && callEnd > callStart ? session.slice(callStart, callEnd) : '';
check(
  'the generator call can be told apart from the hook that wraps it',
  callText.includes('generateWorkout(') && !callText.includes('}, ['),
  'the screen has been restructured and the rule below has gone blind'
);
check(
  'the session screen passes them',
  /exerciseStuckStreak,\s*\r?\n\s*exerciseRepTarget\s*[,)]/.test(callText),
  'computing the target and never reading it back is the same bug with extra steps'
);

console.log('\n[6] Reset Progress clears it');

check(
  'the earned reps go with the rest of the progression',
  /exerciseRepTarget: \{\},/.test(store),
  'they decide future prescriptions, so leaving them behind is the same defect as leaving the weights'
);

console.log(`\ndouble-progression-wiring: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
