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
    after.programme?.sessions === 16 &&
    after.programme?.minutes === 30,
  JSON.stringify(after.programme)
);

// The test-week answer is only asked of the barbell path. It must never come
// back undefined, which would break isTestWeekDue for everybody else - and it
// must not come back as 12 either, which is how somebody building muscle was
// shown "Test Week 1 of 3" over a squat session they never asked for.
check(
  'somebody never asked about strength tests is not signed up for them',
  after.testWeekFrequency === 'never',
  `got ${JSON.stringify(after.testWeekFrequency)}`
);
check(
  'and a strength test cannot interrupt a programme that has no barbell lift in it',
  S().getTestWeekProgress().active === false && S().isTestWeekDue() === false,
  JSON.stringify(S().getTestWeekProgress())
);
check(
  // The other half, or the fix above would read as "test weeks are broken".
  'while a barbell programme still gets tested exactly as it always has',
  (() => {
    reset();
    S().applyProfileTree(
      { focus: 'barbell', days: '3', experience: 'advanced', sore: 'no', testWeeks: '12' },
      '2026-08-31T09:00:00.000Z'
    );
    // Dated relative to now rather than to a fixed day. The test-week check
    // withholds a max attempt from somebody just back off a layoff, so a
    // fixture pinned to a date in the past reads as exactly that the moment
    // enough real time passes, and the assertion would rot rather than fail.
    const twelve = Array.from({ length: 12 }, (_, i) =>
      session(SESSION_ORDER[i % 3], {
        date: new Date(Date.now() - i * 2 * 86400000).toISOString(),
      })
    );
    useAppStore.setState({ completedSessions: twelve });
    return S().testWeekFrequency === 12 && S().getTestWeekProgress().active === true;
  })(),
  JSON.stringify(S().getTestWeekProgress())
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
  'the week number is derived from the on-plan work, and the block is the count they chose',
  S().getProgrammePosition().week === 1 &&
    S().getProgrammePosition().totalSessions === 12 &&
    S().getProgrammePosition().weeks === 4,
  JSON.stringify(S().getProgrammePosition())
);

/**
 * And the history can tell the two apart, session by session.
 *
 * The counter above says "one on plan, two off", which is the summary. Looking
 * back through six weeks, what somebody needs is the mark on the row, and the
 * reversal from the store's newest-first list to the replay's oldest-first is
 * the one thing here that is easy to get silently backwards.
 */
{
  const tags = S().getSessionPlanTags();
  const all = S().completedSessions;
  const oldest = all[all.length - 1];
  const newest = all[0];
  check(
    'every session since enrolment carries a tag',
    Object.keys(tags).length === all.length,
    JSON.stringify(tags)
  );
  check(
    'the joint health session they were asked for is marked as the block, numbered one',
    tags[oldest.id]?.onPlan === true && tags[oldest.id]?.blockIndex === 1,
    `oldest is ${oldest.sessionType}: ${JSON.stringify(tags[oldest.id])}`
  );
  check(
    'and the two they chose themselves are marked as their own',
    tags[newest.id]?.onPlan === false && tags[newest.id]?.blockIndex === null,
    `newest is ${newest.sessionType}: ${JSON.stringify(tags[newest.id])}`
  );
}
check(
  'somebody not enrolled has no tags at all, rather than everything marked off plan',
  (() => {
    const keep = S().programme;
    useAppStore.setState({ programme: null });
    const none = Object.keys(S().getSessionPlanTags()).length;
    useAppStore.setState({ programme: keep });
    return none === 0;
  })(),
  'work done before there was a plan was not off the plan; there was no plan'
);

{
  const stats = read('components/ProgrammeStats.tsx');
  const statsTab = read('app/(tabs)/workouts.tsx');
  check(
    // "The stats will also need a revamp to focus more on the program side of
    // things rather than individual exercises." Everything on Overview counted
    // sessions in the abstract and nothing said how the block was going.
    // Read forward from the block rather than comparing to the FIRST StatStrip:
    // there are two, and the first is in the empty-state branch for somebody
    // who has never trained, which this card is deliberately not part of.
    'Stats leads with the block rather than with individual exercises',
    /<ProgrammeStats \/>/.test(statsTab) &&
      statsTab.indexOf('<StatStrip', statsTab.indexOf('<ProgrammeStats />')) > -1,
    'the programme has to sit above the counters, or it is another card in a stack'
  );
  check(
    'and it shows the split the app has been promising all along',
    /position\.offPlan/.test(stats) && /your own choice/.test(stats),
    'training something else costing nothing is a claim until a number shows it'
  );
  check(
    'it renders nothing at all for somebody not on a programme',
    /if \(!programme \|\| !position\) return null;/.test(stats),
    'a card about a block, to somebody with no block'
  );
  check(
    // Every figure on it is replayed from the sessions list, so nothing on this
    // card can disagree with the history it is drawn from.
    'every figure comes from the replay rather than from a stored counter',
    /getProgrammePosition/.test(stats) && !/programme\.onPlan/.test(stats),
    ''
  );
}

const historyScreen = read('app/past-sessions.tsx');
check(
  'and the history screen actually draws the distinction',
  /getSessionPlanTags/.test(historyScreen) &&
    /Your own choice/.test(historyScreen) &&
    /Programme/.test(historyScreen),
  'the tags existing and nothing showing them is the same as not having them'
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
  S().programme.days === 3 && S().programme.sessions === 12,
  'switching programme is not re-doing the builder'
);

S().updateProgramme({ days: 5, sessions: 8 });
check(
  'the hub can change days and length',
  S().programme.days === 5 &&
    S().programme.sessions === 8 &&
    // The block is the session count itself now, not days multiplied by weeks,
    // so changing the days a week must NOT change how long the block is.
    S().getProgrammePosition().totalSessions === 8 &&
    S().getProgrammePosition().weeks === 2,
  JSON.stringify(S().getProgrammePosition())
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
/**
 * The NUMBER, read and compared, not the string.
 *
 * This asserted /version: 30,/ exactly, which is the defect this repo keeps
 * finding in its own tests: it guards the migration by pinning a spelling, so
 * the next person to bump the version for an unrelated reason gets a red test
 * that tells them nothing and is fixed by editing the number. What it is
 * actually for is "the version is past the point the programme migration was
 * added", and that survives every later bump.
 */
const persistVersion = Number(store.match(/^ {6}version: (\d+),$/m)?.[1] ?? -1);
check(
  'the store version is past the one the programme migrations were added behind',
  persistVersion >= 31,
  `a migration behind a version that never increments is dead code (read ${persistVersion})`
);
check(
  'a block measured in weeks is converted rather than left to be read as sessions',
  /'blockWeeks' in persistedState\.programme/.test(store) && /p\.sessions = /.test(store),
  'blockWeeks 12 read as sessions 12 would silently shorten a three day block to a third of its length'
);

// ─── 5. The programme is the spine of the home screen ───────────────────────
console.log('\n[5] One thing in the suggested box, and somewhere to go without one');

{
  const home = read('app/(tabs)/index.tsx');
  check(
    // Reported after use: a Squat Session with a Test Week badge, to somebody
    // who had asked for neither, with no obvious way to change it. The box held
    // the three-lift rotation's next lift because that is what it fell back to.
    'the hero branches on whether there IS a programme, not on how much they have trained',
    /\{!programme \? \(/.test(home) && !/completedSessions\.length === 0 \? \(/.test(home),
    'a suggestion invented for somebody enrolled in nothing is a suggestion from nowhere'
  );
  check(
    'and the three-lift first-session chooser is gone with it',
    !/first-session-\$\{type\}/.test(home) && !/Choose Your First Session/.test(home),
    'three barbell lifts offered to a brand-new user is not their programme either'
  );
  check(
    'with no programme it points at the page that fixes that',
    /testID="home-choose-programme"/.test(home) && /router\.push\('\/program'\)/.test(home),
    ''
  );
  check(
    'and the card names the block the session belongs to',
    /programmeName/.test(home) && /programmeTilePlace/.test(home),
    'a session with no programme named over it is the same suggestion from nowhere'
  );

  const chooser = read('components/ChooseProgramme.tsx');
  check(
    'the chooser offers every programme by name, and the builder as well',
    /PROGRAMME_IDS\.map/.test(chooser) && /choose-build-mine/.test(chooser),
    ''
  );
  check(
    // The sentence that stops the app reading as "pick one or you cannot use
    // Grow", which is the opposite of true.
    'and says out loud that nobody has to be on one',
    /choose-programme-optional/.test(chooser) && /You do not need one/.test(chooser),
    ''
  );
  check(
    'the rotation screen is still reachable rather than deleted out from under anybody',
    /choose-programme-keep-rotation/.test(chooser) && /showRotation/.test(read('app/program.tsx')),
    'somebody nine cycles into the rotation should not lose the screen that shows it'
  );
}

check(
  'a cycle somebody built is enrolled, named and trained straight away',
  (() => {
    reset({ completedSessions: [], lastReadinessTime: '60' });
    S().enrolInCustomProgramme(
      { name: 'Tuesdays and Fridays', cycle: ['upper_body', 'conditioning'] },
      2,
      8,
      '2026-09-01T00:00:00.000Z'
    );
    const p = S().programme;
    return (
      p?.templateId === 'custom' &&
      p?.custom?.name === 'Tuesdays and Fridays' &&
      p?.days === 2 &&
      p?.sessions === 8 &&
      p?.minutes === 60 &&
      // And the suggestion follows their cycle rather than a template's.
      S().getCurrentSessionType() === 'upper_body'
    );
  })(),
  JSON.stringify(S().programme)
);
check(
  // A custom cycle full of prehab has no barbell lift in it, so the same rule
  // that stopped Joint Health being interrupted has to cover this too.
  'and a custom cycle with no barbell in it is never interrupted by a strength test',
  (() => {
    reset({ testWeekFrequency: 12 });
    S().enrolInCustomProgramme(
      { name: 'Just recovery', cycle: ['prehab', 'flexibility'] },
      2,
      8,
      '2026-09-01T00:00:00.000Z'
    );
    return S().getTestWeekProgress().active === false;
  })(),
  JSON.stringify(S().getTestWeekProgress())
);

const buildScreen = read('components/BuildProgramme.tsx');
check(
  'the builder cannot start an empty cycle',
  /const ready = cycle\.length > 0;/.test(buildScreen) && /disabled={!ready}/.test(buildScreen),
  'a programme with nothing in it is a home screen with nothing on it'
);
check(
  // The line that stops somebody hunting for exercise-level control on a screen
  // that does not have it, and points at the tool that does.
  'and it says what it does not do, rather than leaving people to find out',
  /build-custom-session-link/.test(buildScreen) && /different tool/.test(buildScreen),
  ''
);

check(
  'enrolling from the chooser produces a block that can be trained immediately',
  (() => {
    reset({ completedSessions: [session('conditioning')], lastReadinessTime: '30' });
    S().enrolInProgramme('joints', '2026-09-01T00:00:00.000Z');
    const p = S().programme;
    const pos = S().getProgrammePosition();
    return (
      p?.templateId === 'joints' &&
      p?.days === 3 &&
      p?.sessions === 12 &&
      // The one thing the app already knew, taken rather than guessed.
      p?.minutes === 30 &&
      // And it starts at nothing done, rather than inheriting the session that
      // was already in the history.
      p?.startedAtSessionCount === 1 &&
      pos?.onPlan === 0 &&
      S().getCurrentSessionType() === cycleFor('joints', 3)[0]
    );
  })(),
  JSON.stringify(S().programme)
);


console.log(`\nprogramme-wiring: ${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
