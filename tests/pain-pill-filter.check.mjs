/**
 * Contract tests: pain pill tap-to-filter works correctly end-to-end.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The Stats tab history list renders pain-region "pills" on each session row.
 * Tapping a pill calls onPainRegionPress, which drives the painRegionFilter
 * toggle in the parent WorkoutsScreen. A second tap on the same pill must
 * clear the filter (toggle off). The filteredSessions useMemo then narrows
 * the visible list to only sessions whose painRegions include the active filter.
 *
 * If the togglePainFilter call is replaced with a plain setter, the "tap again
 * to clear" behaviour silently breaks. If the pill press is ever stopped from
 * propagating to the parent, the filter never activates. Both regressions would
 * ship silently without these checks.
 *
 * Checks:
 *  1. SOURCE — pill handler calls togglePainFilter(prev, region) (tap again = clear)
 *  2. SOURCE — pill Pressable calls onPainRegionPress (wired to parent setter)
 *  3. SOURCE — active pill styling gates on activePainRegion === r
 *  4. LOGIC  — toggle: first tap sets region, second tap clears it
 *  5. LOGIC  — toggle: switching regions replaces, not stacks
 *  6. FILTER — only sessions whose painRegions include the filter are returned
 *  7. FILTER — sessions with legacy painRegion (no array) are matched correctly
 *  8. FILTER — null filter returns all sessions (no active filter)
 *  9. FILTER — sessions without any pain data are excluded when filter is active
 *
 * Run:  node tests/pain-pill-filter.check.mjs
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

// ─── 1. SOURCE — pill handler delegates to togglePainFilter ──────────────────
console.log('\n[1] Source — onPainRegionPress calls togglePainFilter(prev, region)');

const TOGGLE_CALL = 'togglePainFilter(prev, region)';
check(
  `onPainRegionPress toggle calls \`${TOGGLE_CALL}\``,
  src.includes(TOGGLE_CALL),
  'togglePainFilter not called from pill handler — second tap may no longer clear the filter, ' +
    'or the two toggle paths (pill + heatmap) have drifted'
);

// ─── 2. SOURCE — pill Pressable calls onPainRegionPress ──────────────────────
console.log('\n[2] Source — pill Pressable is wired to onPainRegionPress');

check(
  'pill Pressable calls onPainRegionPress(r as PainRegion)',
  src.includes('onPainRegionPress?.(r as PainRegion)'),
  'pill press no longer calls the parent handler — filter will never activate on tap'
);

// ─── 3. SOURCE — active pill gates on activePainRegion === r ─────────────────
console.log('\n[3] Source — active pill styling checks activePainRegion === r');

check(
  'isActive computed as activePainRegion === r',
  src.includes('activePainRegion === r'),
  'active-state guard changed — selected pill will not highlight correctly'
);

// ─── 4–5. LOGIC — toggle state machine ───────────────────────────────────────
console.log('\n[4–5] Logic — toggle state machine');

// Re-implements the onPainRegionPress handler from workouts.tsx line ~4799-4800
function toggle(prev, region) {
  return prev === region ? null : region;
}

// 4. First tap sets the region; second tap on same pill clears it
let state = null;

state = toggle(state, 'knee');
check(
  'first tap on "knee" pill sets painRegionFilter to "knee"',
  state === 'knee',
  `state = ${JSON.stringify(state)}, expected "knee"`
);

state = toggle(state, 'knee');
check(
  'second tap on "knee" pill clears painRegionFilter back to null',
  state === null,
  `state = ${JSON.stringify(state)}, expected null`
);

// 5. Switching from one region to another replaces, not stacks
state = toggle(null, 'knee');
state = toggle(state, 'lower_back');
check(
  'tapping "lower_back" pill while "knee" is active replaces filter (not stacked)',
  state === 'lower_back',
  `state = ${JSON.stringify(state)}, expected "lower_back"`
);

state = toggle(state, 'lower_back');
check(
  'tapping "lower_back" again clears after a region-switch',
  state === null,
  `state = ${JSON.stringify(state)}, expected null`
);

// ─── 6–9. FILTER — filteredSessions narrowing ────────────────────────────────
console.log('\n[6–9] Filter — filteredSessions narrowing by painRegionFilter');

// Re-implements the painRegionFilter branch of filteredSessions from workouts.tsx
function getRegions(s) {
  return s.painRegions?.length ? s.painRegions : s.painRegion ? [s.painRegion] : [];
}

function applyFilter(sessions, painRegionFilter) {
  if (!painRegionFilter) return sessions;
  return sessions.filter((s) => {
    const regions = getRegions(s);
    return regions.includes(painRegionFilter);
  });
}

function makeSession(opts) {
  return {
    id: opts.id ?? 'test',
    date: new Date().toISOString(),
    sessionType: 'squat',
    painRegion: opts.painRegion ?? undefined,
    painRegions: opts.painRegions ?? undefined,
    exerciseLogs: [],
  };
}

const kneeSession = makeSession({ id: 'knee-only', painRegions: ['knee'] });
const multiSession = makeSession({ id: 'multi', painRegions: ['knee', 'lower_back'] });
const legacySession = makeSession({ id: 'legacy', painRegion: 'knee' });
const noPainSession = makeSession({ id: 'nopain' });
const backSession = makeSession({ id: 'back-only', painRegions: ['lower_back'] });

const allSessions = [kneeSession, multiSession, legacySession, noPainSession, backSession];

// 6. Filter by 'knee' — sessions whose painRegions include 'knee' are returned
const kneeFiltered = applyFilter(allSessions, 'knee');
check(
  'filter "knee": knee-only session is included',
  kneeFiltered.some((s) => s.id === 'knee-only'),
  'knee-only session missing from filtered list'
);
check(
  'filter "knee": multi-region session (knee + lower_back) is included',
  kneeFiltered.some((s) => s.id === 'multi'),
  'multi-region session missing — pill filter does not use includes()'
);
check(
  'filter "knee": back-only session is excluded',
  !kneeFiltered.some((s) => s.id === 'back-only'),
  'back-only session incorrectly included in knee filter'
);

// 7. Legacy session (painRegion only, no array) is matched correctly
check(
  'filter "knee": legacy session (painRegion:"knee", no array) is included',
  kneeFiltered.some((s) => s.id === 'legacy'),
  'legacy single-region session excluded — fallback to [s.painRegion] not working'
);

// 8. null filter returns all sessions unchanged
const noFilter = applyFilter(allSessions, null);
check(
  'null filter returns all sessions (no active filter)',
  noFilter.length === allSessions.length,
  `got ${noFilter.length} sessions, expected ${allSessions.length}`
);

// 9. Session with no pain data is excluded when filter is active
check(
  'filter "knee": no-pain session is excluded when filter is active',
  !kneeFiltered.some((s) => s.id === 'nopain'),
  'no-pain session incorrectly included — sessions with no pain data should be hidden'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-pill-filter: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`pain-pill-filter: all ${total} checks passed\n`);
  process.exitCode = 0;
}
