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

const cap = readiness.match(/Math\.max\((\d+), Math\.min\((\d+),/);
check(
  `the width ceiling is above 200 (now ${cap?.[2] ?? '?'})`,
  Number(cap?.[2] ?? 0) >= 260,
  '200 capped the figure below what the screen allowed even before the chrome was removed'
);
check(
  `the floor is above 100 (now ${cap?.[1] ?? '?'})`,
  Number(cap?.[1] ?? 0) >= 140,
  'a 100pt human figure has 6pt limbs'
);
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
  process.exit(1);
} else {
  console.log(`pain-input: all ${total} checks passed\n`);
  process.exit(0);
}
