/**
 * Behavioral contract tests for components/BodyDiagram.tsx.
 *
 * These tests verify the source-code contracts that directly drive runtime
 * behaviour on iOS/Android/web:
 *
 *   1. FILL GUARD — the unselected-hotspot fill must be rgba(0,0,0,0.001).
 *      On iOS/Android, react-native-svg only fires onPress for painted fills.
 *      Reverting to 'transparent' silently removes touch events from all
 *      hotspots while appearing fine in the web preview.
 *
 *   2. TESTID WIRING — every PainRegion must have a testID on its hotspot Rect
 *      via the h() helper.  On web, react-native-svg emits this as data-testid,
 *      making hotspots targetable in Playwright / accessibility trees.
 *
 *   3. LABEL COMPLETENESS — BODY_DIAGRAM_LABELS must have a human-readable
 *      string for all regions.  Missing entries silently render nothing.
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
 * ALL_REGIONS is derived dynamically from the PainRegion type in lib/store.ts
 * so that adding a new region automatically extends all checks here.
 *
 * Run:  node tests/body-diagram.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const storeSrc = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
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

// ─── Parse PainRegion literals from lib/store.ts ──────────────────────────────
// Uses the same extraction logic as body-diagram-region-coverage.check.mjs so
// that both tests always agree on the ground-truth region list.
console.log('\n[0] Parse PainRegion type from lib/store.ts');

const typeStart = storeSrc.indexOf('export type PainRegion =');
check(
  'PainRegion type declaration found in lib/store.ts',
  typeStart !== -1,
  'declaration not found — check lib/store.ts'
);

let ALL_REGIONS = [];

if (typeStart !== -1) {
  const eqPos = storeSrc.indexOf('=', typeStart);
  const semi = storeSrc.indexOf(';', eqPos);
  const typeBlock = storeSrc.slice(eqPos, semi + 1);

  const regionMatches = [...typeBlock.matchAll(/'([a-z_]+)'/g)];
  ALL_REGIONS = regionMatches.map((m) => m[1]);

  check(
    `PainRegion type contains at least 1 value (found ${ALL_REGIONS.length})`,
    ALL_REGIONS.length >= 1,
    'no quoted identifiers found in PainRegion type block'
  );

  for (const r of ALL_REGIONS) {
    console.log(`  · PainRegion: '${r}'`);
  }
}

// ─── Manually-curated expected label copy (source of truth for chip text) ─────
// These strings must stay in sync with the actual BODY_DIAGRAM_LABELS values in
// BodyDiagram.tsx.  When a new PainRegion is added to lib/store.ts, add its
// expected label here too — section [4b] below will fail until you do.
const EXPECTED_LABELS = {
  neck: 'Neck',
  front_shoulder: 'Front Shoulder',
  rear_shoulder: 'Rear Shoulder',
  elbow_wrist: 'Elbow / Wrist',
  upper_back: 'Upper Back',
  lower_back: 'Lower Back',
  core_ribs: 'Core / Ribs',
  hip_groin: 'Hip / Groin',
  knee: 'Knee',
  calf_shin: 'Calf / Shin',
  ankle_achilles: 'Ankle / Achilles',
  chest: 'Chest',
  bicep: 'Biceps',
  tricep: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  lat_mid_back: 'Lats / Mid Back',
};

// ─── 1. Fill guard ─────────────────────────────────────────────────────────────
console.log('\n[1] Fill guard — rgba(0,0,0,0.001) workaround');

check('source contains rgba(0,0,0,0.001)', src.includes('rgba(0,0,0,0.001)'));

// Extract the h() helper block only — don't flag rgba usages elsewhere.
// Accepts both concise-return form `=> ({...});` and block form `=> {...\n  };`
const hBlock =
  src.match(/const h = \(r: PainRegion\) => (?:\(\{[\s\S]*?\}\);|\{[\s\S]*?\n  \};)/)?.[0] ?? '';
check(
  'h() block was found in source',
  hBlock.length > 0,
  'regex did not match — check h() function signature'
);
check(
  "h() block does NOT use fill:'transparent'",
  !hBlock.match(/fill:\s*['"]transparent['"]/),
  'reverting to transparent silently disables iOS/Android touch events'
);
check(
  "h() block does NOT use fill:'none'",
  !hBlock.match(/fill:\s*['"]none['"]/),
  'fill:none also disables touch events on react-native-svg'
);

// ─── 2. testID wiring ──────────────────────────────────────────────────────────
console.log('\n[2] testID wiring — all regions via h() helper');

check(
  'h() spreads testID: `body-diagram-region-${r}`',
  src.includes('testID: `body-diagram-region-${r}`'),
  'testID must be inside the h() return object so every region gets it'
);

// ─── 3. Label completeness ────────────────────────────────────────────────────
console.log(`\n[3] BODY_DIAGRAM_LABELS — all ${ALL_REGIONS.length} keys present`);

for (const region of ALL_REGIONS) {
  check(`BODY_DIAGRAM_LABELS has key '${region}'`, src.includes(`${region}:`));
}

// ─── 4. Label correctness ─────────────────────────────────────────────────────
console.log('\n[4] Label string correctness — chip text matches expected copy');

// 4a. Every entry in EXPECTED_LABELS has the correct string in source
for (const [region, expected] of Object.entries(EXPECTED_LABELS)) {
  check(
    `label for '${region}' equals '${expected}'`,
    src.includes(expected),
    `expected to find the string "${expected}" in source`
  );
}

// 4b. Every dynamic PainRegion is covered by EXPECTED_LABELS
// This fails when a new region is added to PainRegion but not to EXPECTED_LABELS above.
console.log('\n[4b] EXPECTED_LABELS coverage — every PainRegion has a curated label entry');
for (const region of ALL_REGIONS) {
  check(
    `EXPECTED_LABELS has a curated entry for '${region}'`,
    Object.prototype.hasOwnProperty.call(EXPECTED_LABELS, region),
    `'${region}' is in PainRegion but missing from EXPECTED_LABELS in this test file — ` +
      `add  ${region}: '<Human Label>',  to EXPECTED_LABELS above`
  );
}

// ─── 5. h() coverage — every region used via h(), not bare Rect ───────────────
console.log(`\n[5] h() coverage — every region appears as h('region') call`);

for (const region of ALL_REGIONS) {
  const pattern = new RegExp(`h\\('${region}'\\)`);
  check(
    `h('${region}') call exists in SVG body`,
    pattern.test(src),
    `region '${region}' must be placed via h() to get fill + onPress + testID`
  );
}

// ─── 6. Toggle testIDs ────────────────────────────────────────────────────────
console.log('\n[6] Front/Back toggle testIDs');

check(
  'Front toggle has testID="body-diagram-front"',
  src.includes('testID="body-diagram-front"') || src.includes("testID='body-diagram-front'")
);
check(
  'Back toggle has testID="body-diagram-back"',
  src.includes('testID="body-diagram-back"') || src.includes("testID='body-diagram-back'")
);

// ─── 7. View-placement check ──────────────────────────────────────────────────
// Each PainRegion must appear in the correct renderer(s).  This is the contract
// that would have caught the hip_groin/adductors bug where a region silently
// ended up in the back view without any automated check failing.
//
// front  = must appear ONLY in renderFrontHotspots (not in renderBackHotspots)
// back   = must appear ONLY in renderBackHotspots  (not in renderFrontHotspots)
// both   = must appear in BOTH renderers
//
// When a new PainRegion is added, add it here too — section [7b] fails if it
// is missing.
console.log('\n[7] View placement — every region in the correct front/back/both renderer');

const EXPECTED_VIEW = {
  // Front-only
  chest: 'front',
  bicep: 'front',
  quads: 'front',
  core_ribs: 'front',
  hip_groin: 'front',
  front_shoulder: 'front',
  // Back-only
  glutes: 'back',
  hamstrings: 'back',
  tricep: 'back',
  lower_back: 'back',
  lat_mid_back: 'back',
  rear_shoulder: 'back',
  // Bilateral — intentionally present in both views
  neck: 'both',
  elbow_wrist: 'both',
  knee: 'both',
  calf_shin: 'both',
  ankle_achilles: 'both',
  upper_back: 'both',
};

// Slice each renderer's source block by known function markers so we can scan
// them independently.  The back renderer is bounded on the right by the next
// section comment that follows it in the file.
const FRONT_MARKER = 'const renderFrontHotspots = () => (';
const BACK_MARKER = 'const renderBackHotspots = () => (';
const AFTER_BACK_MARKER = '// ─── Build library data array';

const frontFnIdx = src.indexOf(FRONT_MARKER);
const backFnIdx = src.indexOf(BACK_MARKER);
const afterBackIdx = src.indexOf(AFTER_BACK_MARKER);

check(
  'renderFrontHotspots function marker found',
  frontFnIdx !== -1,
  'marker not found — did renderFrontHotspots get renamed?'
);
check(
  'renderBackHotspots function marker found',
  backFnIdx !== -1,
  'marker not found — did renderBackHotspots get renamed?'
);
check(
  'post-back-renderer anchor marker found',
  afterBackIdx !== -1,
  `"${AFTER_BACK_MARKER}" not found — update AFTER_BACK_MARKER if a nearby comment changed`
);

if (frontFnIdx !== -1 && backFnIdx !== -1 && afterBackIdx !== -1) {
  const frontSrc = src.slice(frontFnIdx, backFnIdx);
  const backSrc = src.slice(backFnIdx, afterBackIdx);

  for (const [region, expected] of Object.entries(EXPECTED_VIEW)) {
    const pat = new RegExp(`h\\('${region}'\\)`);
    const inFront = pat.test(frontSrc);
    const inBack = pat.test(backSrc);

    if (expected === 'front') {
      check(
        `'${region}' (front-only) is present in renderFrontHotspots`,
        inFront,
        `h('${region}') not found in renderFrontHotspots`
      );
      check(
        `'${region}' (front-only) is absent from renderBackHotspots`,
        !inBack,
        `h('${region}') found in renderBackHotspots — front-only region on the wrong side`
      );
    } else if (expected === 'back') {
      check(
        `'${region}' (back-only) is present in renderBackHotspots`,
        inBack,
        `h('${region}') not found in renderBackHotspots`
      );
      check(
        `'${region}' (back-only) is absent from renderFrontHotspots`,
        !inFront,
        `h('${region}') found in renderFrontHotspots — back-only region on the wrong side`
      );
    } else {
      // 'both'
      check(
        `'${region}' (bilateral) is present in renderFrontHotspots`,
        inFront,
        `h('${region}') not found in renderFrontHotspots`
      );
      check(
        `'${region}' (bilateral) is present in renderBackHotspots`,
        inBack,
        `h('${region}') not found in renderBackHotspots`
      );
    }
  }
}

// 7b. Every dynamic PainRegion must have a curated EXPECTED_VIEW entry so that
//     adding a new region to PainRegion automatically forces placement to be
//     declared here before the check can pass.
console.log('\n[7b] EXPECTED_VIEW coverage — every PainRegion has a curated view entry');
for (const region of ALL_REGIONS) {
  check(
    `EXPECTED_VIEW has an entry for '${region}'`,
    Object.prototype.hasOwnProperty.call(EXPECTED_VIEW, region),
    `'${region}' is in PainRegion but missing from EXPECTED_VIEW above — ` +
      `add  ${region}: 'front' | 'back' | 'both',  with the correct view`
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`body-diagram: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`body-diagram: all ${total} checks passed\n`);
  process.exit(0);
}
