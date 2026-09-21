/**
 * Contract test: reporting a sore area changes the session, and changes it
 * towards the easier movement rather than away from a record.
 *
 * WHAT THIS FILE USED TO DO, AND WHY IT HAD TO STOP
 * ────────────────────────────────────────────────
 * It read lib/exercise-db.ts as text, counted `comfortVariant:` blocks, pulled
 * the `triggerRegions` out of each one, and asserted that every PainRegion
 * appeared in at least one of them. Then it read lib/workout-engine.ts as text
 * and asserted that four named functions existed and called one another.
 *
 * Every one of those assertions passed while comfort variants were reaching
 * nobody, and would have gone on passing after they were deleted. That is this
 * repo's commonest defect and this was the clearest example of it: a test that
 * pins a spelling, guarding a feature that had already gone.
 *
 * WHAT REPLACED THE FEATURE
 * ─────────────────────────
 * A comfort variant was a gentler movement written INSIDE another exercise's
 * record - Knee Diamond Push-Up, Box Goblet Squat, Floor Press. It had no id of
 * its own, no level, no video and no row on Archie's list, so a session that
 * served one served a card the rest of the app had never heard of. Which areas
 * were covered was an accident of which templates somebody had annotated.
 *
 * Every Train session is built from the library now, and it answers the same
 * question with records. A slot whose movement today rules out takes another
 * record OF THE SAME PATTERN that is clean for the flagged area and is NO
 * HARDER A RUNG, the card says what it replaced, and the swap slot offers the
 * original back under its own id.
 *
 * WHAT IS ASSERTED, BY RUNNING THE GENERATOR
 * ──────────────────────────────────────────
 *   [1] every area the app lets somebody report is an area it adapts for
 *   [2] every stand-in is a real record, same pattern, clean for that area
 *   [3] a stand-in is never a harder rung than the movement it replaced, and
 *       the only exceptions are where nothing easier was clean and owned
 *   [4] the card says what it replaced and offers it back
 *   [5] the old mechanism is gone: no card is a comfort variant
 *
 * Run:  npx tsx tests/comfort-variant-coverage.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { PAIN_CATEGORIES } from '../lib/store.ts';
import { generateWorkout } from '../lib/workout-engine.ts';
import { generateLibrarySession, slotPool, levelCeilingFor } from '../lib/library-session.ts';
import { LIBRARY_EXERCISES, patternsOf } from '../lib/exercise-library.ts';
import {
  restrictedTagsFor,
  restrictedTagsOn,
  restrictedTagsOnRecord,
  RESTRICTED_BY_REGION,
} from '../lib/exercise-safety.ts';

let failures = 0;
let total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

/** One key per movement, so two spellings of the same thing are one thing. */
const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const libraryByKey = new Map(LIBRARY_EXERCISES.map((e) => [key(e.name), e]));

// ─── 0. The areas somebody can report ────────────────────────────────────────
console.log('\n[0] The areas the app lets somebody report');

const REGIONS = Object.values(PAIN_CATEGORIES).flatMap((g) => g.regions.map((r) => r.id));
check(
  `PAIN_CATEGORIES offers at least 15 areas (found ${REGIONS.length})`,
  REGIONS.length >= 15,
  'the readiness screen draws its list from here, so an empty one is no screen at all'
);
const unruled = REGIONS.filter((r) => !RESTRICTED_BY_REGION[r]);
check(
  'and every one of them has a rule about what it rules out',
  unruled.length === 0,
  `${unruled.join(', ')} can be reported and mean nothing`
);

// ─── The sweep ───────────────────────────────────────────────────────────────
const TYPES = ['lower_body', 'upper_body', 'full_body'];
const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bands', 'dumbbells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'athlete'];
const SEEDS = [0, 1, 5, 11];

const profileFor = (level) => ({
  name: 'T',
  sex: 'male',
  experienceLevel: level,
  goals: ['muscle'],
  bodyweightKg: 80,
  standingSoreRegions: [],
  clinicalAvoid: [],
});

/** Every substitution the sweep produced, with the facts needed to judge it. */
const swaps = [];
/** Areas that produced at least one adapted session. */
const adapted = new Set();
/** Cards left carrying something their area rules out. */
const unsafe = [];
/** Stand-ins that are not on any list. */
const offList = [];
/** Cards built by the retired comfort-variant path. */
const comfortIds = [];
let sessionsBuilt = 0;

for (const type of TYPES) {
  for (const equipment of KITS) {
    for (const level of LEVELS) {
      const profile = profileFor(level);
      const ceiling = levelCeilingFor(profile);
      for (const region of REGIONS) {
        const banned = restrictedTagsFor([region], level, 'moderate');
        for (const seed of SEEDS) {
          const readiness = {
            hasAches: true,
            painRegion: region,
            painSeverity: 'moderate',
            energy: 'normal',
            timeAvailable: '60',
          };
          const session = generateLibrarySession({
            sessionType: type,
            equipment,
            readiness,
            profile,
            sessionTypeCount: seed,
            strengthSessionCount: seed,
            daysSinceLastSession: null,
          }).exercises;
          sessionsBuilt++;
          const inSession = new Set(session.map((e) => key(e.name)));
          const where = `${type} / ${equipment.join('+') || 'nothing'} / ${level} / ${region} / session ${seed}`;

          for (const ex of session) {
            if (ex.id?.endsWith('-comfort')) comfortIds.push(`${where}: ${ex.id}`);
            // A rehab drill is chosen FOR the sore area, so it is exempt from
            // being screened for mentioning it. Everything else is not.
            if (ex.category !== 'prehab' && banned.size > 0) {
              const hits = restrictedTagsOn(ex.name, banned, undefined, ex.cue);
              if (hits.length > 0) unsafe.push(`${where}: ${ex.name} carries ${hits.join(', ')}`);
            }
            if (ex.badge !== 'comfort' || !ex.safetyNote) continue;
            adapted.add(region);
            const to = libraryByKey.get(key(ex.name));
            const from = libraryByKey.get(key(ex.swapName ?? ''));
            if (!to) offList.push(`${where}: served ${ex.name}`);
            if (!from) offList.push(`${where}: replaced ${ex.swapName ?? '(nothing)'}`);
            swaps.push({ where, ex, to, from, banned, ceiling, equipment, inSession, region });
          }
        }
      }
    }
  }
}

console.log(`\n      ${sessionsBuilt.toLocaleString('en-GB')} sessions built, ${swaps.length} substitutions`);

// ─── 1. Every area is adapted for ────────────────────────────────────────────
console.log('\n[1] Every area somebody can report changes the session');

check(
  `the sweep really built sessions (${sessionsBuilt})`,
  sessionsBuilt > 500 && swaps.length > 100,
  'nothing was generated, so everything below proves nothing'
);

/**
 * Asked as "could it possibly bite", so the answer does not depend on which
 * record the rotation happened to land on. An area produces no substitution for
 * one of exactly two reasons: nothing in the strength library carries anything
 * it rules out, which is honest and is the case for the two ankle areas - their
 * rules name high impact, ankle load and calf lengthening, and the only records
 * carrying those are the jumps, which live in the Athlete-only power block and
 * never enter a pattern pool. Or the adaptation is broken for that area, which
 * is the silent failure this file exists to catch.
 */
const couldBite = (region) => {
  const banned = restrictedTagsFor([region], 'intermediate', 'moderate');
  return LIBRARY_EXERCISES.some(
    (e) =>
      e.role !== 'power' &&
      (restrictedTagsOnRecord(
        {
          name: e.name,
          movementPattern: e.movementPattern,
          reps: e.reps,
          cue: e.cue,
          stress: e.stress,
        },
        banned
      ).length > 0 ||
        restrictedTagsOn(e.name, banned, undefined, e.cue).length > 0)
  );
};
const neverAdapted = REGIONS.filter((r) => !adapted.has(r) && couldBite(r));
check(
  'every area whose rules rule out a strength record produces a labelled substitution',
  neverAdapted.length === 0,
  `${neverAdapted.join(', ')} - somebody reports it, the library holds work it forbids, and no card ever moves`
);
console.log(
  `      (${REGIONS.filter((r) => !couldBite(r)).join(', ') || 'none'} rule out nothing in the strength library, so they move no slot)`
);

check(
  'and no card is left carrying something the reported area rules out',
  unsafe.length === 0,
  unsafe.slice(0, 5).join(' | ')
);

/**
 * AND SAYING SO ALWAYS CHANGES THE SESSION, whether or not a slot moved. The
 * two ankle areas move no slot and must still not be inert: the rehab drill for
 * the area is added, and the explosive and conditioning work severity drops.
 */
const inert = [];
for (const type of TYPES) {
  for (const equipment of [KITS[1], KITS[3]]) {
    for (const level of ['beginner', 'advanced']) {
      const profile = profileFor(level);
      const quiet = generateLibrarySession({
        sessionType: type,
        equipment,
        readiness: { hasAches: false, energy: 'normal', timeAvailable: '60' },
        profile,
        sessionTypeCount: 0,
        strengthSessionCount: 0,
        daysSinceLastSession: null,
      }).exercises.map((e) => e.name).join('|');
      for (const region of REGIONS) {
        const sore = generateLibrarySession({
          sessionType: type,
          equipment,
          readiness: {
            hasAches: true,
            painRegion: region,
            painSeverity: 'moderate',
            energy: 'normal',
            timeAvailable: '60',
          },
          profile,
          sessionTypeCount: 0,
          strengthSessionCount: 0,
          daysSinceLastSession: null,
        }).exercises.map((e) => e.name).join('|');
        if (sore === quiet) inert.push(`${type} / ${equipment.join('+')} / ${level} / ${region}`);
      }
    }
  }
}
check(
  'reporting an area never leaves the session exactly as it was',
  inert.length === 0,
  inert.slice(0, 5).join(' | ')
);

// ─── 2. The stand-in is a real record of the same pattern ────────────────────
console.log('\n[2] A stand-in is a record on the list, doing the same job');

check(
  'every substitution names a library record, both sides of it',
  offList.length === 0,
  offList.slice(0, 5).join(' | ')
);

const wrongPattern = swaps.filter(
  ({ to, from }) => to && from && !patternsOf(to).some((p) => patternsOf(from).includes(p))
);
check(
  'a stand-in trains the same pattern as the movement it replaced',
  wrongPattern.length === 0,
  wrongPattern
    .slice(0, 5)
    .map(({ where, to, from }) => `${where}: ${from.name} -> ${to.name}`)
    .join(' | ')
);

const dirty = swaps.filter(
  ({ to, banned }) =>
    to &&
    restrictedTagsOnRecord(
      {
        name: to.name,
        movementPattern: to.movementPattern,
        reps: to.reps,
        cue: to.cue,
        stress: to.stress,
      },
      banned
    ).length > 0
);
check(
  'and it is clean for the area that moved it',
  dirty.length === 0,
  dirty
    .slice(0, 5)
    .map(({ where, to }) => `${where}: ${to.name}`)
    .join(' | ')
);

// ─── 3. Easier, never harder ─────────────────────────────────────────────────
console.log('\n[3] The stand-in is the easier movement, not merely a different one');

/**
 * Asked as an EXISTENCE question rather than by re-running the pick, so this
 * cannot simply agree with the code under test. For every stand-in that sits on
 * a harder rung than the movement it replaced, the pattern's own pool is asked
 * whether anything at or below that rung was clean for today, owned, and not
 * already somewhere else in the session. If something was, the app chose the
 * harder movement when it did not have to.
 */
const harder = swaps.filter(({ to, from }) => to && from && to.level > from.level);
const avoidable = harder.filter(({ to, from, banned, ceiling, equipment, inSession }) => {
  const pattern =
    patternsOf(to).find((p) => patternsOf(from).includes(p)) ?? from.pattern;
  return slotPool(pattern, ceiling, equipment.length > 0 ? equipment : ['bodyweight']).some(
    (record) =>
      record.level <= from.level &&
      !inSession.has(key(record.name)) &&
      restrictedTagsOnRecord(
        {
          name: record.name,
          movementPattern: record.movementPattern,
          reps: record.reps,
          cue: record.cue,
          stress: record.stress,
        },
        banned
      ).length === 0 &&
      restrictedTagsOn(record.name, banned, undefined, record.cue).length === 0
  );
});

check(
  'no stand-in is a harder rung while an easier clean one was available',
  avoidable.length === 0,
  avoidable
    .slice(0, 5)
    .map(({ where, to, from }) => `${where}: ${from.name} (level ${from.level}) -> ${to.name} (level ${to.level})`)
    .join(' | ')
);
console.log(
  `      (${harder.length} of ${swaps.length} sat on a harder rung, every one of them because nothing easier was clean and owned)`
);

// ─── 4. The card says what it replaced, and offers it back ───────────────────
console.log('\n[4] The card is honest about what it did');

const noNote = swaps.filter(({ ex }) => !ex.safetyNote || !ex.swapName);
check(
  'every substitution carries a note and a way back',
  noNote.length === 0,
  noNote.slice(0, 5).map(({ where, ex }) => `${where}: ${ex.name}`).join(' | ')
);
const noId = swaps.filter(({ ex, from }) => from && ex.swapId !== from.id);
check(
  'and the way back carries the id of the record it puts back, so a revert logs as itself',
  noId.length === 0,
  noId.slice(0, 5).map(({ where, ex }) => `${where}: ${ex.swapName} offered as ${ex.swapId}`).join(' | ')
);
const namesArea = swaps.filter(({ ex }) => !/to protect/i.test(ex.safetyNote ?? ''));
check(
  'the note says the area is what moved it',
  namesArea.length === 0,
  namesArea.slice(0, 3).map(({ where, ex }) => `${where}: "${ex.safetyNote}"`).join(' | ')
);

// ─── 5. The retired mechanism is gone ────────────────────────────────────────
console.log('\n[5] No session serves a comfort variant any more');

check(
  'no card is built by the old comfort path',
  comfortIds.length === 0,
  comfortIds.slice(0, 5).join(' | ')
);

/**
 * THE 152 NAMES THIS USED TO HUNT FOR NO LONGER EXIST, so the hunt is retired.
 *
 * A comfort variant was a gentler version of an exercise written INSIDE that
 * exercise's own record - no id, no level, no video, no row on any list - which
 * is what made it unanswerable: nothing could look one up, so nothing could say
 * how hard it was or whether it was safe. This section read every
 * `comfortVariant:` block out of lib/exercise-db.ts, kept the names that
 * appeared nowhere else, and proved none of them reached a card.
 *
 * Those blocks were part of the old Train catalogue and went with it. The
 * sample came back as zero, and the assertion said of itself that a sample of
 * zero "proves nothing and should be retired with the tables" - so it is, here,
 * rather than left passing over an empty set.
 *
 * WHAT STILL HOLDS THE RULE. The first check above is untouched: no card the
 * app builds carries a comfort id. The sweep below keeps looking for one across
 * every session type, kit and sore area. And the general form of the promise -
 * a card can only ever be a record on one of the three lists - is
 * tests/library-only.check.mjs, which a comfort variant could never satisfy,
 * because having no record of its own was the whole problem with it.
 */
const served = [];
let sweptSessions = 0;
let sweptCards = 0;
for (const type of [...TYPES, 'conditioning', 'prehab', 'flexibility']) {
  for (const tier of ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym']) {
    for (const region of REGIONS) {
      const session = generateWorkout(
        type,
        tier,
        {
          hasAches: true,
          painRegion: region,
          painSeverity: 'moderate',
          energy: 'normal',
          timeAvailable: '60',
        },
        profileFor('intermediate'),
        undefined,
        undefined,
        0,
        undefined,
        undefined,
        undefined,
        null,
        'kg',
        undefined,
        undefined,
        0,
        { equipment: [tier], sessionTypeCount: 0 }
      );
      sweptSessions++;
      for (const ex of session) {
        sweptCards++;
        if (ex.id?.endsWith('-comfort')) served.push(`${type}/${tier}/${region}: ${ex.id}`);
      }
    }
  }
}
check(
  `the sweep really ran (${sweptSessions} sessions, ${sweptCards} cards)`,
  sweptSessions > 0 && sweptCards > sweptSessions,
  'a sweep that builds nothing would find nothing and pass'
);
check(
  'and no card in any session the app builds carries a comfort id',
  served.length === 0,
  served.slice(0, 5).join(' | ')
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`comfort-variant-coverage: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`comfort-variant-coverage: all ${total} checks passed\n`);
  process.exitCode = 0;
}
