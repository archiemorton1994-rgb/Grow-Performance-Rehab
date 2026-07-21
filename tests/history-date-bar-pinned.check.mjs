/**
 * Contract test: History tab date-filter bar stays pinned OUTSIDE the ScrollView.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The History tab renders a date-filter pill row (All / This Week / This Month)
 * that must stay fixed above the scrollable session list. It was previously moved
 * from inside the ScrollView to a pinned bar above it. This test preserves that
 * structural decision: if a future refactor accidentally nests `historyDateBar`
 * back inside the ScrollView, this check will fail immediately.
 *
 * WHAT IS CHECKED
 * ───────────────
 *  1. MARKER  — the `historyDateBar` style marker exists in the History tab section
 *  2. ORDER   — `historyDateBar` appears BEFORE the first `<ScrollView` in that section
 *  3. OUTSIDE — no `<ScrollView` open-tag appears between the history section start
 *               and the `historyDateBar` (the bar is not nested inside a scroll)
 *  4. PILLS   — all three date-option values ('all', 'this_week', 'this_month') are
 *               present inside the date bar block (before the ScrollView opens)
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
// The history tab block starts at the comment "HISTORY TAB".
const HISTORY_SECTION_MARKER = '/* HISTORY TAB */';
const DATE_BAR_MARKER = 'historyDateBar';
const SCROLLVIEW_OPEN = '<ScrollView';

const historySectionIdx = src.indexOf(HISTORY_SECTION_MARKER);
const dateBarIdx = src.indexOf(DATE_BAR_MARKER);
// First <ScrollView that follows the history section start
const scrollViewAfterHistoryIdx = src.indexOf(SCROLLVIEW_OPEN, historySectionIdx);

// ─── Checks ───────────────────────────────────────────────────────────────────
console.log('\n[1–4] History date-bar structural position checks');

// 1. The history section marker must exist so the rest of the checks are meaningful.
check(
  `History tab section marker ("${HISTORY_SECTION_MARKER}") found in source`,
  historySectionIdx !== -1,
  'history section anchor comment was removed or renamed — update this test if intentional'
);

// 2. The historyDateBar style marker must exist inside the history section.
check(
  `"${DATE_BAR_MARKER}" style marker found in history section`,
  dateBarIdx !== -1 && dateBarIdx > historySectionIdx,
  '"historyDateBar" was not found after the HISTORY TAB comment — ' +
    'the pinned bar may have been removed or renamed'
);

// 3. historyDateBar must appear BEFORE the first <ScrollView in the history section.
check(
  `"${DATE_BAR_MARKER}" appears before the first <ScrollView in the history section`,
  historySectionIdx !== -1 &&
    dateBarIdx !== -1 &&
    scrollViewAfterHistoryIdx !== -1 &&
    dateBarIdx < scrollViewAfterHistoryIdx,
  '"historyDateBar" is positioned after (or inside) the first <ScrollView in the history ' +
    'section — the date filter has been moved back inside the scroll; it must be pinned above it'
);

// 4. No <ScrollView opens between the history section start and the historyDateBar.
//    This confirms the bar is not nested inside a scroll container.
const betweenHistoryAndBar =
  historySectionIdx !== -1 && dateBarIdx !== -1 ? src.slice(historySectionIdx, dateBarIdx) : '';
const scrollViewsBeforeBar = (betweenHistoryAndBar.match(/<ScrollView/g) || []).length;
check(
  'no <ScrollView opens between the history section start and the date bar (bar is not nested)',
  scrollViewsBeforeBar === 0,
  `${scrollViewsBeforeBar} <ScrollView open-tag(s) found before "historyDateBar" inside the ` +
    'history section — the date filter bar is nested inside a scroll container and will scroll ' +
    'away instead of staying pinned'
);

// 5. All three filter pill values appear inside the date bar block (between
//    historyDateBar and the following <ScrollView).
const barBlock =
  dateBarIdx !== -1 && scrollViewAfterHistoryIdx !== -1
    ? src.slice(dateBarIdx, scrollViewAfterHistoryIdx)
    : '';

const EXPECTED_PILLS = ["'all'", "'this_week'", "'this_month'"];
for (const pill of EXPECTED_PILLS) {
  check(
    `Date-filter pill option ${pill} is present in the bar block (before the ScrollView)`,
    barBlock.includes(pill),
    `Option ${pill} was not found between "historyDateBar" and the first <ScrollView — ` +
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
