/**
 * Contract test: the exercise database describes the exercises honestly.
 *
 * WHAT WENT WRONG
 * ───────────────
 * Three separate faults, all of them things a user sees and none of them
 * anything that would fail to compile:
 *
 *   1. 171 of 661 exercises carried `targetRegions: []`. Every finisher, every
 *      conditioning session and every 1RM test week therefore contributed
 *      nothing to the muscle map on the Recover tab — you could train for a
 *      month and the drawing stayed grey.
 *   2. All 48 weekly-session exercises were missing from the walk lists in
 *      getExerciseTargetRegionsMap, getExerciseCategoryMap and
 *      getRegionsByExerciseNameMap, so an entire upper-body, lower-body or
 *      full-body session lit up nothing at all.
 *   3. Exercises were filed under equipment tiers that could not do them: a
 *      Chin-Up in a REQUIRED slot of every bodyweight weekly session, whose own
 *      alternative also needed a bar; a pull-up bar and a hyperextension bench
 *      in the dumbbells bucket; an ab wheel and a stability ball in the
 *      bodyweight one.
 *
 * The muscle-heatmap coverage test next door already guards MAIN_LIFTS and
 * ACCESSORIES. This one guards everything else, and the equipment promise.
 *
 * WHAT COUNTS AS UNTAGGED ON PURPOSE
 * ──────────────────────────────────
 * A two-minute bike warm-up, a cool-down walk and a breathing drill genuinely
 * train no muscle. Tagging them would make the map claim work that never
 * happened, which is the same lie in the other direction. Those are listed
 * below by id, so adding a new one is a deliberate act rather than an omission.
 *
 * Run:  npx tsx tests/exercise-content.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  CARDIO_WARMUPS,
  getPrep,
  getMechanical,
  getPowerMechanical,
  getNeuro,
  getPowerNeuro,
  getMainLift,
  getAccessories,
  getPrehab,
  getFinisher,
  getCooldown,
  getConditioningWorkout,
  getGoalConditioningBlock,
  get1RMProtocol,
  getStandalonePrehabWorkout,
  getStandaloneFlexibilityWorkout,
  getRegionPrehabWorkout,
  getWeeklyLowerBodyExercises,
  getWeeklyUpperBodyExercises,
  getWeeklyFullBodyExercises,
  getAllPickableExercises,
  getExerciseTargetRegionsMap,
  getExerciseCategoryMap,
  getExerciseNameMap,
  getRegionsByExerciseNameMap,
} from '../lib/exercise-db.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const storeSrc = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
const diagramSrc = readFileSync(join(__dir, '../components/BodyDiagram.tsx'), 'utf8');

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

// ─── The valid regions, read from the source of truth rather than repeated ───
const typeStart = storeSrc.indexOf('export type PainRegion =');
const painRegions = new Set(
  storeSrc
    .slice(storeSrc.indexOf('=', typeStart), storeSrc.indexOf(';', typeStart))
    .split('\n')
    // The union carries a comment quoting a retired region name; reading that
    // as a live region asks the database for a list that no longer exists.
    .filter((l) => !l.trim().startsWith('//'))
    .flatMap((l) => [...l.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
);
const msDecl = diagramSrc.indexOf('const MUSCLE_SET');
const muscleSet = new Set(
  [
    ...diagramSrc
      .slice(diagramSrc.indexOf('[', msDecl), diagramSrc.indexOf(']', msDecl))
      .matchAll(/'([a-z_]+)'/g),
  ].map((m) => m[1])
);

// ─── Every exercise a generated session can contain, with the tiers it serves ─
const SESSIONS = ['squat', 'bench', 'deadlift'];
const TIERS = ['bodyweight', 'dumbbells', 'fullgym'];
const ENERGY = ['easy', 'normal', 'hard'];

const byId = new Map();
const tiersOf = new Map();
const collectionsOf = new Map();

function record(list, tier, collection) {
  for (const t of [].concat(list)) {
    if (!t || typeof t.id !== 'string') continue;
    byId.set(t.id, t);
    if (!tiersOf.has(t.id)) tiersOf.set(t.id, new Set());
    if (!collectionsOf.has(t.id)) collectionsOf.set(t.id, new Set());
    if (tier) tiersOf.get(t.id).add(tier);
    collectionsOf.get(t.id).add(collection);
  }
}

for (const s of SESSIONS) {
  for (const tr of TIERS) {
    record(getPrep(s, tr), tr, 'PREP');
    record(getMechanical(s, tr), tr, 'MECHANICAL');
    record(getPowerMechanical(s, tr), tr, 'POWER_MECHANICAL');
    record(getNeuro(s, tr), tr, 'NEURO');
    record(getPowerNeuro(s, tr), tr, 'POWER_NEURO');
    record(getMainLift(s, tr), tr, 'MAIN_LIFTS');
    record(getAccessories(s, tr), tr, 'ACCESSORIES');
    record(getPrehab(s, tr), tr, 'PREHAB');
    record(get1RMProtocol(s, tr), tr, 'ORM_TEST');
    for (const e of ENERGY) record(getFinisher(s, tr, e), tr, 'FINISHERS');
  }
}
for (const tr of TIERS) {
  for (const e of ENERGY) {
    record(getConditioningWorkout(tr, e), tr, 'CONDITIONING');
    record(getGoalConditioningBlock(tr, e), tr, 'GOAL_CONDITIONING');
  }
  record(getWeeklyLowerBodyExercises(tr), tr, 'WEEKLY_LOWER_BODY');
  record(getWeeklyUpperBodyExercises(tr), tr, 'WEEKLY_UPPER_BODY');
  record(getWeeklyFullBodyExercises(tr), tr, 'WEEKLY_FULL_BODY');
}
record(CARDIO_WARMUPS, null, 'CARDIO_WARMUPS');
record(getCooldown(), null, 'COOLDOWN');
record(getStandalonePrehabWorkout(), null, 'STANDALONE_PREHAB');
record(getStandaloneFlexibilityWorkout(), null, 'STANDALONE_FLEXIBILITY');
for (const r of painRegions) record(getRegionPrehabWorkout(r), null, 'PREHAB_BY_REGION');
for (const p of getAllPickableExercises()) record(p.template, null, 'PICKER');

/**
 * Exercises that legitimately train no muscle: machine and locomotion warm-ups,
 * cool-down walks, breathing drills and the easy-bucket finishers that exist to
 * bring a heart rate down. Anything else with an empty array is a miss.
 */
const NO_MUSCLE_ON_PURPOSE = new Set([
  // Cardio warm-up pool
  'cardio-warmup', 'cardio-warmup-2', 'cardio-warmup-3', 'cardio-warmup-4',
  'cardio-warmup-5', 'cardio-warmup-6',
  // Conditioning session bookends
  'cond-bw-e-1', 'cond-bw-e-6', 'cond-bw-n-1', 'cond-bw-n-5', 'cond-bw-h-1',
  'cond-bw-h-5', 'cond-db-e-1', 'cond-db-e-5', 'cond-db-n-1', 'cond-db-n-5',
  'cond-db-h-1', 'cond-db-h-5', 'cond-fg-e-1', 'cond-fg-e-5', 'cond-fg-n-1',
  'cond-fg-n-5', 'cond-fg-h-1', 'cond-fg-h-5',
  // Steady machine cardio: a heart-rate block, not a training set
  'cond-fg-e-3', 'gcond-fg-e-2', 'sq-fin-db-e', 'sq-fin-fg-e3', 'dl-fin-fg-e2',
  // Easy-bucket finishers that are locomotion or a stretch
  'sq-fin-bw-e', 'sq-fin-bw-e2', 'sq-fin-bw-e3', 'bn-fin-bw-e', 'bn-fin-bw-e2',
  'bn-fin-bw-e3',
  // Breathing, and the rehab session's easy-walk warm-up
  'cooldown-1', 'fl-s-1', 'ph-s-1',
]);

// ─── 1. Nothing is silently untagged ─────────────────────────────────────────
console.log('\n[1] Every exercise declares the muscles it trains');

// Read from the map the heatmap itself reads, not from the walk above. Walking
// the getters misses anything a getter does not return — the goal-conditioning
// pool holds two exercises per block and hands out only the first, and both of
// those had slipped through untagged.
const regionMap = getExerciseTargetRegionsMap();
const nameMap = getExerciseNameMap();
const categoryMap = getExerciseCategoryMap();

const untagged = Object.keys(regionMap).filter(
  (id) => regionMap[id].length === 0 && !NO_MUSCLE_ON_PURPOSE.has(id)
);
check(
  `no exercise has an empty targetRegions outside the ${NO_MUSCLE_ON_PURPOSE.size} listed as untagged on purpose (${Object.keys(regionMap).length} checked)`,
  untagged.length === 0,
  untagged.length
    ? `${untagged.length} untagged: ${untagged
        .slice(0, 8)
        .map((id) => `${id} (${nameMap[id]})`)
        .join(', ')}${untagged.length > 8 ? ' …' : ''} — these contribute nothing to the muscle map`
    : ''
);

const staleAllowances = [...NO_MUSCLE_ON_PURPOSE].filter(
  (id) => regionMap[id] && regionMap[id].length > 0
);
check(
  'the untagged-on-purpose list contains nothing that is now tagged',
  staleAllowances.length === 0,
  `stale entries: ${staleAllowances.join(', ')} — remove them so the list keeps meaning something`
);

// ─── 2. Every region named is a region the app knows ─────────────────────────
console.log('\n[2] Every declared region exists and is spelled right');

const badRegions = [];
for (const [id, regions] of Object.entries(regionMap)) {
  for (const r of regions) if (!painRegions.has(r)) badRegions.push(`${id}:${r}`);
}
check(
  `all ${Object.keys(regionMap).length} exercises name only valid PainRegions`,
  badRegions.length === 0,
  badRegions.join(', ')
);

// ─── 3. Strength work shades a muscle, not only a joint ──────────────────────
console.log('\n[3] Strength and conditioning work shades a muscle');

const MUSCLE_REQUIRED_CATEGORIES = new Set(['main', 'accessory', 'finisher']);
// The body drawing has no deltoid: front_shoulder and rear_shoulder are joints,
// and they are the only regions a lateral raise can honestly claim. Shoulder
// isolation therefore shades the joint and nothing else, by design.
const isDeltoidWork = (t) =>
  /deltoid|shoulder/i.test(t.primaryMuscle ?? '') &&
  (t.targetRegions ?? []).every((r) => r === 'front_shoulder' || r === 'rear_shoulder');

const jointOnly = [...byId.values()].filter(
  (t) =>
    MUSCLE_REQUIRED_CATEGORIES.has(t.category) &&
    !NO_MUSCLE_ON_PURPOSE.has(t.id) &&
    !isDeltoidWork(t) &&
    !(t.targetRegions ?? []).some((r) => muscleSet.has(r))
);
check(
  'every main, accessory and finisher names at least one muscle region',
  jointOnly.length === 0,
  jointOnly.map((t) => `${t.id} (${t.name}) → [${t.targetRegions.join(', ')}]`).join('; ')
);

// ─── 4. The weekly sessions reach the maps that draw the body ────────────────
console.log('\n[4] Weekly sessions are visible to the muscle map');

const nameRegionMap = getRegionsByExerciseNameMap();

const weeklyIds = [...collectionsOf.entries()]
  .filter(([, cols]) => [...cols].some((c) => c.startsWith('WEEKLY_')))
  .map(([id]) => id);

check(
  `all three weekly session pools were found (${weeklyIds.length} exercises)`,
  weeklyIds.length >= 40,
  'the weekly collections moved or shrank — this test is no longer covering them'
);
const missingFromRegionMap = weeklyIds.filter((id) => !regionMap[id]);
check(
  'every weekly-session exercise is in getExerciseTargetRegionsMap',
  missingFromRegionMap.length === 0,
  `${missingFromRegionMap.length} missing (e.g. ${missingFromRegionMap.slice(0, 5).join(', ')}) — an upper, lower or full body session would light up nothing`
);
const missingFromCategoryMap = weeklyIds.filter((id) => !categoryMap[id]);
check(
  'every weekly-session exercise is in getExerciseCategoryMap',
  missingFromCategoryMap.length === 0,
  `${missingFromCategoryMap.length} missing (e.g. ${missingFromCategoryMap.slice(0, 5).join(', ')})`
);
const missingFromNameMap = weeklyIds.filter((id) => {
  const t = byId.get(id);
  return (t.targetRegions?.length ?? 0) > 0 && !nameRegionMap[t.name];
});
check(
  'every weekly-session exercise is reachable by name in getRegionsByExerciseNameMap',
  missingFromNameMap.length === 0,
  `${missingFromNameMap.length} missing (e.g. ${missingFromNameMap.slice(0, 5).join(', ')}) — a swapped exercise would lose its regions`
);

// Same guarantee for every other collection a session can draw from.
const tagged = [...byId.values()].filter((t) => (t.targetRegions?.length ?? 0) > 0);
const notInRegionMap = tagged.filter((t) => !regionMap[t.id] && collectionsOf.get(t.id).size > 0);
check(
  `every tagged exercise a session can contain is in the region map (${tagged.length} checked)`,
  notInRegionMap.length === 0,
  notInRegionMap
    .slice(0, 8)
    .map((t) => `${t.id} (${[...collectionsOf.get(t.id)].join('/')})`)
    .join(', ')
);

// ─── 5. Nobody is handed kit they said they do not have ──────────────────────
console.log('\n[5] Equipment tiers keep their promise');

// `bodyweight` also serves bands-only and true no-equipment users, so anything
// filed there has to be doable with a floor, a wall, a door and some furniture.
// `dumbbells` also serves kettlebell-only users, so a bar or a fixed gym
// machine is out.
const NEEDS_A_BAR = /pull-?up bar|chin-?up|\bpull-?ups?\b|muscle-?up|dead ?hang|hanging (?:leg|knee)/i;
const NEEDS_A_BARBELL = /barbell|\bbar\b(?! at | or )|weight plate|\bplates?\b|landmine|trap bar/i;
const NEEDS_BOUGHT_KIT = /ab wheel|ab roller|stability ball|swiss ball|\bsled\b|prowler|hyperextension|glute ham|battle rope/i;

const describe = (t) => `${t.name} || ${t.suggestedLoad} || ${t.cue} || ${t.reps}`;
const swapText = (t) =>
  t.swapAlternative
    ? `${t.swapAlternative.name} || ${t.swapAlternative.suggestedLoad} || ${t.swapAlternative.cue}`
    : null;

const bodyweightOffenders = [];
for (const [id, tiers] of tiersOf) {
  if (!tiers.has('bodyweight')) continue;
  const t = byId.get(id);
  const text = describe(t);
  if (!NEEDS_A_BAR.test(text) && !NEEDS_BOUGHT_KIT.test(text)) continue;
  // A hand-authored alternative that needs nothing is a real way out.
  const alt = swapText(t);
  const escapes =
    alt !== null && !NEEDS_A_BAR.test(alt) && !NEEDS_BOUGHT_KIT.test(alt) && !/\bband/i.test(alt);
  if (!escapes) bodyweightOffenders.push(`${id} (${t.name})`);
}
check(
  'no bodyweight-tier exercise needs a pull-up bar or bought kit without an equipment-free alternative',
  bodyweightOffenders.length === 0,
  bodyweightOffenders.join(', ')
);

const dumbbellOffenders = [];
for (const [id, tiers] of tiersOf) {
  if (!tiers.has('dumbbells') || tiers.has('bodyweight')) continue;
  const t = byId.get(id);
  const text = describe(t);
  if (NEEDS_A_BAR.test(text) || NEEDS_A_BARBELL.test(text) || /hyperextension|glute ham/i.test(text)) {
    dumbbellOffenders.push(`${id} (${t.name})`);
  }
}
check(
  'no dumbbells-tier exercise needs a pull-up bar, a barbell or a hyperextension bench',
  dumbbellOffenders.length === 0,
  dumbbellOffenders.join(', ')
);

// ─── 6. One name never means two different loads ─────────────────────────────
console.log('\n[6] One name, one exercise');

// getAllPickableExercises de-dupes by NAME and merges the tiers of everything
// sharing one. So two different exercises under one name do not appear twice —
// worse, one of them wins and inherits the other's equipment tiers. That is how
// a 30-60 kg barbell Good Morning came to be offered to people who own nothing.
const loadsByName = new Map();
for (const t of byId.values()) {
  if (!loadsByName.has(t.name)) loadsByName.set(t.name, new Map());
  loadsByName.get(t.name).set(t.suggestedLoad, t.id);
}
// "Bodyweight + 10 kg" and "Bodyweight or 2 kg" are one prescription with an
// optional load, not two exercises — only a load that never mentions bodyweight
// is the loaded half of a collision.
const isBodyweightLoad = (s) => /^bodyweight/i.test(s);
const isLoaded = (s) => !isBodyweightLoad(s) && /\d\s*kg/i.test(s);
const collisions = [];
for (const [name, loads] of loadsByName) {
  const values = [...loads.keys()];
  if (values.some(isBodyweightLoad) && values.some(isLoaded)) {
    collisions.push(`"${name}" (${[...loads.values()].join(' / ')})`);
  }
}
check(
  'no exercise name is used for both a bodyweight movement and a loaded one',
  collisions.length === 0,
  `${collisions.join('; ')} — the picker keeps one template and hands it to both tiers`
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`exercise-content: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`exercise-content: all ${total} checks passed\n`);
  process.exit(0);
}
