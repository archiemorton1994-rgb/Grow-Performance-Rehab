/**
 * Contract test: a full body day is not a leg day, and a conditioning card is
 * only ever swapped for conditioning.
 *
 * WHAT HE ASKED FOR, 30 SEPTEMBER 2026
 * ────────────────────────────────────
 *   "In the full body session it should remove the last leg exercise (for
 *    example deficit split squats) and add an additional core exercise instead
 *    as there are too many leg exercises in the session."
 *   "When swapping the conditioning exercise at the end of the session it should
 *    only give other conditioning exercises as an option rather than suggesting
 *    a TRX row instead of sled rows."
 *
 * WHAT WAS THERE BEFORE, MEASURED RATHER THAN ASSERTED
 * ───────────────────────────────────────────────────
 * Over 896 full body hours - every kit, every level, four situations, seven
 * rotation positions - the lifting slots held 2.74 leg pieces and 1.00 core
 * piece on average, and 684 of the 896 held three or more leg pieces. With
 * nothing sore it was three legs and one core in every single one. The sixth
 * slot of a full body row was a lunge, and Deficit Split Squats is a lunge.
 *
 * And over 3,816 conditioning cards - every session type, kit, level, length and
 * three situations - 306 of the options behind the swap button were strength
 * records out of the exercise library rather than records on Archie's nine, in
 * twelve distinct pairings, 32 of them the exact one he named: Sled Rows offered
 * a TRX Row. All 306 were on a library session's finisher. The conditioning
 * session next door has been held to its own list since it was written and
 * contributed none, which is the fix this one copies.
 *
 * WHAT THIS FILE ASSERTS, AND WHY EACH ONE IS HERE
 * ───────────────────────────────────────────────
 * Every rule is asked of real generated sessions, through the same two doors the
 * session screen uses - `generateLibrarySession` for the shape and
 * `generateWorkout` for the swap sheet, because the swap sheet is filled one
 * layer above the builder and a check that only asked the builder would have
 * missed this defect entirely. Nothing here reads a table or greps a source
 * file.
 *
 * THE COUNTERWEIGHTS ARE HALF THE FILE. "Fewer leg exercises" must not quietly
 * become "no leg exercises", "only conditioning" must not quietly become "an
 * empty button on every card", and a leg day must be exactly where it was, since
 * stage 7 pushed leg work ONTO a lower body day and this change pulls it off a
 * full body one. Two rules in opposite directions on two session types is how
 * one of them silently wins.
 *
 * Run:  npx tsx tests/session-shape-and-swaps.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';
import {
  CONDITIONING_EXERCISES,
  LIBRARY_EXERCISES,
  WARMUP_CARDIO_EXERCISES,
  isCardioOpener,
} from '../lib/exercise-library.ts';
import { getStandalonePrehabWorkout } from '../lib/exercise-db.ts';
import { muscleGroupOf } from '../lib/exercise-swaps.ts';
import { SLOT_COUNTS, generateLibrarySession } from '../lib/library-session.ts';
import { generateWorkout, getEffectiveTier } from '../lib/workout-engine.ts';

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
const key = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const LEG_PATTERNS = new Set(['squat', 'hinge', 'lunge']);
const libraryById = new Map(LIBRARY_EXERCISES.map((r) => [r.id, r]));
const libraryByKey = new Map(LIBRARY_EXERCISES.map((r) => [key(r.name), r]));
const conditioningByKey = new Map(CONDITIONING_EXERCISES.map((r) => [key(r.name), r]));
const warmUpCardioByKey = new Map(WARMUP_CARDIO_EXERCISES.map((r) => [key(r.name), r]));
const restoreByKey = new Map(getStandalonePrehabWorkout().map((t) => [key(t.name), t]));
/** The library record a card came from, by id first and then by the name shown. */
const recordOf = (card) => libraryById.get(card.id) ?? libraryByKey.get(key(card.name)) ?? null;
const patternOf = (card) => recordOf(card)?.pattern ?? null;
const isLeg = (card) => LEG_PATTERNS.has(patternOf(card));
const isCore = (card) => patternOf(card) === 'core';
/** The slots these rows fill. The explosive card is added on top and is not one. */
const LIFTING = new Set(['main', 'accessory']);

const SLED_ROWS = 'Sled Rows';
const TRX_ROWS = 'TRX Rows';
const SPLIT_SQUATS = 'Deficit Split Squats';

// ── [0] The two sides of the line, before any session is built ───────────────
console.log('\n[0] What the lists hold, so the sweeps below can tell one from the other');
{
  const sledRows = CONDITIONING_EXERCISES.find((e) => e.name === SLED_ROWS);
  const trxRows = LIBRARY_EXERCISES.find((e) => e.name === TRX_ROWS);
  check(
    `${SLED_ROWS} is on Archie's nine and ${TRX_ROWS} is a strength record, which is what makes his complaint a complaint`,
    !!sledRows && !!trxRows && !conditioningByKey.has(key(TRX_ROWS)),
    `sled rows ${sledRows ? 'found' : 'MISSING'}, trx rows ${trxRows ? 'found' : 'MISSING'}`
  );
  /**
   * AND THEY LOOK ALIKE TO THE MUSCLE INDEX, which is HOW the wrong one was
   * reached. The swap sheet fills an empty slot by muscle GROUP, not by muscle:
   * Sled Rows is filed at the lats and TRX Rows at the rhomboids, and both read
   * as back work. Without this, section [4] could pass because the two records
   * drifted apart rather than because the pool was closed.
   */
  check(
    'and both read as back work to the index, which is the route it took to reach the wrong one',
    !!sledRows &&
      !!trxRows &&
      !!muscleGroupOf(sledRows.primaryMuscle) &&
      muscleGroupOf(sledRows.primaryMuscle) === muscleGroupOf(trxRows.primaryMuscle),
    `${sledRows?.primaryMuscle} (${muscleGroupOf(sledRows?.primaryMuscle)}) vs ${trxRows?.primaryMuscle} (${muscleGroupOf(trxRows?.primaryMuscle)})`
  );
  const splitSquats = LIBRARY_EXERCISES.find((e) => e.name === SPLIT_SQUATS);
  check(
    `${SPLIT_SQUATS}, the example he gave, is filed as a lunge`,
    !!splitSquats && splitSquats.pattern === 'lunge',
    splitSquats ? splitSquats.pattern : 'no such record'
  );
  check(
    `Archie's nine is nine records and the walk is not one of them (${CONDITIONING_EXERCISES.length})`,
    CONDITIONING_EXERCISES.length === 9 && WARMUP_CARDIO_EXERCISES.length > 0,
    `${CONDITIONING_EXERCISES.length} conditioning, ${WARMUP_CARDIO_EXERCISES.length} warm-up only`
  );
}

// ── The shape sweep ──────────────────────────────────────────────────────────
const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bench'],
  ['bodyweight', 'dumbbells'],
  ['bodyweight', 'bands', 'dumbbells'],
  ['bodyweight', 'kettlebells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
  ['fullgym', 'bench'],
];
const DURATIONS = ['30', '45', '60'];
const SITUATIONS = [
  { label: 'nothing sore', regions: [], severity: 'mild' },
  { label: 'knee today, moderate', regions: ['knee'], severity: 'moderate' },
  { label: 'hip and groin today, moderate', regions: ['hip_groin'], severity: 'moderate' },
  { label: 'rear shoulder today, severe', regions: ['rear_shoulder'], severity: 'severe' },
];
/** Rotation positions three apart, which walks the whole of the longest pool. */
const SEEDS = [0, 3, 6, 9, 12, 15, 18];
const readinessFor = (situation, duration) => ({
  hasAches: situation.regions.length > 0,
  painRegion: situation.regions.length > 0 ? situation.regions : undefined,
  painSeverity: situation.severity,
  energy: 'normal',
  timeAvailable: duration,
});
const profileFor = (level) => ({
  name: 'Sweep',
  sex: 'female',
  experienceLevel: level,
  goals: ['muscle'],
  bodyweightKg: 72,
  ageYears: 34,
});

const shape = [];
for (const sessionType of ['full_body', 'lower_body', 'upper_body']) {
  for (const equipment of KITS) {
    for (const level of EXPERIENCE_LEVELS) {
      for (const duration of DURATIONS) {
        for (const situation of SITUATIONS) {
          for (const seed of SEEDS) {
            const { exercises } = generateLibrarySession({
              sessionType,
              equipment,
              readiness: readinessFor(situation, duration),
              profile: profileFor(level),
              sessionTypeCount: seed,
              strengthSessionCount: seed,
              daysSinceLastSession: null,
            });
            const lifting = exercises.filter((e) => LIFTING.has(e.category));
            shape.push({
              sessionType,
              level,
              duration,
              situation,
              where: `${sessionType} / ${equipment.join('+') || 'nothing'} / ${level} / ${duration} / ${situation.label} / ${seed}`,
              exercises,
              lifting,
              legs: lifting.filter(isLeg).length,
              core: lifting.filter(isCore).length,
              explosive: exercises.filter((e) => e.category === 'neuro'),
            });
          }
        }
      }
    }
  }
}
const fullBody = shape.filter((r) => r.sessionType === 'full_body');
const lowerBody = shape.filter((r) => r.sessionType === 'lower_body');
const upperBody = shape.filter((r) => r.sessionType === 'upper_body');
const fresh = (rows) => rows.filter((r) => r.situation.regions.length === 0);

// ── [1] The counting itself is honest ────────────────────────────────────────
console.log(`\n[1] Every lifting card can be read back to a record (${shape.length} sessions)`);
{
  /**
   * THE ASSERTION UNDER THE ASSERTIONS.
   *
   * Every count below is "how many of these cards are leg work", and a card
   * whose name no longer resolves to a library record reads as neither leg nor
   * core. So a rename would make section [2] pass by counting nothing at all.
   */
  const unresolved = shape.flatMap((r) =>
    r.lifting.filter((e) => !recordOf(e)).map((e) => `${r.where}: ${e.name}`)
  );
  const cards = shape.reduce((a, r) => a + r.lifting.length, 0);
  check(
    `all ${cards} of them resolve, so a leg count of zero means zero legs`,
    cards > 10000 && unresolved.length === 0,
    unresolved.slice(0, 3).join(' | ')
  );
}

// ── [2] A full body day trades its last leg slot for core ────────────────────
console.log(`\n[2] A full body day is not a leg day (${fullBody.length} sessions)`);
{
  const threeLegs = fullBody.filter((r) => r.legs >= 3);
  check(
    'no full body session at any kit, level, length or sore area fills three lifting slots with leg work',
    threeLegs.length === 0,
    threeLegs
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.lifting.filter(isLeg).map((e) => e.name).join(', ')}`)
      .join(' | ')
  );
  const hours = fullBody.filter((r) => r.duration === '60');
  const notTwoCore = hours.filter((r) => r.core !== 2);
  check(
    `and a full body hour asks for two core pieces and gets them every time (${hours.length} hours)`,
    hours.length > 800 && notTwoCore.length === 0,
    notTwoCore
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.core} core`)
      .join(' | ')
  );
  /**
   * THE COUNTERWEIGHT THAT MATTERS MOST. "Too many leg exercises" is a
   * complaint about three; the answer is two, not none. A full body session
   * with no squat, hinge or lunge in it would satisfy the assertion above and
   * would not be a full body session.
   */
  const noLegs = fullBody.filter((r) => r.legs === 0);
  check(
    'and every one of them still contains leg work, because the answer to three was two and not none',
    noLegs.length === 0,
    noLegs
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.lifting.map((e) => e.name).join(', ')}`)
      .join(' | ')
  );
  const freshHours = fresh(hours);
  const shortHours = freshHours.filter((r) => r.lifting.length < SLOT_COUNTS.full_body['60']);
  check(
    `and with nothing sore it still fills all ${SLOT_COUNTS.full_body['60']} of its slots (${freshHours.length} hours)`,
    freshHours.length > 200 && shortHours.length === 0,
    shortHours
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.lifting.length} pieces of work`)
      .join(' | ')
  );
  const freshCore = fresh(fullBody).filter((r) => r.duration === '60');
  check(
    'with nothing sore a full body hour is exactly two leg pieces and two core pieces',
    freshCore.length > 200 && freshCore.every((r) => r.legs === 2 && r.core === 2),
    freshCore
      .filter((r) => !(r.legs === 2 && r.core === 2))
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.legs} leg, ${r.core} core`)
      .join(' | ')
  );
  /**
   * AND THE ONE PLACE A THIRD LEG MOVEMENT SURVIVES, said out loud.
   *
   * The explosive card is not a slot: it is added on top at Athlete only, and a
   * broad jump is a leg movement. So a full body hour CAN show three leg
   * movements on the sheet, and every time it does it is an Athlete with a jump
   * rather than a list asking for a third leg lift.
   */
  const threeWithExplosive = hours.filter(
    (r) => r.legs + r.explosive.filter(isLeg).length >= 3
  );
  check(
    `a third leg movement only ever comes from the explosive card (${threeWithExplosive.length} hours)`,
    threeWithExplosive.length > 0 &&
      threeWithExplosive.every((r) => r.level === 'athlete' && r.explosive.some(isLeg)),
    threeWithExplosive
      .filter((r) => !(r.level === 'athlete' && r.explosive.some(isLeg)))
      .slice(0, 3)
      .map((r) => r.where)
      .join(' | ')
  );
}

// ── [3] And a leg day did not move an inch ───────────────────────────────────
console.log(`\n[3] The opposite rule, still in force (${lowerBody.length} lower, ${upperBody.length} upper)`);
{
  /**
   * STAGE 7 FORCED LEG WORK ONTO A LOWER BODY DAY; THIS PHASE PULLS IT OFF A
   * FULL BODY ONE. Two rules in opposite directions on two session types, so
   * the lower body day is re-measured here rather than taken on trust. Every
   * number below was identical before this change and after it.
   */
  const freshLower = fresh(lowerBody);
  const withCore = freshLower.filter((r) => r.core > 0);
  check(
    `a lower body day with nothing sore still spends no lifting slot on core (${freshLower.length} sessions)`,
    freshLower.length > 200 && withCore.length === 0,
    withCore
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.lifting.filter(isCore).map((e) => e.name).join(', ')}`)
      .join(' | ')
  );
  const lowerHours = freshLower.filter((r) => r.duration === '60');
  const notFive = lowerHours.filter((r) => r.legs !== 5);
  check(
    `and a lower body hour is still five leg pieces at every kit and level (${lowerHours.length} hours)`,
    lowerHours.length > 200 && notFive.length === 0,
    notFive
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.legs} leg pieces`)
      .join(' | ')
  );
  const upperLegs = upperBody.filter((r) => r.legs > 0);
  check(
    'and an upper body day has no leg work in it at all, which is the third direction nothing moved in',
    upperLegs.length === 0,
    upperLegs
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.lifting.filter(isLeg).map((e) => e.name).join(', ')}`)
      .join(' | ')
  );
}

// ── The swap sweep, through the door the session screen uses ─────────────────
/**
 * `generateWorkout`, NOT the builder. The builder chooses what else on the nine
 * this person could be doing; the swap sheet is filled one layer above it, and
 * that layer is where the TRX Row came from. A check that asked the builder
 * would have passed on the day Archie reported the bug.
 */
const SWAP_SITUATIONS = [
  { label: 'nothing sore', regions: [], severity: 'mild' },
  { label: 'knee today, moderate', regions: ['knee'], severity: 'moderate' },
  { label: 'ankle today, moderate', regions: ['ankle_achilles'], severity: 'moderate' },
];
const SWAP_SEEDS = [0, 1, 3, 5, 7, 11];
const swapCards = [];
for (const sessionType of ['lower_body', 'upper_body', 'full_body', 'conditioning']) {
  for (const equipment of KITS) {
    for (const level of EXPERIENCE_LEVELS) {
      for (const duration of DURATIONS) {
        for (const situation of SWAP_SITUATIONS) {
          for (const seed of SWAP_SEEDS) {
            /**
             * THE TIER THE APP WOULD HAVE RESOLVED, not the last thing ticked.
             *
             * app/session.tsx passes `getEffectiveTier` of the whole owned set
             * alongside the set itself, and the difference is not cosmetic: a
             * bench is a SUPPLY tier and is deliberately outside TIER_ORDER, so
             * reading the last entry of "fullgym then bench" would hand the swap
             * sheet 'bench' and a gym member would be tested as somebody with a
             * bench in the spare room.
             */
            const session = generateWorkout(
              sessionType,
              getEffectiveTier([...equipment]),
              readinessFor(situation, duration),
              profileFor(level),
              undefined,
              undefined,
              seed,
              undefined,
              undefined,
              undefined,
              null,
              'kg',
              undefined,
              undefined,
              0,
              { equipment, sessionTypeCount: seed }
            );
            const where = `${sessionType} / ${equipment.join('+') || 'nothing'} / ${level} / ${duration} / ${situation.label} / ${seed}`;
            for (const card of session) {
              swapCards.push({
                sessionType,
                equipment,
                where,
                card,
                options: [card.swapName, card.swap2Name].filter(Boolean),
              });
            }
          }
        }
      }
    }
  }
}
/**
 * WHAT COUNTS AS A CONDITIONING CARD, and it is the card's JOB rather than the
 * record behind it.
 *
 * 'finisher' is the conditioning block at the end of a lifting session and
 * 'cardio' is a block of a conditioning session. The two minutes of cardio at
 * the TOP of a lifting session is filed 'prep' and is deliberately not one of
 * these: it is doing a warm-up's job, and section [6] holds it to its own rule.
 */
const CONDITIONING_ROLES = new Set(['finisher', 'cardio']);
const conditioningCards = swapCards.filter((r) => CONDITIONING_ROLES.has(r.card.category));

// ── [4] A conditioning card only ever offers conditioning ────────────────────
console.log(`\n[4] The swap button on a conditioning card (${conditioningCards.length} cards)`);
{
  check(
    'the sweep found both kinds of conditioning card, so it is asking the question of both',
    conditioningCards.some((r) => r.card.category === 'finisher') &&
      conditioningCards.some((r) => r.card.category === 'cardio') &&
      conditioningCards.length > 3000,
    `${conditioningCards.filter((r) => r.card.category === 'finisher').length} finishers, ${conditioningCards.filter((r) => r.card.category === 'cardio').length} conditioning blocks`
  );
  const offList = conditioningCards.flatMap((r) =>
    r.options
      .filter((name) => !conditioningByKey.has(key(name)))
      .map(
        (name) =>
          `${r.where}: ${r.card.category} ${r.card.name} -> ${name}${libraryByKey.has(key(name)) ? ' (a STRENGTH record)' : restoreByKey.has(key(name)) ? ' (a Restore drill)' : warmUpCardioByKey.has(key(name)) ? ' (warm-up cardio)' : ''}`
      )
  );
  check(
    "every alternative offered on one is itself a record on Archie's nine",
    offList.length === 0,
    `${offList.length} off the list, first three: ${offList.slice(0, 3).join(' | ')}`
  );
  /**
   * THE PAIRING HE NAMED, ASKED BY NAME AS WELL AS BY RULE.
   *
   * The rule above subsumes it, and it is here anyway: this is the sentence he
   * wrote, and somebody reading this file in a year should be able to see it
   * asked in his words rather than have to work out that it follows.
   */
  const trxForSled = conditioningCards.filter(
    (r) => key(r.card.name) === key(SLED_ROWS) && r.options.some((o) => key(o) === key(TRX_ROWS))
  );
  const sledRowCards = conditioningCards.filter((r) => key(r.card.name) === key(SLED_ROWS));
  check(
    `and no ${SLED_ROWS} card anywhere is offered a ${TRX_ROWS} (${sledRowCards.length} sled row cards swept)`,
    sledRowCards.length > 0 && trxForSled.length === 0,
    trxForSled.length > 0 ? trxForSled[0].where : 'the sweep never served Sled Rows, so it asked nothing'
  );
  /**
   * AND THE BUTTON IS NOT SIMPLY EMPTY EVERYWHERE, which is the cheap way to
   * pass the assertion above. Closing the pool costs some cards their button -
   * 47 finishers in the measurement - and that is the honest answer at home,
   * where three of the nine need no kit and the session has used two of them.
   * It must not be the answer at a full gym, where six of the nine are in reach.
   */
  const offered = conditioningCards.filter((r) => r.options.length > 0);
  check(
    `and most conditioning cards still have something to offer (${offered.length} of ${conditioningCards.length})`,
    offered.length > conditioningCards.length * 0.25,
    `${((offered.length / conditioningCards.length) * 100).toFixed(1)}% carry an alternative`
  );
  /**
   * AND CLOSING THE POOL COST THE FINISHER NOTHING AT ALL, which was worth
   * measuring rather than assuming. Every one of the 576 finishers swept still
   * offers at least one other record from the nine, at every kit down to no
   * equipment at all and with an ankle or a knee sore.
   *
   * ASKED OF THE FINISHER ONLY, because that is the card this rule changed. A
   * conditioning session's own blocks ARE the nine - it can serve six of them at
   * a gym and then have nothing spare to offer behind any of them - and that is
   * a fact about building a session out of a nine-record list rather than
   * anything to do with which pool a swap may reach into.
   *
   * IF THIS EVER GOES RED IT IS A SIGNAL TO LOOK, NOT A RULE TO SATISFY BY
   * WIDENING THE POOL. A blank button on a conditioning card is the honest
   * answer to "what else on this list could I be doing"; a TRX Row is not.
   */
  const finishers = conditioningCards.filter((r) => r.card.category === 'finisher');
  const blankFinishers = finishers.filter((r) => r.options.length === 0);
  check(
    `and holding the finisher to the nine cost it no buttons (${finishers.length} finishers)`,
    finishers.length > 500 && blankFinishers.length === 0,
    blankFinishers
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.card.name} has nothing behind it`)
      .join(' | ')
  );
}

// ── [5] The swap still says what it is ───────────────────────────────────────
console.log('\n[5] A held card keeps the labels the fill wrote on it');
{
  /**
   * WHY THE FILL STILL RUNS AT ALL. It is what classifies an alternative - same
   * movement with other kit, or different work on the same muscles - and writes
   * the sentence the sheet shows. Throwing the whole fill away instead of just
   * what it ADDED would have left every conditioning card with an unlabelled
   * option, which is a different regression wearing this fix's clothes.
   */
  const offered = conditioningCards.filter((r) => r.options.length > 0);
  const unlabelled = offered.filter((r) => !r.card.swapKind || !r.card.swapReason);
  check(
    `every conditioning card that offers something says what it is offering (${offered.length} cards)`,
    offered.length > 500 && unlabelled.length === 0,
    unlabelled
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.card.name} -> ${r.card.swapName} has no kind or reason`)
      .join(' | ')
  );
  const claimsSwap = conditioningCards.filter((r) => r.card.hasSwap);
  const lying = claimsSwap.filter((r) => r.options.length === 0);
  check(
    'and no card claims a swap it cannot show',
    lying.length === 0,
    lying
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.card.name}`)
      .join(' | ')
  );
}

// ── [6] The warm-up is NOT held to the nine, and that is deliberate ──────────
console.log('\n[6] The boundary: the two minutes of cardio keeps its own swap list');
{
  /**
   * ARCHIE'S OTHER RULE, from the day before: "These exercises should be the go
   * to exercises but should still have swap options if the client wants to do a
   * different exercise." The card at the top of a session is doing a warm-up's
   * job, so its builder leads it with the other cardio options and puts the
   * Restore mobility drills on the end rather than ship a blank button. Holding
   * it to Archie's nine would empty it at home.
   *
   * This section exists so that boundary is a decision on the record rather than
   * an oversight somebody tidies up later.
   */
  /**
   * A LIFTING SESSION'S OPENER, and not a conditioning session's. A conditioning
   * session opens on one of the nine and its warm-up card is answered out of the
   * same nine, which is its own arrangement and not what stage 8 step 1 built.
   */
  const openers = swapCards.filter(
    (r) =>
      r.sessionType !== 'conditioning' &&
      r.card.category === 'prep' &&
      (conditioningByKey.has(key(r.card.name)) || warmUpCardioByKey.has(key(r.card.name))) &&
      isCardioOpener(
        conditioningByKey.get(key(r.card.name)) ?? warmUpCardioByKey.get(key(r.card.name))
      )
  );
  const blank = openers.filter((r) => r.options.length === 0);
  check(
    `the cardio opener still has something behind its button at every kit (${openers.length} cards)`,
    openers.length > 1000 && blank.length === 0,
    blank
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.card.name}`)
      .join(' | ')
  );
  /**
   * AND IT LEADS WITH ANOTHER CARDIO OPTION WHEREVER ONE IS SPARE, which is the
   * rest of that rule. A gym has six cardio options between the nine and the
   * walk, so the first thing offered there is never a mobility drill.
   */
  const gymOpeners = openers.filter((r) => r.equipment.includes('fullgym'));
  const notCardioFirst = gymOpeners.filter((r) => {
    const first = r.options[0];
    const record = conditioningByKey.get(key(first)) ?? warmUpCardioByKey.get(key(first));
    return !record || !isCardioOpener(record);
  });
  check(
    `and at a gym it leads with another cardio option (${gymOpeners.length} cards)`,
    gymOpeners.length > 100 && notCardioFirst.length === 0,
    notCardioFirst
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.card.name} -> ${r.options[0]}`)
      .join(' | ')
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
