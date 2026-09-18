/**
 * Contract test: the achievement system knows that programmes exist.
 *
 * WHAT WAS WRONG. lib/badge-engine.ts contained the word "programme" exactly
 * ZERO times, and not one of the 277 badges rewarded any part of the thing the
 * app is built around. A user could enrol in a programme, train it for twelve
 * sessions, sit through a planned easier week, finish the block, be handed a
 * frozen Programme Report and be offered a level step, and earn exactly ONE
 * badge for that entire arc - a session-count milestone that would have fired
 * whatever they had done.
 *
 * WHAT THIS GUARDS, and every one of them is a way it could quietly stop:
 *
 *   THE ENGINE CAN SEE THE BLOCK AT ALL. It takes a fixed snapshot, and a field
 *   missing from that snapshot is a family of badges that can never fire.
 *
 *   THEY ARRIVE ON THE RIGHT TICK. Badges were awarded BEFORE the block was
 *   archived, so a block badge would have landed one session late - the user
 *   finishes, reads the report, gets nothing, and is congratulated halfway
 *   through the next session.
 *
 *   EVERY PATH THAT CAN EARN ONE SAYS SO. Enrolling, switching, taking a rung
 *   and finishing the builder are not sessions, and none of them used to tell
 *   the engine anything had happened.
 *
 *   NOBODY GETS ONE FOR NOTHING. A brand new account earns none of them.
 *
 *   AND THE ENGINE NEVER THROWS. It is called from four new places now, one of
 *   which is changing programme. A badge engine that can crash is a badge engine
 *   that can stop somebody using the app.
 *
 * Run:  npx tsx tests/programme-badges.check.mjs
 */
globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { readFileSync } from 'fs';
import { useAppStore } from '../lib/store.ts';
import {
  ACTIVE_BADGES,
  BADGE_MAP,
  BADGE_CATALOG,
  BADGE_CATEGORY_ORDER,
  countedEarned,
  isRetiredBadge,
  visibleBadges,
} from '../lib/badges.ts';
import { evaluateBadges } from '../lib/badge-engine.ts';

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

const PROGRAMME_CATEGORIES = ['programme', 'progression'];
const family = BADGE_CATALOG.filter((b) => PROGRAMME_CATEGORIES.includes(b.category));

let seq = 0;
const session = (type, day) => ({
  sessionType: type,
  date: new Date(Date.parse('2026-06-01T09:00:00Z') + day * 86400000).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  painRegions: [],
  energy: 'good',
  timeAvailable: '45',
  exerciseCount: 1,
  durationSeconds: 2700,
  exerciseLogs: [
    {
      exerciseId: 'sq',
      exerciseName: 'Back Squat',
      targetReps: '5',
      category: 'main',
      feedbackRating: 'easy',
      sets: [
        { setNumber: 1, weight: 100 + ++seq, reps: 5, completed: true },
        { setNumber: 2, weight: 100 + seq, reps: 5, completed: true },
      ],
    },
  ],
});

const st = () => useAppStore.getState();
const reset = () => {
  seq = 0;
  st().resetProgress();
  useAppStore.setState({
    completedSessions: [],
    completedCount: 0,
    earnedBadges: [],
    newlyUnlockedBadges: [],
    completedProgrammes: [],
    pendingProgrammeReportId: null,
    programme: null,
  });
  st().setUserProfile({
    name: 'A',
    sex: 'male',
    experienceLevel: 'intermediate',
    goals: ['strength'],
    bodyweightKg: 82,
  });
};
const earnedHere = () =>
  st().earnedBadges.filter((id) => PROGRAMME_CATEGORIES.includes(BADGE_MAP.get(id)?.category));
const has = (id) => st().earnedBadges.includes(id);
/** Train the block's own next session, n times. */
const trainBlock = (n, from = 0, step = 2) => {
  for (let i = 0; i < n; i++) st().completeSession(session(st().getProgrammePosition().next, from + i * step));
};

console.log('\n[1] The family exists and is reachable');

check(
  'there are programme-era badges at all',
  family.length >= 15,
  `${family.length} found`
);
check(
  // A category missing from the order array never renders. The badges would
  // exist, be earned, and be invisible.
  'both shelves are in the order the screen renders',
  PROGRAMME_CATEGORIES.every((c) => BADGE_CATEGORY_ORDER.includes(c)),
  BADGE_CATEGORY_ORDER.slice(0, 4).join(', ')
);
check(
  /**
   * DIRECTLY BELOW MILESTONES, WHICH IS A CHANGE AND A DELIBERATE ONE.
   *
   * They used to open the cabinet, because a whole programme arc used to earn
   * exactly one badge and that was wrong. They are still high, and they are no
   * longer above the shelf a new account has already started filling: opening
   * on two shelves of entirely grey cards shows somebody what they have not
   * done before anything they have.
   */
  'and they sit directly below milestones, still near the top of the cabinet',
  BADGE_CATEGORY_ORDER.indexOf('milestone') === 0 &&
    BADGE_CATEGORY_ORDER.indexOf('programme') === 1 &&
    BADGE_CATEGORY_ORDER.indexOf('progression') === 2,
  BADGE_CATEGORY_ORDER.slice(0, 4).join(', ')
);
check(
  // Declaration order IS difficulty order - tierForPosition assigns colour by
  // position. Getting it backwards is how "Complete your first session" became
  // the rarest metal in the app.
  'the family climbs from bronze to Grow rather than starting rare',
  (() => {
    const order = { bronze: 0, silver: 1, gold: 2, grow: 3 };
    for (const c of PROGRAMME_CATEGORIES) {
      const tiers = BADGE_CATALOG.filter((b) => b.category === c).map((b) => order[b.tier]);
      if (tiers[0] !== 0) return false;
      if (tiers[tiers.length - 1] !== 3) return false;
      for (let i = 1; i < tiers.length; i++) if (tiers[i] < tiers[i - 1]) return false;
    }
    return true;
  })(),
  family.map((b) => `${b.name}:${b.tier}`).join(' | ')
);

console.log('\n[2] Nobody is given one for nothing');

reset();
check(
  'a brand new account has earned none of them',
  earnedHere().length === 0,
  earnedHere().join(', ')
);

console.log('\n[3] Every path that can earn one says so');

reset();
st().enrolInProgramme('barbell', '2026-06-01T09:00:00.000Z');
check(
  'enrolling in a programme earns the first one',
  has('programme_enrolled'),
  'enrolInProgramme never told the engine anything had happened'
);

console.log('\n[4] Finishing a block, on the right tick');

reset();
st().enrolInProgramme('barbell', '2026-06-01T09:00:00.000Z');
trainBlock(11);
const beforeLast = has('programme_block_1');
trainBlock(1, 22);
check(
  'the block badge is not earned before the block is finished',
  beforeLast === false,
  ''
);
check(
  /**
   * THE TIMING ASSERTION, and the reason a second award pass exists.
   *
   * Badges are evaluated inside completeSession BEFORE archiveIfBlockComplete
   * runs, and the block badges read the archive. Without a second pass after
   * the archive, this badge appears one session later - the user finishes the
   * block, opens their report, is congratulated for nothing, and is then told
   * about it halfway through the next session.
   */
  'and it IS earned on the very session that finishes it',
  has('programme_block_1'),
  'one session late is the worst possible timing for this one'
);
check(
  'the block really did archive on that session',
  st().completedProgrammes.length === 1,
  `${st().completedProgrammes.length} archived`
);
check(
  'a clean, well-paced block earns the adherence badges too',
  has('programme_pace') && has('programme_clean_block') && has('programme_no_long_gap'),
  earnedHere().join(', ')
);
check(
  'and the planned easier sessions it contained are counted',
  has('programme_deload_1'),
  `report says ${st().completedProgrammes[0]?.report?.deloadSessionsDone} easier sessions`
);

console.log('\n[5] The rungs');

const step = st().completedProgrammes[0]?.report?.step;
check(
  'being OFFERED a rung is not itself an achievement',
  step?.earned === true && !has('level_step_1'),
  'the report never applies a step by itself, so taking it is the moment'
);
st().acceptLevelStep(step.toBonus);
check(
  'taking it is',
  has('level_step_1'),
  'acceptLevelStep never told the engine anything had happened'
);

console.log('\n[6] A second block, and a different one');

st().switchProgramme('foundations', '2026-09-01T09:00:00.000Z');
trainBlock(12, 92);
check(
  'a second finished block is its own badge',
  has('programme_block_2'),
  earnedHere().join(', ')
);
check(
  'and finishing two DIFFERENT programmes is another',
  has('programme_two_shapes'),
  st().completedProgrammes.map((b) => b.templateId).join(', ')
);

// ─── Retired badges ─────────────────────────────────────────────────────────
//
// The two movement-screen badges used to be awarded here, and the screen they
// were for is gone. Deleting them from the catalogue is the tidy move and the
// wrong one: the ids stay in earnedBadges for everybody who won them, so a
// deleted badge unlocks as a blank card with no name and the count somebody has
// collected drops overnight. They are marked retired instead, which has to mean
// three separate things, tested here one at a time.
console.log('\n[7] A retired badge is kept, not awarded, and counted by nothing');

const retired = BADGE_CATALOG.filter((b) => b.retired);

check(
  'there are retired badges to test, and the movement screen ones are among them',
  retired.length >= 2 &&
    ['screen_taken', 'screen_all_patterns'].every((id) => isRetiredBadge(id)),
  retired.map((b) => b.id).join(', ')
);

check(
  /**
   * AND THE ENGINE REFUSES ONE EVEN WHEN A RULE ASKS FOR IT.
   *
   * Removing the award site is the real fix and it is not a durable one: the
   * next person to write a rule near it can hand out a badge for a thing the
   * app no longer does. evaluateBadges gates every award on the catalogue, so
   * this drives a full evaluation of the two-block account section 6 just
   * built, which is the busiest state this file produces, and asserts nothing
   * retired comes out of it.
   */
  'a full evaluation of a busy account never produces one',
  (() => {
    const s = useAppStore.getState();
    const out = evaluateBadges({
      completedSessions: s.completedSessions,
      oneRepMaxes: s.oneRepMaxes,
      userProfile: {
        ...s.userProfile,
        screenPassed: ['hinge', 'squat', 'lunge', 'push', 'pull', 'carry'],
        patternChecks: { squat: true, pull: true },
      },
      profilePhotoUri: null,
      equipmentTiers: ['fullgym'],
      bodyweightUpdatedAt: new Date().toISOString(),
      onboardingComplete: true,
      tourGenuinelyCompleted: true,
      weeklyStreakGoal: 2,
      completedProgrammes: s.completedProgrammes,
      programme: s.programme,
    });
    return out.length > 10 && out.every((id) => !isRetiredBadge(id));
  })(),
  ''
);

reset();
check(
  // The profile fields the screen wrote are still on UserProfile, inert. If the
  // engine ever reads one again, this is what catches it.
  'and a profile still carrying a full movement screen earns nothing for it',
  (() => {
    st().setUserProfile({
      screenPassed: ['hinge', 'squat', 'lunge', 'push', 'pull', 'carry'],
      patternChecks: { squat: true, pull: true },
    });
    return retired.every((b) => !has(b.id));
  })(),
  st().earnedBadges.filter((id) => isRetiredBadge(id)).join(', ')
);
check(
  // Nobody is shown a locked card for something that cannot be done any more.
  'a retired badge nobody earned is not on any shelf',
  visibleBadges(new Set()).every((b) => !b.retired),
  ''
);
check(
  'and one they DID earn is still there, with its name and its metal intact',
  (() => {
    const shown = visibleBadges(new Set(['screen_taken']));
    const kept = shown.find((b) => b.id === 'screen_taken');
    return (
      !!kept &&
      kept.name === BADGE_MAP.get('screen_taken').name &&
      kept.tier === BADGE_MAP.get('screen_taken').tier &&
      !shown.some((b) => b.id === 'screen_all_patterns')
    );
  })(),
  'taking a badge off somebody is worse than the tidy catalogue is worth'
);
check(
  // Every "x of y" in the app is measured against this list.
  'nothing retired is in the set the totals are measured against',
  ACTIVE_BADGES.every((b) => !b.retired) &&
    ACTIVE_BADGES.length === BADGE_CATALOG.length - retired.length,
  `${ACTIVE_BADGES.length} of ${BADGE_CATALOG.length}`
);
check(
  /**
   * AND THE OTHER HALF OF THE HEADLINE FIGURE IS MEASURED THE SAME WAY.
   *
   * The denominator on the Achievements screen leaves retired badges out. If
   * the numerator counted one, somebody who had earned a retired badge would
   * be shown a total larger than the number of badges in the app - "278 of
   * 277" - which is the arithmetic this asserts cannot happen.
   */
  'a retired badge somebody earned is counted in neither half of "x of y"',
  (() => {
    const active = ACTIVE_BADGES.map((b) => b.id).slice(0, 3);
    return (
      countedEarned([...active, 'screen_taken', 'screen_all_patterns']) === active.length &&
      countedEarned(['screen_taken']) === 0 &&
      countedEarned(active) === active.length &&
      countedEarned([]) === 0
    );
  })(),
  'the denominator excludes them, so the numerator has to as well'
);
check(
  /**
   * RETIRING ONE MUST NOT RE-COLOUR THE BADGES AROUND IT.
   *
   * Tiers are assigned by POSITION within a family, so dropping a seed out of
   * the array would shift every badge after it up a slot and change its metal.
   * Keeping the seed in place with a flag on it is what avoids that, and this
   * is the assertion that says so: the Moving Up shelf still runs bronze to
   * Grow without a gap or a step backwards.
   */
  'and the shelf a retired badge sits on still climbs bronze to Grow',
  (() => {
    const order = { bronze: 0, silver: 1, gold: 2, grow: 3 };
    const shelf = BADGE_CATALOG.filter((b) => b.category === 'progression').map(
      (b) => order[b.tier]
    );
    if (shelf.length === 0 || shelf[0] !== 0 || shelf[shelf.length - 1] !== 3) return false;
    for (let i = 1; i < shelf.length; i++) if (shelf[i] < shelf[i - 1]) return false;
    return true;
  })(),
  BADGE_CATALOG.filter((b) => b.category === 'progression')
    .map((b) => `${b.id}:${b.tier}`)
    .join(' | ')
);

console.log('\n[8] The engine never throws');

check(
  // It is called from four new places now, one of which is changing programme.
  'a state with no programme fields at all does not crash it',
  (() => {
    try {
      evaluateBadges({
        completedSessions: [],
        oneRepMaxes: [],
        userProfile: null,
        profilePhotoUri: null,
        equipmentTiers: [],
        bodyweightUpdatedAt: null,
        onboardingComplete: true,
        tourGenuinelyCompleted: false,
        weeklyStreakGoal: 2,
      });
      return true;
    } catch {
      return false;
    }
  })(),
  'a badge engine that throws can stop somebody changing programme'
);
check(
  'and neither does a session with no exercise logs',
  (() => {
    try {
      evaluateBadges({
        completedSessions: [{ id: 'x', sessionType: 'squat', date: '2026-06-01T09:00:00.000Z', equipmentTier: 'fullgym' }],
        oneRepMaxes: [],
        userProfile: { name: 'A', sex: 'male', experienceLevel: 'intermediate', goals: [], bodyweightKg: 80 },
        profilePhotoUri: null,
        equipmentTiers: [],
        bodyweightUpdatedAt: null,
        onboardingComplete: true,
        tourGenuinelyCompleted: false,
        weeklyStreakGoal: 2,
        programme: null,
        completedProgrammes: [],
      });
      return true;
    } catch (e) {
      return false;
    }
  })(),
  ''
);

console.log('\n[9] The celebration is not a parade');

check(
  // One at a time at 3.2 seconds each. A first ever session unlocks eight
  // badges, so the reward for finishing it was 26 seconds of banners in the
  // engine's internal push order.
  'the summary shows the rarest few rather than the whole queue',
  (() => {
    const src = readFileSync(new URL('../app/session-summary.tsx', import.meta.url), 'utf8');
    return /MAX_SESSION_BANNERS/.test(src) && /order\[a\.tier\] - order\[b\.tier\]/.test(src);
  })(),
  'finishing a block would otherwise share a queue with "Complete 10 sessions" said four ways'
);

console.log(`\nprogramme-badges: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
