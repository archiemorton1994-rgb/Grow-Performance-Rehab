/**
 * Contract test: the conditioning session builder, swept and then pinned to a
 * per-kit floor.
 *
 * WHY THIS EXISTS, AND WHY IT REPLACES A SOURCE-READING CHECK
 * ──────────────────────────────────────────────────────────
 * The conditioning check that came before this one counted `id:` strings inside
 * lib/exercise-db.ts by walking braces, and concluded from that count that a
 * conditioning session would contain at least one exercise. It never built one.
 * A pool that is non-empty in the file and empty after the equipment filter, or
 * after the injury screen, would have passed it every time.
 *
 * So nothing here reads source. Every assertion builds real sessions from real
 * answers and reads what comes back, and the floor it holds the builder to is
 * stated per kit set, because "four blocks" is simply not true at home: nine
 * conditioning records exist and only three of them need no equipment.
 *
 * THE SWEEP
 * ─────────
 * Six equipment answers x four experience levels x three session lengths x
 * three energies x eight pain situations (none, plus seven areas reported
 * today, carried since sign-up or named by a clinician) x six session counts.
 * Roughly ten thousand sessions, every one of them checked for:
 *
 *   [1] only the nine conditioning names, plus Restore for the warm-up and the
 *       cool-down
 *   [2] no exercise carrying a tag today's areas rule out
 *   [3] no high impact, and so no Skipping, for a beginner (decision 7)
 *   [4] no exercise twice anywhere, which is stronger than never twice in a row
 *   [5] the interval is inside its bounds and no block dose can be progressed
 *   [6] every session has a warm-up, its blocks and a cool-down, in that order,
 *       or an honest empty state and nothing else
 *
 * Then, separately:
 *
 *   [7]  THE PER-KIT ACHIEVABLE FLOOR: a pinned table of how many blocks each
 *        kit set really yields at each length, for a beginner and for everyone
 *        else, asserted by building the sessions
 *   [8]  a home user with a sore knee still gets a session, and it holds to the
 *        clinical table
 *   [9]  the honest empty state when truly nothing fits
 *   [10] work, rest and rounds scale with level and with energy
 *   [11] the same answers build the same session twice, and different session
 *        counts move the blocks along
 *   [12] an easier week eases the sled and leaves the rounds alone
 *
 * Run:  npx tsx tests/library-conditioning.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';
import { CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';
import { canPerformWith } from '../lib/kit.ts';
import {
  RESTRICTED_BY_REGION,
  restrictedTagsFor,
  restrictedTagsOn,
  restrictedTagsOnRecord,
} from '../lib/exercise-safety.ts';
import {
  getCooldown,
  getRegionPrehabWorkout,
  getStandalonePrehabWorkout,
} from '../lib/exercise-db.ts';
import {
  BLOCKS_BY_TIME,
  INTERVAL_BOUNDS,
  generateLibraryConditioningSession,
  intervalFor,
} from '../lib/library-conditioning.ts';
import { parseReps } from '../lib/rep-scheme.ts';
import { CLINICAL } from './_clinical-expectations.mjs';

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
const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const NINE = CONDITIONING_EXERCISES.map((e) => e.name);
const nineByKey = new Map(CONDITIONING_EXERCISES.map((e) => [key(e.name), e]));
const ALL_REGIONS = Object.keys(RESTRICTED_BY_REGION);
const restoreByKey = new Map(
  [
    ...getStandalonePrehabWorkout(),
    ...getCooldown(),
    ...ALL_REGIONS.flatMap((r) => getRegionPrehabWorkout(r, { acute: true })),
  ].map((t) => [key(t.name), t])
);

console.log('\n[0] The list this session is built from');
check(
  'there are exactly nine conditioning records and every one is written',
  NINE.length === 9 && CONDITIONING_EXERCISES.every((e) => e.cue.length > 0),
  `${NINE.length} records: ${NINE.join(', ')}`
);
check(
  'three of the nine need no equipment, which is what a home session is made of',
  CONDITIONING_EXERCISES.filter((e) => canPerformWith(e, [])).length === 3,
  CONDITIONING_EXERCISES.filter((e) => canPerformWith(e, []))
    .map((e) => e.name)
    .join(', ')
);

// ── The sweep ────────────────────────────────────────────────────────────────
const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bands'],
  ['bodyweight', 'bands', 'dumbbells', 'bench'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
  ['fullgym'],
];
const TIMES = ['30', '45', '60'];
const ENERGIES = ['low', 'normal', 'high'];
const COUNTS = [0, 1, 2, 3, 7, 11];
/** None, then an area in each of the three ways the app can learn about one. */
const SITUATIONS = [
  { label: 'nothing sore', readiness: {}, profile: {} },
  {
    label: 'knee reported today, mild',
    readiness: { hasAches: true, painRegion: 'knee', painSeverity: 'mild', acute: true },
    profile: {},
  },
  {
    label: 'knee reported today, severe',
    readiness: { hasAches: true, painRegion: 'knee', painSeverity: 'severe', acute: true },
    profile: {},
  },
  {
    label: 'wrist reported today, moderate',
    readiness: { hasAches: true, painRegion: 'wrist', painSeverity: 'moderate', acute: true },
    profile: {},
  },
  {
    label: 'ankle carried since sign-up',
    readiness: {},
    profile: { standingSoreRegions: ['ankle_achilles'] },
  },
  {
    label: 'lower back named by a clinician',
    readiness: {},
    profile: { clinicalAvoid: ['lower_back'] },
  },
  {
    label: 'knee today and a wrist carried since sign-up',
    readiness: { hasAches: true, painRegion: 'knee', painSeverity: 'moderate', acute: true },
    profile: { standingSoreRegions: ['wrist'] },
  },
  {
    label: 'front shoulder today, moderate',
    readiness: { hasAches: true, painRegion: 'front_shoulder', painSeverity: 'moderate', acute: true },
    profile: {},
  },
];

const offList = [];
const bannedThrough = [];
const beginnerImpact = [];
const repeated = [];
const badInterval = [];
const progressable = [];
const badShape = [];
const thrown = [];
let swept = 0;
let emptyStates = 0;

for (const equipment of KITS) {
  for (const level of EXPERIENCE_LEVELS) {
    for (const timeAvailable of TIMES) {
      for (const energy of ENERGIES) {
        for (const situation of SITUATIONS) {
          for (const sessionCount of COUNTS) {
            const profile = { experienceLevel: level, ...situation.profile };
            const readiness = {
              hasAches: false,
              energy,
              timeAvailable,
              ...situation.readiness,
            };
            const where = `${equipment.join('+') || 'nothing'} / ${level} / ${timeAvailable}min / ${energy} / ${situation.label} / n=${sessionCount}`;
            let session;
            try {
              session = generateLibraryConditioningSession({
                equipment,
                readiness,
                profile,
                sessionCount,
              });
            } catch (error) {
              thrown.push(`${where}: ${error.message}`);
              continue;
            }
            swept++;

            const flagged = [
              ...new Set([
                ...(Array.isArray(readiness.painRegion)
                  ? readiness.painRegion
                  : readiness.painRegion
                    ? [readiness.painRegion]
                    : []),
                ...(profile.standingSoreRegions ?? []),
                ...(profile.clinicalAvoid ?? []),
              ]),
            ];
            const banned = restrictedTagsFor(flagged, level, readiness.painSeverity ?? 'mild');

            // [6] shape, before anything else reads the cards
            if (session.emptyState) {
              emptyStates++;
              if (session.exercises.length > 0 || session.blocks.length > 0) {
                badShape.push(`${where}: empty state with ${session.exercises.length} cards`);
              }
              // Three of the nine need no equipment, so nothing but a sore area
              // can empty the list. An empty state for somebody who reported
              // nothing means the kit filter or the beginner rule has gone wrong.
              if (flagged.length === 0) {
                badShape.push(`${where}: nothing to give, and nothing was sore`);
              }
              continue;
            }
            const categories = session.exercises.map((e) => e.category);
            const cardioCount = categories.filter((c) => c === 'cardio').length;
            if (
              categories[0] !== 'prep' ||
              categories[categories.length - 1] !== 'cooldown' ||
              cardioCount !== session.blocks.length ||
              session.blocks.length < 1 ||
              categories.slice(1, 1 + cardioCount).some((c) => c !== 'cardio')
            ) {
              badShape.push(`${where}: ${categories.join(',')} against ${session.blocks.length} blocks`);
            }

            for (const card of session.exercises) {
              // [1] only names from the nine or from Restore
              const k = key(card.name);
              if (!nineByKey.has(k) && !restoreByKey.has(k)) {
                offList.push(`${where}: ${card.name}`);
              }
              // [2] nothing carrying a tag today rules out
              const record = nineByKey.get(k);
              const hits = record
                ? [
                    ...restrictedTagsOnRecord(
                      {
                        name: record.name,
                        movementPattern: record.movementPattern,
                        reps: record.reps,
                        cue: record.cue,
                        stress: record.stress,
                      },
                      banned
                    ),
                    ...restrictedTagsOn(card.name, banned, undefined, card.cue),
                  ]
                : restrictedTagsOn(card.name, banned, undefined, card.cue);
              if (hits.length > 0) {
                bannedThrough.push(`${where}: ${card.name} carries ${[...new Set(hits)].join(', ')}`);
              }
              // [3] decision 7: nothing that lands, for a beginner
              if (level === 'beginner') {
                const impact = restrictedTagsOn(
                  card.name,
                  new Set(['high_impact']),
                  undefined,
                  card.cue
                );
                if (impact.length > 0) beginnerImpact.push(`${where}: ${card.name}`);
              }
            }

            // [4] no exercise twice anywhere in the session, by name or by id
            const names = session.exercises.map((e) => key(e.name));
            const ids = session.exercises.map((e) => e.id);
            if (new Set(names).size !== names.length || new Set(ids).size !== ids.length) {
              repeated.push(`${where}: ${session.exercises.map((e) => e.name).join(' | ')}`);
            }

            // [5] the interval, and the promise that a block never climbs
            for (const block of session.blocks) {
              if (
                block.workSeconds < INTERVAL_BOUNDS.workSeconds.min ||
                block.workSeconds > INTERVAL_BOUNDS.workSeconds.max ||
                block.restSeconds < INTERVAL_BOUNDS.restSeconds.min ||
                block.restSeconds > INTERVAL_BOUNDS.restSeconds.max ||
                block.rounds < INTERVAL_BOUNDS.rounds.min ||
                block.rounds > INTERVAL_BOUNDS.rounds.max
              ) {
                badInterval.push(
                  `${where}: ${block.name} ${block.rounds}x${block.workSeconds}s/${block.restSeconds}s`
                );
              }
              if (!nineByKey.has(key(block.name))) {
                offList.push(`${where}: block ${block.name}`);
              }
            }
            for (const card of session.exercises.filter((e) => e.category === 'cardio')) {
              if (parseReps(card.reps) !== null) {
                progressable.push(`${where}: ${card.name} reps "${card.reps}"`);
              }
            }
          }
        }
      }
    }
  }
}

console.log(`\n[1-6] The sweep: ${swept.toLocaleString()} sessions built`);
check('nothing thrown', thrown.length === 0, thrown.slice(0, 3).join('\n      '));
check(
  'every card is one of the nine or a Restore drill',
  offList.length === 0,
  `${offList.length} off-list cards, e.g. ${offList.slice(0, 3).join(' / ')}`
);
check(
  'no card carries a tag the sore areas rule out',
  bannedThrough.length === 0,
  `${bannedThrough.length} cards, e.g. ${bannedThrough.slice(0, 3).join(' / ')}`
);
check(
  'no beginner is given anything that lands, which is what decision 7 says about Skipping',
  beginnerImpact.length === 0,
  `${beginnerImpact.length} cards, e.g. ${beginnerImpact.slice(0, 3).join(' / ')}`
);
check(
  'no exercise appears twice in a session, so no two blocks share an id',
  repeated.length === 0,
  `${repeated.length} sessions, e.g. ${repeated.slice(0, 2).join(' / ')}`
);
check(
  'every interval stays inside its bounds',
  badInterval.length === 0,
  `${badInterval.length} blocks, e.g. ${badInterval.slice(0, 3).join(' / ')}`
);
check(
  'no block dose can be read as reps, so nothing here starts climbing',
  progressable.length === 0,
  `${progressable.length} blocks, e.g. ${progressable.slice(0, 3).join(' / ')}`
);
check(
  'every session is a warm-up, then its blocks, then a cool-down',
  badShape.length === 0,
  `${badShape.length} sessions, e.g. ${badShape.slice(0, 3).join(' / ')}`
);
check(
  'the empty state is rare and never silent',
  emptyStates > 0 && emptyStates < swept / 10,
  `${emptyStates} of ${swept} swept situations had nothing to give`
);

// ── [7] The per-kit achievable floor ─────────────────────────────────────────
//
// What each kit answer really yields, written out rather than derived, because
// a floor computed the same way the builder computes it would pass whatever the
// builder did. Home is three records, and a beginner may not be given the one
// that lands, so a beginner at home tops out at two blocks however long they
// have got. Read the rows as [30 min, 45 min, 60 min].
console.log('\n[7] The per-kit achievable floor, with nothing sore');
const FLOOR = [
  { equipment: [], beginner: [2, 2, 2], other: [2, 3, 3], names: 3 },
  { equipment: ['bodyweight'], beginner: [2, 2, 2], other: [2, 3, 3], names: 3 },
  { equipment: ['bodyweight', 'bands'], beginner: [2, 2, 2], other: [2, 3, 3], names: 3 },
  { equipment: ['bodyweight', 'bench'], beginner: [2, 2, 2], other: [2, 3, 3], names: 3 },
  {
    equipment: ['bodyweight', 'bands', 'dumbbells', 'kettlebells'],
    beginner: [2, 2, 2],
    other: [2, 3, 3],
    names: 3,
  },
  { equipment: ['fullgym'], beginner: [2, 3, 4], other: [2, 3, 4], names: 9 },
  { equipment: ['fullgym', 'bench'], beginner: [2, 3, 4], other: [2, 3, 4], names: 9 },
];

for (const row of FLOOR) {
  const label = row.equipment.join('+') || 'nothing ticked';
  const wrong = [];
  for (const levelName of EXPERIENCE_LEVELS) {
    const wanted = levelName === 'beginner' ? row.beginner : row.other;
    for (let t = 0; t < TIMES.length; t++) {
      for (const energy of ENERGIES) {
        for (const sessionCount of COUNTS) {
          const session = generateLibraryConditioningSession({
            equipment: row.equipment,
            readiness: { hasAches: false, energy, timeAvailable: TIMES[t] },
            profile: { experienceLevel: levelName },
            sessionCount,
          });
          const asked = BLOCKS_BY_TIME[TIMES[t]];
          if (session.emptyState) {
            wrong.push(`${levelName}/${TIMES[t]}: empty state`);
          } else if (session.blocks.length !== wanted[t]) {
            wrong.push(`${levelName}/${TIMES[t]}: ${session.blocks.length} blocks, wanted ${wanted[t]}`);
          } else if (session.blocks.some((b) => !nineByKey.has(key(b.name)))) {
            wrong.push(`${levelName}/${TIMES[t]}: a block is not one of the nine`);
          } else if (wanted[t] < asked && session.notes.length === 0) {
            wrong.push(`${levelName}/${TIMES[t]}: short by ${asked - wanted[t]} and says nothing`);
          } else if (wanted[t] === asked && session.notes.length > 0) {
            wrong.push(`${levelName}/${TIMES[t]}: full session but apologises anyway`);
          }
        }
      }
    }
  }
  check(
    `${label}: every level, length, energy and history yields its floor of blocks`,
    wrong.length === 0,
    wrong.slice(0, 3).join(' / ')
  );
}

check(
  'a short session always says what would open more up',
  (() => {
    const session = generateLibraryConditioningSession({
      equipment: ['bodyweight'],
      readiness: { hasAches: false, energy: 'normal', timeAvailable: '60' },
      profile: { experienceLevel: 'intermediate' },
    });
    return (
      session.notes.length === 1 &&
      /would open more up\.$/.test(session.notes[0]) &&
      session.notes[0].includes('3 blocks rather than 4')
    );
  })(),
  'the home 60-minute note'
);

// ── [7b] The short session blames the right thing ────────────────────────────
//
// Three different people end up with the same two-block session at home for
// three different reasons, and the line they are shown has to say which. Two of
// them are constructed to have an IDENTICAL number of exercises and an
// identical kit sentence, so the reason clause is the only thing that can
// differ - which is why this is an attribution test and not a spelling test.
// Blaming the equipment for a sore wrist would send somebody out to buy a sled.
console.log('\n[7b] A short session names the reason it is short');
/** A home user whose knee and whose wrist between them rule out all three. */
const buildNothingFits = () =>
  generateLibraryConditioningSession({
    equipment: ['bodyweight'],
    readiness: {
      hasAches: true,
      painRegion: ['knee', 'wrist'],
      painSeverity: 'moderate',
      acute: true,
      energy: 'normal',
      timeAvailable: '45',
    },
    profile: { experienceLevel: 'intermediate' },
  });
const twoBlocks = (profile, readiness) =>
  generateLibraryConditioningSession({
    equipment: ['bodyweight'],
    readiness: { hasAches: false, energy: 'normal', timeAvailable: '60', ...readiness },
    profile,
  });
const beginnerNote = twoBlocks({ experienceLevel: 'beginner' }, {}).notes[0];
const wristNote = twoBlocks(
  { experienceLevel: 'intermediate' },
  { hasAches: true, painRegion: 'wrist', painSeverity: 'mild', acute: true }
).notes[0];
const kitNote = twoBlocks({ experienceLevel: 'intermediate' }, {}).notes[0];
check(
  'the two-block beginner and the two-block sore wrist are told different things',
  typeof beginnerNote === 'string' &&
    typeof wristNote === 'string' &&
    beginnerNote.includes('2 blocks rather than 4') &&
    wristNote.includes('2 blocks rather than 4') &&
    beginnerNote !== wristNote,
  `beginner: ${beginnerNote}\n      sore wrist: ${wristNote}`
);
check(
  'and neither of them is told the same thing as the person whose kit is the reason',
  typeof kitNote === 'string' && kitNote !== beginnerNote && kitNote !== wristNote,
  `kit only: ${kitNote}`
);
// The one-exercise session cannot be built for any reason other than a sore
// area, so there is no second case to compare it against. What is asserted
// instead is the harmful claim it must never make: telling somebody their
// equipment is the problem sends them out to buy a sled their knee is the
// reason they cannot use.
const kneeOneBlock = generateLibraryConditioningSession({
  equipment: ['bodyweight'],
  readiness: {
    hasAches: true,
    painRegion: 'knee',
    painSeverity: 'moderate',
    acute: true,
    energy: 'normal',
    timeAvailable: '45',
  },
  profile: { experienceLevel: 'intermediate' },
});
const blamesKitOrLevel = (line) => /match(es)? your equipment|suits? a beginner/.test(line ?? '');
check(
  'a shortfall a sore area caused never blames the equipment or the level instead',
  kneeOneBlock.blocks.length === 1 &&
    !blamesKitOrLevel(kneeOneBlock.notes[0]) &&
    !blamesKitOrLevel(buildNothingFits().emptyState),
  `${kneeOneBlock.notes[0]}\n      ${buildNothingFits().emptyState}`
);

// ── [8] A sore knee at home ──────────────────────────────────────────────────
console.log('\n[8] A home user with a sore knee still gets a session');
const kneeConditioning = {
  never: CLINICAL.knee.never.filter((n) => NINE.includes(n)),
  still: CLINICAL.knee.still.filter((n) => NINE.includes(n)),
};
check(
  'the clinical table has something to say about the nine and a sore knee',
  kneeConditioning.never.length >= 2 && kneeConditioning.still.length >= 3,
  `never: ${kneeConditioning.never.join(', ')} / still: ${kneeConditioning.still.join(', ')}`
);

const kneeReadiness = (timeAvailable) => ({
  hasAches: true,
  painRegion: 'knee',
  painSeverity: 'moderate',
  acute: true,
  energy: 'normal',
  timeAvailable,
});
const homeKneeProblems = [];
for (const levelName of EXPERIENCE_LEVELS) {
  for (const timeAvailable of TIMES) {
    for (const sessionCount of COUNTS) {
      const session = generateLibraryConditioningSession({
        equipment: ['bodyweight'],
        readiness: kneeReadiness(timeAvailable),
        profile: { experienceLevel: levelName },
        sessionCount,
      });
      const where = `${levelName}/${timeAvailable}/n=${sessionCount}`;
      if (session.emptyState) homeKneeProblems.push(`${where}: nothing at all`);
      else if (session.blocks.length < 1) homeKneeProblems.push(`${where}: no blocks`);
      else if (session.notes.length === 0)
        homeKneeProblems.push(`${where}: one block and no explanation`);
      for (const name of kneeConditioning.never) {
        if (session.exercises.some((e) => key(e.name) === key(name))) {
          homeKneeProblems.push(`${where}: served ${name}`);
        }
      }
    }
  }
}
check(
  'at home with a sore knee, every level and length still gets work, and says why it is short',
  homeKneeProblems.length === 0,
  homeKneeProblems.slice(0, 4).join(' / ')
);

const gymKneeMissing = [];
for (const name of kneeConditioning.still) {
  let served = false;
  for (const sessionCount of COUNTS) {
    const session = generateLibraryConditioningSession({
      equipment: ['fullgym'],
      readiness: kneeReadiness('60'),
      profile: { experienceLevel: 'intermediate' },
      sessionCount,
    });
    if (session.exercises.some((e) => key(e.name) === key(name))) served = true;
  }
  if (!served) gymKneeMissing.push(name);
}
check(
  'in a gym, a sore knee still meets the conditioning the clinical table says it keeps',
  gymKneeMissing.length === 0,
  `never offered across the rotation: ${gymKneeMissing.join(', ')}`
);

const wristProblems = [];
for (const name of CLINICAL.wrist.never.filter((n) => NINE.includes(n))) {
  for (const equipment of [['bodyweight'], ['fullgym']]) {
    for (const sessionCount of COUNTS) {
      const session = generateLibraryConditioningSession({
        equipment,
        readiness: {
          hasAches: true,
          painRegion: 'wrist',
          painSeverity: 'mild',
          acute: true,
          energy: 'normal',
          timeAvailable: '60',
        },
        profile: { experienceLevel: 'intermediate' },
        sessionCount,
      });
      if (session.exercises.some((e) => key(e.name) === key(name))) {
        wristProblems.push(`${equipment.join('+')}/n=${sessionCount}: ${name}`);
      }
    }
  }
}
check(
  'a sore wrist is never given the conditioning it is weighted through, Bear Crawl included',
  wristProblems.length === 0,
  wristProblems.slice(0, 3).join(' / ')
);

// ── [9] The honest empty state ───────────────────────────────────────────────
console.log('\n[9] When truly nothing fits, it says so');
const nothingFits = buildNothingFits();
check(
  'a home user with a sore knee AND a sore wrist is told, not handed an empty session',
  typeof nothingFits.emptyState === 'string' &&
    nothingFits.emptyState.length > 40 &&
    nothingFits.exercises.length === 0 &&
    nothingFits.blocks.length === 0,
  JSON.stringify(nothingFits.emptyState)
);
check(
  'the empty state says what would change it and where to go instead',
  /would open more up\./.test(nothingFits.emptyState) &&
    /Restore/.test(nothingFits.emptyState),
  nothingFits.emptyState ?? 'no message at all'
);
check(
  'the empty state is plain English with no em dash and no American spelling',
  !/[—–]/.test(nothingFits.emptyState) && !/\b(color|customize|favorite)\b/i.test(nothingFits.emptyState),
  nothingFits.emptyState ?? ''
);

// ── [10] Scaling by level and by energy ──────────────────────────────────────
console.log('\n[10] Work, rest and rounds scale with level and with energy');
const ladder = EXPERIENCE_LEVELS.map((l) => intervalFor({ experienceLevel: l }, 'normal'));
check(
  'EVERY rung is a longer effort than the one below it, not just the top and the bottom',
  ladder.every((v, i) => i === 0 || v.workSeconds > ladder[i - 1].workSeconds),
  ladder.map((v) => v.workSeconds).join(' -> ')
);
check(
  'EVERY rung is a shorter rest than the one below it',
  ladder.every((v, i) => i === 0 || v.restSeconds < ladder[i - 1].restSeconds),
  ladder.map((v) => v.restSeconds).join(' -> ')
);
check(
  'the rounds never go down a rung, and an athlete does more of them than a beginner',
  ladder.every((v, i) => i === 0 || v.rounds >= ladder[i - 1].rounds) &&
    ladder[ladder.length - 1].rounds > ladder[0].rounds,
  ladder.map((v) => v.rounds).join(' -> ')
);
check(
  'no two levels are handed the same interval, so no rung is decoration',
  new Set(ladder.map((v) => JSON.stringify(v))).size === EXPERIENCE_LEVELS.length,
  ladder.map((v, i) => `${EXPERIENCE_LEVELS[i]} ${v.rounds}x${v.workSeconds}s/${v.restSeconds}s`).join(' | ')
);
check(
  'a rung earned by finishing a block counts here too',
  intervalFor({ experienceLevel: 'beginner', earnedLevelBonus: 1 }, 'normal').workSeconds >
    intervalFor({ experienceLevel: 'beginner' }, 'normal').workSeconds,
  'earnedLevelBonus is read'
);
const energyWrong = [];
for (const levelName of EXPERIENCE_LEVELS) {
  const low = intervalFor({ experienceLevel: levelName }, 'low');
  const mid = intervalFor({ experienceLevel: levelName }, 'normal');
  const high = intervalFor({ experienceLevel: levelName }, 'high');
  if (!(low.workSeconds < mid.workSeconds && mid.workSeconds < high.workSeconds)) {
    energyWrong.push(`${levelName} work ${low.workSeconds}/${mid.workSeconds}/${high.workSeconds}`);
  }
  if (!(low.restSeconds > mid.restSeconds && mid.restSeconds > high.restSeconds)) {
    energyWrong.push(`${levelName} rest ${low.restSeconds}/${mid.restSeconds}/${high.restSeconds}`);
  }
  if (!(low.rounds < mid.rounds && mid.rounds < high.rounds)) {
    energyWrong.push(`${levelName} rounds ${low.rounds}/${mid.rounds}/${high.rounds}`);
  }
}
check(
  'a flat day is gentler in all three ways at once, and a good day is harder in all three',
  energyWrong.length === 0,
  energyWrong.join(' / ')
);
check(
  'the interval on the card is the interval in the block',
  (() => {
    const session = generateLibraryConditioningSession({
      equipment: ['fullgym'],
      readiness: { hasAches: false, energy: 'high', timeAvailable: '60' },
      profile: { experienceLevel: 'advanced' },
    });
    const cards = session.exercises.filter((e) => e.category === 'cardio');
    return (
      cards.length === session.blocks.length &&
      cards.every(
        (c, i) => c.sets === session.blocks[i].rounds && c.reps === `${session.blocks[i].workSeconds}s`
      )
    );
  })(),
  'rounds and work time must agree between the card and the structured block'
);

// ── [11] Deterministic, and it does move ─────────────────────────────────────
console.log('\n[11] The same answers build the same session, and history moves it along');
const twiceInput = {
  equipment: ['fullgym'],
  readiness: { hasAches: false, energy: 'normal', timeAvailable: '60' },
  profile: { experienceLevel: 'intermediate' },
  sessionCount: 5,
};
check(
  'built twice, identical',
  JSON.stringify(generateLibraryConditioningSession(twiceInput)) ===
    JSON.stringify(generateLibraryConditioningSession(twiceInput)),
  'the builder reads no clock'
);
const firstNames = COUNTS.map((sessionCount) =>
  generateLibraryConditioningSession({ ...twiceInput, sessionCount })
    .blocks.map((b) => b.name)
    .join('>')
);
check(
  'a different number of sessions behind you gives different blocks',
  new Set(firstNames).size >= 4,
  firstNames.join(' | ')
);

// ── [12] The easier week ─────────────────────────────────────────────────────
console.log('\n[12] An easier week eases the sled and leaves the rounds alone');
const normalWeek = generateLibraryConditioningSession({
  equipment: ['fullgym'],
  readiness: { hasAches: false, energy: 'normal', timeAvailable: '60' },
  profile: { experienceLevel: 'intermediate' },
});
const easyWeek = generateLibraryConditioningSession({
  equipment: ['fullgym'],
  readiness: { hasAches: false, energy: 'normal', timeAvailable: '60', deload: true },
  profile: { experienceLevel: 'intermediate' },
});
const numbersIn = (text) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const eased = normalWeek.exercises.filter((card, i) => {
  const before = numbersIn(card.suggestedLoad);
  const after = numbersIn(easyWeek.exercises[i]?.suggestedLoad ?? '');
  return before.length > 0 && after.length === before.length && after.some((v, j) => v < before[j]);
});
check(
  'the loaded sled comes down in an easier week',
  eased.length > 0,
  normalWeek.exercises.map((e, i) => `${e.suggestedLoad} -> ${easyWeek.exercises[i]?.suggestedLoad}`).join(' | ')
);
check(
  'the rounds do not, because cutting one would be a rule nobody asked for',
  normalWeek.exercises.every((card, i) => easyWeek.exercises[i]?.sets === card.sets) &&
    JSON.stringify(normalWeek.blocks) === JSON.stringify(easyWeek.blocks),
  'rounds and blocks must be untouched by the easier week'
);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failed > 0) {
  console.log(`library-conditioning: ${passed} passed, ${failed} FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`library-conditioning: all ${passed} checks passed\n`);
  process.exitCode = 0;
}
