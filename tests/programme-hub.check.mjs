/**
 * Contract test: the programme hub, and the screen it did not replace.
 *
 * "Your Program" has always opened the three-lift rotation, because that is all
 * there was. It now opens the hub for anybody enrolled in a programme, and the
 * old screen underneath has to be left completely alone for everybody who is
 * not, which is every user of the app until this week.
 *
 * The second thing it guards is that nothing here destroys anything. Switching
 * programme and changing your days both rebuild the block, and somebody nine
 * weeks in needs to be told that their history, their records and their weights
 * survive it, because the obvious fear is that they do not.
 *
 * Run:  npx tsx tests/programme-hub.check.mjs
 */
import './_persist-shim.mjs';
import { readFileSync } from 'fs';
import { useAppStore } from '../lib/store.ts';
import { cycleFor, extrasFor } from '../lib/programme.ts';

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

const hub = read('components/ProgrammeHub.tsx');
const hubCode = stripComments(hub);
const screen = read('app/program.tsx');
const screenCode = stripComments(screen);

let seq = 0;
const session = (sessionType) => ({
  id: `s${seq++}`,
  sessionType,
  date: '2026-08-01T00:00:00.000Z',
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '45',
  exercises: [],
});

// ─── 1. The screen it did not replace ───────────────────────────────────────
console.log('\n[1] Everybody with no programme still gets the screen they had');

check(
  'the hub is only rendered when there is a programme',
  /\{programme \? \(\s*<ProgrammeHub \/>/.test(screenCode),
  'a hub rendered for somebody with no programme would render nothing at all'
);
check(
  'and the old rotation screen is still there behind it',
  /const suggestedNext = getCurrentSessionType\(\);/.test(screenCode) &&
    /SESSION_DISPLAY_NAMES\[item\.sessionType\]/.test(screenCode),
  'this is the view every existing user opens, and it must not have been gutted'
);
check(
  // The badge belongs to the rotation view, so it is now gated on that view
  // being the one on screen: a programme hides it, and so does the chooser that
  // an unenrolled user lands on first.
  'the cycle badge only appears over the rotation view it belongs to',
  /\{!programme && showRotation && onStrengthProgramme && \(/.test(screenCode),
  '"Cycle 3" counts barbell sessions towards a strength test, which means nothing on Joint Health'
);
check(
  'the hub renders nothing rather than guessing when it has no programme',
  /if \(!programme\) return null;/.test(hubCode) && /if \(!position\) return null;/.test(hubCode),
  ''
);

// ─── 2. Where you are ───────────────────────────────────────────────────────
console.log('\n[2] It answers where you are, honestly');

/**
 * Asserted as INTENT, not as a spelling.
 *
 * These two used to match the JSX character for character, which meant
 * rewording a sentence broke a test that has no opinion about the wording. What
 * has to be true is that the hub draws its position from the replayed position
 * rather than a stored counter, and shows the block in the unit it is measured
 * in.
 */
check(
  'it leads with where they are in the SESSIONS, which is what the block is counted in',
  /position\.totalSessions/.test(hubCode) &&
    /Session /.test(hubCode) &&
    !/programme\.blockWeeks/.test(hubCode),
  'a week counter as the headline tells somebody who trained twice this week that they are behind'
);
check(
  'and the week it works out at, derived rather than taken from the calendar',
  /position\.week\b/.test(hubCode) && /position\.weeks\b/.test(hubCode),
  ''
);
check(
  // The number that would be easiest and most tempting to hide. Somebody who
  // has done eleven sessions and four of them on plan should see both.
  'off-plan sessions are counted out loud, not quietly dropped',
  /position\.offPlan > 0/.test(hubCode) && /testID="hub-off-plan"/.test(hubCode),
  'hiding them would make the app look like it ignores work somebody actually did'
);
check(
  'and it says they still count',
  /count towards your history and records/.test(hub),
  'that is the whole promise, and this is the screen where it is easiest to doubt'
);
check(
  'a finished block says so',
  /position\.complete/.test(hubCode) && /Block complete/.test(hub),
  'twelve weeks with no reckoning at the end is why people drift'
);

// ─── 3. Recovery is offered, and costs nothing ──────────────────────────────
console.log('\n[3] The rehab and recovery work is right there');

check(
  // extrasOf, not extrasFor: a custom programme's cycle lives on the enrolment
  // rather than in the template table, so what is left over to offer alongside
  // it can only be worked out from the enrolment.
  'the extras are listed and can be started',
  /extrasOf\(programme\)/.test(hubCode) && /testID={`hub-extra-\$\{t\}`}/.test(hub),
  ''
);
check(
  'with the sentence that makes them usable',
  /never costs you your place/.test(hub),
  'somebody who thinks a mobility session will break their programme will not do one'
);

// ─── 4. Changing things, and what it costs ──────────────────────────────────
console.log('\n[4] Everything can be changed, and nothing is destroyed');

for (const [label, rx] of [
  ['days a week', /testID={`hub-days-\$\{d\}`}/],
  ['block length', /testID={`hub-length-\$\{n\}`}/],
  ['a different programme', /testID="hub-switch-toggle"/],
  ['pause and resume', /testID="hub-pause"/],
]) {
  check(`${label} can be changed from here`, rx.test(hub), '');
}

check(
  'switching asks first',
  /Alert\.alert\(/.test(hubCode) && /text: 'Cancel', style: 'cancel'/.test(hubCode),
  'somebody nine weeks in should not lose their block to a mis-tap'
);
check(
  'and says what happens to the work already done, which is nothing',
  /your history, your records and your weights are untouched/.test(hub),
  'the obvious fear is that switching wipes something, and it does not'
);
check(
  'changing the days says the rest of the block is rebuilt',
  /Changing this rebuilds the rest of the block/.test(hub),
  'the sessions already done stay done, and somebody watching the plan change needs to know why'
);
check(
  'pausing explains what it does instead',
  /Pausing keeps your place/.test(hub),
  'a pause that looked like leaving would never be used'
);

// ─── 5. The store agrees with all of that ───────────────────────────────────
console.log('\n[5] And the store actually behaves that way');

useAppStore.setState({
  programme: null,
  completedSessions: [],
  completedCount: 0,
  cycleStartOffset: 0,
  testWeekFrequency: 12,
  oneRepMaxes: [],
});
useAppStore.getState().applyProfileTree(
  { focus: 'joints', days: '3', minutes: '45', length: '12', experience: 'beginner', sore: 'no' },
  '2026-08-31T09:00:00.000Z'
);

const cycle = cycleFor('joints', 3);
useAppStore.setState({
  completedSessions: [
    session('conditioning'),
    session(cycle[1]),
    session(cycle[0]),
  ],
});
const pos = () => useAppStore.getState().getProgrammePosition();
check(
  'two on plan and one off plan is reported as exactly that',
  pos().onPlan === 2 && pos().offPlan === 1,
  JSON.stringify(pos())
);

const beforeHistory = useAppStore.getState().completedSessions.length;
useAppStore.getState().switchProgramme('lean', '2026-09-01T00:00:00.000Z');
check(
  'switching keeps every logged session',
  useAppStore.getState().completedSessions.length === beforeHistory,
  'the alert promises this in as many words'
);
check(
  'and starts the new block at nothing done',
  pos().onPlan === 0 && pos().week === 1,
  JSON.stringify(pos())
);

useAppStore.getState().updateProgramme({ days: 5 });
check(
  'changing the days changes the cycle the hub will draw',
  JSON.stringify(cycleFor('lean', 5)) !== JSON.stringify(cycleFor('lean', 3)) &&
    useAppStore.getState().programme.days === 5,
  ''
);
check(
  'and the extras follow it, so nothing is offered that is now prescribed',
  extrasFor('lean', 5).every((e) => !cycleFor('lean', 5).includes(e)),
  ''
);

useAppStore.getState().setProgrammePaused(true);
check(
  'pausing keeps the programme and its position',
  useAppStore.getState().programme !== null && pos() !== null,
  'a pause that dropped the block would be a deletion with a friendly name'
);

console.log(`\nprogramme-hub: ${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
