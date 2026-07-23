/**
 * Contrast check — LightColors category-pill and trend-indicator tokens
 *
 * WHY THIS MATTERS
 * ────────────────
 * Session-type category pills (Mechanical, Neuro, Prehab, Finisher, Cooldown)
 * and trend-status indicators (Warning, Danger, Neutral) are rendered in light
 * mode using LightColors tokens.  Without an automated guard, a future
 * colour-token refactor could silently make badge fills invisible
 * (light-on-white) or render text unreadable against its badge background.
 *
 * Two thresholds (WCAG 2.1 contrast-ratio formula):
 *   • FILL_MIN  1.5 : 1  — fill vs LightColors.surface
 *     Ensures the badge is perceptible as a distinct element against the card
 *     background.  Mirrors the identical threshold used in dark-badge-contrast.
 *   • TEXT_MIN  3.0 : 1  — text vs fill
 *     Ensures the label/icon rendered on the badge is legible.
 *
 * Tokens checked
 * ─────────────
 *   trendWarning / trendDanger / trendNeutral  — fill vs surface only
 *   (these are used as coloured text / icon indicators, not as badge fills that
 *   contain a text label, so no text-on-fill pair exists for them)
 *
 *   categoryMechanical  + categoryMechanicalText  (fill + text-on-fill)
 *   categoryNeuro       + categoryNeuroText
 *   categoryPrehab      + categoryPrehabText
 *   categoryFinisher    + categoryFinisherText
 *   categoryCooldown    + categoryCooldownText
 *
 * Run:  node tests/light-badge-contrast.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// ─── Parse LightColors block from constants/colors.ts ─────────────────────────

const src = readFileSync(join(ROOT, 'constants', 'colors.ts'), 'utf8');

/**
 * Extract the hex value of a property from the LightColors object literal.
 * Throws if the token is missing or not a hex string.
 */
function extractLightToken(key) {
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

const surface = extractLightToken('surface');

// ─── WCAG relative luminance ──────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
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

// ─── Thresholds ───────────────────────────────────────────────────────────────

const FILL_MIN = 1.5; // fill vs surface — perceptibility
const TEXT_MIN = 3.0; // text vs fill  — legibility

// ─── Token definitions ────────────────────────────────────────────────────────

// Fill-only checks: token used as a coloured text/icon indicator, compared vs surface.
const fillOnlyTokens = [
  { name: 'LightColors.trendWarning', key: 'trendWarning' },
  { name: 'LightColors.trendDanger', key: 'trendDanger' },
  { name: 'LightColors.trendNeutral', key: 'trendNeutral' },
];

// Fill + text pairs: badge background fill vs surface, then text vs fill.
const badgePairs = [
  {
    fillName: 'LightColors.categoryMechanical',
    fillKey: 'categoryMechanical',
    textName: 'LightColors.categoryMechanicalText',
    textKey: 'categoryMechanicalText',
  },
  {
    fillName: 'LightColors.categoryNeuro',
    fillKey: 'categoryNeuro',
    textName: 'LightColors.categoryNeuroText',
    textKey: 'categoryNeuroText',
  },
  {
    fillName: 'LightColors.categoryPrehab',
    fillKey: 'categoryPrehab',
    textName: 'LightColors.categoryPrehabText',
    textKey: 'categoryPrehabText',
  },
  {
    fillName: 'LightColors.categoryFinisher',
    fillKey: 'categoryFinisher',
    textName: 'LightColors.categoryFinisherText',
    textKey: 'categoryFinisherText',
  },
  {
    fillName: 'LightColors.categoryCooldown',
    fillKey: 'categoryCooldown',
    textName: 'LightColors.categoryCooldownText',
    textKey: 'categoryCooldownText',
  },
];

// ─── Run checks ───────────────────────────────────────────────────────────────

let failures = 0;

function checkFill(name, token, background, min) {
  const ratio = contrastRatio(token, background);
  const pass = ratio >= min;
  const ratioStr = ratio.toFixed(2);
  if (pass) {
    console.log(`  ✓ ${name} (${token}) — contrast ${ratioStr} : 1`);
  } else {
    console.error(`  ✗ ${name} (${token}) — contrast ${ratioStr} : 1 — below minimum ${min} : 1`);
    console.error(
      `    Fix: adjust ${name} in LightColors so contrast vs ${background} reaches ≥ ${min} : 1.`
    );
    failures++;
  }
  return pass;
}

console.log('\n[light-badge-contrast] checking category-pill and trend-indicator readability\n');
console.log(`  Background (LightColors.surface): ${surface}`);
console.log(`  Fill-vs-surface minimum : ${FILL_MIN} : 1`);
console.log(`  Text-vs-fill minimum    : ${TEXT_MIN} : 1\n`);

console.log('── Trend indicators (fill vs surface) ──');
for (const { name, key } of fillOnlyTokens) {
  const token = extractLightToken(key);
  checkFill(name, token, surface, FILL_MIN);
}

console.log('\n── Category pills (fill vs surface, then text vs fill) ──');
for (const { fillName, fillKey, textName, textKey } of badgePairs) {
  const fill = extractLightToken(fillKey);
  const text = extractLightToken(textKey);
  checkFill(fillName, fill, surface, FILL_MIN);
  checkFill(textName, text, fill, TEXT_MIN);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`light-badge-contrast: FAILED (${failures} token(s) below threshold)\n`);
  process.exit(1);
} else {
  console.log('light-badge-contrast: all checks passed\n');
  process.exit(0);
}
