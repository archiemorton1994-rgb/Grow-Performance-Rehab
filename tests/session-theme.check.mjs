/**
 * Contract test: the whole session wears the session's colour, and nothing
 * became harder to read on the way.
 *
 * WHAT WAS WRONG
 * ──────────────
 * The first pass at session colours spent the hue in three places - the rail,
 * the strip marks, a little card furniture - and left everything else painting
 * itself from the theme's green. So a squat session was a blue rail on a green
 * screen. Reported as "the pop up messages in the session are all still green",
 * "the pre-session screens are all still green", and "it doesn't feel
 * consistent in session with the colouring and theme".
 *
 * The fix re-tones the theme itself for the length of a session, which is a
 * large lever: it repaints every surface and every accent on every screen of
 * the flow at once. A lever that size needs its safety proved rather than
 * eyeballed, which is most of what is below.
 *
 * WHAT THIS ASSERTS, AND WHY EACH ONE IS HERE
 * ───────────────────────────────────────────
 * NOTHING GOT HARDER TO READ. Every derived token comes back at the exact
 * brightness of the token it replaces. Contrast is a function of luminance
 * alone, so if that holds, every text-on-surface pair in the session flow keeps
 * the ratio it was checked at and no separate audit is needed. If it ever stops
 * holding, the failure is silent: a slightly dimmer grey on a slightly lighter
 * card still renders.
 *
 * THE FOUR EXCEPTIONS ARE CHECKED DIRECTLY. primary, primaryDark and
 * primaryText take the identity's own shades, and a pure black background has
 * no brightness to preserve, so those four are measured against the grounds
 * they are actually drawn on.
 *
 * THE SESSIONS ARE STILL TELLABLE APART. Ten themes that all resolve to the
 * same near-black would satisfy every contrast assertion here and defeat the
 * entire point of the change.
 *
 * THE GO BUTTON IS PINNED. "The main big green confirmation box at the bottom
 * should be the only constant." Four buttons move a session forward and all
 * four are painted from GO rather than from a token, because the tokens are the
 * thing being re-toned.
 *
 * AND THE FLOW ACTUALLY USES IT. A screen that still calls useColors() looks
 * exactly right in the theme it was designed in and wrong in all nine others,
 * which is the bug this whole change exists to fix.
 *
 * Run:  npx tsx tests/session-theme.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
import { readFileSync } from 'fs';

const {
  sessionColorOverrides,
  relativeLuminance,
  LUMINANCE_MATCHED_TOKENS,
  BLACK_BACKGROUND_FLOOR,
  GO,
} = await import('../lib/session-theme.ts');
const { SESSION_IDENTITY } = await import('../lib/session-identity.ts');

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const contrast = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

// ── The two base palettes, read from the app rather than copied ─────────────
// Copying them here would pass forever after somebody changed a token.
const colorsSrc = read('../constants/colors.ts');

function palette(name) {
  const start = colorsSrc.indexOf(`const ${name} = {`);
  const end = colorsSrc.indexOf('\n};', start);
  const block = colorsSrc.slice(start, end);
  const out = {};
  for (const [, key, value] of block.matchAll(/^\s{2}([a-zA-Z]+):\s*'([^']+)',/gm)) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

const LIGHT = palette('LightColors');
const DARK = palette('DarkColors');

const TYPES = Object.keys(SESSION_IDENTITY);

console.log('\n[1] The palettes were read, not assumed');

check(
  'both base palettes parsed with the tokens a session re-tones',
  TYPES.length >= 10 &&
    ['primary', 'primaryMuted', 'primarySurface', 'background', 'surface', 'success'].every(
      (k) => typeof LIGHT[k] === 'string' && typeof DARK[k] === 'string'
    ),
  'nothing below is checking anything if this failed'
);

check(
  'and the dark theme background really is the pure black the floor exists for',
  DARK.background === '#000000',
  `read ${DARK.background} - if this changed, the floor may no longer be needed`
);

// ── 1. Nothing got harder to read ──────────────────────────────────────────
console.log('\n[2] Every derived token keeps the brightness it replaced');

// One 8-bit rounding step near mid grey is worth about 0.003 of luminance, and
// the search that lands on the target rounds once. Anything larger than that is
// a real change in brightness, not arithmetic.
const LUMINANCE_TOLERANCE = 0.004;

const drifted = [];
for (const [themeName, base, isDark] of [
  ['dark', DARK, true],
  ['light', LIGHT, false],
]) {
  for (const type of TYPES) {
    const out = sessionColorOverrides(base, type, isDark);
    for (const token of LUMINANCE_MATCHED_TOKENS) {
      const before = base[token];
      const after = out[token];
      // rgba() tokens are passed through untouched by design.
      if (!before?.startsWith('#')) continue;
      const delta = Math.abs(relativeLuminance(before) - relativeLuminance(after));
      if (delta > LUMINANCE_TOLERANCE) {
        drifted.push(`${themeName}/${type}/${token} ${before}->${after} by ${delta.toFixed(4)}`);
      }
    }
  }
}

check(
  `all ${LUMINANCE_MATCHED_TOKENS.length} derived tokens hold their luminance across 10 sessions and 2 themes`,
  drifted.length === 0,
  drifted.slice(0, 4).join('; ')
);

// The same claim stated the way it will actually be felt, so a reader does not
// have to trust that luminance implies contrast.
const worsened = [];
for (const [themeName, base, isDark, inks] of [
  ['dark', DARK, true, [DARK.text, DARK.textSecondary, DARK.textTertiary]],
  ['light', LIGHT, false, [LIGHT.text, LIGHT.textSecondary, LIGHT.textTertiary]],
]) {
  for (const type of TYPES) {
    const out = sessionColorOverrides(base, type, isDark);
    for (const token of LUMINANCE_MATCHED_TOKENS) {
      const before = base[token];
      const after = out[token];
      if (!before?.startsWith('#')) continue;
      for (const ink of inks) {
        const was = contrast(ink, before);
        const now = contrast(ink, after);
        if (Math.abs(now - was) / was > 0.03) {
          worsened.push(`${themeName}/${type}/${token} ${was.toFixed(2)} -> ${now.toFixed(2)}`);
        }
      }
    }
  }
}

check(
  'and no text-on-surface ratio in the flow moves by more than 3 per cent',
  worsened.length === 0,
  worsened.slice(0, 4).join('; ')
);

// ── 2. The four that are not derived ───────────────────────────────────────
console.log('\n[3] The colours that are chosen rather than derived still clear AA');

const dim = [];
for (const [themeName, base, isDark] of [
  ['dark', DARK, true],
  ['light', LIGHT, false],
]) {
  for (const type of TYPES) {
    const o = sessionColorOverrides(base, type, isDark);
    // primary is the fill the app puts white text on.
    const onPrimary = contrast(base.textInverse, o.primary);
    // primaryDark is the other fill, and its text token flips with the theme.
    const onPrimaryDark = contrast(base.primaryDarkText, o.primaryDark);
    // primaryText is ink, drawn on the two grounds the session flow uses.
    const inkOnBg = contrast(o.primaryText, o.background);
    const inkOnSurface = contrast(o.primaryText, o.surface);
    for (const [label, value] of [
      ['white on primary', onPrimary],
      ['text on primaryDark', onPrimaryDark],
      ['primaryText on background', inkOnBg],
      ['primaryText on surface', inkOnSurface],
    ]) {
      if (value < 4.5) dim.push(`${themeName}/${type} ${label} ${value.toFixed(2)}`);
    }
  }
}

check(
  'primary, primaryDark and primaryText all clear 4.5:1 on the ground they are drawn on',
  dim.length === 0,
  dim.slice(0, 5).join('; ')
);

console.log('\n[4] The black background is tinted, and still black');

const blackIssues = [];
for (const type of TYPES) {
  const o = sessionColorOverrides(DARK, type, true);
  if (o.background === '#000000') blackIssues.push(`${type} took no tint at all`);
  if (contrast(DARK.text, o.background) < 15) {
    blackIssues.push(`${type} white text at ${contrast(DARK.text, o.background).toFixed(1)}:1`);
  }
  if (relativeLuminance(o.background) > BLACK_BACKGROUND_FLOOR * 1.4) {
    blackIssues.push(`${type} background lifted to ${relativeLuminance(o.background).toFixed(4)}`);
  }
}

check(
  'a black background takes the hue without becoming a grey one',
  blackIssues.length === 0,
  blackIssues.slice(0, 4).join('; ')
);

// ── 3. Ten sessions that can be told apart ─────────────────────────────────
console.log('\n[5] Ten sessions still look like ten sessions');

// The accents are where identity lives in BOTH themes, so they are checked in
// both. A session whose fill, ink and chip tint all match another session's is
// a session nobody can name at a glance, which is the whole point of the
// change.
for (const [themeName, base, isDark] of [
  ['dark', DARK, true],
  ['light', LIGHT, false],
]) {
  // Each token on its own, not the three of them concatenated. A combined key
  // stays unique while any ONE of them is pinned to the brand green, which is
  // exactly the half-finished state this whole change is fixing: the fill went
  // to the session and the ink stayed green, or the other way round.
  for (const token of ['primary', 'primaryDark', 'primaryText', 'primaryMuted']) {
    const values = TYPES.map((t) => sessionColorOverrides(base, t, isDark)[token]);
    check(
      `${themeName}: every session has its own ${token}`,
      new Set(values).size === values.length,
      values.join(' ')
    );
  }
}

// The tinted greys are only checked in dark mode, and that is a real limit
// rather than an oversight. A light theme's card is #ffffff: there is no
// brightness above white to trade for chroma, so holding its luminance holds it
// at white. Light mode carries the session in its accents and nowhere else; the
// near-black of dark mode has room for both, and dark mode is where the
// difference between a squat day and a deadlift day is felt across the screen.
const darkBackgrounds = TYPES.map((t) => sessionColorOverrides(DARK, t, true).background);
check(
  'dark: no two sessions resolve to the same background',
  new Set(darkBackgrounds).size === darkBackgrounds.length,
  darkBackgrounds.join(' ')
);

const darkSurfaces = TYPES.map((t) => sessionColorOverrides(DARK, t, true).surface);
check(
  'dark: and no two share a card surface',
  new Set(darkSurfaces).size === darkSurfaces.length,
  darkSurfaces.join(' ')
);

check(
  'light: the theme stays a light theme, no matter which session',
  TYPES.every((t) => {
    const o = sessionColorOverrides(LIGHT, t, false);
    return relativeLuminance(o.background) > 0.85 && relativeLuminance(o.surface) > 0.9;
  }),
  'a tint that darkened the page would turn the light theme into a coloured one'
);

// ── 4. The go button ───────────────────────────────────────────────────────
console.log('\n[6] One green, on the four buttons that move you forward');

const session = read('../app/session.tsx');

check(
  'the go colours are the ones the app already used for a green button',
  GO.light.fill === '#2f6b46' && GO.dark.fill === '#4ade80' && GO.dark.on === '#1a1d1b',
  'these have to match primaryDark/primaryDarkText or the button changes appearance'
);

check(
  'and they clear AA both ways round',
  contrast(GO.light.on, GO.light.fill) >= 4.5 && contrast(GO.dark.on, GO.dark.fill) >= 4.5,
  `light ${contrast(GO.light.on, GO.light.fill).toFixed(2)}, dark ${contrast(GO.dark.on, GO.dark.fill).toFixed(2)}`
);

check(
  'the session screen reads them',
  /const go = useGoColors\(\);/.test(session),
  'without this the four buttons are painted from tokens that are being re-toned'
);

// Each of the four by name. A single count would pass with one button painted
// four times, which is exactly the kind of thing a careless merge produces.
for (const [label, pattern] of [
  ['Did It', /testID=\{`did-it-\$\{activeSetIndex \+ 1\}`\}/],
  ['Mark Set Done', /styles\.barMarkDoneBtn, \{ backgroundColor: go\.fill \}/],
  ['Complete Session', /styles\.barCompleteSessionBtn,\s*\r?\n\s*\{ backgroundColor: go\.fill \}/],
  ['Start the session', /styles\.planStartBtn,\s*\r?\n\s*\{ backgroundColor: go\.fill \}/],
]) {
  check(`${label} is painted from go, not from a token`, pattern.test(session), '');
}

check(
  'Did It carries the go fill',
  /styles\.didItBtn,\s*\r?\n\s*\{ backgroundColor: go\.fill \}/.test(session),
  'the button Archie approved is the one that must not change colour with the session'
);

check(
  // The bare name rather than `styles.barCompleteBtn`, so a stylesheet entry
  // left behind fails too. A dead style is how the button comes back: somebody
  // finds it, assumes it is wanted, and wires it up again.
  'and the second green confirm button beside the reps box is gone',
  !/barCompleteBtn/.test(session),
  'a green square and a green bar eight pixels apart, both logging the same set'
);

// ── 5. The flow actually uses the session theme ────────────────────────────
console.log('\n[7] Every screen in the flow is coloured for the session');

check(
  'the session screen wraps itself in its own colour',
  /<SessionThemeProvider type=\{type\}>/.test(session) &&
    /function SessionScreenBody\(\)/.test(session),
  'the modals render through a portal, so the provider has to sit above the whole screen'
);

for (const [file, path] of [
  ['app/session.tsx', '../app/session.tsx'],
  ['app/readiness.tsx', '../app/readiness.tsx'],
  ['components/SessionProgressStrip.tsx', '../components/SessionProgressStrip.tsx'],
]) {
  const src = read(path);
  check(
    `${file} takes its colours from the session`,
    /useSessionColors\(/.test(src) && !/^\s*const C = useColors\(\);/m.test(src),
    'a screen still on useColors() is green in a session that is not'
  );
}

const planList = read('../components/SessionPlanList.tsx');

check(
  // It was parchment for one round: "revert the pre workout session exercise
  // list back to match the theme aka dark or light, but it can have instead
  // subtle colouring to match the theme of the workout". Which is what taking
  // its colours from the session context gives it - no hard-coded value in the
  // file at all, and the tint arrives with the theme.
  'the plan list is on the theme, coloured by the session',
  /useSessionColors\(\)/.test(planList) && !/PAGE\./.test(planList),
  'a cream list on a dark screen was the thing that came back'
);

check(
  'and it carries no palette of its own',
  !/#[0-9a-fA-F]{6}/.test(planList),
  'one hard-coded colour here and the list stops following the session'
);

console.log(`\nsession-theme: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
