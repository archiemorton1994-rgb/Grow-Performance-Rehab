/**
 * Contract test: what the app learns from a set, and how it says what it wants.
 *
 * Three related changes, all about the same question - is the feedback the user
 * gives, and the way they give it, actually sufficient?
 *
 * ── 1. THE REPS ARE EVIDENCE, AND THEY WERE BEING IGNORED ───────────────────
 * Everything the app knew about how a session felt came from three buttons.
 * Buttons are a report; reps are a measurement. Someone prescribed 8-12 who logs
 * 20 has proved the weight was light more convincingly than any button, and they
 * typed it in already - the rep count is a required field on every set. It also
 * works for the user who never taps the buttons at all, which the buttons by
 * definition cannot.
 *
 * ── 2. THE CARD NEVER SAID HOW HARD ────────────────────────────────────────
 * "3 x 10" with no effort target is half a prescription - the same ten reps can
 * be a warm-up or a maximal set. Without it on screen, "how did that feel?" is
 * asked against nothing. The numbers were being computed and thrown away.
 *
 * ── 3. THE WARM-UP ASYMMETRY ───────────────────────────────────────────────
 * Covered in tests/auto-regulation.check.mjs, which owns that function. What is
 * asserted here is the half of it this file introduced: rehab never being
 * programmed to failure, which only became visible once the effort target was
 * displayed.
 */
import { readFileSync } from 'fs';
import {
  combineWithMeasuredReps,
  effortHint,
  measuredRating,
  nextPrescription,
  parseReps,
  prescriptionFor,
  restSecondsFor,
} from '../lib/rep-scheme.ts';

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
/** Comments describe the rule; only code can implement it. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sets = (reps, n = 3) =>
  Array.from({ length: n }, () => ({ reps, completed: true, skipped: false }));

console.log('\n[1] The reps the user logged are read as evidence');

check(
  'hitting the target exactly says nothing',
  measuredRating('8-12', sets(12), 'accessory') === null,
  'doing what was asked is not a reason to change what is asked'
);
check(
  'one rep over says nothing either',
  measuredRating('8-12', sets(13), 'accessory') === null,
  'a single rep is a miscount, a half rep argued into a whole one, or a good day'
);
check(
  'a clear overshoot is read as easy',
  measuredRating('8-12', sets(15), 'accessory') === 'easy',
  ''
);
check(
  'a large one earns the biggest step',
  measuredRating('8-12', sets(18), 'accessory') === 'very_easy',
  ''
);

// Both guards have to clear, and each one catches what the other cannot.
check(
  'the absolute guard: 6 on a 5-rep target is one rep, not a verdict',
  measuredRating('5', sets(6), 'main') === null,
  'proportionally that is 20% over, which is why a ratio alone is not enough'
);
check(
  'the proportional guard: 22 on a 20-rep target is 2 reps, and still nothing',
  measuredRating('20', sets(22), 'accessory') === null,
  'two reps means something different on a triple than on a calf raise'
);
check(
  '8 on a 5-rep target clears both',
  measuredRating('5', sets(8), 'main') === 'very_easy',
  ''
);

console.log('\n[2] And what it refuses to read');

check(
  'clinical dosing is not renegotiated by beating it',
  measuredRating('15 each side', sets(25), 'prehab') === null,
  '"2 x 15 each side" on a rotator cuff is a clinical dose, not an opening bid'
);
check(
  'a timed hold has no rep target to beat',
  measuredRating('45s', sets(60), 'accessory') === null,
  ''
);
check(
  'an AMRAP already asked for every rep there is',
  measuredRating('AMRAP - max clean reps', sets(30), 'accessory') === null,
  'beating "as many as possible" is not information'
);
check(
  'an unfinished set voids the whole reading',
  measuredRating(
    '8-12',
    [
      { reps: 20, completed: true, skipped: false },
      { reps: 20, completed: false, skipped: false },
    ],
    'accessory'
  ) === null,
  'sets that went well before one that did not are not evidence the weight was light'
);
check(
  'it reads the LAST set, not the best one',
  measuredRating(
    '8-12',
    [
      { reps: 20, completed: true, skipped: false },
      { reps: 10, completed: true, skipped: false },
    ],
    'accessory'
  ) === null,
  'on a ramp the last set is the working set; on an accessory it is the closest to failure'
);

console.log('\n[3] "Too Hard" is never overruled by arithmetic');

check(
  'reps saying very_easy cannot beat a user saying Too Hard',
  combineWithMeasuredReps('hard', 'very_easy') === 'hard',
  'answering someone at their limit with more weight is the worst thing the app could do'
);
check(
  'a user who never taps a button still progresses',
  combineWithMeasuredReps(undefined, 'easy') === 'easy',
  'this is the whole point: the measurement works when the report is absent'
);
check(
  'and the stronger of the two agreeing signals wins',
  combineWithMeasuredReps('easy', 'very_easy') === 'very_easy' &&
    combineWithMeasuredReps('very_easy', null) === 'very_easy',
  ''
);

console.log('\n[4] It is actually wired into a finished session');

const store = stripComments(read('lib/store.ts'));
check(
  'completeSession asks what the reps said',
  /const measured =[\s\S]{0,200}?measuredRating\(log\.targetReps, log\.sets, log\.category\)/.test(
    store
  ),
  ''
);
check(
  'and combines it with what the user said, before judging the exercise',
  /combineWithMeasuredReps\(log\.feedbackRating, measured\)/.test(store) &&
    /performanceForLog\(log\.sets, effectiveRating/.test(store),
  'computing a rating and then judging on the old one is the bug with extra steps'
);
check(
  'the combined rating is what drives the next rep target too',
  /effectiveRating \?\? undefined,/.test(store),
  'the two levers must agree about how the session went'
);

console.log('\n[5] Nothing to add is not the same as "add nothing"');

check(
  'a loadable lift tops out and hands the jump to the weight',
  nextPrescription('12', '8-12', true, ['muscle'], 'accessory', undefined, true)?.addLoad === true,
  ''
);
const bodyweight = nextPrescription('12', '8-12', true, ['muscle'], 'accessory', undefined, false);
check(
  'a bodyweight lift holds at the top instead',
  bodyweight?.addLoad === false && bodyweight?.reps === '12',
  '43 catalogue lifts are bodyweight with a countable range: telling those "the weight goes up" threw the earned reps away for a weight that never arrived, and the user climbed the same range again forever'
);
check(
  'and the store decides that from what was actually lifted',
  /log\.sets\.some\(\(set\) => set\.weight > 0\)/.test(store),
  'pattern-matching the load sentence would break on "Bodyweight + 10-20 kg plate"'
);

console.log('\n[6] The effort target reaches the card');

const sessionCode = stripComments(read('app/session.tsx'));
check(
  'the card computes an effort target',
  /const effortTargets = useMemo\(/.test(sessionCode) &&
    /effortHint\(scheme, false\)/.test(sessionCode),
  'it was computed in lib/rep-scheme.ts and displayed nowhere'
);
check(
  'and renders it',
  /\{effortTargets && \(/.test(sessionCode) && /styles\.effortText/.test(sessionCode),
  ''
);
check(
  'it is absent from timed work and cardio, where reps in reserve is not a thing',
  /if \(exercise\.type === 'cardio' \|\| isTimeExercise\) return null;/.test(sessionCode),
  ''
);
check(
  'a one-set exercise is not told to both save reps and go to failure',
  /exercise\.sets > 1 \|\| !scheme\.lastSetToFailure/.test(sessionCode),
  'with one set there is no set that is not the last one'
);

// GENERATING REAL SESSIONS IS WHAT CAUGHT THIS.
//
// The first version showed an effort target anywhere the goal table had a row,
// which put "Leave about 2-3 reps in the tank" under a Broad Jump prescribed
// "4 explosive" and under a Leg Press Activation prescribed "15 slow". Neither
// is effort-limited - one is a maximal jump whose whole point is quality, the
// other is a priming drill - so that line was not a harmless extra, it was
// wrong coaching on the busiest screen in the app.
check(
  'drills and clinical doses get no effort target at all',
  /if \(goalTier !== 'tier1' && goalTier !== 'tier2'\) return null;/.test(sessionCode),
  'activation, power primers and prehab are prescribed by a physiotherapist; their instruction is "as written"'
);
check(
  'and neither does anything the app cannot count the reps of',
  /if \(!parseReps\(exercise\.reps\)\) return null;/.test(sessionCode),
  'parseReps already refuses times, distances, AMRAPs, explosive and tempo work - the same set of things you cannot leave two reps back on'
);
check(
  'the rules it leans on really do refuse those prescriptions',
  parseReps('4 explosive') === null &&
    parseReps('15 slow') === null &&
    parseReps('30s each') === null,
  ''
);
check(
  'the card is given the goals it needs to answer any of this',
  /goals=\{userProfile\.goals\}/.test(sessionCode),
  ''
);
check(
  'the wording is plain English, not RIR',
  !/\bRIR\b/.test(effortHint(prescriptionFor(['muscle'], 'main'), false)) &&
    /in the tank/.test(effortHint(prescriptionFor(['muscle'], 'main'), false)),
  '"RIR 2" means nothing to a beginner and this app is used by beginners'
);

console.log('\n[7] Rest finally depends on the goal');

check(
  'a strength main lift rests far longer than a fat-loss one',
  restSecondsFor(['strength'], 'main') > 2 * restSecondsFor(['fat_loss'], 'main'),
  `${restSecondsFor(['strength'], 'main')}s vs ${restSecondsFor(['fat_loss'], 'main')}s - one number covered both before`
);
check(
  'the timer takes the goal-aware number',
  /const duration = seconds \?\? REST_PERIOD_SECONDS\[category\] \?\? 0;/.test(sessionCode),
  ''
);
check(
  'but only on the lifting tiers',
  /goalTier === 'tier1' \|\| goalTier === 'tier2' \? restSecondsFor/.test(sessionCode),
  'prehab, activation and power-primer rest is written per category and is more specific than the goal table, which has one number covering all three'
);
check(
  'so the categories that deliberately have no timer still have none',
  /seconds=\{goalRestSeconds\}/.test(sessionCode) &&
    restSecondsFor(['muscle'], 'cooldown') === null &&
    restSecondsFor(['muscle'], 'finisher') === null,
  'a countdown on a cooldown is the app interrupting someone breathing'
);

console.log('\n[8] The warm-up rule is settled by what was lifted, not by what was tapped');

check(
  'the rating is recomputed where the answers and the weights both exist',
  /const rating = answers\?\.some\(\(a\) => a != null\)/.test(sessionCode) &&
    /loggedKg: \(exerciseData\[i\]\?\.sets \?\? \[\]\)\.map\(\(set\) => set\.weight\)/.test(sessionCode),
  'the live value is worked out one tap at a time, when only the answers are to hand - and whether a Too Hard warm-up fails the whole lift depends on what the working set then carried'
);
check(
  'and a session with no per-set answers keeps the conservative live value',
  /: inSessionFeedback\[ex\.id\];/.test(sessionCode),
  'per-set answers are scratch working and are not persisted, so a resumed session has none to recompute from'
);

console.log('\n[9] Rehab is never programmed to failure');

for (const goals of [['rehab'], ['rehab', 'muscle'], ['rehab', 'strength']]) {
  const p = prescriptionFor(goals, 'main');
  check(
    `${goals.join(' + ')}: no maximal set, and at least 2 reps kept back`,
    p.lastSetToFailure === false && p.rir.min >= 2,
    'rehab maps onto the hypertrophy row, which carries "last set close to failure" - right for the rep range, wrong for the effort, and invisible until the target was displayed'
  );
}
check(
  'while someone who only picked muscle still gets the last-set push',
  prescriptionFor(['muscle'], 'main').lastSetToFailure === true,
  'the softening must be about rehab, not a quiet removal of the most effective item in the spec'
);
check(
  'and prehab movements were never sent to failure for anyone',
  prescriptionFor(['muscle'], 'prehab').lastSetToFailure === false,
  'an all-out set on a shoulder prehab exercise is how prehab becomes an injury'
);

console.log(`\nfeedback-signal: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
