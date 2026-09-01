/**
 * Contract test: the builder screen, which is now a tree rather than a pager.
 *
 * WHAT THIS REPLACED, AND WHY IT IS NOT SIMPLY DELETED
 * ───────────────────────────────────────────────────
 * tests/onboarding-pager.check.mjs guarded twenty-four things about a swipe
 * pager: that every screen had a named index, that the indices ran 0..N with no
 * gaps, that the celebration was last, that the progress bar divided by the
 * right constant. All of that describes machinery that no longer exists, and
 * deleting those checks costs nothing.
 *
 * But four of them were not about the pager at all. They were about promises to
 * the user that a rewrite could quietly break, and they are carried over here:
 *
 *   THE PROFILE IS WRITTEN ONCE, AT THE END. The old flow wrote it one screen
 *   early, so the test-week answer given afterwards was replaced by the default.
 *   Anything asked after the save is a question whose answer is ignored.
 *
 *   SKIPPING CLEARS THE BOXES. "I do not know my best lifts" is an answer. A
 *   half-typed number left behind goes on to become a prescribed working weight.
 *
 *   DECLINING STRENGTH TESTS DOES NOT REMOVE THE LIFTS QUESTION. A one rep max
 *   is what sets the day-one working weight; dropping it for somebody who opted
 *   out would leave them on a guess with nothing that ever corrects it.
 *
 *   AND THE REASON GIVEN FOR ANSWERING IT CHANGES WITH THAT DECISION. Promising
 *   a re-test to somebody who just said no is a promise nothing will keep, and
 *   "this is optional" is no reason at all for the person who said yes.
 *
 * Run:  npx tsx tests/profile-builder.check.mjs
 */
import { readFileSync } from 'fs';
import { PROFILE_TREE, nextNode, visibleNodes } from '../lib/profile-tree.ts';

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

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const screen = read('app/onboarding.tsx');
const screenCode = stripComments(screen);
const tree = read('components/ProfileTree.tsx');
const treeCode = stripComments(tree);
const byId = new Map(PROFILE_TREE.map((n) => [n.id, n]));

// ─── 1. The pager really is gone ────────────────────────────────────────────
console.log('\n[1] The builder is a tree, not a pager');

check(
  'the screen renders the tree',
  /<ProfileTree/.test(screenCode),
  'this whole file is testing the wrong thing otherwise'
);
check(
  'and nothing is left of the index-driven pager',
  !/currentIndex/.test(screenCode) &&
    !/CELEBRATION_INDEX|LIFTS_INDEX|TEST_WEEK_INDEX/.test(screenCode),
  'a step index and a set of answers can disagree, and the index is the one that gets it wrong'
);
check(
  'the questions live in data rather than in the screen',
  /from '@\/lib\/profile-tree'/.test(screenCode) || /profile-tree/.test(treeCode),
  ''
);

// ─── 2. The two answers that must take effect at once ───────────────────────
console.log('\n[2] The look and the unit apply the moment they are given');

check(
  'the first question is the theme',
  PROFILE_TREE[0]?.id === 'look',
  `it is ${PROFILE_TREE[0]?.id}; every screen after it renders in the chosen theme, so it has to come first`
);
check(
  'and the unit is next',
  PROFILE_TREE[1]?.id === 'units',
  'the bodyweight question is validated against a plausible range, and 176 is a fine number of pounds and an impossible number of kilos'
);
check(
  'both are applied on change rather than at the end',
  /setThemePreference\(look\)/.test(screenCode) && /setWeightUnit\(/.test(screenCode),
  'picking Light and watching the app stay dark reads as a control that does not work'
);

// ─── 3. The profile is written once, at the end ─────────────────────────────
console.log('\n[3] Nothing is saved until every question has been asked');

check(
  'the profile is written through the one action, exactly once',
  (screenCode.match(/applyProfileTree\(/g) ?? []).length === 1 &&
    /applyProfileTree\(finished, new Date\(\)\.toISOString\(\)\)/.test(screenCode),
  'seven separate setters could half-succeed; one set() cannot, and two calls to it are two chances to disagree'
);
check(
  'and onboarding is completed in the same breath, also exactly once',
  (screenCode.match(/setOnboardingComplete\(true\)/g) ?? []).length === 1,
  'a profile written without completing leaves somebody looping through the builder for ever'
);
check(
  // The certificate is where somebody first sees what their answers produced.
  // Enrolling them before they have seen it means backing out of that screen
  // would leave them enrolled in something they never agreed to.
  'nothing is written when the TREE finishes, only when the certificate is accepted',
  (() => {
    const at = screenCode.indexOf('const onTreeComplete');
    if (at < 0) return false;
    const body = screenCode.slice(at, screenCode.indexOf('  );', at));
    return !/applyProfileTree|setOnboardingComplete/.test(body);
  })(),
  'the tree handing over and the user accepting are two different events'
);
check(
  'the certificate is what stands between them',
  /<ProgrammeCertificate/.test(screenCode) && /onContinue=\{onAccept\}/.test(screenCode),
  'the button on the certificate has to be the thing that enrols them'
);
check(
  'the tree only calls onComplete once it has finished',
  /if \(finishing\) return onFinish\(\);/.test(treeCode) &&
    /const onFinish = useCallback\(/.test(treeCode),
  'the finish button and the continue button are the same control, and it must not finish early'
);
check(
  'the screen never navigates for itself',
  !/router\.(replace|push)/.test(screenCode),
  'the gate in app/_layout.tsx decides what comes next; routing from here skips auth and the paywall'
);
check(
  'a half-finished builder is kept as a draft',
  /saveOnboardingDraft\(/.test(screenCode) && /treeAnswers: answers/.test(screenCode),
  'an eight-question form that restarts from nothing is a form most people do not fill in twice'
);

// ─── 4. Skipping is an answer, and it clears the boxes ──────────────────────
console.log('\n[4] "I do not know these" is an answer');

check(
  'there is a skip, and it is only offered on an optional question',
  /testID="tree-skip"/.test(treeCode) && /focusNode\?\.optional && !finishing/.test(treeCode),
  'a skip on a required question is a hole in the profile'
);
check(
  'and skipping clears whatever was half-typed',
  /for \(const f of focusNode\.subFields \?\? \[\]\) cleared\[f\.key\] = '';/.test(treeCode),
  'a number left in a box goes on to become a prescribed working weight'
);
check(
  'only the two questions with a real reason to decline are optional',
  PROFILE_TREE.filter((n) => n.optional).map((n) => n.id).sort().join(',') === 'bodyweight,lifts',
  'every other question changes the programme, so none of them can be passed'
);

// ─── 5. The order of the two barbell questions ──────────────────────────────
console.log('\n[5] The larger decision is asked first');

const iTest = PROFILE_TREE.findIndex((n) => n.id === 'testWeeks');
const iLifts = PROFILE_TREE.findIndex((n) => n.id === 'lifts');
check(
  'strength tests are asked before best lifts',
  iTest >= 0 && iLifts >= 0 && iTest < iLifts,
  `testWeeks at ${iTest}, lifts at ${iLifts}; the larger decision changes what the smaller one is for`
);

const lifts = byId.get('lifts');
const optedOut = lifts?.hintFor?.({ testWeeks: 'never' }) ?? '';
const optedIn = lifts?.hintFor?.({ testWeeks: '12' }) ?? '';
check(
  'the reason for answering changes with that decision',
  optedOut.length > 20 && optedIn.length > 20 && optedOut !== optedIn,
  `"${optedOut}" vs "${optedIn}"`
);
check(
  'both versions say the numbers set the starting weights',
  /starting weights/i.test(optedOut) && /starting weights/i.test(optedIn),
  'that is the reason the question survives an opt-out, so it has to be said either way'
);
check(
  'only the opted-in version promises a re-test',
  /re-measure|re-test/i.test(optedIn) && !/re-measure|re-test/i.test(optedOut),
  'promising a re-test to somebody who turned strength tests off is the same wrong answer in the other direction'
);
check(
  'and the screen actually reads the dynamic hint',
  /node\.hintFor \? node\.hintFor\(answers\) : node\.hint/.test(treeCode),
  'a hint that is computed and never rendered is the same as not having one'
);

check(
  // Carried straight over from the pager test. This is the one that would be
  // easiest to get wrong by "tidying up" the branch condition.
  'declining strength tests does NOT remove the best-lifts question',
  visibleNodes({
    focus: 'barbell',
    experience: 'advanced',
    testWeeks: 'never',
    sore: 'no',
  }).some((n) => n.id === 'lifts'),
  'a one rep max is what sets the day-one working weight; dropping it leaves somebody on a guess that nothing corrects'
);

// ─── 6. It cannot be finished with a question outstanding ───────────────────
console.log('\n[6] The tree will not let anybody past an unanswered question');

check(
  'continue is disabled until the question in focus is answered',
  /disabled=\{!finishing && !canAdvance\}/.test(treeCode) &&
    /issueFor\(focusNode\) === null && \(focusNode\.optional \|\| isAnswered\(focusNode, answers\)\)/.test(
      treeCode
    ),
  'a live-looking button that does nothing is how the paywall used to read as broken'
);
check(
  'a typed answer that is out of range blocks it, and says why',
  /testID={`issue-\${node\.id}`}/.test(tree) && /issueFor/.test(treeCode),
  'silently refusing to advance is the fault this replaced'
);
check(
  'and an empty tree is not complete',
  nextNode({}) !== null,
  ''
);

// ─── 7. Motion, which this is the first screen in the app to think about ────
console.log('\n[7] The screen that moves itself asks first');

check(
  'the tree honours a reduced-motion setting',
  /useReducedMotion\(\)/.test(treeCode) && /reduceMotion \? undefined : FadeInDown/.test(treeCode),
  'a page that moves itself every time you answer is exactly why somebody turns that setting on'
);
check(
  'and it does not animate the scroll either',
  /animated: !reduceMotion/.test(treeCode),
  'the travelling IS the animation here, so it is the one that matters most'
);

check(
  // The node asks for a grid; something has to draw one. Declaring the layout
  // and rendering nine full-width rows anyway is the shape of bug that gets
  // shipped, because both halves look right on their own.
  'a node that asks for a grid gets one',
  /node\.layout === 'grid'/.test(treeCode) && /numberGrid/.test(treeCode),
  'nine block lengths as nine full-width rows is a card taller than the phone'
);
check(
  'and the collapsed answer says what the number was',
  /'length'\) return `\$\{v\} sessions`/.test(treeCode),
  'a bare "12" halfway up the spine is not an answer to anything'
);

console.log(`\nprofile-builder: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
