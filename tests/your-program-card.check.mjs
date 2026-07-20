/**
 * Contract tests: "Your Program" card double-digit cycle number readability
 *
 * WHY THIS MATTERS
 * ────────────────
 * The icon box (72×72pt) for the "Your Program" card holds three stacked
 * children: an Ionicons glyph (size=32), a "CYCLE" micro-label, and the bare
 * cycle number.  After the fix that split the old single "Cycle N" Text into
 * two separate elements, the number must render centred regardless of digit
 * count.  Four invariants guard against future regressions:
 *
 *   1. The icon box children are a CYCLE label + bare number (not "Cycle N").
 *      If someone merges them back into a single string the word "Cycle" adds
 *      ~30pt, making double-digit values wrap inside the 72pt box.
 *
 *   2. summaryBigNum has textAlign:'center'.  Without it, multi-digit numbers
 *      left-align inside their auto-sized Text frame on some RN rendering paths.
 *
 *   3. The total stacked height never exceeds 72pt.  Math:
 *        icon(32) + gap(2) + cycleLabel.lineHeight(9) + gap(2) + bigNum.lineHeight(26)
 *        = 71pt ≤ 72pt.
 *      If someone bumps a lineHeight the box will clip content.
 *
 *   4. summaryCycleLabel uses a SMALL fontSize (≤10) so the label stays truly
 *      micro and does not compete visually with the number.
 *
 * Silent failure modes this catches:
 *  - "Cycle N" string reassembled (text wraps for ≥10)
 *  - textAlign:'center' removed from summaryBigNum (numbers left-align)
 *  - lineHeight/fontSize bumped until total height > 72pt (content clips)
 *  - summaryCycleLabel fontSize enlarged (label overwhelms number hierarchy)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`    ${detail}`);
  failed++;
}

// ─── load source ────────────────────────────────────────────────────────────

const indexSrc = readFile('app/(tabs)/index.tsx');

// ─── test 1: no "Cycle N" combined string ────────────────────────────────────
// The old pattern was:  <Text ...>Cycle {progCycleNumber}</Text>
// If it comes back, double-digit values wrap inside the 72pt box.
const combinedCycleRe = />\s*Cycle\s*\{progCycleNumber\}\s*</;
if (combinedCycleRe.test(indexSrc)) {
  fail(
    'Your Program card: no combined "Cycle N" Text element',
    'Found: >Cycle {progCycleNumber}< — split into separate CYCLE label + number'
  );
} else {
  ok('Your Program card: CYCLE label and number are separate Text elements');
}

// ─── test 2: CYCLE micro-label renders the literal word ──────────────────────
// The label Text must contain only the uppercase string "CYCLE" (no variable).
const cycleLabelRe = /summaryCycleLabel[^>]*>\s*CYCLE\s*</;
if (!cycleLabelRe.test(indexSrc)) {
  fail(
    'Your Program card: CYCLE micro-label renders literal "CYCLE" string',
    'Expected: <Text style={styles.summaryCycleLabel}>CYCLE</Text>'
  );
} else {
  ok('Your Program card: CYCLE micro-label renders literal "CYCLE" string');
}

// ─── test 3: bare cycle number uses summaryBigNum ────────────────────────────
const bigNumCycleRe = /summaryBigNum[^>]*>\{progCycleNumber\}</;
if (!bigNumCycleRe.test(indexSrc)) {
  fail(
    'Your Program card: cycle number rendered with summaryBigNum style',
    'Expected: <Text style={styles.summaryBigNum}>{progCycleNumber}</Text>'
  );
} else {
  ok('Your Program card: cycle number rendered with summaryBigNum style');
}

// ─── test 4: summaryBigNum has textAlign:'center' ───────────────────────────
// Extract the summaryBigNum style block and verify textAlign is set.
const bigNumBlockMatch = indexSrc.match(/summaryBigNum\s*:\s*\{([^}]+)\}/);
if (!bigNumBlockMatch) {
  fail('summaryBigNum style block found in index.tsx');
} else {
  ok('summaryBigNum style block found in index.tsx');
  const block = bigNumBlockMatch[1];
  if (/textAlign\s*:\s*['"]center['"]/.test(block)) {
    ok("summaryBigNum: textAlign is 'center'");
  } else {
    fail(
      "summaryBigNum: textAlign is 'center'",
      'Missing textAlign: center — double-digit numbers may left-align on some platforms'
    );
  }
}

// ─── test 5: height invariant — total stacked content ≤ 72pt ────────────────
// Parse lineHeight values and check icon(32) + gaps(4) + them ≤ 72.
const ICON_SIZE = 32;
const GAP = 2; // gap: 2 in summaryIconBox, applied between each of 3 children = 2 gaps

const bigNumLineHeightMatch = indexSrc.match(/summaryBigNum\s*:\s*\{[^}]*lineHeight\s*:\s*(\d+)/);
const cycleLabelLineHeightMatch = indexSrc.match(
  /summaryCycleLabel\s*:\s*\{[^}]*lineHeight\s*:\s*(\d+)/
);

if (!bigNumLineHeightMatch || !cycleLabelLineHeightMatch) {
  fail('Height invariant: both summaryBigNum and summaryCycleLabel have lineHeight set');
} else {
  const bigNumLH = parseInt(bigNumLineHeightMatch[1], 10);
  const cycleLabelLH = parseInt(cycleLabelLineHeightMatch[1], 10);
  const totalHeight = ICON_SIZE + GAP + cycleLabelLH + GAP + bigNumLH;
  if (totalHeight <= 72) {
    ok(
      `Height invariant: icon(${ICON_SIZE}) + gaps(${GAP * 2}) + cycleLabel(${cycleLabelLH}) + bigNum(${bigNumLH}) = ${totalHeight}pt ≤ 72pt`
    );
  } else {
    fail(
      `Height invariant: stacked content ${totalHeight}pt must be ≤ 72pt`,
      `icon(${ICON_SIZE}) + gaps(${GAP * 2}) + cycleLabel(${cycleLabelLH}) + bigNum(${bigNumLH}) = ${totalHeight}pt — reduce a lineHeight or icon size`
    );
  }
}

// ─── test 6: summaryCycleLabel fontSize is micro (≤ 10) ─────────────────────
const cycleFontSizeMatch = indexSrc.match(/summaryCycleLabel\s*:\s*\{[^}]*fontSize\s*:\s*(\d+)/);
if (!cycleFontSizeMatch) {
  fail('summaryCycleLabel: fontSize found in style block');
} else {
  const fs_ = parseInt(cycleFontSizeMatch[1], 10);
  if (fs_ <= 10) {
    ok(`summaryCycleLabel: fontSize ${fs_} is micro (≤ 10)`);
  } else {
    fail(
      `summaryCycleLabel: fontSize ${fs_} must be ≤ 10 (micro label)`,
      'A large label would visually compete with the number and reduce hierarchy'
    );
  }
}

// ─── summary ─────────────────────────────────────────────────────────────────
console.log(`\nyour-program-card: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
