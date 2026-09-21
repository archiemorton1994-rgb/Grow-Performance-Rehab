/**
 * Contract test: nothing the app can serve comes from outside Archie's lists.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The rebuild moved every Train session onto three lists: Archie's exercise
 * library, his nine conditioning records, and whatever the Restore tab
 * prescribes. While the old catalogue was still in the file, "is this session
 * built from Archie's list" could only be asked of one generator at a time, and
 * the answer was allowed to be "not yet" for anything not switched over.
 *
 * The old catalogue is deleted, so the question becomes a rule rather than a
 * progress report, and this is the file that enforces it. It is deliberately
 * asked in three places, because a leak can happen at any of them:
 *
 *   [1] THE INDEX. `getAllPickableExercises` is what the swap sheet, the injury
 *       screen's forced substitutions, the muscle maps and the video status
 *       document all read. One collection left in its walk puts hundreds of
 *       deleted movements back into the app through the side door.
 *   [2] THE SESSIONS THEMSELVES, through the real `generateWorkout` - every
 *       Train type, every kit, every level, every length, every energy, sore
 *       and not sore, at a spread of session counts. Both the cards and the
 *       alternatives offered behind them, because a card is one tap from
 *       becoming whatever its swap slot holds.
 *   [3] THE COUNT ON THE PAYWALL. "N+ exercises" is built from the same name
 *       map the history screens read. A name the app counts and cannot serve is
 *       a claim it cannot keep.
 *
 * NOTHING HERE READS SOURCE. The allowed set is built by asking the three lists
 * themselves, so a record renamed in any of them moves this check with it
 * rather than leaving it pinned to a spelling that no longer exists.
 *
 * Run:  npx tsx tests/library-only.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';
import { CONDITIONING_EXERCISES, LIBRARY_EXERCISES } from '../lib/exercise-library.ts';
import {
  distinctExerciseCount,
  getAllPickableExercises,
  getExerciseNameMap,
  getRestoreExercises,
  getCooldown,
} from '../lib/exercise-db.ts';
import { generateWorkout, LIBRARY_BUILT_TYPES } from '../lib/workout-engine.ts';

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
const key = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ─── [0] The three lists everything is allowed to come from ──────────────────
console.log('\n[0] The three lists, asked of the lists themselves');

/** name key -> which list it belongs to. */
const SOURCE = new Map();
const own = (list, label) => {
  for (const e of list) if (!SOURCE.has(key(e.name))) SOURCE.set(key(e.name), label);
};
own(LIBRARY_EXERCISES, 'library');
own(CONDITIONING_EXERCISES, 'conditioning');
own(getRestoreExercises(), 'restore');
own(getCooldown(), 'restore');

check(
  `the library, the nine and Restore between them name ${SOURCE.size} movements`,
  LIBRARY_EXERCISES.length > 100 && CONDITIONING_EXERCISES.length === 9 && SOURCE.size > 200,
  `${LIBRARY_EXERCISES.length} library, ${CONDITIONING_EXERCISES.length} conditioning, ${SOURCE.size} in total`
);

// ─── [1] The index the whole app picks from ──────────────────────────────────
console.log('\n[1] The index every picker reads holds nothing else');

const pickable = getAllPickableExercises();
const strangersInIndex = pickable
  .map((p) => p.template.name)
  .filter((name) => !SOURCE.has(key(name)));
check(
  `every one of the ${pickable.length} pickable exercises has a record`,
  strangersInIndex.length === 0,
  `${strangersInIndex.length} do not, e.g. ${strangersInIndex.slice(0, 8).join(' | ')}`
);
/**
 * THE LIBRARY-TIED FLOOR, and the reason it is not simply a number.
 *
 * A floor of "more than N" passes for ever once N is chosen low enough, and the
 * whole risk here is a walk that quietly stops reaching a list. So the floor is
 * the library itself: every written record has to be reachable, by name.
 */
const missingFromIndex = [...SOURCE.keys()].filter(
  (k) => !pickable.some((p) => key(p.template.name) === k)
);
check(
  'and every record on the three lists is reachable through it',
  missingFromIndex.length === 0,
  `${missingFromIndex.length} records are not in the index, e.g. ${missingFromIndex
    .slice(0, 8)
    .join(' | ')}`
);

// ─── [2] The sessions themselves, through the real door ──────────────────────
console.log('\n[2] Every Train session the app can build, card by card');

/**
 * Every Train session type there is, INCLUDING the three lift-named ids.
 *
 * Years of history, everything the server has synced and every frozen programme
 * cycle are tagged 'squat', 'bench' or 'deadlift', and they arrive at the same
 * door as everything else. A session built for one of them has to be as clean
 * as a session built for the type it now means.
 */
const TYPES = [...LIBRARY_BUILT_TYPES, 'squat', 'bench', 'deadlift'];
const KITS = [
  [],
  ['bodyweight', 'bench'],
  ['bodyweight', 'bands', 'dumbbells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells'],
  ['fullgym', 'bench'],
];
const DURATIONS = ['30', '45', '60'];
const ENERGIES = ['low', 'normal', 'high'];
const SITUATIONS = [
  { label: 'nothing sore', readiness: {}, profile: {} },
  {
    label: 'knee today, moderate',
    readiness: { hasAches: true, painRegion: 'knee', painSeverity: 'moderate', acute: true },
    profile: {},
  },
  {
    label: 'shoulder today, severe',
    readiness: {
      hasAches: true,
      painRegion: 'front_shoulder',
      painSeverity: 'severe',
      acute: true,
    },
    profile: {},
  },
  {
    label: 'lower back named by a clinician',
    readiness: {},
    profile: { clinicalAvoid: ['lower_back'] },
  },
  {
    label: 'ankle carried since sign-up',
    readiness: {},
    profile: { standingSoreRegions: ['ankle_achilles'] },
  },
];
const SEEDS = [0, 2, 5];

const offListCards = [];
const offListSwaps = [];
const thrown = [];
let sessions = 0;
let cards = 0;
let slots = 0;

for (const sessionType of TYPES) {
  for (const equipment of KITS) {
    const tier = equipment.includes('fullgym')
      ? 'fullgym'
      : equipment.includes('dumbbells') || equipment.includes('kettlebells')
        ? 'dumbbells'
        : 'bodyweight';
    for (const level of EXPERIENCE_LEVELS) {
      for (const timeAvailable of DURATIONS) {
        for (const energy of ENERGIES) {
          for (const situation of SITUATIONS) {
            for (const seed of SEEDS) {
              const profile = {
                name: 'Sweep',
                experienceLevel: level,
                goals: ['muscle', 'fitness'],
                bodyweightKg: 78,
                ageYears: 34,
                equipmentTiers: equipment.length > 0 ? equipment : ['bodyweight'],
                ...situation.profile,
              };
              const readiness = {
                hasAches: false,
                energy,
                timeAvailable,
                ...situation.readiness,
              };
              const where = `${sessionType} / ${equipment.join('+') || 'nothing'} / ${level} / ${timeAvailable}min / ${energy} / ${situation.label} / n=${seed}`;
              let built;
              try {
                built = generateWorkout(
                  sessionType,
                  tier,
                  readiness,
                  profile,
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
                  { equipment: equipment.length > 0 ? equipment : ['bodyweight'], sessionTypeCount: seed }
                );
              } catch (error) {
                thrown.push(`${where}: ${error && error.message}`);
                continue;
              }
              sessions++;
              for (const card of built) {
                cards++;
                if (!SOURCE.has(key(card.name))) offListCards.push(`${where}: ${card.name}`);
                for (const alt of [card.swapName, card.swap2Name]) {
                  if (!alt) continue;
                  slots++;
                  if (!SOURCE.has(key(alt))) {
                    offListSwaps.push(`${where}: ${card.name} offers ${alt}`);
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

check('nothing thrown', thrown.length === 0, thrown.slice(0, 3).join('\n      '));
check(
  `the sweep actually ran (${sessions.toLocaleString()} sessions, ${cards.toLocaleString()} cards, ${slots.toLocaleString()} swap slots)`,
  sessions === TYPES.length * KITS.length * EXPERIENCE_LEVELS.length * DURATIONS.length * ENERGIES.length * SITUATIONS.length * SEEDS.length && cards > sessions * 4 && slots > sessions,
  'a sweep that generates nothing proves nothing'
);
check(
  'every card in every Train session has a record',
  offListCards.length === 0,
  `${offListCards.length} cards, e.g. ${[...new Set(offListCards)].slice(0, 6).join(' / ')}`
);
check(
  'and so does everything they offer behind the swap button',
  offListSwaps.length === 0,
  `${offListSwaps.length} slots, e.g. ${[...new Set(offListSwaps)].slice(0, 6).join(' / ')}`
);

// ─── [3] The number on the paywall ───────────────────────────────────────────
console.log('\n[3] The exercises stat counts what the app can actually serve');

const counted = new Set(Object.values(getExerciseNameMap()).map((n) => key(n)));
const countedButUnservable = [...counted].filter((k) => !SOURCE.has(k));
check(
  `every one of the ${counted.size} counted movements is on a list`,
  countedButUnservable.length === 0,
  `${countedButUnservable.length} are counted and cannot be served, e.g. ${countedButUnservable
    .slice(0, 8)
    .join(' | ')}`
);
/**
 * Counted the way the paywall counts, which is by lowercased name.
 *
 * `SOURCE` above is keyed harder than that - punctuation and spaces stripped -
 * so that "Band Pull-Apart" and "Band Pull Aparts" are one movement when the
 * question is "may this be served". For the stat the question is different: it
 * is what the number on the screen claims, and that number is distinct
 * lowercased names. Asking it in its own units is the only way this assertion
 * can catch the stat drifting rather than catch the two keys disagreeing.
 */
const spellings = new Set();
for (const list of [LIBRARY_EXERCISES, CONDITIONING_EXERCISES, getRestoreExercises(), getCooldown()]) {
  for (const e of list) spellings.add(e.name.toLowerCase().trim());
}
check(
  `distinctExerciseCount (${distinctExerciseCount()}) is the size of the three lists (${spellings.size})`,
  distinctExerciseCount() === spellings.size,
  'the paywall counts one universe and the app serves another'
);

console.log(`\nlibrary-only: ${failed === 0 ? `all ${passed} checks passed` : `${passed} passed, ${failed} FAILED`}\n`);
process.exitCode = failed === 0 ? 0 : 1;
