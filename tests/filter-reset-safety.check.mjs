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
 * Parser self-tests (run before the real checks):
 *   S1. Block-body useEffect is detected.
 *   S2. Async block-body useEffect is detected.
 *   S3. Concise-arrow useEffect is detected (closes the one-liner loophole).
 *   S4. A clean useEffect does not produce a false positive.
 *
 * Real checks:
 *  1. COUNT  setDateFilter('all')       — exactly 2 call sites
 *  2. COUNT  setHistoryFilter(null)     — exactly 3 call sites
 *  3. COUNT  setSpecificDateFilter(null)— exactly 1 call site
 *  4. EFFECT setDateFilter('all')       — appears in 0 useEffect bodies
 *  5. EFFECT setHistoryFilter(null)     — appears in exactly 1 useEffect body
 *  6. EFFECT setHistoryFilter(null)     — that 1 useEffect is the stale-filter cleanup
 *  7. EFFECT setSpecificDateFilter(null)— appears in 0 useEffect bodies
 *  8. HANDLER setDateFilter('all') #1   — inside "clear all filters" Pressable onPress
 *  9. HANDLER setDateFilter('all') #2   — inside MonthCalendar onNavigateToDate
 * 10. HANDLER setHistoryFilter(null) #2 — inside "clear all filters" Pressable onPress
 * 11. HANDLER setHistoryFilter(null) #3 — inside MonthCalendar onNavigateToDate
 * 12. HANDLER setSpecificDateFilter(null) #1 — inside "clear all filters" Pressable onPress
 *
 * Run:  node tests/filter-reset-safety.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractUseEffectBodies } from './helpers/extract-use-effect-bodies.mjs';

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

// ─── Parser self-tests ────────────────────────────────────────────────────────
// Run before the real checks so a broken parser fails loudly rather than
// silently producing false-green results on the real file.
console.log('\n[S1–S5b] Parser self-tests — extractUseEffectBodies catches all four forms');

const NEEDLE = '__SENTINEL_CALL__()';

const blockBodies = extractUseEffectBodies(`useEffect(() => { ${NEEDLE}; }, [deps])`);
check(
  'S1: block-body useEffect body is extracted',
  blockBodies.length === 1 && blockBodies[0].includes(NEEDLE),
  'block body not detected — the parser is broken for standard block-body effects'
);

const asyncBodies = extractUseEffectBodies(`useEffect(async () => { ${NEEDLE}; }, [deps])`);
check(
  'S2: async block-body useEffect body is extracted',
  asyncBodies.length === 1 && asyncBodies[0].includes(NEEDLE),
  'async block body not detected — useEffect(async () => { ... }) violations would be missed'
);

const conciseBodies = extractUseEffectBodies(`useEffect(() => ${NEEDLE}, [deps])`);
check(
  'S3: concise-arrow useEffect body is extracted (one-liner loophole closed)',
  conciseBodies.length === 1 && conciseBodies[0].includes(NEEDLE),
  'concise arrow body not detected — a one-liner like ' +
    '`useEffect(() => setHistoryFilter(null), [deps])` would pass undetected'
);

const cleanBodies = extractUseEffectBodies(`useEffect(() => { doOtherThing(); }, [deps])`);
check(
  'S4: clean useEffect body does not produce a false positive',
  cleanBodies.length === 1 && !cleanBodies[0].includes(NEEDLE),
  'clean useEffect body incorrectly contains the sentinel — parser has a false-positive bug'
);

const anonFuncBodies = extractUseEffectBodies(`useEffect(function () { ${NEEDLE}; }, [deps])`);
check(
  'S5: anonymous function-expression useEffect body is extracted',
  anonFuncBodies.length === 1 && anonFuncBodies[0].includes(NEEDLE),
  'anonymous function-expression body not detected — ' +
    '`useEffect(function() { setHistoryFilter(null); })` violations would be missed'
);

const namedFuncBodies = extractUseEffectBodies(
  `useEffect(function myEffect() { ${NEEDLE}; }, [deps])`
);
check(
  'S5b: named function-expression useEffect body is extracted',
  namedFuncBodies.length === 1 && namedFuncBodies[0].includes(NEEDLE),
  'named function-expression body not detected — ' +
    '`useEffect(function myEffect() { setHistoryFilter(null); })` violations would be missed'
);

// ─── Real file checks ─────────────────────────────────────────────────────────
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
  `setDateFilter('all') appears exactly 2 times (found ${dateResetCount})`,
  dateResetCount === 2,
  'call count changed — a reset path was added or removed; update this baseline if intentional'
);
check(
  `setHistoryFilter(null) appears exactly 3 times (found ${histResetCount})`,
  histResetCount === 3,
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

// ─── 8–12. Handler checks ────────────────────────────────────────────────────
console.log('\n[8–12] Handler checks — each non-effect call site is inside an explicit callback');

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

// setDateFilter('all') — 2 occurrences, all inside navigation/clear handlers

const dw1 = windowBefore(src, DATE_RESET, 1);
check(
  "setDateFilter('all') #1: inside 'clear all filters' Pressable onPress",
  dw1 !== null && dw1.includes('onPress') && dw1.includes('setHistoryFilter(null)'),
  "first setDateFilter('all') is not co-located with setHistoryFilter(null) in an onPress"
);

const dw2 = windowBefore(src, DATE_RESET, 2);
check(
  "setDateFilter('all') #2: inside MonthCalendar onNavigateToDate",
  dw2 !== null && dw2.includes('onNavigateToDate') && dw2.includes('MonthCalendar'),
  "second setDateFilter('all') is not inside the MonthCalendar onNavigateToDate callback"
);

// setHistoryFilter(null) — 3 occurrences; #1 is the useEffect stale-cleanup (no handler check
// needed there), so we check #2, #3 which are the user-action handlers.

// #2 is the FIRST statement in the clear-all onPress body, so setDateFilter('all')
// comes AFTER it — check onPress in the window before AND setDateFilter('all') after.
const hw2 = windowBefore(src, HIST_RESET, 2);
const hw2after = windowAfter(src, HIST_RESET, 2);
check(
  "setHistoryFilter(null) #2: inside 'clear all filters' Pressable onPress",
  hw2 !== null &&
    hw2after !== null &&
    hw2.includes('onPress') &&
    hw2after.includes("setDateFilter('all')"),
  'second setHistoryFilter(null) is not the first statement inside a clear-all onPress ' +
    "(expected onPress before it and setDateFilter('all') immediately after)"
);

const hw3 = windowBefore(src, HIST_RESET, 3);
check(
  'setHistoryFilter(null) #3: inside MonthCalendar onNavigateToDate',
  hw3 !== null && hw3.includes('onNavigateToDate') && hw3.includes('MonthCalendar'),
  'third setHistoryFilter(null) is not inside the MonthCalendar onNavigateToDate callback'
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
  process.exitCode = 1;
} else {
  console.log(`filter-reset-safety: all ${total} checks passed\n`);
  process.exitCode = 0;
}
