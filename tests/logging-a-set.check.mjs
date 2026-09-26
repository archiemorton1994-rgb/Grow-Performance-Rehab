/**
 * Contract test: everything loadable can be given a weight, and the box says
 * which unit that weight is in.
 *
 * WHAT ARCHIE SAID, 25 SEPTEMBER 2026, AFTER TESTING ON EXPO
 * ──────────────────────────────────────────────────────────
 *   "On some exercises it's not giving option to put weight in."
 *   "Sled rows - it shouldn't say reps it should just say weight and distance
 *    in m (metres)."
 *   "When putting in weights during session it should say either kg or lbs,
 *    currently doesn't show the metric."
 *
 * He hit the first one on a Dumbbell Suitcase Hold. "On some exercises" is the
 * part that matters, so this file measures the rule rather than the one card.
 *
 * WHAT WAS WRONG, MEASURED BEFORE THE CHANGE OVER THE SWEEP BELOW
 * ───────────────────────────────────────────────────────────────
 * 24,960 real sessions, 1,346 distinct cards.
 *
 *                                                             before   after
 *   cards prescribed a weight in kg with no weight box           26       0
 *   cards asked for reps when the prescription is metres        111       0
 *   rehab drills whose rep count was swallowed by a hold         35       0
 *   cards showing a weight box with no suggestion in it          23      13
 *
 * The 26 were four barbell main lifts at 40-100 kg printing the word
 * "Bodyweight" because the load line also mentions a band, and the loaded holds
 * - Dumbbell Suitcase Hold, Cable Pallof Hold and the rest - which were read as
 * pure time work because the prescription says 30s.
 *
 * THE LAST ROW DOES NOT GO TO ZERO, ON PURPOSE. The thirteen that remain are
 * all Sled Push and Sled Pull and Push, where the library describes the load ("Moderate
 * sled") instead of naming a number. Plates go on a sled, so the box belongs
 * there, it arrives empty, and nothing has to be typed into it. The ones that
 * DID have to go are the bike, the rower, the treadmill, the skipping rope and
 * the two crawls: adding the unit label put the word "kg" beside an empty box
 * on an assault bike, which is worse than the blank it replaced. Section [3b]
 * is where that line is drawn, and it is drawn by name.
 *
 * HOW THIS FILE ASKS THE QUESTION
 * ───────────────────────────────
 * By driving the real generator and reading the cards that come back, never by
 * reading a table of exercise names. A name list goes stale the day somebody
 * adds a record; the generator cannot. Lists of names appear in exactly two
 * places, both on purpose: section [2], where the exercises ARCHIE NAMED are
 * checked one by one so a rename says so out loud instead of passing on an
 * empty set, and section [3b], where whether a weight can be added to a
 * movement is a judgement somebody has to make rather than something to infer
 * from a sentence.
 *
 * Sections:
 *   [0] the sweep is big enough for the rest to mean anything
 *   [1] the classifier agrees with the library's own `dose` field
 *   [2] the exercises Archie named, one by one
 *   [3] THE ENUMERATION: both lists, over every card the app can build
 *  [3b] a load described in words: the sled gets a box, the rower does not
 *  [3c] nothing demands a number the app has not already put in the box
 *   [4] nothing that was unloaded has quietly become loaded
 *   [5] the suggested weight reaches the box, in the user's own unit
 *   [6] the pounds path converts rather than relabels
 *   [7] the screen is wired to this rule and not to a second copy of it
 *
 * Run:  npx tsx tests/logging-a-set.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import './_persist-shim.mjs';
import {
  generateWorkout,
  expandSetTargets,
  getWeightGuideKg,
  templateToExercise,
} from '../lib/workout-engine.ts';
import { LIBRARY_EXERCISES, CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';
import { kgToDisplayUnit, convertLoadString } from '../lib/utils.ts';
import {
  asksHowItFelt,
  doseOfPrescription,
  prescribesAWeight,
  setInputShapeFor,
  targetCountForPrefill,
} from '../lib/set-logging.ts';

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

const sample = (set, n = 4) => [...set].slice(0, n).join(' | ');

// ── The sweep ────────────────────────────────────────────────────────────────

const KITS = [
  [],
  ['dumbbells'],
  ['kettlebells'],
  ['barbell', 'bench'],
  ['fullgym', 'bench', 'sled', 'cable', 'trapbar'],
];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'athlete'];
const GOALS = [['muscle'], ['strength'], ['power'], ['fat_loss'], ['rehab'], ['fitness']];
const TIMES = ['30', '45', '60', '90'];
const TYPES = ['lower_body', 'upper_body', 'full_body', 'conditioning', 'prehab', 'flexibility'];
/** Every area the readiness screen can report, so the rehab slot is walked. */
const REGIONS = [
  null,
  'knee',
  'front_shoulder',
  'rear_shoulder',
  'lower_back',
  'upper_back',
  'neck',
  'ankle_achilles',
  'calf_shin',
  'hamstrings',
  'quads',
  'glutes',
  'hip_groin',
  'wrist',
  'elbow',
  'core_ribs',
  'chest',
  'bicep',
  'tricep',
  'lat_mid_back',
];

/**
 * THE SIXTEEN ARGUMENTS ARE POSITIONAL AND THE LAST TWO ARE EASY TO LOSE.
 *
 * `libraryFacts` is the SIXTEENTH slot and `libraryEpochSessionCount` the
 * fifteenth. A check in this repo has already passed its rotation object into
 * the fifteenth by counting wrong, which silently built one identical session
 * per type instead of six. Named here once so every call site below is the
 * same and can be read.
 */
function buildSession(sessionType, tier, readiness, profile, seed, equipment) {
  return generateWorkout(
    sessionType,
    tier,
    readiness,
    profile,
    undefined, // exerciseFeedback
    undefined, // bestOrmKg
    seed, // strengthSessionCount
    undefined, // lastLoggedWeights
    undefined, // exerciseNormalStreak
    undefined, // lastSessionPerformance
    null, // daysSinceLastSession
    'kg', // loadUnit
    undefined, // exerciseStuckStreak
    undefined, // exerciseRepTarget
    0, // libraryEpochSessionCount
    { equipment, sessionTypeCount: seed }
  );
}

const cards = new Map();
let sessionsBuilt = 0;
const remember = (sessionType, list) => {
  for (const card of list) {
    cards.set(
      `${sessionType}|${card.name}|${card.category}|${card.reps}|${card.suggestedLoad}`,
      { sessionType, card }
    );
  }
};

for (const kit of KITS)
  for (const experienceLevel of LEVELS)
    for (const goals of GOALS)
      for (const timeAvailable of TIMES)
        for (const seed of [0, 1, 2, 3, 4, 5, 6, 7]) {
          const profile = { name: 'T', sex: 'male', experienceLevel, goals, bodyweightKg: 80 };
          const readiness = { hasAches: false, energy: 'normal', timeAvailable };
          for (const sessionType of TYPES) {
            remember(
              sessionType,
              buildSession(sessionType, kit[0] ?? 'bodyweight', readiness, profile, seed, kit)
            );
            sessionsBuilt++;
          }
        }

const FULL_KIT = ['fullgym', 'bench', 'sled', 'cable', 'trapbar'];
for (const painRegion of REGIONS)
  for (const severe of [true, false])
    for (const experienceLevel of ['beginner', 'athlete'])
      for (const seed of [0, 1, 2, 3]) {
        const profile = {
          name: 'T',
          sex: 'female',
          experienceLevel,
          goals: ['rehab'],
          bodyweightKg: 70,
        };
        const readiness = {
          hasAches: painRegion !== null,
          energy: severe ? 'low' : 'normal',
          timeAvailable: '45',
          painRegion: painRegion ?? undefined,
          painSeverity: severe ? 'severe' : 'mild',
        };
        for (const sessionType of TYPES) {
          remember(sessionType, buildSession(sessionType, 'fullgym', readiness, profile, seed, FULL_KIT));
          sessionsBuilt++;
        }
      }

const rows = [...cards.values()];
/** One key per movement, so two spellings of the same exercise are one thing. */
const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const cardsNamed = (name) => rows.filter((r) => key(r.card.name) === key(name));

// ── [0] The sweep ────────────────────────────────────────────────────────────
console.log('\n[0] The sweep is big enough for the rest to mean anything');
check(
  `real sessions were generated (${sessionsBuilt})`,
  sessionsBuilt > 20000,
  `${sessionsBuilt} sessions`
);
check(
  `distinct cards to judge (${cards.size})`,
  cards.size > 900,
  `${cards.size} distinct cards`
);
check(
  'every session type reached the sweep',
  TYPES.every((t) => rows.some((r) => r.sessionType === t)),
  TYPES.filter((t) => !rows.some((r) => r.sessionType === t)).join(', ')
);

// ── [1] The classifier and the library agree ─────────────────────────────────
console.log('\n[1] What the bar reads off a prescription is what the library says it is');
{
  const records = [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES].filter((r) => r.dose);
  check(
    `every library record declares a dose (${records.length})`,
    records.length === LIBRARY_EXERCISES.length + CONDITIONING_EXERCISES.length,
    `${records.length} of ${LIBRARY_EXERCISES.length + CONDITIONING_EXERCISES.length}`
  );
  // 'quality' is a statement about progression, not about the input box: nobody
  // adds reps to a depth jump, but they do five of them, so it counts reps.
  const expected = (dose) => (dose === 'quality' ? 'reps' : dose);
  const disagree = records.filter((r) => doseOfPrescription(r.reps) !== expected(r.dose));
  check(
    'and the prescription on that record reads the same way',
    disagree.length === 0,
    disagree
      .slice(0, 5)
      .map((r) => `${r.name}: "${r.reps}" reads ${doseOfPrescription(r.reps)}, record says ${r.dose}`)
      .join(' | ')
  );
  // The hold inside a rep count must not eat the rep count, and a bare metre
  // must never be read as a minute. Both directions, on the real strings.
  check(
    'a rep count with a hold in it is still a rep count',
    doseOfPrescription('10 reps, hold 5s each') === 'reps' &&
      doseOfPrescription('15 reps (3s down)') === 'reps' &&
      targetCountForPrefill('10 reps, hold 5s each') === '10',
    `"10 reps, hold 5s each" reads ${doseOfPrescription('10 reps, hold 5s each')}`
  );
  check(
    'a pure hold is not a rep count',
    doseOfPrescription('30s each side') === 'time' &&
      doseOfPrescription('30-45s') === 'time' &&
      doseOfPrescription('3 min (slow deep breaths)') === 'time',
    `"30-45s" reads ${doseOfPrescription('30-45s')}`
  );
  check(
    'metres are metres and minutes are minutes',
    doseOfPrescription('40 m each side') === 'distance' &&
      doseOfPrescription('500 m') === 'distance' &&
      doseOfPrescription('2 min') === 'time',
    `"2 min" reads ${doseOfPrescription('2 min')}`
  );
}

// ── [2] The exercises Archie named ───────────────────────────────────────────
console.log('\n[2] The exercises Archie named, one at a time');
{
  /**
   * Built through templateToExercise - the one function every card in the app
   * is built through - so these are cards and not table rows, and a record the
   * rotation happens not to reach today is still judged.
   */
  const cardFor = (name) => {
    const record = [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES].find(
      (r) => key(r.name) === key(name)
    );
    return record ? templateToExercise(record) : null;
  };

  const BAND_RESISTED = [
    'Band Resisted Back Squats',
    'Band Resisted Front Squats',
    'Band Resisted Deadlifts',
    'Band Resisted Barbell Press',
  ];
  for (const name of BAND_RESISTED) {
    const card = cardFor(name);
    const shape = card && setInputShapeFor(card);
    check(
      `${name}: a real weight box, because the number recorded is the bar`,
      !!shape && shape.weight === true && shape.count === 'reps' && shape.weightRequired === true,
      card ? `load "${card.suggestedLoad}" gave ${JSON.stringify(shape)}` : 'record not found'
    );
  }

  const LOADED_HOLDS = [
    'Dumbbell Suitcase Hold',
    'Barbell Suitcase Hold',
    'Cable Pallof Hold',
    'Kettlebell Marches',
  ];
  for (const name of LOADED_HOLDS) {
    const card = cardFor(name);
    const shape = card && setInputShapeFor(card);
    check(
      `${name}: the weight only, seconds stay fixed`,
      !!shape && shape.weight === true && shape.count === null,
      card ? `reps "${card.reps}" load "${card.suggestedLoad}" gave ${JSON.stringify(shape)}` : 'record not found'
    );
  }

  const LOADED_CARRIES = [
    'Dumbbell Farmers Carry',
    'Kettlebell Farmers Carry',
    'Trapbar Farmers Carry',
    'Dumbbell Suitcase Carry',
    'Kettlebell Suitcase Carry',
    'Waiter Carry',
    'Earthquake Carry',
  ];
  for (const name of LOADED_CARRIES) {
    const card = cardFor(name);
    const shape = card && setInputShapeFor(card);
    check(
      `${name}: the weight only, metres stay fixed`,
      !!shape && shape.weight === true && shape.count === null,
      card ? `reps "${card.reps}" gave ${JSON.stringify(shape)}` : 'record not found'
    );
  }

  {
    const card = cardFor('Sled Rows');
    const shape = card && setInputShapeFor(card);
    check(
      'Sled Rows: weight and metres, and never reps',
      !!shape && shape.weight === true && shape.count === 'metres',
      card ? `reps "${card.reps}" gave ${JSON.stringify(shape)}` : 'record not found'
    );
    // In a Conditioning session the same record is rewritten into a timed
    // interval before it reaches the screen, and a metres box there would be
    // asking for something nobody was told to do.
    const conditioning = cardsNamed('Sled Rows').filter((r) => r.sessionType === 'conditioning');
    check(
      `and in a Conditioning session, where it is rewritten as an interval, it still offers the weight (${conditioning.length} cards)`,
      conditioning.length > 0 &&
        conditioning.every((r) => {
          const s = setInputShapeFor(r.card);
          return s.weight === true && s.count === null;
        }),
      sample(new Set(conditioning.map((r) => `${r.card.reps} -> ${JSON.stringify(setInputShapeFor(r.card))}`)))
    );
  }

  // The 32 rehab drills written as a rep count with a hold inside it. Found in
  // the sweep rather than listed, because they live in three different files.
  const holdInAReps = rows.filter(
    (r) => /\d\s*reps?\b/i.test(r.card.reps) && /\d+\s*s\b/.test(r.card.reps)
  );
  check(
    `rehab drills written "10 reps, hold 5s each" were found in the sweep (${holdInAReps.length} cards)`,
    holdInAReps.length > 20,
    `${holdInAReps.length} cards`
  );
  const lostTheirCount = holdInAReps.filter((r) => setInputShapeFor(r.card).count !== 'reps');
  check(
    'and every one of them has its rep counter',
    lostTheirCount.length === 0,
    sample(new Set(lostTheirCount.map((r) => `${r.card.name} "${r.card.reps}"`)))
  );
  const prefills = holdInAReps.filter((r) => targetCountForPrefill(r.card.reps) === '');
  check(
    'and the counter arrives holding the prescribed number, not empty',
    prefills.length === 0,
    sample(new Set(prefills.map((r) => `${r.card.name} "${r.card.reps}"`)))
  );
}

// ── [3] The enumeration ──────────────────────────────────────────────────────
console.log('\n[3] THE ENUMERATION: both lists, over every card the app can build');
{
  const noWeightBox = new Set();
  const wrongCounter = new Set();
  for (const { sessionType, card } of rows) {
    const shape = setInputShapeFor(card);
    if (prescribesAWeight(card.suggestedLoad) && !shape.weight) {
      noWeightBox.add(`${card.name} [${card.category}/${sessionType}] "${card.suggestedLoad}"`);
    }
    if (shape.count === 'reps' && doseOfPrescription(card.reps) !== 'reps') {
      wrongCounter.add(`${card.name} [${card.category}/${sessionType}] "${card.reps}"`);
    }
  }
  check(
    'NOTHING prescribed a weight in kilograms is left without a weight box',
    noWeightBox.size === 0,
    `${noWeightBox.size}: ${sample(noWeightBox)}`
  );
  check(
    'NOTHING written in seconds or metres is asked for in reps',
    wrongCounter.size === 0,
    `${wrongCounter.size}: ${sample(wrongCounter)}`
  );

  // Both lists being empty is worth nothing if the sweep never met the cards
  // that used to be on them, so count them here rather than trusting it.
  const loadedNotInReps = rows.filter(
    (r) => prescribesAWeight(r.card.suggestedLoad) && doseOfPrescription(r.card.reps) !== 'reps'
  );
  check(
    `the sweep did meet loaded work prescribed in seconds or metres (${loadedNotInReps.length} cards)`,
    loadedNotInReps.length > 20,
    `${loadedNotInReps.length} cards`
  );
  const bandWithKg = rows.filter(
    (r) =>
      r.card.suggestedLoad.toLowerCase().includes('band') && prescribesAWeight(r.card.suggestedLoad)
  );
  check(
    `and it met loads that name both a band and a weight (${bandWithKg.length} cards)`,
    bandWithKg.length > 0,
    `${bandWithKg.length} cards`
  );
  const metreWork = rows.filter((r) => doseOfPrescription(r.card.reps) === 'distance');
  check(
    `and it met work written in metres (${metreWork.length} cards)`,
    metreWork.length > 20,
    `${metreWork.length} cards`
  );
}

// ── [3b] The load that is described rather than prescribed ───────────────────
console.log('\n[3b] Where the load is described in words, only the kit that holds a weight gets a box');
{
  /**
   * Some load lines name neither a weight nor bodyweight, they describe an
   * effort: "Moderate sled", "Steady pace", "Brisk walk on an incline", "Soft
   * ball or rolled towel", and "Easy pace", which the warm-up slot writes over
   * a conditioning movement's real load. A weight box belongs on some of those
   * and not the others.
   *
   * BOTH LISTS ARE PINNED BY NAME ON PURPOSE, and a card that is on neither
   * fails this section. That is the point: whether a weight can be added to a
   * movement is a judgement, not something to infer from a sentence, and the
   * quiet default is what this whole phase was cleaning up. A new machine, a
   * new crawl or a new piece of loadable kit lands here and gets decided.
   */
  const CAN_TAKE_A_WEIGHT = ['Sled Push', 'Sled Pull and Push'];
  const NO_WEIGHT_TO_CHOOSE = [
    'Assault Bike',
    'Rowing Machine',
    'Incline Treadmill Walk',
    'Skipping',
    'Duck Walks',
    'Bear Crawl',
    'Isometric Adductor Squeeze (Ball or Towel)',
  ];
  const named = (list, name) => list.some((n) => key(n) === key(name));
  const describedNotPrescribed = rows.filter(({ card }) => {
    const lower = card.suggestedLoad.toLowerCase();
    if (prescribesAWeight(card.suggestedLoad)) return false;
    return !(
      lower.startsWith('bodyweight') ||
      lower.includes('band') ||
      lower === 'low intensity'
    );
  });
  check(
    `the sweep met loads described in words rather than named in kilograms (${describedNotPrescribed.length} cards)`,
    describedNotPrescribed.length > 20,
    `${describedNotPrescribed.length} cards`
  );

  // NOTHING UNCLASSIFIED. The guarantee that makes the two lines below mean
  // something: a described load the app can print and neither list has heard of
  // stops the check rather than falling to a default.
  const unclassified = describedNotPrescribed.filter(
    (r) => !named(NO_WEIGHT_TO_CHOOSE, r.card.name) && !named(CAN_TAKE_A_WEIGHT, r.card.name)
  );
  check(
    'every load described in words belongs to a movement somebody has ruled on',
    unclassified.length === 0,
    `${unclassified.length}: ${sample(new Set(unclassified.map((r) => `${r.card.name} "${r.card.suggestedLoad}"`)))}`
  );

  const machineCards = describedNotPrescribed.filter((r) => named(NO_WEIGHT_TO_CHOOSE, r.card.name));
  check(
    'a bike, a rower, a treadmill, a rope, a crawl and a squeezed towel are offered no weight box',
    machineCards.every((r) => setInputShapeFor(r.card).weight === false),
    sample(
      new Set(
        machineCards
          .filter((r) => setInputShapeFor(r.card).weight)
          .map((r) => `${r.card.name} "${r.card.suggestedLoad}"`)
      )
    )
  );
  // Not vacuous: those cards have to be in the sweep for the line above to mean
  // anything, and every one of them used to show the box with "kg" over it.
  check(
    `and there were plenty of them to get wrong (${machineCards.length} cards)`,
    machineCards.length > 10,
    `${machineCards.length} cards`
  );

  // THE OTHER HALF: a sled takes plates, so the weight is worth recording even
  // though the library never names a number for it. This is the one place the
  // phrase "loadable in real life" has to be honoured against the app rather
  // than against the prescription.
  const sleds = describedNotPrescribed.filter((r) => named(CAN_TAKE_A_WEIGHT, r.card.name));
  check(
    `while a sled, which takes plates, still gets one (${sleds.length} cards)`,
    sleds.length > 5 && sleds.every((r) => setInputShapeFor(r.card).weight === true),
    sample(
      new Set(
        sleds.filter((r) => !setInputShapeFor(r.card).weight).map((r) => `${r.card.name} "${r.card.suggestedLoad}"`)
      )
    )
  );
  // An empty box nobody has to fill in. The sled is the only card in the app
  // that offers a weight without suggesting one, so it must not block.
  check(
    'and it never stands in the way of ticking the set off, because no number was suggested',
    sleds.every((r) => setInputShapeFor(r.card).weightRequired === false),
    sample(new Set(sleds.filter((r) => setInputShapeFor(r.card).weightRequired).map((r) => r.card.name)))
  );
}

// ── [3c] A demanded weight is one the app already filled in ──────────────────
console.log('\n[3c] Nothing demands a number the app has not already put in the box');
{
  const guidesFor = (card, unit) =>
    card.loadKg
      ? expandSetTargets(card.category, card.sets, card.loadKg, unit)
      : getWeightGuideKg(card.category, card.sets, card.suggestedLoad, unit);
  /**
   * `weightRequired` disables the Did It button until a weight is entered. That
   * is only fair where the box arrives holding the prescribed weight, so the
   * person is being asked not to delete it rather than to invent a number.
   */
  const demandedButEmpty = rows.filter(
    (r) => setInputShapeFor(r.card).weightRequired && !guidesFor(r.card, 'kg').some((g) => g > 0)
  );
  check(
    'every card that demands a weight arrives with one in the box',
    demandedButEmpty.length === 0,
    sample(new Set(demandedButEmpty.map((r) => `${r.card.name} "${r.card.suggestedLoad}"`)))
  );
  const demanded = rows.filter((r) => setInputShapeFor(r.card).weightRequired);
  check(
    `and the loaded work does demand it (${demanded.length} cards)`,
    demanded.length > 200,
    `${demanded.length} cards`
  );
  // The rehab exception, which is not new: "Light dumbbell 1-2 kg" on a wrist
  // extension assumes an elbow that can hold 1 kg, and the movement is worth
  // doing unweighted by somebody whose elbow cannot.
  const prehabDemanded = rows.filter(
    (r) => r.card.category === 'prehab' && setInputShapeFor(r.card).weightRequired
  );
  check(
    'and a rehab drill never demands one, so the log can say nothing was held',
    prehabDemanded.length === 0,
    sample(new Set(prehabDemanded.map((r) => r.card.name)))
  );
}

// ── [4] Nothing unloaded has quietly become loaded ───────────────────────────
console.log('\n[4] The counterweight: bodyweight work is still bodyweight work');
{
  const gained = rows.filter(({ card }) => {
    const lower = card.suggestedLoad.toLowerCase();
    const saysUnloaded =
      lower.startsWith('bodyweight') || lower.includes('band') || lower === 'low intensity';
    return saysUnloaded && !prescribesAWeight(card.suggestedLoad) && setInputShapeFor(card).weight;
  });
  check(
    'no card whose load names no weight has been given a weight box',
    gained.length === 0,
    sample(new Set(gained.map((r) => `${r.card.name} "${r.card.suggestedLoad}"`)))
  );
  const plainBodyweight = rows.filter((r) =>
    r.card.suggestedLoad.toLowerCase().startsWith('bodyweight')
  );
  check(
    `and there were plenty of them to get wrong (${plainBodyweight.length} cards)`,
    plainBodyweight.length > 100,
    `${plainBodyweight.length} cards`
  );

  // The feedback question exists to move the next set's weight, so it must not
  // appear where there is no weight for it to move. That is what stopped it
  // interrupting breathing drills and stretches.
  const askedWithoutAWeight = rows.filter(
    (r) => asksHowItFelt(r.card) && !prescribesAWeight(r.card.suggestedLoad)
  );
  check(
    'and none of them is asked how the set felt',
    askedWithoutAWeight.length === 0,
    sample(new Set(askedWithoutAWeight.map((r) => `${r.card.name} "${r.card.suggestedLoad}"`)))
  );
  const askedOnRealLifts = rows.filter((r) => r.card.category === 'main' && asksHowItFelt(r.card));
  check(
    `while the main lifts still are (${askedOnRealLifts.length} cards)`,
    askedOnRealLifts.length > 50,
    `${askedOnRealLifts.length} cards`
  );
}

// ── [5] The suggestion reaches the box ───────────────────────────────────────
console.log('\n[5] A weight that is printed on the card reaches the box under it');
{
  const guidesFor = (card, unit) =>
    card.loadKg
      ? expandSetTargets(card.category, card.sets, card.loadKg, unit)
      : getWeightGuideKg(card.category, card.sets, card.suggestedLoad, unit);

  const empty = new Set();
  for (const { sessionType, card } of rows) {
    if (!prescribesAWeight(card.suggestedLoad)) continue;
    if (!setInputShapeFor(card).weight) continue;
    if (!guidesFor(card, 'kg').some((g) => g > 0)) {
      empty.add(`${card.name} [${card.category}/${sessionType}] "${card.suggestedLoad}"`);
    }
  }
  check(
    'every card that names a weight puts a number in the box',
    empty.size === 0,
    `${empty.size}: ${sample(empty)}`
  );

  // The categories this used to return zeros for. Counted, so "no empties"
  // cannot pass by those cards having disappeared from the app.
  const explosive = rows.filter(
    (r) =>
      ['neuro', 'finisher', 'cardio'].includes(r.card.category) &&
      prescribesAWeight(r.card.suggestedLoad)
  );
  check(
    `the explosive and finisher work is in the sweep (${explosive.length} cards)`,
    explosive.length > 15,
    `${explosive.length} cards`
  );
  check(
    'and all of it now carries its suggestion',
    explosive.every((r) => guidesFor(r.card, 'kg').some((g) => g > 0)),
    sample(new Set(explosive.filter((r) => !guidesFor(r.card, 'kg').some((g) => g > 0)).map((r) => r.card.name)))
  );
  // A load that names no weight must still come back empty: the fix must not
  // invent a number for "Easy pace".
  const paceCards = rows.filter((r) => !prescribesAWeight(r.card.suggestedLoad));
  const invented = paceCards.filter((r) => guidesFor(r.card, 'kg').some((g) => g > 0));
  check(
    `and a load with no weight in it still suggests nothing (${paceCards.length} cards)`,
    invented.length === 0,
    sample(new Set(invented.map((r) => `${r.card.name} "${r.card.suggestedLoad}" -> ${guidesFor(r.card, 'kg')}`)))
  );
}

// ── [6] The pounds path ──────────────────────────────────────────────────────
console.log('\n[6] Pounds are converted, not a kilogram number wearing a lbs label');
{
  const guidesFor = (card, unit) =>
    card.loadKg
      ? expandSetTargets(card.category, card.sets, card.loadKg, unit)
      : getWeightGuideKg(card.category, card.sets, card.suggestedLoad, unit);

  const loaded = rows.filter(
    (r) => prescribesAWeight(r.card.suggestedLoad) && setInputShapeFor(r.card).weight
  );
  check(`loaded cards to convert (${loaded.length})`, loaded.length > 200, `${loaded.length}`);

  // What the bar actually prints: kgToDisplayUnit of the guide, with the unit
  // after it. A pounds number must be about 2.2x the kilogram one.
  //
  // Judged on the WORKING weight - the top of the ramp - and not on set one.
  // The two grids have different floors (2.5 kg is 5.5 lbs; the lightest pound
  // step is 2.5 lbs) so the warm-up rung of a very light main lift legitimately
  // rounds to a different fraction in each unit. The weight the exercise is
  // actually prescribed at is the one that must convert.
  const workingKg = (card, unit) => Math.max(0, ...guidesFor(card, unit));
  const unconverted = loaded.filter((r) => {
    const kg = workingKg(r.card, 'kg');
    const lbs = kgToDisplayUnit(workingKg(r.card, 'lbs'), 'lbs');
    if (!kg || !lbs) return true;
    return lbs < kg * 1.9;
  });
  check(
    'the number beside "lbs" is a pounds number',
    unconverted.length === 0,
    sample(
      new Set(
        unconverted.map(
          (r) =>
            `${r.card.name}: ${workingKg(r.card, 'kg')} kg vs ${kgToDisplayUnit(workingKg(r.card, 'lbs'), 'lbs')} lbs`
        )
      )
    )
  );

  // And the card above the box agrees with it, which is the bug this repo has
  // had before: the card said 143 lbs and the box prefilled 143.3.
  const disagrees = loaded.filter((r) => {
    const printed = convertLoadString(r.card.suggestedLoad, 'lbs');
    const first = printed.match(/\d+(?:\.\d+)?/);
    if (!first) return true;
    const boxed = kgToDisplayUnit(guidesFor(r.card, 'lbs').find((g) => g > 0) ?? 0, 'lbs');
    // Only the flat-loaded work can be compared straight across; a main lift's
    // first set is a warm-up percentage of the number the card prints.
    if (r.card.category === 'main') return false;
    return Math.abs(parseFloat(first[0]) - boxed) > 0.05;
  });
  check(
    'and the weight printed on the card is the weight prefilled in the box',
    disagrees.length === 0,
    sample(
      new Set(
        disagrees.map(
          (r) =>
            `${r.card.name}: card "${convertLoadString(r.card.suggestedLoad, 'lbs')}" box ${kgToDisplayUnit(guidesFor(r.card, 'lbs').find((g) => g > 0) ?? 0, 'lbs')}`
        )
      )
    )
  );
}

// ── [7] The screen is wired to this rule ─────────────────────────────────────
console.log('\n[7] The session screen asks this module rather than keeping its own copy');
{
  const source = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');
  check(
    'the screen imports the rule',
    /from '@\/lib\/set-logging'/.test(source),
    'the two regular expressions that used to live in session.tsx are gone'
  );
  check(
    'and no copy of the old load test is left behind',
    !/function isLoadBandOrBodyweight/.test(source) && !/function isRepsTimeBased/.test(source),
    'a second copy is how the card and the bar came to disagree'
  );
  check(
    'the weight box carries the unit whether or not a weight was suggested',
    /\? `suggested \$\{kgToDisplayUnit\(recommendedKg, weightUnit\)\} \$\{weightUnit\}`/.test(
      source
    ) && /: weightUnit\}/.test(source),
    'Archie: "it should say either kg or lbs, currently doesn\'t show the metric"'
  );
  check(
    'and the counter is labelled by what it counts',
    /const countLabel = shape\.count === 'metres' \? 'metres' : 'reps';/.test(source),
    'a 30 m farmer\'s carry read "24 kg x [reps]"'
  );
}

// ── Result ───────────────────────────────────────────────────────────────────
console.log(`\nlogging-a-set: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
