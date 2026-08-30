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
 *  C. PILLS — the session card's category pills, read from the screen.
 *
 *  D. CARD ACCENTS — accent tokens painted as type on a card tinted with that
 *     same accent, read from the screen. See the section for why the token
 *     table alone cannot catch this one.
 *
 *  E. THEME PARITY — reading a string in light mode must not be meaningfully
 *     harder than reading the same string in dark mode.
 *
 *  F. ONE ACCENT PER CATEGORY — Home's first-session chooser. Squat, bench and
 *     deadlift are one kind of thing and must be one colour.
 *
 *  G. ONE FAMILY — the Restore accents must read as a derived set, not three
 *     colours picked separately.
 *
 * TOKENS DELIBERATELY NOT CHECKED
 * ───────────────────────────────
 * These are below AA today as ink. They are left out rather than quietly
 * lowering the bar, because raising them changes how a lot of the app looks and
 * that is a design decision, not a contrast fix. Measured worst case, vs
 * surfaceTertiary (the darkest card in light mode / lightest in dark):
 *
 *   warning        light 2.80  dark 5.78   — amber, mostly a badge fill
 *   trendWarning   light 2.78  dark 4.81   — amber, ditto
 *   trendDanger    light 4.22  dark 3.17
 *   trendNeutral   light 4.22  dark 3.17
 *   error          light 4.62  dark 3.66
 *
 * textTertiary used to head that list. It does not any more: it carries real
 * content — every achievement name and rarity tier, "Not tried yet", the
 * in-session timer line, each queued exercise's set/rep spec, "Resend code in
 * 25s", the locked equipment labels — so "de-emphasised hint" was never an
 * honest description of it. It is in section A now and cannot drift back.
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

/**
 * Perceptual distance (CIE76). Contrast ratio cannot answer "are these two
 * different colours" — a red and a green of equal lightness score 1.0 against
 * each other and are obviously not the same. Section H needs the other
 * question, so it needs the other measure.
 */
function deltaE76(a, b) {
  const toLab = (hex) => {
    const [r, g, bl] = hexToRgb(hex).map(linearise);
    const X = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047;
    const Y = r * 0.2126 + g * 0.7152 + bl * 0.0722;
    const Z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [f(X), f(Y), f(Z)];
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  const A = toLab(a);
  const B = toLab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

// ─── A. Token definitions ────────────────────────────────────────────────────

// The four neutral surfaces any card or screen can be.
const SURFACES = ['background', 'surface', 'surfaceSecondary', 'surfaceTertiary'];

const INK_TOKENS = [
  { key: 'text', on: SURFACES },
  { key: 'textSecondary', on: SURFACES },
  { key: 'textTertiary', on: SURFACES },
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

// One table, in components/SessionPlanList.tsx, read by the exercise card AND
// by the session list. It used to be an inline map in app/session.tsx; it moved
// when the list started drawing the same pills, because two copies of "which
// green is a warm-up" drift apart and only one of them gets checked.
const cardSrc = readFileSync(join(ROOT, 'components', 'SessionPlanList.tsx'), 'utf8');
const mapMatch = cardSrc.match(
  /export function categoryDisplay\([\s\S]*?\) \{\s*\r?\n\s*return \{([\s\S]*?)\n {2}\} as Record/
);

console.log('\n── Session category pills — text on its own fill, both themes ──');

if (!mapMatch) {
  console.error('  ✗ could not find `categoryDisplay` in components/SessionPlanList.tsx');
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

// ─── D. Card accents used as type on a card tinted with the same accent ──────
//
// Section A pairs *ink* tokens with *neutral surfaces*. The badge checks pair
// *pill* tokens with *pill fills*. Neither describes what the Restore rows do:
// each row is filled and outlined with its own accent at low alpha, and then
// the row's title and its chevron are painted in that same accent at full
// strength. The ink and the surface are the same hue, so the surface tracks the
// ink — darken the accent and the card darkens with it — and the margin between
// them is much smaller than the token table makes it look.
//
// That is how `cardAccentPrehab` sat at 1.99 : 1 in light mode while every
// contrast check passed. Its two siblings had been darkened for this exact
// reason; it was left on the raw amber and nothing noticed.
//
// So this measures the pairing as it is composited on screen — accent over
// (accent @ tint alpha) over the screen background — and it reads the alphas,
// the accent list and the background token out of the screen itself. A fourth
// Restore row, or a change to the tint, is covered the day it is written rather
// than the day somebody remembers to update a list here.

// Full AA. These titles are 16px semibold, a hair under WCAG's large-text
// size, so 4.5 : 1 was always the strictly correct bar — the bar used to sit at
// 3.0 only because two of the three accents could not clear it. The family was
// re-derived to a common weight well above AA, so the correct bar is now the
// enforced one.
const ACCENT_MIN = 4.5;

const recoverSrc = readFileSync(join(ROOT, 'app', '(tabs)', 'recover.tsx'), 'utf8');

/** '#rrggbb' at `alphaHex` composited over an opaque '#rrggbb'. */
function composite(fgHex, alphaHex, bgHex) {
  const a = parseInt(alphaHex, 16) / 255;
  const f = hexToRgb(fgHex);
  const b = hexToRgb(bgHex);
  return (
    '#' +
    [0, 1, 2]
      .map((i) => Math.round(f[i] * a + b[i] * (1 - a)).toString(16).padStart(2, '0'))
      .join('')
  );
}

console.log('\n── Restore rows — accent as type on a card tinted with that accent ──');

const accentTokens = [...recoverSrc.matchAll(/cardAccent:\s*C\.(\w+)/g)].map((m) => m[1]);
const tintMatch = recoverSrc.match(
  /backgroundColor:\s*row\.cardAccent\s*\+\s*'([0-9a-fA-F]{2})'/
);
const baseMatch = recoverSrc.match(/root:\s*\{[^}]*backgroundColor:\s*C\.(\w+)/);

// Every place the accent is drawn *on* that tinted card. The optional trailing
// alpha is captured so dimming a call site is measured rather than assumed away.
const ACCENT_SITES = [
  {
    what: 'row title',
    re: /color:\s*row\.cardAccent(?:\s*\+\s*'([0-9a-fA-F]{2})')?\s*\}\]/,
  },
  {
    what: 'row chevron',
    re: /chevron-forward[^\n]*?color=\{row\.cardAccent(?:\s*\+\s*'([0-9a-fA-F]{2})')?\}/,
  },
];

total++;
if (accentTokens.length < 3 || !tintMatch || !baseMatch) {
  console.error(
    `  ✗ could not read the Restore rows from app/(tabs)/recover.tsx ` +
      `(accents: ${accentTokens.length}, tint: ${tintMatch ? 'ok' : 'missing'}, ` +
      `base surface: ${baseMatch ? 'ok' : 'missing'})`
  );
  console.error('    Fix: this check reads the screen; update it alongside the layout.');
  failures++;
} else {
  const tintAlpha = tintMatch[1];
  const baseKey = baseMatch[1];
  console.log(
    `  ✓ ${accentTokens.length} accents, card tinted at '${tintAlpha}' over ${baseKey}`
  );

  const sites = ACCENT_SITES.map(({ what, re }) => {
    const m = recoverSrc.match(re);
    return { what, found: !!m, alpha: m?.[1] ?? 'ff' };
  });

  for (const site of sites) {
    total++;
    if (!site.found) {
      console.error(`  ✗ ${site.what} — no accent-coloured call site found on the row`);
      console.error('    Fix: this check reads the screen; update it alongside the layout.');
      failures++;
    }
  }

  for (const [themeName, T] of Object.entries(THEMES)) {
    const base = T[baseKey];
    for (const token of accentTokens) {
      const accent = T[token];
      total++;
      if (!accent || !base) {
        console.error(`  ✗ ${themeName}.${token} — token missing (or ${baseKey} missing)`);
        failures++;
        continue;
      }
      const card = composite(accent, tintAlpha, base);
      for (const site of sites) {
        if (!site.found) continue;
        total++;
        const ink = site.alpha === 'ff' ? accent : composite(accent, site.alpha, card);
        const ratio = contrastRatio(ink, card);
        const where = `${themeName} ${token} ${site.what} on its own tint (${card})`;
        if (ratio >= ACCENT_MIN) {
          console.log(`  ✓ ${where} — ${ratio.toFixed(2)} : 1`);
        } else {
          console.error(`  ✗ ${where} — ${ratio.toFixed(2)} : 1 — below ${ACCENT_MIN} : 1`);
          console.error(
            `    Fix: darken ${themeName}.${token} (light) / brighten it (dark). The card is ` +
              `tinted with this same token, so it moves with the ink — check the measured ratio, ` +
              `not the raw token against a white page.`
          );
          failures++;
        }
      }
    }
  }
}

// ─── E. Theme parity for the quiet inks ──────────────────────────────────────
//
// Section A puts a floor under each theme separately, which is not the same
// promise as "both themes are equally readable". A token can clear 4.5 in light
// and sit at 15 in dark and still leave light-mode users squinting at strings
// dark-mode users read comfortably. `textTertiary` had drifted to exactly that
// — 2.21–2.53 : 1 in light against 3.01–4.12 : 1 in dark, roughly half the
// legibility for the same strings, which is nobody's design decision.
//
// So rather than pin a number (which would just restate whatever value is in
// the table today), this asserts the promise: for the same token on the same
// surface, neither theme may be meaningfully worse than the other.
//
// The amber inks (warning, trendWarning) are worse offenders — light 2.80 vs
// dark 5.78 — but they are mostly badge fills that happen to be reused as type,
// and sorting them out means deciding what the amber is *for* first. Adding
// them here is the right next step, not a rename.
const PARITY_TOKENS = ['textSecondary', 'textTertiary'];
// The weaker theme must reach at least this share of the stronger one on the
// same surface. It is deliberately generous: the two palettes are different
// colours on different backgrounds and will never land on identical numbers.
// It is tight enough to catch what actually went wrong — the old light value
// missed on three of the four surfaces, worst 0.59.
const PARITY_MIN_SHARE = 0.7;

console.log('\n── Theme parity — the quiet inks must not be far weaker in one theme ──');

for (const key of PARITY_TOKENS) {
  for (const surfKey of SURFACES) {
    total++;
    const lightInk = THEMES.LightColors[key];
    const darkInk = THEMES.DarkColors[key];
    const lightSurf = THEMES.LightColors[surfKey];
    const darkSurf = THEMES.DarkColors[surfKey];
    if (!lightInk || !darkInk || !lightSurf || !darkSurf) {
      console.error(`  ✗ ${key} / ${surfKey} — token missing from one of the themes`);
      failures++;
      continue;
    }
    const lightRatio = contrastRatio(lightInk, lightSurf);
    const darkRatio = contrastRatio(darkInk, darkSurf);
    const share = Math.min(lightRatio, darkRatio) / Math.max(lightRatio, darkRatio);
    const weaker = lightRatio < darkRatio ? 'LightColors' : 'DarkColors';
    const shown = `light ${lightRatio.toFixed(2)} vs dark ${darkRatio.toFixed(2)}`;
    if (share >= PARITY_MIN_SHARE) {
      console.log(`  ✓ ${key} on ${surfKey} — ${shown} (${(share * 100).toFixed(0)}%)`);
    } else {
      console.error(
        `  ✗ ${key} on ${surfKey} — ${shown} — ${weaker} is only ` +
          `${(share * 100).toFixed(0)}% as legible, floor is ${PARITY_MIN_SHARE * 100}%`
      );
      console.error(
        `    Fix: bring ${weaker}.${key} up. Improving only the stronger theme widens the gap.`
      );
      failures++;
    }
  }
}

// ─── F. Colour carries category, never instance — the first-session chooser ──
//
// The three rows of "Choose Your First Session" are the first coloured thing a
// new user ever sees. They used to be a green row, a blue row and a purple row,
// which tells the user these are three different kinds of session. They are
// not: squat, bench and deadlift are one category, a KPI barbell session, and
// they are already told apart by their name, their subtitle and their picture.
//
// So this reads the titles' ink off the screen rather than trusting a list:
// every colour those three rows can paint their own title with, resolved in
// both themes. There must be exactly one, and it must be the brand accent.

console.log('\n── First-session chooser — one accent for the three strength sessions ──');

const homeSrc = readFileSync(join(ROOT, 'app', '(tabs)', 'index.tsx'), 'utf8');

// The card, from its heading down to the end of the row list.
const chooserMatch = homeSrc.match(
  /Choose Your First Session([\s\S]*?)\n {14}<\/Animated\.View>/
);

total++;
if (!chooserMatch) {
  console.error('  ✗ could not find the first-session chooser in app/(tabs)/index.tsx');
  console.error('    Fix: this check reads the screen; update it alongside the layout.');
  failures++;
} else {
  const block = chooserMatch[1];
  const rowTypes = [...block.matchAll(/type:\s*'(\w+)' as const/g)].map((m) => m[1]);

  // Two places a row title's colour can come from: an ink named inside the row
  // definitions, or the shared `firstChoiceLabel` style. Both are collected —
  // a per-row `color` reappearing in the array is exactly the regression here.
  const inlineInks = [...block.matchAll(/\bcolor:\s*C\.(\w+)/g)].map((m) => m[1]);
  const labelStyle = homeSrc.match(/firstChoiceLabel:\s*\{([\s\S]*?)\}/);
  const styleInk = labelStyle?.[1].match(/\bcolor:\s*C\.(\w+)/)?.[1];
  const inks = [...new Set([...inlineInks, ...(styleInk ? [styleInk] : [])])];

  total++;
  if (rowTypes.length !== 3) {
    console.error(
      `  ✗ parsed ${rowTypes.length} chooser row(s), expected squat/bench/deadlift — ` +
        'the card\'s shape has changed'
    );
    console.error('    Fix: this check reads the screen; update it alongside the layout.');
    failures++;
  } else {
    console.log(`  ✓ 3 rows found: ${rowTypes.join(', ')}`);
  }

  total++;
  if (inks.length === 0) {
    console.error('  ✗ found no ink for the chooser row titles — the parse has gone stale');
    failures++;
  } else if (inks.length > 1) {
    console.error(
      `  ✗ the three rows can be painted ${inks.length} different colours (${inks.join(', ')})`
    );
    console.error(
      '    Fix: squat, bench and deadlift are one category. Colour must carry the category, ' +
        'not the instance — the name and the icon already tell them apart.'
    );
    failures++;
  } else {
    console.log(`  ✓ one ink for all three rows: ${inks[0]}`);

    for (const [themeName, T] of Object.entries(THEMES)) {
      total++;
      const ink = T[inks[0]];
      const brand = T.primaryText;
      if (!ink || !brand) {
        console.error(`  ✗ ${themeName} — ${inks[0]} or primaryText missing`);
        failures++;
      } else if (ink.toLowerCase() === brand.toLowerCase()) {
        console.log(`  ✓ ${themeName} — that ink is the brand accent (${ink})`);
      } else {
        console.error(
          `  ✗ ${themeName} — rows are ${ink}, brand accent is ${brand}: not the brand colour`
        );
        console.error('    Fix: this is a green-branded product; its KPI sessions wear the brand.');
        failures++;
      }
    }
  }
}

// ─── G. The Restore accents are one derived family ───────────────────────────
//
// Section D asks whether each Restore accent is legible. It cannot ask the
// other question a user actually asks of that screen: do these three look like
// they belong together? Teal, indigo and amber each passed a contrast bar
// individually and still read as three colours chosen on three different days.
//
// A family is three things differing in *hue only*. So: same saturation, same
// weight (each accent lands on the same contrast against its own tinted card),
// and every hue within reach of the brand green without being mistakable for
// it — the brand accent means "strength session" over on Home.

const SAT_SPREAD_MAX = 5; // percentage points
const WEIGHT_MIN_SHARE = 0.85; // weakest / strongest contrast on own tint
const HUE_MIN_FROM_BRAND = 10; // degrees — closer and it reads as the brand itself
const HUE_MAX_FROM_BRAND = 95; // degrees — further and it is not the brand's family

function hueSat(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s: s * 100 };
}

function hueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

console.log('\n── Restore accents — one derived family, not three separate colours ──');

total++;
if (accentTokens.length < 3 || !tintMatch || !baseMatch) {
  console.error('  ✗ no Restore accents parsed — see the section above');
  failures++;
} else {
  for (const [themeName, T] of Object.entries(THEMES)) {
    const base = T[baseMatch[1]];
    const members = accentTokens.map((k) => ({ key: k, hex: T[k] }));

    total++;
    if (members.some((m) => !m.hex) || !base) {
      console.error(`  ✗ ${themeName} — an accent or the base surface is missing`);
      failures++;
      continue;
    }

    const sats = members.map((m) => hueSat(m.hex).s);
    const satSpread = Math.max(...sats) - Math.min(...sats);
    if (satSpread <= SAT_SPREAD_MAX) {
      console.log(
        `  ✓ ${themeName} shared saturation — ${sats.map((s) => s.toFixed(0) + '%').join(' / ')}`
      );
    } else {
      console.error(
        `  ✗ ${themeName} saturation spread ${satSpread.toFixed(0)} pts ` +
          `(${sats.map((s) => s.toFixed(0) + '%').join(' / ')}), max ${SAT_SPREAD_MAX}`
      );
      console.error('    Fix: derive the set from one saturation; only the hue should differ.');
      failures++;
    }

    total++;
    const weights = members.map((m) => contrastRatio(m.hex, composite(m.hex, tintMatch[1], base)));
    const weightShare = Math.min(...weights) / Math.max(...weights);
    if (weightShare >= WEIGHT_MIN_SHARE) {
      console.log(
        `  ✓ ${themeName} shared weight — ${weights.map((w) => w.toFixed(2)).join(' / ')} : 1`
      );
    } else {
      console.error(
        `  ✗ ${themeName} weight varies — ${weights.map((w) => w.toFixed(2)).join(' / ')} : 1, ` +
          `weakest is ${(weightShare * 100).toFixed(0)}% of strongest (floor ${WEIGHT_MIN_SHARE * 100}%)`
      );
      console.error(
        '    Fix: tune each accent\'s lightness so all three land on the same contrast against ' +
          'their own tint. One row shouting over the others is what makes a set look accidental.'
      );
      failures++;
    }

    const brandHue = hueSat(T.primaryText).h;
    for (const m of members) {
      total++;
      const gap = hueGap(hueSat(m.hex).h, brandHue);
      if (gap >= HUE_MIN_FROM_BRAND && gap <= HUE_MAX_FROM_BRAND) {
        console.log(`  ✓ ${themeName} ${m.key} — ${gap.toFixed(0)}° from the brand green`);
      } else if (gap < HUE_MIN_FROM_BRAND) {
        console.error(
          `  ✗ ${themeName} ${m.key} (${m.hex}) is only ${gap.toFixed(0)}° from the brand green`
        );
        console.error('    Fix: too close — this row would read as the brand accent itself.');
        failures++;
      } else {
        console.error(
          `  ✗ ${themeName} ${m.key} (${m.hex}) is ${gap.toFixed(0)}° from the brand green, ` +
            `max ${HUE_MAX_FROM_BRAND}°`
        );
        console.error('    Fix: unrelated to the brand. Step away from the green, do not leave it.');
        failures++;
      }
    }
  }
}

// ─── H. Chart marks must survive on the card they are drawn on ───────────────
//
// Stats' Session Breakdown is a donut plus a legend. Both are drawn on the
// card, but they were painted with the legend row's *selected-state ink* — the
// colour meant to be read on that row's own coloured fill.
//
// Seven of the ten session types pair a pale fill with strong ink, so that ink
// happened to work as a mark too. Conditioning and custom are built the other
// way round — a strong fill with plain white ink, which is what their pills
// want. In light mode that made their donut wedges and their legend dots WHITE
// ON A WHITE CARD: two of the seven slices were not drawn, two legend dots were
// missing, and the ring visibly did not add up to the "7 total" printed in the
// middle of it. Every contrast check passed, because none of them was looking
// at a fill-shaped token being used as a fill on the wrong surface.
//
// This is section B's bug wearing the opposite coat: there, a fill token was
// used as ink; here, an ink token was used as a mark. So this section asks the
// question the user asks — can I see every slice, and can I read the row when I
// tap it — and it reads the fields off the screen so a new session type or a
// renamed field is covered the day it is written, not the day someone
// remembers this file.

// Marks are graphical objects, not text: WCAG 1.4.11 asks 3 : 1. The legend
// label is 12px semibold on its own fill, which is the app's badge bar, also 3.
const MARK_MIN = 3.0;
// "These two are not literally the same swatch". Deliberately NOT a comfort
// bar: the tightest real pair today is squat / prehab at dE 15.1, and squat /
// flexibility at 22.4 — two greens and a teal that a user can separate side by
// side but would not call a designed set. Raising this bar is a palette
// decision, so it is written down here rather than smuggled in as a threshold.
const MARK_DISTINCT_MIN = 12;

console.log('\n── Stats chart marks — every slice visible on its card ──');

const statsSrc = readFileSync(join(ROOT, 'app', '(tabs)', 'workouts.tsx'), 'utf8');

/**
 * The map is DERIVED from the session identities now, so there is nothing to
 * parse: it is built here the same way the screen builds it, and the values
 * measured are the ones actually drawn.
 *
 * That is why this matters at all. The screen used to carry a palette of its
 * own, unrelated to the one a session wears - squat was green here and blue
 * inside the session - and three PAIRS of session types shared a colour with
 * each other. The distinctness check below could not see it, because the two
 * types really were the same entry.
 */
const { sessionColorOverrides, inkOn } = await import('../lib/session-theme.ts');
const { SESSION_IDENTITY } = await import('../lib/session-identity.ts');

const derivesFromIdentities =
  /sessionColorOverrides\(C, type, isDark\)/.test(statsSrc) &&
  /inkOn\(bg, SESSION_IDENTITY\[type\]\.deep\)/.test(statsSrc);

function statsEntries(T, isDark) {
  return Object.keys(SESSION_IDENTITY).map((type) => {
    const tinted = sessionColorOverrides(T, type, isDark);
    const bg = tinted.primaryMuted;
    return {
      type,
      bg,
      color: inkOn(bg, SESSION_IDENTITY[type].deep),
      chart: tinted.primaryText,
    };
  });
}
// Which field the donut paints with, and which the legend dot uses in each state.
const donutField = statsSrc.match(/fill=\{sessionTypeColors\[seg\.type\]\.(\w+)\}/)?.[1];
const dotFields = statsSrc.match(
  /backgroundColor:\s*isSelected\s*\?\s*meta\.(\w+)\s*:\s*meta\.(\w+),/
);
// The card the donut and legend are drawn on.
const cardKey = statsSrc.match(
  /function SessionTypeBreakdown\(\{[\s\S]*?backgroundColor:\s*C\.(\w+)/
)?.[1];

total++;
if (!derivesFromIdentities || !donutField || !dotFields || !cardKey) {
  console.error(
    `  ✗ could not read the breakdown from app/(tabs)/workouts.tsx ` +
      `(derived: ${derivesFromIdentities ? 'ok' : 'no'}, donut field: ${donutField ?? 'missing'}, ` +
      `dot fields: ${dotFields ? 'ok' : 'missing'}, card: ${cardKey ?? 'missing'})`
  );
  console.error('    Fix: this check reads the screen; update it alongside the layout.');
  failures++;
} else {
  const [, selectedDotField, restingDotField] = dotFields;

  total++;
  console.log(
    `  ✓ ${Object.keys(SESSION_IDENTITY).length} session types, derived from the identities; ` +
      `donut paints \`${donutField}\`, dot paints \`${restingDotField}\` at rest and ` +
      `\`${selectedDotField}\` when selected, card is ${cardKey}`
  );

  for (const [themeName, T] of Object.entries(THEMES)) {
    const entries = statsEntries(T, themeName === 'DarkColors');
    const card = T[cardKey];
    const marks = [];

    for (const e of entries) {
      // The donut slice and the resting legend dot both sit on the card.
      for (const [what, field] of [
        ['donut slice', donutField],
        ['legend dot', restingDotField],
      ]) {
        total++;
        const mark = e[field];
        if (!mark || !card) {
          console.error(`  ✗ ${themeName} ${e.type} — ${field} or ${cardKey} missing`);
          failures++;
          continue;
        }
        const r = contrastRatio(mark, card);
        if (what === 'donut slice') marks.push({ type: e.type, hex: mark, e });
        if (r >= MARK_MIN) {
          console.log(
            `  ✓ ${themeName} ${e.type} ${what} (${e[field]} ${mark}) on ${cardKey} — ${r.toFixed(2)} : 1`
          );
        } else {
          console.error(
            `  ✗ ${themeName} ${e.type} ${what} (${e[field]} ${mark}) on ${cardKey} (${card}) — ` +
              `${r.toFixed(2)} : 1 — below ${MARK_MIN} : 1`
          );
          console.error(
            `    Fix: this is a MARK on the card, not ink on the row's own fill. Point ` +
              `\`${field}\` at a token that is strong in both themes.`
          );
          failures++;
        }
      }

      // Selecting a row fills it with `bg`; its label and its dot move onto that fill.
      for (const [what, field] of [
        ['selected label', 'color'],
        ['selected dot', selectedDotField],
      ]) {
        total++;
        const ink = e[field];
        const bg = e.bg;
        if (!ink || !bg) {
          console.error(`  ✗ ${themeName} ${e.type} — ${field} or ${e.bg} missing`);
          failures++;
          continue;
        }
        const r = contrastRatio(ink, bg);
        if (r >= MARK_MIN) {
          console.log(
            `  ✓ ${themeName} ${e.type} ${what} (${e[field]}) on its own ${e.bg} — ${r.toFixed(2)} : 1`
          );
        } else {
          console.error(
            `  ✗ ${themeName} ${e.type} ${what} (${e[field]} ${ink}) on ${e.bg} (${bg}) — ` +
              `${r.toFixed(2)} : 1 — below ${MARK_MIN} : 1`
          );
          console.error('    Fix: the selected row is filled with `bg`; pair it with ink that reads on it.');
          failures++;
        }
      }
    }

    // Two slices the user cannot separate make the chart unreadable whatever
    // each one scores against the card on its own.
    for (let i = 0; i < marks.length; i++) {
      for (let j = i + 1; j < marks.length; j++) {
        // A shared colour is allowed only when the two types are the same
        // entry in every respect — squat / lower_body are deliberately one
        // family. Matching on the mark alone would let an unrelated type be
        // aliased onto another's colour and call itself intentional.
        const a = marks[i].e;
        const b = marks[j].e;
        if (a.bg === b.bg && a.color === b.color && a.chart === b.chart) continue;
        total++;
        const d = deltaE76(marks[i].hex, marks[j].hex);
        if (d >= MARK_DISTINCT_MIN) continue;
        console.error(
          `  ✗ ${themeName} ${marks[i].type} (${marks[i].hex}) and ${marks[j].type} ` +
            `(${marks[j].hex}) are dE ${d.toFixed(1)} apart — the same swatch to a reader`
        );
        console.error('    Fix: two slices of one chart must not be the same colour.');
        failures++;
      }
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`foreground-contrast: FAILED (${failures} of ${total} check(s))\n`);
  process.exitCode = 1;
} else {
  console.log(`foreground-contrast: all ${total} checks passed\n`);
  process.exitCode = 0;
}
