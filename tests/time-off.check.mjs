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
 * Worse than the weight, at the time: someone who stopped at session 11 and came
 * back a month later walked straight into a max-effort 1RM test, because tests
 * fired on a session count and a session count does not know what a month is.
 * Strength test weeks are retired now, so that half is settled outright rather
 * than guarded, and section 6 keeps what it left behind.
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

// This file drives the real persisted store; see the shim for why that needs
// somewhere to write to under Node.
import './_persist-shim.mjs';
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

/** One lower body session at full-gym tier, built the way the screen builds it. */
function lowerSession(days, { ormKg, count = 8, lastLogged = {}, normal = {} } = {}) {
  return generateWorkout(
    'lower_body',
    'fullgym',
    READINESS,
    PROFILE,
    {},
    ormKg,
    count,
    lastLogged,
    {},
    normal,
    days
  );
}

/**
 * THE MAIN LIFT, AND THE WEIGHT THEY LAST PUT ON IT, LOOKED UP NOT TYPED IN.
 *
 * This used to build a 'squat' session and key the history off the literal id
 * 'sq-main-fg', which was the one main lift a squat day could ever have. Squat
 * days are not built any more: the three lift-named ids all build a lower,
 * upper or full body session now, and those rotate their main lift on the
 * session count and on the calendar, so there is no single id to write down.
 *
 * A hardcoded id that stops matching does not fail loudly. It silently stops
 * being "the weight they last lifted", the layoff has nothing to reduce, and
 * every check below goes on passing while measuring nothing. So the id is read
 * off the session that was actually built, the history is recorded against THAT
 * exercise, and the second build is required to come back with the same one.
 *
 * `days` of null means "no date on file"; leaving it out entirely means "use
 * whatever the store last published", which is the path the session screen
 * takes, since it passes no date at all.
 */
function main(days, { ormKg, count = 8, lastKg = 80 } = {}) {
  const bare = lowerSession(days, { ormKg, count }).find((e) => e.category === 'main');
  if (!bare) return undefined;
  const id = bare.id;
  const found = lowerSession(days, {
    ormKg,
    count,
    lastLogged: { [id]: lastKg },
    normal: { [id]: 'normal' },
  }).find((e) => e.category === 'main');
  return found && found.id === id ? found : undefined;
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

const sameDay = main(0).loadKg[0];
const after38 = main(38).loadKg[0];
const after368 = main(368).loadKg[0];
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
  new Set([11, 21, 35, 60].map((d) => main(d).loadKg[0])).size >= 3,
  'four points on the curve should not collapse to one or two weights'
);
check(
  /**
   * MATCHED BY NAME, ACROSS MANY SESSIONS, AND IT HAD TO BE.
   *
   * This compared two lists of weights BY POSITION out of a single squat
   * session, so it was really asking "is the nth accessory lighter than the nth
   * accessory", of two lists that need not hold the same exercises at all. The
   * rotation is seeded on the calendar as well as on the session count, so the
   * session it happened to look at changed from one day to the next with no
   * code change anywhere - and on 18 September 2026 it failed, on the commit
   * that had passed it the day before. What it drew that day was one loadable
   * accessory, a Dumbbell Walking Lunge at 7.5 kg, which is the lightest rung
   * the dumbbell grid has: a layoff cannot take anything off a weight that is
   * already on the floor, so there was nothing for the rule to be true of.
   *
   * The rule itself was never in doubt, so it is now asserted in a way the
   * calendar cannot reach: every accessory that appears in BOTH the fresh and
   * the rusty version of the same session, matched on its name, across three
   * session types, two kit tiers and six session counts. Two things must hold
   * of those pairs, and the second is new - the old positional form could not
   * express it:
   *
   *   SOME OF THEM COME DOWN. Time away costs load away from the main lift too.
   *
   *   AND NOT ONE OF THEM GOES UP. A layoff must never hand somebody a heavier
   *   accessory than they would have had if they had never stopped.
   */
  'accessories are eased back too, not just the main lift',
  (() => {
    const acc = (days, type, tier, count) =>
      new Map(
        // No logged history passed: accessories are not keyed to the main
        // lift's id, and every weight here is the engine's own estimate.
        generateWorkout(type, tier, READINESS, PROFILE, {}, undefined, count, {}, {}, {}, days)
          .filter((e) => e.category === 'accessory' && e.loadKg?.length)
          .map((e) => [e.name, e.loadKg[0]])
      );
    let compared = 0;
    let eased = 0;
    let heavier = 0;
    for (const type of ['lower_body', 'upper_body', 'full_body']) {
      for (const tier of ['fullgym', 'dumbbells']) {
        // From 8, so auto-progression is already running in every one of them.
        for (let count = 8; count < 14; count++) {
          const fresh = acc(0, type, tier, count);
          const rusty = acc(40, type, tier, count);
          for (const [name, kg] of fresh) {
            if (!rusty.has(name)) continue;
            compared++;
            if (rusty.get(name) < kg) eased++;
            if (rusty.get(name) > kg) heavier++;
          }
        }
      }
    }
    return compared > 0 && eased > 0 && heavier === 0;
  })(),
  'a body that lost tolerance lost it everywhere, not only under the bar'
);

// ─── 3. It stops as soon as they are back ────────────────────────────────────
console.log('\n[3] It does not fight the normal progression once training resumes');

const comeback = main(40).loadKg[0];
const dayAfter = main(1, { lastKg: comeback, count: 9 });
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
const stale = main(200, { ormKg: 180 });
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
  main(LAYOFF_RESET_DAYS, { ormKg: 180 }).loadKg[0] <=
    main(LAYOFF_RESET_DAYS - 1, { ormKg: 180 }).loadKg[0],
  'one more day off must not be rewarded with more weight'
);

// ─── 5. The user is told ─────────────────────────────────────────────────────
console.log('\n[5] Nothing is adjusted silently');

for (const days of [11, 21, 40, 200]) {
  const card = main(days);
  check(
    `${days} days: the card says why the weight moved`,
    !!card.progressionNote && /eased back|starting fresh/i.test(card.progressionNote),
    `got "${card.progressionNote}"`
  );
  check(
    `${days} days: it never claims to have raised the weight`,
    !/up\b/i.test(card.progressionNote ?? ''),
    `got "${card.progressionNote}" beside a REDUCED weight`
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

// ─── 6. The app knows when somebody is on the way back ──────────────────────
console.log('\n[6] Coming back off a break is a state the app can see');

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

/*
 * THE HOLD ITSELF IS GONE, because the thing it held back is gone.
 *
 * Eight assertions used to stand here, driving the real store: a test due on the
 * day somebody returned from a month off was withheld, the postponement was
 * recorded so it could not vanish for a whole block, and it came due again once
 * COMEBACK_SESSIONS strength sessions were back in. That was Archie's own case:
 * stopped at session 11, came back a month later, and was handed a one-rep max
 * attempt on a body that had not been under a bar since.
 *
 * Strength test weeks are retired, so nobody is walked into a max-effort attempt
 * from any starting point at all. The assertions above still hold the half that
 * survives and is still doing work elsewhere in the app: getReturnWindow knows
 * when somebody is on the way back, it counts the break across ALL training, and
 * a conditioning session back does not close a barbell window. The load backs
 * off after a break on the strength of it, which is what sections 1 to 4 of this
 * file measure.
 *
 * tests/test-weeks-retired.check.mjs holds the retirement.
 */
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
    testWeekDeferred: false,
  });
  return sessions;
}

// Archie's case, exactly: stopped at session 11, came back a month later.
seedStore(12, 30);
check(
  'somebody a month off, on the session that used to make a test due, is on the comeback',
  useAppStore.getState().getReturnWindow()?.sessionsBack === 0,
  JSON.stringify(useAppStore.getState().getReturnWindow())
);
check(
  'and what they are offered is an ordinary session',
  // The rotation, not a max attempt. Named by what the app builds today rather
  // than by the three lift ids this fixture is stored under: those ids resolve
  // to exactly these three sessions (lib/session-type.ts), and a check pinned to
  // the stored spelling would have gone quiet the moment they stopped being
  // offered.
  ['lower_body', 'upper_body', 'full_body'].includes(
    useAppStore.getState().getCurrentSessionType()
  ),
  useAppStore.getState().getCurrentSessionType()
);

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
  'training once back does not record a postponement, because there is nothing to postpone',
  useAppStore.getState().testWeekDeferred === false,
  'the field is inert; anything writing to it is the old mechanism coming back'
);
check(
  `and the comeback window still counts that session (${COMEBACK_SESSIONS} closes it)`,
  useAppStore.getState().getReturnWindow()?.sessionsBack === 1,
  JSON.stringify(useAppStore.getState().getReturnWindow())
);

seedStore(12, 1);
check(
  'somebody who never stopped has no comeback window at all',
  useAppStore.getState().getReturnWindow() === null,
  'the layoff machinery must not fire for people who have been training all along'
);

// ─── 7. The store publishes the date the engine needs ────────────────────────
console.log('\n[7] The engine is told when the user last trained');

setLastTrainedDate(null);
const unpublished = main(null).loadKg[0];
setLastTrainedDate(new Date(Date.now() - 40 * 86400000).toISOString());
// No date argument at all, which is the path the session screen takes.
const published = main(undefined).loadKg[0];
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
    return main(undefined, { count: 3 }).loadKg[0] < 80;
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
process.exitCode = failures === 0 ? 0 : 1;
