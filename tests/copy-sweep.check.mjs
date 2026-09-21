/**
 * Contract test: nothing the app prints still names a session after a lift, and
 * no number it quotes about sessions disagrees with the sessions on offer.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Archie's first decision: "Train sessions are Full Body, Upper Body, Lower
 * Body, Conditioning and Build your own. Nothing is named after a lift and the
 * word KPI is not used."
 *
 * tests/non-kpi-user.check.mjs already holds the Train tab and the session
 * names to that. This one is the sweep: every OTHER place the app writes to a
 * person. Two things were still wrong when it was written, and neither was
 * catchable by anything that existed.
 *
 *   THE NUMBER. The showcase promised "10 kinds of session, from a heavy squat
 *   day to ten minutes of mobility" and the paywall printed a tile reading "10
 *   session types". The 10 was MEASURED, from SESSION_META, which is exactly
 *   why it never corrected itself: that table is honestly ten entries long, and
 *   three of the ten are 'squat', 'bench' and 'deadlift', kept so a session
 *   logged two years ago still resolves to a name. Nobody can choose them. Five
 *   is what the Train tab offers.
 *
 *   THE PRACTICE SESSION. The demo run from the last showcase slide, before the
 *   paywall, prescribed Barbell Back Squat, Romanian Deadlift, Lying Leg Curl
 *   and Dead Bug, offering Goblet Squat, Barbell Reverse Lunge, Dumbbell RDL
 *   and Back Extension as alternatives. Seven of those eight are not on
 *   Archie's list. The one thing most people see of the app before they decide
 *   whether to pay was demonstrating movements it cannot prescribe.
 *
 * HOW IT WORKS, AND WHY IT IS NOT A GREP
 * ──────────────────────────────────────
 * This repo's commonest defect is a test that pins a spelling: a regular
 * expression over a screen matches the COMMENT explaining why a word was
 * removed exactly as readily as the word itself, and several of these screens
 * carry comments quoting the very phrases being banned.
 *
 * So every string here is RUN out of the module that owns it. Tables are
 * imported and read; generators are called with representative inputs and their
 * output collected. Nothing below matches source text. That is also why the
 * copy moved out of the screens in the first place: a node check can import a
 * lib file and cannot import a React Native screen, so lib/pitch-copy.ts,
 * lib/stats-screen.ts, lib/session-screen.ts and badges' CRITERIA_HINTS exist
 * to make this file possible.
 *
 * Run:  npx tsx tests/copy-sweep.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import './_persist-shim.mjs';

globalThis.__DEV__ = false;

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

const { SESSION_META, SESSION_DISPLAY_NAMES, SESSION_SHORT_LABELS, STORED_SESSION_ID_COUNT } =
  await import('../lib/session-meta.ts');
const {
  TRAIN_SESSION_TYPES,
  TRAIN_SESSION_COUNT,
  TRAIN_TUTORIAL,
  PROGRAMMES_ENTRY,
  trainTileLabel,
  trainTileSubtitle,
} = await import('../lib/train-screen.ts');
const { STATS_TUTORIAL } = await import('../lib/stats-screen.ts');
const { HOME_TUTORIAL, FIRST_SESSION_COPY } = await import('../lib/home-screen.ts');
const { SHOWCASE_CARDS, paywallStats, PAYWALL_BENEFITS } = await import('../lib/pitch-copy.ts');
const { DEMO_EXERCISES, SESSION_TUTORIAL } = await import('../lib/session-screen.ts');
const { BADGE_CATALOG, BADGE_CATEGORY_LABELS, CRITERIA_HINTS } = await import('../lib/badges.ts');
const { LIBRARY_EXERCISES, CONDITIONING_EXERCISES } = await import('../lib/exercise-library.ts');
const { getCoachMessages, getCoachBriefing, getCoachSnapshot, getLayoffMessage } = await import(
  '../lib/coach.ts'
);
const { nonStrengthContextMessage, programContextMessage } = await import('../lib/program-copy.ts');
const { BUILDER_CATEGORY_LABELS, blocksForGoal } = await import('../lib/session-builder.ts');

/**
 * THE FOUR THINGS NO WORD A USER READS MAY CONTAIN.
 *
 * "Squat" on its own is allowed and has to be. The Lower Body tile's own
 * subtitle is "Squat · Hinge · Lunge", which names a movement pattern, and half
 * the exercise library has the word in its name. What is banned is a SESSION
 * named after a lift, and the acronym, in either case.
 */
const BANNED = [/Squat Session/i, /Bench Session/i, /Deadlift Session/i, /\bKPI\b/i];
const offendingWords = (text) =>
  BANNED.filter((re) => re.test(text))
    .map((re) => String(re))
    .join(', ');

/** Every string collected, tagged with where it came from. */
const collected = [];
const say = (source, ...values) => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) collected.push([source, v]);
  }
};

// ─── 1. Session names, tiles and tours ───────────────────────────────────────
console.log('\n[1] Every name and every tour card the app draws');

for (const type of Object.keys(SESSION_META)) {
  say(`SESSION_META.${type}`, SESSION_META[type].label, SESSION_META[type].subtitle);
  say(`SESSION_DISPLAY_NAMES.${type}`, SESSION_DISPLAY_NAMES[type]);
  say(`SESSION_SHORT_LABELS.${type}`, SESSION_SHORT_LABELS[type]);
}
for (const type of TRAIN_SESSION_TYPES) {
  say(`train tile ${type}`, trainTileLabel(type), trainTileSubtitle(type));
}
say('PROGRAMMES_ENTRY', PROGRAMMES_ENTRY.label, PROGRAMMES_ENTRY.subtitle);
for (const [name, tour] of [
  ['HOME_TUTORIAL', HOME_TUTORIAL],
  ['TRAIN_TUTORIAL', TRAIN_TUTORIAL],
  ['STATS_TUTORIAL', STATS_TUTORIAL],
  ['SESSION_TUTORIAL', SESSION_TUTORIAL],
]) {
  check(
    `${name} was found and has cards (${tour.length})`,
    tour.length > 0 && tour.every((s) => s.title && s.body),
    'a tour read as empty proves nothing about what it says'
  );
  for (const step of tour) say(name, step.title, step.body, step.iconLabel);
}
say('FIRST_SESSION_COPY', ...Object.values(FIRST_SESSION_COPY ?? {}).flatMap((v) =>
  typeof v === 'string' ? [v] : Object.values(v ?? {})
));
say('BUILDER_CATEGORY_LABELS', ...Object.values(BUILDER_CATEGORY_LABELS));
for (const goal of ['strength', 'muscle', 'athletic']) {
  for (const b of blocksForGoal(goal)) say(`builder block ${goal}`, b.title, b.purpose);
}

// ─── 2. The pitch: the showcase and the paywall ──────────────────────────────
console.log('\n[2] The words a stranger reads before they have paid');

check(
  `the showcase has slides (${SHOWCASE_CARDS.length})`,
  SHOWCASE_CARDS.length >= 4 && SHOWCASE_CARDS.every((c) => c.title && c.body),
  'everything about the showcase below this is vacuous otherwise'
);
for (const card of SHOWCASE_CARDS) say('showcase slide', card.eyebrow, card.title, card.body, card.proof);

const stats = paywallStats();
check(
  `the paywall builds its stats (${stats.map((s) => `${s.value} ${s.label}`).join(', ')})`,
  stats.length === 3 && stats.every((s) => s.value && s.label),
  'the stat builder returned nothing usable'
);
for (const s of stats) say('paywall stat', `${s.value} ${s.label}`);
check(
  `the paywall has its benefit rows (${PAYWALL_BENEFITS.length})`,
  PAYWALL_BENEFITS.length >= 4 && PAYWALL_BENEFITS.every((b) => b.title && b.body),
  ''
);
for (const b of PAYWALL_BENEFITS) say('paywall benefit', b.title, b.body);

// ─── 3. Achievements ─────────────────────────────────────────────────────────
console.log('\n[3] Badge names, descriptions and the hint under a locked one');

check(
  `the badge catalogue was found (${BADGE_CATALOG.length})`,
  BADGE_CATALOG.length > 50,
  ''
);
for (const b of BADGE_CATALOG) say(`badge ${b.id}`, b.name, b.description);
say('BADGE_CATEGORY_LABELS', ...Object.values(BADGE_CATEGORY_LABELS));
const hints = Object.entries(CRITERIA_HINTS);
check(
  `every locked badge has a hint (${hints.length} kinds)`,
  hints.length >= 15 && hints.every(([, t]) => typeof t === 'string' && t.length > 10),
  ''
);
for (const [kind, text] of hints) say(`hint ${kind}`, text);

// ─── 4. The coach, run over representative inputs ────────────────────────────
console.log('\n[4] Everything the assistant can say, generated rather than read');

const NOW = 1_700_000_000_000;
const COACH_BASE = {
  sessionCount: 10,
  weekCount: 3,
  weeklyGoal: 3,
  streak: 4,
  consecutiveActiveWeeks: 1,
  daysSinceLast: 1,
  weekday: 1,
  bodyweightStale: false,
  balance: { sessionTypes: [], everTrained: [], dismissedAt: null, now: NOW },
  sessions: [],
  progress: [],
  stuckStreak: {},
  hasOneRepMax: true,
  drift: null,
  programmeName: null,
  weightUnit: 'kg',
  dismissedAt: {},
  now: NOW,
};

/**
 * A session history built out of the LIFT IDS, on purpose.
 *
 * 'squat', 'bench' and 'deadlift' are what a long-standing user's history is
 * actually full of, and every message that reaches for a session name has to
 * resolve one of them through trainTypeOf rather than print the id. Feeding the
 * coach a clean lower_body/upper_body history would never exercise that path.
 */
let seq = 0;
const session = (sessionType) => ({
  id: `s${seq++}`,
  sessionType,
  date: new Date(NOW - seq * 86400000).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '45',
  exerciseCount: 6,
  exerciseLogs: [],
});
const liftHistory = Array.from({ length: 12 }, (_, i) =>
  session(['squat', 'bench', 'deadlift'][i % 3])
);
const mixedHistory = Array.from({ length: 12 }, (_, i) =>
  session(['lower_body', 'upper_body', 'full_body', 'conditioning'][i % 4])
);
const progressRow = (id, name, sessionType, weights) => ({
  exerciseId: id,
  exerciseName: name,
  sessionType,
  appearances: weights.map((kg, i) => ({
    date: new Date(NOW - (weights.length - i) * 7 * 86400000).toISOString(),
    bestSetWeight: kg,
    avgWorkingWeight: kg,
    bestSetReps: 8,
    estimatedOrm: Math.round(kg * (1 + 8 / 30)),
  })),
});

const COACH_CASES = [
  {},
  { sessionCount: 0 },
  { sessionCount: 1 },
  { sessionCount: 200, sessions: liftHistory },
  { sessions: mixedHistory },
  { daysSinceLast: 30, sessions: liftHistory },
  { daysSinceLast: null, sessionCount: 0 },
  { bodyweightStale: true },
  { consecutiveActiveWeeks: 6, sessions: liftHistory },
  { hasOneRepMax: false },
  { weekCount: 0, weekday: 6 },
  { weekCount: 0, weekday: 7, streak: 9 },
  { weightUnit: 'lbs', sessions: liftHistory },
  {
    sessions: liftHistory,
    progress: [
      progressRow('sq-main-db', 'Kettlebell Goblet Squats', 'squat', [20, 22, 24, 26, 30]),
      progressRow('bn-main-db', 'Dumbbell Bench Press', 'bench', [30, 30, 30, 30, 30]),
    ],
    stuckStreak: { 'bn-main-db': 4 },
  },
  {
    programmeName: 'Barbell Strength',
    drift: { programmeType: 'barbell', sessionsOffPlan: 5, weeksDrifting: 3 },
    sessions: liftHistory,
  },
];

let coachStrings = 0;
/** The stored id, and the name the assistant printed for it. */
const nextSessionLines = [];
for (const over of COACH_CASES) {
  const input = { ...COACH_BASE, ...over };
  for (const m of getCoachMessages(input)) {
    say(`coach message ${m.id}`, m.title, m.body, m.action?.label);
    coachStrings += 2;
  }
  /**
   * The full assistant screen, which shows MORE than the home panel.
   *
   * `howItWorks` is the reference section: six explainers that never reach the
   * three-message panel unless one happens to be picked, and which are shown
   * whatever has been waved away. Collecting only getCoachMessages would leave
   * most of them unswept.
   */
  const briefing = getCoachBriefing(input);
  for (const bucket of ['needsYou', 'yourTraining', 'goingWell', 'howItWorks']) {
    for (const m of briefing[bucket] ?? []) {
      say(`briefing ${bucket} ${m.id}`, m.title, m.body, m.action?.label);
      coachStrings += 2;
    }
  }
  /**
   * The one line in the assistant that resolves a stored session id to a name.
   *
   * It is the path a lift-named session would come back through: a history full
   * of 'squat' has to be answered with the session it now builds, not with the
   * id it is filed under.
   */
  const snapshot = getCoachSnapshot(input);
  if (snapshot.nextSession) {
    nextSessionLines.push([snapshot.nextSession.type, snapshot.nextSession.label]);
    say('coach next session', snapshot.nextSession.label, snapshot.nextSession.reason);
    coachStrings += 2;
  }
}
check(
  `the assistant named the next session for ${nextSessionLines.length} of the ${COACH_CASES.length} states`,
  nextSessionLines.length > 0 &&
    nextSessionLines.some(([type]) => type === 'squat' || type === 'bench' || type === 'deadlift'),
  'a history full of lift ids has to reach this line, or the one place the assistant turns a stored id into a name goes unswept'
);
for (const days of [null, 0, 3, 8, 15, 30, 120]) {
  const m = getLayoffMessage(days);
  if (m) say(`layoff ${days}`, m.title, m.body, m.action?.label);
}
check(
  `the coach actually said something (${coachStrings} message fields over ${COACH_CASES.length} states)`,
  coachStrings > 40,
  'a silent coach passes every ban below without proving anything'
);

for (const c of [
  { sessionCount: 3, mix: 'Conditioning · Mobility', weekCount: 0, weeklyGoal: 3, streakWeeks: 0 },
  { sessionCount: 40, mix: 'Mobility · Full Body', weekCount: 1, weeklyGoal: 3, streakWeeks: 5 },
  { sessionCount: 300, mix: 'Conditioning', weekCount: 2, weeklyGoal: 3, streakWeeks: 0 },
]) {
  say('off-rotation line', nonStrengthContextMessage(c));
}
for (const n of [0, 1, 3, 12, 60, 400]) say('programme context', programContextMessage(n));

// ─── 5. The practice session ─────────────────────────────────────────────────
console.log('\n[5] The demo prescribes only exercises the app can prescribe');

const libraryNames = new Set(
  [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES].map((e) => e.name)
);
check(
  `the library was loaded (${libraryNames.size} names) and the demo has cards (${DEMO_EXERCISES.length})`,
  libraryNames.size > 100 && DEMO_EXERCISES.length >= 4,
  'everything in this section is vacuous otherwise'
);
const demoNames = DEMO_EXERCISES.flatMap((e) => [e.name, e.swapName, e.swap2Name]).filter(Boolean);
const offLibrary = demoNames.filter((n) => !libraryNames.has(n));
check(
  `every name in the practice session is on Archie's list (${demoNames.length} names, exercises and both alternatives)`,
  offLibrary.length === 0,
  `not on the list: ${offLibrary.join(', ')} - the session shown before the paywall was demonstrating movements the app cannot prescribe`
);
const libraryByName = new Map(
  [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES].map((e) => [e.name, e])
);
const mismatched = DEMO_EXERCISES.filter((e) => {
  const rec = libraryByName.get(e.name);
  return !rec || rec.sets !== e.sets || rec.reps !== e.reps || rec.cue !== e.cue;
});
check(
  'every demo card carries the prescription its library record carries',
  mismatched.length === 0,
  `${mismatched.map((e) => e.name).join(', ')} - a demo card that retypes its own sets, reps or cue goes stale the moment the record changes`
);
/**
 * THE ONE THING THE DEMO MUST NOT TAKE FROM THE LIBRARY: the id.
 *
 * Every weight a person has lifted is filed under the id of the exercise they
 * did, and the session screen looks up their best ever, their last session's
 * average and their last completed set BY THE ID ON THE CARD. Those reads are
 * not behind the isDemo guard, which is about writes. A practice card carrying
 * sq-main-db would therefore serve a returning user their own goblet squat
 * history: boxes prefilled with a weight the card does not say, and a
 * personal-best flash inside a session that never happened.
 */
const realIds = new Set([...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES].map((e) => e.id));
const demoIds = DEMO_EXERCISES.flatMap((e) => [e.id, e.swapId, e.swap2Id]).filter(Boolean);
check(
  `no demo card is filed under a real exercise id (${demoIds.length} ids checked)`,
  demoIds.length >= 4 && !demoIds.some((id) => realIds.has(id)),
  `${demoIds.filter((id) => realIds.has(id)).join(', ')} - the practice session would read a real history`
);
check(
  'the first card carries a weight, because two tour steps are about logging one',
  /\d/.test(DEMO_EXERCISES[0].suggestedLoad ?? ''),
  `the first card offers "${DEMO_EXERCISES[0].suggestedLoad}", and the tour then narrates boxes that are not there`
);
check(
  'the card the Details step is about really does have both kinds of alternative',
  DEMO_EXERCISES.some((e) => e.hasSwap && e.swapKind === 'equipment' && e.swap2Kind === 'movement'),
  'the tour promises the same exercise with different kit AND a different exercise for the same muscles'
);
for (const e of DEMO_EXERCISES) {
  say('demo card', e.name, e.cue, e.swapName, e.swapCue, e.swapReason, e.swap2Name, e.swap2Cue, e.swap2Reason);
}

// ─── 6. The ban, over everything collected above ─────────────────────────────
console.log('\n[6] Not one of those strings names a session after a lift');

check(
  `${collected.length} strings were collected from ${new Set(collected.map(([s]) => s)).size} sources`,
  collected.length > 400,
  'the sweep collected almost nothing, so the ban below proves almost nothing'
);
const offenders = collected.filter(([, v]) => BANNED.some((re) => re.test(v)));
check(
  'none says Squat Session, Bench Session, Deadlift Session, or the word KPI',
  offenders.length === 0,
  offenders.map(([s, v]) => `${s}: "${v}" (${offendingWords(v)})`).join(' | ')
);

// ─── 7. No number about sessions disagrees with the sessions on offer ────────
console.log('\n[7] Every session count quoted is the number a person can choose');

check(
  `the Train tab offers ${TRAIN_SESSION_TYPES.length} sessions and TRAIN_SESSION_COUNT agrees`,
  TRAIN_SESSION_COUNT === TRAIN_SESSION_TYPES.length && TRAIN_SESSION_COUNT > 0,
  `count says ${TRAIN_SESSION_COUNT}, the list is ${TRAIN_SESSION_TYPES.join(', ')}`
);
/**
 * The trap this section is really about.
 *
 * STORED_SESSION_ID_COUNT is bigger than the number of sessions on offer, and
 * it is MEASURED, so printing it looks safe and reads wrong. It was called
 * SESSION_TYPE_COUNT and it was on two screens. Anything a user reads that
 * quotes a number of sessions has to quote the smaller one.
 */
check(
  `there are more stored ids (${STORED_SESSION_ID_COUNT}) than choosable sessions (${TRAIN_SESSION_COUNT}), so the two cannot be confused by accident`,
  STORED_SESSION_ID_COUNT > TRAIN_SESSION_COUNT,
  'if these ever match, this section stops being able to tell a right number from a wrong one'
);

/** Any "<number> kinds of session" or "<number> session types" style claim. */
const SESSION_COUNT_CLAIM =
  /(\d+)\s*(?:\+\s*)?(?:kinds? of (?:training )?sessions?|sessions? types?|types? of session|ways to train)/gi;
const claims = [];
for (const [source, text] of collected) {
  for (const m of text.matchAll(SESSION_COUNT_CLAIM)) claims.push([source, m[0], Number(m[1])]);
}
check(
  `a session count claim was found and read (${claims.length}: ${claims.map(([, t]) => t).join(', ')})`,
  claims.length > 0,
  'the showcase and the paywall each make one; finding none means the pattern has gone blind'
);
const wrong = claims.filter(([, , n]) => n !== TRAIN_SESSION_COUNT);
check(
  `every one of them says ${TRAIN_SESSION_COUNT}`,
  wrong.length === 0,
  wrong
    .map(([s, t, n]) => `${s}: "${t}" claims ${n}, the app offers ${TRAIN_SESSION_COUNT}`)
    .join(' | ')
);

// ─── 8. House style, over the same strings ───────────────────────────────────
console.log('\n[8] The swept copy follows the house rules');

const dashed = collected.filter(([, v]) => /—|–|―/.test(v));
check('no long dash anywhere in it', dashed.length === 0, dashed.map(([s, v]) => `${s}: "${v}"`).join(' | '));
const emoji = collected.filter(([, v]) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(v));
check('no emoji', emoji.length === 0, emoji.map(([s, v]) => `${s}: "${v}"`).join(' | '));

console.log('');
if (failures > 0) {
  console.error(`copy-sweep: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`copy-sweep: all ${total} checks passed\n`);
  process.exitCode = 0;
}
