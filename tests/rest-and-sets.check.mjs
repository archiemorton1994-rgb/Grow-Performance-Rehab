/**
 * Contract test: how long you rest, and how many sets you are given.
 *
 * WHAT THIS PINS DOWN
 * ───────────────────
 * Two promises, both of them new, both of them made by a physiotherapist about
 * what the app should do rather than about how it should be written.
 *
 * ── 1. REST FOLLOWS THE MOVEMENT, NOT THE SLOT ──────────────────────────────
 * Three numbers and the goal is not one of the inputs:
 *
 *     3 minutes   the working set of a main lift
 *     2 minutes   a compound, wherever in the session it turns up
 *     1 minute    genuine isolation and pump work
 *
 * Rest used to come out of the GOAL - four minutes on a main lift for someone
 * chasing strength, seventy-five seconds for someone chasing fat loss - and
 * everything else came out of the CATEGORY. Both were wrong in the same way.
 * "Accessory" is a slot, not a kind of movement, and measured over thousands of
 * generated sessions sixty per cent of what lands in it is a record the library
 * itself calls a main lift: Kettlebell Deadlift, Dumbbell Front Squats, Walking
 * Lunges. A flat minute on the category would have put sixty seconds between
 * sets of those.
 *
 * So `Exercise.libraryRole` carries the record's own answer onto the card and
 * `restSecondsForSet` reads that. Section [2] is the one that matters: it runs
 * the real generator and checks the number each real card would actually get,
 * with the counterweights next to the merges so that getting it wrong in the
 * generous direction fails too.
 *
 * And the three minutes is for WORKING sets. A five-set barbell squat is three
 * climbing warm-up rungs, an approach set and then the work; the card has said
 * so on screen for a long time and the clock did not read it. Three minutes
 * between warm-up rungs is not a heavier session, just a much longer one.
 *
 * ── 2. THREE SETS IS WHAT AN ACCESSORY IS ───────────────────────────────────
 * Every one of the forty accessory-role records in the library carries sets: 3,
 * and the old recipe computed a number from the level, the goal and the energy
 * and threw the record's own answer away. Measured, it came out at two sets 41%
 * of the time, three 31%, four 20% and five 7%.
 *
 * Three is the NORMAL, not an absolute, and section [5] is as much about what
 * still takes a set off as about the three. A low-energy day, an easier week
 * and a severe pain report each exist to protect somebody having a bad day, and
 * deleting one of them to honour a round number would be a safety regression
 * dressed up as tidiness.
 *
 * NOTHING HERE GREPS FOR A SPELLING except the four assertions in section [7],
 * which are labelled as the wiring and exist because a node script cannot
 * import a React screen. Everything else runs the real generator, the real
 * deload pass and the real pain screen and reads what comes back.
 *
 * Run:  npx tsx tests/rest-and-sets.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';
import { CONDITIONING_EXERCISES, LIBRARY_EXERCISES } from '../lib/exercise-library.ts';
import { generateLibrarySession } from '../lib/library-session.ts';
import {
  easeForDeloadWeek,
  expandSetTargets,
  generateWorkout,
} from '../lib/workout-engine.ts';
import {
  REST_SECONDS,
  SET_KIND_LABELS,
  restSecondsForSet,
  setKindFor,
} from '../lib/rep-scheme.ts';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

/** One key per movement, so two spellings of the same exercise are one thing. */
const key = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
const roleByKey = new Map();
for (const e of LIBRARY_EXERCISES) roleByKey.set(key(e.name), e.role);
for (const e of CONDITIONING_EXERCISES) roleByKey.set(key(e.name), e.role);

const profileFor = (level, extra = {}) => ({
  name: 'Sweep',
  sex: 'male',
  experienceLevel: level,
  goals: ['muscle'],
  bodyweightKg: 80,
  ageYears: 32,
  standingSoreRegions: [],
  clinicalAvoid: [],
  ...extra,
});
const readinessFor = (energy, extra = {}) => ({
  hasAches: false,
  painSeverity: 'mild',
  acute: false,
  energy,
  timeAvailable: '60',
  ...extra,
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[1] The three numbers are Archie's three numbers");
// ─────────────────────────────────────────────────────────────────────────────

const mainWorking = restSecondsForSet({ category: 'main', libraryRole: 'main' });
const compound = restSecondsForSet({ category: 'accessory', libraryRole: 'main' });
const isolation = restSecondsForSet({ category: 'accessory', libraryRole: 'accessory' });

check(
  'the working set of a main lift rests three minutes',
  mainWorking === 180,
  `${mainWorking}s`
);
check(
  'a compound in the accessory slot rests two minutes',
  compound === 120,
  `${compound}s`
);
check('genuine isolation rests one minute', isolation === 60, `${isolation}s`);
check(
  'and they are in that order, so no two of them can quietly become the same number',
  mainWorking > compound && compound > isolation && isolation > 0,
  `${mainWorking} / ${compound} / ${isolation}`
);

/**
 * The goal is not an input any more, asked as behaviour rather than as a
 * signature.
 *
 * The old table gave a main lift 240s for a strength goal and 75s for fat loss.
 * Both of those people now get the same three minutes on the same movement, and
 * the way to prove it is to build the same session for each of the six goals
 * and compare the number each card would actually get.
 */
{
  const GOALS = [['strength'], ['muscle'], ['fat_loss'], ['rehab'], ['power'], ['fitness']];
  const restsPerGoal = GOALS.map((goals) => {
    const s = generateLibrarySession({
      sessionType: 'lower_body',
      equipment: ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
      readiness: readinessFor('normal'),
      profile: profileFor('intermediate', { goals }),
      sessionTypeCount: 0,
      strengthSessionCount: 0,
      daysSinceLastSession: null,
    });
    const main = s.exercises.find((e) => e.category === 'main');
    return restSecondsForSet({
      category: main.category,
      libraryRole: main.libraryRole,
      setKind: 'working',
    });
  });
  check(
    'the same main lift rests the same for every goal, strength and fat loss included',
    new Set(restsPerGoal).size === 1 && restsPerGoal[0] === 180,
    GOALS.map((g, i) => `${g[0]}=${restsPerGoal[i]}s`).join(' ')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2] Rest follows the movement, over every card the generator builds');
// ─────────────────────────────────────────────────────────────────────────────

const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bands', 'dumbbells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
  ['fullgym', 'bench'],
];
const SWEEP_GOALS = [['strength'], ['muscle'], ['fat_loss'], ['power'], ['fitness']];

/** Every main and accessory card the sweep produced, with what the app knows about it. */
const lifted = [];
/** Accessory cards only, keyed by level and goal, for the set-count sections. */
const accessoryBySituation = [];
let sweptSessions = 0;
for (const sessionType of ['lower_body', 'upper_body', 'full_body']) {
  for (const equipment of KITS) {
    for (const level of EXPERIENCE_LEVELS) {
      for (const goals of SWEEP_GOALS) {
        for (const energy of ['low', 'normal', 'high']) {
          for (let seed = 0; seed < 2; seed++) {
            const session = generateLibrarySession({
              sessionType,
              equipment,
              readiness: readinessFor(energy),
              profile: profileFor(level, { goals }),
              sessionTypeCount: seed,
              strengthSessionCount: seed,
              daysSinceLastSession: null,
            });
            sweptSessions++;
            for (const ex of session.exercises) {
              if (ex.category !== 'main' && ex.category !== 'accessory') continue;
              lifted.push(ex);
              if (ex.category === 'accessory') {
                accessoryBySituation.push({ level, goals, energy, sets: ex.sets, name: ex.name });
              }
            }
          }
        }
      }
    }
  }
}

const accessorySlot = lifted.filter((e) => e.category === 'accessory');
const accCompounds = accessorySlot.filter((e) => e.libraryRole === 'main');
const accIsolation = accessorySlot.filter((e) => e.libraryRole === 'accessory');

check(
  `the sweep is real: ${sweptSessions} sessions, ${lifted.length} lifting cards`,
  sweptSessions > 1000 && accessorySlot.length > 3000,
  `${sweptSessions} sessions, ${accessorySlot.length} accessory cards`
);

/**
 * THE VACUITY GUARD, AND IT IS THE WHOLE POINT OF THE SECTION.
 *
 * If the accessory slot only ever held isolation work there would be nothing to
 * get wrong and the rule below would pass while meaning nothing. It holds both,
 * and the compounds are the majority.
 */
check(
  `the accessory slot really does hold both kinds (${accCompounds.length} compound, ${accIsolation.length} isolation)`,
  accCompounds.length > 0 &&
    accIsolation.length > 0 &&
    accCompounds.length / accessorySlot.length > 0.4,
  `${((100 * accCompounds.length) / accessorySlot.length).toFixed(1)}% of accessory cards are records the library calls main lifts`
);

const compoundRests = new Set(
  accCompounds.map((e) => restSecondsForSet({ category: e.category, libraryRole: e.libraryRole }))
);
const isolationRests = new Set(
  accIsolation.map((e) => restSecondsForSet({ category: e.category, libraryRole: e.libraryRole }))
);
check(
  'every compound in the accessory slot gets two minutes, not the slot minute',
  compoundRests.size === 1 && compoundRests.has(120),
  `rests seen: ${[...compoundRests].join(', ')} - e.g. ${accCompounds[0]?.name}`
);
check(
  'and every genuine isolation card in the same slot gets one',
  isolationRests.size === 1 && isolationRests.has(60),
  `rests seen: ${[...isolationRests].join(', ')} - e.g. ${accIsolation[0]?.name}`
);
check(
  'so the two are not the same answer, which is what the old category rule made them',
  [...compoundRests][0] !== [...isolationRests][0],
  ''
);

/**
 * The barbell case, because it is the one Archie described: "sixty seconds
 * between sets of heavy barbell rowing".
 *
 * The bar is not the test - the ROLE is, and the two come apart. Barbell
 * Suitcase Hold is a barbell movement the library files as an accessory, and it
 * is a loaded hold, so one minute is right for it. Both halves are asserted, so
 * a rule that swept up everything with "barbell" in the name would fail here
 * just as surely as one that gave barbell rowing a minute.
 */
{
  const barbell = accessorySlot.filter((e) => /barbell/i.test(e.name));
  const barbellCompounds = barbell.filter((e) => roleByKey.get(key(e.name)) === 'main');
  const restOf = (e) => restSecondsForSet({ category: e.category, libraryRole: e.libraryRole });
  check(
    `barbell compounds in an accessory slot keep two minutes (${new Set(barbellCompounds.map((e) => e.name)).size} distinct movements)`,
    barbellCompounds.length > 0 && barbellCompounds.every((e) => restOf(e) === 120),
    barbellCompounds.length === 0
      ? 'no barbell compound landed in an accessory slot, so this proves nothing - widen the sweep'
      : [...new Set(barbellCompounds.map((e) => e.name))].slice(0, 4).join(', ')
  );
  /**
   * AND THE OTHER HALF, ASKED OF THE LIBRARY RATHER THAN OF THE SWEEP.
   *
   * It used to be asked of the sweep, and the record that answered it was
   * Barbell Suitcase Hold. On 24 September 2026 the accessory rules capped an
   * accessory at one rung BELOW the main lift, and that record is level 4: no
   * main lift is level 5, so nothing at level 4 can be an accessory any more
   * and the sweep can no longer produce the case. The rule it was proving is
   * untouched - rest reads the ROLE and not the bar - so it is asked of the
   * records themselves, which is where the role lives.
   */
  const barbellAccessoryRecords = LIBRARY_EXERCISES.filter(
    (e) => /barbell/i.test(e.name) && e.role === 'accessory'
  );
  check(
    `but a barbell HOLD gets one whatever slot it lands in, because the rule reads the role and not the bar (${barbellAccessoryRecords.length} record(s))`,
    barbellAccessoryRecords.length > 0 &&
      barbellAccessoryRecords.every(
        (e) =>
          restSecondsForSet({ category: 'accessory', libraryRole: e.role }) === 60 &&
          restSecondsForSet({ category: 'main', libraryRole: e.role, setKind: 'working' }) === 60
      ),
    barbellAccessoryRecords.length === 0
      ? 'the library holds no barbell accessory record, so the counterweight proves nothing'
      : barbellAccessoryRecords.map((e) => e.name).join(', ')
  );
}

/**
 * Isolation in the MAIN slot is still isolation.
 *
 * A bodyweight or bands-only session filed under one of the retired lift ids
 * fills its main slot with Wall Hip Hinge, which the library calls an accessory.
 * The slot would give it three minutes; the movement gives it one.
 */
check(
  'an isolation record that lands in the main slot rests one minute, not three',
  restSecondsForSet({ category: 'main', libraryRole: 'accessory', setKind: 'working' }) === 60 &&
    restSecondsForSet({ category: 'main', libraryRole: 'main', setKind: 'working' }) === 180,
  'the main slot must not be able to hand three minutes to a wall hip hinge'
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[3] The role reaches the card, on every route');
// ─────────────────────────────────────────────────────────────────────────────

const withoutRole = lifted.filter((e) => !e.libraryRole);
check(
  'every main and accessory card arrives carrying the library record’s own role',
  withoutRole.length === 0,
  `${withoutRole.length} card(s) without one, e.g. ${withoutRole[0]?.name}`
);

/**
 * And it is the RIGHT role, not merely a role.
 *
 * Copying the field is easy to do and easy to do from the wrong place. This
 * asks the library what each card's movement actually is and compares.
 */
{
  const wrong = lifted.filter((e) => {
    const truth = roleByKey.get(key(e.name));
    return truth !== undefined && truth !== e.libraryRole;
  });
  const recognised = lifted.filter((e) => roleByKey.get(key(e.name)) !== undefined).length;
  check(
    `the role on the card is the role in the library (${recognised} of ${lifted.length} cards matched to a record)`,
    wrong.length === 0 && recognised > lifted.length * 0.9,
    wrong.length > 0
      ? `${wrong[0].name}: card says ${wrong[0].libraryRole}, library says ${roleByKey.get(key(wrong[0].name))}`
      : 'too few cards matched a record for this to mean anything'
  );
}

/**
 * The other door.
 *
 * generateLibrarySession is not the only way a card is built: the session
 * screen calls generateWorkout, which also serves the retired lift ids, the
 * conditioning builder and Restore. A field that survives one route and not
 * another fails in silence.
 */
{
  const byRoute = [];
  for (const sessionType of [
    'squat',
    'bench',
    'deadlift',
    'lower_body',
    'upper_body',
    'full_body',
    'conditioning',
    'prehab',
    'flexibility',
  ]) {
    for (const tier of ['bodyweight', 'bands', 'dumbbells', 'full']) {
      for (const level of EXPERIENCE_LEVELS) {
        const built = generateWorkout(
          sessionType,
          tier,
          readinessFor('normal'),
          profileFor(level),
          undefined,
          undefined,
          1,
          undefined,
          undefined,
          undefined,
          null,
          'kg',
          undefined,
          undefined,
          {
            equipment:
              tier === 'full'
                ? ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym', 'bench']
                : ['bodyweight'],
            sessionTypeCount: 1,
          }
        );
        const list = Array.isArray(built) ? built : (built?.exercises ?? []);
        for (const ex of list) {
          if (ex.category === 'main' || ex.category === 'accessory') byRoute.push(ex);
        }
      }
    }
  }
  const bare = byRoute.filter((e) => !e.libraryRole);
  const categories = new Set(byRoute.map((e) => e.category));
  check(
    `no lifting card built through generateWorkout has lost its role (${byRoute.length} cards, every session type)`,
    byRoute.length > 400 && categories.size === 2 && bare.length === 0,
    `${bare.length} bare, e.g. ${bare[0]?.name}; categories ${[...categories].join('/')}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4] Three minutes is for working sets, not for the climb');
// ─────────────────────────────────────────────────────────────────────────────

const kindsOf = (n) => Array.from({ length: n }, (_, i) => setKindFor('main', i, n));
const restsOf = (n) =>
  Array.from({ length: n }, (_, i) =>
    restSecondsForSet({ category: 'main', libraryRole: 'main', setKind: setKindFor('main', i, n) })
  );

check(
  'a five-set main lift is three rungs, an approach set and the work',
  kindsOf(5).join(',') === 'warmup,warmup,warmup,approach,working',
  kindsOf(5).join(',')
);
check(
  'and it rests 60, 60, 60, 90, then 180',
  restsOf(5).join(',') === '60,60,60,90,180',
  restsOf(5).join(',')
);
check(
  'so the three minutes is spent once on the card, not five times',
  restsOf(5).filter((s) => s === 180).length === 1 &&
    restsOf(4).filter((s) => s === 180).length === 1 &&
    restsOf(3).filter((s) => s === 180).length === 1,
  `5 sets: ${restsOf(5).join(',')} | 4: ${restsOf(4).join(',')} | 3: ${restsOf(3).join(',')}`
);
check(
  'a warm-up rung rests 60 to 90 seconds, never the working number',
  restsOf(5)
    .slice(0, 4)
    .every((s) => s >= 60 && s <= 90),
  restsOf(5).join(',')
);
check(
  'a short main lift has no approach rung, because there is no room for one',
  !kindsOf(3).includes('approach') && kindsOf(4).includes('approach'),
  `3 sets: ${kindsOf(3).join(',')} | 4 sets: ${kindsOf(4).join(',')}`
);

/**
 * The labels and the clock read the same rule.
 *
 * They were two separate pieces of reasoning until this change, which is how
 * the card came to print "Warm-up" over a countdown from three minutes.
 */
check(
  'the words on the card come from the same function as the number on the clock',
  SET_KIND_LABELS[setKindFor('main', 0, 5)] === 'Warm-up' &&
    SET_KIND_LABELS[setKindFor('main', 3, 5)] === 'Approach set' &&
    SET_KIND_LABELS[setKindFor('main', 4, 5)] === 'Working set',
  JSON.stringify(SET_KIND_LABELS)
);

/**
 * The climb is real, asked of the engine rather than assumed.
 *
 * If a main lift carried the same weight on every set then calling four of them
 * warm-ups would be the app inventing a ramp that is not there, and the short
 * rests would be wrong.
 */
{
  const ramp = expandSetTargets('main', 5, [100], 'kg');
  const climbs = ramp.every((kg, i) => i === 0 || kg > ramp[i - 1]);
  const flat = expandSetTargets('accessory', 4, [40], 'kg');
  check(
    'a main lift really does climb to its working weight, so the rungs really are rungs',
    climbs && ramp[ramp.length - 1] === 100,
    ramp.join(' -> ')
  );
  check(
    'an accessory carries the same weight on every set, so every one of its sets is a working set',
    new Set(flat).size === 1 &&
      Array.from({ length: 4 }, (_, i) => setKindFor('accessory', i, 4)).every(
        (k) => k === 'working'
      ),
    flat.join(', ')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5] Three sets is the accessory normal, and the reductions still bite');
// ─────────────────────────────────────────────────────────────────────────────

{
  const ordinary = accessoryBySituation.filter(
    (a) => a.energy === 'normal' && !a.goals.includes('rehab')
  );
  const setsSeen = new Set(ordinary.map((a) => a.sets));
  check(
    `on an ordinary day an accessory is three sets, whatever the level and the goal (${ordinary.length} cards)`,
    ordinary.length > 500 && setsSeen.size === 1 && setsSeen.has(3),
    `set counts seen: ${[...setsSeen].sort().join(', ')}`
  );

  /**
   * The counterweight: the level and the goal still move the MAIN lift.
   *
   * Without this the assertion above would also pass if set counts had been
   * frozen everywhere, which is a different and worse change.
   */
  const mainSets = new Set(
    lifted.filter((e) => e.category === 'main').map((e) => e.sets)
  );
  check(
    'the main lift still moves with the level, the goal and the energy',
    mainSets.size >= 3,
    `main set counts seen: ${[...mainSets].sort().join(', ')}`
  );

  const lowEnergy = accessoryBySituation.filter(
    (a) => a.energy === 'low' && !a.goals.includes('rehab')
  );
  check(
    `a low-energy day still takes one off (${lowEnergy.length} cards, all at two)`,
    lowEnergy.length > 100 && lowEnergy.every((a) => a.sets === 2),
    `set counts seen: ${[...new Set(lowEnergy.map((a) => a.sets))].join(', ')}`
  );

  const highEnergy = accessoryBySituation.filter((a) => a.energy === 'high');
  check(
    'but a high-energy day does not add one, because three is the dose the library wrote',
    highEnergy.every((a) => a.sets === 3),
    `set counts seen: ${[...new Set(highEnergy.map((a) => a.sets))].join(', ')}`
  );
}

/**
 * Rehab, which is the one standing reduction rather than a bad-day one.
 *
 * Somebody who has told the app they are injured had two accessory sets before
 * this change. Rounding them up to three would be raising an injured person's
 * volume by half to honour a tidy number, which is the wrong direction for the
 * only goal in the list that means "I am hurt".
 */
{
  const rehab = generateLibrarySession({
    sessionType: 'full_body',
    equipment: ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
    readiness: readinessFor('normal'),
    profile: profileFor('intermediate', { goals: ['rehab'] }),
    sessionTypeCount: 0,
    strengthSessionCount: 0,
    daysSinceLastSession: null,
  });
  const accs = rehab.exercises.filter((e) => e.category === 'accessory');
  check(
    'a rehab goal still keeps accessory volume down',
    accs.length > 0 && accs.every((e) => e.sets === 2),
    `sets: ${accs.map((e) => e.sets).join(', ')}`
  );
}

/**
 * An easier week, run through the real deload pass over a real session.
 */
{
  const session = generateLibrarySession({
    sessionType: 'lower_body',
    equipment: ['fullgym', 'bench'],
    readiness: readinessFor('normal'),
    profile: profileFor('intermediate'),
    sessionTypeCount: 0,
    strengthSessionCount: 0,
    daysSinceLastSession: null,
  });
  const before = session.exercises.filter((e) => e.category === 'accessory');
  const after = easeForDeloadWeek(session.exercises, 'kg').filter(
    (e) => e.category === 'accessory'
  );
  check(
    'an easier week still takes a set off a three-set accessory',
    before.length > 0 &&
      before.every((e) => e.sets === 3) &&
      after.every((e) => e.sets === 2),
    `${before.map((e) => e.sets).join(',')} -> ${after.map((e) => e.sets).join(',')}`
  );
  check(
    'and it does not take the last one: nothing drops below two',
    easeForDeloadWeek(
      session.exercises.map((e) => ({ ...e, sets: 2 })),
      'kg'
    ).every((e) => e.sets >= 2),
    'a deload that empties the block is not an easier week, it is a missing one'
  );
}

/**
 * A severe pain report, run through the real pain screen by asking
 * generateWorkout for a session with a sore area at severe.
 */
{
  const args = (readiness) =>
    generateWorkout(
      'lower_body',
      'full',
      readiness,
      profileFor('intermediate'),
      undefined,
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      null,
      'kg',
      undefined,
      undefined,
      {
        equipment: ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym', 'bench'],
        sessionTypeCount: 1,
      }
    );
  const calm = args(readinessFor('normal'));
  const severe = args(
    readinessFor('normal', {
      hasAches: true,
      painRegion: ['knee'],
      painSeverity: 'severe',
      acute: true,
    })
  );
  const accsOf = (w) =>
    (Array.isArray(w) ? w : (w?.exercises ?? [])).filter((e) => e.category === 'accessory');
  const calmSets = accsOf(calm).map((e) => e.sets);
  const severeSets = accsOf(severe).map((e) => e.sets);
  check(
    'a severe pain report still takes a set off the accessory block',
    calmSets.length > 0 &&
      severeSets.length > 0 &&
      calmSets.every((n) => n === 3) &&
      severeSets.every((n) => n === 2),
    `calm ${calmSets.join(',')} vs severe ${severeSets.join(',')}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[6] The cards that deliberately have no clock still have none');
// ─────────────────────────────────────────────────────────────────────────────

for (const category of ['prep', 'finisher', 'cooldown', 'cardio']) {
  check(
    `${category} gets no countdown at all`,
    restSecondsForSet({ category }) === null,
    'a countdown over somebody’s closing breathing is the app interrupting the quiet part'
  );
}
check(
  'the clinical doses keep their own shorter numbers',
  restSecondsForSet({ category: 'prehab' }) === REST_SECONDS.prehab &&
    restSecondsForSet({ category: 'mechanical' }) === REST_SECONDS.mechanical &&
    restSecondsForSet({ category: 'neuro' }) === REST_SECONDS.neuro &&
    REST_SECONDS.prehab < REST_SECONDS.isolation,
  'a mechanical drill has always rested 30-45 seconds and nobody has ever complained about it'
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[7] The wiring, which a node script cannot reach any other way');
// ─────────────────────────────────────────────────────────────────────────────

const sessionCode = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');

check(
  'the screen decides rest from the movement and the kind of set, in one place',
  /restSecondsForSet\(\{[\s\S]{0,200}libraryRole: exercise\.libraryRole,[\s\S]{0,200}setKind: setKindFor\(/.test(
    sessionCode
  ),
  'rest has to be given the role, or it is back to reading the slot'
);
check(
  'it asks about the set that was just logged, not the one coming',
  /if \(sets\[i\]\.completed\) \{/.test(sessionCode) && /justLogged = i;/.test(sessionCode),
  'the three minutes is earned by the working set; the rung before it rests a minute'
);
check(
  'the old per-category fallback table is gone from the timer',
  !/REST_PERIOD_SECONDS/.test(sessionCode),
  'a fallback means a dropped answer silently becomes a different, older prescription instead of an absent clock'
);
check(
  'and the set label on the card comes from the shared rule rather than its own copy',
  /SET_KIND_LABELS\[setKindFor\(/.test(sessionCode),
  'two copies of "which kind of set is this" is how a card comes to say Warm-up over a three-minute countdown'
);

console.log(`\nrest-and-sets: ${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
