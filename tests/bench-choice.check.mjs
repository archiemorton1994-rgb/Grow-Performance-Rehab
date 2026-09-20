/**
 * Contract test: "Bench, box or sturdy step" is offered, kept, and used.
 *
 * WHAT THIS GUARDS
 * ────────────────
 * Archie's sixth decision adds a sixth answer to the equipment question, and it
 * is the one that unlocks the most work for somebody training at home: every
 * step-up, step-down, box squat, split squat, hip thrust and bench press in the
 * library needs something to put a foot or a back on. The plumbing for it went
 * in two phases ago - the kit keys, the supply tier, the label, the icon - and
 * nothing offered it, so nobody had one.
 *
 * Offering it is not one change but four, and each one is a section below.
 *
 *   IT IS ON EVERY PICKER. Six screens ask this question. A tile added to one
 *   of them is a bench somebody can tick on Monday and not on Tuesday.
 *
 *   IT IS NOT A RUNG. It supplies kit and says nothing about how well equipped
 *   somebody is, so ticking it must not make the app think they have more, and
 *   unticking it must not take their gym away - which is exactly what the old
 *   hand-written toggle rules would have done, because they all answered "they
 *   have taken something off, so this is not a full gym".
 *
 *   IT CANNOT BE THE WHOLE ANSWER. A person who ticks only the bench has told
 *   us what they can stand on and nothing about what they can lift.
 *
 *   IT REACHES THE SESSION. A tick that does not change which exercises come
 *   back is a tick that changed nothing.
 *
 * HOW IT TESTS
 * ────────────
 * By running the real rules and the real library. The tile lists are data with
 * no React in them for exactly this reason: a check that matched a regular
 * expression over a screen would pass on the comment that mentions a bench.
 *
 * Run:  npx tsx tests/bench-choice.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore, TIER_ORDER } from '../lib/store.ts';
import { PICKER_TIERS, hasRung, toggleEquipment } from '../lib/equipment-picker.ts';
import { SUPPLY_TIERS, canPerformWith, ownedKitKeys } from '../lib/kit.ts';
import { EQUIPMENT_TILES, canContinue, toggleTier } from '../lib/sign-up.ts';
import { LIBRARY_EXERCISES } from '../lib/exercise-library.ts';
import { getEffectiveTier, getEquipmentLabel } from '../lib/workout-engine.ts';

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

const S = () => useAppStore.getState();
const FRESH = JSON.parse(JSON.stringify(S()));
const freshAccount = (patch = {}) => useAppStore.setState({ ...FRESH, ...patch });

// ─── 1. It is on the list every picker draws ─────────────────────────────────
console.log('\n[1] The tile exists, on one list');

check(
  'the bench is offered',
  PICKER_TIERS.includes('bench'),
  `tiles are ${PICKER_TIERS.join(', ')}`
);
check(
  'every rung of the ladder is still offered, in its own order',
  PICKER_TIERS.slice(0, TIER_ORDER.length).join(',') === TIER_ORDER.join(','),
  PICKER_TIERS.join(',')
);
check(
  'and every supply is on it, so a second one cannot be forgotten',
  SUPPLY_TIERS.every((t) => PICKER_TIERS.includes(t)),
  SUPPLY_TIERS.join(',')
);
check(
  'the tile has a name to draw',
  getEquipmentLabel('bench').length > 0 && getEquipmentLabel('bench') !== 'bench',
  getEquipmentLabel('bench')
);
check(
  'the sign-up pager offers the bench too, in the same order as the sheets',
  EQUIPMENT_TILES.map((t) => t.value).join(',') === PICKER_TIERS.join(','),
  `${EQUIPMENT_TILES.map((t) => t.value).join(',')} against ${PICKER_TIERS.join(',')}`
);
check(
  'and every tile there says what it is',
  EQUIPMENT_TILES.every((t) => t.label.trim().length > 0 && t.description.trim().length > 0),
  EQUIPMENT_TILES.filter((t) => !t.label.trim() || !t.description.trim())
    .map((t) => t.value)
    .join(', ')
);
check(
  'the bench tile names all three things it can be',
  (() => {
    const tile = EQUIPMENT_TILES.find((t) => t.value === 'bench');
    const words = `${tile.label} ${tile.description}`.toLowerCase();
    return ['bench', 'box', 'step'].every((w) => words.includes(w));
  })(),
  // Decision 6 is one tick covering a bench, a box and a block, so somebody
  // with only a garden step has to recognise themselves in the tile.
  JSON.stringify(EQUIPMENT_TILES.find((t) => t.value === 'bench'))
);

// ─── 2. It is kit, not a rung ────────────────────────────────────────────────
console.log('\n[2] Ticking it says nothing about how well equipped somebody is');

check(
  'a bench never becomes the tier a session is drawn from',
  getEffectiveTier(['bodyweight', 'bench']) === 'bodyweight' &&
    getEffectiveTier(['dumbbells', 'bench']) === 'dumbbells',
  `${getEffectiveTier(['bodyweight', 'bench'])} / ${getEffectiveTier(['dumbbells', 'bench'])}`
);
check(
  'ticking it leaves the full gym ticked',
  toggleEquipment(['fullgym'], 'bench').includes('fullgym'),
  toggleEquipment(['fullgym'], 'bench').join(',')
);
check(
  'and UNTICKING it leaves the full gym ticked',
  toggleEquipment(['fullgym', 'bench'], 'bench').join(',') === 'fullgym',
  `${toggleEquipment(['fullgym', 'bench'], 'bench').join(',')} - every hand-written copy of this rule dropped the gym alongside whatever came off`
);
check(
  'unticking a rung leaves the bench alone',
  toggleEquipment(['dumbbells', 'bands', 'bench'], 'bands').join(',') === 'dumbbells,bench',
  toggleEquipment(['dumbbells', 'bands', 'bench'], 'bands').join(',')
);
check(
  'ticking the full gym keeps a bench that was already there',
  toggleEquipment(['bench'], 'fullgym').includes('bench'),
  toggleEquipment(['bench'], 'fullgym').join(',')
);
check(
  'a sheet will not let the last rung come off, and keeps the bench when it refuses',
  (() => {
    const next = toggleEquipment(['dumbbells', 'bench'], 'dumbbells', { keepLastRung: true });
    return next.includes('dumbbells') && next.includes('bench');
  })(),
  toggleEquipment(['dumbbells', 'bench'], 'dumbbells', { keepLastRung: true }).join(',')
);
check(
  'but the bench itself always comes off, because it is not the last rung',
  toggleEquipment(['dumbbells', 'bench'], 'bench', { keepLastRung: true }).join(',') ===
    'dumbbells',
  toggleEquipment(['dumbbells', 'bench'], 'bench', { keepLastRung: true }).join(',')
);
check(
  'the pager, which has a disabled Continue behind it, may be cleared',
  toggleTier(['dumbbells'], 'dumbbells').length === 0,
  toggleTier(['dumbbells'], 'dumbbells').join(',')
);

// ─── 3. It cannot be the whole answer ────────────────────────────────────────
console.log('\n[3] A bench on its own is not an answer to the equipment question');

const page = (equipment) =>
  canContinue(
    'equipment',
    { name: '', age: '', sex: null, bodyweight: '', experience: null, goals: [], equipment },
    'kg'
  );

check('ticking nothing does not get past the page', page([]) === false, '');
check('ticking only the bench does not either', page(['bench']) === false, 'it names no equipment');
check('a rung does', page(['bodyweight']) === true, '');
check('a rung and a bench does', page(['bodyweight', 'bench']) === true, '');
check(
  'hasRung is what says so',
  hasRung(['bench']) === false && hasRung(['bodyweight', 'bench']) === true,
  ''
);

// ─── 4. It survives sign-up and reaches the session ──────────────────────────
console.log('\n[4] A ticked bench changes what somebody is given');

freshAccount();
S().completeOnboarding(
  {
    name: 'Sam',
    sex: 'male',
    ageYears: 40,
    bodyweight: 82,
    weightUnit: 'kg',
    experienceLevel: 'intermediate',
    goals: ['strength'],
    equipmentTiers: ['dumbbells', 'bench'],
    soreRegions: [],
    clinicalAvoid: [],
  },
  '2026-09-20T09:00:00.000Z'
);
check(
  'a bench ticked at sign-up is stored',
  S().equipmentTiers.includes('bench'),
  S().equipmentTiers.join(',')
);
check(
  'and it survives editing the equipment in Profile',
  (() => {
    // The Profile sheet starts from what is stored and toggles a rung.
    let draft = [...S().equipmentTiers];
    draft = toggleEquipment(draft, 'bands', { keepLastRung: true });
    S().setEquipmentTiers(draft);
    return S().equipmentTiers.includes('bench');
  })(),
  S().equipmentTiers.join(',')
);

const withoutBench = LIBRARY_EXERCISES.filter((e) => canPerformWith(e, ['dumbbells']));
const withBench = LIBRARY_EXERCISES.filter((e) => canPerformWith(e, ['dumbbells', 'bench']));
const unlocked = withBench.filter((e) => !withoutBench.includes(e));
check(
  'the tick unlocks real exercises rather than nothing',
  unlocked.length > 0,
  `${unlocked.length} unlocked of ${LIBRARY_EXERCISES.length}`
);
check(
  'and it takes nothing away',
  withoutBench.every((e) => withBench.includes(e)),
  'kit only ever widens what somebody can be given'
);
check(
  'everything it unlocks really does need a bench, a box or a block',
  unlocked.every((e) => e.kit.some((group) => group.some((k) => ['bench', 'box'].includes(k)))),
  unlocked
    .filter((e) => !e.kit.some((group) => group.some((k) => ['bench', 'box'].includes(k))))
    .map((e) => e.libraryName)
    .join(', ')
);
check(
  'the three keys it supplies are the ones decision 6 names',
  (() => {
    const before = ownedKitKeys(['dumbbells']);
    const after = ownedKitKeys(['dumbbells', 'bench']);
    const added = [...after].filter((k) => !before.has(k)).sort();
    return added.join(',') === 'bench,box';
  })(),
  // Blocks are on the always-owned list, so the bench adds the other two.
  [...ownedKitKeys(['dumbbells', 'bench'])].join(',')
);

// ─── Result ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
