/**
 * Contract test: Overview pain shortcut navigates to filtered History.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The Overview tab's pain detail strip contains a "See sessions" Pressable.
 * When tapped it must call BOTH setPainRegionFilter(painOverviewSelected) AND
 * setActiveTab('history') inside the same onPress handler. If either call is
 * dropped, users will be silently left on the Overview tab with an invisible
 * filter, or land on History with no filter applied.
 *
 * A secondary risk is that the handler starts using a different variable
 * (e.g. a hardcoded string, or the wrong state variable) instead of
 * painOverviewSelected, which would navigate with the wrong filter value.
 *
 * Checks:
 *  1. SOURCE — "See sessions" Pressable exists in the source
 *  2. SOURCE — onPress handler calls setPainRegionFilter(painOverviewSelected)
 *  3. SOURCE — onPress handler calls setActiveTab('history') in the same block
 *  4. SOURCE — both calls appear together (same arrow-function body, no gap)
 *  5. PATTERN — navigation pattern matches the heatmap card's own path
 *
 * Run:  node tests/pain-overview-shortcut.check.mjs
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

// ─── 1. SOURCE — "See sessions" label exists ──────────────────────────────────
console.log('\n[1] Source — "See sessions" Pressable exists');

check(
  '"See sessions" text exists in workouts.tsx',
  src.includes('See sessions'),
  'label not found — button may have been removed or renamed'
);

// ─── 2. SOURCE — handler calls setPainRegionFilter(painOverviewSelected) ──────
console.log('\n[2] Source — onPress calls setPainRegionFilter(painOverviewSelected)');

check(
  'setPainRegionFilter(painOverviewSelected) is called',
  src.includes('setPainRegionFilter(painOverviewSelected)'),
  'call not found — filter will not be set when navigating from Overview'
);

// ─── 3. SOURCE — handler calls setActiveTab("history") ────────────────────────
console.log('\n[3] Source — onPress calls setActiveTab("history")');

check(
  "setActiveTab('history') is called",
  src.includes("setActiveTab('history')"),
  "call not found — app will not switch to the History tab"
);

// ─── 4. SOURCE — both calls appear together in the same handler block ──────────
console.log('\n[4] Source — both calls are co-located in the same handler');

// Find the index of the "See sessions" text, then look backwards for the
// nearest onPress arrow-function open-brace and verify both setter calls
// appear before the matching close-brace.
const SEE_SESSIONS_LABEL = 'See sessions';
const labelIdx = src.indexOf(SEE_SESSIONS_LABEL);

let colocated = false;
if (labelIdx !== -1) {
  // Walk backwards to find the nearest `onPress={() => {` opening
  const beforeLabel = src.slice(0, labelIdx);
  const onPressIdx = beforeLabel.lastIndexOf('onPress={() => {');
  if (onPressIdx !== -1) {
    // The handler body is between onPressIdx and the first `}}` after it
    const handlerSlice = src.slice(onPressIdx, labelIdx);
    colocated =
      handlerSlice.includes('setPainRegionFilter(painOverviewSelected)') &&
      handlerSlice.includes("setActiveTab('history')");
  }
}

check(
  'setPainRegionFilter and setActiveTab are in the same onPress handler as "See sessions"',
  colocated,
  'one or both calls are outside the expected handler block — they may have drifted apart'
);

// ─── 5. PATTERN — PainInsightSheet onViewHistory uses the same two-call pattern
console.log('\n[5] Pattern — PainInsightSheet onViewHistory uses identical two-call navigation pattern');

// The PainInsightSheet "onViewHistory" callback (workouts.tsx ~line 4927-4931)
// is the other explicit pain-filter navigation path. Locate it by its signal
// anchor (onViewHistory) and verify both setter calls appear before the closing
// brace of that callback.
const OVH_ANCHOR = 'onViewHistory={(region) => {';
const ovhIdx = src.indexOf(OVH_ANCHOR);
let heatmapColocated = false;
if (ovhIdx !== -1) {
  // Grab the block from the anchor up to the first `}}` that closes it
  const blockSlice = src.slice(ovhIdx, ovhIdx + 300);
  heatmapColocated =
    blockSlice.includes('setPainRegionFilter(region)') &&
    blockSlice.includes("setActiveTab('history')");
}

check(
  'PainInsightSheet onViewHistory calls setPainRegionFilter(region) + setActiveTab("history") together',
  heatmapColocated,
  'one or both calls are missing from the onViewHistory callback — the heatmap card navigation path has diverged'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-overview-shortcut: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`pain-overview-shortcut: all ${total} checks passed\n`);
  process.exit(0);
}
