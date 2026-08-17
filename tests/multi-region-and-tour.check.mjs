/**
 * Contract test: report two sore areas and the app still talks about both.
 *
 * A user can tap more than one region — the button literally reads "Start
 * Session (2 regions)" — and three separate things then quietly narrowed to the
 * first one they tapped.
 *
 * 1. THE SAFETY MESSAGE. The banner is the ONLY place the session confirms back
 *    what it adapted for, and the stop-if-it-hurts instruction is the one line
 *    that makes an injury-adapted session safe. It named one area out of three,
 *    so the other two were silently uncovered. The person reporting MORE pain
 *    got the narrower instruction.
 *
 * 2. THE ESCALATION ADVICE. All twenty per-region disclaimers end with "stop and
 *    get it assessed by a physiotherapist or doctor". The shared one-line rule —
 *    which is precisely what a MULTI-region user sees, because there is no
 *    single protocol to quote — stopped at "it should settle as soon as you
 *    stop". Again: more areas reported, less guidance given.
 *
 * 3. THE SWAP CAPTIONS. Every card blamed the first area tapped, so a
 *    shoulder-then-knee user read "Swapped from Squat Jump to protect your front
 *    shoulder" on every knee swap. The adaptation was right and the reason
 *    printed on it was wrong, which reads as the app not having understood.
 *
 * ALSO HERE: the guided tour's practice session, which no user had ever seen.
 * The last Stats step set the active tab to Profile AND pushed /session?demo=true
 * 150ms later; the tour-routing effect then navigated to Profile 200ms after
 * that, popping the session about a third of a second after it opened. Its own
 * tutorial is on an 800ms timer, so it never started. The intro promises "a
 * walkthrough of the five tabs, then a quick practice session" — so the launch
 * belongs at the END of Profile, and there is one handoff instead of two racing.
 */
import { readFileSync } from 'fs';
import { PAIN_FREE_RULE } from '../lib/acute-rehab.ts';

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

// Several assertions below say "this string must NOT appear" — and the comments
// explaining WHY it was removed quote the string. Strip comments for those, or
// the prose documenting the fix is what fails the test.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const readCode = (p) => stripComments(read(p));
const session = read('app/session.tsx');
const engine = read('lib/workout-engine.ts');
const tabsLayout = read('app/(tabs)/_layout.tsx');
const workouts = readCode('app/(tabs)/workouts.tsx');
const profile = readCode('app/(tabs)/profile.tsx');

console.log('\n[1] The safety banner covers every area reported');

check(
  'the banner accepts the full list',
  /painRegions\?: PainRegion\[\]/.test(session),
  'it only ever received the first area tapped'
);

check(
  'the session passes it',
  /<PainAdaptBanner[\s\S]{0,200}?painRegions=\{painRegions\}/.test(session),
  'declaring the prop and not passing it changes nothing'
);

check(
  'the title lists them all',
  /Adapted for \{titleLabels\}/.test(session),
  'this is the only confirmation the user gets of what they picked'
);

check(
  'the stop-if-it-hurts instruction names them all',
  /hurts your \$\{sentenceLabels\}/.test(session),
  'naming one area out of three leaves two uncovered by the instruction that matters most'
);

check(
  'several areas are joined readably',
  /' or ' \+/.test(session),
  '"your shoulder, knee or lower back" reads; a comma-separated list does not'
);

console.log('\n[2] The escalation advice survives a multi-region session');

check(
  'the shared rule tells the user when to get assessed',
  /physiotherapist or doctor/.test(PAIN_FREE_RULE),
  'this is the fallback shown when more than one area is reported'
);

check(
  'it still states the threshold',
  /\b2\s*(?:\/|out of)\s*10\b/i.test(PAIN_FREE_RULE),
  'the escalation sentence must not have displaced the rule itself'
);

console.log('\n[3] A swap is blamed on the area that caused it');

check(
  'the caption resolves the culprit region per exercise',
  /const labelForHit = \(tag: StressTag \| undefined\)/.test(engine),
  'one label for the whole session is what printed "to protect your front shoulder" on knee swaps'
);

check(
  'it looks the tag up in the restriction map',
  /regions\.find\(\(r\) => \(RESTRICTED_BY_REGION\[r\] \?\? \[\]\)\.includes\(tag\)\)/.test(engine),
  'the culprit is whichever reported area actually restricts the tag that forced the swap'
);

check(
  'both the substitution note and the caution note use it',
  (engine.match(/labelForHit\(hits\[0\]\)/g) ?? []).length === 2,
  'the swapped-for note and the take-care note are both per-exercise'
);

check(
  'a single-region session is unchanged',
  /if \(regions\.length <= 1 \|\| !tag\) return regionLabel;/.test(engine),
  'the common case must not pay for the multi-region fix'
);

console.log('\n[4] The tour actually reaches its practice session');

check(
  'the Stats step no longer launches the session itself',
  !/demo=true/.test(workouts),
  'setting the active tab AND pushing the session is two handoffs racing each other'
);

check(
  'Profile launches it at the end of the tour',
  /setTourActiveTab\(null\);[\s\S]{0,400}?router\.navigate\('\/session\?demo=true'/.test(profile),
  'the intro promises five tabs THEN a practice session'
);

check(
  'the active tab is cleared before the session opens',
  /setTourActiveTab\(null\);[\s\S]{0,300}?setTimeout/.test(profile),
  'with a tab still active the routing effect would navigate straight back out of it'
);

check(
  'and tour routing never fires on a screen above the tabs',
  /if \(tourActiveTab === null\) return;\s*\r?\n(?:\s*\/\/[^\n]*\r?\n)*\s*if \(segments\[0\] !== '\(tabs\)'\) return;/.test(
    tabsLayout
  ),
  'this is the belt-and-braces half: nothing pushed above the tabs may be navigated out from under'
);

console.log('\n[5] Logging a set no longer rewrites the whole history');

check(
  'the resume snapshot is throttled',
  /SNAPSHOT_THROTTLE_MS/.test(session),
  'activeSession shares a storage blob with every session ever logged'
);

check(
  'typing a note does not schedule a write',
  !/\}, \[exerciseData, exerciseNotes, inSessionFeedback, activeIndex, painBannerDismissed\]\)/.test(
    session
  ),
  'exerciseNotes in the deps meant one full history rewrite PER KEYSTROKE'
);

check(
  'the throttled write reads current values from refs',
  /exerciseNotes: notes,[\s\S]{0,400}?exerciseIds: exerciseIdsRef\.current/.test(session),
  'a delayed write must not persist the state as it was when the timer was set'
);

check(
  'the pending timer is cleaned up on unmount',
  /clearTimeout\(snapshotTimerRef\.current\)/.test(session),
  'a timer firing after the screen is gone would write a snapshot from a dead closure'
);

check(
  'the root navigator subscribes field by field',
  !/const \{ onboardingComplete, hasHydrated \} = useAppStore\(\);/.test(read('app/_layout.tsx')) &&
    /useAppStore\(\(s\) => s\.hasHydrated\)/.test(read('app/_layout.tsx')),
  'a bare useAppStore() re-renders the whole navigator on every set logged'
);

console.log('\n[6] Prehab from this route can be maintenance work again');

const readiness = read('app/readiness.tsx');
check(
  'the sore / feels-fine question is asked',
  /prehab-sore-\$\{opt\.key \? 'yes' : 'no'\}/.test(readiness),
  'the session route infers acute from "is a region present", which this step always sends'
);

check(
  'the answer is passed explicitly',
  /acute: region !== 'fullbody' && prehabSore \? 'true' : 'false'/.test(readiness),
  'left unsent, every targeted prehab was the fresh-injury protocol, identical every time'
);

check(
  'it defaults to sore',
  /useState\(true\);[\s\S]{0,80}?const diagramBudget|const \[prehabSore, setPrehabSore\] = useState\(true\)/.test(
    readiness
  ),
  'too gentle costs a session, too much costs weeks - same default as the Restore sheet'
);

console.log(`\nmulti-region-and-tour: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
