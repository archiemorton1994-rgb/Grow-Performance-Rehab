/**
 * Contract test: there is ONE pain body diagram on the Stats tab, and it does
 * both jobs.
 *
 * WHAT THIS FILE USED TO SAY
 * ──────────────────────────
 * It asserted that there were exactly TWO pain heatmaps and policed the
 * difference between them: an overview diagram that respected the all-time /
 * recent toggle, and a filter diagram that had to ignore the toggle and always
 * show all-time counts — because filtering by a region with no recent pain
 * would have looked broken.
 *
 * That was a correct rule about a design that should not have existed. The two
 * diagrams were the same picture of the same body drawn twice, a scroll apart
 * on a tab the owner had already called crammed, with a button on the first one
 * whose only purpose was to do what the second one did.
 *
 * WHAT IT SAYS NOW
 * ────────────────
 * One diagram, one selection. Tapping a region shows that region's numbers AND
 * filters the session list below it. The original concern does not disappear —
 * it changes shape: with a single diagram, an empty "recent" view must not
 * strand the user with no way to clear a filter they can no longer see. That is
 * what the header subtitle and the shared toggle are for, and both are asserted
 * below.
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
  if (condition) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

const MODE_TERNARY = "painHeatmapMode === 'recent' ? recentPainCounts : painRegionCounts";

// ─── 1. One diagram ──────────────────────────────────────────────────────────
console.log('\n[1] The tab draws the body once');

// Counts every BodyDiagram fed by pain data. The muscle-progress heatmap is a
// different component and does not use these props.
const painDiagrams = [...src.matchAll(/heatmapCounts=\{[^}]*[Pp]ainCounts[^}]*\}/g)];
check(
  `exactly one pain heatmap (found ${painDiagrams.length})`,
  painDiagrams.length === 1,
  painDiagrams.length > 1
    ? 'two full body diagrams on one tab is the redundancy this merge removed'
    : 'the pain heatmap has gone entirely'
);
check(
  'and it respects the all-time / recent toggle',
  src.includes(MODE_TERNARY),
  'without the ternary the toggle is a no-op'
);
check(
  'the standalone filter panel is gone',
  !src.includes('{/* Pain Region Heatmap Filter */}'),
  'it existed only to set the filter the one remaining diagram now sets directly'
);

// ─── 2. One selection ────────────────────────────────────────────────────────
console.log('\n[2] Selecting a region and filtering by it are the same act');

check(
  'the diagram is driven by the filter state',
  /selected=\{painRegionFilter \?\? undefined\}/.test(src),
  'a separate highlight variable is how the two diagrams came to disagree'
);
check(
  'tapping a zone sets the filter',
  /onSelect=\{\(r\) => \{[\s\S]{0,200}?setPainRegionFilter\(\(prev\) => togglePainFilter\(prev, r\)\)/.test(
    src
  ),
  'togglePainFilter is shared with the pain pills, so the two ways of picking a region agree'
);
check(
  'the old second selection variable is gone',
  !/painOverviewSelected/.test(src),
  'two variables meaning "the selected region" is two things to keep in step'
);

// ─── 3. A filter you can always see and clear ────────────────────────────────
console.log('\n[3] An active filter is never invisible');

// This is the original concern in its new form. With one diagram, switching to
// "recent" can leave the selected zone unshaded — so the panel header has to
// state the active filter in words, and it has to do so even when collapsed.
check(
  'the panel header names the active region',
  /Showing \$\{BODY_DIAGRAM_LABELS\[painRegionFilter\]\} sessions/.test(src),
  'the header is the only part visible when the panel is collapsed'
);
check(
  'and says how to clear it',
  /tap the zone again to clear/.test(src),
  ''
);
check(
  'switching to the recent view clears the filter rather than orphaning it',
  /setPainHeatmapMode\(mode\);\s*\n\s*setPainRegionFilter\(null\);/.test(src),
  'a filter whose zone is unshaded in the current view is a filter the user cannot find to clear'
);
check(
  'the panel is open by default',
  /const \[painPatternsExpanded, setPainPatternsExpanded\] = useState\(true\)/.test(src),
  'it is the filter control now, and a filter you have to go looking for is a filter nobody uses'
);

console.log('');
if (failures > 0) {
  console.error(`pain-filter-heatmap-alltime: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`pain-filter-heatmap-alltime: all ${total} checks passed\n`);
  process.exit(0);
}
