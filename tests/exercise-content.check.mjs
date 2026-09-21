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
 *   4. A conditioning session was the same session forever. The database held
 *      exactly one prescribed circuit per equipment tier per energy level, so
 *      whatever the engine did with the order, the exercises never changed:
 *      day-over-day overlap measured 1.000 in all fifteen tier x energy cells.
 *   5. Individual entries described the wrong movement. A "Bicep Stretch"
 *      reported that it worked the thoracic extensors, a Pallof Press reported
 *      pectorals, a Hanging Leg Raise was filed as a vertical pull and offered
 *      alongside pull-ups, and a cool-down stretch was tagged as conditioning,
 *      which filed it into the warm-up block of the custom builder. All of
 *      those are printed on the exercise card or drive which list it appears
 *      in, so every one of them is something a user reads.
 *
 * WHAT COUNTS AS UNTAGGED ON PURPOSE
 * ──────────────────────────────────
 * A cool-down breathing drill genuinely trains no muscle. Tagging it would make
 * the map claim work that never happened, which is the same lie in the other
 * direction. Those are listed below by id, so adding a new one is a deliberate
 * act rather than an omission.
 *
 * WHAT CHANGED WHEN THE OLD CATALOGUE WENT
 * ────────────────────────────────────────
 * Faults 1 to 4 above were all faults in collections this phase deleted, so the
 * evidence for them is history rather than something that can be re-measured.
 * The QUESTIONS are the same and are now asked of what a session is actually
 * built from: Archie's library, his nine conditioning records and Restore.
 * Sections 4 and 7, which were about the weekly pools and the conditioning
 * pools by name, say where their promises moved to.
 *
 * Run:  npx tsx tests/exercise-content.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  getCooldown,
  getStandalonePrehabWorkout,
  getStandaloneFlexibilityWorkout,
  getRegionPrehabWorkout,
  getAllPickableExercises,
  getExerciseTargetRegionsMap,
  getExerciseNameMap,
  getRegionsByExerciseNameMap,
} from '../lib/exercise-db.ts';
import { CONDITIONING_EXERCISES, LIBRARY_EXERCISES } from '../lib/exercise-library.ts';
import { patternGroupOf } from '../lib/exercise-classification.ts';
import { builderCategoryOf } from '../lib/session-builder.ts';

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

// ─── Every exercise a session can contain, with the tiers it serves ──────────
/**
 * THE THREE LISTS, WHICH IS WHAT A SESSION IS BUILT FROM NOW.
 *
 * This used to walk the old Train catalogue pool by pool - PREP, MECHANICAL,
 * NEURO, MAIN_LIFTS, ACCESSORIES, FINISHERS, ORM_TEST, the CONDITIONING pools
 * and the three WEEKLY tables - at three session types and three equipment
 * tiers, because that is where the content being judged lived. All of it is
 * deleted. What a card can hold today is a record on Archie's library, one of
 * his nine conditioning records, or something Restore prescribes.
 *
 * The tiers come from the picker rather than from the filing, because there are
 * no tier-keyed pools left to read them off: getAllPickableExercises works out
 * what each exercise needs and reports the tiers it is available at, which is
 * the same fact the old collections stated by where they put things.
 */
const byId = new Map();
const tiersOf = new Map();
const collectionsOf = new Map();

function record(list, tiers, collection) {
  for (const t of [].concat(list)) {
    if (!t || typeof t.id !== 'string') continue;
    byId.set(t.id, t);
    if (!tiersOf.has(t.id)) tiersOf.set(t.id, new Set());
    if (!collectionsOf.has(t.id)) collectionsOf.set(t.id, new Set());
    for (const tier of tiers ?? []) tiersOf.get(t.id).add(tier);
    collectionsOf.get(t.id).add(collection);
  }
}

record(LIBRARY_EXERCISES, null, 'LIBRARY');
record(CONDITIONING_EXERCISES, null, 'CONDITIONING');
record(getCooldown(), null, 'COOLDOWN');
record(getStandalonePrehabWorkout(), null, 'STANDALONE_PREHAB');
record(getStandaloneFlexibilityWorkout(), null, 'STANDALONE_FLEXIBILITY');
for (const r of painRegions) record(getRegionPrehabWorkout(r), null, 'PREHAB_BY_REGION');
for (const p of getAllPickableExercises()) record(p.template, p.tiers, 'PICKER');

/**
 * Exercises that legitimately train no muscle: the breathing drills that close
 * a session and Restore's own opening instruction. Anything else with an empty
 * array is a miss.
 *
 * It was three times this length and every one of the others belonged to the
 * old catalogue: six cardio-machine warm-ups, twelve conditioning warm-ups,
 * three conditioning cool-downs and nine easy-bucket finishers. They went with
 * the pools. Not one of Archie's nine is on it, which section 4b asserts.
 */
const NO_MUSCLE_ON_PURPOSE = new Set(['cooldown-1', 'fl-s-1', 'ph-s-1']);

// ─── 1. Nothing is silently untagged ─────────────────────────────────────────
console.log('\n[1] Every exercise declares the muscles it trains');

// Read from the map the heatmap itself reads, not from the walk above. Walking
// the getters misses anything a getter does not return — the goal-conditioning
// pool holds two exercises per block and hands out only the first, and both of
// those had slipped through untagged.
const regionMap = getExerciseTargetRegionsMap();
const nameMap = getExerciseNameMap();
const nameRegionMap = getRegionsByExerciseNameMap();

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

/**
 * SECTION 4 WENT WITH THE WEEKLY POOLS IT WAS ABOUT.
 *
 * It asserted that all 48 exercises of WEEKLY_LOWER_BODY, WEEKLY_UPPER_BODY
 * and WEEKLY_FULL_BODY reached the three maps that draw the body, because
 * when this file was written none of them did and a whole upper, lower or
 * full body session lit up nothing at all. Those three tables are deleted:
 * all three session types are built from Archie's library now. The same
 * promise for the records that build them is held by tests/library-only
 * .check.mjs, which asks it of every record the app can serve rather than of
 * one collection.
 */
// ─── 4b. A conditioning session lights up the body ───────────────────────────
console.log('\n[4b] The conditioning session reaches the muscle map');

/**
 * THE NINE ARE THE WHOLE CONDITIONING SESSION NOW, so the map depends on them.
 *
 * It did not used to. The old engine built conditioning out of
 * CONDITIONING_WORKOUTS, and a fair number of those circuits were steady machine
 * cardio that genuinely trains no muscle - they are in NO_MUSCLE_ON_PURPOSE
 * above, and correctly so. A conditioning session could therefore leave the
 * Recover drawing exactly as grey as it found it, which was defensible when it
 * was one card among several and is not when it is the whole session.
 *
 * Archie's nine are all tagged, so the promise is now simply true, and this
 * holds it: finish a conditioning session, any conditioning session, and
 * something shades in. Asked of the map the heatmap itself reads rather than of
 * the records, because the records being right and the map missing them is the
 * exact failure this file was written for.
 */
const conditioningRegions = new Set();
const invisibleNine = [];
const unreachableByName = [];
for (const record of CONDITIONING_EXERCISES) {
  const regions = regionMap[record.id];
  if (!regions || regions.length === 0) invisibleNine.push(`${record.id} (${record.name})`);
  else for (const r of regions) conditioningRegions.add(r);
  if (!nameRegionMap[record.name]) unreachableByName.push(record.name);
}

check(
  `every conditioning exercise shades something in (${CONDITIONING_EXERCISES.length} records)`,
  CONDITIONING_EXERCISES.length === 9 && invisibleNine.length === 0,
  `${invisibleNine.length} contribute nothing: ${invisibleNine.join(', ')} — a whole conditioning session would leave the map grey`
);
check(
  'and every one of them is reachable by name, so a swap keeps its regions',
  unreachableByName.length === 0,
  `${unreachableByName.length} missing: ${unreachableByName.join(', ')}`
);
check(
  `between them they reach ${conditioningRegions.size} regions rather than one corner of the body`,
  conditioningRegions.size >= 8,
  `only: ${[...conditioningRegions].join(', ')}`
);

const nineExcused = CONDITIONING_EXERCISES.filter((e) => NO_MUSCLE_ON_PURPOSE.has(e.id));
check(
  'and not one of them is excused from tagging',
  nineExcused.length === 0,
  `${nineExcused.map((e) => e.name).join(', ')} is on the untagged-on-purpose list, which would hide a real gap`
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

/**
 * SECTION 7 WENT WITH THE CONDITIONING POOLS IT WAS ABOUT.
 *
 * It measured day-over-day overlap across CONDITIONING_WARMUPS,
 * CONDITIONING_WORKOUTS, CONDITIONING_FINISHERS and CONDITIONING_COOLDOWNS,
 * because the database once held exactly one prescribed circuit per tier and
 * energy and a conditioning session was therefore the same session for ever.
 * All four pools are deleted. Conditioning is built from Archie's nine on an
 * interval clock, and the same question - does this session move along, or is
 * it the same one every time - is asked of the real builder in
 * tests/library-conditioning.check.mjs and tests/conditioning-rotation.check.mjs.
 */
// ─── 8. The corrections stay corrected ───────────────────────────────────────
console.log('\n[8] Exercises are filed as the movement they actually are');

const templateById = (id) => byId.get(id);
const named = (rx) => [...byId.values()].filter((t) => rx.test(t.name));

check(
  'the bicep stretch reports a bicep, not a spinal muscle',
  /bicep/i.test(templateById('ph-r-bi-1')?.primaryMuscle ?? ''),
  `ph-r-bi-1 says "${templateById('ph-r-bi-1')?.primaryMuscle}" — that string is printed on the exercise card`
);

const pallof = named(/pallof/i).filter((t) => !/core|abdomin|oblique|transvers/i.test(t.primaryMuscle ?? ''));
check(
  'an anti-rotation press is core work, not chest work',
  pallof.length === 0,
  pallof.map((t) => `${t.id} → ${t.primaryMuscle}`).join(', ')
);

// A hanging leg raise reads as a vertical pull to the classifier the moment its
// movementPattern says 'pull', because the name contains "hang" — which is how
// it came to be offered as pull work in the custom builder.
const legRaises = named(/hanging leg raise/i).filter((t) => patternGroupOf(t) !== 'core');
check(
  'a hanging leg raise is core work, not a vertical pull',
  legRaises.length === 0,
  legRaises.map((t) => `${t.id} → ${patternGroupOf(t)}`).join(', ')
);

// builderCategoryOf sends a cooldown to the cardio block when its
// movementPattern is 'conditioning'. That is right for a cool-down walk and
// wrong for a stretch, which is how a stretch ended up in the warm-up list.
const isStretchOrBreathing = (n) => /stretch/i.test(n) || (/breathing/i.test(n) && !/walk|jog|bike|row/i.test(n));
const strayStretches = [...byId.values()].filter(
  (t) => t.category === 'cooldown' && isStretchOrBreathing(t.name) && builderCategoryOf(t) === 'cardio'
);
check(
  'a cool-down stretch is not offered as a warm-up',
  strayStretches.length === 0,
  strayStretches.map((t) => `${t.id} (${t.name})`).join(', ')
);

const hardCooldowns = [...byId.values()].filter(
  (t) => t.category === 'cooldown' && t.difficulty === 'advanced'
);
check(
  'no cool-down is graded advanced',
  hardCooldowns.length === 0,
  `${hardCooldowns.map((t) => `${t.id} (${t.name})`).join(', ')} — the difficulty badge describes the movement, not the session it closed`
);

/**
 * One movement, one name. "Pull-Up / Chin-Up" was a third catalogue entry for
 * two movements the catalogue already held separately, so the picker showed the
 * same movement three times under two and a half names.
 *
 * Re-pointed at the library's spellings, which are "Pull Ups" and "Chin Ups"
 * without the hyphens. The old three-in-one entry went with the catalogue; what
 * this holds now is the rule that survived it - two separate records, and no
 * third one claiming to be both.
 */
const allNames = new Set([...byId.values()].map((t) => t.name));
const bothAtOnce = [...allNames].filter((n) => /pull[- ]?ups?\s*\/\s*chin[- ]?ups?/i.test(n));
check(
  'a pull-up and a chin-up are two exercises, and neither is called both',
  bothAtOnce.length === 0 && allNames.has('Pull Ups') && allNames.has('Chin Ups'),
  bothAtOnce.length > 0
    ? bothAtOnce.join(', ')
    : 'the library serves them as "Pull Ups" and "Chin Ups" and both have to be there'
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`exercise-content: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`exercise-content: all ${total} checks passed\n`);
  process.exitCode = 0;
}
