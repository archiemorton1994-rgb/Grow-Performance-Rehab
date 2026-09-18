/**
 * Contract test: the profile tree, which app/onboarding.tsx no longer draws.
 *
 * WHERE THE SCREEN HALF OF THIS FILE WENT
 * ───────────────────────────────────────
 * Sign-up is a short linear pager again, so every assertion here that read
 * app/onboarding.tsx was describing a screen that does not exist any more.
 * All of them moved to tests/onboarding-pager.check.mjs, and most of them are
 * now RUN rather than matched against source text, because the rules they
 * guard live in lib/sign-up.ts, which has no React in it: the profile is
 * written once by one action, the draft is kept, the screen never routes for
 * itself, and no question can be passed without answering it.
 *
 * What is left below is the tree itself, which is still in the repo and is
 * deleted in the next step of the rebuild along with the rest of the builder.
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
import { PROFILE_TREE, nextNode, visibleNodes, outcomeFrom } from '../lib/profile-tree.ts';

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

const tree = read('components/ProfileTree.tsx');
const treeCode = stripComments(tree);
const byId = new Map(PROFILE_TREE.map((n) => [n.id, n]));

// ─── 1. The tree, and the screen that no longer draws it ────────────────────
console.log('\n[1] The tree is data rather than a hand-written form');

check(
  'the questions live in data rather than in a screen',
  /profile-tree/.test(treeCode),
  ''
);

// ─── 2. The order of the first two questions ────────────────────────────────
console.log('\n[2] The look and the unit are asked before anything is validated');

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

// ─── 3. The tree finishes in one piece ──────────────────────────────────────
console.log('\n[3] The tree hands over only once it is done');

check(
  'the tree only calls onComplete once it has finished',
  /if \(finishing\) return onFinish\(\);/.test(treeCode) &&
    /const onFinish = useCallback\(/.test(treeCode),
  'the finish button and the continue button are the same control, and it must not finish early'
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
  /**
   * TWO NOW, AND THE RULE IS UNCHANGED: a question may be passed only when
   * "I would rather not" or "I do not know" is a real answer to it rather than
   * a hole in the profile.
   *
   *   lifts       plenty of people have never tested a one rep max
   *   kit         somebody who genuinely does not know what their heaviest
   *               dumbbell is should not be blocked by it
   *
   * The movement self-check used to be the third, on the reasoning that
   * skipping it left every ceiling where the experience answer put it. The
   * question is gone rather than optional now: experience is what sets the
   * ceiling, and a self-graded benchmark was never measuring anything.
   *
   * Everything else changes the programme in a way nothing can fill in.
   */
  'only questions where "I would rather not" is a real answer are optional',
  PROFILE_TREE.filter((n) => n.optional)
    .map((n) => n.id)
    .sort()
    .join(',') === 'kit,lifts',
  PROFILE_TREE.filter((n) => n.optional).map((n) => n.id).join(',')
);
check(
  /**
   * BODYWEIGHT CAME OFF THIS LIST, and it is the one worth defending.
   *
   * It was optional on the reasoning that nobody should have to type their
   * weight to use the app. What overturned that is what the fallback does: a
   * bodyweight is not one input among several, it scales the opening load of
   * every accessory, every bodyweight-relative movement and every estimate made
   * before the app has watched anybody lift. Assuming 75 kg for a 55 kg person
   * opens them about 35% too heavy on the one session where they are least able
   * to tell that a weight is wrong for them.
   *
   * The other two are genuinely answerable with "I do not know": a heaviest
   * dumbbell nobody has measured should not block the form, and unknown best
   * lifts are estimated from bodyweight - which is now always there to estimate
   * from.
   */
  'and bodyweight is not one of them, so there is no way past it',
  !PROFILE_TREE.some((n) => n.id === 'bodyweight' && (n.optional || n.skipLabel)),
  'the skip button only renders for an optional node, so this is the whole gate'
);
check(
  // Skipping is only honest if the way past says what passing means.
  'and every one of them says what the way past is',
  PROFILE_TREE.filter((n) => n.optional).every(
    (n) => typeof n.skipLabel === 'string' && n.skipLabel.trim().length > 0
  ),
  '"Skip" says nothing about what skipping means'
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
  // WAS A SPELLING TEST for the exact phrase "starting weights", and it went red
  // when the hint was rewritten to say more rather than less. What it is for is
  // that both versions explain what answering BUYS, so ask that.
  'both versions say what the numbers are actually for',
  /(starting|opening) weights/i.test(optedOut) && /(starting|opening) weights/i.test(optedIn),
  'that is the reason the question survives an opt-out, so it has to be said either way'
);
check(
  // The half that was missing: the old hint said the cost of answering and
  // nothing about the benefit, so the rational move was to skip.
  'and both say what skipping costs, so the choice is an informed one',
  /conservativ/i.test(optedOut) && /conservativ/i.test(optedIn),
  'a question that only says "optional" is a question people skip'
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

check(
  // The one change that makes the spine a journey rather than a decoration:
  // you can see how far down you have come without reading the counter.
  'the rail shows the part of it you have travelled',
  /styles\.spineTravel/.test(treeCode) && /travelStyle/.test(treeCode),
  'a flat line looks identical on question two and question twelve'
);
check(
  // Counted from answers it overshot the dot by however much taller the open
  // card is than a collapsed row, which reads as having travelled past yourself.
  'and it is measured to the stop you are at rather than counted',
  /if \(id === focusId\) setTravelY\(y\);/.test(treeCode) &&
    /height: travelled\.value/.test(treeCode),
  ''
);
check(
  'the question in focus is the only lit card on the rail',
  /borderColor: C\.primaryMuted/.test(treeCode) && /dotHalo/.test(treeCode),
  'the card you are answering looked exactly like the six you are not'
);

// ─── The three questions the builder learned to ask ─────────────────────────
//
// A question collected and never read is worse than a question not asked: it
// costs a tap and buys nothing, and it leaves a comment claiming an effect that
// does not exist. Two fields were already in that state when these were added -
// ageYears and standingSoreRegions - which is why every one of these asserts
// that the answer LANDS somewhere as well as that it is asked.
console.log('\n[8] The kit ceiling and the clinical question, and no self-check');

const byIdNode = (id) => PROFILE_TREE.find((n) => n.id === id);

check(
  /**
   * NO NODE COLLECTS A MOVEMENT SELF-CHECK, and the assertion is about what the
   * nodes DO rather than about one node's id.
   *
   * A question used to sit here asking which of six zero-load benchmarks
   * somebody could manage, and holding any pattern they left unticked at the
   * foundation rung. Deleting it by id would leave the door open to the same
   * question coming back under another name, which is the version of this
   * mistake that costs a physiotherapist's credibility: the answer it collects
   * is how somebody feels about a movement, and the person the gate existed to
   * protect is the one most likely to tick every box.
   *
   * So the rule is that no node anywhere in the tree asks somebody to grade
   * their own movement. Experience is the one question, and it is asked.
   */
  'no question in the builder asks somebody to grade their own movement',
  (() => {
    const words =
      /squat down and stand|plank|hang from a bar|touch your shins|lower your knee|shopping bag|without it hurting|movement (check|screen)/i;
    return PROFILE_TREE.every((n) => {
      const text = [n.question, n.hint ?? '', ...(n.options ?? []).map((o) => `${o.label} ${o.hint ?? ''}`)].join(' ');
      return !words.test(text);
    });
  })(),
  PROFILE_TREE.map((n) => n.id).join(', ')
);
check(
  // The other half of it: the finished outcome carries no list of passed
  // patterns for anything downstream to read.
  'and a finished tree hands nothing about movement checks to the rest of the app',
  (() => {
    const out = outcomeFrom({ screen: ['hinge', 'squat'], experience: 'advanced' });
    return !('screenPassed' in out) && !('patternChecks' in out);
  })(),
  Object.keys(outcomeFrom({})).join(', ')
);
check(
  // Experience is what is left, so it had better survive the walk intact.
  'while the experience answer still reaches the outcome',
  outcomeFrom({ experience: 'advanced' }).experience === 'advanced' &&
    outcomeFrom({}).experience === 'beginner',
  ''
);

check(
  'the kit ceiling is only put to people who have one',
  (() => {
    const n = byIdNode('kit');
    if (!n?.branch) return false;
    return (
      n.branch.when({ equipment: ['dumbbells'] }) === true &&
      n.branch.when({ equipment: ['kettlebells', 'bands'] }) === true &&
      // A full gym has a rack running to whatever anybody can lift.
      n.branch.when({ equipment: ['dumbbells', 'fullgym'] }) === false &&
      n.branch.when({ equipment: ['bodyweight'] }) === false &&
      n.branch.when({}) === false
    );
  })(),
  ''
);
check(
  'and it reaches the outcome as a number, or as nothing',
  outcomeFrom({ kit: '24' }).maxKitKg === 24 &&
    outcomeFrom({}).maxKitKg === 0 &&
    outcomeFrom({ kit: '-5' }).maxKitKg === 0,
  ''
);

check(
  'the clinical question is put to everybody, not hung off the sore branch',
  (() => {
    const n = byIdNode('avoid');
    return !!n && n.kind === 'multi' && n.branch === undefined;
  })(),
  'a shoulder avoided for six months does not hurt, so it answers no to "is anything sore"'
);
check(
  '"nothing" is an answer to it rather than an empty one',
  (() => {
    const none = outcomeFrom({ avoid: ['none'] }).avoidRegions;
    const some = outcomeFrom({ avoid: ['shoulder', 'none'] }).avoidRegions;
    return none.length === 0 && some.join(',') === 'shoulder';
  })(),
  ''
);
check(
  // The screen and the clinical question both carry one, and on both of them
  // "none of these" and a list of these contradict each other.
  'and the screen that draws them makes "none" exclusive',
  (() => {
    const tree = read('components/ProfileTree.tsx');
    return /value === 'none'\s*\?\s*\['none'\]/.test(tree) && /filter\(\(v\) => v !== 'none'\)/.test(tree);
  })(),
  '"I can do a plank, and none of these" is an answer the outcome would have to guess about'
);

check(
  // It was collected, stored, synced to the server, and read by nothing, while
  // its own comment claimed it changed three things.
  'the age answer now does something, and the comment says what',
  (() => {
    const src = read('lib/profile-tree.ts');
    const engine = read('lib/workout-engine.ts');
    return (
      /prepCountFor/.test(engine) &&
      /profile\?\.ageYears/.test(engine) &&
      /prepCountFor in lib\/workout-engine/.test(src)
    );
  })(),
  'a question that changes nothing has not earned its place, by the tree own rule'
);

console.log(`\nprofile-builder: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
