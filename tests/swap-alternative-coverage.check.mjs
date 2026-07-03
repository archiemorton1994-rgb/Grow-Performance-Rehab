/**
 * Contract test: every exercise in the main and accessory phases of a regular
 * strength session has a swapAlternative defined so the "Swap exercise" button
 * always offers a meaningful alternative.
 *
 * The session screen gates the "Swap exercise" button on `exercise.hasSwap`:
 *
 *   {exercise.hasSwap && <Pressable onPress={onSwapPress} …>Swap exercise</Pressable>}
 *
 * In workout-engine.ts the flag is derived as:
 *
 *   const swap1  = t.swapAlternative ?? t.comfortVariant;   // preferred, then fallback
 *   hasSwap: !!(swap1)
 *
 * This means an exercise with NEITHER swapAlternative NOR comfortVariant will have
 * hasSwap = false — the swap button is hidden and users can never replace the
 * exercise mid-session.
 *
 * An exercise that only has comfortVariant (pain-adaptation variant) is in a
 * slightly better position — the button shows — but the user sees the pain variant
 * as their only swap option rather than a genuine exercise alternative.
 *
 * These checks guard against that regression:
 *   1. EXERCISE PARSING  — extract all main/accessory exercises from exercise-db.ts
 *                          using brace-depth block scanning (exercises are multi-line)
 *   2. SWAP COVERAGE     — every strength session exercise has swapAlternative
 *                          (conditioning circuits and 1RM test sets are excluded —
 *                           they are not individual exercises users would swap)
 *   3. ENGINE WIRING     — the swap path is correctly wired in workout-engine.ts
 *                          and the swap button is gated on hasSwap in session.tsx
 *
 * Adding a new exercise to the main or accessory pool without a swapAlternative
 * will cause this test to fail with a clear message naming the exercise.
 *
 * Run:  node tests/swap-alternative-coverage.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const dbSrc      = readFileSync(join(__dir, '../lib/exercise-db.ts'), 'utf8');
const engineSrc  = readFileSync(join(__dir, '../lib/workout-engine.ts'), 'utf8');
const sessionSrc = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');

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

// ─── 1. Parse main/accessory exercise objects from lib/exercise-db.ts ─────────
console.log('\n[1] Parse main/accessory exercises from lib/exercise-db.ts');

// Exercises are multi-line objects.  Strategy:
//   1. Find each occurrence of  category: 'main'  or  category: 'accessory'
//   2. Scan BACKWARDS from that point with brace-depth tracking to find the
//      opening '{' of the enclosing exercise object.
//   3. Scan FORWARDS from that '{' to find the matching closing '}' at depth 0.
//   4. Extract the full block and check for swapAlternative: and comfortVariant:.
//
// This mirrors the approach used in comfort-variant-coverage.check.mjs for
// comfortVariant block extraction.

const exercises = [];
let searchPos = 0;

while (true) {
  // Locate the next category: 'main' or category: 'accessory' occurrence.
  const catMainIdx = dbSrc.indexOf("category: 'main'",      searchPos);
  const catAccIdx  = dbSrc.indexOf("category: 'accessory'", searchPos);

  if (catMainIdx === -1 && catAccIdx === -1) break;

  let catPos;
  let category;
  if (catMainIdx === -1 || (catAccIdx !== -1 && catAccIdx < catMainIdx)) {
    catPos   = catAccIdx;
    category = 'accessory';
  } else {
    catPos   = catMainIdx;
    category = 'main';
  }

  // Scan backwards to find the opening '{' of the exercise object.
  // Between the exercise's opening '{' and 'category:' all properties (id, name,
  // sets, reps, cue, suggestedLoad) are plain scalar values — no nested braces —
  // so the first '{' encountered while scanning backwards at depth 0 IS the
  // opening brace of the exercise object.
  let backDepth = 0;
  let objOpen   = -1;
  for (let i = catPos - 1; i >= 0; i--) {
    if (dbSrc[i] === '}') backDepth++;
    else if (dbSrc[i] === '{') {
      if (backDepth === 0) { objOpen = i; break; }
      backDepth--;
    }
  }

  if (objOpen === -1) { searchPos = catPos + 1; continue; }

  // Scan forwards from objOpen to find the matching closing '}'.
  let fwdDepth = 0;
  let objEnd   = -1;
  for (let i = objOpen; i < dbSrc.length; i++) {
    if (dbSrc[i] === '{') fwdDepth++;
    else if (dbSrc[i] === '}') {
      fwdDepth--;
      if (fwdDepth === 0) { objEnd = i; break; }
    }
  }

  if (objEnd === -1) { searchPos = catPos + 1; continue; }

  const block = dbSrc.slice(objOpen, objEnd + 1);

  // Extract id and name — both always use single quotes in exercise-db.ts.
  // Use the first match to get the exercise's own id/name, not the swapAlternative's.
  const idMatch   = block.match(/\bid:\s*'([^']+)'/);
  const nameMatch = block.match(/\bname:\s*'([^']+)'/);

  if (!idMatch) { searchPos = objEnd + 1; continue; }

  exercises.push({
    id:                 idMatch[1],
    name:               nameMatch ? nameMatch[1] : '(unknown)',
    category,
    hasSwapAlternative: block.includes('swapAlternative:'),
    hasComfortVariant:  block.includes('comfortVariant:'),
  });

  searchPos = objEnd + 1;
}

// Conditioning circuits (cond-*) and 1RM test protocols (*-1rm-*) are excluded
// from the swap check: conditioning exercises are whole circuits (not individual
// exercises users would swap one-for-one), and 1RM tests are assessment protocols
// where substituting a different exercise would invalidate the test.
const strengthExercises = exercises.filter(
  e => !e.id.startsWith('cond-') && !e.id.includes('-1rm-'),
);
const condExercises = exercises.filter(e => e.id.startsWith('cond-'));
const testExercises = exercises.filter(e => e.id.includes('-1rm-'));

const mainCount      = strengthExercises.filter(e => e.category === 'main').length;
const accessoryCount = strengthExercises.filter(e => e.category === 'accessory').length;

check(
  `at least 1 'main' strength exercise found (found ${mainCount})`,
  mainCount >= 1,
  'no main-category exercises found — check lib/exercise-db.ts',
);

check(
  `at least 1 'accessory' strength exercise found (found ${accessoryCount})`,
  accessoryCount >= 1,
  'no accessory-category exercises found — check lib/exercise-db.ts',
);

console.log(`  · ${mainCount} main, ${accessoryCount} accessory → ${strengthExercises.length} strength exercises to check`);
console.log(`  · ${condExercises.length} conditioning circuit(s) and ${testExercises.length} 1RM test protocol(s) skipped (not individually swappable)`);

// ─── 2. Swap coverage — every strength exercise has swapAlternative ────────────
console.log('\n[2] Swap coverage — every strength main/accessory exercise has swapAlternative');

for (const ex of strengthExercises) {
  const detail = ex.hasComfortVariant
    ? `comfortVariant present as fallback swap (button will show), but a dedicated ` +
      `swapAlternative is still needed so users see a true exercise alternative ` +
      `rather than the pain-adaptation variant`
    : `neither swapAlternative nor comfortVariant — hasSwap = false, swap button ` +
      `is hidden and users can never replace this exercise mid-session`;

  check(
    `'${ex.id}' (${ex.name}) [${ex.category}] has swapAlternative`,
    ex.hasSwapAlternative,
    detail,
  );
}

// ─── 3. Engine wiring — swap path is reachable ────────────────────────────────
console.log('\n[3] Engine wiring — swap path is reachable in workout-engine.ts and session.tsx');

check(
  'swapAlternative is read from ExerciseTemplate in workout-engine.ts',
  engineSrc.includes('swapAlternative'),
  'swapAlternative reference missing — swap feature may be broken',
);

check(
  'swap1 falls back to comfortVariant when swapAlternative is absent',
  engineSrc.includes('swapAlternative ?? t.comfortVariant'),
  'fallback missing — exercises with only comfortVariant would show empty swap modal',
);

check(
  'hasSwap is derived from swap alternative in workout-engine.ts',
  engineSrc.includes('hasSwap'),
  'hasSwap field not found — swap button visibility may be uncontrolled',
);

check(
  'swap button is gated on exercise.hasSwap in session.tsx',
  sessionSrc.includes('exercise.hasSwap'),
  'exercise.hasSwap not referenced in session.tsx — swap button may always show/hide incorrectly',
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`swap-alternative-coverage: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`swap-alternative-coverage: all ${total} checks passed\n`);
  process.exit(0);
}
