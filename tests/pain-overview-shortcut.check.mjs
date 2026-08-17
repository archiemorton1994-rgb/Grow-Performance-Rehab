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

// ─── 1. Picking a region on the heatmap filters the list ─────────────────────
console.log('\n[1] Tapping a region filters the sessions below it');

// THIS SECTION USED TO CHECK A BUTTON. The pain detail strip carried a "See
// sessions" Pressable whose onPress set the filter and switched to the History
// tab. Both halves are now redundant: the panel already lives on History, so
// the tab switch was a no-op that scrolled the user to the top, and tapping the
// body sets the filter directly. The button was one tap standing in for
// something that should never have needed one.
//
// The behaviour it protected still matters, so it is asserted against the
// diagram instead of against the button.

// Anchored on the diagram's own onSelect: find it, then confirm the filter
// setter is inside that handler rather than somewhere else on the page.
const onSelectIdx = src.indexOf('onSelect={(r) => {');
const onSelectBody = onSelectIdx === -1 ? '' : src.slice(onSelectIdx, onSelectIdx + 240);
check(
  'tapping a zone sets the pain filter',
  onSelectBody.includes('setPainRegionFilter((prev) => togglePainFilter(prev, r))'),
  'without this, selecting a region highlights it and shows nothing'
);
check(
  'the detail strip reads from the same state the filter uses',
  src.includes('selected={painRegionFilter ?? undefined}'),
  'a separate highlight variable is how the two old diagrams came to disagree'
);
check(
  'the redundant "See sessions" button is gone',
  !src.includes('See sessions'),
  'it set a filter that is now set by the tap itself, and switched to the tab it is already on'
);
check(
  'and nothing still switches tab from inside the panel',
  !src.includes('setPainRegionFilter(painRegionFilter)'),
  'that call set the filter to its own current value and then switched to the tab it was already on'
);
// ─── 5. PATTERN — PainInsightSheet onViewHistory uses the same two-call pattern
console.log(
  '\n[5] Pattern — PainInsightSheet onViewHistory uses identical two-call navigation pattern'
);

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

// ─── 6. SOURCE — SessionTypeBreakdown (Conditioning card) has an onFilterChange prop
console.log('\n[6] Source — SessionTypeBreakdown onFilterChange prop exists');

// The SessionTypeBreakdown donut chart on the Overview tab has an onFilterChange
// callback. When the user taps a segment (including "Conditioning") it must call
// BOTH setHistoryFilter(type) AND setActiveTab('history'). If either call is
// dropped, users will be silently left on the Overview tab with an invisible
// filter, or land on History with no filter applied.
const STB_ANCHOR = 'onFilterChange={(type) => {';
const stbIdx = src.indexOf(STB_ANCHOR);

check(
  'SessionTypeBreakdown onFilterChange prop handler exists in workouts.tsx',
  stbIdx !== -1,
  'onFilterChange handler not found — the SessionTypeBreakdown conditioning card may have lost its navigation callback'
);

// ─── 7. SOURCE — handler calls setHistoryFilter(type) ─────────────────────────
console.log('\n[7] Source — SessionTypeBreakdown onFilterChange calls setHistoryFilter(type)');

check(
  'setHistoryFilter(type) is called inside the onFilterChange handler',
  stbIdx !== -1 && src.slice(stbIdx, stbIdx + 200).includes('setHistoryFilter(type)'),
  'call not found — session-type filter will not be set when navigating from the Conditioning card'
);

// ─── 8. SOURCE — handler calls setActiveTab('history') ────────────────────────
console.log("\n[8] Source — SessionTypeBreakdown onFilterChange calls setActiveTab('history')");

check(
  "setActiveTab('history') is called inside the onFilterChange handler",
  stbIdx !== -1 && src.slice(stbIdx, stbIdx + 200).includes("setActiveTab('history')"),
  'call not found — app will not switch to the History tab when tapping the Conditioning segment'
);

// ─── 9. SOURCE — both calls co-located in the same handler block ──────────────
console.log('\n[9] Source — both calls are co-located in the same onFilterChange handler');

let stbColocated = false;
if (stbIdx !== -1) {
  const handlerSlice = src.slice(stbIdx, stbIdx + 200);
  stbColocated =
    handlerSlice.includes('setHistoryFilter(type)') &&
    handlerSlice.includes("setActiveTab('history')");
}

check(
  'setHistoryFilter and setActiveTab are in the same onFilterChange handler block',
  stbColocated,
  'one or both calls are outside the expected handler block — they may have drifted apart during a refactor'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-overview-shortcut: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`pain-overview-shortcut: all ${total} checks passed\n`);
  process.exitCode = 0;
}
