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
import { BADGE_MAP, BADGE_CATALOG, BADGE_CATEGORY_ORDER } from '../lib/badges.ts';
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
  'and they are near the top of the cabinet, not buried at the bottom',
  BADGE_CATEGORY_ORDER.indexOf('programme') <= 1,
  `programme is shelf ${BADGE_CATEGORY_ORDER.indexOf('programme') + 1}`
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

console.log('\n[7] The movement screen');

reset();
check('never answering the screen earns nothing for it', !has('screen_taken'), '');
st().setUserProfile({ screenPassed: [] });
check(
  // An empty array is somebody who took it and passed nothing, which is a real
  // answer and a different thing from never taking it.
  'answering it and passing nothing still counts as having taken it',
  has('screen_taken') && !has('screen_all_patterns'),
  ''
);
st().setUserProfile({ screenPassed: ['hinge', 'squat', 'lunge', 'push', 'pull', 'carry'] });
check('and passing all six is its own badge', has('screen_all_patterns'), '');

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
