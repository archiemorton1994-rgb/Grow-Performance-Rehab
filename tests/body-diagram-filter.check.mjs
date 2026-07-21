/**
 * Contract test: BodyDiagram heatmap onSelect tap-to-filter works correctly.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The Stats tab has two separate paths that both drive painRegionFilter:
 *
 *   1. Pain pills on session rows (guarded by pain-pill-filter.check.mjs)
 *      toggle: `prev === region ? null : region`
 *
 *   2. BodyDiagram heatmap regions (guarded here)
 *      toggle: `r === prev ? null : (r ?? null)`
 *
 * The body-diagram path is subtly different — `r` is typed `PainRegion |
 * undefined` (the BodyDiagram can send undefined to deselect), so the toggle
 * uses `(r ?? null)` instead of bare `r`. If this pattern is simplified to a
 * plain setter or the prev-based guard is dropped, a second tap on the same
 * region will no longer clear the filter — a silent regression.
 *
 * Additionally, both toggle paths must stay functionally equivalent for normal
 * (non-undefined) region values so that tapping a heatmap zone behaves the
 * same as tapping the pill for the same region.
 *
 * Checks:
 *  1. SOURCE — onSelect uses the prev-based toggle `r === prev ? null : (r ?? null)`
 *  2. SOURCE — BodyDiagram selected prop is wired to `painRegionFilter ?? undefined`
 *  3. SOURCE — onSelect is an inline arrow function (not a pre-bound ref that hides the toggle)
 *  4. LOGIC  — first tap sets region; second tap on same region clears to null
 *  5. LOGIC  — switching regions replaces (not stacks)
 *  6. LOGIC  — `r = undefined` (BodyDiagram deselect) always clears the filter
 *  7. PARITY — diagram toggle == pill toggle for all non-undefined region values
 *
 * Run:  node tests/body-diagram-filter.check.mjs
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

// ─── 1. SOURCE — prev-based toggle pattern ───────────────────────────────────
console.log('\n[1] Source — onSelect toggle uses the prev-based pattern');

const DIAGRAM_TOGGLE = 'r === prev ? null : (r ?? null)';

check(
  `onSelect toggle uses "${DIAGRAM_TOGGLE}"`,
  src.includes(DIAGRAM_TOGGLE),
  'pattern not found — second tap will no longer clear the filter, or the ' +
    'undefined-deselect path is broken'
);

// ─── 2. SOURCE — selected prop wired to painRegionFilter ─────────────────────
console.log('\n[2] Source — BodyDiagram selected prop wired to painRegionFilter');

const SELECTED_PROP = 'selected={painRegionFilter ?? undefined}';

check(
  `BodyDiagram selected prop is "${SELECTED_PROP}"`,
  src.includes(SELECTED_PROP),
  'BodyDiagram is not receiving the active filter — heatmap highlights will be wrong'
);

// ─── 3. SOURCE — BodyDiagram onSelect calls setPainRegionFilter inline ────────
console.log('\n[3] Source — BodyDiagram onSelect calls setPainRegionFilter inline (not a ref)');

// Anchor to the filter-heatmap BodyDiagram by its unique `selected` prop
// (`selected={painRegionFilter ?? undefined}`), then verify that
// `setPainRegionFilter` appears within the next 200 chars — i.e. in the next
// prop (`onSelect`). There are other BodyDiagram instances in the file that
// use different `selected` values, so this anchor is unambiguous.
const FILTER_DIAGRAM_ANCHOR = 'selected={painRegionFilter ?? undefined}';
const filterDiagramIdx = src.indexOf(FILTER_DIAGRAM_ANCHOR);
const setPainAfterDiagram =
  filterDiagramIdx !== -1 ? src.indexOf('setPainRegionFilter', filterDiagramIdx) : -1;

check(
  'filter BodyDiagram onSelect calls setPainRegionFilter inline (within 200 chars of selected prop)',
  filterDiagramIdx !== -1 &&
    setPainAfterDiagram !== -1 &&
    setPainAfterDiagram - filterDiagramIdx < 200,
  filterDiagramIdx === -1
    ? `"${FILTER_DIAGRAM_ANCHOR}" not found — BodyDiagram may have been removed or its selected prop changed`
    : 'setPainRegionFilter is not called within the filter BodyDiagram prop block — ' +
        'the toggle may be hidden in a pre-bound reference like onSelect={someCallback}'
);

// ─── 4–6. LOGIC — toggle state machine ───────────────────────────────────────
console.log('\n[4–6] Logic — BodyDiagram toggle state machine');

/**
 * Re-implements the BodyDiagram onSelect handler from workouts.tsx:
 *   setPainRegionFilter((prev) => (r === prev ? null : (r ?? null)))
 * where `r` is PainRegion | undefined.
 */
function diagramToggle(prev, r) {
  return r === prev ? null : (r ?? null);
}

// 4. First tap sets region; second tap on same region clears
let state = null;
state = diagramToggle(state, 'knee');
check(
  'first tap on "knee" zone sets painRegionFilter to "knee"',
  state === 'knee',
  `state = ${JSON.stringify(state)}, expected "knee"`
);

state = diagramToggle(state, 'knee');
check(
  'second tap on "knee" zone clears painRegionFilter to null',
  state === null,
  `state = ${JSON.stringify(state)}, expected null`
);

// 5. Switching regions replaces, not stacks
state = diagramToggle(null, 'knee');
state = diagramToggle(state, 'lower_back');
check(
  'tapping "lower_back" while "knee" is active replaces filter',
  state === 'lower_back',
  `state = ${JSON.stringify(state)}, expected "lower_back"`
);

state = diagramToggle(state, 'lower_back');
check(
  'tapping "lower_back" again after region-switch clears to null',
  state === null,
  `state = ${JSON.stringify(state)}, expected null`
);

// 6. r = undefined (BodyDiagram deselect signal) always clears the filter
state = diagramToggle('knee', undefined);
check(
  'r = undefined while "knee" is active clears the filter (deselect)',
  state === null,
  `state = ${JSON.stringify(state)}, expected null — ` +
    'BodyDiagram sends undefined to deselect; (undefined ?? null) must resolve to null'
);

state = diagramToggle(null, undefined);
check(
  'r = undefined while no region is active stays null',
  state === null,
  `state = ${JSON.stringify(state)}, expected null`
);

// ─── 7. PARITY — diagram toggle matches pill toggle for non-undefined values ──
console.log(
  '\n[7] Parity — diagram toggle is functionally equivalent to pill toggle for region values'
);

/**
 * Re-implements the pill onPainRegionPress toggle from workouts.tsx:
 *   setPainRegionFilter((prev) => (prev === region ? null : region))
 */
function pillToggle(prev, region) {
  return prev === region ? null : region;
}

const regions = ['knee', 'lower_back', 'shoulder_front', 'ankle', 'hip'];

let parityOk = true;
for (const region of regions) {
  // First tap from null
  if (diagramToggle(null, region) !== pillToggle(null, region)) {
    parityOk = false;
    break;
  }
  // Second tap (clear)
  if (diagramToggle(region, region) !== pillToggle(region, region)) {
    parityOk = false;
    break;
  }
  // Switch from a different region
  const other = regions.find((x) => x !== region);
  if (diagramToggle(other, region) !== pillToggle(other, region)) {
    parityOk = false;
    break;
  }
}

check(
  'diagram toggle produces the same result as pill toggle for all tested region values',
  parityOk,
  'the two toggle paths diverged — tapping the heatmap and tapping a pill ' +
    'for the same region would behave differently'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`body-diagram-filter: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`body-diagram-filter: all ${total} checks passed\n`);
  process.exit(0);
}
