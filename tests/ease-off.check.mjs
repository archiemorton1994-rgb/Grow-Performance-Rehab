/**
 * Contract test: "Challenging" is no longer a dead end, and the way out cannot
 * be worse than staying.
 *
 * WHAT WAS WRONG
 * ──────────────
 * "Challenging" records the answer and holds the weight, which is correct when
 * the prescription was correct. It is also what somebody taps when they have
 * just realised the next set is the one that will fail, and for them the screen
 * had two options: grind it, or tap "Skip - couldn't do this exercise" and lose
 * the rest of the exercise entirely. Nothing in between.
 *
 * So the answer can now open a second step offering the two middle paths:
 * finish on one lighter set, or move on and keep everything already logged.
 *
 * WHAT THIS ASSERTS, AND WHY EACH ONE IS HERE
 * ───────────────────────────────────────────
 * A RAMP RUNG IS NOT A WORKING SET. lib/auto-regulation.ts opens with this
 * trap: on a ramped main lift, "that felt challenging" on rung one of six means
 * the bar is heavy, not that the session is beyond the lifter, and twenty per
 * cent below that rung is a weight they warmed up on.
 *
 * The first version answered this by withholding the offer on a rung. Walking a
 * real generated squat session showed what that cost: the barbell squat is five
 * sets, every one of them a new higher weight, so no rung is ever at the top of
 * the plan and the top has no sets left after it. The offer could not appear on
 * the hardest work in the session. So the ramp now changes WHAT is offered.
 * On a rung it is "stop climbing and take this weight as your top set", which
 * is lighter than the set the plan was about to ask for. At the top of a ramp,
 * and on a flat accessory, it is a real twenty per cent reduction.
 *
 * THE LIGHTER WEIGHT MUST BE LIGHTER. Twenty per cent off the lightest dumbbell
 * in the building rounds straight back onto it, because every weight the app
 * names has to be one the gym can load. A row that promises relief and hands
 * back the same number is worse than no row.
 *
 * AND IT MUST LEAVE A SET TO DO. The whole difference between this and skipping
 * is that one set still gets done.
 *
 * Run:  npx tsx tests/ease-off.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
import { readFileSync } from 'fs';

const { roundToLoadable } = await import('../lib/utils.ts');

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

console.log('\n[1] The offer only appears where it can change something');

check(
  'it is raised by the Challenging answer',
  /f === 'challenging' &&/.test(session),
  'the other two answers already move the weight themselves'
);

check(
  'there has to be a later set for it to change',
  /showFeedback\.remaining > 0/.test(session),
  'on the last set of an exercise both options are meaningless'
);

check(
  'there has to be a weight for it to reduce',
  /showFeedback\.kg > 0/.test(session),
  'a bodyweight or banded set has no load to drop'
);

check(
  'and that is all it takes, so the main lift can reach it too',
  /showFeedback\.kg > 0\s*\r?\n\s*\) \{/.test(session),
  'gating on the ramp being over made the offer unreachable on every main lift: each rung is below the top, and the top has no sets left after it'
);

check(
  'whether the ramp is over is carried into the offer',
  /isWorkingSet: showFeedback\.isWorkingSet,/.test(session),
  'it decides which kind of relief the row describes'
);

console.log('\n[2] The context is captured, not read live');

check(
  'the remaining count is taken when the prompt is raised',
  /remaining: totalSets - \(activeSetIndex \+ 1\)/.test(session),
  'logging the last set advances the session, so reading it live describes the NEXT exercise'
);

check(
  'so is which exercise it belongs to',
  /exerciseIndex,[\s\S]{0,200}isWorkingSet:/.test(session),
  'the same reason the set index is captured: the bar has already moved on'
);

check(
  'the working set is worked out from the planned weights',
  /const topGuide = Math\.max\(0, \.\.\.weightGuidesKg\.filter\(\(n\) => n > 0\)\);/.test(session) &&
    /\(weightGuidesKg\[activeSetIndex\] \?\? 0\) >= topGuide/.test(session),
  'weightGuidesKg is the planned weight per set, so the top of the ramp is its maximum'
);

console.log('\n[3] The lighter weight is genuinely lighter, and loadable');

const m = session.match(/const EASE_OFF_FRACTION = ([\d.]+);/);
const fraction = m ? parseFloat(m[1]) : NaN;

check(
  `the drop is a real fraction (read ${m ? m[1] : 'nothing'})`,
  Number.isFinite(fraction) && fraction > 0 && fraction < 1,
  'a missing or nonsense constant would silently make this a no-op'
);

check(
  'and it is a bigger drop than the correction Too Hard already applies',
  fraction > 0.1,
  'ten per cent is what the auto-regulation does for a set that was too hard; this is a deliberate back-off and has to feel different'
);

let notLower = [];
let higher = [];
for (const unit of ['kg', 'lbs']) {
  for (let kg = 2.5; kg <= 220; kg += 2.5) {
    const back = roundToLoadable(kg * (1 - fraction), unit);
    if (back > kg) higher.push(`${kg}${unit} -> ${back}`);
    else if (back >= kg) notLower.push(`${kg}${unit}`);
  }
}

check(
  'the back-off is never heavier than the set that earned it',
  higher.length === 0,
  higher.slice(0, 4).join('; ')
);

check(
  `it is lighter everywhere except the very bottom of the rack (${notLower.length} of 176)`,
  notLower.length > 0 ? notLower.every((s) => parseFloat(s) <= 10) : true,
  `not lighter at: ${notLower.slice(0, 6).join(', ')}`
);

check(
  'a rung offers the weight just lifted; a working set offers less',
  /const lighterKg = easeOff\.isWorkingSet\s*\r?\n?\s*\? roundToLoadable\(easeOff\.kg \* \(1 - EASE_OFF_FRACTION\), weightUnit\)\s*\r?\n?\s*: easeOff\.kg;/.test(
    session
  ),
  'twenty per cent below a ramp rung is a weight they warmed up on; stopping the climb is the relief there'
);

check(
  'and where a reduction cannot go lower, the row is not offered',
  /const canGoLighter = !easeOff\.isWorkingSet \|\| lighterKg < easeOff\.kg;/.test(session) &&
    /\{canGoLighter && \(/.test(session),
  'a button promising a lighter set and handing back the same weight is worse than no button'
);

check(
  'the weight on the button is the weight handed to the handler',
  /onEaseOff\?\.\(easeOff\.exerciseIndex, 'lighter', lighterKg\);/.test(session) &&
    /const backOffKg = targetKg;/.test(session),
  'working the same sum out in the bar and again in the handler is two chances for the number agreed to and the number written to diverge'
);

console.log('\n[4] The lighter option leaves a set to actually do');

check(
  'the final set keeps its weight and stays unfinished',
  /if \(i < last\) return \{ \.\.\.s, weight: 0, reps: 0, completed: true, skipped: true \};\s*\r?\n\s*return \{ \.\.\.s, weight: backOffKg \};/.test(
    session
  ),
  'marking it completed would make this identical to skipping, which is the option beside it'
);

check(
  'and the session points at it',
  /activeSetIndex: last,/.test(session),
  'otherwise the user is left on a set that has already been written off'
);

check(
  'the sets already logged survive',
  /if \(s\.completed\) return s;/.test(session),
  'the same guarantee tapping Skip carries - see skip-preserves-logged-sets.check.mjs'
);

console.log('\n[5] Nothing is a dead end');

check(
  'moving on goes through the audited skip handler',
  /if \(mode === 'skip'\) \{\s*\r?\n\s*handleSkipExercise\(index\);/.test(session),
  'a second implementation of skip is a second thing to get wrong'
);

check(
  'there is a way to decline both and carry on',
  /testID="ease-off-carry-on"/.test(session) && /Carry on as planned/.test(session),
  'a prompt with only irreversible answers is a trap'
);

check(
  'declining changes nothing',
  /onPress=\{\(\) => setEaseOff\(null\)\}/.test(session),
  'carrying on must not touch the sets or the weight'
);

check(
  'the answer is recorded before any of this',
  /onFeedback\(showFeedback\.exerciseId, showFeedback\.setIndex, f, showFeedback\.kg\);[\s\S]{0,400}f === 'challenging'/.test(
    session
  ),
  'the rating shapes the next session and must not depend on what the user does with the offer'
);

console.log('\n[6] It is a step in the bar, not another modal');

/**
 * The whole branch, from the test to the next one.
 *
 * Sliced rather than matched with a character budget: a budget is a spelling
 * pin wearing a number, and it goes red the day somebody adds a comment.
 */
const branchStart = session.indexOf('if (easeOff) {');
const branchEnd = session.indexOf('if (showFeedback || demoForceFeedback) {', branchStart);
const branch = branchStart >= 0 && branchEnd > branchStart ? session.slice(branchStart, branchEnd) : '';

check(
  'the ease-off step exists as its own branch of the bar',
  branch.length > 0,
  'could not find the branch between "if (easeOff)" and the feedback prompt'
);

check(
  'it renders into the bar rather than opening a sheet',
  /<View style=\{\[styles\.barContainer/.test(branch) && !/<Modal/.test(branch),
  'every frozen-app report in this app has been two native modals open at once'
);

console.log(`\nease-off: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
