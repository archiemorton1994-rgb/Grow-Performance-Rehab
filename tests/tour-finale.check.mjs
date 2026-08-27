/**
 * Contract test: the tour ends with something that happens TO the user, and
 * the app stops telling people about a strength test they turned off.
 *
 * TWO THINGS THIS FILE EXISTS TO PIN
 * ─────────────────────────────────
 *
 * 1. THE WELCOME BADGE HAD NEVER BEEN AWARDED TO ANYBODY.
 *
 *    lib/badges.ts carries onboarding_complete, "Welcome Aboard", the only badge
 *    in the catalogue not earned by training. lib/badge-engine.ts awards it on
 *    state.tourGenuinelyCompleted, and that works - section 1 runs the engine
 *    and proves it.
 *
 *    Nothing ever set the flag. markTourGenuinelyCompleted had exactly one call
 *    site, inside the isDemo branch of handleComplete in app/session.tsx, and
 *    that branch is unreachable: handleComplete only arrives there as
 *    onCompleteSession, whose button renders solely when every set of every
 *    exercise is marked complete, and demo mode hard-codes every set mutator to
 *    a no-op. The practice session's real ending goes through advanceTut into
 *    the demo-complete modal, whose button navigated away without awarding
 *    anything.
 *
 *    A finished, catalogued, artworked badge that no user could earn, and no
 *    test noticed, because every test asked whether the ENGINE would award it.
 *
 * 2. FOUR SCREENS COUNTED DOWN TO A TEST THAT WILL NEVER ARRIVE.
 *
 *    testWeekFrequency 'never' correctly disables everything: getTestWeekProgress
 *    short-circuits and isTestWeekDue is permanently false. The copy did not
 *    follow. The Program screen aliases 'never' to 12 so its arc dots have
 *    something to draw, then fed that number into "N sessions until your next
 *    strength test". Stats told them to record a max "in a test week". The
 *    assistant offered them a "Test a lift" button.
 *
 *    An app that offers you something it has already disabled is worse than an
 *    app that says nothing.
 *
 * Run:  npx tsx tests/tour-finale.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';

const { evaluateBadges } = await import('../lib/badge-engine.ts');
const { BADGE_CATALOG, BADGE_MAP, TOUR_WELCOME_BADGE_ID } = await import('../lib/badges.ts');
const TW = await import('../lib/test-week-copy.ts');

let failures = 0;
let total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const session = stripComments(read('app/session.tsx'));
const home = read('app/(tabs)/index.tsx');
const homeCode = stripComments(home);
const rootLayout = stripComments(read('app/_layout.tsx'));
const sheet = stripComments(read('components/AchievementUnlockedSheet.tsx'));
const achievements = stripComments(read('app/achievements.tsx'));
const store = stripComments(read('lib/store.ts'));

// ─── 1. The badge exists, and the engine really awards it ────────────────────
console.log('\n[1] Welcome Aboard is a real, winnable badge');

const BASE = {
  completedSessions: [],
  oneRepMaxes: [],
  userProfile: null,
  profilePhotoUri: null,
  equipmentTiers: [],
  bodyweightUpdatedAt: null,
  onboardingComplete: true,
  tourGenuinelyCompleted: false,
  weeklyStreakGoal: 2,
};

check(
  'the badge is in the catalogue',
  !!BADGE_MAP.get(TOUR_WELCOME_BADGE_ID),
  `${TOUR_WELCOME_BADGE_ID} is not a real badge id`
);
check(
  'finishing the tour earns it, with no sessions logged at all',
  evaluateBadges({ ...BASE, tourGenuinelyCompleted: true }).includes(TOUR_WELCOME_BADGE_ID),
  'this is the one badge that is not a training reward'
);
check(
  'and not finishing it earns nothing',
  evaluateBadges(BASE).length === 0,
  'a first-run user with no history must not be handed anything'
);
check(
  'it is still the ONLY badge awarded without training',
  evaluateBadges({ ...BASE, tourGenuinelyCompleted: true }).length === 1,
  'badges are a training reward plus this one welcome badge'
);
check(
  'its description matches what now earns it',
  /tour/i.test(BADGE_MAP.get(TOUR_WELCOME_BADGE_ID)?.description ?? ''),
  BADGE_MAP.get(TOUR_WELCOME_BADGE_ID)?.description
);

// ─── 2. The award is on a control a user can actually reach ──────────────────
console.log('\n[2] The award sits on a button, not behind a condition demo mode cannot meet');

const awardSites = [...session.matchAll(/markTourGenuinelyCompleted\(\)/g)].length;
check(
  `markTourGenuinelyCompleted is called ${awardSites} time(s) in the session screen`,
  awardSites >= 1,
  'no award site at all'
);
check(
  'the demo-complete modal is one of them',
  /testID="demo-complete-continue"[\s\S]{0,400}?markTourGenuinelyCompleted\(\)/.test(session),
  'this modal is the only ending the practice session actually has - see advanceTut'
);
/**
 * THE ORDER MATTERS AND IS NOT OBVIOUS.
 *
 * The root layout only presents an unlock while segments[0] === '(tabs)'. Award
 * after the navigation and the queue is populated on a screen that cannot show
 * it; the badge is recorded but the celebration never happens, and the queue is
 * deliberately not persisted, so it is gone.
 */
const modalBlock = session.slice(
  session.indexOf('testID="demo-complete-continue"'),
  session.indexOf('testID="demo-complete-continue"') + 600
);
check(
  'the badge is awarded BEFORE the navigation into the tabs',
  modalBlock.indexOf('markTourGenuinelyCompleted()') <
    modalBlock.indexOf("router.replace((isShowcase ? '/offer'"),
  'the root layout will only present an unlock inside (tabs), so a badge queued after the navigate has nowhere to land'
);
check(
  'the showcase branch does not award it',
  /if \(!isShowcase\) markTourGenuinelyCompleted\(\)/.test(session),
  'the showcase practice session runs before anybody has subscribed and is not the tour'
);
check(
  'skipping the practice session does not award it',
  !/skipTut[\s\S]{0,400}?markTourGenuinelyCompleted/.test(session),
  'the badge says "start to finish"'
);
check(
  'the award action re-runs the badge engine rather than writing the list itself',
  /markTourGenuinelyCompleted: \(\) => \{\s*set\(\{ tourGenuinelyCompleted: true \}\);\s*get\(\)\.awardNewBadges\(\);/.test(
    store
  ),
  'awardNewBadges is the only supported writer of earnedBadges'
);

// ─── 3. The unlock leads into the achievements space ─────────────────────────
console.log('\n[3] The tour ends by showing the shelf the badge landed on');

check(
  'the unlock sheet takes a destination for "View all badges"',
  /viewAllHref\?: string;/.test(sheet) && /viewAllHref = '\/achievements'/.test(sheet),
  'and it defaults to the plain screen'
);
check(
  'and uses it rather than a hardcoded route',
  /router\.push\(viewAllHref as never\)/.test(sheet),
  ''
);
check(
  'the welcome badge is pointed at the achievements explainer',
  /currentToast\.id === TOUR_WELCOME_BADGE_ID[\s\S]{0,80}\/achievements\?tour=1/.test(rootLayout),
  'this is the last beat of the tour'
);
check(
  'every other unlock goes to the plain screen',
  /: '\/achievements'/.test(rootLayout),
  'somebody on their fifth streak badge does not need to be told what a shelf is'
);
check(
  'the achievements screen reads that parameter',
  /const isTourMode = params\.tour === '1';/.test(achievements) &&
    /tourOverlayVisible && <TourCallout/.test(achievements),
  'the overlay was written, styled and reviewed, and until now nothing in the repo navigated to it'
);
check(
  'the id is named once rather than spelled out at each site',
  /export const TOUR_WELCOME_BADGE_ID/.test(read('lib/badges.ts')) &&
    /TOUR_WELCOME_BADGE_ID/.test(read('lib/badge-engine.ts')),
  'the engine, the award site and the comparison must not drift'
);

// ─── 4. Home: a way out, and the tour points at it ───────────────────────────
console.log('\n[4] Nobody is stuck with the session the app picked');

check(
  'the button exists in BOTH hero branches',
  (homeCode.match(/testID="home-train-something-else"/g) ?? []).length === 2,
  'the hero card is either the first-session chooser or the today card, never both. One copy means it is missing for exactly the user the tour is running for'
);
check(
  'it opens the Train tab',
  /handleTrainSomethingElse = useCallback\(\(\) => \{[\s\S]{0,200}?router\.push\('\/\(tabs\)\/train'\)/.test(
    homeCode
  ),
  ''
);
check(
  'the wrapper carries collapsable={false}',
  (homeCode.match(/ref=\{trainElseRef\} collapsable=\{false\}/g) ?? []).length === 2,
  'without it Android flattens the view, measureInWindow returns 0x0, and the spotlight silently points at nothing'
);
check(
  'the tour has a step for it',
  /spotlightRef: 'trainElse'/.test(homeCode),
  ''
);
check(
  'and a step for achievements',
  /spotlightRef: 'achievements'/.test(homeCode),
  'they were cut from the tour as "badges nobody has earned"; the tour now awards one'
);
check(
  'the achievements tile can be measured',
  /ref=\{achievementsTileRef\}\s*\n?\s*collapsable=\{false\}/.test(homeCode),
  ''
);
check(
  'the first card no longer promises a Start button to a user who has none',
  !/Tap Start and the whole session gets built/.test(homeCode),
  'sessionCardRef wraps a conditional, and a brand-new user is looking at the chooser'
);

// ─── 5. Test weeks: nothing is offered to somebody who declined ──────────────
console.log('\n[5] An opted-out user is never counted down to a test');

check(
  'the countdown is null when tests are off',
  TW.sessionsUntilTest('never', 11) === null && TW.sessionsUntilTest('never', 0) === null,
  ''
);
check(
  'and a real number when they are on',
  TW.sessionsUntilTest(12, 5) === 7 && TW.sessionsUntilTest(18, 5) === 13,
  ''
);
check(
  'a count sitting exactly on a multiple reads as due, not as a full cycle away',
  TW.sessionsUntilTest(12, 12) === 0 && TW.sessionsUntilTest(12, 24) === 0,
  'the old arithmetic was n - (count % n), which at a multiple gives n: it said "12 until test" on the session the test was due'
);
check(
  'a brand-new user is a full cycle away',
  TW.sessionsUntilTest(12, 0) === 12,
  ''
);

for (const count of [0, 1, 5, 10, 11, 12, 13, 23, 24, 100]) {
  const msg = TW.programContextMessage('never', count, false);
  check(
    `program line at ${count} sessions says nothing about a test`,
    !/test/i.test(msg),
    msg
  );
}
check(
  'even when something upstream claims a test is due',
  !/test/i.test(TW.programContextMessage('never', 12, true)),
  'testWeekDue cannot be true for an opted-out user, but the copy must not depend on that being got right elsewhere'
);
check(
  'an opted-in user two sessions out still gets the countdown',
  /2 sessions until your next strength test/.test(TW.programContextMessage(12, 10, false)),
  'the fix must not silence the message for the people it is for'
);
check(
  'and one session out reads as singular',
  /1 session until/.test(TW.programContextMessage(12, 11, false)),
  ''
);
check(
  'a due test is announced',
  /Test week is here/.test(TW.programContextMessage(12, 12, true)),
  ''
);

check(
  'the Stats hint drops the test-week route when tests are off',
  !/test week/i.test(TW.noOneRepMaxHint('never')) && /work one out/i.test(TW.noOneRepMaxHint('never')),
  'the manual calculator directly below that text works either way'
);
check(
  'and keeps it when they are on',
  /test week/i.test(TW.noOneRepMaxHint(12)),
  ''
);
check(
  'the assistant stops offering to test a lift',
  !/test/i.test(TW.noMaxAssistantCopy('never').actionLabel) &&
    !/tested max/i.test(TW.noMaxAssistantCopy('never').body),
  JSON.stringify(TW.noMaxAssistantCopy('never'))
);
check(
  'and still offers it to everyone else',
  /Test a lift/.test(TW.noMaxAssistantCopy(12).actionLabel),
  ''
);
check(
  'the assistant rule reads the frequency at all',
  /testWeekFrequency: TestWeekFrequency;/.test(read('lib/coach.ts')),
  'CoachInput carried no such field, which is why the rule could not know'
);
for (const f of ['app/(tabs)/index.tsx', 'app/assistant.tsx']) {
  check(
    `${f} passes it in`,
    /hasOneRepMax: oneRepMaxes\.length > 0,\s*\r?\n\s*testWeekFrequency,/.test(read(f)),
    'both call sites build their own CoachInput'
  );
}

// ─── 6. Turning tests back on is a path, not a switch ────────────────────────
console.log('\n[6] The way back in says what will happen');

check(
  'nothing is said to somebody who has tests off',
  TW.nextTestNotice('never', 5, false) === null,
  'the notice must not appear as a nag on the setting they just declined'
);
check(
  'an outstanding postponement is called out',
  /next strength session will be a test/.test(TW.nextTestNotice(12, 5, true) ?? ''),
  'this is the trap: testWeekDeferred survives being switched off, so turning tests back on could hand somebody a max attempt immediately'
);
check(
  'so is landing exactly on a multiple',
  /next strength session will be a test/.test(TW.nextTestNotice(12, 24, false) ?? ''),
  ''
);
check(
  'otherwise it counts',
  /7 strength sessions away/.test(TW.nextTestNotice(12, 5, false) ?? ''),
  ''
);
check(
  'and reads properly at one to go',
  /last one before a test week/.test(TW.nextTestNotice(12, 11, false) ?? ''),
  ''
);
check(
  'turning tests ON clears a stale postponement',
  /testWeekDeferred: freq === 'never' \? s\.testWeekDeferred : false/.test(store),
  'postpone a test, switch tests off, switch them back on months later: without this the very next strength session is an all-out max with no warning'
);
check(
  'turning them OFF leaves it alone',
  /freq === 'never' \? s\.testWeekDeferred/.test(store),
  'nothing is scheduled while off anyway, and clearing it would lose a deferral for anyone toggling twice'
);
check(
  'the settings screen shows the notice',
  /testID="next-test-notice"/.test(read('app/(tabs)/profile.tsx')),
  'the only feedback used to be the segmented button highlighting'
);
check(
  'and the row that leads there names the setting',
  /strength tests/.test(read('app/(tabs)/profile.tsx')),
  'Settings listed six rows, none of which said strength, test or 1RM'
);

// ─── 7. House style ──────────────────────────────────────────────────────────
console.log('\n[7] The new copy follows the same rules as the rest of the app');

const newCopy = [
  ...[0, 1, 5, 11, 12].flatMap((n) => [
    TW.programContextMessage(12, n, false),
    TW.programContextMessage('never', n, false),
  ]),
  TW.noOneRepMaxHint('never'),
  TW.noOneRepMaxHint(12),
  ...Object.values(TW.noMaxAssistantCopy('never')),
  ...Object.values(TW.noMaxAssistantCopy(12)),
  TW.nextTestNotice(12, 5, false),
  TW.nextTestNotice(12, 11, false),
  TW.nextTestNotice(12, 5, true),
  ...[...homeCode.matchAll(/\btitle: '([^']{8,})'|\bbody: '([^']{8,})'/g)].map(
    (m) => m[1] ?? m[2]
  ),
].filter(Boolean);

check(
  `collected ${newCopy.length} strings to check`,
  newCopy.length >= 20,
  'the parse has gone stale and the rules below are testing nothing'
);
const offenders = newCopy.filter((v) => /—|–|―|--/.test(v));
check('no long dash and no double hyphen', offenders.length === 0, offenders.join(' | '));
const emoji = newCopy.filter((v) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(v));
check('no emoji', emoji.length === 0, emoji.join(' | '));

console.log('');
if (failures > 0) {
  console.error(`tour-finale: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`tour-finale: all ${total} checks passed\n`);
  process.exitCode = 0;
}
