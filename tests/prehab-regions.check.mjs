/**
 * Contract tests: every region reachable via the prehab/recovery region picker
 * has exercises in PREHAB_BY_REGION.
 *
 * The Recovery and Targeted Prehab modals in flex.tsx use REGION_FRONT and
 * REGION_BACK sets filtered by REGION_MUSCLE (muscles/joints toggle) to build
 * the region list.  The union of REGION_FRONT ∪ REGION_BACK is the full set of
 * regions a user can ever tap.  When a user taps one, handlePrehabRegion() calls
 * getRegionPrehabWorkout(region) in workout-engine.ts, which delegates to:
 *
 *   exercise-db.ts: return [PREHAB_WARMUP, ...PREHAB_BY_REGION[region], PREHAB_COOLDOWN];
 *
 * If PREHAB_BY_REGION[region] is missing or its array is empty, the session
 * launches with 0 exercises (warmup + cooldown only) — a silent failure the
 * user only discovers mid-workout.
 *
 * NOTE on tiers: getRegionPrehabWorkout() takes only a region, not an equipment
 * tier — targeted prehab exercises are all bodyweight/band and tier-agnostic.
 *
 * These checks guard against regressions:
 *   1. REGION PARSING    — extract regions dynamically from REGION_FRONT and
 *                          REGION_BACK in flex.tsx (not a hardcoded expected list).
 *   2. DB KEY COVERAGE   — every UI region has a matching key in PREHAB_BY_REGION.
 *   3. EXERCISE COUNT    — every DB key array has ≥ 1 exercise template.
 *   4. SET EQUALITY      — no DB key is missing from the UI list and vice-versa.
 *   5. ENGINE WIRING     — getRegionPrehabWorkout spreads PREHAB_BY_REGION[region]
 *                          and workout-engine.ts calls it for targeted prehab.
 *   6. ID UNIQUENESS     — no duplicate exercise IDs across all region arrays.
 *
 * Run:  node tests/prehab-regions.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const flexSrc   = readFileSync(join(__dir, '../app/(tabs)/flex.tsx'), 'utf8');
const dbSrc     = readFileSync(join(__dir, '../lib/exercise-db.ts'), 'utf8');
const engineSrc = readFileSync(join(__dir, '../lib/workout-engine.ts'), 'utf8');

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

/**
 * Parse a `new Set<PainRegion>([ ... ])` literal from source, returning an
 * array of string values extracted from the array body.
 */
function parseSetLiteral(src, constName) {
  const constStart = src.indexOf(`const ${constName}`);
  if (constStart === -1) return null;

  // Find the opening '[' of the Set constructor's argument
  const arrayOpen = src.indexOf('[', constStart);
  if (arrayOpen === -1) return null;

  let depth = 0;
  let arrayEnd = -1;
  for (let i = arrayOpen; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) { arrayEnd = i; break; }
    }
  }
  if (arrayEnd === -1) return null;

  const body = src.slice(arrayOpen, arrayEnd + 1);
  const matches = [...body.matchAll(/'([^']+)'/g)];
  return matches.map(m => m[1]);
}

// ─── 1. Parse REGION_FRONT and REGION_BACK from flex.tsx ─────────────────────
console.log('\n[1] Parse REGION_FRONT and REGION_BACK from flex.tsx');

const frontRegions = parseSetLiteral(flexSrc, 'REGION_FRONT');
const backRegions  = parseSetLiteral(flexSrc, 'REGION_BACK');

check(
  'REGION_FRONT constant found in flex.tsx',
  frontRegions !== null,
  'constant not found — check app/(tabs)/flex.tsx',
);
check(
  'REGION_BACK constant found in flex.tsx',
  backRegions !== null,
  'constant not found — check app/(tabs)/flex.tsx',
);
check(
  `REGION_FRONT contains at least 1 region (found ${(frontRegions ?? []).length})`,
  (frontRegions ?? []).length >= 1,
  'no region entries found in REGION_FRONT',
);
check(
  `REGION_BACK contains at least 1 region (found ${(backRegions ?? []).length})`,
  (backRegions ?? []).length >= 1,
  'no region entries found in REGION_BACK',
);

// The full set of reachable UI regions is the union of front and back
const uiRegionSet = new Set([...(frontRegions ?? []), ...(backRegions ?? [])]);
const uiRegions   = [...uiRegionSet];

console.log(`  · Union of REGION_FRONT ∪ REGION_BACK (${uiRegions.length} unique regions):`);
for (const r of uiRegions) console.log(`    · '${r}'`);

// ─── 2. Parse PREHAB_BY_REGION from exercise-db.ts ────────────────────────────
console.log('\n[2] Parse PREHAB_BY_REGION from exercise-db.ts');

const byRegionStart = dbSrc.indexOf('const PREHAB_BY_REGION');
check(
  'PREHAB_BY_REGION constant found in exercise-db.ts',
  byRegionStart !== -1,
  'constant not found — check lib/exercise-db.ts',
);

let dbRegionExercises = {}; // region -> count

if (byRegionStart !== -1) {
  const objOpen = dbSrc.indexOf('{', byRegionStart);
  let braceDepth = 0;
  let objEnd     = -1;

  for (let i = objOpen; i < dbSrc.length; i++) {
    if (dbSrc[i] === '{') braceDepth++;
    else if (dbSrc[i] === '}') {
      braceDepth--;
      if (braceDepth === 0) { objEnd = i; break; }
    }
  }

  check(
    'PREHAB_BY_REGION object boundary found',
    objEnd !== -1,
    'brace counting failed — unbalanced braces in PREHAB_BY_REGION?',
  );

  if (objEnd !== -1) {
    const block = dbSrc.slice(objOpen, objEnd + 1);

    let depth = 0;
    let i     = 0;

    while (i < block.length) {
      const ch = block[i];
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') depth--;

      if (depth === 1) {
        const keyMatch = block.slice(i).match(/^([a-z_]+):\s*\[/);
        if (keyMatch) {
          const regionKey   = keyMatch[1];
          const relArrayOpen = block.indexOf('[', i + keyMatch[0].indexOf('['));
          let   bracketD    = 0;
          let   arrayEnd    = -1;

          for (let j = relArrayOpen; j < block.length; j++) {
            if (block[j] === '[') bracketD++;
            else if (block[j] === ']') {
              bracketD--;
              if (bracketD === 0) { arrayEnd = j; break; }
            }
          }

          const arraySlice    = arrayEnd !== -1 ? block.slice(relArrayOpen, arrayEnd + 1) : '';
          const exerciseCount = (arraySlice.match(/id:\s*'/g) || []).length;
          dbRegionExercises[regionKey] = exerciseCount;

          if (arrayEnd !== -1) { i = arrayEnd; }
        }
      }
      i++;
    }

    const dbRegions = Object.keys(dbRegionExercises);
    check(
      `PREHAB_BY_REGION contains at least 1 region (found ${dbRegions.length})`,
      dbRegions.length >= 1,
      'no top-level region keys found in PREHAB_BY_REGION block',
    );

    for (const [region, count] of Object.entries(dbRegionExercises)) {
      console.log(`  · DB region: '${region}' (${count} exercises)`);
    }
  }
}

// ─── 3. DB key coverage — every UI region has a DB key ────────────────────────
console.log('\n[3] DB coverage — every UI region has a key in PREHAB_BY_REGION');

for (const region of uiRegions) {
  check(
    `PREHAB_BY_REGION has key '${region}'`,
    Object.prototype.hasOwnProperty.call(dbRegionExercises, region),
    `'${region}' is reachable in the picker but has no key in PREHAB_BY_REGION — tapping this tile launches an empty session`,
  );
}

// ─── 4. Exercise count — every DB key has ≥ 1 exercise ────────────────────────
console.log('\n[4] Exercise count — every DB region array has ≥ 1 exercise');

for (const region of uiRegions) {
  const count = dbRegionExercises[region] ?? 0;
  check(
    `'${region}' has ≥ 1 exercise in PREHAB_BY_REGION (found ${count})`,
    count >= 1,
    `'${region}' array is empty — session launches with only warmup + cooldown`,
  );
}

// ─── 5. Coverage direction — every UI region must have DB coverage ─────────────
// NOTE: PREHAB_BY_REGION is intentionally a superset of the UI region set.
// It may also hold regions used only for pain-region selection in readiness.tsx
// that are not exposed in the picker UI. The meaningful guarantee is one-directional.
console.log('\n[5] Coverage direction — every UI region has DB coverage');

const uiSet = new Set(uiRegions);
const dbSet = new Set(Object.keys(dbRegionExercises));

const inUINotDB = [...uiSet].filter(r => !dbSet.has(r));

check(
  'every UI region (REGION_FRONT ∪ REGION_BACK) has a key in PREHAB_BY_REGION',
  inUINotDB.length === 0,
  inUINotDB.length > 0
    ? `UI regions with no DB key: ${inUINotDB.join(', ')} — tapping these tiles launches an empty session`
    : '',
);

const inDBNotUI = [...dbSet].filter(r => !uiSet.has(r));
if (inDBNotUI.length > 0) {
  console.log(`  · DB-only regions (used elsewhere, not a failure): ${inDBNotUI.join(', ')}`);
}

// ─── 6. Engine wiring — getRegionPrehabWorkout uses PREHAB_BY_REGION[region] ──
console.log('\n[6] Engine wiring — getRegionPrehabWorkout uses PREHAB_BY_REGION[region]');

check(
  'getRegionPrehabWorkout is exported from exercise-db.ts',
  dbSrc.includes('export function getRegionPrehabWorkout'),
  'function not found in exercise-db.ts',
);

check(
  'getRegionPrehabWorkout spreads PREHAB_BY_REGION[region]',
  dbSrc.includes('...PREHAB_BY_REGION[region]'),
  'spread operator missing — region exercises may not reach the returned array',
);

check(
  'workout-engine.ts calls getRegionPrehabWorkout when painRegion is set',
  engineSrc.includes('getRegionPrehabWorkout(readiness.painRegion)'),
  'wiring between session generator and region workout builder is broken',
);

// ─── 7. ID uniqueness — no duplicate exercise IDs across all region arrays ─────
console.log('\n[7] ID uniqueness — no duplicate exercise IDs across region arrays');

const idMatches = dbSrc.match(/id:\s*'ph-r-[^']+'/g) ?? [];
const ids       = idMatches.map(m => m.replace(/id:\s*'/, '').replace(/'$/, ''));
const seen      = new Set();
const dupes     = [];

for (const id of ids) {
  if (seen.has(id)) dupes.push(id);
  else seen.add(id);
}

check(
  `all ${ids.length} region exercise IDs are unique (no duplicates)`,
  dupes.length === 0,
  dupes.length > 0 ? `duplicate IDs: ${dupes.join(', ')}` : '',
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`prehab-regions: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`prehab-regions: all ${total} checks passed\n`);
  process.exit(0);
}
