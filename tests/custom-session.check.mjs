/**
 * Contract tests: the custom session path in workout-engine.ts correctly bypasses
 * auto-generation, and the exercise pool (getAllPickableExercises) is non-empty and
 * properly wired from exercise-db.ts through custom-session.tsx to session.tsx via
 * the Zustand store.
 *
 * HOW CUSTOM SESSIONS WORK
 * ─────────────────────────
 * 1. custom-session.tsx calls getAllPickableExercises(tier) to populate the picker.
 * 2. The user selects exercises; handleStart() calls setPendingCustomExercises() on
 *    the Zustand store, then navigates to /session with sessionType: 'custom'.
 * 3. session.tsx reads pendingCustomExercises from the store and uses them directly.
 * 4. workout-engine.ts returns [] for sessionType === 'custom' — this is intentional;
 *    it is NOT a bug. The exercises are provided by the store, not auto-generated.
 *
 * Silent failure modes this catches:
 *  - getAllPickableExercises removed / not exported — picker shows 0 exercises
 *  - MAIN_LIFTS, ACCESSORIES, or PREHAB_BY_REGION removed from the pool function —
 *    picker silently loses entire exercise categories
 *  - MAIN_LIFTS or ACCESSORIES missing an internal tier — every exercise for that
 *    tier disappears from the custom picker
 *  - workout-engine.ts custom bypass accidentally removed — generates a random
 *    session instead of using the user's picks
 *  - setPendingCustomExercises removed from store — custom-session.tsx crashes
 *  - session.tsx no longer reads pendingCustomExercises — custom exercises never load
 *  - Duplicate exercise IDs in MAIN_LIFTS / ACCESSORIES — set-logging and swap bugs
 *
 * Checks:
 *  1. POOL EXPORT      — getAllPickableExercises exported from exercise-db.ts
 *  2. POOL SOURCES     — function body references MAIN_LIFTS, ACCESSORIES, PREHAB_BY_REGION
 *  3. MAIN_LIFTS TIERS — all 3 internal tiers present in MAIN_LIFTS for each session type
 *  4. ACCESSORIES TIERS— all 3 internal tiers present in ACCESSORIES for each session type
 *  5. ENGINE BYPASS    — workout-engine.ts returns [] for 'custom' sessionType
 *  6. STORE CONTRACT   — store declares pendingCustomExercises + setPendingCustomExercises
 *  7. PICKER WIRING    — custom-session.tsx imports getAllPickableExercises and calls
 *                        setPendingCustomExercises before navigating to /session
 *  8. SESSION WIRING   — session.tsx reads pendingCustomExercises from the store
 *  9. ID UNIQUENESS    — no duplicate IDs across MAIN_LIFTS and ACCESSORIES
 *
 * Run:  node tests/custom-session.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const dbSrc          = readFileSync(join(__dir, '../lib/exercise-db.ts'), 'utf8');
const engineSrc      = readFileSync(join(__dir, '../lib/workout-engine.ts'), 'utf8');
const storeSrc       = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
const customSrc      = readFileSync(join(__dir, '../app/custom-session.tsx'), 'utf8');
const sessionSrc     = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');

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

// ─── 1. Pool export — getAllPickableExercises exported from exercise-db.ts ────
console.log('\n[1] Pool export — getAllPickableExercises exported from exercise-db.ts');

check(
  'getAllPickableExercises is exported from exercise-db.ts',
  dbSrc.includes('export function getAllPickableExercises'),
  'function not found — custom-session.tsx import fails; picker shows 0 exercises',
);

// ─── 2. Pool sources — function body references the 3 exercise collections ───
console.log('\n[2] Pool sources — getAllPickableExercises references MAIN_LIFTS, ACCESSORIES, PREHAB_BY_REGION');

// Locate the function body using brace-counting so we only inspect what's inside it
const fnStart = dbSrc.indexOf('export function getAllPickableExercises');
let poolFnBody = '';

if (fnStart !== -1) {
  const bodyOpen = dbSrc.indexOf('{', fnStart);
  let depth = 0;
  let end   = -1;

  for (let i = bodyOpen; i < dbSrc.length; i++) {
    if (dbSrc[i] === '{') depth++;
    else if (dbSrc[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  poolFnBody = end !== -1 ? dbSrc.slice(bodyOpen, end + 1) : '';
}

check(
  'getAllPickableExercises body references MAIN_LIFTS',
  poolFnBody.includes('MAIN_LIFTS'),
  'MAIN_LIFTS not referenced — main exercises (squat/bench/deadlift) missing from custom picker',
);

check(
  'getAllPickableExercises body references ACCESSORIES',
  poolFnBody.includes('ACCESSORIES'),
  'ACCESSORIES not referenced — accessory exercises missing from custom picker',
);

check(
  'getAllPickableExercises body references PREHAB_BY_REGION',
  poolFnBody.includes('PREHAB_BY_REGION'),
  'PREHAB_BY_REGION not referenced — prehab exercises missing from custom picker',
);

// ─── 3. MAIN_LIFTS tiers — all internal tiers exist per session type ──────────
console.log('\n[3] MAIN_LIFTS tiers — bodyweight / dumbbells / fullgym present for each session type');

const INTERNAL_TIERS  = ['bodyweight', 'dumbbells', 'fullgym'];
const MAIN_SESSION_TYPES = ['squat', 'bench', 'deadlift'];

// Locate MAIN_LIFTS constant in exercise-db.ts and find its boundaries
const mainLiftsStart = dbSrc.indexOf('const MAIN_LIFTS');
let mainLiftsBlock   = '';

if (mainLiftsStart !== -1) {
  const openBrace = dbSrc.indexOf('{', mainLiftsStart);
  let depth = 0;
  let end   = -1;

  for (let i = openBrace; i < dbSrc.length; i++) {
    if (dbSrc[i] === '{') depth++;
    else if (dbSrc[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  mainLiftsBlock = end !== -1 ? dbSrc.slice(openBrace, end + 1) : '';
}

check(
  'MAIN_LIFTS constant found in exercise-db.ts',
  mainLiftsStart !== -1,
  'constant not found — custom picker has no main lift exercises',
);

if (mainLiftsBlock) {
  for (const sessionType of MAIN_SESSION_TYPES) {
    // Find the session-type block (e.g. squat: { ... }) and check it has all tiers
    const stIdx = mainLiftsBlock.indexOf(`${sessionType}:`);
    if (stIdx === -1) {
      check(
        `MAIN_LIFTS['${sessionType}'] key exists`,
        false,
        `'${sessionType}' key not found in MAIN_LIFTS — all ${sessionType} exercises missing from custom picker`,
      );
      continue;
    }

    const stObjOpen = mainLiftsBlock.indexOf('{', stIdx);
    let   stDepth   = 0;
    let   stEnd     = -1;

    for (let i = stObjOpen; i < mainLiftsBlock.length; i++) {
      if (mainLiftsBlock[i] === '{') stDepth++;
      else if (mainLiftsBlock[i] === '}') {
        stDepth--;
        if (stDepth === 0) { stEnd = i; break; }
      }
    }

    const stBlock = stEnd !== -1 ? mainLiftsBlock.slice(stObjOpen, stEnd + 1) : '';

    for (const tier of INTERNAL_TIERS) {
      check(
        `MAIN_LIFTS['${sessionType}']['${tier}'] exists`,
        stBlock.includes(`${tier}:`),
        `tier '${tier}' missing from MAIN_LIFTS['${sessionType}'] — ${sessionType} exercises vanish from custom picker for this tier`,
      );
    }
  }
}

// ─── 4. ACCESSORIES tiers — all internal tiers exist per session type ─────────
console.log('\n[4] ACCESSORIES tiers — bodyweight / dumbbells / fullgym present for each session type');

const accessoriesStart = dbSrc.indexOf('const ACCESSORIES');
let accessoriesBlock   = '';

if (accessoriesStart !== -1) {
  const openBrace = dbSrc.indexOf('{', accessoriesStart);
  let depth = 0;
  let end   = -1;

  for (let i = openBrace; i < dbSrc.length; i++) {
    if (dbSrc[i] === '{') depth++;
    else if (dbSrc[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  accessoriesBlock = end !== -1 ? dbSrc.slice(openBrace, end + 1) : '';
}

check(
  'ACCESSORIES constant found in exercise-db.ts',
  accessoriesStart !== -1,
  'constant not found — custom picker has no accessory exercises',
);

if (accessoriesBlock) {
  for (const sessionType of MAIN_SESSION_TYPES) {
    const stIdx = accessoriesBlock.indexOf(`${sessionType}:`);
    if (stIdx === -1) {
      check(
        `ACCESSORIES['${sessionType}'] key exists`,
        false,
        `'${sessionType}' key not found in ACCESSORIES — all ${sessionType} accessories missing from custom picker`,
      );
      continue;
    }

    const stObjOpen = accessoriesBlock.indexOf('{', stIdx);
    let   stDepth   = 0;
    let   stEnd     = -1;

    for (let i = stObjOpen; i < accessoriesBlock.length; i++) {
      if (accessoriesBlock[i] === '{') stDepth++;
      else if (accessoriesBlock[i] === '}') {
        stDepth--;
        if (stDepth === 0) { stEnd = i; break; }
      }
    }

    const stBlock = stEnd !== -1 ? accessoriesBlock.slice(stObjOpen, stEnd + 1) : '';

    for (const tier of INTERNAL_TIERS) {
      check(
        `ACCESSORIES['${sessionType}']['${tier}'] exists`,
        stBlock.includes(`${tier}:`),
        `tier '${tier}' missing from ACCESSORIES['${sessionType}'] — ${sessionType} accessories disappear from custom picker for this tier`,
      );
    }
  }
}

// ─── 5. Engine bypass — workout-engine.ts returns [] for 'custom' ─────────────
console.log("\n[5] Engine bypass — workout-engine.ts explicitly returns [] for sessionType === 'custom'");

check(
  "workout-engine.ts has explicit 'custom' bypass returning []",
  engineSrc.includes("sessionType === 'custom'") && engineSrc.includes("return [];"),
  "bypass missing — engine may generate a random session instead of using the user's picked exercises",
);

// Verify the [] return is in close proximity to the 'custom' check (not a coincidence)
const customBypassIdx = engineSrc.indexOf("sessionType === 'custom'");
const returnEmptyIdx  = customBypassIdx !== -1 ? engineSrc.indexOf('return [];', customBypassIdx) : -1;
check(
  "return [] follows immediately after the 'custom' check (within 50 chars)",
  returnEmptyIdx !== -1 && (returnEmptyIdx - customBypassIdx) < 50,
  "return [] is too far from the 'custom' check — may not be the custom bypass; verify workout-engine.ts lines",
);

// ─── 6. Store contract — pendingCustomExercises + setPendingCustomExercises ───
console.log('\n[6] Store contract — Zustand store declares pendingCustomExercises and setter');

check(
  'store.ts declares pendingCustomExercises field',
  storeSrc.includes('pendingCustomExercises'),
  'field missing — custom-session.tsx cannot hand exercises to session.tsx',
);

check(
  'store.ts declares setPendingCustomExercises action',
  storeSrc.includes('setPendingCustomExercises'),
  'action missing — custom-session.tsx cannot save selected exercises to the store',
);

// ─── 7. Picker wiring — custom-session.tsx imports pool and calls store action ─
console.log('\n[7] Picker wiring — custom-session.tsx imports getAllPickableExercises and setPendingCustomExercises');

check(
  'custom-session.tsx imports getAllPickableExercises',
  customSrc.includes('getAllPickableExercises'),
  'import not found — picker has no exercise pool to display',
);

check(
  'custom-session.tsx calls getAllPickableExercises to populate the picker',
  customSrc.includes('getAllPickableExercises('),
  'call site not found — picker never fetches exercises even if the import exists',
);

check(
  'custom-session.tsx calls setPendingCustomExercises before navigating to /session',
  customSrc.includes('setPendingCustomExercises('),
  'call site not found — selected exercises never reach the session screen',
);

check(
  "custom-session.tsx navigates to /session with sessionType: 'custom'",
  customSrc.includes("sessionType: 'custom'"),
  "navigation missing 'custom' sessionType — session screen receives wrong type",
);

// ─── 8. Session wiring — session.tsx reads pendingCustomExercises from store ──
console.log('\n[8] Session wiring — session.tsx reads pendingCustomExercises from the store');

check(
  'session.tsx references pendingCustomExercises',
  sessionSrc.includes('pendingCustomExercises'),
  'reference not found — custom exercises are saved to the store but never loaded into the session',
);

// ─── 9. ID uniqueness — no duplicate IDs across MAIN_LIFTS and ACCESSORIES ────
console.log('\n[9] ID uniqueness — no duplicate IDs across MAIN_LIFTS and ACCESSORIES');

// IDs in these collections follow the pattern: id: 'some-id'
// We scope the search to MAIN_LIFTS and ACCESSORIES blocks to avoid false positives
// from other collections.  If we can't isolate the blocks, fall back to the full file.
const searchBlock = (mainLiftsBlock || '') + (accessoriesBlock || '') || dbSrc;

const idMatches = searchBlock.match(/id:\s*'[^']+'/g) ?? [];
const ids       = idMatches.map(m => m.replace(/id:\s*'/, '').replace(/'$/, ''));

// Filter to IDs that look like exercise IDs (exclude conditioning, prehab, etc.)
const seen  = new Set();
const dupes = [];

for (const id of ids) {
  if (seen.has(id)) dupes.push(id);
  else seen.add(id);
}

check(
  `all ${ids.length} exercise IDs in MAIN_LIFTS + ACCESSORIES are unique (no duplicates)`,
  dupes.length === 0,
  dupes.length > 0 ? `duplicate IDs: ${dupes.join(', ')}` : '',
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`custom-session: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`custom-session: all ${total} checks passed\n`);
  process.exit(0);
}
