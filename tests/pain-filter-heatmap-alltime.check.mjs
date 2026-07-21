/**
 * Contract test: the pain-filter heatmap always shows all-time counts.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The Stats tab contains two pain BodyDiagram heatmaps:
 *
 *  1. OVERVIEW diagram — respects the all / recent toggle by reading
 *     `painHeatmapMode === 'recent' ? recentPainCounts : painRegionCounts`.
 *     This is intentional: the toggle lets users compare their lifetime pain
 *     pattern against recent sessions.
 *
 *  2. FILTER diagram — sits inside the session-filter panel and lets users
 *     tap a region to filter the session history. This one must ALWAYS use
 *     `painRegionCounts` (all-time), because filtering by a region that
 *     shows zero recent pain would look inactive even when many all-time
 *     sessions are logged against it — making the filter appear broken.
 *
 * If someone accidentally swaps the filter diagram over to the mode-switch
 * ternary (or to `recentPainCounts` directly), users on a pain-free run
 * would see a blank heatmap in the filter panel and might think the feature
 * is broken or their pain history is gone.
 *
 * Checks:
 *  1. SOURCE — exactly one pain-related `heatmapCounts` assignment uses the
 *              mode-switch ternary (the overview diagram)
 *  2. SOURCE — exactly one pain-related `heatmapCounts` assignment is a
 *              direct `heatmapCounts={painRegionCounts}` with no ternary
 *              (the filter diagram)
 *  3. SOURCE — the direct assignment does NOT contain `recentPainCounts`
 *              (the filter is not accidentally reading the recent variable)
 *  4. SOURCE — the filter diagram assignment appears AFTER the overview
 *              assignment (structural sanity: filter panel is below overview)
 *
 * Run:  node tests/pain-filter-heatmap-alltime.check.mjs
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

// ─── Anchors ─────────────────────────────────────────────────────────────────

// The exact ternary used by the overview diagram
const OVERVIEW_TERNARY = "painHeatmapMode === 'recent' ? recentPainCounts : painRegionCounts";

// The exact direct prop used by the filter diagram
const FILTER_DIRECT = 'heatmapCounts={painRegionCounts}';

// ─── Locate all matches ───────────────────────────────────────────────────────

// Count how many times the ternary appears as a heatmapCounts value
const ternaryMatches = [
  ...src.matchAll(new RegExp(OVERVIEW_TERNARY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')),
];

// Count how many times the direct assignment appears
const directMatches = [
  ...src.matchAll(new RegExp(FILTER_DIRECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')),
];

const overviewIdx = ternaryMatches.length > 0 ? src.indexOf(OVERVIEW_TERNARY) : -1;
const filterIdx = directMatches.length > 0 ? src.indexOf(FILTER_DIRECT) : -1;

// ─── 1. Exactly one overview ternary ─────────────────────────────────────────
console.log(
  '\n[1] Source — exactly one pain heatmapCounts uses the mode-switch ternary (overview)'
);

check(
  `mode-switch ternary appears exactly once: "${OVERVIEW_TERNARY}"`,
  ternaryMatches.length === 1,
  ternaryMatches.length === 0
    ? 'ternary not found — the overview heatmap may have lost its mode-switch, ' +
        "making the 'recent' toggle a no-op"
    : `found ${ternaryMatches.length} occurrences — expected exactly 1`
);

// ─── 2. Exactly one direct filter assignment ──────────────────────────────────
console.log('\n[2] Source — exactly one pain heatmapCounts is a direct all-time prop (filter)');

check(
  `direct assignment appears exactly once: "${FILTER_DIRECT}"`,
  directMatches.length === 1,
  directMatches.length === 0
    ? `"${FILTER_DIRECT}" not found — the filter diagram may have been changed ` +
        'to use the mode-switch ternary or recentPainCounts, causing the filter ' +
        'panel to show different intensities depending on recent history'
    : `found ${directMatches.length} occurrences — expected exactly 1`
);

// ─── 3. Filter assignment does not reference recentPainCounts ─────────────────
console.log('\n[3] Source — the filter diagram does not reference recentPainCounts');

// Grab a window around the direct assignment to inspect (200 chars is enough)
const windowAround =
  filterIdx !== -1
    ? src.slice(Math.max(0, filterIdx - 20), filterIdx + FILTER_DIRECT.length + 20)
    : null;

check(
  'filter heatmapCounts prop does not contain `recentPainCounts`',
  windowAround !== null && !windowAround.includes('recentPainCounts'),
  windowAround === null
    ? 'filter assignment not found — could not inspect its value'
    : '`recentPainCounts` detected in the filter heatmapCounts prop — the filter ' +
        'diagram is now reading recent data instead of all-time counts'
);

// ─── 4. Filter diagram appears after overview diagram ────────────────────────
console.log(
  '\n[4] Source — filter diagram (all-time) appears after overview diagram (mode-switch)'
);

check(
  'overview ternary index < filter direct assignment index (structural order)',
  overviewIdx !== -1 && filterIdx !== -1 && overviewIdx < filterIdx,
  `overviewIdx=${overviewIdx}, filterIdx=${filterIdx} — ` +
    'expected filter panel to appear below the overview section in source'
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-filter-heatmap-alltime: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`pain-filter-heatmap-alltime: all ${total} checks passed\n`);
  process.exit(0);
}
