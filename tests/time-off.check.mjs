/**
 * Contract test: the app knows how long you have been away.
 *
 * WHAT WAS WRONG
 * ──────────────
 * The load calculation had no concept of elapsed time anywhere in it. Neither
 * generateWorkout nor personalizeLoad took a date. Eight strong squat sessions
 * built a working weight of 80 kg, and coming back the next day, after 38 days
 * and after 368 days produced the byte-identical prescription. The app knew the
 * gap perfectly well — the streak reset, the bodyweight reminder fired — the
 * number simply never reached the weight.
 *
 * Worse than the weight: someone who stopped at session 11 and came back a
 * month later walked straight into a max-effort 1RM test, because tests fire on
 * a session count and a session count does not know what a month is.
 *
 * WHAT THIS FILE PROTECTS
 * ───────────────────────
 * Four properties, and they pull against each other on purpose:
 *
 *   BACKS OFF     time away must cost load, on a curve, not a cliff
 *   COMES BACK    and must stop costing it the moment training resumes, or the
 *                 app would fight its own progression forever after one holiday
 *   NEVER HEAVIER falling back to a fresh estimate must never prescribe MORE
 *                 than the weight the person actually walked away from
 *   SAYS SO       a silent adjustment is indistinguishable from a bug. Whenever
 *                 the load moves for this reason, the app has to say why.
 *
 * Run:  npx tsx tests/time-off.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import {
  COMEBACK_SESSIONS,
  LAYOFF_GRACE_DAYS,
  LAYOFF_RESET_DAYS,
  describeTimeAway,
  generateWorkout,
  getLayoff,
  getReturnWindow,
  layoffFactor,
  setLastTrainedDate,
  wholeDaysBetween,
} from '../lib/workout-engine.ts';
import { getLayoffMessage, getCoachMessages } from '../lib/coach.ts';
import { useAppStore } from '../lib/store.ts';

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

const PROFILE = {
  name: 'Test',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['strength'],
  bodyweightKg: 85,
};
const READINESS = { hasAches: false, energy: 'normal', timeAvailable: '60' };
/** The squat KPI lift at full-gym tier — the id progression is keyed on. */
const SQUAT_ID = 'sq-main-fg';
const LAST_LOGGED = { [SQUAT_ID]: 80 };
const NORMAL = { [SQUAT_ID]: 'normal' };

/** The main lift of a squat session generated `days` after the last one. */
function squatMain(days, { ormKg, lastLogged = LAST_LOGGED, strengthCount = 8 } = {}) {
  const session = generateWorkout(
    'squat',
    'fullgym',
    READINESS,
    PROFILE,
    {},
    ormKg,
    strengthCount,
    lastLogged,
    {},
    NORMAL,
    days
  );
  return session.find((e) => e.category === 'main');
}

// ─── 1. The curve ────────────────────────────────────────────────────────────
console.log('\n[1] Time away costs load, on a curve');

check(
  'no history means no adjustment',
  layoffFactor(null) === 1,
  'a brand-new user has not been away from anything'
);
check(
  `nothing changes inside ${LAYOFF_GRACE_DAYS} days`,
  [0, 1, 5, LAYOFF_GRACE_DAYS].every((d) => layoffFactor(d) === 1),
  'missing a week is life happening, not detraining'
);
check(
  'roughly 90% at three weeks',
  Math.abs(layoffFactor(21) - 0.9) < 0.02,
  `got ${layoffFactor(21).toFixed(3)}`
);
check(
  'between 75% and 80% at five weeks',
  layoffFactor(35) >= 0.75 && layoffFactor(35) <= 0.8,
  `got ${layoffFactor(35).toFixed(3)}`
);
check(
  'never increases as time away grows',
  Array.from({ length: 400 }, (_, d) => layoffFactor(d)).every((f, i, a) => i === 0 || f <= a[i - 1]),
  'a longer break can never justify a heavier bar'
);
check(
  'never falls off a cliff between one day and the next',
  Array.from({ length: 400 }, (_, d) => layoffFactor(d)).every(
    (f, i, a) => i === 0 || a[i - 1] - f < 0.02
  ),
  'a step change means someone gets a wildly different session for waiting one more day'
);
check(
  'stays within sane bounds forever',
  [1, 90, 365, 3650].every((d) => layoffFactor(d) > 0.5 && layoffFactor(d) <= 1),
  'a factor of 0 would prescribe an empty bar'
);
check(
  `past ${LAYOFF_RESET_DAYS} days the history is declared stale`,
  getLayoff(LAYOFF_RESET_DAYS).reset === true && getLayoff(LAYOFF_RESET_DAYS - 1).reset === false,
  ''
);

// ─── 2. It reaches the weight ────────────────────────────────────────────────
console.log('\n[2] The curve actually reaches the prescription');

const sameDay = squatMain(0).loadKg[0];
const after38 = squatMain(38).loadKg[0];
const after368 = squatMain(368).loadKg[0];
check(
  'a month away prescribes less than the next day would',
  after38 < sameDay,
  `${after38} kg vs ${sameDay} kg — this is the audit's byte-identical finding`
);
check(
  'a year away prescribes less again',
  after368 < after38,
  `${after368} kg vs ${after38} kg`
);
check(
  'the weight moves gradually, not in one jump',
  new Set([11, 21, 35, 60].map((d) => squatMain(d).loadKg[0])).size >= 3,
  'four points on the curve should not collapse to one or two weights'
);
check(
  'accessories are eased back too, not just the main lift',
  (() => {
    const acc = (d) =>
      generateWorkout('squat', 'fullgym', READINESS, PROFILE, {}, undefined, 8, {}, {}, {}, d)
        .filter((e) => e.category === 'accessory' && e.loadKg?.length)
        .map((e) => e.loadKg[0]);
    const fresh = acc(0);
    const rusty = acc(40);
    return fresh.length > 0 && rusty.length > 0 && rusty.some((kg, i) => kg < fresh[i]);
  })(),
  'a body that lost tolerance lost it everywhere, not only under the bar'
);

// ─── 3. It stops as soon as they are back ────────────────────────────────────
console.log('\n[3] It does not fight the normal progression once training resumes');

const comeback = squatMain(40).loadKg[0];
const dayAfter = squatMain(1, { lastLogged: { [SQUAT_ID]: comeback }, strengthCount: 9 });
check(
  'the session after the comeback progresses normally again',
  dayAfter.loadKg[0] > comeback,
  `${dayAfter.loadKg[0]} kg vs the ${comeback} kg just logged`
);
check(
  'and goes back to explaining itself as progression',
  /nudged up|bumped up/i.test(dayAfter.progressionNote ?? ''),
  `got "${dayAfter.progressionNote}"`
);

// ─── 4. A fresh estimate is never a heavier one ──────────────────────────────
console.log('\n[4] Falling back to a fresh estimate never raises the weight');

// A 1RM tested before the break is still the best one on file. 85% of 180 kg is
// 153 kg — far more than the 80 kg this person actually last squatted.
const stale = squatMain(200, { ormKg: 180 });
check(
  'a stale 1RM cannot outrank the weight they walked away from',
  stale.loadKg[0] <= 80,
  `prescribed ${stale.loadKg[0]} kg after 200 days off, having last squatted 80 kg`
);
check(
  'and the cut is a real one, not a token',
  stale.loadKg[0] <= 80 * 0.7,
  `prescribed ${stale.loadKg[0]} kg`
);
check(
  'crossing the reset boundary does not bounce the weight upward',
  squatMain(LAYOFF_RESET_DAYS, { ormKg: 180 }).loadKg[0] <=
    squatMain(LAYOFF_RESET_DAYS - 1, { ormKg: 180 }).loadKg[0],
  'one more day off must not be rewarded with more weight'
);

// ─── 5. The user is told ─────────────────────────────────────────────────────
console.log('\n[5] Nothing is adjusted silently');

for (const days of [11, 21, 40, 200]) {
  const main = squatMain(days);
  check(
    `${days} days: the card says why the weight moved`,
    !!main.progressionNote && /eased back|starting fresh/i.test(main.progressionNote),
    `got "${main.progressionNote}"`
  );
  check(
    `${days} days: it never claims to have raised the weight`,
    !/up\b/i.test(main.progressionNote ?? ''),
    `got "${main.progressionNote}" beside a REDUCED weight`
  );
}
check(
  'the assistant raises it too',
  getCoachMessages({
    sessionCount: 11,
    weekCount: 0,
    weeklyGoal: 2,
    streak: 0,
    consecutiveActiveWeeks: 0,
    daysSinceLast: 35,
    weekday: 3,
    bodyweightStale: false,
    balance: { sessionTypes: [], everTrained: [], dismissedAt: null, now: Date.now() },
  }).some((m) => m.id === 'layoff'),
  ''
);
check(
  'and says nothing when there has been no break',
  getLayoffMessage(3) === null && getLayoffMessage(null) === null,
  'a message that fires for everyone is a message nobody reads'
);
check(
  'the readiness screen shows the same message, not its own wording',
  /getLayoffMessage/.test(
    readFileSync(new URL('../app/readiness.tsx', import.meta.url), 'utf8')
  ),
  'two surfaces inventing their own copy is how they end up contradicting each other'
);
check(
  'a small cut is described in words rather than a meaningless percentage',
  !/\d+%/.test(getLayoffMessage(11).body) && /\d+%/.test(getLayoffMessage(35).body),
  '"about 99% of where you left off" reads like a rounding error'
);

// ─── 6. No test week off the back of a layoff ────────────────────────────────
console.log('\n[6] Nobody is walked into a max-effort test straight off a break');

const day = (n) => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString();
const NOW = Date.parse(day(200));

check(
  'someone training steadily has no comeback in play',
  getReturnWindow([day(199), day(197), day(195)], [day(199), day(197), day(195)], NOW) === null,
  ''
);
check(
  'someone away right now has zero sessions back',
  getReturnWindow([day(160)], [day(160)], NOW)?.sessionsBack === 0,
  'the next thing they log is their first session back'
);
check(
  'the break is measured across all training, not only barbell work',
  getReturnWindow([day(199), day(160)], [day(160)], NOW)?.sessionsBack === 0,
  'a conditioning session back does not re-establish a barbell baseline'
);
check(
  `${COMEBACK_SESSIONS} strength sessions back closes the window`,
  getReturnWindow(
    [day(199), day(198), day(160)],
    [day(199), day(198), day(160)],
    NOW
  )?.sessionsBack === COMEBACK_SESSIONS,
  ''
);

/** A store seeded with `n` strength sessions, the newest `gapDays` ago. */
function seedStore(n, gapDays) {
  const sessions = Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    sessionType: ['squat', 'bench', 'deadlift'][i % 3],
    date: new Date(Date.now() - (gapDays + i * 3) * 86400000).toISOString(),
    equipmentTier: 'fullgym',
    hadAches: false,
    energy: 'normal',
    timeAvailable: '60',
    exerciseCount: 6,
    exerciseLogs: [],
  }));
  useAppStore.setState({
    completedSessions: sessions,
    completedCount: n,
    testWeekFrequency: 12,
    testWeekDeferred: false,
  });
  return sessions;
}

// Archie's case, exactly: stopped at session 11, came back a month later.
seedStore(12, 30);
let progress = useAppStore.getState().getTestWeekProgress();
check(
  'a test due on the day someone returns from a month off is held',
  progress.active === false && progress.held === true,
  `active=${progress.active} held=${progress.held}`
);

// They train that session. The count moves past the multiple that made the test
// due, so the hold has to be recorded or the test is gone for a whole block.
useAppStore.getState().completeSession({
  sessionType: 'squat',
  date: new Date().toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '60',
  exerciseCount: 6,
  exerciseLogs: [],
});
check(
  'the held test is recorded rather than lost',
  useAppStore.getState().testWeekDeferred === true,
  'the session count has moved past the multiple that made it due'
);
check(
  'it is still held on the very next session',
  useAppStore.getState().getTestWeekProgress().active === false,
  `one session back is short of the ${COMEBACK_SESSIONS} needed`
);

useAppStore.getState().completeSession({
  sessionType: 'bench',
  date: new Date().toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '60',
  exerciseCount: 6,
  exerciseLogs: [],
});
check(
  `it comes due again once ${COMEBACK_SESSIONS} sessions are back in`,
  useAppStore.getState().getTestWeekProgress().active === true,
  'held means postponed, not cancelled'
);

seedStore(12, 1);
check(
  'someone who never stopped is tested exactly as before',
  useAppStore.getState().getTestWeekProgress().active === true,
  'the hold must not fire for people who have been training all along'
);

// A block already under way finishes. Being mid-test is not the same as being
// handed one out of nowhere.
seedStore(13, 30);
useAppStore.setState((s) => ({
  completedSessions: s.completedSessions.map((x, i) => (i === 0 ? { ...x, isTestWeek: true } : x)),
}));
check(
  'a test block already in progress is not interrupted by the hold',
  useAppStore.getState().getTestWeekProgress().active === true,
  ''
);

// ─── 7. The store publishes the date the engine needs ────────────────────────
console.log('\n[7] The engine is told when the user last trained');

setLastTrainedDate(null);
const unpublished = squatMain(null).loadKg[0];
setLastTrainedDate(new Date(Date.now() - 40 * 86400000).toISOString());
const published = generateWorkout(
  'squat',
  'fullgym',
  READINESS,
  PROFILE,
  {},
  undefined,
  8,
  LAST_LOGGED,
  {},
  NORMAL
).find((e) => e.category === 'main').loadKg[0];
check(
  'a published date is used when the caller supplies none',
  published < unpublished,
  `${published} kg vs ${unpublished} kg — session.tsx does not pass a date, so this is the live path`
);
setLastTrainedDate(null);

check(
  'the store publishes it on every path that can change it',
  (() => {
    const src = readFileSync(new URL('../lib/store.ts', import.meta.url), 'utf8');
    return /useAppStore\.subscribe\(publishLastTrained\)/.test(src);
  })(),
  'a per-action call would go stale behind whichever mutation path forgot it'
);
check(
  'the live store agrees with the engine after a session completes',
  (() => {
    seedStore(3, 45);
    // The subscription fires on setState, so the engine now sees a 45-day gap.
    const rusty = generateWorkout(
      'squat',
      'fullgym',
      READINESS,
      PROFILE,
      {},
      undefined,
      3,
      LAST_LOGGED,
      {},
      NORMAL
    ).find((e) => e.category === 'main').loadKg[0];
    return rusty < 80;
  })(),
  'the subscription is what makes any of this reach a real user'
);

// ─── 8. Copy ─────────────────────────────────────────────────────────────────
console.log('\n[8] The gap is described in words a person would use');

check('11 days stays days', describeTimeAway(11) === '11 days', describeTimeAway(11));
check('three weeks is weeks', describeTimeAway(21) === '3 weeks', describeTimeAway(21));
check('half a year is months', describeTimeAway(180) === '6 months', describeTimeAway(180));
check(
  'day counting is calendar days, not 24-hour blocks',
  wholeDaysBetween('2026-03-01T23:00:00.000Z', Date.parse('2026-03-02T01:00:00.000Z')) === 1,
  'two hours apart across midnight is "yesterday", not "today"'
);

console.log(
  failures === 0
    ? `\ntime-off: all ${total} checks passed\n`
    : `\ntime-off: ${failures} of ${total} checks FAILED\n`
);
process.exit(failures === 0 ? 0 : 1);
