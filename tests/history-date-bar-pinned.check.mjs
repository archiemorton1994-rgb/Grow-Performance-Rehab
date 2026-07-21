/**
 * Contract test: History tab date-filter bar stays pinned OUTSIDE the scroll container.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The History tab renders a date-filter pill row (All / This Week / This Month)
 * that must stay fixed above the scrollable session list. It was previously moved
 * from inside the ScrollView to a pinned bar above it. This test preserves that
 * structural decision: if a future refactor accidentally nests `historyDateBar`
 * back inside the ScrollView (or replaces it with a FlatList and nests the bar
 * inside that), these checks will fail immediately.
 *
 * WHAT IS CHECKED
 * ───────────────
 *  1. MARKER        — the `historyDateBar` style marker exists in the History tab section
 *  2. ORDER (SV)    — `historyDateBar` appears BEFORE the first `<ScrollView` in that section
 *  3. OUTSIDE (SV)  — no `<ScrollView` open-tag appears between the history section start
 *                     and the `historyDateBar` (the bar is not nested inside a ScrollView)
 *  4. ORDER (FL)    — if a `<FlatList` exists in the section, `historyDateBar` appears before it
 *  5. OUTSIDE (FL)  — no `<FlatList` open-tag appears between the history section start
 *                     and the `historyDateBar` (the bar is not nested inside a FlatList)
 *  6–8. PILLS       — all three date-option values ('all', 'this_week', 'this_month') are
 *                     present inside the date bar block (before whichever scroll container
 *                     opens first — ScrollView or FlatList)
 *
 * Run:  node tests/history-date-bar-pinned.check.mjs
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
const HISTORY_SECTION_MARKER = '/* HISTORY TAB */';
const DATE_BAR_MARKER = 'historyDateBar';
const SCROLLVIEW_OPEN = '<ScrollView';
const FLATLIST_OPEN = '<FlatList';

const historySectionIdx = src.indexOf(HISTORY_SECTION_MARKER);
const dateBarIdx = src.indexOf(DATE_BAR_MARKER);

// First <ScrollView / <FlatList that follows the history section start
const scrollViewAfterHistoryIdx = src.indexOf(SCROLLVIEW_OPEN, historySectionIdx);
const flatListAfterHistoryIdx = src.indexOf(FLATLIST_OPEN, historySectionIdx);

// Slice between section start and date bar (used to detect nested containers)
const betweenHistoryAndBar =
  historySectionIdx !== -1 && dateBarIdx !== -1 ? src.slice(historySectionIdx, dateBarIdx) : '';

// The "bar block" is the source between the date bar marker and whichever scroll
// container opens first (ScrollView or FlatList). Pills must live in this block.
const firstScrollContainerIdx = (() => {
  const sv = scrollViewAfterHistoryIdx !== -1 ? scrollViewAfterHistoryIdx : Infinity;
  const fl = flatListAfterHistoryIdx !== -1 ? flatListAfterHistoryIdx : Infinity;
  const first = Math.min(sv, fl);
  return first === Infinity ? -1 : first;
})();

const barBlock =
  dateBarIdx !== -1 && firstScrollContainerIdx !== -1
    ? src.slice(dateBarIdx, firstScrollContainerIdx)
    : '';

// ─── Checks ───────────────────────────────────────────────────────────────────
console.log('\n[1] History date-bar marker');

// 1. The historyDateBar style marker must exist inside the history section.
check(
  `"${DATE_BAR_MARKER}" style marker found after history section start`,
  dateBarIdx !== -1 && dateBarIdx > historySectionIdx,
  '"historyDateBar" was not found after the HISTORY TAB comment — ' +
    'the pinned bar may have been removed or renamed'
);

console.log('\n[2–3] ScrollView structural checks');

// 2. historyDateBar must appear BEFORE the first <ScrollView in the history section.
check(
  `"${DATE_BAR_MARKER}" appears before the first <ScrollView in the history section`,
  historySectionIdx !== -1 &&
    dateBarIdx !== -1 &&
    scrollViewAfterHistoryIdx !== -1 &&
    dateBarIdx < scrollViewAfterHistoryIdx,
  '"historyDateBar" is positioned after (or inside) the first <ScrollView in the history ' +
    'section — the date filter has been moved back inside the scroll; it must be pinned above it'
);

// 3. No <ScrollView opens between the history section start and historyDateBar.
const scrollViewsBeforeBar = (betweenHistoryAndBar.match(/<ScrollView/g) || []).length;
check(
  'no <ScrollView opens between the history section start and the date bar',
  scrollViewsBeforeBar === 0,
  `${scrollViewsBeforeBar} <ScrollView open-tag(s) found before "historyDateBar" inside the ` +
    'history section — the date filter bar is nested inside a ScrollView and will scroll ' +
    'away instead of staying pinned'
);

console.log('\n[4–5] FlatList structural checks');

// 4. If a <FlatList exists after the history section, historyDateBar must appear before it.
//    (Guard against the ScrollView being replaced by a FlatList with the bar nested inside.)
const flatListExists = flatListAfterHistoryIdx !== -1;
check(
  flatListExists
    ? `"${DATE_BAR_MARKER}" appears before the first <FlatList in the history section`
    : `no <FlatList present in history section (check is a no-op pass)`,
  !flatListExists || (dateBarIdx !== -1 && dateBarIdx < flatListAfterHistoryIdx),
  '"historyDateBar" is positioned after (or inside) the first <FlatList in the history ' +
    'section — if ScrollView was replaced by FlatList the date bar must remain pinned above it'
);

// 5. No <FlatList opens between the history section start and historyDateBar.
const flatListsBeforeBar = (betweenHistoryAndBar.match(/<FlatList/g) || []).length;
check(
  'no <FlatList opens between the history section start and the date bar',
  flatListsBeforeBar === 0,
  `${flatListsBeforeBar} <FlatList open-tag(s) found before "historyDateBar" inside the ` +
    'history section — the date filter bar is nested inside a FlatList and will scroll ' +
    'away instead of staying pinned'
);

console.log('\n[6–8] Filter pill values present in pinned bar block');

// 6–8. All three filter pill values appear inside the bar block (between historyDateBar
//      and whichever scroll container opens first).
const EXPECTED_PILLS = ["'all'", "'this_week'", "'this_month'"];
for (const pill of EXPECTED_PILLS) {
  check(
    `Date-filter pill option ${pill} is present in the bar block (before the scroll container)`,
    barBlock.includes(pill),
    `Option ${pill} was not found between "historyDateBar" and the first scroll container — ` +
      'a filter pill may have been moved inside the scroll or the option value was renamed'
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`history-date-bar-pinned: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`history-date-bar-pinned: all ${total} checks passed\n`);
  process.exit(0);
}
