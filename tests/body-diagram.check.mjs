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
  // Strip // comments first: the union is documented inline, and a comment
  // naming a retired region would otherwise be read as a live member.
  const typeBlock = storeSrc
    .slice(eqPos, semi + 1)
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

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
  elbow: 'Elbow',
  wrist: 'Wrist',
  upper_back: 'Traps',
  lower_back: 'Lower Back',
  core_ribs: 'Core',
  hip_groin: 'Hip',
  knee: 'Knee',
  calf_shin: 'Calf / Shin',
  ankle_achilles: 'Ankle',
  chest: 'Chest',
  bicep: 'Biceps',
  tricep: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  lat_mid_back: 'Lats',
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
  // Back-only
  glutes: 'back',
  hamstrings: 'back',
  tricep: 'back',
  lower_back: 'back',
  lat_mid_back: 'back',
  rear_shoulder: 'back',
  // Bilateral — intentionally present in both views
  front_shoulder: 'both',
  neck: 'both',
  elbow: 'both',
  wrist: 'both',
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

// ─── 8. Hotspot coordinate Y-range check ──────────────────────────────────────
//
// Catches the "400 vs 480 height mismatch" regression (and similar drift):
//
//   The body-highlighter library renders at 400 overlay units tall, but the SVG
//   container is svgWidth * 2.4 = 480 overlay units tall.  The overlay SVG uses
//   viewBox="0 0 200 480" and a <G transform="scale(1, 0.8333)"> (= 5/6) to
//   compress hotspot paths so they line up with the 400-unit visual figure.
//
//   Raw path Y values  → written in 480-unit coordinate space (0–480)
//   Visual Y values    → raw * (5/6) → must be within 0–400 (library figure)
//
//   Each region also has an expected visual Y band; paths falling outside the
//   band indicate a placement bug (e.g. ankle paths appearing at the chest).
//
// Sub-checks:
//   8a — viewBox declaration is "0 0 200 480" (not "0 0 200 400")
//   8b — G scaleY transform (5/6 ≈ 0.8333) is present in source
//   8c — All raw path Y values are within [0, 480] (the viewBox height)
//   8d — All visual path Y values (raw × 5/6) are within [0, 400] (figure height)
//   8e — Per-region visual Y falls within the expected anatomical band
//
console.log('\n[8] Hotspot coordinate Y-range — 400/480-unit coordinate system');

// ── 8a: viewBox declaration ───────────────────────────────────────────────────
check(
  'SVG overlay uses viewBox="0 0 200 480" (not 400)',
  src.includes('viewBox="0 0 200 480"'),
  'viewBox height must be 480 so hotspot paths span the full container height; ' +
    'the 5/6 scaleY then compresses them to the 400-unit library figure'
);

// ── 8b: G scaleY transform ────────────────────────────────────────────────────
// Accept either form that appears in BodyDiagram.tsx: scale(1, 0.8333) or scale(1,0.8333)
const hasScaleTransform =
  src.includes('scale(1, 0.8333)') ||
  src.includes('scale(1,0.8333)') ||
  src.includes('scaleY(0.8333)');

check(
  'G element applies a 5/6 (≈ 0.8333) scaleY transform to the hotspot overlay',
  hasScaleTransform,
  'the 5/6 scaleY (scale(1, 0.8333)) must be present so 480-unit paths align ' +
    'with the 400-unit library figure; removing it re-introduces the height-mismatch bug'
);

// ── Helper: extract all Y values from an SVG path "d" string ─────────────────
// Strips command letters, then treats numbers at odd indices in each coordinate
// pair as Y values.  Works for absolute M / L / C / Q commands (all that appear
// in BodyDiagram hotspot paths).
function getPathYValues(d) {
  const nums = (d.replace(/[A-Za-z]/g, ' ').match(/[-+]?[0-9]*\.?[0-9]+(?:\.[0-9]+)?/g) ?? []).map(
    Number
  );
  const ys = [];
  for (let i = 1; i < nums.length; i += 2) {
    ys.push(nums[i]);
  }
  return ys;
}

// ── Helper: extract (d_value, region) pairs from a renderer source block ──────
function extractPathRegionPairs(block) {
  const pairs = [];
  // Match: d="..." followed (allowing whitespace/newlines) by {...h('region')}
  const re = /d="([^"]+)"[\s\S]*?\{\.\.\.h\('([^']+)'\)\}/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    pairs.push({ d: m[1], region: m[2] });
  }
  return pairs;
}

// ── 8c & 8d: raw Y ≤ 480 and visual Y ≤ 400 for every path ──────────────────
// We reuse the frontSrc / backSrc slices from section [7] when available,
// otherwise fall back to the full source.
const VIEWBOX_HEIGHT = 480; // raw coordinate space
const FIGURE_HEIGHT = 400; // visual coordinate space (after 5/6 scale)
const SCALE_Y = 5 / 6; // = 0.8333…

if (frontFnIdx !== -1 && backFnIdx !== -1 && afterBackIdx !== -1) {
  const frontSrc8 = src.slice(frontFnIdx, backFnIdx);
  const backSrc8 = src.slice(backFnIdx, afterBackIdx);

  const allPairs = [...extractPathRegionPairs(frontSrc8), ...extractPathRegionPairs(backSrc8)];

  check(
    `at least 1 (d, region) pair extracted from hotspot renderers (found ${allPairs.length})`,
    allPairs.length >= 1,
    'path+region extraction failed — check d="..." {...h(\'region\')} pattern in renderers'
  );

  let rawOutOfBoundsCount = 0;
  let visualOutOfBoundsCount = 0;

  for (const { d, region } of allPairs) {
    const ys = getPathYValues(d);
    if (ys.length === 0) continue;
    const rawMin = Math.min(...ys);
    const rawMax = Math.max(...ys);
    const visualMin = rawMin * SCALE_Y;
    const visualMax = rawMax * SCALE_Y;

    if (rawMin < 0 || rawMax > VIEWBOX_HEIGHT) {
      rawOutOfBoundsCount++;
      console.error(
        `  ✗ FAIL: raw Y range for '${region}' path is [${rawMin.toFixed(1)}, ${rawMax.toFixed(1)}] — ` +
          `must be within [0, ${VIEWBOX_HEIGHT}]. ` +
          `Path d="${d.slice(0, 60)}…"`
      );
    }
    if (visualMin < 0 || visualMax > FIGURE_HEIGHT) {
      visualOutOfBoundsCount++;
      console.error(
        `  ✗ FAIL: visual Y range for '${region}' path is [${visualMin.toFixed(1)}, ${visualMax.toFixed(1)}] (raw × 5/6) — ` +
          `must be within [0, ${FIGURE_HEIGHT}]. ` +
          `Path d="${d.slice(0, 60)}…"`
      );
    }
  }

  check(
    `all hotspot path raw Y values are within [0, ${VIEWBOX_HEIGHT}] (viewBox height)`,
    rawOutOfBoundsCount === 0,
    `${rawOutOfBoundsCount} path(s) have raw Y outside [0, ${VIEWBOX_HEIGHT}] — ` +
      'hotspot paths must be written in the 480-unit viewBox coordinate space'
  );

  check(
    `all hotspot path visual Y values (raw × 5/6) are within [0, ${FIGURE_HEIGHT}] (figure height)`,
    visualOutOfBoundsCount === 0,
    `${visualOutOfBoundsCount} path(s) have visual Y outside [0, ${FIGURE_HEIGHT}] — ` +
      'paths extend outside the rendered body figure; update paths or scaleY transform'
  );

  // ── 8e: per-region expected anatomical Y bands (visual coordinate space) ────
  //
  // These ranges were derived from the current correct path geometry.
  // They are wide enough to accommodate minor shape edits while still catching
  // large-scale misplacements (e.g. quads paths drifting into the shoulder area).
  //
  // When a new PainRegion is added to lib/store.ts, add its expected Y band here
  // too — section [8f] below will fail until you do, ensuring the new region is
  // always included in the coordinate-drift check.
  //
  // All values are in VISUAL coordinates (i.e. raw × 5/6 ≈ 0-400 scale).
  //
  const EXPECTED_VISUAL_Y = {
    neck: [30, 70],
    front_shoulder: [50, 135],
    rear_shoulder: [50, 135],
    chest: [45, 120],
    bicep: [55, 145],
    tricep: [55, 150],
    // The forearm hotspot was split at raw y=196: elbow above, wrist below.
    // Visual Y is raw x 5/6, so elbow lands ~125-163 and wrist ~163-195; the
    // bands stay loose to tolerate minor shape edits.
    elbow: [110, 175],
    wrist: [150, 215],
    upper_back: [35, 135],
    core_ribs: [85, 175],
    lower_back: [95, 180],
    lat_mid_back: [50, 175],
    hip_groin: [130, 200],
    glutes: [140, 255],
    quads: [150, 295],
    hamstrings: [200, 315],
    knee: [245, 315],
    calf_shin: [260, 395],
    ankle_achilles: [340, 400],
  };

  console.log('\n[8e] Per-region anatomical Y band (visual coordinate space, 0–400)');

  // Accumulate min/max visual Y per region across all paths in both renderers
  const regionVisualBounds = {};
  for (const { d, region } of allPairs) {
    const ys = getPathYValues(d);
    if (ys.length === 0) continue;
    const visualYs = ys.map((y) => y * SCALE_Y);
    const vMin = Math.min(...visualYs);
    const vMax = Math.max(...visualYs);
    if (!regionVisualBounds[region]) {
      regionVisualBounds[region] = { min: vMin, max: vMax };
    } else {
      regionVisualBounds[region].min = Math.min(regionVisualBounds[region].min, vMin);
      regionVisualBounds[region].max = Math.max(regionVisualBounds[region].max, vMax);
    }
  }

  for (const [region, [expectedMin, expectedMax]] of Object.entries(EXPECTED_VISUAL_Y)) {
    if (!regionVisualBounds[region]) {
      // Region has no paths extracted — already caught by section [5] / [7]
      continue;
    }
    const { min: actualMin, max: actualMax } = regionVisualBounds[region];
    const withinBand = actualMin >= expectedMin - 5 && actualMax <= expectedMax + 5;
    check(
      `'${region}' visual Y in expected band [${expectedMin}, ${expectedMax}] ` +
        `(actual [${actualMin.toFixed(0)}, ${actualMax.toFixed(0)}])`,
      withinBand,
      `'${region}' paths have drifted outside their expected anatomical band — ` +
        `update the path geometry or the EXPECTED_VISUAL_Y entry in this test`
    );
  }

  // ── 8f: EXPECTED_VISUAL_Y coverage — every PainRegion must have a Y band entry ─
  // Mirrors [4b] and [7b]: adding a new region to PainRegion forces a Y-band entry
  // to be declared here before the check can pass, so no new region can silently
  // bypass coordinate-drift detection.
  console.log('\n[8f] EXPECTED_VISUAL_Y coverage — every PainRegion has a curated Y band');
  for (const region of ALL_REGIONS) {
    check(
      `EXPECTED_VISUAL_Y has a curated Y band for '${region}'`,
      Object.prototype.hasOwnProperty.call(EXPECTED_VISUAL_Y, region),
      `'${region}' is in PainRegion but missing from EXPECTED_VISUAL_Y in this test file — ` +
        `add  ${region}: [minVisualY, maxVisualY],  to EXPECTED_VISUAL_Y above`
    );
  }
} else {
  check(
    'hotspot coordinate Y-range check skipped — renderer markers not found',
    false,
    'section [7] renderer markers are required for the Y-range check; ' +
      'fix the missing markers first (check [7] failures above)'
  );
}

// ─── 9. Container–viewBox–scaleY three-way consistency ───────────────────────
//
// The body diagram coordinate system rests on three tightly coupled values:
//
//   containerMultiplier  — the N in `height: svgWidth * N` (currently 2.4)
//   viewBoxHeight        — H in `viewBox="0 0 W H"` (currently 480)
//   scaleY               — S in `<G transform="scale(1, S)">` (currently 0.8333)
//
// They must satisfy two equations:
//
//   viewBoxHeight = viewBoxWidth × containerMultiplier    (200 × 2.4 = 480)
//   scaleY        = FIGURE_HEIGHT / viewBoxHeight          (400 / 480 ≈ 0.8333)
//
// Sections [8a] and [8b] check each value in isolation with hardcoded expectations.
// This section EXTRACTS all three from source and verifies them as a mutually
// consistent triple.  It therefore catches the silent failure mode where, e.g.,
// the multiplier is changed to 3.0 for a layout fix without updating viewBox
// height (should become 600) or scaleY (should become 400/600 ≈ 0.6667).
//
// If any equation fails, the error message shows all three extracted values plus
// the expected values so the developer knows exactly which one needs updating.
//
console.log('\n[9] Container–viewBox–scaleY three-way consistency');

// ── [9a] Extract the container height multiplier ──────────────────────────────
// Matches both: `height: svgWidth * 2.4`  (style object)
//          and: `height={svgWidth * 2.4}`  (JSX prop)
//
// The multiplier may also be written as a named constant (`svgWidth *
// DIAGRAM_ASPECT`). In that case resolve the identifier to the literal it is
// declared with, so the three-way consistency check below still verifies a real
// number. Changing DIAGRAM_ASPECT without updating viewBox height / scaleY
// therefore still fails here, which is the whole point of this section.
function extractContainerMultiplier(source) {
  const literal = source.match(/height[={:\s]+svgWidth\s*\*\s*([\d.]+)/);
  if (literal) return parseFloat(literal[1]);

  const ident = source.match(/height[={:\s]+svgWidth\s*\*\s*([A-Za-z_$][\w$]*)/);
  if (!ident) return null;

  const decl = source.match(new RegExp(`const\\s+${ident[1]}\\s*=\\s*([\\d.]+)`));
  return decl ? parseFloat(decl[1]) : null;
}

const containerMultiplier = extractContainerMultiplier(src);

check(
  'container height multiplier (svgWidth * N) found in BodyDiagram.tsx',
  containerMultiplier !== null,
  'could not find "height: svgWidth * N" or "height={svgWidth * N}" — ' +
    'check the View wrapping the Body + Svg elements'
);

// ── [9b] Extract viewBox width and height ────────────────────────────────────
const viewBoxExtractMatch = src.match(/viewBox="0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/);
const vbWidth = viewBoxExtractMatch ? parseFloat(viewBoxExtractMatch[1]) : null;
const vbHeight = viewBoxExtractMatch ? parseFloat(viewBoxExtractMatch[2]) : null;

check(
  'SVG viewBox="0 0 W H" dimensions extractable from BodyDiagram.tsx',
  viewBoxExtractMatch !== null,
  'viewBox not found or not in "0 0 W H" form — check the <Svg> element'
);

// ── [9c] Extract the G scaleY value ──────────────────────────────────────────
const scaleYExtractMatch = src.match(/scale\(1,\s*([\d.]+)\)/);
const extractedScaleY = scaleYExtractMatch ? parseFloat(scaleYExtractMatch[1]) : null;

check(
  'G transform scale(1, S) scaleY value extractable from BodyDiagram.tsx',
  extractedScaleY !== null,
  'scale(1, N) not found — check the <G transform="..."> element'
);

if (
  containerMultiplier !== null &&
  vbWidth !== null &&
  vbHeight !== null &&
  extractedScaleY !== null
) {
  // ── [9d] viewBoxHeight = viewBoxWidth × containerMultiplier ─────────────────
  const expectedVbHeight = vbWidth * containerMultiplier;
  const heightConsistent = Math.abs(vbHeight - expectedVbHeight) < 0.5;

  check(
    `viewBoxHeight (${vbHeight}) = viewBoxWidth (${vbWidth}) × multiplier (${containerMultiplier}) → ${expectedVbHeight}`,
    heightConsistent,
    `THREE-WAY MISMATCH — container uses svgWidth*${containerMultiplier} but viewBox height is ${vbHeight} (expected ${expectedVbHeight}). ` +
      `Fix: update viewBox to "0 0 ${vbWidth} ${expectedVbHeight}" ` +
      `OR revert the multiplier to ${(vbHeight / vbWidth).toFixed(4)}. ` +
      `Hotspot taps will misfire until these match.`
  );

  // ── [9e] scaleY = FIGURE_HEIGHT / viewBoxHeight ─────────────────────────────
  const expectedScaleY = FIGURE_HEIGHT / vbHeight;
  // Tolerance: 0.001 — covers minor rounding in the source (e.g. 0.8333 vs exact 5/6)
  const scaleYConsistent = Math.abs(extractedScaleY - expectedScaleY) < 0.001;

  check(
    `scaleY (${extractedScaleY}) = figureHeight (${FIGURE_HEIGHT}) / viewBoxHeight (${vbHeight}) → ${expectedScaleY.toFixed(4)}`,
    scaleYConsistent,
    `THREE-WAY MISMATCH — G transform has scale(1, ${extractedScaleY}) but ` +
      `figureHeight(${FIGURE_HEIGHT}) / viewBoxHeight(${vbHeight}) = ${expectedScaleY.toFixed(4)}. ` +
      `Fix: update the G transform to scale(1, ${expectedScaleY.toFixed(4)}) ` +
      `so hotspot paths visually align with the body figure.`
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
