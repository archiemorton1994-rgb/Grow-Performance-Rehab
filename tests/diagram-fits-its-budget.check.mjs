/**
 * Contract test: `maxHeight` is the room for the WHOLE diagram, not just the figure.
 *
 * WHAT WENT WRONG
 * ───────────────
 * `maxHeight` sized the SVG alone. The toggles above it and the label row below
 * it — around 230pt of chrome — were then added on top. So a screen that
 * measured its space perfectly and handed the exact number over still got a card
 * ~150pt taller than the space it had given.
 *
 * Because the slot centres its content, that overflow went BOTH ways: the figure
 * ran off the bottom of the phone AND the card rode up over the screen's own
 * heading. On the pain step it covered "Which area is affected?" along with the
 * "Not sore" and "More than one area" controls; on the prehab step it covered
 * the title and pushed the confirm button below the fold.
 *
 * Both callers had grown magic reserve constants to compensate (46 on one, 78 on
 * the other) — guesses against a number only the component can know. Worse, the
 * prehab step wrapped itself in a ScrollView, and inside one of those a `flex: 1`
 * measuring wrapper resolves to whatever the content grew to rather than the
 * room left on screen. It measured diligently and the number meant nothing.
 *
 * THE FIX, AND WHY IT IS SHAPED THIS WAY
 * ──────────────────────────────────────
 * The component measures its own chrome as (whole component - figure). Summing
 * the parts was the first attempt and came out ~67pt short: there is more in
 * there than the two obvious rows, and any such list goes stale the moment
 * somebody adds one. The subtraction is invariant to the figure's own size, so
 * feeding it back into the budget settles immediately instead of oscillating.
 *
 * The onLayout handlers are attached UNCONDITIONALLY. Attaching them only when a
 * budget exists looks tidier and silently fails: callers measure their own space
 * first, so `maxHeight` arrives undefined on the first render and becomes a
 * number on the second — and a handler attached at that point never fires,
 * because onLayout reports layout CHANGES and the layout has already settled.
 * That mistake was made and caught here; hence the assertion.
 *
 * VERIFIED BY EYE on the running app at 390x844, both steps, before and after:
 * headings previously cut off are legible, both confirm buttons are on screen,
 * and nothing scrolls.
 */
import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const diagram = read('components/BodyDiagram.tsx');
const readiness = read('app/readiness.tsx');

console.log('\n[1] The budget accounts for the component, not just the figure');

check(
  'chrome is subtracted from the caller budget',
  /maxHeight != null\s*\r?\n?\s*\?\s*Math\.max\([\s\S]{0,80}?maxHeight - chromeH\)/.test(diagram),
  'without this, the caller measures its space perfectly and still overflows it'
);

check(
  'chrome is measured, not summed from a list of parts',
  /const chromeH = componentH > 0 && figureH > 0 \? Math\.max\(0, componentH - figureH\) : 0;/.test(
    diagram
  ),
  'adding up the toggle group and label row came out ~67pt short and goes stale when a row is added'
);

check(
  'the whole component reports its height',
  /const measureComponent = \(e: LayoutChangeEvent\) => setComponentH/.test(diagram),
  'one half of the subtraction'
);

check(
  'the figure reports its height',
  /onLayout=\{\(e\) => setFigureH\(e\.nativeEvent\.layout\.height\)\}/.test(diagram),
  'the other half'
);

check(
  'neither measurement is conditional on maxHeight',
  !/maxHeight != null\s*\r?\n?\s*\?\s*\(e\) => setFigureH/.test(diagram) &&
    !/maxHeight != null\s*\r?\n?\s*\?\s*\(e: LayoutChangeEvent\) => setComponentH/.test(diagram),
  'callers measure first, so maxHeight is undefined on render one - a handler attached on render two never fires, because the layout has already settled'
);

check(
  'the figure still cannot collapse below its tappable minimum',
  /Math\.max\(DIAGRAM_MIN_WIDTH \* DIAGRAM_ASPECT, maxHeight - chromeH\)/.test(diagram),
  'a small budget must shrink the figure, not make it untappable'
);

check(
  'an unconstrained caller is unaffected',
  /: screenHeight \* DIAGRAM_HEIGHT_SHARE;/.test(diagram),
  'the six callers that pass no maxHeight must keep their existing sizing'
);

console.log('\n[2] The screens hand over their real measurement');

check(
  'the pain step passes its measured space with no invented reserve',
  /const painDiagramMaxHeight = painDiagramAreaH > 0 \? painDiagramAreaH - 20 : undefined;/.test(
    readiness
  ),
  'the label-row reserve belonged to the component, which now measures it'
);

// This assertion used to pin a reserve for the sore/feels-fine question, and was
// wrong: the question is a SIBLING of the flex:1 wrapper that reports its own
// height, so flexbox has already removed the question's height from that
// measurement. Subtracting it again shrank the figure a second time, at the
// exact moment the user taps a region and most wants to check they hit the right
// one. The property that matters is that the budget does not depend on the
// selection at all.
check(
  'the prehab step passes its measured space, same as the pain step',
  /const prehabDiagramMaxHeight =\s*\r?\n?\s*prehabDiagramAreaH > 0 \? prehabDiagramAreaH - 20 : undefined;/.test(
    readiness
  ),
  'a reserve here is counted twice - flexbox has already taken the question out of the measurement'
);

check(
  'the figure budget does not change when a region is selected',
  !/prehabDiagramMaxHeight[\s\S]{0,120}?diagramPrehabRegion/.test(readiness),
  'the figure must not jump smaller the moment the user taps an area'
);

console.log('\n[3] Neither step can scroll');

check(
  'the prehab step is not wrapped in a ScrollView',
  !/key="prehabFocus"[\s\S]{0,400}?<ScrollView/.test(readiness),
  'inside a ScrollView the flex:1 measuring wrapper reports the content height, not the space left'
);

check(
  'the pain step is not either',
  !/key="painRegion"[\s\S]{0,400}?<ScrollView/.test(readiness),
  'it never was; this pins it'
);

check(
  'both steps measure their diagram area',
  /setPainDiagramAreaH\(e\.nativeEvent\.layout\.height\)/.test(readiness) &&
    /setPrehabDiagramAreaH\(e\.nativeEvent\.layout\.height\)/.test(readiness),
  'a step that does not measure falls back to a share of the screen and ignores its own layout'
);

console.log(`\ndiagram-fits-its-budget: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
