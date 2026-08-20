/**
 * Contract test: the rep-scheme config, and double progression.
 *
 * WHAT THIS ADDS TO THE APP
 * ─────────────────────────
 * Load was the only lever progression had, and the smallest honest step is a
 * 2.5 kg plate: 12.5% on a 20 kg dumbbell press, over 6% on a 40 kg squat. So
 * the engine had two answers available - nothing, or too much - and for an
 * honest "normal" session below about 50 kg its answer was nothing, three
 * sessions running, until a bank-three-clean-sessions rule allowed the jump.
 *
 * Adding a rep is 5-10% more work at a fraction of the joint cost. Reps climb to
 * the top of the range, then the weight goes up and the reps start again.
 *
 * WHAT IT MUST NOT DO
 * ───────────────────
 * The catalogue was written movement by movement by a physiotherapist. Two of
 * the assertions below exist because the first version of this quietly undid
 * that work:
 *
 *   1. Climbing "8-10" produces "9-10" and then "10" - at which point the range
 *      is gone from the string. Re-deriving it from "10" fell back to the GOAL
 *      default, so an authored 8-10 became a generic 6-8 two sessions in. The
 *      range is read from the template every time now.
 *   2. Prehab dosing is clinical. "2 x 15 each side" on a rotator cuff is not an
 *      opening bid, and the first version was walking it up to 20.
 */
import { readFileSync } from 'fs';
import {
  REP_SCHEME,
  intentFor,
  tierOf,
  prescriptionFor,
  parseReps,
  nextPrescription,
  effortHint,
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

console.log('\n[1] Goals map onto the three training intentions');

check('strength and power are strength', intentFor(['strength']) === 'strength' && intentFor(['power']) === 'strength', '');
check('muscle is hypertrophy', intentFor(['muscle']) === 'hypertrophy', '');
check('fat loss is endurance', intentFor(['fat_loss']) === 'endurance', '');
check('rehab is programmed gently, not heavily', intentFor(['rehab']) === 'hypertrophy', 'a 3-5 rep max-effort prescription is the wrong shape for someone rehabbing');
check(
  'strength wins a mixed answer',
  intentFor(['muscle', 'strength']) === 'strength',
  'a 5-rep prescription trained as 15 is a different session; the reverse is merely heavier'
);
check('no goal at all still returns something', intentFor(undefined) === 'hypertrophy', '');

console.log('\n[2] The tiers come from the categories the app already has');

check('a main lift is tier 1', tierOf('main') === 'tier1', '');
check('an accessory is tier 2', tierOf('accessory') === 'tier2', '');
check('prehab is tier 3', tierOf('prehab') === 'tier3', '');
check(
  'a finisher gets no rep prescription at all',
  tierOf('finisher') === null && prescriptionFor(['muscle'], 'finisher') === null,
  'a finisher is meant to be a scramble; a rep target and an RIR would pretend it is a working set'
);
check('a cooldown gets none either', prescriptionFor(['muscle'], 'cooldown') === null, '');

console.log('\n[3] The table says what the spec says');

check('strength tier 1 is 3-5 reps', REP_SCHEME.strength.tier1.reps.min === 3 && REP_SCHEME.strength.tier1.reps.max === 5, '');
check('hypertrophy tier 2 is 8-12 reps', REP_SCHEME.hypertrophy.tier2.reps.min === 8 && REP_SCHEME.hypertrophy.tier2.reps.max === 12, '');
check('endurance leans past 12 reps everywhere', Object.values(REP_SCHEME.endurance).every((p) => p.reps.min >= 12), '');
check(
  'tier 3 is always higher-rep than tier 1, whatever the goal',
  Object.keys(REP_SCHEME).every((i) => REP_SCHEME[i].tier3.reps.min >= REP_SCHEME[i].tier1.reps.min),
  'isolation and rehab work stays lighter and longer to protect the joint'
);
check(
  'rest gets shorter as the reps get higher',
  REP_SCHEME.strength.tier1.restSeconds.min > REP_SCHEME.hypertrophy.tier1.restSeconds.min &&
    REP_SCHEME.hypertrophy.tier1.restSeconds.min > REP_SCHEME.endurance.tier1.restSeconds.min,
  'the same back squat wants 3 minutes for a powerlifter and 90 seconds for size'
);
check(
  'the same movement rests differently for different goals',
  restSecondsFor(['strength'], 'main') !== restSecondsFor(['muscle'], 'main'),
  'this is the thing the old category-only rest table could not express'
);

console.log('\n[4] Only hypertrophy lifting is taken close to failure');

check(
  'hypertrophy pushes the last set on tier 1 and 2',
  REP_SCHEME.hypertrophy.tier1.lastSetToFailure && REP_SCHEME.hypertrophy.tier2.lastSetToFailure,
  ''
);
check(
  'but never on tier 3',
  Object.keys(REP_SCHEME).every((i) => REP_SCHEME[i].tier3.lastSetToFailure === false),
  'an all-out set on a rehab exercise is how shoulder prehab becomes a shoulder injury'
);
check(
  'strength and endurance never go to failure',
  Object.values(REP_SCHEME.strength).every((p) => !p.lastSetToFailure) &&
    Object.values(REP_SCHEME.endurance).every((p) => !p.lastSetToFailure),
  ''
);
check(
  'the effort hint avoids jargon',
  /in the tank/.test(effortHint(REP_SCHEME.strength.tier1, false)) &&
    !/\bRIR\b|\bRPE\b/.test(effortHint(REP_SCHEME.strength.tier1, false)),
  'this app is used by beginners; "RIR 2" means nothing to most people'
);
check(
  'the final hypertrophy set says push, and says when to stop',
  /close to failure/.test(effortHint(REP_SCHEME.hypertrophy.tier2, true)) &&
    /form/.test(effortHint(REP_SCHEME.hypertrophy.tier2, true)),
  ''
);

console.log('\n[5] Only countable reps are counted');

for (const notReps of ['45s each side', '3 min', '4 min continuous', 'AMRAP - max clean reps', '5 explosive', '10 slow reps']) {
  check(`"${notReps}" is not something to add a rep to`, parseReps(notReps) === null, 'it was treated as a rep count');
}
check('"12" parses', JSON.stringify(parseReps('12')) === JSON.stringify({ min: 12, max: 12, suffix: '' }), '');
check('"8-10" parses', JSON.stringify(parseReps('8-10')) === JSON.stringify({ min: 8, max: 10, suffix: '' }), '');
check('"15 each side" keeps its suffix', parseReps('15 each side')?.suffix === ' each side', 'losing it turns a per-side prescription into a total');

console.log('\n[6] Double progression climbs, then adds load, then starts again');

const cycle = (base, goal, category, steps) => {
  const seen = [];
  let reps = base;
  for (let i = 0; i < steps; i++) {
    const r = nextPrescription(reps, base, true, [goal], category);
    if (!r) return null;
    seen.push(r.addLoad ? `${r.reps}+LOAD` : r.reps);
    reps = r.reps;
  }
  return seen;
};

const authored = cycle('8-10', 'strength', 'accessory', 4);
check(
  'an authored 8-10 climbs 9-10, 10, then adds load and returns to 8-10',
  JSON.stringify(authored) === JSON.stringify(['9-10', '10', '8-10+LOAD', '9-10']),
  `got ${JSON.stringify(authored)}`
);

check(
  'the authored range survives the round trip',
  authored.includes('8-10+LOAD'),
  're-deriving the range from "10" fell back to the goal default, silently replacing a physiotherapist\'s 8-10 with a generic 6-8'
);

const fixed = cycle('12', 'muscle', 'accessory', 6);
check(
  'a single number gets a range to climb inside',
  fixed[1] === '9-12' && fixed[5] === '8-12+LOAD',
  `got ${JSON.stringify(fixed)}`
);

check(
  'a missed set holds everything where it is',
  nextPrescription('10', '8-10', false, ['muscle'], 'accessory')?.addLoad === false &&
    nextPrescription('10', '8-10', false, ['muscle'], 'accessory')?.reps === '10',
  'reps must not climb off the back of a set that was not finished'
);

console.log('\n[7] Clinical prescriptions are left exactly as written');

check(
  'prehab reps do not climb',
  nextPrescription('15 each side', '15 each side', true, ['muscle'], 'prehab') === null,
  '"2 x 15 each side" on a rotator cuff is a dose, not an opening bid'
);
check('neuro work does not climb', nextPrescription('5', '5', true, ['power'], 'neuro') === null, '');
check('mechanical drills do not climb', nextPrescription('8', '8', true, ['strength'], 'mechanical') === null, '');
check(
  'but main lifts and accessories do',
  nextPrescription('8-10', '8-10', true, ['strength'], 'main') !== null &&
    nextPrescription('8-10', '8-10', true, ['strength'], 'accessory') !== null,
  ''
);

console.log('\n[8] Over the whole catalogue: nothing loses work it was not paid for');

/**
 * THE INVARIANT THIS SECTION EXISTS FOR.
 *
 * Reps may only drop when the weight goes up. That is the deal double
 * progression makes, and the sections above check it on hand-written examples.
 * Hand-written examples were not enough: run against the real catalogue, the
 * first version CUT 159 of 243 countable tier-1/tier-2 prescriptions after a
 * single good session, and its worst answer turned a 500 m rowing interval into
 * an 8-12 m one.
 *
 * Two causes, both fixed and both asserted below. The parser read any leading
 * number and kept the rest as opaque text, so a distance looked like a rep
 * count. And the goal table was asked what range a single number sits in even
 * when the number was far above the table's own ceiling, which declared the
 * exercise topped out on the spot and reset it to the goal's floor.
 *
 * So this walks all 797 entries rather than a list of examples. A rule about a
 * catalogue has to be checked against the catalogue.
 */
const dbSrc = readFileSync(new URL('../lib/exercise-db.ts', import.meta.url), 'utf8');
const lifting = [];
for (const block of dbSrc.split(/\n\s*\{\s*\n/)) {
  const name = block.match(/name:\s*'((?:[^'\\]|\\.)*)'/);
  const cat = block.match(/category:\s*'(\w+)'/);
  const reps = block.match(/reps:\s*'((?:[^'\\]|\\.)*)'/);
  const load = block.match(/suggestedLoad:\s*'((?:[^'\\]|\\.)*)'/);
  if (!name || !cat || !reps) continue;
  const t = tierOf(cat[1]);
  if (t !== 'tier1' && t !== 'tier2') continue;
  lifting.push({ name: name[1], category: cat[1], reps: reps[1], load: load ? load[1] : '' });
}

check(
  'the catalogue was actually read',
  lifting.length > 300,
  `found only ${lifting.length} tier-1/tier-2 entries - the parse above has drifted from the file`
);

const unearned = [];
const countable = [];
for (const goals of [['strength'], ['muscle'], ['fat_loss'], ['rehab']]) {
  for (const e of lifting) {
    const before = parseReps(e.reps);
    if (!before) continue;
    if (goals[0] === 'strength') countable.push(e);
    const loadable = !/^bodyweight$/i.test(e.load.trim());
    const next = nextPrescription(e.reps, e.reps, true, goals, e.category, undefined, loadable);
    if (!next) continue;
    const after = parseReps(next.reps);
    if (!after) continue;
    if (after.min < before.min && !next.addLoad)
      unearned.push(`${goals[0]}: ${e.name} "${e.reps}" -> "${next.reps}"`);
  }
}

check(
  'no prescription in the catalogue loses reps without the weight going up',
  unearned.length === 0,
  `${unearned.length} do, e.g. ${unearned.slice(0, 3).join(' | ')}`
);

check(
  'and enough of the catalogue is still countable for the feature to mean anything',
  countable.length > 150,
  `only ${countable.length} parse - refusing too much is its own failure`
);

// The specific shapes that caused it, named so a future parser change is told
// exactly what it broke.
check(
  'a distance is not a rep count',
  parseReps('500 m') === null &&
    parseReps('40m') === null &&
    parseReps('30 m each side') === null &&
    parseReps('20 steps forward') === null,
  'a carry and a rowing interval are prescribed in distance for the same reason a plank is prescribed in seconds'
);
check(
  'a circuit round is not one set',
  parseReps('10 each side + 16 total') === null && parseReps('20 + 16 total + 15') === null,
  'progressing the first number and reprinting the rest verbatim describes a session nobody wrote'
);
check(
  'a complex is not a rep target to negotiate upward',
  parseReps('6 of each, unbroken') === null,
  ''
);
check(
  'a number above the goal ceiling is left exactly as the physiotherapist wrote it',
  nextPrescription('20', '20', true, ['muscle'], 'accessory') === null &&
    nextPrescription('15 each', '15 each', true, ['strength'], 'accessory') === null,
  'the goal table has no opinion about a 20-rep glute bridge, and answering anyway reset it to 8'
);
check(
  'but the case the feature was built for still works',
  nextPrescription('12', '12', true, ['muscle'], 'accessory')?.addLoad === true,
  'a 12-rep accessory sits at the top of the 8-12 muscle range, which is a sensible thing to say about it'
);

console.log(`\nrep-scheme: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
