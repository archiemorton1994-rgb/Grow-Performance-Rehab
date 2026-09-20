/**
 * Contract test: the guided custom-session builder.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Asked for: "replace its current unorganized exercise repository with a
 * structured, step-by-step assembly line ... Filtering during each step must
 * automatically restrict the user to relevant, compatible exercises based on
 * the selected KPI lift."
 *
 * Three things have to hold for that to be true rather than merely intended:
 *
 *  1. EVERY exercise is categorised. A movement that falls through the rules
 *     does not appear in any step, and the failure is silent — the user simply
 *     never sees it and has no way to know it exists.
 *  2. The GOAL changes the session. If Athletic Performance and Aesthetics
 *     produce the same blocks, the first step is decoration.
 *  3. Every step offers a non-empty, relevant list, for every equipment tier.
 *     An empty step is a dead end, and a step full of the wrong exercises is
 *     the unorganised repository again with more taps in front of it.
 *
 * AND, SINCE THE INDEX BECAME THE LIBRARY'S:
 *
 *  4. The builder may offer the exercise library, the nine conditioning records
 *     and whatever the Restore tab prescribes, and nothing else. It used to be
 *     built on getAllPickableExercises, which walks every collection in
 *     exercise-db, so a session assembled here could be made entirely of
 *     movements on no list of Archie's.
 *  5. Nobody is offered work above their level, by any route — not the matched
 *     list, not the widened one, and not the whole block behind the All button.
 *
 * Run:  npx tsx tests/session-builder.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getRestoreExercises } from '../lib/exercise-db.ts';
import { CONDITIONING_EXERCISES, LIBRARY_EXERCISES } from '../lib/exercise-library.ts';
import { canPerformWith as kitAllows } from '../lib/kit.ts';
import { bodyRegionOf } from '../lib/exercise-safety.ts';
import { patternGroupOf } from '../lib/exercise-classification.ts';
import {
  assembleSession,
  blocksForGoal,
  builderCategoryOf,
  builderExercises,
  builderRolesOf,
  muscleGroupsOf,
  optionsForBlock,
  ownedTiersFor,
  relevanceOf,
  BUILDER_CATEGORIES,
  CARDIO_MINUTES,
  SESSION_FOCUSES,
  SESSION_GOALS,
} from '../lib/session-builder.ts';

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
 * The whole index, as seen by somebody at the top rung with a full gym.
 *
 * Every fixture below is drawn from here rather than from the database, so a
 * name that leaves the library fails the check that names it instead of quietly
 * resolving to an old catalogue record that is no longer offered anywhere.
 */
const all = builderExercises(4, ['fullgym']);
const byName = new Map(all.map((p) => [p.template.name.toLowerCase(), p.template]));
const get = (n) => byName.get(n.toLowerCase());
const ALL_KIT = ['fullgym'];
const TOP = 4;

// ─── 0. The index is the library's, and only the library's ──────────────────
console.log('\n[0] Build your own draws on the library, the nine finishers and Restore');

const OWNED = new Map();
for (const e of LIBRARY_EXERCISES) OWNED.set(e.name.toLowerCase(), 'library');
for (const e of CONDITIONING_EXERCISES)
  if (!OWNED.has(e.name.toLowerCase())) OWNED.set(e.name.toLowerCase(), 'conditioning');
for (const e of getRestoreExercises())
  if (!OWNED.has(e.name.toLowerCase())) OWNED.set(e.name.toLowerCase(), 'restore');

const strangers = all.filter((p) => !OWNED.has(p.template.name.toLowerCase()));
check(
  `every one of the ${all.length} exercises in the index has a record on one of the three lists`,
  strangers.length === 0,
  strangers
    .slice(0, 8)
    .map((p) => p.template.name)
    .join(', ')
);

const sources = {};
for (const p of all) {
  const from = OWNED.get(p.template.name.toLowerCase());
  sources[from] = (sources[from] ?? 0) + 1;
}
check(
  `and all three are represented (${Object.entries(sources)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ')})`,
  sources.library > 0 && sources.conditioning > 0 && sources.restore > 0,
  ''
);

// The nine finishers are the whole of Archie's conditioning list, so every one
// of them has to be reachable. Losing one is silent: the step still fills.
const conditioningMissing = CONDITIONING_EXERCISES.filter(
  (e) => !byName.has(e.name.toLowerCase())
);
check(
  'all nine conditioning records are in the index',
  CONDITIONING_EXERCISES.length === 9 && conditioningMissing.length === 0,
  conditioningMissing.map((e) => e.name).join(', ')
);

// ─── 1. Every exercise lands in a category ───────────────────────────────────
console.log('\n[1] The whole index is categorised, with nothing left over');

const uncategorised = all.filter((p) => !BUILDER_CATEGORIES.includes(builderCategoryOf(p.template)));
check(
  `all ${all.length} pickable exercises have a builder category`,
  uncategorised.length === 0,
  uncategorised
    .slice(0, 5)
    .map((p) => p.template.name)
    .join(', ')
);

/**
 * Counted by ROLE, which is what a step actually draws on.
 *
 * `optionsForBlock` filters on `builderRolesOf`, not on the primary category,
 * and the two genuinely differ now: no record in the three lists is filed as
 * activation first — the activation step is built out of Restore's prehab
 * drills, every one of which is core_prehab primary and activation as well.
 * Counting primaries would have called that step a dead end while it offers a
 * hundred and twenty drills.
 */
const counts = Object.fromEntries(BUILDER_CATEGORIES.map((c) => [c, 0]));
for (const p of all) for (const role of builderRolesOf(p.template)) counts[role]++;
const emptyCats = BUILDER_CATEGORIES.filter((c) => counts[c] === 0);
check(
  `every one of the eight categories has exercises offerable in it (${BUILDER_CATEGORIES.map((c) => `${c}:${counts[c]}`).join(' ')})`,
  emptyCats.length === 0,
  `${emptyCats.join(', ')} — a step drawing on an empty category is a dead end`
);

// Categorisation is a total function, so it cannot silently start returning
// undefined for a movement somebody adds next month.
const notAString = all.filter((p) => typeof builderCategoryOf(p.template) !== 'string');
check('categorisation never returns nothing', notAString.length === 0, '');

// Roles are a superset of the primary category — an exercise must at minimum be
// offerable in the block it is filed under.
const roleMismatch = all.filter(
  (p) => !builderRolesOf(p.template).includes(builderCategoryOf(p.template))
);
check('every exercise can be offered in its own category', roleMismatch.length === 0, '');

// ─── 2. The categories mean what they say ────────────────────────────────────
console.log('\n[2] Named exercises land where a coach would put them');

const EXPECTED = [
  ['Cardio Warm-Up (Easy Walk / Bike)', 'cardio'],
  ['Figure-4 Glute Stretch', 'active_stretch'],
  ['Legs-Up-The-Wall', 'active_stretch'],
  ['Depth Jumps', 'power'],
  ['Medball Slams', 'power'],
  ['Barbell Back Squat', 'kpi'],
  ['Dumbbell Bench Press', 'kpi'],
  ['Kettlebell Halos', 'accessory'],
  ['Wall Sit', 'accessory'],
  ['Dead Bug', 'core_prehab'],
  ['Banded Clamshell', 'core_prehab'],
  ['Plank', 'core_prehab'],
  ['Sled Push', 'conditioning'],
  ['Dumbbell Farmers Carry', 'conditioning'],
];
for (const [name, expected] of EXPECTED) {
  const t = get(name);
  check(
    `"${name}" is ${expected}`,
    !!t && builderCategoryOf(t) === expected,
    t ? `got ${builderCategoryOf(t)}` : 'not in the index'
  );
}

/**
 * The nine finishers are the warm-up step as well as the conditioning one.
 *
 * They are all filed `category: 'cardio'`, which the derivation alone read as
 * "this is a warm-up", so the Conditioning step could not reach a single one of
 * Archie's nine. The library's own `role` decides now — and the warm-up step
 * still needs them, because without them it holds one Restore walk.
 */
for (const name of ['Assault Bike', 'Rowing Machine', 'Skipping', 'Bear Crawl']) {
  const t = get(name);
  check(
    `"${name}" is conditioning, and can also be offered as a warm-up`,
    !!t && builderCategoryOf(t) === 'conditioning' && builderRolesOf(t).includes('cardio'),
    t ? builderRolesOf(t).join(', ') : 'not in the index'
  );
}

// The spec names clamshells and banded walks as activation work. They are
// filed as prehab in the database, which is also correct — so they have to be
// offerable in both places or one of the two steps is wrong.
for (const name of ['Banded Clamshell', 'Lateral Band Walk', 'Prone Y Raise']) {
  const t = get(name);
  check(
    `"${name}" can be offered as activation`,
    !!t && builderRolesOf(t).includes('activation'),
    t ? builderRolesOf(t).join(', ') : 'not in the index'
  );
}

// A compound is a KPI lift and an accessory both. Someone doing a squat session
// with a split squat second is not doing two main lifts.
const goblet = get('Kettlebell Goblet Squats');
check(
  'a compound can fill either the KPI or an accessory slot',
  !!goblet && builderRolesOf(goblet).includes('kpi') && builderRolesOf(goblet).includes('accessory'),
  goblet ? builderRolesOf(goblet).join(', ') : ''
);

/**
 * Support work stays support work, whatever the movement rules make of it.
 *
 * A Wall Sit and a Glute Bridge are both loaded enough for canBeMainLift to
 * accept, and the library calls both accessories. A Curtsy Lunge the library
 * does call a main movement, and canBeMainLift refuses it. Either way, none of
 * the three may turn up as the lift a training block is built on.
 */
for (const name of ['Wall Sit', 'Glute Bridge', 'Curtsy Lunge', 'Band Pull Aparts']) {
  const t = get(name);
  check(
    `"${name}" is not offered as a main exercise`,
    !!t && !builderRolesOf(t).includes('kpi'),
    t ? builderRolesOf(t).join(', ') : 'not in the index'
  );
}

// ─── 3. The goal reconfigures the template ───────────────────────────────────
console.log('\n[3] The goal changes the session, not just the label');

const athletic = blocksForGoal('athletic').map((b) => b.id);
const aesthetic = blocksForGoal('aesthetic').map((b) => b.id);
const fitness = blocksForGoal('fitness').map((b) => b.id);

check('Athletic Performance includes the power primer', athletic.includes('power'), athletic.join(' > '));
check('Aesthetics omits the power primer', !aesthetic.includes('power'), aesthetic.join(' > '));
check(
  'Aesthetics replaces it with a second accessory block',
  aesthetic.includes('volume') && aesthetic.filter((b) => b === 'accessory' || b === 'volume').length === 2,
  aesthetic.join(' > ')
);
check('General Fitness omits the power primer too', !fitness.includes('power'), fitness.join(' > '));
check(
  'General Fitness finishes with two conditioning movements',
  blocksForGoal('fitness').find((b) => b.id === 'conditioning')?.picks === 2,
  ''
);
check(
  'the three goals are three different templates',
  new Set([athletic.join(), aesthetic.join(), fitness.join()]).size === 3,
  ''
);
check(
  'every goal keeps the three-part warm-up, in order',
  [athletic, aesthetic, fitness].every(
    (b) => b[0] === 'cardio' && b[1] === 'mobility' && b[2] === 'activation'
  ),
  ''
);
// The cardio warm-up joins the KPI lift as a block that cannot be skipped: the
// generator treats one as a safety requirement on every session it builds, and
// the session screen hands its warm-up countdown to whatever warm-up exercise
// comes first — with no cardio, that is a mobility drill being counted down for
// five minutes.
check(
  'the KPI lift and the cardio warm-up are the blocks that cannot be skipped',
  SESSION_GOALS.every((g) =>
    blocksForGoal(g.key).every((b) => (b.id === 'kpi' || b.id === 'cardio' ? !b.optional : b.optional))
  ),
  ''
);

// ─── 4. Every step offers something, for every user ──────────────────────────
console.log('\n[4] No step is ever empty, at any equipment tier');

const KPI_SPREAD = [
  ['Barbell Back Squat', 'lower'],
  ['Barbell Deadlift', 'lower'],
  ['Kettlebell Goblet Squats', 'lower'],
  ['Kettlebell Romanian Deadlift', 'lower'],
  ['Bodyweight Squats', 'lower'],
  ['Dumbbell Bench Press', 'push'],
  ['Seated Dumbbell Press', 'push'],
  ['Push Up', 'push'],
  ['Pull Ups', 'pull'],
  ['Barbell Row', 'pull'],
  ['Bent Over Dumbbell Rows', 'pull'],
];
const TIERS = ['bodyweight', 'dumbbells', 'fullgym'];

/**
 * The power step is Athlete work, and is empty below that on purpose.
 *
 * Decision 8 files every jump, throw and slam in the library at level 4, and
 * the ceiling is applied before anything widens, so the Power Primer genuinely
 * has nothing for a beginner. That is the rule working, not a dead end: the
 * step is skippable and the screen says why it is empty. Every OTHER step has
 * to keep filling at every rung, which is the thing worth guarding.
 */
let emptySteps = [];
let thinSteps = [];
let powerBelowAthlete = [];
for (const ceiling of [1, 2, 3, 4]) {
  for (const tier of TIERS) {
    const owned = ownedTiersFor(tier);
    for (const [name, focus] of KPI_SPREAD) {
      const kpi = get(name);
      if (!kpi) {
        emptySteps.push(`${name} missing from the index`);
        continue;
      }
      for (const goalKey of ['athletic', 'aesthetic', 'fitness']) {
        for (const block of blocksForGoal(goalKey)) {
          const { options } = optionsForBlock(
            block,
            { focus, kpi, ceiling },
            owned,
            new Set([name])
          );
          if (block.id === 'power') {
            if ((options.length > 0) !== (ceiling === 4)) {
              powerBelowAthlete.push(`L${ceiling}/${tier}/${options.length}`);
            }
            continue;
          }
          if (options.length === 0) emptySteps.push(`L${ceiling}/${tier}/${goalKey}/${name}/${block.id}`);
          // The main exercise step is the one that never widens: broadening it
          // would offer bench presses to somebody who warmed up their hips, and
          // it cannot reach past the ceiling for more. A beginner with no kit
          // has exactly one pressing main in the library, and one honest option
          // is the right answer there.
          else if (options.length < 3 && block.id !== 'kpi')
            thinSteps.push(`L${ceiling}/${tier}/${name}/${block.id}=${options.length}`);
        }
      }
    }
  }
}
check(
  `every block of every goal offers at least one exercise (4 levels × ${TIERS.length} tiers × ${KPI_SPREAD.length} lifts)`,
  emptySteps.length === 0,
  emptySteps.slice(0, 6).join(', ')
);
check(
  'and at least three, so it reads as a choice',
  thinSteps.length === 0,
  thinSteps.slice(0, 6).join(', ')
);
check(
  'the power primer has work at Athlete and nothing below it, which is decision 8',
  powerBelowAthlete.length === 0,
  powerBelowAthlete.slice(0, 6).join(', ')
);

// Before the KPI lift is chosen the warm-up steps run on the focus alone. Those
// have to work too — they are the first three steps every user sees.
let emptyPreKpi = [];
for (const ceiling of [1, 2, 3, 4]) {
  for (const tier of TIERS) {
    const owned = ownedTiersFor(tier);
    for (const f of SESSION_FOCUSES) {
      for (const block of blocksForGoal('athletic').slice(0, 3)) {
        const { options } = optionsForBlock(
          block,
          { focus: f.key, kpi: null, ceiling },
          owned,
          new Set()
        );
        if (options.length === 0) emptyPreKpi.push(`L${ceiling}/${tier}/${f.key}/${block.id}`);
      }
    }
  }
}
check(
  'the warm-up steps work before a KPI lift has been picked, at every level',
  emptyPreKpi.length === 0,
  emptyPreKpi.slice(0, 6).join(', ')
);

// And the step that cannot be skipped always has a lift in it, whoever you are.
let emptyKpi = [];
for (const ceiling of [1, 2, 3, 4]) {
  for (const kit of [['bodyweight'], ['bodyweight', 'bands'], ['bodyweight', 'dumbbells'], ['fullgym']]) {
    for (const f of SESSION_FOCUSES) {
      const block = blocksForGoal('athletic').find((b) => b.id === 'kpi');
      const { options } = optionsForBlock(
        block,
        { focus: f.key, kpi: null, ceiling },
        ownedTiersFor(kit.includes('fullgym') ? 'fullgym' : kit.includes('dumbbells') ? 'dumbbells' : 'bodyweight'),
        new Set(),
        kit
      );
      if (options.length === 0) emptyKpi.push(`L${ceiling}/${kit.join('+')}/${f.key}`);
    }
  }
}
check(
  'the main exercise step always offers at least one lift, at every level and kit',
  emptyKpi.length === 0,
  emptyKpi.slice(0, 8).join(', ')
);

// ─── 4b. The ceiling holds on every route out of a step ─────────────────────
console.log('\n[4b] Nobody is offered work above their level, by any route');

const levelOf = new Map(LIBRARY_EXERCISES.map((e) => [e.name.toLowerCase(), e.level]));
let aboveLevel = [];
for (const ceiling of [1, 2, 3]) {
  for (const kit of [['bodyweight'], ['bodyweight', 'dumbbells'], ['fullgym']]) {
    const owned = ownedTiersFor(kit.includes('fullgym') ? 'fullgym' : kit.includes('dumbbells') ? 'dumbbells' : 'bodyweight');
    for (const f of SESSION_FOCUSES) {
      for (const goalKey of ['athletic', 'aesthetic', 'fitness']) {
        for (const block of blocksForGoal(goalKey)) {
          const { options, all: everything } = optionsForBlock(
            block,
            { focus: f.key, kpi: null, ceiling },
            owned,
            new Set(),
            kit
          );
          for (const t of [...options, ...everything]) {
            const level = levelOf.get(t.name.toLowerCase());
            if (level !== undefined && level > ceiling) {
              aboveLevel.push(`L${ceiling}/${block.id}/${t.name}(L${level})`);
            }
          }
        }
      }
    }
  }
}
check(
  'no step, widened or not, and no "show everything" list reaches above the ceiling',
  aboveLevel.length === 0,
  [...new Set(aboveLevel)].slice(0, 8).join(', ')
);

// A beginner and an athlete do not get the same list — otherwise the ceiling
// is filtering nothing and the check above is vacuous.
const kpiBlock4b = blocksForGoal('athletic').find((b) => b.id === 'kpi');
const beginnerLifts = optionsForBlock(
  kpiBlock4b,
  { focus: 'lower', kpi: null, ceiling: 1 },
  ownedTiersFor('fullgym'),
  new Set(),
  ALL_KIT
).options.map((t) => t.name);
const athleteLifts = optionsForBlock(
  kpiBlock4b,
  { focus: 'lower', kpi: null, ceiling: TOP },
  ownedTiersFor('fullgym'),
  new Set(),
  ALL_KIT
).options.map((t) => t.name);
check(
  `a beginner sees fewer lower-body lifts than an athlete (${beginnerLifts.length} vs ${athleteLifts.length})`,
  beginnerLifts.length > 0 && athleteLifts.length > beginnerLifts.length,
  ''
);
check(
  'and the beginner is never offered the barbell back squat the athlete is',
  athleteLifts.includes('Barbell Back Squat') && !beginnerLifts.includes('Barbell Back Squat'),
  ''
);

/**
 * THE KIT RULE IS TWO-SIDED, AND ONLY ONE SIDE IS OBVIOUS.
 *
 * Every other equipment check in the repo asks whether somebody is offered work
 * they cannot do, and a stricter filter always passes it. But a library record's
 * `equipmentRequired` is a holding answer that says 'fullgym' for anything
 * needing any kit at all, so reading THAT instead of the record's own `kit` list
 * is a mistake that passes every leak check ever written while silently hiding
 * every dumbbell movement in the library from somebody holding dumbbells.
 *
 * So the catalogue is held to being exactly what lib/kit.ts says it should be:
 * every library record this kit can perform, and no other.
 */
const KIT_CASES = [
  ['no equipment', ['bodyweight']],
  ['bands', ['bodyweight', 'bands']],
  ['a bench', ['bodyweight', 'bench']],
  ['dumbbells', ['bodyweight', 'dumbbells']],
  ['kettlebells', ['bodyweight', 'kettlebells']],
  ['a full gym', ['fullgym']],
];
for (const [label, kit] of KIT_CASES) {
  const expected = LIBRARY_EXERCISES.filter((e) => kitAllows(e, kit)).map((e) => e.name);
  const offered = new Set(
    builderExercises(TOP, kit)
      .map((e) => e.template.name)
      .filter((n) => LIBRARY_EXERCISES.some((e) => e.name === n))
  );
  const missing = expected.filter((n) => !offered.has(n));
  const extra = [...offered].filter((n) => !expected.includes(n));
  check(
    `somebody with ${label} is offered exactly the ${expected.length} library records their kit allows`,
    missing.length === 0 && extra.length === 0,
    `missing ${missing.slice(0, 6).join(', ')}${extra.length ? ` | extra ${extra.slice(0, 6).join(', ')}` : ''}`
  );
}

// Leaving the ceiling out is the one mistake a caller can make silently, so the
// answer when it is missing is the Beginner rung, not the whole library.
const noCeiling = optionsForBlock(
  kpiBlock4b,
  { focus: 'lower', kpi: null },
  ownedTiersFor('fullgym'),
  new Set(),
  ALL_KIT
).options.map((t) => t.name);
check(
  'a context with no ceiling is read as Beginner, not as Athlete',
  noCeiling.join() === beginnerLifts.join(),
  `${noCeiling.length} vs ${beginnerLifts.length}`
);

// ─── 5. The lists are actually relevant ──────────────────────────────────────
console.log('\n[5] What each step offers matches the lift it was built for');

// Where the filter has not been widened, every option must be a direct match —
// otherwise "relevant" means nothing.
let notRelevant = [];
for (const tier of TIERS) {
  const owned = ownedTiersFor(tier);
  for (const [name, focus] of KPI_SPREAD) {
    const kpi = get(name);
    if (!kpi) continue;
    for (const block of blocksForGoal('aesthetic')) {
      const ctx = { focus, kpi, ceiling: TOP };
      const { options, widened } = optionsForBlock(block, ctx, owned, new Set([name]));
      if (widened) continue;
      for (const t of options) {
        if (relevanceOf(block.category, t, ctx) !== 'direct') {
          notRelevant.push(`${name}/${block.id}/${t.name}`);
        }
      }
    }
  }
}
check(
  'an un-widened step contains only direct matches',
  notRelevant.length === 0,
  notRelevant.slice(0, 6).join(', ')
);

// The concrete version of the same claim: leg work does not turn up in a bench
// press session's accessories, and chest work does not turn up in a squat's.
function accessoriesFor(name, focus, tier = 'fullgym') {
  const kpi = get(name);
  const block = blocksForGoal('athletic').find((b) => b.id === 'accessory');
  return optionsForBlock(
    block,
    { focus, kpi, ceiling: TOP },
    ownedTiersFor(tier),
    new Set([name]),
    ALL_KIT
  ).options;
}

const benchAccessories = accessoriesFor('Dumbbell Bench Press', 'push');
const benchLower = benchAccessories.filter((t) => bodyRegionOf(t.primaryMuscle) === 'lower');
check(
  `bench press accessories contain no lower-body work (${benchAccessories.length} options)`,
  benchLower.length === 0,
  benchLower
    .slice(0, 5)
    .map((t) => t.name)
    .join(', ')
);

const squatAccessories = accessoriesFor('Barbell Back Squat', 'lower');
const squatUpper = squatAccessories.filter((t) => bodyRegionOf(t.primaryMuscle) === 'upper');
check(
  `back squat accessories contain no upper-body work (${squatAccessories.length} options)`,
  squatUpper.length === 0,
  squatUpper
    .slice(0, 5)
    .map((t) => t.name)
    .join(', ')
);

// And the positive form: the obvious accessory for a lift is actually offered.
const EXPECTED_ACCESSORIES = [
  ['Barbell Back Squat', 'lower', 'Barbell Bulgarian Split Squats'],
  ['Dumbbell Bench Press', 'push', 'Incline Dumbbell Bench Press'],
  ['Pull Ups', 'pull', 'Lat Pulldowns'],
];
for (const [kpiName, focus, wanted] of EXPECTED_ACCESSORIES) {
  const list = accessoriesFor(kpiName, focus).map((t) => t.name);
  check(`"${wanted}" is offered as an accessory to "${kpiName}"`, list.includes(wanted), '');
}

// The KPI step stays inside the focus the warm-up was filtered on, so the
// session cannot quietly change what it is halfway through.
let offFocus = [];
for (const f of SESSION_FOCUSES) {
  const block = blocksForGoal('athletic').find((b) => b.id === 'kpi');
  const { options, widened } = optionsForBlock(
    block,
    { focus: f.key, kpi: null, ceiling: TOP },
    ownedTiersFor('fullgym'),
    new Set(),
    ALL_KIT
  );
  if (widened) continue;
  for (const t of options) {
    if (!f.patterns.includes(patternGroupOf(t))) offFocus.push(`${f.key}/${t.name}`);
  }
}
check('the KPI step only offers lifts in the chosen focus', offFocus.length === 0, offFocus.slice(0, 6).join(', '));

// Core and prehab work has to be aimed at what the session loaded. Shoulder
// rehab after a squat session is the "chaotic, random category list" again.
const corePrehabBlock = blocksForGoal('athletic').find((b) => b.id === 'core_prehab');
const squatPrehab = optionsForBlock(
  corePrehabBlock,
  { focus: 'lower', kpi: get('Barbell Back Squat'), ceiling: TOP },
  ownedTiersFor('fullgym'),
  new Set(),
  ALL_KIT
).options;
const wristWork = squatPrehab.filter((t) =>
  (t.targetRegions ?? []).every((r) => ['wrist', 'elbow', 'neck', 'front_shoulder'].includes(r))
);
check(
  `squat prehab is not shoulder and wrist work (${squatPrehab.length} options)`,
  wristWork.length === 0,
  wristWork
    .slice(0, 5)
    .map((t) => t.name)
    .join(', ')
);

// ─── 6. Ordering is stable ───────────────────────────────────────────────────
console.log('\n[6] The same build offers the same list twice');

const blockA = blocksForGoal('athletic').find((b) => b.id === 'accessory');
const ctxA = { focus: 'lower', kpi: get('Barbell Back Squat'), ceiling: TOP };
const first = optionsForBlock(blockA, ctxA, ownedTiersFor('fullgym'), new Set()).options.map((t) => t.id);
const second = optionsForBlock(blockA, ctxA, ownedTiersFor('fullgym'), new Set()).options.map((t) => t.id);
check('option order is deterministic', first.join() === second.join(), '');

// ─── 7. The built session looks like a generated one ─────────────────────────
console.log('\n[7] A custom session is shaped like every other session');

function buildFull(goalKey, focus, kpiName, tier = 'fullgym') {
  const owned = ownedTiersFor(tier);
  const picks = {};
  let kpi = null;
  for (const block of blocksForGoal(goalKey)) {
    const taken = new Set();
    for (const list of Object.values(picks)) for (const p of list) taken.add(p.template.name);
    let chosen;
    if (block.id === 'kpi') {
      chosen = [get(kpiName)];
      kpi = chosen[0];
    } else {
      chosen = optionsForBlock(
        block,
        { focus, kpi, ceiling: TOP },
        owned,
        taken,
        ALL_KIT
      ).options.slice(0, block.picks);
    }
    picks[block.id] = chosen.map((t) => ({ template: t, sets: t.sets, reps: t.reps }));
  }
  return { picks, session: assembleSession(goalKey, picks, 3) };
}

const { picks: athPicks, session: athletic1 } = buildFull('athletic', 'lower', 'Barbell Back Squat');
const order = athletic1.map((e) => e.category);
check(
  `an athletic build produces ${athletic1.length} exercises`,
  athletic1.length >= 9,
  athletic1.map((e) => e.name).join(', ')
);
check(
  'the block order matches a generated session: prep, mechanical, neuro, main, accessory, prehab, finisher',
  order.join(',') === 'prep,prep,prep,mechanical,neuro,main,accessory,accessory,prehab,finisher',
  order.join(',')
);

const names = athletic1.map((e) => e.name.toLowerCase());
check('nothing appears twice in one session', new Set(names).size === names.length, '');

// The steps exclude what is already picked, but the catalogue escape hatch does
// not know about the other blocks — so the same movement CAN be chosen twice,
// and the assembled session has to drop the repeat rather than prescribe a
// second helping of it under a different heading.
const doubled = assembleSession(
  'aesthetic',
  {
    kpi: [{ template: get('Barbell Back Squat'), sets: 5, reps: '5' }],
    accessory: [{ template: get('Cable Pull Through'), sets: 3, reps: '10' }],
    volume: [{ template: get('Cable Pull Through'), sets: 3, reps: '12' }],
  },
  3
);
check(
  'the same exercise picked into two blocks appears once',
  doubled.length === 2 && doubled.filter((e) => e.name === 'Cable Pull Through').length === 1,
  doubled.map((e) => `${e.category}:${e.name}`).join(' | ')
);

// Sets, reps and load come off the template, so a custom session prescribes
// what a generated one would for the same movement.
const kpiEntry = athletic1.find((e) => e.category === 'main');
const kpiTemplate = get('Barbell Back Squat');
check(
  'the KPI lift keeps the template sets, reps and load',
  kpiEntry.sets === kpiTemplate.sets &&
    kpiEntry.reps === kpiTemplate.reps &&
    kpiEntry.suggestedLoad === kpiTemplate.suggestedLoad,
  `${kpiEntry.sets}x${kpiEntry.reps} vs ${kpiTemplate.sets}x${kpiTemplate.reps}`
);

// The cardio warm-up is the one exception: its duration is the user's, and it
// has to be written where the session screen's warm-up timer reads it.
for (const m of CARDIO_MINUTES) {
  const { session } = buildFull('athletic', 'lower', 'Barbell Back Squat');
  const withMinutes = assembleSession('athletic', athPicks, m);
  check(
    `a ${m} minute warm-up is prescribed as "${m} min steady"`,
    withMinutes[0].reps === `${m} min steady` && withMinutes[0].sets === 1,
    `${withMinutes[0].reps} / ${session.length}`
  );
}

const aestheticSession = buildFull('aesthetic', 'push', 'Dumbbell Bench Press').session;
check(
  'an aesthetics build has four accessory-slot exercises and no power work',
  aestheticSession.filter((e) => e.category === 'accessory').length === 4 &&
    aestheticSession.every((e) => e.category !== 'neuro'),
  aestheticSession.map((e) => `${e.category}:${e.name}`).join(' | ')
);

const fitnessSession = buildFull('fitness', 'full', 'Kettlebell Goblet Squats').session;
check(
  'a general fitness build finishes with two conditioning movements',
  fitnessSession.filter((e) => e.category === 'finisher').length === 2,
  fitnessSession.map((e) => e.category).join(',')
);

// Skipping a block removes it and leaves the rest in order — the escape hatch
// has to produce a valid session too.
const skipped = assembleSession('athletic', { ...athPicks, power: [], core_prehab: [] }, 3);
check(
  'skipped blocks drop out without disturbing the order',
  !skipped.some((e) => e.category === 'neuro' || e.category === 'prehab') &&
    skipped.some((e) => e.category === 'main'),
  skipped.map((e) => e.category).join(',')
);

const empty = assembleSession('athletic', {}, 3);
check('an empty build produces an empty session rather than throwing', empty.length === 0, '');

// ─── 8. Muscle grouping does not over-match ──────────────────────────────────
console.log('\n[8] The muscle model is specific enough to be useful');

const bench = get('Dumbbell Bench Press');
// The library holds no isolation curl, so the same claim is made on the row
// that stands behind one: pulling work trains the biceps and pressing work
// trains the triceps, and "arms" is not a muscle group this app has.
const row = get('Bent Over Dumbbell Rows');
const benchGroups = [...muscleGroupsOf(bench)];
check(
  'a bench press is chest work, not "arms"',
  benchGroups.includes('chest') && !benchGroups.includes('biceps'),
  benchGroups.join(', ')
);
check(
  'a row is bicep work and is not lumped in with triceps',
  [...muscleGroupsOf(row)].includes('biceps') && ![...muscleGroupsOf(row)].includes('triceps'),
  [...muscleGroupsOf(row)].join(', ')
);

console.log('');
if (failures > 0) {
  console.error(`session-builder: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`session-builder: all ${total} checks passed\n`);
  process.exitCode = 0;
}
