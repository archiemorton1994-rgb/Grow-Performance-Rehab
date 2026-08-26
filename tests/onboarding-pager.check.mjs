/**
 * Contract test: the onboarding pager's indices all agree.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The flow is a horizontal pager driven by a bare screen index, and that index
 * is consumed in four separate places which must stay in step:
 *
 *   - the canContinue() switch, which gates the Continue button
 *   - the handleNext() boundaries, which decide where each step goes next
 *   - index-keyed effects (focus a field, run the celebration animation)
 *   - the progress bar fraction
 *
 * Inserting one screen means editing all four. Miss one and the failure is
 * quiet and bad: a step whose Continue button never enables (canContinue falls
 * through to `default: false`), or a save that fires before the answer it is
 * meant to persist exists.
 *
 * That second one is not hypothetical. The test-week question was first added
 * as a block appended to the best-lifts screen, where it fell below the fold
 * behind three inputs and a skip link — invisible unless you scrolled. Moving
 * it to its own screen also had to move the save, because saveAndComplete ran
 * at the end of the best-lifts step and would have written the default no
 * matter what the user picked.
 *
 * Run:  node tests/onboarding-pager.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dir, '../app/onboarding.tsx'), 'utf8');

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

// ─── 1. Indices are named, and the screen count matches ──────────────────────
console.log('\n[1] The pager has as many screens as it thinks');

// Read every declared screen index rather than three named ones, so this test
// survives the screens being REORDERED and not merely added to. The theme
// question moved from second-to-last to second, which the previous version of
// this file could not express.
const INDEX_DECL = /const ([A-Z_]+)_INDEX = (\d+);/g;
const indices = Object.fromEntries(
  [...src.matchAll(INDEX_DECL)].map((m) => [`${m[1]}_INDEX`, Number(m[2])])
);
const idx = (name) => indices[name] ?? null;
const TEST_WEEK_INDEX = idx('TEST_WEEK_INDEX');
const LIFTS_INDEX = idx('LIFTS_INDEX');
const THEME_INDEX = idx('THEME_INDEX');
const CELEBRATION_INDEX = idx('CELEBRATION_INDEX');
const values = Object.values(indices).sort((a, b) => a - b);

check(
  'every screen has a named index',
  TEST_WEEK_INDEX != null && THEME_INDEX != null && CELEBRATION_INDEX != null,
  ''
);
check(
  `the indices run 0..${values.length - 1} with no gaps or duplicates`,
  values.length > 0 && values.every((v, i) => v === i),
  Object.entries(indices)
    .sort((a, b) => a[1] - b[1])
    .map(([k, v]) => `${v}:${k.replace('_INDEX', '')}`)
    .join(' ')
);
check(
  'the celebration is last',
  CELEBRATION_INDEX === values[values.length - 1],
  'the finish screen has to be the finish'
);
// Theme changes how every LATER screen looks, so asking it late means the flow
// changes appearance right before the finish. Asking it early is the point of
// having moved it, and this is the assertion that says so.
check(
  'the theme question comes before the profile questions',
  THEME_INDEX < TEST_WEEK_INDEX && THEME_INDEX <= 2,
  `theme is at ${THEME_INDEX}; it should be near the start so the rest of onboarding renders in the chosen theme`
);

const screenCount = (src.match(/styles\.screen, \{ width: SCREEN_WIDTH \}/g) ?? []).length;
check(
  `the pager renders ${CELEBRATION_INDEX + 1} screens`,
  screenCount === CELEBRATION_INDEX + 1,
  `found ${screenCount} screen views but the last index is ${CELEBRATION_INDEX}`
);

// ─── 2. Every index can advance ──────────────────────────────────────────────
console.log('\n[2] No screen has a Continue button that can never enable');

const switchBlock = src.slice(src.indexOf('const canContinue'), src.indexOf('const saveAndComplete'));
const covered = new Set();
for (const m of switchBlock.matchAll(/case (\d+):/g)) covered.add(Number(m[1]));
// Resolve every named case, not a hand-listed pair — the whole switch is
// written in named indices now, so a hardcoded list here would silently stop
// seeing most of it.
for (const m of switchBlock.matchAll(/case ([A-Z_]+_INDEX):/g)) {
  if (idx(m[1]) != null) covered.add(idx(m[1]));
}
const uncovered = [];
for (let i = 0; i < CELEBRATION_INDEX; i++) if (!covered.has(i)) uncovered.push(i);
check(
  'canContinue covers every screen before the celebration',
  uncovered.length === 0,
  `screens ${uncovered.join(', ')} fall through to default:false — their Continue button is dead`
);

// ─── 3. The save happens after the answer exists ─────────────────────────────
console.log('\n[3] The profile is saved once every answer has been given');

// Derived, not named. The two question screens have now swapped once, so what
// has to hold is not "the save is on the test-week screen" but "the save is on
// whichever screen is last" - which survives the next reorder as well.
const lastQuestion = Object.entries(indices).find(([, v]) => v === CELEBRATION_INDEX - 1)?.[0];
check(
  `the save fires on the last question, currently ${lastQuestion}`,
  lastQuestion != null &&
    new RegExp(`currentIndex === ${lastQuestion}\\) \\{[\\s\\S]{0,600}?saveAndComplete\\(\\);`).test(
      src
    ),
  'saving one screen early writes the DEFAULT for whatever is asked after it, whatever the user then picks - which is exactly what happened when the save sat on best lifts and test weeks came next'
);
check(
  'saveAndComplete persists the test-week choice',
  /setTestWeekFrequency\(testFrequency\);/.test(src),
  ''
);
const skipBlock = src.slice(src.indexOf('const handleSkipLifts'), src.indexOf('const toggleGoal'));
check(
  'the skip link runs the same save the Continue button runs',
  skipBlock.length > 0 &&
    /saveAndComplete\(\);/.test(skipBlock) &&
    /goTo\(CELEBRATION_INDEX\);/.test(skipBlock),
  'best lifts is the last question now, so skipping it FINISHES onboarding - and a finish that does not save throws away the test-week answer given one screen earlier'
);
check(
  'and it clears anything half-typed on the way out',
  /setOrmSquat\(''\)/.test(skipBlock) &&
    /setOrmBench\(''\)/.test(skipBlock) &&
    /setOrmDeadlift\(''\)/.test(skipBlock),
  '"I do not know my best lifts" is an answer; a number left in a box goes on to become a prescribed working weight'
);

// ─── 4. The question is on its own screen ────────────────────────────────────
console.log('\n[4] The test-week question is not buried');

// Each screen is sliced from its OWN marker to the next one, rather than from a
// piece of its copy to the marker after it. The old form assumed best lifts came
// first in the source; when the two swapped it silently sliced backwards and the
// assertion below passed on an empty string.
const TEST_WEEK_MARKER = `Screen ${TEST_WEEK_INDEX}: Strength test weeks`;
const LIFTS_MARKER = `Screen ${LIFTS_INDEX}: Key Lifts`;
const CELEB_MARKER = `Screen ${CELEBRATION_INDEX}: Profile Built`;
const testWeekScreen = src.slice(src.indexOf(TEST_WEEK_MARKER), src.indexOf(LIFTS_MARKER));
const liftsScreen = src.slice(src.indexOf(LIFTS_MARKER), src.indexOf(CELEB_MARKER));
check(
  'it is no longer appended to the best-lifts screen',
  liftsScreen.length > 0 && !/Test your strength/.test(liftsScreen),
  'appended there it sat below three inputs and a skip link, off the bottom of the screen'
);
check(
  'it has its own screen, numbered to match its index',
  src.includes(TEST_WEEK_MARKER) && /Test your strength\?/.test(src),
  `expected a "${TEST_WEEK_MARKER}" comment — screen comments drifting from the constants is how the last two index bugs got missed`
);
check(
  'that screen does not scroll',
  testWeekScreen.length > 0 && !/<ScrollView/.test(testWeekScreen),
  'the whole point was to fit without scrolling'
);

// ─── 5. The celebration effect follows the celebration screen ────────────────
console.log('\n[5] Index-keyed effects moved with the screens');

check(
  'the celebration animation is keyed to the named index',
  /currentIndex === CELEBRATION_INDEX\) \{/.test(src),
  'left on a bare 9 it would fire on the theme screen'
);
check(
  'the progress bar spans the whole flow',
  /Math\.min\(currentIndex \/ CELEBRATION_INDEX, 1\)/.test(src),
  'dividing by a stale count makes the bar full one screen early'
);

// This one is here because the first version of this test did NOT catch it, and
// it dead-ended the flow: showContinue was `currentIndex < 9`, written when the
// celebration WAS screen 9. Inserting the test-week question made 9 the theme
// screen, so its Continue button silently stopped rendering and onboarding could
// not be finished. Gating render on a literal is the bug; assert the derivation.
check(
  'the footer button is shown on every screen before the celebration',
  /const showContinue = currentIndex < CELEBRATION_INDEX;/.test(src),
  'a literal here hides the Continue button on whichever screen inherits that number'
);

const staleLiterals = [...src.matchAll(/currentIndex (?:===|<|>|<=|>=) (\d+)/g)]
  .map((m) => Number(m[1]))
  .filter((n) => n >= TEST_WEEK_INDEX);
check(
  'no screen-gating literal sits in the shifting range',
  staleLiterals.length === 0,
  `found ${staleLiterals.join(', ')} — indices at or past ${TEST_WEEK_INDEX} move when a screen is inserted, so they must be named constants`
);

// --- 6. The bigger question first, and the smaller one explains itself ------
console.log('\n[6] Test weeks is asked before best lifts, and the lifts screen says why');

/**
 * THE ORDER THIS LOCKS IN, AND WHY THE QUESTION SURVIVES AN OPT-OUT.
 *
 * Best lifts used to come first. Somebody who then chose "no test weeks" on the
 * very next screen had just been made to dig out three maxes for a feature they
 * were about to decline, and nothing on the lifts screen said the numbers were
 * for anything else.
 *
 * They are. A 1RM sets the working weight the app prescribes on day one, via
 * workingWeightFromOrm in lib/workout-engine.ts; test weeks only RE-set it every
 * twelve sessions. So the answer was not to drop the question for somebody who
 * opts out - if anything it matters more to them, since nothing will ever
 * re-calibrate those weights automatically. The answer was to ask the bigger
 * question first and then say, on the lifts screen, which of the two it is for.
 */
check(
  'the test-week question is asked before the best-lifts question',
  TEST_WEEK_INDEX != null && LIFTS_INDEX != null && TEST_WEEK_INDEX < LIFTS_INDEX,
  `test weeks sits at ${TEST_WEEK_INDEX} and best lifts at ${LIFTS_INDEX}; the larger decision has to come first, because it changes what the smaller one is for`
);
check(
  'and the screens are laid out in that same order',
  src.indexOf(TEST_WEEK_MARKER) > 0 && src.indexOf(TEST_WEEK_MARKER) < src.indexOf(LIFTS_MARKER),
  'the pager renders in source order, so a constant that disagrees with the layout scrolls to the wrong screen'
);
check(
  'opting out does not skip the best-lifts question',
  /case LIFTS_INDEX:/.test(src) && liftsScreen.length > 0,
  'a 1RM is what sets the day-one working weight; dropping the question for an opted-out user would leave them on a guessed load with nothing that ever corrects it'
);
check(
  'the best-lifts hint changes with the test-week answer',
  /testFrequency === 'never'/.test(liftsScreen),
  'a step that says only "optional" gives somebody who has just declined test weeks no reason to answer it'
);
check(
  'both branches say the numbers set the starting weights',
  (liftsScreen.match(/set the weights we start you on/g) ?? []).length === 2,
  'that is the reason the question survives an opt-out, so it has to be said either way'
);
check(
  'only the opted-in branch promises a re-test',
  /re-test them every 12 sessions/.test(liftsScreen) &&
    /nothing will re-set them for you later/.test(liftsScreen),
  'promising a re-test to somebody who turned test weeks off is the same wrong answer in the other direction'
);
check(
  'declining test weeks does not claim the lifts leave your training',
  !/desc: "These lifts aren't part of my training"/.test(src),
  'it was not true: the squat, bench and deadlift rotation runs either way - isOnStrengthProgramme keeps a new user on it regardless of this answer - and only the max-out weeks stop'
);

console.log('');
if (failures > 0) {
  console.error(`onboarding-pager: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`onboarding-pager: all ${total} checks passed\n`);
  process.exitCode = 0;
}
