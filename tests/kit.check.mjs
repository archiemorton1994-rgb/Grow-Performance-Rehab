/**
 * Contract test: the equipment question and the library's kit lists agree.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Onboarding asks a coarse question — five tiles — and the library answers a
 * fine one: this exercise needs a barbell, and either a landmine attachment or
 * a corner to wedge it into. lib/kit.ts is the translation between them, and
 * every way it can be wrong is silent. Say a corner is gym kit and the home
 * landmine work disappears with no error. Say a door frame is gym kit and the
 * only no-equipment pull in the library disappears with it. Let a dumbbell
 * stand in for a kettlebell one exercise too far and somebody is handed a
 * Kettlebell Swing with a dumbbell, which is a different movement with a worse
 * wrist position.
 *
 * So nothing here reads the source for a spelling. Every assertion runs the
 * real matcher against the real records, the real store, the real sync payload
 * and the real persist migration.
 *
 * WHAT IT HOLDS (plan section 5 item 18; Archie's decisions 5 and 6)
 *   1. What each of the answers supplies, and what only a full gym does.
 *   2. The three things everybody owns: a corner, a block and a door frame.
 *   3. "Bench, box or sturdy step" satisfies every Box (or Bench) row.
 *   4. A landmine exercise needs the barbell, never the attachment.
 *   5. A full gym can do every exercise in the library.
 *   6. A bench is never the tier a session is drawn at, in all three places
 *      that work one out.
 *   7. Decision 5, exactly: a dumbbell does the kettlebell's job on the
 *      deadlifts, goblet squats, lunges, carries and marches, and nowhere
 *      else.
 *   8. The 'bench' answer survives being stored, synced, merged back and
 *      migrated, and survives a picker that rewrites the whole selection.
 *
 * Run:  npx tsx tests/kit.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore, TIER_ORDER } from '../lib/store.ts';
import { toggleTier } from '../lib/sign-up.ts';
import { getEffectiveTier } from '../lib/workout-engine.ts';
import { getMainLift, getAccessories } from '../lib/exercise-db.ts';
import { LIBRARY_EXERCISES, CONDITIONING_EXERCISES, KIT_KEYS } from '../lib/exercise-library.ts';
import {
  ALWAYS_OWNED_KIT,
  DUMBBELL_FOR_KETTLEBELL,
  KIT_BY_TIER,
  SUPPLY_TIERS,
  canPerformWith,
  isSupplyTier,
  ownedKitKeys,
  withKeptSupplies,
} from '../lib/kit.ts';

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

const byName = new Map(LIBRARY_EXERCISES.map((e) => [e.libraryName, e]));
function record(name) {
  const found = byName.get(name);
  if (!found) throw new Error(`no library record called "${name}"`);
  return found;
}
const conditioning = new Map(CONDITIONING_EXERCISES.map((e) => [e.libraryName, e]));

/** Every answer somebody at home could give, short of the one being tested. */
const HOME = ['bodyweight', 'bands', 'dumbbells', 'kettlebells'];
const HOME_WITH_BENCH = [...HOME, 'bench'];
const sorted = (list) => [...list].sort().join(' | ');

// ─── 1. What each answer supplies ────────────────────────────────────────────
console.log('\n[1] What each answer on the equipment question supplies');

check(
  'no equipment supplies no equipment',
  KIT_BY_TIER.bodyweight.length === 0,
  `it supplies ${JSON.stringify(KIT_BY_TIER.bodyweight)}; the three keys everybody owns are added separately`
);
check('bands own a band', ownedKitKeys(['bands']).has('band'));
check('dumbbells own a dumbbell', ownedKitKeys(['dumbbells']).has('dumbbell'));
check('kettlebells own a kettlebell', ownedKitKeys(['kettlebells']).has('kettlebell'));
check(
  'owning dumbbells does not hand somebody a kettlebell',
  !ownedKitKeys(['dumbbells']).has('kettlebell'),
  'decision 5 is a ruling about named exercises, not a swap of the keys themselves'
);
check(
  'owning kettlebells does not hand somebody a dumbbell',
  !ownedKitKeys(['kettlebells']).has('dumbbell')
);

/**
 * Decision 6, in the owner's words: "TRX, pull-up bar, medicine ball and ab
 * wheel count as gym kit." The plan's item 18 lists the rest of the same
 * shelf. None of them may reach a home answer.
 */
const GYM_ONLY = [
  'trx',
  'pullupbar',
  'medball',
  'slamball',
  'abwheel',
  'cable',
  'latpulldown',
  'landmine',
  'trapbar',
  'rack',
  'barbell',
  'plates',
  'sled',
  'assaultbike',
  'treadmill',
  'rower',
];
const atHome = ownedKitKeys(HOME_WITH_BENCH);
const leaked = GYM_ONLY.filter((key) => atHome.has(key));
check(
  'gym kit comes only with a full gym',
  leaked.length === 0,
  `${leaked.join(', ')} reached somebody who did not tick a full gym`
);
const missingFromGym = GYM_ONLY.filter((key) => !ownedKitKeys(['fullgym']).has(key));
check(
  'and a full gym has all of it',
  missingFromGym.length === 0,
  `a full gym was short of ${missingFromGym.join(', ')}`
);

// ─── 2. The three things everybody owns ──────────────────────────────────────
console.log('\n[2] A corner, a block and a door frame are never a reason to say no');

const withNothing = ownedKitKeys([]);
check(
  'somebody who ticked nothing still owns a corner, a block and a door frame',
  ALWAYS_OWNED_KIT.every((k) => withNothing.has(k)) && ALWAYS_OWNED_KIT.length === 3,
  `they own ${sorted([...withNothing])}`
);
check(
  'and owns nothing else',
  [...withNothing].every((k) => ALWAYS_OWNED_KIT.includes(k)),
  `they own ${sorted([...withNothing])}`
);

check(
  'Door Frame Rows can be done with no equipment at all',
  canPerformWith(record('Door Frame Rows'), ['bodyweight']),
  'decision 4 added it as THE no-equipment pull; without it a home user has no pulling exercise'
);
check(
  'and with nothing ticked at all',
  canPerformWith(record('Door Frame Rows'), []),
  'the door frame must not depend on which tile was picked'
);
check(
  'Duck Walks, Skipping and Bear Crawl need no kit either',
  ['Duck Walks', 'Skipping', 'Bear Crawl'].every((n) =>
    canPerformWith(conditioning.get(n), ['bodyweight'])
  ),
  'decision 7: skipping is with a rope OR on the spot, so the rope can never withhold it'
);
check(
  'the sled, the bike, the treadmill and the rower still need the machine',
  ['Sled Push', 'Sled Pull', 'Sled Rows', 'Assault Bike', 'Incline Treadmill Walk', 'Rowing Machine']
    .map((n) => conditioning.get(n))
    .every((e) => !canPerformWith(e, HOME_WITH_BENCH) && canPerformWith(e, ['fullgym'])),
  'a home user cannot be handed a sled push'
);

// ─── 3. The bench ────────────────────────────────────────────────────────────
console.log('\n[3] "Bench, box or sturdy step" supplies a bench, a box and a block');

const benchKeys = ownedKitKeys(['bench']);
check(
  'the one tick supplies all three',
  ['bench', 'box', 'blocks'].every((k) => benchKeys.has(k)),
  `it supplies ${sorted([...benchKeys])}`
);

const boxRows = LIBRARY_EXERCISES.filter((e) =>
  e.kit.some((g) => g.includes('box') || g.includes('bench'))
);
const unsatisfied = boxRows.filter(
  (e) =>
    !e.kit
      .filter((g) => g.includes('box') || g.includes('bench'))
      .every((g) => g.some((k) => benchKeys.has(k)))
);
check(
  `every Box (or Bench) row in the library is satisfied by it (${boxRows.length} rows)`,
  unsatisfied.length === 0,
  unsatisfied.map((e) => e.libraryName).join(', ')
);

check(
  'Box Squats are on for somebody with a bench and off for somebody without',
  canPerformWith(record('Box Squats'), ['bodyweight', 'bench']) &&
    !canPerformWith(record('Box Squats'), ['bodyweight']),
  'the whole point of the new answer is that it turns this row on'
);
check(
  'Bench Press Ups too',
  canPerformWith(record('Bench Press Ups'), ['bench']) &&
    !canPerformWith(record('Bench Press Ups'), ['bodyweight'])
);
check(
  'a bench alone does not unlock the dumbbell bench press',
  !canPerformWith(record('Dumbbell Bench Press'), ['bench']) &&
    canPerformWith(record('Dumbbell Bench Press'), ['dumbbells', 'bench']),
  'both halves of an AND have to be met'
);
check(
  'a deficit can be stood on a block, which everybody has',
  canPerformWith(record('Deficit Kettlebell Deadlift'), ['kettlebells']),
  'its second requirement is plates OR a block, and a block is always owned'
);

// ─── 4. Landmine ─────────────────────────────────────────────────────────────
console.log('\n[4] A landmine exercise needs the barbell, never the attachment');

const landmines = LIBRARY_EXERCISES.filter((e) => e.kit.some((g) => g.includes('landmine')));
check('the library has landmine rows to judge', landmines.length === 7, `found ${landmines.length}`);

const attachmentBlocked = landmines.filter(
  (e) =>
    !e.kit.filter((g) => g.includes('landmine')).every((g) => g.some((k) => withNothing.has(k)))
);
check(
  'the attachment requirement is met by the corner everybody has',
  attachmentBlocked.length === 0,
  attachmentBlocked.map((e) => e.libraryName).join(', ')
);
const noBar = landmines.filter((e) => !e.kit.some((g) => g.length === 1 && g[0] === 'barbell'));
check(
  'and every one of them still demands the bar on its own',
  noBar.length === 0,
  noBar.map((e) => e.libraryName).join(', ')
);
check(
  'so a home user gets no landmine work',
  landmines.every((e) => !canPerformWith(e, HOME_WITH_BENCH)),
  landmines
    .filter((e) => canPerformWith(e, HOME_WITH_BENCH))
    .map((e) => e.libraryName)
    .join(', ')
);
check(
  'and a full gym gets all of it, attachment or corner',
  landmines.every((e) => canPerformWith(e, ['fullgym']))
);

// ─── 5. A full gym can do everything ─────────────────────────────────────────
console.log('\n[5] A full gym owns every key in the library');

const keysMissing = KIT_KEYS.filter((k) => !ownedKitKeys(['fullgym']).has(k));
check(
  `a full gym owns all ${KIT_KEYS.length} kit keys`,
  keysMissing.length === 0,
  keysMissing.join(', ')
);
const gymCannot = LIBRARY_EXERCISES.filter((e) => !canPerformWith(e, ['fullgym']));
check(
  `and can perform all ${LIBRARY_EXERCISES.length} library exercises`,
  gymCannot.length === 0,
  gymCannot.map((e) => e.libraryName).join(', ')
);
const gymCannotCondition = CONDITIONING_EXERCISES.filter((e) => !canPerformWith(e, ['fullgym']));
check(
  `and all ${CONDITIONING_EXERCISES.length} conditioning exercises`,
  gymCannotCondition.length === 0,
  gymCannotCondition.map((e) => e.libraryName).join(', ')
);

// ─── 6. A bench is never the tier a session is drawn at ──────────────────────
console.log('\n[6] A bench is kit, not a rung on the ladder');

check('the supply tiers are exactly the bench', sorted(SUPPLY_TIERS) === 'bench');
check('and none of the five rungs is one', TIER_ORDER.every((t) => !isSupplyTier(t)));
check('TIER_ORDER, the list every picker shows, still has five rungs', TIER_ORDER.length === 5);
check('and does not offer a bench', !TIER_ORDER.includes('bench'));

/**
 * Three separate pieces of code work out which tier a session is drawn at: the
 * store's getEffectiveTier, the workout engine's, and the exercise database's
 * own. All three are put through these cases, because a bench that slipped
 * past any one of them would hand somebody a gym session.
 */
const effectiveCases = [
  [['bench'], 'bodyweight'],
  [['bodyweight', 'bench'], 'bodyweight'],
  [['bands', 'bench'], 'bands'],
  [['dumbbells', 'bench'], 'dumbbells'],
  [['bench', 'kettlebells'], 'kettlebells'],
  [['bench', 'fullgym'], 'fullgym'],
];
const engineWrong = effectiveCases.filter(([tiers, want]) => getEffectiveTier(tiers) !== want);
check(
  'the workout engine never picks it',
  engineWrong.length === 0,
  engineWrong.map(([t, w]) => `${t.join('+')} wanted ${w} got ${getEffectiveTier(t)}`).join(' | ')
);

const storeWrong = [];
for (const [tiers, want] of effectiveCases) {
  useAppStore.setState({ equipmentTiers: [...tiers] });
  const got = useAppStore.getState().getEffectiveTier();
  if (got !== want) storeWrong.push(`${tiers.join('+')} wanted ${want} got ${got}`);
}
check('the store never picks it', storeWrong.length === 0, storeWrong.join(' | '));

useAppStore.setState({ equipmentTiers: ['bench'] });
check(
  'and a bench-only profile trains at the bodyweight tier inside the app',
  useAppStore.getState().getInternalTier() === 'bodyweight',
  `it came out ${useAppStore.getState().getInternalTier()}`
);

check(
  'the exercise database draws the same pool with a bench as without',
  getMainLift('squat', ['dumbbells', 'bench']).name === getMainLift('squat', ['dumbbells']).name &&
    getMainLift('squat', ['bench']).name === getMainLift('squat', ['bodyweight']).name,
  `bench+dumbbells gave ${getMainLift('squat', ['dumbbells', 'bench']).name}, dumbbells alone gave ${getMainLift('squat', ['dumbbells']).name}`
);
check(
  'and the same accessories',
  sorted(getAccessories('squat', ['dumbbells', 'bench']).map((t) => t.name)) ===
    sorted(getAccessories('squat', ['dumbbells']).map((t) => t.name))
);
check(
  'a bench-only profile can still do bodyweight work',
  getMainLift('squat', ['bench']).name.length > 0 &&
    getAccessories('squat', ['bench']).length ===
      getAccessories('squat', ['bodyweight']).length,
  'the old equipment table must count a bench owner as able to do bodyweight exercises'
);

// ─── 7. Decision 5, exactly ──────────────────────────────────────────────────
console.log('\n[7] Where a dumbbell may do a kettlebell\'s job');

const unknownNames = DUMBBELL_FOR_KETTLEBELL.filter((n) => !byName.has(n));
check(
  'every exercise the ruling names is a real library exercise',
  unknownNames.length === 0,
  `${unknownNames.join(', ')} — a name that matches nothing would silently do nothing`
);

/**
 * The rows that genuinely demand a kettlebell: ones where the document did not
 * already write "or". The rows that did are satisfied without any ruling and
 * are checked separately below.
 */
const kettlebellOnly = LIBRARY_EXERCISES.filter((e) =>
  e.kit.some((g) => g.includes('kettlebell') && !g.includes('dumbbell'))
);
check(
  'the library has 14 rows that ask for a kettlebell and name no alternative',
  kettlebellOnly.length === 14,
  `found ${kettlebellOnly.length}: ${kettlebellOnly.map((e) => e.libraryName).join(', ')}`
);

/**
 * A home user with dumbbells, bands and a bench, and no kettlebell. Bands and
 * the bench are there so that nothing ELSE in a row can be the reason it
 * fails: the kettlebell is the only thing missing.
 */
const NO_KETTLEBELL = ['bodyweight', 'bands', 'dumbbells', 'bench'];
const servedByDumbbell = kettlebellOnly
  .filter((e) => canPerformWith(e, NO_KETTLEBELL))
  .map((e) => e.libraryName);

const EXPECTED = [
  'Kettlebell Deadlift',
  'Kettlebell Romanian Deadlift',
  'Deficit Kettlebell Deadlift',
  'Kettlebell Goblet Squats',
  'Kettlebell Side Lunge',
  'Kettlebell Reverse Lunges',
  'Kettlebell Curtsy Lunge',
  'Kettlebell Box Step Over',
  'Kettlebell Suitcase Carry',
  'Kettlebell Farmers Carry',
  'Kettlebell Marches',
];
check(
  'a dumbbell serves the deadlifts, goblet squats, lunges, carries and marches, and only those',
  sorted(servedByDumbbell) === sorted(EXPECTED),
  `got ${sorted(servedByDumbbell)}\n      wanted ${sorted(EXPECTED)}`
);

const MUST_REFUSE = ['Kettlebell Swings', 'Kettlebell Halos', 'Earthquake Carry'];
for (const name of MUST_REFUSE) {
  check(
    `${name} is not offered to somebody holding a dumbbell`,
    // The same person, with a kettlebell added, gets it — so the kettlebell is
    // demonstrably the thing standing in the way and nothing else is.
    !canPerformWith(record(name), NO_KETTLEBELL) &&
      canPerformWith(record(name), [...NO_KETTLEBELL, 'kettlebells']),
    'it is a different movement with a dumbbell, and the owner did not rule for it'
  );
}

check(
  "the document's own \"or\" rows need no ruling",
  ['Gorilla Rows', 'Split Stance Romanian Deadlift', 'Waiter Carry', 'Kettlebell Box Squats'].every(
    (n) => canPerformWith(record(n), NO_KETTLEBELL)
  ),
  'these say "or" in the library itself, so their kit already names both implements'
);
check(
  'and a kettlebell owner with no dumbbell still gets them',
  ['Gorilla Rows', 'Split Stance Romanian Deadlift', 'Waiter Carry'].every((n) =>
    canPerformWith(record(n), ['bodyweight', 'kettlebells'])
  )
);
check(
  'the ruling changes nothing for somebody with no weights at all',
  EXPECTED.every((n) => !canPerformWith(record(n), ['bodyweight', 'bench'])),
  'a ruling about which implement is not a licence to do it empty-handed'
);

// ─── 8. The bench answer survives being stored, synced and migrated ──────────
console.log('\n[8] The bench answer round-trips');

useAppStore.setState({
  equipmentTiers: ['bodyweight', 'dumbbells', 'bench'],
  completedSessions: [],
  completedCount: 0,
  resetPendingUpload: false,
});
useAppStore.getState().setEquipmentTiers(['bodyweight', 'dumbbells', 'bench']);
check(
  'the store keeps it when it is set',
  useAppStore.getState().equipmentTiers.includes('bench'),
  JSON.stringify(useAppStore.getState().equipmentTiers)
);

const payload = useAppStore.getState().getDataForSync();
check(
  'it travels in the sync payload',
  (payload.equipmentTiers ?? []).includes('bench'),
  JSON.stringify(payload.equipmentTiers)
);

useAppStore.setState({
  equipmentTiers: ['bodyweight'],
  completedSessions: [],
  completedCount: 0,
});
useAppStore.getState().mergeServerData({
  ...payload,
  // One session on the server and none here, so this is the branch that adopts
  // the server's view of the profile.
  completedSessions: [{ id: 'srv-1', date: '2026-01-01', type: 'full_body', exercises: [] }],
});
check(
  'and comes back off the server onto a device that had lost it',
  useAppStore.getState().equipmentTiers.includes('bench'),
  JSON.stringify(useAppStore.getState().equipmentTiers)
);

const STORAGE_KEY = 'grow-app-storage';
async function rehydrateWith(state, version) {
  globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));
  await useAppStore.persist.rehydrate();
  return useAppStore.getState().equipmentTiers;
}
const shippedVersion = useAppStore.persist.getOptions().version;
const migrated = await rehydrateWith(
  {
    onboardingComplete: true,
    completedSessions: [],
    earnedBadges: [],
    equipmentTiers: ['bodyweight', 'bench'],
  },
  shippedVersion
);
check(
  'a persisted profile holding it rehydrates with it intact',
  migrated.includes('bench') && migrated.includes('bodyweight'),
  JSON.stringify(migrated)
);
const oldMigrated = await rehydrateWith(
  {
    onboardingComplete: true,
    completedSessions: [],
    earnedBadges: [],
    equipmentTiers: ['barbell', 'bench'],
  },
  20
);
check(
  'and an old blob still has its barbell rewritten without losing the bench',
  oldMigrated.includes('fullgym') && oldMigrated.includes('bench'),
  JSON.stringify(oldMigrated)
);

check(
  'ticking full gym in a picker does not throw the bench away',
  withKeptSupplies(TIER_ORDER, ['bodyweight', 'bench']).includes('bench') &&
    toggleTier(['bodyweight', 'bench'], 'fullgym', 'intermediate').includes('bench'),
  JSON.stringify(toggleTier(['bodyweight', 'bench'], 'fullgym', 'intermediate'))
);
check(
  'and unticking it leaves the bench behind',
  toggleTier(
    toggleTier(['bodyweight', 'bench'], 'fullgym', 'intermediate'),
    'fullgym',
    'intermediate'
  ).includes('bench')
);
check(
  'a picker that already has the bench does not gain a second one',
  withKeptSupplies(['bench', 'dumbbells'], ['bench']).filter((t) => t === 'bench').length === 1,
  JSON.stringify(withKeptSupplies(['bench', 'dumbbells'], ['bench']))
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failed > 0) {
  console.error(`kit: ${failed} of ${passed + failed} checks FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`kit: all ${passed} checks passed\n`);
  process.exitCode = 0;
}
