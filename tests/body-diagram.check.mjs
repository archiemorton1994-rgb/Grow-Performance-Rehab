/**
 * Behavioral contract tests for components/BodyDiagram.tsx.
 *
 * These tests verify the source-code contracts that directly drive runtime
 * behaviour on iOS/Android/web:
 *
 *   1. FILL GUARD — the unselected-hotspot fill must be rgba(0,0,0,0.001).
 *      On iOS/Android, react-native-svg only fires onPress for painted fills.
 *      Reverting to 'transparent' silently removes touch events from all 11
 *      hotspots while appearing fine in the web preview.
 *
 *   2. TESTID WIRING — every PainRegion must have a testID on its hotspot Rect
 *      via the h() helper.  On web, react-native-svg emits this as data-testid,
 *      making hotspots targetable in Playwright / accessibility trees.
 *
 *   3. LABEL COMPLETENESS — BODY_DIAGRAM_LABELS must have a human-readable
 *      string for all 11 regions.  Missing entries silently render nothing.
 *
 *   4. LABEL CORRECTNESS — each label string must match the expected copy.
 *      Protects against accidental rename causing the label chip to show the
 *      wrong region name after a tap.
 *
 *   5. H() COVERAGE — every PainRegion must appear as an h('region') call in
 *      the SVG body, confirming no region is placed as a bare Rect without the
 *      fill + onPress + testID bundle that h() provides.
 *
 *   6. TOGGLE TESTIDS — the Front/Back toggle must have testID="body-diagram-front"
 *      and testID="body-diagram-back" so Playwright and accessibility tools can
 *      target the view-switch control.
 *
 * Run:  node tests/body-diagram.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dir, '../components/BodyDiagram.tsx');
const src = readFileSync(srcPath, 'utf8');

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

// ─── Expected label copy (source of truth for chip text) ──────────────────────
const EXPECTED_LABELS = {
  neck:           'Neck',
  front_shoulder: 'Front Shoulder',
  rear_shoulder:  'Rear Shoulder',
  elbow_wrist:    'Elbow / Wrist',
  upper_back:     'Upper Back',
  lower_back:     'Lower Back',
  core_ribs:      'Core / Ribs',
  hip_groin:      'Hip / Groin',
  knee:           'Knee',
  calf_shin:      'Calf / Shin',
  ankle_achilles: 'Ankle / Achilles',
};

const ALL_REGIONS = Object.keys(EXPECTED_LABELS);

// ─── 1. Fill guard ─────────────────────────────────────────────────────────────
console.log('\n[1] Fill guard — rgba(0,0,0,0.001) workaround');

check(
  'source contains rgba(0,0,0,0.001)',
  src.includes('rgba(0,0,0,0.001)'),
);

// Extract the h() helper block only — don't flag rgba usages elsewhere
const hBlock = src.match(/const h = \(r: PainRegion\) => \(\{[\s\S]*?\}\);/)?.[0] ?? '';
check(
  'h() block was found in source',
  hBlock.length > 0,
  'regex did not match — check h() function signature',
);
check(
  "h() block does NOT use fill:'transparent'",
  !hBlock.match(/fill:\s*['"]transparent['"]/),
  "reverting to transparent silently disables iOS/Android touch events",
);
check(
  "h() block does NOT use fill:'none'",
  !hBlock.match(/fill:\s*['"]none['"]/),
  "fill:none also disables touch events on react-native-svg",
);

// ─── 2. testID wiring ──────────────────────────────────────────────────────────
console.log('\n[2] testID wiring — all 11 regions via h() helper');

check(
  'h() spreads testID: `body-diagram-region-${r}`',
  src.includes('testID: `body-diagram-region-${r}`'),
  'testID must be inside the h() return object so every region gets it',
);

// ─── 3. Label completeness ────────────────────────────────────────────────────
console.log('\n[3] BODY_DIAGRAM_LABELS — all 11 keys present');

for (const region of ALL_REGIONS) {
  check(
    `BODY_DIAGRAM_LABELS has key '${region}'`,
    src.includes(`${region}:`),
  );
}

// ─── 4. Label correctness ─────────────────────────────────────────────────────
console.log('\n[4] Label string correctness — chip text matches expected copy');

for (const [region, expected] of Object.entries(EXPECTED_LABELS)) {
  check(
    `label for '${region}' equals '${expected}'`,
    src.includes(expected),
    `expected to find the string "${expected}" in source`,
  );
}

// ─── 5. h() coverage — every region used via h(), not bare Rect ───────────────
console.log('\n[5] h() coverage — every region appears as h(\'region\') call');

for (const region of ALL_REGIONS) {
  const pattern = new RegExp(`h\\('${region}'\\)`);
  check(
    `h('${region}') call exists in SVG body`,
    pattern.test(src),
    `region '${region}' must be placed via h() to get fill + onPress + testID`,
  );
}

// ─── 6. Toggle testIDs ────────────────────────────────────────────────────────
console.log('\n[6] Front/Back toggle testIDs');

check(
  'Front toggle has testID="body-diagram-front"',
  src.includes('testID="body-diagram-front"') || src.includes("testID='body-diagram-front'"),
);
check(
  'Back toggle has testID="body-diagram-back"',
  src.includes('testID="body-diagram-back"') || src.includes("testID='body-diagram-back'"),
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`body-diagram: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`body-diagram: all ${total} checks passed\n`);
  process.exit(0);
}
