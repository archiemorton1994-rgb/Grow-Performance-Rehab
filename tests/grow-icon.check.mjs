/**
 * Contract test: the app's own icon set is complete, distinct and in bounds.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The onboarding flow is the first thing anyone sees, and every illustration on
 * it was a stock Ionicons outline glyph rendered at 56px — a UI icon at five
 * times the size it was drawn for. That is what made a paid app look like a
 * template. lib/icon-art.ts replaces them with drawings made for this app.
 *
 * Three things have to hold, none of which a typechecker can see:
 *   1. COVERAGE  — a name with no geometry renders an empty box, silently.
 *   2. DISTINCT  — two icons with identical geometry means one of them is
 *                  saying the wrong thing. Onboarding used barbell-outline for
 *                  "1-3 years training", "Build Strength", "Train and recover",
 *                  the equipment step AND two of the three celebration pills;
 *                  that sameness is exactly what is being fixed.
 *   3. IN BOUNDS — geometry outside the 48-unit box is clipped by the viewBox
 *                  with no warning.
 *
 * Run:  node tests/grow-icon.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
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

const names = Object.keys(GROW_ICONS);

// ─── 1. Coverage ──────────────────────────────────────────────────────────────
console.log('\n[1] Coverage — every declared name has geometry');

// The union in lib/icon-art.ts is the contract; the object must match it.
const src = readFileSync(join(__dir, '../lib/icon-art.ts'), 'utf8');
const unionBlock = src.slice(src.indexOf('export type GrowIconName'), src.indexOf('export const GROW_ICONS'));
const declared = [...unionBlock.matchAll(/\|\s*'([a-z][a-z0-9]*)'/gi)].map((m) => m[1]);

check(`the union declares ${declared.length} icons`, declared.length > 10, `only ${declared.length} parsed`);
const missing = declared.filter((n) => !GROW_ICONS[n] || GROW_ICONS[n].length === 0);
check(
  'every declared icon has shapes',
  missing.length === 0,
  missing.length ? `empty: ${missing.join(', ')}` : ''
);
const undeclared = names.filter((n) => !declared.includes(n));
check(
  'no icon exists outside the union',
  undeclared.length === 0,
  undeclared.length ? `stray: ${undeclared.join(', ')}` : ''
);

// ─── 2. Distinctness ──────────────────────────────────────────────────────────
console.log('\n[2] Distinctness — no two icons are the same drawing');
const byShape = new Map();
for (const [name, shapes] of Object.entries(GROW_ICONS)) {
  const key = JSON.stringify(shapes);
  byShape.set(key, [...(byShape.get(key) ?? []), name]);
}
const shared = [...byShape.values()].filter((l) => l.length > 1);
check(
  `all ${names.length} icons are distinct`,
  shared.length === 0,
  shared.length ? shared.map((l) => l.join(' = ')).join('; ') : ''
);

// ─── 3. Bounds ────────────────────────────────────────────────────────────────
console.log('\n[3] Bounds — nothing is clipped by the 48-unit viewBox');

function pathPoints(d) {
  const points = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let cursor = [0, 0];
  let m;
  while ((m = re.exec(d))) {
    const upper = m[1].toUpperCase();
    if (upper === 'Z') continue;
    const nums = (m[2].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const stride = upper === 'A' ? 7 : upper === 'H' || upper === 'V' ? 1 : 2;
    for (let i = 0; i + stride <= nums.length; i += stride) {
      const chunk = nums.slice(i, i + stride);
      if (upper === 'H') cursor = [chunk[0], cursor[1]];
      else if (upper === 'V') cursor = [cursor[0], chunk[0]];
      else if (upper === 'A') cursor = [chunk[5], chunk[6]];
      else {
        for (let j = 0; j + 1 < chunk.length; j += 2) points.push([chunk[j], chunk[j + 1]]);
        cursor = [chunk[chunk.length - 2], chunk[chunk.length - 1]];
      }
      points.push([...cursor]);
    }
  }
  return points;
}

function extent(s) {
  const pad = (s.stroke ? (s.sw ?? 1) / 2 : 0) + (s.k === 'circle' ? s.r : 0);
  let pts;
  if (s.k === 'circle') pts = [[s.cx, s.cy]];
  else if (s.k === 'rect')
    pts = [
      [s.x, s.y],
      [s.x + s.w, s.y + s.h],
    ];
  else pts = pathPoints(s.d);
  let lo = Infinity;
  let hi = -Infinity;
  for (const [x, y] of pts) {
    lo = Math.min(lo, x - pad, y - pad);
    hi = Math.max(hi, x + pad, y + pad);
  }
  return [lo, hi];
}

const out = [];
for (const [name, shapes] of Object.entries(GROW_ICONS)) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of shapes) {
    const [a, b] = extent(s);
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  if (lo < 0 || hi > 48) out.push(`${name} spans ${lo.toFixed(1)}..${hi.toFixed(1)}`);
}
check('all icon geometry sits inside 0..48', out.length === 0, out.join('; '));

// ─── 4. Onboarding actually uses them ─────────────────────────────────────────
console.log('\n[4] Onboarding — illustrations are drawn, not borrowed');

const onboarding = readFileSync(join(__dir, '../app/onboarding.tsx'), 'utf8');
// Ionicons stays the right tool for plain navigation controls — a chevron is a
// chevron, and redrawing one buys nothing. What must not come back is an
// Ionicon standing in as ILLUSTRATION: the hero glyphs, the option tiles and
// the goal chips. Anything not in this allowlist, at 18px or more, is one.
const CONTROLS = /chevron-|arrow-|^checkmark$|close|lock-closed|ellipsis|search/;
const illustrative = [...onboarding.matchAll(/<Ionicons[\s\S]{0,140}?name=[{"']([a-z-]+)[}"'][\s\S]{0,80}?size=\{(\d+)\}/g)]
  .filter(([, name, size]) => Number(size) >= 18 && !CONTROLS.test(name))
  .map(([, name, size]) => `${name}@${size}`);
check(
  'no Ionicon is used as illustration on the onboarding flow',
  illustrative.length === 0,
  illustrative.length ? `found: ${illustrative.join(', ')}` : ''
);
check(
  'the onboarding option tables are typed to the app icon set',
  /icon: GrowIconName;/.test(onboarding) && !/keyof typeof Ionicons\.glyphMap/.test(onboarding),
  'expected `icon: GrowIconName` and no remaining Ionicons glyphMap types'
);

console.log('');
if (failures > 0) {
  console.error(`grow-icon: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`grow-icon: all ${total} checks passed\n`);
  process.exit(0);
}
