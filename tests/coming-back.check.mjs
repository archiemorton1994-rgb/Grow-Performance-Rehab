/**
 * Contract test: the things that reach a user between sessions, and the things
 * the app already knew and never said.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. THE APP COULD ONLY TALK TO PEOPLE WHO WERE ALREADY COMING BACK
 * ─────────────────────────────────────────────────────────────────────────────
 * The missed-workout nudge is the only reminder on by default, and it was a
 * SINGLE one-shot alarm twenty hours out, re-armed only when the app was opened
 * or a session finished. There is no push server and no background task in this
 * repo, so somebody who stopped opening the app got exactly one notification,
 * ever, and then silence. The reminder that matters - the one on day nine, when
 * they have drifted rather than decided - could not exist.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. AND 102 CLINICAL NOTES WERE WRITTEN AND NEVER SHOWN
 * ─────────────────────────────────────────────────────────────────────────────
 * lib/acute-rehab.ts carries, for all 19 body regions, both a pain rule and a
 * list of what the protocol deliberately leaves out and why - that pulling on a
 * hamstring still knitting back together pulls the repairing fibres apart, that
 * a Nordic negative is the heaviest demand there is on a hamstring. Only the
 * pain rule ever reached a user. The other 102 lines existed in that file, in a
 * contract test, and nowhere else in the app.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. AND THE CARD NEVER SAID WHAT YOU DID LAST TIME
 * ─────────────────────────────────────────────────────────────────────────────
 * The weight was fed back twice - it prefills the logging box and sets the
 * target on the card. The REPS were not fed back anywhere, even though the card
 * component was already handed them and simply dropped the value.
 *
 * Run:  npx tsx tests/coming-back.check.mjs
 */
import { readFileSync } from 'fs';

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
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const notifications = read('lib/notifications.ts');
const notificationsCode = stripComments(notifications);
const session = read('app/session.tsx');
const sessionCode = stripComments(session);

console.log('\n[1] A lapsed user hears more than once');

const rungs = [...notificationsCode.matchAll(/hours:\s*([0-9*\s]+),/g)].map((m) =>
  Number(eval(m[1]))
);
check(
  `the nudge is a ladder, not one alarm (${rungs.length} rungs)`,
  rungs.length >= 4,
  'one alarm twenty hours out is the only thing somebody who drifts away ever hears'
);
check(
  'it reaches past a fortnight',
  Math.max(...rungs, 0) >= 24 * 14,
  'people do not decide to stop; they drift, and the rung that matters is the one after they have'
);
check(
  'the rungs are in order and none is a duplicate',
  rungs.every((h, i) => i === 0 || h > rungs[i - 1]),
  ''
);
check(
  'every rung has its own identifier',
  (() => {
    const ids = [...notificationsCode.matchAll(/id:\s*'(grow-missed-workout[^']*)'/g)].map(
      (m) => m[1]
    );
    return ids.length === rungs.length && new Set(ids).size === ids.length;
  })(),
  'scheduling four alarms under one identifier schedules one alarm'
);
check(
  'the first rung keeps the identifier the old single alarm used',
  /id:\s*'grow-missed-workout',/.test(notificationsCode),
  'an alarm scheduled by a previous version of the app must still be cancellable, or it fires alongside the new ones'
);
check(
  'cancelling clears every rung, not just the first',
  /export async function cancelMissedWorkoutNudge[\s\S]{0,320}for \(const rung of NUDGE_RUNGS\)/.test(
    notificationsCode
  ),
  'clearing one and leaving three behind notifies somebody who came back yesterday'
);
check(
  'and scheduling cancels first, so an active user never walks down the ladder',
  /scheduleMissedWorkoutNudge[\s\S]{0,260}await cancelMissedWorkoutNudge\(\);/.test(
    notificationsCode
  ),
  ''
);
check(
  'the later rungs say what coming back actually costs',
  /lighter on purpose|Nothing to make up|exactly as you left/i.test(notifications),
  'the reason people do not come back after a fortnight is not knowing what it costs them, and the app already handles it - see getLayoff'
);

/**
 * NO RUNG MAY PROMISE A SAVED SESSION IT KNOWS HAS BEEN DELETED.
 *
 * A half-finished session is discarded on the first launch after 24 hours, in
 * app/_layout.tsx. The 72-hour rung read "Your session is still here / Three
 * days off changes nothing. Pick up exactly where you left it." By the time it
 * fired, the session it named had been gone for two days, and tapping the
 * notification opened an app with nothing to resume.
 *
 * The window is read off the layout rather than written here, so moving the
 * discard rule re-opens the question instead of quietly making more rungs lie.
 */
const layout = read('app/_layout.tsx');
// Read off the NAMED constant, which is what the window is now. The first
// version of this matched the inline arithmetic and went blind the moment the
// number was given a name, which it caught itself.
const discardHours = (() => {
  const m = /ACTIVE_SESSION_MAX_AGE_MS = ([0-9 *]+);/.exec(stripComments(layout));
  if (!m) return NaN;
  // eslint-disable-next-line no-new-func
  return Function('return (' + m[1] + ') / (60 * 60 * 1000);')();
})();
check(
  `the saved-session discard window was found (${discardHours} hours)`,
  Number.isFinite(discardHours) && discardHours > 0,
  'without it the rule below proves nothing'
);

const RESUME_CLAIM = /session is still here|pick (?:it )?up (?:exactly )?where you left|resume your session|session is waiting/i;
const rungBlocks = [
  ...notificationsCode.matchAll(
    /hours:\s*([0-9*\s]+),\s*title:\s*(?:'([^']*)'|"([^"]*)"),\s*body:\s*(?:'([^']*)'|"([^"]*)")/g
  ),
].map((m) => ({
  // eslint-disable-next-line no-eval
  hours: Function('return ' + m[1])(),
  copy: (m[2] ?? m[3] ?? '') + ' ' + (m[4] ?? m[5] ?? ''),
}));
check(
  `every rung's copy was read (${rungBlocks.length})`,
  rungBlocks.length >= 3,
  'the rung shape has changed and this rule has gone blind'
);
const liars = rungBlocks.filter((r) => r.hours > discardHours && RESUME_CLAIM.test(r.copy));
check(
  'no rung that fires after the discard window promises a saved session',
  liars.length === 0,
  liars
    .map((r) => `${r.hours}h: "${r.copy}"`)
    .join(' | ') + ` - the session is deleted after ${discardHours} hours`
);
check(
  'the first rung, which fires inside the window, may still say it',
  rungBlocks.some((r) => r.hours <= discardHours),
  'if no rung fires inside the window the ladder has lost its earliest and most useful step'
);

console.log('\n[1c] The daily reminder knows who it is talking to');

/**
 * "Your session is ready. Let's go." fired every day for everybody with
 * reminders on, including people the gate sends straight to the paywall. They
 * tap it, meet a paywall, and learn to ignore the app's notifications, which is
 * worse than not sending it.
 *
 * Three audiences now, and the rule that matters most is what they may NOT say.
 * Apple grants an introductory offer once per Apple ID rather than once per Grow
 * account, and nothing has asked the store anything at the moment a
 * notification is scheduled. A daily notification promising fourteen free days
 * to somebody Apple will charge immediately is the celebration-screen mistake
 * on a repeating timer.
 *
 * reminderAudienceFor is LIFTED OUT AND RUN rather than regexed, because what
 * matters is the mapping, not the wording of the if.
 */
const audienceFn = (() => {
  const at = notificationsCode.indexOf('export function reminderAudienceFor(');
  if (at === -1) return null;
  const open = notificationsCode.indexOf('{', notificationsCode.indexOf(')', at));
  let depth = 0;
  for (let i = open; i < notificationsCode.length; i++) {
    if (notificationsCode[i] === '{') depth++;
    else if (notificationsCode[i] === '}') {
      depth--;
      if (depth === 0) {
        const body = notificationsCode.slice(open + 1, i);
        return Function('hasActiveSubscription', 'hasEverSubscribed', body);
      }
    }
  }
  return null;
})();
check(
  'reminderAudienceFor could be read off the source and run',
  audienceFn != null,
  'the three checks below prove nothing without it'
);
check(
  'a subscriber gets the training reminder',
  audienceFn?.(true, true) === 'training' && audienceFn?.(true, false) === 'training',
  'somebody who is paying should be reminded to train, not sold to'
);
check(
  'somebody who has never subscribed is not told they lapsed',
  audienceFn?.(false, false) === 'never-subscribed',
  ''
);
check(
  'and somebody who had it and lost it is not treated as new',
  audienceFn?.(false, true) === 'lapsed',
  'the two need different words: one has nothing yet, the other has everything and cannot reach it'
);

const audienceCopy = notifications.slice(
  notifications.indexOf('const AUDIENCE_COPY'),
  notifications.indexOf('export function reminderAudienceFor')
);
const audienceStrings = [...audienceCopy.matchAll(/'([^'\n]{10,})'/g)].map((m) => m[1]);
check(
  `both audiences have their own copy (${audienceStrings.length} lines)`,
  audienceStrings.length >= 6,
  'the block has moved and the rules below have gone blind'
);
check(
  'no reminder promises a free trial, or a number of free days',
  !audienceStrings.some((v) => /free trial|days free|\d+ days on us|trial/i.test(v)),
  'eligibility is per Apple ID and nothing has asked the store at the moment this is scheduled. The paywall asks, and the paywall is the only screen allowed to name an offer'
);
check(
  'nor a price',
  !audienceStrings.some((v) => /[£$€]\s?\d/.test(v)),
  'the same rule the rest of the app now follows'
);
check(
  'no spaced hyphen doing a dash job',
  !audienceStrings.some((v) => / - |—|–/.test(v)),
  ''
);
check(
  'both callers choose an audience rather than taking the default',
  /scheduleWorkoutReminder\(\s*reminderTime,\s*reminderAudienceFor\(/.test(
    stripComments(read('app/_layout.tsx'))
  ) && /scheduleWorkoutReminder\(reminderTime, reminderAudience\)/.test(
    stripComments(read('app/(tabs)/profile.tsx'))
  ),
  'a caller that forgets falls back to the training wording, which is the bug'
);
check(
  'and both get it from the same helper',
  /reminderAudienceFor\(hasActiveSubscription, hasEverSubscribed\)/.test(
    read('app/(tabs)/profile.tsx')
  ),
  'two copies of this mapping is two chances to disagree about who somebody is'
);
check(
  'the flag that separates them decides no access',
  !/hasEverSubscribed/.test(stripComments(read('lib/auth-context.tsx'))),
  'it exists to pick a message. The moment it reaches the gate it is deciding who gets in'
);

console.log('\n[2] The clinical notes reach the person they were written for');

check(
  'the session reads the avoid list, not only the disclaimer',
  /ACUTE_PROTOCOL_NOTES\[painRegions\[0\]\]\?\.avoid/.test(sessionCode),
  '102 hand-written explanations existed in one file and a test, and nowhere a user could see them'
);
check(
  'it is passed to the banner',
  /avoid=\{painFreeAvoid\}/.test(sessionCode),
  ''
);
check(
  'and the banner renders it',
  /avoid\?\.length/.test(sessionCode) && /acute-avoid-list/.test(sessionCode),
  ''
);
check(
  'folded away by default',
  /const \[avoidOpen, setAvoidOpen\] = useState\(false\);/.test(sessionCode),
  'during a session the pain rule is the thing that has to be read; five more bullets on top of it is how nobody reads either'
);
check(
  'and only offered when one region was named',
  /painRegions\?\.length === 1/.test(sessionCode),
  'with two complaints the session blends two protocols and neither list describes what is on screen'
);

console.log('\n[3] The card says what you did last time');

check(
  'the last session hint is rendered, not just accepted as a prop',
  sessionCode.includes('{lastSessionHint && lastSessionHint.reps > 0 && ('),
  'the component was already handed the weight, reps and date, and drew none of it'
);
check(
  'it names the reps, which were the part missing',
  /Last time: \{formatWeight\(lastSessionHint\.weight, weightUnit\)\}/.test(sessionCode) &&
    /\{lastSessionHint\.reps\}/.test(sessionCode),
  'the weight was already fed back twice over; the rep count was nowhere'
);
check(
  'and it is still handed the data',
  /lastSessionHint=\{previousSessionData\[exercise\.id\]\}/.test(sessionCode),
  ''
);

console.log('\n[4] The screen stays awake while you train');

check(
  'the session screen holds the wake lock',
  /useKeepAwake\(\);/.test(sessionCode) &&
    /from 'expo-keep-awake'/.test(sessionCode),
  'log a set, put the phone down, do the set, pick it up: locked, once per set'
);
check(
  'and the dependency is declared rather than borrowed from expo',
  /"expo-keep-awake"/.test(read('package.json')),
  'importing a transitive dependency works until an update removes it silently'
);

console.log(`\ncoming-back: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
