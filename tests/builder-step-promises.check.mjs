/**
 * The guided builder judged by what its steps SAY, not by how they are built.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The two tests alongside this one prove the assembly line is complete and that
 * each step offers something relevant. Both passed while three of the screen's
 * own sentences were false:
 *
 *  1. Every step printed "Matched to <your lift>". The Cardio and Conditioning
 *     steps were not matched to anything — measured, the conditioning list was
 *     the same 264 movements for a Back Squat and a Barbell Bench Press, in the
 *     same order, and the cardio list was the same 17 led by the same assault
 *     bike. The KPI step printed it too, about the lift it was still asking the
 *     user to choose.
 *  2. Changing the lift late re-filtered forwards only. A lower-body build
 *     switched to a bench press kept a Cossack Squat Flow, a Hip Flexor
 *     Kneeling Stretch, a Banded Lateral Walk and a Box Jump in front of it —
 *     four steps of warm-up preparing a lift that was no longer happening,
 *     under notes still reading "lower body training".
 *  3. Reusing a saved template abandoned the guided flow for the flat catalogue.
 *
 * So these checks read the promise and then test the promise. A step may only
 * claim to follow the lift if changing the lift changes what it offers; a
 * session must follow its lift in every block, not just the ones after it; and
 * a saved session must come back as the session that was saved.
 *
 * Run:  npx tsx tests/builder-step-promises.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { builderExercises } from '../lib/session-builder.ts';
import { bodyRegionOf } from '../lib/exercise-safety.ts';
import {
  assembleSession,
  blocksForGoal,
  buildFromSession,
  optionsForBlock,
  ownedTiersFor,
  refreshForKpi,
  relevanceOf,
  DEFAULT_CARDIO_MINUTES,
  SESSION_GOALS,
} from '../lib/session-builder.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const screen = readFileSync(join(__dir, '../app/custom-session.tsx'), 'utf8');

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
const pickOf = (t) => ({ template: t, sets: t.sets, reps: t.reps });
const names = (list) => (list ?? []).map((p) => p.template.name);

const TIERS = ['bodyweight', 'dumbbells', 'fullgym'];
/** One lift per focus, so a swap between any two is a real change of session. */
const LIFTS = [
  ['lower', 'Barbell Back Squat'],
  ['push', 'Dumbbell Bench Press'],
  ['pull', 'Pull Ups'],
];

check(
  'the fixtures these checks run on exist',
  LIFTS.every(([, n]) => !!get(n)),
  LIFTS.filter(([, n]) => !get(n))
    .map(([, n]) => n)
    .join(', ')
);

/** The session someone gets by holding Next: every step takes the app's default. */
function autoBuild(goal, focus, kpiName, tier = 'fullgym') {
  const owned = ownedTiersFor(tier);
  const picks = {};
  for (const block of blocksForGoal(goal)) {
    if (block.id === 'kpi') {
      picks.kpi = [pickOf(get(kpiName))];
      continue;
    }
    const taken = new Set();
    for (const list of Object.values(picks)) for (const p of list) taken.add(p.template.name);
    const { options } = optionsForBlock(
      block,
      { focus, kpi: picks.kpi?.[0]?.template ?? null, ceiling: TOP },
      owned,
      taken
    );
    picks[block.id] = options.slice(0, block.picks).map(pickOf);
  }
  return picks;
}

/** Every block the app filled — which, after autoBuild, is all of them but the lift. */
function autoFilledOf(goal) {
  return new Set(blocksForGoal(goal).map((b) => b.id).filter((id) => id !== 'kpi'));
}

// ─── 1. A step may only claim to follow the lift if it follows the lift ──────
console.log('\n[1] "Matched to <your lift>" is only printed where it is true');

{
  const owned = ownedTiersFor('fullgym');
  let dishonest = [];
  let checkedBlocks = 0;
  for (const g of SESSION_GOALS) {
    for (const block of blocksForGoal(g.key)) {
      checkedBlocks++;
      // The same block, offered for three different lifts in three different
      // focuses. A step that claims to be matched to the lift has to answer
      // differently; one that does not claim it may answer however it likes.
      //
      // Compared as SETS, not as ordered lists. "Matched to <your lift>" reads
      // as a filter, and a step that shuffles the same seventeen options into a
      // different order has not filtered anything.
      const results = LIFTS.map(([focus, name]) =>
        optionsForBlock(block, { focus, kpi: get(name), ceiling: TOP }, owned, new Set([name]), FULL_GYM)
      );
      const answers = results.map((r) =>
        r.options
          .map((t) => t.name)
          .sort()
          .join('|')
      );
      const varies = new Set(answers).size > 1;
      // Or the step says it could not narrow, which the screen prints beside
      // the match note. See section 2 for why that escape exists.
      const admitsIt = results.every((r) => r.widened);
      if (block.followsLift && !varies && !admitsIt) {
        dishonest.push(`${g.key}/${block.id} claims to follow the lift and never changes`);
      }
    }
  }
  check(
    `every step claiming "Matched to <lift>" answers differently for different lifts (${checkedBlocks} blocks across 3 goals)`,
    dishonest.length === 0,
    dishonest.join('; ')
  );

  // The claim is worth nothing if no block makes it — a green run with
  // followsLift false everywhere would be the label softened into meaninglessness.
  const claiming = blocksForGoal('athletic').filter((b) => b.followsLift).length;
  check(
    `and the claim is still made where it belongs (${claiming} of the 8 athletic blocks)`,
    claiming >= 5,
    `${claiming}`
  );

  // The two that do not claim it are the two that cannot: the conditioning
  // step is deliberately open, and the KPI step is the one choosing the lift.
  check(
    'the KPI step does not claim to follow the lift it is asking the user to pick',
    blocksForGoal('athletic').find((b) => b.id === 'kpi')?.followsLift === false,
    ''
  );
}

// The screen must take the sentence from the block rather than deciding for
// itself, or a block can change its filter and leave the old claim on screen.
{
  const claims = screen.match(/Matched to \$\{kpiTemplate\.name\}/g) ?? [];
  check(
    'the screen prints the lift-matched note in exactly one place',
    claims.length === 1,
    `${claims.length} occurrences`
  );
  check(
    'and only when the block says its list follows the lift',
    /activeBlock\.followsLift && kpiTemplate \? `Matched to \$\{kpiTemplate\.name\}`/.test(screen),
    'the note is not guarded by followsLift'
  );
  const unfiltered = /Any finisher suits any lift[^`']*/.exec(screen)?.[0] ?? '';
  check(
    'the unfiltered step says so instead of claiming a match',
    unfiltered.length > 0 && !/Matched to/.test(unfiltered),
    unfiltered
  );
}

// ─── 2. The cardio warm-up prepares the lift that follows it ─────────────────
console.log('\n[2] The warm-up step is the day\'s warm-up, not the alphabet\'s');

{
  const owned = ownedTiersFor('fullgym');
  const cardio = blocksForGoal('athletic').find((b) => b.id === 'cardio');
  const resultFor = (focus, name) =>
    optionsForBlock(cardio, { focus, kpi: get(name), ceiling: TOP }, owned, new Set(), FULL_GYM);
  const listFor = (focus, name) => resultFor(focus, name).options;

  const lists = LIFTS.map(([focus, name]) => [name, listFor(focus, name)]);
  /**
   * THE WHOLE WARM-UP UNIVERSE IS NOW TEN MOVEMENTS.
   *
   * Nine conditioning records and one Restore walk, where it used to be
   * seventeen warm-ups out of the old catalogue. Two lifts that share no
   * pattern can therefore be left holding the same ten names, and that is not
   * the step lying: `widened` is true when the filter could not hold, and the
   * screen prints "widened, too few exact matches for your equipment" beside
   * the match note wherever it is. So the promise is that the list narrows OR
   * the step says out loud that it could not - never that it silently offers
   * everything under a heading claiming a match.
   */
  const shapes = LIFTS.map(([focus, name]) => {
    const { options, widened } = resultFor(focus, name);
    return {
      key: options.map((t) => t.name).sort().join('|'),
      widened,
    };
  });
  const honest = shapes.filter((s, i) =>
    s.widened || shapes.every((o, j) => i === j || o.key !== s.key)
  );
  check(
    `the cardio list narrows per lift, or admits it could not (${lists.map(([n, l]) => `${n}:${l.length}`).join(' ')})`,
    honest.length === shapes.length,
    shapes.map((s) => `${s.widened ? 'widened' : 'strict'}:${s.key.split('|').length}`).join(' ')
  );
  // Non-vacuity: at least one lift really does get a narrower list than the
  // whole block, or the rule above is satisfied by everything widening.
  check(
    'and at least one lift still gets a genuinely narrowed warm-up',
    shapes.some((s) => !s.widened),
    shapes.map((s) => (s.widened ? 'widened' : 'strict')).join(' ')
  );

  // The default is what someone who holds Next actually gets, so it is the one
  // that has to be right. Every session in the app used to open with an
  // assault bike because "Assault Bike Warm-Up" sorts first alphabetically.
  const defaults = Object.fromEntries(lists.map(([n, l]) => [n, l[0]?.name]));
  check(
    `a pulling day opens on a rower, not a bike (got "${defaults['Pull Ups']}")`,
    /row/i.test(defaults['Pull Ups'] ?? ''),
    ''
  );
  check(
    `a squat day opens on something that drives the legs (got "${defaults['Barbell Back Squat']}")`,
    /bike|tread|walk|skip|jump rope|cycl/i.test(defaults['Barbell Back Squat'] ?? ''),
    ''
  );
  check(
    `a bench day does not open on a leg machine (got "${defaults['Dumbbell Bench Press']}")`,
    !/\bbike\b|jump rope/i.test(defaults['Dumbbell Bench Press'] ?? ''),
    ''
  );

  // Filtering must not empty the step for anyone: it is the one block that
  // cannot be skipped.
  let thin = [];
  for (const tier of TIERS) {
    for (const [focus, name] of LIFTS) {
      const { options } = optionsForBlock(
        cardio,
        { focus, kpi: get(name), ceiling: TOP },
        ownedTiersFor(tier)
      );
      if (options.length < 3) thin.push(`${tier}/${name}=${options.length}`);
    }
  }
  check('and every tier still has a warm-up to choose from', thin.length === 0, thin.join(', '));
}

// ─── 3. A change of lift reaches the whole session ───────────────────────────
console.log('\n[3] Changing the lift late re-aims the warm-up too, not only what follows it');

{
  const WARM_UP = ['cardio', 'mobility', 'activation', 'power'];
  let stale = [];
  let unmoved = [];
  let strayCardio = [];
  let halfChecked = 0;
  let comparisons = 0;

  for (const tier of TIERS) {
    const owned = ownedTiersFor(tier);
    for (const [fromFocus, fromName] of LIFTS) {
      for (const [toFocus, toName] of LIFTS) {
        if (fromName === toName) continue;
        comparisons++;
        const picks = autoBuild('athletic', fromFocus, fromName, tier);
        const to = get(toName);
        const after = refreshForKpi(
          'athletic',
          { ...picks, kpi: [pickOf(to)] },
          { focus: toFocus, kpi: to, ceiling: TOP },
          owned,
          autoFilledOf('athletic')
        );

        /**
         * Nothing anywhere in the session may be work the app would not have
         * chosen for the NEW lift.
         *
         * Asked as "is this pick one the step now offers" rather than "is this
         * pick relevant", which is both stricter and fairer. Stricter, because
         * a pick can be graded merely 'related' and still be work chosen for
         * the lift you are no longer doing. Fairer, because a step whose pool
         * holds nothing relevant at all widens to everything and says so, and
         * the honest answer there really is the best of a bad list: at
         * bodyweight every power record in the library is a lower-body jump, so
         * a bench press build's power primer has nothing else to give.
         */
        for (const block of blocksForGoal('athletic')) {
          if (block.id === 'kpi') continue;
          const nowOffers = new Set(
            optionsForBlock(
              block,
              { focus: toFocus, kpi: to, ceiling: TOP },
              owned,
              new Set([toName])
            ).options.map((t) => t.name)
          );
          for (const p of after[block.id] ?? []) {
            if (!nowOffers.has(p.template.name)) {
              stale.push(`${tier} ${fromName}->${toName} ${block.id}: ${p.template.name}`);
            }
          }
        }

        // And the warm-up specifically has to have moved: a bench press warmed
        // up with a Cossack squat is the reported bug. Skipped where the step
        // widened, because a step with nothing for this half of the body cannot
        // choose better and the screen says so on the card.
        const wrongHalf = bodyRegionOf(to.primaryMuscle) === 'lower' ? 'upper' : 'lower';
        for (const id of WARM_UP) {
          const block = blocksForGoal('athletic').find((b) => b.id === id);
          const { widened } = optionsForBlock(
            block,
            { focus: toFocus, kpi: to, ceiling: TOP },
            owned,
            new Set([toName])
          );
          if (widened) continue;
          for (const p of after[id] ?? []) {
            halfChecked++;
            if (bodyRegionOf(p.template.primaryMuscle) === wrongHalf) {
              unmoved.push(`${tier} ${fromName}->${toName} ${id}: ${p.template.name}`);
            }
          }
        }

        // The cardio machine has to follow the lift as well. Nothing ever
        // grades a warm-up machine as useless — a bike before a bench press is
        // a worse warm-up, not a wrong one — so the "no use for" check above
        // cannot see a stale one, and an assault bike chosen for a squat day
        // sat under "Matched to Barbell Bench Press" without tripping anything.
        for (const p of after.cardio ?? []) {
          if (relevanceOf('cardio', p.template, { focus: toFocus, kpi: to, ceiling: TOP }) !== 'direct') {
            strayCardio.push(`${tier} ${fromName}->${toName}: ${p.template.name}`);
          }
        }
      }
    }
  }
  check(
    `no block anywhere holds work the new lift has no use for (${comparisons} lift swaps)`,
    stale.length === 0,
    stale.slice(0, 6).join(' | ')
  );
  check(
    `and no warm-up step is left preparing the opposite half of the body (${halfChecked} picks judged)`,
    unmoved.length === 0 && halfChecked > 20,
    unmoved.length
      ? unmoved.slice(0, 6).join(' | ')
      : `only ${halfChecked} picks were strict enough to judge, so this proved nothing`
  );
  check(
    'and the cardio machine the app chose is re-chosen for the new lift',
    strayCardio.length === 0,
    strayCardio.slice(0, 6).join(' | ')
  );
  check('the swap matrix actually ran', comparisons === 18, `${comparisons}`);
}

{
  // The other half of the promise: a choice the USER made survives, even when
  // the app would not have made it. Re-picking everything on every swap would
  // pass the checks above and be a worse app.
  const owned = ownedTiersFor('fullgym');
  const squat = get('Barbell Back Squat');
  const bench = get('Dumbbell Bench Press');
  const closeGrip = get('Dumbbell Floor Press');
  const picks = autoBuild('athletic', 'lower', 'Barbell Back Squat');
  const chosenByUser = { ...picks, accessory: [pickOf(closeGrip)] };
  const after = refreshForKpi(
    'athletic',
    { ...chosenByUser, kpi: [pickOf(bench)] },
    { focus: 'push', kpi: bench, ceiling: TOP },
    owned,
    // Everything but the accessory block was filled by the app.
    new Set([...autoFilledOf('athletic')].filter((id) => id !== 'accessory'))
  );
  check(
    'a pick the user made themselves is kept when it still fits',
    names(after.accessory).includes('Dumbbell Floor Press'),
    names(after.accessory).join(', ')
  );
  check(
    'a block the user emptied on purpose stays empty',
    (refreshForKpi(
      'athletic',
      { kpi: [pickOf(bench)], power: [] },
      { focus: 'push', kpi: bench, ceiling: TOP },
      owned,
      autoFilledOf('athletic')
    ).power ?? []).length === 0,
    ''
  );
  check(
    'a block the user has not reached yet is left for them to reach',
    refreshForKpi(
      'athletic',
      { kpi: [pickOf(bench)] },
      { focus: 'push', kpi: bench, ceiling: TOP },
      owned,
      autoFilledOf('athletic')
    ).core_prehab === undefined,
    ''
  );
  check(
    'and the app-chosen warm-up really was replaced, not merely re-listed',
    names(picks.mobility).join() !== names(after.mobility).join(),
    `${names(picks.mobility).join(', ')} -> ${names(after.mobility).join(', ')}`
  );
  check('the fixture for the user-choice case is a real one', !!closeGrip && !!squat, '');
}

// ─── 4. A reused template is the session that was saved ──────────────────────
console.log('\n[4] Reopening a saved session gives back the same session, in blocks');

{
  let lost = [];
  let changed = [];
  let rounds = 0;
  for (const g of SESSION_GOALS) {
    for (const [focus, name] of LIFTS) {
      rounds++;
      const picks = autoBuild(g.key, focus, name);
      const saved = assembleSession(g.key, picks, 4);
      const restored = buildFromSession(saved);
      const rebuilt = assembleSession(restored.goal, restored.picks, restored.cardioMinutes);

      const before = saved.map((e) => `${e.category}:${e.name}:${e.sets}:${e.reps}`);
      const after = rebuilt.map((e) => `${e.category}:${e.name}:${e.sets}:${e.reps}`);
      if (before.length !== after.length) lost.push(`${g.key}/${name} ${before.length}->${after.length}`);
      else if (before.join() !== after.join()) {
        changed.push(`${g.key}/${name}: ${before.find((b, i) => b !== after[i])} -> ${after[before.indexOf(before.find((b, i) => b !== after[i]))]}`);
      }

      if (restored.cardioMinutes !== 4) {
        changed.push(`${g.key}/${name} cardio minutes ${restored.cardioMinutes}`);
      }
      if (restored.picks.kpi?.[0]?.template.name !== name) {
        changed.push(`${g.key}/${name} KPI came back as ${restored.picks.kpi?.[0]?.template.name}`);
      }
    }
  }
  check(`no exercise is lost reopening a saved session (${rounds} sessions)`, lost.length === 0, lost.join(', '));
  check(
    'and every one comes back in the block, order and prescription it was saved in',
    changed.length === 0,
    changed.slice(0, 4).join(' | ')
  );
}

{
  // A session with more in a block than the block is built around. Nothing caps
  // a block at its default count — the review screen and the catalogue escape
  // hatch both add to one — so a template can hold three stretches where the
  // step offers two, and every one of them has to come back.
  const saved = (name, category, sets, reps) => ({
    id: get(name).id,
    name,
    sets,
    reps,
    cue: get(name).cue,
    suggestedLoad: get(name).suggestedLoad,
    category,
  });
  const crowded = [
    saved('Cardio Warm-Up (Easy Walk / Bike)', 'prep', 1, '4 min steady'),
    saved('Figure-4 Glute Stretch', 'prep', 1, '30s each side'),
    saved('Legs-Up-The-Wall', 'prep', 1, '60s'),
    saved('Side-Bend Overhead Reach', 'prep', 1, '6 each side'),
    saved('Barbell Back Squat', 'main', 5, '5'),
    saved('Barbell Bulgarian Split Squats', 'accessory', 3, '10'),
    saved('Dumbbell Walking Lunges', 'accessory', 3, '12'),
    saved('Wall Sit', 'accessory', 3, '45s'),
    saved('Glute Bridge', 'accessory', 3, '12'),
    saved('Dead Bug', 'prehab', 2, '8 each side'),
    saved('Banded Clamshell', 'prehab', 2, '15'),
    saved('Sled Push', 'finisher', 3, '20m'),
    saved('Dumbbell Farmers Carry', 'finisher', 3, '30m'),
  ];
  check(
    'the crowded fixture is built from exercises that exist',
    crowded.every((e) => !!e.id),
    ''
  );
  const restored = buildFromSession(crowded);
  const placed = Object.values(restored.picks).flat();
  check(
    `a block holding more than it is built around loses nothing (${placed.length} of ${crowded.length})`,
    placed.length === crowded.length,
    crowded
      .filter((e) => !placed.some((p) => p.template.name === e.name))
      .map((e) => e.name)
      .join(', ')
  );
  const rebuilt = assembleSession(restored.goal, restored.picks, restored.cardioMinutes);
  check(
    'and gives every one of them back in the same place with the same prescription',
    rebuilt.map((e) => `${e.category}:${e.name}:${e.sets}:${e.reps}`).join('|') ===
      crowded.map((e) => `${e.category}:${e.name}:${e.sets}:${e.reps}`).join('|'),
    rebuilt.map((e) => `${e.category}:${e.name}`).join(' > ')
  );
  check(
    `the third stretch really did overflow the two-pick mobility step (${names(restored.picks.mobility).length} there)`,
    names(restored.picks.mobility).length === 3,
    names(restored.picks.mobility).join(', ')
  );
}

{
  // A template saved from the flat catalogue has no block structure at all, and
  // one of its cardio machines is not an exercise in the database. Both have to
  // survive, because both are already sitting in people's saved templates.
  const flat = [
    { id: get('Barbell Back Squat').id, name: 'Barbell Back Squat', sets: 5, reps: '5', cue: 'x', suggestedLoad: 'Heavy', category: 'main' },
    { id: get('Barbell Bulgarian Split Squats').id, name: 'Barbell Bulgarian Split Squats', sets: 3, reps: '10', cue: 'x', suggestedLoad: 'Moderate', category: 'accessory' },
    { id: get('Dead Bug').id, name: 'Dead Bug', sets: 2, reps: '8', cue: 'x', suggestedLoad: 'Bodyweight', category: 'prehab' },
    { id: 'cardio-treadmill', name: 'Treadmill', sets: 1, reps: '', cue: 'Run or walk.', suggestedLoad: 'Cardio', category: 'accessory', type: 'cardio' },
  ];
  const restored = buildFromSession(flat);
  const placed = Object.values(restored.picks).flat();
  check(
    'a template saved from the flat catalogue keeps every exercise',
    placed.length === flat.length,
    `${placed.length} of ${flat.length}`
  );
  check(
    'its main lift comes back as the KPI lift',
    restored.picks.kpi?.[0]?.template.name === 'Barbell Back Squat',
    restored.picks.kpi?.[0]?.template.name ?? '(none)'
  );
  check(
    'and the focus follows from it, so the steps filter the way they did',
    restored.focus === 'lower',
    restored.focus
  );
  const out = assembleSession(restored.goal, restored.picks, restored.cardioMinutes);
  const treadmill = out.find((e) => e.name === 'Treadmill');
  check(
    'a cardio machine still logs as a duration rather than sets and reps',
    treadmill?.type === 'cardio' && treadmill?.reps === '',
    `${treadmill?.type ?? 'no type'} / reps "${treadmill?.reps}"`
  );
  check(
    'a template with no cardio warm-up saved falls back to the default duration',
    buildFromSession([flat[0]]).cardioMinutes === DEFAULT_CARDIO_MINUTES,
    ''
  );
  check(
    'an empty template does not throw',
    Object.values(buildFromSession([]).picks).flat().length === 0,
    ''
  );
}

// The screen has to actually go there. This is the whole of the reported bug:
// the data was right and the destination was the old flat catalogue.
{
  const loader = /const loadTemplate = useCallback\(\s*\(tmpl: CustomTemplate\) => \{[\s\S]*?\n {4}\},/.exec(screen)?.[0] ?? '';
  check(
    'the screen reads a saved template back into blocks',
    /buildFromSession\(tmpl\.exercises\)/.test(loader),
    'loadTemplate does not call buildFromSession'
  );
  check(
    'and lands it on the review screen, not the flat catalogue',
    /setStage\('review'\)/.test(loader) && !/setStage\('catalogue'\)/.test(loader),
    loader ? 'loadTemplate still opens the catalogue' : 'loadTemplate not found'
  );
}

// ─── 5. The step counter and the progress dots tell the same story ───────────
console.log('\n[5] The counter and the dots agree on how many steps there are');

{
  const counter = /`Step \$\{stepIndex \+ (\d+)\} of \$\{([^}]+)\}`/.exec(screen);
  check('the step counter is on screen', !!counter, 'no "Step N of M" found');
  const dots = /<View style=\{styles\.stepDots\}>\s*\{(\w+)\.map\(/.exec(screen);
  check('the progress dots are on screen', !!dots, 'no dot row found');
  if (counter && dots) {
    check(
      `the counter counts the same list the dots draw (counts ${counter[2]}, draws one per ${dots[1]})`,
      counter[2] === `${dots[1]}.length`,
      `"${counter[2]}" vs "${dots[1]}.length"`
    );
    check(
      `the first block is step 1, not step ${counter[1]}`,
      counter[1] === '1',
      `offset ${counter[1]} means the dots start at 1 while the counter starts at ${counter[1]}`
    );
  }
}

console.log('');
if (failures > 0) {
  console.error(`builder step promises: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`builder step promises: all ${total} checks passed\n`);
  process.exitCode = 0;
}
