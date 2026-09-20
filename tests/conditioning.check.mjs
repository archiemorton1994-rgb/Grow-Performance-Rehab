/**
 * Contract test: the conditioning session the app serves TODAY actually builds,
 * and it is made of Archie's nine conditioning exercises and nothing else.
 *
 * WHAT CHANGED, AND WHY
 * ─────────────────────
 * This check used to walk the braces of lib/exercise-db.ts counting `id:`
 * strings, and conclude from that count that a conditioning session would
 * contain at least one exercise. It never built one. A pool that is full in the
 * file and empty after the equipment filter, or after the injury screen, passed
 * it every time, which is this repo's commonest defect: a test that pins a
 * spelling and stays green while the behaviour breaks.
 *
 * So the floor is ACHIEVABLE rather than declared. Every assertion below that
 * can run the real code runs it, over every equipment answer, every level, every
 * energy and every length, and reads the session that comes back. Only the two
 * that cross into a React screen still read source, because a node check cannot
 * render one.
 *
 * AND THE SESSION IT GUARDS IS THE NEW ONE.
 * ─────────────────────────────────────────
 * Conditioning is built from Archie's nine records now - Sled Push, Sled Pull,
 * Sled Rows, Assault Bike, Incline Treadmill Walk, Rowing Machine, Duck Walks,
 * Skipping and Bear Crawl - worked as interval blocks on a clock scaled by level
 * and energy, with a pulse raiser at the top and a Restore cool-down at the
 * bottom. The old engine's circuits (CONDITIONING_WORKOUTS and the three pools
 * around it) are unreachable, so the sections that used to measure THEM measure
 * the session people are actually given instead. The clinical rules they carried
 * are re-expressed, not dropped: the floor is still achievable, energy is still
 * read, no session comes back empty, no id appears twice, and nothing from
 * outside the list can get in.
 *
 * Checks:
 *  1. THE ACHIEVABLE FLOOR — every kit x level x energy x length gives real
 *                            work, and a full gym gives the whole clock
 *  2. ENERGY IS READ       — the three energy answers are three prescriptions
 *  3. THE WHOLE SESSION    — generateWorkout('conditioning', ...) returns a
 *                            complete session at every tier, sore or not
 *  4. ID UNIQUENESS        — no session contains one id twice
 *  5. THE NINE, AND NOTHING ELSE — no main lift, no old circuit, and every
 *                            block is on Archie's list
 *  6. WIRING               — the engine really routes conditioning to the
 *                            library builder; train.tsx launches it
 *  7. EVERY SESSION TYPE   — across all of them, at every kit, level, length
 *                            and energy, no conditioning-role card is off-list
 *
 * Run:  npx tsx tests/conditioning.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import './_persist-shim.mjs';
import {
  getConditioningWorkout,
  getCooldown,
  getFinisher,
  getGoalConditioningBlock,
  getStandaloneFlexibilityWorkout,
  getStandalonePrehabWorkout,
} from '../lib/exercise-db.ts';
import { CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';
import { BLOCKS_BY_TIME, generateLibraryConditioningSession } from '../lib/library-conditioning.ts';
import { trainTypeOf } from '../lib/session-type.ts';
import { generateWorkout, LIBRARY_BUILT_TYPES } from '../lib/workout-engine.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const trainSrc = readFileSync(join(__dir, '../app/(tabs)/train.tsx'), 'utf8');
const sessionSrc = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');
const customSrc = readFileSync(join(__dir, '../app/custom-session.tsx'), 'utf8');

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

/** Archie's nine, by name. The whole universe a conditioning block may hold. */
const NINE = new Set(CONDITIONING_EXERCISES.map((e) => e.name));

/**
 * Every conditioning session this file builds goes through here.
 *
 * Routing conditioning away from its own builder does not return the wrong
 * session, it throws, because the lifting generator indexes its warm-up table
 * by a session type conditioning has no row in. Catching it turns a stack trace
 * into a named failure that says what broke.
 *
 * The session count is the SEVENTH POSITIONAL ARGUMENT and the equipment list
 * is a NAMED FIELD in the sixteenth. Passing either on the profile object is
 * silently ignored, which is how a seed loop becomes the same session generated
 * over and over; two checks in this repo have already been found doing it.
 */
const thrown = [];
function buildConditioning(tier, readiness, profile, sessionCount, where) {
  try {
    return generateWorkout(
      'conditioning',
      tier,
      readiness,
      profile,
      undefined,
      undefined,
      sessionCount,
      undefined,
      undefined,
      undefined,
      null,
      'kg',
      undefined,
      undefined,
      0,
      { equipment: [tier], sessionTypeCount: sessionCount }
    );
  } catch (error) {
    thrown.push(`${where}: ${error.message}`);
    return null;
  }
}

/** Every answer onboarding can leave in the profile, bench aside (a supply). */
const TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const ENERGIES = ['low', 'normal', 'high'];
const TIMES = ['30', '45', '60'];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'athlete'];
/**
 * Swept rather than left to today's date.
 *
 * The builder's variety turns on how many conditioning sessions the person has
 * finished, and nothing in it reads the clock - but the swap seed the engine
 * fills the cards with does, so a single-example assertion could still pass or
 * fail depending on the calendar. Two checks in this repo have been found doing
 * exactly that.
 */
const ROTATIONS = [0, 1, 2, 3, 5, 7];

const blocksOf = (session) => session.filter((e) => e.category === 'cardio');

// ─── 1. The achievable floor ──────────────────────────────────────────────────
console.log('\n[1] The achievable floor — every kit, level, energy and length yields real work');

const noWork = [];
const shortOfTheClock = [];
let cells = 0;

for (const tier of TIERS) {
  for (const level of LEVELS) {
    for (const energy of ENERGIES) {
      for (const timeAvailable of TIMES) {
        for (const n of ROTATIONS) {
          const where = `${tier}/${level}/${energy}/${timeAvailable}/n=${n}`;
          const session = buildConditioning(
            tier,
            { hasAches: false, energy, timeAvailable },
            { experienceLevel: level },
            n,
            where
          );
          cells++;
          if (session === null) continue;
          const blocks = blocksOf(session);
          if (blocks.length === 0) noWork.push(where);
          // A full gym owns every one of the nine, so nothing there has an
          // excuse for a short session. Home does: three of the nine need no
          // equipment, and a beginner may not be given the one that lands.
          if (tier === 'fullgym' && blocks.length !== BLOCKS_BY_TIME[timeAvailable]) {
            shortOfTheClock.push(`${where}: ${blocks.length} of ${BLOCKS_BY_TIME[timeAvailable]}`);
          }
        }
      }
    }
  }
}

check(
  `every cell gives at least one conditioning block (${cells.toLocaleString()} built)`,
  cells > 500 && noWork.length === 0,
  `${noWork.length} with nothing to do, e.g. ${noWork.slice(0, 3).join(' / ')}`
);
check(
  'and a full gym gets the whole clock, every time',
  shortOfTheClock.length === 0,
  `${shortOfTheClock.length} short, e.g. ${shortOfTheClock.slice(0, 3).join(' / ')}`
);

/**
 * The per-kit floor, stated rather than assumed.
 *
 * Nine records; three need no equipment, and a beginner may not be given the
 * one that lands (decision 7). So the most a beginner at home can be given is
 * two blocks. That is a fact about the list, not a bug, and the builder says so
 * in `notes` instead of padding the session out with something that is not
 * conditioning. This asserts that the sentence is there when the session is
 * short, and absent when it is not.
 */
const silentlyShort = [];
const noisyWhenFull = [];
for (const tier of TIERS) {
  for (const level of LEVELS) {
    for (const timeAvailable of TIMES) {
      const built = generateLibraryConditioningSession({
        equipment: [tier],
        readiness: { hasAches: false, energy: 'normal', timeAvailable },
        profile: { experienceLevel: level },
        sessionCount: 0,
      });
      const asked = BLOCKS_BY_TIME[timeAvailable];
      const where = `${tier}/${level}/${timeAvailable}`;
      if (built.blocks.length < asked && built.notes.length === 0) silentlyShort.push(where);
      if (built.blocks.length === asked && built.notes.length > 0) noisyWhenFull.push(where);
    }
  }
}
check(
  'a session shorter than the clock asked for says so, in words',
  silentlyShort.length === 0,
  `${silentlyShort.length} short and silent, e.g. ${silentlyShort.slice(0, 3).join(', ')}`
);
check(
  'and a full one does not apologise for nothing',
  noisyWhenFull.length === 0,
  `${noisyWhenFull.length} needless notes, e.g. ${noisyWhenFull.slice(0, 3).join(', ')}`
);

// ─── 2. Energy is read ────────────────────────────────────────────────────────
console.log('\n[2] Energy is read — the three answers are three prescriptions');

/**
 * What the card actually prescribes: how many rounds, and how long each is.
 *
 * Comparing names would go green with the interval frozen, because the same
 * three exercises come back whatever the energy answer was - the list is what
 * the kit allows, and energy does not change the kit. The work is the clock, so
 * the clock is what is compared.
 */
const clockOf = (session) =>
  blocksOf(session)
    .map((e) => `${e.sets}x${e.reps}`)
    .join('|');

const energyIgnored = [];
let energyCells = 0;
for (const tier of TIERS) {
  for (const level of LEVELS) {
    for (const n of ROTATIONS) {
      const byEnergy = ENERGIES.map((energy) =>
        clockOf(
          buildConditioning(
            tier,
            { hasAches: false, energy, timeAvailable: '45' },
            { experienceLevel: level },
            n,
            `${tier}/${level}/${energy}/n=${n}`
          ) ?? []
        )
      );
      energyCells++;
      if (new Set(byEnergy).size !== 3) energyIgnored.push(`${tier}/${level}/n=${n}`);
    }
  }
}
check(
  `the readiness screen's low / normal / high each prescribe something different (${energyCells} cells)`,
  energyCells > 0 && energyIgnored.length === 0,
  `${energyIgnored.length} cells where two energies were the same session, e.g. ${energyIgnored.slice(0, 3).join(', ')}`
);

/**
 * And the level is read too, which is the other half of the same promise.
 *
 * A beginner's twenty seconds on and a full minute off is a work-to-rest of one
 * to three; an athlete's is one to two thirds. If these ever collapse into one
 * prescription, the level question stopped meaning anything for conditioning.
 */
const levelClocks = new Set(
  LEVELS.map((level) =>
    clockOf(
      buildConditioning(
        'fullgym',
        { hasAches: false, energy: 'normal', timeAvailable: '45' },
        { experienceLevel: level },
        0,
        `fullgym/${level}`
      ) ?? []
    )
  )
);
check(
  `and the four experience levels are not one prescription (${levelClocks.size} distinct)`,
  levelClocks.size === LEVELS.length,
  `saw: ${[...levelClocks].join(' | ')}`
);

// ─── 3. The whole session ─────────────────────────────────────────────────────
console.log('\n[3] The whole session — a complete one comes back at every tier');

const SITUATIONS = [
  { label: 'nothing sore', readiness: {} },
  {
    label: 'sore knee, mild',
    readiness: { hasAches: true, painRegion: 'knee', painSeverity: 'mild', acute: true },
  },
  {
    label: 'sore knee, severe',
    readiness: { hasAches: true, painRegion: 'knee', painSeverity: 'severe', acute: true },
  },
  {
    label: 'sore lower back, moderate',
    readiness: { hasAches: true, painRegion: 'lower_back', painSeverity: 'moderate', acute: true },
  },
  {
    label: 'sore shoulder, moderate',
    readiness: { hasAches: true, painRegion: 'shoulder', painSeverity: 'moderate', acute: true },
  },
];

const emptySessions = [];
const duplicateIds = [];
const incomplete = [];
const badOpener = [];
const badCloser = [];
const offList = [];
const leaked = [];
let built = 0;
let workCards = 0;

/**
 * The one thing in the session that is not one of the nine, and the one thing
 * that stands in for the pulse raiser when the list is too short to spare one:
 * Restore's own drills. Read off the real pools rather than named here, so a
 * new Restore drill does not read as a leak.
 */
const restoreNames = new Set(
  [
    ...getStandalonePrehabWorkout(),
    ...getStandaloneFlexibilityWorkout(),
    ...getCooldown(),
  ].map((t) => t.name)
);

for (const tier of TIERS) {
  for (const energy of ENERGIES) {
    for (const timeAvailable of TIMES) {
      for (const situation of SITUATIONS) {
        for (const level of LEVELS) {
          for (const n of [0, 3, 7]) {
            const where = `${tier}/${energy}/${timeAvailable}/${situation.label}/${level}/n=${n}`;
            const session = buildConditioning(
              tier,
              { hasAches: false, energy, timeAvailable, ...situation.readiness },
              { experienceLevel: level },
              n,
              where
            );
            built++;
            if (session === null) continue;
            if (session.length === 0) {
              emptySessions.push(where);
              continue;
            }
            const ids = session.map((e) => e.id);
            if (new Set(ids).size !== ids.length) {
              duplicateIds.push(
                `${where}: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`
              );
            }
            if (session[0].category !== 'prep') badOpener.push(`${where}: ${session[0].category}`);
            const last = session[session.length - 1];
            if (last.category !== 'cooldown') badCloser.push(`${where}: ${last.category}`);
            for (const exercise of session) {
              if (!exercise.name || !exercise.cue || !exercise.reps) {
                incomplete.push(`${where}: ${exercise.name || '(no name)'}`);
              }
              if (exercise.category === 'main' || exercise.category === 'accessory') {
                leaked.push(`${where}: ${exercise.category} ${exercise.name}`);
              }
              if (exercise.category === 'cardio') {
                workCards++;
                if (!NINE.has(exercise.name)) offList.push(`${where}: ${exercise.name}`);
              }
              if (
                (exercise.category === 'prep' || exercise.category === 'cooldown') &&
                !NINE.has(exercise.name) &&
                !restoreNames.has(exercise.name)
              ) {
                offList.push(`${where}: ${exercise.category} ${exercise.name}`);
              }
            }
          }
        }
      }
    }
  }
}

check(
  'no conditioning session throws, which is what routing it elsewhere does',
  thrown.length === 0,
  `${thrown.length} threw, e.g. ${thrown.slice(0, 2).join(' / ')}`
);
check(
  `no conditioning session comes back empty (${built.toLocaleString()} built)`,
  built > 500 && emptySessions.length === 0,
  `${emptySessions.length} empty, e.g. ${emptySessions.slice(0, 3).join(' / ')}`
);
check(
  'every card in every session has a name, a cue and a prescription',
  incomplete.length === 0,
  `${incomplete.length} incomplete, e.g. ${incomplete.slice(0, 3).join(' / ')}`
);
check(
  'a warm-up opens every session',
  badOpener.length === 0,
  `${badOpener.length} opened on something else, e.g. ${badOpener.slice(0, 3).join(' / ')}`
);
check(
  'and a cool-down closes it',
  badCloser.length === 0,
  `${badCloser.length} closed on something else, e.g. ${badCloser.slice(0, 3).join(' / ')}`
);

// ─── 4. ID uniqueness ─────────────────────────────────────────────────────────
console.log('\n[4] ID uniqueness — two cards sharing an id would share their set log');

check(
  'no generated conditioning session contains the same exercise id twice',
  duplicateIds.length === 0,
  `${duplicateIds.length} sessions, e.g. ${duplicateIds.slice(0, 3).join(' / ')}`
);

// ─── 5. The nine, and nothing else ────────────────────────────────────────────
console.log(
  "\n[5] Conditioning is Archie's nine, not the old circuits and not a lifting session"
);

check(
  'a conditioning session contains no main lift and no accessory work',
  leaked.length === 0,
  `${leaked.length} cards, e.g. ${leaked.slice(0, 3).join(' / ')}`
);
check(
  `every card is on the conditioning list or comes from Restore (${workCards.toLocaleString()} blocks seen)`,
  workCards > 500 && offList.length === 0,
  `${offList.length} off-list cards, e.g. ${offList.slice(0, 3).join(' / ')}`
);

/**
 * THE NAMES THE RETIRED POOLS CAN PRODUCE AND ARCHIE'S LIST CANNOT.
 *
 * Computed from the real old pools rather than typed out, so it follows them
 * instead of pinning four spellings that will rot. Anything a Restore pool can
 * also produce is subtracted, because a Restore cool-down legitimately appears
 * in a conditioning session and a name is not evidence of which pool it came
 * from. What is left is the old engine's own conditioning work - the circuits,
 * the goal-conditioning blocks and the lift-day finishers - and none of it may
 * reach anybody again.
 */
const RETIRED_ONLY = new Set();
for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
  for (const key of ['easy', 'normal', 'hard']) {
    for (let d = 0; d < 40; d++) {
      for (const t of getConditioningWorkout(tier, key, d)) RETIRED_ONLY.add(t.name);
    }
    for (const t of getGoalConditioningBlock(tier, key)) RETIRED_ONLY.add(t.name);
    for (const s of ['squat', 'bench', 'deadlift']) {
      for (const t of getFinisher(s, tier, key)) RETIRED_ONLY.add(t.name);
    }
  }
}
for (const name of [...NINE, ...restoreNames]) RETIRED_ONLY.delete(name);

const retiredSightings = [];
for (const tier of TIERS) {
  for (const energy of ENERGIES) {
    for (const timeAvailable of TIMES) {
      for (const level of LEVELS) {
        const session =
          buildConditioning(
            tier,
            { hasAches: false, energy, timeAvailable },
            { experienceLevel: level },
            0,
            `${tier}/${energy}/${timeAvailable}/${level}`
          ) ?? [];
        for (const e of session) {
          if (RETIRED_ONLY.has(e.name)) retiredSightings.push(`${tier}/${energy}: ${e.name}`);
        }
      }
    }
  }
}
check(
  `nothing the retired conditioning pools alone could produce reaches a session (${RETIRED_ONLY.size} such names)`,
  RETIRED_ONLY.size > 50 && retiredSightings.length === 0,
  RETIRED_ONLY.size <= 50
    ? 'the retired-name set came back too small to be measuring anything'
    : `${retiredSightings.length} sightings, e.g. ${retiredSightings.slice(0, 3).join(' / ')}`
);

// ─── 6. Wiring ────────────────────────────────────────────────────────────────
console.log('\n[6] Wiring — the engine routes conditioning to the library builder');

check(
  'the app says conditioning is built from the library',
  LIBRARY_BUILT_TYPES.includes('conditioning'),
  `LIBRARY_BUILT_TYPES is ${LIBRARY_BUILT_TYPES.join(', ') || 'empty'}`
);

/**
 * AND IT IS THE SAME SESSION, CARD FOR CARD.
 *
 * Asked by building both and comparing, rather than by grepping the engine for
 * a function name. A route that called the builder and then quietly rebuilt the
 * session from the old catalogue would pass a grep and fail this.
 */
const routingMismatch = [];
for (const tier of TIERS) {
  for (const level of LEVELS) {
    for (const timeAvailable of TIMES) {
      const readiness = { hasAches: false, energy: 'normal', timeAvailable };
      const profile = { experienceLevel: level };
      const viaEngine = (buildConditioning(tier, readiness, profile, 2, `${tier}/${level}`) ?? [])
        .map((e) => `${e.category}:${e.id}:${e.sets}x${e.reps}`)
        .join('>');
      const viaBuilder = generateLibraryConditioningSession({
        equipment: [tier],
        readiness,
        profile,
        sessionCount: 2,
      })
        .exercises.map((e) => `${e.category}:${e.id}:${e.sets}x${e.reps}`)
        .join('>');
      if (viaEngine !== viaBuilder) {
        routingMismatch.push(`${tier}/${level}/${timeAvailable}`);
      }
    }
  }
}
check(
  'and what the engine hands back is what that builder made',
  routingMismatch.length === 0,
  `${routingMismatch.length} differed, e.g. ${routingMismatch.slice(0, 3).join(', ')}`
);

// The two assertions a node check cannot run, because they live in React
// screens. Kept as source reads, and kept positive: each asserts that text
// which must be present IS present.
check(
  "train.tsx navigates to /readiness with sessionType: 'conditioning'",
  trainSrc.includes("sessionType: 'conditioning'") ||
    /sessionType === 'conditioning'\)\s*\{[\s\S]{0,200}?pathname: '\/readiness',[\s\S]{0,120}?params: \{ sessionType,/.test(
      trainSrc
    ),
  'navigation call not found — tapping conditioning never launches a conditioning session'
);

check(
  'session.tsx imports generateWorkout from workout-engine',
  sessionSrc.includes('generateWorkout'),
  'import not found — session screen cannot generate any session type including conditioning'
);

/**
 * THE BUILD-YOUR-OWN SESSION OFFERS THE SAME MACHINES AND NO OTHERS.
 *
 * A source read, because CARDIO_OPTIONS is a hand-written list inside a React
 * screen and a node check cannot render one. But the ASSERTION is computed
 * against Archie's list rather than pinned to three spellings: every machine
 * offered has to be a record on it, so a fourth one added tomorrow fails here
 * whatever it is called, and renaming one of the nine cannot leave this green.
 *
 * "Other cardio" is the one allowed exception and it is named. It is not a
 * machine the app is prescribing - it is the one place somebody can log a run
 * or a swim they have actually done, under a name they type themselves.
 */
const OPTIONS_ESCAPE_HATCH = 'Other Cardio';
const optionsStart = customSrc.indexOf('const CARDIO_OPTIONS');
const optionsBlock =
  optionsStart === -1 ? '' : customSrc.slice(optionsStart, customSrc.indexOf('\n];', optionsStart));
const offeredCardio = [...optionsBlock.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
const notOnTheList = offeredCardio.filter((n) => !NINE.has(n) && n !== OPTIONS_ESCAPE_HATCH);

check(
  `the custom builder's cardio tile was found and holds something (${offeredCardio.length} options)`,
  offeredCardio.length >= 3,
  'CARDIO_OPTIONS moved or was renamed, so the rule below is reading nothing'
);
check(
  `and every machine it offers is on Archie's list (${offeredCardio.join(', ')})`,
  notOnTheList.length === 0,
  `${notOnTheList.join(', ')} is not one of the nine — a custom session could hold conditioning the rest of the app would never prescribe`
);

// ─── 7. Every session type ────────────────────────────────────────────────────
console.log("\n[7] No conditioning-role card, in any session type, is off Archie's list");

/**
 * THE WHOLE POINT OF THE PHASE, MEASURED ACROSS THE WHOLE APP.
 *
 * Conditioning does not only appear in the Conditioning session. Every library
 * strength session opens on a pulse raiser and, at an hour (or at 45 minutes for
 * a fat loss or fitness goal), closes its working half on a finisher, and both
 * are conditioning. So the promise "the nine, and nothing else" has to be asked
 * of every session type at once rather than of the one named after it.
 *
 * A CONDITIONING-ROLE CARD IS ONE FILED AS `cardio` OR `finisher`. Those two
 * categories exist for nothing else: `cardio` is an interval block, `finisher`
 * is the last hard effort. The pulse raiser is filed as `prep`, which it shares
 * with Restore's mobility drills, so the prep cards are held to a slightly wider
 * rule - on the list, or out of Restore - which is the honest statement of what
 * the top of a session is allowed to contain.
 *
 * The three lift-named ids are swept too, because somebody's history and the
 * Barbell Strength cycle still produce them and they map to real sessions.
 */
const SWEEP_TYPES = [
  'squat',
  'bench',
  'deadlift',
  'lower_body',
  'upper_body',
  'full_body',
  'conditioning',
];
/**
 * Both goals that change the shape of a session.
 *
 * A fat loss or fitness goal earns a finisher at 45 minutes as well as at 60,
 * so a sweep that only carried a muscle goal would see fewer finishers - the
 * cards this section exists to inspect.
 */
const SWEEP_GOALS = [['muscle'], ['fat_loss']];
/**
 * Two points in the rotation, because one of them is not a sweep of the list.
 *
 * Everything conditioning varies varies on how many sessions of that type have
 * been finished, and the library's slots move every third one, so a single
 * count sees one slice of the nine and could pass with six of them unreachable.
 */
const SWEEP_ROTATIONS = [0, 3, 8];

const roleOffList = [];
const prepOffList = [];
let cardioSeen = 0;
let finisherSeen = 0;
let prepSeen = 0;
let sweptSessions = 0;
const namesSeen = new Set();

for (const sessionType of SWEEP_TYPES) {
  for (const tier of TIERS) {
    for (const level of LEVELS) {
      for (const timeAvailable of TIMES) {
        for (const energy of ENERGIES) {
          for (const goals of SWEEP_GOALS) {
           for (const n of SWEEP_ROTATIONS) {
            let session;
            try {
              session = generateWorkout(
                sessionType,
                tier,
                { hasAches: false, energy, timeAvailable },
                { name: 'S', sex: 'male', experienceLevel: level, goals, bodyweightKg: 80 },
                undefined,
                undefined,
                n,
                undefined,
                undefined,
                undefined,
                null,
                'kg',
                undefined,
                undefined,
                0,
                { equipment: [tier], sessionTypeCount: n }
              );
            } catch (error) {
              roleOffList.push(`${sessionType}/${tier}/${level} threw: ${error.message}`);
              continue;
            }
            sweptSessions++;
            const where = `${sessionType}/${tier}/${level}/${timeAvailable}/${energy}/${goals[0]}/n=${n}`;
            for (const card of session) {
              if (card.category === 'cardio' || card.category === 'finisher') {
                if (card.category === 'cardio') cardioSeen++;
                else finisherSeen++;
                namesSeen.add(card.name);
                if (!NINE.has(card.name)) roleOffList.push(`${where}: ${card.name}`);
              } else if (card.category === 'prep') {
                prepSeen++;
                if (!NINE.has(card.name) && !restoreNames.has(card.name)) {
                  prepOffList.push(`${where}: ${card.name}`);
                }
              }
            }
           }
          }
        }
      }
    }
  }
}

check(
  `the sweep really ran (${sweptSessions.toLocaleString()} sessions over ${SWEEP_TYPES.length} types, ${TIERS.length} kits, ${LEVELS.length} levels, ${TIMES.length} lengths, ${ENERGIES.length} energies)`,
  sweptSessions > 6000 && cardioSeen > 0 && finisherSeen > 0 && prepSeen > 0,
  `cardio ${cardioSeen}, finisher ${finisherSeen}, prep ${prepSeen} - a zero means the rule below measures nothing`
);
check(
  `every conditioning block and finisher is one of the nine (${(cardioSeen + finisherSeen).toLocaleString()} cards)`,
  roleOffList.length === 0,
  `${roleOffList.length} off-list, e.g. ${roleOffList.slice(0, 5).join(' / ')}`
);
check(
  `every warm-up card is on the list or out of Restore (${prepSeen.toLocaleString()} cards)`,
  prepOffList.length === 0,
  `${prepOffList.length} off-list, e.g. ${prepOffList.slice(0, 5).join(' / ')}`
);
check(
  `and the sweep saw the whole list rather than one exercise over and over (${namesSeen.size} of ${NINE.size})`,
  namesSeen.size === NINE.size,
  `only ever saw: ${[...namesSeen].join(', ')}`
);

/**
 * Every type in the sweep is one the app really builds, asked of the app.
 *
 * Without it, a typo in SWEEP_TYPES would sweep a session type that throws and
 * gets skipped, and the counts above would still look healthy.
 */
check(
  'and every type swept is one the app builds from the library',
  SWEEP_TYPES.every((t) => LIBRARY_BUILT_TYPES.includes(trainTypeOf(t))),
  `${SWEEP_TYPES.filter((t) => !LIBRARY_BUILT_TYPES.includes(trainTypeOf(t))).join(', ')} is not on LIBRARY_BUILT_TYPES`
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`conditioning: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`conditioning: all ${total} checks passed\n`);
  process.exitCode = 0;
}
