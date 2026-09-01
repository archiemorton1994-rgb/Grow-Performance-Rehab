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

import { readFileSync } from 'fs';
import { generateWorkout } from '../lib/workout-engine.ts';

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
check(
  'it compares against the target that was shown, not the catalogue default',
  /newRepTarget\[log\.exerciseId\] \?\? log\.targetReps,\s*\r?\n?\s*log\.targetReps,/.test(store),
  'passing only the catalogue default would restart the climb every session'
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

check(
  'rep progress is excluded from the deload counter',
  /perfWithFeedback !== 'failed' \|\| repsStillClimbing\.has\(log\.exerciseId\)/.test(store),
  'three good sessions of rep progress would otherwise look like three failures and earn a 10% deload'
);

console.log('\n[5] The earned reps reach the card');

check(
  'the engine accepts them',
  /exerciseRepTarget\?: Record<string, string>/.test(engine),
  ''
);
check(
  'appended last, so the positional call sites do not shift',
  /exerciseStuckStreak\?: Record<string, number>,\s*\r?\n[\s\S]{0,600}?exerciseRepTarget\?: Record<string, string>\s*\r?\n\): Exercise\[\]/.test(
    engine
  ),
  'this signature is called from the session screen and a couple of dozen check scripts'
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
    const profile = {
      name: 'T',
      sex: 'male',
      experienceLevel: 'intermediate',
      goals: ['strength'],
      bodyweightKg: 80,
    };
    const build = (targets) =>
      generateWorkout(
        'squat',
        'fullgym',
        { hasAches: false, energy: 'normal', timeAvailable: '60' },
        profile,
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
    const none = build(undefined);
    const otherId = build({ 'no-such-exercise-id': '99' });
    return (
      none.length > 0 &&
      none.length === otherId.length &&
      none.every((ex, i) => ex.reps === otherId[i].reps)
    );
  })(),
  'every account before its first session, and all timed and rehab work forever'
);
check(
  'the session screen passes them',
  /exerciseStuckStreak,\s*\r?\n\s*exerciseRepTarget\s*\r?\n\s*\);/.test(session),
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
