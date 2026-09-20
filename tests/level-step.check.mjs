/**
 * Contract test: the level step-up offer, its cap, and the way back down.
 *
 * WHAT THIS GUARDS
 * ────────────────
 * The level a person is on is the single most consequential number in the app:
 * it is a hard ceiling on which movements they are ever prescribed. Until this
 * phase it could only move for somebody enrolled in a programme, at the end of
 * a block. Most people are not on a programme, so for most people it was set
 * once at sign-up and never again.
 *
 * Four things therefore have to hold, and each is a section below.
 *
 *   THE OFFER IS EARNED. Sixteen logged Train sessions at the level they are
 *   on, not sixteen sessions ever. A count that keeps running across a step up
 *   would offer the next one the following week.
 *
 *   IT STOPS AT ADVANCED. Athlete is jumps, throws and depth work. Somebody
 *   arrives there by saying so about themselves on the experience page, never
 *   by turning up sixteen times, so the offer caps one rung below it. This is
 *   the clinical half of the phase and the half a refactor is most likely to
 *   quietly undo.
 *
 *   "NOT YET" IS AN ANSWER. It comes back after eight more sessions. Not two,
 *   which teaches people to stop reading the card, and not never, which would
 *   make the first tap final.
 *
 *   THE WAY DOWN IS AS PLAIN AS THE WAY UP, and it hands back the EARNED rung
 *   rather than editing the answer somebody gave about themselves.
 *
 * And the two one-time cards, which exist because everybody already using the
 * app answered the equipment and experience questions before either of them
 * meant what they mean now.
 *
 * HOW IT TESTS
 * ────────────
 * By running the real rule and driving the real store through the real actions,
 * including a real cold start through persist's own migrate(). Nothing here
 * reads the source of anything.
 *
 * Run:  npx tsx tests/level-step.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore } from '../lib/store.ts';
import { levelStepOffer, levelStandingFor, LEVEL_STEP_CEILING } from '../lib/level-step.ts';
import { LIBRARY_LEVEL_NAMES } from '../lib/exercise-library.ts';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

const S = () => useAppStore.getState();
const FRESH = JSON.parse(JSON.stringify(S()));
const freshAccount = (patch = {}) => useAppStore.setState({ ...FRESH, ...patch });

/** A Train session, which is what countLiftingSessions counts. */
const trainSessions = (n, type = 'lower_body') =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    date: new Date(2026, 0, 1 + i).toISOString(),
    sessionType: type,
    exerciseLogs: [],
  }));

const offer = (patch = {}) =>
  levelStepOffer({
    experienceLevel: 'beginner',
    earnedLevelBonus: 0,
    liftingCount: 16,
    levelStepDueAt: 16,
    programme: null,
    ...patch,
  });

// ─── 1. When it is offered ───────────────────────────────────────────────────
console.log('\n[1] Sixteen Train sessions at this level, and not before');

check(
  'fifteen sessions is not enough',
  offer({ liftingCount: 15 }) === null,
  JSON.stringify(offer({ liftingCount: 15 }))
);
check(
  'sixteen is',
  offer({ liftingCount: 16 })?.toName === 'Intermediate',
  JSON.stringify(offer({ liftingCount: 16 }))
);
check(
  'and so is anything past it, so a missed summary does not lose the offer',
  offer({ liftingCount: 40 })?.toName === 'Intermediate',
  JSON.stringify(offer({ liftingCount: 40 }))
);
check(
  'the step is one level, named in the onboarding wording',
  (() => {
    const o = offer();
    return (
      o.from === 1 &&
      o.to === 2 &&
      o.fromName === LIBRARY_LEVEL_NAMES[1] &&
      o.toName === LIBRARY_LEVEL_NAMES[2]
    );
  })(),
  JSON.stringify(offer())
);
check(
  'it hands acceptLevelStep the next rung up, not a level',
  offer({ earnedLevelBonus: 1, liftingCount: 99 })?.toBonus === 2,
  JSON.stringify(offer({ earnedLevelBonus: 1, liftingCount: 99 }))
);
check(
  'a device that was never stamped is never offered anything',
  offer({ levelStepDueAt: null }) === null,
  'an unstamped device cannot tell sixteen sessions at this level from sixteen in a career'
);

// ─── 2. The cap ──────────────────────────────────────────────────────────────
console.log('\n[2] It never offers Athlete, and never offers past it');

check(
  'somebody who said Advanced is offered nothing, however much they train',
  [16, 50, 500].every((n) => offer({ experienceLevel: 'advanced', liftingCount: n }) === null),
  'Advanced to Athlete is a thing a person chooses about themselves, not a reward'
);
check(
  'somebody who said Athlete is offered nothing either',
  offer({ experienceLevel: 'athlete', liftingCount: 500 }) === null,
  'there is nothing above it'
);
check(
  'an Intermediate who has already taken a rung is at the cap',
  offer({ experienceLevel: 'intermediate', earnedLevelBonus: 1, liftingCount: 500 }) === null,
  'their ceiling is Advanced already'
);
check(
  'a Beginner who has taken two rungs is at the cap',
  offer({ experienceLevel: 'beginner', earnedLevelBonus: 2, liftingCount: 500 }) === null,
  JSON.stringify(offer({ experienceLevel: 'beginner', earnedLevelBonus: 2, liftingCount: 500 }))
);
check(
  'no reachable combination is ever offered a step to Athlete',
  ['beginner', 'intermediate', 'advanced', 'athlete'].every((lvl) =>
    [0, 1, 2].every((bonus) => {
      const o = offer({ experienceLevel: lvl, earnedLevelBonus: bonus, liftingCount: 999 });
      return o === null || o.to <= LEVEL_STEP_CEILING;
    })
  ),
  'this is the clinical rule of the phase: jumps and throws are chosen, never given'
);

// ─── 3. Not while a block is running ─────────────────────────────────────────
console.log('\n[3] A programme owns its own offer');

check(
  'nothing is offered while a block is choosing the sessions',
  offer({ programme: { paused: false } }) === null,
  'the block report offers the rung at the end of it; two offers is two payments'
);
check(
  'a paused block counts as no block, exactly as Home reads it',
  offer({ programme: { paused: true } })?.toName === 'Intermediate',
  JSON.stringify(offer({ programme: { paused: true } }))
);

// ─── 4. The store: accepting, declining, stepping down ───────────────────────
console.log('\n[4] Taking it, turning it down, and handing it back');

const liveOffer = () =>
  levelStepOffer({
    experienceLevel: S().userProfile.experienceLevel,
    earnedLevelBonus: S().userProfile.earnedLevelBonus,
    liftingCount: S().completedSessions.length,
    levelStepDueAt: S().levelStepDueAt,
    programme: S().programme,
  });

freshAccount();
check(
  'a brand new account is due its first offer at sixteen',
  S().levelStepDueAt === 16,
  `due at ${S().levelStepDueAt}`
);

freshAccount({ completedSessions: trainSessions(16) });
check('after sixteen sessions the offer is live', liveOffer()?.toName === 'Intermediate', '');

S().acceptLevelStep(liveOffer().toBonus);
check(
  'accepting raises the earned rung',
  S().userProfile.earnedLevelBonus === 1,
  `bonus ${S().userProfile.earnedLevelBonus}`
);
check(
  'and the sessions behind it cannot earn the next one as well',
  S().levelStepDueAt === 32 && liveOffer() === null,
  `due at ${S().levelStepDueAt} against 16 sessions logged`
);
check(
  'the next offer needs another sixteen',
  (() => {
    useAppStore.setState({ completedSessions: trainSessions(31) });
    const early = liveOffer();
    useAppStore.setState({ completedSessions: trainSessions(32) });
    return early === null && liveOffer()?.toName === 'Advanced';
  })(),
  `due at ${S().levelStepDueAt}`
);

freshAccount({ completedSessions: trainSessions(16) });
S().deferLevelStep();
check(
  '"Not yet" puts the question eight sessions out, not sixteen',
  S().levelStepDueAt === 24,
  `due at ${S().levelStepDueAt}`
);
check(
  'and it really is gone in the meantime',
  (() => {
    useAppStore.setState({ completedSessions: trainSessions(23) });
    return liveOffer() === null;
  })(),
  'seven more sessions is not eight'
);
check(
  'it comes back after eight more',
  (() => {
    useAppStore.setState({ completedSessions: trainSessions(24) });
    return liveOffer()?.toName === 'Intermediate';
  })(),
  `due at ${S().levelStepDueAt}`
);
check(
  'declining never moves the level itself',
  (S().userProfile.earnedLevelBonus ?? 0) === 0,
  'a card that changed something by being dismissed would be the app acting unasked'
);

freshAccount({
  completedSessions: trainSessions(40),
  userProfile: { ...FRESH.userProfile, experienceLevel: 'beginner', earnedLevelBonus: 1 },
  levelStepDueAt: 40,
});
check(
  'the level control shows the ceiling, not the answer they gave',
  levelStandingFor(S().userProfile).name === 'Intermediate',
  JSON.stringify(levelStandingFor(S().userProfile))
);
check(
  'and names where stepping down would land them',
  levelStandingFor(S().userProfile).down?.name === 'Beginner',
  JSON.stringify(levelStandingFor(S().userProfile))
);
S().stepLevelDown();
check(
  'stepping down hands back the earned rung',
  S().userProfile.earnedLevelBonus === 0 && levelStandingFor(S().userProfile).name === 'Beginner',
  `bonus ${S().userProfile.earnedLevelBonus}`
);
check(
  'it does not touch the answer they gave about themselves',
  S().userProfile.experienceLevel === 'beginner',
  'that answer is theirs, and the edit sheet is where it changes'
);
check(
  'and it is not met by the same offer again next session',
  S().levelStepDueAt === 56 && liveOffer() === null,
  `due at ${S().levelStepDueAt} against 40 sessions logged`
);
check(
  'with no rung left there is nothing to hand back',
  levelStandingFor(S().userProfile).down === null,
  'the card points at the edit sheet instead'
);

freshAccount({ completedSessions: trainSessions(40), levelStepDueAt: 40 });
S().setUserProfile({ experienceLevel: 'intermediate' });
check(
  'correcting the experience answer restarts the clock',
  S().levelStepDueAt === 56 && liveOffer() === null,
  `due at ${S().levelStepDueAt}; without this, correcting your level down is met by an offer to put it back up`
);

// ─── 5. The two one-time cards ───────────────────────────────────────────────
console.log('\n[5] The cards for the people who were already here');

const STORAGE_KEY = 'grow-app-storage';
/** A real cold start: version compare, migrate(), merge. */
async function rehydrateWith(state, version) {
  globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));
  await useAppStore.persist.rehydrate();
  return useAppStore.getState();
}
/** The last version released without any of this. */
const SHIPPED_VERSION = 37;
const BASE = { onboardingComplete: true, earnedBadges: [], completedSessions: [] };

check(
  'the persist version is above the one that shipped without these fields',
  useAppStore.persist.getOptions().version > SHIPPED_VERSION,
  'migrate() only runs when the stored number is lower, so without the bump none of this happens on a real phone'
);

let m = await rehydrateWith({ ...BASE, equipmentTiers: ['dumbbells'] }, SHIPPED_VERSION);
check(
  'an existing user is asked once to check their level',
  m.levelCheckCardPending === true,
  'their exercises have just changed on the strength of an old answer'
);
check(
  'and an existing home user is told once about the bench',
  m.benchPromptPending === true,
  'they answered the equipment question before the tile existed'
);

m = await rehydrateWith({ ...BASE, equipmentTiers: ['fullgym'] }, SHIPPED_VERSION);
check(
  'a full gym is not asked about a bench',
  m.benchPromptPending === false,
  'it has one'
);
m = await rehydrateWith({ ...BASE, equipmentTiers: ['dumbbells', 'bench'] }, SHIPPED_VERSION);
check(
  'and neither is somebody who already has one ticked',
  m.benchPromptPending === false,
  ''
);
m = await rehydrateWith({ ...BASE, onboardingComplete: false }, SHIPPED_VERSION);
check(
  'somebody who never finished signing up gets neither card',
  m.levelCheckCardPending === false && m.benchPromptPending === false,
  'they are about to be asked both questions properly'
);

m = await rehydrateWith(
  { ...BASE, equipmentTiers: ['dumbbells'], completedSessions: trainSessions(300) },
  SHIPPED_VERSION
);
check(
  'a long history is not handed an instant level step',
  m.levelStepDueAt === 316,
  `due at ${m.levelStepDueAt}; those 300 sessions were trained on a different catalogue`
);

freshAccount();
S().completeOnboarding(
  {
    name: 'Jo',
    sex: 'female',
    ageYears: 34,
    bodyweight: 68,
    weightUnit: 'kg',
    experienceLevel: 'intermediate',
    goals: ['strength'],
    equipmentTiers: ['dumbbells'],
    soreRegions: [],
    clinicalAvoid: [],
  },
  '2026-09-20T09:00:00.000Z'
);
check(
  'a new account sees neither card',
  S().levelCheckCardPending === false && S().benchPromptPending === false,
  'it was asked both questions in the pager minutes ago'
);
check(
  'and its clock starts at sixteen from nothing',
  S().levelStepDueAt === 16,
  `due at ${S().levelStepDueAt}`
);

freshAccount({ levelCheckCardPending: true, benchPromptPending: true });
S().dismissLevelCheckCard();
S().dismissBenchPrompt();
check(
  'dismissing either card puts it away for good',
  S().levelCheckCardPending === false && S().benchPromptPending === false,
  'one-time means one time'
);

freshAccount({ benchPromptPending: true });
S().setEquipmentTiers(['dumbbells', 'bench']);
check(
  'ticking the bench answers the card as well as dismissing it would',
  S().benchPromptPending === false,
  'the card is asking a question, and this is the answer'
);

freshAccount({ levelCheckCardPending: true, completedSessions: trainSessions(16) });
S().acceptLevelStep(1);
check(
  'acting on the level puts the level card away too',
  S().levelCheckCardPending === false,
  'it was asking them to check it, and they just did'
);

// ─── 6. A sign-in must not hand out a free level ─────────────────────────────
console.log('\n[6] Restoring a history moves the clock with it');

freshAccount({ completedSessions: trainSessions(4), levelStepDueAt: 20 });
S().mergeServerData({
  completedSessions: trainSessions(300, 'upper_body').map((s, i) => ({
    ...s,
    id: `server-${i}`,
  })),
});
check(
  'the due count rises by exactly the sessions the merge brought in',
  S().levelStepDueAt === 320,
  `due at ${S().levelStepDueAt} against ${S().completedSessions.length} sessions`
);
check(
  'so signing in on a new phone offers nobody a level step on their first session',
  levelStepOffer({
    experienceLevel: 'beginner',
    earnedLevelBonus: 0,
    liftingCount: S().completedSessions.length,
    levelStepDueAt: S().levelStepDueAt,
    programme: null,
  }) === null,
  `${S().completedSessions.length} sessions against a due count of ${S().levelStepDueAt}`
);

freshAccount({ completedSessions: trainSessions(4) });
useAppStore.setState({ levelStepDueAt: null });
S().mergeServerData({ completedSessions: trainSessions(6, 'upper_body') });
check(
  'and a payload that reaches an unstamped device stamps it',
  typeof S().levelStepDueAt === 'number' &&
    S().levelStepDueAt === 22,
  `due at ${S().levelStepDueAt}`
);

// ─── Result ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
