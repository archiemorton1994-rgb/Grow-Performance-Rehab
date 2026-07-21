/**
 * Contract test: recentPainCounts and previousPainCounts trend windows are
 * computed over the full session list, not over the currently-filtered subset.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The pain overview section shows trend arrows (↑/↓/→) per region by comparing
 * the last 28 days against the previous 28 days (days 29–56). Both windows
 * must iterate `completedSessions` — ALL completed sessions — so that sessions
 * outside the active date/region filter still contribute to the trend comparison.
 *
 * If either memo were accidentally scoped to `filteredSessions`, older sessions
 * would be suppressed from the previous window, making every trend appear flat
 * or upward even when pain in a region is actually decreasing.
 *
 * Checks:
 *  1. SOURCE — `recentPainCounts = useMemo(` is present
 *  2. SOURCE — recentPainCounts body iterates `completedSessions`
 *  3. SOURCE — recentPainCounts body does NOT reference `filteredSessions`
 *  4. SOURCE — recentPainCounts dependency array is exactly `[completedSessions]`
 *  5. SOURCE — `previousPainCounts = useMemo(` is present
 *  6. SOURCE — previousPainCounts body iterates `completedSessions`
 *  7. SOURCE — previousPainCounts body does NOT reference `filteredSessions`
 *  8. SOURCE — previousPainCounts dependency array is exactly `[completedSessions]`
 *  9. LOGIC  — recent window (≤28 days) correctly includes sessions in that window
 * 10. LOGIC  — recent window excludes sessions older than 28 days
 * 11. LOGIC  — previous window (29–56 days) correctly includes sessions in that window
 * 12. LOGIC  — previous window excludes sessions inside the recent 28-day window
 * 13. LOGIC  — previous window excludes sessions older than 56 days
 * 14. LOGIC  — trend is ↑ when recent > previous, ↓ when recent < previous, → when equal
 *
 * Run:  node tests/pain-trend-counts.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dir, '../app/(tabs)/workouts.tsx'), 'utf8');

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

// ─── Helper: extract a useMemo block by anchor ────────────────────────────────
// Finds `const <name> = useMemo(` and scans forward up to maxLen chars looking
// for `}, [completedSessions])` so we can inspect the entire body.

function extractMemoBlock(anchor, closeMarker, maxLen = 600) {
  const start = src.indexOf(anchor);
  if (start === -1) return { start: -1, window: null, closeOffset: -1, block: null };
  const window = src.slice(start, start + maxLen);
  const closeOffset = window.indexOf(closeMarker);
  const block = closeOffset !== -1 ? window.slice(0, closeOffset + closeMarker.length) : null;
  return { start, window, closeOffset, block };
}

const CLOSE = '}, [completedSessions])';
const FULL_LIST_ITER = 'for (const s of completedSessions)';

// ─── recentPainCounts ─────────────────────────────────────────────────────────

const RECENT_ANCHOR = 'const recentPainCounts = useMemo(';
const {
  start: recentStart,
  closeOffset: recentCloseOffset,
  block: recentBlock,
} = extractMemoBlock(RECENT_ANCHOR, CLOSE);

console.log('\n[1] Source — recentPainCounts useMemo is present');
check(
  `"${RECENT_ANCHOR}" found in source`,
  recentStart !== -1,
  'recentPainCounts useMemo is missing — trend arrows have no recent-window data source'
);

console.log('\n[2] Source — recentPainCounts body iterates completedSessions (full list)');
check(
  `useMemo body contains "${FULL_LIST_ITER}"`,
  recentBlock !== null && recentBlock.includes(FULL_LIST_ITER),
  recentBlock === null
    ? `closing "${CLOSE}" not found within 600 chars — memo structure may have changed`
    : 'recentPainCounts does not iterate completedSessions — trend comparison will be filter-scoped'
);

console.log('\n[3] Source — recentPainCounts body does NOT reference filteredSessions');
check(
  'recentPainCounts useMemo body does not mention filteredSessions',
  recentBlock !== null && !recentBlock.includes('filteredSessions'),
  recentBlock === null
    ? 'could not extract memo block — see checks 1/4 failures'
    : 'filteredSessions is referenced inside recentPainCounts — active filter will suppress older ' +
        'sessions and make trends appear flat or upward when they should be downward'
);

console.log('\n[4] Source — recentPainCounts dependency array is exactly [completedSessions]');
check(
  `useMemo closes with "${CLOSE}" (within 600 chars of anchor)`,
  recentCloseOffset !== -1,
  `"${CLOSE}" not found within 600 chars of the memo start — ` +
    'dependency array may include filteredSessions or other filter state'
);

// ─── previousPainCounts ───────────────────────────────────────────────────────

const PREV_ANCHOR = 'const previousPainCounts = useMemo(';
const {
  start: prevStart,
  closeOffset: prevCloseOffset,
  block: prevBlock,
} = extractMemoBlock(PREV_ANCHOR, CLOSE, 800);

console.log('\n[5] Source — previousPainCounts useMemo is present');
check(
  `"${PREV_ANCHOR}" found in source`,
  prevStart !== -1,
  'previousPainCounts useMemo is missing — trend arrows have no previous-window data source'
);

console.log('\n[6] Source — previousPainCounts body iterates completedSessions (full list)');
check(
  `useMemo body contains "${FULL_LIST_ITER}"`,
  prevBlock !== null && prevBlock.includes(FULL_LIST_ITER),
  prevBlock === null
    ? `closing "${CLOSE}" not found within 600 chars — memo structure may have changed`
    : 'previousPainCounts does not iterate completedSessions — previous window will be filter-scoped'
);

console.log('\n[7] Source — previousPainCounts body does NOT reference filteredSessions');
check(
  'previousPainCounts useMemo body does not mention filteredSessions',
  prevBlock !== null && !prevBlock.includes('filteredSessions'),
  prevBlock === null
    ? 'could not extract memo block — see checks 5/8 failures'
    : 'filteredSessions is referenced inside previousPainCounts — previous window will miss ' +
        'older sessions, making downward trends appear flat or upward'
);

console.log('\n[8] Source — previousPainCounts dependency array is exactly [completedSessions]');
check(
  `useMemo closes with "${CLOSE}" (within 600 chars of anchor)`,
  prevCloseOffset !== -1,
  `"${CLOSE}" not found within 600 chars of the memo start — ` +
    'dependency array may include filteredSessions or other filter state'
);

// ─── 9–14. LOGIC — 28-day window splitting and trend direction ────────────────
console.log('\n[9–14] Logic — 28-day window splitting and trend direction');

/**
 * Re-implements recentPainCounts from workouts.tsx.
 * Sessions with date >= (now - 28 days) are counted.
 */
function computeRecent(sessions, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 28);
  const counts = {};
  for (const s of sessions) {
    if (new Date(s.date) < cutoff) continue;
    const regions = s.painRegions?.length ? s.painRegions : s.painRegion ? [s.painRegion] : [];
    for (const r of regions) {
      counts[r] = (counts[r] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Re-implements previousPainCounts from workouts.tsx.
 * Sessions with date in [now-56, now-28) are counted.
 */
function computePrevious(sessions, now = new Date()) {
  const recentCutoff = new Date(now);
  recentCutoff.setDate(now.getDate() - 28);
  const prevCutoff = new Date(now);
  prevCutoff.setDate(now.getDate() - 56);
  const counts = {};
  for (const s of sessions) {
    const d = new Date(s.date);
    if (d >= prevCutoff && d < recentCutoff) {
      const regions = s.painRegions?.length ? s.painRegions : s.painRegion ? [s.painRegion] : [];
      for (const r of regions) {
        counts[r] = (counts[r] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/**
 * Re-implements painTrends from workouts.tsx.
 */
function computeTrends(recent, previous) {
  const allRegions = new Set([...Object.keys(recent), ...Object.keys(previous)]);
  const trends = {};
  for (const region of allRegions) {
    const r = recent[region] ?? 0;
    const p = previous[region] ?? 0;
    if (r > p) trends[region] = '↑';
    else if (r < p) trends[region] = '↓';
    else trends[region] = '→';
  }
  return trends;
}

// Anchor "now" so date arithmetic is deterministic
const NOW = new Date('2026-07-21T12:00:00Z');

// Session ages relative to NOW
function daysAgo(n) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const testSessions = [
  // Recent window (≤28 days)
  { id: 'r1', date: daysAgo(1), painRegions: ['knee'] },
  { id: 'r2', date: daysAgo(14), painRegions: ['knee'] },
  { id: 'r3', date: daysAgo(27), painRegions: ['lower_back'] },
  // Previous window (29–56 days)
  { id: 'p1', date: daysAgo(29), painRegions: ['knee'] },
  { id: 'p2', date: daysAgo(42), painRegions: ['knee'] },
  { id: 'p3', date: daysAgo(55), painRegions: ['shoulder_front'] },
  // Too old (>56 days) — should be excluded from both windows
  { id: 'old1', date: daysAgo(57), painRegions: ['knee'] },
  { id: 'old2', date: daysAgo(100), painRegions: ['hip_groin'] },
];

const recentCounts = computeRecent(testSessions, NOW);
const previousCounts = computePrevious(testSessions, NOW);
const trends = computeTrends(recentCounts, previousCounts);

// 9. Recent window includes sessions ≤28 days old
check(
  'knee appears in recentCounts (sessions r1, r2 are within 28 days)',
  (recentCounts['knee'] ?? 0) === 2,
  `got ${recentCounts['knee'] ?? 0}, expected 2`
);

// 10. Recent window excludes sessions older than 28 days
check(
  'shoulder_front is absent from recentCounts (only in previous window)',
  (recentCounts['shoulder_front'] ?? 0) === 0,
  `got ${recentCounts['shoulder_front'] ?? 0}, expected 0`
);

// 11. Previous window includes sessions in the 29–56 day range
check(
  'knee appears in previousCounts (sessions p1, p2 are in days 29–56)',
  (previousCounts['knee'] ?? 0) === 2,
  `got ${previousCounts['knee'] ?? 0}, expected 2`
);

// 12. Previous window excludes sessions inside the recent 28-day window
check(
  'lower_back is absent from previousCounts (session r3 is within 28 days)',
  (previousCounts['lower_back'] ?? 0) === 0,
  `got ${previousCounts['lower_back'] ?? 0}, expected 0`
);

// 13. Previous window excludes sessions older than 56 days
check(
  'hip_groin is absent from previousCounts (session old2 is >56 days old)',
  (previousCounts['hip_groin'] ?? 0) === 0,
  `got ${previousCounts['hip_groin'] ?? 0}, expected 0`
);

// 14. Trend directions: knee is equal (2 vs 2) → flat, lower_back recent-only → ↑,
//     shoulder_front previous-only → ↓
check(
  'knee trend is → (equal counts in both windows)',
  trends['knee'] === '→',
  `got "${trends['knee']}", expected "→"`
);
check(
  'lower_back trend is ↑ (recent=1, previous=0)',
  trends['lower_back'] === '↑',
  `got "${trends['lower_back']}", expected "↑"`
);
check(
  'shoulder_front trend is ↓ (recent=0, previous=1)',
  trends['shoulder_front'] === '↓',
  `got "${trends['shoulder_front']}", expected "↓"`
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-trend-counts: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`pain-trend-counts: all ${total} checks passed\n`);
  process.exit(0);
}
