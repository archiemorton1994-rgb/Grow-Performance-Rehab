/**
 * Contract test: nothing in the app can start a strength test week.
 *
 * WHAT WAS RETIRED
 * ────────────────
 * Every twelve or eighteen barbell sessions, Grow handed the user a max-effort
 * attempt: warm up, then one all-out set, and the reps you managed rewrote the
 * weights for the next block. Archie's decision 3 retires the whole idea, along
 * with the "best lifts" question that seeded it. Grow is a physiotherapist's
 * app, and finding out once what somebody can lift is not what it is for.
 *
 * WHAT THIS FILE HAS TO PROVE, AND WHY IT IS NOT OBVIOUS
 * ─────────────────────────────────────────────────────
 * Deleting the screens is the easy half. The hard half is that a test was
 * decided by a NUMBER SITTING IN PERSISTED STATE, `testWeekFrequency`, and that
 * number is still on hundreds of phones and in the sync payload on the server.
 * A retirement that only removes the UI leaves the stored 12 intact, and the
 * next person to restore a branch near it hands a real user a one-rep max.
 *
 * So the promise here is made of the STORE, not of the screens:
 *
 *   1. No value that can be stored in that field can produce a test. The field
 *      is fed every number the old type allowed and every shape an older build
 *      or a corrupt blob could leave there, and after each one the app is asked
 *      what today is.
 *   2. A state migrated from a real previous version reads 'never'.
 *   3. The server cannot put the number back, which is the half a migration
 *      alone does not cover: mergeServerData adopts the server's view whenever
 *      it is ahead on sessions, and an older build still uploads 12.
 *   4. The engine has no test to build. The functions are gone, not merely
 *      uncalled.
 *   5. Existing maxes are untouched, and the badges that needed a test are
 *      retired rather than deleted: still shown to whoever earned them, never
 *      awarded again, and out of both halves of "x of y".
 *   6. Migrating does not fire a burst of unlock toasts. This is the one that
 *      would reach a user as noise rather than as a bug report: a long history
 *      full of test weeks, opened after the update, must celebrate nothing.
 *
 * Everything runs the real store, the real migration and the real badge engine.
 * Nothing here greps source for a spelling.
 *
 * Run:  npx tsx tests/test-weeks-retired.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore, SESSION_ORDER } from '../lib/store.ts';
import * as engine from '../lib/workout-engine.ts';
import { evaluateBadges } from '../lib/badge-engine.ts';
import {
  ACTIVE_BADGES,
  BADGE_CATALOG,
  BADGE_MAP,
  countedEarned,
  isRetiredBadge,
  visibleBadges,
} from '../lib/badges.ts';

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

const S = () => useAppStore.getState();
const STORAGE_KEY = 'grow-app-storage';

let seq = 0;
/** A completed session, in the shape the store keeps them. */
const session = (sessionType, extra = {}) => ({
  id: `s${seq++}`,
  sessionType,
  date: new Date(Date.now() - seq * 2 * 86400000).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '45',
  exerciseCount: 6,
  exerciseLogs: [],
  ...extra,
});

/** The exact history that used to make a test due at every frequency the old
 *  type allowed: 36 barbell sessions divides by 12 and by 18. */
const HISTORY_THAT_USED_TO_TRIGGER = () =>
  Array.from({ length: 36 }, (_, i) => session(SESSION_ORDER[i % 3]));

/**
 * THE ROTATION IS DELIBERATELY OFFSET BY ONE, and the whole of section 1 depends
 * on it.
 *
 * A test always started on SESSION_ORDER[0]. Both old frequencies, 12 and 18,
 * divide exactly by three, so at the moment a test came due the plain rotation
 * was ALSO sitting on SESSION_ORDER[0] - which is the bug the old store docblock
 * describes, and it means "a test is due" and "no test is due" produce the same
 * lift at a round session count. A check written on a zero offset would be
 * comparing two answers that agree by coincidence, and a restored test branch
 * would sail past it. Mutation-tested: reinstating one is caught only with this.
 */
const CYCLE_OFFSET = 1;

function reset(patch = {}) {
  useAppStore.setState({
    programme: null,
    completedSessions: [],
    completedCount: 0,
    cycleStartOffset: CYCLE_OFFSET,
    oneRepMaxes: [],
    earnedBadges: [],
    newlyUnlockedBadges: [],
    xpTotal: 0,
    testWeekFrequency: 'never',
    testWeekDeferred: false,
    ...patch,
  });
}

// ─── 1. No stored value can produce a test ───────────────────────────────────
console.log('\n[1] Whatever is in testWeekFrequency, today is an ordinary session');

/**
 * Every value that could be sitting in the field on a real phone.
 *
 * 12 and 18 were the two the old type offered. 'never' is what the migration
 * writes. The rest are what a corrupt blob, a half-written sync or a future
 * build could leave: the field is persisted and synced, so it is not ours to
 * assume is well formed.
 */
const STORED_VALUES = [12, 18, 'never', 1, 3, 0, -1, '12', null, undefined, {}, [], NaN, true];

/** What the plain rotation asks for, worked out here rather than read back off
 *  the thing under test. */
const ROTATION_ANSWER = SESSION_ORDER[(36 + CYCLE_OFFSET) % SESSION_ORDER.length];

const baseline = (() => {
  reset({ completedSessions: HISTORY_THAT_USED_TO_TRIGGER() });
  return S().getCurrentSessionType();
})();
check(
  `the history that used to trigger a test gets the plain rotation instead (${baseline})`,
  baseline === ROTATION_ANSWER,
  `got ${baseline}, and the rotation asks for ${ROTATION_ANSWER}`
);
check(
  `and that is NOT the lift a test would have started on (${SESSION_ORDER[0]})`,
  ROTATION_ANSWER !== SESSION_ORDER[0],
  'if the two agreed, everything below would pass on a build that still ran test weeks'
);

const offenders = [];
for (const value of STORED_VALUES) {
  reset({
    completedSessions: HISTORY_THAT_USED_TO_TRIGGER(),
    testWeekFrequency: value,
    testWeekDeferred: true,
  });
  const today = S().getCurrentSessionType();
  if (today !== baseline) offenders.push(`${String(value)} -> ${today}`);
}
check(
  `all ${STORED_VALUES.length} storable values give the same answer as 'never'`,
  offenders.length === 0,
  offenders.join(' | ')
);

check(
  'and the store exposes nothing that could work out a test is due',
  S().getTestWeekProgress === undefined &&
    S().isTestWeekDue === undefined &&
    S().setTestWeekFrequency === undefined &&
    S().deferTestWeek === undefined,
  'those four were the whole mechanism; leaving one of them is leaving the way back in'
);

// The deferral is the sharpest edge of the old design: it survived being
// switched off, so turning tests back on could hand somebody a max attempt on
// their very next session. Nothing sets it and nothing reads it now.
reset({ completedSessions: HISTORY_THAT_USED_TO_TRIGGER(), testWeekDeferred: true });
const withDeferral = S().getCurrentSessionType();
check(
  'an outstanding postponement from the old design changes nothing',
  withDeferral === baseline,
  `got ${withDeferral}, expected ${baseline}`
);

// And logging a session does not write one back.
reset({ completedSessions: HISTORY_THAT_USED_TO_TRIGGER() });
S().completeSession(session(SESSION_ORDER[0]));
check(
  'completing a session leaves both fields where the migration put them',
  S().testWeekFrequency === 'never' && S().testWeekDeferred === false,
  `frequency ${String(S().testWeekFrequency)}, deferred ${String(S().testWeekDeferred)}`
);

// ─── 2. A migrated state reads 'never' ───────────────────────────────────────
console.log('\n[2] A phone that comes back from an older version reads never');

/**
 * Loads a persisted blob the way a cold start does: version compare, the real
 * migrate(), then the merge into the live store.
 */
async function rehydrateWith(state, version) {
  globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));
  await useAppStore.persist.rehydrate();
  return useAppStore.getState();
}

const BASE_BLOB = {
  onboardingComplete: true,
  completedSessions: [],
  earnedBadges: [],
  equipmentTiers: ['fullgym'],
  themePreference: 'dark',
};

const storeVersion = useAppStore.persist.getOptions().version;
check(
  'the persist version is above the last one that shipped with test weeks',
  storeVersion > 34,
  `version is ${storeVersion}; migrate() only runs when the stored number is LOWER, so without the bump none of this section happens on a real phone`
);

const stranded = [];
for (const v of [0, 1, 21, 30, 33, 34]) {
  for (const freq of [12, 18, 'never']) {
    const after = await rehydrateWith(
      { ...BASE_BLOB, testWeekFrequency: freq, testWeekDeferred: true },
      v
    );
    if (after.testWeekFrequency !== 'never' || after.testWeekDeferred !== false) {
      stranded.push(`v${v}/${freq} -> ${String(after.testWeekFrequency)}`);
    }
  }
}
check(
  'every older version, holding any frequency, comes back as never with no deferral',
  stranded.length === 0,
  `${stranded.join(' | ')}; a migration gated on one version number strands everybody else`
);

const noField = await rehydrateWith({ ...BASE_BLOB }, 20);
check(
  'a blob so old it has no such field at all still reads never',
  noField.testWeekFrequency === 'never' && noField.testWeekDeferred === false,
  `got ${String(noField.testWeekFrequency)}`
);

// ─── 3. The server cannot put the number back ────────────────────────────────
console.log('\n[3] A copy uploaded by an older build does not undo the migration');

/**
 * mergeServerData adopts the server's view of the current state whenever the
 * server is AHEAD on sessions, which is exactly the moment a phone signs in on
 * a new device. An older build still uploads testWeekFrequency: 12. A migration
 * that is not mirrored here is a migration that lasts until the next sign-in.
 */
reset({ completedSessions: [session('squat')], completedCount: 1 });
S().mergeServerData({
  completedSessions: [session('squat'), session('bench'), session('deadlift')],
  userProfile: S().userProfile,
  testWeekFrequency: 12,
  testWeekDeferred: true,
  oneRepMaxes: [{ lift: 'squat', weight: 140, date: '2026-01-01T00:00:00.000Z', unit: 'kg' }],
});
check(
  'the server saying 12 still leaves the phone on never',
  S().testWeekFrequency === 'never' && S().testWeekDeferred === false,
  `frequency ${String(S().testWeekFrequency)}, deferred ${String(S().testWeekDeferred)}`
);
check(
  'and the merge still did its real job',
  S().completedSessions.length === 4 && S().oneRepMaxes.length === 1,
  `${S().completedSessions.length} sessions, ${S().oneRepMaxes.length} maxes; the frequency must be ignored without the rest of the restore being dropped`
);

// ─── 4. The engine has no test left to build ─────────────────────────────────
console.log('\n[4] Nothing in the engine can prescribe a max-effort set');

const GONE = [
  'generate1RMWorkout',
  'testLoadFromWorkingWeight',
  'workingWeightAfterTest',
  'skipsMaxTest',
  'ormFromWorkingWeight',
  'TEST_LOAD_FRACTION_OF_ORM',
  'TEST_EXPECTED_REPS',
  'MAX_TEST_WEIGHT_MOVE',
  'TEST_DEADBAND_REPS',
];
const survivors = GONE.filter((name) => engine[name] !== undefined);
check(
  `all ${GONE.length} pieces of the test protocol are gone from the engine`,
  survivors.length === 0,
  `${survivors.join(', ')} still exported, so a screen could still call it`
);

// The load maths a NORMAL session runs is untouched, or this would be a
// retirement that quietly changed everybody's weights.
check(
  'the ordinary load maths is still there and still works',
  typeof engine.workingWeightFromOrm === 'function' &&
    typeof engine.goalLoadFraction === 'function' &&
    typeof engine.estimateOrmFromAmrap === 'function' &&
    engine.estimateOrmFromAmrap(100, 0) === 100,
  'Epley is still read for exercise progress and for the block report'
);

/**
 * NOBODY IS ASKED TO MAX OUT ON A REHAB GOAL.
 *
 * This rule was held by tests/test-week-fairness.check.mjs, which is deleted
 * with the feature. It asserted that skipsMaxTest was true for a rehab goal,
 * because a fair test is a heavy test and a rehab working weight sits at half a
 * max by design, so testing one properly meant asking for about 1.6x what they
 * train at, taken to failure. It is re-expressed here over the names that
 * survive: for a rehab goal the prescribed working weight is a long way BELOW
 * the max, and nothing exists that could ask for more than it.
 */
const rehab = {
  name: 'Test',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['rehab'],
  bodyweightKg: 80,
};
const rehabWorking = engine.workingWeightFromOrm(100, rehab, 'kg');
check(
  `a rehab goal is prescribed well under a max (${rehabWorking} kg from a 100 kg max)`,
  rehabWorking < 60,
  'the whole reason a rehab user was excused the test is that a fair one is a maximal effort'
);
const strengthOnly = engine.goalLoadFraction({ ...rehab, goals: ['strength'] });
const strengthPlusRehab = engine.goalLoadFraction({ ...rehab, goals: ['strength', 'rehab'] });
check(
  `and naming rehab alongside another goal still pulls the load down (${strengthOnly} to ${strengthPlusRehab})`,
  strengthPlusRehab < strengthOnly,
  'somebody who says they are rehabbing is rehabbing, whatever else they picked'
);
check(
  'so no goal, in any combination, is ever prescribed at or above its max',
  ['strength', 'power', 'muscle', 'fitness', 'fat_loss', 'rehab'].every((g) =>
    [[g], [g, 'rehab'], [g, 'strength']].every(
      (goals) => engine.workingWeightFromOrm(100, { ...rehab, goals }, 'kg') < 100
    )
  ),
  'the all-out set was the only thing in the app that ever asked for a true maximum'
);

// ─── 5. The maxes stay, and the badges are retired rather than deleted ───────
console.log('\n[5] What was earned is kept');

const OLD_MAXES = [
  { lift: 'squat', weight: 140, date: '2026-01-01T00:00:00.000Z', unit: 'kg', source: 'test' },
  { lift: 'bench', weight: 100, date: '2026-01-02T00:00:00.000Z', unit: 'kg', source: 'test' },
];
reset({ oneRepMaxes: OLD_MAXES, completedSessions: HISTORY_THAT_USED_TO_TRIGGER() });
check(
  'existing one-rep maxes are still stored and still readable',
  S().oneRepMaxes.length === 2 && S().getBestORM('squat')?.weight === 140,
  JSON.stringify(S().oneRepMaxes)
);
check(
  'and they still reach the sync payload, so they survive a new phone',
  (S().getDataForSync().oneRepMaxes ?? []).length === 2,
  'history that does not sync is history that a sign-out destroys'
);

const TEST_BADGES = ['test_1', 'test_3', 'test_5', 'test_10', 'test_20'];
check(
  'all five test-week badges are still in the catalogue',
  TEST_BADGES.every((id) => BADGE_MAP.get(id) !== undefined),
  'deleting them would take a badge off somebody who earned it'
);
check(
  'and every one of them is marked retired',
  TEST_BADGES.every(isRetiredBadge),
  TEST_BADGES.filter((id) => !isRetiredBadge(id)).join(', ')
);
check(
  'so none of them is on offer any more',
  ACTIVE_BADGES.every((b) => !TEST_BADGES.includes(b.id)),
  'ACTIVE_BADGES is the denominator of "x of y"'
);

// Shown if earned, absent if not. Both halves, because either one alone is a
// different bug: hiding an earned one takes it away, showing an unearned one
// is a locked card for something nobody can do.
check(
  'an earned test badge is still on the shelf',
  visibleBadges(new Set(['test_3'])).some((b) => b.id === 'test_3'),
  'a retired badge somebody earned has to keep its place'
);
check(
  'and an unearned one is not shown at all',
  !visibleBadges(new Set()).some((b) => TEST_BADGES.includes(b.id)),
  'a locked card for a thing the app no longer does is a dead end'
);
check(
  'an earned retired badge is left out of the count',
  countedEarned(['test_3', 'milestone_1']) === 1,
  'counting it here and not in the denominator is how somebody is shown "278 of 277"'
);

/**
 * AND NO HISTORY CAN EARN ONE AGAIN.
 *
 * Run against an account whose whole history is test weeks, which is the most
 * anybody could have. The old rules awarded on one, three, five, ten and twenty.
 */
const allTests = Array.from({ length: 25 }, (_, i) =>
  session(SESSION_ORDER[i % 3], { isTestWeek: true })
);
const earnedFromTests = evaluateBadges({
  completedSessions: allTests,
  oneRepMaxes: OLD_MAXES,
  userProfile: S().userProfile,
  profilePhotoUri: null,
  equipmentTiers: ['fullgym'],
  bodyweightUpdatedAt: null,
  onboardingComplete: true,
  tourGenuinelyCompleted: false,
  weeklyStreakGoal: 2,
  programme: null,
  completedProgrammes: [],
});
check(
  'twenty-five completed test weeks award none of the five',
  TEST_BADGES.every((id) => !earnedFromTests.includes(id)),
  earnedFromTests.filter((id) => TEST_BADGES.includes(id)).join(', ')
);
check(
  'while the session-count badges those same sessions earn still fire',
  earnedFromTests.includes('goal_strength_10') && earnedFromTests.includes('goal_strength_25'),
  'goal_strength_* counts barbell SESSIONS, and a test week was one; that history must keep counting'
);

// ─── 6. Migrating does not celebrate anything ────────────────────────────────
console.log('\n[6] Nobody opens the update to a burst of unlock toasts');

/**
 * THE FAILURE THIS GUARDS IS A USER-FACING ONE, not a broken number.
 *
 * Badges are evaluated against the whole history rather than against the
 * moment, so anything that changes what the history means can make a pile of
 * badges "newly unlocked" at once. The user's own words for it, from a previous
 * occurrence: "it insta awards about 40 that I've already earned previously."
 *
 * This phase changes badge rules. So: an account that has already earned
 * everything its history deserves, migrated and then reconciled on launch the
 * way the app does it, must queue nothing.
 */
reset({ completedSessions: allTests, oneRepMaxes: OLD_MAXES });
S().awardNewBadges({ silent: true });
const settled = [...S().earnedBadges];
check(
  `the account has a real collection to be noisy about (${settled.length} badges)`,
  settled.length >= 10,
  'a small collection would not detect a burst'
);

useAppStore.setState({ newlyUnlockedBadges: [] });
S().awardNewBadges();
check(
  'launching again queues no celebration at all',
  S().newlyUnlockedBadges.length === 0,
  S().newlyUnlockedBadges.join(', ')
);

// And the same account taken through the real migration from the last shipped
// version, which is what actually happens on somebody's phone.
await rehydrateWith(
  {
    ...BASE_BLOB,
    completedSessions: allTests,
    oneRepMaxes: OLD_MAXES,
    earnedBadges: settled,
    newlyUnlockedBadges: [],
    testWeekFrequency: 12,
    testWeekDeferred: true,
  },
  34
);
S().awardNewBadges();
check(
  'and neither does the real migration from the last shipped version',
  S().newlyUnlockedBadges.length === 0,
  S().newlyUnlockedBadges.join(', ')
);
check(
  'with the frequency converted on the way in',
  S().testWeekFrequency === 'never' && S().testWeekDeferred === false,
  `frequency ${String(S().testWeekFrequency)}`
);

// Non-vacuity: this account is NOT one where nothing could ever be awarded.
useAppStore.setState({ earnedBadges: [], newlyUnlockedBadges: [] });
S().awardNewBadges();
check(
  'the same reconcile on an empty collection does award the badges it should',
  S().newlyUnlockedBadges.length > 0,
  'if this queued nothing either, the two checks above would be measuring a dead code path'
);
check(
  'and none of what it awards is a retired badge',
  S().newlyUnlockedBadges.every((id) => !isRetiredBadge(id)),
  S().newlyUnlockedBadges.filter(isRetiredBadge).join(', ')
);

// One last guard on the catalogue itself, so a future retirement cannot be
// half-done: nothing marked retired may be reachable by any award rule.
const retiredIds = BADGE_CATALOG.filter((b) => b.retired).map((b) => b.id);
check(
  `the catalogue holds ${retiredIds.length} retired badges and the engine awards none of them`,
  retiredIds.length >= TEST_BADGES.length &&
    retiredIds.every((id) => !S().newlyUnlockedBadges.includes(id)),
  retiredIds.filter((id) => S().newlyUnlockedBadges.includes(id)).join(', ')
);

console.log(`\ntest-weeks-retired: ${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
