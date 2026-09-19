/**
 * Contract test: the safety screen and the load labelling behave clinically.
 *
 * ── CHEST PAIN CHANGED NOTHING ─────────────────────────────────────────────
 * Every region could remove the work that loads it, except the chest. `chest`
 * restricted `shoulder_end_range` alone, which catches flyes, dips and pullovers
 * and misses every press — because no horizontal-pressing tag existed at all.
 *
 * So a user with a strained pec tapping "Chest" and "Severe" still got Barbell
 * Bench Press 60-100 kg as their main lift, with close-grip and decline bench
 * behind it, and a Doorway Chest Opener taking the same pec to end range in the
 * warm-up. The app asked where it hurt and then did nothing about it. For a
 * physiotherapist's product that is the worst kind of defect: the screen looks
 * like it works.
 *
 * ── AND KETTLEBELL REHAB WAS PRESCRIBED AT 2-4x THE LOAD ───────────────────
 * Loads were relabelled by rounding every number to the nearest real bell,
 * independently. The lightest bell is 8 kg, so "2-4 kg per hand" — the
 * prescription for rotator-cuff external rotations, the most load-sensitive
 * drill in the app and one that sits in the PREHAB slot — printed as
 * "8-8 kg per hand". Two to four times the intended load, for someone who has
 * just told the app their shoulder hurts. It also produced "6-10 kg" -> "8-8 kg"
 * across fourteen cards.
 *
 * Two rules now: never round a load UP past what was prescribed, and a range
 * that collapses onto one bell prints as one number.
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import './_persist-shim.mjs';
import {
  restrictedTagsOn,
  restrictedTagsOnRecord,
  restrictedTagsFor,
  STRESS_TAG_LABELS,
} from '../lib/exercise-safety.ts';
import { getExerciseTargetRegionsMap, ACUTE_PREHAB_BY_REGION } from '../lib/exercise-db.ts';
import { LIBRARY_EXERCISES, CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';
import { generateWorkout } from '../lib/workout-engine.ts';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

console.log('\n[1] Reporting chest pain removes the pressing');

const chestBanned = restrictedTagsFor(['chest'], 'severe');
const blocked = (name) => restrictedTagsOn(name, chestBanned).length > 0;

for (const name of [
  'Barbell Bench Press',
  'Close-Grip Bench Press',
  'Decline Bench Press',
  'Incline DB Press',
  'DB Incline Press',
  'Incline Barbell Bench Press',
  'Board Press',
  'JM Press',
  'DB Floor Press',
  'Floor Press',
  'Dumbbell Bench Press',
  'Flat Bench Press',
]) {
  check(`"${name}" is screened out`, blocked(name), 'a strained pec must not be handed a press');
}

check(
  'the end-range chest stretch goes too',
  blocked('Doorway Chest Opener'),
  'an end-range passive stretch on a strained pec, in the warm-up, is the one place it must not go'
);

/**
 * Press-ups used to be listed below as a substitute that must SURVIVE a chest
 * complaint, on the argument that removing the regression leaves nothing to put
 * in the gap. Archie overruled that (decision 11, 2026-09-17) and the protocol
 * he wrote is why: ACUTE_PROTOCOL_NOTES.chest.avoid reads "Press-ups of any
 * kind, including incline - the bottom of a press-up is a loaded stretch of the
 * pec". The app was printing that sentence on the rehab banner and serving
 * press-ups in the same session.
 *
 * Every spelling, because the catalogue and the library disagree about the
 * word: "Push-Up", "Push Up", "Press Ups", and the variants underneath them.
 */
for (const name of [
  'Push-Up',
  'Push Up',
  'Kneeling Press Ups',
  'Kneeling Incline Press Ups',
  'Bench Press Ups',
  'Incline Push-Up',
  'Deficit Press Ups',
  'Decline Press Ups',
  'TRX Push Ups',
  'Wide Push-Up',
  'Scapular Push-Up',
]) {
  check(
    `"${name}" is screened out (decision 11)`,
    blocked(name),
    'no press-up variation may reach a session where the chest is the sore area'
  );
}

console.log('\n[2] ...without gutting the session or banning the substitutes');

for (const name of [
  'Leg Press',
  'DB Shoulder Press',
  'Landmine Press',
  'Barbell Row',
  'Bodyweight Squat',
  'Banded Serratus Punch',
  'Door Frame Rows',
]) {
  check(
    `"${name}" is still allowed`,
    !blocked(name),
    'over-screening leaves nothing to put in the gap - a chest complaint must still be able to train'
  );
}

check(
  'the new tag has a human label for the swap caption',
  typeof STRESS_TAG_LABELS.horizontal_press === 'string' &&
    STRESS_TAG_LABELS.horizontal_press.length > 0,
  'an untagged label prints "undefined" into the note on the card'
);

console.log('\n[3] Kettlebell loads are never rounded UP past the prescription');

const engine = readFileSync(new URL('../lib/workout-engine.ts', import.meta.url), 'utf8');

check(
  'a load lighter than the lightest bell is left as written',
  /if \(num < KB_WEIGHTS\[0\]\) return match;/.test(engine),
  '"2-4 kg per hand" became "8-8 kg per hand" - 2-4x the load on rotator-cuff rehab'
);

check(
  'a whole range below the lightest bell is left as written',
  /if \(hi < KB_WEIGHTS\[0\]\) return labelled;/.test(engine),
  'the rehab case: both ends under 8 kg'
);

check(
  'the two ends of a range are rounded separately',
  /const loKb = Math\.min\(nearestKbWeight\(lo\), nearestKbWeight\(hi\)\);/.test(engine),
  'one rounding applied to both is what produced "8-8 kg"'
);

check(
  'a range that collapses prints one number',
  /loKb === hiKb \? String\(loKb\) : `\$\{loKb\}-\$\{hiKb\}`/.test(engine),
  '"8-8 kg" is not a range, it is a bug on the card'
);

console.log('\n[4] Rehab sessions shade the body parts they actually worked');

const regionMap = getExerciseTargetRegionsMap();
const unmapped = [];
for (const [, list] of Object.entries(ACUTE_PREHAB_BY_REGION)) {
  for (const ex of list) if (!regionMap[ex.id]) unmapped.push(ex.id);
}

check(
  'every acute exercise resolves to its regions',
  unmapped.length === 0,
  unmapped.length
    ? `${unmapped.length} unmapped, e.g. ${unmapped.slice(0, 3).join(', ')} - the summary map shades the wrong body parts`
    : ''
);

check(
  'the chest protocol maps to the chest',
  (ACUTE_PREHAB_BY_REGION.chest ?? []).some((ex) => (regionMap[ex.id] ?? []).includes('chest')),
  'it used to shade hip, lower back and core - four areas the user never touched'
);

check(
  'the groin protocol maps to the hip/groin',
  (ACUTE_PREHAB_BY_REGION.hip_groin ?? []).some((ex) =>
    (regionMap[ex.id] ?? []).includes('hip_groin')
  ),
  'it used to shade glutes, lower back and ankle'
);

/**
 * ── AND NOW THE SAME RULE, ASKED OF THE SESSION RATHER THAN OF THE NAME ─────
 *
 * Everything above runs the screen over names, which is how the screen is
 * written, and it is where the chest bug was found. It is also, on its own,
 * exactly the defect this repo names as its commonest: a table can be right
 * while the session built from it is wrong, and the failure is silent because
 * the session looks like a session.
 *
 * Upper Body is built from Archie's library now, which is where the pressing
 * lives, so the headline case can finally be asked end to end: somebody taps
 * Chest, and the session that comes back has to contain no pressing at all,
 * still be worth doing, and be visibly different from the one they would have
 * been given if nothing hurt. All three are asserted, because dropping any one
 * of them lets a different failure through - a session with no pressing and
 * nothing else either, or one that was never going to press anyway.
 *
 * AND IT IS ASKED WITHOUT USING THE TABLE THE SCREEN ITSELF READS.
 * ───────────────────────────────────────────────────────────────
 * The first draft of this section asked whether any card carried a tag the
 * chest restricts, which sounds like the right question and is not one: the
 * check and the app were reading the same list, so deleting horizontal_press
 * from it - the exact bug at the top of this file - emptied the question and
 * left all five assertions green. It was caught by mutating the table and
 * watching the section pass.
 *
 * So the oracle is the records' OWN target regions, which the screen never
 * consults: eighteen library records say they work the chest, and not one of
 * them may be given to somebody whose chest hurts. That reading agrees with
 * Archie exactly where it matters - every press and every press-up is in it,
 * and the Banded Serratus Punch he ruled back in is not, because it lists the
 * front shoulder and the ribs rather than the chest.
 *
 * The tag reading is kept as a second question, because it catches the other
 * half: a record whose regions say nothing but whose authored stress or name
 * says press. It is read both ways, as the builder screens - the card's name
 * and cue as `applyInjurySafety` reads them, unioned with the record's own
 * stress.
 */
console.log('\n[5] A chest complaint changes the real Upper Body session');

const recordByName = new Map(
  [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES].map((r) => [r.name.toLowerCase(), r])
);
const TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const SEVERITIES = ['mild', 'moderate', 'severe'];

/** Every tag this movement asks of the chest, by name and by authored stress. */
const chestHitsOn = (card, banned) => {
  const record = recordByName.get(card.name.toLowerCase());
  return new Set([
    ...restrictedTagsOn(card.name, banned, undefined, card.cue),
    ...(record ? restrictedTagsOnRecord(record, banned) : []),
  ]);
};

/**
 * Does this card work the chest? Asked of the record, not of the screen.
 *
 * `targetRegions` is what the muscle map shades and what the record says about
 * itself. Nothing in the safety screen reads it, which is exactly why it is the
 * right question here.
 */
const worksTheChest = (card) =>
  (recordByName.get(card.name.toLowerCase())?.targetRegions ?? []).includes('chest');

const chestRecordCount = LIBRARY_EXERCISES.filter((r) =>
  (r.targetRegions ?? []).includes('chest')
).length;
check(
  `${chestRecordCount} library records say they work the chest, so there is something to withhold`,
  chestRecordCount > 10,
  'if no record claims the chest, the sweep below is asking nothing'
);

const workedItAnyway = [];
const pressedAnyway = [];
const gutted = [];
const unchanged = [];
const neverPressed = [];
let sessionsBuilt = 0;

for (const experienceLevel of EXPERIENCE_LEVELS) {
  for (const tier of TIERS) {
    // Both ids that mean Upper Body: the one the app uses and the one a stored
    // bench day out of somebody's history arrives under.
    for (const sessionType of ['upper_body', 'bench']) {
      const profile = {
        name: 'C',
        sex: 'female',
        experienceLevel,
        goals: ['fitness'],
        bodyweightKg: 70,
      };
      const ask = (readiness) =>
        generateWorkout(sessionType, tier, readiness, profile, {}, undefined, 0);
      const painFree = ask({ hasAches: false, energy: 'normal', timeAvailable: '60' });
      const pressedWhenWell = painFree.filter(worksTheChest);

      for (const painSeverity of SEVERITIES) {
        const where = `${experienceLevel} / ${tier} / ${sessionType} / ${painSeverity}`;
        const banned = restrictedTagsFor(['chest'], experienceLevel, painSeverity);
        const sore = ask({
          hasAches: true,
          painRegion: 'chest',
          painSeverity,
          energy: 'normal',
          timeAvailable: '60',
        });
        sessionsBuilt++;

        for (const card of sore) {
          // The rehab slot is the drill FOR the sore chest, so it is the one
          // card that is allowed to be about the chest.
          if (card.category === 'prehab') continue;
          if (worksTheChest(card)) workedItAnyway.push(`${where}: ${card.name}`);
          const hits = chestHitsOn(card, banned);
          if (hits.size > 0) {
            pressedAnyway.push(`${where}: ${card.name} carries ${[...hits].join(', ')}`);
          }
        }

        const work = sore.filter((e) => e.category === 'main' || e.category === 'accessory');
        if (work.length < 2) gutted.push(`${where}: ${work.length} piece(s) of work`);

        // Where they would have been pressing, the session has to have moved.
        if (pressedWhenWell.length > 0) {
          const shape = (list) => list.map((e) => e.name).join(' | ');
          if (shape(sore) === shape(painFree)) unchanged.push(where);
        } else if (painSeverity === 'severe') {
          neverPressed.push(`${where}: nothing in the pain-free session works the chest`);
        }
      }
    }
  }
}

check(
  `${sessionsBuilt} Upper Body sessions were really built for a sore chest`,
  sessionsBuilt > 100,
  'nothing was generated, so this section proves nothing'
);
check(
  'no exercise that works the chest reaches a session built for a sore chest',
  workedItAnyway.length === 0,
  `${workedItAnyway.length} of ${sessionsBuilt}, e.g. ${workedItAnyway[0]} - this is the bug at the top of this file, in a real session`
);
check(
  'and nothing carrying a stress the chest rules out does either',
  pressedAnyway.length === 0,
  `${pressedAnyway.length} of ${sessionsBuilt}, e.g. ${pressedAnyway[0]}`
);
check(
  'and the session is still worth doing, not emptied to make the rule true',
  gutted.length === 0,
  gutted[0]
);
check(
  'where the session would have pressed, reporting the chest changes it',
  unchanged.length === 0,
  `${unchanged[0]} built exactly the same session with the chest reported as with nothing sore`
);
check(
  // The other half of the same measurement: if NO kit ever pressed, the rule
  // above would be true and meaningless.
  `and there is kit on which it bites (${TIERS.length * EXPERIENCE_LEVELS.length * 2 - neverPressed.length} of ${TIERS.length * EXPERIENCE_LEVELS.length * 2} pain-free sessions work the chest)`,
  neverPressed.length < TIERS.length * EXPERIENCE_LEVELS.length * 2,
  'no pain-free upper body session anywhere works the chest, so withholding it proves nothing'
);

console.log(`\nclinical-screening: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
