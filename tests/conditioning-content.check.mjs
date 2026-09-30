/**
 * Contract test: one sled, a farmers carry, clamshells in reps, a drawn bench.
 *
 * ARCHIE'S FOURTH BATCH OF EXPO FEEDBACK, 30 SEPTEMBER 2026
 * ────────────────────────────────────────────────────────
 *   "Remove the conditioning exercises sled push and sled pull and push from the
 *    database and swap for sled push and pull instead."
 *   "Add farmer carries as a conditioning exercise."
 *   "Banded Clamshells should say reps not seconds."
 *   The "Bench, box or sturdy step" icon "should be a gym bench not a green
 *   rectangle."
 *
 * WHAT EACH SECTION ASSERTS, AND WHY IT IS NOT A SPELLING TEST
 * ──────────────────────────────────────────────────────────
 * [1] THE SLED. Two records became one, so the clinical rule attached to both of
 *     them has to survive the merge. It is proved by generating sessions for
 *     each of the four complaints Archie named - a sore ankle, Achilles, calf
 *     and shin - plus the sore knee that decision 16 covers, and showing the
 *     card is absent from every block of every one of them. The counterweights
 *     are what stop that passing for the wrong reason: somebody with nothing
 *     sore is still offered it, and a sore lower back still keeps all the sled
 *     work, so "withheld" is not simply "deleted".
 *
 *     And the HISTORY, which is the half a rename silently breaks. Two ids
 *     became one, so the retired id's logged sled weight is asserted to read
 *     back on the survivor, and the survivor's own weight is asserted never to
 *     be overwritten by it - the survivor is the lighter of the two
 *     prescriptions, so that direction matters.
 *
 * [2] THE FARMERS CARRY. A new conditioning record is only real if a session
 *     actually serves it, so it is found in generated sessions rather than in
 *     the list. Then the clinical question a loaded carry raises: it is asked of
 *     every region that restricts either of the tags it carries, again by
 *     generating and looking. Then the three implement carries in the Core list
 *     are asserted untouched, because this was an addition and not a move, and a
 *     move would have taken somebody's carry history with it.
 *
 * [3] THE CLAMSHELL. Every Banded Clamshell record in the app is written at
 *     "15 each side" and always was. What put it on a clock was the swap button
 *     handing the new movement the prescription of the card it replaced. So this
 *     sweeps every swap the app can offer, applies the rule, and asserts that
 *     nothing is left counting the wrong thing - plus the two cases that must
 *     NOT change, which are the two-minute cardio opener and a Conditioning
 *     session's interval blocks.
 *
 * [4] THE BENCH. The drawing exists, and it is a bench rather than the one
 *     rectangle Archie complained about: a pad wider than it is deep, legs that
 *     start below it, and a drawing nothing else in the set already is. Two
 *     halves of that claim live elsewhere on purpose - tests/grow-icon.check.mjs
 *     holds every icon inside the 48-unit box, and tests/equipment-tile-art.test.tsx
 *     renders the component to prove the tile really reaches this drawing, which
 *     needs React and cannot be asked from here.
 *
 * Run:  npx tsx tests/conditioning-content.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';
import { generateLibrarySession } from '../lib/library-session.ts';
import { generateLibraryConditioningSession } from '../lib/library-conditioning.ts';
import {
  CONDITIONING_EXERCISES,
  LIBRARY_EXERCISES,
  isPulseRaiser,
} from '../lib/exercise-library.ts';
import { RESTRICTED_BY_REGION, restrictedTagsOnRecord } from '../lib/exercise-safety.ts';
import { canonicalExerciseName } from '../lib/exercise-aliases.ts';
import { ID_MERGE, carryProgressForward } from '../lib/exercise-id-merge.ts';
import { videoUrlFor } from '../lib/exercise-videos.ts';
import { doseOfPrescription, setInputShapeFor } from '../lib/set-logging.ts';
import { holdClockFor } from '../lib/hold-timer.ts';
import { ownPrescriptionFor, swapPrescription } from '../lib/swap-prescription.ts';
import { GROW_ICONS } from '../lib/icon-art.ts';

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
const sample = (list) => [...list].slice(0, 3).join(' | ');

const SLED = 'Sled Push and Pull';
const SLED_ID = 'lib-cond-sled-pull';
const RETIRED_SLED_ID = 'lib-cond-sled-push';
const CARRY = 'Farmers Carry';

const byName = new Map(CONDITIONING_EXERCISES.map((e) => [e.libraryName, e]));

/**
 * EVERY CARD A PERSON CAN BE HANDED, and every alternative behind every button.
 *
 * Both builders, every session type, every kit answer, both ends of the level
 * ladder, all three lengths and several rotation positions. The whole point of
 * driving the real generators is that a record removed from a list is not the
 * same claim as a record removed from somebody's session: the finisher, the
 * blocks, the warm-up and the swap slots each choose by their own index.
 */
const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bands'],
  ['dumbbells', 'bands'],
  ['kettlebells'],
  ['fullgym'],
  ['fullgym', 'bench'],
];
const SESSION_TYPES = ['full_body', 'upper_body', 'lower_body'];
const TIMES = ['30', '45', '60'];
const SEEDS = [0, 1, 2, 3, 4, 5];

function sweep(regions, severity = 'moderate', { levels = EXPERIENCE_LEVELS } = {}) {
  const cards = [];
  for (const equipment of KITS) {
    for (const level of levels) {
      for (const timeAvailable of TIMES) {
        for (const seed of SEEDS) {
          const readiness = {
            hasAches: regions.length > 0,
            painRegion: regions.length > 0 ? regions : undefined,
            painSeverity: severity,
            energy: 'normal',
            timeAvailable,
          };
          const profile = {
            name: 'Sweep',
            sex: 'female',
            experienceLevel: level,
            goals: ['muscle'],
            bodyweightKg: 72,
            ageYears: 40,
          };
          for (const sessionType of SESSION_TYPES) {
            const session = generateLibrarySession({
              sessionType,
              equipment,
              readiness,
              profile,
              sessionTypeCount: seed,
              strengthSessionCount: seed,
              daysSinceLastSession: null,
            });
            for (const card of session.exercises) {
              cards.push({ card, where: `${sessionType}/${equipment.join('+') || 'nothing'}/${level}/${timeAvailable}/${seed}` });
            }
          }
          const cond = generateLibraryConditioningSession({
            equipment,
            readiness,
            profile,
            sessionCount: seed,
          });
          for (const card of cond.exercises) {
            cards.push({ card, where: `conditioning/${equipment.join('+') || 'nothing'}/${level}/${timeAvailable}/${seed}` });
          }
        }
      }
    }
  }
  return cards;
}

const healthy = sweep([], 'mild');
const healthyNames = new Set(healthy.map((r) => r.card.name));

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[1] "Sled push and sled pull and push become sled push and pull"');

check(
  'there is one sled drag, and it is the record that kept the id',
  byName.get(SLED)?.id === SLED_ID,
  `${SLED} is ${byName.get(SLED)?.id ?? 'not on the list'}`
);
check(
  'neither of the two it replaced is on the conditioning list any more',
  !byName.has('Sled Push') && !byName.has('Sled Pull and Push'),
  [...byName.keys()].join(', ')
);
check(
  'and no strength record picked either name up',
  !LIBRARY_EXERCISES.some((e) => /^sled/i.test(e.libraryName)),
  LIBRARY_EXERCISES.filter((e) => /sled/i.test(e.libraryName)).map((e) => e.libraryName).join(', ')
);
check(
  'the surviving record is still one drill of sled work with a sled in its kit',
  byName.get(SLED)?.kit.some((group) => group.every((k) => k === 'sled')),
  JSON.stringify(byName.get(SLED)?.kit)
);
check(
  'its prescription says both halves of the round trip',
  /out/i.test(byName.get(SLED)?.reps ?? '') && /back/i.test(byName.get(SLED)?.reps ?? ''),
  `reps "${byName.get(SLED)?.reps}"`
);
check(
  'and its cue describes a push AND a backwards drag, in that order',
  (() => {
    const cue = byName.get(SLED)?.cue ?? '';
    const push = cue.toLowerCase().indexOf('push');
    const back = cue.toLowerCase().indexOf('backward');
    return push >= 0 && back >= 0 && push < back;
  })(),
  byName.get(SLED)?.cue
);
check(
  "his own video is attached to it under the name the app serves",
  videoUrlFor({ name: SLED, videoId: '' })?.includes('7KYhdRNN8c8') === true,
  `${videoUrlFor({ name: SLED, videoId: '' })} - the channel clip is titled "Sled Push & Pull"`
);

/**
 * THE CLINICAL RULE, CARRIED OVER RATHER THAN RE-ARGUED.
 *
 * Decision 22 withholds the drag from a sore ankle, Achilles, calf and shin -
 * two regions in the app - and decision 16 withholds sled work from a sore
 * knee. Both were true of both records before the merge, so both have to be
 * true of the survivor, at every severity, in every block of every session type.
 */
const FOUR_COMPLAINTS = [
  ['a sore ankle', 'ankle_achilles'],
  ['a sore Achilles', 'ankle_achilles'],
  ['a sore calf', 'calf_shin'],
  ['a sore shin', 'calf_shin'],
  ['a sore knee', 'knee'],
];
for (const [complaint, region] of FOUR_COMPLAINTS) {
  for (const severity of ['mild', 'moderate', 'severe']) {
    const cards = sweep([region], severity, { levels: ['intermediate', 'athlete'] });
    const served = cards.filter((r) => r.card.name === SLED);
    check(
      `${complaint} (${region}, ${severity}): the card is absent from all ${cards.length} cards offered`,
      served.length === 0,
      sample(served.map((r) => `${r.card.category} in ${r.where}`))
    );
  }
}
check(
  'somebody with nothing sore is still offered it, so those absences mean something',
  healthyNames.has(SLED),
  'otherwise "withheld from a sore calf" would be true of everybody'
);
check(
  'a sore lower back still keeps all the sled work, which is the other half of his answer',
  (() => {
    const names = new Set(sweep(['lower_back']).map((r) => r.card.name));
    return names.has(SLED) && names.has('Sled Rows');
  })(),
  'decision 16 was "rule sled work out for a sore knee and keep the rest"'
);

/**
 * THE HISTORY HALF. Two ids became one, so both the NAME keys (the personal
 * best, the progress chart, the recalled note) and the ID keys (the logged
 * weight, the rep target, the streaks, the feedback) have to land on the
 * survivor.
 */
for (const old of ['Sled Push', 'Sled Pull', 'Sled Pull and Push']) {
  check(
    `a set logged as "${old}" charts as ${SLED}`,
    canonicalExerciseName(old) === SLED,
    `it charts as "${canonicalExerciseName(old)}"`
  );
}
check(
  'the name the record is served under is the name it is charted under',
  canonicalExerciseName(SLED) === SLED,
  'an alias pointing at another alias resolves to the wrong name in one pass'
);
check(
  'the retired id is mapped onto the survivor',
  ID_MERGE[RETIRED_SLED_ID] === SLED_ID,
  `it maps to ${ID_MERGE[RETIRED_SLED_ID]}`
);
check(
  'so a sled weight logged against the retired id reads back on the survivor',
  carryProgressForward({ [RETIRED_SLED_ID]: 70 })[SLED_ID] === 70,
  'without it the merged drill opens at the beginner estimate'
);
check(
  'and a weight already logged against the survivor is never overwritten by it',
  carryProgressForward({ [RETIRED_SLED_ID]: 70, [SLED_ID]: 40 })[SLED_ID] === 40,
  'the survivor is the lighter prescription, so it has to win'
);
check(
  'the same for a session logged with a sore joint, which uses the comfort id',
  carryProgressForward({ [`${RETIRED_SLED_ID}-comfort`]: 55 })[`${SLED_ID}-comfort`] === 55,
  'a person sore for a month would otherwise carry nothing over'
);

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[2] "Add farmer carries as a conditioning exercise"');

const carry = byName.get(CARRY);
check('it is on the conditioning list', Boolean(carry), [...byName.keys()].join(', '));
check(
  'filed as conditioning work rather than as strength work',
  carry?.role === 'conditioning' && carry?.category === 'cardio',
  `role ${carry?.role}, category ${carry?.category}`
);
check(
  'prescribed by distance in metres, like the sled work',
  carry?.dose === 'distance' &&
    doseOfPrescription(carry?.reps ?? '') === 'distance' &&
    /\d+\s*m\b/.test(carry?.reps ?? ''),
  `reps "${carry?.reps}", dose ${carry?.dose}`
);
check(
  'with a starting load in kilograms, so the box arrives holding a number',
  setInputShapeFor(carry ?? { reps: '', suggestedLoad: '' }).weight === true &&
    setInputShapeFor(carry ?? { reps: '', suggestedLoad: '' }).weightRequired === true,
  `load "${carry?.suggestedLoad}"`
);
check(
  'and its metres are fixed rather than counted, which is what every carry does',
  setInputShapeFor(carry ?? { reps: '', suggestedLoad: '' }).count === null &&
    carry?.movementPattern === 'carry',
  'a carry gets harder by picking up more, not by walking further'
);
check(
  'it accepts a dumbbell, a kettlebell or a trap bar as one requirement',
  carry?.kit.length === 1 &&
    ['dumbbell', 'kettlebell', 'trapbar'].every((k) => carry.kit[0].includes(k)),
  JSON.stringify(carry?.kit)
);
check(
  'the name is its own, not an alias for the trap bar version',
  canonicalExerciseName(CARRY) === CARRY,
  `it charts as "${canonicalExerciseName(CARRY)}" - an alias key cannot also be a live name`
);

/**
 * THE THREE STRENGTH CARRIES ARE UNTOUCHED. Archie added a record; he did not
 * move three. A move would have changed which id each one's logged weight is
 * filed under, and the whole point of this being a separate entry is that it
 * cannot.
 */
const STRENGTH_CARRIES = [
  ['Dumbbell Farmers Carry', 'dl-acc-db-9', 2],
  ['Kettlebell Farmers Carry', 'lib-core-kettlebell-farmers-carry', 2],
  ['Trapbar Farmers Carry', 'dl-acc-fg-3', 3],
];
for (const [name, id, level] of STRENGTH_CARRIES) {
  const record = LIBRARY_EXERCISES.find((e) => e.libraryName === name);
  check(
    `${name} is still a core accessory at level ${level}, on its own id`,
    record?.id === id && record?.level === level && record?.pattern === 'core',
    record ? `${record.id} / level ${record.level} / ${record.pattern}` : 'it is gone'
  );
}
check(
  'and the conditioning carry shares an id with none of them',
  STRENGTH_CARRIES.every(([, id]) => id !== carry?.id),
  `${carry?.id} against ${STRENGTH_CARRIES.map(([, id]) => id).join(', ')}`
);

check(
  'a session really serves it, so it is a card rather than a list entry',
  healthyNames.has(CARRY),
  'it is chosen by the finisher slot and by the conditioning blocks'
);
check(
  'and it reaches somebody at home with dumbbells, not only a full gym',
  healthy.some((r) => r.card.name === CARRY && r.where.includes('dumbbells')),
  sample(new Set(healthy.filter((r) => r.card.name === CARRY).map((r) => r.where)))
);
/**
 * A LOADED CARRY IS NOT A WARM-UP, which is the same sentence of Archie's that
 * took the sled off the top of a session. Asked twice: of the rule, and of every
 * card any session actually opens on.
 */
check(
  'it may not open a session',
  carry ? isPulseRaiser(carry) === false : false,
  'two minutes of easy cardio is the opener, not twenty-five kilograms in each hand'
);
const openedOnTheCarry = healthy.filter((r) => r.card.category === 'prep' && r.card.name === CARRY);
check(
  `and no session in the sweep opens on it (${healthy.filter((r) => r.card.category === 'prep').length} warm-up cards)`,
  openedOnTheCarry.length === 0,
  sample(openedOnTheCarry.map((r) => r.where))
);

/**
 * THE CLINICAL ANSWER, and it is the answer the other seven carries already
 * give. `grip_load` is restricted by a sore wrist and a sore bicep;
 * `spinal_compression` by a sore lower back, upper back, neck and lat. Asked by
 * generating sessions for each of those and looking for the card.
 */
const CARRY_WITHHELD_FROM = ['wrist', 'bicep', 'lower_back', 'upper_back', 'neck', 'lat_mid_back'];
for (const region of CARRY_WITHHELD_FROM) {
  const cards = sweep([region], 'moderate', { levels: ['intermediate'] });
  const served = cards.filter((r) => r.card.name === CARRY);
  check(
    `a sore ${region} is never offered it (${cards.length} cards swept)`,
    served.length === 0,
    sample(served.map((r) => `${r.card.category} in ${r.where}`))
  );
}
check(
  'and those are exactly the regions its two tags name, so nothing is hand-written',
  CARRY_WITHHELD_FROM.every((region) =>
    (carry?.stress ?? []).some((tag) => RESTRICTED_BY_REGION[region].includes(tag))
  ),
  `stress ${JSON.stringify(carry?.stress ?? [])}`
);
/**
 * ASKED OF THE RECORD AS WELL AS OF THE SESSIONS, and that is not belt and
 * braces. The name "Farmers Carry" matches the /farmer/ test in both tag rules
 * in lib/exercise-safety.ts, so the six absences above would stay true with the
 * authored tags deleted - the screen would be resting entirely on the spelling
 * of the name, which is exactly what this repo keeps being caught doing.
 */
check(
  'the record carries both tags itself',
  ['grip_load', 'spinal_compression'].every((t) => (carry?.stress ?? []).includes(t)),
  `stress ${JSON.stringify(carry?.stress ?? [])}`
);
check(
  'and it keeps them with the name and the cue taken away, so nothing is reading the word "farmer"',
  (() => {
    const anonymous = { ...carry, name: 'Walk With Things', libraryName: 'Walk With Things', cue: 'Walk' };
    const banned = new Set([...RESTRICTED_BY_REGION.wrist, ...RESTRICTED_BY_REGION.lower_back]);
    const found = restrictedTagsOnRecord(anonymous, banned);
    return found.includes('grip_load') && found.includes('spinal_compression');
  })(),
  'a rule keyed on the spelling would pass today and break on the next rename'
);
/**
 * THE COUNTERWEIGHT, AND IT IS ALSO THE HONEST BIT. A sore shoulder keeps it,
 * exactly as it keeps the other seven carries: neither shoulder region restricts
 * either tag. That is the app's existing answer rather than a decision taken
 * here, and pinning it means a later change to it is a deliberate one.
 */
for (const region of ['front_shoulder', 'rear_shoulder', 'knee']) {
  check(
    `a sore ${region} still keeps it, as it keeps every other carry`,
    new Set(sweep([region], 'moderate', { levels: ['intermediate'] }).map((r) => r.card.name)).has(
      CARRY
    ),
    'if this ever changes it is a decision about every carry, deadlift and row at once'
  );
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[3] "Banded Clamshells should say reps not seconds"');

/**
 * Every swap the app can offer, asked what the card would prescribe once it is
 * showing. The sweep above is reused: `healthy` is 111,000-odd cards and each
 * one carries up to two alternatives.
 */
const offers = [];
for (const { card, where } of healthy) {
  for (const [id, name] of [
    [card.swapId, card.swapName],
    [card.swap2Id, card.swap2Name],
  ]) {
    if (!name) continue;
    offers.push({ card, where, swap: { id, name } });
  }
}
check(
  `the sweep met swap options to judge (${offers.length})`,
  offers.length > 1000,
  `${offers.length} offers`
);
/**
 * NOTHING UNRESOLVED, which is the silent hole this rule could have had. An
 * alternative whose record cannot be found keeps the card's prescription, which
 * is the old behaviour, so it would fail quietly rather than loudly.
 */
const unresolved = offers.filter((o) => !ownPrescriptionFor(o.swap));
check(
  'every alternative offered is a movement the app can look the prescription up for',
  unresolved.length === 0,
  sample(new Set(unresolved.map((o) => `${o.swap.name} behind ${o.card.name}`)))
);

const wrongCount = offers.filter((o) => {
  const shown = swapPrescription(o.card.reps, o.swap);
  const own = ownPrescriptionFor(o.swap);
  if (!own) return false;
  const shownDose = doseOfPrescription(shown);
  const ownDose = doseOfPrescription(own);
  return (
    (ownDose === 'reps' && shownDose === 'time') || (ownDose === 'time' && shownDose === 'reps')
  );
});
check(
  `no alternative is left counting the wrong thing (${offers.length} offers judged)`,
  wrongCount.length === 0,
  sample(
    new Set(
      wrongCount.map(
        (o) => `${o.swap.name} on ${o.card.name}: shown "${swapPrescription(o.card.reps, o.swap)}"`
      )
    )
  )
);
/**
 * AND THE FAULT WAS REAL, which the line above cannot show on its own: with the
 * rule removed it would pass if no swap had ever crossed reps and a clock.
 */
const wouldHaveBeenWrong = offers.filter((o) => {
  const own = ownPrescriptionFor(o.swap);
  if (!own) return false;
  const cardDose = doseOfPrescription(o.card.reps ?? '');
  const ownDose = doseOfPrescription(own);
  return (cardDose === 'time' && ownDose === 'reps') || (cardDose === 'reps' && ownDose === 'time');
});
check(
  `and the fault it fixes really happens (${wouldHaveBeenWrong.length} offers would have inherited the wrong kind)`,
  wouldHaveBeenWrong.length > 100,
  `${wouldHaveBeenWrong.length} offers`
);

/** Archie's own example, end to end. */
const clamshellOffers = offers.filter((o) => /clamshell/i.test(o.swap.name));
check(
  `a Banded Clamshell really is offered behind cards prescribed on a clock (${clamshellOffers.filter((o) => doseOfPrescription(o.card.reps ?? '') === 'time').length})`,
  clamshellOffers.filter((o) => doseOfPrescription(o.card.reps ?? '') === 'time').length > 0,
  sample(new Set(clamshellOffers.map((o) => `${o.card.name} "${o.card.reps}"`)))
);
const clamshellWrong = clamshellOffers.filter((o) => {
  const shown = swapPrescription(o.card.reps, o.swap);
  return doseOfPrescription(shown) !== 'reps' || holdClockFor(shown) !== null;
});
check(
  `and every one of the ${clamshellOffers.length} clamshell offers asks for reps with no timer under it`,
  clamshellWrong.length === 0,
  sample(
    new Set(
      clamshellWrong.map(
        (o) => `${o.card.name} "${o.card.reps}" -> shown "${swapPrescription(o.card.reps, o.swap)}"`
      )
    )
  )
);
check(
  `which is the count the record itself is written at, not a number this rule invented`,
  clamshellOffers.every(
    (o) => swapPrescription(o.card.reps, o.swap) === ownPrescriptionFor(o.swap) ||
      doseOfPrescription(o.card.reps ?? '') === 'reps'
  ),
  `an invented dose is a clinical error; what the movement is written at is the only honest answer`
);

/**
 * THE TWO THINGS THAT MUST NOT MOVE. Both are prescriptions the SESSION wrote on
 * purpose, and the movement's own answer is the wrong one for the slot.
 */
const openerSwaps = healthy.filter(
  (r) => r.card.category === 'prep' && (r.card.reps ?? '') === '2 min' && r.card.swapName
);
const openerChanged = openerSwaps.filter(
  (r) =>
    doseOfPrescription(ownPrescriptionFor({ id: r.card.swapId, name: r.card.swapName }) ?? '') ===
      'distance' &&
    swapPrescription(r.card.reps, { id: r.card.swapId, name: r.card.swapName }) !== '2 min'
);
check(
  `the two minute cardio opener stays two minutes when it is swapped for a machine (${openerSwaps.length} openers)`,
  openerSwaps.length > 0 && openerChanged.length === 0,
  sample(openerChanged.map((r) => `${r.card.swapName} in ${r.where}`))
);
const blockSwaps = healthy.filter(
  (r) => r.where.startsWith('conditioning') && r.card.category === 'cardio' && r.card.swapName
);
const blockChanged = blockSwaps.filter(
  (r) => swapPrescription(r.card.reps, { id: r.card.swapId, name: r.card.swapName }) !== r.card.reps
);
check(
  `and a Conditioning block keeps its interval when it is swapped (${blockSwaps.length} blocks)`,
  blockSwaps.length > 0 && blockChanged.length === 0,
  sample(
    blockChanged.map(
      (r) =>
        `${r.card.name} "${r.card.reps}" -> "${swapPrescription(r.card.reps, { id: r.card.swapId, name: r.card.swapName })}"`
    )
  )
);
check(
  'and an alternative that asks for the same kind of count leaves the card alone',
  swapPrescription('8-12', { name: 'Push Up' }) === '8-12' &&
    swapPrescription('30s', { name: 'Plank' }) === '30s',
  'the rule is about crossing reps and a clock, nothing else'
);

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[4] "The bench icon should be a gym bench not a green rectangle"');

const bench = GROW_ICONS.bench;
check(
  `the icon set the app draws its own illustrations from holds a bench`,
  Array.isArray(bench) && bench.length > 0,
  'a name with no geometry renders an empty box, silently'
);
/**
 * AND IT IS NOT ONE RECTANGLE, which is the complaint word for word. A bench
 * reads as a bench because it has a pad, legs under it and something joining
 * the feet, so the drawing has to have filled parts AND stroked parts.
 */
check(
  'it is a drawing rather than a single rectangle',
  (bench ?? []).length >= 4 &&
    (bench ?? []).some((s) => s.k === 'rect' && s.fill) &&
    (bench ?? []).filter((s) => s.stroke).length >= 2,
  JSON.stringify(bench)
);
check(
  'the pad is the widest part of it, so it reads as something you lie on',
  (() => {
    const rects = (bench ?? []).filter((s) => s.k === 'rect');
    const pad = rects.find((s) => s.fill && !s.o);
    return Boolean(pad) && pad.w > 24 && pad.h < pad.w / 3;
  })(),
  JSON.stringify((bench ?? []).filter((s) => s.k === 'rect'))
);
check(
  'and the legs are below the pad rather than through it',
  (() => {
    const rects = (bench ?? []).filter((s) => s.k === 'rect');
    const pad = rects.find((s) => s.fill && !s.o);
    const legs = (bench ?? []).filter((s) => s.stroke && s.k === 'path');
    if (!pad || legs.length < 2) return false;
    const tops = legs.flatMap((s) => [...s.d.matchAll(/M\s*[\d.]+\s+([\d.]+)/g)].map((m) => Number(m[1])));
    return tops.length >= 2 && tops.every((y) => y >= pad.y + pad.h);
  })(),
  JSON.stringify((bench ?? []).filter((s) => s.stroke))
);
check(
  'it is a drawing nothing else in the set already is',
  Object.entries(GROW_ICONS).filter(([, shapes]) => JSON.stringify(shapes) === JSON.stringify(bench))
    .length === 1,
  'two icons with the same geometry means one of them is saying the wrong thing'
);

// ═════════════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
