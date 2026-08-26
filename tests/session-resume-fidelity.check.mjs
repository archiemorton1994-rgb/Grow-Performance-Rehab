/**
 * Contract test: a saved session comes back as the session that was saved.
 *
 * WHAT WENT WRONG
 * ───────────────
 * The session route takes the whole pain answer — every sore area, the
 * severity, and whether it is acute — and feeds all of it to the generator:
 *
 *     painRegion: painRegions?.length ? painRegions : painRegion,
 *     painSeverity,
 *     acute: isAcute,
 *
 * The resume snapshot stored ONE of those four things: the first sore area. So
 * resuming rebuilt the workout with no severity, no other areas and no acute
 * flag, produced a different exercise list, failed its own exercise-ID match,
 * and dropped every logged set on the floor — silently, while the card the user
 * had just tapped still read "Squat Session · 12/24 sets".
 *
 * Moderate is the readiness screen's DEFAULT severity, so this was most pain
 * sessions rather than a rare case.
 *
 * Two shapes of duplication caused it and both are asserted against here: three
 * screens each wrote the resume params out longhand, and three save paths each
 * wrote the snapshot out longhand. A field added to the route reached one of
 * them and not the others. There is now one definition of each.
 *
 * ALSO PINNED
 * ───────────
 * The ratings, which were restored on resume but never saved, so every
 * "Too Hard" answer given before a Save & Exit was silently discarded. And the
 * timer, which used to CAP an overnight gap at 90 minutes rather than reject it
 * — turning 30 minutes trained into a reported 2:00:00.
 */
import { readFileSync } from 'fs';
import { resumeParams } from '../lib/resume-params.ts';

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

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const session = read('app/session.tsx');

console.log('\n[1] The full pain answer survives the round trip');

const saved = {
  sessionType: 'squat',
  equipmentTier: 'fullgym',
  hasAches: true,
  painRegion: 'shoulder_front',
  painRegions: ['shoulder_front', 'knee'],
  painSeverity: 'moderate',
  acute: true,
  energy: 'normal',
  timeAvailable: '45',
  isTestWeek: false,
};
const params = resumeParams(saved);

check(
  'every sore area is replayed, not just the first',
  params.painRegion === 'shoulder_front,knee',
  `got "${params.painRegion}" - the route splits this on commas, so one area rebuilds a different session`
);

check(
  'the severity is replayed',
  params.painSeverity === 'moderate',
  'severity changes which exercises are dropped; losing it changes the workout'
);

check(
  'the acute flag is replayed',
  params.acute === 'true',
  'acute routes to the gentle protocols - a resume must not quietly leave them'
);

console.log('\n[2] Snapshots from older builds still resume');

const legacy = { ...saved, painRegions: undefined, painSeverity: undefined, acute: undefined };
const legacyParams = resumeParams(legacy);
check(
  'it falls back to the single stored area',
  legacyParams.painRegion === 'shoulder_front',
  'a snapshot written before this change has only painRegion'
);
check(
  'absent severity is omitted rather than sent as undefined',
  !('painSeverity' in legacyParams) && !('acute' in legacyParams),
  'sending the string "undefined" as a route param is worse than sending nothing'
);

console.log('\n[3] A pain-free session is unaffected');

const noPain = {
  sessionType: 'bench',
  equipmentTier: 'fullgym',
  hasAches: false,
  painRegion: undefined,
  energy: 'normal',
  timeAvailable: '45',
  isTestWeek: false,
};
check(
  'no sore area produces an empty string, as before',
  resumeParams(noPain).painRegion === '',
  'the route treats an empty string as "no pain reported"'
);

console.log('\n[4] There is exactly one definition of each half');

for (const [file, label] of [
  ['app/(tabs)/index.tsx', 'Home'],
  ['app/(tabs)/train.tsx', 'Train'],
  ['app/program.tsx', 'the programme sheet'],
]) {
  const src = read(file);
  check(
    `${label} resumes through the shared helper`,
    /params: resumeParams\(activeSession\)/.test(src),
    'writing the params out longhand here is how the pain context went missing'
  );
  check(
    `${label} does not hand-roll the params`,
    !/painRegion: activeSession\.painRegion \?\? ''/.test(src),
    'the longhand version replayed only the first sore area'
  );
}

check(
  'the session screen builds every snapshot from one context',
  (session.match(/\.\.\.snapshotContext(Ref\.current)?\(\)/g) ?? []).length === 3,
  'all three save paths (background, autosave, Save & Exit) must share one definition'
);

check(
  'that context carries the whole pain answer',
  /const snapshotContext = \(\) => \(\{[\s\S]{0,400}?painRegions,[\s\S]{0,120}?painSeverity,[\s\S]{0,120}?acute: isAcute,/.test(
    session
  ),
  'painRegions, painSeverity and acute must all be saved or the resume rebuilds a different session'
);

console.log('\n[5] Ratings are saved, not just restored');

check(
  'every save path writes the in-session ratings',
  (session.match(/inSessionFeedback: cleanFeedback\(/g) ?? []).length === 3,
  'they were restored on resume but only ever written by the COMPLETE path, so a Save & Exit lost them'
);

check(
  'the background save reads them from a ref',
  /inSessionFeedback: cleanFeedback\(inSessionFeedbackRef\.current\)/.test(session),
  'the AppState listener has no re-render, so state read directly there is stale'
);

check(
  'Save & Exit marks the session terminated before dismissing',
  /sessionTerminatedRef\.current = true;[\s\S]{0,400}?setActiveSession\(\{[\s\S]{0,200}?snapshotContext\(\)/.test(
    session
  ),
  'otherwise the unmount save fires afterwards and overwrites the snapshot from a stale closure'
);

console.log('\n[6] The timer reports time actually trained');

check(
  'a long gap is rejected rather than capped',
  /secondsSinceSave > 0 && secondsSinceSave <= RESUME_GAP_COUNTS_AS_TRAINING_S\s*\r?\n?\s*\?\s*secondsSinceSave\s*\r?\n?\s*:\s*0/.test(
    session
  ),
  'capping an overnight gap at 90 minutes still adds 90 minutes to a 30-minute session'
);

check(
  'the old 90-minute cap is gone',
  !/Math\.min\([\s\S]{0,120}?5400\s*\r?\n?\s*\)/.test(session),
  'Math.min(gap, 5400) is the bug: it turned 30 minutes trained into a reported 2:00:00'
);

check(
  'time spent backgrounded mid-session is credited',
  /AppState\.addEventListener\([\s\S]{0,600}?state === 'active' && leftAt !== null/.test(session),
  'setInterval does not run in the background, so checking a message between sets lost that time'
);

check(
  'both directions use the same threshold',
  (session.match(/RESUME_GAP_COUNTS_AS_TRAINING_S/g) ?? []).length >= 3,
  'one definition of "this gap was an interruption, not leaving"'
);

console.log('\n[7] A failed restore says so');

check(
  'the screen can report that a snapshot could not be rebuilt',
  /setRestoreFailed\(true\)/.test(session) && /RestoreFailedBanner/.test(session),
  'handing the user a blank session after they tapped "12/24 sets" reads as lost work'
);

check(
  'it only fires when there was work to lose',
  /stored\.completedSetsCount > 0/.test(session),
  'a snapshot with nothing logged in it is not worth a banner'
);

console.log('\n[?] A day off does not throw the session away');

/**
 * IT USED TO DELETE AFTER TWENTY-FOUR HOURS, SILENTLY.
 *
 * Start on Saturday morning, get interrupted, open the app on Sunday: the sets
 * were gone, with no warning and no notice. Home has always offered both
 * answers on that card, Resume and an X to start fresh, so the choice existed.
 * The automatic delete was taking it away before the user ever saw it.
 *
 * A week rather than forever, because the load maths backs weights off after a
 * layoff and resuming a fortnight-old session would train against numbers the
 * app has since moved past. Long enough that ordinary life does not cost you a
 * session; short enough that nothing ancient is offered.
 */
const layoutSrc = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const homeSrc = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const windowMs = (() => {
  const m = /ACTIVE_SESSION_MAX_AGE_MS = ([0-9 *]+);/.exec(layoutSrc);
  // eslint-disable-next-line no-new-func
  return m ? Function('return (' + m[1] + ');')() : NaN;
})();
const windowDays = windowMs / 86400000;

check(
  `the discard window is a named constant (${windowDays} days)`,
  Number.isFinite(windowMs),
  'a bare literal here is a rule nothing can read, and the notification ladder needs to ask what it is'
);
check(
  'a session survives at least a couple of days',
  windowDays >= 2,
  'at one day, anyone who trains in the morning and reopens the app the next day loses their sets'
);
check(
  'but not indefinitely',
  windowDays <= 30,
  'the weights in a month-old session are not the weights the app would give you today'
);
check(
  'and the discard is still automatic past that point',
  /age > ACTIVE_SESSION_MAX_AGE_MS/.test(layoutSrc),
  'without it a stale session sits on Home for ever'
);

check(
  'Home offers both answers, not just Resume',
  /testID="resume-session"/.test(homeSrc) && /testID="discard-active-session"/.test(homeSrc),
  'this is the choice the automatic delete was making on the user\'s behalf'
);
check(
  'the card says how old the session is',
  /activeSessionAge/.test(homeSrc),
  '"12/24 sets" from this morning and the same from last Tuesday are different decisions'
);
check(
  'and it says nothing for one saved today',
  /if \(days <= 0\) return '';/.test(homeSrc),
  '"today" beside a Resume button is noise'
);
check(
  'starting fresh says what is actually lost',
  /Start fresh\?/.test(homeSrc) && /will be lost/.test(homeSrc),
  'and that it is only the in-progress sets, not the history'
);
check(
  'it does not claim the history goes with it',
  /history and your weights are not affected/.test(homeSrc),
  'the word "lost" beside a training app needs bounding, or nobody taps it'
);

console.log(`\nsession-resume-fidelity: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
