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

const idx = (name) => {
  const m = src.match(new RegExp(`const ${name} = (\\d+);`));
  return m ? Number(m[1]) : null;
};
const TEST_WEEK_INDEX = idx('TEST_WEEK_INDEX');
const THEME_INDEX = idx('THEME_INDEX');
const CELEBRATION_INDEX = idx('CELEBRATION_INDEX');

check('the indices are named constants', TEST_WEEK_INDEX != null && CELEBRATION_INDEX != null, '');
check(
  'they are consecutive',
  THEME_INDEX === TEST_WEEK_INDEX + 1 && CELEBRATION_INDEX === THEME_INDEX + 1,
  `${TEST_WEEK_INDEX} / ${THEME_INDEX} / ${CELEBRATION_INDEX}`
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
for (const name of ['TEST_WEEK_INDEX', 'THEME_INDEX']) {
  if (new RegExp(`case ${name}:`).test(switchBlock)) covered.add(idx(name));
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

check(
  'saveAndComplete fires on the test-week screen, not before it',
  /currentIndex === TEST_WEEK_INDEX\) \{[\s\S]{0,320}?saveAndComplete\(\);/.test(src),
  'saving at the best-lifts step wrote the default test-week setting regardless of what was picked'
);
check(
  'saveAndComplete persists the test-week choice',
  /setTestWeekFrequency\(testFrequency\);/.test(src),
  ''
);
check(
  'skipping the lifts still reaches the test-week question',
  /goTo\(TEST_WEEK_INDEX\);/.test(src),
  'it used to jump straight past it to the theme screen'
);

// ─── 4. The question is on its own screen ────────────────────────────────────
console.log('\n[4] The test-week question is not buried');

const liftsScreen = src.slice(
  src.indexOf('Your best lifts'),
  src.indexOf('Screen 8: Strength test weeks')
);
check(
  'it is no longer appended to the best-lifts screen',
  !/Test your strength/.test(liftsScreen),
  'appended there it sat below three inputs and a skip link, off the bottom of the screen'
);
check(
  'it has its own screen',
  /Screen 8: Strength test weeks/.test(src) && /Test your strength\?/.test(src),
  ''
);
check(
  'that screen does not scroll',
  !/Screen 8: Strength test weeks[\s\S]{0,900}?<ScrollView/.test(src),
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

console.log('');
if (failures > 0) {
  console.error(`onboarding-pager: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`onboarding-pager: all ${total} checks passed\n`);
  process.exit(0);
}
