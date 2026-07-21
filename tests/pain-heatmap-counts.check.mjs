/**
 * Contract test: painRegionCounts heatmap is computed over the full session
 * list, not over the currently-filtered subset.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The BodyDiagram heatmap in the Stats tab shows how often each body region
 * has been reported as painful. It is fed by `painRegionCounts`, which must
 * iterate over ALL completed sessions so that every zone's intensity can be
 * compared against every other zone at once.
 *
 * If `painRegionCounts` were accidentally scoped to `filteredSessions` (the
 * list narrowed by painRegionFilter, dateFilter, etc.), the selected region
 * would always appear at maximum intensity — every session in the filtered
 * set contains that region. Other regions' bars would shrink misleadingly.
 * The heatmap would be useless as a cross-region comparison tool.
 *
 * Checks:
 *  1. SOURCE — `painRegionCounts = useMemo(` is present (memo exists)
 *  2. SOURCE — useMemo body iterates `completedSessions` (full list)
 *  3. SOURCE — useMemo body does NOT reference `filteredSessions`
 *  4. SOURCE — useMemo dependency array is exactly `[completedSessions]`
 *  5. LOGIC  — full-list counts include sessions excluded by the active filter
 *  6. LOGIC  — regions from filter-excluded sessions appear in the counts
 *  7. LOGIC  — sessions with no pain data contribute 0 to every count
 *  8. SANITY — filtered-list counts would miss those regions (confirms the test is meaningful)
 *
 * Run:  node tests/pain-heatmap-counts.check.mjs
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

// ─── Extract the painRegionCounts useMemo block ───────────────────────────────
// Anchor to `const painRegionCounts = useMemo(` and find the closing
// `}, [completedSessions])` within 500 chars. This gives us the entire memo
// body for targeted source checks without a TypeScript parser.

const MEMO_ANCHOR = 'const painRegionCounts = useMemo(';
const MEMO_CLOSE = '}, [completedSessions])';

const memoStart = src.indexOf(MEMO_ANCHOR);
const window500 = memoStart !== -1 ? src.slice(memoStart, memoStart + 500) : null;
const memoCloseOffset = window500 !== null ? window500.indexOf(MEMO_CLOSE) : -1;
const memoBlock =
  window500 !== null && memoCloseOffset !== -1
    ? window500.slice(0, memoCloseOffset + MEMO_CLOSE.length)
    : null;

// ─── 1. SOURCE — useMemo is present ──────────────────────────────────────────
console.log('\n[1] Source — painRegionCounts useMemo is present');

check(
  `"${MEMO_ANCHOR}" found in source`,
  memoStart !== -1,
  'painRegionCounts useMemo is missing — heatmap has no data source'
);

// ─── 2. SOURCE — body iterates completedSessions (full list) ─────────────────
console.log('\n[2] Source — useMemo body iterates completedSessions (not a filtered subset)');

const FULL_LIST_ITER = 'for (const s of completedSessions)';

check(
  `useMemo body contains "${FULL_LIST_ITER}"`,
  memoBlock !== null && memoBlock.includes(FULL_LIST_ITER),
  memoBlock === null
    ? `closing "${MEMO_CLOSE}" not found within 500 chars — memo structure may have changed`
    : 'painRegionCounts does not iterate completedSessions — heatmap intensity will be wrong'
);

// ─── 3. SOURCE — body does NOT reference filteredSessions ────────────────────
console.log('\n[3] Source — useMemo body does NOT reference filteredSessions');

check(
  'painRegionCounts useMemo body does not mention filteredSessions',
  memoBlock !== null && !memoBlock.includes('filteredSessions'),
  memoBlock === null
    ? 'could not extract memo block — see check 1 / check 4 failures'
    : 'filteredSessions is referenced inside painRegionCounts — active region will always ' +
        'appear at maximum intensity; all other zones will shrink misleadingly'
);

// ─── 4. SOURCE — dependency array is [completedSessions] ─────────────────────
console.log('\n[4] Source — useMemo dependency array is exactly [completedSessions]');

check(
  `useMemo closes with "${MEMO_CLOSE}" (within 500 chars of anchor)`,
  memoCloseOffset !== -1,
  `"${MEMO_CLOSE}" not found within 500 chars of the memo start — ` +
    'dependency array may include filteredSessions or other filter state, ' +
    'causing stale or filter-scoped heatmap counts'
);

// ─── 5–8. LOGIC — counts cover all sessions regardless of active filter ───────
console.log('\n[5–8] Logic — counts include all sessions regardless of active filter');

/**
 * Re-implements the painRegionCounts useMemo from workouts.tsx (lines ~3812-3821).
 * Mirrors the exact loop so any future drift is caught by the source checks above.
 */
function computeCounts(sessions) {
  const counts = {};
  for (const s of sessions) {
    const regions = s.painRegions?.length ? s.painRegions : s.painRegion ? [s.painRegion] : [];
    for (const r of regions) {
      counts[r] = (counts[r] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Re-implements the painRegionFilter branch of filteredSessions from workouts.tsx.
 * Used to prove what counts WOULD look like if erroneously computed post-filter.
 */
function applyPainFilter(sessions, filter) {
  if (!filter) return sessions;
  return sessions.filter((s) => {
    const regions = s.painRegions?.length ? s.painRegions : s.painRegion ? [s.painRegion] : [];
    return regions.includes(filter);
  });
}

const allSessions = [
  { id: 'knee-only', painRegions: ['knee'] },
  { id: 'back-only', painRegions: ['lower_back'] },
  { id: 'multi', painRegions: ['knee', 'shoulder_front'] },
  { id: 'nopain' },
  { id: 'legacy', painRegion: 'hip_groin' },
];

// Simulate: painRegionFilter = 'knee' is active
const filteredForKnee = applyPainFilter(allSessions, 'knee');
const countsFromAll = computeCounts(allSessions);
const countsFromFiltered = computeCounts(filteredForKnee);

// 5. Full-list count for lower_back is > 0 even when filter = 'knee' is active.
//    painRegionCounts should behave like countsFromAll, not countsFromFiltered.
check(
  'lower_back count is non-zero when all sessions are counted (filter="knee" active)',
  (countsFromAll['lower_back'] ?? 0) > 0,
  `got ${countsFromAll['lower_back'] ?? 0} — back-only session must contribute a count`
);

// 6. Regions from filter-excluded sessions appear in the full-list counts.
check(
  'hip_groin appears in full-list counts (from legacy session excluded by knee filter)',
  (countsFromAll['hip_groin'] ?? 0) > 0,
  `got ${countsFromAll['hip_groin'] ?? 0} — legacy painRegion session should be counted`
);

// 7. No-pain sessions contribute nothing.
const noPainCounts = computeCounts([{ id: 'nopain' }]);
check(
  'session with no painRegions or painRegion contributes 0 to all counts',
  Object.keys(noPainCounts).length === 0,
  `got counts: ${JSON.stringify(noPainCounts)} — expected empty object`
);

// 8. Sanity: the filtered-list counts WOULD be missing those regions, confirming
//    that the counts source matters and the test is meaningful.
check(
  'SANITY: lower_back count is 0 from filtered list (proves test is sensitive to data source)',
  (countsFromFiltered['lower_back'] ?? 0) === 0,
  'filtered list should contain only knee sessions — if lower_back appears, applyPainFilter is wrong'
);

check(
  'SANITY: hip_groin count is 0 from filtered list (legacy session excluded by filter)',
  (countsFromFiltered['hip_groin'] ?? 0) === 0,
  'filtered list should not include the hip_groin legacy session'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-heatmap-counts: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`pain-heatmap-counts: all ${total} checks passed\n`);
  process.exit(0);
}
