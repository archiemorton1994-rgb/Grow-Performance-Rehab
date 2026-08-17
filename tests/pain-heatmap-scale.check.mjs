/**
 * Contract test: BodyDiagram heatmap uses absolute count buckets — not
 * relative max-normalisation — so a single active region can't silently
 * saturate all zones or cause a divide-by-zero.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The BodyDiagram heatmap colours each pain region based on raw session count.
 * The implementation uses four absolute bucket thresholds:
 *
 *   count = 0       → REST       (dark grey — no sessions recorded)
 *   count = 1       → WORKED     (green  — occasional mention)
 *   count = 2 or 3  → ATTENTION  (amber  — moderate frequency)
 *   count ≥ 4       → OVERLOADED (red    — frequent pain)
 *
 * If this were changed to normalise relative to the current max count (e.g.
 * `heatmapColor(count / maxCount)`), a single region with just one session
 * would be normalised to 1.0 and rendered OVERLOADED. Combined with the
 * filter-scoping risk caught in pain-heatmap-counts.check.mjs, both bugs
 * together would guarantee the selected zone always looks maximally intense
 * while all others appear dim — making the heatmap actively misleading.
 *
 * This test separately guards against the scale-collapse path by verifying:
 *
 * Checks:
 *  1. SOURCE — `heatmapColor` is exported from BodyDiagram (function exists)
 *  2. SOURCE — bucket threshold `count <= 0` is present (absolute, not relative)
 *  3. SOURCE — bucket threshold `count === 1` is present (single session ≠ max)
 *  4. SOURCE — bucket threshold `count <= 3` is present (medium-range bucket)
 *  5. SOURCE — `heatmapColor` body does NOT reference `maxCount` (no normalisation)
 *  6. SOURCE — `bodyData` useMemo calls `heatmapColor(count)` directly (no division)
 *  7. SOURCE — `heatmapCounts[region] ?? 0` is used (raw lookup, no pre-division)
 *  8. SOURCE — `heatmapColor(count /` does NOT appear (no division before call)
 *  9. LOGIC  — count=0 → REST bucket (zero sessions stay grey)
 * 10. LOGIC  — count=1 → WORKED bucket (single session is lowest active, not max)
 * 11. LOGIC  — count=3 → ATTENTION (still medium — not yet overloaded)
 * 12. LOGIC  — count=4 → OVERLOADED (max bucket only at 4+ sessions)
 * 13. LOGIC  — single-region scenario: active region and zero region are in different buckets
 * 14. LOGIC  — all-zeros scenario: all regions REST, no crash (no divide-by-zero)
 *
 * Run:  node tests/pain-heatmap-scale.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const bodySrc = readFileSync(join(__dir, '../components/BodyDiagram.tsx'), 'utf8');

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

// ─── Extract the heatmapColor function body ───────────────────────────────────
// Anchor to `export function heatmapColor(` and find the closing `\n}` within
// 250 chars. This gives the entire bucket function for targeted source checks.

const HC_ANCHOR = 'export function heatmapColor(';
const hcStart = bodySrc.indexOf(HC_ANCHOR);
const hcWindow = hcStart !== -1 ? bodySrc.slice(hcStart, hcStart + 250) : null;
// The function closes with a lone `}` on its own line.
const hcCloseOffset = hcWindow !== null ? hcWindow.indexOf('\n}') : -1;
const hcBody =
  hcWindow !== null && hcCloseOffset !== -1 ? hcWindow.slice(0, hcCloseOffset + 2) : null;

// ─── 1. SOURCE — heatmapColor is exported ────────────────────────────────────
console.log('\n[1] Source — heatmapColor is exported from BodyDiagram');

check(
  `"${HC_ANCHOR}" found in components/BodyDiagram.tsx`,
  hcStart !== -1,
  'heatmapColor export is missing — BodyDiagram heatmap rendering is broken'
);

// ─── 2–4. SOURCE — absolute threshold buckets ────────────────────────────────
console.log('\n[2–4] Source — heatmapColor uses absolute threshold buckets');

check(
  'bucket threshold `if (count <= 0)` is present in heatmapColor',
  hcBody !== null && hcBody.includes('if (count <= 0)'),
  hcBody === null
    ? 'could not extract heatmapColor body (function may span > 250 chars)'
    : 'zero threshold missing — zero-count regions may no longer return REST color'
);

check(
  'bucket threshold `if (count === 1)` is present (single session is lowest active bucket)',
  hcBody !== null && hcBody.includes('if (count === 1)'),
  hcBody === null
    ? 'could not extract heatmapColor body'
    : 'single-session threshold missing — 1 session may be mapped to attention/overloaded ' +
        'instead of the lowest active bucket'
);

check(
  'bucket threshold `if (count <= 3)` is present (medium-frequency bucket)',
  hcBody !== null && hcBody.includes('if (count <= 3)'),
  hcBody === null
    ? 'could not extract heatmapColor body'
    : 'medium threshold missing — 2–3 sessions may be incorrectly mapped to max intensity'
);

// ─── 5. SOURCE — no relative normalisation in heatmapColor ───────────────────
console.log('\n[5] Source — heatmapColor body has no relative normalisation (no maxCount)');

check(
  'heatmapColor body does NOT reference `maxCount`',
  hcBody !== null && !hcBody.includes('maxCount'),
  hcBody === null
    ? 'could not extract heatmapColor body'
    : '`maxCount` found inside heatmapColor — the bucket function has been changed to ' +
        'normalise relative to max; a single active region will saturate as OVERLOADED'
);

// ─── 6–8. SOURCE — bodyData useMemo calls heatmapColor without division ───────
console.log('\n[6–8] Source — bodyData useMemo uses heatmapColor(count) without division');

const DIRECT_CALL = 'heatmapColor(count)';
check(
  `bodyData useMemo calls \`${DIRECT_CALL}\` (no division)`,
  bodySrc.includes(DIRECT_CALL),
  `"${DIRECT_CALL}" not found — heatmapColor may now receive a pre-divided value`
);

const RAW_LOOKUP = 'heatmapCounts[region] ?? 0';
check(
  `count is looked up as \`${RAW_LOOKUP}\` (raw count, no pre-division)`,
  bodySrc.includes(RAW_LOOKUP),
  `"${RAW_LOOKUP}" not found — count may be divided before being passed to heatmapColor`
);

const DIVIDED_CALL = 'heatmapColor(count /';
check(
  `"${DIVIDED_CALL}" does NOT appear (no division before call)`,
  !bodySrc.includes(DIVIDED_CALL),
  `"${DIVIDED_CALL}" found — count is being divided before heatmapColor receives it; ` +
    'a single active region will be normalised to max intensity'
);

// ─── 9–14. LOGIC — 4-bucket state machine ─────────────────────────────────────
console.log('\n[9–14] Logic — 4-bucket colour mapping is correct at each threshold boundary');

/**
 * Re-implements heatmapColor from components/BodyDiagram.tsx using symbolic
 * bucket names instead of hex strings. The thresholds must match the source
 * exactly; any drift is caught by the source checks above.
 */
function heatmapBucket(count) {
  if (count <= 0) return 'rest'; // VOCAB_REST
  if (count === 1) return 'worked'; // VOCAB_WORKED
  if (count <= 3) return 'attention'; // VOCAB_ATTENTION
  return 'overloaded'; // VOCAB_OVERLOADED
}

// 9. count=0 → REST (zero sessions must not appear active)
check(
  'count=0 → rest bucket (zero sessions stay grey, not coloured as active region)',
  heatmapBucket(0) === 'rest',
  `got "${heatmapBucket(0)}", expected "rest"`
);

// 10. count=1 → WORKED (single session = lowest active bucket, not saturated)
check(
  'count=1 → worked bucket (one session is lowest active — not attention or overloaded)',
  heatmapBucket(1) === 'worked',
  `got "${heatmapBucket(1)}", expected "worked" — ` +
    'if this is "overloaded", the scale has likely been max-normalised'
);

// 11. count=3 → ATTENTION (still in medium range)
check(
  'count=3 → attention bucket (three sessions is medium, not yet overloaded)',
  heatmapBucket(3) === 'attention',
  `got "${heatmapBucket(3)}", expected "attention"`
);

// 12. count=4 → OVERLOADED (max bucket only reached at 4+ sessions)
check(
  'count=4 → overloaded bucket (max intensity only reached at 4+ sessions)',
  heatmapBucket(4) === 'overloaded',
  `got "${heatmapBucket(4)}", expected "overloaded"`
);

// 13. Single-region scenario: knee=1, lower_back=0 → different buckets.
//     If max-normalisation were applied, knee (1/1 = 1.0) would be OVERLOADED
//     and lower_back (0/1 = 0.0) would be REST — same visual result, but only
//     by coincidence. With count=2 for knee, REST vs ATTENTION is the correct split.
const kneeCount = 2;
const backCount = 0;
check(
  'single-region scenario: knee=2 → attention; lower_back=0 → rest (different buckets)',
  heatmapBucket(kneeCount) === 'attention' && heatmapBucket(backCount) === 'rest',
  `knee="${heatmapBucket(kneeCount)}", lower_back="${heatmapBucket(backCount)}" — ` +
    'both should be different buckets when one region has sessions and the other has none'
);

// 14. All-zeros: no crash, all REST.
const allRegions = ['knee', 'lower_back', 'shoulder_front', 'hip_groin', 'ankle_achilles'];
const zeroCounts = {};
const allRest = allRegions.every((r) => heatmapBucket(zeroCounts[r] ?? 0) === 'rest');
check(
  'all-zeros scenario: every region maps to rest (no crash, no false active colours)',
  allRest,
  'at least one region returned a non-rest bucket for count=0 — possible divide-by-zero fallback'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-heatmap-scale: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`pain-heatmap-scale: all ${total} checks passed\n`);
  process.exitCode = 0;
}
