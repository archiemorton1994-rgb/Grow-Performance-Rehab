/**
 * Contract test: within-session load auto-regulation.
 *
 * WHY THIS MATTERS
 * ────────────────
 * This is the one piece of logic in the app that can put more weight on a bar
 * than the user asked for. The single rule that must never break is the
 * guardrail: answering "Challenging" or "Too Hard" must NEVER be met with a
 * heavier suggestion. A user who tells the app a set was too hard and gets
 * handed more weight learns not to answer honestly, and the whole feature stops
 * working — or worse.
 *
 * So the guardrail is not tested with one example. It is tested by enumerating
 * every reachable combination of three answers across four sets, on both a
 * ramped KPI lift and a flat accessory, and asserting the property holds in all
 * of them.
 *
 * Run:  node tests/auto-regulation.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import {
  suggestSetWeight,
  adjustKg,
  loadStepKg,
  feedbackRatingFor,
  SET_FEEDBACK_LABELS,
} from '../lib/auto-regulation.ts';

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

const out = (kg, feedback) => ({ loggedKg: kg, feedback });

// ─── 1. The KPI ramp ─────────────────────────────────────────────────────────
console.log('\n[1] KPI lifts follow the ramp built from the 1RM');

// A typical squat ramp to an ~82% top set.
const RAMP = [60, 80, 100, 110];
const ramped = (outcomes) => ({ isRamped: true, plannedKg: RAMP, outcomes });

check(
  'set 1 is simply the prescription',
  suggestSetWeight(ramped([]), 0).kg === 60,
  'nothing has happened yet, so there is nothing to regulate against'
);

const easyRamp = suggestSetWeight(ramped([out(60, 'easy')]), 1);
check(
  'Easy climbs to the next rung',
  easyRamp.kg === 80 && easyRamp.reason === 'ramp_up',
  `got ${easyRamp.kg} (${easyRamp.reason})`
);

// 60 kg is the first rung of a ramp to 110 — a warm-up, and a stated fraction
// of the working weight rather than a claim about it. Holding the NUMBER here
// is what collapsed the lift; what gets held is the plan.
const holdWarmUp = suggestSetWeight(ramped([out(60, 'challenging')]), 1);
check(
  'Challenging on a warm-up carries on up the ramp',
  holdWarmUp.kg === 80 && holdWarmUp.reason === 'ramp_hold',
  `got ${holdWarmUp.kg} (${holdWarmUp.reason}) — repeating 60 here handed 60 to the working set too`
);
const overPlan = suggestSetWeight(ramped([out(70, 'challenging')]), 1);
check(
  'and adds nothing on top of the plan',
  overPlan.kg === 80,
  `got ${overPlan.kg}; they lifted 70 against a planned 60, and Easy would have carried that up`
);
const underPlan = suggestSetWeight(ramped([out(50, 'challenging')]), 1);
check(
  'while still following someone lifting under the plan',
  underPlan.kg > 50 && underPlan.kg < 80,
  `got ${underPlan.kg}; they lifted 50 against a planned 60`
);

const holdWorking = suggestSetWeight(
  ramped([out(60, 'easy'), out(80, 'easy'), out(100, 'easy'), out(110, 'challenging')]),
  4
);
check(
  'Challenging on the WORKING set holds the weight just lifted',
  holdWorking.kg === 110 && holdWorking.reason === 'hold',
  `got ${holdWorking.kg} (${holdWorking.reason}) — the one place the ramp must NOT carry on climbing`
);

const backOff = suggestSetWeight(ramped([out(60, 'easy'), out(80, 'easy'), out(100, 'too_hard')]), 3);
check(
  'Too Hard drops back to the last set that went well',
  backOff.kg === 80 && backOff.reason === 'back_off',
  `got ${backOff.kg} (${backOff.reason}) — expected the previous successful set, 80`
);

const firstSetFailed = suggestSetWeight(ramped([out(60, 'too_hard')]), 1);
check(
  'Too Hard on the very first set takes 10% off instead',
  firstSetFailed.kg === 55,
  `got ${firstSetFailed.kg} — there is no earlier set to fall back to`
);

// ─── 2. The user's own numbers win over the prescription ─────────────────────
console.log('\n[2] The ramp follows what the user is actually lifting');

// Prescribed 60 but they put 70 on the bar and it was easy. The next rung
// should shift with them, not snap back to the planned 80.
const shifted = suggestSetWeight(ramped([out(70, 'easy')]), 1);
check(
  'lifting above the plan shifts the rest of the ramp up',
  shifted.kg > 80,
  `got ${shifted.kg}; the plan said 80 but they are ~17% above it`
);
const shiftedDown = suggestSetWeight(ramped([out(50, 'easy')]), 1);
check(
  'lifting below the plan shifts the rest of the ramp down',
  shiftedDown.kg < 80 && shiftedDown.kg > 50,
  `got ${shiftedDown.kg}`
);

// ─── 3. Accessories ──────────────────────────────────────────────────────────
console.log('\n[3] Accessories move ±10% off what was actually lifted');

const acc = (outcomes, planned = [20, 20, 20]) => ({
  isRamped: false,
  plannedKg: planned,
  outcomes,
});

check(
  'Easy adds 10%',
  suggestSetWeight(acc([out(20, 'easy')]), 1).kg === 22,
  `got ${suggestSetWeight(acc([out(20, 'easy')]), 1).kg}`
);
check(
  'Challenging holds',
  suggestSetWeight(acc([out(20, 'challenging')]), 1).kg === 20,
  ''
);
check(
  'Too Hard takes 10% off',
  suggestSetWeight(acc([out(20, 'too_hard')]), 1).kg === 18,
  `got ${suggestSetWeight(acc([out(20, 'too_hard')]), 1).kg}`
);

// This is the accessory half of the original complaint: with no 1RM there is
// no ramp, so set 2 has to come from what the user typed into set 1 — not from
// the database's guess, which is what every set used to be prefilled with.
const overrode = suggestSetWeight(acc([out(35, 'challenging')]), 1);
check(
  'set 2 follows what was typed into set 1, not the database guess',
  overrode.kg === 35,
  `got ${overrode.kg}; the prescription said 20 but they lifted 35`
);

// ─── 4. Small weights still move ─────────────────────────────────────────────
console.log('\n[4] The increment matches how weights actually come');

check('under 10 kg steps by 0.5', loadStepKg(5) === 0.5, '');
check('10-25 kg steps by 1', loadStepKg(20) === 1, '');
check('25 kg and up steps by 2.5', loadStepKg(60) === 2.5, '');
check(
  'a 5 kg lateral raise actually goes up on Easy',
  adjustKg(5, 1.1) > 5,
  'rounding 10% of 5 kg to the nearest 2.5 gives zero change — Easy would have done nothing'
);
check('and actually goes down on Too Hard', adjustKg(5, 0.9) < 5, '');
check('a weight never rounds to zero', adjustKg(0.5, 0.9) > 0, '');

// ─── 5. THE GUARDRAIL, exhaustively ──────────────────────────────────────────
console.log('\n[5] Nothing gets heavier after Challenging on the set that counts');

const ANSWERS = ['easy', 'challenging', 'too_hard'];
let violations = [];
let overPlanned = [];
let capViolations = [];
let combos = 0;

for (const isRamped of [true, false]) {
  const planned = isRamped ? RAMP : [20, 20, 20, 20];
  // Every sequence of four answers over four sets, plus the set after the last.
  for (const a of ANSWERS) {
    for (const b of ANSWERS) {
      for (const c of ANSWERS) {
        for (const d of ANSWERS) {
          combos++;
          const seq = [a, b, c, d];
          const outcomes = [];
          let cappedAt = null;
          for (let i = 0; i <= seq.length; i++) {
            const suggestion = suggestSetWeight({ isRamped, plannedKg: planned, outcomes }, i);
            const lifted = suggestion.kg;
            const where = `${isRamped ? 'KPI' : 'acc'} ${seq.join('>')} set${i + 1}`;

            if (i > 0) {
              const prevAnswer = outcomes[i - 1].feedback;
              const prevWeight = outcomes[i - 1].loggedKg;
              // A flat exercise carries the same target on every set, so every
              // set of one is a working set. A ramp has exactly one.
              const prevWasWorkingSet = !isRamped || i - 1 >= planned.length - 1;

              // THE PROPERTY: on the set that carries the prescription, an
              // answer of Challenging or Too Hard is never met with more
              // weight. Too Hard is never met with more weight anywhere.
              if (
                (prevAnswer === 'too_hard' || (prevAnswer === 'challenging' && prevWasWorkingSet)) &&
                lifted > prevWeight
              ) {
                violations.push(`${where}: ${prevAnswer} at ${prevWeight} → offered ${lifted}`);
              }

              // THE SECOND PROPERTY: a Challenging on a warm-up may carry the
              // ramp on climbing — a warm-up is a fraction of the working
              // weight, not a verdict on it — but never past the rung the plan
              // itself named. It may decline to add; it may not add.
              if (prevAnswer === 'challenging' && !prevWasWorkingSet) {
                const rung = planned[i] ?? 0;
                if (rung > 0 && lifted > rung) {
                  overPlanned.push(`${where}: offered ${lifted} against a planned ${rung}`);
                }
              }
            }

            // And once Too Hard has been said, nothing later may climb back
            // above the weight it was backed off to.
            if (cappedAt !== null && lifted > cappedAt) {
              capViolations.push(`${where}: capped at ${cappedAt} → offered ${lifted}`);
            }
            if (i < seq.length) {
              if (seq[i] === 'too_hard' && cappedAt === null) {
                // The cap is whatever the next set is offered after the failure.
                const after = suggestSetWeight(
                  {
                    isRamped,
                    plannedKg: planned,
                    outcomes: [...outcomes, out(lifted, 'too_hard')],
                  },
                  i + 1
                );
                cappedAt = after.kg;
              }
              outcomes.push(out(lifted, seq[i]));
            }
          }
        }
      }
    }
  }
}

check(
  `no increase follows Too Hard, or Challenging on a working set (${combos} sequences)`,
  violations.length === 0,
  violations.slice(0, 5).join(' | ')
);
check(
  'and a Challenging warm-up never climbs past the plan',
  overPlanned.length === 0,
  overPlanned.slice(0, 5).join(' | ')
);
check(
  'nothing climbs back above a Too Hard back-off',
  capViolations.length === 0,
  capViolations.slice(0, 5).join(' | ')
);

// The specific case the cap exists for: fail set 3, then find the lighter set 4
// easy. Without a cap that Easy sends you straight back to the weight you just
// could not do.
const afterFailure = {
  isRamped: true,
  plannedKg: RAMP,
  outcomes: [out(60, 'easy'), out(80, 'easy'), out(100, 'too_hard'), out(80, 'easy')],
};
check(
  'an Easy after a failure cannot undo the back-off',
  suggestSetWeight(afterFailure, 4).kg <= 80,
  `got ${suggestSetWeight(afterFailure, 4).kg} — expected no more than the 80 it backed off to`
);

// ─── 6. Cross-session mapping ────────────────────────────────────────────────
console.log('\n[6] Set answers feed the next session sensibly');

check('Challenging alone changes nothing', feedbackRatingFor(['challenging']) === null, '');
check("one Easy is a nudge", feedbackRatingFor(['easy']) === 'easy', '');
check(
  'two Easys earn the bigger jump',
  feedbackRatingFor(['easy', 'easy']) === 'very_easy',
  "this is how the old four-button scale's top rung survives three buttons"
);
check(
  'Too Hard always wins over Easy',
  feedbackRatingFor(['easy', 'easy', 'too_hard']) === 'hard',
  'a failed set is the most important thing that happened'
);

// The ramped branch, which nothing above this line ever reached: every check
// here called feedbackRatingFor WITHOUT the ramp argument, so the KPI lifts —
// the only exercises that have a ramp — were the untested case.
const KPI = { isRamped: true, sets: 4 };
check(
  'a ramp reads its working set and ignores the warm-ups',
  feedbackRatingFor(['easy', 'easy', 'easy', 'challenging'], KPI) === null,
  'three easy warm-ups say nothing about the working weight — they are fractions of it'
);
check(
  'Easy on the working set earns the biggest jump',
  feedbackRatingFor(['challenging', 'challenging', 'challenging', 'easy'], KPI) === 'very_easy',
  'the summary screen promises Easy can earn 7.5 kg; a ramp has one set that can say it, so that set earns it'
);
check(
  'the biggest jump is actually reachable on a ramp at all',
  ['easy', 'challenging', 'too_hard', null].some(
    (a) =>
      ['easy', 'challenging', 'too_hard', null].some((b) =>
        ['easy', 'challenging', 'too_hard', null].some((c) =>
          ['easy', 'challenging', 'too_hard', null].some(
            (d) => feedbackRatingFor([a, b, c, d], KPI) === 'very_easy'
          )
        )
      )
  ),
  'enumerated: before this, no run of answers on a ramped lift could ever return very_easy'
);
check(
  'a one-set main lift is all working set',
  feedbackRatingFor(['easy'], { isRamped: true, sets: 1 }) === 'very_easy',
  'with one set there is no warm-up to discount'
);
// THE ASYMMETRY THIS FILE USED TO ENFORCE.
//
// "Easy" on a warm-up was correctly ignored - it is a fraction of the working
// weight, so an honest answer to it is Easy every time. "Too Hard" on the same
// warm-up failed the whole lift: held the load AND counted toward the three
// stalled sessions that earn a 10% deload. A stiff first set, answered
// honestly, was punished; the generous answer to it was not.
//
// It is settled by what was lifted afterwards, and ONLY by that. The first
// attempt asked whether the working set had been answered, which is a different
// question with a dangerous answer - see section [6] of ramp-collapse, where a
// lifter refuses 72.5 kg, the exercise correctly backs them off, and the working
// set then gets answered at 57.5 kg. Reading that as "nothing to change" left
// the prescription at 102.5 kg forever.
const RAMP_KG = [40, 57.5, 90, 102.5];
const KPI_KG = { ...KPI, loggedKg: RAMP_KG };
check(
  'a warm-up called too hard, and then the full working weight lifted anyway',
  feedbackRatingFor(['too_hard', null, null, 'challenging'], KPI_KG) === null,
  'they got past it - and this used to hold the load and move them a third of the way to a 10% deload'
);
check(
  'but not if they backed off and never got there',
  feedbackRatingFor(['too_hard', null, null, 'challenging'], { ...KPI, loggedKg: [40, 57.5, 35, 35] }) === 'hard',
  'the working set carrying LESS than the weight refused is the opposite of evidence the prescription was fine'
);
check(
  'and it cannot earn a jump either, however good the working set felt',
  feedbackRatingFor(['too_hard', null, null, 'easy'], KPI_KG) === null,
  'the best a lift with a Too Hard in it can score is that nothing changes'
);
check(
  'with the working set unanswered, the warm-up is the only evidence and stands',
  feedbackRatingFor(['too_hard', null, null, null], KPI_KG) === 'hard',
  'nothing overruled it - including the case where the working set was never reached'
);
check(
  'with no logged weights at all, it stands too',
  feedbackRatingFor(['too_hard', null, null, 'challenging'], KPI) === 'hard',
  'a resumed session has no per-set answers to recompute from, and unproven must fall to holding the load'
);
check(
  'clearing the lightest refusal does not clear the heaviest',
  feedbackRatingFor(['too_hard', 'too_hard', null, 'challenging'], { ...KPI, loggedKg: [40, 57.5, 50, 50] }) === 'hard',
  'on a climbing ramp the first Too Hard is the lightest of them'
);
check(
  'Too Hard on the working set is still Too Hard',
  feedbackRatingFor([null, null, null, 'too_hard'], KPI) === 'hard',
  ''
);
check(
  'an accessory has no warm-ups, so Too Hard anywhere still counts',
  feedbackRatingFor(['easy', 'too_hard', 'easy']) === 'hard',
  'every set of an accessory carries the same target, so every answer is about it'
);

check(
  'the button labels are exactly Easy / Challenging / Too Hard',
  SET_FEEDBACK_LABELS.easy === 'Easy' &&
    SET_FEEDBACK_LABELS.challenging === 'Challenging' &&
    SET_FEEDBACK_LABELS.too_hard === 'Too Hard',
  JSON.stringify(SET_FEEDBACK_LABELS)
);

console.log('');
if (failures > 0) {
  console.error(`auto-regulation: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`auto-regulation: all ${total} checks passed\n`);
  process.exitCode = 0;
}
