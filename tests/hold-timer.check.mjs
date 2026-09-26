/**
 * Contract test: the clock starts when they press start, and tells them when it
 * is done.
 *
 * WHAT ARCHIE SAID, 25 SEPTEMBER 2026, AFTER TESTING ON EXPO
 * ──────────────────────────────────────────────────────────
 *   "For exercises that require timing the counter should start when the client
 *    presses start."
 *   "App should make a noise or vibrate when exercise timer has complete to
 *    alert the client to stop."
 *
 * WHAT WAS WRONG, MEASURED BEFORE THE CHANGE OVER THE SWEEP BELOW
 * ──────────────────────────────────────────────────────────────
 * 24,960 real sessions, 867 distinct cards. 119 of them (13.7%) are prescribed on
 * a clock, across 58 distinct exercises and 18 distinct ways of writing a
 * duration. 60 of the 119 say "each side", "each leg" or "each arm".
 *
 *                                                            before   after
 *   clock-prescribed cards with a counter                          3     119
 *   counters that start themselves, with nobody pressing           3       0
 *   counters that handle "each side"                               0      60
 *   counters that warn before zero                                 0     119
 *   cards NOT prescribed on a clock that could get a counter      any    none
 *
 * The three were the cardio warm-up, the only exercise in the app that had a
 * counter, and it was created already running: a three-minute warm-up on the
 * first card of a session began while the plan screen was still on top and could
 * finish, and buzz, before the person pressed Start.
 *
 * THE PART THAT IS NOT IN THIS FILE, SAID PLAINLY
 * ──────────────────────────────────────────────
 * The vibration itself. No node check can feel a phone buzz, and no check in
 * this repo asserts a haptic (grepped: zero hits for "haptic" or "vibrat" in
 * every check and the jest suite). What IS asserted here is everything that
 * decides whether and when to buzz: which cards have a clock, how long it runs,
 * how many times, and the exact crossing that each of the two alerts belongs to.
 * The screen's job is one call to buzzForAlert per alert this file counts, and
 * that wiring was verified by reading it.
 *
 * WHY THE RULES ARE IN A LIB FILE AND NOT IN THE SCREEN
 * ────────────────────────────────────────────────────
 * Because of this file. A node check can import a lib file and cannot import a
 * React Native screen, so a state machine left inside the component could only
 * ever be tested by matching source text - and this repo's commonest defect is a
 * test that pins a spelling and stays green while the behaviour breaks. Every
 * assertion below RUNS lib/hold-timer.ts. Thirty seconds of clock is driven
 * second by second in under a millisecond.
 *
 * Sections:
 *   [0] the sweep is big enough for the rest to mean anything
 *   [1] WHICH CARDS GET A COUNTER: the enumeration, both directions
 *  [1b] no duration is ever invented
 *  [1c] the three groups Archie named all have one
 *  [1d] the clinical rule the old warm-up predicate protected, re-expressed
 *  [1e] the rest timer's own rule is untouched by the card it now draws on
 *   [2] NOTHING STARTS ON ITS OWN
 *   [3] it counts DOWN, and a backgrounded phone cannot freeze it
 *   [4] "each side" runs one side and WAITS
 *   [5] the alert: one warning three seconds out, one at zero, once each
 *   [6] the words it says
 *
 * Run:  npx tsx tests/hold-timer.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { generateWorkout } from '../lib/workout-engine.ts';
import { assembleSession, exercisesInCategory } from '../lib/session-builder.ts';
import { doseOfPrescription } from '../lib/set-logging.ts';
import { restSecondsForSet } from '../lib/rep-scheme.ts';
import {
  NEARLY_SECONDS,
  alertForCrossing,
  clockFace,
  clockSecondsIn,
  holdButtonLabel,
  holdClockFor,
  holdInitialState,
  holdPressLabel,
  holdRunLabel,
  holdStep,
  remainingAt,
  swapPromptFor,
} from '../lib/hold-timer.ts';

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

// ── The sweep ────────────────────────────────────────────────────────────────
// The same shape as tests/logging-a-set.check.mjs, because it is the same
// question asked of the same sentence: what does this card prescribe?

const KITS = [
  [],
  ['dumbbells'],
  ['kettlebells'],
  ['barbell', 'bench'],
  ['fullgym', 'bench', 'sled', 'cable', 'trapbar'],
];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'athlete'];
const GOALS = [['muscle'], ['strength'], ['power'], ['fat_loss'], ['rehab'], ['fitness']];
const TIMES = ['30', '45', '60', '90'];
const TYPES = ['lower_body', 'upper_body', 'full_body', 'conditioning', 'prehab', 'flexibility'];
const REGIONS = [
  null,
  'knee',
  'front_shoulder',
  'rear_shoulder',
  'lower_back',
  'upper_back',
  'neck',
  'ankle_achilles',
  'calf_shin',
  'hamstrings',
  'quads',
  'glutes',
  'hip_groin',
  'wrist',
  'elbow',
  'core_ribs',
  'chest',
  'bicep',
  'tricep',
  'lat_mid_back',
];

/** The sixteen arguments are positional; `libraryFacts` is the sixteenth. */
function buildSession(sessionType, tier, readiness, profile, seed, equipment) {
  return generateWorkout(
    sessionType,
    tier,
    readiness,
    profile,
    undefined,
    undefined,
    seed,
    undefined,
    undefined,
    undefined,
    null,
    'kg',
    undefined,
    undefined,
    0,
    { equipment, sessionTypeCount: seed }
  );
}

const cards = new Map();
let sessionsBuilt = 0;
const remember = (list) => {
  for (const card of list) {
    cards.set(`${card.name}|${card.category}|${card.reps}|${card.suggestedLoad}`, card);
  }
};

for (const kit of KITS)
  for (const experienceLevel of LEVELS)
    for (const goals of GOALS)
      for (const timeAvailable of TIMES)
        for (const seed of [0, 1, 2, 3, 4, 5, 6, 7]) {
          const profile = { name: 'T', sex: 'male', experienceLevel, goals, bodyweightKg: 80 };
          const readiness = { hasAches: false, energy: 'normal', timeAvailable };
          for (const sessionType of TYPES) {
            remember(buildSession(sessionType, kit[0] ?? 'bodyweight', readiness, profile, seed, kit));
            sessionsBuilt++;
          }
        }

const FULL_KIT = ['fullgym', 'bench', 'sled', 'cable', 'trapbar'];
for (const painRegion of REGIONS)
  for (const severe of [true, false])
    for (const experienceLevel of ['beginner', 'athlete'])
      for (const seed of [0, 1, 2, 3]) {
        const profile = {
          name: 'T',
          sex: 'female',
          experienceLevel,
          goals: ['rehab'],
          bodyweightKg: 70,
        };
        const readiness = {
          hasAches: painRegion !== null,
          energy: severe ? 'low' : 'normal',
          timeAvailable: '45',
          painRegion: painRegion ?? undefined,
          painSeverity: severe ? 'severe' : 'mild',
        };
        for (const sessionType of TYPES) {
          remember(buildSession(sessionType, 'fullgym', readiness, profile, seed, FULL_KIT));
          sessionsBuilt++;
        }
      }

const rows = [...cards.values()];
const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const cardsNamed = (name) => rows.filter((r) => key(r.name) === key(name));
const clocked = rows.filter((r) => holdClockFor(r.reps) !== null);
const sample = (list, n = 4) => list.slice(0, n).join(' | ');

// ─── [0] The sweep ───────────────────────────────────────────────────────────
console.log('\n[0] The sweep is big enough for the rest to mean anything');
check(
  `real sessions were generated (${sessionsBuilt})`,
  sessionsBuilt > 20000,
  `${sessionsBuilt} sessions`
);
check(`distinct cards to judge (${cards.size})`, cards.size > 800, `${cards.size} cards`);
check(
  `cards prescribed on a clock (${clocked.length})`,
  clocked.length > 80,
  `${clocked.length} clocked cards; if this collapses the whole file is testing an empty set`
);

// ─── [1] Which cards get a counter ───────────────────────────────────────────
console.log('\n[1] A counter lands on every card prescribed on a clock, and on no other');

/**
 * EVERY DISTINCT CLOCK PRESCRIPTION THE APP CAN PRINT, AND WHAT IT MEANS.
 *
 * A named table on purpose, and the only one in this file. A new way of writing
 * a duration has to be read by a person - is "30s at each level" two runs or
 * one? - so a prescription that is not on this list FAILS rather than quietly
 * getting whatever the parser happens to make of it. Section [1a] holds the list
 * closed in both directions.
 *
 *                               seconds  runs  swap
 */
const EXPECTED = {
  '15s': [15, 1, null],
  '20s': [20, 1, null],
  '30s': [30, 1, null],
  '40s': [40, 1, null],
  '45s': [45, 1, null],
  '60s': [60, 1, null],
  '2 min': [120, 1, null],
  '3 min': [180, 1, null],
  '5 min': [300, 1, null],
  // "3 min (slow deep breaths)" used to be here, and it was the app's only
  // prescription with a parenthetical after the duration. It was the closing
  // Diaphragmatic Breathing card, which Archie changed to "10 reps (10
  // breaths)" on 25 September 2026, so nothing prints it any more and the row
  // below would go stale. The claim it carried - a parenthetical after a
  // duration is a cue and not a second prescription - is now asked of the parser
  // directly, further down, where it does not depend on a live prescription.
  '20s each side': [20, 2, 'side'],
  '30s each side': [30, 2, 'side'],
  '40s each side': [40, 2, 'side'],
  '45s each side': [45, 2, 'side'],
  '60s each side': [60, 2, 'side'],
  '45s each leg': [45, 2, 'leg'],
  // Two things to swap: which way the wrist bends AND which arm. Four runs.
  '30s each way, each arm': [30, 4, 'over'],
  // A level is NOT a side. The Floor Angel cue is one continuous slide of the
  // arms overhead and back; doubling it would be inventing a run.
  '30s at each level': [30, 1, null],
};

const missingFromTable = [...new Set(clocked.map((r) => r.reps))].filter((p) => !(p in EXPECTED));
check(
  'every clock prescription the generator prints is one this file has read',
  missingFromTable.length === 0,
  `unread: ${sample(missingFromTable.map((p) => `"${p}"`), 6)}`
);

const unusedTableRows = Object.keys(EXPECTED).filter(
  (p) => !clocked.some((r) => r.reps === p)
);
check(
  'and every row of the table is a prescription the app still prints',
  unusedTableRows.length === 0,
  `gone stale: ${sample(unusedTableRows.map((p) => `"${p}"`), 6)}`
);

const wrongClock = [];
for (const [reps, [seconds, runs, swap]] of Object.entries(EXPECTED)) {
  const got = holdClockFor(reps);
  if (!got || got.seconds !== seconds || got.runs !== runs || got.swap !== swap) {
    wrongClock.push(`"${reps}" -> ${JSON.stringify(got)}, expected ${seconds}s x${runs} ${swap}`);
  }
}
check('each one becomes the clock it says it is', wrongClock.length === 0, sample(wrongClock, 4));

const clockOnNonTime = rows.filter(
  (r) => holdClockFor(r.reps) !== null && doseOfPrescription(r.reps) !== 'time'
);
check(
  'no card gets a counter unless what it asks for is a length of time',
  clockOnNonTime.length === 0,
  sample(clockOnNonTime.map((r) => `${r.name} "${r.reps}"`))
);

const timeWithoutClock = rows.filter(
  (r) => doseOfPrescription(r.reps) === 'time' && holdClockFor(r.reps) === null
);
check(
  'and every card that IS asking for a length of time gets one',
  timeWithoutClock.length === 0,
  sample(timeWithoutClock.map((r) => `${r.name} "${r.reps}"`))
);

// ─── [1b] No duration is ever invented ───────────────────────────────────────
console.log('\n[1b] The seconds on the clock are the seconds in the sentence');

/**
 * THE CLINICAL FAULT THIS SECTION EXISTS FOR.
 *
 * The parser this replaces fell back to FIVE MINUTES when it could not read a
 * prescription, and the app told somebody to hold a six-rep Cossack squat for
 * five minutes. So the number on the clock is checked against the number in the
 * sentence for every clocked card in the sweep: it must be the first number
 * written there, in the unit written beside it, and nothing else.
 */
const invented = [];
for (const row of clocked) {
  const clock = holdClockFor(row.reps);
  const first = row.reps.match(/(\d+(?:\.\d+)?)\s*(s|secs?|seconds?|mins?|minutes?)\b/i);
  if (!first) {
    invented.push(`${row.name} "${row.reps}" has no duration in it at all`);
    continue;
  }
  const written = parseFloat(first[1]);
  const expected = /^m/i.test(first[2]) ? Math.round(written * 60) : Math.round(written);
  if (clock.seconds !== expected) {
    invented.push(`${row.name} "${row.reps}" -> ${clock.seconds}s, the sentence says ${expected}s`);
  }
}
check('no clocked card runs for a length nobody wrote down', invented.length === 0, sample(invented));

/**
 * UNREADABLE SENTENCES, ASKED OF BOTH GUARDS SEPARATELY, BECAUSE THERE ARE TWO.
 *
 * `holdClockFor` refuses these twice over: once because what they ask for is not
 * a length of time, and again because there is no duration in them to read. The
 * first refusal hides the second. Measured: putting the five-minute fallback
 * back inside `clockSecondsIn` left every assertion in this file green, because
 * nothing ever reached the fallback through `holdClockFor`.
 *
 * So the parser is driven on its own as well. It is exported for exactly this,
 * and a fallback sitting unreached inside it is a loaded gun rather than a safe
 * one - the next caller that skips the dose question inherits the Cossack squat.
 */
const UNREADABLE = ['8-10 reps', 'AMRAP', '10 deep breaths', 'Max effort', '', '5 rounds', 'To failure'];
check(
  'a sentence with no duration in it gets no clock at all, and no default',
  UNREADABLE.every((p) => holdClockFor(p) === null),
  'the five-minute fallback is what held a Cossack squat for five minutes'
);
check(
  'and the parser underneath invents nothing either, asked directly',
  UNREADABLE.every((p) => clockSecondsIn(p) === null),
  `answered ${UNREADABLE.filter((p) => clockSecondsIn(p) !== null)
    .map((p) => `"${p}" -> ${clockSecondsIn(p)}s`)
    .join(', ')} - the dose gate above is the only thing keeping that off a card`
);
check(
  'a duration outside what anybody is asked to hold gets no clock either',
  clockSecondsIn('0s') === null &&
    clockSecondsIn('45 min') === null &&
    clockSecondsIn('999 min') === null &&
    clockSecondsIn('5 min') === 300,
  'a misread sentence must lose its clock, not become a 45-minute hold'
);
check(
  'a range counts to the BOTTOM of it, which is the length that was promised',
  clockSecondsIn('30-45s') === 30 && clockSecondsIn('30 - 45 s') === 30,
  '"at least 30" must not become "hold for 45"'
);
/**
 * A PARENTHETICAL AFTER A DURATION IS A CUE, NOT A SECOND PRESCRIPTION.
 *
 * This used to be proved by a row in the table above, because the closing
 * breathing card read "3 min (slow deep breaths)". Archie changed that card to
 * "10 reps (10 breaths)" on 25 September 2026, so no live prescription is
 * written this way any more - and the way a parenthetical is read is a property
 * of the parser, not of the card, so it is asked of the parser directly. Written
 * with the wording that used to exist, so a reader can see what it was.
 */
check(
  'a cue in brackets after a duration is not counted as anything',
  holdClockFor('3 min (slow deep breaths)')?.seconds === 180 &&
    holdClockFor('3 min (slow deep breaths)')?.runs === 1 &&
    holdClockFor('30s (slow and controlled)')?.runs === 1,
  `"3 min (slow deep breaths)" reads ${JSON.stringify(holdClockFor('3 min (slow deep breaths)'))}`
);

// ─── [1c] The three groups Archie named ──────────────────────────────────────
console.log('\n[1c] The holds, the cool-down stretches and the conditioning bouts all count');

const GROUPS = {
  'the holds': ['Plank', 'Wall Sit', 'Forearm Side Plank', 'Superman Plank', 'Cable Pallof Hold'],
  'the cool-down stretches': [
    'Figure-4 Glute Stretch',
    'Pigeon Pose',
    'Standing Quad Stretch',
    'Seated Forward Fold',
  ],
  'the conditioning bouts': ['Assault Bike', 'Skipping', 'Bear Crawl'],
};
for (const [groupName, names] of Object.entries(GROUPS)) {
  const absent = names.filter((n) => cardsNamed(n).length === 0);
  check(
    `${groupName}: all ${names.length} are still cards the app builds`,
    absent.length === 0,
    `not generated: ${absent.join(', ')} - a rename would make the next check pass on an empty set`
  );
  const withoutClock = names.flatMap((n) =>
    cardsNamed(n)
      .filter((r) => doseOfPrescription(r.reps) === 'time' && holdClockFor(r.reps) === null)
      .map((r) => `${r.name} "${r.reps}"`)
  );
  check(
    `${groupName}: every clock-prescribed one of them has a counter`,
    withoutClock.length === 0,
    sample(withoutClock)
  );
}

const warmUps = rows.filter((r) => r.category === 'prep' && /\d+\s*min/.test(r.reps));
check(
  `the cardio warm-up still has its counter too (${warmUps.length} cards)`,
  warmUps.length > 0 && warmUps.every((r) => holdClockFor(r.reps) !== null),
  'it is the one card that had one before; it must not lose it to the rewrite'
);

// ─── [1d] The rule the old warm-up predicate protected ───────────────────────
console.log('\n[1d] Nothing counted in reps or in metres gets a clock');

const repsWithClock = rows.filter(
  (r) => doseOfPrescription(r.reps) === 'reps' && holdClockFor(r.reps) !== null
);
check(
  'a card counted in reps never gets one, however many seconds its sentence mentions',
  repsWithClock.length === 0,
  sample(repsWithClock.map((r) => `${r.name} "${r.reps}"`))
);

const rehabHolds = rows.filter((r) => /hold\s*\d+\s*s/i.test(r.reps));
check(
  `the rehab drills written "10 reps, hold 5s each" keep their rep counter and take no clock (${rehabHolds.length} cards)`,
  rehabHolds.length > 0 && rehabHolds.every((r) => holdClockFor(r.reps) === null),
  sample(rehabHolds.filter((r) => holdClockFor(r.reps)).map((r) => `${r.name} "${r.reps}"`))
);

const distanceWithClock = rows.filter(
  (r) => doseOfPrescription(r.reps) === 'distance' && holdClockFor(r.reps) !== null
);
check(
  'a card counted in metres never gets one: a 20 metre sled push is a walk, not twenty minutes',
  distanceWithClock.length === 0,
  sample(distanceWithClock.map((r) => `${r.name} "${r.reps}"`))
);

/**
 * THE ORIGINAL BUG, KEPT: a session built without the cardio step.
 *
 * The old predicate said "a preparation card asking for minutes", which was true
 * of the cardio warm-up in every generated session and false in a custom build
 * that skipped it - so the clock fell on the first stretch instead and the
 * parser's five-minute default answered for it. The rule is now about the
 * sentence, so the question is no longer "which card" but "does any card get a
 * clock it did not ask for". A stretch prescribed "45s each side" SHOULD get one.
 */
const pick = (t) => ({ template: t, sets: t.sets, reps: t.reps });
const cardioPool = exercisesInCategory('cardio');
const stretchPool = exercisesInCategory('active_stretch');
const kpiPool = exercisesInCategory('kpi');
const withoutCardio = assembleSession(
  'athletic',
  { mobility: [pick(stretchPool[0]), pick(stretchPool[1])], kpi: [pick(kpiPool[0])] },
  3
);
const withCardio = assembleSession(
  'athletic',
  {
    cardio: [pick(cardioPool[0])],
    mobility: [pick(stretchPool[0]), pick(stretchPool[1])],
    kpi: [pick(kpiPool[0])],
  },
  3
);
for (const [name, build] of [
  ['a custom build with cardio', withCardio],
  ['a custom build without cardio', withoutCardio],
]) {
  const wrong = build.filter(
    (e) => (holdClockFor(e.reps) !== null) !== (doseOfPrescription(e.reps) === 'time')
  );
  check(
    `${name} (${build.length} cards) gives a clock to exactly the cards asking for time`,
    build.length > 0 && wrong.length === 0,
    sample(wrong.map((e) => `${e.name} "${e.reps}"`))
  );
}
check(
  'a build without cardio still opens with a preparation exercise',
  withoutCardio.length > 0 && withoutCardio[0].category === 'prep',
  'otherwise the case above passes for the wrong reason'
);

// ─── [1e] The rest timer is untouched by the card it now draws on ────────────
console.log('\n[1e] The hand-written exclusion the warm-up card used to need is not needed');

/**
 * The screen used to render the rest timer only on cards the warm-up predicate
 * rejected. That branch is gone, and the rest timer is now drawn on every
 * non-cardio card - which changes nothing visible ONLY because rest is not
 * prescribed for the categories a warm-up, a bout or a stretch belongs to. That
 * is the fact the comment in the screen leans on, so it is measured here.
 */
const shouldHaveNoRest = rows.filter((r) =>
  ['prep', 'cardio', 'cooldown', 'finisher'].includes(r.category)
);
const restLeaked = shouldHaveNoRest.filter(
  (r) => restSecondsForSet({ category: r.category, libraryRole: r.libraryRole }) !== null
);
check(
  `prep, cardio, cool-down and finisher cards are prescribed no rest (${shouldHaveNoRest.length} cards)`,
  shouldHaveNoRest.length > 0 && restLeaked.length === 0,
  sample(restLeaked.map((r) => `${r.name} (${r.category})`))
);

// ─── [2] Nothing starts on its own ───────────────────────────────────────────
console.log('\n[2] No counter is armed to start itself');

const PHASES = ['ready', 'running', 'paused', 'swap', 'done'];
const EVENTS = ['start', 'pause', 'tick', 'reset'];
const twoSides = holdClockFor('30s each side');
const oneRun = holdClockFor('30s');
const T = 1_000_000;

/** A believable state in each phase, with the clock already most of the way down. */
const stateIn = (phase) => {
  switch (phase) {
    case 'ready':
      return holdInitialState(twoSides);
    case 'running':
      return { phase: 'running', run: 1, endAt: T + 10_000, remaining: 10 };
    case 'paused':
      return { phase: 'paused', run: 1, endAt: null, remaining: 10 };
    case 'swap':
      return { phase: 'swap', run: 2, endAt: null, remaining: 30 };
    default:
      return { phase: 'done', run: 2, endAt: null, remaining: 0 };
  }
};

check(
  'a fresh counter is stopped, with no end time and the full length showing',
  ['ready'].every(() => {
    const s = holdInitialState(twoSides);
    return s.phase === 'ready' && s.endAt === null && s.remaining === twoSides.seconds && s.run === 1;
  }),
  'this is the state every card mounts in; "running" here is the bug being fixed'
);

const startedItself = [];
for (const phase of PHASES) {
  if (phase === 'running') continue; // already on; nothing to start
  for (const event of EVENTS) {
    if (event === 'start') continue; // the press, which is allowed to
    const step = holdStep(twoSides, stateIn(phase), { kind: event, now: T + 1000 });
    if (step.state.phase === 'running' || step.state.endAt !== null) {
      startedItself.push(`${event} on a ${phase} clock -> ${step.state.phase}`);
    }
  }
}
check(
  `nothing but a press can put a stopped clock on (${(PHASES.length - 1) * (EVENTS.length - 1)} combinations)`,
  startedItself.length === 0,
  startedItself.join(' | ')
);

check(
  'a press starts it from every stopped phase',
  ['ready', 'paused', 'swap', 'done'].every(
    (phase) => holdStep(twoSides, stateIn(phase), { kind: 'start', now: T }).state.phase === 'running'
  ),
  'the other half: a counter nobody can start is worse than one that starts itself'
);

check(
  'a press on a running clock pauses rather than restarting it',
  (() => {
    const paused = holdStep(twoSides, stateIn('running'), { kind: 'pause', now: T + 1000 });
    return paused.state.phase === 'paused' && paused.state.remaining === 9;
  })(),
  'and the seconds already served are kept'
);

check(
  'resuming carries on from where it stopped, not from the top',
  (() => {
    const resumed = holdStep(twoSides, stateIn('paused'), { kind: 'start', now: T });
    return resumed.state.remaining === 10 && resumed.state.endAt === T + 10_000;
  })(),
  'a paused hold that restarted at 30 would ask for forty seconds of plank'
);

check(
  'running a finished set again starts at the first side, not the last',
  holdStep(twoSides, stateIn('done'), { kind: 'start', now: T }).state.run === 1,
  'otherwise the second set of an each-side hold only ever does the second side'
);

// ─── [3] It counts down, and cannot freeze ───────────────────────────────────
console.log('\n[3] It counts DOWN, and a phone in a pocket cannot freeze it');

const FACES = [
  [0, '00:00'],
  [1, '00:01'],
  [5, '00:05'],
  [30, '00:30'],
  [59, '00:59'],
  [60, '01:00'],
  [65, '01:05'],
  [165, '02:45'],
  [300, '05:00'],
];
const badFaces = FACES.filter(([n, want]) => clockFace(n) !== want).map(
  ([n, want]) => `${n} -> "${clockFace(n)}", expected "${want}"`
);
check('mm:ss is right at every boundary that matters', badFaces.length === 0, badFaces.join(' | '));
check(
  'a negative or absent count still reads 00:00 rather than -1:59',
  clockFace(-5) === '00:00' && remainingAt(null, T) === 0 && remainingAt(T - 5000, T) === 0,
  'the digits are the only thing on the card that says how long is left'
);

check(
  'the seconds left come out of the real clock, and go DOWN as it moves',
  remainingAt(T + 30_000, T) === 30 &&
    remainingAt(T + 30_000, T + 10_000) === 20 &&
    remainingAt(T + 30_000, T + 29_500) === 1,
  'counting up was the alternative, and nobody in a plank wants to know how long they have done'
);

const started = holdStep(oneRun, holdInitialState(oneRun), { kind: 'start', now: T }).state;
const afterOne = holdStep(oneRun, started, { kind: 'tick', now: T + 1000 }).state;
const afterGap = holdStep(oneRun, started, { kind: 'tick', now: T + 60_000 });
check(
  'one second of real time takes one second off it',
  afterOne.remaining === 29 && afterOne.phase === 'running',
  `got ${afterOne.remaining}s`
);
check(
  'and a minute spent in another app finishes a thirty-second hold rather than freezing it',
  afterGap.state.phase === 'done' && afterGap.state.remaining === 0 && afterGap.alert === 'finished',
  `got ${afterGap.state.phase} with ${afterGap.state.remaining}s left - the old warm-up timer came back frozen where it was left`
);

// ─── [4] "Each side" waits ───────────────────────────────────────────────────
console.log('\n[4] An each-side hold runs one side, alerts, and WAITS to be pressed again');

const SIDED = {
  '30s each side': ['Swap sides', 2],
  '45s each leg': ['Swap legs', 2],
  '30s each way, each arm': ['Swap over', 4],
  '30s': [null, 1],
};
const wrongPrompt = Object.entries(SIDED)
  .filter(([reps, [prompt]]) => {
    const clock = holdClockFor(reps);
    return prompt === null ? clock.runs !== 1 : swapPromptFor(clock) !== prompt;
  })
  .map(([reps, [prompt]]) => `"${reps}" asks "${swapPromptFor(holdClockFor(reps))}", expected "${prompt}"`);
check('it asks them to swap in the words the prescription used', wrongPrompt.length === 0, wrongPrompt.join(' | '));

/** Drive a whole set second by second, pressing only where a person would. */
function runWholeSet(clock, { pressOnSwap = true } = {}) {
  let state = holdInitialState(clock);
  const alerts = [];
  const presses = [];
  let now = T;
  const send = (event) => {
    const step = holdStep(clock, state, { kind: event, now });
    state = step.state;
    if (step.alert) alerts.push({ alert: step.alert, secondsIn: (now - T) / 1000 });
    return step;
  };
  send('start');
  presses.push(0);
  for (let i = 0; i < clock.seconds * clock.runs + 30; i++) {
    now += 1000;
    send('tick');
    if (state.phase === 'swap' && pressOnSwap) {
      send('start');
      presses.push((now - T) / 1000);
    }
    if (state.phase === 'done') break;
  }
  return { state, alerts, presses, secondsElapsed: (now - T) / 1000 };
}

const each30 = runWholeSet(twoSides);
check(
  'two sides need two presses, not one',
  each30.presses.length === 2,
  `pressed ${each30.presses.length} times at ${each30.presses.join('s, ')}s`
);
check(
  'the second side is thirty more seconds, so the set is a full minute of work',
  each30.secondsElapsed === 60 && each30.state.phase === 'done',
  `finished after ${each30.secondsElapsed}s in phase ${each30.state.phase}`
);

const waited = (() => {
  let state = holdInitialState(twoSides);
  state = holdStep(twoSides, state, { kind: 'start', now: T }).state;
  for (let i = 1; i <= 30; i++) {
    state = holdStep(twoSides, state, { kind: 'tick', now: T + i * 1000 }).state;
  }
  const atSwap = state;
  // Ten seconds of ticking while it waits: a person putting a strap on the other
  // leg. Nothing may begin counting.
  for (let i = 31; i <= 40; i++) {
    state = holdStep(twoSides, state, { kind: 'tick', now: T + i * 1000 }).state;
  }
  return { atSwap, after: state };
})();
check(
  'when the first side ends it stops, and says which side is next',
  waited.atSwap.phase === 'swap' && waited.atSwap.run === 2 && waited.atSwap.endAt === null,
  `got ${waited.atSwap.phase} run ${waited.atSwap.run}`
);
check(
  'and ten seconds of waiting times nothing, because they have not swapped yet',
  waited.after.phase === 'swap' && waited.after.run === 2 && waited.after.remaining === 30,
  `got ${waited.after.phase} with ${waited.after.remaining}s - timing a side nobody has swapped to is the fault here`
);

const fourRuns = runWholeSet(holdClockFor('30s each way, each arm'));
check(
  'the one prescription with two things to swap needs four presses and two minutes',
  fourRuns.presses.length === 4 && fourRuns.secondsElapsed === 120,
  `${fourRuns.presses.length} presses, ${fourRuns.secondsElapsed}s`
);

const singleRun = runWholeSet(oneRun);
check(
  'a hold with one side needs one press and never asks anybody to swap',
  singleRun.presses.length === 1 &&
    singleRun.secondsElapsed === 30 &&
    holdRunLabel(oneRun, singleRun.state) === null,
  `${singleRun.presses.length} presses, run label ${holdRunLabel(oneRun, singleRun.state)}`
);

const everyClockedSet = clocked
  .map((r) => ({ row: r, run: runWholeSet(holdClockFor(r.reps)) }))
  .filter(({ row, run }) => {
    const clock = holdClockFor(row.reps);
    return (
      run.state.phase !== 'done' ||
      run.presses.length !== clock.runs ||
      run.secondsElapsed !== clock.seconds * clock.runs
    );
  });
check(
  `every clocked card the app builds completes in exactly its prescribed time (${clocked.length} cards)`,
  everyClockedSet.length === 0,
  sample(everyClockedSet.map(({ row }) => `${row.name} "${row.reps}"`))
);

// ─── [5] The alert ───────────────────────────────────────────────────────────
console.log('\n[5] A short warning three seconds out, a distinct one at zero, once each');

const CROSSINGS = [
  [null, 30, null, 'the first reading of a clock is not a crossing'],
  [30, 29, null, 'an ordinary second'],
  [30, 4, null, 'still more than three left'],
  [4, 3, 'nearly', 'the warning, as it reaches three'],
  [3, 2, null, 'and not again on the way past'],
  [2, 1, null, 'nor again'],
  [5, 0, 'finished', 'the end'],
  [0, 0, null, 'a stopped clock does not keep buzzing'],
  [30, 0, 'finished', 'a background gap skips the warning and still says it is over'],
  [null, 0, null, 'a clock that was never running has not finished'],
];
const wrongCrossings = CROSSINGS.filter(([a, b, want]) => alertForCrossing(a, b) !== want).map(
  ([a, b, want]) => `${a} -> ${b} gave ${alertForCrossing(a, b)}, expected ${want}`
);
check(
  `the buzz belongs to the step between two readings, not to a number (${CROSSINGS.length} steps)`,
  wrongCrossings.length === 0,
  wrongCrossings.join(' | ')
);
check(
  `the warning is ${NEARLY_SECONDS} seconds out, which is the number the decision named`,
  NEARLY_SECONDS === 3 &&
    alertForCrossing(NEARLY_SECONDS + 1, NEARLY_SECONDS) === 'nearly' &&
    alertForCrossing(NEARLY_SECONDS + 2, NEARLY_SECONDS + 1) === null,
  `NEARLY_SECONDS is ${NEARLY_SECONDS}`
);

const alertsOf = (run, kind) => run.alerts.filter((a) => a.alert === kind);
check(
  'a 30 second each-side hold buzzes exactly twice with a warning and twice at zero',
  alertsOf(each30, 'nearly').length === 2 && alertsOf(each30, 'finished').length === 2,
  `${alertsOf(each30, 'nearly').length} warnings, ${alertsOf(each30, 'finished').length} ends`
);
check(
  'each warning lands three seconds before that side ends',
  alertsOf(each30, 'nearly').map((a) => a.secondsIn).join(',') === '27,57' &&
    alertsOf(each30, 'finished').map((a) => a.secondsIn).join(',') === '30,60',
  `warnings at ${alertsOf(each30, 'nearly').map((a) => a.secondsIn).join(',')}s, ends at ${alertsOf(each30, 'finished').map((a) => a.secondsIn).join(',')}s`
);

const wrongCounts = clocked
  .map((r) => ({ row: r, clock: holdClockFor(r.reps), run: runWholeSet(holdClockFor(r.reps)) }))
  .filter(
    ({ clock, run }) =>
      alertsOf(run, 'nearly').length !== clock.runs || alertsOf(run, 'finished').length !== clock.runs
  );
check(
  `one warning and one end per run, on every clocked card the app builds (${clocked.length} cards)`,
  wrongCounts.length === 0,
  sample(
    wrongCounts.map(
      ({ row, clock, run }) =>
        `${row.name} "${row.reps}": ${alertsOf(run, 'nearly').length}/${alertsOf(run, 'finished').length} for ${clock.runs} run(s)`
    )
  )
);

const pausedThrough = (() => {
  const clock = oneRun;
  let state = holdStep(clock, holdInitialState(clock), { kind: 'start', now: T }).state;
  const alerts = [];
  const tick = (at) => {
    const step = holdStep(clock, state, { kind: 'tick', now: at });
    state = step.state;
    if (step.alert) alerts.push(step.alert);
  };
  for (let i = 1; i <= 28; i++) tick(T + i * 1000); // 2 seconds left, warning fired
  state = holdStep(clock, state, { kind: 'pause', now: T + 28_000 }).state;
  // Twenty seconds of being paused, then carry on.
  state = holdStep(clock, state, { kind: 'start', now: T + 48_000 }).state;
  for (let i = 1; i <= 3; i++) tick(T + 48_000 + i * 1000);
  return { alerts, state };
})();
check(
  'a pause and a resume inside the last three seconds does not buzz a second warning',
  pausedThrough.alerts.filter((a) => a === 'nearly').length === 1 &&
    pausedThrough.alerts.filter((a) => a === 'finished').length === 1,
  `got ${pausedThrough.alerts.join(', ')} - a stored "already warned" flag is what gets this wrong`
);
check(
  'and it still reaches the end',
  pausedThrough.state.phase === 'done',
  `got ${pausedThrough.state.phase}`
);
check(
  'a reset puts it back to a stopped clock with nothing pending',
  (() => {
    const s = holdStep(twoSides, stateIn('running'), { kind: 'reset' });
    return (
      s.alert === null &&
      s.state.phase === 'ready' &&
      s.state.run === 1 &&
      s.state.endAt === null &&
      s.state.remaining === twoSides.seconds
    );
  })(),
  'including back to the FIRST side'
);

// ─── [6] The words ──────────────────────────────────────────────────────────
console.log('\n[6] What it says, over every prescription and every phase');

const everyLabel = [];
for (const reps of Object.keys(EXPECTED)) {
  const clock = holdClockFor(reps);
  for (const phase of PHASES) {
    const state = { ...stateIn(phase), remaining: phase === 'done' ? 0 : 7 };
    everyLabel.push([`${reps}/${phase}`, holdButtonLabel(clock, state)]);
    everyLabel.push([`${reps}/${phase}`, holdPressLabel(clock, state)]);
    const run = holdRunLabel(clock, state);
    if (run !== null) everyLabel.push([`${reps}/${phase}`, run]);
  }
}
check(
  `every phase of every prescription says something (${everyLabel.length} strings)`,
  everyLabel.length > 200 && everyLabel.every(([, v]) => typeof v === 'string' && v.trim().length > 0),
  sample(everyLabel.filter(([, v]) => !v || !v.trim()).map(([k]) => k))
);
const dashed = everyLabel.filter(([, v]) => /—|–|―/.test(v));
check('no long dash', dashed.length === 0, sample(dashed.map(([k, v]) => `${k}: "${v}"`)));
const emoji = everyLabel.filter(([, v]) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(v));
check('no emoji', emoji.length === 0, sample(emoji.map(([k, v]) => `${k}: "${v}"`)));
const american = everyLabel.filter(([, v]) => /\b(timer's|meters?|seconds left over)\b/i.test(v));
check('British spelling throughout', american.length === 0, sample(american.map(([k, v]) => `${k}: "${v}"`)));
check(
  'the button says what pressing it does, in a word a person would use',
  holdButtonLabel(oneRun, holdInitialState(oneRun)) === 'Start the timer - 00:30' &&
    holdPressLabel(oneRun, holdInitialState(oneRun)) === 'Start the timer',
  `got "${holdButtonLabel(oneRun, holdInitialState(oneRun))}"`
);
check(
  'a waiting each-side hold asks for the swap AND for the press, in that order',
  holdButtonLabel(twoSides, stateIn('swap')) === 'Swap sides, then start - 00:30' &&
    holdRunLabel(twoSides, stateIn('swap')) === '2 of 2',
  `got "${holdButtonLabel(twoSides, stateIn('swap'))}" / "${holdRunLabel(twoSides, stateIn('swap'))}"`
);
check(
  'a one-sided hold never prints "1 of 1"',
  PHASES.every((phase) => holdRunLabel(oneRun, stateIn(phase)) === null),
  'noise on a Plank'
);
check(
  'a finished set says so rather than showing 00:00 and nothing else',
  /Time is up/.test(holdButtonLabel(oneRun, stateIn('done'))) &&
    holdRunLabel(twoSides, stateIn('done')) === 'all 2 done',
  `got "${holdButtonLabel(oneRun, stateIn('done'))}"`
);

// ─── Result ─────────────────────────────────────────────────────────────────
console.log('');
if (failed > 0) {
  console.error(`hold-timer: ${failed}/${passed + failed} check(s) FAILED\n`);
  process.exit(1);
}
console.log(`hold-timer: all ${passed} checks passed\n`);
process.exit(0);
