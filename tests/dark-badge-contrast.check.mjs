/**
 * Contrast check — DarkColors status-badge and category-pill tokens
 *
 * WHY THIS MATTERS
 * ────────────────
 * Session-type category pills (Mechanical, Neuro, Prehab, Finisher, Cooldown)
 * and trend-status badges (Warning, Danger, Neutral) are rendered in dark mode
 * using DarkColors tokens.  Without an automated guard, a future colour-token
 * refactor could silently make badge fills invisible (dark-on-dark) or render
 * text unreadable against its badge background.
 *
 * Two thresholds (WCAG 2.1 contrast-ratio formula):
 *   • FILL_MIN  1.5 : 1  — fill vs DarkColors.surface
 *     Ensures the badge is perceptible as a distinct element against the card
 *     background.  Intentionally conservative (not WCAG AA text) because these
 *     are non-text visual regions, not body copy.
 *   • TEXT_MIN  3.0 : 1  — text vs fill
 *     Ensures the label/icon rendered on the badge is legible.  Stricter than
 *     the fill threshold because human contrast sensitivity is higher for text.
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
 * Run:  node tests/dark-badge-contrast.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// ─── Parse DarkColors block from constants/colors.ts ─────────────────────────

const src = readFileSync(join(ROOT, 'constants', 'colors.ts'), 'utf8');

/**
 * Extract the hex value of a property from the DarkColors object literal.
 * Throws if the token is missing or not a hex string.
 */
function extractDarkToken(key) {
  const darkBlockMatch = src.match(/const DarkColors\s*=\s*\{([\s\S]*?)\n\};/);
  if (!darkBlockMatch) {
    throw new Error('Could not locate DarkColors block in constants/colors.ts');
  }
  const block = darkBlockMatch[1];
  const re = new RegExp(`\\b${key}\\s*:\\s*['"]?(#[0-9a-fA-F]{3,8})['"]?`);
  const m = block.match(re);
  if (!m) {
    throw new Error(`Could not find DarkColors.${key} in constants/colors.ts`);
  }
  return m[1];
}

const surface = extractDarkToken('surface');

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
  { name: 'DarkColors.trendWarning', key: 'trendWarning' },
  { name: 'DarkColors.trendDanger', key: 'trendDanger' },
  { name: 'DarkColors.trendNeutral', key: 'trendNeutral' },
];

// Fill + text pairs: badge background fill vs surface, then text vs fill.
const badgePairs = [
  {
    fillName: 'DarkColors.categoryMechanical',
    fillKey: 'categoryMechanical',
    textName: 'DarkColors.categoryMechanicalText',
    textKey: 'categoryMechanicalText',
  },
  {
    fillName: 'DarkColors.categoryNeuro',
    fillKey: 'categoryNeuro',
    textName: 'DarkColors.categoryNeuroText',
    textKey: 'categoryNeuroText',
  },
  {
    fillName: 'DarkColors.categoryPrehab',
    fillKey: 'categoryPrehab',
    textName: 'DarkColors.categoryPrehabText',
    textKey: 'categoryPrehabText',
  },
  {
    fillName: 'DarkColors.categoryFinisher',
    fillKey: 'categoryFinisher',
    textName: 'DarkColors.categoryFinisherText',
    textKey: 'categoryFinisherText',
  },
  {
    fillName: 'DarkColors.categoryCooldown',
    fillKey: 'categoryCooldown',
    textName: 'DarkColors.categoryCooldownText',
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
      `    Fix: adjust ${name} in DarkColors so contrast vs ${background} reaches ≥ ${min} : 1.`
    );
    failures++;
  }
  return pass;
}

console.log('\n[dark-badge-contrast] checking status-badge and category-pill readability\n');
console.log(`  Background (DarkColors.surface): ${surface}`);
console.log(`  Fill-vs-surface minimum : ${FILL_MIN} : 1`);
console.log(`  Text-vs-fill minimum    : ${TEXT_MIN} : 1\n`);

console.log('── Trend indicators (fill vs surface) ──');
for (const { name, key } of fillOnlyTokens) {
  const token = extractDarkToken(key);
  checkFill(name, token, surface, FILL_MIN);
}

console.log('\n── Category pills (fill vs surface, then text vs fill) ──');
for (const { fillName, fillKey, textName, textKey } of badgePairs) {
  const fill = extractDarkToken(fillKey);
  const text = extractDarkToken(textKey);
  checkFill(fillName, fill, surface, FILL_MIN);
  checkFill(textName, text, fill, TEXT_MIN);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`dark-badge-contrast: FAILED (${failures} token(s) below threshold)\n`);
  process.exit(1);
} else {
  console.log('dark-badge-contrast: all checks passed\n');
  process.exit(0);
}
