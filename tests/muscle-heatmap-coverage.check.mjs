/**
 * Contract test: the muscle heatmap on the Stats tab reflects accurate exercise
 * coverage — every exercise in MAIN_LIFTS and ACCESSORIES has at least one
 * MUSCLE_SET region declared in its targetRegions, and every declared region
 * value is a valid PainRegion.
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
 *  - New exercise added to MAIN_LIFTS or ACCESSORIES with targetRegions: [] →
 *    that muscle group silently shows grey on the heatmap after sessions
 *  - Renamed PainRegion leaves stale string in targetRegions → heatmap never
 *    lights up for that region (no runtime error; silent miss)
 *  - getExerciseTargetRegionsMap() stops walking MAIN_LIFTS or ACCESSORIES →
 *    entire session type goes dark on the heatmap
 *
 * Checks:
 *  1. PAINREGION PARSING     — extract all PainRegion literals from lib/store.ts
 *  2. MUSCLE_SET PARSING     — extract MUSCLE_SET from components/BodyDiagram.tsx
 *  3. FUNCTION WIRING        — getExerciseTargetRegionsMap() exported and walks
 *                              both MAIN_LIFTS and ACCESSORIES collections
 *  4. REGION VALIDITY        — every targetRegions value across the whole DB is a
 *                              valid PainRegion (catches typos and stale renames)
 *  5. MAIN_LIFTS COVERAGE    — every exercise in MAIN_LIFTS has ≥1 MUSCLE_SET region
 *  6. ACCESSORIES COVERAGE   — every exercise in ACCESSORIES has ≥1 MUSCLE_SET region
 *  7. ID UNIQUENESS          — no duplicate IDs across MAIN_LIFTS + ACCESSORIES
 *
 * Run:  node tests/muscle-heatmap-coverage.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const storeSrc   = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
const diagramSrc = readFileSync(join(__dir, '../components/BodyDiagram.tsx'), 'utf8');
const dbSrc      = readFileSync(join(__dir, '../lib/exercise-db.ts'), 'utf8');

let failures = 0;
let total    = 0;

function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// ─── Helper: extract the text of a const block ───────────────────────────────
// Handles TypeScript type annotations:  const FOO: SomeType<A> = { ... }
// by finding '= {' rather than the first '{' (which could be inside the type).
function findConstBlockBoundary(src, constName) {
  const constIdx = src.indexOf(`const ${constName}`);
  if (constIdx === -1) return { constIdx: -1, open: -1, end: -1 };

  const assignIdx = src.indexOf('= {', constIdx);
  if (assignIdx === -1) return { constIdx, open: -1, end: -1 };

  const open = assignIdx + 2; // index of '{'
  let depth = 0;
  let end   = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  return { constIdx, open, end };
}

// ─── Helper: from a source block, extract all { id, targetRegions } pairs ────
// Each exercise is declared on a long single line.  We find every
//   id: 'xxx', ..., targetRegions: ['a', 'b']
// pattern, handling both empty and non-empty arrays.
function parseExercises(block) {
  const results = [];
  // Match id:'...' on a line that also has targetRegions:[...]
  // Uses global regex over lines to avoid cross-exercise matches.
  for (const line of block.split('\n')) {
    const idMatch  = line.match(/\bid:\s*'([^']+)'/);
    const regMatch = line.match(/\btargetRegions:\s*\[([^\]]*)\]/);
    if (idMatch && regMatch) {
      const id = idMatch[1];
      const regionsRaw = regMatch[1];
      const regions = [...regionsRaw.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
      results.push({ id, regions });
    }
  }
  return results;
}

// ─── 1. Parse PainRegion literals from lib/store.ts ──────────────────────────
console.log('\n[1] Parse PainRegion type from lib/store.ts');

const typeStart = storeSrc.indexOf('export type PainRegion =');
check(
  'PainRegion type declaration found in lib/store.ts',
  typeStart !== -1,
  'declaration not found — check lib/store.ts',
);

let painRegions = [];

if (typeStart !== -1) {
  const eqPos     = storeSrc.indexOf('=', typeStart);
  const semi      = storeSrc.indexOf(';', eqPos);
  const typeBlock = storeSrc.slice(eqPos, semi + 1);
  painRegions     = [...typeBlock.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);

  check(
    `PainRegion type contains at least 1 value (found ${painRegions.length})`,
    painRegions.length >= 1,
    'no quoted identifiers found in PainRegion type block',
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
  'MUSCLE_SET not found — check components/BodyDiagram.tsx',
);

let muscleSetValues = [];

if (muscleSetDecl !== -1) {
  const arrOpen  = diagramSrc.indexOf('[', muscleSetDecl);
  const arrClose = diagramSrc.indexOf(']', arrOpen);
  if (arrOpen !== -1 && arrClose !== -1) {
    const arrBlock = diagramSrc.slice(arrOpen + 1, arrClose);
    muscleSetValues = [...arrBlock.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
  }
  check(
    `MUSCLE_SET parsed successfully (found ${muscleSetValues.length} muscle region(s))`,
    muscleSetValues.length >= 1,
    'could not extract values from MUSCLE_SET — check BodyDiagram.tsx',
  );
  for (const v of muscleSetValues) console.log(`  · MUSCLE_SET: '${v}'`);
}

const muscleSet = new Set(muscleSetValues);

// ─── 3. Function wiring — getExerciseTargetRegionsMap ────────────────────────
console.log('\n[3] Function wiring — getExerciseTargetRegionsMap in exercise-db.ts');

check(
  'getExerciseTargetRegionsMap is exported from exercise-db.ts',
  dbSrc.includes('export function getExerciseTargetRegionsMap'),
  'function not found — getMuscleProgressCounts() in workouts.tsx cannot build the region map',
);

check(
  'getExerciseTargetRegionsMap walks MAIN_LIFTS',
  dbSrc.includes('MAIN_LIFTS,') || dbSrc.includes('MAIN_LIFTS\n'),
  'MAIN_LIFTS not in the walk() call — main lifts will be missing from the heatmap',
);

check(
  'getExerciseTargetRegionsMap walks ACCESSORIES',
  dbSrc.includes('ACCESSORIES,') || dbSrc.includes('ACCESSORIES\n'),
  'ACCESSORIES not in the walk() call — accessory exercises missing from the heatmap',
);

check(
  'workouts.tsx imports getExerciseTargetRegionsMap',
  (() => {
    try {
      const workoutsSrc = readFileSync(join(__dir, '../app/(tabs)/workouts.tsx'), 'utf8');
      return workoutsSrc.includes('getExerciseTargetRegionsMap');
    } catch { return false; }
  })(),
  'import not found in workouts.tsx — getMuscleProgressCounts() cannot query the map',
);

// ─── 4. Region validity — all targetRegions values are valid PainRegions ──────
console.log('\n[4] Region validity — every declared targetRegion is a valid PainRegion');

const allTargetRegionMatches = [...dbSrc.matchAll(/\btargetRegions:\s*\[([^\]]+)\]/g)];
const invalidRegionPairs = [];

for (const m of allTargetRegionMatches) {
  const values = [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]);
  for (const v of values) {
    if (!painRegionSet.has(v)) {
      invalidRegionPairs.push(v);
    }
  }
}

check(
  `all declared targetRegion values are valid PainRegions (checked ${allTargetRegionMatches.length} arrays)`,
  invalidRegionPairs.length === 0,
  invalidRegionPairs.length > 0
    ? `invalid values: ${[...new Set(invalidRegionPairs)].join(', ')} — these will never light up on the heatmap`
    : '',
);

if (invalidRegionPairs.length > 0) {
  for (const v of [...new Set(invalidRegionPairs)]) {
    console.error(`  ! Invalid region value '${v}' — not declared in PainRegion type in lib/store.ts`);
  }
}

// ─── 5. MAIN_LIFTS coverage ───────────────────────────────────────────────────
console.log('\n[5] MAIN_LIFTS coverage — every exercise has ≥1 MUSCLE_SET region');

const { open: mainOpen, end: mainEnd } = findConstBlockBoundary(dbSrc, 'MAIN_LIFTS');
check(
  'MAIN_LIFTS block found in exercise-db.ts (balanced braces)',
  mainOpen !== -1 && mainEnd !== -1,
  'could not locate or parse MAIN_LIFTS — check lib/exercise-db.ts',
);

const mainExercises = (mainOpen !== -1 && mainEnd !== -1)
  ? parseExercises(dbSrc.slice(mainOpen, mainEnd + 1))
  : [];

check(
  `MAIN_LIFTS contains exercises (found ${mainExercises.length})`,
  mainExercises.length >= 1,
  'no exercises parsed from MAIN_LIFTS — block may have changed format',
);

console.log(`\n  Checking ${mainExercises.length} exercises in MAIN_LIFTS:`);
for (const ex of mainExercises) {
  const muscleRegions = ex.regions.filter(r => muscleSet.has(r));
  check(
    `MAIN_LIFTS '${ex.id}' has ≥1 MUSCLE_SET region (${muscleRegions.length > 0 ? muscleRegions.join(', ') : 'NONE'})`,
    muscleRegions.length >= 1,
    `targetRegions ${JSON.stringify(ex.regions)} contains no MUSCLE_SET member — ` +
    `muscle heatmap will never light up for this exercise; ` +
    `add a muscle region from: ${[...muscleSet].join(', ')}`,
  );
}

// ─── 6. ACCESSORIES coverage ──────────────────────────────────────────────────
console.log('\n[6] ACCESSORIES coverage — every exercise has ≥1 MUSCLE_SET region');

const { open: accOpen, end: accEnd } = findConstBlockBoundary(dbSrc, 'ACCESSORIES');
check(
  'ACCESSORIES block found in exercise-db.ts (balanced braces)',
  accOpen !== -1 && accEnd !== -1,
  'could not locate or parse ACCESSORIES — check lib/exercise-db.ts',
);

const accExercises = (accOpen !== -1 && accEnd !== -1)
  ? parseExercises(dbSrc.slice(accOpen, accEnd + 1))
  : [];

check(
  `ACCESSORIES contains exercises (found ${accExercises.length})`,
  accExercises.length >= 1,
  'no exercises parsed from ACCESSORIES — block may have changed format',
);

console.log(`\n  Checking ${accExercises.length} exercises in ACCESSORIES:`);
for (const ex of accExercises) {
  const muscleRegions = ex.regions.filter(r => muscleSet.has(r));
  check(
    `ACCESSORIES '${ex.id}' has ≥1 MUSCLE_SET region (${muscleRegions.length > 0 ? muscleRegions.join(', ') : 'NONE'})`,
    muscleRegions.length >= 1,
    `targetRegions ${JSON.stringify(ex.regions)} contains no MUSCLE_SET member — ` +
    `muscle heatmap will not show work from this exercise; ` +
    `add a muscle region from: ${[...muscleSet].join(', ')}`,
  );
}

// ─── 7. ID uniqueness — no duplicate IDs across MAIN_LIFTS + ACCESSORIES ──────
console.log('\n[7] ID uniqueness — no duplicate IDs across MAIN_LIFTS + ACCESSORIES');

const allStrengthExercises = [...mainExercises, ...accExercises];
const seenIds = new Set();
const dupeIds = [];

for (const ex of allStrengthExercises) {
  if (seenIds.has(ex.id)) dupeIds.push(ex.id);
  else seenIds.add(ex.id);
}

check(
  `all ${allStrengthExercises.length} exercise IDs in MAIN_LIFTS + ACCESSORIES are unique (no duplicates)`,
  dupeIds.length === 0,
  dupeIds.length > 0 ? `duplicate IDs: ${dupeIds.join(', ')}` : '',
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`muscle-heatmap-coverage: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`muscle-heatmap-coverage: all ${total} checks passed\n`);
  process.exit(0);
}
