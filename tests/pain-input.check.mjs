/**
 * Contract test: telling the app where it hurts.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Four things were reported about this screen, and each one has a distinct
 * failure mode worth pinning:
 *
 *  1. "The body map is way too small." It was — but the diagram was not the
 *     cause. ~90pt of chrome sat above it (an icon medallion and a subtitle
 *     explaining an interaction), and the width was capped at 200 regardless of
 *     how much room the phone had.
 *  2. "It's still difficult to easily tap the regions." The hit area was
 *     exactly the painted path. On a 200pt figure a calf is about 12pt across —
 *     a quarter of what a fingertip needs.
 *  3. "Ensure there is a toggle to multi-select so the app knows when it's off,
 *     only one area will be chosen." There was no toggle; a second tap always
 *     added, so the app could not distinguish one problem from two.
 *  4. "Targeted prehab will be an exception as we can only allow one region."
 *
 * Run:  node tests/pain-input.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const readiness = readFileSync(join(__dir, '../app/readiness.tsx'), 'utf8');
const diagram = readFileSync(join(__dir, '../components/BodyDiagram.tsx'), 'utf8');

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

// ─── 1. The figure gets the space ────────────────────────────────────────────
console.log('\n[1] The body map is the content, not a thumbnail');

check(
  'the icon medallion above the question is gone',
  !/locate-outline/.test(readiness),
  'it repeated what the heading said, in 70pt of height the figure could use'
);
check(
  'the layout still measures the space it has',
  /onLayout=\{\(e\) => setPainDiagramAreaH/.test(readiness),
  'the whole point is fitting without scrolling, which needs the real height'
);

// ─── 2. The regions are tappable ─────────────────────────────────────────────
console.log('\n[2] A fingertip can hit a calf');

check(
  'hit zones carry a padding stroke',
  /export const HIT_PADDING = \d+;/.test(diagram),
  ''
);
check(
  'and it is applied to the interactive paths',
  /strokeWidth: HIT_PADDING/.test(diagram),
  'a stroke is part of the hit region in react-native-svg, so it grows the target without changing the look'
);
check(
  'the stroke is near-invisible rather than transparent',
  /stroke: 'rgba\(0,0,0,0\.001\)'/.test(diagram),
  "fully transparent paint does not receive touches on iOS or Android — the same reason the fill is rgba and not 'none'"
);
check(
  'out-of-category regions are still inert',
  /fill: 'rgba\(0,0,0,0\)'/.test(diagram),
  'a joint must not be tappable while the muscles view is showing'
);

// ─── 2b. Selection is resolved in JS, not by SVG hit-testing ─────────────────
console.log('\n[2b] Overlapping paths cannot steal each other\'s taps');

// Reported twice, the second time after the hit paths had already been grown:
// "still takes a couple of taps all the time". Growing them could not have
// worked. The figure has 47 hotspot paths and they OVERLAP; where two cover the
// same pixel the one drawn last wins, so a tap on the knee lands on the quad.
// Making the paths bigger makes the overlaps worse.
check(
  'there is a single surface that receives taps',
  /testID="body-diagram-surface"/.test(diagram),
  'per-path hit testing is what made a tap ambiguous in the first place'
);
check(
  'it resolves the region by nearest anchor',
  /const regionAtY = React\.useCallback\(/.test(diagram),
  ''
);
check(
  'only regions actually on screen are candidates',
  /view === 'front' \? FRONT_REGIONS : BACK_REGIONS/.test(diagram),
  'the back view has no chest, and the joints view has no quads'
);
check(
  'and the category filter still applies',
  /category === 'muscles' \? isMuscle : !isMuscle/.test(diagram),
  'otherwise a joint would be selectable while the muscles view is showing'
);
// The front of the body has no rear shoulder on it. Listing both put two
// regions on the same anchor, and the tie went to whichever was listed first —
// so one of them became unselectable rather than the two being distinguished.
check(
  'the front list does not offer the rear shoulder',
  !/const FRONT_REGIONS[\s\S]*?'rear_shoulder'[\s\S]*?\];/.test(
    diagram.slice(diagram.indexOf('const FRONT_REGIONS'), diagram.indexOf('const BACK_REGIONS'))
  ),
  ''
);
check(
  'and the back list does not offer the front shoulder',
  !diagram
    .slice(diagram.indexOf('const BACK_REGIONS'), diagram.indexOf('interface BodyDiagramProps'))
    .includes("'front_shoulder'"),
  ''
);
// Every region must be reachable from SOME view, or it becomes dead.
const listBlock = diagram.slice(
  diagram.indexOf('const FRONT_REGIONS'),
  diagram.indexOf('interface BodyDiagramProps')
);
const anchorBlock = diagram.slice(
  diagram.indexOf('const REGION_ANCHOR'),
  diagram.indexOf('const FRONT_REGIONS')
);
const anchored = [...anchorBlock.matchAll(/^  ([a-z_]+): \{ x:/gm)].map((m) => m[1]);
const listed = new Set([...listBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
const unreachable = anchored.filter((r) => !listed.has(r));
check(
  `every region is reachable from some view (${anchored.length} regions)`,
  anchored.length > 0 && unreachable.length === 0,
  `${unreachable.join(', ')} — anchored but in neither list, so nothing can select them`
);

// ─── 2c. The caller's measured height wins ───────────────────────────────────
console.log('\n[2c] A measured space beats a share of the screen');

// The component budgets 58% of SCREEN height, which caps the figure at ~196pt
// wide on a normal phone whatever the caller asks for. Raising the width
// ceiling did nothing because this bound first — the two were fighting.
check(
  'the pain step passes its measured height',
  /maxHeight=\{painDiagramMaxHeight\}/.test(readiness),
  'passing a width the height budget then overrides is why the figure stayed small'
);
check(
  'targeted prehab measures too',
  /setPrehabDiagramAreaH\(e\.nativeEvent\.layout\.height\)/.test(readiness) &&
    /maxHeight=\{prehabDiagramMaxHeight\}/.test(readiness) &&
    /const prehabDiagramMaxHeight =\s*\r?\n?\s*prehabDiagramAreaH > 0/.test(readiness),
  'this one was not measuring at all, so it took the default on every phone'
);

// The prehab step gained a sore / feels-fine question. It is a SIBLING of the
// measured wrapper, so flexbox already takes its height out of the measurement —
// this assertion used to demand a reserve on top of that, which shrank the
// figure twice over the moment a region was tapped.
check(
  'the sore question is not double-counted against the figure',
  !/PREHAB_SORE_RESERVE/.test(readiness),
  'flexbox has already removed a sibling row from the measured height; subtracting it again shrinks the figure for nothing'
);

// ─── 3. Multi-select is a decision, not an accident ──────────────────────────
console.log('\n[3] One area or several, stated outright');

check('there is a toggle', /testID="pain-multi-select"/.test(readiness), '');
check(
  'it defaults to single',
  /const \[multiSelect, setMultiSelect\] = useState\(false\)/.test(readiness),
  'one problem is the common case, and the one where a mis-tap costs most'
);
check(
  'with it off, a new region REPLACES the old one',
  /return multiSelect \? \[\.\.\.prev, r\] : \[r\];/.test(readiness),
  'otherwise "off" would just mean "you cannot change your mind"'
);
check(
  'turning it off collapses a multi-selection',
  /diagramPainRegions\.length > 1[\s\S]{0,120}?setDiagramPainRegions\(diagramPainRegions\.slice\(0, 1\)\)/.test(
    readiness
  ),
  'leaving three regions selected under a control that says one is a lie about what the app will do'
);

// ─── 4. Targeted rehab takes exactly one ─────────────────────────────────────
console.log('\n[4] Targeted rehab is single-region by construction');

check(
  'the rehab picker holds one region, not a list',
  /const \[diagramPrehabRegion, setDiagramPrehabRegion\] = useState<PainRegion \| undefined>/.test(
    readiness
  ),
  'a rehab session is built for one joint; the type makes a second one impossible rather than merely discouraged'
);
check(
  'and it is wired straight to the setter',
  /onSelect=\{setDiagramPrehabRegion\}/.test(readiness),
  'no toggle logic means no way to accumulate'
);

// ─── 5. The severe prompt says what it will do ───────────────────────────────
console.log('\n[5] "Train around it" is what actually happens');

check(
  'the second option no longer reads as "ignore this"',
  !/Continue with \{getSessionLabel\(sessionType\)\} anyway/.test(readiness),
  '"continue anyway" described the opposite of the behaviour — the session IS screened against the region'
);
check(
  'it says train around it',
  /Train around it/.test(readiness),
  ''
);
check(
  'and it still passes the region and severity through',
  /handlePainRegion\(diagramPainRegions, 'severe'\)/.test(readiness),
  'the screening only happens because those two values reach the generator'
);

console.log('');
if (failures > 0) {
  console.error(`pain-input: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`pain-input: all ${total} checks passed\n`);
  process.exitCode = 0;
}
