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
 *     pressing session's Core & Prehab slot was a light band curl.
 *
 * Run:  npx tsx tests/session-builder-guardrails.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises, getMainLift } from '../lib/exercise-db.ts';
import {
  assembleSession,
  blocksForGoal,
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

const all = getAllPickableExercises();
const byName = new Map(all.map((p) => [p.template.name.toLowerCase(), p.template]));
const get = (n) => byName.get(n.toLowerCase());

const blockOf = (goal, id) => blocksForGoal(goal).find((b) => b.id === id);
const pickOf = (t) => ({ template: t, sets: t.sets, reps: t.reps });

// ─── 1. Nobody is offered equipment they do not have ─────────────────────────
console.log('\n[1] The cardio step respects the equipment the user actually owns');

const GYM_ONLY = /^(fullgym|full gym|machine|cable machine)$/i;
const cardioBlock = blockOf('athletic', 'cardio');

for (const tier of ['bodyweight', 'dumbbells']) {
  const { options, all: everything } = optionsForBlock(
    cardioBlock,
    { focus: 'lower', kpi: null },
    ownedTiersFor(tier)
  );
  const leaked = [...options, ...everything].filter((t) =>
    GYM_ONLY.test(t.equipmentRequired ?? '')
  );
  check(
    `a ${tier} user is never offered a gym cardio machine`,
    leaked.length === 0,
    [...new Set(leaked.map((t) => t.name))].join(', ')
  );
  check(
    `a ${tier} user still has a warm-up to choose from`,
    options.length >= 3,
    `${options.length}`
  );
}

{
  const { options } = optionsForBlock(
    cardioBlock,
    { focus: 'lower', kpi: null },
    ownedTiersFor('fullgym')
  );
  check(
    'a full gym user still gets the machines',
    options.some((t) => /treadmill|rowing machine|stationary bike|cardio machine/i.test(t.name)),
    ''
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
      { focus: 'lower', kpi: picks.kpi?.[0]?.template ?? null },
      ownedTiersFor('fullgym')
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
const bench = get('Barbell Bench Press');
const backSquat = get('Back Squat');
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
      { focus: 'full', kpi: picks.kpi?.[0]?.template ?? null },
      owned
    );
    picks[b.id] = options.slice(0, b.picks).map(pickOf);
  }
  const beforeAccessories = (picks.accessory ?? []).map((p) => p.template.name);
  check(
    'a deadlift session fills its accessories with lower-body work',
    (picks.accessory ?? []).every(
      (p) => relevanceOf('accessory', p.template, { focus: 'full', kpi: deadlift }) !== 'none'
    ),
    beforeAccessories.join(', ')
  );

  const swapped = refreshForKpi(
    'athletic',
    { ...picks, kpi: [pickOf(bench)] },
    { focus: 'full', kpi: bench },
    owned
  );
  const after = swapped.accessory ?? [];
  check(
    'swapping the deadlift for a bench press drops the leg accessories',
    after.every(
      (p) => relevanceOf('accessory', p.template, { focus: 'full', kpi: bench }) !== 'none'
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
  const out = refreshForKpi('athletic', picks, { focus: 'full', kpi: bench }, owned);
  check('a deliberately emptied block stays empty', (out.accessory ?? []).length === 0, '');
  check('an unvisited block is left undefined', out.core_prehab === undefined, '');
}

{
  // A pick that still fits the new lift survives the swap.
  const closeGrip = get('Close-Grip Bench Press');
  const picks = { kpi: [pickOf(bench)], accessory: [pickOf(closeGrip), pickOf(backSquat)] };
  const out = refreshForKpi('athletic', picks, { focus: 'full', kpi: bench }, owned);
  const names = (out.accessory ?? []).map((p) => p.template.name);
  check(
    'work that still fits the new lift is kept',
    names.includes('Close-Grip Bench Press'),
    names.join(', ')
  );
  check('work that no longer fits is replaced', !names.includes('Back Squat'), names.join(', '));
}

// ─── 4. Defaults are chosen, not alphabetical accidents ──────────────────────
console.log('\n[4] The block a user gets by default is a sensible one');

const NAMED_FINISHERS =
  /sled|prowler|battle rope|assault bike|ski erg|rower|farmer|carry|sprint|shuttle/i;
{
  const cond = blockOf('athletic', 'conditioning');
  const { options } = optionsForBlock(cond, { focus: 'lower', kpi: backSquat }, owned);
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
  const { options } = optionsForBlock(block, { focus: 'full', kpi: lift }, owned);
  check(
    `${label} session defaults to trunk work in the Core & Prehab step`,
    muscleGroupsOf(options[0]).has('core'),
    options
      .slice(0, 3)
      .map((t) => t.name)
      .join(', ')
  );
}

// ─── The KPI step defaults to a lift worth building a session around ─────────
//
// Every `main` template used to rank the same, so the alphabet chose: a
// bodyweight lower-body session led with a Bodyweight Good Morning ahead of a
// Bodyweight Squat. The order now defers to the lift the generator itself would
// programme for that tier, which is why this asserts against getMainLift rather
// than a list written out here — a hand-written list would just be a second
// opinion that could drift from the app's own.
for (const [focus, sessionType] of [
  ['lower', 'squat'],
  ['push', 'bench'],
]) {
  for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
    const expected = getMainLift(sessionType, tier).name;
    const block = blockOf('athletic', 'kpi');
    const { options } = optionsForBlock(block, { focus, kpi: null }, [tier]);
    check(
      `${focus}/${tier} defaults to the programmed main lift (${expected})`,
      options[0]?.name === expected,
      `got ${options[0]?.name ?? '(none)'} — first three: ${options
        .slice(0, 3)
        .map((t) => t.name)
        .join(', ')}`
    );
  }
}

console.log(
  failures === 0
    ? `\nsession-builder guardrails: all ${total} checks passed\n`
    : `\nsession-builder guardrails: ${failures}/${total} check(s) FAILED\n`
);
process.exit(failures === 0 ? 0 : 1);
