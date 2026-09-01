/**
 * Contract test: the profile builder's tree can be walked, drawn and finished.
 *
 * WHAT IT IS GUARDING
 * ───────────────────
 * The builder is becoming a branching tree the user travels down rather than a
 * fixed swipe pager. A branching form has three failure modes a pager cannot
 * have, and all three are invisible until somebody hits them:
 *
 *   STRANDED   a journey where nextNode never returns null, so the builder
 *              never finishes and there is no way into the app
 *   IRRELEVANT somebody asked a question that does not apply to them, which is
 *              the exact complaint that started this work: every single user is
 *              currently asked for their squat one rep max, including somebody
 *              whose knee is the reason they downloaded it
 *   BACKWARDS  a branch node placed before the node it forks from, which the
 *              diagram would draw as a line running back up the page
 *
 * It also pins the defaults. outcomeFrom has to produce TODAY'S behaviour from
 * an empty answer set, because a corrupted or half-finished draft must give
 * somebody the app as it currently is rather than something nobody designed.
 * The one that matters most is test weeks defaulting to 12.
 *
 * Run:  npx tsx tests/profile-tree.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
import {
  PROFILE_TREE,
  everyJourney,
  forks,
  isAnswered,
  isComplete,
  nextNode,
  nodeApplies,
  outcomeFrom,
  treeProgress,
  visibleNodes,
} from '../lib/profile-tree.ts';

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

const byId = new Map(PROFILE_TREE.map((n) => [n.id, n]));
const indexOf = (id) => PROFILE_TREE.findIndex((n) => n.id === id);

/** Answer a node the way the screen would, so a journey can be driven to its end. */
function answerFor(node) {
  if (node.subFields) {
    return Object.fromEntries(node.subFields.map((f) => [f.key, 100]));
  }
  if (node.kind === 'multi') return { [node.id]: [node.options?.[0]?.value ?? 'x'] };
  if (node.kind === 'number') return { [node.id]: 42 };
  if (node.kind === 'text') return { [node.id]: 'Archie' };
  return { [node.id]: node.options?.[0]?.value ?? 'x' };
}

// ─── 1. The tree is well formed ─────────────────────────────────────────────
console.log('\n[1] The tree is well formed');

check(
  'there is a tree to test',
  PROFILE_TREE.length >= 10,
  `only ${PROFILE_TREE.length} nodes, so everything below proves very little`
);

check(
  'every node id is unique',
  new Set(PROFILE_TREE.map((n) => n.id)).size === PROFILE_TREE.length,
  'answers are keyed by id, so a duplicate silently overwrites another question'
);

const noQuestion = PROFILE_TREE.filter((n) => !n.question || n.question.length < 4);
check('every node asks something', noQuestion.length === 0, noQuestion.map((n) => n.id).join(', '));

const badChoice = PROFILE_TREE.filter(
  (n) => (n.kind === 'single' || n.kind === 'multi') && !n.options && !n.subFields && n.id !== 'soreArea'
);
check(
  'every choice node has options, apart from the one filled in at runtime',
  badChoice.length === 0,
  `${badChoice.map((n) => n.id).join(', ')} would render as a question with nothing to tap`
);

check(
  'the branch conditions all point at a node that exists',
  PROFILE_TREE.filter((n) => n.branch).every((n) => byId.has(n.branch.from)),
  'a fork hanging off a question nobody is asked can never be taken'
);

const backwards = PROFILE_TREE.filter((n) => n.branch && indexOf(n.branch.from) >= indexOf(n.id));
check(
  'and no branch is placed before the question it forks from',
  backwards.length === 0,
  `${backwards.map((n) => n.id).join(', ')} would draw a line running back up the page`
);

// ─── 2. Nobody is stranded ──────────────────────────────────────────────────
console.log('\n[2] Every journey reaches the end');

const journeys = everyJourney();
check(
  'the journeys were enumerated',
  journeys.length >= 12,
  `only ${journeys.length}; the branch conditions have moved`
);

let stranded = [];
let longest = 0;
for (const seed of journeys) {
  const answers = { ...seed };
  let guard = 0;
  let node = nextNode(answers);
  while (node && guard < 60) {
    Object.assign(answers, answerFor(node));
    node = nextNode(answers);
    guard++;
  }
  longest = Math.max(longest, guard);
  if (node) stranded.push(JSON.stringify(seed));
  else if (!isComplete(answers)) stranded.push('incomplete: ' + JSON.stringify(seed));
}
check(
  `all ${journeys.length} journeys finish, the longest in ${longest} answers`,
  stranded.length === 0,
  stranded.slice(0, 3).join(' | ')
);

check(
  'and the longest journey is short enough to be worth finishing',
  longest <= 16,
  `${longest} questions is a form people abandon; branch more or move some after the first session`
);

// ─── 3. Nobody is asked something irrelevant ────────────────────────────────
console.log('\n[3] The branches actually branch');

check(
  // The complaint that started this. Somebody whose knee is the reason they
  // downloaded the app should never be asked to type a squat max.
  'somebody coming back from an injury is never asked for their best lifts',
  !visibleNodes({ focus: 'comeback', experience: 'advanced', sore: 'yes' }).some(
    (n) => n.id === 'lifts'
  ),
  'this is the question that reads as "this app is not for me"'
);

check(
  'nor is a beginner, whatever they train',
  !visibleNodes({ focus: 'barbell', experience: 'beginner', sore: 'no' }).some(
    (n) => n.id === 'lifts'
  ),
  'they do not have the numbers, and bodyweight estimates better than a guess does'
);

check(
  'but a lifter who knows their numbers is',
  visibleNodes({ focus: 'barbell', experience: 'advanced', sore: 'no' }).some(
    (n) => n.id === 'lifts'
  ),
  'skipping it for everybody would throw away the best starting data the app can get'
);

check(
  'only a barbell programme is asked about strength tests',
  visibleNodes({ focus: 'barbell', experience: 'advanced', sore: 'no' }).some(
    (n) => n.id === 'testWeeks'
  ) &&
    !visibleNodes({ focus: 'joints', experience: 'advanced', sore: 'no' }).some(
      (n) => n.id === 'testWeeks'
    ),
  'a strength test only ever comes due on a squat, bench or deadlift session'
);

check(
  'saying nothing is sore skips both injury questions',
  !visibleNodes({ focus: 'strength', experience: 'advanced', sore: 'no' }).some((n) =>
    ['soreArea', 'soreAge'].includes(n.id)
  ),
  ''
);

check(
  'and saying something is sore asks both',
  ['soreArea', 'soreAge'].every((id) =>
    visibleNodes({ focus: 'strength', experience: 'advanced', sore: 'yes' }).some(
      (n) => n.id === id
    )
  ),
  'where it is and how long it has been are both needed before the block can be shaped around it'
);

check(
  // A pager tracks a step index. Change a fork and the index points at the wrong
  // question or past the end. Deriving the path from the answers cannot desync.
  'changing your mind retracts the branch you had taken',
  (() => {
    const sore = { focus: 'strength', experience: 'advanced', sore: 'yes', soreArea: ['knee'] };
    const had = visibleNodes(sore).some((n) => n.id === 'soreArea');
    const after = visibleNodes({ ...sore, sore: 'no' }).some((n) => n.id === 'soreArea');
    return had && !after;
  })(),
  'going back and answering a fork differently must remove the questions it opened'
);

// ─── 4. The diagram can be drawn ────────────────────────────────────────────
console.log('\n[4] There is enough here to draw a tree');

const trunk = PROFILE_TREE.filter((n) => !n.branch);
check(
  'most of the tree is trunk, so a fork means something',
  trunk.length > PROFILE_TREE.length / 2,
  `${trunk.length} of ${PROFILE_TREE.length}; a spine that forks constantly is a mess, not a diagram`
);

check(
  /**
   * FOUND BY PHOTOGRAPHING THE SCREEN, WHICH IS WHY THIS EXISTS NOW.
   *
   * The block-length question is tier "shape" and was written at the very end of
   * the array, after ten "tune" questions. The screen draws a heading each time
   * the tier changes, so the spine read shape, tune, shape: "what you want"
   * appeared twice, the second time BELOW "about you", on a diagram whose one
   * structural claim is that those two are separate halves.
   *
   * Every check in this file passed while that was on screen. The tiers were
   * both present and both populated, which was all anything asked.
   */
  'each tier is one contiguous run, so its heading is drawn once',
  (() => {
    const runs = [];
    for (const n of PROFILE_TREE) {
      if (runs[runs.length - 1] !== n.tier) runs.push(n.tier);
    }
    return runs.length === new Set(runs).size;
  })(),
  'a tier that starts, stops and starts again draws its heading twice and out of order'
);

check(
  'and every question that chooses the programme is asked before the ones that tune it',
  PROFILE_TREE.map((n) => n.tier).lastIndexOf('shape') <
    PROFILE_TREE.findIndex((n) => n.tier === 'tune'),
  'the shape half has to come first, or the diagram is telling the wrong story about itself'
);

check(
  'both tiers exist and are populated',
  PROFILE_TREE.some((n) => n.tier === 'shape') && PROFILE_TREE.some((n) => n.tier === 'tune'),
  'the shape/tune split is what the diagram draws its one structural boundary from'
);

const soreForks = forks({ focus: 'strength', experience: 'advanced', sore: 'yes' });
check(
  'the two injury questions draw as ONE limb, not two splits',
  soreForks.filter((f) => f.at === 'sore').length === 1 &&
    soreForks.find((f) => f.at === 'sore').nodeIds.length === 2,
  `got ${JSON.stringify(soreForks.map((f) => [f.at, f.nodeIds]))}`
);

check(
  'every fork carries a line of text explaining itself',
  PROFILE_TREE.filter((n) => n.branch).every((n) => n.branch.label.length > 8),
  'a split with no reason on it is a mystery, not a diagram'
);

check(
  'nobody with a straight journey is shown a fork at all',
  forks({ focus: 'joints', experience: 'beginner', sore: 'no' }).length === 0,
  ''
);

// ─── 5. Progress counts the path, not the tree ──────────────────────────────
console.log('\n[5] Progress counts the journey this person is on');

const straight = { focus: 'joints', experience: 'beginner', sore: 'no' };
const branched = { focus: 'barbell', experience: 'advanced', sore: 'yes' };
check(
  'a shorter journey has a smaller total',
  treeProgress(straight).total < treeProgress(branched).total,
  `${treeProgress(straight).total} vs ${treeProgress(branched).total}; showing everyone the size of the whole tree promises questions most of them never see`
);
check(
  'an untouched tree is zero answered',
  treeProgress({}).answered === 0 && !isComplete({}),
  ''
);

check(
  // Somebody who knows their squat and not their bench must not be held up.
  'a grouped node counts as answered on any one of its fields',
  (() => {
    const lifts = byId.get('lifts');
    if (!lifts?.subFields) return false;
    return (
      isAnswered(lifts, { liftsSquat: 100 }) &&
      !isAnswered(lifts, { liftsSquat: 0 }) &&
      !isAnswered(lifts, {})
    );
  })(),
  'the three lifts are one stop on the journey, not three'
);

check(
  'an empty multi-select does not count as answered',
  !isAnswered(byId.get('equipment'), { equipment: [] }),
  'somebody who opened the equipment screen and picked nothing has answered nothing'
);

// ─── 6. The defaults are today's behaviour ──────────────────────────────────
console.log('\n[6] A half-finished answer set still produces a working app');

const empty = outcomeFrom({});
check(
  'test weeks default to every 12 sessions',
  empty.testWeekFrequency === 12,
  'that is what the builder does today for anyone who does not touch it'
);
check(
  'and "no thanks" survives as never rather than becoming a number',
  outcomeFrom({ testWeeks: 'never' }).testWeekFrequency === 'never' &&
    outcomeFrom({ testWeeks: '18' }).testWeekFrequency === 18,
  'the store reads this field to decide whether a test can ever come due'
);
check(
  // Found by mutation: swapping the ternary so anything unrecognised became 18
  // left all three of the checks above passing. A draft written by an older
  // build can hold any string, and silently doubling somebody's test interval
  // is the kind of change nobody would ever report.
  'and anything the app does not recognise falls back to 12, not to the other number',
  outcomeFrom({ testWeeks: 'garbage' }).testWeekFrequency === 12 &&
    outcomeFrom({ testWeeks: '' }).testWeekFrequency === 12,
  'an unknown answer has to land on the current default, whatever the ternary happens to be shaped like'
);
check(
  'a block is 12 sessions unless somebody says otherwise',
  empty.sessions === 12 && outcomeFrom({ length: '8' }).sessions === 8,
  ''
);
check(
  'days and minutes fall back to something trainable',
  empty.days === 3 && empty.minutes === 45,
  'zero days a week is not a programme'
);
check(
  'nothing is sore unless they said so',
  empty.soreRegions.length === 0 && empty.soreFor === null,
  ''
);
check(
  // The sore area is asked on a branch, so an answer can survive going back and
  // changing the fork. The outcome has to honour the fork, not the leftover.
  'and a leftover sore area is ignored once they say nothing hurts',
  outcomeFrom({ sore: 'no', soreArea: ['knee'], soreAge: 'weeks' }).soreRegions.length === 0,
  'going back and saying it is better must not leave the programme built around a knee'
);
check(
  'a missing lift is null rather than zero',
  empty.oneRepMaxes.squat === null &&
    outcomeFrom({ liftsSquat: 120 }).oneRepMaxes.squat === 120,
  'zero would be treated as a real one rep max by the load maths'
);
check(
  'and the focus falls back to general strength, not the barbell rotation',
  empty.focus === 'strength',
  'defaulting to barbell is exactly the bug this whole change exists to fix'
);

// ─── The block-length question ──────────────────────────────────────────────
console.log('\n[block length]');

{
  const length = PROFILE_TREE.find((n) => n.id === 'length');
  check('the question asks for sessions rather than weeks', /sessions/i.test(length.question), length.question);
  check(
    'and says so in the hint, because everybody who has used a programme expects weeks',
    /not weeks/i.test(length.hint ?? ''),
    length.hint
  );
  check(
    'nine of them, offered as a grid',
    length.options.length === 9 && length.layout === 'grid',
    `${length.options.length} options, layout ${length.layout}`
  );
  check(
    // Found by photographing it: nine full-width rows made the card taller than
    // the phone, on a question you answer by comparing the numbers.
    'the labels are bare numbers, which is what makes a grid readable',
    length.options.every((o) => /^\d+$/.test(o.label)),
    length.options.map((o) => o.label).join(', ')
  );
  check(
    'exactly three carry a caption, so the captions mean something',
    length.options.filter((o) => o.hint).length === 3,
    length.options.filter((o) => o.hint).map((o) => `${o.label}: ${o.hint}`).join(' | ')
  );
  check(
    'and the grid layout is asked for on the node rather than guessed from the count',
    PROFILE_TREE.filter((n) => n.layout === 'grid').length === 1,
    'the six things a programme can be built around are sentences, not numbers'
  );
}

console.log(`\nprofile-tree: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
