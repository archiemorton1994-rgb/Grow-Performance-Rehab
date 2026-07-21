/**
 * Contract test: setDateFilter / setHistoryFilter / setSpecificDateFilter
 * resets only appear inside explicit user-action handlers, with one known
 * exception for setHistoryFilter(null).
 *
 * WHY THIS MATTERS
 * ────────────────
 * The History tab has four interdependent filter state variables:
 *   - dateFilter        (string)
 *   - historyFilter     (session-type string | null)
 *   - specificDateFilter (date string | null)
 *   - painRegionFilter  (region string | null)   ← guarded by pain-filter-reset-safety.check.mjs
 *
 * These are always cleared together in "clear all filters" Pressables and in
 * navigation callbacks (onNavigateToDate). If any of them drifts into a
 * useEffect body it can silently wipe an active filter whenever unrelated state
 * changes (e.g. a new session completing, the component remounting after a tab
 * switch, or the session list updating).
 *
 * KNOWN INTENTIONAL useEffect USAGE
 * ──────────────────────────────────
 * setHistoryFilter(null) appears ONCE inside a useEffect:
 *
 *   useEffect(() => {
 *     if (historyFilter && !completedSessions.some(s => s.sessionType === historyFilter)) {
 *       setHistoryFilter(null);   ← intentional stale-filter auto-clear
 *     }
 *   }, [historyFilter, completedSessions, setHistoryFilter]);
 *
 * This is a safe, intentional cleanup that removes a session-type filter whose
 * type has been fully deleted from history (edge case). It is the ONLY permitted
 * useEffect usage — this test explicitly checks the count is exactly 1 and that
 * the enclosing body contains the `completedSessions.some` stale-check pattern.
 *
 * Checks:
 *  1. COUNT  setDateFilter('all')       — exactly 3 call sites
 *  2. COUNT  setHistoryFilter(null)     — exactly 4 call sites
 *  3. COUNT  setSpecificDateFilter(null)— exactly 1 call site
 *  4. EFFECT setDateFilter('all')       — appears in 0 useEffect bodies
 *  5. EFFECT setHistoryFilter(null)     — appears in exactly 1 useEffect body
 *  6. EFFECT setHistoryFilter(null)     — that 1 useEffect is the stale-filter cleanup
 *  7. EFFECT setSpecificDateFilter(null)— appears in 0 useEffect bodies
 *  8. HANDLER setDateFilter('all') #1   — inside TrainingCalendarGrid onNavigateToDate
 *  9. HANDLER setDateFilter('all') #2   — inside "clear all filters" Pressable onPress
 * 10. HANDLER setDateFilter('all') #3   — inside MonthCalendar onNavigateToDate
 * 11. HANDLER setHistoryFilter(null) #2 — inside TrainingCalendarGrid onNavigateToDate
 * 12. HANDLER setHistoryFilter(null) #3 — inside "clear all filters" Pressable onPress
 * 13. HANDLER setHistoryFilter(null) #4 — inside MonthCalendar onNavigateToDate
 * 14. HANDLER setSpecificDateFilter(null) #1 — inside "clear all filters" Pressable onPress
 *
 * Run:  node tests/filter-reset-safety.check.mjs
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts every useEffect arrow-function body from source using brace-depth
 * counting. Returns an array of body strings (content between `{` and its
 * matching `}`). Handles both deps-array and no-deps forms.
 */
function extractUseEffectBodies(source) {
  const PATTERN = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{/g;
  const bodies = [];
  let match;
  while ((match = PATTERN.exec(source)) !== null) {
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let pos = bodyStart;
    while (pos < source.length && depth > 0) {
      if (source[pos] === '{') depth++;
      else if (source[pos] === '}') depth--;
      pos++;
    }
    bodies.push(source.slice(bodyStart, pos - 1));
  }
  return bodies;
}

/**
 * Returns the ~700-char window of source text immediately before the Nth
 * occurrence of `needle` (1-indexed). Returns null if not found.
 */
function windowBefore(source, needle, nth) {
  let idx = -1;
  for (let i = 0; i < nth; i++) {
    idx = source.indexOf(needle, idx + 1);
    if (idx === -1) return null;
  }
  return source.slice(Math.max(0, idx - 700), idx);
}

/**
 * Returns the ~300-char window of source text immediately after the Nth
 * occurrence of `needle` (1-indexed). Returns null if not found.
 */
function windowAfter(source, needle, nth) {
  let idx = -1;
  for (let i = 0; i < nth; i++) {
    idx = source.indexOf(needle, idx + 1);
    if (idx === -1) return null;
  }
  const end = idx + needle.length;
  return source.slice(end, Math.min(source.length, end + 300));
}

const useEffectBodies = extractUseEffectBodies(src);

// ─── 1–3. COUNT checks ───────────────────────────────────────────────────────
console.log('\n[1–3] Count — expected number of call sites');

const DATE_RESET = "setDateFilter('all')";
const HIST_RESET = 'setHistoryFilter(null)';
const SPEC_RESET = 'setSpecificDateFilter(null)';

const dateResetCount = src.split(DATE_RESET).length - 1;
const histResetCount = src.split(HIST_RESET).length - 1;
const specResetCount = src.split(SPEC_RESET).length - 1;

check(
  `setDateFilter('all') appears exactly 3 times (found ${dateResetCount})`,
  dateResetCount === 3,
  'call count changed — a reset path was added or removed; update this baseline if intentional'
);
check(
  `setHistoryFilter(null) appears exactly 4 times (found ${histResetCount})`,
  histResetCount === 4,
  'call count changed — a reset path was added or removed; update this baseline if intentional'
);
check(
  `setSpecificDateFilter(null) appears exactly 1 time (found ${specResetCount})`,
  specResetCount === 1,
  'call count changed — a reset path was added or removed; update this baseline if intentional'
);

// ─── 4–7. useEffect body checks ──────────────────────────────────────────────
console.log(
  `\n[4–7] useEffect bodies — filter resets in effects (${useEffectBodies.length} effects found)`
);

const effectsWithDateReset = useEffectBodies.filter((b) => b.includes(DATE_RESET));
const effectsWithHistReset = useEffectBodies.filter((b) => b.includes(HIST_RESET));
const effectsWithSpecReset = useEffectBodies.filter((b) => b.includes(SPEC_RESET));

check(
  `no useEffect body calls setDateFilter('all') (0 expected)`,
  effectsWithDateReset.length === 0,
  `${effectsWithDateReset.length} useEffect(s) call setDateFilter('all') — ` +
    'this would silently reset the date filter on every re-render that triggers the effect'
);

check(
  `exactly 1 useEffect body calls setHistoryFilter(null) (the intentional stale-filter cleanup)`,
  effectsWithHistReset.length === 1,
  effectsWithHistReset.length === 0
    ? 'the stale-filter cleanup useEffect is missing — was it accidentally removed?'
    : `${effectsWithHistReset.length} useEffect(s) call setHistoryFilter(null); ` +
        'only the stale-filter cleanup is permitted — remove the unexpected one(s)'
);

check(
  `the 1 permitted useEffect is the stale-filter cleanup (checks completedSessions.some)`,
  effectsWithHistReset.length === 1 && effectsWithHistReset[0].includes('completedSessions.some'),
  'the useEffect calling setHistoryFilter(null) does not contain the expected ' +
    '`completedSessions.some` stale-check — it may be a new, unintended effect'
);

check(
  `no useEffect body calls setSpecificDateFilter(null) (0 expected)`,
  effectsWithSpecReset.length === 0,
  `${effectsWithSpecReset.length} useEffect(s) call setSpecificDateFilter(null) — ` +
    'this would silently clear the date-jump filter on re-render'
);

// ─── 8–14. Handler checks ────────────────────────────────────────────────────
console.log('\n[8–14] Handler checks — each non-effect call site is inside an explicit callback');

// setDateFilter('all') — 3 occurrences, all inside navigation/clear handlers

const dw1 = windowBefore(src, DATE_RESET, 1);
check(
  "setDateFilter('all') #1: inside TrainingCalendarGrid onNavigateToDate",
  dw1 !== null && dw1.includes('onNavigateToDate') && dw1.includes('TrainingCalendarGrid'),
  "first setDateFilter('all') is not inside the TrainingCalendarGrid onNavigateToDate callback"
);

const dw2 = windowBefore(src, DATE_RESET, 2);
check(
  "setDateFilter('all') #2: inside 'clear all filters' Pressable onPress",
  dw2 !== null && dw2.includes('onPress') && dw2.includes('setHistoryFilter(null)'),
  "second setDateFilter('all') is not co-located with setHistoryFilter(null) in an onPress"
);

const dw3 = windowBefore(src, DATE_RESET, 3);
check(
  "setDateFilter('all') #3: inside MonthCalendar onNavigateToDate",
  dw3 !== null && dw3.includes('onNavigateToDate') && dw3.includes('MonthCalendar'),
  "third setDateFilter('all') is not inside the MonthCalendar onNavigateToDate callback"
);

// setHistoryFilter(null) — 4 occurrences; #1 is the useEffect stale-cleanup (no handler check
// needed there), so we check #2, #3, #4 which are the user-action handlers.

const hw2 = windowBefore(src, HIST_RESET, 2);
check(
  'setHistoryFilter(null) #2: inside TrainingCalendarGrid onNavigateToDate',
  hw2 !== null && hw2.includes('onNavigateToDate') && hw2.includes('TrainingCalendarGrid'),
  'second setHistoryFilter(null) is not inside the TrainingCalendarGrid onNavigateToDate callback'
);

// #3 is the FIRST statement in the clear-all onPress body, so setDateFilter('all')
// comes AFTER it — check onPress in the window before AND setDateFilter('all') after.
const hw3 = windowBefore(src, HIST_RESET, 3);
const hw3after = windowAfter(src, HIST_RESET, 3);
check(
  "setHistoryFilter(null) #3: inside 'clear all filters' Pressable onPress",
  hw3 !== null &&
    hw3after !== null &&
    hw3.includes('onPress') &&
    hw3after.includes("setDateFilter('all')"),
  'third setHistoryFilter(null) is not the first statement inside a clear-all onPress ' +
    "(expected onPress before it and setDateFilter('all') immediately after)"
);

const hw4 = windowBefore(src, HIST_RESET, 4);
check(
  'setHistoryFilter(null) #4: inside MonthCalendar onNavigateToDate',
  hw4 !== null && hw4.includes('onNavigateToDate') && hw4.includes('MonthCalendar'),
  'fourth setHistoryFilter(null) is not inside the MonthCalendar onNavigateToDate callback'
);

// setSpecificDateFilter(null) — 1 occurrence, in the clear-all Pressable

const sw1 = windowBefore(src, SPEC_RESET, 1);
check(
  "setSpecificDateFilter(null) #1: inside 'clear all filters' Pressable onPress",
  sw1 !== null && sw1.includes('onPress') && sw1.includes('setHistoryFilter(null)'),
  'setSpecificDateFilter(null) is not co-located with setHistoryFilter(null) in an onPress'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`filter-reset-safety: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`filter-reset-safety: all ${total} checks passed\n`);
  process.exit(0);
}
