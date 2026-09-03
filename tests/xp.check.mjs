/**
 * Contract test: XP, and the level it adds up to.
 *
 * WHAT THIS GUARDS, and why each of them is a way a progress number goes wrong:
 *
 *   IT ONLY EVER GOES UP. A level that can be taken away is worse than no level
 *   at all, and five different places call awardXp.
 *
 *   IT IS NOT THE OTHER LEVELS. This app already had three things called a
 *   level - the exercise ladders that decide what you are PRESCRIBED, the
 *   experience answer, and badge tiers. XP must never reach any of them. That
 *   separation is what makes it safe to gamify at all: a number that changed
 *   your prescription would push people to chase it, and pushing a rehab client
 *   to chase a number is the opposite of the job.
 *
 *   THE DELOAD IS NOT PUNISHED. Backing off when the plan says to is the
 *   hardest thing to get somebody to do. An XP table that quietly paid less for
 *   an easier session would be arguing against the programme.
 *
 *   A SESSION IS FROZEN AT WHAT IT PAID. Retuning the table must not move
 *   somebody's level underneath them months later.
 *
 *   AND NOBODY ARRIVES AT LEVEL 1 WITH A YEAR BEHIND THEM. There is exactly one
 *   moment to backfill an existing user and it is the migration.
 *
 * Run:  npx tsx tests/xp.check.mjs
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import './_persist-shim.mjs';
import {
  xpForLevel,
  xpStanding,
  sessionXp,
  xpBandName,
  XP,
  XP_BY_BADGE_TIER,
  MAX_XP_LEVEL,
} from '../lib/xp.ts';
import { useAppStore } from '../lib/store.ts';

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
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

console.log('\n[1] The curve');

check(
  'level 1 costs nothing, so a new account is on it',
  xpForLevel(1) === 0 && xpStanding(0).level === 1,
  ''
);
check(
  'every level costs more than the one before it',
  (() => {
    for (let n = 2; n < MAX_XP_LEVEL; n++) {
      const thisCost = xpForLevel(n + 1) - xpForLevel(n);
      const prevCost = xpForLevel(n) - xpForLevel(n - 1);
      if (thisCost <= prevCost) return false;
    }
    return true;
  })(),
  'a curve that flattens turns into a treadmill'
);
check(
  'the standing never reports more XP into a level than the level costs',
  (() => {
    for (let xp = 0; xp < 30000; xp += 137) {
      const s = xpStanding(xp);
      if (!s.atCeiling && (s.into > s.span || s.into < 0)) return false;
      if (s.fraction < 0 || s.fraction > 1) return false;
    }
    return true;
  })(),
  ''
);
check(
  'and it stops at the ceiling rather than reporting a level nobody can reach',
  (() => {
    const s = xpStanding(xpForLevel(MAX_XP_LEVEL) + 500000);
    return s.level === MAX_XP_LEVEL && s.atCeiling && s.toNext === 0 && s.fraction === 1;
  })(),
  JSON.stringify(xpStanding(xpForLevel(MAX_XP_LEVEL) + 500000))
);
check(
  // Rubbish in must not produce a level.
  'nonsense totals are treated as nothing',
  xpStanding(NaN).level === 1 && xpStanding(-5000).level === 1 && xpStanding(Infinity).level >= 1,
  ''
);
check(
  'every level has a band name',
  (() => {
    for (let n = 1; n <= MAX_XP_LEVEL; n++) if (!xpBandName(n)) return false;
    return true;
  })(),
  ''
);

console.log('\n[2] What a session is worth');

check(
  'a plain session is worth the same whatever kind it was',
  sessionXp({ sets: 0 }).total === XP.session,
  'a rehab user doing twenty minutes of prehab did the thing the app asked'
);
check(
  'more sets is worth more, up to a cap',
  (() => {
    const few = sessionXp({ sets: 5 }).total;
    const many = sessionXp({ sets: 30 }).total;
    const absurd = sessionXp({ sets: 300 }).total;
    return many > few && absurd === many + 0 * 1 && absurd === XP.session + XP.maxSetBonus;
  })(),
  `${sessionXp({ sets: 300 }).total} for 300 sets`
);
check(
  /**
   * THE ONE VALUE JUDGEMENT IN THE WHOLE TABLE. An easier session pays exactly
   * what a hard one does. Paying less would have the XP table arguing against
   * the deload the programme just prescribed.
   */
  'a planned easier session pays the same as an on-plan hard one',
  XP.deload === XP.onPlan &&
    sessionXp({ sets: 10, deload: true }).total === sessionXp({ sets: 10, onPlan: true }).total,
  ''
);
check(
  'and it pays once, not twice, when it is both',
  sessionXp({ sets: 10, onPlan: true, deload: true }).total ===
    sessionXp({ sets: 10, deload: true }).total,
  'a deload session IS an on-plan session'
);
check(
  'finishing a block is the biggest single thing in the table',
  XP.blockComplete > Math.max(XP.session, XP.testSession, XP.personalBest, XP.levelStep) * 2,
  `${XP.blockComplete}`
);
check(
  'the lines always add up to the total',
  (() => {
    const cases = [
      { sets: 0 },
      { sets: 12, onPlan: true },
      { sets: 20, deload: true, personalBests: 2 },
      { sets: 18, onPlan: true, testSession: true, personalBests: 1, blockComplete: true },
    ];
    return cases.every((c) => {
      const r = sessionXp(c);
      return r.lines.reduce((n, l) => n + l.amount, 0) === r.total;
    });
  })(),
  'the summary prints them as a receipt, so a column that does not sum is a bug'
);
check(
  'nonsense inputs cannot produce a negative or a fractional award',
  (() => {
    const r = sessionXp({ sets: -50, personalBests: -3 });
    return r.total >= 0 && Number.isInteger(r.total);
  })(),
  ''
);

console.log('\n[3] It is not any of the other levels');

/**
 * STRIP THE COMMENTS FIRST.
 *
 * This repo comments heavily and deliberately, so a check that greps for a
 * forbidden NAME finds the paragraph explaining why it is forbidden and fails
 * on its own documentation. Both assertions below did exactly that on the first
 * run - xp.ts names exercise-levels.ts and the ladder bands in prose, precisely
 * to say that it must never touch them.
 */
const stripComments = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

check(
  // The separation the whole design rests on.
  'nothing in the XP module reaches the exercise ladders or the experience answer',
  (() => {
    const src = stripComments(read('lib/xp.ts'));
    return (
      !/exercise-levels/.test(src) &&
      !/experienceLevel/.test(src) &&
      !/earnedLevelBonus/.test(src) &&
      !/patternCeiling/.test(src)
    );
  })(),
  'a number that decided the prescription would be a number people chase'
);
check(
  'and the band names are not the ladder names',
  (() => {
    // "Foundations" and "Elite" belong to what you are PRESCRIBED. Reusing them
    // would tell somebody their sessions had changed when nothing had.
    const src = stripComments(read('lib/xp.ts'));
    return !/Foundations/.test(src) && !/Elite/.test(src);
  })(),
  ''
);

console.log('\n[4] Through the store');

const CYCLE = ['squat', 'bench', 'deadlift'];
let seq = 0;
const session = (type, sets = 3) => ({
  sessionType: type,
  date: new Date(Date.parse('2026-06-01T09:00:00Z') + seq++ * 2 * 86400000).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  painRegions: [],
  energy: 'good',
  timeAvailable: '45',
  exerciseCount: 1,
  durationSeconds: 2700,
  exerciseLogs: [
    {
      exerciseId: 'x',
      exerciseName: 'Back Squat',
      targetReps: '5',
      category: 'main',
      sets: Array.from({ length: sets }, () => ({
        weight: 100,
        reps: 5,
        completed: true,
        skipped: false,
      })),
    },
  ],
});

useAppStore.getState().resetProgress();
useAppStore.setState({ completedSessions: [], completedCount: 0, xpTotal: 0, earnedBadges: [] });
useAppStore.getState().setUserProfile({
  name: 'A',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['strength'],
  bodyweightKg: 82,
});

const before = useAppStore.getState().xpTotal;
useAppStore.getState().completeSession(session('squat'));
const afterOne = useAppStore.getState().xpTotal;

check('finishing a session earns XP', afterOne > before, `${before} -> ${afterOne}`);
check(
  'and the session carries what it paid, frozen onto it',
  (useAppStore.getState().completedSessions[0].xpEarned ?? 0) > 0,
  `${useAppStore.getState().completedSessions[0].xpEarned}`
);
check(
  // Five call sites, and a negative reaching any of them takes a level off
  // somebody.
  'XP can never be taken away',
  (() => {
    const at = useAppStore.getState().xpTotal;
    useAppStore.getState().awardXp(-9999);
    useAppStore.getState().awardXp(NaN);
    return useAppStore.getState().xpTotal === at;
  })(),
  ''
);
check(
  'a badge unlock pays on top of the session',
  (() => {
    // The first session unlocks several badges, so the total has to exceed what
    // the session alone was worth.
    const paid = useAppStore.getState().completedSessions[0].xpEarned ?? 0;
    return afterOne > paid;
  })(),
  `session paid ${useAppStore.getState().completedSessions[0].xpEarned}, total ${afterOne}`
);
check(
  'and the tiers are ordered, so a rarer badge is always worth more',
  XP_BY_BADGE_TIER.bronze < XP_BY_BADGE_TIER.silver &&
    XP_BY_BADGE_TIER.silver < XP_BY_BADGE_TIER.gold &&
    XP_BY_BADGE_TIER.gold < XP_BY_BADGE_TIER.grow,
  JSON.stringify(XP_BY_BADGE_TIER)
);

console.log('\n[5] Nobody arrives at level 1 with a year behind them');

const migrate = useAppStore.persist.getOptions().migrate;

check(
  'an existing account is backfilled from the sessions it already has',
  (() => {
    const sessions = Array.from({ length: 100 }, (_, i) => ({
      id: 's' + i,
      sessionType: CYCLE[i % 3],
      date: new Date(Date.parse('2025-01-01T09:00:00Z') + i * 3 * 86400000).toISOString(),
      exerciseLogs: [
        {
          exerciseId: 'x',
          sets: Array.from({ length: 12 }, () => ({ weight: 100, reps: 5, completed: true })),
        },
      ],
    }));
    const out = migrate({ completedSessions: sessions, earnedBadges: ['milestone_1'] }, 32);
    return xpStanding(out.xpTotal).level >= 10;
  })(),
  'a hundred sessions has to read as more than "Getting started"'
);
check(
  'each of their old sessions gets its own figure, so the history is not blank',
  (() => {
    const out = migrate(
      {
        completedSessions: [
          { id: 'a', exerciseLogs: [{ exerciseId: 'x', sets: [{ completed: true }] }] },
        ],
        earnedBadges: [],
      },
      32
    );
    return (out.completedSessions[0].xpEarned ?? 0) > 0;
  })(),
  ''
);
check(
  'a brand new account still starts at nothing',
  migrate({ completedSessions: [], earnedBadges: [] }, 32).xpTotal === 0,
  ''
);
check(
  // Running it twice must not double somebody's level.
  'and an account that already has a total is left alone',
  migrate({ completedSessions: [], earnedBadges: [], xpTotal: 4321 }, 32).xpTotal === 4321,
  ''
);

console.log('\n[6] It appears in two places, and no more');

check(
  'the session summary shows what was earned',
  /SessionXpPanel/.test(read('app/session-summary.tsx')),
  ''
);
check(
  'the profile shows the standing',
  /LevelRing/.test(read('app/(tabs)/profile.tsx')),
  ''
);
check(
  // The brief was "definitely not overbearing". Home is also the screen that
  // must not scroll, so this doubles as a fit guard.
  'and Home does not, so nothing was added to the screen that cannot grow',
  !/LevelRing|xpTotal|SessionXpPanel/.test(read('app/(tabs)/index.tsx')),
  'Home is sized not to scroll'
);
check(
  'nothing pops XP mid-session',
  !/xp|XP/.test(
    read('app/session.tsx')
      .split('\n')
      .filter((l) => /awardXp|SessionXpPanel|LevelRing/.test(l))
      .join('\n')
  ),
  'the summary is the moment, not the set'
);

console.log(`\nxp: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
