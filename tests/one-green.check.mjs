/**
 * Contract test: a session has two fixed visual constants, and this is both.
 *
 * ONE GREEN. Four buttons move a session forward - Start the session, Did It,
 * Mark Set Done, Complete Session - and they are the same green everywhere.
 * "The main big green confirmation box at the bottom should be the only
 * constant." They are painted from lib/go-colors.ts rather than from the
 * theme's primary family, because under that family they had drifted: Mark Set
 * Done and Complete Session were the deep green while Did It was the bright
 * one, so the button that finishes a set changed appearance depending on which
 * exercise you were on.
 *
 * ONE PAGE. The recap at the end of a session is printed on parchment, the same
 * paper as the summary certificate that follows it. That is the only place in
 * the app that is not themed, and the only place that should be.
 *
 * WHAT THIS FILE REPLACED. It was session-identity.check.mjs, which guarded ten
 * per-session hues swapped into the theme for the length of a session. That
 * shipped and was reverted at Archie's request - "the colours was a good idea in
 * principle but maybe better just a simplistic style as it was before" - so what
 * is left to guard is what did not move.
 *
 * Run:  npx tsx tests/one-green.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
import { readFileSync } from 'fs';

const { PAGE } = await import('../lib/session-identity.ts');
const { GO } = await import('../lib/go-colors.ts');

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

const luminance = (h) => {
  const s = h.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

// The app's own two backgrounds, from constants/colors.ts.
const DARK_BG = '#000000';
const LIGHT_BG = '#fafbfa';

const session = read('../app/session.tsx');

// ── 1. One green ────────────────────────────────────────────────────────────
console.log('\n[1] One green, on the four buttons that move you forward');

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
  'the session screen reads them from one place',
  /const go = useGoColors\(\);/.test(session),
  'four buttons painted from four places is how three of them drifted last time'
);

// Each of the four by name. A single count would pass with one button painted
// four times, which is exactly the kind of thing a careless merge produces.
for (const [label, pattern] of [
  ['Did It', /styles\.didItBtn,\s*\r?\n\s*\{ backgroundColor: go\.fill \}/],
  ['Mark Set Done', /styles\.barMarkDoneBtn, \{ backgroundColor: go\.fill \}/],
  ['Complete Session', /styles\.barCompleteSessionBtn,\s*\r?\n\s*\{ backgroundColor: go\.fill \}/],
  ['Start the session', /styles\.planStartBtn,\s*\r?\n\s*\{ backgroundColor: go\.fill \}/],
]) {
  check(`${label} is painted from go`, pattern.test(session), '');
}

check(
  // The bare name rather than `styles.barCompleteBtn`, so a stylesheet entry
  // left behind fails too. A dead style is how the button comes back: somebody
  // finds it, assumes it is wanted, and wires it up again.
  'and the second green confirm button beside the reps box is still gone',
  !/barCompleteBtn/.test(session),
  'a green square and a green bar eight pixels apart, both logging the same set'
);

check(
  // Bench was red for a round and this was the bug it exposed: "Easy" wore the
  // session's accent, which put it in the same red as "Too Hard" two chips
  // along. The accent is gone now, but the principle it taught is not - how
  // hard a set felt is a judgement, not an identity.
  'the effort scale is a fixed ramp, not an accent',
  /<GrowIcon name="effort1" size=\{17\} color=\{go\.fill\} \/>/.test(session) &&
    /<GrowIcon name="effort4" size=\{17\} color=\{C\.error\} \/>/.test(session),
  'green, neutral, red - and none of the three borrowed from anything else'
);

// ── 2. One page ─────────────────────────────────────────────────────────────
console.log('\n[2] One page, and it is only the recap');

check(
  'the page ink is comfortable on the page',
  contrast(PAGE.ink, PAGE.bg) >= 10 && contrast(PAGE.inkMuted, PAGE.bg) >= 4.5,
  `ink ${contrast(PAGE.ink, PAGE.bg).toFixed(2)}, muted ${contrast(PAGE.inkMuted, PAGE.bg).toFixed(2)}`
);

check(
  'and the page is light in both themes, because it is not themed',
  luminance(PAGE.bg) > 0.7 && contrast(PAGE.bg, DARK_BG) > 12 && contrast(PAGE.bg, LIGHT_BG) < 1.3,
  'the whole point is that it reads as a different object whichever theme somebody runs'
);

check(
  'there is a recap, and it is on the page',
  /styles\.recapPage/.test(session) &&
    /recapPage: \{[\s\S]{0,120}backgroundColor: PAGE\.bg/.test(session),
  'once the last set was logged the screen went to a blank rectangle'
);

check(
  'and the modifier tags are gone by then',
  /\{!allDone && \(hasAches \|\| energy !== 'normal' \|\| isTestWeek\) && \(/.test(session),
  'those describe how the session was built, which is not what the finished screen is for'
);

check(
  'the page is spent on the recap and nowhere else',
  !/exerciseCard: \{[\s\S]{0,80}backgroundColor: PAGE\.bg/.test(session),
  'the exercise card was parchment for a round and came back; paper is the finish, not the work'
);

console.log(`\none-green: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
