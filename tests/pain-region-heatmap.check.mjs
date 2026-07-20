/**
 * Contract tests: body-area heatmap correctly counts and filters sessions that
 * have multiple pain regions (painRegions[]) as well as legacy single-region
 * sessions (painRegion).
 *
 * WHY THIS MATTERS
 * ────────────────
 * Sessions now store `painRegions: PainRegion[]` (multi-select). The heatmap
 * data in the Stats tab is computed by three useMemo blocks in workouts.tsx:
 *   - painRegionCounts   (all-time)
 *   - recentPainCounts   (last 28 days)
 *   - previousPainCounts (28–56 days ago)
 * The history filter also narrows sessions by region.
 *
 * All four use the same derivation pattern:
 *   s.painRegions?.length ? s.painRegions : s.painRegion ? [s.painRegion] : []
 *
 * If this pattern is accidentally reverted to `s.painRegion` only, multi-region
 * sessions silently lose all but their first region in the heatmap.
 *
 * Checks:
 *  1. SOURCE PATTERN  — workouts.tsx uses the multi-region derivation in all 3 count blocks
 *  2. SOURCE FILTER   — workouts.tsx filter uses Array.includes() not strict equality
 *  3. COUNT LOGIC     — re-implemented count: multi-region session increments all regions
 *  4. LEGACY FALLBACK — session with only painRegion (no array) still counted
 *  5. NO-PAIN SKIP    — session with no pain data contributes 0 counts
 *  6. FILTER LOGIC    — re-implemented filter: multi-region session matched by any region
 *  7. FILTER LEGACY   — legacy session (painRegion only) still matched by filter
 *  8. FILTER MISS     — session not filtered out when region not in its set
 *
 * Run:  node tests/pain-region-heatmap.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const workoutsSrc = readFileSync(join(__dir, '../app/(tabs)/workouts.tsx'), 'utf8');

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

// ─── 1. SOURCE PATTERN — multi-region derivation in count useMemos ─────────────
console.log('\n[1] Source pattern — all-time / recent / previous count useMemos use painRegions[]');

const DERIVATION = 's.painRegions?.length ? s.painRegions : s.painRegion ? [s.painRegion] : []';

// Count how many times the pattern appears (should be ≥ 3: one per useMemo block)
const occurrences = (workoutsSrc.split(DERIVATION).length - 1);
check(
  `painRegions-with-fallback derivation appears ≥ 3 times in workouts.tsx (found ${occurrences})`,
  occurrences >= 3,
  'derivation not found in all three count useMemos — one or more heatmaps will miss multi-region sessions'
);

// ─── 2. SOURCE FILTER — filter uses Array.includes() not strict equality ────────
console.log('\n[2] Source filter — history filter uses Array.includes(), not strict equality');

check(
  'filter block uses regions.includes(painRegionFilter)',
  workoutsSrc.includes('regions.includes(painRegionFilter)'),
  'strict equality check found instead — sessions with 2+ regions may be excluded incorrectly'
);

check(
  'filter does NOT use s.painRegion !== painRegionFilter',
  !workoutsSrc.includes('s.painRegion !== painRegionFilter'),
  'legacy strict-equality check still present — multi-region sessions will not pass the filter'
);

// ─── 3–8. LOGIC TESTS — re-implement count + filter inline ─────────────────────
console.log('\n[3–8] Logic tests — count and filter re-implemented inline');

// Minimal session shape for testing
function makeSession(opts) {
  return {
    id: opts.id ?? 'test',
    date: opts.date ?? new Date().toISOString(),
    painRegion: opts.painRegion ?? undefined,
    painRegions: opts.painRegions ?? undefined,
    exerciseLogs: [],
    sessionType: 'squat',
    energy: 'normal',
  };
}

// Re-implements the derivation pattern
function getRegions(s) {
  return s.painRegions?.length ? s.painRegions : s.painRegion ? [s.painRegion] : [];
}

// Re-implements painRegionCounts logic
function computeCounts(sessions) {
  const counts = {};
  for (const s of sessions) {
    const regions = getRegions(s);
    for (const r of regions) {
      counts[r] = (counts[r] ?? 0) + 1;
    }
  }
  return counts;
}

// Re-implements filteredSessions filter for painRegionFilter
function filterByRegion(sessions, painRegionFilter) {
  return sessions.filter((s) => {
    const regions = getRegions(s);
    return regions.includes(painRegionFilter);
  });
}

// 3. Multi-region session increments ALL its regions
const multiSession = makeSession({ id: 'multi', painRegions: ['knee', 'lower_back'] });
const counts3 = computeCounts([multiSession]);

check(
  'multi-region session (painRegions: ["knee","lower_back"]) counted under "knee"',
  counts3['knee'] === 1,
  `knee count = ${counts3['knee'] ?? 0}, expected 1`
);

check(
  'multi-region session (painRegions: ["knee","lower_back"]) counted under "lower_back"',
  counts3['lower_back'] === 1,
  `lower_back count = ${counts3['lower_back'] ?? 0}, expected 1`
);

// 4. Legacy session (painRegion only, no painRegions) still counted
const legacySession = makeSession({ id: 'legacy', painRegion: 'knee' });
const counts4 = computeCounts([legacySession]);

check(
  'legacy session (painRegion: "knee", no painRegions) counted under "knee"',
  counts4['knee'] === 1,
  `knee count = ${counts4['knee'] ?? 0}, expected 1`
);

// 5. Session with no pain data contributes 0 counts
const noPainSession = makeSession({ id: 'nopain' });
const counts5 = computeCounts([noPainSession]);

check(
  'session with no pain data contributes 0 region counts',
  Object.keys(counts5).length === 0,
  `got ${JSON.stringify(counts5)}, expected {}`
);

// 6. Filter: multi-region session matched by any of its regions
const filtered6a = filterByRegion([multiSession], 'knee');
const filtered6b = filterByRegion([multiSession], 'lower_back');
const filtered6c = filterByRegion([multiSession], 'elbow_wrist');

check(
  'multi-region session included when filter matches first region ("knee")',
  filtered6a.length === 1,
  `got ${filtered6a.length} sessions, expected 1`
);

check(
  'multi-region session included when filter matches second region ("lower_back")',
  filtered6b.length === 1,
  `got ${filtered6b.length} sessions, expected 1`
);

check(
  'multi-region session excluded when filter region not in its set ("elbow_wrist")',
  filtered6c.length === 0,
  `got ${filtered6c.length} sessions, expected 0`
);

// 7. Legacy session still matched by filter
const filtered7 = filterByRegion([legacySession], 'knee');
const filtered7b = filterByRegion([legacySession], 'lower_back');

check(
  'legacy session (painRegion only) included by matching filter',
  filtered7.length === 1,
  `got ${filtered7.length} sessions, expected 1`
);

check(
  'legacy session excluded when filter region does not match its painRegion',
  filtered7b.length === 0,
  `got ${filtered7b.length} sessions, expected 0`
);

// 8. Mixed session list — aggregate counts are additive across regions
const threeRegionSession = makeSession({ id: 'three', painRegions: ['knee', 'lower_back', 'neck'] });
const mixed = [multiSession, legacySession, threeRegionSession, noPainSession];
const countsMixed = computeCounts(mixed);

check(
  'knee count = 3 across mixed session list (multi + legacy + three-region)',
  countsMixed['knee'] === 3,
  `knee = ${countsMixed['knee'] ?? 0}, expected 3`
);

check(
  'lower_back count = 2 (multi + three-region sessions)',
  countsMixed['lower_back'] === 2,
  `lower_back = ${countsMixed['lower_back'] ?? 0}, expected 2`
);

check(
  'neck count = 1 (three-region session only)',
  countsMixed['neck'] === 1,
  `neck = ${countsMixed['neck'] ?? 0}, expected 1`
);

check(
  'no-pain session does not inflate any region count',
  countsMixed['elbow_wrist'] === undefined,
  `elbow_wrist = ${countsMixed['elbow_wrist']}, expected undefined`
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-region-heatmap: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`pain-region-heatmap: all ${total} checks passed\n`);
  process.exit(0);
}
