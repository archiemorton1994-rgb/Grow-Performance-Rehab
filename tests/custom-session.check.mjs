/**
 * Contract test: what Build your own is allowed to put in a session.
 *
 * WHAT THIS FILE USED TO DO, AND WHY IT CHANGED
 * ─────────────────────────────────────────────
 * It read lib/exercise-db.ts as text and checked that `getAllPickableExercises`
 * still mentioned MAIN_LIFTS, ACCESSORIES and eighteen other collection names.
 * That was the right guard while the builder's index WAS those collections. It
 * is not any more: the index is Archie's exercise library, the nine conditioning
 * records and whatever the Restore tab prescribes, and a check counting
 * collection names in a file the builder no longer reads would have stayed green
 * for ever while saying nothing.
 *
 * Worse, it was the defect this repo keeps making — a test that pins a spelling
 * and passes while the thing it guards is wrong. So the questions are asked of
 * the running builder instead, by driving every step it has:
 *
 *  1. EVERYTHING IT OFFERS has a record on one of the three lists. Not the
 *     matched list only: the widened list, the whole block behind the All
 *     button, the flat catalogue, and what comes out the far end assembled.
 *  2. NO OFF-LIBRARY TRAIN NAME can be added, named one by one, because a
 *     count can pass while a specific movement leaks.
 *  3. A BEGINNER CANNOT ADD ABOVE-LEVEL WORK by any route.
 *  4. The wiring from the screen to the session still holds, which is the one
 *     part of the old file that was always about plumbing rather than content.
 *
 * WHY IT MATTERS. A custom session is logged, charted and progressed against
 * like any other. An exercise reachable here and nowhere else is an exercise
 * with a personal best, a history and a chart, that the app will never programme
 * and that Archie has never written a word about.
 *
 * Run:  npx tsx tests/custom-session.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { getRestoreExercises } from '../lib/exercise-db.ts';
import { CONDITIONING_EXERCISES, LIBRARY_EXERCISES } from '../lib/exercise-library.ts';
import {
  assembleSession,
  blocksForGoal,
  builderExercises,
  exercisesInCategory,
  optionsForBlock,
  ownedTiersFor,
  BUILDER_CATEGORIES,
  SESSION_FOCUSES,
  SESSION_GOALS,
} from '../lib/session-builder.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const storeSrc = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
const customSrc = readFileSync(join(__dir, '../app/custom-session.tsx'), 'utf8');
const sessionSrc = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');

let failures = 0;
let total = 0;

function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// ─── The three lists, and the whole of what the builder may serve ────────────

/** Where a name comes from, or undefined if it comes from nowhere Archie owns. */
const SOURCE = new Map();
for (const e of LIBRARY_EXERCISES) SOURCE.set(e.name.toLowerCase(), 'library');
for (const e of CONDITIONING_EXERCISES)
  if (!SOURCE.has(e.name.toLowerCase())) SOURCE.set(e.name.toLowerCase(), 'conditioning');
for (const e of getRestoreExercises())
  if (!SOURCE.has(e.name.toLowerCase())) SOURCE.set(e.name.toLowerCase(), 'restore');

const LEVEL = new Map(LIBRARY_EXERCISES.map((e) => [e.name.toLowerCase(), e.level]));

/**
 * The kits somebody can actually have, as the five tiles they tick.
 *
 * 'bench' is included on its own because it is the one tile that is neither
 * bodyweight nor a gym: it unlocks a third of the library's pressing work.
 */
const KITS = [
  ['no equipment', ['bodyweight'], 'bodyweight'],
  ['bands', ['bodyweight', 'bands'], 'bodyweight'],
  ['a bench', ['bodyweight', 'bench'], 'bodyweight'],
  ['dumbbells', ['bodyweight', 'dumbbells'], 'dumbbells'],
  ['kettlebells', ['bodyweight', 'kettlebells'], 'dumbbells'],
  ['a full gym', ['fullgym'], 'fullgym'],
];

/**
 * Every exercise the builder can put in front of anybody, measured rather than
 * assumed: four levels by six kits by three goals by four focuses, and for each
 * step both the list it shows and the whole block behind the All button.
 */
function sweep() {
  const seen = new Map();
  let steps = 0;
  const note = (t, where, ceiling) => {
    const key = t.name.toLowerCase();
    if (!seen.has(key)) seen.set(key, { name: t.name, where, ceiling });
  };
  for (const ceiling of [1, 2, 3, 4]) {
    for (const [, kit, tier] of KITS) {
      const owned = ownedTiersFor(tier);
      // The flat catalogue behind "Browse the full catalogue instead".
      for (const e of builderExercises(ceiling, kit)) note(e.template, 'catalogue', ceiling);
      for (const { key: goal } of SESSION_GOALS) {
        const blocks = blocksForGoal(goal);
        const kpiBlock = blocks.find((b) => b.id === 'kpi');
        for (const { key: focus } of SESSION_FOCUSES) {
          const kpi =
            optionsForBlock(kpiBlock, { focus, kpi: null, ceiling }, owned, new Set(), kit)
              .options[0] ?? null;
          const picks = {};
          for (const block of blocks) {
            const { options, all } = optionsForBlock(
              block,
              { focus, kpi, ceiling },
              owned,
              new Set(),
              kit
            );
            steps++;
            for (const t of options) note(t, `${goal}/${focus}/${block.id}`, ceiling);
            for (const t of all) note(t, `${goal}/${focus}/${block.id} (all)`, ceiling);
            picks[block.id] = options
              .slice(0, block.picks)
              .map((t) => ({ template: t, sets: t.sets, reps: t.reps }));
          }
          // And what actually comes out the far end, prescribed.
          for (const e of assembleSession(goal, picks, 3)) {
            note({ name: e.name }, `${goal}/${focus} assembled`, ceiling);
          }
        }
      }
    }
  }
  return { seen, steps };
}

const { seen: OFFERED, steps: STEPS } = sweep();

// ─── 1. Everything on offer is on one of the three lists ─────────────────────
console.log('\n[1] Build your own serves the library, the nine finishers and Restore');

const strangers = [...OFFERED.values()].filter((e) => !SOURCE.has(e.name.toLowerCase()));
check(
  `${STEPS} steps offer ${OFFERED.size} distinct exercises, and every one has a record`,
  strangers.length === 0,
  strangers
    .slice(0, 10)
    .map((e) => `${e.name} (${e.where})`)
    .join(', ')
);

// Non-vacuity: a sweep that offered nothing would pass the check above.
check(
  'and the sweep actually walked the whole builder',
  OFFERED.size > 200 && STEPS > 500,
  `${OFFERED.size} exercises across ${STEPS} steps`
);

// The category listings behind the browse rail are the same universe.
const strayCategories = [];
for (const category of BUILDER_CATEGORIES) {
  for (const t of exercisesInCategory(category)) {
    if (!SOURCE.has(t.name.toLowerCase())) strayCategories.push(`${category}/${t.name}`);
  }
}
check(
  'every category listing holds only records too',
  strayCategories.length === 0,
  strayCategories.slice(0, 8).join(', ')
);

// ─── 2. Named Train movements cannot be added any more ───────────────────────
console.log('\n[2] No off-library Train movement can be put in a session');

/**
 * Movements that WERE reachable here and are on no list of Archie's.
 *
 * Named one at a time because a count can pass while a specific movement leaks,
 * and because these are the ones that would hurt: a Leg Press and a Lying Leg
 * Curl are machines the library deliberately does not use, a DB Bicep Curl is
 * isolation work the library has none of, and a Back Squat is the old
 * catalogue's own name for a movement the library spells Barbell Back Squat —
 * so leaking it would split one lift's history across two names.
 */
const OFF_LIBRARY = [
  'Back Squat',
  'Barbell Bench Press',
  'Pull-Up',
  'Goblet Squat',
  'Romanian Deadlift',
  'Overhead Press',
  'Lat Pulldown',
  'Leg Press',
  'Leg Extension',
  'Lying Leg Curl',
  'DB Bicep Curl',
  'Close-Grip Bench Press',
  'Med Ball Overhead Slam',
  'Box Jump (Step-Down)',
  'Cossack Squat Flow',
  "World's Greatest Stretch",
  'Assault Bike Warm-Up',
  'Rowing Machine Warm-Up',
  'Farmers Carry',
  'Sled Drag',
];

const leaked = OFF_LIBRARY.filter((n) => OFFERED.has(n.toLowerCase()));
check(
  `none of the ${OFF_LIBRARY.length} named Train movements is reachable`,
  leaked.length === 0,
  leaked.map((n) => `${n} via ${OFFERED.get(n.toLowerCase()).where}`).join(', ')
);

// And the list is a list of real movements, not of typos that could never leak.
const notReal = OFF_LIBRARY.filter((n) => SOURCE.has(n.toLowerCase()));
check(
  'and none of them is secretly a library record under another spelling',
  notReal.length === 0,
  notReal.join(', ')
);

// The self-logging cardio tiles are the one thing on this screen that is not
// drawn from the index, so they are named here too. Three are conditioning
// records; the fourth is the blank one somebody logs their own run into.
const tiles = [...customSrc.matchAll(/^\s*name: '([^']+)',$/gm)].map((m) => m[1]);
const cardioTiles = tiles.filter((n) => n !== 'Other Cardio');
check(
  `every cardio tile is a conditioning record (${cardioTiles.join(', ')})`,
  cardioTiles.length >= 3 &&
    cardioTiles.every((n) =>
      CONDITIONING_EXERCISES.some((e) => e.name.toLowerCase() === n.toLowerCase())
    ),
  cardioTiles
    .filter((n) => !CONDITIONING_EXERCISES.some((e) => e.name.toLowerCase() === n.toLowerCase()))
    .join(', ')
);

// ─── 3. A beginner cannot add work above their level ─────────────────────────
console.log('\n[3] Nobody is offered a rung they have not reached');

for (const ceiling of [1, 2, 3]) {
  const above = [];
  for (const [label, kit, tier] of KITS) {
    const owned = ownedTiersFor(tier);
    for (const e of builderExercises(ceiling, kit)) {
      const level = LEVEL.get(e.template.name.toLowerCase());
      if (level !== undefined && level > ceiling) above.push(`catalogue/${label}/${e.template.name}`);
    }
    for (const { key: goal } of SESSION_GOALS) {
      for (const { key: focus } of SESSION_FOCUSES) {
        for (const block of blocksForGoal(goal)) {
          const { options, all } = optionsForBlock(
            block,
            { focus, kpi: null, ceiling },
            owned,
            new Set(),
            kit
          );
          for (const t of [...options, ...all]) {
            const level = LEVEL.get(t.name.toLowerCase());
            if (level !== undefined && level > ceiling) {
              above.push(`${label}/${goal}/${focus}/${block.id}/${t.name}(L${level})`);
            }
          }
        }
      }
    }
  }
  check(
    `at level ${ceiling}, nothing above level ${ceiling} is reachable by any route`,
    above.length === 0,
    [...new Set(above)].slice(0, 8).join(', ')
  );
}

// Non-vacuity: the ceiling has to be removing something, or the three checks
// above are satisfied by a filter that does nothing.
const beginnerCatalogue = builderExercises(1, ['fullgym']).length;
const athleteCatalogue = builderExercises(4, ['fullgym']).length;
check(
  `a beginner's catalogue is smaller than an athlete's (${beginnerCatalogue} vs ${athleteCatalogue})`,
  beginnerCatalogue < athleteCatalogue && beginnerCatalogue > 100,
  ''
);

// And the hardest thing in the library really is out of a beginner's reach.
const beginnerNames = new Set(
  builderExercises(1, ['fullgym']).map((e) => e.template.name.toLowerCase())
);
for (const name of ['Depth Jumps', 'Barbell Back Squat', 'Pull Ups', 'Reeves Deadlift']) {
  check(
    `a beginner cannot add "${name}"`,
    !beginnerNames.has(name.toLowerCase()),
    'it is in the beginner catalogue'
  );
}

// ─── 4. Ids are unique, so set logging and swaps cannot cross wires ──────────
console.log('\n[4] No two offerable exercises share an id');

const byId = new Map();
const idDupes = [];
for (const e of builderExercises(4, ['fullgym'])) {
  const prior = byId.get(e.template.id);
  if (prior && prior !== e.template.name) idDupes.push(`${e.template.id}: ${prior} / ${e.template.name}`);
  else byId.set(e.template.id, e.template.name);
}
check(
  `all ${byId.size} offerable exercises have an id of their own`,
  idDupes.length === 0,
  idDupes.slice(0, 6).join(', ')
);

// ─── 5. Engine bypass — a custom session generates nothing of its own ────────
console.log('\n[5] Engine bypass — the generator adds nothing to a custom session');

/**
 * THIS USED TO READ THE SOURCE, AND THAT IS WHY IT BROKE.
 *
 * It searched lib/workout-engine.ts for the literal `sessionType === 'custom'`
 * and for a `return [];` within fifty characters of it. Both are true of code
 * that does the right thing and both are false of other code that also does the
 * right thing, which is exactly what happened when the old lift-day generator
 * was deleted: the branch became the function's ordinary ending, the behaviour
 * did not change by one card, and the check failed anyway.
 *
 * So it asks the generator instead. A custom session is assembled by the user;
 * anything the engine returned for one would be pushed in alongside their picks
 * or on top of them. The answer has to be nothing, whatever the readiness
 * answers, whatever the kit, and whether or not something is sore - a sore
 * shoulder must not quietly add a rehab card to a session somebody built
 * themselves.
 */
const { generateWorkout } = await import('../lib/workout-engine.ts');
const customGenerated = [];
for (const tier of ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym']) {
  for (const timeAvailable of ['30', '45', '60']) {
    for (const energy of ['low', 'normal', 'high']) {
      for (const painRegion of [null, 'knee', 'front_shoulder']) {
        for (const seed of [0, 1, 5, 12]) {
          const out = generateWorkout(
            'custom',
            tier,
            {
              hasAches: !!painRegion,
              energy,
              timeAvailable,
              painRegion,
              painSeverity: painRegion ? 'moderate' : undefined,
              acute: !!painRegion,
            },
            { experienceLevel: 'intermediate', goals: ['muscle'], equipmentTiers: [tier] },
            undefined,
            undefined,
            seed
          );
          if (out.length > 0) {
            customGenerated.push(
              `${tier}/${timeAvailable}/${energy}/${painRegion ?? 'nothing sore'}/n=${seed}: ${out
                .map((e) => e.name)
                .join(', ')}`
            );
          }
        }
      }
    }
  }
}
check(
  'a custom session comes back empty from every set of answers (540 asked)',
  customGenerated.length === 0,
  `${customGenerated.length} generated something, e.g. ${customGenerated.slice(0, 2).join(' / ')}`
);

// ─── 6. Store contract — pendingCustomExercises + setPendingCustomExercises ───
console.log('\n[6] Store contract — the store carries the picks to the session screen');

check(
  'store.ts declares pendingCustomExercises field',
  storeSrc.includes('pendingCustomExercises'),
  'field missing — custom-session.tsx cannot hand exercises to session.tsx'
);

check(
  'store.ts declares setPendingCustomExercises action',
  storeSrc.includes('setPendingCustomExercises'),
  'action missing — custom-session.tsx cannot save selected exercises to the store'
);

// ─── 7. Picker wiring — the screen reads the builder's index, not the database ─
console.log("\n[7] Picker wiring — the screen's pool is the builder's index");

/**
 * Source-read, and disclosed as such.
 *
 * app/custom-session.tsx is a React screen these checks cannot run, so the last
 * few centimetres between the index and the list on screen are read rather than
 * driven. Everything above this line is measured by running the real code.
 */
check(
  'custom-session.tsx builds its pool from builderExercises',
  /builderExercises\(ceiling, userKit\)/.test(customSrc),
  'the screen is not reading the builder index — it may be back on the whole database'
);

check(
  'and it no longer reads the whole exercise database',
  !customSrc.includes('getAllPickableExercises'),
  'getAllPickableExercises is back in the screen, so every Train movement is pickable again'
);

check(
  'the level ceiling comes from the profile, the way Train works it out',
  /levelCeilingFor\(userProfile\)/.test(customSrc),
  'the screen is not asking for a ceiling, so every rung is on offer to everybody'
);

check(
  'and the ceiling is carried into every step',
  (customSrc.match(/ceiling\b/g) ?? []).length >= 6 && /kpi: kpiTemplate, ceiling/.test(customSrc),
  'the steps are not being given the ceiling'
);

check(
  'custom-session.tsx calls setPendingCustomExercises before navigating to /session',
  customSrc.includes('setPendingCustomExercises('),
  'call site not found — selected exercises never reach the session screen'
);

check(
  "custom-session.tsx navigates to /session with sessionType: 'custom'",
  customSrc.includes("sessionType: 'custom'"),
  "navigation missing 'custom' sessionType — session screen receives wrong type"
);

// ─── 8. Session wiring — session.tsx reads pendingCustomExercises from store ──
console.log('\n[8] Session wiring — session.tsx reads the picks back');

check(
  'session.tsx references pendingCustomExercises',
  sessionSrc.includes('pendingCustomExercises'),
  'reference not found — custom exercises are saved to the store but never loaded'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`custom-session: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`custom-session: all ${total} checks passed\n`);
  process.exitCode = 0;
}
