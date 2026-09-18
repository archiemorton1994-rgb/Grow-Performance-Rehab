/**
 * Contract test: a saved session comes back as the session that was saved.
 *
 * WHAT WENT WRONG
 * ───────────────
 * The session route takes the whole pain answer — every sore area, the
 * severity, and whether it is acute — and feeds all of it to the generator:
 *
 *     painRegion: painRegions?.length ? painRegions : painRegion,
 *     painSeverity,
 *     acute: isAcute,
 *
 * The resume snapshot stored ONE of those four things: the first sore area. So
 * resuming rebuilt the workout with no severity, no other areas and no acute
 * flag, produced a different exercise list, failed its own exercise-ID match,
 * and dropped every logged set on the floor — silently, while the card the user
 * had just tapped still read "Squat Session · 12/24 sets".
 *
 * Moderate is the readiness screen's DEFAULT severity, so this was most pain
 * sessions rather than a rare case.
 *
 * Two shapes of duplication caused it and both are asserted against here: three
 * screens each wrote the resume params out longhand, and three save paths each
 * wrote the snapshot out longhand. A field added to the route reached one of
 * them and not the others. There is now one definition of each.
 *
 * AND THE SAME FAILURE, ONE APP UPDATE LATER
 * ──────────────────────────────────────────
 * Storing the exercise IDs and re-running the generator only works while the
 * generator stands still. It does not: the rebuild moves the whole app onto
 * Archie's exercise library, which renames exercises, empties pools and re-rates
 * levels. Someone ten sets into a session on Friday evening, whose phone updates
 * the app overnight, came back on Saturday to a session built from a different
 * list and every set they had logged thrown away.
 *
 * An ID match does not even catch the half of it. Rename the exercises in a pool
 * and the IDs still line up perfectly, so the sets go back on, onto cards
 * carrying different names, different rep targets and weights recomputed from a
 * history that has since moved. Half a workout on Friday's numbers and half on
 * Saturday's is not one session.
 *
 * So the cards are stored whole, in `ActiveSession.exerciseSnapshot`, and a
 * resume prefers them over anything the generator would build today. Sections
 * [8] to [10] run that decision for real against a generator that has been
 * changed underneath it.
 *
 * ALSO PINNED
 * ───────────
 * The ratings, which were restored on resume but never saved, so every
 * "Too Hard" answer given before a Save & Exit was silently discarded. And the
 * timer, which used to CAP an overnight gap at 90 minutes rather than reject it
 * — turning 30 minutes trained into a reported 2:00:00.
 *
 * Run:  npx tsx tests/session-resume-fidelity.check.mjs
 */
import { readFileSync } from 'fs';
import './_persist-shim.mjs';

globalThis.__DEV__ = false;

/**
 * The clock is frozen. The load maths reads how long it has been since the last
 * session, so a run that crossed midnight would generate the same session twice
 * and get two different answers, and this file's whole point is comparing two
 * generations of one session.
 */
const RealDate = Date;
const FIXED_NOW = RealDate.UTC(2026, 0, 15, 12, 0, 0);
globalThis.Date = class FixedDate extends RealDate {
  constructor(...args) {
    super(...(args.length > 0 ? args : [FIXED_NOW]));
  }
  static now() {
    return FIXED_NOW;
  }
};

// Imported after the clock is frozen, so nothing in lib/ can read the real one.
const { resumeParams } = await import('../lib/resume-params.ts');
const { snapshotToResume, isUsableSnapshot, storedMatchesLaunch } = await import(
  '../lib/resume-snapshot.ts'
);
const { generateWorkout } = await import('../lib/workout-engine.ts');
const { SESSION_POOLS } = await import('../lib/exercise-db.ts');
const { useAppStore } = await import('../lib/store.ts');

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
const session = read('app/session.tsx');

console.log('\n[1] The full pain answer survives the round trip');

const saved = {
  sessionType: 'squat',
  equipmentTier: 'fullgym',
  hasAches: true,
  painRegion: 'shoulder_front',
  painRegions: ['shoulder_front', 'knee'],
  painSeverity: 'moderate',
  acute: true,
  energy: 'normal',
  timeAvailable: '45',
  isTestWeek: false,
};
const params = resumeParams(saved);

check(
  'every sore area is replayed, not just the first',
  params.painRegion === 'shoulder_front,knee',
  `got "${params.painRegion}" - the route splits this on commas, so one area rebuilds a different session`
);

check(
  'the severity is replayed',
  params.painSeverity === 'moderate',
  'severity changes which exercises are dropped; losing it changes the workout'
);

check(
  'the acute flag is replayed',
  params.acute === 'true',
  'acute routes to the gentle protocols - a resume must not quietly leave them'
);

console.log('\n[2] Snapshots from older builds still resume');

const legacy = { ...saved, painRegions: undefined, painSeverity: undefined, acute: undefined };
const legacyParams = resumeParams(legacy);
check(
  'it falls back to the single stored area',
  legacyParams.painRegion === 'shoulder_front',
  'a snapshot written before this change has only painRegion'
);
check(
  'absent severity is omitted rather than sent as undefined',
  !('painSeverity' in legacyParams) && !('acute' in legacyParams),
  'sending the string "undefined" as a route param is worse than sending nothing'
);

console.log('\n[3] A pain-free session is unaffected');

const noPain = {
  sessionType: 'bench',
  equipmentTier: 'fullgym',
  hasAches: false,
  painRegion: undefined,
  energy: 'normal',
  timeAvailable: '45',
  isTestWeek: false,
};
check(
  'no sore area produces an empty string, as before',
  resumeParams(noPain).painRegion === '',
  'the route treats an empty string as "no pain reported"'
);

console.log('\n[4] There is exactly one definition of each half');

for (const [file, label] of [
  ['app/(tabs)/index.tsx', 'Home'],
  ['app/(tabs)/train.tsx', 'Train'],
  ['app/program.tsx', 'the programme sheet'],
]) {
  const src = read(file);
  check(
    `${label} resumes through the shared helper`,
    /params: resumeParams\(activeSession\)/.test(src),
    'writing the params out longhand here is how the pain context went missing'
  );
  check(
    `${label} does not hand-roll the params`,
    !/painRegion: activeSession\.painRegion \?\? ''/.test(src),
    'the longhand version replayed only the first sore area'
  );
}

check(
  'the session screen builds every snapshot from one context',
  (session.match(/\.\.\.snapshotContext(Ref\.current)?\(\)/g) ?? []).length === 3,
  'all three save paths (background, autosave, Save & Exit) must share one definition'
);

check(
  'that context carries the whole pain answer',
  /const snapshotContext = \(\) => \(\{[\s\S]{0,400}?painRegions,[\s\S]{0,120}?painSeverity,[\s\S]{0,120}?acute: isAcute,/.test(
    session
  ),
  'painRegions, painSeverity and acute must all be saved or the resume rebuilds a different session'
);

console.log('\n[5] Ratings are saved, not just restored');

check(
  'every save path writes the in-session ratings',
  (session.match(/inSessionFeedback: cleanFeedback\(/g) ?? []).length === 3,
  'they were restored on resume but only ever written by the COMPLETE path, so a Save & Exit lost them'
);

check(
  'the background save reads them from a ref',
  /inSessionFeedback: cleanFeedback\(inSessionFeedbackRef\.current\)/.test(session),
  'the AppState listener has no re-render, so state read directly there is stale'
);

check(
  'Save & Exit marks the session terminated before dismissing',
  /sessionTerminatedRef\.current = true;[\s\S]{0,400}?setActiveSession\(\{[\s\S]{0,200}?snapshotContext\(\)/.test(
    session
  ),
  'otherwise the unmount save fires afterwards and overwrites the snapshot from a stale closure'
);

console.log('\n[6] The timer reports time actually trained');

check(
  'a long gap is rejected rather than capped',
  /secondsSinceSave > 0 && secondsSinceSave <= RESUME_GAP_COUNTS_AS_TRAINING_S\s*\r?\n?\s*\?\s*secondsSinceSave\s*\r?\n?\s*:\s*0/.test(
    session
  ),
  'capping an overnight gap at 90 minutes still adds 90 minutes to a 30-minute session'
);

check(
  'the old 90-minute cap is gone',
  !/Math\.min\([\s\S]{0,120}?5400\s*\r?\n?\s*\)/.test(session),
  'Math.min(gap, 5400) is the bug: it turned 30 minutes trained into a reported 2:00:00'
);

check(
  'time spent backgrounded mid-session is credited',
  /AppState\.addEventListener\([\s\S]{0,600}?state === 'active' && leftAt !== null/.test(session),
  'setInterval does not run in the background, so checking a message between sets lost that time'
);

check(
  'both directions use the same threshold',
  (session.match(/RESUME_GAP_COUNTS_AS_TRAINING_S/g) ?? []).length >= 3,
  'one definition of "this gap was an interruption, not leaving"'
);

console.log('\n[7] A failed restore says so');

check(
  'the screen can report that a snapshot could not be rebuilt',
  /setRestoreFailed\(true\)/.test(session) && /RestoreFailedBanner/.test(session),
  'handing the user a blank session after they tapped "12/24 sets" reads as lost work'
);

check(
  'it only fires when there was work to lose',
  /stored\.completedSetsCount > 0/.test(session),
  'a snapshot with nothing logged in it is not worth a banner'
);

console.log('\n[8] An app update does not change the session someone is halfway through');

/**
 * ONE PERSON, ONE SESSION, TWO VERSIONS OF THE APP.
 *
 * Generate a squat session the way the screen does. Save it the way the screen
 * does, snapshot and all, and put the whole thing through JSON on the way in and
 * out, because that is what AsyncStorage does to it, and a check that handed
 * the resume the very array the generator returned would pass on reference
 * identity alone and prove nothing.
 *
 * Then change the generator underneath it, twice, in the two ways the rebuild
 * actually changes it, and resume.
 */
const profile = {
  name: 'P',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['strength'],
  bodyweightKg: 82,
};

/** The seven facts that say WHICH session this is. */
const launch = {
  sessionType: 'squat',
  equipmentTier: 'fullgym',
  hasAches: false,
  painRegion: undefined,
  energy: 'normal',
  timeAvailable: '45',
  isTestWeek: false,
};

// Positional, because that is how the generator takes its seed - passing it on
// the profile is read by nothing.
const ROTATION_SEED = 3;

const generate = () =>
  generateWorkout(
    launch.sessionType,
    launch.equipmentTier,
    { hasAches: launch.hasAches, energy: launch.energy, timeAvailable: launch.timeAvailable },
    profile,
    {},
    undefined,
    ROTATION_SEED,
    undefined,
    undefined,
    undefined,
    null
  );

/** The cards that were on screen when the session was started. */
const started = generate();

const stored = JSON.parse(
  JSON.stringify({
    ...launch,
    exerciseData: started.map((ex) => ({
      sets: Array.from({ length: ex.sets }, (_, i) => ({
        setNumber: i + 1,
        weight: i < 2 ? 60 : 0,
        reps: i < 2 ? 5 : 0,
        completed: i < 2,
      })),
      swapCount: 0,
      activeSetIndex: 2,
    })),
    exerciseNotes: started.map(() => ''),
    activeIndex: 3,
    savedAt: new Date().toISOString(),
    completedSetsCount: started.length * 2,
    totalSets: started.reduce((n, ex) => n + ex.sets, 0),
    sessionName: 'Squat Session',
    elapsedSeconds: 900,
    exerciseIds: started.map((ex) => ex.id),
    exerciseSnapshot: started,
  })
);

// ─── Changing the generator, in memory, reversibly ───────────────────────────

const isEntry = (x) =>
  !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.name === 'string';

/** Every live array of exercises inside the pools, however deeply it is keyed. */
function arraysIn(value, out = []) {
  if (Array.isArray(value)) {
    const ofEntries = value.every(isEntry);
    const ofCircuits = value.every((c) => Array.isArray(c) && c.every(isEntry));
    if (value.length > 0 && (ofEntries || ofCircuits)) out.push(value);
    return out;
  }
  if (value && typeof value === 'object' && !isEntry(value)) {
    for (const v of Object.values(value)) arraysIn(v, out);
  }
  return out;
}

/** Every exercise record inside the pools. */
function entriesIn(value, out = []) {
  if (Array.isArray(value)) {
    for (const v of value) entriesIn(v, out);
    return out;
  }
  if (isEntry(value)) {
    out.push(value);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) entriesIn(v, out);
  }
  return out;
}

const POOL_ARRAYS = [...new Set(arraysIn(SESSION_POOLS))];
const POOL_ENTRIES = [...new Set(entriesIn(SESSION_POOLS))];

/** Content moved out of a pool and into the library: the block simply goes. */
function withEmptiedPools(fn) {
  const saved = POOL_ARRAYS.map((a) => a.splice(0));
  try {
    return fn();
  } finally {
    POOL_ARRAYS.forEach((a, i) => a.push(...saved[i]));
  }
}

/** Content re-authored in place: the same slots, different cards. */
function withRenamedPools(fn) {
  const savedNames = POOL_ENTRIES.map((e) => e.name);
  const savedReps = POOL_ENTRIES.map((e) => e.reps);
  for (const e of POOL_ENTRIES) {
    e.name = `Rebuilt ${e.name}`;
    if (typeof e.reps === 'string') e.reps = `${e.reps} (rebuilt)`;
  }
  try {
    return fn();
  } finally {
    POOL_ENTRIES.forEach((e, i) => {
      e.name = savedNames[i];
      e.reps = savedReps[i];
    });
  }
}

const afterEmptied = withEmptiedPools(generate);
const afterRenamed = withRenamedPools(generate);

const json = (x) => JSON.stringify(x);

check(
  'emptying the pools really does change what the generator builds',
  json(afterEmptied) !== json(started),
  `${started.length} cards became ${afterEmptied.length}; if these are equal this whole section proves nothing`
);
check(
  'renaming the pool entries really does change it too',
  json(afterRenamed) !== json(started),
  'a pool list holding copies rather than the live records would change nothing'
);
check(
  'and every pool was put back exactly',
  json(generate()) === json(started),
  'otherwise the rest of this run, and every check after it, is measuring a mangled library'
);

/**
 * The rename is the case an ID match cannot see. Same IDs, different cards - so
 * the old resume would have put the logged sets back onto a session whose names,
 * rep targets and weights had all moved.
 */
check(
  'a rename keeps every ID, so an ID match alone would wave it through',
  afterRenamed.length === started.length &&
    afterRenamed.every((ex, i) => ex.id === started[i].id) &&
    afterRenamed.some((ex, i) => ex.name !== started[i].name),
  'which is why the whole card is stored and not just the id'
);

/** Which fields of one card differ from another. */
const cardDiff = (a, b) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (k) => json(a[k]) !== json(b[k])
  );

for (const [label, generated] of [
  ['the exercises it drew from are gone', afterEmptied],
  ['every exercise has been re-authored', afterRenamed],
]) {
  const resumed = snapshotToResume(stored, launch) ?? generated;
  check(
    `${label}: the same number of cards comes back`,
    resumed.length === started.length,
    `got ${resumed.length}, started with ${started.length}`
  );
  const differences = started
    .map((ex, i) => {
      const other = resumed[i];
      if (!other) return `card ${i + 1} (${ex.name}) is missing`;
      const fields = cardDiff(ex, other);
      return fields.length > 0 ? `${ex.name}: ${fields.join(', ')}` : null;
    })
    .filter(Boolean);
  check(
    `${label}: card for card, field for field, it is the session that was started`,
    differences.length === 0,
    differences.slice(0, 4).join(' | ')
  );
  check(
    `${label}: and it is NOT what the generator would build today`,
    json(resumed) !== json(generated),
    'preferring the snapshot has to actually prefer it'
  );
  check(
    `${label}: the weights, rep targets and cues are the ones they started on`,
    started.every(
      (ex, i) =>
        resumed[i].reps === ex.reps &&
        resumed[i].suggestedLoad === ex.suggestedLoad &&
        resumed[i].cue === ex.cue &&
        resumed[i].sets === ex.sets &&
        json(resumed[i].loadKg) === json(ex.loadKg)
    ),
    'finishing half a session on last week numbers and half on this week is not one session'
  );
}

/**
 * The screen's own gate for putting the logged sets back, run here against both
 * lists: the one the snapshot gives it, and the one the generator would.
 */
const canRestore = (cards) =>
  storedMatchesLaunch(stored, launch) &&
  stored.exerciseData.length === cards.length &&
  stored.exerciseIds.length === cards.length &&
  stored.exerciseIds.every((id, i) => id === cards[i].id);

check(
  'the sets logged before the update go back on',
  canRestore(snapshotToResume(stored, launch) ?? afterEmptied) &&
    canRestore(snapshotToResume(stored, launch) ?? afterRenamed),
  'if this fails the user is handed a blank session after tapping a card that promised their sets'
);
check(
  'and on the regenerated list they would have been thrown away',
  !canRestore(afterEmptied),
  'this is the failure the snapshot exists to stop; if it passes, the mutation above was too gentle'
);

console.log('\n[9] Everything without a snapshot resumes exactly as it did before');

const noSnapshot = { ...stored };
delete noSnapshot.exerciseSnapshot;
check(
  'a session paused by an older build runs on the generated list',
  snapshotToResume(noSnapshot, launch) === null,
  'old snapshots have no cards stored, and they must keep the behaviour they had'
);
check(
  'no saved session at all runs on the generated list',
  snapshotToResume(null, launch) === null && snapshotToResume(undefined, launch) === null,
  'a fresh start is not a resume'
);

for (const [field, value] of [
  ['sessionType', 'bench'],
  ['equipmentTier', 'dumbbells'],
  ['hasAches', true],
  ['painRegion', 'knee'],
  ['energy', 'low'],
  ['timeAvailable', '30'],
  ['isTestWeek', true],
]) {
  check(
    `a snapshot saved under a different ${field} is not used`,
    snapshotToResume(stored, { ...launch, [field]: value }) === null,
    'the snapshot belongs to the session it was saved from and to no other'
  );
}

for (const [label, snapshot] of [
  ['came back empty', []],
  ['came back as something other than a list', { 0: started[0] }],
  ['holds a card with no id', [{ ...started[0], id: '' }]],
  ['holds a card with no name', [{ ...started[0], name: '' }]],
  ['holds a card with no sets on it', [{ ...started[0], sets: 0 }]],
  ['holds a hole where a card should be', [started[0], null]],
]) {
  check(
    `a snapshot that ${label} is not used`,
    snapshotToResume({ ...stored, exerciseSnapshot: snapshot }, launch) === null,
    'it has been through storage and a migration chain, so the shape is checked rather than assumed'
  );
}
check(
  'and a whole one is',
  isUsableSnapshot(stored.exerciseSnapshot) &&
    snapshotToResume(stored, launch) === stored.exerciseSnapshot,
  'otherwise the guards above are passing for the wrong reason'
);

console.log('\n[10] The snapshot stays on the phone');

/**
 * `activeSession` is deliberately not part of SyncPayload: half a workout is not
 * history and has no business arriving on another phone. That is what keeps the
 * cards clear of the sync body limit measured in tests/sync-payload-size. Run
 * the real payload builder both ways and compare, rather than trusting the type.
 */
const snapshotBytes = Buffer.byteLength(json(stored.exerciseSnapshot));
console.log(`      one session's cards weigh about ${(snapshotBytes / 1024).toFixed(1)} kb`);

useAppStore.setState({ activeSession: null });
const bytesWithout = Buffer.byteLength(json(useAppStore.getState().getDataForSync()));
useAppStore.setState({ activeSession: stored });
const bytesWith = Buffer.byteLength(json(useAppStore.getState().getDataForSync()));
useAppStore.setState({ activeSession: null });

check(
  'a session in progress adds nothing at all to the sync body',
  bytesWith === bytesWithout,
  `${bytesWith} bytes with it against ${bytesWithout} without; if these ever differ, the cards are being uploaded and sync-payload-size has to be told about them`
);
check(
  'and one session of cards is a sane thing to hold on the device',
  snapshotBytes > 0 && snapshotBytes < 64 * 1024,
  `${(snapshotBytes / 1024).toFixed(1)} kb - this is rewritten on every autosave alongside the whole history`
);

console.log('\n[11] The session screen is actually wired to all of it');

check(
  'every save path writes the cards, not just their ids',
  (session.match(/exerciseSnapshot: exercisesRef\.current/g) ?? []).length === 3,
  'the three save paths are background/unmount, autosave and Save & Exit; a snapshot that reaches two of them is the original bug'
);
check(
  'the screen asks lib/resume-snapshot which list to run on',
  /snapshotToResume\(activeSession, launch\)/.test(session),
  'the decision tested above has to be the decision the screen makes'
);
check(
  'and it holds on to a saved list once it has one',
  /const exercises = resumedCards \?\? savedCards \?\? generatedExercises;/.test(session),
  'completing a session clears activeSession, and a list derived live from it would flip back to the generated one at that moment'
);
check(
  'the restore gate compares the launch in one place',
  /storedMatchesLaunch\(stored, launch\)/.test(session),
  'two hand-written copies of the same seven comparisons is how the pain context went missing in the first place'
);

console.log('\n[?] A day off does not throw the session away');

/**
 * IT USED TO DELETE AFTER TWENTY-FOUR HOURS, SILENTLY.
 *
 * Start on Saturday morning, get interrupted, open the app on Sunday: the sets
 * were gone, with no warning and no notice. Home has always offered both
 * answers on that card, Resume and an X to start fresh, so the choice existed.
 * The automatic delete was taking it away before the user ever saw it.
 *
 * A week rather than forever, because the load maths backs weights off after a
 * layoff and resuming a fortnight-old session would train against numbers the
 * app has since moved past. Long enough that ordinary life does not cost you a
 * session; short enough that nothing ancient is offered.
 */
const layoutSrc = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const homeSrc = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const windowMs = (() => {
  const m = /ACTIVE_SESSION_MAX_AGE_MS = ([0-9 *]+);/.exec(layoutSrc);
  // eslint-disable-next-line no-new-func
  return m ? Function('return (' + m[1] + ');')() : NaN;
})();
const windowDays = windowMs / 86400000;

check(
  `the discard window is a named constant (${windowDays} days)`,
  Number.isFinite(windowMs),
  'a bare literal here is a rule nothing can read, and the notification ladder needs to ask what it is'
);
check(
  'a session survives at least a couple of days',
  windowDays >= 2,
  'at one day, anyone who trains in the morning and reopens the app the next day loses their sets'
);
check(
  'but not indefinitely',
  windowDays <= 30,
  'the weights in a month-old session are not the weights the app would give you today'
);
check(
  'and the discard is still automatic past that point',
  /age > ACTIVE_SESSION_MAX_AGE_MS/.test(layoutSrc),
  'without it a stale session sits on Home for ever'
);

check(
  'Home offers both answers, not just Resume',
  /testID="resume-session"/.test(homeSrc) && /testID="discard-active-session"/.test(homeSrc),
  'this is the choice the automatic delete was making on the user\'s behalf'
);
check(
  'the card says how old the session is',
  /activeSessionAge/.test(homeSrc),
  '"12/24 sets" from this morning and the same from last Tuesday are different decisions'
);
check(
  'and it says nothing for one saved today',
  /if \(days <= 0\) return '';/.test(homeSrc),
  '"today" beside a Resume button is noise'
);
check(
  'starting fresh says what is actually lost',
  /Start fresh\?/.test(homeSrc) && /will be lost/.test(homeSrc),
  'and that it is only the in-progress sets, not the history'
);
check(
  'it does not claim the history goes with it',
  /history and your weights are not affected/.test(homeSrc),
  'the word "lost" beside a training app needs bounding, or nobody taps it'
);

console.log(`\nsession-resume-fidelity: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
