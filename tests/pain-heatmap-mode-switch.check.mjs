/**
 * Contract test: the 'all' / 'recent' pain heatmap toggle routes to two
 * distinct data sources — not the same variable in both modes.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The pain heatmap on the Stats tab has an 'all' / 'recent' toggle
 * (`painHeatmapMode`). When 'recent' is selected the BodyDiagram should
 * receive `recentPainCounts` (sessions from the last 28 days only); when
 * 'all' is selected it should receive `painRegionCounts` (all sessions,
 * no time filter). The toggle is a single ternary on the `heatmapCounts`
 * prop — if that ternary were accidentally simplified (e.g. both branches
 * always pass `painRegionCounts`), the 'recent' button becomes a silent
 * no-op and users see identical diagrams in both modes.
 *
 * Additionally, both variables must be genuine independent useMemo
 * computations, not aliases of each other. `recentPainCounts` applies a
 * 28-day date cutoff inside its body; `painRegionCounts` does not — that
 * difference is what makes the toggle meaningful.
 *
 * Checks:
 *  1. SOURCE — `const painRegionCounts = useMemo(` exists (all-time counter present)
 *  2. SOURCE — `const recentPainCounts = useMemo(` exists (recent counter present)
 *  3. SOURCE — mode-switch ternary with BOTH identifiers present and correct:
 *              `painHeatmapMode === 'recent' ? recentPainCounts : painRegionCounts`
 *  4. SOURCE — `recentPainCounts` useMemo body contains a `cutoff` date (time-bounded)
 *  5. SOURCE — `painRegionCounts` useMemo body does NOT contain `cutoff` (all-time)
 *  6. SOURCE — `const recentPainCounts = painRegionCounts` does NOT appear (no alias)
 *  7. SOURCE — `painRegionCounts` definition appears before `recentPainCounts` in source
 *              (dependency order is intact — all-time then recent, not the reverse)
 *  8. SOURCE — both definitions appear before the ternary (used after declaration)
 *
 * Run:  node tests/pain-heatmap-mode-switch.check.mjs
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
const ALL_TIME_ANCHOR = 'const painRegionCounts = useMemo(';
const RECENT_ANCHOR = 'const recentPainCounts = useMemo(';
const TERNARY = "painHeatmapMode === 'recent' ? recentPainCounts : painRegionCounts";

const allTimeIdx = src.indexOf(ALL_TIME_ANCHOR);
const recentIdx = src.indexOf(RECENT_ANCHOR);
const ternaryIdx = src.indexOf(TERNARY);

// ─── 1–2. SOURCE — both useMemo declarations exist ───────────────────────────
console.log('\n[1–2] Source — both useMemo declarations exist');

check(
  `"${ALL_TIME_ANCHOR}" is present (all-time pain counter)`,
  allTimeIdx !== -1,
  'painRegionCounts is missing — the all-time pain heatmap has no data source'
);

check(
  `"${RECENT_ANCHOR}" is present (recent-only pain counter)`,
  recentIdx !== -1,
  'recentPainCounts is missing — the recent pain heatmap mode has no data source'
);

// ─── 3. SOURCE — mode-switch ternary routes to BOTH identifiers ────────────────
console.log('\n[3] Source — mode-switch ternary references both variables correctly');

check(
  `mode-switch ternary is present: "${TERNARY}"`,
  ternaryIdx !== -1,
  'the ternary is missing or has been changed to always reference one variable — ' +
    "the 'recent' toggle would silently become a no-op"
);

// ─── 4–5. SOURCE — bodies are distinct (cutoff filter only in recentPainCounts) ──
console.log('\n[4–5] Source — recentPainCounts is time-bounded; painRegionCounts is not');

// Extract a window covering each useMemo body (400 chars is enough for both)
const recentBody = recentIdx !== -1 ? src.slice(recentIdx, recentIdx + 400) : null;
const allTimeBody = allTimeIdx !== -1 ? src.slice(allTimeIdx, allTimeIdx + 300) : null;

check(
  'recentPainCounts useMemo body contains `cutoff` (28-day date filter applied)',
  recentBody !== null && recentBody.includes('cutoff'),
  recentBody === null
    ? 'could not extract recentPainCounts body (anchor not found)'
    : '`cutoff` not found inside recentPainCounts — it may now use the same ' +
        'all-sessions loop as painRegionCounts, making the toggle meaningless'
);

check(
  'painRegionCounts useMemo body does NOT contain `cutoff` (genuinely all-time)',
  allTimeBody !== null && !allTimeBody.includes('cutoff'),
  allTimeBody === null
    ? 'could not extract painRegionCounts body (anchor not found)'
    : '`cutoff` found inside painRegionCounts — the all-time counter now applies ' +
        "a time filter, so the 'all' mode no longer shows all sessions"
);

// ─── 6. SOURCE — recentPainCounts is not a plain alias of painRegionCounts ───
console.log('\n[6] Source — recentPainCounts is not an alias of painRegionCounts');

const ALIAS_PATTERN = 'const recentPainCounts = painRegionCounts';
check(
  `"${ALIAS_PATTERN}" does NOT appear (variables are independent computations)`,
  !src.includes(ALIAS_PATTERN),
  `"${ALIAS_PATTERN}" found — recentPainCounts is just an alias; ` +
    "the 'recent' mode returns identical data to 'all'"
);

// ─── 7. SOURCE — declaration order (all-time before recent) ──────────────────
console.log('\n[7] Source — painRegionCounts is declared before recentPainCounts');

check(
  'painRegionCounts definition index < recentPainCounts definition index',
  allTimeIdx !== -1 && recentIdx !== -1 && allTimeIdx < recentIdx,
  `allTimeIdx=${allTimeIdx}, recentIdx=${recentIdx} — ` +
    'declaration order inverted; recentPainCounts now appears before its sibling'
);

// ─── 8. SOURCE — both definitions appear before the ternary ──────────────────
console.log('\n[8] Source — both variables are declared before the mode-switch ternary');

check(
  'painRegionCounts definition index < ternary index (defined before use)',
  allTimeIdx !== -1 && ternaryIdx !== -1 && allTimeIdx < ternaryIdx,
  `allTimeIdx=${allTimeIdx}, ternaryIdx=${ternaryIdx} — ` +
    'painRegionCounts is referenced before it is declared'
);

check(
  'recentPainCounts definition index < ternary index (defined before use)',
  recentIdx !== -1 && ternaryIdx !== -1 && recentIdx < ternaryIdx,
  `recentIdx=${recentIdx}, ternaryIdx=${ternaryIdx} — ` +
    'recentPainCounts is referenced before it is declared'
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-heatmap-mode-switch: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`pain-heatmap-mode-switch: all ${total} checks passed\n`);
  process.exitCode = 0;
}
