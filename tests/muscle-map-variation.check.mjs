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
 * training legs all month left the legs grey. So section 1 still holds the
 * rotated ids while any session type is still built by the old engine, and
 * section 2 now asks the question that matters for both engines: can the map
 * credit every exercise a session actually serves?
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

// ─── 1. The engine produces ids nothing has catalogued ───────────────────────
console.log('\n[1] A rotated main lift trains under an id no region map knows');

const readiness = { energy: 'normal', timeAvailable: '60', hadAches: false, painRegions: [] };
const rotated = [];
/** Every exercise of real work any session serves, whichever builder made it. */
const served = [];
for (const sessionType of ['upper_body', 'lower_body', 'full_body']) {
  for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
    for (let done = 0; done < 12; done++) {
      const exercises = generateWorkout(
        sessionType,
        tier,
        readiness,
        undefined,
        undefined,
        undefined,
        done,
        undefined,
        undefined,
        undefined,
        0
      );
      const main = exercises.find((e) => e.category === 'main');
      if (main?.id.endsWith('-variation')) rotated.push({ sessionType, tier, main });
      for (const ex of exercises) {
        if (ex.category === 'main' || ex.category === 'accessory') {
          served.push({ sessionType, tier, main: ex });
        }
      }
    }
  }
}

check(
  `the sweep really built sessions (${served.length} exercises of work over 108)`,
  served.length > 300 && new Set(served.map((r) => r.sessionType)).size === 3,
  'nothing was generated, so the rest of this test proves nothing'
);

check(
  `the old engine still rotates its main lift into a derived id (${rotated.length} found)`,
  rotated.length > 0,
  'no -variation id anywhere: if every session type is built from the library now, this half has retired and section 2 is the whole test'
);

check(
  'the whole muscle-set is reachable from the diagram source',
  MUSCLE_SET.size > 0,
  'MUSCLE_SET could not be parsed out of components/BodyDiagram.tsx'
);

const byId = getExerciseTargetRegionsMap();
const missedById = rotated.filter((r) => !(byId[r.main.id]?.length > 0));
check(
  'none of them is in the by-id region map',
  missedById.length === rotated.length,
  'if these are catalogued after all, the id-only lookup was never broken'
);

// ─── 2. The name fallback resolves every one of them ─────────────────────────
console.log('\n[2] The name the user saw is enough to light the map');

const byName = getRegionsByExerciseNameMap();
const unresolved = rotated
  .filter((r) => !(byName[r.main.name]?.length > 0))
  .map((r) => `${r.sessionType}/${r.tier}: ${r.main.name}`);
check(
  'every rotated main lift resolves by name',
  unresolved.length === 0,
  [...new Set(unresolved)].join(', ')
);

const unshaded = rotated
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
 * Asked of every exercise of work in every session, by the two lookups in the
 * order the Stats tab uses them, so it holds whichever builder made the
 * session. This is what caught the library going live with 29 of its 36 lower
 * body exercises unknown to both maps.
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
