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
 *    When strength test weeks could be switched off, switching them off disabled
 *    everything properly and the copy did not follow: the Program screen counted
 *    down "N sessions until your next strength test", Stats told people to
 *    record a max "in a test week", and the assistant offered a "Test a lift"
 *    button. An app that offers you something it has already disabled is worse
 *    than an app that says nothing.
 *
 *    Test weeks are now retired for everybody, so the same promise is made of
 *    everybody: no line the app can draw mentions a test. Section 5 holds that.
 *    What CANNOT happen underneath is in tests/test-weeks-retired.check.mjs.
 *
 * Run:  npx tsx tests/tour-finale.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { TRAIN_TUTORIAL } from '../lib/train-screen.ts';

const { evaluateBadges } = await import('../lib/badge-engine.ts');
const { BADGE_CATALOG, BADGE_MAP, TOUR_WELCOME_BADGE_ID } = await import('../lib/badges.ts');

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
  // The step that taught this used to be on Home and is now on Train, where
  // the sessions actually are. What has to stay true is that the first-run
  // tour teaches it SOMEWHERE, and says the part that matters: choosing
  // something else costs you nothing.
  'the tour still teaches that nobody is stuck with the session the app picked',
  (() => {
    // Run the cards, do not read them. Train's tour is data in
    // lib/train-screen.ts, so this is the sentence the user gets rather than a
    // line of source that could as easily be the comment explaining it.
    const trainCopy = TRAIN_TUTORIAL.map((s) => `${s.title} ${s.body}`).join(' \n ');
    return (
      /whether you are on a programme or not/.test(trainCopy) &&
      /moves your programme along or sets it back/.test(trainCopy)
    );
  })(),
  'a way out nobody is told about is a way out nobody takes'
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

// ─── 5. Test weeks are retired, and nothing counts down to one ──────────────
console.log('\n[5] Nobody is counted down to a strength test');

/*
 * Sections 5 and 6 used to run lib/test-week-copy.ts: a countdown to the next
 * strength test, two wordings of the Stats hint and the assistant nudge (one
 * for people with tests on and one for people who had declined), and the notice
 * that told somebody what would happen if they switched tests back on.
 *
 * Strength test weeks are retired, that module is deleted, and there is one
 * wording of each piece of copy left. What survives here is the promise those
 * sections were really making, now made of everybody rather than only of the
 * people who had opted out: no line the app can draw mentions a test.
 *
 * The behaviour underneath (nothing can start a test week for any stored
 * frequency, and a migrated state reads never) is held by
 * tests/test-weeks-retired.check.mjs.
 */

const PC = await import('../lib/program-copy.ts');

for (const count of [0, 1, 5, 10, 11, 12, 13, 23, 24, 100]) {
  const msg = PC.programContextMessage(count);
  check(`program line at ${count} sessions says nothing about a test`, !/test/i.test(msg), msg);
}

check(
  'the Stats hint points at the calculator, which is the only route left',
  (() => {
    const stats = read('app/(tabs)/workouts.tsx');
    const hint = stats.match(/One-rep max tracking covers[^<]*/)?.[0] ?? '';
    return hint.length > 0 && !/test week/i.test(hint) && /work one out/i.test(hint);
  })(),
  'the route it used to name, recording one in a test week, no longer exists'
);
check(
  'the assistant stops offering to test a lift',
  (() => {
    const coach = read('lib/coach.ts');
    const nudge = coach.match(/id: 'prompt-1rm'[\s\S]{0,700}?\}\);/)?.[0] ?? '';
    return (
      nudge.length > 0 &&
      /Work one out/.test(nudge) &&
      !/Test a lift/.test(nudge) &&
      !/tested max/i.test(nudge)
    );
  })(),
  'it had two wordings and picked between them on testWeekFrequency; there is one left'
);
check(
  'and the rule no longer reads a test-week frequency at all',
  !/testWeekFrequency/.test(read('lib/coach.ts')),
  'CoachInput carried the field only so this one nudge could branch on it'
);

for (const f of [
  'app/(tabs)/index.tsx',
  'app/assistant.tsx',
  'app/(tabs)/profile.tsx',
  'app/(tabs)/train.tsx',
  'app/readiness.tsx',
]) {
  check(
    `${f} says nothing about a test week`,
    !/\btest\s*week\b/i.test(stripComments(read(f))),
    'every screen that promised or offered one has had that copy removed'
  );
}

// ─── 7. House style ──────────────────────────────────────────────────────────
console.log('\n[7] The new copy follows the same rules as the rest of the app');

const newCopy = [
  ...[0, 1, 2, 5, 7, 9, 11, 12, 18, 27].map((n) => PC.programContextMessage(n)),
  ...[
    { sessionCount: 3, mix: 'Conditioning', weekCount: 1, weeklyGoal: 2, streakWeeks: 0 },
    { sessionCount: 30, mix: 'Mobility', weekCount: 2, weeklyGoal: 2, streakWeeks: 4 },
    { sessionCount: 12, mix: 'Full Body', weekCount: 0, weeklyGoal: 3, streakWeeks: 3 },
  ].map(PC.nonStrengthContextMessage),
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
