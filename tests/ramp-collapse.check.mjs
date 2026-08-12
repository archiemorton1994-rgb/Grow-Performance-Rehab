/**
 * Contract test: an answer given on a warm-up cannot take the lift away.
 *
 * WHAT WENT WRONG
 * ───────────────
 * A KPI lift is prescribed as a ramp: six sets climbing 40 / 57.5 / 72.5 /
 * 77.5 / 90 / 102.5 kg, only the last of which is the working weight. Answering
 * "Challenging" on the 40 kg warm-up used to mean "hold this number", so every
 * later set — including the one the screen labels WORKING SET — was offered
 * 40 kg. Then the heaviest weight of the session was filed as the exercise's
 * anchor, the next session's ramp was built from it, and the same answer
 * collapsed it again. Measured: 102.5 → 30 → 12.5 → 5 kg over four sessions,
 * with the summary congratulating the user each time.
 *
 * WHAT MUST BE TRUE INSTEAD
 * ─────────────────────────
 * A warm-up is by construction a fraction of the working weight, so what the
 * user says about one is not a statement about the working weight. It may
 * decline to add anything on top of the plan. It may not delete the plan. And
 * no run of sessions in which the user simply accepts the numbers the app
 * itself offers may leave them with a lighter bar than they started with.
 *
 * The four-session spiral is simulated below against the real modules: the real
 * ramp builder, the real per-set suggestion, the real rating fold and the real
 * anchor rule, wired to each other exactly as a session wires them.
 *
 * Run:  npx tsx tests/ramp-collapse.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import {
  suggestSetWeight,
  feedbackRatingFor,
  nextAnchorKg,
} from '../lib/auto-regulation.ts';
import { expandSetTargets } from '../lib/workout-engine.ts';

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

/** The reported case: intermediate, full gym, squat 1RM 120 → 102.5 kg working. */
const WORKING_KG = 102.5;
const SETS = 6;
const RAMP = expandSetTargets('main', SETS, [WORKING_KG]);

/**
 * Play one exercise: take whatever weight the app offers for every set and
 * answer it however `answerFor` says. Returns what was offered and lifted.
 */
function playExercise(plannedKg, answerFor) {
  const outcomes = [];
  const offered = [];
  for (let i = 0; i < plannedKg.length; i++) {
    const s = suggestSetWeight({ isRamped: true, plannedKg, outcomes }, i);
    offered.push(s.kg);
    outcomes.push({ loggedKg: s.kg, feedback: answerFor(i, s.kg) });
  }
  return { offered, outcomes };
}

const always = (f) => () => f;

console.log('\n[1] The ramp the audit reproduced');
check(
  `a 1RM of 120 kg still builds ${RAMP.join(' / ')}`,
  RAMP.length === SETS && RAMP[SETS - 1] === WORKING_KG && RAMP[0] < RAMP[SETS - 1],
  JSON.stringify(RAMP)
);

console.log('\n[2] One "Challenging" on the first warm-up');
{
  const { offered } = playExercise(RAMP, (i) => (i === 0 ? 'challenging' : null));
  check(
    'the working set is still offered the working weight',
    offered[SETS - 1] === WORKING_KG,
    `offered ${offered.join(' / ')} — this is the exact bug: it used to read ${RAMP[0]} six times`
  );
  check(
    'and every rung in between still climbs',
    offered.every((kg, i) => i === 0 || kg > offered[i - 1]),
    offered.join(' / ')
  );
}

console.log('\n[3] Every combination of warm-up answers, exhaustively');
{
  const ANSWERS = ['easy', 'challenging', 'too_hard', null];
  const warmUps = SETS - 1;
  const collapsed = [];
  const overPlanned = [];
  const failedButClimbed = [];
  let combos = 0;

  // Every sequence of answers across the five warm-ups, working set unanswered.
  const seq = new Array(warmUps).fill(null);
  const walk = (idx) => {
    if (idx === warmUps) {
      combos++;
      const { offered, outcomes } = playExercise(RAMP, (i) => seq[i] ?? null);
      const working = offered[SETS - 1];
      const saidTooHard = seq.includes('too_hard');

      // THE PROPERTY: short of the user actually failing a set, nothing said
      // about a warm-up may reduce the working weight. It is a fraction of the
      // working weight; it is not a claim about it.
      if (!saidTooHard && working < WORKING_KG) {
        collapsed.push(`${seq.join('>')} → working set offered ${working}`);
      }
      // And nothing said about a warm-up may inflate it either: "Easy" on a
      // warm-up is what a warm-up is supposed to feel like.
      if (working > WORKING_KG && !seq.includes('easy')) {
        overPlanned.push(`${seq.join('>')} → working set offered ${working}`);
      }
      // A failed set must still back the exercise off.
      if (saidTooHard) {
        const failedAt = Math.min(
          ...outcomes.filter((o) => o.feedback === 'too_hard').map((o) => o.loggedKg)
        );
        if (working >= failedAt) {
          failedButClimbed.push(`${seq.join('>')} → failed at ${failedAt}, offered ${working}`);
        }
      }
      return;
    }
    for (const a of ANSWERS) {
      seq[idx] = a;
      walk(idx + 1);
    }
    seq[idx] = null;
  };
  walk(0);

  check(
    `no warm-up answer collapses the working weight (${combos} sequences)`,
    collapsed.length === 0,
    collapsed.slice(0, 4).join(' | ')
  );
  check(
    'and none of them inflates it either',
    overPlanned.length === 0,
    overPlanned.slice(0, 4).join(' | ')
  );
  check(
    'a failed warm-up still backs the whole exercise off',
    failedButClimbed.length === 0,
    failedButClimbed.slice(0, 4).join(' | ')
  );
}

console.log('\n[4] The working set keeps its guardrail');
{
  const plan = { isRamped: true, plannedKg: RAMP, outcomes: [] };
  for (let i = 0; i < SETS - 1; i++) {
    plan.outcomes.push({ loggedKg: RAMP[i], feedback: 'challenging' });
  }
  plan.outcomes.push({ loggedKg: WORKING_KG, feedback: 'challenging' });
  const afterWorking = suggestSetWeight(plan, SETS);
  check(
    'Challenging on the working set is never answered with more weight',
    afterWorking.kg <= WORKING_KG && afterWorking.reason === 'hold',
    `offered ${afterWorking.kg} (${afterWorking.reason}) after ${WORKING_KG}`
  );
}

console.log('\n[5] Four sessions of answering Challenging, honestly, every time');
{
  // The whole loop: the ramp is built from the anchor, the sets are whatever
  // the app offers, and the anchor is rewritten from what was lifted.
  const playSessions = (count, answerFor, startKg = WORKING_KG) => {
    let anchor = startKg;
    const log = [];
    for (let s = 0; s < count; s++) {
      const plannedKg = expandSetTargets('main', SETS, [anchor]);
      const { offered, outcomes } = playExercise(plannedKg, answerFor);
      const heaviest = Math.max(...outcomes.map((o) => o.loggedKg));
      const rating = feedbackRatingFor(
        outcomes.map((o) => o.feedback),
        { isRamped: true, sets: SETS }
      );
      log.push({ prescribed: plannedKg[SETS - 1], offered: offered[SETS - 1], rating });
      anchor = nextAnchorKg(heaviest, anchor, rating);
    }
    return { log, anchor };
  };

  const { log, anchor } = playSessions(4, always('challenging'));
  console.log(
    '     ' + log.map((l, i) => `session ${i + 1}: ${l.offered} kg`).join('  ·  ') +
      `  → anchor ${anchor} kg`
  );
  check(
    'the working weight is the same in session 4 as in session 1',
    log.every((l) => l.offered === WORKING_KG),
    `got ${log.map((l) => l.offered).join(' → ')} — the audit measured 102.5 → 30 → 12.5 → 5`
  );
  check(
    'and the anchor on file never fell',
    anchor >= WORKING_KG,
    `anchor ended at ${anchor}`
  );

  // Ten sessions, because "it decays slowly" is still decay.
  const long = playSessions(10, always('challenging'));
  check(
    'ten sessions of it change nothing either',
    long.anchor === WORKING_KG && long.log.every((l) => l.offered === WORKING_KG),
    `anchor ended at ${long.anchor}`
  );

  // The second half of the loop, on its own: a lifter who never says anything
  // is too hard but keeps rounding down to the plates on the rack. Filing "the
  // most you lifted" as "the most you can lift" turns that into a prescription
  // that shrinks every week, which nothing on screen would explain.
  const roundsDown = (kg) => Math.max(2.5, Math.round((kg * 0.9) / 2.5) * 2.5);
  let onFile = WORKING_KG;
  const prescribed = [];
  for (let s = 0; s < 6; s++) {
    const plannedKg = expandSetTargets('main', SETS, [onFile]);
    prescribed.push(plannedKg[SETS - 1]);
    const outcomes = [];
    for (let i = 0; i < SETS; i++) {
      const sug = suggestSetWeight({ isRamped: true, plannedKg, outcomes }, i);
      outcomes.push({ loggedKg: roundsDown(sug.kg), feedback: 'challenging' });
    }
    onFile = nextAnchorKg(
      Math.max(...outcomes.map((o) => o.loggedKg)),
      onFile,
      feedbackRatingFor(
        outcomes.map((o) => o.feedback),
        { isRamped: true, sets: SETS }
      )
    );
  }
  console.log('     prescribed working weight: ' + prescribed.join(' → '));
  check(
    'lifting under the plan every week does not shrink the prescription',
    prescribed.every((kg) => kg === WORKING_KG),
    `${prescribed.join(' → ')} — nothing was ever rated Too Hard, so nothing said to back off`
  );
}

{
  // The simulation above is only the truth if the session screen actually
  // files its anchors through this rule. It used to file Math.max outright.
  const src = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');
  check(
    'the session screen files its anchors through nextAnchorKg',
    /sessionWeights\[log\.exerciseId\] = nextAnchorKg\(/.test(src),
    'writing Math.max(...completedWeights) straight in is the loop this file exists to close'
  );
}

console.log('\n[6] Backing off still works, and settles');
{
  // A lifter who genuinely cannot do more than 60 kg today: they say Too Hard
  // to anything above it. The weight must come down — and then stop coming
  // down, at something near what they can actually lift.
  const REAL_LIMIT = 60;
  const answer = (_i, kg) => (kg > REAL_LIMIT ? 'too_hard' : 'challenging');
  let anchor = WORKING_KG;
  const anchors = [];
  for (let s = 0; s < 6; s++) {
    const plannedKg = expandSetTargets('main', SETS, [anchor]);
    const { outcomes } = playExercise(plannedKg, answer);
    const heaviest = Math.max(...outcomes.map((o) => o.loggedKg));
    const rating = feedbackRatingFor(
      outcomes.map((o) => o.feedback),
      { isRamped: true, sets: SETS }
    );
    anchor = nextAnchorKg(heaviest, anchor, rating);
    anchors.push(anchor);
  }
  console.log('     anchors: ' + anchors.join(' → '));
  check(
    'saying Too Hard does bring the weight down',
    anchors[0] < WORKING_KG,
    `first session left the anchor at ${anchors[0]}`
  );
  check(
    'it settles instead of running to an empty bar',
    anchors[5] === anchors[4] && anchors[5] >= REAL_LIMIT,
    `ended at ${anchors[5]} against a real limit of ${REAL_LIMIT}`
  );
}

console.log('\n[7] The anchor rule on its own');
check(
  'a lighter session on its own does not move the anchor down',
  nextAnchorKg(40, 102.5, null) === 102.5,
  `got ${nextAnchorKg(40, 102.5, null)}`
);
check(
  'a heavier session does move it up',
  nextAnchorKg(110, 102.5, null) === 110,
  `got ${nextAnchorKg(110, 102.5, null)}`
);
check(
  'saying a set was Too Hard does move it down',
  nextAnchorKg(80, 102.5, 'hard') === 80,
  `got ${nextAnchorKg(80, 102.5, 'hard')}`
);
check(
  'a first-ever session sets the anchor whatever it is',
  nextAnchorKg(40, 0, null) === 40,
  `got ${nextAnchorKg(40, 0, null)}`
);
check(
  'an unweighted session leaves the anchor alone',
  nextAnchorKg(0, 102.5, null) === 102.5,
  `got ${nextAnchorKg(0, 102.5, null)}`
);

// ─── 8. The other number on that card ────────────────────────────────────────
// Rides along in this file because the check script takes one new entry, and
// this is the same card: the line directly under the weight the sections above
// are about.
console.log('\n[8] The card never prints a unit twice');
{
  const src = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');
  // Take the live rule out of the screen rather than restating it here, so this
  // cannot pass against a copy of the rule that the app no longer uses.
  const m = src.match(/const repsIsBareCount = (\/.*?\/)\.test\(repsLabel\.trim\(\)\);/);
  const bareCount = m ? new RegExp(m[1].slice(1, -1)) : null;
  const render = (reps) => (bareCount && bareCount.test(reps.trim()) ? `${reps} reps` : reps);

  check('the session screen still has a rep-label rule to read', bareCount !== null, '');

  // Every distinct rep string the exercise database actually ships.
  const db = readFileSync(new URL('../lib/exercise-db.ts', import.meta.url), 'utf8');
  const all = [...new Set([...db.matchAll(/\breps:\s*'([^']*)'/g)].map((x) => x[1]))];
  check('found the database rep strings', all.length > 100, `${all.length} distinct`);

  // A label that already names what it is counting must be printed as written.
  // "reps" after any of these is the giveaway that the old rule was a guess.
  const doubled = all.filter((r) => {
    const out = render(r);
    return out !== r && /[a-z]/i.test(r);
  });
  check(
    `nothing that already names its own unit gets " reps" bolted on (${all.length} strings)`,
    doubled.length === 0,
    doubled.slice(0, 6).map((r) => `"${render(r)}"`).join(' | ')
  );

  // The specific ones the audit read off the screen.
  const wrongBefore = [
    '10 deep breaths',
    '40m',
    '20 total',
    '5 explosive',
    '25 pulses',
    '500-400-300-200-100 m',
  ];
  const stillWrong = wrongBefore.filter((r) => render(r) !== r);
  check(
    'the six the audit photographed all read as written',
    stillWrong.length === 0,
    stillWrong.map((r) => `"${render(r)}"`).join(' | ')
  );

  // And a bare count still needs the word, or the card just says "10".
  const bare = ['8', '10-12', '6-8', '25'];
  const missing = bare.filter((r) => render(r) !== `${r} reps`);
  check(
    'a bare count still gets it',
    missing.length === 0,
    missing.map((r) => `"${render(r)}"`).join(' | ')
  );
}

console.log('');
if (failures > 0) {
  console.error(`ramp-collapse: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`ramp-collapse: all ${total} checks passed\n`);
  process.exit(0);
}
