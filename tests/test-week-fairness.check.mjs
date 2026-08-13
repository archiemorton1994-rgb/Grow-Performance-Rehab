/**
 * The strength test has to be a test, not a tax on your goal.
 *
 * The test set used to be 90% of the user's WORKING weight. Working weight is
 * already scaled down by goal (strength 85% of max, rehab 50%), so 90% of it
 * only landed near a true max for the strength and power goals. Everyone else
 * was tested well under their real strength, Epley read that back as a small
 * max, and the app cut their weights. The reps needed merely to stand still
 * ran 9 / 7 / 14 / 18 / 21 / 36 — and the app's own code notes that Epley
 * "loses accuracy fast beyond ~10 reps", so four of the six goals were being
 * judged in the part of the formula that does not work.
 *
 * What this file asserts is the user-visible consequence, not the table the
 * bug lived in: run the whole pipeline a real session runs, count the reps it
 * takes before the app stops cutting you, and require that number to be the
 * same whatever you picked as your goal. Section 3 feeds the OLD rule through
 * the identical routine and requires it to FAIL, so a routine that had stopped
 * measuring anything could not pass this file quietly.
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import {
  generate1RMWorkout,
  goalLoadFraction,
  workingWeightFromOrm,
  testLoadFromWorkingWeight,
  estimateOrmFromAmrap,
  workingWeightAfterTest,
  skipsMaxTest,
  TEST_LOAD_FRACTION_OF_ORM,
  TEST_EXPECTED_REPS,
  MAX_TEST_WEIGHT_MOVE,
  TEST_DEADBAND_REPS,
} from '../lib/workout-engine.ts';
import { roundToLoadable } from '../lib/utils.ts';

let failures = 0;
let total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`);
  }
}

const GOALS = ['strength', 'power', 'muscle', 'fitness', 'fat_loss', 'rehab'];

function profileFor(goal) {
  return {
    name: 'Test',
    sex: 'male',
    experienceLevel: 'intermediate',
    goals: [goal],
    bodyweightKg: 80,
  };
}

/**
 * One test week, start to finish, exactly as a session runs it: prescribe the
 * load, take the reps the user managed, estimate the max, turn that back into
 * a working weight, and apply the limit on what one session may change.
 */
function oneTestCycle(workingKg, profile, reps, unit) {
  const testKg = testLoadFromWorkingWeight(workingKg, profile, unit);
  const estimatedMax = Math.round(estimateOrmFromAmrap(testKg, reps));
  return {
    testKg,
    estimatedMax,
    next: workingWeightAfterTest(workingKg, estimatedMax, profile, unit),
  };
}

/**
 * The same cycle as the app shipped it before this change: test at 90% of the
 * working weight, and write whatever came out straight into the programming.
 * Kept so the "before" column is genuinely the old behaviour and not the new
 * one wearing an old test load.
 */
function oldTestCycle(workingKg, profile, reps, unit) {
  const testKg = roundToLoadable(workingKg * 0.9, unit);
  const estimatedMax = Math.round(estimateOrmFromAmrap(testKg, reps));
  return { testKg, estimatedMax, next: workingWeightFromOrm(estimatedMax, profile, unit) };
}

/** Fewest clean reps at which the app stops taking weight off you. */
function breakEvenReps(workingKg, profile, unit, cycle = oneTestCycle) {
  for (let reps = 1; reps <= 60; reps++) {
    if (cycle(workingKg, profile, reps, unit).next >= workingKg) return reps;
  }
  return Infinity;
}

/** Fewest clean reps that actually earn more weight for the next block. */
function raiseReps(workingKg, profile, unit) {
  for (let reps = 1; reps <= 60; reps++) {
    if (oneTestCycle(workingKg, profile, reps, unit).next > workingKg) return reps;
  }
  return Infinity;
}

// ─── 1. The break-even table, before and after ───────────────────────────────
console.log('\n[1] Reps needed just to keep the weight you already train at');
{
  const TRUE_MAX = 100;
  const rows = [];
  for (const goal of GOALS) {
    const profile = profileFor(goal);
    const workingKg = workingWeightFromOrm(TRUE_MAX, profile, 'kg');
    rows.push({
      goal,
      workingKg,
      before: breakEvenReps(workingKg, profile, 'kg', oldTestCycle),
      after: breakEvenReps(workingKg, profile, 'kg'),
      raise: raiseReps(workingKg, profile, 'kg'),
      beforeLoad: oldTestCycle(workingKg, profile, 1, 'kg').testKg,
      afterLoad: testLoadFromWorkingWeight(workingKg, profile, 'kg'),
    });
  }
  console.log(
    '       goal        working   test load (was → now)   hold from (was → now)   raise from'
  );
  for (const r of rows) {
    console.log(
      `       ${r.goal.padEnd(10)}  ${String(r.workingKg).padStart(5)} kg` +
        `   ${String(r.beforeLoad).padStart(5)} → ${String(r.afterLoad).padStart(5)} kg` +
        `        ${String(r.before).padStart(2)} → ${String(r.after).padStart(2)} reps` +
        `        ${String(r.raise).padStart(2)} reps`
    );
  }

  // Non-vacuity: the six goals must really be six different situations, or
  // "the answer is the same for all of them" would mean nothing.
  const distinctWorking = new Set(rows.map((r) => r.workingKg));
  check(
    `the six goals are genuinely six different working weights (${[...distinctWorking].join(', ')})`,
    distinctWorking.size === GOALS.length,
    `${distinctWorking.size} distinct values across ${GOALS.length} goals`
  );

  const afters = new Set(rows.map((r) => r.after));
  check(
    `break-even is the same rep count for every goal (${[...afters].join(', ')})`,
    afters.size === 1,
    rows.map((r) => `${r.goal}=${r.after}`).join(' ')
  );

  const beApp = [...afters][0];
  check(
    `and it lands where Epley is still trustworthy (${beApp} reps, needs <= 10)`,
    beApp <= 10,
    `break-even ${beApp}`
  );
  check(
    `nobody has to grind out a set nobody would program (${beApp} reps, needs >= 3)`,
    beApp >= 3,
    `break-even ${beApp}`
  );

  // Every goal ends up tested at the same absolute weight, because they all
  // imply the same one-rep max. That is what "measure strength, not a goal"
  // actually means on the bar.
  const loads = new Set(rows.map((r) => r.afterLoad));
  check(
    `two people with the same real max are tested at the same weight (${[...loads].join(', ')} kg)`,
    loads.size === 1,
    rows.map((r) => `${r.goal}=${r.afterLoad}`).join(' ')
  );

  // The band works at both ends or it is not a band: the reps that earn more
  // weight must be goal-independent too, and must sit above the hold point.
  const raises = new Set(rows.map((r) => r.raise));
  check(
    `the reps that earn a raise are the same for every goal too (${[...raises].join(', ')})`,
    raises.size === 1,
    rows.map((r) => `${r.goal}=${r.raise}`).join(' ')
  );
  const raiseAt = [...raises][0];
  check(
    `there is a real hold band, not a single knife edge (${beApp}-${raiseAt - 1} reps change nothing)`,
    raiseAt > beApp,
    `hold from ${beApp}, raise from ${raiseAt}`
  );
  check(
    `and the band is the width the tolerance says it is (${raiseAt - beApp} reps wide, ` +
      `TEST_DEADBAND_REPS ${TEST_DEADBAND_REPS} either side)`,
    Math.abs(raiseAt - beApp - 2 * TEST_DEADBAND_REPS) <= 1,
    `${raiseAt - beApp} vs ${2 * TEST_DEADBAND_REPS}`
  );
}

// ─── 2. Perform the same twice, keep the same weight ─────────────────────────
console.log('\n[2] A user who does not change is left alone');
{
  for (const unit of ['kg', 'lbs']) {
    const drifted = [];
    for (const goal of GOALS) {
      const profile = profileFor(goal);
      const TRUE_MAX = unit === 'kg' ? 100 : 102.06; // 225 lbs
      let workingKg = workingWeightFromOrm(TRUE_MAX, profile, unit);
      const start = workingKg;
      for (let cycle = 0; cycle < 5; cycle++) {
        const testKg = testLoadFromWorkingWeight(workingKg, profile, unit);
        // Unchanged strength: the reps a lifter with this exact max gets at
        // this exact load, per the same formula the app judges them with.
        const reps = Math.round(30 * (TRUE_MAX / testKg - 1));
        workingKg = oneTestCycle(workingKg, profile, reps, unit).next;
      }
      if (workingKg !== start) drifted.push(`${goal}: ${start} → ${workingKg}`);
    }
    check(
      `five identical tests in a row move nobody's weight (${unit})`,
      drifted.length === 0,
      drifted.join(' | ')
    );
  }

  // Same claim stated the way the session copy states it.
  const fixedPoint = [];
  for (const goal of GOALS) {
    const profile = profileFor(goal);
    const workingKg = workingWeightFromOrm(100, profile, 'kg');
    if (oneTestCycle(workingKg, profile, TEST_EXPECTED_REPS, 'kg').next !== workingKg) {
      fixedPoint.push(goal);
    }
  }
  check(
    `the ${TEST_EXPECTED_REPS} reps the session promises really do change nothing, for every goal`,
    fixedPoint.length === 0,
    fixedPoint.join(', ')
  );
}

// ─── 3. Does this file actually detect the bug it was written for? ───────────
console.log('\n[3] The measurement has teeth');
{
  const befores = GOALS.map((goal) => {
    const profile = profileFor(goal);
    return breakEvenReps(workingWeightFromOrm(100, profile, 'kg'), profile, 'kg', oldTestCycle);
  });
  check(
    `the old 90%-of-working rule is caught as goal-dependent (${befores.join(', ')})`,
    new Set(befores).size > 1,
    befores.join(', ')
  );
  check(
    'and caught as unreachable for someone rehabbing (>30 reps)',
    Math.max(...befores) > 30,
    `worst goal needed ${Math.max(...befores)} reps`
  );
  check(
    'so the spread this file measures is real, not rounding noise',
    Math.max(...befores) - Math.min(...befores) >= 20,
    `spread ${Math.max(...befores) - Math.min(...befores)}`
  );

  // A test load that ignored the goal entirely would also be goal-independent
  // but wrong: it must sit at the stated share of the max the app believes in.
  const misplaced = [];
  for (const goal of GOALS) {
    const profile = profileFor(goal);
    const workingKg = workingWeightFromOrm(100, profile, 'kg');
    const impliedMax = workingKg / goalLoadFraction(profile);
    const testKg = testLoadFromWorkingWeight(workingKg, profile, 'kg');
    if (Math.abs(testKg / impliedMax - TEST_LOAD_FRACTION_OF_ORM) > 0.03) {
      misplaced.push(`${goal}: ${(testKg / impliedMax).toFixed(3)}`);
    }
  }
  check(
    `the bar is set at ${TEST_LOAD_FRACTION_OF_ORM * 100}% of the max the app believes in, for every goal`,
    misplaced.length === 0,
    misplaced.join(' | ')
  );
}

// ─── 4. One bad day is not a verdict ─────────────────────────────────────────
console.log('\n[4] What a single test is allowed to do to a block');
{
  for (const unit of ['kg', 'lbs']) {
    const overCut = [];
    const overRaise = [];
    for (const goal of GOALS) {
      const profile = profileFor(goal);
      const workingKg = workingWeightFromOrm(100, profile, unit);
      const floor = roundToLoadable(workingKg * (1 - MAX_TEST_WEIGHT_MOVE), unit);
      const ceil = roundToLoadable(workingKg * (1 + MAX_TEST_WEIGHT_MOVE), unit);
      // Catastrophic day: one rep, then failed at the top set entirely.
      for (const reps of [1, 2, 3]) {
        const { next } = oneTestCycle(workingKg, profile, reps, unit);
        if (next < floor) overCut.push(`${goal} @${reps}: ${workingKg} → ${next} (floor ${floor})`);
      }
      // Fluke day, deep in the range where Epley over-reads.
      for (const reps of [20, 30, 45]) {
        const { next } = oneTestCycle(workingKg, profile, reps, unit);
        if (next > ceil) overRaise.push(`${goal} @${reps}: ${workingKg} → ${next} (ceil ${ceil})`);
      }
    }
    check(`a disastrous test cannot cut more than 10% (${unit})`, overCut.length === 0, overCut.join(' | '));
    check(`a fluke test cannot add more than 10% (${unit})`, overRaise.length === 0, overRaise.join(' | '));
  }

  // Teeth: the cap must actually be binding at those rep counts, otherwise the
  // two checks above would pass on a build with no cap at all.
  const profile = profileFor('strength');
  const workingKg = workingWeightFromOrm(100, profile, 'kg');
  const uncappedLow = workingWeightFromOrm(
    Math.round(estimateOrmFromAmrap(testLoadFromWorkingWeight(workingKg, profile, 'kg'), 1)),
    profile,
    'kg'
  );
  check(
    `without the cap a 1-rep test would have cut ${workingKg} kg to ${uncappedLow} kg`,
    uncappedLow < roundToLoadable(workingKg * (1 - MAX_TEST_WEIGHT_MOVE), 'kg'),
    `${uncappedLow} vs floor ${roundToLoadable(workingKg * (1 - MAX_TEST_WEIGHT_MOVE), 'kg')}`
  );

  // The reported symptom, stated as the user met it: a 144 kg personal best on
  // the profile screen and a 65 kg prescription in the session, at the same
  // time, with nothing on screen reconciling them.
  const BEST_ORM = 144;
  const strength = profileFor('strength');
  const wasWorking = workingWeightFromOrm(BEST_ORM, strength, 'kg');
  const BAD_DAY_ORM = 76;
  const oldOutcome = workingWeightFromOrm(BAD_DAY_ORM, strength, 'kg');
  const newOutcome = workingWeightAfterTest(wasWorking, BAD_DAY_ORM, strength, 'kg');
  check(
    `one bad day on a ${wasWorking} kg working weight now lands at ${newOutcome} kg, not ${oldOutcome} kg`,
    newOutcome > oldOutcome && newOutcome < wasWorking,
    `old ${oldOutcome}, new ${newOutcome}, was ${wasWorking}`
  );
  const stepsToRecover = (weight) => Math.ceil((wasWorking - weight) / 2.5);
  check(
    `recovering from it takes ${stepsToRecover(newOutcome)} sessions at +2.5 kg, not ${stepsToRecover(oldOutcome)}`,
    stepsToRecover(newOutcome) <= 5 && stepsToRecover(oldOutcome) > 20,
    `${stepsToRecover(newOutcome)} vs ${stepsToRecover(oldOutcome)}`
  );
}

// ─── 5. Nobody is asked to max out on a rehab goal ───────────────────────────
console.log('\n[5] Rehab');
{
  check('a rehab goal skips the max-effort set', skipsMaxTest(profileFor('rehab')) === true);
  const testing = GOALS.filter((g) => g !== 'rehab').filter((g) => skipsMaxTest(profileFor(g)));
  check('every other goal still tests', testing.length === 0, testing.join(', '));
  check(
    'and rehab alongside another goal still skips it',
    skipsMaxTest({ ...profileFor('strength'), goals: ['strength', 'rehab'] }) === true
  );

  // Why: a fair test is a heavy test, and for a rehab working weight that is a
  // large multiple of what they train at. Assert the size of the ask so this
  // stays a documented consequence rather than an opinion.
  const p = profileFor('rehab');
  const workingKg = workingWeightFromOrm(100, p, 'kg');
  const testKg = testLoadFromWorkingWeight(workingKg, p, 'kg');
  check(
    `a fair test would have asked a rehab user for ${(testKg / workingKg).toFixed(2)}x their working weight`,
    testKg / workingKg > 1.4,
    `${workingKg} kg working → ${testKg} kg test`
  );
}

// ─── 6. The number on the card, and the sentence beside it ───────────────────
console.log('\n[6] What the session actually shows');
{
  const profile = profileFor('rehab');
  const workingKg = workingWeightFromOrm(100, profile, 'kg');
  const testKg = testLoadFromWorkingWeight(workingKg, profile, 'kg');
  const session = generate1RMWorkout('squat', 'fullgym', 4, testKg, 'kg');
  const main = session.find((e) => e.category === 'main');
  check('the test set is prescribed at the computed load', main?.loadKg?.[0] === testKg, `${main?.loadKg?.[0]} vs ${testKg}`);
  check(
    `the cue names the same ${TEST_EXPECTED_REPS} reps the maths breaks even at`,
    new RegExp(`\\b${TEST_EXPECTED_REPS}\\b`).test(main?.cue ?? ''),
    main?.cue?.slice(0, 120)
  );
  const ramp = session.find((e) => e.category === 'prep');
  check(
    'the warm-up ladder tops out below the test set',
    (ramp?.loadKg ?? []).every((kg) => kg <= testKg) && (ramp?.loadKg ?? []).length > 0,
    `${(ramp?.loadKg ?? []).join('/')} vs ${testKg}`
  );

  // The app has to be wired to the functions checked above, not merely own
  // them. This file would otherwise be testing a library nothing calls.
  const src = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');
  check(
    'the session prescribes the test with testLoadFromWorkingWeight',
    /testLoadFromWorkingWeight\(/.test(src) && !/workingKg \* 0\.9/.test(src)
  );
  check(
    'the session puts the result through workingWeightAfterTest',
    /testWeekWorkingWeight = workingWeightAfterTest\(/.test(src)
  );
  check('the session asks skipsMaxTest before running the all-out set', /skipsMaxTest\(userProfile\)/.test(src));
  // Rendered, not merely declared - a component that exists and is never used
  // is exactly the silent removal this was meant to prevent.
  check(
    'and a skipped test says so on screen rather than silently vanishing',
    /<NoMaxTestBanner\s+visible=\{isTestWeek && !runsMaxTest\}/.test(src)
  );
  check(
    'the max-effort set is not run for someone who skips it',
    /if \(runsMaxTest\) \{/.test(src) && !/if \(isTestWeek\) \{\s*\r?\n\s*const mainExIndex/.test(src)
  );
}

console.log(`\n${total - failures}/${total} checks passed`);
if (failures > 0) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
}
