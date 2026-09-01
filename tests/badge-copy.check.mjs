/**
 * Contract test: every badge says what actually earns it.
 *
 * WHY THIS MATTERS
 * ────────────────
 * A badge is a promise printed on a card, and the rule behind it lives in a
 * completely different file. Nothing connects them, nothing typechecks them,
 * and a wrong one fails in the quietest way there is: the user reads the card,
 * does what it says, and gets nothing. There are 277 of them.
 *
 * Seven were wrong when this file was written, and every one was found by
 * RUNNING the engine rather than reading it:
 *
 *   "Set a new 1RM personal best" was awarded for HAVING two 1RM entries.
 *   Onboarding writes up to three of them before you have trained at all.
 *
 *   "Complete 10 sessions before 9am" counted sessions before SEVEN.
 *
 *   "Train every single day of a calendar week" was seven sessions in a week.
 *   Four on Monday and three on Tuesday earned it.
 *
 *   "Train at least 2x per week" was really the user's own weekly goal, which
 *   they can set to four.
 *
 *   "Complete at least one Squat Session, Bench Session, and Deadlift Session"
 *   was awarded to somebody who had done none of them, because the engine
 *   reads the shared lower/upper/full buckets.
 *
 *   "Complete 10 sessions targeting muscle" counted ten stretching sessions.
 *
 *   "Complete at least 5 sessions of every type" could not be earned at all by
 *   anyone training in the weekly format.
 *
 * So this file does not compare copy to copy. It builds the history each badge
 * describes, runs evaluateBadges over it, and checks what came back.
 *
 * Run:  npx tsx tests/badge-copy.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { evaluateBadges } from '../lib/badge-engine.ts';
import { BADGE_CATALOG, BADGE_MAP } from '../lib/badges.ts';

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
const engineSrc = read('lib/badge-engine.ts');

const DAY = 86400000;
const BASE = {
  oneRepMaxes: [],
  userProfile: {
    name: 'Probe',
    sex: 'male',
    experienceLevel: 'intermediate',
    goals: ['muscle'],
    bodyweightKg: 80,
  },
  profilePhotoUri: null,
  equipmentTiers: ['fullgym'],
  bodyweightUpdatedAt: null,
  onboardingComplete: true,
  tourGenuinelyCompleted: false,
  weeklyStreakGoal: 2,
};
let seq = 0;
const sess = (over = {}) => ({
  id: 'p' + seq++,
  sessionType: 'squat',
  date: new Date().toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  painRegions: [],
  energy: 'good',
  timeAvailable: '60',
  exerciseCount: 5,
  durationSeconds: 2700,
  exerciseLogs: [],
  ...over,
});
/** Does this history earn this badge? */
const earns = (state, id) => evaluateBadges({ ...BASE, ...state }).includes(id);
const descOf = (id) => BADGE_MAP.get(id)?.description ?? '';
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
const dateAgo = (n) => daysAgo(n).slice(0, 10);

// ─── 1. Every badge is reachable, and nothing is awarded that does not exist ──
console.log('\n[1] The catalogue and the engine describe the same set of badges');

/**
 * Badge ids the engine can award.
 *
 * Nearly all of them are written as string literals at the award site. One is
 * not: TOUR_WELCOME_BADGE_ID, pulled into a named constant in lib/badges.ts so
 * the engine, the award site in app/session.tsx and the root layout's
 * "which unlock is this" comparison cannot drift onto three spellings of the
 * same string. So identifiers are followed back to their definition rather than
 * being read as unreachable.
 */
const literals = new Set([...engineSrc.matchAll(/'([a-z0-9_]+)'\s*\)\s*;/g)].map((m) => m[1]));
const badgesSrc = readFileSync(new URL('../lib/badges.ts', import.meta.url), 'utf8');
for (const [, ident] of engineSrc.matchAll(/awardIf\([^;]*?,\s*([A-Z][A-Z0-9_]+)\s*\)\s*;/g)) {
  const def = badgesSrc.match(new RegExp(`\\b${ident}\\s*=\\s*'([a-z0-9_]+)'`));
  if (def) literals.add(def[1]);
}
const templates = [...engineSrc.matchAll(/`([^`]*\$\{[^`]*)`/g)].map((m) => m[1]);
const tmplRe = templates.map(
  (t) => new RegExp('^' + t.replace(/\$\{[^}]+\}/g, '[a-z0-9_]+') + '$')
);
const awardable = (id) => literals.has(id) || tmplRe.some((r) => r.test(id));

check(
  `the catalogue has ${BADGE_CATALOG.length} badges and no duplicate ids`,
  new Set(BADGE_CATALOG.map((b) => b.id)).size === BADGE_CATALOG.length,
  'a duplicate id means one of the two can never be shown'
);
const unreachable = BADGE_CATALOG.filter((b) => !awardable(b.id));
check(
  'every badge in the cabinet can actually be won',
  unreachable.length === 0,
  `the engine never awards: ${unreachable.map((b) => b.id).join(', ')}`
);
const catalogueIds = new Set(BADGE_CATALOG.map((b) => b.id));
const orphans = [...literals].filter((l) => l.includes('_') && !catalogueIds.has(l));
check(
  'and the engine awards nothing that is not in the cabinet',
  orphans.length === 0,
  `awarded but missing from the catalogue: ${orphans.join(', ')} - these unlock as blank`
);

// ─── 2. The number on the card is the number in the rule ─────────────────────
console.log('\n[2] Where a badge names a number, it is the engine\'s number');

/**
 * The threshold is read off the engine where the award is a one-liner, and off
 * the id otherwise (the templated families - milestones, streaks, session
 * buckets, strength percentages - build the id FROM the threshold, so it cannot
 * disagree there).
 *
 * Thresholds of 1 are skipped: those badges say "your first" or "a session",
 * which is right, and a rule demanding the digit would be demanding worse copy.
 */
const thresholds = new Map();
for (const m of engineSrc.matchAll(/awardIf\(([^;]*?)>=\s*([\d_]+)[^;]*?'([a-z0-9_]+)'\s*\)/g)) {
  thresholds.set(m[3], Number(m[2].replace(/_/g, '')));
}
check(
  `thresholds were read for ${thresholds.size} badges`,
  thresholds.size >= 40,
  'the awardIf shape has changed and this section has gone blind'
);

const mismatched = [];
for (const b of BADGE_CATALOG) {
  const idNums = (b.id.match(/\d+/g) ?? []).map(Number);
  const n = thresholds.get(b.id) ?? (idNums.length ? idNums[idNums.length - 1] : null);
  if (n == null || n <= 1) continue;
  const desc = b.description.replace(/,/g, '');
  if (!new RegExp(`\\b${n}\\b`).test(desc)) mismatched.push(`${b.id} wants ${n}: "${b.description}"`);
}
check(
  'no badge prints a number the engine does not use',
  mismatched.length === 0,
  mismatched.join(' | ')
);

// ─── 3. The seven that were wrong ────────────────────────────────────────────
console.log('\n[3] The claims that were wrong, each proved against the engine');

// 3a. Personal Best has to be a personal best.
const twoTypedAtOnboarding = {
  completedSessions: [sess()],
  oneRepMaxes: [
    { lift: 'squat', weight: 140, reps: 1, date: dateAgo(0), unit: 'kg' },
    { lift: 'bench', weight: 100, reps: 1, date: dateAgo(0), unit: 'kg' },
  ],
};
check(
  'two maxes typed during onboarding do not earn "Personal Best"',
  !earns(twoTypedAtOnboarding, 'goal_strength_pb'),
  `onboarding writes up to three 1RMs before the user has trained; "${descOf('goal_strength_pb')}" must mean something happened`
);
check(
  'beating your first entry does earn it',
  earns(
    {
      completedSessions: [sess()],
      oneRepMaxes: [
        { lift: 'squat', weight: 140, reps: 1, date: dateAgo(30), unit: 'kg' },
        { lift: 'squat', weight: 145, reps: 1, date: dateAgo(0), unit: 'kg' },
      ],
    },
    'goal_strength_pb'
  ),
  'tightening the rule must not make the badge unreachable'
);
check(
  'a lighter follow-up test does not',
  !earns(
    {
      completedSessions: [sess()],
      oneRepMaxes: [
        { lift: 'squat', weight: 140, reps: 1, date: dateAgo(30), unit: 'kg' },
        { lift: 'squat', weight: 135, reps: 1, date: dateAgo(0), unit: 'kg' },
      ],
    },
    'goal_strength_pb'
  ),
  ''
);
check(
  'and a personal best followed by a bad day still counts',
  earns(
    {
      completedSessions: [sess()],
      oneRepMaxes: [
        { lift: 'squat', weight: 140, reps: 1, date: dateAgo(60), unit: 'kg' },
        { lift: 'squat', weight: 150, reps: 1, date: dateAgo(30), unit: 'kg' },
        // BELOW the first entry, so reading 'latest' instead of 'best' loses the
        // personal best that did happen in between.
        { lift: 'squat', weight: 135, reps: 1, date: dateAgo(0), unit: 'kg' },
      ],
    },
    'goal_strength_pb'
  ),
  'measured against the best entry after the first, not the latest one'
);

// 3b. The morning badges count sessions before the hour they name.
const MORNING_HOUR = Number(/if \(hour < (\d+)\) earlySessionCount\+\+/.exec(engineSrc)?.[1] ?? NaN);
check(
  `the engine's morning cutoff was found (${MORNING_HOUR}:00)`,
  Number.isFinite(MORNING_HOUR),
  'without it the next check proves nothing'
);
check(
  'the morning badges name the hour the engine actually uses',
  new RegExp(`\\b${MORNING_HOUR}am\\b`).test(descOf('consistent_morning_10')) &&
    new RegExp(`\\b${MORNING_HOUR}am\\b`).test(descOf('consistent_morning_30')),
  `engine counts before ${MORNING_HOUR}:00, card says "${descOf('consistent_morning_10')}" - somebody training at 8am was reading a badge that will never count them`
);

// 3c. Perfect Week is seven SESSIONS, not seven days.
//
// BOTH FIXTURE DAYS HAVE TO SIT INSIDE THE CURRENT WEEK. Weeks start on
// Monday (lib/utils.ts startOfWeek, the badge engine's isoWeek, and the
// calendar grid all agree). Hard-coding "yesterday and the day before" put one
// or both of them in the PREVIOUS week every Monday and Tuesday, so only four
// of the seven sessions counted, the badge was not earned, and this check
// inverted and failed for a reason that has nothing to do with badge copy.
//
// Picking the two most recent in-week days keeps the thing being tested
// intact - seven sessions spread over FEWER than seven days - on every day of
// the week. On a Monday both groups land on the same day, which tests it
// harder rather than less.
const weekStartMs = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay() || 7; // 1 = Mon … 7 = Sun
  d.setDate(d.getDate() - (dow - 1));
  return d.getTime();
})();
const inThisWeek = (n) => Date.now() - n * DAY >= weekStartMs;
const dayA = inThisWeek(1) ? 1 : 0;
const dayB = inThisWeek(2) ? 2 : dayA;
const sevenOnTwoDays = [
  ...Array.from({ length: 4 }, () => sess({ date: daysAgo(dayA) })),
  ...Array.from({ length: 3 }, () => sess({ date: daysAgo(dayB) })),
];
check(
  'the fixture for it lands inside the current week, whatever day this is run',
  inThisWeek(dayA) && inThisWeek(dayB),
  'otherwise the check below is answering a question about week boundaries'
);
check(
  'the "perfect week" badge is not described as a session every day',
  earns({ completedSessions: sevenOnTwoDays }, 'consistent_7x_1wk')
    ? !/every( single)? day/i.test(descOf('consistent_7x_1wk'))
    : /every( single)? day/i.test(descOf('consistent_7x_1wk')),
  `four sessions on one day and three on the next earns it, so "${descOf('consistent_7x_1wk')}" has to describe a count`
);

// 3d. The streak threshold is the user's own weekly goal.
const threeAWeekForFour = [];
for (let w = 0; w < 4; w++)
  for (let i = 0; i < 3; i++) threeAWeekForFour.push(sess({ date: daysAgo(w * 7 + i) }));
const atGoalTwo = earns({ completedSessions: threeAWeekForFour, weeklyStreakGoal: 2 }, 'streak_2wk');
const atGoalFour = earns({ completedSessions: threeAWeekForFour, weeklyStreakGoal: 4 }, 'streak_2wk');
check(
  'the streak really does follow the weekly goal, not a fixed number',
  atGoalTwo && !atGoalFour,
  'if this stops being true the streak copy has to change back'
);
check(
  'so no streak badge promises a fixed number of sessions per week',
  BADGE_CATALOG.filter((b) => b.category === 'streak').every(
    (b) => !/\d\s*[x×]\s*per week/i.test(b.description)
  ),
  `"${descOf('streak_2wk')}" - somebody who set their goal to four trains three times a week and earns nothing`
);

// 3e. Triple Threat reads the shared buckets.
const weeklyFormatOnly = [
  sess({ sessionType: 'lower_body' }),
  sess({ sessionType: 'upper_body' }),
  sess({ sessionType: 'full_body' }),
];
check(
  'a weekly-format user earns Triple Threat, and the card does not name the KPI sessions',
  earns({ completedSessions: weeklyFormatOnly }, 'exercise_all_three_lifts') &&
    !/squat session|bench session|deadlift session/i.test(descOf('exercise_all_three_lifts')),
  `"${descOf('exercise_all_three_lifts')}" - it is awarded to people who have done none of those three`
);

// 3f. The goal badges that run on total sessions do not claim to be specific.
const tenStretches = Array.from({ length: 10 }, (_, i) =>
  sess({ sessionType: 'flexibility', date: daysAgo(i) })
);
check(
  'the muscle-goal badges do not claim to count muscle sessions',
  earns({ completedSessions: tenStretches }, 'goal_muscle_10')
    ? !/targeting muscle|muscle session/i.test(descOf('goal_muscle_10'))
    : true,
  `ten flexibility sessions earn it, so "${descOf('goal_muscle_10')}" cannot say what it counts`
);

// 3g. Jack of All is reachable in either session format.
const sixOfEach = (types) =>
  types.flatMap((t) => Array.from({ length: 6 }, (_, i) => sess({ sessionType: t, date: daysAgo(i) })));
check(
  'Jack of All can be earned in the weekly format',
  earns(
    {
      completedSessions: sixOfEach([
        'lower_body',
        'upper_body',
        'full_body',
        'conditioning',
        'prehab',
        'flexibility',
        'custom',
      ]),
    },
    'goal_fitness_all'
  ),
  `"${descOf('goal_fitness_all')}" was unreachable for anyone who trains Lower/Upper/Full instead of Squat/Bench/Deadlift`
);
check(
  'and still in the KPI format',
  earns(
    {
      completedSessions: sixOfEach([
        'squat',
        'bench',
        'deadlift',
        'conditioning',
        'prehab',
        'flexibility',
        'custom',
      ]),
    },
    'goal_fitness_all'
  ),
  'the change had to be strictly more permissive'
);
check(
  'while missing a type still blocks it',
  !earns(
    {
      completedSessions: sixOfEach([
        'squat',
        'bench',
        'deadlift',
        'conditioning',
        'prehab',
        'flexibility',
      ]),
    },
    'goal_fitness_all'
  ),
  '"every type" has to mean every type'
);

// ─── 4. The locked hint cannot contradict the card it sits under ─────────────
console.log('\n[4] The hint on a locked badge is true of every badge in its family');

/**
 * One hint is shared by a whole criteriaType, and the members of a criteriaType
 * have different numbers. The duration hint read "Complete a longer session (45
 * or 60 min) to unlock" - printed directly beneath Quick & Dirty, which asks
 * for thirty-minute sessions. A hint carrying a number is the bug.
 */
const achievements = read('app/achievements.tsx');
const hintBlock = achievements.slice(
  achievements.indexOf('session_count:'),
  achievements.indexOf('exercise_specific:') + 200
);
const hints = [...hintBlock.matchAll(/^\s*([a-z_]+):\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]);
check(
  `the locked-badge hints were found (${hints.length})`,
  hints.length >= 15,
  'the hint map has moved and this section has gone blind'
);
// "1RM" is the name of a thing, not a threshold, so it does not count as a
// number here. Everything else does.
const numbered = hints.filter(([, text]) => /\d/.test(text.replace(/1RMs?/g, 'max')));
check(
  'no hint names a number',
  numbered.length === 0,
  `${numbered.map(([k, t]) => `${k}: "${t}"`).join(' | ')} - one hint covers a whole family, and its members ask for different numbers`
);
const hintTypes = new Set(hints.map(([k]) => k));
const uncovered = [...new Set(BADGE_CATALOG.map((b) => b.criteriaType))].filter(
  (t) => !hintTypes.has(t)
);
check(
  'every criteria type has a hint',
  uncovered.length === 0,
  `no hint for: ${uncovered.join(', ')} - those badges lock with nothing to say`
);

// ─── 5. The house style ──────────────────────────────────────────────────────
console.log('\n[5] Badge copy follows the same rules as the rest of the app');

const dashed = BADGE_CATALOG.filter((b) => / - |—|–|―/.test(b.name + ' ' + b.description));
check(
  'no badge uses a long dash, or a spaced hyphen doing a dash\'s job',
  dashed.length === 0,
  dashed.map((b) => `${b.id}: "${b.description}"`).join(' | ')
);
const emptyCopy = BADGE_CATALOG.filter((b) => !b.name.trim() || !b.description.trim());
check(
  'every badge has a name and a description',
  emptyCopy.length === 0,
  emptyCopy.map((b) => b.id).join(', ')
);
const repeated = BADGE_CATALOG.filter((b) => {
  const words = b.description.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
  return new Set(words).size < words.length - 2;
});
check(
  'no description says the same thing twice over',
  repeated.length === 0,
  repeated.map((b) => `${b.id}: "${b.description}"`).join(' | ')
);

console.log('');
if (failures > 0) {
  console.error(`badge-copy: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`badge-copy: all ${total} checks passed\n`);
  process.exitCode = 0;
}
