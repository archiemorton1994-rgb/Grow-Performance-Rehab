/**
 * Contract test: no session is named after a lift, the word KPI is gone, and
 * what the app offers somebody follows Archie's second decision.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * It was written when the app had one rotation and it was three barbell lifts.
 * Reported by the owner: "regardless of what you put or what you intend to do,
 * test week and the KPI lifts are there whether you like it or not." The answer
 * at the time was a divert: count how much non-barbell training somebody had
 * done lately and stop suggesting squats if there was enough of it.
 *
 * THAT PROBLEM NO LONGER EXISTS, so the divert is gone with it. The rotation is
 * Lower Body, Upper Body and Full Body, which the generator builds at every
 * equipment tier down to no equipment at all, so there is no longer a suggestion
 * anybody is unable to take. Two decisions replace the old machinery:
 *
 *   1. "Train sessions are Full Body, Upper Body, Lower Body, Conditioning and
 *      Build your own. Nothing is named after a lift and the word KPI is not
 *      used."
 *   2. "Beginners are offered Full Body every session until they step up a
 *      level. Everyone else rotates Lower Body, Upper Body, Full Body."
 *
 * WHAT THIS FILE HOLDS
 *   1. Every word the Train tab prints, RUN rather than grepped.
 *   2. Every session name the app can print for a stored id.
 *   3. The suggestion, against the real store: the beginner rule, the rotation,
 *      what does and does not move it, and a programme outranking both.
 *   4. The index-for-index promise that makes cycleStartOffset safe.
 *   5. The one question the Your Program screen still asks.
 *   6. The copy that screen shows somebody who is not on the rotation.
 *
 * NOTHING HERE MATCHES SOURCE TEXT FOR A SPELLING. Section 1 asks the label
 * functions for their labels and reads the strings back; section 3 seeds the
 * real store and calls the real selector. That matters most in section 1,
 * because a regular expression over app/(tabs)/train.tsx matches the comment
 * explaining why a word was removed exactly as readily as the word itself.
 *
 * Run:  npx tsx tests/non-kpi-user.check.mjs
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

const { useAppStore, SESSION_ORDER, ROTATION_EVIDENCE, RECENT_WINDOW } = await import(
  '../lib/store.ts'
);
const { SESSION_META, SESSION_DISPLAY_NAMES, SESSION_SHORT_LABELS } = await import(
  '../lib/session-meta.ts'
);
const { trainTypeOf } = await import('../lib/session-type.ts');
const {
  TRAIN_SESSION_TYPES,
  TRAIN_TUTORIAL,
  PROGRAMMES_ENTRY,
  trainTileLabel,
  trainTileSubtitle,
} = await import('../lib/train-screen.ts');
const { BUILDER_CATEGORY_LABELS, blocksForGoal } = await import('../lib/session-builder.ts');
const { cycleFor } = await import('../lib/programme.ts');
const { nonStrengthContextMessage } = await import('../lib/program-copy.ts');

const S = () => useAppStore.getState();

/**
 * The four things no word the user reads may contain.
 *
 * "Squat" on its own is allowed and has to be: the Lower Body tile's own
 * subtitle is "Squat · Hinge · Lunge", which names a movement pattern rather
 * than a session. What is banned is a SESSION named after a lift, and the
 * acronym, in either case.
 */
const BANNED = [/Squat Session/i, /Bench Session/i, /Deadlift Session/i, /\bKPI\b/i];
const offendingWords = (text) =>
  BANNED.filter((re) => re.test(text))
    .map((re) => String(re))
    .join(', ');

// ─── 1. The Train tab, run rather than read ──────────────────────────────────
console.log('\n[1] Every word the Train tab prints');

check(
  'the tab offers five sessions',
  TRAIN_SESSION_TYPES.length === 5,
  `it offers ${TRAIN_SESSION_TYPES.length}: ${TRAIN_SESSION_TYPES.join(', ')}`
);
check(
  'and they are the five Archie named, in his order',
  JSON.stringify(TRAIN_SESSION_TYPES.map(trainTileLabel)) ===
    JSON.stringify(['Full Body', 'Upper Body', 'Lower Body', 'Conditioning', 'Build your own']),
  TRAIN_SESSION_TYPES.map(trainTileLabel).join(' | ')
);
check(
  'no lift-named session is among them',
  !TRAIN_SESSION_TYPES.some((t) => t === 'squat' || t === 'bench' || t === 'deadlift'),
  TRAIN_SESSION_TYPES.join(', ')
);

/** Every string the tab draws: the tiles, the Programmes row, the tour cards. */
const trainWords = [
  ...TRAIN_SESSION_TYPES.flatMap((t) => [trainTileLabel(t), trainTileSubtitle(t)]),
  PROGRAMMES_ENTRY.label,
  PROGRAMMES_ENTRY.subtitle,
  ...TRAIN_TUTORIAL.flatMap((s) => [s.title, s.body, s.iconLabel]),
];
check(
  `${trainWords.length} strings were collected from the tab and its tour`,
  trainWords.length >= 18 && trainWords.every((w) => typeof w === 'string' && w.length > 0),
  'everything below this is vacuous if they were not'
);
const trainOffenders = trainWords.filter((w) => BANNED.some((re) => re.test(w)));
check(
  'not one of them says Squat Session, Bench Session, Deadlift Session or KPI',
  trainOffenders.length === 0,
  trainOffenders.map((w) => `"${w}" (${offendingWords(w)})`).join(' | ')
);
check(
  'the Programmes row says out loud that a programme is optional',
  /\boptional\b/i.test(`${PROGRAMMES_ENTRY.label} ${PROGRAMMES_ENTRY.subtitle}`),
  `"${PROGRAMMES_ENTRY.label}: ${PROGRAMMES_ENTRY.subtitle}"`
);
check(
  'and the tour still says choosing a session here costs a programme nothing',
  TRAIN_TUTORIAL.some(
    (s) =>
      /whether you are on a programme or not/.test(s.body) &&
      /moves your programme along or sets it back/.test(s.body)
  ),
  'the sentence that stops the programme reading as the whole app'
);
check(
  'the tour copy follows house style',
  !trainWords.some((w) => /—|–|―/.test(w)),
  trainWords.filter((w) => /—|–|―/.test(w)).join(' | ')
);

// The session builder's own step, which had the last "KPI Lift" heading in the
// app. Run through the real block tables rather than read.
const builderTitles = [
  ...Object.values(BUILDER_CATEGORY_LABELS),
  ...['strength', 'muscle', 'athletic'].flatMap((goal) =>
    blocksForGoal(goal).flatMap((b) => [b.title, b.purpose])
  ),
];
check(
  `the session builder's ${builderTitles.length} headings say it too`,
  builderTitles.length > 10 && !builderTitles.some((t) => BANNED.some((re) => re.test(t))),
  builderTitles.filter((t) => BANNED.some((re) => re.test(t))).join(' | ')
);
check(
  'and the block a session is built around is called the main exercise',
  BUILDER_CATEGORY_LABELS.kpi === 'Main exercise' &&
    blocksForGoal('strength').some((b) => b.id === 'kpi' && b.title === 'Main exercise'),
  `label "${BUILDER_CATEGORY_LABELS.kpi}"`
);

// ─── 2. Every name a stored session can print ────────────────────────────────
console.log('\n[2] No stored id resolves to a lift-named session');

const ALL_TYPES = Object.keys(SESSION_META);
check(
  `all ${ALL_TYPES.length} session types were found`,
  ALL_TYPES.length === 10,
  ALL_TYPES.join(', ')
);
const nameOffenders = ALL_TYPES.flatMap((t) => [
  SESSION_META[t].label,
  SESSION_META[t].subtitle,
  SESSION_DISPLAY_NAMES[t],
  SESSION_SHORT_LABELS[t],
]).filter((w) => BANNED.some((re) => re.test(w)));
check(
  'every label, subtitle, display name and short label is clean',
  nameOffenders.length === 0,
  nameOffenders.join(' | ')
);
check(
  'and a stored squat, bench or deadlift day reads as what it builds',
  ['squat', 'bench', 'deadlift'].every(
    (t) => SESSION_DISPLAY_NAMES[t] === SESSION_DISPLAY_NAMES[trainTypeOf(t)]
  ),
  ['squat', 'bench', 'deadlift'].map((t) => `${t} -> ${SESSION_DISPLAY_NAMES[t]}`).join(', ')
);

// ─── 3. The suggestion, against the real store ───────────────────────────────
console.log('\n[3] What the app offers somebody who is not on a programme');

let seq = 0;
const session = (sessionType) => ({
  id: `s${seq++}`,
  sessionType,
  date: new Date(Date.now() - seq * 86400000).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '45',
  exerciseCount: 6,
  exerciseLogs: [],
});
const historyOf = (types, n) => Array.from({ length: n }, (_, i) => session(types[i % types.length]));

const PROFILE = (experienceLevel, earnedLevelBonus) => ({
  name: 'Probe',
  sex: 'male',
  experienceLevel,
  goals: ['muscle'],
  bodyweightKg: 80,
  ...(earnedLevelBonus === undefined ? {} : { earnedLevelBonus }),
});

function seed({ level = 'intermediate', bonus = undefined, history = [], offset = 0 } = {}) {
  useAppStore.setState({
    programme: null,
    completedSessions: history,
    completedCount: history.length,
    cycleStartOffset: offset,
    userProfile: PROFILE(level, bonus),
  });
  return S().getCurrentSessionType();
}

check(
  'the rotation is Lower, Upper, Full Body',
  JSON.stringify(SESSION_ORDER) === JSON.stringify(['lower_body', 'upper_body', 'full_body']),
  JSON.stringify(SESSION_ORDER)
);

/**
 * DECISION 2, FIRST HALF: a beginner is offered Full Body EVERY session.
 *
 * Swept over the histories that would otherwise put them somewhere else, so this
 * cannot pass by landing on full_body coincidentally: at 0, 1 and 2 lifting
 * sessions the rotation asks for lower_body, upper_body and full_body in turn,
 * and only one of those three is the answer the rule gives.
 */
const beginnerAnswers = [];
for (let n = 0; n <= 12; n++) {
  beginnerAnswers.push(
    seed({ level: 'beginner', bonus: 0, history: historyOf(['lower_body', 'upper_body', 'full_body'], n) })
  );
}
check(
  `a beginner with no earned rung is offered Full Body at every session count (0-12)`,
  beginnerAnswers.every((a) => a === 'full_body'),
  beginnerAnswers.join(', ')
);
check(
  'including when the field has never been written at all',
  seed({ level: 'beginner', bonus: undefined, history: historyOf(['lower_body'], 4) }) === 'full_body',
  'an absent earnedLevelBonus is nought, not "unknown"'
);
check(
  'and whatever else they have been training',
  ['conditioning', 'prehab', 'flexibility', 'custom'].every(
    (t) => seed({ level: 'beginner', bonus: 0, history: historyOf([t], 5) }) === 'full_body'
  ),
  'the beginner rule is about the person, not about their last five sessions'
);
check(
  'and wherever their stored cycle offset happens to sit',
  [0, 1, 2].every(
    (o) => seed({ level: 'beginner', bonus: 0, history: historyOf(['lower_body'], 2), offset: o }) === 'full_body'
  ),
  'an offset written before they were a beginner must not leak past the rule'
);

/**
 * DECISION 2, SECOND HALF: everybody else rotates.
 *
 * "Stepping up a level" is the earned rung, which is granted for finishing a
 * block, not the answer somebody gave at sign-up. So a profile that still says
 * beginner joins the rotation the moment its first rung lands.
 */
check(
  'one earned rung puts a beginner into the rotation',
  seed({ level: 'beginner', bonus: 1, history: [] }) === SESSION_ORDER[0] &&
    seed({ level: 'beginner', bonus: 1, history: historyOf(['lower_body'], 1) }) === SESSION_ORDER[1],
  `got ${seed({ level: 'beginner', bonus: 1, history: [] })} then ${seed({ level: 'beginner', bonus: 1, history: historyOf(['lower_body'], 1) })}`
);
for (const level of ['intermediate', 'advanced', 'athlete']) {
  const walk = [];
  for (let n = 0; n < 7; n++) {
    walk.push(seed({ level, history: historyOf(['lower_body', 'upper_body', 'full_body'], n) }));
  }
  check(
    `${level}: seven sessions walk the rotation in order`,
    JSON.stringify(walk) ===
      JSON.stringify([0, 1, 2, 0, 1, 2, 0].map((i) => SESSION_ORDER[i])),
    walk.join(' -> ')
  );
}

check(
  'conditioning, rehab, mobility and a custom session do not move it',
  ['conditioning', 'prehab', 'flexibility', 'custom'].every(
    (t) => seed({ history: historyOf([t], 9) }) === SESSION_ORDER[0]
  ),
  'none of them load the lifts being progressed, so none may turn the rotation'
);
check(
  'a history of lift-named days keeps its place in the rotation',
  seed({ history: historyOf(['squat', 'bench', 'deadlift'], 40) }) ===
    seed({ history: historyOf(['lower_body', 'upper_body', 'full_body'], 40) }),
  'forty of one and forty of the other are the same forty sessions of training'
);
check(
  'and forty of them is not simply the same answer as none',
  seed({ history: historyOf(['squat', 'bench', 'deadlift'], 40) }) !== seed({ history: [] }),
  'if it were, the assertion above would hold for a rotation that never moved'
);
check(
  'the stored offset shifts the rotation one for one',
  [0, 1, 2].every((o) => seed({ history: [], offset: o }) === SESSION_ORDER[o]),
  [0, 1, 2].map((o) => `${o} -> ${seed({ history: [], offset: o })}`).join(', ')
);
check(
  'nobody is ever offered a session the app cannot build',
  ['beginner', 'intermediate', 'advanced', 'athlete'].every((level) =>
    [0, 1, 2, 3, 4, 5].every((n) => {
      const answer = seed({ level, history: historyOf(['lower_body', 'conditioning', 'custom'], n) });
      return ['lower_body', 'upper_body', 'full_body'].includes(answer);
    })
  ),
  'generateWorkout returns an empty list for a custom session, so suggesting one would hand somebody an empty workout'
);

// A block outranks the rule, and pausing it hands the rule back.
useAppStore.setState({ userProfile: PROFILE('beginner', 0), completedSessions: [], completedCount: 0 });
S().enrolInProgramme('upper_lower', '2026-08-31T09:00:00.000Z');
const enrolledAnswer = S().getCurrentSessionType();
check(
  `a beginner enrolled in a block gets the block's session (${enrolledAnswer})`,
  enrolledAnswer === S().getProgrammePosition()?.next && enrolledAnswer !== 'full_body',
  `got ${enrolledAnswer}, and the block asked for ${S().getProgrammePosition()?.next}`
);
S().setProgrammePaused(true);
check(
  'and pausing it gives them Full Body back',
  S().getCurrentSessionType() === 'full_body',
  `got ${S().getCurrentSessionType()}`
);
S().setProgrammePaused(false);
check(
  'unpausing puts the block back in charge',
  S().getCurrentSessionType() === enrolledAnswer,
  `got ${S().getCurrentSessionType()}`
);

// ─── 3b. Nothing can turn today into a max attempt ───────────────────────────
console.log('\n[3b] The strength test cannot come back through this door');

check(
  'the store exposes nothing that could work out a test is due',
  S().getTestWeekProgress === undefined &&
    S().isTestWeekDue === undefined &&
    S().setTestWeekFrequency === undefined &&
    S().deferTestWeek === undefined,
  'those four were the whole mechanism; tests/test-weeks-retired.check.mjs holds the rest'
);

// ─── 4. Why cycleStartOffset did not need a migration ────────────────────────
console.log('\n[4] The rotation kept its order, position for position');

/**
 * cycleStartOffset is a stored NUMBER: an index into SESSION_ORDER. Re-ordering
 * that list would move every existing user to a different session with nothing
 * on disk changing, and nothing would fail. The three lift ids are the other
 * half of the same pairing, and Barbell Strength still prescribes them to the
 * people part way through a block, so the two lists have to agree index for
 * index or an enrolled user and a rotating one drift apart.
 */
const barbellCycle = cycleFor('barbell', 3);
check(
  'Barbell Strength still prescribes the three lift ids',
  JSON.stringify(barbellCycle) === JSON.stringify(['squat', 'bench', 'deadlift']),
  JSON.stringify(barbellCycle)
);
check(
  'and each one sits at the same index in the rotation it now means',
  barbellCycle.length === SESSION_ORDER.length &&
    barbellCycle.every((t, i) => trainTypeOf(t) === SESSION_ORDER[i]),
  barbellCycle.map((t, i) => `${t} -> ${trainTypeOf(t)} vs ${SESSION_ORDER[i]}`).join(', ')
);

// ─── 5. The one question the Your Program screen asks ────────────────────────
console.log('\n[5] Your Program knows whether somebody is really on the rotation');

const onRotation = ({ history }) => {
  useAppStore.setState({
    programme: null,
    completedSessions: history,
    completedCount: history.length,
    userProfile: PROFILE('intermediate'),
  });
  return S().isOnStrengthProgramme();
};
check(
  'somebody with almost no history is assumed to be on it',
  [0, 1, ROTATION_EVIDENCE - 1].every((n) => onRotation({ history: historyOf(['conditioning'], n) })),
  `${ROTATION_EVIDENCE} sessions is the evidence it takes to say otherwise`
);
check(
  `${ROTATION_EVIDENCE} sessions of something else says otherwise`,
  !onRotation({ history: historyOf(['conditioning'], ROTATION_EVIDENCE) }),
  ''
);
check(
  'one lifting session inside the window brings it back',
  onRotation({ history: [session('full_body'), ...historyOf(['conditioning'], RECENT_WINDOW)] }),
  ''
);
check(
  'and a lift-named day counts as the lifting session it was',
  onRotation({ history: [session('squat'), ...historyOf(['conditioning'], RECENT_WINDOW)] }),
  'reading the rotation list directly would tell a fifteen-year barbell lifter they had never lifted'
);
check(
  'a lifting session older than the window does not',
  !onRotation({ history: [...historyOf(['conditioning'], RECENT_WINDOW), session('squat')] }),
  'a window corrects in both directions; an all-time count never lets go'
);

// ─── 6. The line that screen shows somebody off the rotation ─────────────────
console.log('\n[6] The copy for somebody training their own way');

const OFF_ROTATION_STATES = [
  { sessionCount: 3, mix: 'Conditioning · Mobility', weekCount: 0, weeklyGoal: 3, streakWeeks: 0 },
  { sessionCount: 8, mix: 'Conditioning · Mobility', weekCount: 2, weeklyGoal: 3, streakWeeks: 1 },
  { sessionCount: 12, mix: 'Conditioning', weekCount: 3, weeklyGoal: 3, streakWeeks: 4 },
  { sessionCount: 40, mix: 'Mobility · Full Body', weekCount: 1, weeklyGoal: 3, streakWeeks: 5 },
  { sessionCount: 300, mix: 'Conditioning · Mobility', weekCount: 0, weeklyGoal: 2, streakWeeks: 0 },
];
const offLines = OFF_ROTATION_STATES.map(nonStrengthContextMessage);
check(
  `there is copy that does not mention cycles or tests (${offLines.length} states)`,
  offLines.every((l) => !/\b(cycle|block|test|1RM|squat|bench|deadlift)\b/i.test(l)),
  offLines.filter((l) => /\b(cycle|block|test|1RM|squat|bench|deadlift)\b/i.test(l)).join(' | ')
);
check(
  'and it says something DIFFERENT as their training changes',
  new Set(offLines).size === offLines.length,
  `${new Set(offLines).size} distinct lines from ${offLines.length} states: ${offLines.join(' | ')}`
);
check(
  'it names what they actually train, every time',
  offLines.every((l, i) => l.toLowerCase().includes(OFF_ROTATION_STATES[i].mix.toLowerCase())),
  offLines.join(' | ')
);
check(
  'a week one session short is told so',
  /One more session this week/.test(
    nonStrengthContextMessage({
      sessionCount: 20,
      mix: 'Conditioning',
      weekCount: 2,
      weeklyGoal: 3,
      streakWeeks: 0,
    })
  ),
  'the most useful thing this screen knows about them is how close their week is'
);
check(
  'and the copy follows house style',
  !offLines.some((l) => /—|–|―|--/.test(l)),
  offLines.filter((l) => /—|–|―|--/.test(l)).join(' | ')
);

console.log('');
if (failures > 0) {
  console.error(`non-kpi-user: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`non-kpi-user: all ${total} checks passed\n`);
  process.exitCode = 0;
}
