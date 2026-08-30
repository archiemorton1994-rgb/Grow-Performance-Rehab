/**
 * Contract test: every session owns a colour, and the exercise card is printed
 * on paper.
 *
 * WHAT WAS WRONG
 * ──────────────
 * Every session looked the same. Squat day, deadlift day and a mobility session
 * from the Restore tab were one green card with a different title. And the rail
 * down the side of the exercise card carried the BLOCK's colour, which the pill
 * two lines below already gives in words: "the green on the left side of the
 * exercise box, what even is its purpose?"
 *
 * WHAT THIS ASSERTS, AND WHY EACH ONE IS HERE
 * ───────────────────────────────────────────
 * EVERY SESSION TYPE HAS ONE. A missing entry silently falls back to the custom
 * hue, so a new session type would look like a custom one and nothing would say
 * so.
 *
 * BOTH SHADES ARE LEGIBLE ON THEIR OWN GROUND. `deep` is drawn on the card's
 * parchment and `bright` on the app's near-black background. A palette picked
 * by eye drifts the first time somebody adds an eleventh session, and the
 * failure is silent: a colour nobody can see still renders.
 *
 * THEY ARE ACTUALLY DIFFERENT FROM EACH OTHER. Ten hues that all read as
 * "blueish" would satisfy every other check here and defeat the entire point.
 * This one earned its place immediately: squat and prehab were picked 15
 * degrees apart and bench and lower body 13, and both pairs looked fine in
 * isolation.
 *
 * AND THE GREEN IS SPENT ONCE. "The main big green confirmation box at the
 * bottom should be the only constant." Two 2pt green input borders sat directly
 * above it.
 *
 * Run:  npx tsx tests/session-identity.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
import { readFileSync } from 'fs';

const { SESSION_IDENTITY, PAGE, sessionIdentity } = await import('../lib/session-identity.ts');

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

// ── Colour maths ────────────────────────────────────────────────────────────
const channels = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const luminance = (h) => {
  const [r, g, b] = channels(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
/** Hue in degrees, for asking whether two colours are actually different. */
const hue = (h) => {
  const [r, g, b] = channels(h).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let deg;
  if (max === r) deg = ((g - b) / d) % 6;
  else if (max === g) deg = (b - r) / d + 2;
  else deg = (r - g) / d + 4;
  return (((deg * 60) % 360) + 360) % 360;
};

// The app's own two backgrounds, from constants/colors.ts.
const DARK_BG = '#000000';
const LIGHT_BG = '#fafbfa';

// ── 1. Every session type has one ───────────────────────────────────────────
console.log('\n[1] Every session type owns a colour');

const store = readFileSync(new URL('../lib/store.ts', import.meta.url), 'utf8');
const typeBlock = store.slice(
  store.indexOf('export type SessionType ='),
  store.indexOf(';', store.indexOf('export type SessionType ='))
);
const declared = (typeBlock.match(/'([a-z_]+)'/g) ?? []).map((s) => s.replace(/'/g, ''));

check(
  `SessionType declares ${declared.length} kinds of session`,
  declared.length >= 10,
  'parsed nothing, so everything below is checking an empty list'
);

const missing = declared.filter((t) => !SESSION_IDENTITY[t]);
check(
  'and every one of them has an identity',
  missing.length === 0,
  `missing: ${missing.join(', ')} - these would silently render as a custom session`
);

check(
  'an unknown type falls back rather than throwing',
  sessionIdentity('something-new').deep === SESSION_IDENTITY.custom.deep &&
    sessionIdentity(undefined).deep === SESSION_IDENTITY.custom.deep,
  'a crash on an unrecognised session type would take the whole screen down'
);

// ── 2. Legible on the ground it is drawn on ─────────────────────────────────
console.log('\n[2] Both shades read on the ground they sit on');

const dim = [];
for (const [type, id] of Object.entries(SESSION_IDENTITY)) {
  const onPage = contrast(id.deep, PAGE.bg);
  const onDark = contrast(id.bright, DARK_BG);
  if (onPage < 4.5) dim.push(`${type} deep ${onPage.toFixed(2)} on the page`);
  if (onDark < 4.5) dim.push(`${type} bright ${onDark.toFixed(2)} on black`);
}
check('deep clears 4.5:1 on the page and bright clears it on black', dim.length === 0, dim.join('; '));

check(
  'the page ink itself is comfortable on the page',
  contrast(PAGE.ink, PAGE.bg) >= 10 && contrast(PAGE.inkMuted, PAGE.bg) >= 4.5,
  `ink ${contrast(PAGE.ink, PAGE.bg).toFixed(2)}, muted ${contrast(PAGE.inkMuted, PAGE.bg).toFixed(2)}`
);

check(
  'and the page is light in both themes, because it is not themed',
  luminance(PAGE.bg) > 0.7 && contrast(PAGE.bg, DARK_BG) > 12 && contrast(PAGE.bg, LIGHT_BG) < 1.3,
  'the whole point is that the exercise stands out whichever theme somebody runs'
);

// ── 3. Actually different from one another ──────────────────────────────────
console.log('\n[3] No two sessions look like each other');

const deeps = Object.values(SESSION_IDENTITY).map((i) => i.deep);
check(
  'no two share a value',
  new Set(deeps).size === deeps.length,
  'two identical hues is two sessions that cannot be told apart'
);

const clashes = [];
const entries = Object.entries(SESSION_IDENTITY);
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const a = hue(entries[i][1].deep);
    const b = hue(entries[j][1].deep);
    const apart = Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    if (apart < 18) {
      clashes.push(`${entries[i][0]} and ${entries[j][0]} are ${apart.toFixed(0)} degrees apart`);
    }
  }
}
check('and no two sit within 18 degrees of hue', clashes.length === 0, clashes.join('; '));

// ── 4. The card is printed on the page ──────────────────────────────────────
console.log('\n[4] The exercise card is printed on the page');

const session = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');

check(
  'the card builds its styles from the page, not from the app theme',
  /function makeCardStyles\(/.test(session) &&
    /const styles = useMemo\(\(\) => makeCardStyles\(C, accent\), \[C, accent\]\);/.test(session),
  'this is what makes it impossible to leave a themed colour on the parchment'
);

check(
  'the page tones are merged over the base sheet rather than replacing it',
  /merged\[key\] = \{ \.\.\.\(base\[key\] \?\? \{\}\), \.\.\.value \};/.test(session),
  'replacing whole entries means every override restates padding and radius, and one omission is a broken card'
);

check(
  'the timers inside the card are on the page too',
  (session.match(/makeCardStyles\(C, accent\)/g) ?? []).length >= 4,
  'a rest timer using primarySurface is a dark green pill on cream'
);

check(
  'the rail is the session, not the block',
  /borderLeftColor: accent\.deep/.test(session) && !/borderLeftColor: cat\.text/.test(session),
  'the block is already named in words on the pill two lines below it'
);

check(
  'and the block pill no longer paints over the page',
  !/styles\.categoryPill, \{ backgroundColor: cat\.bg \}/.test(session),
  'an inline style beats the sheet, so the pill kept the block colours while everything around it changed'
);

// ── 5. The green is spent once ──────────────────────────────────────────────
console.log('\n[5] One green, on the button that finishes the set');

check(
  'the weight and reps boxes are not outlined in green',
  // barInput by name. The first version matched any 2pt green border and
  // tripped on activeSetInput, a style with zero references anywhere in the
  // file - a check that goes red for something nothing renders is telling you
  // about the source rather than about the screen.
  /barInput: \{[\s\S]{0,900}?borderColor: C\.border,/.test(session),
  'two green rectangles above a green button is three things competing to be the one you press'
);

check(
  'the button that finishes a set is still green',
  /didItBtn: \{[\s\S]{0,260}?backgroundColor: C\.primary/.test(session),
  'it has to be the same colour in every session, or the thing you press moves'
);

// ── 6. The end of the session is not a hole ─────────────────────────────────
console.log('\n[6] The end of the session shows the work');

check(
  'there is a recap on the page',
  /styles\.recapPage/.test(session) && /recapPage: \{[\s\S]{0,120}backgroundColor: PAGE\.bg/.test(session),
  'once the last set was logged the screen went to a blank rectangle'
);

check(
  'and the modifier tags are gone by then',
  /\{!allDone && \(hasAches \|\| energy !== 'normal' \|\| isTestWeek\) && \(/.test(session),
  'those describe how the session was built, which is not what the finished screen is for'
);

console.log(`\nsession-identity: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
