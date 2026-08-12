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
    }
  }
}

check(
  `every weekly session type rotates its main lift (${rotated.length} found)`,
  new Set(rotated.map((r) => r.sessionType)).size === 3,
  'nothing rotated, so the rest of this test proves nothing'
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
  process.exit(1);
} else {
  console.log(`muscle-map-variation: all ${total} checks passed\n`);
  process.exit(0);
}
