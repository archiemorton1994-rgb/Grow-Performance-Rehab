/**
 * Contract test: the icon set has material, and the material does not eat it.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The badge medallions were rebuilt into struck metal and made every other
 * illustration in the app look like a placeholder beside them: one flat green,
 * occasionally at 0.3 opacity, no light, no surface. lib/icon-material.ts gives
 * the icon set the same vocabulary — a lit gradient, a deeper receding tone,
 * and a tile with a face, a rim and a gloss.
 *
 * THE BUG THIS FILE EXISTS TO PREVENT
 * ───────────────────────────────────
 * The first build of the gradient used SVG's default objectBoundingBox units. A
 * gradient in those units is UNDEFINED on any shape whose bounding box has zero
 * width or height, and such a shape does not degrade — it disappears. Every
 * straight line in the set is one. The dumbbell lost its bar, the clock lost
 * both hands, the flag lost its pole, the sun lost all eight rays, the rehab
 * shield lost its cross and the female symbol lost its stem and crossbar.
 *
 * Nothing looked broken. Six icons just quietly became simpler drawings. It was
 * caught by rasterising the set and looking at it, and section 2 below is what
 * stops it coming back.
 *
 * Everything here RUNS lib/icon-material.ts. The functions are pure and free of
 * react-native imports precisely so that a test can execute them instead of
 * pattern-matching the component that calls them.
 *
 * Run:  npx tsx tests/icon-material.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';

const M = await import('../lib/icon-material.ts');
const { GROW_ICONS } = await import('../lib/icon-art.ts');

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

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// The two theme accents, read off the palette rather than typed here, so a
// palette change is checked rather than missed.
const colorsSrc = read('constants/colors.ts');
const accents = [...colorsSrc.matchAll(/primaryText:\s*'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]);

// ─── 1. The ramps ────────────────────────────────────────────────────────────
console.log('\n[1] Every glyph is lit from somewhere');

check(
  `both theme accents were found (${accents.join(', ')})`,
  accents.length === 2,
  'the palette parse has gone stale and everything below it is testing nothing'
);

for (const accent of accents) {
  const stops = M.glyphStops(accent);
  check(
    `${accent}: the glyph ramp runs light to dark, not flat`,
    stops.length === 3 &&
      M.relativeLuminance(stops[0].color) > M.relativeLuminance(stops[2].color),
    stops.map((s) => s.color).join(' -> ')
  );
  check(
    `${accent}: the middle stop is the accent itself`,
    stops[1].color === accent,
    'the icon must still be the brand colour, just lit'
  );
  const deep = M.deepStops(accent);
  check(
    `${accent}: the deep ramp ends darker than the glyph ramp does`,
    M.relativeLuminance(deep[1].color) < M.relativeLuminance(stops[2].color),
    'the receding tone has to recede'
  );
}

// ─── 2. The straight lines are still there ───────────────────────────────────
console.log('\n[2] userSpaceOnUse — no icon silently loses a straight line');

/**
 * A shape whose bounding box has zero width or height. In objectBoundingBox
 * units these render as NOTHING when painted with a gradient.
 */
function isDegenerate(s) {
  if (s.k === 'circle') return false;
  if (s.k === 'rect') return s.w === 0 || s.h === 0;
  const nums = (s.d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  if (!xs.length || !ys.length) return false;
  return Math.max(...xs) === Math.min(...xs) || Math.max(...ys) === Math.min(...ys);
}

const atRisk = [];
for (const [name, shapes] of Object.entries(GROW_ICONS)) {
  const bad = shapes.filter(isDegenerate);
  if (bad.length) atRisk.push(`${name} (${bad.length})`);
}
check(
  `${atRisk.length} icon(s) contain a shape a bounding-box gradient would delete`,
  atRisk.length > 0,
  'if this ever reads 0 the check below is guarding nothing and the parse has broken'
);
console.log(`      at risk: ${atRisk.join(', ')}`);

check(
  'the glyph gradient is declared in userSpaceOnUse coordinates',
  M.GLYPH_GRADIENT_BOX.x1 >= 0 &&
    M.GLYPH_GRADIENT_BOX.x2 <= M.ICON_BOX &&
    M.GLYPH_GRADIENT_BOX.x2 > M.GLYPH_GRADIENT_BOX.x1 &&
    M.GLYPH_GRADIENT_BOX.y2 > M.GLYPH_GRADIENT_BOX.y1,
  'coordinates over the 48 box, not percentages of each shape'
);

const iconSrc = stripComments(read('components/GrowIcon.tsx'));
check(
  'and the renderer actually passes gradientUnits="userSpaceOnUse"',
  (iconSrc.match(/gradientUnits="userSpaceOnUse"/g) ?? []).length >= 2,
  'both the glyph ramp and the deep ramp need it; the tile face does not, it is a full-box rect'
);
check(
  'the renderer feeds those coordinates from GLYPH_GRADIENT_BOX, not literals',
  /const g = GLYPH_GRADIENT_BOX;/.test(iconSrc) && /x1=\{g\.x1\}/.test(iconSrc),
  'a hardcoded x1 here and a constant there is two sources of truth for one light source'
);

// ─── 3. The depth tone recedes without vanishing ─────────────────────────────
console.log('\n[3] The receding tone still has mass');

check(
  'a 0.3 wash comes back up, but not to solid',
  M.deepToneOpacity(0.3) > 0.3 && M.deepToneOpacity(0.3) < 0.8,
  `got ${M.deepToneOpacity(0.3)}`
);
check(
  'authored order is preserved: a fainter shape stays fainter',
  M.deepToneOpacity(0.22) < M.deepToneOpacity(0.35) &&
    M.deepToneOpacity(0.35) < M.deepToneOpacity(0.6),
  'flattening every depth shape to one alpha turned the celebration tick into a dark disc'
);
check(
  'nothing ever reaches full opacity by this path',
  M.deepToneOpacity(1) <= 0.78 && M.deepToneOpacity(0.62) <= 0.78,
  'a receding shape at alpha 1 is not receding'
);
check(
  'the chart glyph\'s middle bar counts as receding',
  M.isDeepTone(0.6),
  'chart authors its middle bar at 0.6 and it is a background element'
);
check(
  'a shape with no authored opacity is not treated as receding',
  !M.isDeepTone(undefined),
  'the main mass of every icon has no `o` at all'
);

// ─── 4. Face ink is legible on the glyph it sits on ──────────────────────────
console.log('\n[4] The tick on the seal can actually be seen');

function contrast(a, b) {
  const la = M.relativeLuminance(a);
  const lb = M.relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
for (const accent of accents) {
  const ratio = contrast(M.faceInkFor(accent), accent);
  check(
    `${accent}: face ink reaches ${ratio.toFixed(1)}:1 against the glyph beneath it`,
    ratio >= 4.5,
    'the check seal draws its tick straight onto its own face; below 4.5:1 it disappears into it'
  );
}
check(
  'face ink is a tint of the accent, not plain white or plain black',
  accents.every((a) => !['#ffffff', '#000000'].includes(M.faceInkFor(a).toLowerCase())),
  'a pure white tick on a brand-green medal looks like a sticker'
);

// ─── 5. Gradient ids cannot collide with different content ───────────────────
console.log('\n[5] One document, many icons, no crossed gradients');

check(
  'two different colours get two different ids',
  M.gradientId('gi', '#4ade80') !== M.gradientId('gi', '#2f6b46'),
  'on web every icon on a screen lands in one DOM'
);
check(
  'the same colour gets the same id, so any duplicate is byte-identical',
  M.gradientId('gi', '#4ade80') === M.gradientId('gi', '#4ade80'),
  ''
);
check(
  'ids survive a colour written with different punctuation',
  /^[A-Za-z][\w-]*$/.test(M.gradientId('gi', '#4ade80')),
  'an id starting with a digit or containing # is not a valid CSS selector target'
);

// ─── 6. shade() does not produce nonsense ────────────────────────────────────
console.log('\n[6] The colour maths is total');

check('lightening moves toward white', M.relativeLuminance(M.shade('#2f6b46', 0.5)) > M.relativeLuminance('#2f6b46'), '');
check('darkening moves toward black', M.relativeLuminance(M.shade('#4ade80', -0.5)) < M.relativeLuminance('#4ade80'), '');
check('shorthand hex is understood', M.shade('#4a8', 0) === '#44aa88', M.shade('#4a8', 0));
check(
  'a non-hex colour is returned untouched rather than turned into #NaNNaNNaN',
  M.shade('rgba(0,0,0,0.5)', 0.3) === 'rgba(0,0,0,0.5)',
  'a theme token that is ever an rgba string must tint nothing, not take the icon down'
);
check(
  'full lightening is white and full darkening is black',
  M.shade('#4ade80', 1) === '#ffffff' && M.shade('#4ade80', -1) === '#000000',
  ''
);

// ─── 7. The tile is a surface, not a second glyph ────────────────────────────
console.log('\n[7] The tile holds the icon rather than competing with it');

for (const face of ['#e8f2ec', '#1a3d28', '#eef0ef', '#252525']) {
  const ink = M.tileInk(face);
  check(
    `${face}: the lit edge is lighter than the shaded edge`,
    M.relativeLuminance(ink.faceLight) > M.relativeLuminance(ink.faceDark),
    ''
  );
  const spread = Math.abs(M.relativeLuminance(ink.faceLight) - M.relativeLuminance(ink.faceDark));
  check(
    `${face}: and the spread stays under a quarter (${spread.toFixed(3)})`,
    spread < 0.25,
    'widen this and the tile starts reading as the picture'
  );
}
check(
  'the glyph is inset far enough to clear the rim and the gloss',
  M.TILE_GLYPH_INSET > M.TILE_BOX * 0.2 && M.TILE_GLYPH_INSET < M.TILE_BOX * 0.35,
  `inset is ${M.TILE_GLYPH_INSET} of ${M.TILE_BOX}`
);

// ─── 8. Small icons opt out ──────────────────────────────────────────────────
console.log('\n[8] Chrome-sized icons stay flat');

check(
  'the material threshold sits above the smallest illustrative use',
  M.MATERIAL_MIN_SIZE >= 17 && M.MATERIAL_MIN_SIZE <= 24,
  `a three-stop ramp across ${M.MATERIAL_MIN_SIZE}px is banding, not light`
);
check(
  'and the renderer honours it',
  /const material = size >= MATERIAL_MIN_SIZE;/.test(iconSrc),
  ''
);

// ─── 9. Nothing on the first-run path is a borrowed glyph any more ───────────
console.log('\n[9] The first-run screens draw their own illustrations');

const CONTROLS = /chevron-|arrow-|^checkmark$|close|lock-closed|ellipsis|search|information-circle/;
for (const file of ['app/showcase.tsx', 'app/offer.tsx']) {
  const src = stripComments(read(file));
  const big = [...src.matchAll(/<Ionicons[\s\S]{0,160}?name=[{"']([a-z-]+)[}"'][\s\S]{0,90}?size=\{(\d+)\}/g)]
    .filter(([, n, s]) => Number(s) >= 28 && !CONTROLS.test(n))
    .map(([, n, s]) => `${n}@${s}`);
  check(
    `${file}: no Ionicon standing in as illustration`,
    big.length === 0,
    big.join(', ')
  );
}
check(
  'the showcase and the offer both draw their glyph on a lit tile',
  /GrowIconTile/.test(read('app/showcase.tsx')) && /GrowIconTile/.test(read('app/offer.tsx')),
  'these are the two screens between finishing onboarding and being asked to pay'
);
check(
  'the tour invitation does too',
  /GrowIconTile/.test(read('app/(tabs)/_layout.tsx')),
  ''
);

console.log('');
if (failures > 0) {
  console.error(`icon-material: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`icon-material: all ${total} checks passed\n`);
  process.exitCode = 0;
}
