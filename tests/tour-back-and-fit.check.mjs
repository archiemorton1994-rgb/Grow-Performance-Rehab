/**
 * Contract test: the tour can be walked backwards, Home fits a phone, and every
 * screen that scrolls says so.
 *
 * THREE THINGS, ALL OF WHICH FAIL SILENTLY.
 *
 * 1. BACK ACROSS A TAB BOUNDARY.
 *    The tour walks Home, Train, Restore, Stats, Profile - which is tab indices
 *    0, 2, 3, 4, 1, NOT left to right. Deriving "the previous tab" as tab minus
 *    one gives the wrong answer for every tab in the chain, and the wrong answer
 *    is not an error: it is a working Back button that takes you somewhere else.
 *    And each tab's entry effect hardcoded setTutStep(0), so even a correct
 *    target would have dropped the user on that tab's FIRST card and made them
 *    walk it again.
 *
 * 2. HOME'S HEIGHT.
 *    Measured in a browser against the exported bundle, Home's scroll content
 *    was 974pt against 777pt of viewport on a 390x844 phone: the bottom row of
 *    the summary grid was cut off. Nothing in ~3,000 contract assertions
 *    measured it, and nothing could - so these pin the specific numbers that
 *    were cut, each of which is a decision somebody could undo without noticing.
 *
 * 3. THE SCROLL AFFORDANCE.
 *    All 23 of the app's main vertical scrollers hid their indicator. On the
 *    Train tab that means nothing on screen says Full Body and Conditioning
 *    exist.
 *
 * Run:  npx tsx tests/tour-back-and-fit.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';

const T = await import('../lib/tour-chain.ts');

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

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const TABS = [
  { name: 'Home', file: 'app/(tabs)/index.tsx', idx: 0, arr: 'homeEffectiveTutorial', fn: 'HomeTut' },
  { name: 'Train', file: 'app/(tabs)/train.tsx', idx: 2, arr: 'TRAIN_TUTORIAL', fn: 'TrainTut' },
  { name: 'Restore', file: 'app/(tabs)/recover.tsx', idx: 3, arr: 'RESTORE_TUTORIAL', fn: 'RestoreTut' },
  { name: 'Stats', file: 'app/(tabs)/workouts.tsx', idx: 4, arr: 'STATS_TUTORIAL', fn: 'StatsTut' },
  { name: 'Profile', file: 'app/(tabs)/profile.tsx', idx: 1, arr: 'PROFILE_TUTORIAL', fn: 'ProfileTut' },
];

// ─── 1. The chain knows its own order ────────────────────────────────────────
console.log('\n[1] Back goes to the tab the tour actually came from');

check(
  'the chain is the tour order, not the tab-bar order',
  JSON.stringify([...T.TOUR_CHAIN]) === JSON.stringify([0, 2, 3, 4, 1]),
  `got ${JSON.stringify([...T.TOUR_CHAIN])}`
);
check(
  'and it is NOT ascending, which is the whole point',
  [...T.TOUR_CHAIN].some((v, i, a) => i > 0 && v < a[i - 1]),
  'if this ever sorts, `tab - 1` would start working by accident and the chain would look redundant'
);
check(
  'the first tab has nowhere to go back to',
  T.previousTourTab(0) === null,
  ''
);
for (const [tab, prev] of [
  [2, 0],
  [3, 2],
  [4, 3],
  [1, 4],
]) {
  check(`tab ${tab} goes back to tab ${prev}`, T.previousTourTab(tab) === prev, `got ${T.previousTourTab(tab)}`);
}
/**
 * `tab - 1` is right for Restore (3 -> 2) and Stats (4 -> 3), and wrong for
 * Train (2 -> 0, not 1) and Profile (1 -> 4, not 0). That mix is exactly what
 * makes it dangerous: it would work for the two tabs in the middle of the tour
 * and take the user to the wrong screen at the two ends, which reads as a
 * glitch rather than as a bug in an assumption.
 */
const naiveWrong = [2, 3, 4, 1].filter((t) => T.previousTourTab(t) !== t - 1);
check(
  `tab minus one is wrong for ${naiveWrong.length} of the four (tabs ${naiveWrong.join(', ')})`,
  naiveWrong.length === 2 && naiveWrong.includes(2) && naiveWrong.includes(1),
  `got ${JSON.stringify(naiveWrong)}`
);
check(
  'an index outside the chain returns null rather than guessing',
  T.previousTourTab(9) === null && T.previousTourTab(null) === null,
  'a stale index should hide the control, not jump somewhere arbitrary'
);

// ─── 2. Back targets: within a tab, then across one ──────────────────────────
console.log('\n[2] Within a tab it steps; at the top of one it crosses');

check(
  'the very first card of the whole tour offers no Back at all',
  T.tourBackTarget(0, 0) === null,
  'not a disabled control - no control'
);
check(
  'card 3 of Home goes back to card 2',
  JSON.stringify(T.tourBackTarget(0, 2)) === JSON.stringify({ kind: 'step', step: 1 }),
  ''
);
check(
  'card 1 of Train crosses to Home',
  JSON.stringify(T.tourBackTarget(2, 0)) === JSON.stringify({ kind: 'tab', tab: 0 }),
  ''
);
check(
  'card 1 of Profile crosses to Stats, not to Home',
  JSON.stringify(T.tourBackTarget(1, 0)) === JSON.stringify({ kind: 'tab', tab: 4 }),
  'Profile is tab 1 and Home is tab 0, so the naive answer here is spectacularly wrong'
);
check(
  'a tab with no card showing offers nothing',
  T.tourBackTarget(3, null) === null,
  ''
);

// ─── 3. Entering a tab backwards lands on its last card ──────────────────────
console.log('\n[3] Crossing back does not restart the tab');

check(
  'entering forwards opens the first card',
  T.entryStepFor(false, 5) === 0 && T.entryStepFor(false, 1) === 0,
  ''
);
check(
  'entering backwards opens the last',
  T.entryStepFor(true, 5) === 4 && T.entryStepFor(true, 3) === 2,
  'otherwise Back from Restore drops you on Train card 1 and you walk the tab again'
);
check(
  'a one-card tab is handled (Stats has exactly one)',
  T.entryStepFor(true, 1) === 0,
  ''
);
check(
  'and an empty array cannot produce a negative index',
  T.entryStepFor(true, 0) === 0,
  ''
);

// ─── 4. Every tab is wired ───────────────────────────────────────────────────
console.log('\n[4] All five tabs, plus the card itself');

const coach = stripComments(read('components/CoachMark.tsx'));
check(
  'CoachMark takes an optional onPrev',
  /onPrev\?: \(\) => void;/.test(coach),
  'it MUST be optional: tests/spotlight-shape.test.tsx renders this component with an exact prop set'
);
check(
  'and renders nothing when it is absent',
  /\{onPrev \? \(/.test(coach),
  'absent means there is nowhere to go back to, which is a missing control rather than a disabled one'
);
check(
  'a card can be swiped, which it advertised and never did',
  /if \(dx < -40\) onNextRef\.current\?\.\(\);/.test(coach) &&
    /else if \(dx > 40\) onPrevRef\.current\?\.\(\);/.test(coach),
  'a full PanResponder sat behind an onSwipeLeft prop that no caller ever passed, so the gesture was captured and dropped'
);
check(
  'Back sits with Next rather than at the far left',
  /styles\.navCluster/.test(coach) && /testID="coachmark-prev"/.test(coach),
  'styles.actions is space-between with two children; a third would put Back dead centre where it reads as the primary action'
);

for (const t of TABS) {
  const src = stripComments(read(t.file));
  check(
    `${t.name}: has a back handler using the chain`,
    new RegExp(`const back${t.fn} = useCallback`).test(src) &&
      new RegExp(`tourBackTarget\\(${t.idx}, tutStep\\)`).test(src),
    ''
  );
  check(
    `${t.name}: passes onPrev only when there is somewhere to go`,
    new RegExp(`onPrev=\\{tourBackTarget\\(${t.idx}, tutStep\\) \\? back${t.fn} : undefined\\}`).test(
      src
    ),
    ''
  );
  check(
    `${t.name}: its entry effect honours the backwards flag`,
    new RegExp(`entryStepFor\\(tourEnterAtLastStep, ${t.arr}\\.length\\)`).test(src) &&
      /if \(tourEnterAtLastStep\) setTourEnterAtLastStep\(false\);/.test(src),
    'without this a backwards arrival restarts the tab'
  );
}

const store = stripComments(read('lib/store.ts'));
check(
  'the flag exists and is not persisted',
  /tourEnterAtLastStep: boolean;/.test(store) &&
    /tourEnterAtLastStep: _tourEnterAtLastStep,/.test(store),
  'a killed app restarts the tour from its intro, not halfway back through it'
);

// ─── 5. The Custom card is spotlit on its own ────────────────────────────────
console.log('\n[5] "Or build your own" points at the Custom card');

const train = stripComments(read('app/(tabs)/train.tsx'));
check(
  'the step has its own spotlight key',
  /spotlightRef: 'custom',/.test(train),
  'it reused kpi, so the user saw the identical highlight twice in a row'
);
check(
  'and the key resolves to the card, not the grid',
  /custom: customRef,/.test(train) &&
    /ref=\{type === 'custom' \? customRef : undefined\}/.test(train),
  ''
);
check(
  'with collapsable={false}, or Android measures it as 0x0',
  /collapsable=\{type === 'custom' \? false : undefined\}/.test(train),
  ''
);
check(
  'and it scrolls to the KPI section, because a card inside a grid has no scroll offset of its own',
  /const scrollKey = stepKey === 'custom' \? 'kpi' : stepKey;/.test(train),
  "sectionScrollY holds onLayout offsets for top-level sections; asking it for 'custom' reads undefined and scrolls to NaN"
);

// ─── 6. Home's budget ────────────────────────────────────────────────────────
console.log('\n[6] Home fits one screen on a modern phone');

const home = read('app/(tabs)/index.tsx');
const num = (re, label) => {
  const m = home.match(re);
  if (!m) {
    check(`${label} was found in the styles`, false, 'the parse has gone stale');
    return null;
  }
  return Number(m[1]);
};

/**
 * Every number here was measured, not chosen. The screen was 974pt of content
 * against a 777pt viewport; these are the cuts that closed 197pt of that
 * without removing a single piece of information.
 */
const todayIcon = num(/todayIcon: \{\s*\n\s*width: (\d+),/, 'todayIcon');
check(
  `the session illustration is ${todayIcon}pt, not 112`,
  todayIcon !== null && todayIcon <= 84,
  'it was the single tallest thing in the hero card and it set that row height on its own'
);
/**
 * The tile artwork has two sizes and the phone picks one.
 *
 * Every attempt to make this flexible failed. A grid that could grow put Home
 * on a scrollbar; a bounded grid with a flexible picture gave 185pt tiles with
 * the logo stranded at its ceiling half way up them; a picture with no ceiling
 * fell back on its own aspect ratio and produced a 301pt tile. Two fixed sizes,
 * chosen from the window height, is what actually holds - measured in the
 * exported build at 390x844, 375x812 and 360x780, all three exactly the
 * viewport with nothing to scroll.
 *
 * The full sizing budget lives in your-program-card.check.mjs. What matters
 * here, in the screen's own fit section, is that neither size is a poster.
 */
const tileImage = num(/summaryCardImage: \{[^}]*height: compactTiles \? \d+ : (\d+)/, 'summaryCardImage');
check(
  `the summary tile artwork is ${tileImage}pt on a full-size phone`,
  tileImage !== null && tileImage <= 72,
  'four of them, two rows: every point above this comes out of the grid twice'
);
check(
  'and the phone chooses which of its two sizes it gets',
  /const compactTiles = windowHeight < \d+;/.test(home) &&
    /minHeight: compactTiles \? \d+ : \d+/.test(home),
  'one fixed size cannot both fill a 6.7 inch screen and fit a 5.5 inch one'
);
const innerGap = num(/inner: \{[^}]*gap: (\d+)/, 'inner gap');
check(
  `the gap between blocks is ${innerGap}pt, not 16`,
  innerGap !== null && innerGap <= 12,
  'four gaps at 16 was 64pt of air on a screen that was 197pt over'
);
check(
  'the bottom reserve is the tab bar plus a gap, not plus 24',
  /paddingBottom: Platform\.OS === 'web' \? 84 \+ 8 : tabBarHeight \+ 8/.test(home),
  'tabBarHeight is already 84 for an 83pt bar; the old +24 reserved 108pt for it'
);
check(
  'the session name and subtitle are pinned to one line',
  /<Text style=\{styles\.todaySessionName\} numberOfLines=\{1\}>/.test(home) &&
    /<Text style=\{styles\.todaySessionSub\} numberOfLines=\{1\}>/.test(home),
  'below ~90pt the artwork stops setting the row height and the text takes over, so the card would be taller on the days squat comes up than on the days deadlift does'
);
check(
  'the equipment chip and Train something else share a row',
  /styles\.chipRow/.test(home),
  'stacked they were 90pt for two controls carrying one line each'
);
check(
  'and Train something else is still in both hero branches',
  (stripComments(home).match(/testID="home-train-something-else"/g) ?? []).length === 2,
  'shrinking the screen must not be done by deleting the thing that was added to it'
);
check(
  'the dead summaryIconBox style is gone',
  !/summaryIconBox/.test(home),
  'it had no JSX reference and a contract test was deriving a height budget from its constants'
);

// ─── 7. Scroll affordance ────────────────────────────────────────────────────
console.log('\n[7] A screen that scrolls says so');

const indicator = stripComments(read('components/ScrollIndicator.tsx'));
check(
  'the indicator renders nothing when the content fits',
  /if \(viewportHeight <= 0 \|\| contentHeight <= 0 \|\| overflow <= 8\) return null;/.test(indicator),
  'a bar on a screen with nothing below the fold is noise, and it would appear for one user and not another depending on their phone'
);
check(
  'the scroll offset never goes through React state',
  /Animated\.event/.test(indicator) &&
    /scrollY\.interpolate/.test(indicator) &&
    !/setScrollY|useState\(0\)[\s\S]{0,40}scrollY/.test(indicator),
  'onScroll fires at 60fps; putting the offset in state re-renders the whole screen on every frame of every scroll'
);
check(
  'and it does NOT use the native driver, which returns an object here',
  /useNativeDriver: false/.test(indicator) && !/useNativeDriver: true/.test(indicator),
  'Animated.event returns an AnimatedEvent OBJECT with the native driver on and a FUNCTION with it off. Every consumer spreads these handlers onto a plain ScrollView and profile calls handlers.onScroll(e) itself, so the native version crashed five screens with "onScroll is not a function (it is Object)". This check used to assert the opposite and held the crash in place.'
);
check(
  'the thumb has a floor, so a long list is not a dot',
  /Math\.max\(\s*MIN_THUMB/.test(indicator),
  ''
);

for (const f of [
  'app/(tabs)/index.tsx',
  'app/(tabs)/train.tsx',
  'app/(tabs)/recover.tsx',
  'app/(tabs)/profile.tsx',
  'app/program.tsx',
]) {
  const src = stripComments(read(f));
  check(
    `${f} shows one`,
    /useScrollIndicator\(\)/.test(src) && /<ScrollIndicator /.test(src),
    ''
  );
}
check(
  'Profile keeps its own onScroll as well as the indicator',
  /scrollOffsetY\.current = e\.nativeEvent\.contentOffset\.y;\s*\n\s*scrollHint\.handlers\.onScroll\(e\);/.test(
    stripComments(read('app/(tabs)/profile.tsx'))
  ),
  'that ref is what the tour uses to scroll a spotlight target into view; spreading over it would have silently broken the tour'
);

// ─── 8. The last uncapped list in Stats ──────────────────────────────────────
console.log('\n[8] Personal Bests stops somewhere');

const stats = stripComments(read('app/(tabs)/workouts.tsx'));
check(
  'the list is capped until asked to expand',
  /const COLLAPSED_PER_LIFT = 4;/.test(stats) &&
    /showAllPbs\s*\?\s*grouped\[lift\]\s*:\s*grouped\[lift\]\.slice\(0, COLLAPSED_PER_LIFT\)/.test(
      stats
    ),
  'it rendered every entry the store held: about 585pt at 60 sessions, 1000 at two years, and unbounded via the 1RM calculator which appends on every save'
);
check(
  'the cap is per lift, not shared across the card',
  /COLLAPSED_PER_LIFT\)/.test(stats) &&
    /liftsWithData\.reduce\(/.test(stats),
  'a shared budget spent top-down shows eight squat PBs and no deadlift, which defeats the point of comparing the three'
);
check(
  'and it says how many are hidden',
  /Show all \(\{hiddenCount\} more\)/.test(stats) && /testID="pb-show-all"/.test(stats),
  'same wording as the Progress tab, so it is the same thing in both places'
);

// ─── 9. Program is true for somebody off the barbell rotation ────────────────
console.log('\n[9] Your Program, for a conditioning-and-mobility user');

const program = stripComments(read('app/program.tsx'));
check(
  'a due test cannot decorate a non-barbell session',
  /const testWeek = isTestWeekDue\(\) && onStrengthProgramme;/.test(program),
  'isTestWeekDue is about the strength-session count and knows nothing about what the user trains now, so a diverted user got a trophy and the words Strength Test over a conditioning row'
);
check(
  'and the start button cannot launch one as a test',
  /isTestWeek: testWeek \? 'true' : 'false'/.test(program) &&
    /const testWeek = isTestWeekDue\(\) && onStrengthProgramme;/.test(program),
  'readiness strips the energy and time questions and offers "Begin Test" for whatever it is handed'
);
check(
  'every session type gets a recency label, not just the three lifts',
  /for \(const type of Object\.keys\(SESSION_META\) as SessionType\[\]\)/.test(program),
  'it was built over SESSION_ORDER, so a conditioning row looked up a missing key and rendered a blank line'
);
check(
  'the non-barbell copy lives in lib/ where a test can run it',
  /nonStrengthContextMessage/.test(program) &&
    !/function getNonStrengthMessage/.test(program),
  'the barbell counterpart already moved there; this one was asserted by a single regex checking it existed'
);

console.log('');
if (failures > 0) {
  console.error(`tour-back-and-fit: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`tour-back-and-fit: all ${total} checks passed\n`);
  process.exitCode = 0;
}
