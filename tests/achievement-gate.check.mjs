/**
 * Contract tests: AchievementUnlockedSheet cannot appear during an active session.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The badge queue in app/_layout.tsx is gated by `inMainApp` so badges earned
 * during onboarding / auth / subscription flows are held back. A separate
 * `isOnTransientScreen` guard prevents navigation redirects while on session /
 * readiness screens. Together these ensure the AchievementUnlockedSheet never
 * slides up and obscures the workout UI mid-session.
 *
 * Checks:
 *  [1] TRANSIENT_SCREENS set includes 'session' — isOnTransientScreen is true
 *      while the user is on the session screen
 *  [2] inMainApp derivation requires onboardingComplete, isAuthenticated, and
 *      hasActiveSubscription — all three gates must be present
 *  [3] Toast queue drain bails out when !inMainApp — ensuring queued badges
 *      are not surfaced until the user is fully in the main app
 *  [4] AchievementUnlockedSheet is only rendered when currentToast is truthy —
 *      no unconditional render that could fire at any time
 *  [5] Sheet render block appears after the last </Stack> closing tag — the
 *      sheet is root-level, not nested inside any screen or modal
 *
 * Run:  node tests/achievement-gate.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const layoutSrc = readFileSync(join(__dir, '../app/_layout.tsx'), 'utf8');

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

console.log('\nachievement-gate: AchievementUnlockedSheet session guard\n');

// [1] TRANSIENT_SCREENS must include 'session'
check(
  "TRANSIENT_SCREENS set includes 'session'",
  /TRANSIENT_SCREENS\s*=\s*new\s+Set\([^)]*'session'/.test(layoutSrc),
  "add 'session' back to TRANSIENT_SCREENS so isOnTransientScreen is true mid-workout"
);

// [2] inMainApp requires all three gate conditions
check(
  'inMainApp gates on onboardingComplete',
  /const\s+inMainApp\s*=[^;]*onboardingComplete/.test(layoutSrc),
  'inMainApp derivation must include onboardingComplete'
);
check(
  'inMainApp gates on isAuthenticated',
  /const\s+inMainApp\s*=[^;]*isAuthenticated/.test(layoutSrc),
  'inMainApp derivation must include isAuthenticated'
);
check(
  'inMainApp gates on hasActiveSubscription',
  /const\s+inMainApp\s*=[^;]*hasActiveSubscription/.test(layoutSrc),
  'inMainApp derivation must include hasActiveSubscription'
);

// [3] Toast queue drain bails out when !inMainApp
check(
  'Queue drain useEffect bails out when !inMainApp',
  /if\s*\(\s*!inMainApp\s*\)\s*return/.test(layoutSrc),
  'drain useEffect must have `if (!inMainApp) return` to hold badges back during gate screens'
);

// [4] Sheet render is gated on currentToast (not unconditional)
check(
  'AchievementUnlockedSheet render gated on currentToast',
  /\{\s*currentToast\s*&&/.test(layoutSrc),
  'sheet must only mount when currentToast is non-null'
);

// [5] Sheet render block appears after the last </Stack> in the file — confirms
//     it is at the root of RootLayoutNav return, not inside a screen component
const stackCloseIdx = layoutSrc.lastIndexOf('</Stack>');
const sheetIdx = layoutSrc.indexOf('AchievementUnlockedSheet', stackCloseIdx);
check(
  'AchievementUnlockedSheet render is outside the Stack navigator',
  stackCloseIdx !== -1 && sheetIdx !== -1 && sheetIdx > stackCloseIdx,
  'sheet must be rendered after </Stack>, not nested inside any navigator screen'
);

console.log(`\nachievement-gate: ${total - failures} passed, ${failures} failed\n`);
if (failures > 0) process.exit(1);
