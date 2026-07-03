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

// ─── 1. Parse main/accessory exercises from lib/exercise-db.ts ────────────────
console.log('\n[1] Parse main/accessory exercises from lib/exercise-db.ts');

// Each exercise is written as a single-line object in exercise-db.ts.
// Strategy: scan every line that contains category: 'main' or category: 'accessory',
// extract the id and name, then check whether swapAlternative: and comfortVariant:
// appear on the same line.

const exercises = [];

for (const line of dbSrc.split('\n')) {
  if (!line.includes("category: 'main'") && !line.includes("category: 'accessory'")) continue;

  const idMatch   = line.match(/id:\s*'([^']+)'/);
  const nameMatch = line.match(/name:\s*'([^']+)'/);
  if (!idMatch) continue;

  exercises.push({
    id:                 idMatch[1],
    name:               nameMatch ? nameMatch[1] : '(unknown)',
    category:           line.includes("category: 'main'") ? 'main' : 'accessory',
    hasSwapAlternative: line.includes('swapAlternative:'),
    hasComfortVariant:  line.includes('comfortVariant:'),
  });
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

console.log(`  · ${mainCount} main, ${accessoryCount} accessory → ${strengthExercises.length} strength exercises checked`);
console.log(`  · ${condExercises.length} conditioning circuit(s) and ${testExercises.length} 1RM test protocol(s) skipped (not swappable)`);

// ─── 2. Swap coverage — every strength exercise has swapAlternative ────────────
console.log('\n[2] Swap coverage — every strength main/accessory exercise has swapAlternative');

for (const ex of strengthExercises) {
  const detail = ex.hasComfortVariant
    ? `comfortVariant present as fallback swap (button shows), but a dedicated ` +
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
