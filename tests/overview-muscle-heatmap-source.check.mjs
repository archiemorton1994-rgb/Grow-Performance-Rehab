/**
 * Contract test: MuscleProgressPanel overview heatmap data source never drifts to pain data.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The Stats tab contains a `MuscleProgressPanel` component that renders the
 * muscle-engagement heatmap section (the "overview" of muscle progress). Inside
 * it, `progressCounts` drives both the front- and back-view BodyDiagram heatmaps.
 *
 * A separate test (`progress-heatmap-counts.check.mjs`) already verifies that the
 * *prop assignments* (`heatmapCounts={progressCounts}`) are correct. This test
 * guards the *data source* one level up — inside the MuscleProgressPanel body —
 * ensuring that:
 *
 *   1. `progressCounts` is always derived from `getMuscleProgressCounts`
 *      (training-volume data), not from any pain-related function or variable.
 *   2. The MuscleProgressPanel component body contains no references to
 *      `painRegionCounts` or `recentPainCounts` — pain variables must never
 *      appear inside the muscle-progress overview component.
 *   3. `getMuscleProgressCounts` receives `completedSessions` as its argument
 *      (the component's training-data prop), not a pain-related variable.
 *
 * Without this guard, a developer could accidentally wire `progressCounts` to
 * pain-history data inside MuscleProgressPanel — the prop-level test would still
 * see `heatmapCounts={progressCounts}` and pass, while the heatmap silently
 * displayed pain intensities instead of training volume.
 *
 * Run:  node tests/overview-muscle-heatmap-source.check.mjs
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

// ─── Isolate the MuscleProgressPanel component body ──────────────────────────
//
// We locate the function definition and extract everything up to the *next*
// top-level function/component definition so checks are scoped to the right
// code.  A top-level declaration starts at column 0 with `function ` or
// `const ` or `class `.

const PANEL_ANCHOR = 'function MuscleProgressPanel(';
const panelStart = src.indexOf(PANEL_ANCHOR);

if (panelStart === -1) {
  console.error(
    '\nFATAL: Could not locate MuscleProgressPanel in workouts.tsx — ' +
      'the component may have been renamed or removed.'
  );
  process.exit(1);
}

// Find the next top-level declaration after MuscleProgressPanel
const TOP_LEVEL = /\n(?:function |const [A-Z]|class )/g;
TOP_LEVEL.lastIndex = panelStart + PANEL_ANCHOR.length;
const nextTopLevel = TOP_LEVEL.exec(src);
const panelEnd = nextTopLevel ? nextTopLevel.index : src.length;

const panelBody = src.slice(panelStart, panelEnd);

// ─── Anchors ─────────────────────────────────────────────────────────────────

const PROGRESS_COUNTS_ASSIGN = 'getMuscleProgressCounts(';
const PAIN_VARS = ['painRegionCounts', 'recentPainCounts'];

// ─── 1. progressCounts is sourced from getMuscleProgressCounts ───────────────
console.log(
  '\n[1] Source — progressCounts inside MuscleProgressPanel is assigned from getMuscleProgressCounts'
);

check(
  '`getMuscleProgressCounts(` appears inside MuscleProgressPanel body',
  panelBody.includes(PROGRESS_COUNTS_ASSIGN),
  '`getMuscleProgressCounts` call not found — progressCounts may be sourced from an unknown or ' +
    'pain-related function'
);

// ─── 2. No pain variable references inside MuscleProgressPanel ───────────────
console.log(
  '\n[2] Source — MuscleProgressPanel body contains no references to pain count variables'
);

for (const painVar of PAIN_VARS) {
  check(
    `\`${painVar}\` does NOT appear inside MuscleProgressPanel body`,
    !panelBody.includes(painVar),
    `\`${painVar}\` found inside MuscleProgressPanel — the muscle-progress overview must never ` +
      'reference pain data'
  );
}

// ─── 3. getMuscleProgressCounts receives completedSessions ───────────────────
console.log(
  '\n[3] Source — getMuscleProgressCounts is called with completedSessions (not a pain variable)'
);

// Find the call site within the component body
const callIdx = panelBody.indexOf(PROGRESS_COUNTS_ASSIGN);
if (callIdx !== -1) {
  // Grab the argument list: text from '(' up to the first ')'
  const afterOpen = callIdx + PROGRESS_COUNTS_ASSIGN.length;
  const closeIdx = panelBody.indexOf(')', afterOpen);
  const argText = closeIdx !== -1 ? panelBody.slice(afterOpen, closeIdx).trim() : '';

  check(
    '`getMuscleProgressCounts` argument is `completedSessions`',
    argText === 'completedSessions',
    `expected argument "completedSessions" but found "${argText}" — the source data may have ` +
      'been replaced with a pain-related variable'
  );

  // Also verify no pain variable appears immediately around the call site
  const WINDOW = 120;
  const callWindow = panelBody.slice(
    Math.max(0, callIdx - WINDOW),
    callIdx + PROGRESS_COUNTS_ASSIGN.length + WINDOW
  );

  for (const painVar of PAIN_VARS) {
    check(
      `\`${painVar}\` does not appear within ${WINDOW} chars of getMuscleProgressCounts call`,
      !callWindow.includes(painVar),
      `\`${painVar}\` detected near getMuscleProgressCounts — the call may be using pain data ` +
        'as its input'
    );
  }
} else {
  // getMuscleProgressCounts not found — already caught by check [1]; skip sub-checks
  console.log('  (skipped — getMuscleProgressCounts call not found, caught above)');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`overview-muscle-heatmap-source: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`overview-muscle-heatmap-source: all ${total} checks passed\n`);
  process.exitCode = 0;
}
