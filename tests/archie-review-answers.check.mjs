/**
 * THE FIVE ANSWERS ARCHIE GAVE ON 21 SEPTEMBER 2026, PINNED.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Six open questions were put to Archie, who is the physiotherapist this app
 * belongs to. He accepted every recommended option. Two of them corrected what
 * the app was doing; three of them confirmed behaviour that was already built
 * and is now easy to undo by accident, because nothing was asserting it.
 *
 * Each section below is headed with the decision in his own terms, so that
 * somebody reading a red line here can tell straight away that a clinician
 * chose this and that changing it is a conversation rather than a code change.
 *
 * HOW EVERY ASSERTION IS WRITTEN
 * ──────────────────────────────
 * By running the real generators over real answers and reading what a person is
 * offered. Nothing here greps a table for a spelling. This repo's commonest
 * defect is a check that pins a word and stays green while the behaviour behind
 * it breaks, so every section sweeps: the knee and wrist cases across every
 * experience level, every kit answer, every session type and a run of session
 * counts, because the rotation seed is the session count and sweeping it is
 * what covers the calendar rather than one lucky day.
 *
 * Each section also carries a COUNTERWEIGHT - something that must still be
 * offered. The cheap way to pass a safety assertion is for the generator to
 * offer nothing at all, and a sweep that only ever looks for an absence cannot
 * tell the difference between "the sled is withheld from a sore knee" and "the
 * sled never reaches anybody".
 *
 * Run:  npx tsx tests/archie-review-answers.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore, EXPERIENCE_LEVELS } from '../lib/store.ts';
import { generateLibrarySession } from '../lib/library-session.ts';
import { generateLibraryConditioningSession } from '../lib/library-conditioning.ts';
import { LIBRARY_EXERCISES, CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';
import {
  RESTRICTED_BY_REGION,
  restrictedTagsFor,
  restrictedTagsOnRecord,
} from '../lib/exercise-safety.ts';
import { ID_MERGE, carryProgressForward } from '../lib/exercise-id-merge.ts';

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

// ─── The sweep, shared by every section ──────────────────────────────────────

/** Every kit answer the app can be given, from nothing to a full gym. */
const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bench'],
  ['bodyweight', 'bands', 'dumbbells'],
  ['bodyweight', 'bands', 'dumbbells', 'bench'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
  ['fullgym', 'bench'],
];
const STRENGTH_TYPES = ['lower_body', 'upper_body', 'full_body'];
const SEVERITIES = ['mild', 'moderate', 'severe'];
/**
 * Eight session counts, which is what sweeps the calendar.
 *
 * The generators rotate on the count rather than on the date - the main
 * exercise every fourth session of its type, every other slot every third, and
 * the conditioning blocks every session - so a check run against one count is a
 * check run on one day of the cycle. Eight clears both rotation periods twice.
 */
const COUNTS = [0, 1, 2, 3, 4, 5, 6, 7];

function profileFor(level, extra = {}) {
  return {
    name: 'Sweep',
    sex: 'female',
    experienceLevel: level,
    goals: ['muscle'],
    bodyweightKg: 72,
    ageYears: 34,
    standingSoreRegions: [],
    clinicalAvoid: [],
    ...extra,
  };
}

function readinessFor(regions, severity, timeAvailable = '60', energy = 'normal') {
  return {
    hasAches: regions.length > 0,
    painRegion: regions.length > 0 ? regions : undefined,
    painSeverity: severity,
    acute: false,
    energy,
    timeAvailable,
  };
}

/**
 * Every card a person with these answers is offered, strength and conditioning,
 * swept over the whole grid. One list of names, because every question below is
 * "was this person offered that".
 */
function everythingOffered(regions, { severity = 'mild', levels = EXPERIENCE_LEVELS } = {}) {
  const cards = [];
  for (const level of levels) {
    for (const equipment of KITS) {
      for (const n of COUNTS) {
        for (const sessionType of STRENGTH_TYPES) {
          const s = generateLibrarySession({
            sessionType,
            equipment,
            readiness: readinessFor(regions, severity),
            profile: profileFor(level),
            sessionTypeCount: n,
            strengthSessionCount: n,
            daysSinceLastSession: null,
          });
          for (const e of s.exercises) cards.push({ ...e, where: `${sessionType}/${level}` });
        }
        for (const timeAvailable of ['30', '45', '60']) {
          const c = generateLibraryConditioningSession({
            equipment,
            readiness: readinessFor(regions, severity, timeAvailable),
            profile: profileFor(level),
            sessionCount: n,
          });
          for (const e of c.exercises) cards.push({ ...e, where: `conditioning/${level}` });
        }
      }
    }
  }
  return cards;
}

const namesIn = (cards) => new Set(cards.map((c) => c.name));

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[1] "Rule sled work out for a sore knee and keep the rest."');
console.log('    Archie, 21 September 2026. Sled Push and Sled Pull, his backwards');
console.log('    drag, are both driven through a loaded knee over the ground.');

const kneeCards = everythingOffered(['knee']);
const kneeNames = namesIn(kneeCards);

/**
 * Named rather than derived, and that is right here: Archie's answer WAS these
 * two exercises. Deriving the list from the tag that withholds them would be
 * the tag testing itself. What the naming needs instead is a guard against a
 * rename quietly emptying it, which is the line below.
 */
const sledDrags = ['Sled Push', 'Sled Pull'];
const conditioningNames = new Set(CONDITIONING_EXERCISES.map((e) => e.name));
check(
  'both sled drags are still on the conditioning list under these names',
  sledDrags.every((n) => conditioningNames.has(n)),
  `a rename would leave the sweep below looking for nothing: ${[...conditioningNames].join(', ')}`
);

const dragsServed = kneeCards.filter((c) => sledDrags.includes(c.name));
check(
  'a sore knee is never offered Sled Push or Sled Pull, in any block',
  dragsServed.length === 0,
  `${dragsServed.length} cards, e.g. ${dragsServed
    .slice(0, 3)
    .map((c) => `${c.name} as ${c.category} in ${c.where}`)
    .join(' | ')}`
);

/**
 * THE WARM-UP ASKED SEPARATELY, BECAUSE IT PICKS ITS OWN CARD.
 *
 * The conditioning session draws its pulse raiser from the same nine as the
 * blocks and by a different index, so "no sled in the blocks" and "no sled in
 * the warm-up" are two claims. The measured fault Archie was asked about was a
 * sled push served AS the warm-up.
 */
const kneeWarmUps = kneeCards.filter((c) => c.category === 'prep');
const dragWarmUps = kneeWarmUps.filter((c) => sledDrags.includes(c.name));
check(
  'and not as the warm-up either, which is where it was found',
  dragWarmUps.length === 0 && kneeWarmUps.length > 0,
  `${dragWarmUps.length} sled warm-ups out of ${kneeWarmUps.length} warm-ups swept`
);

// The counterweight: "keep the rest", in his words.
check(
  'a sore knee still keeps Sled Rows, which is rowed standing still',
  kneeNames.has('Sled Rows'),
  'the legs only brace, so the knee keeps it'
);
const kneeConditioning = [
  'Assault Bike',
  'Rowing Machine',
  'Incline Treadmill Walk',
  'Sled Rows',
].filter((n) => kneeNames.has(n));
check(
  'and a sore knee still gets real conditioning, not an empty session',
  kneeConditioning.length >= 3,
  `kept: ${kneeConditioning.join(', ')}`
);

/**
 * The other half of the same answer: nothing changes for a sore lower back.
 * Sled Rows and the bent-over rows were the "rest" he was asked to keep, and a
 * knee rule written too widely is exactly how they would have been lost.
 */
const backNames = namesIn(everythingOffered(['lower_back']));
for (const name of ['Sled Rows', 'Sled Push', 'Sled Pull']) {
  check(`a sore lower back still keeps ${name}`, backNames.has(name), 'nothing changed there');
}
check(
  'a sore lower back still keeps bent-over rowing',
  ['Barbell Row', 'Bent Over Dumbbell Rows', 'Gorilla Rows'].some((n) => backNames.has(n)),
  'the rows he asked to keep'
);

/**
 * AND THE SLEDS ARE REACHABLE AT ALL, so the assertion above has teeth.
 *
 * Without this, deleting both records from the library outright would turn
 * every line in this section green.
 */
const healthyNames = namesIn(everythingOffered([]));
check(
  'somebody with nothing sore is still offered both sled drags',
  healthyNames.has('Sled Push') && healthyNames.has('Sled Pull'),
  'otherwise "withheld from a sore knee" would be true of everybody'
);

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[2] "Treat both the same and let both through unless the wrist is flaring."');
console.log('    Archie, 21 September 2026, on Door Frame Rows being withheld from a');
console.log('    sore wrist while barbell rows, which load the grip just as hard, were not.');

const DOOR_FRAME = 'Door Frame Rows';
const BARBELL_ROW = 'Barbell Row';
const doorFrameRecord = LIBRARY_EXERCISES.find((e) => e.name === DOOR_FRAME);
const barbellRowRecord = LIBRARY_EXERCISES.find((e) => e.name === BARBELL_ROW);
check(
  'both rows are still in the library to compare',
  !!doorFrameRecord && !!barbellRowRecord,
  'one of them has been renamed or removed'
);

/**
 * THE ANTI-DRIFT ASSERTION, AND IT IS THE POINT OF THIS SECTION.
 *
 * Not "Door Frame Rows survives a sore wrist" on its own - that would stay
 * green if somebody later withheld the barbell row instead and left the two
 * pointing in opposite directions again. What Archie asked for is that the two
 * are treated the same, so the two are asserted against EACH OTHER, over every
 * complaint the app knows and every severity.
 */
const REGIONS = Object.keys(RESTRICTED_BY_REGION);
const diverged = [];
for (const region of REGIONS) {
  for (const severity of SEVERITIES) {
    for (const level of EXPERIENCE_LEVELS) {
      const banned = restrictedTagsFor([region], level, severity);
      const doorOut = restrictedTagsOnRecord(doorFrameRecord, banned).length > 0;
      const barOut = restrictedTagsOnRecord(barbellRowRecord, banned).length > 0;
      if (doorOut !== barOut) {
        diverged.push(
          `${region}/${severity}/${level}: ${DOOR_FRAME} ${doorOut ? 'out' : 'in'}, ${BARBELL_ROW} ${barOut ? 'out' : 'in'}`
        );
      }
    }
  }
}
check(
  'Door Frame Rows and Barbell Row are withheld and kept by exactly the same rule',
  diverged.length === 0,
  `${diverged.length} disagreements, e.g. ${diverged.slice(0, 3).join(' | ')}`
);

// And the consequence, read off real sessions rather than off the tables.
for (const severity of SEVERITIES) {
  const wristNames = namesIn(everythingOffered(['wrist'], { severity }));
  check(
    `a sore wrist at ${severity} is still offered Door Frame Rows`,
    wristNames.has(DOOR_FRAME),
    'the only pulling exercise somebody with no equipment has'
  );
}

/**
 * THE USER-FACING CONSEQUENCE, which is what the decision was actually about:
 * somebody at home with a sore wrist is still given something to pull on.
 */
const homeWristPulls = everythingOffered(['wrist'], { severity: 'mild' }).filter(
  (c) => c.name === DOOR_FRAME
);
check(
  'so a home session with a sore wrist still contains a pull',
  homeWristPulls.length > 0,
  `${homeWristPulls.length} Door Frame Rows cards swept`
);

// The counterweight: letting this one through has not emptied the wrist rule.
const wristNamesMild = namesIn(everythingOffered(['wrist'], { severity: 'mild' }));
const stillWithheld = ['Push Up', 'Plank', 'Barbell Deadlift', 'Chin Ups', 'Sled Rows'].filter(
  (n) => !wristNamesMild.has(n)
);
check(
  'and a sore wrist still loses the things that put weight through the palm',
  stillWithheld.length >= 4,
  `withheld: ${stillWithheld.join(', ')}`
);

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[3] "Every press-up variation is withheld from a sore chest."');
console.log('    Confirmed by Archie, 21 September 2026: his own rehab notes say');
console.log('    "press-ups of any kind, including incline", and they win over the');
console.log('    older rule that kept a press-up as the gentle substitute.');

/**
 * FOUND FROM THE LIBRARY, NOT LISTED BY HAND.
 *
 * A hand-written list of three names is the failure this whole decision is
 * about: the app was telling somebody on the rehab banner that press-ups of any
 * kind were out and then serving them one. Anything Archie adds next month that
 * is a press-up is asked the same question on the day he adds it. Both
 * spellings, because the library writes "Press Ups" and the older records write
 * "Push Up".
 */
const IS_PRESS_UP = /press[-\s]?ups?\b|push[-\s]?ups?\b/i;
const pressUpRecords = LIBRARY_EXERCISES.filter(
  (e) => IS_PRESS_UP.test(e.name) || (e.pattern === 'push' && IS_PRESS_UP.test(e.libraryName ?? ''))
);
check(
  'the library is searched for press-ups rather than three names being typed out',
  pressUpRecords.length >= 5,
  `found ${pressUpRecords.length}: ${pressUpRecords.map((e) => e.name).join(', ')}`
);

const chestBanned = restrictedTagsFor(['chest'], 'intermediate', 'mild');
const unprotected = pressUpRecords.filter(
  (e) => restrictedTagsOnRecord(e, chestBanned).length === 0
);
check(
  'every press-up in the library is withheld from a sore chest',
  unprotected.length === 0,
  `not withheld: ${unprotected.map((e) => e.name).join(', ')}`
);

const chestCards = everythingOffered(['chest']);
const pressUpsServed = chestCards.filter((c) => IS_PRESS_UP.test(c.name));
check(
  'and no session ever puts one in front of somebody whose chest hurts',
  pressUpsServed.length === 0,
  `${pressUpsServed.length} cards, e.g. ${pressUpsServed
    .slice(0, 3)
    .map((c) => `${c.name} in ${c.where}`)
    .join(' | ')}`
);

// The counterweight: press-ups reach everybody else, and a sore chest still trains.
const healthyPressUps = everythingOffered([]).filter((c) => IS_PRESS_UP.test(c.name));
check(
  'press-ups are still offered to somebody whose chest is fine',
  healthyPressUps.length > 0,
  'otherwise the rule above would be true of an empty library'
);
check(
  'and a sore chest still gets a session with pulling in it',
  ['Door Frame Rows', 'Barbell Row', 'Lat Pulldowns', 'Seated Close Grip Rows'].some((n) =>
    namesIn(chestCards).has(n)
  ),
  'decision 11 costs the chest its gentlest push, not the whole session'
);

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[4] "Kettlebell Goblet Squats keeps the existing Goblet Squat identity."');
console.log('    Confirmed by Archie, 21 September 2026, so logged weights carry over');
console.log('    instead of everybody starting again at the first-timer estimate.');

const goblet = LIBRARY_EXERCISES.find((e) => e.name === 'Kettlebell Goblet Squats');
check('Kettlebell Goblet Squats is in the library', !!goblet, 'renamed or removed');

/**
 * AN INHERITED ID, NOT A NEW ONE.
 *
 * Every record written for Archie's library carries a `lib-` id. This one does
 * not, on purpose: it kept the id the old catalogue's Goblet Squat had, which
 * is what every weight anybody has ever logged on a goblet squat is filed
 * under. Giving it a fresh id would be invisible on screen and would hand
 * thirty sessions' worth of progress back to the beginner's guess.
 */
check(
  'it carries the old catalogue id rather than a new library one',
  !!goblet && !goblet.id.startsWith('lib-'),
  `id is ${goblet && goblet.id}`
);
const oldGobletIds = Object.entries(ID_MERGE)
  .filter(([, to]) => to === (goblet && goblet.id))
  .map(([from]) => from);
/**
 * FOUR, NOT "SOME". The old catalogue filed a goblet squat four times over,
 * once per pool it appeared in, and every one of them is somebody's history.
 * A floor of three would let one of the four be dropped in passing and stay
 * green, and nobody would find out until a person opened their first library
 * session and was offered the beginner's guess. Where each mapping POINTS is
 * guarded next door, in tests/exercise-id-merge.check.mjs, which resolves both
 * ends of every pair back to a movement name.
 */
check(
  'and all four goblet squats the old catalogue held point at that same id',
  oldGobletIds.length >= 4,
  `${oldGobletIds.length} ids merged into ${goblet && goblet.id}: ${oldGobletIds.join(', ')}`
);
check(
  'no other library record has claimed that id',
  LIBRARY_EXERCISES.filter((e) => e.id === (goblet && goblet.id)).length === 1,
  'two records sharing an id would write their sets on top of each other'
);

/**
 * THE BEHAVIOUR, WHICH IS THE ONLY THING THAT MATTERS TO A PERSON.
 *
 * A weight logged under an old goblet squat id, carried forward the way the
 * persist migration and the server merge both carry it, has to come back on the
 * Kettlebell Goblet Squats card. Asserted by generating the real session twice
 * and reading the load off the card, once with no history and once with it.
 */
const gobletCase = (() => {
  for (const sessionType of ['lower_body', 'full_body']) {
    for (const equipment of KITS) {
      for (const level of EXPERIENCE_LEVELS) {
        for (const n of COUNTS) {
          const s = generateLibrarySession({
            sessionType,
            equipment,
            readiness: readinessFor([], 'mild'),
            profile: profileFor(level),
            sessionTypeCount: n,
            strengthSessionCount: 20,
            daysSinceLastSession: null,
          });
          const card = s.exercises.find((e) => goblet && e.id === goblet.id);
          if (card) return { sessionType, equipment, level, n, card };
        }
      }
    }
  }
  return null;
})();
check(
  'a real session that contains the goblet squat can be built to read the load off',
  !!gobletCase,
  'nothing to measure the carry-over on'
);

if (gobletCase) {
  const LOGGED = 47.5;
  const failedIds = [];
  for (const oldId of oldGobletIds) {
    const carried = carryProgressForward({ [oldId]: LOGGED });
    const s = generateLibrarySession({
      sessionType: gobletCase.sessionType,
      equipment: gobletCase.equipment,
      readiness: readinessFor([], 'mild'),
      profile: profileFor(gobletCase.level),
      sessionTypeCount: gobletCase.n,
      strengthSessionCount: 20,
      daysSinceLastSession: null,
      lastLoggedWeights: carried,
    });
    const card = s.exercises.find((e) => e.id === goblet.id);
    const kg = card && card.loadKg && card.loadKg[0];
    if (!(kg >= LOGGED)) failedIds.push(`${oldId} -> ${kg}`);
  }
  const before = gobletCase.card.loadKg && gobletCase.card.loadKg[0];
  /**
   * `oldGobletIds.length >= 4` is inside the condition on purpose. Without it,
   * giving the record a fresh id empties that list, the loop below runs no
   * times, and an assertion about carrying weight forward passes by never
   * having looked. Measured: that is exactly what happened the first time this
   * was mutation-tested.
   */
  check(
    'a weight logged on the old goblet squat comes back on this card, from every old id',
    oldGobletIds.length >= 4 && failedIds.length === 0 && before < LOGGED,
    `${oldGobletIds.length} old ids; first-timer estimate ${before} kg; did not carry: ${failedIds.join(' | ')}`
  );
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[5] "An experience level the app does not recognise is treated as');
console.log('    Beginner, never guessed." Confirmed by Archie, 21 September 2026.');
console.log('    Experience is a hard ceiling on what a person is offered, so the only');
console.log('    safe answer to a value nobody recognises is the narrowest one.');

const S = () => useAppStore.getState();
const FRESH = JSON.parse(JSON.stringify(S()));
const freshAccount = () => useAppStore.setState({ ...FRESH });
const SIGNED_UP_AT = '2026-09-21T09:30:00.000Z';
const answers = (experienceLevel) => ({
  name: 'Jo Fielding',
  sex: 'female',
  ageYears: 34,
  bodyweight: 68,
  weightUnit: 'kg',
  experienceLevel,
  goals: ['strength'],
  equipmentTiers: ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
  soreRegions: [],
  clinicalAvoid: [],
});

/**
 * Corrupt, empty and unknown, which are three different ways in.
 *
 * A half-finished draft rehydrated from a build that spelled the levels
 * differently; a field the form never filled in; a value synced down from
 * another device running a version this one has never seen.
 */
const BAD_LEVELS = [
  ['a level from a build this one has never seen', 'elite'],
  ['an empty answer', ''],
  ['nothing at all', undefined],
  ['a null', null],
  ['a number', 3],
  ['an object', { level: 'advanced' }],
  ['the right word in the wrong case', 'Advanced'],
];

const badProfiles = [];
for (const [label, value] of BAD_LEVELS) {
  freshAccount();
  S().completeOnboarding(answers(value), SIGNED_UP_AT);
  const profile = S().userProfile;
  check(
    `${label} signs somebody up as a beginner`,
    profile.experienceLevel === 'beginner',
    `got ${JSON.stringify(profile.experienceLevel)}`
  );
  badProfiles.push({ label, profile, equipment: S().equipmentTiers });
}

// A recognised answer is still kept, or the rule above would just be "everybody
// is a beginner".
freshAccount();
S().completeOnboarding(answers('advanced'), SIGNED_UP_AT);
check(
  'somebody who really did answer Advanced is still Advanced',
  S().userProfile.experienceLevel === 'advanced',
  `got ${S().userProfile.experienceLevel}`
);

/**
 * AND THE CONSEQUENCE, which is the half a value check cannot see.
 *
 * "Treated as beginner" only means anything if it reaches the ceiling. The
 * tables downstream are full of `?? 'intermediate'` fallbacks, so a bad value
 * that survived the sign-up boundary would quietly prescribe level 2 work with
 * nothing on screen to show for it.
 */
const levelByName = new Map(LIBRARY_EXERCISES.map((e) => [e.name.toLowerCase(), e.level]));
function aboveBeginner(profile, equipment) {
  const over = [];
  for (const sessionType of STRENGTH_TYPES) {
    for (const n of COUNTS) {
      const s = generateLibrarySession({
        sessionType,
        equipment,
        readiness: readinessFor([], 'mild'),
        profile,
        sessionTypeCount: n,
        strengthSessionCount: n,
        daysSinceLastSession: null,
      });
      for (const e of s.exercises) {
        const level = levelByName.get(e.name.toLowerCase());
        if (level !== undefined && level > 1) over.push(`${e.name} (level ${level})`);
      }
    }
  }
  return over;
}

for (const { label, profile, equipment } of badProfiles) {
  const over = aboveBeginner(profile, equipment);
  check(
    `${label} is never prescribed an exercise above beginner level`,
    over.length === 0,
    `${over.length} cards, e.g. ${[...new Set(over)].slice(0, 3).join(' | ')}`
  );
}

// The counterweight, again: the ceiling is real rather than the library being
// entirely level 1.
freshAccount();
S().completeOnboarding(answers('advanced'), SIGNED_UP_AT);
const advancedOver = aboveBeginner(S().userProfile, S().equipmentTiers);
check(
  'while somebody who answered Advanced is prescribed above beginner level',
  advancedOver.length > 0,
  'otherwise the ceiling above would be true of any library at all'
);

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${total - failures}/${total} passed`);
if (failures > 0) {
  console.error(`${failures} failed`);
  process.exitCode = 1;
}
