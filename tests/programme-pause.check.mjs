/**
 * Contract test: pausing a block actually pauses it.
 *
 * WHAT WAS WRONG. The hub says, in these words: "Paused. You are still
 * training, it just is not moving the block along." Nothing implemented it. The
 * position is replayed from every session logged since enrolment and no reader
 * ever consulted the flag, so a paused twelve session block advanced on every
 * session, reached the end, and archived a Programme Report its owner had
 * explicitly stopped and never asked for. Reports are frozen the moment they
 * are written, so that one was wrong for good.
 *
 * A COUNT WOULD NOT HAVE BEEN ENOUGH, and that is the part worth remembering.
 * Sessions logged during a pause are the most recent ones only until training
 * resumes; after that they sit in the middle of the history. Where they were
 * has to be recorded, not how many, which is why pausedRanges is a list of
 * ranges rather than a number.
 *
 * What this guards:
 *   THE BLOCK HOLDS while paused, however much is trained.
 *   IT CANNOT FINISH ITSELF while paused, and archives nothing.
 *   IT PICKS UP WHERE IT LEFT OFF, not where it would have been.
 *   AND THE PAUSED SESSIONS STAY OFF THE BLOCK for ever, including after more
 *   training has been logged on top of them.
 *
 * Run:  npx tsx tests/programme-pause.check.mjs
 */
globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore } from '../lib/store.ts';
import { sessionsCountingToward } from '../lib/programme.ts';

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

const CYCLE = ['squat', 'bench', 'deadlift'];
let seq = 0;
const session = (type) => ({
  sessionType: type,
  date: new Date(Date.parse('2026-06-01T09:00:00Z') + seq++ * 2 * 86400000).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  painRegions: [],
  energy: 'good',
  timeAvailable: '45',
  exerciseCount: 1,
  durationSeconds: 2700,
  exerciseLogs: [
    {
      exerciseId: 'x',
      exerciseName: 'Back Squat',
      targetReps: '5',
      category: 'main',
      sets: [{ weight: 100, reps: 5, completed: true, skipped: false }],
    },
  ],
});

/** Enrol fresh, then run the cycle in order for n sessions. */
function start() {
  seq = 0;
  useAppStore.getState().resetProgress();
  useAppStore.getState().setUserProfile({
    name: 'A',
    sex: 'male',
    experienceLevel: 'intermediate',
    goals: ['strength'],
    bodyweightKg: 82,
  });
  useAppStore.setState({
    completedSessions: [],
    completedCount: 0,
    completedProgrammes: [],
    pendingProgrammeReportId: null,
    programme: {
      templateId: 'barbell',
      days: 3,
      sessions: 12,
      minutes: 45,
      startedAt: '2026-06-01T09:00:00.000Z',
      startedAtSessionCount: 0,
    },
  });
}
/** Train the block's next N sessions, following the cycle so they are on plan. */
function trainOnPlan(n) {
  for (let i = 0; i < n; i++) {
    const next = useAppStore.getState().getProgrammePosition()?.next ?? CYCLE[0];
    useAppStore.getState().completeSession(session(next));
  }
}
/** Train N sessions of the cycle regardless of where the block thinks it is. */
function trainAnything(n) {
  for (let i = 0; i < n; i++) useAppStore.getState().completeSession(session(CYCLE[i % 3]));
}
const onPlan = () => useAppStore.getState().getProgrammePosition()?.onPlan ?? -1;

console.log('\n[1] The block holds while paused');

start();
trainOnPlan(4);
const beforePause = onPlan();
useAppStore.getState().setProgrammePaused(true);
check('pausing does not move the block on its own', onPlan() === beforePause, `${onPlan()}`);

trainAnything(8);
check(
  'and eight sessions trained while paused do not move it either',
  onPlan() === beforePause,
  `was ${beforePause}, now ${onPlan()}`
);
check(
  // The whole reason this mattered. Twelve sessions logged on a twelve session
  // block used to complete it and freeze a report nobody asked for.
  'a paused block never finishes itself',
  useAppStore.getState().getProgrammePosition()?.complete === false,
  ''
);
check(
  'and nothing is archived while it is stopped',
  useAppStore.getState().completedProgrammes.length === 0 &&
    useAppStore.getState().pendingProgrammeReportId === null,
  `${useAppStore.getState().completedProgrammes.length} archived`
);

console.log('\n[2] It picks up where it left off');

useAppStore.getState().setProgrammePaused(false);
check(
  'resuming leaves the block exactly where the pause found it',
  onPlan() === beforePause,
  `was ${beforePause}, now ${onPlan()}`
);
trainOnPlan(2);
check(
  'and training after resuming moves it again',
  onPlan() === beforePause + 2,
  `${onPlan()}`
);
check(
  // The reason a range is stored rather than a count: these sessions are in the
  // MIDDLE of the history now, not at the end of it.
  'the sessions trained during the pause stay off the block afterwards',
  (() => {
    const { programme, completedSessions } = useAppStore.getState();
    const counted = sessionsCountingToward(programme, completedSessions);
    return counted.length === beforePause + 2 && completedSessions.length === beforePause + 10;
  })(),
  `${sessionsCountingToward(useAppStore.getState().programme, useAppStore.getState().completedSessions).length} counted of ${useAppStore.getState().completedSessions.length} logged`
);

console.log('\n[3] The bookkeeping holds up');

start();
trainOnPlan(3);
useAppStore.getState().setProgrammePaused(true);
useAppStore.getState().setProgrammePaused(true);
check(
  // Pausing twice must not move the start of the open range forward, which would
  // quietly let the sessions in between count.
  'pausing an already paused block does not move where the pause began',
  (useAppStore.getState().programme.pausedRanges ?? []).length === 1,
  JSON.stringify(useAppStore.getState().programme.pausedRanges)
);
useAppStore.getState().setProgrammePaused(false);
check(
  'a pause nobody trained through leaves nothing behind',
  (useAppStore.getState().programme.pausedRanges ?? []).length === 0,
  JSON.stringify(useAppStore.getState().programme.pausedRanges)
);

start();
trainOnPlan(2);
useAppStore.getState().setProgrammePaused(true);
trainAnything(2);
useAppStore.getState().setProgrammePaused(false);
trainOnPlan(2);
useAppStore.getState().setProgrammePaused(true);
trainAnything(2);
useAppStore.getState().setProgrammePaused(false);
check(
  'two separate pauses are both remembered',
  (useAppStore.getState().programme.pausedRanges ?? []).length === 2,
  JSON.stringify(useAppStore.getState().programme.pausedRanges)
);
check(
  'and neither of their sessions counts towards the block',
  (() => {
    const { programme, completedSessions } = useAppStore.getState();
    return (
      sessionsCountingToward(programme, completedSessions).length === 4 &&
      completedSessions.length === 8
    );
  })(),
  `${sessionsCountingToward(useAppStore.getState().programme, useAppStore.getState().completedSessions).length} counted of ${useAppStore.getState().completedSessions.length}`
);

console.log('\n[4] A block that was never paused is untouched');

start();
trainOnPlan(5);
check(
  'every session since enrolment still counts when nothing was ever paused',
  (() => {
    const { programme, completedSessions } = useAppStore.getState();
    return sessionsCountingToward(programme, completedSessions).length === 5;
  })(),
  ''
);
check(
  'and history from before enrolment is still excluded',
  (() => {
    const { programme, completedSessions } = useAppStore.getState();
    const p = { ...programme, startedAtSessionCount: 2 };
    return sessionsCountingToward(p, completedSessions).length === 3;
  })(),
  ''
);

console.log(`\nprogramme-pause: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
