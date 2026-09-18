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
import { MAX_EARNED_BONUS } from '../lib/programme-report.ts';

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

/**
 * Reset to something like a clean install.
 *
 * The profile is written every time, and it is deliberately NOT a beginner.
 * Archie's second decision hands a beginner with no earned rung Full Body every
 * session, off a programme, whatever their history: a fixture left on the store
 * default would answer full_body to every question in section 1 and the rotation
 * would go untested. The beginner rule itself is held in
 * tests/non-kpi-user.check.mjs, which sweeps it across thirteen session counts.
 */
function reset(patch = {}) {
  useAppStore.setState({
    programme: null,
    completedSessions: [],
    completedCount: 0,
    cycleStartOffset: 0,
    testWeekDeferred: false,
    oneRepMaxes: [],
    userProfile: {
      name: 'Probe',
      sex: 'male',
      experienceLevel: 'intermediate',
      goals: ['muscle'],
      bodyweightKg: 80,
    },
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
});
check(
  'conditioning sessions leave the rotation exactly where it was',
  S().getCurrentSessionType() === SESSION_ORDER[0],
  `got ${S().getCurrentSessionType()}; conditioning does not load the lifts being progressed, so it must not turn the rotation`
);

reset();
check(
  'a brand new install opens on the first session of the rotation',
  S().getCurrentSessionType() === SESSION_ORDER[0],
  ''
);
check('and is enrolled in nothing', S().programme === null, '');
check(
  'so the position selector answers null rather than inventing a block',
  S().getProgrammePosition() === null,
  ''
);

// ─── 2. A strength test belongs to the barbell programmes ───────────────────
//
// FIFTEEN ASSERTIONS USED TO STAND HERE, all driving applyProfileTree: the one
// store action the profile builder ended on. It wrote the whole profile AND
// enrolled a block in the same breath, and it has gone with the builder.
//
// Signing up is completeOnboarding now, which writes the same fields and leaves
// `programme` null. Every answer it writes is asserted against the real store in
// tests/complete-onboarding.check.mjs and in tests/onboarding-pager.check.mjs
// section 9, including the pounds fault that stored 176 lb as 176 kg.
//
// What was kept here was the half neither of those can see, because it is about
// a programme rather than about a profile: a block with no barbell lift in it is
// never interrupted by a strength test, and a block with three still is. The
// second half of that is retired with test weeks themselves, and the first is
// now true of everybody, so what stands here is the fact underneath both.
console.log('\n[2] No block is ever interrupted by a strength test');

/**
 * Twelve barbell sessions, which is exactly the history that used to make a
 * test due at a frequency of 12.
 *
 * Dated relative to now rather than to a fixed day. The test-week check withheld
 * a max attempt from somebody just back off a layoff, so a fixture pinned to a
 * date in the past read as exactly that the moment enough real time passed, and
 * the assertion rotted rather than failed. Kept dated the same way, because what
 * this fixture is FOR now is being the worst case: the precise history that
 * would once have produced a test on the very next session.
 */
const twelveBarbellSessions = () =>
  Array.from({ length: 12 }, (_, i) =>
    session(SESSION_ORDER[i % 3], {
      date: new Date(Date.now() - i * 2 * 86400000).toISOString(),
    })
  );

check(
  'the store has no way to work out that a test is due',
  S().getTestWeekProgress === undefined && S().isTestWeekDue === undefined,
  'those two decided what today was, and a due test outranked the block'
);

for (const id of ['joints', 'barbell']) {
  reset({ lastReadinessTime: '45' });
  S().enrolInProgramme(id, '2026-08-31T09:00:00.000Z');
  useAppStore.setState({ completedSessions: twelveBarbellSessions() });
  const next = S().getCurrentSessionType();
  const position = S().getProgrammePosition();
  check(
    `the ${id} block still decides what comes next after twelve barbell sessions`,
    position !== null && next === position.next,
    `got ${next}, and the block asked for ${position?.next}`
  );
  check(
    `and ${id} is never diverted onto the first lift of a test block`,
    cycleFor(id, 3).includes(next),
    `got ${next}, which is not a session this block asks for at all`
  );
}

// ─── 3. The programme decides the session ───────────────────────────────────
console.log('\n[3] The block, not the rotation, decides what comes next');

reset({ lastReadinessTime: '45' });
S().enrolInProgramme('joints', '2026-08-31T09:00:00.000Z');
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
    /**
     * WAS PINNED TO `return null;`, on a line whose behaviour changed on
     * purpose.
     *
     * The claim survives: a card describing a block must not be shown to
     * somebody who has no block. What changed is what they get instead. A
     * person between programmes with four finished ones behind them now sees
     * the shelf, and under the old spelling that improvement read as a
     * regression.
     */
    'a card about a block is never rendered to somebody with no block',
    (() => {
      const guard = stats.match(/if \(!programme \|\| !position\) return (\w+);/);
      return !!guard && guard[1] !== 'card';
    })(),
    'a card about a block, to somebody with no block'
  );
  check(
    'and the only thing they can be shown instead is the blocks they finished',
    /completedProgrammes\.length === 0 \? null/.test(stats) &&
      /stats-completed-programmes/.test(stats),
    'anything else on that branch is a card invented for somebody with no data'
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

// ─── 5. Nothing outranks the block any more ─────────────────────────────────
console.log('\n[5] The block is not interrupted, even by a history of test weeks');

/*
 * This section used to assert the opposite: a half-finished test week dictated
 * the lift, whatever the block would otherwise have said, so that nobody was
 * pulled off a test they had already started. Strength tests are retired and
 * nobody can start one.
 *
 * What replaces it is the migration case, and it is the one that matters for
 * somebody who has been using the app: an account whose history is FULL of
 * completed test weeks, with a barbell block running. The old rule would have
 * read those sessions and carried on dictating lifts. The block decides now.
 */
reset({ lastReadinessTime: '45' });
S().enrolInProgramme('barbell', '2026-08-31T09:00:00.000Z');
useAppStore.setState({
  completedSessions: [session(SESSION_ORDER[0], { isTestWeek: true })],
  programme: { ...S().programme, startedAtSessionCount: 0 },
});
check(
  'a test week in the history does not dictate the next lift',
  S().getCurrentSessionType() === S().getProgrammePosition()?.next,
  `got ${S().getCurrentSessionType()}, and the block asked for ${S().getProgrammePosition()?.next}`
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
    'the chooser offers every programme by name, and a cycle of your own',
    /PROGRAMME_IDS\.map/.test(chooser) && /choose-build-own/.test(chooser),
    ''
  );
  check(
    // It pushed to /onboarding, which is now the sign-up and nothing else: it
    // asks who somebody is, writes a profile and deliberately enrols nobody. A
    // button called "Build mine from a few questions" on the page whose whole
    // job is choosing a programme would have walked a person through ten
    // questions and handed them back the same page, still unenrolled.
    'and no longer sends anybody back through sign-up to get one',
    !/choose-build-mine/.test(chooser) && !/'\/onboarding'/.test(chooser),
    'sign-up produces a profile, not a programme'
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
  // A custom cycle full of prehab has no barbell lift in it. This used to check
  // that the rule which stopped Joint Health being interrupted covered a custom
  // block too; there is no interruption left to be covered from, so it asserts
  // the outcome that mattered: the cycle is what they get.
  'and a custom cycle of recovery work is offered exactly what it asks for',
  (() => {
    reset();
    S().enrolInCustomProgramme(
      { name: 'Just recovery', cycle: ['prehab', 'flexibility'] },
      2,
      8,
      '2026-09-01T00:00:00.000Z'
    );
    return S().getCurrentSessionType() === 'prehab';
  })(),
  JSON.stringify(S().programme)
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


// ─── The easier week reaches every screen that has to mention it ────────────
//
// The rule itself is tested in tests/programme.check.mjs and the effect on a
// session in tests/deload.check.mjs. What is asserted here is the thing neither
// of those can see: that a session which is 10% lighter than the last one says
// so on every surface a person could be looking at when they find out.
//
// A deload the engine applies and the home screen does not mention is not a
// deload. It is the app appearing to have lost somebody's weights.
console.log('\n[13] The planned easier week is announced, not just applied');

check(
  'the store answers "is this an easier week" in one place',
  (() => {
    reset({ completedSessions: [] });
    S().enrolInProgramme('barbell', '2026-09-01T00:00:00.000Z');
    S().updateProgramme({ sessions: 20, days: 3 });
    const p = S().programme;
    const cycle = cycleFor('barbell', 3);
    // Nine on-plan sessions done puts the tenth next, which is week four.
    reset({
      completedSessions: Array.from({ length: 9 }, (_, i) => session(cycle[(8 - i) % cycle.length])),
      programme: { ...p, startedAtSessionCount: 0 },
    });
    const pos = S().getProgrammePosition();
    return pos?.deload === true && S().isDeloadSession(pos.next) === true;
  })(),
  JSON.stringify(S().getProgrammePosition())
);
check(
  // An easier week is part of a plan. Something somebody chose to do instead is
  // their own session, and the app has no business quietly watering it down.
  'and only ever for the session the programme is actually asking for',
  (() => {
    const pos = S().getProgrammePosition();
    const other = ['conditioning', 'flexibility', 'prehab'].find((t) => t !== pos?.next);
    return S().isDeloadSession(other) === false;
  })(),
  ''
);
check(
  'a paused programme has no easier weeks, because it has no weeks',
  (() => {
    S().setProgrammePaused(true);
    const paused = S().isDeloadSession(S().getProgrammePosition()?.next);
    S().setProgrammePaused(false);
    return paused === false;
  })(),
  ''
);

const sessionScreen = read('app/session.tsx');
check(
  'the session screen asks the store rather than working it out again',
  /isDeloadSession\(sessionType\)/.test(sessionScreen) && /deload: isDeloadWeek/.test(sessionScreen),
  'two copies of this rule is one copy that goes wrong'
);
check(
  // Read live it would regenerate on the last set of the last session of an
  // easier week and take 10% off a session already finished.
  'and freezes the answer at the start, like the load unit beside it',
  /useRef<boolean>\(isDeloadSession\(sessionType\)\)\.current/.test(sessionScreen),
  ''
);
check(
  'it tells the user before the first set, not after the last',
  /session-deload/.test(sessionScreen) && /Easier week/.test(sessionScreen),
  ''
);

const homeScreen = read('app/(tabs)/index.tsx');
check(
  'the home tile says so on the line it already had',
  /deload: pos\.deload/.test(homeScreen) && /Easier week/.test(homeScreen),
  'Home is sized not to scroll, so this cannot be a new row'
);

const hub = read('components/ProgrammeHub.tsx');
check(
  'the hub is the one place you can see an easier session coming',
  // Driven by the SESSION list rather than the week list. The schedule is
  // decided in sessions, and a trimmed window covers only part of a week, so
  // naming the week would promise an easier session the engine builds at full
  // weight.
  /hub-deload-note/.test(hub) && /position\.deloadSessions/.test(hub),
  'the hub shows the whole block at once, so it is the only screen that can'
);
check(
  'and the week strip asks every session in the week, not just the first',
  // Was `items[0].deload`, which called a whole week ordinary whenever the
  // easier stretch opened part way through it - which is exactly what a trimmed
  // window does.
  /hub-week-easy-/.test(hub) && /items\.some\(\(p\) => p\.deload\)/.test(hub),
  ''
);

const summary = read('app/session-summary.tsx');
check(
  'the certificate knows which kind of session it was recording',
  /summary-programme-panel/.test(summary) && /summary-own-panel/.test(summary),
  'the two genuinely different pieces of work produced two identical documents'
);
check(
  // Not a better and a worse version. One gets the block; the other gets the
  // promise the app keeps for it.
  'the off-plan one is a reassurance rather than a smaller badge',
  (() => {
    const at = summary.indexOf('summary-own-panel');
    if (at < 0) return false;
    const near = summary.slice(at, at + 700);
    return /where you left it/.test(near) && /counts towards/.test(near);
  })(),
  ''
);
check(
  'and a history row says which of them it was',
  (() => {
    const h = read('app/past-sessions.tsx');
    return /tag\.deload \? ' · easier week' : ''/.test(h) && /Your own choice/.test(h);
  })(),
  ''
);

// ─── The block has an ending, and the ending is kept ────────────────────────
//
// A block finishing is a fact about the session history, so it is detected in
// completeSession rather than on a screen: there is more than one way to log a
// session and only one of them ends on the summary. Everything below is about
// that being true exactly once, at the right moment, and surviving.
console.log('\n[14] A finished block is written up, once, and kept');

/** Log a full block of the enrolled cycle, one session at a time. */
const trainWholeBlock = () => {
  const p = S().programme;
  const cycle = cycleFor(p.templateId, p.days);
  for (let i = 0; i < p.sessions; i++) {
    S().completeSession({ ...session(cycle[i % cycle.length]), exerciseLogs: [], exerciseCount: 0 });
  }
};

check(
  'finishing the last session of a block writes the report there and then',
  (() => {
    reset({ completedSessions: [], completedProgrammes: [], pendingProgrammeReportId: null });
    S().enrolInProgramme('barbell', '2026-09-01T00:00:00.000Z');
    S().updateProgramme({ sessions: 6, days: 3 });
    trainWholeBlock();
    const done = S().completedProgrammes;
    return (
      done.length === 1 &&
      done[0].report.onPlan === 6 &&
      done[0].name === 'Barbell Strength' &&
      S().pendingProgrammeReportId === done[0].id
    );
  })(),
  JSON.stringify({
    archived: S().completedProgrammes.length,
    pending: S().pendingProgrammeReportId,
  })
);
check(
  // Its id is derived from the enrolment rather than generated, precisely so
  // this is safe. Somebody who keeps training after finishing a block must not
  // collect a fresh certificate on every session for the rest of the month.
  'and training on past the end of it does not collect a second one',
  (() => {
    const before = S().completedProgrammes.length;
    S().completeSession({ ...session('squat'), exerciseLogs: [], exerciseCount: 0 });
    S().completeSession({ ...session('bench'), exerciseLogs: [], exerciseCount: 0 });
    return S().completedProgrammes.length === before;
  })(),
  `${S().completedProgrammes.length}`
);
check(
  'a block still running is not written up early',
  (() => {
    reset({ completedSessions: [], completedProgrammes: [], pendingProgrammeReportId: null });
    S().enrolInProgramme('foundations', '2026-09-01T00:00:00.000Z');
    S().updateProgramme({ sessions: 6, days: 3 });
    const cycle = cycleFor('foundations', 3);
    for (let i = 0; i < 5; i++)
      S().completeSession({ ...session(cycle[i % cycle.length]), exerciseLogs: [], exerciseCount: 0 });
    return S().completedProgrammes.length === 0 && S().pendingProgrammeReportId === null;
  })(),
  ''
);
check(
  // The promise, at the moment it matters most. Somebody who did four
  // conditioning sessions in the middle of their block has not finished it.
  'and sessions somebody chose themselves do not finish it for them',
  (() => {
    for (let i = 0; i < 4; i++)
      S().completeSession({ ...session('conditioning'), exerciseLogs: [], exerciseCount: 0 });
    return S().completedProgrammes.length === 0;
  })(),
  ''
);
check(
  'the last on-plan session still finishes it, whatever went on in between',
  (() => {
    S().completeSession({
      ...session(cycleFor('foundations', 3)[0]),
      exerciseLogs: [],
      exerciseCount: 0,
    });
    return S().completedProgrammes.length === 1 && S().completedProgrammes[0].report.offPlan === 4;
  })(),
  JSON.stringify(S().completedProgrammes[0]?.report?.offPlan)
);
check(
  'starting a new block leaves the finished one alone and arms a fresh one',
  (() => {
    const first = S().completedProgrammes[0].id;
    S().switchProgramme('lean', '2026-12-01T00:00:00.000Z');
    return (
      S().completedProgrammes.length === 1 &&
      S().completedProgrammes[0].id === first &&
      S().getProgrammePosition()?.onPlan === 0
    );
  })(),
  ''
);
check(
  // Frozen means frozen. The report was built from a cycle and a name that can
  // both be changed afterwards, and a record that rewrites itself is worth less
  // than no record at all.
  'and changing the live programme cannot rewrite what the finished one says',
  (() => {
    const before = JSON.stringify(S().completedProgrammes[0]);
    S().updateProgramme({ sessions: 20, days: 5 });
    S().enrolInCustomProgramme(
      { name: 'Something Else', cycle: ['prehab'] },
      2,
      4,
      '2026-12-02T00:00:00.000Z'
    );
    return JSON.stringify(S().completedProgrammes[0]) === before;
  })(),
  ''
);
check(
  'reading the report is what clears the flag, and it clears only once',
  (() => {
    S().clearPendingProgrammeReport();
    return S().pendingProgrammeReportId === null;
  })(),
  ''
);
check(
  /**
   * Never automatic. Making somebody's next eight weeks harder because the app
   * decided they looked comfortable is the app changing underneath them.
   *
   * REWRITTEN, AND IT WAS GUARDING NOTHING. It used to call
   * acceptLevelStep('advanced') and then read `experienceLevel`. That action
   * takes a NUMBER, the earned rung, and never touches experienceLevel at all,
   * so the call did nothing in either direction. It stayed green only because
   * the builder journey deleted from section 2 had already written 'advanced'
   * onto the profile, which made both halves true of a call that did nothing.
   * Removing that journey is what showed it up.
   */
  'a step up moves the earned rung only when it is taken, and is clamped',
  (() => {
    const was = S().userProfile.earnedLevelBonus ?? 0;
    S().acceptLevelStep(was + 1);
    const taken = S().userProfile.earnedLevelBonus;
    S().acceptLevelStep(999);
    const clamped = S().userProfile.earnedLevelBonus;
    S().acceptLevelStep(was);
    return (
      taken === was + 1 &&
      clamped === MAX_EARNED_BONUS &&
      (S().userProfile.earnedLevelBonus ?? 0) === was
    );
  })(),
  `rung ${JSON.stringify(S().userProfile.earnedLevelBonus)}, ceiling ${MAX_EARNED_BONUS}`
);
check(
  'a finished block travels to the server, and comes back unioned rather than replaced',
  (() => {
    const payload = S().getDataForSync();
    if (!Array.isArray(payload.completedProgrammes)) return false;
    const mine = S().completedProgrammes;
    const theirs = [{ ...mine[0], id: 'from-another-device', name: 'Their Block' }];
    S().mergeServerData({
      ...payload,
      completedSessions: [
        ...payload.completedSessions,
        { ...session('squat'), exerciseLogs: [], exerciseCount: 0 },
        { ...session('bench'), exerciseLogs: [], exerciseCount: 0 },
      ],
      completedProgrammes: theirs,
    });
    const after = S().completedProgrammes;
    return after.length === 2 && after.some((c) => c.id === 'from-another-device');
  })(),
  `${S().completedProgrammes.length}`
);

const reportScreen = read('app/programme-report.tsx');
check(
  'the report formats what was frozen rather than working anything out again',
  !/buildProgrammeReport|tagSessions|programmePosition/.test(reportScreen),
  'a document that recomputes itself is a document that can change after it was issued'
);
check(
  'it speaks weights in the unit the reader has set today',
  /kgToDisplayUnit|formatWeight/.test(reportScreen) && /weightUnit/.test(reportScreen),
  'a frozen number still has to be read out loud in somebody own unit'
);
check(
  'it offers the step up rather than applying it',
  /report-step-accept/.test(reportScreen) && /acceptLevelStep/.test(reportScreen),
  ''
);
check(
  'and it asks what happens next instead of assuming',
  /report-another-block/.test(reportScreen) &&
    /report-choose-other/.test(reportScreen) &&
    /report-decide-later/.test(reportScreen),
  'the block ended; the decision is theirs'
);

const archiveScreen = read('app/completed-programmes.tsx');
check(
  'there is a place the reports are kept',
  /completed-programmes/.test(archiveScreen) && /programme-report/.test(archiveScreen),
  ''
);
check(
  // Nothing is manufactured from history. The app could look at ninety sessions
  // and invent seven blocks nobody was ever on, and every number in those
  // reports would be a guess dressed up as a record.
  'and it says plainly that older training is not counted back into it',
  /not counted back|never on|first one here/i.test(archiveScreen),
  ''
);

check(
  'every route into the report is registered, or it renders a bare file path',
  (() => {
    const layout = read('app/_layout.tsx');
    return (
      /name="programme-report"/.test(layout) && /name="completed-programmes"/.test(layout)
    );
  })(),
  ''
);
check(
  'the session that finished the block says so before anything else on the screen',
  (() => {
    const summary = read('app/session-summary.tsx');
    const at = summary.indexOf('summary-block-complete');
    const tabs = summary.indexOf('summary-tab-summary');
    return at > -1 && at < tabs && /isLatestSession/.test(summary.slice(at - 400, at));
  })(),
  'scrolling back through history must not congratulate somebody a second time'
);
check(
  'the hub badge is a door rather than a label',
  (() => {
    const hub = read('components/ProgrammeHub.tsx');
    const at = hub.indexOf('hub-complete');
    return at > -1 && /programme-report/.test(hub.slice(at - 400, at + 400));
  })(),
  '"Block complete" as a chip that does nothing is weeks of work acknowledged with a label'
);
check(
  'and it stops offering session thirteen of twelve',
  /!programme\.paused && !position\.complete && \(/.test(read('components/ProgrammeHub.tsx')),
  ''
);
check(
  'Home points at the report without adding a row to a screen that cannot scroll',
  (() => {
    const home = read('app/(tabs)/index.tsx');
    return (
      /reportReady/.test(home) &&
      /router\.push\(reportReady \? '\/programme-report' : '\/program'\)/.test(home) &&
      // The id must NOT move with the state: the tour spotlights this tile by
      // name, so a conditional id breaks the tour for the longest-standing users.
      /testID="your-program-card"/.test(home)
    );
  })(),
  ''
);
check(
  'and a session keeps the block it was in after that block is written up',
  (() => {
    const history = read('app/past-sessions.tsx');
    return /archivedTagFor/.test(history) && /completedProgrammes/.test(history);
  })(),
  'the replay only knows the CURRENT enrolment, so twelve rows would go blank on the day'
);

console.log(`\nprogramme-wiring: ${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
