/**
 * Contract test: nobody is served a session named after a barbell lift.
 *
 * WHAT THIS IS GUARDING
 * ─────────────────────
 * The app used to be three days a week of squat, bench and deadlift, and three
 * of the ten stored session ids are still those words. They cannot be deleted:
 * they sit in years of somebody's completed sessions, in whatever the server
 * last synced back, in a frozen programme report that must never be rewritten,
 * and in the Barbell Strength cycle somebody may be nine sessions into.
 *
 * So they stay readable and stop being built. lib/session-type.ts is the one
 * place that says what they mean now - a squat day is a lower body day, a bench
 * day an upper body day, a deadlift day a full body day - and this file holds
 * the three promises that follow from it:
 *
 *   1. THE SESSION IS THE SAME SESSION. Not similar, not "also fine": a stored
 *      'squat' and a 'lower_body' asked the same question on the same day with
 *      the same history come back card for card identical, down to the load on
 *      every set and the alternatives offered in the swap sheet. Anything less
 *      and there are still two lower body generators in the app, one of which
 *      nobody is maintaining.
 *
 *   2. THE NAME NEVER SAYS A LIFT. Every table that turns a stored id into
 *      something a person reads - the session screen title, the history list,
 *      the programme report's chips, the archived cycle line - resolves all
 *      three to the name of the session it now is.
 *
 *   3. IT HOLDS FOR DATA NOBODY CAN EDIT. A frozen report, an archived block
 *      and a custom cycle built before any of this all still resolve, and all
 *      still route.
 *
 * HOW IT IS TESTED
 * ────────────────
 * By running the real generator, the real report builder and the real label
 * tables, never by reading source for a spelling. The clock is frozen because
 * the rotation seed adds today's date, so a run crossing midnight would compare
 * two different days.
 *
 * The comparisons are guarded against being vacuously true: the three train
 * types are first proved to generate DIFFERENT sessions from each other and to
 * carry DIFFERENT names, so "squat matches lower_body" is a real claim rather
 * than three empty lists matching three empty lists.
 *
 * Run:  npx tsx tests/legacy-session-ids.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

const RealDate = Date;
const FIXED_NOW = RealDate.UTC(2026, 2, 11, 9, 0, 0);
globalThis.Date = class FixedDate extends RealDate {
  constructor(...args) {
    super(...(args.length > 0 ? args : [FIXED_NOW]));
  }
  static now() {
    return FIXED_NOW;
  }
};

// Imported after the clock is frozen, so nothing in lib/ can read the real one.
const { trainTypeOf, LEGACY_SESSION_TYPES, isLegacySessionType } = await import(
  '../lib/session-type.ts'
);
const { generateWorkout, getSessionLabel, getSessionSubtitle, getSessionIcon } = await import(
  '../lib/workout-engine.ts'
);
// STORED_SESSION_ID_COUNT was called SESSION_TYPE_COUNT until the copy sweep.
// Under that name the showcase and the paywall both printed it as the number of
// sessions on offer, which it is not: it counts stored ids, three of which are
// the lift days kept only so an old history still resolves to a name.
const { SESSION_META, SESSION_DISPLAY_NAMES, SESSION_SHORT_LABELS, STORED_SESSION_ID_COUNT } =
  await import('../lib/session-meta.ts');
// lib/session-images.ts is deliberately NOT imported here: its tables are built
// from `require('....png')`, which node cannot parse, and jest maps every image
// to one shared stub so a comparison there would pass whatever the code did.
// Its guard is the typecheck instead - the artwork tables are keyed by
// TrainSessionType, so a stored id cannot be looked up without trainTypeOf.
const { cycleOf, cycleFor, PROGRAMMES, BUILDABLE_SESSION_TYPES } = await import(
  '../lib/programme.ts'
);
const { buildProgrammeReport, completeProgramme } = await import('../lib/programme-report.ts');
await import('./_persist-shim.mjs');
const { EXPERIENCE_LEVELS } = await import('../lib/store.ts');

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

/** Every stored session id there is, taken from the label table rather than typed out. */
const ALL_TYPES = Object.keys(SESSION_DISPLAY_NAMES);
const TRAIN_TYPES = ALL_TYPES.filter((t) => !isLegacySessionType(t));
/** The three pairings this whole file is about, derived rather than hand-written. */
const PAIRS = LEGACY_SESSION_TYPES.map((legacy) => [legacy, trainTypeOf(legacy)]);

/** The words that must never appear in a name somebody reads. */
const LIFT_WORDS = ['squat', 'bench', 'deadlift'];
const namesALift = (text) => LIFT_WORDS.some((w) => String(text).toLowerCase().includes(w));

// ─── 1. The map ──────────────────────────────────────────────────────────────
console.log('\n[1] What the three stored ids mean now');

check(
  'a squat day is a lower body day',
  trainTypeOf('squat') === 'lower_body',
  `got ${trainTypeOf('squat')}`
);
check(
  'a bench day is an upper body day',
  trainTypeOf('bench') === 'upper_body',
  `got ${trainTypeOf('bench')}`
);
check(
  'a deadlift day is a full body day',
  trainTypeOf('deadlift') === 'full_body',
  `got ${trainTypeOf('deadlift')}`
);
check(
  'and every other stored id is already what it says it is',
  TRAIN_TYPES.length > 0 && TRAIN_TYPES.every((t) => trainTypeOf(t) === t),
  TRAIN_TYPES.filter((t) => trainTypeOf(t) !== t).join(', ')
);
check(
  'every one of the ten ids maps to something real, so none can go missing',
  ALL_TYPES.length === STORED_SESSION_ID_COUNT &&
    ALL_TYPES.every((t) => ALL_TYPES.includes(trainTypeOf(t))),
  ALL_TYPES.filter((t) => !ALL_TYPES.includes(trainTypeOf(t))).join(', ')
);
check(
  'mapping twice changes nothing, so it is safe to call anywhere',
  ALL_TYPES.every((t) => trainTypeOf(trainTypeOf(t)) === trainTypeOf(t)),
  ''
);

// ─── 2. The session built is the SAME session ────────────────────────────────
console.log('\n[2] A stored squat day builds a lower body session, card for card');

/**
 * Everything a card shows, flattened to a string.
 *
 * Every field the session screen or the swap sheet can render, so a difference
 * in the load on set three, in the cue, in the safety note or in the second
 * alternative offered all count as a difference. Comparing names alone would
 * pass on two sessions holding the same exercises at different weights.
 */
function signature(exercises) {
  return exercises
    .map((e) =>
      [
        e.id,
        e.name,
        e.sets,
        e.reps,
        e.cue,
        e.suggestedLoad,
        (e.loadKg ?? []).join('/'),
        e.category,
        e.type,
        e.badge,
        e.safetyNote,
        e.progressionNote,
        e.progressionDirection,
        e.hasSwap,
        e.swapName,
        e.swapCue,
        e.swapLoad,
        e.swapKind,
        e.swapReason,
        e.swap2Name,
        e.swap2Cue,
        e.swap2Load,
      ].join('|')
    )
    .join('\n');
}

const TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const TIMES = ['30', '45', '60'];
const SEEDS = [0, 4, 17];
const PAIN_STATES = [
  { hasAches: false, painRegion: null, painSeverity: 'mild', acute: false },
  { hasAches: true, painRegion: ['front_shoulder'], painSeverity: 'moderate', acute: false },
];

const profileFor = (level) => ({
  name: 'Probe',
  sex: 'male',
  ageYears: 34,
  experienceLevel: level,
  goals: ['muscle'],
  bodyweightKg: 82,
  standingSoreRegions: [],
  clinicalAvoid: [],
  maxKitKg: 0,
});

/** One session, built the way app/session.tsx builds it. */
function build(type, { level, tier, time, seed, pain, energy = 'normal' }) {
  return generateWorkout(
    type,
    tier,
    { ...pain, energy, timeAvailable: time, deload: false },
    profileFor(level),
    undefined,
    undefined,
    seed,
    undefined,
    undefined,
    undefined,
    0,
    'kg'
  );
}

/** Every combination the sweep below walks. Built once and reused. */
const GRID = [];
for (const level of EXPERIENCE_LEVELS) {
  for (const tier of TIERS) {
    for (const time of TIMES) {
      for (const seed of SEEDS) {
        for (let p = 0; p < PAIN_STATES.length; p++) {
          GRID.push({ level, tier, time, seed, pain: PAIN_STATES[p], painIndex: p });
        }
      }
    }
  }
}

check(
  `the sweep is a real sweep (${GRID.length} combinations of level, kit, length, history and pain)`,
  GRID.length >= 300,
  `${GRID.length}`
);

// FIRST: prove the three target sessions are genuinely different from one
// another. Without this, everything below would pass on three empty lists.
{
  let allThreeDiffer = 0;
  let anyEmpty = 0;
  for (const c of GRID) {
    const sigs = ['lower_body', 'upper_body', 'full_body'].map((t) => signature(build(t, c)));
    if (sigs.some((s) => s.length === 0)) anyEmpty++;
    if (new Set(sigs).size === 3) allThreeDiffer++;
  }
  check(
    'lower, upper and full body are three different sessions everywhere',
    allThreeDiffer === GRID.length,
    `${GRID.length - allThreeDiffer} of ${GRID.length} combinations had two of them identical`
  );
  check(
    'and none of them is ever an empty session',
    anyEmpty === 0,
    `${anyEmpty} combinations produced an empty list, which would make the match below meaningless`
  );
}

for (const [legacy, train] of PAIRS) {
  const mismatches = [];
  for (const c of GRID) {
    const a = signature(build(legacy, c));
    const b = signature(build(train, c));
    if (a !== b) {
      mismatches.push(`${c.level}/${c.tier}/${c.time}min/seed ${c.seed}/pain ${c.painIndex}`);
    }
  }
  check(
    `a stored '${legacy}' session is the '${train}' session, exactly, in all ${GRID.length} combinations`,
    mismatches.length === 0,
    mismatches.slice(0, 5).join('; ') + (mismatches.length > 5 ? ` (+${mismatches.length - 5})` : '')
  );
}

// And it is not simply that all three legacy ids return the same thing.
{
  const legacySigs = LEGACY_SESSION_TYPES.map((t) =>
    signature(build(t, { level: 'intermediate', tier: 'fullgym', time: '60', seed: 3, pain: PAIN_STATES[0] }))
  );
  check(
    'the three of them still produce three different sessions, not one',
    new Set(legacySigs).size === 3,
    'two legacy ids collapsed onto the same session, so the map is not the map'
  );
}

// A deload week and a pounds gym, because those run through separate code after
// the generator has picked the exercises and are where a near miss would show.
{
  let same = 0;
  let of = 0;
  for (const [legacy, train] of PAIRS) {
    for (const loadUnit of ['kg', 'lb']) {
      for (const deload of [true, false]) {
        const args = [
          'fullgym',
          {
            hasAches: false,
            painRegion: null,
            painSeverity: 'mild',
            acute: false,
            energy: 'normal',
            timeAvailable: '60',
            deload,
          },
          profileFor('advanced'),
          undefined,
          undefined,
          9,
          undefined,
          undefined,
          undefined,
          0,
          loadUnit,
        ];
        of++;
        if (
          signature(generateWorkout(legacy, ...args)) === signature(generateWorkout(train, ...args))
        ) {
          same++;
        }
      }
    }
  }
  check(
    'the match survives an easier week and a gym stocked in pounds',
    same === of,
    `${of - same} of ${of} differed`
  );
}

// ─── 3. The name never says a lift ───────────────────────────────────────────
console.log('\n[3] Every name a person reads');

/** Every table that turns a stored id into something a person reads. */
const LABELLERS = [
  ['the session screen title and history list', (t) => getSessionLabel(t)],
  ['the programme report chips', (t) => SESSION_DISPLAY_NAMES[t]],
  ['the archived cycle line', (t) => SESSION_SHORT_LABELS[t]],
  ['the session card', (t) => SESSION_META[t]?.label],
];

for (const [where, labelOf] of LABELLERS) {
  check(
    `${where}: all ten ids resolve to a real name`,
    ALL_TYPES.every((t) => typeof labelOf(t) === 'string' && labelOf(t).trim().length > 0),
    ALL_TYPES.filter((t) => !labelOf(t)).join(', ')
  );
  check(
    `${where}: not one of them names a barbell lift`,
    ALL_TYPES.every((t) => !namesALift(labelOf(t))),
    ALL_TYPES.filter((t) => namesALift(labelOf(t)))
      .map((t) => `${t} -> ${labelOf(t)}`)
      .join('; ')
  );
  check(
    `${where}: a stored squat, bench and deadlift read as their new session`,
    PAIRS.every(([legacy, train]) => labelOf(legacy) === labelOf(train)),
    PAIRS.map(([l, t]) => `${l} -> ${labelOf(l)} vs ${t} -> ${labelOf(t)}`).join('; ')
  );
  // Without this the three assertions above would hold if every session in the
  // app were called the same thing.
  check(
    `${where}: and the sessions that are different are still named differently`,
    new Set(TRAIN_TYPES.map(labelOf)).size === TRAIN_TYPES.length,
    TRAIN_TYPES.map(labelOf).join(', ')
  );
}

check(
  'no name anywhere still says KPI',
  ALL_TYPES.every(
    (t) =>
      !/\bkpi\b/i.test(getSessionLabel(t)) &&
      !/\bkpi\b/i.test(SESSION_DISPLAY_NAMES[t]) &&
      !/\bkpi\b/i.test(SESSION_SHORT_LABELS[t]) &&
      !/\bkpi\b/i.test(SESSION_META[t].label)
  ),
  ALL_TYPES.filter((t) => /\bkpi\b/i.test(SESSION_META[t].label)).join(', ')
);
check(
  'the card a stored squat session draws is the lower body card entire, subtitle and icon too',
  PAIRS.every(
    ([legacy, train]) =>
      SESSION_META[legacy].label === SESSION_META[train].label &&
      SESSION_META[legacy].subtitle === SESSION_META[train].subtitle &&
      SESSION_META[legacy].icon === SESSION_META[train].icon
  ),
  PAIRS.map(([l]) => `${l}: ${JSON.stringify(SESSION_META[l])}`).join(' ')
);
check(
  'the readiness screen subtitle and icon follow the same map',
  PAIRS.every(
    ([legacy, train]) =>
      getSessionSubtitle(legacy) === getSessionSubtitle(train) &&
      getSessionIcon(legacy) === getSessionIcon(train)
  ),
  PAIRS.map(([l]) => `${l}: ${getSessionSubtitle(l)} / ${getSessionIcon(l)}`).join('; ')
);
check(
  'and the subtitles still tell the seven real sessions apart',
  new Set(TRAIN_TYPES.map(getSessionSubtitle)).size === TRAIN_TYPES.length,
  TRAIN_TYPES.map(getSessionSubtitle).join(' | ')
);

// ─── 4. Programme cycles, including ones already running ─────────────────────
console.log('\n[4] Cycles that still hold the old ids');

const barbellCycles = [2, 3, 4, 5].map((days) => cycleFor('barbell', days));
check(
  'the Barbell Strength cycle really does still hold the old ids, at every day count',
  barbellCycles.every((c) => c.some((t) => isLegacySessionType(t))),
  barbellCycles.map((c) => c.join(',')).join(' | ')
);

{
  const unresolved = [];
  const liftNamed = [];
  for (const id of Object.keys(PROGRAMMES)) {
    for (const days of [2, 3, 4, 5]) {
      for (const t of cycleFor(id, days)) {
        const short = SESSION_SHORT_LABELS[t];
        const long = SESSION_DISPLAY_NAMES[t];
        if (!short || !long) unresolved.push(`${id}/${days}: ${t}`);
        else if (namesALift(short) || namesALift(long)) liftNamed.push(`${id}/${days}: ${t}`);
      }
    }
  }
  check(
    'every session of every programme, at every day count, resolves to a name',
    unresolved.length === 0,
    unresolved.slice(0, 6).join('; ')
  );
  check(
    'and not one of those names is a lift',
    liftNamed.length === 0,
    liftNamed.slice(0, 6).join('; ')
  );
}

{
  // The whole Barbell Strength cycle, generated the way the session screen
  // would generate it for somebody part way through their block.
  const cycle = cycleFor('barbell', 5);
  const mismatched = cycle.filter((t) => {
    const args = { level: 'intermediate', tier: 'fullgym', time: '45', seed: 6, pain: PAIN_STATES[0] };
    return signature(build(t, args)) !== signature(build(trainTypeOf(t), args));
  });
  check(
    'somebody nine sessions into Barbell Strength gets the new session for every slot of it',
    mismatched.length === 0,
    mismatched.join(', ')
  );
}

{
  // A cycle somebody built themselves before any of this, held on the enrolment
  // rather than in the template table. cycleOf is what every screen calls.
  const enrolment = {
    templateId: 'custom',
    days: 3,
    sessions: 12,
    minutes: 45,
    startedAt: '2025-11-02T09:00:00.000Z',
    startedAtSessionCount: 0,
    custom: { name: 'My old three day', cycle: ['squat', 'bench', 'deadlift', 'conditioning'] },
  };
  const cycle = cycleOf(enrolment);
  check(
    'a custom cycle built before the change still comes back exactly as it was stored',
    cycle.join(',') === 'squat,bench,deadlift,conditioning',
    cycle.join(',')
  );
  check(
    'every slot of it still shows a name, and none of them is a lift',
    cycle.every((t) => SESSION_SHORT_LABELS[t] && !namesALift(SESSION_SHORT_LABELS[t])),
    cycle.map((t) => `${t} -> ${SESSION_SHORT_LABELS[t]}`).join('; ')
  );
  const args = { level: 'beginner', tier: 'dumbbells', time: '45', seed: 2, pain: PAIN_STATES[0] };
  check(
    'and every slot of it generates the session its new name promises',
    cycle.every((t) => signature(build(t, args)) === signature(build(trainTypeOf(t), args))),
    cycle.filter((t) => signature(build(t, args)) !== signature(build(trainTypeOf(t), args))).join(', ')
  );
}

check(
  'nobody can put a lift-named session into a NEW cycle',
  BUILDABLE_SESSION_TYPES.length > 0 &&
    !BUILDABLE_SESSION_TYPES.some((t) => isLegacySessionType(t)),
  BUILDABLE_SESSION_TYPES.join(', ')
);
check(
  'and every session they can put in one builds something',
  BUILDABLE_SESSION_TYPES.every(
    (t) =>
      build(t, { level: 'intermediate', tier: 'fullgym', time: '45', seed: 1, pain: PAIN_STATES[0] })
        .length > 0
  ),
  BUILDABLE_SESSION_TYPES.filter(
    (t) =>
      build(t, { level: 'intermediate', tier: 'fullgym', time: '45', seed: 1, pain: PAIN_STATES[0] })
        .length === 0
  ).join(', ')
);

// ─── 5. Frozen reports and archived blocks ───────────────────────────────────
console.log('\n[5] A report that was frozen years ago still reads');

let idSeq = 0;
const sess = (sessionType, over = {}) => ({
  id: `L${++idSeq}`,
  sessionType,
  date: `2025-11-${String(2 + (idSeq % 26)).padStart(2, '0')}T10:00:00.000Z`,
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '60',
  exerciseCount: 3,
  durationSeconds: 45 * 60,
  exerciseLogs: [
    {
      exerciseId: 'bb_squat',
      exerciseName: 'Back Squat',
      sets: [
        { setNumber: 1, weight: 100, reps: 5, completed: true },
        { setNumber: 2, weight: 100, reps: 5, completed: true },
      ],
    },
  ],
  ...over,
});

const oldBlock = {
  templateId: 'barbell',
  days: 3,
  sessions: 12,
  minutes: 45,
  startedAt: '2025-11-01T09:00:00.000Z',
  startedAtSessionCount: 0,
};
const oldCycle = cycleOf(oldBlock);
const oldSessions = Array.from({ length: 12 }, (_, i) => sess(oldCycle[i % oldCycle.length]));
const reportInput = {
  programme: oldBlock,
  sessionsSinceEnrolment: oldSessions,
  historyBefore: [],
  experience: 'intermediate',
  finishedAt: '2026-01-10T00:00:00.000Z',
};
const frozen = buildProgrammeReport(reportInput);
const archived = completeProgramme(reportInput);

check(
  'the frozen report really is full of the old ids, or this section proves nothing',
  frozen.byType.some((t) => isLegacySessionType(t.type)) &&
    frozen.cycle.some((t) => isLegacySessionType(t)),
  JSON.stringify(frozen.byType)
);
check(
  'every chip on it resolves to a name',
  frozen.byType.every(
    (t) => typeof SESSION_DISPLAY_NAMES[t.type] === 'string' && SESSION_DISPLAY_NAMES[t.type]
  ),
  frozen.byType.map((t) => `${t.type} -> ${SESSION_DISPLAY_NAMES[t.type]}`).join('; ')
);
check(
  'and not one of them names a lift',
  frozen.byType.every((t) => !namesALift(SESSION_DISPLAY_NAMES[t.type])),
  frozen.byType.map((t) => `${t.type} -> ${SESSION_DISPLAY_NAMES[t.type]}`).join('; ')
);
check(
  'the counts underneath the names are untouched, because the report is a record',
  frozen.byType.reduce((n, t) => n + t.count, 0) === 12 && frozen.onPlan === 12,
  `${frozen.byType.reduce((n, t) => n + t.count, 0)} counted, ${frozen.onPlan} on plan`
);

// The archived cycle line, built exactly as app/completed-programmes.tsx and
// components/ProgrammeStats.tsx build it.
{
  const line = archived.cycle.map((t) => SESSION_SHORT_LABELS[t]).join(' · ');
  check(
    'the archived block still prints its cycle',
    archived.cycle.length > 0 && !line.includes('undefined') && line.trim().length > 0,
    line
  );
  check(
    'and that line does not name a lift either',
    !namesALift(line),
    line
  );
}

// And the same for a history row: past-sessions, the summary and the session
// screen all fall back to getSessionLabel when a session has no stored label.
{
  const rows = oldSessions.map((s) => s.displayLabel ?? getSessionLabel(s.sessionType));
  check(
    'every session in that old block reads as a session the app still offers',
    rows.every((r) => r && !namesALift(r)),
    [...new Set(rows)].join(', ')
  );
  check(
    'and the three days of it are still told apart',
    new Set(rows).size === 3,
    [...new Set(rows)].join(', ')
  );
}

console.log(`\nlegacy-session-ids: ${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
