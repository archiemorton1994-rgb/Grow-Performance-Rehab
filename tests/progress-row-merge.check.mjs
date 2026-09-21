/**
 * Contract test: old barbell-day history and new session history are ONE row.
 *
 * WHAT ARCHIE WAS SHOWN, AND WHAT HE ANSWERED
 * ───────────────────────────────────────────
 * Somebody who trained here before the rebuild has completed sessions filed
 * under 'squat', 'bench' and 'deadlift' sitting beside newer ones filed under
 * 'lower_body', 'upper_body' and 'full_body'. Every label table already
 * resolves the old ids to the new names, so the Stats screen drew TWO rows both
 * headed Lower Body - one counting four, one counting three, and no seven
 * anywhere. Asked whether to rewrite the history or merge the display, he chose
 * the display: "merge the rows on screen and leave the stored record alone."
 *
 * So there are two promises here and they pull against each other, which is
 * exactly why they are tested together:
 *
 *   1. MERGED WHERE IT IS READ. One Lower Body row, carrying both, counting the
 *      sum. The same fold on the history filter, the Progress tab's exercise
 *      groups, "last trained" on Your Programme, the training mix, and the
 *      chips under a finished block.
 *
 *   2. UNTOUCHED WHERE IT IS KEPT. Nothing writes. The stored completedSessions
 *      array is compared byte for byte either side of everything a screen does
 *      to draw those rows, because a "merge" that quietly rewrites somebody's
 *      history to make a screen tidy is the thing he said not to do.
 *
 * HOW IT IS TESTED
 * ────────────────
 * By seeding the REAL store and running the REAL functions the screens call -
 * lib/progress-groups.ts, which exists so this can be measured rather than read
 * for a spelling - and by deriving the exercise rows from the store's own
 * getAllExerciseProgress rather than hand-building them.
 *
 * GUARDED AGAINST BEING VACUOUSLY TRUE. The fixture is first proved to contain
 * both old and new ids, and the old and new ids are proved to carry the SAME
 * name, so "one Lower Body row" is a real claim. And the separations are
 * asserted as well as the merges: a change that folded every session into one
 * row would satisfy "one Lower Body row carrying seven" and is caught by Upper
 * and Full Body still being rows of their own.
 *
 * Run:  npx tsx tests/progress-row-merge.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

const {
  EXERCISE_GROUP_ORDER,
  SESSION_BREAKDOWN_ORDER,
  countsByTrainType,
  displayTypeFilter,
  groupByTrainType,
  lastSessionOfTrainType,
  matchesTypeFilter,
  mergeTypeCounts,
  sessionTypeRows,
  trainingMixTypes,
} = await import('../lib/progress-groups.ts');
const { trainTypeOf, LEGACY_SESSION_TYPES } = await import('../lib/session-type.ts');
const { SESSION_SHORT_LABELS, SESSION_DISPLAY_NAMES } = await import('../lib/session-meta.ts');
await import('./_persist-shim.mjs');
const { useAppStore } = await import('../lib/store.ts');

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    if (detail) console.error(`      ${detail}`);
    failed++;
  }
}

// ─── The person ──────────────────────────────────────────────────────────────
// Four squat days and three lower body days, so the merged row must read seven
// and not four, not three and not fourteen. Upper and Full are lopsided the
// other way round, so no single arithmetic slip can make all three come out
// right by accident.
//
// Newest first, as the store keeps them.

let counter = 0;
function day(offsetDays) {
  const d = new Date(Date.UTC(2026, 5, 20) - offsetDays * 86400000);
  return d.toISOString();
}

function session(sessionType, exercises) {
  counter++;
  return {
    id: `s${counter}`,
    sessionType,
    date: day(counter),
    equipmentTier: 'full_gym',
    hadAches: false,
    energy: 'normal',
    timeAvailable: '45',
    exerciseCount: exercises.length,
    exerciseLogs: exercises.map(([exerciseId, exerciseName, weight]) => ({
      exerciseId,
      exerciseName,
      sets: [
        { setNumber: 1, weight, reps: 8, completed: true },
        { setNumber: 2, weight, reps: 8, completed: true },
      ],
    })),
  };
}

const HISTORY = [
  // Newest: the sessions logged since the rebuild.
  session('lower_body', [['leg-press', 'Leg Press', 120]]),
  session('lower_body', [['leg-press', 'Leg Press', 115]]),
  session('lower_body', [['leg-press', 'Leg Press', 110]]),
  session('upper_body', [['db-press', 'Dumbbell Bench Press', 30]]),
  session('full_body', [['kb-swing', 'Kettlebell Swing', 24]]),
  session('conditioning', [['row-erg', 'Rowing Machine', 0]]),
  session('conditioning', [['row-erg', 'Rowing Machine', 0]]),
  // Older: the barbell rotation, stored under the ids it used at the time.
  session('squat', [['back-squat', 'Barbell Back Squat', 100]]),
  session('squat', [['back-squat', 'Barbell Back Squat', 97.5]]),
  session('squat', [['back-squat', 'Barbell Back Squat', 95]]),
  session('squat', [['back-squat', 'Barbell Back Squat', 92.5]]),
  session('bench', [['bench-press', 'Barbell Bench Press', 70]]),
  session('bench', [['bench-press', 'Barbell Bench Press', 67.5]]),
  session('deadlift', [['deadlift', 'Barbell Deadlift', 140]]),
  session('deadlift', [['deadlift', 'Barbell Deadlift', 135]]),
];

const EXPECTED_TOTAL = HISTORY.length; // 15

useAppStore.setState({ completedSessions: HISTORY, completedCount: HISTORY.length });

// The exact bytes of what is stored, taken BEFORE anything reads it.
const storedBefore = JSON.stringify(useAppStore.getState().completedSessions);

// ─── 0. The fixture is worth testing ─────────────────────────────────────────
console.log('\n[0] The person really does have both kinds of history');

const storedIds = new Set(HISTORY.map((s) => s.sessionType));
check(
  'every retired id is present in the history',
  LEGACY_SESSION_TYPES.every((t) => storedIds.has(t)),
  `stored ids: ${[...storedIds].join(', ')}`
);
check(
  'and so is every session the app builds today for those three',
  ['lower_body', 'upper_body', 'full_body'].every((t) => storedIds.has(t)),
  `stored ids: ${[...storedIds].join(', ')}`
);
check(
  'the old and new ids carry the SAME name, which is why a merge is needed at all',
  SESSION_SHORT_LABELS.squat === SESSION_SHORT_LABELS.lower_body &&
    SESSION_SHORT_LABELS.bench === SESSION_SHORT_LABELS.upper_body &&
    SESSION_SHORT_LABELS.deadlift === SESSION_SHORT_LABELS.full_body,
  `${SESSION_SHORT_LABELS.squat} / ${SESSION_SHORT_LABELS.lower_body}`
);
check(
  'and that name is Lower Body, not a lift',
  SESSION_SHORT_LABELS.squat === 'Lower Body',
  SESSION_SHORT_LABELS.squat
);

// ─── 1. The Session Breakdown: one row per kind of session ───────────────────
console.log('\n[1] Stats shows one Lower Body row, and it counts both');

const rows = sessionTypeRows(useAppStore.getState().completedSessions);
const labelled = rows.map((r) => SESSION_SHORT_LABELS[r.type]);
const lowerRows = rows.filter((r) => SESSION_SHORT_LABELS[r.type] === 'Lower Body');

check(
  'exactly one row is headed Lower Body',
  lowerRows.length === 1,
  `rows: ${rows.map((r) => `${SESSION_SHORT_LABELS[r.type]}=${r.count}`).join(', ')}`
);
check(
  'and it counts four squat days plus three lower body days as seven',
  lowerRows.length === 1 && lowerRows[0].count === 7,
  `count: ${lowerRows[0]?.count}`
);
check(
  'no two rows print the same heading',
  new Set(labelled).size === labelled.length,
  labelled.join(', ')
);
check(
  'the rows add up to the number of sessions, so nothing is counted twice or lost',
  rows.reduce((n, r) => n + r.count, 0) === EXPECTED_TOTAL,
  `${rows.reduce((n, r) => n + r.count, 0)} counted of ${EXPECTED_TOTAL}`
);

// The counterweight: a fold that merged everything would pass the three above.
const upperRow = rows.find((r) => r.type === 'upper_body');
const fullRow = rows.find((r) => r.type === 'full_body');
check(
  'Upper Body is still its own row, counting two bench days plus one upper body day',
  upperRow?.count === 3,
  `upper: ${upperRow?.count}`
);
check(
  'Full Body is still its own row, counting two deadlift days plus one full body day',
  fullRow?.count === 3,
  `full: ${fullRow?.count}`
);
check(
  'conditioning, which was never renamed, is untouched at two',
  rows.find((r) => r.type === 'conditioning')?.count === 2,
  `conditioning: ${rows.find((r) => r.type === 'conditioning')?.count}`
);
check(
  'a type with no history gets no row at all',
  !rows.some((r) => r.type === 'prehab' || r.type === 'flexibility' || r.type === 'custom'),
  rows.map((r) => r.type).join(', ')
);

// The control: the same fifteen sessions filed entirely under the new ids must
// produce the same rows. If the merge were double-counting, these would differ.
const allNew = HISTORY.map((s) => ({ ...s, sessionType: trainTypeOf(s.sessionType) }));
check(
  'a history with no retired ids at all produces exactly the same rows',
  JSON.stringify(sessionTypeRows(allNew)) === JSON.stringify(rows),
  `${JSON.stringify(sessionTypeRows(allNew))} vs ${JSON.stringify(rows)}`
);

check(
  'the breakdown order covers every train type, so nothing can fall off the screen',
  SESSION_BREAKDOWN_ORDER.length === Object.keys(countsByTrainType([])).length,
  `${SESSION_BREAKDOWN_ORDER.length} in the order, ${Object.keys(countsByTrainType([])).length} counted`
);

// ─── 2. Tapping that row filters to all seven ────────────────────────────────
console.log('\n[2] Tapping the merged row shows every session it counted');

const stored = useAppStore.getState().completedSessions;
const lowerFiltered = stored.filter((s) => matchesTypeFilter(s.sessionType, 'lower_body'));
check(
  'filtering to Lower Body returns seven sessions',
  lowerFiltered.length === 7,
  `${lowerFiltered.length} returned`
);
check(
  'and those seven include the old squat days',
  lowerFiltered.filter((s) => s.sessionType === 'squat').length === 4,
  lowerFiltered.map((s) => s.sessionType).join(', ')
);
check(
  'the filtered count equals the count printed on the row',
  lowerFiltered.length === lowerRows[0]?.count,
  `${lowerFiltered.length} vs ${lowerRows[0]?.count}`
);
check(
  'no filter at all returns everything',
  stored.filter((s) => matchesTypeFilter(s.sessionType, null)).length === EXPECTED_TOTAL,
  ''
);
check(
  'filtering to Upper Body does not sweep up the lower body sessions',
  stored.filter((s) => matchesTypeFilter(s.sessionType, 'upper_body')).length === 3,
  ''
);
// The filter is persisted, so somebody may still have a retired id stored.
check(
  'a filter saved as "squat" before the rebuild selects the merged Lower Body row',
  displayTypeFilter('squat') === 'lower_body' && displayTypeFilter(null) === null,
  `${displayTypeFilter('squat')}`
);

// ─── 3. The Progress tab groups the exercises the same way ───────────────────
console.log('\n[3] One Lower Body group of exercises, not two');

const progress = useAppStore.getState().getAllExerciseProgress();
const groups = groupByTrainType(progress, EXERCISE_GROUP_ORDER);
const lowerGroups = groups.filter((g) => SESSION_SHORT_LABELS[g.type] === 'Lower Body');

check(
  'the store really did file the Back Squat under a retired id',
  progress.find((p) => p.exerciseName === 'Barbell Back Squat')?.sessionType === 'squat',
  progress.map((p) => `${p.exerciseName}:${p.sessionType}`).join(', ')
);
check(
  'exactly one group is headed Lower Body',
  lowerGroups.length === 1,
  groups.map((g) => SESSION_SHORT_LABELS[g.type]).join(', ')
);
check(
  'the Back Squat and the Leg Press are in it together',
  lowerGroups[0]?.items.some((p) => p.exerciseName === 'Barbell Back Squat') &&
    lowerGroups[0]?.items.some((p) => p.exerciseName === 'Leg Press'),
  lowerGroups[0]?.items.map((p) => p.exerciseName).join(', ')
);
check(
  'every exercise appears in exactly one group, and none is dropped',
  groups.reduce((n, g) => n + g.items.length, 0) === progress.length,
  `${groups.reduce((n, g) => n + g.items.length, 0)} grouped of ${progress.length}`
);
check(
  'the bench press is still under Upper Body, not swept into Lower',
  groups.find((g) => g.type === 'upper_body')?.items.some((p) => p.exerciseId === 'bench-press'),
  ''
);
check(
  'the group order covers every train type, so no exercise can vanish from the tab',
  EXERCISE_GROUP_ORDER.length === Object.keys(countsByTrainType([])).length,
  `${EXERCISE_GROUP_ORDER.length} in the order`
);

// ─── 4. Your Programme reads the old days as the sessions they were ──────────
console.log('\n[4] "Last trained" and the training mix count the old days');

const lastLower = lastSessionOfTrainType(stored, 'lower_body');
check(
  'the most recent Lower Body session is found',
  lastLower?.sessionType === 'lower_body' && lastLower?.id === 's1',
  `${lastLower?.id} / ${lastLower?.sessionType}`
);
// Strip the new ones and only the retired ids are left: it must still answer.
const legacyOnly = stored.filter((s) => s.sessionType === 'squat');
check(
  'somebody whose only leg history is squat days is NOT told "not done yet"',
  lastSessionOfTrainType(legacyOnly, 'lower_body')?.sessionType === 'squat',
  `${lastSessionOfTrainType(legacyOnly, 'lower_body')?.sessionType}`
);
check(
  'and a type they have genuinely never trained still answers with nothing',
  lastSessionOfTrainType(stored, 'flexibility') === undefined,
  ''
);

const mix = trainingMixTypes(stored);
const mixNames = mix.map((t) => SESSION_DISPLAY_NAMES[t]);
check(
  'the training mix names no session twice',
  new Set(mixNames).size === mixNames.length,
  mixNames.join(' · ')
);
check(
  'and it leads with Lower Body, which is what they have done most of',
  mix[0] === 'lower_body',
  mixNames.join(' · ')
);

// ─── 5. The chips under a finished block ─────────────────────────────────────
console.log('\n[5] A frozen report prints one chip per kind of session');

// Shaped exactly as lib/programme-report.ts stores it for a block trained under
// the old rotation. The stored report is never rewritten; this is the reader.
const frozenByType = [
  { type: 'squat', count: 4 },
  { type: 'conditioning', count: 2 },
  { type: 'lower_body', count: 3 },
  { type: 'bench', count: 1 },
];
const frozenSnapshot = JSON.stringify(frozenByType);
const chips = mergeTypeCounts(frozenByType);
check(
  'four stored entries become three chips',
  chips.length === 3,
  JSON.stringify(chips)
);
check(
  'the Lower Body chip reads seven',
  chips.find((c) => c.type === 'lower_body')?.count === 7,
  JSON.stringify(chips)
);
check(
  'no chip is printed twice',
  new Set(chips.map((c) => SESSION_DISPLAY_NAMES[c.type])).size === chips.length,
  chips.map((c) => SESSION_DISPLAY_NAMES[c.type]).join(', ')
);
check(
  'the chips still add up to the sessions the block counted',
  chips.reduce((n, c) => n + c.count, 0) ===
    frozenByType.reduce((n, t) => n + t.count, 0),
  ''
);
check(
  'and the frozen report itself is not edited by being read',
  JSON.stringify(frozenByType) === frozenSnapshot,
  JSON.stringify(frozenByType)
);

// ─── 6. Nothing was written ──────────────────────────────────────────────────
console.log('\n[6] The stored history is byte-identical after all of that');

const after = useAppStore.getState().completedSessions;
check(
  'completedSessions is byte for byte what it was before anything read it',
  JSON.stringify(after) === storedBefore,
  'the display grouping wrote to the stored history'
);
check(
  'and it is the same array object, so nothing replaced it either',
  after === HISTORY,
  ''
);
check(
  'every session still carries the id it was logged under',
  after.filter((s) => LEGACY_SESSION_TYPES.includes(s.sessionType)).length === 8,
  after.map((s) => s.sessionType).join(', ')
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
