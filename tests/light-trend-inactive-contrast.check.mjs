/**
 * Contrast check — LightColors.trendInactive / trendInactiveBorder
 *
 * WHY THIS MATTERS
 * ────────────────
 * The "Not trained" markers on the calendar heatmap (app/(tabs)/workouts.tsx)
 * are rendered using LightColors.trendInactive (fill) and
 * LightColors.trendInactiveBorder (border) against the light card surface
 * (LightColors.surface).  These tokens were tuned for readability in light
 * mode, but no automated check existed to guard them.  A future colour-token
 * refactor could silently lighten those values until they disappear on white
 * cards (e.g. #f5f5f5 fill on #ffffff surface ≈ invisible).
 *
 * Checks:
 *  1. LightColors.trendInactive vs LightColors.surface → contrast ratio ≥ 1.5 : 1
 *  2. LightColors.trendInactiveBorder vs LightColors.surface → contrast ratio ≥ 1.5 : 1
 *
 * The 1.5 : 1 threshold is intentionally conservative (below the WCAG text
 * minimum of 4.5 : 1) because these are non-text visual indicators, not body
 * copy.  Even so it catches the worst regressions (e.g. #f0f0f0 on #ffffff).
 *
 * Technique: WCAG 2.1 relative luminance + contrast-ratio formula.
 *   https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * Run:  node tests/light-trend-inactive-contrast.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// ─── Parse LightColors block from constants/colors.ts ────────────────────────

const src = readFileSync(join(ROOT, 'constants', 'colors.ts'), 'utf8');

/**
 * Extract the value of a property from the LightColors object literal.
 * Looks for `  key: '#hexval'` or `  key: "..."` inside LightColors.
 * Returns the hex string (with leading #) or throws if not found.
 */
function extractLightToken(key) {
  // Match the key inside LightColors only — find the LightColors block first.
  const lightBlockMatch = src.match(/const LightColors\s*=\s*\{([\s\S]*?)\n\};/);
  if (!lightBlockMatch) {
    throw new Error('Could not locate LightColors block in constants/colors.ts');
  }
  const block = lightBlockMatch[1];
  const re = new RegExp(`\\b${key}\\s*:\\s*['"]?(#[0-9a-fA-F]{3,8})['"]?`);
  const m = block.match(re);
  if (!m) {
    throw new Error(`Could not find LightColors.${key} in constants/colors.ts`);
  }
  return m[1];
}

const trendInactive = extractLightToken('trendInactive');
const trendInactiveBorder = extractLightToken('trendInactiveBorder');
const surface = extractLightToken('surface');

// ─── WCAG relative luminance ──────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  // Support 3-char shorthand
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function linearise(c8) {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Minimum threshold ────────────────────────────────────────────────────────
// 1.5 : 1 catches invisible combinations (near-zero contrast) while remaining
// achievable for non-text indicators that don't need WCAG AA text compliance.
const MIN_CONTRAST = 1.5;

// ─── Run checks ───────────────────────────────────────────────────────────────

const checks = [
  { name: 'LightColors.trendInactive', token: trendInactive },
  { name: 'LightColors.trendInactiveBorder', token: trendInactiveBorder },
];

let failures = 0;

console.log(
  '\n[light-trend-inactive-contrast] checking "Not trained" marker readability on light surfaces\n'
);
console.log(`  Background (LightColors.surface): ${surface}`);
console.log(`  Minimum contrast ratio required: ${MIN_CONTRAST} : 1\n`);

for (const { name, token } of checks) {
  const ratio = contrastRatio(token, surface);
  const pass = ratio >= MIN_CONTRAST;
  const ratioStr = ratio.toFixed(2);
  if (pass) {
    console.log(`  ✓ ${name} (${token}) — contrast ${ratioStr} : 1`);
  } else {
    console.error(
      `  ✗ ${name} (${token}) — contrast ${ratioStr} : 1 — below minimum ${MIN_CONTRAST} : 1`
    );
    console.error(
      `    Fix: darken ${name} in LightColors until it reaches ≥ ${MIN_CONTRAST} : 1 against ${surface}.`
    );
    failures++;
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`light-trend-inactive-contrast: FAILED (${failures} token(s) below threshold)\n`);
  process.exitCode = 1;
} else {
  console.log('light-trend-inactive-contrast: all checks passed\n');
  process.exitCode = 0;
}
