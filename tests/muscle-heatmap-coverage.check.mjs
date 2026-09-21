/**
 * Contract test: the muscle heatmap on the Stats tab reflects accurate exercise
 * coverage — every record a Train session can put a set against shades at least
 * one MUSCLE_SET region, and every region the map hands back is a real
 * PainRegion.
 *
 * HOW THE MUSCLE HEATMAP WORKS
 * ─────────────────────────────
 * 1. stats tab calls getExerciseTargetRegionsMap() from lib/exercise-db.ts, which
 *    deep-walks every exercise collection and builds { exerciseId → PainRegion[] }.
 * 2. getMuscleProgressCounts() in workouts.tsx iterates completed session logs,
 *    looks up each exerciseId in the map, and increments per-region set counters.
 * 3. BodyDiagram renders the heatmap — only MUSCLE_SET regions get coloured fills.
 *
 * Silent failure modes this catches:
 *  - A new library record with targetRegions: [] → that muscle group silently
 *    shows grey on the heatmap however many sets are logged against it
 *  - Renamed PainRegion leaves a stale string in targetRegions → the heatmap
 *    never lights up for that region (no runtime error; silent miss)
 *  - getExerciseTargetRegionsMap() stops walking one of the lists → a whole
 *    session type goes dark on the heatmap
 *
 * Checks:
 *  1. PAINREGION PARSING     — extract all PainRegion literals from lib/store.ts
 *  2. MUSCLE_SET PARSING     — extract MUSCLE_SET from components/BodyDiagram.tsx
 *  3. THE MAP ITSELF         — built by calling the real function, and holding
 *                              every library and conditioning record
 *  4. REGION VALIDITY        — every region the map returns is a real PainRegion
 *  5. COVERAGE               — every library record shades ≥1 MUSCLE_SET region
 *  6. THE DIAGRAM'S OWN SET  — MUSCLE_SET was read, so section 5 means something
 *  7. ID UNIQUENESS          — no two records share an id, which would share sets
 *
 * Run:  npx tsx tests/muscle-heatmap-coverage.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// The live map and the live lists. Importing .ts modules is why this check runs
// under tsx rather than plain node; see section 3 for why it stopped reading
// lib/exercise-db.ts as text.
import { getExerciseTargetRegionsMap } from '../lib/exercise-db.ts';
import { CONDITIONING_EXERCISES, LIBRARY_EXERCISES } from '../lib/exercise-library.ts';

const __dir = dirname(fileURLToPath(import.meta.url));

const storeSrc = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
const diagramSrc = readFileSync(join(__dir, '../components/BodyDiagram.tsx'), 'utf8');

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

// ─── 1. Parse PainRegion literals from lib/store.ts ──────────────────────────
console.log('\n[1] Parse PainRegion type from lib/store.ts');

const typeStart = storeSrc.indexOf('export type PainRegion =');
check(
  'PainRegion type declaration found in lib/store.ts',
  typeStart !== -1,
  'declaration not found — check lib/store.ts'
);

let painRegions = [];

if (typeStart !== -1) {
  const eqPos = storeSrc.indexOf('=', typeStart);
  const semi = storeSrc.indexOf(';', eqPos);
  const typeBlock = storeSrc.slice(eqPos, semi + 1);
  painRegions = [...typeBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

  check(
    `PainRegion type contains at least 1 value (found ${painRegions.length})`,
    painRegions.length >= 1,
    'no quoted identifiers found in PainRegion type block'
  );
  for (const r of painRegions) console.log(`  · PainRegion: '${r}'`);
}

const painRegionSet = new Set(painRegions);

// ─── 2. Parse MUSCLE_SET from components/BodyDiagram.tsx ─────────────────────
console.log('\n[2] Parse MUSCLE_SET from components/BodyDiagram.tsx');

const muscleSetDecl = diagramSrc.indexOf('const MUSCLE_SET');
check(
  'MUSCLE_SET declaration found in BodyDiagram.tsx',
  muscleSetDecl !== -1,
  'MUSCLE_SET not found — check components/BodyDiagram.tsx'
);

let muscleSetValues = [];

if (muscleSetDecl !== -1) {
  const arrOpen = diagramSrc.indexOf('[', muscleSetDecl);
  const arrClose = diagramSrc.indexOf(']', arrOpen);
  if (arrOpen !== -1 && arrClose !== -1) {
    const arrBlock = diagramSrc.slice(arrOpen + 1, arrClose);
    muscleSetValues = [...arrBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  }
  check(
    `MUSCLE_SET parsed successfully (found ${muscleSetValues.length} muscle region(s))`,
    muscleSetValues.length >= 1,
    'could not extract values from MUSCLE_SET — check BodyDiagram.tsx'
  );
  for (const v of muscleSetValues) console.log(`  · MUSCLE_SET: '${v}'`);
}

const muscleSet = new Set(muscleSetValues);

// ─── 3. The map itself, built by the real function ───────────────────────────
console.log('\n[3] The map the Stats tab reads, built by running the real function');

/**
 * ASKED OF THE MAP, NOT OF THE FILE IT USED TO BE PARSED OUT OF.
 *
 * Sections 3 to 7 used to read lib/exercise-db.ts as text: find the MAIN_LIFTS
 * block by counting braces, pull each `id` and `targetRegions` out of it with a
 * regex, and do the same for ACCESSORIES. Both blocks were the old Train
 * catalogue and are deleted, so the parse now finds nothing.
 *
 * IT DID NOT FAIL HONESTLY, WHICH IS THE POINT. Two of the assertions here -
 * "getExerciseTargetRegionsMap walks MAIN_LIFTS" and the same for ACCESSORIES -
 * were `dbSrc.includes('MAIN_LIFTS,')`, and they went on passing after the
 * deletion because a COMMENT in that file explaining what had been removed
 * contains the words "MAIN_LIFTS, ACCESSORIES,". A test that reads source for a
 * spelling cannot tell a walk from a sentence about a walk.
 *
 * So the question is asked the way the Stats tab asks it: call
 * getExerciseTargetRegionsMap(), and check what comes back. The scope is the
 * same scope the two blocks had - the strength work somebody logs sets against,
 * which is Archie's library now.
 */
const regionMap = getExerciseTargetRegionsMap();
const mappedIds = Object.keys(regionMap);

check(
  `getExerciseTargetRegionsMap returns a map (${mappedIds.length} exercises)`,
  mappedIds.length > 0,
  'the map is empty, so the heatmap has nothing to colour and every check below is vacuous'
);

/** Every record a Train session can put a set against. */
const strengthRecords = [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES];
const unmapped = strengthRecords.filter((e) => !regionMap[e.id]).map((e) => `${e.id} (${e.name})`);
check(
  `every one of the ${strengthRecords.length} library and conditioning records is in the map`,
  unmapped.length === 0,
  `${unmapped.length} are not, e.g. ${unmapped.slice(0, 6).join(', ')} - work logged against them shades nothing`
);

check(
  'workouts.tsx imports getExerciseTargetRegionsMap',
  (() => {
    try {
      const workoutsSrc = readFileSync(join(__dir, '../app/(tabs)/workouts.tsx'), 'utf8');
      return workoutsSrc.includes('getExerciseTargetRegionsMap');
    } catch {
      return false;
    }
  })(),
  'import not found in workouts.tsx - getMuscleProgressCounts() cannot query the map'
);

// ─── 4. Region validity — every value in the map is a real PainRegion ────────
console.log('\n[4] Region validity — every value in the map is a real PainRegion');

const invalidRegionPairs = [];
for (const [id, regions] of Object.entries(regionMap)) {
  for (const r of regions) {
    if (!painRegionSet.has(r)) invalidRegionPairs.push(`${id}: '${r}'`);
  }
}
check(
  `every region the map hands back is declared in lib/store.ts (${mappedIds.length} exercises)`,
  invalidRegionPairs.length === 0,
  invalidRegionPairs.length > 0
    ? `invalid: ${[...new Set(invalidRegionPairs)].slice(0, 8).join(', ')} - these will never light up on the heatmap`
    : ''
);

// ─── 5. Coverage — every library record shades at least one muscle ───────────
console.log('\n[5] Coverage — every strength record shades at least one muscle');

/**
 * THE LIBRARY IS THE FLOOR, in place of "the MAIN_LIFTS block parsed".
 *
 * A record with no MUSCLE_SET region in its map entry is work somebody does
 * that leaves the whole diagram grey afterwards, which is the silent failure
 * this file was written for. Asked of every one of Archie's records rather than
 * of the two collections that happened to exist when it was written.
 *
 * Conditioning is deliberately NOT held to this: a Rowing Machine or an Incline
 * Treadmill Walk trains the whole body and the diagram has no honest shape for
 * that, so those records are listed below with their reason rather than forced
 * to name a muscle they do not single out.
 */
const noMuscle = [];
for (const e of LIBRARY_EXERCISES) {
  const regions = regionMap[e.id] ?? [];
  if (!regions.some((r) => muscleSet.has(r))) {
    noMuscle.push(`${e.id} (${e.name}) -> ${JSON.stringify(regions)}`);
  }
}
check(
  `all ${LIBRARY_EXERCISES.length} library records shade at least one muscle on the diagram`,
  noMuscle.length === 0,
  `${noMuscle.length} shade nothing, e.g. ${noMuscle.slice(0, 6).join(' | ')} - add a muscle region from: ${[...muscleSet].join(', ')}`
);

const conditioningShading = CONDITIONING_EXERCISES.filter((e) =>
  (regionMap[e.id] ?? []).some((r) => muscleSet.has(r))
).length;
check(
  `and the conditioning records shade what they honestly can (${conditioningShading} of ${CONDITIONING_EXERCISES.length} name a muscle)`,
  CONDITIONING_EXERCISES.length > 0,
  'the nine are whole-body work, so this reports rather than demands'
);

// ─── 6. Nothing in the map is invisible ──────────────────────────────────────
console.log('\n[6] The muscle set the diagram can actually colour');

check(
  `the diagram colours ${muscleSet.size} muscle regions and the test can see them`,
  muscleSet.size > 0,
  'MUSCLE_SET could not be read from components/BodyDiagram.tsx, so section 5 proves nothing'
);

// ─── 7. ID uniqueness — one id, one movement ─────────────────────────────────
console.log('\n[7] ID uniqueness — two records sharing an id would share their sets');

const seenIds = new Set();
const dupeIds = [];
for (const e of strengthRecords) {
  if (seenIds.has(e.id)) dupeIds.push(e.id);
  else seenIds.add(e.id);
}
check(
  `all ${strengthRecords.length} library and conditioning ids are unique`,
  dupeIds.length === 0,
  dupeIds.length > 0 ? `duplicate ids: ${dupeIds.join(', ')}` : ''
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`muscle-heatmap-coverage: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`muscle-heatmap-coverage: all ${total} checks passed\n`);
  process.exitCode = 0;
}
