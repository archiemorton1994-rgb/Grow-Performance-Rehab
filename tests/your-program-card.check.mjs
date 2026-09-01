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

// ─── test 2: the micro-label is its own Text, in the micro-label style ───────
//
// This used to pin the literal word CYCLE. What it is FOR is the layout: a
// micro-label above a big number, each in its own Text, which is what keeps the
// four tiles the same height. The word itself is content, and the tile now says
// SESSION when somebody is on a programme and CYCLE when they are on the old
// rotation - a change this test failed for reasons it has no opinion about.
const cycleLabelRe = /styles\.summaryCycleLabel\}[^>]*>[\s\S]{0,120}?<\/Text>/;
if (!cycleLabelRe.test(indexSrc)) {
  fail(
    'Your Program card: the micro-label is its own Text in summaryCycleLabel',
    'Expected a <Text style={styles.summaryCycleLabel}>…</Text>'
  );
} else {
  ok('Your Program card: the micro-label is its own Text in summaryCycleLabel');
}

// ─── test 3: the number under it is its own Text, in summaryBigNum ───────────
const bigNumCycleRe = /styles\.summaryBigNum\}[^>]*>[\s\S]{0,200}?<\/Text>/;
if (!bigNumCycleRe.test(indexSrc)) {
  fail(
    'Your Program card: the number is rendered with summaryBigNum',
    'Expected a <Text style={styles.summaryBigNum}>…</Text>'
  );
} else {
  ok('Your Program card: the number is rendered with summaryBigNum');
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
/**
 * THE TILE AND ITS PICTURE ARE BOTH FIXED, AND BOTH SIZED TO THE PHONE.
 *
 * Two rounds were spent trying to make them flexible and both failed the same
 * way. Letting the grid grow put Home on a scrollbar. Bounding the grid but
 * letting the picture take up the slack made 185pt tiles with an 84pt logo
 * marooned in them - "the boxes are still too big and the logos not big
 * enough". Taking the picture's ceiling off was worse again: an Image with
 * `flex` and no height falls back on its own aspect ratio, so a 219px square
 * asset produced a 301pt tile.
 *
 * So there are two sizes, chosen from the window height, and this reads both.
 * `compactTiles ? A : B` is the shape it looks for; A is the short-phone size.
 */
const imgBlock = indexSrc.match(/summaryCardImage\s*:\s*\{([^}]+)\}/);
const imgBody = imgBlock ? imgBlock[1] : '';
const imgPair = imgBody.match(/height:\s*compactTiles \? (\d+) : (\d+)/);
const tilePair = indexSrc.match(/minHeight:\s*compactTiles \? (\d+) : (\d+)/);
const gapMatch = indexSrc.match(/summaryCard\s*:\s*\{[\s\S]*?\bgap\s*:\s*(\d+)/);

if (/const compactTiles = windowHeight < \d+;/.test(indexSrc)) {
  ok('the tiles are sized from the window height, not guessed');
} else {
  fail(
    'the tiles are sized from the window height',
    'one fixed size cannot both fill a 6.7 inch screen and fit a 5.5 inch one'
  );
}

if (/flex\s*:\s*1/.test(imgBody)) {
  fail(
    'summaryCardImage has a real height rather than flex',
    'an Image with flex and no height falls back on its own aspect ratio and drives the tile'
  );
} else {
  ok('summaryCardImage has a real height rather than flex');
}

if (!imgPair) fail('summaryCardImage height found — both sizes of it');
else ok(`summaryCardImage is ${imgPair[1]}pt compact, ${imgPair[2]}pt comfortable`);
if (!tilePair) fail('summaryCard minHeight found — both sizes of it');
else ok(`summaryCard is ${tilePair[1]}pt compact, ${tilePair[2]}pt comfortable`);

// THE COMPLAINT, AS A NUMBER. "The logos not big enough" was the picture at
// 45% of a tile that was itself too tall. Whatever the sizes become, the
// artwork has to be a real share of the box it sits in.
if (imgPair && tilePair) {
  const share = Math.min(
    Number(imgPair[1]) / Number(tilePair[1]),
    Number(imgPair[2]) / Number(tilePair[2])
  );
  if (share >= 0.33) {
    ok(`the artwork is at least ${(share * 100).toFixed(0)}% of its tile, at both sizes`);
  } else {
    fail(
      `the artwork is only ${(share * 100).toFixed(0)}% of its tile`,
      'a small picture in a large box is what "the logos not big enough" meant'
    );
  }
}

if (!gapMatch) fail('summaryCard gap found');
else ok(`summaryCard gap read from the screen: ${gapMatch[1]}pt`);
// The comfortable size is the one the budget below is measured against, since
// it is the one a modern phone gets.
const ICON_SIZE = imgPair ? parseInt(imgPair[2], 10) : 999;
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

  /**
   * HOME DOES NOT SCROLL, and it is the SIZE of the grid that decides that.
   *
   * Nothing here is flexible any more. The grid is content-sized, the tiles
   * have a known height, and whatever the screen has left over is spread
   * between the blocks above by `inner`. So the whole question is one number:
   * how tall are two rows of tiles.
   *
   * The budget was measured in the exported build, not chosen. At the
   * comfortable size the page comes out exactly the viewport on 390x844 and
   * 375x812; the compact size takes 360x780 under the line too. A 375x667
   * screen does not fit and is not expected to - it is 150 points shorter than
   * a modern phone and the hero card alone will not shrink that far.
   */
  const padMatch = indexSrc.match(/summaryCard\s*:\s*\{[\s\S]*?padding\s*:\s*(\d+)/);
  const pad = padMatch ? parseInt(padMatch[1], 10) : 0;

  const gridOpen = indexSrc.indexOf('    summaryGrid: {');
  const gridBlock =
    gridOpen < 0 ? '' : indexSrc.slice(gridOpen, indexSrc.indexOf('\n    },', gridOpen));
  if (!gridBlock || /^\s*(flex|flexGrow|maxHeight|alignContent)\s*:/m.test(gridBlock)) {
    fail(
      'The grid is content-sized, with no flex of its own',
      'every attempt to let this grid share the leftover space ended with either a scrollbar or 185pt tiles'
    );
  } else {
    ok('The grid is content-sized: its height is the tiles, and nothing else');
  }

  if (/inner: \{[\s\S]{0,400}?justifyContent: 'space-between'/.test(indexSrc)) {
    ok('and the leftover is spread between the blocks, not left in a band at the foot');
  } else {
    fail(
      'the leftover is spread between the blocks',
      'without this the space the grid does not take piles up under the last tile, which is the gap that was reported'
    );
  }

  // Two rows of tiles, at the size a modern phone gets. This is the number the
  // whole screen's fit turns on.
  const gridGapMatch = gridBlock.match(/\bgap\s*:\s*(\d+)/);
  const gridGap = gridGapMatch ? parseInt(gridGapMatch[1], 10) : 999;
  const tileHeight = ICON_SIZE + GAP + bigNumLH + GAP + 13 + pad * 2;
  const gridHeight = tileHeight * 2 + gridGap;
  const GRID_MAX = 310;
  if (gridHeight <= GRID_MAX) {
    ok(`Grid: two rows come to ${gridHeight}pt (budget ${GRID_MAX})`);
  } else {
    fail(
      `Grid: two rows come to ${gridHeight}pt, over the ${GRID_MAX}pt budget`,
      'past this the grid does not fit under the hero card on a 390x844 phone, and Home scrolls'
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
