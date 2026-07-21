/**
 * Contract test: History tab date-filter bar stays pinned OUTSIDE the scroll container.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The History tab renders a date-filter pill row (All / This Week / This Month)
 * that must stay fixed above the scrollable session list. It was previously moved
 * from inside the ScrollView to a pinned bar above it. This test preserves that
 * structural decision: if a future refactor accidentally nests `historyDateBar`
 * back inside any scroll-capable container — ScrollView, FlatList, SectionList,
 * or VirtualizedList — these checks will fail immediately.
 *
 * WHAT IS CHECKED
 * ───────────────
 *  1.  MARKER           — `historyDateBar` style marker exists after history section anchor
 *  2.  ORDER (SV)       — `historyDateBar` appears BEFORE the first `<ScrollView`
 *  3.  OUTSIDE (SV)     — no `<ScrollView` opens between section start and date bar
 *  4.  ORDER (FL)       — if `<FlatList` exists, `historyDateBar` appears before it
 *  5.  OUTSIDE (FL)     — no `<FlatList` opens between section start and date bar
 *  6.  ORDER (SL)       — if `<SectionList` exists, `historyDateBar` appears before it
 *  7.  OUTSIDE (SL)     — no `<SectionList` opens between section start and date bar
 *  8.  ORDER (VL)       — if `<VirtualizedList` exists, `historyDateBar` appears before it
 *  9.  OUTSIDE (VL)     — no `<VirtualizedList` opens between section start and date bar
 *  10–12. PILLS         — all three date-option values ('all', 'this_week', 'this_month')
 *                         present before whichever scroll container opens first
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

// All React Native scroll-capable containers that could nest the date bar
const CONTAINERS = [
  { tag: '<ScrollView', label: 'ScrollView' },
  { tag: '<FlatList', label: 'FlatList' },
  { tag: '<SectionList', label: 'SectionList' },
  { tag: '<VirtualizedList', label: 'VirtualizedList' },
];

const historySectionIdx = src.indexOf(HISTORY_SECTION_MARKER);
const dateBarIdx = src.indexOf(DATE_BAR_MARKER);

// Slice between section start and date bar — used to detect containers before the bar
const betweenHistoryAndBar =
  historySectionIdx !== -1 && dateBarIdx !== -1 ? src.slice(historySectionIdx, dateBarIdx) : '';

// First occurrence of each container after the history section start
const containerIndices = CONTAINERS.map(({ tag, label }) => ({
  tag,
  label,
  idx: src.indexOf(tag, historySectionIdx),
}));

// Pill-block boundary: earliest scroll container that follows the date bar
const firstContainerAfterBarIdx = (() => {
  const candidates = containerIndices
    .map(({ idx }) => idx)
    .filter((idx) => idx !== -1 && dateBarIdx !== -1 && idx > dateBarIdx);
  return candidates.length > 0 ? Math.min(...candidates) : -1;
})();

const barBlock =
  dateBarIdx !== -1 && firstContainerAfterBarIdx !== -1
    ? src.slice(dateBarIdx, firstContainerAfterBarIdx)
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

// ─── Per-container order + nesting checks ────────────────────────────────────
const containerCheckMap = [
  { label: 'ScrollView', checkNum: '2–3', required: true },
  { label: 'FlatList', checkNum: '4–5', required: false },
  { label: 'SectionList', checkNum: '6–7', required: false },
  { label: 'VirtualizedList', checkNum: '8–9', required: false },
];

for (const { label, checkNum, required } of containerCheckMap) {
  const tag = `<${label}`;
  const containerIdx = src.indexOf(tag, historySectionIdx);
  const containerExists = containerIdx !== -1;
  const countBeforeBar = (betweenHistoryAndBar.match(new RegExp(tag.replace('<', '<'), 'g')) || [])
    .length;

  console.log(`\n[${checkNum}] ${label} structural checks`);

  // ORDER check: date bar must appear before this container (if it exists; required for SV)
  if (required) {
    check(
      `"${DATE_BAR_MARKER}" appears before the first <${label} in the history section`,
      historySectionIdx !== -1 &&
        dateBarIdx !== -1 &&
        containerIdx !== -1 &&
        dateBarIdx < containerIdx,
      `"historyDateBar" is positioned after (or inside) the first <${label} — ` +
        'the date filter has been moved back inside the scroll; it must be pinned above it'
    );
  } else {
    check(
      containerExists
        ? `"${DATE_BAR_MARKER}" appears before the first <${label} in the history section`
        : `no <${label} present in history section (check is a no-op pass)`,
      !containerExists || (dateBarIdx !== -1 && dateBarIdx < containerIdx),
      `"historyDateBar" is positioned after (or inside) the first <${label} — ` +
        `if <${label} replaces the existing scroll container the date bar must remain pinned above it`
    );
  }

  // OUTSIDE check: no instance of this container must appear before the date bar
  check(
    `no <${label} opens between the history section start and the date bar`,
    countBeforeBar === 0,
    `${countBeforeBar} <${label} open-tag(s) found before "historyDateBar" inside the ` +
      `history section — the date filter bar is nested inside a ${label} and will scroll away`
  );
}

// ─── Filter pill values ───────────────────────────────────────────────────────
console.log('\n[10–12] Filter pill values present in pinned bar block');

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
