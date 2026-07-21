/**
 * Contract test: setPainRegionFilter(null) is never called from a useEffect body.
 *
 * WHY THIS MATTERS
 * ────────────────
 * painRegionFilter is set when users navigate from the Overview tab or tap a
 * history pill. A stale useEffect that references setPainRegionFilter(null)
 * could silently wipe the filter whenever unrelated state changes — e.g. when
 * the user navigates back to the History tab, when session data updates, or
 * when the component re-renders after a tab switch.
 *
 * This test guards against three failure modes:
 *   A. setPainRegionFilter(null) is added to a new or existing useEffect body.
 *   B. setPainRegionFilter (any call) is added to a useEffect body.
 *   C. The number of setPainRegionFilter(null) call sites changes unexpectedly
 *      (signals an accidental addition or removal of a reset path).
 *
 * Parser self-tests (run before the real checks):
 *   S1. Block-body useEffect is detected.
 *   S2. Async block-body useEffect is detected.
 *   S3. Concise-arrow useEffect is detected (closes the one-liner loophole).
 *   S4. A clean useEffect does not produce a false positive.
 *
 * Real checks:
 *  1. COUNT      — exactly 4 setPainRegionFilter(null) occurrences (baseline)
 *  2. USE-EFFECT — no useEffect body in workouts.tsx contains setPainRegionFilter(null)
 *  3. USE-EFFECT — no useEffect body in workouts.tsx contains setPainRegionFilter at all
 *  4. HANDLER #1 — TrainingCalendarGrid onNavigateToDate clears the filter inside its callback
 *  5. HANDLER #2 — "clear all filters" Pressable onPress clears the filter inside its callback
 *  6. HANDLER #3 — heatmap clear button onPress calls only setPainRegionFilter(null) inline
 *  7. HANDLER #4 — MonthCalendar onNavigateToDate clears the filter inside its callback
 *
 * Run:  node tests/pain-filter-reset-safety.check.mjs
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
    '`useEffect(() => setPainRegionFilter(null), [deps])` would pass undetected'
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
    '`useEffect(function() { setPainRegionFilter(null); })` violations would be missed'
);

const namedFuncBodies = extractUseEffectBodies(
  `useEffect(function myEffect() { ${NEEDLE}; }, [deps])`
);
check(
  'S5b: named function-expression useEffect body is extracted',
  namedFuncBodies.length === 1 && namedFuncBodies[0].includes(NEEDLE),
  'named function-expression body not detected — ' +
    '`useEffect(function myEffect() { setPainRegionFilter(null); })` violations would be missed'
);

// ─── Real file checks ─────────────────────────────────────────────────────────
const useEffectBodies = extractUseEffectBodies(src);

// ─── 1. COUNT — baseline call-site count ─────────────────────────────────────
console.log('\n[1] Count — expected number of setPainRegionFilter(null) call sites');

const NULL_RESET = 'setPainRegionFilter(null)';
const nullResetCount = src.split(NULL_RESET).length - 1;

check(
  `setPainRegionFilter(null) appears exactly 4 times (found ${nullResetCount})`,
  nullResetCount === 4,
  'call count changed — a reset path was added or removed. Update this baseline if intentional.'
);

// ─── 2 & 3. USE-EFFECT — null reset and any call ─────────────────────────────
console.log(
  `\n[2–3] useEffect bodies — no pain filter resets in any effect (${useEffectBodies.length} effects found)`
);

const effectsWithNullReset = useEffectBodies.filter((b) => b.includes(NULL_RESET));
const effectsWithAnyCall = useEffectBodies.filter((b) => b.includes('setPainRegionFilter'));

check(
  `no useEffect body calls setPainRegionFilter(null)`,
  effectsWithNullReset.length === 0,
  `${effectsWithNullReset.length} useEffect(s) contain the null reset — ` +
    'this would silently wipe the filter on re-render'
);

check(
  `no useEffect body calls setPainRegionFilter at all`,
  effectsWithAnyCall.length === 0,
  `${effectsWithAnyCall.length} useEffect(s) reference setPainRegionFilter — ` +
    'even a non-null call could set the filter unexpectedly during side-effects'
);

// ─── 4–7. HANDLER CHECKS — each call site is inside an explicit callback ─────
console.log('\n[4–7] Handler checks — each call site is inside an explicit user callback');

/**
 * Returns the ~600-char window before the Nth occurrence of `needle` in `source`.
 * Returns null if the Nth occurrence doesn't exist.
 */
function windowBefore(source, needle, nth = 1) {
  let idx = -1;
  for (let i = 0; i < nth; i++) {
    idx = source.indexOf(needle, idx + 1);
    if (idx === -1) return null;
  }
  return source.slice(Math.max(0, idx - 600), idx);
}

// 4. TrainingCalendarGrid onNavigateToDate (1st occurrence)
const w1 = windowBefore(src, NULL_RESET, 1);
check(
  'call site 1: setPainRegionFilter(null) is inside a TrainingCalendarGrid onNavigateToDate callback',
  w1 !== null && w1.includes('onNavigateToDate') && w1.includes('TrainingCalendarGrid'),
  'first null reset is not inside the TrainingCalendarGrid onNavigateToDate callback — ' +
    'the clear may have moved to an unsafe location'
);

// 5. "clear all filters" Pressable onPress (2nd occurrence)
const w2 = windowBefore(src, NULL_RESET, 2);
check(
  'call site 2: setPainRegionFilter(null) is inside a "clear all filters" Pressable onPress',
  w2 !== null && w2.includes('onPress') && w2.includes('setHistoryFilter(null)'),
  'second null reset is not co-located with setHistoryFilter(null) in an onPress — ' +
    'the clear-all-filters button may have regressed'
);

// 6. Heatmap body diagram clear button — inline onPress (3rd occurrence)
const w3 = windowBefore(src, NULL_RESET, 3);
check(
  'call site 3: setPainRegionFilter(null) is the sole body of an inline onPress (heatmap clear button)',
  w3 !== null && w3.includes('onPress'),
  'third null reset is not inside an onPress — the heatmap clear button may have moved to a side-effect'
);

// 7. MonthCalendar onNavigateToDate (4th occurrence)
const w4 = windowBefore(src, NULL_RESET, 4);
check(
  'call site 4: setPainRegionFilter(null) is inside a MonthCalendar onNavigateToDate callback',
  w4 !== null && w4.includes('onNavigateToDate') && w4.includes('MonthCalendar'),
  'fourth null reset is not inside the MonthCalendar onNavigateToDate callback — ' +
    'the clear may have moved to an unsafe location'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-filter-reset-safety: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`pain-filter-reset-safety: all ${total} checks passed\n`);
  process.exit(0);
}
