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
 * Run:  npx tsx tests/session-builder.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises } from '../lib/exercise-db.ts';
import { bodyRegionOf } from '../lib/exercise-safety.ts';
import { patternGroupOf } from '../lib/exercise-classification.ts';
import {
  assembleSession,
  blocksForGoal,
  builderCategoryOf,
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

const all = getAllPickableExercises();
const byName = new Map(all.map((p) => [p.template.name.toLowerCase(), p.template]));
const get = (n) => byName.get(n.toLowerCase());

// ─── 1. Every exercise lands in a category ───────────────────────────────────
console.log('\n[1] The whole catalogue is categorised, with nothing left over');

const uncategorised = all.filter((p) => !BUILDER_CATEGORIES.includes(builderCategoryOf(p.template)));
check(
  `all ${all.length} pickable exercises have a builder category`,
  uncategorised.length === 0,
  uncategorised
    .slice(0, 5)
    .map((p) => p.template.name)
    .join(', ')
);

const counts = Object.fromEntries(BUILDER_CATEGORIES.map((c) => [c, 0]));
for (const p of all) counts[builderCategoryOf(p.template)]++;
const emptyCats = BUILDER_CATEGORIES.filter((c) => counts[c] === 0);
check(
  `every one of the eight categories has exercises in it (${BUILDER_CATEGORIES.map((c) => `${c}:${counts[c]}`).join(' ')})`,
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
  ['Rowing Machine Warm-Up', 'cardio'],
  ['Stationary Bike Warm-Up', 'cardio'],
  ["World's Greatest Stretch", 'active_stretch'],
  ['Doorway Chest Opener', 'active_stretch'],
  ['Goblet Squat Primer', 'activation'],
  ['Scapular Push-Up', 'activation'],
  ['Box Jump (Step-Down)', 'power'],
  ['Med Ball Overhead Slam', 'power'],
  ['Back Squat', 'kpi'],
  ['Barbell Bench Press', 'kpi'],
  ['DB Bicep Curl', 'accessory'],
  ['Leg Extension', 'accessory'],
  ['Dead Bug', 'core_prehab'],
  ['Banded Clamshell', 'core_prehab'],
  ['Sled Push', 'conditioning'],
  ['Farmers Carry', 'conditioning'],
];
for (const [name, expected] of EXPECTED) {
  const t = get(name);
  check(
    `"${name}" is ${expected}`,
    !!t && builderCategoryOf(t) === expected,
    t ? `got ${builderCategoryOf(t)}` : 'not in the catalogue'
  );
}

// The spec names clamshells and banded hip circles as activation work. They are
// filed as prehab in the database, which is also correct — so they have to be
// offerable in both places or one of the two steps is wrong.
for (const name of ['Banded Clamshell', 'Lateral Band Walk', 'Banded Hip Circle']) {
  const t = get(name);
  check(
    `"${name}" can be offered as activation`,
    !!t && builderRolesOf(t).includes('activation'),
    t ? builderRolesOf(t).join(', ') : 'not in the catalogue'
  );
}

// A compound is a KPI lift and an accessory both. Someone doing a squat session
// with a leg press second is not doing two main lifts.
const goblet = get('Goblet Squat');
check(
  'a compound can fill either the KPI or an accessory slot',
  !!goblet && builderRolesOf(goblet).includes('kpi') && builderRolesOf(goblet).includes('accessory'),
  goblet ? builderRolesOf(goblet).join(', ') : ''
);

// Two exercises are filed as category 'main' and are not compounds. Trusting
// the field would offer both as the lift a session is built around.
for (const name of ['Lying Leg Curl', 'Pallof Press']) {
  const t = get(name);
  check(`"${name}" is not offered as a KPI lift`, !!t && builderCategoryOf(t) !== 'kpi', '');
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
  ['Back Squat', 'lower'],
  ['Barbell Deadlift', 'lower'],
  ['Goblet Squat', 'lower'],
  ['Romanian Deadlift', 'lower'],
  ['Bodyweight Squat', 'lower'],
  ['Barbell Bench Press', 'push'],
  ['Overhead Press', 'push'],
  ['Push-Up', 'push'],
  ['Pull-Up', 'pull'],
  ['Barbell Row', 'pull'],
  ['DB Bent-Over Row', 'pull'],
];
const TIERS = ['bodyweight', 'dumbbells', 'fullgym'];

let emptySteps = [];
let thinSteps = [];
for (const tier of TIERS) {
  const owned = ownedTiersFor(tier);
  for (const [name, focus] of KPI_SPREAD) {
    const kpi = get(name);
    if (!kpi) {
      emptySteps.push(`${name} missing from catalogue`);
      continue;
    }
    for (const goalKey of ['athletic', 'aesthetic', 'fitness']) {
      for (const block of blocksForGoal(goalKey)) {
        const { options } = optionsForBlock(block, { focus, kpi }, owned, new Set([name]));
        if (options.length === 0) emptySteps.push(`${tier}/${goalKey}/${name}/${block.id}`);
        else if (options.length < 3) thinSteps.push(`${tier}/${name}/${block.id}=${options.length}`);
      }
    }
  }
}
check(
  `every block of every goal offers at least one exercise (${TIERS.length} tiers × ${KPI_SPREAD.length} lifts)`,
  emptySteps.length === 0,
  emptySteps.slice(0, 6).join(', ')
);
check(
  'and at least three, so it reads as a choice',
  thinSteps.length === 0,
  thinSteps.slice(0, 6).join(', ')
);

// Before the KPI lift is chosen the warm-up steps run on the focus alone. Those
// have to work too — they are the first three steps every user sees.
let emptyPreKpi = [];
for (const tier of TIERS) {
  const owned = ownedTiersFor(tier);
  for (const f of SESSION_FOCUSES) {
    for (const block of blocksForGoal('athletic').slice(0, 4)) {
      const { options } = optionsForBlock(block, { focus: f.key, kpi: null }, owned, new Set());
      if (options.length === 0) emptyPreKpi.push(`${tier}/${f.key}/${block.id}`);
    }
  }
}
check(
  'the warm-up steps work before a KPI lift has been picked',
  emptyPreKpi.length === 0,
  emptyPreKpi.slice(0, 6).join(', ')
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
      const { options, widened } = optionsForBlock(block, { focus, kpi }, owned, new Set([name]));
      if (widened) continue;
      for (const t of options) {
        if (relevanceOf(block.category, t, { focus, kpi }) !== 'direct') {
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
  return optionsForBlock(block, { focus, kpi }, ownedTiersFor(tier), new Set([name])).options;
}

const benchAccessories = accessoriesFor('Barbell Bench Press', 'push');
const benchLower = benchAccessories.filter((t) => bodyRegionOf(t.primaryMuscle) === 'lower');
check(
  `bench press accessories contain no lower-body work (${benchAccessories.length} options)`,
  benchLower.length === 0,
  benchLower
    .slice(0, 5)
    .map((t) => t.name)
    .join(', ')
);

const squatAccessories = accessoriesFor('Back Squat', 'lower');
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
  ['Back Squat', 'lower', 'Leg Press'],
  ['Barbell Bench Press', 'push', 'Incline Barbell Press'],
  ['Pull-Up', 'pull', 'Barbell Bent-Over Row'],
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
    { focus: f.key, kpi: null },
    ownedTiersFor('fullgym'),
    new Set()
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
  { focus: 'lower', kpi: get('Back Squat') },
  ownedTiersFor('fullgym'),
  new Set()
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
const ctxA = { focus: 'lower', kpi: get('Back Squat') };
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
      chosen = optionsForBlock(block, { focus, kpi }, owned, taken).options.slice(0, block.picks);
    }
    picks[block.id] = chosen.map((t) => ({ template: t, sets: t.sets, reps: t.reps }));
  }
  return { picks, session: assembleSession(goalKey, picks, 3) };
}

const { picks: athPicks, session: athletic1 } = buildFull('athletic', 'lower', 'Back Squat');
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
    kpi: [{ template: get('Back Squat'), sets: 5, reps: '5' }],
    accessory: [{ template: get('Leg Press'), sets: 3, reps: '10' }],
    volume: [{ template: get('Leg Press'), sets: 3, reps: '12' }],
  },
  3
);
check(
  'the same exercise picked into two blocks appears once',
  doubled.length === 2 && doubled.filter((e) => e.name === 'Leg Press').length === 1,
  doubled.map((e) => `${e.category}:${e.name}`).join(' | ')
);

// Sets, reps and load come off the template, so a custom session prescribes
// what a generated one would for the same movement.
const kpiEntry = athletic1.find((e) => e.category === 'main');
const kpiTemplate = get('Back Squat');
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
  const { session } = buildFull('athletic', 'lower', 'Back Squat');
  const withMinutes = assembleSession('athletic', athPicks, m);
  check(
    `a ${m} minute warm-up is prescribed as "${m} min steady"`,
    withMinutes[0].reps === `${m} min steady` && withMinutes[0].sets === 1,
    `${withMinutes[0].reps} / ${session.length}`
  );
}

const aestheticSession = buildFull('aesthetic', 'push', 'Barbell Bench Press').session;
check(
  'an aesthetics build has four accessory-slot exercises and no power work',
  aestheticSession.filter((e) => e.category === 'accessory').length === 4 &&
    aestheticSession.every((e) => e.category !== 'neuro'),
  aestheticSession.map((e) => `${e.category}:${e.name}`).join(' | ')
);

const fitnessSession = buildFull('fitness', 'full', 'Goblet Squat').session;
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

const bench = get('Barbell Bench Press');
const curl = get('DB Bicep Curl');
const benchGroups = [...muscleGroupsOf(bench)];
check(
  'a bench press is chest work, not "arms"',
  benchGroups.includes('chest') && !benchGroups.includes('biceps'),
  benchGroups.join(', ')
);
check(
  'a bicep curl is not lumped in with triceps',
  [...muscleGroupsOf(curl)].includes('biceps') && ![...muscleGroupsOf(curl)].includes('triceps'),
  [...muscleGroupsOf(curl)].join(', ')
);

console.log('');
if (failures > 0) {
  console.error(`session-builder: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`session-builder: all ${total} checks passed\n`);
  process.exit(0);
}
