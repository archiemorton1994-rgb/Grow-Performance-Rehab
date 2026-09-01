/**
 * Contract test: a finished block produces a record, and the record is true.
 *
 * WHAT THIS IS GUARDING
 * ─────────────────────
 * A block had no ending. Twelve sessions of twelve, and the app showed a badge
 * reading "Block complete" in two places and carried on identically. The report
 * is the ending, and because it is FROZEN at the moment it is built - see the
 * docblock in lib/programme-report.ts - anything wrong in it is wrong for good.
 * There is no next render to correct it on.
 *
 * So the five things that must hold:
 *
 *   EVERYTHING IS COUNTED, ON PLAN OR NOT. The block's POSITION only moves on a
 *   session the programme asked for, and that promise is unchanged. But a report
 *   that threw away six conditioning sessions somebody chose to do would be
 *   telling them their own training did not happen.
 *
 *   REPS COUNT AS PROGRESS. The app climbs reps before it adds weight. A report
 *   that charted weight alone would show a flat line for somebody who went from
 *   eight reps to twelve, on the exact mechanic the app is built around.
 *
 *   IT REPORTS LOSSES TOO. A document that only ever reports gains is a document
 *   nobody can trust the good news in.
 *
 *   A PERSONAL BEST MEANS BEATING YOUR OWN HISTORY, not beating session one.
 *
 *   AND NOBODY IS PROMOTED ON NOTHING. Two ratings out of two is a hundred
 *   percent of nothing, and stepping somebody up on it puts a beginner in front
 *   of a movement a physiotherapist would not have given them.
 *
 * Run:  npx tsx tests/programme-report.check.mjs
 */
globalThis.__DEV__ = false;

import {
  buildProgrammeReport,
  completeProgramme,
  archiveIdFor,
  archivedTagFor,
  levelStepFor,
  REPORT_VERSION,
} from '../lib/programme-report.ts';
import { cycleOf } from '../lib/programme.ts';

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

// ─── Fixtures ───────────────────────────────────────────────────────────────

const block = (over = {}) => ({
  templateId: 'barbell',
  days: 3,
  sessions: 12,
  minutes: 45,
  startedAt: '2026-01-01T09:00:00.000Z',
  startedAtSessionCount: 0,
  ...over,
});

let idSeq = 0;
/** A logged session. Dates step a day at a time unless one is given. */
const sess = (sessionType, over = {}) => ({
  id: `s${++idSeq}`,
  sessionType,
  date: over.date ?? `2026-01-${String(1 + (idSeq % 28)).padStart(2, '0')}T10:00:00.000Z`,
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '60',
  exerciseCount: 1,
  durationSeconds: 45 * 60,
  exerciseLogs: [],
  ...over,
});

/** One exercise's worth of logged sets. */
const log = (exerciseId, exerciseName, sets, over = {}) => ({
  exerciseId,
  exerciseName,
  sets: sets.map(([weight, reps], i) => ({
    setNumber: i + 1,
    weight,
    reps,
    completed: true,
  })),
  ...over,
});

/** A whole block of the given cycle, done in order, oldest first. */
function fullBlock(p, build) {
  const cycle = cycleOf(p);
  return Array.from({ length: p.sessions }, (_, i) =>
    sess(cycle[i % cycle.length], build ? build(i) : {})
  );
}

const report = (p, sessions, over = {}) =>
  buildProgrammeReport({
    programme: p,
    sessionsSinceEnrolment: sessions,
    historyBefore: [],
    experience: 'intermediate',
    finishedAt: '2026-03-01T00:00:00.000Z',
    ...over,
  });

// ─── 1. It counts what happened ─────────────────────────────────────────────
console.log('\n[1] The block, counted');

{
  const p = block();
  const done = fullBlock(p, (i) => ({
    exerciseLogs: [log('squat', 'Back Squat', [[100, 5], [100, 5], [100, 5]])],
    durationSeconds: 40 * 60,
  }));
  const r = report(p, done);

  check('a finished block reports every session in it', r.onPlan === 12, `${r.onPlan}`);
  check('and stamps the shape it was written in', r.v === REPORT_VERSION, `${r.v}`);
  check(
    'sets, reps and weight moved are all summed from what was logged',
    r.totalSets === 36 && r.totalReps === 180 && r.volumeKg === 18000,
    `${r.totalSets} sets, ${r.totalReps} reps, ${r.volumeKg} kg`
  );
  check(
    'time under the bar comes from the timer, not from the plan',
    r.minutesTrained === 12 * 40,
    `${r.minutesTrained}`
  );
  check('and the block knows how long it was meant to be', r.blockLength === 12, `${r.blockLength}`);
}

{
  // The promise the whole programme layer is built on, seen from the report's
  // side: position does not move, and the work still happened.
  const p = block();
  const cycle = cycleOf(p);
  const done = [];
  for (let i = 0; i < 12; i++) {
    done.push(sess(cycle[i % cycle.length], { exerciseLogs: [log('x', 'X', [[50, 10]])] }));
    if (i % 4 === 0) done.push(sess('conditioning', { exerciseLogs: [log('run', 'Run', [[0, 0]])] }));
  }
  const r = report(p, done);
  check(
    'sessions somebody chose themselves are counted, not thrown away',
    r.onPlan === 12 && r.offPlan === 3,
    `${r.onPlan} on plan, ${r.offPlan} off`
  );
  check(
    'and they show up in what was actually trained',
    r.byType.some((t) => t.type === 'conditioning' && t.count === 3),
    JSON.stringify(r.byType)
  );
}

// ─── 2. What moved ──────────────────────────────────────────────────────────
console.log('\n[2] What moved, including what did not');

{
  const p = block({ sessions: 6, days: 3 });
  const cycle = cycleOf(p);
  // Squat climbs 100 -> 120. Bench holds. Row goes backwards.
  const kgAt = [100, 105, 110, 115, 120, 120];
  const done = Array.from({ length: 6 }, (_, i) =>
    sess(cycle[i % cycle.length], {
      exerciseLogs: [
        log('squat', 'Back Squat', [[kgAt[i], 5]]),
        log('bench', 'Bench Press', [[60, 8]]),
        log('row', 'Barbell Row', [[70 - i * 2, 8]]),
      ],
    })
  );
  const r = report(p, done);
  const squat = r.movers.find((m) => m.exerciseId === 'squat');

  check(
    'a lift that climbed is reported, first appearance against last',
    !!squat && squat.fromKg === 100 && squat.toKg === 120 && squat.deltaKg > 0,
    JSON.stringify(squat)
  );
  check(
    'the movers are ordered biggest first, and capped at three',
    r.movers.length <= 3 && r.movers.every((m, i) => i === 0 || m.deltaKg <= r.movers[i - 1].deltaKg),
    JSON.stringify(r.movers.map((m) => m.deltaKg))
  );
  check(
    // A document that only ever reports gains is one nobody can trust the good
    // news in, and a lift that went backwards is the most useful thing here for
    // a physiotherapist.
    'a lift that went backwards is reported too',
    r.slipped.some((m) => m.exerciseId === 'row' && m.deltaKg < 0),
    JSON.stringify(r.slipped)
  );
  check(
    'and a lift that held is in neither list',
    !r.movers.some((m) => m.exerciseId === 'bench') &&
      !r.slipped.some((m) => m.exerciseId === 'bench'),
    ''
  );
}

check(
  // The app climbs reps before it adds weight - eight, then nine, then ten at
  // the same load, and only then a plate. A report that charted weight alone
  // would show a flat line across the entire first half of every progression.
  'reps count as progress, at the same weight',
  (() => {
    const p = block({ sessions: 4, days: 2 });
    const cycle = cycleOf(p);
    const reps = [8, 9, 10, 12];
    const done = reps.map((n, i) =>
      sess(cycle[i % cycle.length], { exerciseLogs: [log('squat', 'Back Squat', [[100, n]])] })
    );
    const r = report(p, done);
    const m = r.movers.find((x) => x.exerciseId === 'squat');
    return !!m && m.fromKg === m.toKg && m.deltaKg > 0 && m.toReps === 12;
  })(),
  ''
);
check(
  /**
   * WAS "one appearance is not a trend", WHICH COULD NOT FAIL.
   *
   * It asserted that an exercise seen once shows up in neither list. True, and
   * true with or without the guard it was aimed at: one appearance has the same
   * first and last entry, so its delta is exactly zero and both lists drop it
   * anyway. Deleting the guard left the check green.
   *
   * This is the assertion that is actually load-bearing. Every number on the
   * report is a claim about what was logged, and "you trained this eleven times"
   * is one somebody can check against their own history.
   */
  'a lift reports how many sessions it was actually trained in',
  (() => {
    const p = block({ sessions: 6, days: 3 });
    const cycle = cycleOf(p);
    // Squat every session and climbing; the accessory only on alternate ones.
    const done = Array.from({ length: 6 }, (_, i) =>
      sess(cycle[i % cycle.length], {
        exerciseLogs: [
          log('squat', 'Back Squat', [[100 + i * 5, 5]]),
          ...(i % 2 === 0 ? [log('curl', 'Biceps Curl', [[20 + i, 10]])] : []),
        ],
      })
    );
    const r = report(p, done);
    const all = [...r.movers, ...r.slipped];
    return (
      all.find((m) => m.exerciseId === 'squat')?.appearances === 6 &&
      all.find((m) => m.exerciseId === 'curl')?.appearances === 3
    );
  })(),
  ''
);

// ─── 3. Personal bests mean beating your own history ────────────────────────
console.log('\n[3] A first is a first against everything, not against session one');

{
  const p = block({ sessions: 4, days: 2, startedAtSessionCount: 1 });
  const cycle = cycleOf(p);
  const before = [sess('squat', { exerciseLogs: [log('squat', 'Back Squat', [[140, 3]])] })];
  const done = Array.from({ length: 4 }, (_, i) =>
    sess(cycle[i % cycle.length], {
      exerciseLogs: [
        log('squat', 'Back Squat', [[100 + i * 20, 3]]),
        log('curl', 'Biceps Curl', [[20, 10]]),
      ],
    })
  );
  const r = report(p, done, { historyBefore: before });

  check(
    'beating a two year old best is a personal best',
    r.personalBests.some((b) => b.exerciseName === 'Back Squat' && b.kg === 160),
    JSON.stringify(r.personalBests)
  );
  check(
    // Otherwise the page fills with the same lift five times, and "personal
    // best" stops meaning anything.
    'and it is listed once, not once per session that beat the one before it',
    r.personalBests.filter((b) => b.exerciseName === 'Back Squat').length === 1,
    ''
  );
  check(
    'an exercise with no history before the block is not called a first',
    !r.personalBests.some((b) => b.exerciseName === 'Biceps Curl'),
    'everything anybody ever does would be a personal best on that reading'
  );
}

// ─── 4. How it felt ─────────────────────────────────────────────────────────
console.log('\n[4] How it went, honestly');

check(
  'a block where the aches thinned out says they settled',
  (() => {
    const p = block({ sessions: 8, days: 2 });
    const cycle = cycleOf(p);
    const done = Array.from({ length: 8 }, (_, i) =>
      sess(cycle[i % cycle.length], {
        hadAches: i < 3,
        painRegions: i < 3 ? ['knee'] : undefined,
        exerciseLogs: [log('x', 'X', [[50, 5]])],
      })
    );
    const r = report(p, done);
    return r.acheTrend === 'settled' && r.acheSessions === 3 && r.acheRegions.includes('knee');
  })(),
  ''
);
check(
  'a block where they got worse says so rather than rounding it off',
  (() => {
    const p = block({ sessions: 8, days: 2 });
    const cycle = cycleOf(p);
    const done = Array.from({ length: 8 }, (_, i) =>
      sess(cycle[i % cycle.length], { hadAches: i >= 5, exerciseLogs: [log('x', 'X', [[50, 5]])] })
    );
    return report(p, done).acheTrend === 'worse';
  })(),
  ''
);
check(
  'nothing sore all block means no trend at all, rather than a flattering one',
  (() => {
    const p = block({ sessions: 8, days: 2 });
    return report(p, fullBlock(p)).acheTrend === null;
  })(),
  ''
);
check(
  'a session with a set left unfinished is not a clean one',
  (() => {
    const p = block({ sessions: 4, days: 2 });
    const cycle = cycleOf(p);
    const half = log('x', 'X', [[50, 5]]);
    half.sets.push({ setNumber: 2, weight: 50, reps: 0, completed: false });
    const done = Array.from({ length: 4 }, (_, i) =>
      sess(cycle[i % cycle.length], { exerciseLogs: [i === 0 ? half : log('x', 'X', [[50, 5]])] })
    );
    return report(p, done).cleanSessions === 3;
  })(),
  ''
);
check(
  'a set deliberately skipped is not the same as one abandoned',
  (() => {
    const p = block({ sessions: 2, days: 2 });
    const cycle = cycleOf(p);
    const skipped = log('x', 'X', [[50, 5]]);
    skipped.sets.push({ setNumber: 2, weight: 0, reps: 0, completed: false, skipped: true });
    const done = [
      sess(cycle[0], { exerciseLogs: [skipped] }),
      sess(cycle[1], { exerciseLogs: [log('x', 'X', [[50, 5]])] }),
    ];
    const r = report(p, done);
    return r.cleanSessions === 2 && r.totalSets === 2;
  })(),
  ''
);

// ─── 5. The step up ─────────────────────────────────────────────────────────
console.log('\n[5] Nobody is promoted on nothing');

const effort = (rated, hard) => ({ easy: rated - hard, hard, rated });

check(
  'a block finished cleanly and comfortably earns the next level',
  (() => {
    const step = levelStepFor('beginner', { cleanSessions: 12, onPlan: 12, effort: effort(20, 2) });
    return step.earned && step.to === 'intermediate' && step.toCeiling > step.fromCeiling;
  })(),
  JSON.stringify(levelStepFor('beginner', { cleanSessions: 12, onPlan: 12, effort: effort(20, 2) }))
);
check(
  // Two ratings out of two is a hundred percent of nothing. Promoting on it puts
  // a beginner in front of a movement a physiotherapist would not have given
  // them, which is the exact failure the level ceiling exists to prevent.
  'but not on two ratings out of two',
  levelStepFor('beginner', { cleanSessions: 12, onPlan: 12, effort: effort(2, 0) }).earned === false,
  ''
);
check(
  'a block that was hard work is not a step up, and says so kindly',
  (() => {
    const step = levelStepFor('intermediate', {
      cleanSessions: 12,
      onPlan: 12,
      effort: effort(20, 10),
    });
    return !step.earned && step.to === 'intermediate' && step.because.length > 40;
  })(),
  levelStepFor('intermediate', { cleanSessions: 12, onPlan: 12, effort: effort(20, 10) }).because
);
check(
  'nor is a block with sets left unfinished',
  levelStepFor('beginner', { cleanSessions: 6, onPlan: 12, effort: effort(20, 0) }).earned === false,
  ''
);
check(
  'the top level has nowhere to go, and does not pretend otherwise',
  (() => {
    const step = levelStepFor('advanced', { cleanSessions: 12, onPlan: 12, effort: effort(20, 0) });
    return !step.earned && step.to === 'advanced' && step.fromCeiling === step.toCeiling;
  })(),
  ''
);
check(
  'a step that is not earned never moves the ceiling either',
  ['beginner', 'intermediate', 'advanced'].every((lvl) => {
    const step = levelStepFor(lvl, { cleanSessions: 1, onPlan: 12, effort: effort(20, 10) });
    return !step.earned && step.from === step.to && step.fromCeiling === step.toCeiling;
  }),
  ''
);
check(
  'every outcome names what decided it',
  [
    levelStepFor('beginner', { cleanSessions: 12, onPlan: 12, effort: effort(20, 0) }),
    levelStepFor('beginner', { cleanSessions: 12, onPlan: 12, effort: effort(2, 0) }),
    levelStepFor('beginner', { cleanSessions: 1, onPlan: 12, effort: effort(20, 0) }),
    levelStepFor('beginner', { cleanSessions: 12, onPlan: 12, effort: effort(20, 19) }),
    levelStepFor('advanced', { cleanSessions: 12, onPlan: 12, effort: effort(20, 0) }),
  ].every((s) => s.because.trim().length > 30 && !/undefined|NaN/.test(s.because)),
  ''
);

// ─── 6. Freezing it ─────────────────────────────────────────────────────────
console.log('\n[6] A record, not a projection');

{
  const p = block({
    templateId: 'custom',
    custom: { name: 'My Thing', cycle: ['full_body', 'conditioning'] },
    sessions: 8,
    days: 2,
  });
  const done = fullBlock(p, () => ({ exerciseLogs: [log('x', 'X', [[50, 5]])] }));
  const archived = completeProgramme({
    programme: p,
    sessionsSinceEnrolment: done,
    historyBefore: [],
    experience: 'intermediate',
    finishedAt: '2026-03-01T00:00:00.000Z',
  });

  check(
    'the cycle and the name are COPIED, so editing them later cannot rewrite it',
    archived.name === 'My Thing' && archived.cycle.join(',') === 'full_body,conditioning',
    JSON.stringify(archived.cycle)
  );
  check(
    'it keeps which sessions were in it, so history can point back',
    archived.sessionIds.length === 8 && archived.sessionIds.every((id) => typeof id === 'string'),
    ''
  );
  check(
    // Derived rather than generated, so archiveIfBlockComplete can be called
    // after every session for the rest of the block's life without collecting a
    // second certificate for the same one.
    'its id is derived from the block, so the same block cannot be archived twice',
    archiveIdFor(p) === archiveIdFor({ ...p }) && archived.id === archiveIdFor(p),
    archived.id
  );
  check(
    'and a different block gets a different one',
    archiveIdFor(p) !== archiveIdFor({ ...p, startedAt: '2026-06-01T00:00:00.000Z' }),
    ''
  );
  check(
    'a session in a finished block can still be told which block it was in',
    (() => {
      const tag = archivedTagFor([archived], done[3].id);
      return !!tag && tag.name === 'My Thing' && tag.blockIndex === 4 && tag.total === 8;
    })(),
    JSON.stringify(archivedTagFor([archived], done[3].id))
  );
  check(
    'and a session that was never in one is not given a block it did not belong to',
    archivedTagFor([archived], 'not-a-real-id') === null,
    ''
  );
}

check(
  'a block finished in a single day does not divide by zero',
  (() => {
    const p = block({ sessions: 4, days: 2 });
    const done = fullBlock(p, () => ({
      date: '2026-02-02T10:00:00.000Z',
      exerciseLogs: [log('x', 'X', [[50, 5]])],
    }));
    const r = report(p, done);
    return Number.isFinite(r.perWeek) && Number.isFinite(r.spanDays);
  })(),
  ''
);
check(
  'a block with nothing logged in it produces a report rather than a crash',
  (() => {
    const p = block({ sessions: 4, days: 2 });
    const r = report(p, []);
    return r.onPlan === 0 && r.highlight === null && Number.isFinite(r.volumeKg);
  })(),
  ''
);
check(
  // Somebody who did twelve sessions of mobility work moved no weight at all and
  // still finished a block. The page cannot go blank on them.
  'a block with no weight in it still has something to put in the biggest type',
  (() => {
    const p = block({ templateId: 'joints', sessions: 8, days: 2 });
    const done = fullBlock(p, () => ({ exerciseLogs: [log('m', 'Mobility', [[0, 10]])] }));
    const r = report(p, done);
    return r.highlight?.kind === 'sessions' && r.highlight.count === 8;
  })(),
  JSON.stringify(report(block({ templateId: 'joints', sessions: 8, days: 2 }), []).highlight)
);
check(
  'and a block with a real gain in it leads on the gain',
  (() => {
    const p = block({ sessions: 4, days: 2 });
    const cycle = cycleOf(p);
    const done = [100, 110, 120, 130].map((kg, i) =>
      sess(cycle[i % cycle.length], { exerciseLogs: [log('squat', 'Back Squat', [[kg, 5]])] })
    );
    const r = report(p, done);
    return r.highlight?.kind === 'lift' && r.highlight.move.exerciseId === 'squat';
  })(),
  ''
);
check(
  'the easier weeks that were actually done are counted',
  (() => {
    const p = block({ sessions: 20, days: 3 });
    const done = fullBlock(p, () => ({ exerciseLogs: [log('x', 'X', [[50, 5]])] }));
    // 20 sessions at 3 a week is 7 weeks, so week 4 eases and nothing else does.
    return report(p, done).deloadWeeksDone === 1;
  })(),
  `${report(block({ sessions: 20, days: 3 }), fullBlock(block({ sessions: 20, days: 3 }))).deloadWeeksDone}`
);

console.log(`\nprogramme-report: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
