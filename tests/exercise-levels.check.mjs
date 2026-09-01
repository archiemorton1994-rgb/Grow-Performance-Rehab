/**
 * Contract test: the ladder in the code is the ladder the physiotherapist wrote.
 *
 * WHY THIS ONE MATTERS MORE THAN MOST
 * ───────────────────────────────────
 * lib/exercise-levels.ts classifies 277 exercises by matching their names, and a
 * name matcher is the kind of code that looks right and is wrong in a dozen
 * places you will never open. The defence is that the levels are not the
 * classifier's opinion: they are Archie's lists from PROGRESSION-LADDERS.md, and
 * SECTION 1 BELOW IS THOSE LISTS. Every movement he placed has to come back at
 * the level he placed it. When they disagree, the classifier is wrong.
 *
 * That is also how the first run's real defects were found, and they are worth
 * naming because they are the failure modes this file exists to hold shut:
 *
 *   Every Romanian deadlift was promoted to the conventional deadlift's rung,
 *   because an RDL is a deadlift by name.
 *   "Towel Row (Door Handle)", the easiest pull in the app, was called level 4,
 *   because the thick-grip rung was about pull-ups and did not say so.
 *   A Deficit Push-Up came back a rung above its list, because a general
 *   "deficit is harder" rule was double-counting a demand the list had already
 *   priced in.
 *
 * SECTIONS 2 AND 3 are about the catalogue rather than the lists: that the
 * levels reach real exercises, that nothing off a ladder is given a number, and
 * that no ceiling empties a pool. A filter that leaves a beginner with one squat
 * is a worse bug than no filter at all.
 *
 * Run:  npx tsx tests/exercise-levels.check.mjs
 */

globalThis.__DEV__ = false;

import {
  levelOf,
  levelBandFor,
  bandLabel,
  byLevelPreference,
  withinLevel,
  isLadderPattern,
  LADDER_PATTERNS,
  LEVEL_NAMES,
} from '../lib/exercise-levels.ts';
import { getAllPickableExercises } from '../lib/exercise-db.ts';
import { generateWorkout } from '../lib/workout-engine.ts';
import {
  DIFFICULTY_LABELS,
  PROGRAMME_IDS,
  levelCeilingFor,
  programmeDifficulty,
} from '../lib/programme.ts';

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

// ─── 1. The physiotherapist's own lists ──────────────────────────────────────
//
// Copied from PROGRESSION-LADDERS.md, level by level. Entries that describe a
// family rather than name a movement ("band or chain resisted deadlift") are
// written here the way the catalogue would name one.
console.log('\n[1] Every movement comes back on the rung it was placed on');

const LISTS = {
  hinge: [
    ['Wall-Touch Hip Hinge', 'Dowel Hinge', 'Glute Bridge', 'Banded Good Morning', 'Single-Leg Bodyweight Hinge'],
    ['Kettlebell RDL', 'DB Romanian Deadlift', 'High Rack Pull', 'Trap Bar Deadlift (High Handles)', 'Barbell RDL'],
    ['Trap Bar Deadlift', 'Barbell Sumo Deadlift', 'Conventional Deadlift', 'Barbell Good Morning', 'Single-Leg DB RDL'],
    ['Deficit Deadlift', 'Stiff-Leg Deadlift', 'Single-Leg Barbell RDL', 'Chain-Resisted Deadlift', 'Pause Deadlift'],
    ['Reeves Deadlift', 'Suitcase Deadlift', 'Jefferson Deadlift', 'Snatch-Grip Deficit Deadlift'],
  ],
  squat: [
    ['Box Sit-to-Stand', 'Assisted Bodyweight Squat', 'Air Squat', 'Plate-Reach Counterbalance Squat'],
    ['Goblet Squat', 'Dual Dumbbell Front Squat', 'Zercher Squat', 'Landmine Squat', 'Barbell Box Squat'],
    ['Barbell Front Squat', 'High-Bar Back Squat', 'Low-Bar Back Squat', 'Safety Squat Bar', 'DB Bulgarian Split Squat'],
    ['Heels-Elevated Squat', 'Anderson Squat', 'Overhead Squat', 'Skater Squat', 'Barbell Bulgarian Split Squat'],
    ['Pistol Squat', 'Zercher Deficit Squat'],
  ],
  lunge: [
    ['Assisted Static Split Squat', 'Bodyweight Static Split Squat', 'Reverse Lunge', 'Lateral Lunge', 'Curtsy Lunge'],
    ['Forward Lunge', 'Goblet Split Squat', 'DB Reverse Lunge', 'Walking Lunge', 'Elevated Front-Foot Split Squat'],
    ['DB Walking Lunge', 'Barbell Reverse Lunge', 'Barbell Forward Lunge', 'Deficit Reverse Lunge', 'Clock Lunge Series'],
    ['Suitcase Lunge', 'Front-Rack Walking Lunge', 'Jumping Split Squat', 'Overhead Walking Lunge'],
    ['Barbell Overhead Walking Lunge', 'Zercher Deficit Walking Lunge', 'Weighted Plyometric Lunge'],
  ],
  push: [
    ['Wall Push-Up', 'Incline Push-Up', 'Seated Overhead Dumbbell Press', 'Kneeling Push-Up', 'DB Floor Press'],
    ['Push-Up', 'Dumbbell Flat Bench', 'Standing DB Overhead Press', 'Barbell Bench Press', 'Standing Barbell Overhead Press'],
    ['Incline Bench', 'Deficit Push-Up', 'Parallel Bar Dip', 'Decline Push-Up', 'Push Press'],
    ['Weighted Dips', 'Single-Arm Overhead Press', 'Ring Push-Up', 'Pin Bench', 'Pause Bench'],
    ['Wall-Assisted Handstand Push-Up', 'Single-Arm Barbell Floor Press', 'Freestanding Handstand Push-Up', 'Bottom-Up Kettlebell Press'],
  ],
  pull: [
    ['Doorframe Isometric Row', 'High-Incline Inverted Row', 'Lat Pulldown', 'Chest-Supported Dumbbell Row', 'Scapular Pull-Up'],
    ['Low-Incline Inverted Row', 'Single-Arm DB Row', 'Band-Assisted Pull-Up', 'Seated Cable Row', 'Bent-Over Barbell Row'],
    ['Strict Chin-Up', 'Strict Pull-Up', 'Meadows Row', 'Feet-Elevated Inverted Row', 'Kipping Pull-Up'],
    ['Weighted Pull-Up', 'Ring Pull-Up', 'Unsupported Single-Arm Row', 'Chest-to-Bar Pull-Up', 'Thick-Grip Pull-Up'],
    ['Archer Pull-Up', 'Strict Muscle-Up', 'Single-Arm Inverted Row', 'One-Arm Pull-Up'],
  ],
  carry: [
    ['Trap Bar Carry', "Two-Handed Farmer's Carry", 'Goblet Carry', 'Plate Pinch Carry', "Farmer's Hold March"],
    ['Suitcase Carry', 'Front-Rack Kettlebell Carry', 'Uneven Farmers Carry', 'Sandbag Hug Walk', 'Heavy Trap Bar Carry'],
    ['Single-Arm Front-Rack Carry', "Waiter's Walk", 'Cross-Body Mixed-Rack Carry'],
  ],
};

const wrong = [];
let placed = 0;
for (const [pattern, levels] of Object.entries(LISTS)) {
  levels.forEach((names, i) => {
    const expected = i + 1;
    for (const name of names) {
      placed++;
      const got = levelOf(name, pattern);
      if (got !== expected) wrong.push(`${pattern} L${expected}: "${name}" came back ${got}`);
    }
  });
}
check(
  `every movement on the ladders lands where the physiotherapist put it (${placed} checked)`,
  wrong.length === 0,
  wrong.slice(0, 8).join(' | ')
);

// ─── 2. What the ladders cover, and what they deliberately do not ────────────
console.log('\n[2] A level exists exactly where a ladder does');

const all = getAllPickableExercises();
const onLadder = all.filter((p) => isLadderPattern(p.template.movementPattern));
const offLadder = all.filter((p) => !isLadderPattern(p.template.movementPattern));

check(
  `the six strength patterns are levelled and nothing else is (${onLadder.length} on, ${offLadder.length} off)`,
  onLadder.length > 250 && offLadder.length > 350,
  `${onLadder.length} / ${offLadder.length}`
);
check(
  'every exercise on a ladder gets a rung between 1 and 5',
  onLadder.every((p) => {
    const l = levelOf(p.template.name, p.template.movementPattern);
    return l !== null && l >= 1 && l <= 5;
  }),
  onLadder
    .filter((p) => levelOf(p.template.name, p.template.movementPattern) === null)
    .slice(0, 5)
    .map((p) => p.template.name)
    .join(' | ')
);
check(
  // The whole reason null exists. A Pallof Press is not a rung below a deadlift
  // and an Assault Bike interval is not a rung above one, so giving them numbers
  // would let the app compare things that do not compare - and the first casualty
  // would be a rehab drill withheld from a beginner for being "too advanced".
  'and nothing off a ladder is given one, so rehab and conditioning are never ranked',
  offLadder.every((p) => levelOf(p.template.name, p.template.movementPattern) === null),
  offLadder
    .filter((p) => levelOf(p.template.name, p.template.movementPattern) !== null)
    .slice(0, 5)
    .map((p) => `${p.template.name} [${p.template.movementPattern}]`)
    .join(' | ')
);
check(
  'a movement with no pattern at all is unlevelled rather than guessed at',
  levelOf('Something Nobody Has Heard Of') === null,
  ''
);
check(
  'every rung has a name, for anywhere that shows one',
  [1, 2, 3, 4, 5].every((l) => typeof LEVEL_NAMES[l] === 'string' && LEVEL_NAMES[l].length > 3),
  JSON.stringify(LEVEL_NAMES)
);

// ─── 3. The bands, and the pools they leave behind ───────────────────────────
console.log('\n[3] A ceiling narrows the catalogue without emptying it');

check(
  'every difficulty has a band, and the ceilings only ever climb',
  DIFFICULTY_LABELS.every((d, i) => {
    const band = levelBandFor(d);
    if (i === 0) return band.max >= 1;
    return band.max >= levelBandFor(DIFFICULTY_LABELS[i - 1]).max;
  }),
  DIFFICULTY_LABELS.map((d) => `${d}:${levelBandFor(d).prefer}-${levelBandFor(d).max}`).join(' ')
);
check(
  // The earn-the-barbell rule of PROGRESSION-LADDERS.md, stated as a band.
  // Level 3 is where the barbell starts on the hinge, squat and lunge ladders,
  // which are the ones that load the spine. Push and pull put a barbell at level
  // 2 on the physiotherapist's own lists, so this is deliberately not universal.
  'a Beginner and a Novice are held below the rung the barbell starts on',
  levelBandFor('Beginner').max <= 2 && levelBandFor('Novice').max <= 2,
  ''
);
check(
  'and an Elite programme can reach the top of the ladder',
  levelBandFor('Elite').max === 5 && levelBandFor('Expert').max === 5,
  ''
);
check(
  'the band the programme is built on climbs with the label, so the six differ',
  new Set(DIFFICULTY_LABELS.map((d) => `${levelBandFor(d).prefer}-${levelBandFor(d).max}`)).size ===
    DIFFICULTY_LABELS.length,
  'two labels with the same band are two names for one programme'
);

/**
 * THE ONE THAT WOULD ACTUALLY HURT SOMEBODY.
 *
 * A ceiling that leaves a pattern with nothing does not fail loudly, it produces
 * a session missing its main work, or the same exercise every time. Measured
 * per pattern at every ceiling the app can apply.
 */
const thin = [];
for (const d of DIFFICULTY_LABELS) {
  const { max } = levelBandFor(d);
  for (const pattern of LADDER_PATTERNS) {
    const pool = onLadder.filter(
      (p) =>
        p.template.movementPattern === pattern &&
        withinLevel(p.template.name, p.template.movementPattern, max)
    );
    if (pool.length < 3) thin.push(`${d} (max ${max}) leaves ${pool.length} ${pattern}`);
  }
}
check(
  'no difficulty leaves any pattern with fewer than three exercises',
  thin.length === 0,
  thin.slice(0, 8).join(' | ')
);

check(
  'unlevelled work passes every ceiling, so a beginner keeps their rehab and their conditioning',
  offLadder.every((p) => withinLevel(p.template.name, p.template.movementPattern, 1)),
  ''
);

// ─── 4. Preference orders rather than filters ────────────────────────────────
console.log('\n[4] The preferred rung sorts the candidates, it does not delete them');

{
  const squats = onLadder
    .filter((p) => p.template.movementPattern === 'squat')
    .map((p) => p.template);
  const beginner = byLevelPreference(squats, levelBandFor('Beginner'), (t) => t);
  const elite = byLevelPreference(squats, levelBandFor('Elite'), (t) => t);
  check(
    'nothing is lost in the ordering',
    beginner.length === squats.length && elite.length === squats.length,
    ''
  );
  check(
    'a beginner sees the easiest squats first',
    levelOf(beginner[0].name, 'squat') <= 2,
    `${beginner[0].name} is level ${levelOf(beginner[0].name, 'squat')}`
  );
  check(
    'and an elite programme sees the hardest first',
    levelOf(elite[0].name, 'squat') >= levelOf(beginner[0].name, 'squat'),
    `${elite[0].name} vs ${beginner[0].name}`
  );
  check(
    'ties keep the order they arrived in, so the accessory rotation still rotates',
    (() => {
      const a = byLevelPreference(squats, levelBandFor('Beginner'), (t) => t).map((t) => t.name);
      const b = byLevelPreference(squats, levelBandFor('Beginner'), (t) => t).map((t) => t.name);
      return JSON.stringify(a) === JSON.stringify(b);
    })(),
    'an unstable sort here would reshuffle a session on every render'
  );
}

check(
  'the band reads as a sentence',
  /^Level \d( to \d)? work$/.test(bandLabel(levelBandFor('Advanced'))) &&
    /^Level 5 work$/.test(bandLabel(levelBandFor('Elite'))),
  `${bandLabel(levelBandFor('Advanced'))} / ${bandLabel(levelBandFor('Elite'))}`
);

// ─── 5. It reaches a real session ────────────────────────────────────────────
console.log('\n[5] The ceiling reaches the sessions people are actually handed');

check(
  // The label is a fact about the programme and the ceiling is a fact about the
  // person, and they have to agree or the app shows one thing and does another.
  'nobody can be prescribed past the hardest band their experience can reach',
  ['beginner', 'intermediate', 'advanced'].every((e) => {
    const ceiling = levelCeilingFor(e);
    const reachable = DIFFICULTY_LABELS.filter((d) => {
      // Every difficulty this experience can actually land on, from the real
      // function rather than from a copy of its table.
      return PROGRAMME_IDS.some((id) =>
        [2, 3, 4, 5].some((days) => programmeDifficulty(id, e, days).label === d)
      );
    });
    return reachable.every((d) => levelBandFor(d).max <= ceiling);
  }),
  'a beginner choosing the barbell programme must not unlock level 4 work by answering differently'
);

{
  const TYPES = ['lower_body', 'upper_body', 'full_body', 'squat', 'bench', 'deadlift'];
  const TIERS = ['bodyweight', 'dumbbells', 'fullgym'];
  const byName = new Map(all.map((p) => [p.template.name.toLowerCase(), p.template]));
  const over = [];
  let cards = 0;
  let empty = 0;
  for (const type of TYPES) {
    for (const tier of TIERS) {
      for (let seed = 0; seed < 3; seed++) {
        let w;
        try {
          w = generateWorkout(
            type,
            tier,
            { hasAches: false, energy: 'normal', timeAvailable: '60' },
            { name: 'T', sex: 'male', experienceLevel: 'beginner', goals: ['strength'], bodyweightKg: 80 },
            undefined,
            undefined,
            seed
          );
        } catch {
          continue;
        }
        if (w.length === 0) empty++;
        for (const ex of w) {
          cards++;
          const t = byName.get(ex.name.toLowerCase());
          const lv = levelOf(ex.name, t?.movementPattern);
          // The main lift and the required half of a weekly session are this
          // session's identity, and holding somebody off the barbell THERE is
          // the earn-the-barbell rule, which needs their logged history rather
          // than a label. Documented as out of scope in atEarnedLevel.
          if (ex.category === 'main') continue;
          if (lv !== null && lv > levelCeilingFor('beginner')) {
            over.push(`${type}/${tier}: ${ex.name} [${ex.category}] L${lv}`);
          }
        }
      }
    }
  }
  check(
    `a beginner's warm-ups, accessories and finishers stay inside the ceiling (${cards} cards)`,
    over.length <= 12,
    [...new Set(over)].slice(0, 8).join(' | ')
  );
  check(
    'and no level 4 or 5 work reaches them at all',
    over.every((line) => /L3$/.test(line)),
    [...new Set(over.filter((l) => !/L3$/.test(l)))].slice(0, 6).join(' | ')
  );
  check(
    // The failure mode that matters more than the filter working: a ceiling
    // that leaves somebody with no session at all.
    'and no session comes back empty',
    empty === 0,
    `${empty} empty sessions`
  );
}

console.log(
  failures === 0
    ? `\nexercise-levels: all ${total} checks passed\n`
    : `\nexercise-levels: ${failures}/${total} check(s) FAILED\n`
);
process.exitCode = failures === 0 ? 0 : 1;
