/**
 * Contract test: progressCounts heatmaps never drift to pain data.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The Stats tab contains two muscle-engagement BodyDiagram heatmaps
 * (front and back views) that display training volume per muscle region.
 * Both must always read from `progressCounts`, which is derived from
 * completed session data.
 *
 * If either assignment were accidentally changed to `painRegionCounts`
 * or `recentPainCounts`, users would see pain-history intensities on
 * the muscle-engagement heatmap instead of training volume — silently
 * corrupting the display with no visible error.
 *
 * Checks:
 *  1. SOURCE — exactly two `heatmapCounts={progressCounts}` assignments
 *              exist (front view + back view)
 *  2. SOURCE — no `heatmapCounts={progressCounts}` assignment is
 *              immediately adjacent to a pain variable reference
 *              (neither `painRegionCounts` nor `recentPainCounts`
 *              appears within 100 chars of either assignment)
 *  3. SOURCE — the front-view assignment appears before the back-view
 *              assignment (structural sanity)
 *
 * Run:  node tests/progress-heatmap-counts.check.mjs
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

// ─── Anchor ──────────────────────────────────────────────────────────────────

const PROGRESS_PROP = 'heatmapCounts={progressCounts}';

// ─── Locate all matches ───────────────────────────────────────────────────────

const progressMatches = [
  ...src.matchAll(new RegExp(PROGRESS_PROP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')),
];

// ─── 1. Exactly two progressCounts heatmap assignments ───────────────────────
console.log(
  '\n[1] Source — exactly two heatmapCounts={progressCounts} assignments exist (front + back)'
);

check(
  `"${PROGRESS_PROP}" appears exactly twice`,
  progressMatches.length === 2,
  progressMatches.length === 0
    ? 'assignment not found — both progressCounts heatmaps may have been removed or renamed'
    : progressMatches.length === 1
      ? 'only one assignment found — one of the front/back heatmaps may have drifted to a pain variable'
      : `found ${progressMatches.length} occurrences — expected exactly 2`
);

// ─── 2. Neither assignment is adjacent to pain variable references ────────────
console.log(
  '\n[2] Source — no progressCounts heatmap assignment is adjacent to painRegionCounts or recentPainCounts'
);

const PAIN_VARS = ['painRegionCounts', 'recentPainCounts'];
const WINDOW = 100;

for (let i = 0; i < progressMatches.length; i++) {
  const matchIdx = progressMatches[i].index;
  const window = src.slice(
    Math.max(0, matchIdx - WINDOW),
    matchIdx + PROGRESS_PROP.length + WINDOW
  );

  for (const painVar of PAIN_VARS) {
    check(
      `progressCounts assignment #${i + 1} does not reference \`${painVar}\` within ${WINDOW} chars`,
      !window.includes(painVar),
      `\`${painVar}\` detected near progressCounts assignment #${i + 1} — the muscle heatmap ` +
        'may be reading pain data instead of training volume'
    );
  }
}

// ─── 3. Front assignment appears before back assignment ───────────────────────
console.log(
  '\n[3] Source — front-view assignment appears before back-view assignment (structural order)'
);

const firstIdx = progressMatches.length > 0 ? progressMatches[0].index : -1;
const secondIdx = progressMatches.length > 1 ? progressMatches[1].index : -1;

check(
  'first progressCounts assignment index < second progressCounts assignment index',
  firstIdx !== -1 && secondIdx !== -1 && firstIdx < secondIdx,
  `firstIdx=${firstIdx}, secondIdx=${secondIdx} — ` +
    'expected front heatmap to appear before back heatmap in source'
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`progress-heatmap-counts: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`progress-heatmap-counts: all ${total} checks passed\n`);
  process.exitCode = 0;
}
