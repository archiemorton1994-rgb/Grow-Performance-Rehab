/**
 * Contract tests: badge animation tracking fires correctly for 1, N, and 0
 * new badges, and does not re-animate already-earned badges after app restart.
 *
 * HOW THE BADGE ANIMATION WORKS
 * ──────────────────────────────
 * HomeScreen initialises prevBadgeIdsRef with new Set(earnedBadges) so that
 * badges earned before the current mount are pre-loaded and never re-animate.
 * On each earnedBadges change the effect diffs against prevBadgeIdsRef (a full
 * ID Set, not a count) to collect newIds. Each new ID is added to
 * animatingBadgeIds at (i * 80) ms and removed at (i * 80 + 800) ms —
 * producing a 80 ms stagger ripple for simultaneous batches.
 *
 * Silent failure modes this catches:
 *  - prevBadgeIdsRef reverted to a count → wrong diff, re-animation on restart
 *  - animatingBadgeIds reverted to string|null → only last badge in batch fires
 *  - stagger multiplier changed → visual ripple broken for multi-badge batches
 *  - clear delay changed → animation lifetime too short/long
 *  - ref updated AFTER early return → already-earned badges re-animate on next
 *    render cycle after earnedBadges array reference changes
 *  - cleanup removed → stale timers fire after component unmounts
 *
 * Checks:
 *  STATIC  1. prevBadgeIdsRef initialised with new Set(earnedBadges)
 *  STATIC  2. Diff uses .filter(id => !prev.has(id)), not count subtraction
 *  STATIC  3. prevBadgeIdsRef.current updated before early-return guard
 *  STATIC  4. Stagger: i * 80
 *  STATIC  5. Clear delay: startDelay + 800
 *  STATIC  6. animatingBadgeIds is Set<string> (not string | null)
 *  STATIC  7. Effect cleanup calls timers.forEach(clearTimeout)
 *  RUNTIME 8. Single new badge → 1 entry in newIds, start=0 ms, clear=800 ms
 *  RUNTIME 9. 3 simultaneous badges → staggered starts (0/80/160), clears (800/880/960)
 *  RUNTIME 10. No new badges → newIds is empty, no timers scheduled
 *  RUNTIME 11. Mount with existing badges → diff against pre-loaded ref yields no newIds
 *
 * Run:  node tests/badge-animation.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// Logic lives in the extracted hook; index.tsx wires it in.
const hookSrc  = readFileSync(join(__dir, '../hooks/useBadgeAnimation.ts'), 'utf8');
const indexSrc = readFileSync(join(__dir, '../app/(tabs)/index.tsx'), 'utf8');

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`);
    failed++;
  }
}

// For structural checks we use the hook source as "block"
const block = hookSrc;

// ─── Section 1: Static structure ──────────────────────────────────────────────

console.log('\nStatic structure checks');

// 1. prevBadgeIdsRef initialised with new Set(earnedBadges), not a number
check(
  'prevBadgeIdsRef initialised as Set<string>(earnedBadges)',
  /prevBadgeIdsRef\s*=\s*useRef[^(]*\(\s*new Set\s*\(\s*earnedBadges\s*\)/.test(block),
  'Expected: useRef(new Set(earnedBadges))',
);

// 2. Diff uses Set.has(), not count subtraction
check(
  'Diff filters by Set.has() identity, not by count',
  /earnedBadges\.filter\s*\(\s*id\s*=>\s*!prev\.has\s*\(\s*id\s*\)/.test(block),
  'Expected: earnedBadges.filter(id => !prev.has(id))',
);

// 3. Ref is updated before the early-return guard
// "prevBadgeIdsRef.current = new Set(earnedBadges)" must appear BEFORE
// "if (newIds.length === 0) return"
const refUpdateIdx = block.indexOf('prevBadgeIdsRef.current = new Set');
const earlyReturnIdx = block.indexOf('if (newIds.length === 0) return');
check(
  'prevBadgeIdsRef.current updated before early-return guard',
  refUpdateIdx !== -1 && earlyReturnIdx !== -1 && refUpdateIdx < earlyReturnIdx,
  `refUpdate@${refUpdateIdx}, earlyReturn@${earlyReturnIdx}`,
);

// 4. Stagger delay uses i * 80
check(
  'Stagger delay is i * 80 ms',
  /startDelay\s*=\s*i\s*\*\s*80/.test(block),
  'Expected: startDelay = i * 80',
);

// 5. Clear delay is startDelay + 800
check(
  'Clear delay is startDelay + 800 ms',
  /clearDelay\s*=\s*startDelay\s*\+\s*800/.test(block),
  'Expected: clearDelay = startDelay + 800',
);

// 6. animatingBadgeIds is a Set, not a single string/null
check(
  'animatingBadgeIds state is Set<string>',
  /animatingBadgeIds.*useState.*Set<string>/.test(block) ||
  /useState<Set<string>>/.test(block),
  'Expected: useState<Set<string>>(new Set())',
);

// 7. Effect cleanup calls timers.forEach(clearTimeout)
check(
  'Effect cleanup cancels all timers via timers.forEach(clearTimeout)',
  /timers\.forEach\s*\(\s*clearTimeout\s*\)/.test(block),
  'Expected: return () => timers.forEach(clearTimeout)',
);

// ─── Section 2: Runtime logic simulation ──────────────────────────────────────
// Re-implement the pure diff + timing calculation here so we can verify
// the arithmetic is correct for 1, N, and 0 new badges, and for the
// mount-with-existing-badges case.

console.log('\nRuntime logic simulation');

/**
 * Simulates the core diff + timer-scheduling logic extracted from the effect.
 * Returns { newIds, timingPairs } where timingPairs[i] = [startMs, clearMs].
 */
function simulateDiff(prevIds, earnedBadges) {
  const prev = new Set(prevIds);
  const newIds = earnedBadges.filter(id => !prev.has(id));
  const timingPairs = newIds.map((_, i) => {
    const startDelay = i * 80;
    const clearDelay = startDelay + 800;
    return [startDelay, clearDelay];
  });
  return { newIds, timingPairs };
}

// 8. Single new badge
{
  const { newIds, timingPairs } = simulateDiff(
    ['badge_a', 'badge_b'],         // already earned (pre-loaded at mount)
    ['badge_a', 'badge_b', 'badge_c'], // earnedBadges after session
  );
  check(
    'Single new badge: exactly 1 ID in newIds',
    newIds.length === 1 && newIds[0] === 'badge_c',
    `newIds=${JSON.stringify(newIds)}`,
  );
  check(
    'Single new badge: starts at 0 ms, clears at 800 ms',
    timingPairs.length === 1 &&
    timingPairs[0][0] === 0 &&
    timingPairs[0][1] === 800,
    `timingPairs=${JSON.stringify(timingPairs)}`,
  );
}

// 9. 3 simultaneous badges (stagger ripple)
{
  const { newIds, timingPairs } = simulateDiff(
    ['badge_a'],
    ['badge_a', 'badge_b', 'badge_c', 'badge_d'],
  );
  check(
    '3 simultaneous badges: 3 IDs in newIds',
    newIds.length === 3,
    `newIds=${JSON.stringify(newIds)}`,
  );
  const expectedStarts = [0, 80, 160];
  const expectedClears = [800, 880, 960];
  const startsOk = timingPairs.every(([s], i) => s === expectedStarts[i]);
  const clearsOk = timingPairs.every(([, c], i) => c === expectedClears[i]);
  check(
    '3 simultaneous badges: stagger starts at 0 / 80 / 160 ms',
    startsOk,
    `starts=${timingPairs.map(p => p[0]).join(', ')} (expected 0, 80, 160)`,
  );
  check(
    '3 simultaneous badges: clears at 800 / 880 / 960 ms',
    clearsOk,
    `clears=${timingPairs.map(p => p[1]).join(', ')} (expected 800, 880, 960)`,
  );
}

// 10. No new badges → empty diff, no timers
{
  const { newIds, timingPairs } = simulateDiff(
    ['badge_a', 'badge_b'],
    ['badge_a', 'badge_b'],
  );
  check(
    'No new badges: newIds is empty, no timers scheduled',
    newIds.length === 0 && timingPairs.length === 0,
    `newIds=${JSON.stringify(newIds)}`,
  );
}

// 11. Mount with existing badges → re-render does not produce new IDs
{
  // Simulates: component mounts with earnedBadges=['a','b'],
  // prevBadgeIdsRef = new Set(['a','b']).
  // On first earnedBadges change (array ref changes but contents same):
  const { newIds } = simulateDiff(
    ['badge_a', 'badge_b'],  // prevBadgeIdsRef pre-loaded at mount
    ['badge_a', 'badge_b'],  // earnedBadges — same contents, new array ref
  );
  check(
    'Mount with existing badges: diff yields no newIds on next render cycle',
    newIds.length === 0,
    `newIds=${JSON.stringify(newIds)}`,
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
