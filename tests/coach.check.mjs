/**
 * Contract test: the assistant, and the home screen it declutters.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Reported, with screenshots: "the two advisory messages on the home screen
 * make the page scrollable and messy. We don't want that. We want everything in
 * view."
 *
 * There were not two. There were FIVE, each an independently reasonable card
 * that rendered itself into the same scroll as the session card: a deload
 * banner, a streak-at-risk warning, a calibration progress bar, a bodyweight
 * reminder and a training-balance nudge. Any two showing at once pushed the
 * thing you opened the app to do below the fold.
 *
 * The fix is not fewer messages, it is somewhere else to put them. So this file
 * checks two things: that the rules produce sensible advice, and that none of it
 * can ever render into the home screen's scroll again.
 *
 * Run:  npx tsx tests/coach.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  getCoachMessages,
  hasActionableAdvice,
  MAX_MESSAGES,
  MAX_CAUTIONS,
  weekdayForTrainingWeek,
  PROBLEM_IDS,
} from '../lib/coach.ts';
import {
  biggestLiftGain,
  painPersistence,
  painResolved,
  recentPersonalBest,
  stalledLift,
} from '../lib/coach-insights.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const home = readFileSync(join(__dir, '../app/(tabs)/index.tsx'), 'utf8');
const coachSrc = readFileSync(join(__dir, '../lib/coach.ts'), 'utf8');
const bubble = readFileSync(join(__dir, '../components/CoachBubble.tsx'), 'utf8');

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

const NOW = 1_700_000_000_000;
const base = {
  sessionCount: 10,
  weekCount: 3,
  weeklyGoal: 3,
  streak: 4,
  consecutiveActiveWeeks: 1,
  daysSinceLast: 1,
  weekday: 1,
  bodyweightStale: false,
  balance: { sessionTypes: [], everTrained: [], dismissedAt: null, now: NOW },
  // Everything the panel now reads about the training itself. Empty by default
  // so the existing assertions keep testing exactly what they were written for.
  sessions: [],
  progress: [],
  stuckStreak: {},
  hasOneRepMax: true,
  weightUnit: 'kg',
  dismissedAt: {},
  now: NOW,
};
const ask = (over = {}) => getCoachMessages({ ...base, ...over });
const ids = (msgs) => msgs.map((m) => m.id);

// ─── 1. It always says something ─────────────────────────────────────────────
console.log('\n[1] The panel is never empty');

check('a brand-new user is told to train', ids(ask({ sessionCount: 0 }))[0] === 'first-session', '');
check(
  'and that is the ONLY thing they are told',
  ask({ sessionCount: 0 }).length === 1,
  'everything else needs history, and a panel of "not enough data" teaches you not to open it'
);
check(
  'the panel is never empty',
  ask().length > 0,
  'an assistant that opens to a blank panel is one nobody taps twice'
);
/**
 * The all-clear is the true fallback and it now sits behind the how-it-works
 * notes, which fill a spare slot until they have each been waved away. So the
 * only way to reach it is with nothing to flag AND nothing left to explain.
 */
/**
 * Read off the source rather than hand-listed.
 *
 * A hand-written list goes stale the moment a note is added, and it goes stale
 * QUIETLY: this fixture is the only way to reach the all-clear, so a sixth
 * explainer turns "the all-clear is unreachable" into the failure message,
 * which is a puzzle rather than an instruction. Deriving it means adding a note
 * costs nothing here and removing one still cannot break it.
 */
const EXPLAINER_IDS = [
  ...coachSrc
    .slice(coachSrc.indexOf('const EXPLAINERS'), coachSrc.indexOf('interface Bucket'))
    .matchAll(/id: '([a-z-]+)'/g),
].map((m) => m[1]);
const allExplainersSeen = Object.fromEntries(EXPLAINER_IDS.map((id) => [id, NOW]));
check(
  `every how-it-works note was found (${EXPLAINER_IDS.length})`,
  EXPLAINER_IDS.length >= 5,
  `found: ${EXPLAINER_IDS.join(', ') || 'none'} - if this is empty the all-clear check below proves nothing`
);
check(
  'a user with nothing to flag and nothing left to learn gets the all-clear',
  ids(ask({ dismissedAt: allExplainersSeen })).includes('all-clear'),
  ''
);
check(
  'every message has a title and a body',
  ask().every((m) => m.title.length > 0 && m.body.length > 0),
  ''
);
check(
  `never more than ${MAX_MESSAGES} at once`,
  ask({
    sessionCount: 4,
    weekCount: 0,
    weekday: 5,
    consecutiveActiveWeeks: 6,
    bodyweightStale: true,
    balance: {
      sessionTypes: Array(8).fill('upper_body'),
      everTrained: [...Array(8).fill('upper_body'), 'lower_body'],
      dismissedAt: null,
      now: NOW,
    },
  }).length <= MAX_MESSAGES,
  'three is a briefing; six is a to-do list nobody reads'
);

// ─── 2. Urgency wins ─────────────────────────────────────────────────────────
console.log('\n[2] The most urgent thing is first');

const busy = ask({
  sessionCount: 20,
  weekCount: 0,
  weekday: 5,
  consecutiveActiveWeeks: 6,
  bodyweightStale: true,
});
check('a streak about to break leads', ids(busy)[0] === 'streak-risk', ids(busy).join(', '));
check(
  'a deload is mentioned but does not lead',
  ids(busy).includes('deload') && ids(busy)[0] !== 'deload',
  ''
);
check(
  'nothing is flagged before Wednesday',
  !ids(ask({ weekCount: 0, weekday: 1 })).includes('streak-risk'),
  '"you have not trained this week" on a Monday is not news, it is Monday'
);
check(
  'a user with no streak to lose is not warned about losing it',
  !ids(ask({ streak: 0, weekCount: 0, weekday: 5 })).includes('streak-risk'),
  ''
);

// ─── 3. Calibration ──────────────────────────────────────────────────────────
console.log('\n[3] The first three sessions are explained');

check('session 1 of 3 is explained', ids(ask({ sessionCount: 1 })).includes('calibrating'), '');
check('session 3 is celebrated', ids(ask({ sessionCount: 3 })).includes('calibrated'), '');
check(
  'and not celebrated forever',
  !ids(ask({ sessionCount: 12 })).includes('calibrated'),
  'a milestone that never goes away is wallpaper'
);

// ─── 4. The badge means something ────────────────────────────────────────────
console.log('\n[4] The dot on the button is honest');

check(
  'no dot when there is nothing to act on',
  hasActionableAdvice(ask()) === false,
  'a permanent dot is a dot nobody believes'
);
check(
  'a dot when something needs attention',
  hasActionableAdvice(ask({ bodyweightStale: true })) === true,
  ''
);
check(
  'no dot merely for having finished calibration',
  hasActionableAdvice(ask({ sessionCount: 3 })) === false,
  'good news is not a task'
);

// ─── 5. The home screen cannot grow advisory cards again ─────────────────────
console.log('\n[5] None of it renders into the home scroll');

for (const gone of [
  ['styles.deloadBanner', 'the deload banner'],
  ['styles.calibrationCard', 'the calibration progress bar'],
  ['styles.weightReminderCard', 'the bodyweight reminder card'],
  ['testID="balance-nudge"', 'the training-balance card'],
]) {
  check(`${gone[1]} is gone from the home screen`, !home.includes(gone[0]), '');
}
check(
  'the assistant button is in the header',
  /<CoachButton/.test(home),
  ''
);
check(
  'the bubble is rendered OUTSIDE the ScrollView',
  home.indexOf('</ScrollView>') < home.indexOf('<CoachBubble'),
  'inside it, the advice would add to the page height — which is the entire thing being fixed'
);

// ─── 6. It cannot freeze the app ─────────────────────────────────────────────
console.log('\n[6] The bubble is not a native modal');

// Two native Modals presented at once break touch routing on both and the whole
// app reads as frozen. This app has shipped that bug twice.
check(
  'CoachBubble does not import Modal',
  !/\bModal\b/.test(bubble),
  'an absolutely-positioned View in the screen own tree cannot collide with anything'
);
check(
  'it closes on a tap anywhere outside',
  /StyleSheet\.absoluteFill/.test(bubble) && /onPress=\{onClose\}/.test(bubble),
  'no way out of an overlay is the other half of how an app reads as frozen'
);

// ─── The assistant talks about training, not only attendance ─────────────────
console.log('\n[7] It has something to say about the training itself');

/**
 * THE MEASUREMENT THAT FORCED THIS.
 *
 * Run over sixteen weeks of a user who trains three times a week and never
 * misses, the old panel said "You're all set", then "Nothing to flag" twice,
 * then "N weeks without a break" - with a lit notification dot - every single
 * time, forever. Four distinct messages across four months, and the best
 * possible user got a permanent nag. Seven messages existed in total and every
 * one was about consistency or admin.
 *
 * These build the same history the store keeps and assert the panel now reads
 * it. The helpers below mirror lib/store.ts getAllExerciseProgress: appearances
 * oldest first, sessions newest first.
 */
const DAY = 86400000;
const lift = (name, id, weights, opts = {}) => ({
  exerciseId: id,
  exerciseName: name,
  sessionType: 'squat',
  appearances: weights.map((kg, i) => ({
    date: new Date(NOW - (weights.length - 1 - i) * 3 * DAY).toISOString(),
    bestSetWeight: kg,
    avgWorkingWeight: kg,
  })),
  ...opts,
});
const session = (daysAgo, over = {}) => ({
  id: 's' + daysAgo,
  sessionType: 'squat',
  date: new Date(NOW - daysAgo * DAY).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  painRegions: [],
  energy: 'normal',
  timeAvailable: '60',
  exerciseCount: 5,
  exerciseLogs: [],
  ...over,
});

// A lift that has genuinely moved, measured from the fourth session on.
const climbing = lift('Back Squat', 'sq', [60, 62.5, 65, 67.5, 75, 82.5]);

check(
  'a lift that has moved is worth a message',
  ids(ask({ progress: [climbing] })).includes('lift-gain'),
  'the app auto-progresses the load, so the user may never notice how much stronger they got'
);
check(
  'measured from the fourth session, not the first',
  biggestLiftGain([climbing]).fromKg === 67.5,
  'the first three sessions are estimates from a questionnaire - measuring from them reports the app correcting its own guess as if it were progress'
);
check(
  'a trivial gain is not worth a message',
  biggestLiftGain([lift('Curl', 'c', [20, 20, 20, 20, 21.25])]) === null,
  'on linear progression a lift moves every session; without a floor the panel says "up 1.25 kg" forever'
);

check(
  'a weight beaten is worth a message',
  ids(ask({ progress: [climbing] })).includes('personal-best'),
  ''
);
check(
  'and an old personal best is not',
  recentPersonalBest([lift('Back Squat', 'sq', [60, 65, 70])], NOW + 60 * DAY) === null,
  'a best set two months ago is history, not news'
);

check(
  'a stalled lift says what the app is about to do about it',
  (() => {
    const m = ask({
      progress: [lift('Bench', 'bp', [60, 60, 60, 60])],
      stuckStreak: { bp: 2 },
    }).find((x) => x.id === 'stall');
    return !!m && /10%/.test(m.body);
  })(),
  'an automatic 10% drop that arrives unannounced is indistinguishable from a bug'
);

console.log('\n[8] Pain is an episode, not a count');

// Flagged in five of the last ten sessions, running for two months.
const kneeSessions = [];
for (let i = 0; i < 20; i++) {
  kneeSessions.push(
    session(i * 3, i % 2 === 0 ? { hadAches: true, painRegions: ['knee'] } : {})
  );
}

check(
  'a complaint that keeps coming back is said out loud',
  ids(ask({ sessions: kneeSessions })).includes('pain-persist'),
  'the Stats screen already did this analysis and the assistant could not see any of it'
);
check(
  'two sore sessions out of ten is a niggle, not a pattern',
  (() => {
    const rare = [];
    // Three sore sessions out of ten, spread over five weeks. As a share that
    // is 0.3 and below the bar. As a raw count it is 3, which clears any
    // threshold written as a share and fires on a niggle.
    for (let i = 0; i < 12; i++)
      rare.push(session(i * 4, i === 0 || i === 5 || i === 9 ? { hadAches: true, painRegions: ['knee'] } : {}));
    return painPersistence(rare, NOW) === null;
  })(),
  'counting rather than sharing fires on anybody who has ever tapped a region twice'
);
check(
  'and it reports a share of sessions, not a raw count',
  (() => {
    const e = painPersistence(kneeSessions, NOW);
    return !!e && e.of === 10 && e.flagged <= e.of;
  })(),
  'a raw count rises simply because somebody trained more, which is how a fortnight away reads as "worsening"'
);
check(
  'the duration is measured over the whole history, not inside the window',
  (() => {
    const e = painPersistence(kneeSessions, NOW);
    // Ten sessions at three-day spacing is about four weeks. The complaint has
    // been running for two months and the message has to say two months.
    return !!e && e.weeksRunning >= 6;
  })(),
  'the first version measured the width of its own window, so "has this run three weeks" was false however long it had really run'
);
check(
  'it says who to ask and does not diagnose',
  (() => {
    const m = ask({ sessions: kneeSessions }).find((x) => x.id === 'pain-persist');
    return !!m && /looked at by someone/.test(m.body) && !/injur|strain|tear|diagnos/i.test(m.body);
  })(),
  'reporting what was tapped is the app\'s job; saying what it is is not'
);
check(
  'and it can be waved away',
  (() => {
    const m = ask({ sessions: kneeSessions }).find((x) => x.id === 'pain-persist');
    return !!m && m.dismissible === true;
  })(),
  'a chronic complaint with no dismiss is a lit dot for the rest of the user\'s life'
);
check(
  'a complaint that settled and came back is a new episode, not a nine-month one',
  (() => {
    const old = [];
    // Sore recently...
    for (let i = 0; i < 14; i++)
      old.push(session(i * 3, i % 2 === 0 ? { hadAches: true, painRegions: ['knee'] } : {}));
    // ...nothing for four months...
    for (let i = 0; i < 6; i++) old.push(session(60 + i * 5));
    // ...and sore back then too.
    for (let i = 0; i < 8; i++)
      old.push(session(140 + i * 3, { hadAches: true, painRegions: ['knee'] }));
    const e = painPersistence(old, NOW);
    return !!e && e.weeksRunning < 8;
  })(),
  'a knee that hurt last spring, settled, and is sore again this month has a two-week complaint'
);
check(
  'a complaint that settled is worth saying too',
  (() => {
    const settled = [];
    // Six clear sessions is about a fortnight at three a week, which is the
    // bar: four clear sessions can be nine days, and nine days quiet is not a
    // complaint that has settled.
    for (let i = 0; i < 6; i++) settled.push(session(i * 3));
    for (let i = 6; i < 14; i++)
      settled.push(session(i * 3, { hadAches: true, painRegions: ['knee'] }));
    return ids(ask({ sessions: settled })).includes('pain-resolved');
  })(),
  'an app that only speaks up when something is wrong is one people learn to dread'
);

console.log('\n[9] The panel never opens onto three problems');

const everythingWrong = {
  sessions: kneeSessions,
  daysSinceLast: 30,
  streak: 5,
  weekCount: 0,
  weekday: 5,
  progress: [lift('Bench', 'bp', [60, 60, 60, 60])],
  stuckStreak: { bp: 2 },
  bodyweightStale: true,
};
check(
  `at most ${MAX_CAUTIONS} problems at once`,
  ask(everythingWrong).filter((m) => PROBLEM_IDS.includes(m.id)).length <= MAX_CAUTIONS,
  'opening a panel onto three things you have done wrong is how people stop opening it'
);
check(
  'praise does not light the notification dot',
  hasActionableAdvice(ask({ progress: [climbing] })) === false,
  'a dot that lights up to say your squat went up is a dot you stop believing'
);
check(
  'but a complaint that will not settle does',
  hasActionableAdvice(ask({ sessions: kneeSessions })) === true,
  ''
);

console.log('\n[10] It explains itself, occasionally');

check(
  'a how-it-works note fills a spare slot',
  ask().some((m) => m.id.startsWith('how-')),
  'an app that silently changes your weights is one people assume is broken'
);
check(
  'they rotate rather than repeating',
  (() => {
    const seen = new Set();
    for (let n = 4; n < 12; n++) {
      const m = ask({ sessionCount: n }).find((x) => x.id.startsWith('how-'));
      if (m) seen.add(m.id);
    }
    return seen.size >= 3;
  })(),
  ''
);
check(
  'and each can be waved away for good',
  ask().filter((m) => m.id.startsWith('how-')).every((m) => m.dismissible === true),
  'how it works is not news twice'
);
check(
  'a note that was dismissed stays gone',
  !ids(ask({ dismissedAt: { 'how-load': NOW - DAY } })).includes('how-load'),
  ''
);
check(
  'and the deload suggestion is dismissible now',
  (() => {
    const m = ask({ consecutiveActiveWeeks: 8, sessionCount: 30 }).find((x) => x.id === 'deload');
    return !!m && m.dismissible === true;
  })(),
  'the counter behind it caps at eight and never resets, so before this it was permanent wallpaper with a lit dot'
);
check(
  'and it does not light the dot',
  !hasActionableAdvice(ask({ consecutiveActiveWeeks: 8, sessionCount: 30 })),
  'advice somebody is free to ignore forever must not hold the dot open forever'
);

console.log('\n[11] The training week runs Monday to Sunday');

check(
  'Sunday is day 7, not day 0',
  weekdayForTrainingWeek(new Date('2026-08-23T12:00:00')) === 7 &&
    weekdayForTrainingWeek(new Date('2026-08-24T12:00:00')) === 1,
  'the raw getDay() numbering hid the streak warning on the single last day it could be acted on'
);
check(
  'so the streak warning is still shown on Sunday',
  ids(ask({ weekday: 7, streak: 4, weekCount: 1, weeklyGoal: 3 })).includes('streak-risk'),
  ''
);
check(
  'and still hidden on Monday',
  !ids(ask({ weekday: 1, streak: 4, weekCount: 0, weeklyGoal: 3 })).includes('streak-risk'),
  '"you have not trained this week" on a Monday is not news, it is Monday'
);
check(
  'the home screen does not compare a raw getDay() against a weekday',
  !/getDay\(\)\s*>=/.test(readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8')),
  'a duplicated day-of-week rule is a duplicated bug, and this is the one that hid the warning on Sunday'
);
check(
  'both callers use the shared helper',
  readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8').includes(
    'weekdayForTrainingWeek(new Date())'
  ),
  'a duplicated day-of-week rule is a duplicated bug'
);

console.log('');
if (failures > 0) {
  console.error(`coach: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`coach: all ${total} checks passed\n`);
  process.exitCode = 0;
}
