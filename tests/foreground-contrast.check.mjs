/**
 * Contrast check — foreground (ink) tokens, BOTH themes
 *
 * WHY THIS MATTERS
 * ────────────────
 * The existing badge checks (light-/dark-badge-contrast) guard text that sits on
 * a *badge fill*. Nothing guarded the much more common case: accent text and
 * icons drawn straight onto a card or the page background.
 *
 * That gap let a real bug live for a long time. `primary` is a fill token — the
 * green we put *behind* white text — so it is dark in both themes by design. It
 * was also being used as a text and icon colour in 172 places, where in dark
 * mode it measured 1.90–3.31 : 1 against the surfaces it landed on. The worst
 * case was the selected row in Settings, which was the only row a user could not
 * read, the theme picker included.
 *
 * The fix was to split the two roles: `primary` stays the fill, `primaryText` is
 * the same brand green as ink and flips to the bright value in dark mode. This
 * check exists so the two can never silently collapse back together.
 *
 * WHAT IS CHECKED
 * ───────────────
 *  A. TOKENS — every token below reaches WCAG AA (4.5 : 1) against each surface
 *     it can be painted on, in LightColors *and* DarkColors.
 *
 *  B. SOURCE — `primary` is never used as a foreground colour in app/ or
 *     components/. A `color:`, `tintColor:`, SVG `fill`/`stroke` etc. fed from
 *     `.primary` is the exact regression this check exists to stop; those call
 *     sites must read `primaryText`.
 *
 * TOKENS DELIBERATELY NOT CHECKED
 * ───────────────────────────────
 * These are below AA today as ink. They are left out rather than quietly
 * lowering the bar, because raising them changes how a lot of the app looks and
 * that is a design decision, not a contrast fix. Measured worst case, vs
 * surfaceTertiary (the darkest card in light mode / lightest in dark):
 *
 *   textTertiary   light 2.21  dark 3.01   — de-emphasised hints
 *   warning        light 2.80  dark 5.78   — amber, mostly a badge fill
 *   trendWarning   light 2.78  dark 4.81   — amber, ditto
 *   trendDanger    light 4.22  dark 3.17
 *   trendNeutral   light 4.22  dark 3.17
 *   error          light 4.62  dark 3.66
 *   cardAccent*    light 1.88–3.61         — card accent stripes, not type
 *
 * Run:  node tests/foreground-contrast.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

const AA = 4.5;

// ─── Parse both theme blocks from constants/colors.ts ────────────────────────

const src = readFileSync(join(ROOT, 'constants', 'colors.ts'), 'utf8');

function themeTokens(blockName) {
  const m = src.match(new RegExp(`const ${blockName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!m) throw new Error(`Could not locate ${blockName} block in constants/colors.ts`);
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([A-Za-z][\w]*)\s*:\s*'(#[0-9a-fA-F]{3,8})'/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

const THEMES = {
  LightColors: themeTokens('LightColors'),
  DarkColors: themeTokens('DarkColors'),
};

// ─── WCAG relative luminance ─────────────────────────────────────────────────

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

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ─── A. Token definitions ────────────────────────────────────────────────────

// The four neutral surfaces any card or screen can be.
const SURFACES = ['background', 'surface', 'surfaceSecondary', 'surfaceTertiary'];

const INK_TOKENS = [
  { key: 'text', on: SURFACES },
  { key: 'textSecondary', on: SURFACES },
  // primaryMuted / primarySurface are the green-tinted chips this accent is put
  // on when a row is selected — the Settings case that started all this.
  { key: 'primaryText', on: [...SURFACES, 'primaryMuted', 'primarySurface'] },
  // The tab bar is painted with `background`, so that is the only pairing.
  { key: 'tabActive', on: ['background'] },
  { key: 'tabInactive', on: ['background'] },
];

let failures = 0;
let total = 0;

console.log('\n[foreground-contrast] ink tokens vs the surfaces they are painted on\n');
console.log(`  Minimum: WCAG AA ${AA} : 1\n`);

for (const [themeName, T] of Object.entries(THEMES)) {
  console.log(`── ${themeName} ──`);
  for (const { key, on } of INK_TOKENS) {
    const ink = T[key];
    if (!ink) {
      console.error(`  ✗ ${themeName}.${key} — token missing from constants/colors.ts`);
      failures++;
      total++;
      continue;
    }
    for (const surfKey of on) {
      const surf = T[surfKey];
      total++;
      if (!surf) {
        console.error(`  ✗ ${themeName}.${surfKey} — surface token missing`);
        failures++;
        continue;
      }
      const ratio = contrastRatio(ink, surf);
      const shown = ratio.toFixed(2);
      if (ratio >= AA) {
        console.log(`  ✓ ${key} (${ink}) on ${surfKey} (${surf}) — ${shown} : 1`);
      } else {
        console.error(
          `  ✗ ${key} (${ink}) on ${surfKey} (${surf}) — ${shown} : 1 — below AA ${AA} : 1`
        );
        console.error(
          `    Fix: adjust ${themeName}.${key} so it reaches ≥ ${AA} : 1 on ${surfKey}.`
        );
        failures++;
      }
    }
  }
  console.log('');
}

// ─── B. Source guard — `primary` must not be used as ink ─────────────────────
//
// For each bare `.primary`, the nearest preceding style/prop key on the line is
// the property it actually feeds. Looking only for *known* keys is what makes
// this reliable: it steps over ternary branches such as
// `color={active ? C.textInverse : C.primary}`, where a naive "last identifier"
// scan would wrongly blame `textInverse`.

const FOREGROUND_KEYS = [
  'color',
  'tintColor',
  'stroke',
  'fill',
  'accentColor',
  'placeholderTextColor',
];
const FILL_KEYS = [
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'shadowColor',
  'trackColor',
  'thumbColor',
  'underlayColor',
];

const KEY_RE = new RegExp(`\\b(${[...FOREGROUND_KEYS, ...FILL_KEYS].join('|')})\\s*[:=]`, 'g');
const PRIMARY_RE =
  /\b(?:C|Colors|colors|DarkColors|LightColors|theme)\.primary\b(?!(?:Light|Dark|Muted|Surface|Subtext))/g;

// Empty, and meant to stay that way: every screen has been migrated. It is kept
// as the one documented escape hatch, so that a screen mid-migration can be
// listed for as long as that takes instead of the guard being switched off for
// everybody. Anything added here is a debt with a name on it.
const NOT_YET_MIGRATED = new Set([]);

function walkFiles(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, results);
    else if (/\.tsx?$/.test(entry)) results.push(full);
  }
  return results;
}

const perFile = {};
for (const dir of ['app', 'components']) {
  for (const abs of walkFiles(join(ROOT, dir))) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/');
    const lines = readFileSync(abs, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      PRIMARY_RE.lastIndex = 0;
      let m;
      while ((m = PRIMARY_RE.exec(line))) {
        const before = line.slice(0, m.index);
        const keys = [...before.matchAll(KEY_RE)];
        const key = keys.length ? keys[keys.length - 1][1] : null;
        if (key && FOREGROUND_KEYS.includes(key)) {
          (perFile[rel] ??= []).push({ line: i + 1, key, text: line.trim().slice(0, 110) });
        }
      }
    });
  }
}

console.log('── Source — `primary` is not used as a foreground colour ──');

const offenders = Object.keys(perFile).sort();
let sourceFailures = 0;

for (const file of offenders) {
  const hits = perFile[file];
  total++;
  if (NOT_YET_MIGRATED.has(file)) {
    console.log(`  ~ ${file} — ${hits.length} known remaining (migration outstanding)`);
  } else {
    console.error(`  ✗ ${file} — ${hits.length} foreground use(s) of \`primary\`:`);
    for (const h of hits) console.error(`      line ${h.line}  ${h.key}: ${h.text}`);
    console.error(`    Fix: these paint text or icons — use \`primaryText\` instead.`);
    sourceFailures++;
  }
}

// A screen that has been migrated should not keep its exemption.
for (const file of NOT_YET_MIGRATED) {
  if (!perFile[file]) {
    total++;
    console.log(`  ✓ ${file} — now clean; remove it from NOT_YET_MIGRATED`);
  }
}

if (offenders.length === 0) console.log('  ✓ no foreground uses of `primary` anywhere');

failures += sourceFailures;

// ─── C. The session card's category pills, read from the screen ──────────────
//
// The badge checks next door take a hand-written list of token PAIRS, which
// only ever grew to the five pills named `categoryX` / `categoryXText`. The
// three that are assembled out of general tokens were never in it, and that is
// how "Warm-Up" sat at 1.90 : 1 on the first four cards of every session while
// two contrast checks passed: it pairs `primaryMuted` with `primary`, and
// neither name says "category pill" to a list.
//
// So this reads the map the screen actually renders rather than a list of what
// somebody remembered to add. A new pill is covered the day it is written.

const PILL_MIN = 3.0; // small bold type on its own fill — the app's badge bar

const cardSrc = readFileSync(join(ROOT, 'app', 'session.tsx'), 'utf8');
const mapMatch = cardSrc.match(
  /const categoryColors: Record<string, \{ bg: string; text: string; label: string \}> = \{([\s\S]*?)\n {2}\};/
);

console.log('\n── Session category pills — text on its own fill, both themes ──');

if (!mapMatch) {
  console.error('  ✗ could not find `categoryColors` in app/session.tsx');
  failures++;
  total++;
} else {
  const pills = [...mapMatch[1].matchAll(/(\w+): \{ bg: C\.(\w+), text: C\.(\w+), label: '([^']+)'/g)];
  total++;
  if (pills.length < 8) {
    console.error(`  ✗ parsed only ${pills.length} pills — the map's shape has changed`);
    failures++;
  } else {
    console.log(`  ✓ all ${pills.length} pills found in the map`);
  }

  for (const [, key, bgKey, textKey, label] of pills) {
    for (const [themeName, T] of Object.entries(THEMES)) {
      total++;
      const bg = T[bgKey];
      const ink = T[textKey];
      if (!bg || !ink) {
        console.error(`  ✗ ${themeName} ${key} — token missing (${bgKey} / ${textKey})`);
        failures++;
        continue;
      }
      const ratio = contrastRatio(ink, bg);
      const where = `${themeName} "${label}" (${textKey} on ${bgKey})`;
      if (ratio >= PILL_MIN) {
        console.log(`  ✓ ${where} — ${ratio.toFixed(2)} : 1`);
      } else {
        console.error(`  ✗ ${where} — ${ratio.toFixed(2)} : 1 — below ${PILL_MIN} : 1`);
        console.error(`    Fix: pair the tinted fill with the BRIGHT ink token, as the others do.`);
        failures++;
      }
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`foreground-contrast: FAILED (${failures} of ${total} check(s))\n`);
  process.exit(1);
} else {
  console.log(`foreground-contrast: all ${total} checks passed\n`);
  process.exit(0);
}
