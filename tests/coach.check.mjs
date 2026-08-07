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
import { getCoachMessages, hasActionableAdvice, MAX_MESSAGES } from '../lib/coach.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const home = readFileSync(join(__dir, '../app/(tabs)/index.tsx'), 'utf8');
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
  'a user with nothing to flag still gets a message',
  ids(ask()).includes('all-clear'),
  'an assistant that opens to a blank panel is one nobody taps twice'
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

console.log('');
if (failures > 0) {
  console.error(`coach: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`coach: all ${total} checks passed\n`);
  process.exit(0);
}
