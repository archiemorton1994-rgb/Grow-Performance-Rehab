/**
 * Contract test: the programme reaches the app, and nobody already using it moves.
 *
 * THE RISK THIS EXISTS FOR
 * ────────────────────────
 * Until now `SESSION_ORDER = ['squat', 'bench', 'deadlift']` decided what every
 * single user was offered, and a programme now sits in front of that decision.
 * Everyone currently using Grow has `programme: null`, and for them every line
 * of this change has to be invisible. A wiring bug here does not produce a
 * crash: it silently offers somebody a different session than the one their
 * training has been built around, and nobody would report it as a fault.
 *
 * So the first section drives the real store with no programme and asserts the
 * old answers, and the last one asserts a new field cannot be destroyed by a
 * sign-out or by a server copy written before it existed.
 *
 * Run:  npx tsx tests/programme-wiring.check.mjs
 */
import './_persist-shim.mjs';
import { readFileSync } from 'fs';
import { useAppStore, SESSION_ORDER } from '../lib/store.ts';
import { cycleFor } from '../lib/programme.ts';

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

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const S = () => useAppStore.getState();

let seq = 0;
/** A completed session, newest-first order being the caller's problem. */
const session = (sessionType, extra = {}) => ({
  id: `s${seq++}`,
  sessionType,
  date: '2026-08-01T00:00:00.000Z',
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '45',
  exercises: [],
  ...extra,
});

/** Reset to something like a clean install. */
function reset(patch = {}) {
  useAppStore.setState({
    programme: null,
    completedSessions: [],
    completedCount: 0,
    cycleStartOffset: 0,
    testWeekFrequency: 12,
    testWeekDeferred: false,
    oneRepMaxes: [],
    ...patch,
  });
}

// ─── 1. Nobody already using the app moves ──────────────────────────────────
console.log('\n[1] With no programme, the app answers exactly as it always has');

reset({
  // Newest first, which is how the store keeps them.
  completedSessions: [session('deadlift'), session('bench'), session('squat')],
});
check(
  'three barbell sessions still hand back the fourth in the rotation',
  S().getCurrentSessionType() === SESSION_ORDER[0],
  `got ${S().getCurrentSessionType()}, expected ${SESSION_ORDER[0]}`
);

reset({ completedSessions: [session('bench'), session('squat')] });
check(
  'and two still hand back the third',
  S().getCurrentSessionType() === SESSION_ORDER[2],
  `got ${S().getCurrentSessionType()}`
);

reset({
  completedSessions: [
    session('conditioning'),
    session('conditioning'),
    session('conditioning'),
    session('conditioning'),
  ],
  testWeekFrequency: 'never',
});
check(
  'somebody who only ever does conditioning is still only offered conditioning',
  S().getCurrentSessionType() === 'conditioning',
  `got ${S().getCurrentSessionType()}; the divert-off-the-barbell logic must survive`
);

reset();
check(
  'a brand new install still opens on the first lift',
  S().getCurrentSessionType() === SESSION_ORDER[0],
  ''
);
check('and is enrolled in nothing', S().programme === null, '');
check(
  'so the position selector answers null rather than inventing a block',
  S().getProgrammePosition() === null,
  ''
);

// ─── 2. The builder writes every answer to its home ─────────────────────────
console.log('\n[2] Every answer in the tree lands somewhere that uses it');

reset();
S().applyProfileTree(
  {
    units: 'lbs',
    name: 'Archie',
    focus: 'muscle',
    days: '4',
    minutes: '30',
    experience: 'advanced',
    age: 34,
    sex: 'male',
    bodyweight: 82,
    equipment: ['dumbbells', 'kettlebells'],
    sore: 'yes',
    soreArea: ['front_shoulder'],
    soreAge: 'months',
    length: '16',
    liftsSquat: 140,
    liftsBench: 100,
    liftsDeadlift: 180,
  },
  '2026-08-31T09:00:00.000Z'
);

const after = S();
check(
  'the name, sex, experience and bodyweight are on the profile',
  after.userProfile.name === 'Archie' &&
    after.userProfile.sex === 'male' &&
    after.userProfile.experienceLevel === 'advanced' &&
    after.userProfile.bodyweightKg === 82,
  JSON.stringify(after.userProfile)
);
check(
  // The one that would be easiest to get wrong. lib/rep-scheme.ts turns goals
  // into rep ranges and lib/workout-engine.ts turns them into set counts, and
  // they are the only part of the old profile that ever reached the training. If
  // the focus stopped at the template, somebody asking for muscle would get an
  // upper/lower split prescribed in strength rep ranges.
  'the focus reaches the goals, so it reaches the rep schemes',
  JSON.stringify(after.userProfile.goals) === JSON.stringify(['muscle']),
  `goals are ${JSON.stringify(after.userProfile.goals)}`
);
check(
  'age is stored',
  after.userProfile.ageYears === 34,
  'asked for the first time, and it was never on the profile before'
);
check(
  'a standing injury is stored as a fact about the person',
  JSON.stringify(after.userProfile.standingSoreRegions) === JSON.stringify(['front_shoulder']) &&
    after.userProfile.standingSoreSince === 'months',
  'until now this was re-learned before every session and forgotten after it'
);
check(
  'equipment is set',
  JSON.stringify(after.equipmentTiers) === JSON.stringify(['dumbbells', 'kettlebells']),
  ''
);
check('the weight unit follows the answer', after.weightUnit === 'lbs', '');
check(
  'and how long they usually have becomes the readiness default',
  after.lastReadinessTime === '30',
  'otherwise the session-length question is collected and never used'
);
check(
  'the three lifts are recorded in the shape the app already uses',
  after.oneRepMaxes.length === 3 &&
    after.oneRepMaxes.every((m) => m.unit === 'kg' && m.reps === 1 && m.weight > 0) &&
    after.oneRepMaxes.some((m) => m.lift === 'squat' && m.weight === 140),
  JSON.stringify(after.oneRepMaxes)
);
check(
  'and they are enrolled in a real programme',
  after.programme?.templateId === 'muscle' &&
    after.programme?.days === 4 &&
    after.programme?.blockWeeks === 16 &&
    after.programme?.minutes === 30,
  JSON.stringify(after.programme)
);

// The test-week answer is only asked of the barbell path, so it must default
// rather than come back undefined for everybody else.
check(
  'somebody never asked about strength tests still gets the default',
  after.testWeekFrequency === 12,
  'undefined here would break isTestWeekDue for every non-barbell user'
);

// ─── 3. The programme decides the session ───────────────────────────────────
console.log('\n[3] The block, not the rotation, decides what comes next');

reset();
S().applyProfileTree(
  { focus: 'joints', days: '3', minutes: '45', length: '12', experience: 'beginner', sore: 'no' },
  '2026-08-31T09:00:00.000Z'
);
const jointsCycle = cycleFor('joints', 3);
check(
  'a joint health programme opens on its own first session, not on a squat',
  S().getCurrentSessionType() === jointsCycle[0],
  `got ${S().getCurrentSessionType()}, expected ${jointsCycle[0]}; this is the entire point of the change`
);

useAppStore.setState({ completedSessions: [session(jointsCycle[0])] });
check(
  'doing it advances the block',
  S().getCurrentSessionType() === jointsCycle[1],
  `got ${S().getCurrentSessionType()}`
);

useAppStore.setState({
  completedSessions: [session('conditioning'), session('custom'), session(jointsCycle[0])],
});
check(
  'training something else in between leaves the block exactly where it was',
  S().getCurrentSessionType() === jointsCycle[1],
  'this is the promise on the card, and it has to be true of the actual suggestion'
);
check(
  'and that off-plan work is counted rather than discarded',
  S().getProgrammePosition().offPlan === 2 && S().getProgrammePosition().onPlan === 1,
  JSON.stringify(S().getProgrammePosition())
);

check(
  'the week number is derived from the on-plan work',
  S().getProgrammePosition().week === 1 &&
    S().getProgrammePosition().totalSessions === 36,
  JSON.stringify(S().getProgrammePosition())
);

// ─── 4. Pausing, switching and leaving ──────────────────────────────────────
console.log('\n[4] It can be paused, switched and left');

S().setProgrammePaused(true);
check(
  'pausing falls back to the behaviour of somebody with no programme',
  S().getCurrentSessionType() !== jointsCycle[1],
  'a pause that still dictated the session would not be a pause'
);
check(
  'but the block is still there, with its position intact',
  S().programme !== null && S().getProgrammePosition().onPlan === 1,
  'pausing is not leaving'
);
S().setProgrammePaused(false);
check('and unpausing puts it back', S().getCurrentSessionType() === jointsCycle[1], '');

const beforeSwitch = S().completedSessions.length;
S().switchProgramme('lean', '2026-09-01T09:00:00.000Z');
check(
  'switching starts a fresh block rather than landing mid-way through the new one',
  S().programme.startedAtSessionCount === beforeSwitch &&
    S().getProgrammePosition().onPlan === 0 &&
    S().getProgrammePosition().week === 1,
  JSON.stringify(S().getProgrammePosition())
);
check(
  'and it keeps the answers that were not about which programme',
  S().programme.days === 3 && S().programme.blockWeeks === 12,
  'switching programme is not re-doing the builder'
);

S().updateProgramme({ days: 5, blockWeeks: 8 });
check(
  'the hub can change days and length',
  S().programme.days === 5 &&
    S().programme.blockWeeks === 8 &&
    S().getProgrammePosition().totalSessions === 40,
  ''
);

S().leaveProgramme();
check(
  'leaving returns them to the app as it was',
  S().programme === null && S().getProgrammePosition() === null,
  ''
);

// ─── 5. A due strength test still outranks the block ────────────────────────
console.log('\n[5] A strength test still comes first');

reset({ testWeekFrequency: 12 });
S().applyProfileTree(
  { focus: 'barbell', days: '3', minutes: '45', length: '12', experience: 'advanced', sore: 'no', testWeeks: '12' },
  '2026-08-31T09:00:00.000Z'
);
useAppStore.setState({
  completedSessions: [session(SESSION_ORDER[0], { isTestWeek: true })],
  programme: { ...S().programme, startedAtSessionCount: 0 },
});
check(
  'a half-finished test week dictates the lift, whatever the block would say',
  S().getCurrentSessionType() === SESSION_ORDER[1],
  `got ${S().getCurrentSessionType()}; nobody should be pulled off a test they have started`
);

// ─── 6. It cannot be destroyed ──────────────────────────────────────────────
console.log('\n[6] A programme survives a new phone');

const sync = read('lib/sync.ts');
const store = read('lib/store.ts');

check(
  'the sync payload has a slot for it',
  /programme\?: unknown;/.test(sync),
  'sign-out wipes the device, so anything missing from the payload is destroyed rather than merely un-synced'
);
check(
  'and a standing injury travels with the profile',
  /standingSoreRegions\?: string\[\];/.test(sync) && /ageYears\?: number;/.test(sync),
  'the one fact in the profile that changes what somebody is safe to be given'
);
check(
  'the store puts it in the payload it uploads',
  /programme: s\.programme,/.test(store),
  'a field in the type and not in the payload is worse than neither'
);
check(
  // ?? and not ||, and not a bare assignment. An older build's payload has no
  // programme key at all, and adopting that would un-enrol somebody on sign-in.
  'a server copy written before programmes existed leaves the local one alone',
  /programme: \(data\.programme as EnrolledProgramme \| null\) \?\? s\.programme,/.test(store),
  ''
);
check(
  'and upgrading an existing install enrols nobody automatically',
  /if \(!\('programme' in persistedState\)\) \{[\s\S]{0,40}persistedState\.programme = null;/.test(
    store
  ),
  'a programme invented for somebody who answered none of the questions is built on nothing'
);
check(
  'the store version was bumped so the migration actually runs',
  /version: 30,/.test(store),
  'a migration behind a version that never increments is dead code'
);

console.log(`\nprogramme-wiring: ${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
