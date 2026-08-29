/**
 * Contract test: the session screen shows one exercise, and everything that
 * used to compete with it has somewhere else to be.
 *
 * WHAT WAS WRONG
 * ──────────────
 * The screen was a scrolling list of twenty-five cards, one open and the rest
 * collapsed above and below it. Measured on a real exported build, stopped on
 * the Back Squat: sixty visible pieces of text, fourteen of them green, nine
 * green filled blocks, six different greens. The Back Squat card alone carried
 * fourteen separate pieces of information before the logging bar started, and
 * the two boxes you type into were below the fold.
 *
 * WHAT THIS ASSERTS, AND WHY EACH ONE IS HERE
 * ───────────────────────────────────────────
 * ONE EXERCISE. The map over `exercises` must skip everything that is not the
 * active index. Without that line the screen silently goes back to a list and
 * every other promise here becomes decoration.
 *
 * THE REFERENCE SHEET IS BEHIND ONE CONTROL, and the video is NOT inside it.
 * Making somebody open a panel to find a play button is one tap of nothing.
 *
 * GOING BACK IS A STATE. The old implementation set a ref that suppressed
 * exactly one auto-advance, which is enough to arrive on a finished exercise
 * and not enough to stay there: the next render threw the user forward again.
 *
 * THE CLOCK WAITS for the plan. Reading what you are about to do is not
 * training, and that number goes on the summary.
 *
 * THE TOUR DESCRIBES THIS SCREEN. It previously pointed a tight spotlight at
 * the Swap icon, which now lives inside a panel that starts closed, so the
 * cutout would have framed nothing.
 *
 * Run:  npx tsx tests/session-focus.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
import { readFileSync } from 'fs';

const { sessionCoachTips, MAX_SESSION_TIPS } = await import('../lib/session-coach.ts');

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

const session = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');
const strip = readFileSync(new URL('../components/SessionProgressStrip.tsx', import.meta.url), 'utf8');
const plan = readFileSync(new URL('../components/SessionPlanList.tsx', import.meta.url), 'utf8');
const sheet = readFileSync(
  new URL('../components/SessionAssistantSheet.tsx', import.meta.url),
  'utf8'
);
const profile = readFileSync(new URL('../app/(tabs)/profile.tsx', import.meta.url), 'utf8');

console.log('\n[1] One exercise on screen');

check(
  'the card list renders only the active exercise',
  /if \(index !== activeIndex\) return null;/.test(session),
  'without this the screen is a list again and everything below is decoration'
);

check(
  'the exercise turns like a page, and back the other way',
  /SlideInRight/.test(session) &&
    /SlideOutLeft/.test(session) &&
    /SlideInLeft/.test(session) &&
    /SlideOutRight/.test(session),
  'a transition that goes the same way whichever way you moved tells you nothing'
);

check(
  'the direction is a ref, not state',
  /const navDirRef = useRef<1 \| -1>\(1\);/.test(session),
  'state lands a frame late and sends the first flip the wrong way'
);

console.log('\n[2] The reference sheet is behind one control');

check(
  'there is a "How do I do this?" toggle',
  /How do I do this\?/.test(session) && /styles\.howBtn/.test(session),
  'this is the single door for everything you read rather than do'
);

check(
  'it starts closed',
  /const \[expanded, setExpanded\] = useState\(false\);/.test(session),
  'open by default is the fourteen-item card again'
);

check(
  'the video button is on that row, not inside the panel',
  /styles\.howVideoBtn/.test(session) &&
    session.indexOf('styles.howVideoBtn') < session.indexOf('styles.detailsPanel'),
  'two taps to reach a play button is one tap of nothing'
);

check(
  'the cue, the weight range and the effort target are in the panel',
  /detailsPanel[\s\S]{0,2600}styles\.cueText/.test(session) &&
    /detailsPanel[\s\S]{0,2600}targetWeightLabel/.test(session) &&
    /detailsPanel[\s\S]{0,2600}styles\.effortRow/.test(session),
  'these are the paragraphs that made the card a reference sheet'
);

check(
  'the timers and the plate calculator are NOT in the panel',
  /setsContainer/.test(session) &&
    session.indexOf('styles.setsContainer') > session.indexOf('styles.detailsPanel'),
  'a rest timer you have to open a panel to see is a rest timer you miss'
);

console.log('\n[3] Where you are, and getting back');

check(
  'the strip has a finish line',
  /flag-outline/.test(strip) && /finished \? 'flag' : 'flag-outline'/.test(strip),
  'the end of the session should be on screen from the first second'
);

check(
  'the marks are not individually tappable',
  !/onPress=\{\(\) => onSelect/.test(strip) && /accessibilityLabel=\{`Exercise \$\{/.test(strip),
  'twenty-five marks across a phone is eleven points each; a tap target is forty-four'
);

check(
  'the whole strip opens the session list',
  /setPlanOpen\(true\)/.test(session) && /<SessionPlanList/.test(session),
  'that list is where you check what you logged before deciding to go back'
);

check(
  'reviewing is a state with a way out of it',
  /const \[reviewing, setReviewing\] = useState\(false\);/.test(session) &&
    /if \(reviewing\) return;/.test(session) &&
    /testID="return-from-review"/.test(session),
  'the old one-shot ref let the user arrive on a finished exercise and be thrown forward again'
);

check(
  'nothing lets you jump forward past work not done',
  /const reachable = !!onSelect && \(isActive \|\| !!result\?\.done\);/.test(plan),
  'a list that can skip ahead is a list that can skip the session'
);

check(
  'a finished row says what was actually recorded',
  /styles\.summary/.test(plan) && /result\.summary/.test(plan),
  'going back to check is the whole reason the list exists'
);

console.log('\n[4] The plan, before anything starts');

check(
  'the session is shown before it begins',
  /const \[started, setStarted\] = useState\(isDemo\);/.test(session) &&
    /testID="plan-start"/.test(session),
  'you answered three questions and were dropped onto exercise one of twenty-five'
);

check(
  'it reads the same exercises array the session does',
  /<SessionPlanList\s+exercises=\{exercises\}\s+style=\{styles\.planScreenList\}/.test(session),
  'a second generateWorkout call is a plan for a session you are not about to do'
);

check(
  'resuming skips it',
  /hasRestoredRef\.current = true;[\s\S]{0,200}setStarted\(true\);/.test(session),
  'resuming is not starting'
);

check(
  'the clock does not run while it is up',
  /if \(!started\) return;/.test(session),
  'reading the plan is not training, and this number goes on the summary'
);

console.log('\n[5] The assistant, scoped to the session');

const tips = sessionCoachTips({
  exerciseName: 'Back Squat',
  category: 'main',
  setNumber: 1,
  totalSets: 5,
  suggestedKg: 60,
  typedKg: 60,
  weightUnit: 'kg',
  isBandOrBodyweight: false,
  loggedAnySet: false,
  exercisesLeft: 4,
});

check(
  `it answers with ${tips.length} tips, never more than ${MAX_SESSION_TIPS}`,
  tips.length > 0 && tips.length <= MAX_SESSION_TIPS,
  'more than four and it stops being a glance'
);

check(
  'the weight tip says the suggestion can be changed',
  tips.some(
    (t) =>
      /suggest/i.test(t.title + t.body) &&
      /(change it|your own|whatever you|actually going to lift)/i.test(t.body)
  ),
  'a pre-filled box reads as an instruction unless something says otherwise'
);

const changed = sessionCoachTips({
  exerciseName: 'Back Squat',
  category: 'main',
  setNumber: 2,
  totalSets: 5,
  suggestedKg: 60,
  typedKg: 50,
  weightUnit: 'kg',
  isBandOrBodyweight: false,
  loggedAnySet: true,
  exercisesLeft: 4,
});

check(
  'and it changes once they have changed it',
  changed.some((t) => /you changed the weight/i.test(t.title)),
  'repeating an instruction somebody has already followed is nagging'
);

const banded = sessionCoachTips({
  exerciseName: 'Band Pull-Apart',
  category: 'accessory',
  setNumber: 1,
  totalSets: 3,
  suggestedKg: 0,
  typedKg: 0,
  weightUnit: 'kg',
  isBandOrBodyweight: true,
  loggedAnySet: true,
  exercisesLeft: 2,
});

check(
  'a set with no load gets no talk about weight',
  !banded.some((t) => /suggest/i.test(t.title)),
  'every word of it would be about a box that is not on screen'
);

const sore = sessionCoachTips({
  exerciseName: 'Goblet Squat',
  category: 'accessory',
  setNumber: 1,
  totalSets: 3,
  suggestedKg: 20,
  typedKg: 20,
  weightUnit: 'kg',
  isBandOrBodyweight: false,
  painRegionLabel: 'left knee',
  loggedAnySet: true,
  exercisesLeft: 2,
});

check(
  'pain outranks everything and comes first',
  /left knee/i.test(sore[0]?.title ?? '') && /Skip/.test(sore[0]?.body ?? ''),
  'the instruction to stop is the one line that makes an adapted session safe'
);

check(
  'it can be turned off from Settings and from inside itself',
  /testID="in-session-assistant-toggle"/.test(profile) &&
    /testID="assistant-turn-off"/.test(sheet),
  'the moment you decide you do not want something is the moment it is in front of you'
);

check(
  'and the session honours the setting',
  /inSessionAssistantEnabled && !isDemo/.test(session),
  'a switch that does not switch anything is worse than no switch'
);

console.log('\n[6] The tour describes this screen');

check(
  'it no longer points at the icon row that no longer exists',
  !/icon row under the exercise name/.test(session) &&
    !/Tap the swap icon on any card/.test(session),
  'the tour is the first writing anyone reads, and it was describing the old screen'
);

check(
  'the tight spotlight points at a control that is actually rendered',
  /spotlightTarget\?: 'detailsToggle'/.test(session) &&
    /spotlightTarget === 'detailsToggle' \? detailsBtnRef/.test(session) &&
    /ref=\{detailsBtnRef\}/.test(session),
  'it pointed at the Swap icon, which now lives inside a panel that starts closed'
);

check(
  'and that ref is on the details toggle, not on Swap',
  session.indexOf('ref={detailsBtnRef}') > session.indexOf('styles.howRow') - 400 &&
    /ref=\{detailsBtnRef\}[\s\S]{0,200}styles\.howBtn/.test(session),
  'a ref left on the old control is a spotlight around nothing'
);

check(
  'the tour mentions the strip and the finish line',
  /row of marks at the top/.test(session) && /finish line/.test(session),
  'the step used to describe a filled progress bar'
);

console.log(`\nsession-focus: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
