/**
 * Contract test: every PainRegion has at least one exercise with a comfortVariant
 * whose triggerRegions array includes that region.
 *
 * The readiness screen lets a user flag a pain region before a session.  When
 * they do, shouldSwapForComfort() in workout-engine.ts swaps any exercise whose
 * comfortVariant.triggerRegions includes the flagged region.  If NO exercise in
 * the generated session has a matching comfortVariant, the user gets no relief —
 * a silent failure that defeats the whole pain-adaptation feature.
 *
 * These checks guard against that regression:
 *   1. REGION PARSING   — extract all PainRegion literals from lib/store.ts
 *   2. VARIANT PARSING  — collect every triggerRegion cited in comfortVariants
 *                         across lib/exercise-db.ts
 *   3. COVERAGE         — every PainRegion must appear in at least one
 *                         comfortVariant.triggerRegions array
 *   4. ENGINE WIRING    — workout-engine.ts references shouldSwapForComfort and
 *                         comfortVariant so the swap path is actually reachable
 *
 * Adding a new PainRegion to lib/store.ts without covering it in exercise-db.ts
 * will cause this test to fail with a clear message naming the uncovered region.
 *
 * Run:  node tests/comfort-variant-coverage.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const storeSrc  = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
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

// ─── 1. Parse PainRegion literals from lib/store.ts ───────────────────────────
console.log('\n[1] Parse PainRegion type from lib/store.ts');

const typeStart = storeSrc.indexOf('export type PainRegion =');
check(
  'PainRegion type declaration found in lib/store.ts',
  typeStart !== -1,
  'declaration not found — check lib/store.ts',
);

let painRegions = [];

if (typeStart !== -1) {
  // The type declaration ends at the first semicolon after the '=' sign.
  // Extract that slice then pull all single-quoted identifiers.
  const eqPos  = storeSrc.indexOf('=', typeStart);
  const semi   = storeSrc.indexOf(';', eqPos);
  const typeBlock = storeSrc.slice(eqPos, semi + 1);

  const regionMatches = [...typeBlock.matchAll(/'([a-z_]+)'/g)];
  painRegions = regionMatches.map(m => m[1]);

  check(
    `PainRegion type contains at least 1 value (found ${painRegions.length})`,
    painRegions.length >= 1,
    'no quoted identifiers found in PainRegion type block',
  );

  for (const r of painRegions) {
    console.log(`  · PainRegion: '${r}'`);
  }
}

// ─── 2. Collect all triggerRegions cited in comfortVariant blocks ──────────────
console.log('\n[2] Collect comfortVariant.triggerRegions from lib/exercise-db.ts');

// Strategy: find every occurrence of "triggerRegions:" inside a comfortVariant
// block and extract the quoted values from the following array.
//
// We locate each "comfortVariant:" then scan forward to find "triggerRegions:"
// within it (before the closing '}' at depth 0 of the comfortVariant object).

const coveredByRegion = new Map(); // region -> count of covering exercises

let searchPos = 0;
let cvFound   = 0;

while (true) {
  const cvIdx = dbSrc.indexOf('comfortVariant:', searchPos);
  if (cvIdx === -1) break;
  cvFound++;

  // Find the opening '{' of this comfortVariant object
  const objOpen = dbSrc.indexOf('{', cvIdx);
  if (objOpen === -1) { searchPos = cvIdx + 1; continue; }

  // Walk forward tracking brace depth to find the end of this comfortVariant object
  let depth  = 0;
  let objEnd = -1;
  for (let i = objOpen; i < dbSrc.length; i++) {
    if (dbSrc[i] === '{') depth++;
    else if (dbSrc[i] === '}') {
      depth--;
      if (depth === 0) { objEnd = i; break; }
    }
  }

  if (objEnd === -1) { searchPos = cvIdx + 1; continue; }

  const cvBlock = dbSrc.slice(objOpen, objEnd + 1);

  // Find "triggerRegions:" inside this block
  const trIdx = cvBlock.indexOf('triggerRegions:');
  if (trIdx !== -1) {
    // Find the array that follows
    const arrOpen = cvBlock.indexOf('[', trIdx);
    if (arrOpen !== -1) {
      const arrClose = cvBlock.indexOf(']', arrOpen);
      if (arrClose !== -1) {
        const arrSlice = cvBlock.slice(arrOpen, arrClose + 1);
        const regionMatches = [...arrSlice.matchAll(/'([a-z_]+)'/g)];
        for (const m of regionMatches) {
          const r = m[1];
          coveredByRegion.set(r, (coveredByRegion.get(r) ?? 0) + 1);
        }
      }
    }
  }

  searchPos = objEnd + 1;
}

check(
  `at least 1 comfortVariant block found in exercise-db.ts (found ${cvFound})`,
  cvFound >= 1,
  'no comfortVariant entries found — check lib/exercise-db.ts',
);

check(
  `at least 1 PainRegion is covered by a comfortVariant (found ${coveredByRegion.size})`,
  coveredByRegion.size >= 1,
  'no triggerRegions values extracted — comfortVariant blocks may be malformed',
);

console.log(`  · Covered regions (${coveredByRegion.size} unique):`);
for (const [r, count] of [...coveredByRegion.entries()].sort()) {
  console.log(`      '${r}' — ${count} exercise(s)`);
}

// ─── 3. Coverage check — every PainRegion must be covered ─────────────────────
console.log('\n[3] Coverage — every PainRegion has ≥ 1 comfortVariant covering it');

for (const region of painRegions) {
  const count = coveredByRegion.get(region) ?? 0;
  check(
    `'${region}' is covered by ≥ 1 comfortVariant (found ${count})`,
    count >= 1,
    `'${region}' has no exercise with comfortVariant.triggerRegions including this region — ` +
    `users who flag this pain area during readiness will receive no exercise swap`,
  );
}

// ─── 4. Engine wiring — shouldSwapForComfort uses comfortVariant ───────────────
console.log('\n[4] Engine wiring — swap path is reachable in workout-engine.ts');

check(
  'shouldSwapForComfort function exists in workout-engine.ts',
  engineSrc.includes('function shouldSwapForComfort'),
  'function not found — pain-region swap path may be broken',
);

check(
  'shouldSwapForComfort checks comfortVariant.triggerRegions',
  engineSrc.includes('comfortVariant.triggerRegions.includes(painRegion)'),
  'triggerRegions check missing — swap logic may never fire',
);

check(
  'applyComfortOrBadge (or equivalent) uses shouldSwapForComfort',
  engineSrc.includes('shouldSwapForComfort('),
  'shouldSwapForComfort is never called — swap logic is dead code',
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`comfort-variant-coverage: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`comfort-variant-coverage: all ${total} checks passed\n`);
  process.exit(0);
}
