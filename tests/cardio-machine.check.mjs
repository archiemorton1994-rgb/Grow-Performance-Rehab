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
 * Run:  npx tsx tests/cardio-machine.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';

const { generateWorkout } = await import('../lib/workout-engine.ts');
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
function openings() {
  const rows = [];
  for (const sessionType of [
    'squat',
    'bench',
    'deadlift',
    'upper_body',
    'lower_body',
    'full_body',
  ]) {
    for (const tier of ['bodyweight', 'bands', 'dumbbells', 'fullgym']) {
      for (const timeAvailable of ['30', '45', '60']) {
        for (let seed = 0; seed < 12; seed++) {
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
          rows.push({ sessionType, tier, seed, first: w[0] });
        }
      }
    }
  }
  return rows;
}

const rows = openings();
const gym = rows.filter((r) => r.tier === 'fullgym');
const home = rows.filter((r) => r.tier !== 'fullgym');

console.log('\n[1] The sessions were really generated');

check(
  `${rows.length} sessions opened, ${gym.length} of them in a gym`,
  rows.length > 500 && gym.length > 100,
  'everything below measures nothing if this is small'
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

check(
  'a gym session always opens on a machine',
  gym.every((r) => CARDIO_MACHINE_IDS.includes(r.first.id)),
  gym
    .filter((r) => !CARDIO_MACHINE_IDS.includes(r.first.id))
    .slice(0, 3)
    .map((r) => `${r.sessionType} opened on ${r.first.name}`)
    .join('; ')
);

const lowerDays = gym.filter((r) => r.sessionType === 'squat' || r.sessionType === 'lower_body');
check(
  `leg days open on a leg machine (${lowerDays.length} checked)`,
  lowerDays.length > 0 && lowerDays.every((r) => LOWER.has(r.first.id)),
  lowerDays
    .filter((r) => !LOWER.has(r.first.id))
    .slice(0, 3)
    .map((r) => `${r.sessionType} opened on ${r.first.name}`)
    .join('; ')
);

const upperDays = gym.filter((r) => r.sessionType === 'bench' || r.sessionType === 'upper_body');
check(
  `pressing and pulling days open on an upper-body machine (${upperDays.length} checked)`,
  upperDays.length > 0 && upperDays.every((r) => UPPER.has(r.first.id)),
  upperDays
    .filter((r) => !UPPER.has(r.first.id))
    .slice(0, 3)
    .map((r) => `${r.sessionType} opened on ${r.first.name}`)
    .join('; ')
);

/**
 * More than one machine per session type.
 *
 * Not decoration. A single fixed machine per session type is what the old code
 * effectively did, and the comment in the catalogue claimed otherwise for
 * years. If this ever drops to one, the rotation has quietly died again.
 */
for (const type of ['squat', 'bench']) {
  const seen = new Set(gym.filter((r) => r.sessionType === type).map((r) => r.first.name));
  check(
    `${type} days rotate between machines rather than always naming one`,
    seen.size >= 2,
    `only ever saw: ${[...seen].join(', ')}`
  );
}

console.log('\n[3] Nothing changed for somebody without a gym');

check(
  'a home session never opens on a machine',
  home.every((r) => !CARDIO_MACHINE_IDS.includes(r.first.id)),
  home
    .filter((r) => CARDIO_MACHINE_IDS.includes(r.first.id))
    .slice(0, 3)
    .map((r) => `${r.tier} was given ${r.first.name}`)
    .join('; ')
);

check(
  'and it opens on something that needs no equipment',
  home.every((r) => /bodyweight/i.test(r.first.suggestedLoad) || /march|swing|rope|skip/i.test(r.first.name)),
  home
    .filter((r) => !/bodyweight/i.test(r.first.suggestedLoad) && !/march|swing|rope|skip/i.test(r.first.name))
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

check(
  'every generated machine warm-up asks for minutes',
  gym.every((r) => /\d+\s*min/.test(r.first.reps)),
  'the session screen decides to draw a warm-up TIMER by matching minutes in the prescription'
);

check(
  'and every machine in a session asks for the same duration',
  new Set(gym.map((r) => r.first.reps)).size === 1,
  `saw: ${[...new Set(gym.map((r) => r.first.reps))].join(' | ')}`
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
