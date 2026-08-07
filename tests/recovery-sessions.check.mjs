/**
 * Contract test: rehab and mobility are first-class sessions.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Two failures, both invisible unless you actually train that way:
 *
 *  1. app/session.tsx saved prehab and flexibility sessions with
 *     `exerciseLogs: []`. Weeks of rehab produced a session count and a date and
 *     NOTHING else — no exercise history, no muscle map, no progress, and a
 *     summary screen that said "Recovery sessions don't load exercises, so
 *     there's nothing to compare here". The app had no memory of what was done.
 *
 *  2. Targeted rehab returned the same fixed seven exercises in the same order
 *     every time, with no shuffle and no seed. Six weeks of knee rehab was the
 *     identical session, forty times.
 *
 * Run:  node tests/recovery-sessions.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dir, rel), 'utf8');
const session = read('../app/session.tsx');
const engine = read('../lib/workout-engine.ts');
const stats = read('../app/(tabs)/workouts.tsx');

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

// ─── 1. Recovery sessions record what was done ───────────────────────────────
console.log('\n[1] Rehab and mobility record their exercises');

check(
  'exerciseLogs is no longer emptied for prehab/flexibility',
  !/const exerciseLogs: ExerciseLog\[\] = isPrehabOrFlex\s*\n?\s*\?\s*\[\]/.test(session),
  'the empty-list branch is what erased every rehab session'
);
check(
  'every session type maps its exercises into logs',
  /const exerciseLogs: ExerciseLog\[\] = exercises\.map\(/.test(session),
  ''
);
check(
  'rehab load is still NOT auto-progressed',
  /if \(!isPrehabOrFlex && exerciseLogs\.length > 0\) \{/.test(session),
  'recording what was done is not the same as adding 2.5 kg to rehab work on a timer'
);

// ─── 2. Targeted rehab varies ────────────────────────────────────────────────
console.log('\n[2] Targeted rehab varies between sessions');

check(
  'the region plan is split into warmup / core / cooldown',
  /const regionPlan = getRegionPrehabWorkout\(primaryRegion\);/.test(engine) &&
    /const core = regionPlan\.filter\(\(e\) => e\.category === 'prehab'\);/.test(engine),
  ''
);
check(
  'the core order is shuffled on a seed',
  /const rotatedCore = seededShuffleDiverse\(core, seed\);/.test(engine),
  ''
);
check(
  'rotating supplements are drawn from the general pool',
  /const supplement = seededShuffleDiverse\(supplementPool, seed\)\.slice\(0, REHAB_SUPPLEMENT\);/.test(
    engine
  ),
  ''
);
check(
  'supplements never duplicate a region exercise',
  /\.filter\(\(e\) => !core\.some\(\(c\) => c\.name === e\.name\)\)/.test(engine),
  ''
);

// ─── 2b. Simulated, against the real engine ──────────────────────────────────
console.log('\n[2b] Six knee-rehab sessions, generated for real');

const { generateWorkout } = await import('../lib/workout-engine.ts');
const { getRegionPrehabWorkout } = await import('../lib/exercise-db.ts');

const profile = {
  name: 'A',
  sex: 'other',
  experienceLevel: 'intermediate',
  goals: ['rehab'],
  bodyweightKg: 80,
};
const readiness = { energy: 'normal', timeAvailable: '45', hasAches: true, painRegion: 'knee' };

const sessions = [];
for (let n = 0; n < 6; n++) {
  sessions.push(
    generateWorkout('prehab', 'bodyweight', readiness, profile, {}, undefined, n).map((e) => e.name)
  );
}

const distinct = new Set(sessions.map((s) => s.join('|')));
check(
  `all six sessions differ (${distinct.size}/6 distinct)`,
  distinct.size === 6,
  'the whole point is that six weeks of rehab is not one session repeated'
);

// The clinical core must survive the variation — that is what makes it rehab
// for THAT joint rather than generic mobility.
const kneeCore = getRegionPrehabWorkout('knee')
  .filter((e) => e.category === 'prehab')
  .map((e) => e.name);
check(
  `every session still contains all ${kneeCore.length} knee-specific exercises`,
  sessions.every((s) => kneeCore.every((name) => s.includes(name))),
  'variation must not drop the exercises chosen for the injured joint'
);
check(
  'sessions stay a sane length',
  sessions.every((s) => s.length >= kneeCore.length + 2 && s.length <= kneeCore.length + 5),
  `lengths: ${sessions.map((s) => s.length).join(', ')}`
);

// ─── 3. The Strength tab says something to a non-lifter ──────────────────────
console.log('\n[3] The Strength tab is not four empty states');

check(
  'a no-1RM fallback exists',
  /const noKpiData = oneRepMaxes\.length === 0;/.test(stats),
  ''
);
check(
  'it is derived from real logged weight, any session type',
  /if \(!set\.completed \|\| set\.skipped \|\| set\.weight <= 0\) continue;/.test(stats),
  ''
);
check(
  'it renders only when there is something to show',
  /\{heaviestLifts\.length > 0 && \(/.test(stats),
  'an empty "Your heaviest lifts" heading is just a fifth empty state'
);
// This assertion used to require `noKpiData && heaviestLifts.length > 0`, which
// was wrong in a way that only showed up once someone had used the app for a
// while: the block DISAPPEARED the moment a single 1RM was recorded. A
// conditioning user who tested their squat once went from a useful list of
// their heaviest lifts to a tab with one number and two empty charts. The
// intent — never render an empty heading — is kept; the extra gate is not.
check(
  'and it is not switched off by having one 1RM',
  !/noKpiData && heaviestLifts\.length > 0/.test(stats),
  'gating on noKpiData deletes the fallback at exactly the point it starts being useful'
);

console.log('');
if (failures > 0) {
  console.error(`recovery-sessions: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`recovery-sessions: all ${total} checks passed\n`);
  process.exit(0);
}
