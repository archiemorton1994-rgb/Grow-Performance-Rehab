/**
 * Guardrails found by driving the rebuilt builder as a real user.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The contract test alongside this one proves the assembly line is complete and
 * that each step offers something relevant. These are the four places where it
 * was complete and still wrong in the running app:
 *
 *  1. A user with no equipment was offered a treadmill, and got one by default.
 *     The generator has always filtered the shared warm-up pool by equipment;
 *     the builder did not, because that pool carries no equipment tiers of its
 *     own and therefore reads as available to everybody.
 *  2. Skipping the cardio warm-up handed the session screen's warm-up countdown
 *     to the first mobility drill, which counted a six-rep Cossack squat down
 *     from five minutes.
 *  3. Changing the KPI lift left the later blocks holding work chosen for the
 *     old one — a bench press session with back squats filed under "support
 *     work for the same muscles the KPI lift trains".
 *  4. Two blocks defaulted to whatever sorted first alphabetically: every
 *     session in the app finished with an Alternating Jump Lunge, and every
 *     pressing session's core and prehab slot was a light band curl.
 *  5. The same alphabetical accident came back to the main exercise step the
 *     moment the index became the library's, because the rule that fixed it
 *     ranked by the lift the OLD generator would have programmed and not one of
 *     those lifts is in the library. A beginner's default lower-body lift was
 *     Alternating Reverse Lunges. Section 4 now asserts the library's own
 *     order: a main movement, at the hardest rung that person is allowed.
 *
 * Run:  npx tsx tests/session-builder-guardrails.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { LIBRARY_EXERCISES } from '../lib/exercise-library.ts';
import { canPerformWith } from '../lib/kit.ts';
import {
  assembleSession,
  blocksForGoal,
  builderExercises,
  muscleGroupsOf,
  optionsForBlock,
  ownedTiersFor,
  refreshForKpi,
  relevanceOf,
  SESSION_GOALS,
} from '../lib/session-builder.ts';

let failures = 0;
let total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) console.log(`  [ok] ${label}`);
  else {
    console.error(`  [FAIL] ${label}${detail ? ` - ${detail}` : ''}`);
    failures++;
  }
}

const TOP = 4;
const FULL_GYM = ['fullgym'];
const all = builderExercises(TOP, FULL_GYM);
const byName = new Map(all.map((p) => [p.template.name.toLowerCase(), p.template]));
const get = (n) => byName.get(n.toLowerCase());
const levelOf = new Map(LIBRARY_EXERCISES.map((e) => [e.name.toLowerCase(), e.level]));
const roleOf = new Map(LIBRARY_EXERCISES.map((e) => [e.name.toLowerCase(), e.role]));

const blockOf = (goal, id) => blocksForGoal(goal).find((b) => b.id === id);
const pickOf = (t) => ({ template: t, sets: t.sets, reps: t.reps });

// ─── 1. Nobody is offered equipment they do not have ─────────────────────────
console.log('\n[1] Every step respects the equipment the user actually ticked');

const cardioBlock = blockOf('athletic', 'cardio');

/**
 * Asked of lib/kit.ts, which is the table the rest of the app runs on.
 *
 * The old form of this check read `equipmentRequired`, and on a library record
 * that field is a holding answer that says 'fullgym' for anything needing any
 * kit at all — so a Dumbbell Bench Press and a Barbell Back Squat carry the
 * same word. Asking the record's own `kit` list is the only version of this
 * question that still means anything.
 */
const KITS = [
  ['no equipment', ['bodyweight']],
  ['resistance bands', ['bodyweight', 'bands']],
  ['dumbbells', ['bodyweight', 'dumbbells']],
];

for (const [label, kit] of KITS) {
  const owned = ownedTiersFor(kit.includes('dumbbells') ? 'dumbbells' : 'bodyweight');
  let leaked = [];
  for (const block of blocksForGoal('athletic')) {
    const { options, all: everything } = optionsForBlock(
      block,
      { focus: 'lower', kpi: null, ceiling: TOP },
      owned,
      new Set(),
      kit
    );
    for (const t of [...options, ...everything]) {
      if (t.kit && !canPerformWith(t, kit)) leaked.push(`${block.id}/${t.name}`);
    }
  }
  check(
    `somebody with ${label} is never offered work they cannot do`,
    leaked.length === 0,
    [...new Set(leaked)].slice(0, 6).join(', ')
  );

  const { options } = optionsForBlock(
    cardioBlock,
    { focus: 'lower', kpi: null, ceiling: TOP },
    owned,
    new Set(),
    kit
  );
  check(`somebody with ${label} still has a warm-up to choose from`, options.length >= 3, `${options.length}`);
  check(
    `and none of it is a machine they do not own`,
    !options.some((t) => /assault bike|treadmill|rowing machine|sled/i.test(t.name)),
    options.map((t) => t.name).join(', ')
  );
}

{
  const { options } = optionsForBlock(
    cardioBlock,
    { focus: 'lower', kpi: null, ceiling: TOP },
    ownedTiersFor('fullgym'),
    new Set(),
    ['fullgym']
  );
  check(
    'a full gym user still gets the machines',
    options.some((t) => /treadmill|rowing machine|assault bike/i.test(t.name)),
    options.map((t) => t.name).join(', ')
  );
  // A sled is the hardest thing in the app. It belongs in the finisher, not in
  // front of somebody who has not moved yet.
  check(
    'and a sled is never the warm-up a full gym user is handed by default',
    !/sled|prowler/i.test(options[0]?.name ?? ''),
    options.slice(0, 3).map((t) => t.name).join(', ')
  );
}

/**
 * And a sled must not CROWD OUT the machines either.
 *
 * The warm-up universe is ten movements. A sled matches no pattern rule, so
 * treating it as a general warm-up makes it a direct match for every lift, and
 * six of them are then enough to fill the step strictly — which quietly hides
 * the assault bike, the treadmill and the rower from a pressing day altogether.
 * Ranking alone does not catch that: a demoted sled still fills the list.
 */
for (const focus of ['lower', 'push', 'pull']) {
  const { options } = optionsForBlock(
    cardioBlock,
    { focus, kpi: null, ceiling: TOP },
    ownedTiersFor('fullgym'),
    new Set(),
    FULL_GYM
  );
  check(
    `a ${focus} warm-up step still reaches a machine`,
    options.some((t) => /assault bike|treadmill|rowing machine/i.test(t.name)),
    options.map((t) => t.name).join(', ')
  );
}

// ─── 2. Every session starts warm ────────────────────────────────────────────
console.log('\n[2] The warm-up that drives the countdown cannot be skipped');

check(
  'the cardio block is required on all three goals',
  SESSION_GOALS.every((g) => blockOf(g.key, 'cardio').optional === false),
  ''
);

for (const g of SESSION_GOALS) {
  const blocks = blocksForGoal(g.key);
  const picks = {};
  for (const b of blocks) {
    const { options } = optionsForBlock(
      b,
      { focus: 'lower', kpi: picks.kpi?.[0]?.template ?? null, ceiling: TOP },
      ownedTiersFor('fullgym'),
      new Set(),
      FULL_GYM
    );
    picks[b.id] = options.slice(0, b.picks).map(pickOf);
  }
  const session = assembleSession(g.key, picks, 4);
  check(
    `a ${g.key} session opens with the cardio warm-up, so the countdown lands on it`,
    session[0]?.category === 'prep' && /min steady/.test(session[0]?.reps ?? ''),
    `${session[0]?.name} / ${session[0]?.reps}`
  );
}

// ─── 3. Changing the KPI lift re-filters what claims to follow it ────────────
console.log('\n[3] The later blocks follow the KPI lift when it changes');

const deadlift = get('Barbell Deadlift');
const bench = get('Dumbbell Bench Press');
const backSquat = get('Barbell Back Squat');
const owned = ownedTiersFor('fullgym');

check('the fixtures this section needs exist', !!(deadlift && bench && backSquat), '');

{
  // Build a full-body athletic session around a deadlift, the way holding Next
  // does, then swap the lift for a bench press.
  const blocks = blocksForGoal('athletic');
  let picks = {};
  for (const b of blocks) {
    if (b.id === 'kpi') {
      picks.kpi = [pickOf(deadlift)];
      continue;
    }
    const { options } = optionsForBlock(
      b,
      { focus: 'full', kpi: picks.kpi?.[0]?.template ?? null, ceiling: TOP },
      owned,
      new Set(),
      FULL_GYM
    );
    picks[b.id] = options.slice(0, b.picks).map(pickOf);
  }
  const beforeAccessories = (picks.accessory ?? []).map((p) => p.template.name);
  check(
    'a deadlift session fills its accessories with lower-body work',
    (picks.accessory ?? []).every(
      (p) => relevanceOf('accessory', p.template, { focus: 'full', kpi: deadlift, ceiling: TOP }) !== 'none'
    ),
    beforeAccessories.join(', ')
  );

  const swapped = refreshForKpi(
    'athletic',
    { ...picks, kpi: [pickOf(bench)] },
    { focus: 'full', kpi: bench, ceiling: TOP },
    owned
  );
  const after = swapped.accessory ?? [];
  check(
    'swapping the deadlift for a bench press drops the leg accessories',
    after.every(
      (p) => relevanceOf('accessory', p.template, { focus: 'full', kpi: bench, ceiling: TOP }) !== 'none'
    ),
    after.map((p) => p.template.name).join(', ')
  );
  check(
    'the accessory block is topped back up rather than left short',
    after.length === (picks.accessory ?? []).length,
    `${after.length} vs ${(picks.accessory ?? []).length}`
  );
  check(
    'the swap actually changed something',
    after.map((p) => p.template.name).join() !== beforeAccessories.join(),
    ''
  );
  check(
    'no exercise ends up in two blocks after the swap',
    (() => {
      const names = Object.values(swapped)
        .flat()
        .map((p) => p.template.name.toLowerCase());
      return new Set(names).size === names.length;
    })(),
    ''
  );
}

{
  // A block the user has not opened is left alone, and one they emptied on
  // purpose stays empty.
  const picks = { kpi: [pickOf(bench)], accessory: [] };
  const out = refreshForKpi('athletic', picks, { focus: 'full', kpi: bench, ceiling: TOP }, owned);
  check('a deliberately emptied block stays empty', (out.accessory ?? []).length === 0, '');
  check('an unvisited block is left undefined', out.core_prehab === undefined, '');
}

{
  // A pick that still fits the new lift survives the swap.
  const floorPress = get('Dumbbell Floor Press');
  const picks = { kpi: [pickOf(bench)], accessory: [pickOf(floorPress), pickOf(backSquat)] };
  const out = refreshForKpi('athletic', picks, { focus: 'full', kpi: bench, ceiling: TOP }, owned);
  const names = (out.accessory ?? []).map((p) => p.template.name);
  check(
    'work that still fits the new lift is kept',
    names.includes('Dumbbell Floor Press'),
    names.join(', ')
  );
  check(
    'work that no longer fits is replaced',
    !names.includes('Barbell Back Squat'),
    names.join(', ')
  );
}

// ─── 4. Defaults are chosen, not alphabetical accidents ──────────────────────
console.log('\n[4] The block a user gets by default is a sensible one');

const NAMED_FINISHERS =
  /sled|prowler|battle rope|assault bike|ski erg|rower|farmer|carry|sprint|shuttle/i;
{
  const cond = blockOf('athletic', 'conditioning');
  const { options } = optionsForBlock(cond, { focus: 'lower', kpi: backSquat, ceiling: TOP }, owned);
  check(
    'a full gym conditioning finisher leads with the modalities the brief names',
    NAMED_FINISHERS.test(options[0]?.name ?? ''),
    options
      .slice(0, 3)
      .map((t) => t.name)
      .join(', ')
  );
}

for (const [lift, label] of [
  [bench, 'a bench press'],
  [backSquat, 'a back squat'],
]) {
  const block = blockOf('athletic', 'core_prehab');
  const { options } = optionsForBlock(block, { focus: 'full', kpi: lift, ceiling: TOP }, owned);
  check(
    `${label} session defaults to trunk work in the Core and prehab step`,
    muscleGroupsOf(options[0]).has('core'),
    options
      .slice(0, 3)
      .map((t) => t.name)
      .join(', ')
  );
}

// ─── The main exercise step defaults to a lift worth building around ─────────
//
// Every `main` template used to rank the same, so the alphabet chose: a
// bodyweight lower-body session led with a Bodyweight Good Morning ahead of a
// Bodyweight Squat. The order used to defer to the lift the OLD generator would
// programme, and not one of those lifts is in the library, so the rule had
// quietly become dead weight and the alphabet was choosing again — the default
// lower-body lift for a beginner was Alternating Reverse Lunges.
//
// The rule is now the library's own: a record it calls a main movement, at the
// hardest rung this person is allowed, in the order the document lists them.
// Asserted as three properties of what comes back rather than by re-deriving
// the answer here, which would only be the same arithmetic agreeing with itself.
const kpiBlock = blockOf('athletic', 'kpi');
function kpiOptions(focus, kit, ceiling) {
  const tier = kit.includes('fullgym') ? 'fullgym' : kit.includes('dumbbells') ? 'dumbbells' : 'bodyweight';
  return optionsForBlock(kpiBlock, { focus, kpi: null, ceiling }, ownedTiersFor(tier), new Set(), kit)
    .options;
}

let notAMain = [];
let notTopRung = [];
for (const ceiling of [1, 2, 3, 4]) {
  for (const kit of [['bodyweight'], ['bodyweight', 'dumbbells'], FULL_GYM]) {
    for (const focus of ['lower', 'push', 'pull', 'full']) {
      const options = kpiOptions(focus, kit, ceiling);
      const first = options[0];
      if (!first) continue;
      if (roleOf.get(first.name.toLowerCase()) !== 'main') {
        notAMain.push(`L${ceiling}/${focus}/${first.name}`);
      }
      const best = Math.max(...options.map((t) => levelOf.get(t.name.toLowerCase()) ?? 0));
      if ((levelOf.get(first.name.toLowerCase()) ?? 0) !== best) {
        notTopRung.push(`L${ceiling}/${focus}/${first.name}`);
      }
    }
  }
}
check(
  'the step always defaults to a record the library calls a main movement',
  notAMain.length === 0,
  notAMain.slice(0, 6).join(', ')
);
check(
  'and always to the hardest rung that person is allowed',
  notTopRung.length === 0,
  notTopRung.slice(0, 6).join(', ')
);

// The concrete form of the same claim, and the regression that prompted it.
check(
  'a beginner with no kit gets Bodyweight Squats, not whatever sorts first',
  kpiOptions('lower', ['bodyweight'], 1)[0]?.name === 'Bodyweight Squats',
  kpiOptions('lower', ['bodyweight'], 1)
    .slice(0, 3)
    .map((t) => t.name)
    .join(', ')
);
check(
  'and an athlete in a full gym does not get the same beginner lift',
  kpiOptions('lower', FULL_GYM, 4)[0]?.name !== 'Bodyweight Squats',
  kpiOptions('lower', FULL_GYM, 4)
    .slice(0, 3)
    .map((t) => t.name)
    .join(', ')
);

console.log(
  failures === 0
    ? `\nsession-builder guardrails: all ${total} checks passed\n`
    : `\nsession-builder guardrails: ${failures}/${total} check(s) FAILED\n`
);
process.exitCode = failures === 0 ? 0 : 1;
