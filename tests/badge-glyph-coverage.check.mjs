/**
 * Contract test: the badge artwork is complete, distinct, and fits the medal.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Badges used to be drawn with Ionicons. Forty-seven glyphs covered 277 badges
 * and `trophy-outline` alone appeared thirty-seven times across NINE unrelated
 * families, so a Recovery badge, a Test Week badge and a Duration badge were
 * the same picture. The replacement — one drawing per family, in
 * lib/badge-art.ts — only stays better if three things hold, and none of them
 * are visible in a diff:
 *
 *  1. COVERAGE  — a family with no drawing renders an empty medallion. Adding a
 *                 BadgeCategory is a one-line change in lib/badges.ts and it is
 *                 very easy to forget the art.
 *  2. DISTINCT  — two families sharing a drawing is the exact failure we just
 *                 spent a release undoing.
 *  3. FITS      — the glyph is inset into a 38-unit-radius face. Geometry that
 *                 strays past that is clipped by, or collides with, the rim.
 *                 Caught session_upper's overhead bar during authoring.
 *
 * Also checks the metals: every tier needs one, and the glyph ink has to hold
 * against the near-white medal face. Silver is the trap — the tier colour
 * #9BA6AE on a white face is 2.1:1, which is why Metal carries a separate,
 * darker `glyph` value rather than reusing the tier colour.
 *
 * Run:  node tests/badge-glyph-coverage.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const { BADGE_GLYPHS, BADGE_ID_GLYPHS, TIER_METALS, LOCKED_METAL } = await import(
  '../lib/badge-art.ts'
);
const { BADGE_CATEGORY_LABELS, BADGE_TIER_COLORS, BADGE_CATALOG } = await import('../lib/badges.ts');

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

// ─── 1. Coverage ──────────────────────────────────────────────────────────────
console.log('\n[1] Coverage — every badge family has a drawing');

const categories = Object.keys(BADGE_CATEGORY_LABELS);
const missing = categories.filter((c) => !BADGE_GLYPHS[c] || BADGE_GLYPHS[c].length === 0);
check(
  `all ${categories.length} badge families have a glyph`,
  missing.length === 0,
  missing.length ? `no artwork for: ${missing.join(', ')}` : ''
);

const orphan = Object.keys(BADGE_GLYPHS).filter((c) => !categories.includes(c));
check(
  'no artwork for a family that no longer exists',
  orphan.length === 0,
  orphan.length ? `stale: ${orphan.join(', ')}` : ''
);

// Every badge in the catalogue must resolve to a drawing.
const unresolvable = [...new Set(BADGE_CATALOG.filter((b) => !BADGE_GLYPHS[b.category]).map((b) => b.category))];
check(
  `all ${BADGE_CATALOG.length} badges resolve to a drawing`,
  unresolvable.length === 0,
  unresolvable.length ? `categories with no art: ${unresolvable.join(', ')}` : ''
);

// ─── 2. Distinctness ──────────────────────────────────────────────────────────
console.log('\n[2] Distinctness — no two families are the same picture');

const byShape = new Map();
for (const [cat, shapes] of Object.entries(BADGE_GLYPHS)) {
  const key = JSON.stringify(shapes);
  const list = byShape.get(key) ?? [];
  list.push(cat);
  byShape.set(key, list);
}
const shared = [...byShape.values()].filter((l) => l.length > 1);
check(
  'every family has its own drawing',
  shared.length === 0,
  shared.length ? shared.map((l) => l.join(' = ')).join('; ') : ''
);

// Per-badge drawings exist to tell badges within one family apart. Two of them
// being identical defeats the entire point of overriding the family glyph.
const byOwnShape = new Map();
for (const [id, shapes] of Object.entries(BADGE_ID_GLYPHS)) {
  const key = JSON.stringify(shapes);
  const list = byOwnShape.get(key) ?? [];
  list.push(id);
  byOwnShape.set(key, list);
}
const sharedOwn = [...byOwnShape.values()].filter((l) => l.length > 1);
check(
  `all ${Object.keys(BADGE_ID_GLYPHS).length} per-badge drawings are distinct`,
  sharedOwn.length === 0,
  sharedOwn.length ? sharedOwn.map((l) => l.join(' = ')).join('; ') : ''
);

// A per-badge drawing keyed to an id that no longer exists is dead art, and —
// worse — silently means the badge it was meant for shows the family glyph.
const catalogIds = new Set(BADGE_CATALOG.map((b) => b.id));
const danglingIds = Object.keys(BADGE_ID_GLYPHS).filter((id) => !catalogIds.has(id));
check(
  'every per-badge drawing maps to a badge that exists',
  danglingIds.length === 0,
  danglingIds.length ? `no such badge: ${danglingIds.join(', ')}` : ''
);

// ─── 3. Fit ───────────────────────────────────────────────────────────────────
console.log('\n[3] Fit — no geometry strays outside the medallion face');

// Mirrors components/BadgeMedallion.tsx: the 48-unit glyph box is scaled to 50
// and centred in a 100-unit medal whose face has radius 38. Rotation in the art
// data is always about the glyph centre, so it cannot change a point's distance
// from that centre and is ignored here.
const GLYPH_BOX = 48;
const GLYPH_SCALE = 50 / GLYPH_BOX;
const FACE_R = 38;
const CENTRE = GLYPH_BOX / 2;
/** Max distance from the glyph centre, in glyph units, that still lands on the face. */
const MAX_R = FACE_R / GLYPH_SCALE;

/** Coordinate pairs a path command actually lands on or bends through. */
function pathPoints(d) {
  const points = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let cursor = [0, 0];
  let m;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    const nums = (m[2].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const upper = cmd.toUpperCase();
    if (upper === 'Z') continue;
    // Arcs carry five non-coordinate parameters before the endpoint; everything
    // else is coordinate pairs (H/V are single values on one axis).
    const stride = upper === 'A' ? 7 : upper === 'H' || upper === 'V' ? 1 : 2;
    for (let i = 0; i + stride <= nums.length; i += stride) {
      const chunk = nums.slice(i, i + stride);
      if (upper === 'H') cursor = [chunk[0], cursor[1]];
      else if (upper === 'V') cursor = [cursor[0], chunk[0]];
      else if (upper === 'A') cursor = [chunk[5], chunk[6]];
      else {
        // C/S/Q/T control points are inside the hull of the curve, so bounding
        // them bounds the curve.
        for (let j = 0; j + 1 < chunk.length; j += 2) points.push([chunk[j], chunk[j + 1]]);
        cursor = [chunk[chunk.length - 2], chunk[chunk.length - 1]];
      }
      points.push([...cursor]);
    }
  }
  return points;
}

function shapeRadius(s) {
  const pad = (s.stroke ? (s.sw ?? 1) / 2 : 0) + (s.k === 'circle' ? s.r : 0);
  let pts;
  if (s.k === 'circle') pts = [[s.cx, s.cy]];
  else if (s.k === 'rect')
    pts = [
      [s.x, s.y],
      [s.x + s.w, s.y],
      [s.x, s.y + s.h],
      [s.x + s.w, s.y + s.h],
    ];
  else pts = pathPoints(s.d);
  let max = 0;
  for (const [x, y] of pts) {
    const r = Math.hypot(x - CENTRE, y - CENTRE) + pad;
    if (r > max) max = r;
  }
  return max;
}

const overflowing = [];
for (const [name, shapes] of [
  ...Object.entries(BADGE_GLYPHS),
  ...Object.entries(BADGE_ID_GLYPHS),
]) {
  let worst = 0;
  for (const s of shapes) worst = Math.max(worst, shapeRadius(s));
  if (worst > MAX_R) overflowing.push(`${name} reaches ${worst.toFixed(1)} of ${MAX_R.toFixed(1)}`);
}
check(
  `all artwork fits inside the ${FACE_R}-unit medal face`,
  overflowing.length === 0,
  overflowing.join('; ')
);

// ─── 4. Metals ────────────────────────────────────────────────────────────────
console.log('\n[4] Metals — every tier is struck, and the ink holds on the face');

const tiers = Object.keys(BADGE_TIER_COLORS);
const noMetal = tiers.filter((t) => !TIER_METALS[t]);
check(
  `all ${tiers.length} tiers have a metal`,
  noMetal.length === 0,
  noMetal.length ? `missing: ${noMetal.join(', ')}` : ''
);

function luminance(hex) {
  const h = hex.replace('#', '');
  const parts = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// 3:1 is the WCAG minimum for a graphical object to be perceivable.
const MIN_CONTRAST = 3;
const weak = [];
for (const [tier, metal] of [...Object.entries(TIER_METALS), ['locked', LOCKED_METAL]]) {
  for (const stop of metal.face) {
    const ratio = contrast(metal.glyph, stop);
    // Locked badges are deliberately quiet, but must still be readable enough
    // to tell one grey medal from another.
    const floor = tier === 'locked' ? 1.6 : MIN_CONTRAST;
    if (ratio < floor) weak.push(`${tier} ink ${metal.glyph} on ${stop} is ${ratio.toFixed(2)}:1`);
  }
}
check('glyph ink is legible on every face', weak.length === 0, weak.join('; '));

// ─── 5. No Ionicons left on a badge ───────────────────────────────────────────
console.log('\n[5] Regression — badges are not rendered with UI icons again');

// The unlock sheet is back in scope.
//
// It was scoped out while the post-session freeze was unexplained: 6e0df77 had
// put a medallion in it and the app froze, so the sheet was reverted to its old
// artwork as a precaution. c5f4bf0 found the real cause — the sheet was
// presenting as a native Modal over session-summary's own fullScreenModal
// presentation — and the sheet at that point was byte-identical to the build
// the user had confirmed working, which proved the medallion was never it. The
// user then hit the sheet with the old icons still in it and reported exactly
// that. Medallions are back, and this covers both surfaces again.
const screens = ['../app/achievements.tsx', '../components/AchievementUnlockedSheet.tsx'];
const leftovers = [];
for (const rel of screens) {
  const src = readFileSync(join(__dir, rel), 'utf8');
  // `badge.icon` / `b.icon` / `detailBadge.icon` fed to an Ionicons name prop.
  if (/name=\{[A-Za-z]*[Bb]adge?\.icon/.test(src)) leftovers.push(rel);
}
check(
  'no badge is drawn with an Ionicons glyph',
  leftovers.length === 0,
  leftovers.length ? `still using badge.icon: ${leftovers.join(', ')}` : ''
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`badge-glyph-coverage: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`badge-glyph-coverage: all ${total} checks passed\n`);
  process.exit(0);
}
