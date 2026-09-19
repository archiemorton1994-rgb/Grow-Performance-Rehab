/**
 * Contract test: the warm-up machine suits the session, and nobody is stuck
 * when it is occupied.
 *
 * WHAT WAS WRONG
 * ──────────────
 * Two things, and they were the same thing.
 *
 * The machine had nothing to do with the session. Both generators opened by
 * shuffling a pool of six warm-ups on the session seed and taking the first,
 * so a squat day could open on a rowing machine and a bench day on a treadmill.
 * Neither is dangerous. Both are two minutes spent warming the half of the body
 * that is about to sit still.
 *
 * And there was no way to change it. The treadmill warm-up carried no
 * alternative at all; three of the other five carried exactly one, hand-written.
 * So a user standing in front of an occupied machine could wait, or could do
 * something else and let the app record a treadmill.
 *
 * WHAT THIS ASSERTS
 * ─────────────────
 * That real generated sessions open on a machine that primes what they load;
 * that people without a gym are untouched; that the swap list always offers
 * every machine with the relevant ones first, so "both of those are taken too"
 * still has an answer; and that no route through the picker can shorten the
 * warm-up.
 *
 * The first section generates sessions rather than reading the catalogue. The
 * catalogue said the warm-up rotated daily for years while it did not.
 *
 * THE SESSIONS BUILT FROM ARCHIE'S LIBRARY OPEN DIFFERENTLY, ON PURPOSE.
 * ─────────────────────────────────────────────────────────────────────
 * A library session opens on one of the nine conditioning exercises at an easy
 * pace (plan section 1), which is a pulse raiser rather than a machine chosen
 * to prime a half of the body: two of the nine are not machines at all, and
 * Archie's list is what a session is allowed to draw on.
 *
 * ALL THREE WEEKLY TYPES ARE NOW ON THE LIBRARY, so no generated session opens
 * on a cardio machine at all. That does not retire the machine rules, it moves
 * where they are asked: the machines are still reachable, through the warm-up
 * card's own picker, and what that picker offers is decided by
 * `cardioWarmupPoolForSession` and `machinesForFocus`. So the "primes the half
 * of the body the session loads" rule is asked of the picker in sections 2 and
 * 4, where the decision is actually made, rather than of a session that no
 * longer contains a machine; the generated sessions are held to opening on
 * Archie's list instead (section 2b). Which types are on the library is read
 * from the app (LIBRARY_LIVE_TYPES) rather than listed here, so this file
 * follows the switch instead of pinning it.
 *
 * Run:  npx tsx tests/cardio-machine.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';

const { generateWorkout, LIBRARY_LIVE_TYPES } = await import('../lib/workout-engine.ts');
const { trainTypeOf } = await import('../lib/session-type.ts');
const { CONDITIONING_EXERCISES } = await import('../lib/exercise-library.ts');
const { canPerformWith } = await import('../lib/kit.ts');
const { getStandalonePrehabWorkout } = await import('../lib/exercise-db.ts');
const {
  CARDIO_MACHINES,
  CARDIO_MACHINE_IDS,
  cardioFocusForSession,
  cardioWarmupPoolForSession,
  machineById,
  machineForExerciseId,
  machinesForFocus,
  machineTemplate,
  relevantCountForFocus,
} = await import('../lib/cardio-warmup.ts');

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

const profile = {
  name: 'P',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};

/**
 * Every session's opening card.
 *
 * strengthSessionCount is the SEVENTH POSITIONAL ARGUMENT, not a field on the
 * profile. Passing it on the profile object is silently ignored, which turns a
 * seed loop into the same session generated over and over - the first draft of
 * this sweep did exactly that and reported a single machine per session type
 * with perfect confidence.
 */
const SWEPT_TYPES = ['squat', 'bench', 'deadlift', 'upper_body', 'lower_body', 'full_body'];
const SWEPT_TIERS = ['bodyweight', 'bands', 'dumbbells', 'fullgym'];
const SWEPT_TIMES = ['30', '45', '60'];
const SWEPT_SEEDS = 12;

function openings() {
  const rows = [];
  for (const sessionType of SWEPT_TYPES) {
    for (const tier of SWEPT_TIERS) {
      for (const timeAvailable of SWEPT_TIMES) {
        for (let seed = 0; seed < SWEPT_SEEDS; seed++) {
          let w;
          try {
            w = generateWorkout(
              sessionType,
              tier,
              { energy: 'normal', hasAches: false, timeAvailable },
              profile,
              undefined,
              undefined,
              seed
            );
          } catch {
            continue;
          }
          if (!w[0]) continue;
          rows.push({
            sessionType,
            tier,
            seed,
            first: w[0],
            // Which builder made it, asked of the app rather than listed here.
            library: LIBRARY_LIVE_TYPES.includes(trainTypeOf(sessionType)),
          });
        }
      }
    }
  }
  return rows;
}

const rows = openings();
/** Any row the old engine still builds. All six weekly types have left it. */
const oldEngine = rows.filter((r) => !r.library);
const fromLibrary = rows.filter((r) => r.library);
const gym = fromLibrary.filter((r) => r.tier === 'fullgym');
const home = fromLibrary.filter((r) => r.tier !== 'fullgym');

console.log('\n[1] The sessions were really generated');

check(
  `${rows.length} sessions opened, all ${fromLibrary.length} of them from the library`,
  rows.length > 500 && fromLibrary.length === rows.length,
  `${oldEngine.length} row(s) still came from the old engine (${[...new Set(oldEngine.map((r) => r.sessionType))].join(', ')}) - LIBRARY_LIVE_TYPES is ${LIBRARY_LIVE_TYPES.join(', ') || 'empty'}`
);

check(
  `and both halves of the sweep are populated (${gym.length} gym, ${home.length} home)`,
  gym.length > 0 && home.length > 0,
  'sections 2b and 3 measure nothing if either is empty'
);

check(
  'every session still opens on a warm-up',
  rows.every((r) => r.first.category === 'prep'),
  'the opening card must remain the warm-up, whatever it is'
);

console.log('\n[2] The machine primes the half of the body the session loads');

const LOWER = new Set(
  CARDIO_MACHINES.filter((m) => m.primes === 'lower').map((m) => `cardio-machine-${m.id}`)
);
const UPPER = new Set(
  CARDIO_MACHINES.filter((m) => m.primes === 'upper').map((m) => `cardio-machine-${m.id}`)
);

/**
 * THE RULE MOVED TO THE PICKER, BECAUSE THAT IS WHERE THE CHOICE IS MADE NOW.
 *
 * No generated session contains a machine any more, so asking "does this gym
 * day open on the right machine" would sweep an empty list and pass for ever.
 * The machines are still offered: the warm-up card's picker draws on
 * `cardioWarmupPoolForSession`, which is the same function the old generator
 * picked from. So the promise is asked of it directly, per session type,
 * through `cardioFocusForSession` rather than by naming leg days and pressing
 * days, and a type whose focus is 'both' has no wrong machine to offer.
 */
const FOCUS_MACHINES = { lower: LOWER, upper: UPPER };
const misprimed = [];
for (const sessionType of SWEPT_TYPES) {
  const suits = FOCUS_MACHINES[cardioFocusForSession(sessionType)];
  if (!suits) continue;
  for (const tpl of cardioWarmupPoolForSession(sessionType)) {
    if (!suits.has(tpl.id)) misprimed.push(`${sessionType} would offer ${tpl.name}`);
  }
}
check(
  `every session type offers only machines that prime what it loads (${SWEPT_TYPES.length} types)`,
  misprimed.length === 0,
  misprimed.slice(0, 3).join('; ')
);

/**
 * More than one machine per session type.
 *
 * Not decoration. A single fixed machine per session type is what the old code
 * effectively did, and the comment in the catalogue claimed otherwise for
 * years. If this ever drops to one, somebody standing in front of an occupied
 * rower has nowhere to go.
 */
for (const sessionType of SWEPT_TYPES) {
  const pool = cardioWarmupPoolForSession(sessionType);
  check(
    `${sessionType} offers more than one machine rather than always naming one`,
    new Set(pool.map((tpl) => tpl.id)).size >= 2,
    `only ever offers: ${pool.map((tpl) => tpl.name).join(', ') || 'nothing'}`
  );
}

check(
  'and no generated session opens on a machine any more',
  rows.every((r) => !CARDIO_MACHINE_IDS.includes(r.first.id)),
  rows
    .filter((r) => CARDIO_MACHINE_IDS.includes(r.first.id))
    .slice(0, 3)
    .map((r) => `${r.sessionType}/${r.tier} opened on ${r.first.name}`)
    .join('; ')
);

console.log('\n[2b] A library session opens on one of the nine, at an easy pace');

const conditioningByName = new Map(CONDITIONING_EXERCISES.map((e) => [e.name, e]));
/** The one thing that stands in when nothing on the nine fits: Restore's walk. */
const restorePrep = new Set(
  getStandalonePrehabWorkout()
    .filter((t) => t.category === 'prep')
    .map((t) => t.name)
);

const offTheList = fromLibrary.filter(
  (r) => !conditioningByName.has(r.first.name) && !restorePrep.has(r.first.name)
);
check(
  `every library session opens on the conditioning list or Restore (${fromLibrary.length} checked)`,
  fromLibrary.length > 0 && offTheList.length === 0,
  offTheList
    .slice(0, 3)
    .map((r) => `${r.sessionType}/${r.tier} opened on ${r.first.name}`)
    .join('; ')
);

const notEasy = fromLibrary.filter(
  (r) => conditioningByName.has(r.first.name) && r.first.suggestedLoad !== 'Easy pace'
);
check(
  'and it is prescribed as a pulse raiser rather than as work',
  notEasy.length === 0,
  notEasy
    .slice(0, 3)
    .map((r) => `${r.sessionType}/${r.tier}: ${r.first.name} at ${r.first.suggestedLoad}`)
    .join('; ')
);

/**
 * The honesty rule this file already holds for the old engine, asked of the
 * new one: a machine is gym kit, so nobody at home is opened on one. Asked of
 * the record's own kit requirement rather than of a list of machine names, so
 * it covers the sled as well as the rower.
 */
const unownedOpener = fromLibrary.filter((r) => {
  const record = conditioningByName.get(r.first.name);
  return record ? !canPerformWith(record, [r.tier]) : false;
});
check(
  'and never on kit they have not got',
  unownedOpener.length === 0,
  unownedOpener
    .slice(0, 3)
    .map((r) => `${r.tier} was given ${r.first.name}`)
    .join('; ')
);

console.log('\n[3] Nothing changed for somebody without a gym');

check(
  `a home session never opens on a machine (${home.length} checked)`,
  home.length > 0 && home.every((r) => !CARDIO_MACHINE_IDS.includes(r.first.id)),
  home
    .filter((r) => CARDIO_MACHINE_IDS.includes(r.first.id))
    .slice(0, 3)
    .map((r) => `${r.tier} was given ${r.first.name}`)
    .join('; ')
);

/**
 * Asked of the record's own kit rather than of a name regex.
 *
 * The old rule matched "march", "swing", "rope" or "skip" in the name, which
 * were the four things the old engine's home warm-ups were called. A library
 * session opens on Bear Crawl, Duck Walks or Skipping, and two of those three
 * match nothing in that list - so the rule would have gone red on a home
 * warm-up that is in fact perfectly equipment-free. `canPerformWith` answers
 * the question the rule was always asking, and it answers it for whatever
 * Archie's list holds next.
 */
const needsKitAtHome = home.filter((r) => {
  const record = conditioningByName.get(r.first.name);
  return record ? !canPerformWith(record, [r.tier]) : false;
});
check(
  'and it opens on something that needs no equipment they have not got',
  needsKitAtHome.length === 0,
  needsKitAtHome
    .slice(0, 3)
    .map((r) => `${r.tier} was given ${r.first.name} (${r.first.suggestedLoad})`)
    .join('; ')
);

console.log('\n[4] The swap list never leaves anybody stuck');

for (const sessionType of ['squat', 'bench', 'deadlift', 'full_body', 'upper_body', 'lower_body']) {
  const focus = cardioFocusForSession(sessionType);
  const ordered = machinesForFocus(focus);
  const relevant = relevantCountForFocus(focus);
  check(
    `${sessionType}: every machine is still offered`,
    ordered.length === CARDIO_MACHINES.length &&
      new Set(ordered.map((m) => m.id)).size === CARDIO_MACHINES.length,
    'filtering the list is how "both of those are taken too" becomes a dead end'
  );
  check(
    `${sessionType}: the ones that suit it come first`,
    focus === 'both' ||
      ordered.slice(0, relevant).every((m) => m.primes === focus),
    `first ${relevant}: ${ordered.slice(0, relevant).map((m) => m.id).join(', ')}`
  );
}

check(
  'the default pool only holds machines that suit the session',
  ['squat', 'lower_body'].every((t) =>
    cardioWarmupPoolForSession(t).every((tpl) => LOWER.has(tpl.id))
  ) &&
    ['bench', 'upper_body'].every((t) =>
      cardioWarmupPoolForSession(t).every((tpl) => UPPER.has(tpl.id))
    ),
  'the pool is what the generator picks from, so an irrelevant entry can be served'
);

check(
  'every machine id resolves back to its machine',
  CARDIO_MACHINE_IDS.every((id) => !!machineForExerciseId(id)) &&
    CARDIO_MACHINES.every((m) => machineById(m.id)?.id === m.id),
  'the session screen looks the current machine up by id to tick it in the picker'
);

check(
  'and a non-machine exercise resolves to nothing',
  !machineForExerciseId('cardio-warmup-3') && !machineForExerciseId('bb-bench-press'),
  'otherwise the picker would appear on cards that are not machines'
);

console.log('\n[5] Swapping cannot shorten the warm-up');

check(
  'a machine template carries whatever duration it was handed',
  CARDIO_MACHINES.every((m) => machineTemplate(m, '4 min steady').reps === '4 min steady'),
  'the duration is the prescription; the machine is not allowed to change it'
);

/**
 * Asked of the pool the picker offers, not of a generated session.
 *
 * No session opens on a machine now, so a sweep of generated cards holds none
 * of them and both of these would have gone quietly vacuous. What a person can
 * still be given is whatever is in the picker, so that is what is measured.
 */
const offered = SWEPT_TYPES.flatMap((t) => cardioWarmupPoolForSession(t));
check(
  `every machine the picker offers asks for minutes (${offered.length} checked)`,
  offered.length > 0 && offered.every((tpl) => /\d+\s*min/.test(tpl.reps)),
  'the session screen decides to draw a warm-up TIMER by matching minutes in the prescription'
);

check(
  'and every machine it offers asks for the same duration',
  new Set(offered.map((tpl) => tpl.reps)).size === 1,
  `saw: ${[...new Set(offered.map((tpl) => tpl.reps))].join(' | ')}`
);

console.log('\n[6] The picker is actually wired to the screen');

const session = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');

check(
  'the warm-up card offers the swap',
  /testID={`swap-machine-\$\{index\}`}/.test(session) && /machineSwapBtn/.test(session),
  'the button is the only way into the picker'
);

check(
  'it is only offered on a card that is actually a machine',
  /!machineForExerciseId\(exercise\.id\)\s*\n?\s*\?\s*undefined/.test(session),
  'offering a machine picker on a bodyweight warm-up is offering equipment the user does not have'
);

check(
  'choosing a machine records the choice',
  /const handleMachineChoice = useCallback/.test(session) &&
    /cardioMachine: machine/.test(session),
  'the choice has to survive the card re-rendering and the session being paused'
);

check(
  'the chosen machine is what the card then shows',
  /const machine = data\.cardioMachine \? machineById\(data\.cardioMachine\) : undefined;/.test(
    session
  ),
  'getDisplayExercise is the single place a card learns what it is showing'
);

check(
  'and choosing one does not rewrite the prescription',
  !/name: machine\.name,[\s\S]{0,200}reps:/.test(session),
  'the machine override must not set reps, or a swap could quietly shorten the warm-up'
);

console.log(`\ncardio-machine: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
