/**
 * Contract test: nobody's logged progress is lost, and nobody inherits
 * somebody else's.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The old catalogue holds the same movement several times over, once per pool
 * it appears in. The library has one record per movement, and 89 of them keep
 * the catalogue id they matched - but only ONE of the duplicates. So a person
 * who trained Lower Body rather than the old squat rotation logged every squat
 * against `wlb-fg-squat`, and the record that will serve them keeps
 * `sq-main-fg`. Left alone their first library session arrives at the
 * beginner's estimate with months of real sets sitting under an id nothing
 * reads.
 *
 * Both ways of getting this wrong are silent:
 *
 *   TOO LITTLE - a duplicate nobody merged, and somebody starts again at the
 *   estimate, which looks like the app forgetting them.
 *   TOO MUCH - a pair merged that is not the same exercise, and somebody is
 *   handed another movement's loads. A dumbbell Romanian deadlift inheriting a
 *   barbell one's anchor is 70 kg on a hinge prescribed for 20.
 *
 * So nothing here reads the source for a spelling. Every assertion runs the
 * real table against the real catalogue, the real library, the real persist
 * migration, the real sync merge and the real progression engine.
 *
 * WHAT IT HOLDS (plan section 5 item 21; Archie's decisions 4 and 5)
 *   1. Every id in the table is a real one, and the survivor is a live record.
 *   2. Each pair is the SAME MOVEMENT, proved through EXERCISE_ALIASES.
 *   3. Nothing chains, nothing merges a Restore drill, nothing merges into a
 *      duplicate of itself.
 *   4. The carry-forward fills an empty survivor and never overwrites a full
 *      one, in all seven per-exercise maps, comfort variants included.
 *   5. A device persisted by the previous version rehydrates with the progress
 *      readable under the surviving id, old keys intact.
 *   6. A stale server payload is normalised the same way on sign-in.
 *   7. The engine actually prescribes off the carried weight.
 *   8. Every library record is shown under exactly one name, and no two
 *      records share one.
 *   9. Every duplicate set pivot-scope 1.4 names BY HAND is accounted for,
 *      each id either merged onto that set's survivor or excluded with a
 *      written reason. Rules 1-3 can only keep a wrong pair out; they cannot
 *      pull a right one in, because rule 2 reads EXERCISE_ALIASES and this
 *      work writes EXERCISE_ALIASES. A duplicate spelled differently enough
 *      that nobody aliased it - "Barbell Bent-Over Row" against "Barbell Row"
 *      - is invisible to every automatic rule there is. So the hand list is
 *      pinned, and forgetting one fails instead of passing quietly.
 *
 * Run:  npx tsx tests/exercise-id-merge.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore } from '../lib/store.ts';
import {
  ID_MERGE,
  MERGED_PROGRESS_FIELDS,
  carryProgressForward,
} from '../lib/exercise-id-merge.ts';
import { getExerciseNameMap, getExerciseCategoryMap } from '../lib/exercise-db.ts';
import { LIBRARY_EXERCISES, CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';
import { canonicalExerciseName, isSameExercise } from '../lib/exercise-aliases.ts';
import { generateWorkout } from '../lib/workout-engine.ts';

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

const templateNames = getExerciseNameMap();
const templateCategories = getExerciseCategoryMap();
const RECORDS = [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES];
const recordById = new Map(RECORDS.map((e) => [e.id, e]));
const pairs = Object.entries(ID_MERGE);

// ─── 1. Both sides of every pair are real ────────────────────────────────────
console.log('\n[1] Every id in the table exists');

const unknownFrom = pairs.filter(([from]) => !templateNames[from]);
check(
  `all ${pairs.length} duplicate ids resolve to an exercise in the catalogue`,
  unknownFrom.length === 0,
  unknownFrom.map(([f]) => f).join(', ') + ' — an id nobody ever logged against carries nothing'
);

const unknownTo = pairs.filter(([, to]) => !recordById.has(to));
check(
  'every survivor is an id a library record actually kept',
  unknownTo.length === 0,
  unknownTo.map(([f, t]) => `${f} -> ${t}`).join(', ') +
    ' — progress copied onto an id nothing serves is progress thrown away'
);

// ─── 2. Same movement, never across implements ───────────────────────────────
console.log('\n[2] Each pair is one movement, not two');

// THE ASSERTION THAT MATTERS MOST. Both sides are read back to a name and the
// names have to agree. A wrong-but-valid pairing - the Plank merged into the
// Goblet Squat, say - would need somebody to have written "Goblet Squat" reads
// as "Plank" into EXERCISE_ALIASES, which nobody would.
const notSameMovement = [];
for (const [from, to] of pairs) {
  const record = recordById.get(to);
  if (!record) continue;
  const oldName = templateNames[from];
  if (!oldName) continue;
  if (canonicalExerciseName(oldName) !== record.name) {
    notSameMovement.push(`${from} "${oldName}" -> ${to} "${record.name}"`);
  }
}
check(
  `all ${pairs.length} pairs read back to the same movement`,
  notSameMovement.length === 0,
  notSameMovement.slice(0, 6).join(' | ') +
    ' — this is the one that would hand somebody another exercise\'s loads'
);

// Said a second way, over the implement words themselves, so a wrong alias and
// a wrong merge cannot agree with each other and both pass.
const IMPLEMENTS = [
  ['barbell', /\bbarbell\b/i],
  ['dumbbell', /\bdumbbells?\b|\bdb\b/i],
  ['kettlebell', /\bkettlebells?\b|\bkb\b/i],
  ['cable', /\bcable\b/i],
  ['band', /\bbands?\b|\bbanded\b/i],
  ['trapbar', /\btrap ?bar\b/i],
  ['landmine', /\blandmine\b/i],
  ['medball', /\bmed ?ball\b/i],
  ['slamball', /\bslam ?ball\b/i],
  ['sled', /\bsled\b/i],
  ['trx', /\btrx\b/i],
];
function implementsIn(name) {
  return IMPLEMENTS.filter(([, re]) => re.test(name)).map(([key]) => key);
}
const crossedImplements = [];
for (const [from, to] of pairs) {
  const a = implementsIn(templateNames[from] ?? '');
  const b = implementsIn(recordById.get(to)?.name ?? '');
  // A qualifier the library adds is fine ("Back Squat" becoming "Barbell Back
  // Squat"). A qualifier SWAPPED for a different one is not.
  const dropped = a.filter((k) => !b.includes(k));
  const gained = b.filter((k) => !a.includes(k));
  if (dropped.length > 0 && gained.length > 0) {
    crossedImplements.push(`${from} (${a.join('+')}) -> ${to} (${b.join('+')})`);
  }
}
check(
  'no pair swaps one implement for another',
  crossedImplements.length === 0,
  crossedImplements.join(' | ') + ' — a dumbbell hinge must not inherit a barbell one'
);

// ─── 3. The shape of the table ───────────────────────────────────────────────
console.log('\n[3] The table cannot fold back on itself');

const survivors = new Set(pairs.map(([, to]) => to));
const chained = pairs.filter(([from]) => survivors.has(from));
check(
  'no duplicate id is also a survivor',
  chained.length === 0,
  chained.map(([f]) => f).join(', ') + ' — a two-step carry would depend on the order it ran in'
);

const selfMerge = pairs.filter(([from, to]) => from === to);
check('nothing merges into itself', selfMerge.length === 0, selfMerge.map(([f]) => f).join(', '));

const isRestore = (id) =>
  id.startsWith('ph-') ||
  id.startsWith('fl-') ||
  id.startsWith('acute-') ||
  templateCategories[id] === 'prehab' ||
  templateCategories[id] === 'cooldown';
const restoreMerged = pairs.filter(([from]) => isRestore(from));
check(
  'no Restore drill is merged into a training record',
  restoreMerged.length === 0,
  restoreMerged.map(([f]) => `${f} ("${templateNames[f]}")`).join(', ') +
    ' — Restore still serves these under its own dose, and a rehab set is not training'
);

const recordIds = new Set(RECORDS.map((e) => e.id));
const stolen = pairs.filter(([from]) => recordIds.has(from));
check(
  'no duplicate id is one a library record is still using',
  stolen.length === 0,
  stolen.map(([f]) => f).join(', ')
);

// Every survivor named here has to be one of the reused ids, never a fresh one:
// a lib- id has no history behind it, so merging onto it would be copying a
// duplicate's loads onto a movement the app has never served.
const freshSurvivor = pairs.filter(([, to]) => to.startsWith('lib-'));
check(
  'no survivor is one of the new lib- records',
  freshSurvivor.length === 0,
  freshSurvivor.map(([f, t]) => `${f} -> ${t}`).join(', ')
);

// ─── 4. The carry-forward itself ─────────────────────────────────────────────
console.log('\n[4] Copied forward, never over the top');

const [DUP, KEPT] = pairs.find(([, to]) => to === 'sq-main-fg') ?? [];
check(
  'the Back Squat duplicate is in the table (the fixtures below use it)',
  DUP === 'wlb-fg-squat' && KEPT === 'sq-main-fg',
  `${DUP} -> ${KEPT}`
);

const filled = carryProgressForward({ [DUP]: 82.5 });
check(
  'an empty survivor is filled from the duplicate',
  filled[KEPT] === 82.5,
  JSON.stringify(filled)
);
check('and the old key is left exactly where it was', filled[DUP] === 82.5, JSON.stringify(filled));

const held = carryProgressForward({ [DUP]: 82.5, [KEPT]: 60 });
check(
  'a survivor that already has an answer is never overwritten',
  held[KEPT] === 60,
  JSON.stringify(held) + ' — somebody who trained both would be told they had got weaker'
);

// A stall count of 0 and a rep note of "" are answers, not absences.
const zero = carryProgressForward({ [DUP]: 3, [KEPT]: 0 });
check(
  'a stored zero counts as an answer and survives',
  zero[KEPT] === 0,
  JSON.stringify(zero) + ' — a falsy test here would deload somebody who had just recovered'
);
const emptyNote = carryProgressForward({ [DUP]: 'reps went up', [KEPT]: '' });
check('so does a stored empty string', emptyNote[KEPT] === '', JSON.stringify(emptyNote));

const twice = carryProgressForward(carryProgressForward({ [DUP]: 82.5 }));
check(
  'running it twice changes nothing',
  twice[KEPT] === 82.5 && Object.keys(twice).length === 2,
  JSON.stringify(twice) + ' — the migration is unconditional, so it will run again'
);

// Two duplicates competing for one empty survivor. Whichever is written first
// in the table wins, both times, so the result never depends on key order.
const glute = pairs.filter(([, to]) => to === 'sq-acc-bw-2').map(([f]) => f);
check('the Glute Bridge has more than one duplicate', glute.length > 1, glute.join(', '));
const contestedA = carryProgressForward(Object.fromEntries(glute.map((id, i) => [id, i + 1])));
const contestedB = carryProgressForward(
  Object.fromEntries([...glute].reverse().map((id, i) => [id, glute.length - i]))
);
check(
  'where two duplicates could both fill it, the first in the table wins either way round',
  contestedA['sq-acc-bw-2'] === 1 && contestedB['sq-acc-bw-2'] === 1,
  `${contestedA['sq-acc-bw-2']} and ${contestedB['sq-acc-bw-2']}`
);

const comfort = carryProgressForward({ [`${DUP}-comfort`]: 45 });
check(
  'a session logged with a sore joint carries over too',
  comfort[`${KEPT}-comfort`] === 45,
  JSON.stringify(comfort) +
    ' — the engine logs those under <id>-comfort, so a month of training with an ache would vanish'
);
check(
  'and a comfort log does not land on the plain id',
  comfort[KEPT] === undefined,
  JSON.stringify(comfort)
);

check(
  'a map with none of these ids in it comes back untouched',
  (() => {
    const before = { 'ph-r-kn-2': 12, 'lib-squat-zercher-squat': 40 };
    return carryProgressForward(before) === before;
  })(),
  'it should not even allocate'
);
check(
  'and a missing map is safe to pass',
  carryProgressForward(undefined) === undefined && carryProgressForward(null) === null,
  'the sync payload leaves fields out on purpose'
);

// ─── 5. A device persisted by the previous version ───────────────────────────
console.log('\n[5] A phone that upgrades gets its weights back');

const STORAGE_KEY = 'grow-app-storage';
async function rehydrateWith(state, version) {
  globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));
  await useAppStore.persist.rehydrate();
  return useAppStore.getState();
}
const shippedVersion = useAppStore.persist.getOptions().version;
check(
  'the persisted schema version was bumped for this change',
  shippedVersion >= 37,
  `version ${shippedVersion}`
);

// Everything a real device would be carrying: a weight, a rep target, a note,
// how the last one went, both streaks, and a thumbs rating - all of it under
// the weekly-pool id, which is where somebody training Lower Body logged it.
const OLD_DEVICE = {
  onboardingComplete: true,
  completedSessions: [],
  earnedBadges: [],
  equipmentTiers: ['fullgym'],
  lastLoggedWeights: { [DUP]: 82.5, 'wub-db-bench': 22.5 },
  exerciseRepTarget: { [DUP]: '7-8' },
  exerciseRepNote: { [DUP]: 'Reps went up after a clean session' },
  lastSessionPerformance: { [DUP]: 'easy' },
  exerciseNormalStreak: { [DUP]: 2 },
  exerciseStuckStreak: { [DUP]: 0 },
  exerciseFeedback: { [DUP]: { thumbs: 'up', multiplier: 1.05 } },
};
const upgraded = await rehydrateWith(OLD_DEVICE, 36);

check(
  'the squat weight is readable under the id the library kept',
  upgraded.lastLoggedWeights[KEPT] === 82.5,
  JSON.stringify(upgraded.lastLoggedWeights)
);
check(
  'and the weekly-pool key is still there',
  upgraded.lastLoggedWeights[DUP] === 82.5,
  'the old engine is still live and still logging against it'
);
check(
  'the bench press carried over as well',
  upgraded.lastLoggedWeights['bn-main-db'] === 22.5,
  JSON.stringify(upgraded.lastLoggedWeights)
);
check(
  'where double progression had got to came with it',
  upgraded.exerciseRepTarget[KEPT] === '7-8',
  JSON.stringify(upgraded.exerciseRepTarget)
);
check(
  'so did the reason the reps last moved',
  upgraded.exerciseRepNote[KEPT] === 'Reps went up after a clean session',
  JSON.stringify(upgraded.exerciseRepNote)
);
check(
  'so did how the last attempt went',
  upgraded.lastSessionPerformance[KEPT] === 'easy',
  JSON.stringify(upgraded.lastSessionPerformance)
);
check(
  'so did the clean-session streak that earns the bigger jump',
  upgraded.exerciseNormalStreak[KEPT] === 2,
  JSON.stringify(upgraded.exerciseNormalStreak)
);
check(
  'so did the stall count that triggers the deload',
  upgraded.exerciseStuckStreak[KEPT] === 0,
  JSON.stringify(upgraded.exerciseStuckStreak)
);
check(
  'so did the thumbs they gave it',
  upgraded.exerciseFeedback[KEPT]?.thumbs === 'up',
  JSON.stringify(upgraded.exerciseFeedback)
);
check(
  `all ${MERGED_PROGRESS_FIELDS.length} per-exercise maps were covered by that fixture`,
  MERGED_PROGRESS_FIELDS.every((f) => OLD_DEVICE[f] && OLD_DEVICE[f][DUP] !== undefined),
  MERGED_PROGRESS_FIELDS.filter((f) => !OLD_DEVICE[f]).join(', ') +
    ' — a map added later and not listed here would go unmigrated and untested'
);

// A device that had trained both keeps the survivor's own answer.
const bothTrained = await rehydrateWith(
  {
    onboardingComplete: true,
    completedSessions: [],
    earnedBadges: [],
    equipmentTiers: ['fullgym'],
    lastLoggedWeights: { [DUP]: 60, [KEPT]: 100 },
  },
  36
);
check(
  'a device that trained both keeps the heavier record it already had',
  bothTrained.lastLoggedWeights[KEPT] === 100,
  JSON.stringify(bothTrained.lastLoggedWeights)
);

// ─── 6. The same thing arriving from the server ──────────────────────────────
console.log('\n[6] Signing in on a new phone does not undo it');

useAppStore.setState({
  completedSessions: [],
  completedCount: 0,
  resetPendingUpload: false,
  lastLoggedWeights: {},
  exerciseRepTarget: {},
  lastSessionPerformance: {},
  exerciseNormalStreak: {},
  exerciseStuckStreak: {},
  exerciseRepNote: {},
  exerciseFeedback: {},
});
// A payload as an older build would have written it: the duplicate key only.
const stalePayload = {
  userProfile: {},
  equipmentTiers: ['fullgym'],
  completedSessions: [{ id: 'srv-1', date: '2026-01-01', type: 'full_body', exercises: [] }],
  oneRepMaxes: [],
  exerciseFeedback: { [DUP]: { thumbs: 'up', multiplier: 1.05 } },
  weightUnit: 'kg',
  testWeekFrequency: 12,
  testWeekDeferred: false,
  cycleStartOffset: 0,
  lastLoggedWeights: { [DUP]: 82.5 },
  lastSessionPerformance: { [DUP]: 'easy' },
  exerciseNormalStreak: { [DUP]: 2 },
  exerciseStuckStreak: { [DUP]: 0 },
  exerciseRepTarget: { [DUP]: '7-8' },
  exerciseRepNote: { [DUP]: 'Reps went up after a clean session' },
  savedTemplates: [],
};
const payloadBefore = JSON.stringify(stalePayload);
useAppStore.getState().mergeServerData(stalePayload);
const synced = useAppStore.getState();
check(
  'a stale server copy arrives normalised, not split',
  synced.lastLoggedWeights[KEPT] === 82.5 && synced.lastLoggedWeights[DUP] === 82.5,
  JSON.stringify(synced.lastLoggedWeights)
);
check(
  'every other per-exercise map from the server is normalised too',
  synced.exerciseRepTarget[KEPT] === '7-8' &&
    synced.exerciseRepNote[KEPT] === 'Reps went up after a clean session' &&
    synced.lastSessionPerformance[KEPT] === 'easy' &&
    synced.exerciseNormalStreak[KEPT] === 2 &&
    synced.exerciseStuckStreak[KEPT] === 0 &&
    synced.exerciseFeedback[KEPT]?.thumbs === 'up',
  'a migration that is not mirrored in mergeServerData is a migration that does not hold'
);
check(
  'and the payload handed in was not mutated underneath its caller',
  JSON.stringify(stalePayload) === payloadBefore,
  'the sync layer reuses that object'
);

// The server's own answer on the survivor still outranks a duplicate's.
useAppStore.setState({ completedSessions: [], completedCount: 0, lastLoggedWeights: {} });
useAppStore.getState().mergeServerData({
  ...stalePayload,
  completedSessions: [
    { id: 'srv-1', date: '2026-01-01', type: 'full_body', exercises: [] },
    { id: 'srv-2', date: '2026-01-02', type: 'full_body', exercises: [] },
  ],
  lastLoggedWeights: { [DUP]: 60, [KEPT]: 100 },
});
check(
  'a server copy that already knows the survivor keeps its own number',
  useAppStore.getState().lastLoggedWeights[KEPT] === 100,
  JSON.stringify(useAppStore.getState().lastLoggedWeights)
);

// ─── 7. The engine prescribes off the carried weight ─────────────────────────
console.log('\n[7] The next session is actually heavier for it');

/**
 * The whole point, run through the real generator rather than inspected.
 *
 * The case is a real one and it is live today: the Lat Pulldown is in the
 * weekly Upper Body pool as `wub-fg-pulldown` and in the bench pool as
 * `bn-acc-fg-4`, which is the id the library record keeps. Somebody who trains
 * Upper Body logs every pulldown against the first of those, and a bench
 * session builds the second. Same person, same history, same session: the only
 * difference below is whether the duplicate was carried forward.
 */
const PULLDOWN_DUP = 'wub-fg-pulldown';
const PULLDOWN_KEPT = 'bn-acc-fg-4';
check(
  'the Lat Pulldown duplicate is in the table',
  ID_MERGE[PULLDOWN_DUP] === PULLDOWN_KEPT,
  `${PULLDOWN_DUP} -> ${ID_MERGE[PULLDOWN_DUP]}`
);
const PROFILE = {
  name: 'T',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['strength'],
  bodyweightKg: 80,
};
const buildBench = (weights) =>
  generateWorkout(
    'bench',
    'fullgym',
    { hasAches: false, energy: 'normal', timeAvailable: '45' },
    PROFILE,
    undefined,
    undefined,
    0,
    weights,
    undefined,
    undefined,
    0
  );
const loadOf = (list, id) => {
  const found = list.find((e) => e.id === id);
  return found ? Math.max(0, ...(found.loadKg ?? [0])) : null;
};
const LOGGED = 70;
const estimate = loadOf(buildBench({}), PULLDOWN_KEPT);
const withoutMerge = loadOf(buildBench({ [PULLDOWN_DUP]: LOGGED }), PULLDOWN_KEPT);
const withMerge = loadOf(
  buildBench(carryProgressForward({ [PULLDOWN_DUP]: LOGGED })),
  PULLDOWN_KEPT
);
check(
  'the session really does build the exercise that kept the id',
  estimate !== null,
  'the worked example needs that exercise on the card'
);
check(
  'without the merge the engine cannot see the 70 kg that was logged',
  withoutMerge === estimate && withoutMerge < LOGGED,
  `it prescribed ${withoutMerge} kg, the same first-timer's estimate as somebody with no history`
);
check(
  'with it, the next pulldown is at least the weight they last pulled',
  withMerge !== null && withMerge >= LOGGED,
  `it prescribed ${withMerge} kg — expected something built on ${LOGGED} kg`
);
check(
  'so the merge changes what the person is actually handed',
  withMerge !== withoutMerge,
  `both came out at ${withMerge} kg`
);

// ─── 8. One record, one name ─────────────────────────────────────────────────
console.log('\n[8] No two records answer to the same name');

// The name half of the same problem: personal bests, the progress chart and the
// recalled note key off the displayed name, so two records sharing one would
// share a personal best. The library lists the Single Leg Romanian Deadlift
// twice on purpose, a dumbbell one and a barbell one, and 8 kg in one hand must
// never be read as the same lift as 40 kg on a bar.
const nameCounts = new Map();
for (const e of RECORDS) nameCounts.set(e.name, [...(nameCounts.get(e.name) ?? []), e.id]);
const sharedNames = [...nameCounts.entries()].filter(([, ids]) => ids.length > 1);
check(
  `all ${RECORDS.length} records have a name of their own`,
  sharedNames.length === 0,
  sharedNames.map(([n, ids]) => `"${n}" <- ${ids.join(', ')}`).join(' | ')
);

const rdls = RECORDS.filter((e) => e.libraryName === 'Single Leg Romanian Deadlift');
check('the document lists that hinge twice', rdls.length === 2, `${rdls.length} records`);
check(
  'and the two are never read as the same movement',
  rdls.length === 2 && !isSameExercise(rdls[0].name, rdls[1].name),
  rdls.map((e) => e.name).join(' / ')
);
check(
  'the dumbbell one is the one the dumbbell history goes to',
  canonicalExerciseName('DB Single-Leg RDL') === recordById.get('dl-acc-db-5')?.name,
  `"${canonicalExerciseName('DB Single-Leg RDL')}"`
);

// ─── 9. The duplicates somebody had to find by hand ──────────────────────────
console.log('\n[9] Every named duplicate set is accounted for');

/**
 * rebuild/reference/pivot-scope.md section 1.4, "The library counts these as
 * one exercise, but the catalogue has duplicates", transcribed into ids.
 *
 * This is the only guard that can catch a duplicate nobody merged. Everything
 * above constrains entries that are already in ID_MERGE; a set left out of the
 * table entirely is invisible to all of it, and a reviewer found four missing
 * that way. So each id the scope names is written down here with a verdict:
 *
 *   merged   - must be in ID_MERGE, pointing at this set's survivor
 *   excluded - must NOT be in ID_MERGE, and must say why in one sentence
 *
 * Dropping a line from ID_MERGE now fails. Adding a new catalogue template
 * under one of these names and forgetting it also fails, because the last
 * assertion sweeps the real catalogue for every id sharing a name with the set.
 */
const PIVOT_SCOPE_1_4 = [
  {
    set: 'the bent-over dumbbell row',
    survivor: 'dl-acc-db-2',
    merged: ['cond-db-e-4a', 'wub-db-row', 'wfb-db-row', 'ch-standing-dumbbell-row'],
    excluded: {},
  },
  {
    set: 'the barbell row',
    survivor: 'wub-fg-row',
    merged: ['wfb-fg-row', 'bn-acc-fg-1'],
    excluded: {},
  },
  {
    set: 'the band pull-apart',
    survivor: 'bn-mech-bw-1',
    merged: ['bn-mech-db-1', 'bn-mech-fg-1', 'dl-acc-bw-6'],
    excluded: {
      'bn-prep-fg-3': 'prescription variant: a warm-up dose, and a warm-up rep target is not a working set\'s',
      'bn-pwr-mech-bw-1': 'prescription variant: the same band pulled apart fast, for a different job',
      'bn-pwr-mech-db-1': 'prescription variant: the same band pulled apart fast, for a different job',
      'bn-pwr-mech-fg-1': 'prescription variant: the same band pulled apart fast, for a different job',
      'ph-s-4': 'Restore: served under its own dose, and a rehab set is not training',
      'ph-r-rs-1': 'Restore: served under its own dose, and a rehab set is not training',
      'ph-r-fs-3': 'Restore: served under its own dose, and a rehab set is not training',
      'ph-r-ub-1': 'Restore: served under its own dose, and a rehab set is not training',
      'ph-r-ch-4': 'Restore: served under its own dose, and a rehab set is not training',
      'ph-r-lm-3': 'Restore: served under its own dose, and a rehab set is not training',
    },
  },
  {
    set: 'the cable face pull',
    survivor: 'dl-acc-fg-9',
    merged: ['bn-mech-fg-2'],
    excluded: {},
  },
  {
    set: 'the lateral lunge',
    survivor: 'sq-acc-bw-10',
    merged: ['wlb-bw-lateral-lunge'],
    excluded: {
      'sq-acc-db-10':
        'a different implement: the dumbbell lateral lunge is loaded, and 8-14 kg per hand is not a bodyweight anchor',
    },
  },
  {
    set: 'the dumbbell Bulgarian split squat',
    survivor: 'sq-acc-db-1',
    merged: ['wlb-db-split'],
    excluded: {},
  },
  {
    set: 'the squat jump',
    survivor: 'sq-neuro-bw',
    merged: ['sq-neuro-db-2', 'gcond-bw-n-2'],
    excluded: {},
  },
];

for (const { set, survivor, merged, excluded } of PIVOT_SCOPE_1_4) {
  const named = [survivor, ...merged, ...Object.keys(excluded)];
  const ghosts = named.filter((id) => !templateNames[id]);
  check(
    `${set}: all ${named.length} ids the scope names are real catalogue ids`,
    ghosts.length === 0,
    ghosts.join(', ') + ' — an id that has drifted pins nothing'
  );
  check(
    `${set}: the survivor "${templateNames[survivor] ?? survivor}" is a live library record`,
    recordById.has(survivor),
    `${survivor} — progress copied onto an id nothing serves is progress thrown away`
  );

  const notMerged = merged.filter((id) => ID_MERGE[id] !== survivor);
  check(
    `${set}: every named duplicate (${merged.length}) carries forward onto it`,
    notMerged.length === 0,
    notMerged.map((id) => `${id} ("${templateNames[id]}") -> ${ID_MERGE[id] ?? 'nothing'}`).join(', ') +
      ' — this is the one that catches a duplicate nobody merged'
  );

  const excludedIds = Object.keys(excluded);
  if (excludedIds.length > 0) {
    const contradicted = excludedIds.filter((id) => ID_MERGE[id]);
    check(
      `${set}: everything it leaves out (${excludedIds.length}) really is left out`,
      contradicted.length === 0,
      contradicted.join(', ') + ' — listed as excluded and merged at the same time'
    );
    const unexplained = excludedIds.filter((id) => !excluded[id] || excluded[id].length < 20);
    check(
      `${set}: and each one says why`,
      unexplained.length === 0,
      unexplained.join(', ') + ' — an exclusion without a reason is an omission'
    );
  }

  // The catalogue swept for anything else sharing one of these names. A new
  // template added under "Squat Jump" tomorrow lands here rather than nowhere.
  const setNames = new Set(named.map((id) => templateNames[id]).filter(Boolean));
  const accounted = new Set(named);
  const strays = Object.entries(templateNames)
    .filter(([id, name]) => setNames.has(name) && !accounted.has(id))
    .map(([id, name]) => `${id} ("${name}")`);
  check(
    `${set}: no other catalogue id answers to any of its names`,
    strays.length === 0,
    strays.join(', ') + ' — a duplicate that arrived after this list was written'
  );
}

// Said once more as behaviour rather than membership: a weight logged against
// any named duplicate has to come out readable under that set's survivor. The
// loop above would still pass if ID_MERGE were a table nothing ever consulted.
const notCarried = [];
for (const { survivor, merged } of PIVOT_SCOPE_1_4) {
  for (const id of merged) {
    if (carryProgressForward({ [id]: 42 })[survivor] !== 42) notCarried.push(`${id} -> ${survivor}`);
  }
}
check(
  `a weight logged against any of the ${PIVOT_SCOPE_1_4.reduce((n, s) => n + s.merged.length, 0)} named duplicates reads back under its survivor`,
  notCarried.length === 0,
  notCarried.join(', ')
);

/**
 * THE HEADLINE CASE, WORKED RIGHT THROUGH THE WAY THE PULLDOWN IS ABOVE.
 *
 * The old bench pool built "Barbell Bent-Over Row" as an accessory under
 * `bn-acc-fg-1`, so somebody who only ever trained bench days has every row
 * they have done under that id. The library keeps `wub-fg-row` for the record
 * that serves it, and now that Upper Body is built from the library, the id on
 * the card is the survivor rather than the duplicate. That is exactly the
 * change this table exists for, so the check asks for it that way round: the
 * session has to build the row under the id the library kept, and the weight it
 * prescribes has to be the one the person actually lifted.
 *
 * The Barbell Row is a level 3 record, so the lifter here is an advanced one
 * with a barbell. A beginner is not given it at all, which is the ceiling doing
 * its job rather than a duplicate going missing.
 */
const ROW_DUP = 'bn-acc-fg-1';
const ROW_KEPT = 'wub-fg-row';
const ROW_LOGGED = 65;
const ADVANCED = { ...PROFILE, experienceLevel: 'advanced' };
const buildAdvancedBench = (weights) =>
  generateWorkout(
    'bench',
    'fullgym',
    { hasAches: false, energy: 'normal', timeAvailable: '60' },
    ADVANCED,
    undefined,
    undefined,
    0,
    weights,
    undefined,
    undefined,
    0
  );
const rowEstimate = loadOf(buildAdvancedBench({}), ROW_KEPT);
const rowWithoutMerge = loadOf(buildAdvancedBench({ [ROW_DUP]: ROW_LOGGED }), ROW_KEPT);
const rowWithMerge = loadOf(
  buildAdvancedBench(carryProgressForward({ [ROW_DUP]: ROW_LOGGED })),
  ROW_KEPT
);
check(
  'an upper body session really does build the barbell row, under the id the library kept',
  rowEstimate !== null,
  'if the engine stopped serving it, this worked example stops meaning anything'
);
check(
  'and a bench-day row history is readable under that id',
  carryProgressForward({ [ROW_DUP]: ROW_LOGGED })[ROW_KEPT] === ROW_LOGGED,
  `${ROW_DUP} -> ${ID_MERGE[ROW_DUP] ?? 'nothing'} — without it those rows are orphaned`
);
check(
  'without the merge the engine cannot see the 65 kg of bench-day rows',
  rowWithoutMerge === rowEstimate && rowWithoutMerge < ROW_LOGGED,
  `it prescribed ${rowWithoutMerge} kg, the same first-timer's estimate as somebody with no history`
);
check(
  'with it, the next row is at least the weight they last rowed',
  rowWithMerge !== null && rowWithMerge >= ROW_LOGGED,
  `it prescribed ${rowWithMerge} kg — expected something built on ${ROW_LOGGED} kg`
);

// The last line of scope 1.4: the library document itself listed Squat Jump
// twice, under Squat and again as "Squat Jumps" under Lunge. One record is the
// right answer; two would have split the chart the same way a missed duplicate
// does.
const squatJumpRecords = RECORDS.filter((e) => /^squat jumps?$/i.test(e.libraryName ?? e.name));
check(
  'the document\'s own double listing of the Squat Jump became one record',
  squatJumpRecords.length === 1,
  squatJumpRecords.map((e) => `${e.id} "${e.name}"`).join(', ')
);

console.log('');
if (failures > 0) {
  console.error(`exercise-id-merge: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`exercise-id-merge: all ${total} checks passed\n`);
  process.exitCode = 0;
}
