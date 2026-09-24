/**
 * Contract test: answering "how did that feel?" never takes a set off your plan.
 *
 * WHAT THIS FILE USED TO GUARD, AND WHY IT NOW GUARDS THE OPPOSITE
 * ───────────────────────────────────────────────────────────────
 * The middle button used to read "Challenging", and answering it with sets
 * still to come raised a second screen in the bar: "Hard work. Want to ease
 * off?". The first row on it read "One more set at 16 kg", and taking that row
 * collapsed every remaining set into one. A three-set exercise became two.
 *
 * Archie watched that happen and reported it as a disappearing set. The missing
 * set was only the symptom. The fault was offering a way out the instant
 * somebody had answered, and it became impossible to defend at all once the
 * button was renamed: "Hard work. Want to ease off?" directly contradicts the
 * answer "Just right" that raised it.
 *
 * There is no other answer it could sensibly hang off either. "Too Hard" is
 * given on a warm-up rung more often than anywhere else - lib/auto-regulation.ts
 * opens with that trap - so moving the prompt there would put "shall I collapse
 * this lift into one set?" in front of somebody three rungs below their working
 * weight. So the whole step is gone.
 *
 * WHAT IS ASSERTED NOW
 * ────────────────────
 *   [1] The step is gone from the bar, and nothing raises it.
 *   [2] Answering records the answer and returns the logging bar. No branch.
 *   [3] What the answer DOES do, run through the real auto-regulation: it moves
 *       the weight offered for the next set and nothing else.
 *   [4] The lossless way out that remains is Skip, and it is still the only
 *       thing in the screen that writes a set off.
 *   [5] The app explains that in words, and the words match the buttons.
 *
 * Sections [1], [2] and [4] read app/session.tsx as text because a node script
 * cannot import a React screen. They are written as questions about structure -
 * is there a branch, how many writers are there - rather than as pins on a
 * spelling, which is the failure mode this repository keeps finding.
 *
 * Run:  npx tsx tests/ease-off.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
import { readFileSync } from 'fs';

const { SET_FEEDBACK_LABELS, suggestSetWeight } = await import('../lib/auto-regulation.ts');
const { SESSION_TUTORIAL } = await import('../lib/session-screen.ts');
const { sessionCoachTips } = await import('../lib/session-coach.ts');

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

const session = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');
/**
 * The screen with its comments taken out.
 *
 * Section [1] is a set of absence claims, and a comment EXPLAINING that the
 * feature was removed would otherwise read as the feature still being there.
 * The header comment at the top of app/session.tsx does exactly that on
 * purpose: it names the row that used to remove the sets, so the next person to
 * wonder why the bar has only one step does not have to dig for the answer.
 */
const code = session.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n[1] The step that removed the sets is gone, and nothing can raise it');

check(
  'the screen has no ease-off state, handler or prop left to reach',
  !/\beaseOff\b/i.test(code),
  'dead UI that the tutorial no longer mentions is a trap for the next reader'
);
check(
  'none of its three rows can be pressed, because none of them exists',
  !/testID="ease-off/.test(code) &&
    !/One more set at/.test(code) &&
    !/Carry on as planned/.test(code),
  'the row labelled "One more set at X" is the one that removed the sets'
);
check(
  'and the prompt that contradicted the answer is gone with it',
  !/Want to ease off/.test(code),
  '"Hard work. Want to ease off?" cannot follow somebody saying the weight was right'
);
check(
  'the back-off fraction it used has nothing left to reduce',
  !/EASE_OFF_FRACTION/.test(code),
  'a constant with no reader is a feature somebody will wire back up by accident'
);
check(
  'the absence is real and not an empty file being searched',
  code.length > 50000 && /testID="feedback-challenging"/.test(code),
  'the three feedback buttons still have to be there for their absent second step to mean anything'
);

console.log('\n[2] Answering records the answer, and that is the whole of it');

/**
 * The handler, sliced rather than matched with a character budget.
 *
 * A budget is a spelling pin wearing a number and goes red the day somebody
 * adds a comment. What is asked here is structural: the answer is reported, the
 * prompt closes, and nothing in between looks at WHICH answer it was.
 */
const feedbackHandler = (() => {
  const start = session.indexOf('const handleFeedback = (f: SetFeedback) => {');
  if (start === -1) return '';
  const end = session.indexOf('\n  };', start);
  return end === -1 ? session.slice(start) : session.slice(start, end);
})();
const handlerCode = feedbackHandler.replace(/\/\/.*$/gm, '');

check(
  'the handler exists and reports the answer',
  handlerCode.includes('onFeedback(') && handlerCode.includes('showFeedback.exerciseId'),
  'could not find handleFeedback'
);
check(
  'it never asks which answer it was',
  handlerCode.length > 0 && !/f ===/.test(handlerCode),
  'every branch on the answer that has ever existed here has been a consequence dressed up as an offer'
);
check(
  'and it leaves the sets alone: no set state is touched anywhere in it',
  handlerCode.length > 0 &&
    !/setExerciseData|skipped:\s*true|activeSetIndex:/.test(handlerCode),
  'the rating shapes the next session; it must not edit the session you are in'
);

console.log('\n[3] What the answer does instead, run through the real code');

/**
 * A flat accessory: every set carries the same target, so every answer is about
 * the prescription itself.
 */
const out = (loggedKg, feedback) => ({ loggedKg, feedback });
const flat = {
  isRamped: false,
  plannedKg: [40, 40, 40],
  outcomes: [out(40, 'challenging')],
};
const hold = suggestSetWeight(flat, 1);
const easier = suggestSetWeight({ ...flat, outcomes: [out(40, 'too_hard')] }, 1);
const harder = suggestSetWeight({ ...flat, outcomes: [out(40, 'easy')] }, 1);

check(
  '"Just right" holds the weight that was just lifted',
  hold.kg === 40,
  `${hold.kg} kg, reason ${hold.reason}`
);
check(
  'and it is the middle of three: Too Hard goes down, Easy goes up',
  easier.kg < 40 && harder.kg > 40,
  `too hard ${easier.kg} kg, easy ${harder.kg} kg`
);
check(
  'every answer leaves a weight for the set that was going to happen anyway',
  [hold, easier, harder].every((s) => Number.isFinite(s.kg) && s.kg > 0),
  JSON.stringify([hold.kg, easier.kg, harder.kg])
);

/**
 * The same answer on a warm-up rung of a ramped main lift.
 *
 * This is the case the removed offer was worst for: rung one of five is meant
 * to feel like something, and the honest answer to it must not be able to end
 * the lift.
 */
{
  const ramp = {
    isRamped: true,
    plannedKg: [50, 60, 70, 87.5, 100],
    outcomes: [out(50, 'challenging')],
  };
  const nextRung = suggestSetWeight(ramp, 1);
  check(
    'on a warm-up rung it carries on up the climb rather than stopping it',
    nextRung.kg > 50 && nextRung.kg <= 100,
    `rung 2 offered at ${nextRung.kg} kg after "Just right" on rung 1`
  );
  check(
    'and the working set is still the top of the plan, not a collapsed version of it',
    suggestSetWeight(ramp, 4).kg === 100,
    `${suggestSetWeight(ramp, 4).kg} kg`
  );
}

console.log('\n[4] The lossless way out is Skip, and it is the only thing that writes a set off');

const writers = (session.match(/skipped:\s*true/g) ?? []).length;
const skipHandler = (() => {
  const start = session.indexOf('const handleSkipExercise = useCallback(');
  if (start === -1) return '';
  const end = session.indexOf('\n  }, []);', start);
  return end === -1 ? session.slice(start, start + 2000) : session.slice(start, end);
})();

check(
  'there is exactly one writer of a skipped set in the screen',
  writers === 1,
  `${writers} writer(s) - a second one is a second thing to get wrong, and the last one was the disappearing set`
);
check(
  'and it is inside the audited skip handler',
  skipHandler.length > 0 && /skipped:\s*true/.test(skipHandler),
  'could not find handleSkipExercise, or the writer is somewhere else'
);
check(
  'which spares everything already logged',
  /s\.completed \? s :/.test(skipHandler),
  'an unconditional map zeroes work the user actually did - see skip-preserves-logged-sets.check.mjs'
);
check(
  'and the clinical banner still points at it',
  /stop that exercise straight away and tap Skip/.test(session),
  'the button the safety copy points at has to be the lossless one'
);

console.log('\n[5] The app says all of this in words that match the buttons');

const tutorialBodies = SESSION_TUTORIAL.map((s) => `${s.title} ${s.body}`).join(' ');
const COACH_BASE = {
  exerciseName: 'Barbell Back Squat',
  category: 'main',
  setNumber: 2,
  totalSets: 4,
  suggestedKg: 60,
  typedKg: 60,
  weightUnit: 'kg',
  isBandOrBodyweight: false,
  loggedAnySet: true,
  exercisesLeft: 3,
};
const coachBodies = [
  'prep',
  'mechanical',
  'neuro',
  'main',
  'accessory',
  'prehab',
  'finisher',
  'cooldown',
]
  .flatMap((category) => sessionCoachTips({ ...COACH_BASE, category }))
  .map((t) => `${t.title} ${t.body}`)
  .join(' ');

check(
  `the tutorial and the in-session tips are both actually saying something (${SESSION_TUTORIAL.length} steps, ${coachBodies.length} characters of tips)`,
  SESSION_TUTORIAL.length > 4 && coachBodies.length > 500,
  'empty copy would pass every ban below without proving anything'
);
check(
  'neither of them still calls the middle button Challenging',
  !/challenging/i.test(tutorialBodies) && !/challenging/i.test(coachBodies),
  'the app explaining a button that no longer exists is worse than not explaining it'
);
check(
  'both name the button as it actually reads',
  new RegExp(SET_FEEDBACK_LABELS.challenging, 'i').test(tutorialBodies) &&
    new RegExp(SET_FEEDBACK_LABELS.challenging, 'i').test(coachBodies),
  `expected "${SET_FEEDBACK_LABELS.challenging}" in both`
);
check(
  'and neither promises the way out that used to remove the sets',
  !/one more set lighter|ease off|offers a way out/i.test(tutorialBodies) &&
    !/one more set lighter|ease off|offers a way out/i.test(coachBodies),
  'the tutorial promised "one more set lighter, or move on keeping everything you have logged" in words'
);
check(
  'what they do promise is that the answer only moves the weight',
  /never changes how many sets|only ever moves the weight|sets stay as they are/i.test(
    `${tutorialBodies} ${coachBodies}`
  ),
  'the reassurance is worth writing down, because the app did the opposite for months'
);

console.log(`\nease-off: ${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
