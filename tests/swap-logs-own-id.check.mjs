/**
 * Contract test: a swapped exercise records progress under its own name.
 *
 * WHAT WENT WRONG
 * ───────────────
 * The swap button changed what the card SAID and not what it was. Somebody
 * whose squat rack was taken tapped "Goblet Squat", did five sets at 24 kg, and
 * every one of those sets was filed against the BACK SQUAT: the id never moved,
 * because the card only ever replaced the name, the cue and the load text.
 *
 * Three things went wrong at once, and none of them said anything on screen.
 *
 *   The anchor. Next session's barbell squat was built from 24 kg, because
 *   that is the heaviest weight "the back squat" had on file.
 *
 *   The history. The goblet squat had none. It could be done every week for a
 *   year and never appear in the progress chart, the muscle map or the
 *   previous-best line, because nothing was ever written under its name.
 *
 *   The card. It then showed the back squat's personal best above a goblet
 *   squat, so the one number on screen was measuring today against a lift
 *   nobody was doing.
 *
 * It goes the other way too: a swap that is HARDER than the exercise it
 * replaced pushed the original's anchor up to a weight it had never been lifted
 * at, and the next session prescribed that.
 *
 * WHAT THIS ASSERTS, BY RUNNING THE REAL CODE
 * ───────────────────────────────────────────
 *   [1] Every alternative a real session offers is a real record, carries that
 *       record's own id, and is not something already on another card today —
 *       two cards sharing an id would write their sets on top of each other.
 *   [2] The card's identity follows the swap: swapSlotFor and loggedExerciseFor
 *       answer with the swap's id and name, and with the original's when
 *       nothing is swapped.
 *   [3] End to end: sets logged on a swapped card move the SWAP'S anchor
 *       through the real rule, and leave the original's exactly where it was.
 *   [4] The session screen is wired to both, so the two above are about the
 *       path the app actually takes.
 *
 * Run:  npx tsx tests/swap-logs-own-id.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { generateWorkout } from '../lib/workout-engine.ts';
import { loggedExerciseFor, swapSlotFor, swapProgressId } from '../lib/exercise-swaps.ts';
import { anchorsFromLogs } from '../lib/auto-regulation.ts';
import { getAllPickableExercises } from '../lib/exercise-db.ts';
import { LIBRARY_EXERCISES, CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';

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

/**
 * Every record the app can put in front of somebody, by id.
 *
 * An id can carry more than one name - the same movement is written up in
 * Archie's library and in the old catalogue under different ids, and the
 * library records answer to more than one name - so the value is a set.
 */
const namesById = new Map();
const remember = (id, name) => {
  if (!id || !name) return;
  const names = namesById.get(id);
  if (names) names.add(name.toLowerCase());
  else namesById.set(id, new Set([name.toLowerCase()]));
};
for (const p of getAllPickableExercises()) remember(p.template.id, p.template.name);
for (const r of LIBRARY_EXERCISES) remember(r.id, r.name);
for (const r of CONDITIONING_EXERCISES) remember(r.id, r.name);

const profile = {
  name: 'T',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};

const TYPES = [
  'lower_body',
  'upper_body',
  'full_body',
  'squat',
  'bench',
  'deadlift',
  'conditioning',
  'prehab',
  'flexibility',
];
/**
 * Every tier except kettlebells, which is asked for separately below.
 *
 * A kettlebell session relabels the words on the card - "Dumbbell Row" is shown
 * as "Kettlebell Row" - so the name on a swap slot is deliberately not the
 * record's name there. The id is still the record's, which is the whole point
 * of carrying it, so that tier answers the id questions and sits out the
 * name-matching one.
 */
const TIERS = ['bodyweight', 'bands', 'dumbbells', 'bench', 'fullgym'];

function build(tiers) {
  const out = [];
  for (const type of TYPES) {
    for (const tier of tiers) {
      for (const painRegion of [undefined, ['knee'], ['front_shoulder']]) {
        for (const seed of [0, 3, 7]) {
          out.push({
            type,
            tier,
            exercises: generateWorkout(
              type,
              tier,
              {
                hasAches: !!painRegion,
                painRegion,
                energy: 'normal',
                timeAvailable: '60',
              },
              profile,
              undefined,
              undefined,
              seed
            ),
          });
        }
      }
    }
  }
  return out;
}

const sessions = build(TIERS);
const kettlebellSessions = build(['kettlebells']);

// ─── 1. Every alternative is a real record, and only ever one card's ─────────
console.log('\n[1] Every alternative on offer is a record with an id of its own');

const slots = [];
for (const { type, tier, exercises } of [...sessions, ...kettlebellSessions]) {
  const idsInSession = new Set(exercises.map((e) => e.id));
  for (const card of exercises) {
    for (const [id, name] of [
      [card.swapId, card.swapName],
      [card.swap2Id, card.swap2Name],
    ]) {
      if (!name) continue;
      slots.push({ type, tier, card, id, name, idsInSession, relabelled: tier === 'kettlebells' });
    }
  }
}

check(
  'the sweep found alternatives to measure',
  slots.length > 1000,
  `only ${slots.length} swap slots across ${sessions.length + kettlebellSessions.length} sessions`
);

const withoutId = slots.filter((s) => !s.id);
check(
  'every alternative carries an id',
  withoutId.length === 0,
  `${withoutId.length} offered with no id, e.g. ${withoutId
    .slice(0, 3)
    .map((s) => `${s.type}/${s.tier}: ${s.card.name} → ${s.name}`)
    .join('; ')}`
);

const unknown = slots.filter((s) => s.id && !namesById.has(s.id));
check(
  'every id belongs to a record the app knows',
  unknown.length === 0,
  `${unknown.length} unknown, e.g. ${unknown
    .slice(0, 3)
    .map((s) => `${s.name} (${s.id})`)
    .join('; ')}`
);

/**
 * The derived key in swapProgressId is the backstop for an alternative whose
 * record could not be named. It must never be what a real session relies on:
 * a key derived from a name is stable, but it joins up with nothing else.
 */
const derived = slots.filter((s) => s.id === swapProgressId(s.name));
check(
  'no session leans on the name-derived fallback key',
  derived.length === 0,
  `${derived.length} slots fell back, e.g. ${derived
    .slice(0, 3)
    .map((s) => `${s.card.name} → ${s.name}`)
    .join('; ')}`
);

const misnamed = slots.filter(
  (s) => !s.relabelled && s.id && namesById.has(s.id) && !namesById.get(s.id).has(s.name.toLowerCase())
);
check(
  'the id is the id of the exercise the slot names',
  misnamed.length === 0,
  `${misnamed.length} disagree, e.g. ${misnamed
    .slice(0, 3)
    .map((s) => `${s.name} carries ${s.id}, which is ${[...namesById.get(s.id)].join('/')}`)
    .join('; ')}`
);

const selfSwaps = slots.filter((s) => s.id === s.card.id);
check(
  'no alternative is the exercise on the card',
  selfSwaps.length === 0,
  `${selfSwaps.length}, e.g. ${selfSwaps
    .slice(0, 3)
    .map((s) => `${s.card.name} → ${s.name} (${s.id})`)
    .join('; ')}`
);

/**
 * AND NOT SOMETHING ALREADY IN TODAY'S SESSION.
 *
 * Measured before this change: 40 slots offered a record that was already on
 * another card, under a name that card was not wearing - a lower body session
 * offered "Bodyweight Squat" behind its hinge while the main lift WAS that
 * record. Now that a swap logs as itself, taking that offer would have two
 * cards writing their sets against one id.
 */
const collisions = slots.filter((s) => s.id && s.id !== s.card.id && s.idsInSession.has(s.id));
check(
  'no alternative is an exercise already in the session',
  collisions.length === 0,
  `${collisions.length}, e.g. ${collisions
    .slice(0, 3)
    .map((s) => `${s.type}/${s.tier}: ${s.card.name} → ${s.name} (${s.id})`)
    .join('; ')}`
);

// ─── 2. The card's identity follows the swap ────────────────────────────────
console.log('\n[2] Tapping an alternative changes which exercise the card IS');

const twoOptions = slots
  .map((s) => s.card)
  .find((card) => card.swapName && card.swap2Name && card.swapId && card.swap2Id);

check('the sweep found a card with both alternatives filled', !!twoOptions);

if (twoOptions) {
  const original = loggedExerciseFor(twoOptions, 0);
  const first = loggedExerciseFor(twoOptions, 1);
  const second = loggedExerciseFor(twoOptions, 2);

  check(
    'nothing swapped logs the exercise the session prescribed',
    original.id === twoOptions.id && original.name === twoOptions.name,
    `got ${original.name} (${original.id})`
  );
  check(
    'the first alternative logs as itself',
    first.id === twoOptions.swapId &&
      first.id !== twoOptions.id &&
      first.name === twoOptions.swapName,
    `${twoOptions.name} (${twoOptions.id}) → ${first.name} (${first.id})`
  );
  check(
    'the second alternative logs as itself',
    second.id === twoOptions.swap2Id &&
      second.id !== twoOptions.id &&
      second.name === twoOptions.swap2Name,
    `${twoOptions.name} (${twoOptions.id}) → ${second.name} (${second.id})`
  );
  check(
    'the swapped card shows the alternative it is logging',
    swapSlotFor(twoOptions, 1)?.name === twoOptions.swapName &&
      swapSlotFor(twoOptions, 0) === null,
    'what is shown and what is logged must be the same exercise'
  );
}

// ─── 3. The weight moves with the exercise that was actually done ───────────
console.log('\n[3] Sets logged on a swapped card move the swap, not the original');

const swapped = slots.find((s) => s.id && s.card.category !== 'cooldown');
check('the sweep found a loaded card with an alternative', !!swapped);

if (swapped) {
  const card = swapped.card;
  const ORIGINAL_ANCHOR = 100;
  const LOGGED_KG = 40;
  const anchorsOnFile = { [card.id]: ORIGINAL_ANCHOR };

  // Three sets done at 40 kg on the card, with the first alternative live -
  // exactly what the session screen writes when the user has tapped swap.
  const doneSets = [1, 2, 3].map((n) => ({
    setNumber: n,
    weight: LOGGED_KG,
    reps: 8,
    completed: true,
  }));
  const logged = loggedExerciseFor(card, 1);
  const anchors = anchorsFromLogs(
    [{ exerciseId: logged.id, sets: doneSets, feedbackRating: null }],
    anchorsOnFile
  );

  check(
    'the swap gets the weight that was lifted',
    anchors[logged.id] === LOGGED_KG,
    `${logged.name} (${logged.id}) came back as ${anchors[logged.id]}`
  );
  check(
    "the original's anchor is not touched",
    anchors[card.id] === undefined && anchorsOnFile[card.id] === ORIGINAL_ANCHOR,
    `${card.name} (${card.id}) was filed ${anchors[card.id]} off a session it was not in`
  );
  check(
    'the history is written under the swap, not the exercise it replaced',
    logged.name === card.swapName && logged.name !== card.name,
    `logged as ${logged.name}`
  );

  // And the same card with nothing swapped still moves its own anchor, so the
  // rule above is about the swap rather than about everything falling through.
  const untouched = anchorsFromLogs(
    [{ exerciseId: loggedExerciseFor(card, 0).id, sets: doneSets, feedbackRating: null }],
    anchorsOnFile
  );
  check(
    'an unswapped card still moves the exercise it was built with',
    untouched[card.id] === ORIGINAL_ANCHOR,
    `got ${untouched[card.id]} — a lighter session must not drag the anchor down either`
  );
}

// ─── 4. The session screen takes this path ──────────────────────────────────
console.log('\n[4] The session screen is wired to both rules');

/**
 * A WIRING CHECK, NOT A BEHAVIOUR ONE.
 *
 * Everything above runs the real functions; this is the one thing that cannot
 * be run, because the session screen is a React component. It asks only that
 * the screen goes through those functions, so that what was measured above is
 * the path the app actually takes.
 */
const src = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');

check(
  'the log is keyed by loggedExerciseFor',
  /const logged = loggedExerciseFor\(/.test(src) && /exerciseId: logged\.id/.test(src),
  'writing ex.id straight in is the bug this file exists to close'
);
check(
  'the card shows what loggedExerciseFor will log',
  /const slot = swapSlotFor\(exercise, swapCount\)/.test(src),
  'the card and the log must resolve the swap the same way'
);
check(
  'the anchors are filed through anchorsFromLogs',
  /anchorsFromLogs\(exerciseLogs, lastLoggedWeights\)/.test(src),
  'a second copy of the rule in the screen is a second copy to go stale'
);

console.log('');
if (failures > 0) {
  console.error(`swap-logs-own-id: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`swap-logs-own-id: all ${total} checks passed\n`);
  process.exitCode = 0;
}
