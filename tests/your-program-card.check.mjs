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
//
// IT WAS MEASURING A BOX THAT DOES NOT RENDER. ICON_SIZE and GAP were taken
// from `summaryIconBox`, a style with no JSX reference anywhere in the app: the
// tiles moved to `summaryCardImage` in a redesign and that block was left
// behind. So this passed comfortably at 32 + 2 + 2 while the tile actually
// stacked a 52pt image with 4pt gaps, and it would have gone on passing at any
// image size at all.
//
// Both numbers are read out of the real styles now. The tile is the thing being
// guarded, so the tile is the thing that has to be measured.
// The height may be a literal or a named constant. Resolve the identifier
// rather than forcing the screen back to a magic number: the constant exists
// so the style and the <GrowIconTile size> cannot drift apart, which is the
// same thing this budget is guarding. Same fix badge-copy.check.mjs needed
// when the badge ids moved behind constants.
const iconRaw = indexSrc.match(/summaryCardImage\s*:\s*\{[^}]*height\s*:\s*([A-Za-z0-9_]+)/);
const iconMatch = !iconRaw
  ? null
  : /^[0-9]+$/.test(iconRaw[1])
    ? iconRaw
    : indexSrc.match(new RegExp("const\\s+" + iconRaw[1] + "\\s*=\\s*([0-9]+)"));
const gapMatch = indexSrc.match(/summaryCard\s*:\s*\{[\s\S]*?\bgap\s*:\s*(\d+)/);
if (!iconMatch) fail('summaryCardImage height found — the tile artwork is what sets this budget');
else ok(`summaryCardImage height read from the screen: ${iconMatch[1]}pt`);
if (!gapMatch) fail('summaryCard gap found');
else ok(`summaryCard gap read from the screen: ${gapMatch[1]}pt`);
const ICON_SIZE = iconMatch ? parseInt(iconMatch[1], 10) : 999;
const GAP = gapMatch ? parseInt(gapMatch[1], 10) : 999;

const bigNumLineHeightMatch = indexSrc.match(/summaryBigNum\s*:\s*\{[^}]*lineHeight\s*:\s*(\d+)/);
const cycleLabelLineHeightMatch = indexSrc.match(
  /summaryCycleLabel\s*:\s*\{[^}]*lineHeight\s*:\s*(\d+)/
);

if (!bigNumLineHeightMatch || !cycleLabelLineHeightMatch) {
  fail('Height invariant: both summaryBigNum and summaryCycleLabel have lineHeight set');
} else {
  const bigNumLH = parseInt(bigNumLineHeightMatch[1], 10);
  const cycleLabelLH = parseInt(cycleLabelLineHeightMatch[1], 10);

  // WHAT THIS ACTUALLY GUARDS.
  //
  // Your Program is the only tile with five children; the other three have
  // four. summaryGrid is flexWrap with the default alignItems:'stretch', so
  // that one extra child sets the height of the entire first row and the 2x2
  // grid steps by exactly cycleLabel + one gap. Home has no room to spare - it
  // was 83pt over a 390x844 screen before this round - so the step has to stay
  // small enough to read as a grid rather than as two mismatched rows.
  const STEP_MAX = 16;
  const step = cycleLabelLH + GAP;
  if (step <= STEP_MAX) {
    ok(`Grid step: cycleLabel(${cycleLabelLH}) + gap(${GAP}) = ${step}pt ≤ ${STEP_MAX}pt`);
  } else {
    fail(
      `Grid step: the first row stands ${step}pt taller than the second`,
      'Your Program carries one child more than the other tiles and stretch makes it set the whole row. Shrink summaryCycleLabel lineHeight or summaryCard gap.'
    );
  }

  // And the tile's own content must still fit the four-child tiles' floor plus
  // that step, or minHeight is doing nothing and the rows drift apart further.
  const minHeightMatch = indexSrc.match(/summaryCard\s*:\s*\{[\s\S]*?minHeight\s*:\s*(\d+)/);
  const minH = minHeightMatch ? parseInt(minHeightMatch[1], 10) : 0;
  const padMatch = indexSrc.match(/summaryCard\s*:\s*\{[\s\S]*?padding\s*:\s*(\d+)/);
  const pad = padMatch ? parseInt(padMatch[1], 10) : 0;
  // image + gap + number + gap + title, i.e. the four-child tile, ignoring the
  // 11pt title's own line box which is the same in every tile.
  const fourChild = ICON_SIZE + GAP + bigNumLH + GAP + 13;
  if (minH > 0 && fourChild <= minH - pad * 2 + STEP_MAX) {
    ok(`Tile floor: four-child content ${fourChild}pt fits minHeight ${minH} with padding ${pad}`);
  } else {
    fail(
      `Tile floor: four-child content is ${fourChild}pt against minHeight ${minH} - padding ${pad * 2}`,
      'the floor no longer floors anything, so every tile is content-sized and the grid height is whatever the copy happens to be'
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
process.exitCode = failed > 0 ? 1 : 0;
