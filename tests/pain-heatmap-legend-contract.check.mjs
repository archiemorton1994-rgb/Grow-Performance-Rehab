/**
 * Contract test: heatmapColor (body regions) and heatmapBucketColor (legend)
 * share the same four-bucket threshold logic and the same colour constants so
 * the legend can never silently drift from the body it describes.
 *
 * WHY THIS MATTERS
 * ────────────────
 * BodyDiagram renders each pain region using heatmapColor() (with alpha on REST)
 * and renders the colour-scale legend using heatmapBucketColor() (solid).  Both
 * functions implement the same four bucket thresholds:
 *
 *   count <= 0   REST       (dark grey — no sessions recorded)
 *   count = 1    WORKED     (green  — occasional mention)
 *   count 2–3    ATTENTION  (amber  — moderate frequency)
 *   count >= 4   OVERLOADED (red    — frequent pain)
 *
 * Because they are separate functions, editing one without updating the other
 * will produce a legend that contradicts what the body diagram actually shows —
 * silently misleading users about which colour means what.
 *
 * Checks:
 *  1. SOURCE — heatmapColor is exported from BodyDiagram
 *  2. SOURCE — heatmapBucketColor is exported from BodyDiagram
 *  3. SOURCE — heatmapColor contains if (count <= 0)
 *  4. SOURCE — heatmapColor contains if (count === 1)
 *  5. SOURCE — heatmapColor contains if (count <= 3)
 *  6. SOURCE — heatmapBucketColor contains if (count <= 0)
 *  7. SOURCE — heatmapBucketColor contains if (count === 1)
 *  8. SOURCE — heatmapBucketColor contains if (count <= 3)
 *  9. COLOUR — count<=0 branch: both functions reference the same VOCAB constant
 * 10. COLOUR — count===1 branch: both functions reference the same VOCAB constant
 * 11. COLOUR — count<=3 branch: both functions reference the same VOCAB constant
 * 12. COLOUR — fallthrough branch: both functions reference the same VOCAB constant
 *
 * Run:  node tests/pain-heatmap-legend-contract.check.mjs
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
    console.log(`  \u2713 ${label}`);
  } else {
    console.error(`  \u2717 FAIL: ${label}${detail ? ` \u2014 ${detail}` : ''}`);
    failures++;
  }
}

// ─── Extract function bodies ──────────────────────────────────────────────────
// Anchor to the export declaration; grab up to 250 chars and find closing `\n}`

function extractFunctionBody(src, exportAnchor) {
  const start = src.indexOf(exportAnchor);
  if (start === -1) return null;
  const window = src.slice(start, start + 250);
  const closeOffset = window.indexOf('\n}');
  return closeOffset !== -1 ? window.slice(0, closeOffset + 2) : null;
}

const HC_ANCHOR = 'export function heatmapColor(';
const HBC_ANCHOR = 'export function heatmapBucketColor(';

const hcBody = extractFunctionBody(bodySrc, HC_ANCHOR);
const hbcBody = extractFunctionBody(bodySrc, HBC_ANCHOR);

// ─── 1–2. SOURCE — both functions are exported ────────────────────────────────
console.log('\n[1-2] Source \u2014 heatmapColor and heatmapBucketColor are both exported');

check(
  `"${HC_ANCHOR}" found in components/BodyDiagram.tsx`,
  bodySrc.includes(HC_ANCHOR),
  'heatmapColor export is missing \u2014 body-region colouring is broken'
);

check(
  `"${HBC_ANCHOR}" found in components/BodyDiagram.tsx`,
  bodySrc.includes(HBC_ANCHOR),
  'heatmapBucketColor export is missing \u2014 the colour-scale legend cannot render'
);

// ─── 3–5. SOURCE — heatmapColor threshold buckets ────────────────────────────
console.log('\n[3-5] Source \u2014 heatmapColor uses the canonical four bucket thresholds');

check(
  'heatmapColor: `if (count <= 0)` present',
  hcBody !== null && hcBody.includes('if (count <= 0)'),
  hcBody === null
    ? 'could not extract heatmapColor body (function may span > 250 chars)'
    : 'zero threshold missing from heatmapColor \u2014 REST bucket may be broken'
);

check(
  'heatmapColor: `if (count === 1)` present',
  hcBody !== null && hcBody.includes('if (count === 1)'),
  hcBody === null
    ? 'could not extract heatmapColor body'
    : 'single-session threshold missing from heatmapColor \u2014 1 session may be mapped to attention/overloaded'
);

check(
  'heatmapColor: `if (count <= 3)` present',
  hcBody !== null && hcBody.includes('if (count <= 3)'),
  hcBody === null
    ? 'could not extract heatmapColor body'
    : 'medium threshold missing from heatmapColor \u2014 2\u20133 sessions may incorrectly reach max intensity'
);

// ─── 6–8. SOURCE — heatmapBucketColor threshold buckets ──────────────────────
console.log('\n[6-8] Source \u2014 heatmapBucketColor uses the same canonical thresholds');

check(
  'heatmapBucketColor: `if (count <= 0)` present',
  hbcBody !== null && hbcBody.includes('if (count <= 0)'),
  hbcBody === null
    ? 'could not extract heatmapBucketColor body (function may span > 250 chars)'
    : 'zero threshold missing from heatmapBucketColor \u2014 legend REST swatch may be wrong'
);

check(
  'heatmapBucketColor: `if (count === 1)` present',
  hbcBody !== null && hbcBody.includes('if (count === 1)'),
  hbcBody === null
    ? 'could not extract heatmapBucketColor body'
    : 'single-session threshold missing from heatmapBucketColor \u2014 legend WORKED swatch may show wrong colour'
);

check(
  'heatmapBucketColor: `if (count <= 3)` present',
  hbcBody !== null && hbcBody.includes('if (count <= 3)'),
  hbcBody === null
    ? 'could not extract heatmapBucketColor body'
    : 'medium threshold missing from heatmapBucketColor \u2014 ATTENTION/OVERLOADED boundary may be wrong'
);

// ─── 9–12. COLOUR — same VOCAB constant in each branch of both functions ──────
//
// Strategy: for each threshold branch, find the source line that contains the
// branch guard (e.g. `if (count <= 0)`) and extract the VOCAB_* token from it.
// Then find the line in heatmapBucketColor that matches the same guard and
// extract its VOCAB_* token.  The tokens must be identical.
//
// This is stronger than re-implementing the logic locally: it detects the
// actual drift scenario where one function's return constant is changed without
// updating the other.
//
// heatmapColor wraps the REST branch in colorWithAlpha(VOCAB_REST, 0.55) while
// heatmapBucketColor returns VOCAB_REST directly.  The VOCAB_* constant name
// is still present on the same source line in both cases, so the extraction
// works identically for both.

console.log('\n[9-12] Colour \u2014 both functions reference the same VOCAB constant per bucket');

/**
 * Extract the first VOCAB_* identifier from the source line containing
 * branchGuard inside fnBody.  Returns null if no match is found.
 */
function vocabOnBranchLine(fnBody, branchGuard) {
  if (!fnBody) return null;
  const lines = fnBody.split('\n');
  for (const line of lines) {
    if (line.includes(branchGuard)) {
      const m = line.match(/VOCAB_\w+/);
      return m ? m[0] : null;
    }
  }
  return null;
}

/**
 * Extract the VOCAB_* constant from the final fallthrough return (the line
 * that starts with `return` and has no preceding `if` on the same line).
 */
function vocabOnFallthrough(fnBody) {
  if (!fnBody) return null;
  const lines = fnBody.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('return') && !trimmed.startsWith('return color')) {
      const m = trimmed.match(/VOCAB_\w+/);
      return m ? m[0] : null;
    }
  }
  return null;
}

// 9. count <= 0 branch (REST)
const hcRest = vocabOnBranchLine(hcBody, 'if (count <= 0)');
const hbcRest = vocabOnBranchLine(hbcBody, 'if (count <= 0)');
check(
  `count<=0 branch: both functions reference the same VOCAB constant (heatmapColor="${hcRest}", heatmapBucketColor="${hbcRest}")`,
  hcRest !== null && hbcRest !== null && hcRest === hbcRest,
  hcRest === null || hbcRest === null
    ? `could not extract VOCAB constant from one or both REST branches (hcRest=${hcRest}, hbcRest=${hbcRest})`
    : `VOCAB mismatch on REST bucket: heatmapColor uses "${hcRest}" but heatmapBucketColor uses "${hbcRest}" \u2014 legend will show a different colour than the body diagram`
);

// 10. count === 1 branch (WORKED)
const hcWorked = vocabOnBranchLine(hcBody, 'if (count === 1)');
const hbcWorked = vocabOnBranchLine(hbcBody, 'if (count === 1)');
check(
  `count===1 branch: both functions reference the same VOCAB constant (heatmapColor="${hcWorked}", heatmapBucketColor="${hbcWorked}")`,
  hcWorked !== null && hbcWorked !== null && hcWorked === hbcWorked,
  hcWorked === null || hbcWorked === null
    ? `could not extract VOCAB constant from one or both WORKED branches (hcWorked=${hcWorked}, hbcWorked=${hbcWorked})`
    : `VOCAB mismatch on WORKED bucket: heatmapColor uses "${hcWorked}" but heatmapBucketColor uses "${hbcWorked}" \u2014 legend swatch will differ from the body region colour`
);

// 11. count <= 3 branch (ATTENTION)
const hcAttention = vocabOnBranchLine(hcBody, 'if (count <= 3)');
const hbcAttention = vocabOnBranchLine(hbcBody, 'if (count <= 3)');
check(
  `count<=3 branch: both functions reference the same VOCAB constant (heatmapColor="${hcAttention}", heatmapBucketColor="${hbcAttention}")`,
  hcAttention !== null && hbcAttention !== null && hcAttention === hbcAttention,
  hcAttention === null || hbcAttention === null
    ? `could not extract VOCAB constant from one or both ATTENTION branches (hcAttention=${hcAttention}, hbcAttention=${hbcAttention})`
    : `VOCAB mismatch on ATTENTION bucket: heatmapColor uses "${hcAttention}" but heatmapBucketColor uses "${hbcAttention}"`
);

// 12. fallthrough branch (OVERLOADED)
const hcOverloaded = vocabOnFallthrough(hcBody);
const hbcOverloaded = vocabOnFallthrough(hbcBody);
check(
  `fallthrough branch: both functions reference the same VOCAB constant (heatmapColor="${hcOverloaded}", heatmapBucketColor="${hbcOverloaded}")`,
  hcOverloaded !== null && hbcOverloaded !== null && hcOverloaded === hbcOverloaded,
  hcOverloaded === null || hbcOverloaded === null
    ? `could not extract VOCAB constant from one or both OVERLOADED branches (hcOverloaded=${hcOverloaded}, hbcOverloaded=${hbcOverloaded})`
    : `VOCAB mismatch on OVERLOADED bucket: heatmapColor uses "${hcOverloaded}" but heatmapBucketColor uses "${hbcOverloaded}"`
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`pain-heatmap-legend-contract: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`pain-heatmap-legend-contract: all ${total} checks passed\n`);
  process.exitCode = 0;
}
