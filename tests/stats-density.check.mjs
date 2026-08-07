/**
 * Contract test: the Stats tab has a spacing rhythm and a heading structure.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The complaint was "a lot crammed into one space… overwhelming". Surveying it
 * turned that into something measurable, and it was mostly not the amount of
 * content:
 *
 *   - ELEVEN distinct marginBottom values across the file, every block setting
 *     its own. The Overview scroll ran 20 / 16 / 16 / 12 / 20 between five
 *     consecutive blocks, so nothing lined up and nothing grouped.
 *   - Two tabs where the LARGEST heading appeared second, underneath a card —
 *     a page whose biggest type is halfway down has no top.
 *   - Overview had no section heading at all, so the level that structures the
 *     other three sub-tabs was simply absent on the fourth.
 *   - The donut legend printed a count AND a percentage on every row, which
 *     with ten session types is twenty figures beside a chart whose entire job
 *     is to show proportion.
 *
 * These assertions pin the fixes. They are shape checks rather than pixel
 * checks — the point is that spacing is owned in ONE place and headings exist,
 * not that any particular number is sacred.
 *
 * Run:  node tests/stats-density.check.mjs
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
  if (condition) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// ─── 1. One owner for block rhythm ───────────────────────────────────────────
console.log('\n[1] Block spacing is owned by the scroll container');

check(
  'tabContent sets a gap',
  /tabContent: \{ paddingHorizontal: 20, paddingTop: 12, gap: \d+ \}/.test(src),
  'without it every block has to invent its own bottom margin, and they disagreed'
);

for (const [style, label] of [['drillDownCard', 'the drill-down cards']]) {
  const block = src.slice(src.indexOf(`    ${style}: {`), src.indexOf(`    ${style}: {`) + 400);
  check(
    `${label} no longer sets its own bottom margin`,
    !/marginBottom:/.test(block.slice(0, block.indexOf('},'))),
    'it would stack on top of the container gap'
  );
}

// ─── 1b. The three-figure summary card exists once ───────────────────────────
console.log('\n[1b] The stat strip is one component, not four copies');

check(
  'there is a StatStrip component',
  /function StatStrip\(/.test(src),
  'it was hand-built four times — twice verbatim on Overview, once on Strength, and once inline'
);
check(
  'nothing hand-builds a stat cell any more',
  !/styles\.statCell|styles\.statValue|styles\.statDiv/.test(src),
  'a leftover copy is a leftover place for the design to drift'
);
// The inline copy used 22px where the two style-sheet copies used 26px. Nobody
// decided that; it happened because the card was written more than once. Scoped
// to the component so it measures the card, not every bold number on the tab.
const stripBody = src.slice(src.indexOf('function StatStrip('), src.indexOf('function MuscleProgressPanel('));
const bigNumbers = new Set(
  [...stripBody.matchAll(/fontSize: (\d+), fontFamily: 'Inter_700Bold'/g)].map((m) => Number(m[1]))
);
check(
  `the summary number has one size (found ${[...bigNumbers].join(', ') || 'none'})`,
  bigNumbers.size === 1,
  'three implementations of one card meant three different number sizes'
);
check(
  'the unit sits beside the number rather than in the label',
  /hint\?: string/.test(stripBody),
  '"Squat kg" as a label reads as a different statistic from "Squat"'
);

check(
  'no block card overrides the rhythm inline',
  !/styles\.drillDownCard,\s*\n?\s*\{ marginBottom/.test(src),
  'one card used to add 20 on top of everything else'
);

// The distinct-value count is a proxy for "is there a system". It is allowed to
// be non-trivial — small margins inside cards are fine — but the pre-fix file
// had eleven, which is not a system.
const marginValues = new Set(
  [...src.matchAll(/marginBottom: (\d+)/g)].map((m) => Number(m[1]))
);
check(
  `distinct marginBottom values are down from 11 (now ${marginValues.size})`,
  marginValues.size <= 9,
  `${[...marginValues].sort((a, b) => a - b).join(', ')}`
);

// ─── 2. Every sub-tab has a heading structure ────────────────────────────────
console.log('\n[2] Headings exist, and come before what they introduce');

check(
  'there is a shared heading block style',
  /sectionHead: \{/.test(src),
  'a heading and its subtitle are one unit and must travel together'
);

const overview = src.slice(src.indexOf('{/* OVERVIEW TAB */}'), src.indexOf('{/* STRENGTH TAB */}'));
check(
  'Overview has section headings at all',
  /styles\.sectionTitle/.test(overview),
  'it was the only sub-tab with none, so four cards ran together unlabelled'
);

// On Progress the tab's biggest heading used to appear AFTER the volume chart.
const progress = src.slice(src.indexOf('<WeeklyVolumeChart'), src.indexOf('<ExerciseProgressList'));
check(
  'Progress introduces the volume chart before drawing it',
  src.indexOf('<Text style={styles.sectionTitle}>Volume</Text>') <
    src.indexOf('<WeeklyVolumeChart'),
  'the largest heading on the tab used to appear second, below a card'
);
check(
  'Progress still heads its exercise list',
  /Exercise Progress<\/Text>/.test(progress) || /Exercise Progress/.test(src),
  ''
);

// ─── 3. Fewer competing figures ──────────────────────────────────────────────
console.log('\n[3] The donut legend is not a second table');

check(
  'legend rows show a count, not a count and a percentage',
  !/\{pct\}%/.test(src),
  'ten session types meant twenty figures stacked beside a chart that already shows proportion'
);
check(
  'the now-unused percentage is not still computed',
  !/const pct = Math\.round/.test(src),
  ''
);

// ─── 4. The charts stop implying things that are not true ────────────────────
console.log('\n[4] Charts tell the truth about empty data');

check(
  'a zero-session week draws no bar',
  !/height=\{barH \|\| 2\}/.test(src),
  'a 2px stub made a rest week look like a small amount of training, on both bar charts'
);
check(
  'the peak footer cannot read zero',
  /Math\.max\(1, \.\.\.weeks\.map\(\(w\) => w\.count\)\)/.test(src),
  '"peak: 0 sessions" is not a statistic'
);
check(
  'the Muscle Progress drill-down that landed in the wrong place is gone',
  !/drillDownTitle}>Muscle Progress</.test(src),
  'it promised a heatmap and delivered a scroll-to-top on another tab'
);

// ─── 5. The Strength tab has something to say to a non-lifter ────────────────
console.log('\n[5] No block renders itself empty');

// Everything on this tab except the heaviest-lifts list is built on 1RMs, which
// only exist for squat/bench/deadlift. Someone who trains conditioning, rehab
// or their own sessions used to get three em-dashes, three "no data" charts and
// an empty PB list — permanently, with nothing saying why.
check(
  'the heaviest-lifts list is not gated on having no 1RM',
  !/\{noKpiData && heaviestLifts\.length > 0 && \(/.test(src),
  'gated that way it VANISHED the moment a single 1RM existed, which is the worst possible moment'
);
check(
  'heaviestLifts is computed for everyone',
  !/const heaviestLifts = useMemo\(\(\) => \{\s*if \(!noKpiData\) return \[\];/.test(src),
  'an early return here empties the one block that works without 1RMs'
);
check(
  'only tested lifts get a progression chart',
  /const testedLifts = useMemo\(/.test(src) && /testedLifts\.map\(\(lift\) => \(/.test(src),
  'charting an untested lift draws an axis and the words "no data", three times over'
);
check(
  'the tested-maxes card is hidden when there are no maxes',
  /\{!noKpiData && \(/.test(src),
  'three em-dashes in a card is not a summary'
);
check(
  'and something explains the absence instead',
  /\{noKpiData && \(/.test(src) && /noKpiCard/.test(src),
  'an empty tab with no explanation reads as a broken tab'
);

console.log('');
if (failures > 0) {
  console.error(`stats-density: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`stats-density: all ${total} checks passed\n`);
  process.exit(0);
}
