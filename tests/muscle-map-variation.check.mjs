/**
 * Contract test: the muscle map credits a rotated main lift.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Every fourth weekly session serves its main lift as the curated alternative —
 * a flat bench becomes an incline, a back squat becomes a front squat. That
 * variation is logged under `<base id>-variation`, deliberately, so it
 * progresses on its own history instead of being prescribed at the base lift's
 * working weight (see MAIN_VARIATION_ID_SUFFIX in lib/workout-engine.ts).
 *
 * Nothing maps that id to a body region — it is derived, not catalogued. So the
 * Stats tab's Muscle Progress map, which looked exercises up by id alone, was
 * silently dropping the single biggest exercise of those sessions: train front
 * squats and the quads stayed grey. The session summary had already hit this
 * and solved it by falling back to the exercise NAME, which the catalogue does
 * know, via getRegionsByExerciseNameMap().
 *
 * Two halves, and both have to hold:
 *   DATA — the engine really does produce ids the region map has never heard
 *          of, and the name map really does resolve them to muscle regions
 *   WIRING — the Stats tab actually consults the name map, everywhere it reads
 *          regions off a log
 *
 * WIDENED when Lower Body moved to Archie's library. The library does not
 * rotate a main lift into a `-variation` id at all: every record has its own
 * id and its own history. What it does do is serve exercises no collection in
 * lib/exercise-db.ts had ever held, which is the same failure wearing different
 * clothes - measured before the fix, 29 of the 36 exercises a Lower Body
 * session can serve were unknown to the by-name map and 10 to the by-id map, so
 * training legs all month left the legs grey.
 *
 * AND THE ROTATION IS DORMANT NOW THAT FULL BODY HAS SWITCHED OVER TOO.
 * `MAIN_VARIATION_ID_SUFFIX` is only ever appended inside
 * `generateWeeklyWorkout`, and with Lower, Upper and Full Body all built from
 * Archie's list no session type reaches that generator, so nothing the app
 * builds trains under a derived id any more. Swept over every session type the
 * app has, at four levels and five tiers: 3,948 pieces of work, none of them
 * rotated. The old first assertion said as much in its own failure message -
 * "if every session type is built from the library now, this half has retired"
 * - and this is that day.
 *
 * So the derived-id promise is not deleted, it is asked without depending on a
 * generator nobody reaches. Section 1 pins the rotation as dormant, in both
 * directions, so a builder starting to rotate again is noticed rather than
 * waved through. Section 2 then asks the original question of the ids the
 * rotation WOULD make, built from the mains the app really serves: an id the
 * catalogue has never heard of still has to light a muscle through its name.
 * That is the fallback the Stats tab depends on, measured on real exercises,
 * and it cannot go quietly vacuous because the mains are always there.
 *
 * Run:  npx tsx tests/muscle-map-variation.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

globalThis.__DEV__ = false;

import { generateWorkout } from '../lib/workout-engine.ts';
import {
  getExerciseTargetRegionsMap,
  getRegionsByExerciseNameMap,
} from '../lib/exercise-db.ts';

const __dir = dirname(fileURLToPath(import.meta.url));

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

// The muscle regions the figure can actually shade. Read from the component so
// a renamed or removed region fails here rather than going quietly grey.
const diagramSrc = readFileSync(join(__dir, '../components/BodyDiagram.tsx'), 'utf8');
const muscleSetBlock = diagramSrc.match(/MUSCLE_SET = new Set<PainRegion>\(\[([\s\S]*?)\]\)/);
const MUSCLE_SET = new Set(
  (muscleSetBlock?.[1] ?? '').match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)) ?? []
);

// ─── 1. Nothing trains under a derived id any more ───────────────────────────
console.log('\n[1] The rotation that made an uncatalogued id is dormant');

const readiness = { energy: 'normal', timeAvailable: '60', hadAches: false, painRegions: [] };
const profile = {
  name: 'A',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};
/**
 * EVERY SESSION TYPE, not just the three weekly ones.
 *
 * The claim below is that NO session the app builds rotates into a derived id,
 * and a sweep of three types could not support it. The three legacy lift ids
 * are in the list as well, because they are what a day out of somebody's
 * history is still called and they are mapped, not retired.
 */
const SESSION_TYPES = [
  'lower_body',
  'upper_body',
  'full_body',
  'squat',
  'bench',
  'deadlift',
  'conditioning',
  'prehab',
  'flexibility',
];
const rotated = [];
/** Every exercise of real work any session serves, whichever builder made it. */
const served = [];
/** The lead of each session, which is what the rotation used to replace. */
const mains = [];
/** Every type that produced a session at all, so an empty one cannot hide. */
const typesBuilt = new Set();
for (const sessionType of SESSION_TYPES) {
  for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
    for (let done = 0; done < 12; done++) {
      const exercises = generateWorkout(
        sessionType,
        tier,
        readiness,
        profile,
        undefined,
        undefined,
        done,
        undefined,
        undefined,
        undefined,
        0,
        { equipment: [tier], sessionTypeCount: done }
      );
      if (exercises.length > 0) typesBuilt.add(sessionType);
      const main = exercises.find((e) => e.category === 'main');
      if (main?.id.endsWith('-variation')) rotated.push({ sessionType, tier, main });
      if (main) mains.push({ sessionType, tier, main });
      for (const ex of exercises) {
        if (ex.category === 'main' || ex.category === 'accessory') {
          served.push({ sessionType, tier, main: ex });
        }
      }
    }
  }
}

/**
 * Every type is asked for, and the lifting ones are counted separately.
 *
 * Rehab and stretching sessions contain no main or accessory work at all and a
 * conditioning session has no lead exercise, which is correct and is why the
 * two counts are made apart: a type dropping out of `typesBuilt` is a session
 * that failed to build, while the work and main counts guard the half the
 * region map is about.
 */
const LIFTING_TYPES = SESSION_TYPES.filter((t) => t !== 'prehab' && t !== 'flexibility');
check(
  `the sweep really built sessions (${typesBuilt.size} types, ${served.length} exercises of work, ${mains.length} of them leading one)`,
  typesBuilt.size === SESSION_TYPES.length &&
    served.length > 300 &&
    mains.length > 100 &&
    new Set(served.map((r) => r.sessionType)).size === LIFTING_TYPES.length,
  `built ${[...typesBuilt].join(', ')} — nothing was generated, so the rest of this test proves nothing`
);

/**
 * PINNED IN BOTH DIRECTIONS, like the rest of this phase's retirements.
 *
 * Nothing rotates today, so the honest assertion is that nothing does. If a
 * builder starts appending a derived id again this fails and says where, and
 * whoever brings the rotation back has to come and read section 2, which is
 * the promise that made it safe in the first place.
 */
check(
  `no session the app builds trains its main under a derived id (${rotated.length} found)`,
  rotated.length === 0,
  [...new Set(rotated.map((r) => `${r.sessionType}/${r.tier}: ${r.main.id}`))].slice(0, 3).join(' | ')
);

check(
  'the whole muscle-set is reachable from the diagram source',
  MUSCLE_SET.size > 0,
  'MUSCLE_SET could not be parsed out of components/BodyDiagram.tsx'
);

/**
 * The ids the rotation would make, built from the mains the app really serves.
 *
 * This is the same string `generateWeeklyWorkout` builds - the base id with
 * MAIN_VARIATION_ID_SUFFIX on the end - so section 2 can ask the original
 * question of real exercises without needing a generator nobody reaches to
 * hand it one. Any rotated id that IS produced is measured alongside them, so
 * the day the rotation comes back the real cards are covered too.
 */
const MAIN_VARIATION_ID_SUFFIX = '-variation';
const derived = [
  ...rotated,
  ...mains.map((r) => ({
    ...r,
    main: { ...r.main, id: `${r.main.id}${MAIN_VARIATION_ID_SUFFIX}` },
  })),
];

const byId = getExerciseTargetRegionsMap();
const missedById = derived.filter((r) => !(byId[r.main.id]?.length > 0));
check(
  `a derived id is in no by-id region map, which is what broke the map (${derived.length} checked)`,
  derived.length > 100 && missedById.length === derived.length,
  'if these are catalogued after all, the id-only lookup was never broken'
);

// ─── 2. The name fallback resolves every one of them ─────────────────────────
console.log('\n[2] The name the user saw is enough to light the map');

const byName = getRegionsByExerciseNameMap();
const unresolved = derived
  .filter((r) => !(byName[r.main.name]?.length > 0))
  .map((r) => `${r.sessionType}/${r.tier}: ${r.main.name}`);
check(
  'every exercise that could lead a session resolves by name',
  unresolved.length === 0,
  [...new Set(unresolved)].slice(0, 5).join(', ')
);

const unshaded = derived
  .filter((r) => !(byName[r.main.name] ?? []).some((region) => MUSCLE_SET.has(region)))
  .map((r) => r.main.name);
check(
  'and each one names at least one muscle the figure can shade',
  unshaded.length === 0,
  `${[...new Set(unshaded)].join(', ')} — joints only, so the map would still look empty`
);

/**
 * THE PROMISE ITSELF: nothing anybody trains is left off the map.
 *
 * Asked of every exercise of work in every session type the app has, by the two
 * lookups in the order the Stats tab uses them, so it holds whichever builder
 * made the session. This is what caught the library going live with 29 of its
 * 36 lower body exercises unknown to both maps.
 */
const unlit = served
  .filter((r) => {
    const regions = byId[r.main.id]?.length > 0 ? byId[r.main.id] : (byName[r.main.name] ?? []);
    return !regions.some((region) => MUSCLE_SET.has(region));
  })
  .map((r) => `${r.sessionType}/${r.tier}: ${r.main.name} (${r.main.id})`);
check(
  `every exercise a session serves lights a muscle the figure can shade (${served.length} checked)`,
  unlit.length === 0,
  `${[...new Set(unlit)].slice(0, 5).join(', ')} — trained, and shaded nothing`
);

// ─── 3. The Stats tab actually uses it ───────────────────────────────────────
console.log('\n[3] Both readers on the Stats tab go through the fallback');

const statsSrc = readFileSync(join(__dir, '../app/(tabs)/workouts.tsx'), 'utf8');

check(
  'the name map is imported',
  /getRegionsByExerciseNameMap/.test(statsSrc),
  'the tab can only fall back to a map it has'
);

const helper = statsSrc.match(/function regionsOfLog\([\s\S]*?\n\}/)?.[0] ?? '';
check(
  'the shared lookup consults the by-name map',
  /byName\[log\.exerciseName\]/.test(helper),
  'regionsOfLog is where the fallback lives; without it the id miss is final'
);
check(
  'and it prefers the id when the catalogue has one',
  /byId\[log\.exerciseId\]/.test(helper) && helper.indexOf('byId') < helper.indexOf('byName['),
  'the template is the fact and a name match is the approximation'
);

// Both readers — the heatmap itself and the tap-a-region breakdown. Fixing one
// and not the other is the failure this catches: the figure lights up and the
// callout underneath still reports nothing.
const readers = statsSrc.match(/regionsOfLog\(log, targetRegionsMap, regionsByName\)/g) ?? [];
check(
  'both the heatmap and the region breakdown call it',
  readers.length === 2,
  `${readers.length} call site(s) — expected the counts function and the insight breakdown`
);
check(
  'no reader still reads the id map directly off a log',
  !/targetRegionsMap\[log\.exerciseId\]/.test(statsSrc),
  'a direct id lookup is the bug, whichever reader keeps it'
);

console.log('');
if (failures > 0) {
  console.error(`muscle-map-variation: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`muscle-map-variation: all ${total} checks passed\n`);
  process.exitCode = 0;
}
