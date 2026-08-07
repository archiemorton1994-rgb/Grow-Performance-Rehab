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

const holdRamp = suggestSetWeight(ramped([out(60, 'challenging')]), 1);
check(
  'Challenging holds the weight just lifted',
  holdRamp.kg === 60 && holdRamp.reason === 'hold',
  `got ${holdRamp.kg} (${holdRamp.reason}) — the ramp must NOT carry on climbing`
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
console.log('\n[5] Nothing ever gets heavier after Challenging or Too Hard');

const ANSWERS = ['easy', 'challenging', 'too_hard'];
let violations = [];
let capViolations = [];
let combos = 0;

for (const isRamped of [true, false]) {
  const planned = isRamped ? RAMP : [20, 20, 20, 20];
  // Every sequence of three answers over four sets.
  for (const a of ANSWERS) {
    for (const b of ANSWERS) {
      for (const c of ANSWERS) {
        combos++;
        const seq = [a, b, c];
        const outcomes = [];
        let cappedAt = null;
        for (let i = 0; i < seq.length; i++) {
          const suggestion = suggestSetWeight({ isRamped, plannedKg: planned, outcomes }, i);
          const lifted = suggestion.kg;

          // THE PROPERTY: the weight offered after a Challenging/Too Hard answer
          // must never exceed what was on the bar when that answer was given.
          if (i > 0) {
            const prevAnswer = outcomes[i - 1].feedback;
            const prevWeight = outcomes[i - 1].loggedKg;
            if (
              (prevAnswer === 'challenging' || prevAnswer === 'too_hard') &&
              lifted > prevWeight
            ) {
              violations.push(
                `${isRamped ? 'KPI' : 'acc'} ${seq.join('>')} set${i + 1}: ${prevAnswer} at ${prevWeight} → offered ${lifted}`
              );
            }
          }

          // And once Too Hard has been said, nothing later may climb back above
          // the weight it was backed off to.
          if (cappedAt !== null && lifted > cappedAt) {
            capViolations.push(
              `${isRamped ? 'KPI' : 'acc'} ${seq.join('>')} set${i + 1}: capped at ${cappedAt} → offered ${lifted}`
            );
          }
          if (seq[i] === 'too_hard' && cappedAt === null) {
            // The cap is whatever the next set is offered after the failure.
            const after = suggestSetWeight(
              { isRamped, plannedKg: planned, outcomes: [...outcomes, out(lifted, 'too_hard')] },
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

check(
  `no increase follows Challenging or Too Hard (${combos} sequences)`,
  violations.length === 0,
  violations.slice(0, 5).join(' | ')
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
  process.exit(1);
} else {
  console.log(`auto-regulation: all ${total} checks passed\n`);
  process.exit(0);
}
